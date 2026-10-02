import * as THREE from 'three';
export const ENEMY_FORMATION_TUNING = Object.freeze({
  fadeInDuration: 2,
  squareSize: 0.62,
  typeCScale: 1.5,
  columnSpacing: 0.6,
  verticalSpacing: 0.63,
  formationStepDistance: 0.124,
  formationDropDistance: 0.124,
  formationStepBaseInterval: 1,
  formationStepIntervalReductionPerWave: 0.05,
  minimumFormationStepInterval: 0.2,
  attackerDepartureBaseInterval: 2,
  attackerDepartureIntervalReductionPerWave: 0.05,
  minimumAttackerDepartureInterval: 1,
  attackerDescentSpeed: 2,
  attackerZigzagAngleDegrees: 70,
  attackerFirstShotDelay: 0.2,
  attackerShotInterval: Object.freeze({ A: 3.5, B: 3 }),
  attackerShotIntervalReductionPerWave: 0.05,
  attackerMinimumShotInterval: Object.freeze({ A: 2, B: 1.5 }),
  enemyProjectileSpeed: 5,
  rows: Object.freeze([
    Object.freeze({ type: 'A', count: 9, y: 0.62 }),
    Object.freeze({ type: 'A', count: 9, y: 1.25 }),
    Object.freeze({ type: 'A', count: 9, y: 1.88 }),
    Object.freeze({ type: 'B', count: 7, y: 2.51 }),
    Object.freeze({ type: 'A', count: 5, y: 3.14 }),
    Object.freeze({ type: 'C', count: 2, y: 3.91 }),
  ]),
});

const ENEMY_STYLE = {
  A: {
    outer: 0x601b37,
    body: 0xd3335d,
    light: 0xff6e83,
    shadow: 0x9a2149,
    glint: 0xffd4c8,
    health: 1,
  },
  B: {
    outer: 0x193e37,
    body: 0x43a66c,
    light: 0x9bea83,
    shadow: 0x28704f,
    glint: 0xd7ffab,
    health: 1,
  },
  C: {
    outer: 0x604322,
    body: 0xf0b83e,
    light: 0xffe58a,
    shadow: 0xca822e,
    glint: 0xfff7c9,
    health: 2,
  },
};
const ENEMY_PROJECTILE_COLORS = Object.freeze({ A: 0xd3335d, B: 0x43a66c });

function enemyMaterial(color) {
  return new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, depthWrite: false });
}

function polygon(parent, points, color, z) {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  for (const [x, y] of points.slice(1)) shape.lineTo(x, y);
  shape.closePath();
  const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), enemyMaterial(color));
  mesh.position.z = z;
  parent.add(mesh);
  return mesh;
}

function smoothShell(parent, inset, color, z) {
  const shape = new THREE.Shape();
  const f = (value) => value * inset;
  shape.moveTo(0, f(-0.31));
  shape.lineTo(f(-0.095), f(-0.19));
  shape.quadraticCurveTo(f(-0.21), f(-0.34), f(-0.30), f(-0.27));
  shape.lineTo(f(-0.265), f(-0.11));
  shape.quadraticCurveTo(f(-0.36), f(0.015), f(-0.29), f(0.16));
  shape.quadraticCurveTo(f(-0.22), f(0.31), f(-0.08), f(0.28));
  shape.lineTo(0, f(0.22));
  shape.lineTo(f(0.08), f(0.28));
  shape.quadraticCurveTo(f(0.22), f(0.31), f(0.29), f(0.16));
  shape.quadraticCurveTo(f(0.36), f(0.015), f(0.265), f(-0.11));
  shape.lineTo(f(0.30), f(-0.27));
  shape.quadraticCurveTo(f(0.21), f(-0.34), f(0.095), f(-0.19));
  shape.closePath();
  const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), enemyMaterial(color));
  mesh.position.z = z;
  parent.add(mesh);
  return mesh;
}

function rectangle(parent, x, y, width, height, color, z) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    enemyMaterial(color),
  );
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

function starPoints(radius, innerRadius, pointCount = 8) {
  const points = [];
  for (let index = 0; index < pointCount * 2; index += 1) {
    const angle = -Math.PI / 2 + index * Math.PI / pointCount;
    const distance = index % 2 === 0 ? radius : innerRadius;
    points.push([Math.cos(angle) * distance, Math.sin(angle) * distance]);
  }
  return points;
}

function finishEnemy(enemy, type) {
  const size = ENEMY_FORMATION_TUNING.squareSize * (type === 'C' ? ENEMY_FORMATION_TUNING.typeCScale : 1);
  const style = ENEMY_STYLE[type];
  enemy.name = `Enemy ${type}`;
  enemy.userData.type = type;
  enemy.userData.explosionColor = style.light;
  enemy.userData.projectileColor = ENEMY_PROJECTILE_COLORS[type] ?? style.body;
  enemy.userData.size = size;
  enemy.userData.maxHealth = style.health;
  enemy.userData.health = style.health;
  enemy.userData.active = false;
  enemy.userData.fadeOpacity = 0;
  enemy.userData.damageMaterial = null;
  enemy.userData.getCollisionBounds = () => ({
    left: enemy.position.x - size / 2,
    right: enemy.position.x + size / 2,
    bottom: enemy.position.y - size / 2,
    top: enemy.position.y + size / 2,
  });
  enemy.userData.setFadeOpacity = (opacity) => {
    enemy.userData.fadeOpacity = opacity;
    enemy.traverse((part) => {
      if (part.isMesh) part.material.opacity = opacity;
    });
    enemy.userData.active = opacity >= 1;
  };
  enemy.userData.takeHit = () => {
    enemy.userData.health -= 1;
    if (enemy.userData.damageMaterial && enemy.userData.health === 1) {
      enemy.userData.damageMaterial.color.set(0xff704a);
    }
    return enemy.userData.health <= 0;
  };
  enemy.userData.explosionColor = style.light;
  enemy.traverse((part) => {
    if (part.isMesh) part.material.opacity = 0;
  });
  return enemy;
}

function createEnemyA() {
  const enemy = new THREE.Group();
  const style = ENEMY_STYLE.A;
  smoothShell(enemy, 0.86, style.outer, 0.01);
  smoothShell(enemy, 0.72, style.body, 0.02);
  smoothShell(enemy, 0.5, style.shadow, 0.03);
  polygon(enemy, [[-0.12, 0.15], [-0.19, 0.25], [-0.06, 0.21], [0, 0.12], [0.06, 0.21], [0.19, 0.25], [0.12, 0.15], [0, 0.09]], style.light, 0.04);
  rectangle(enemy, -0.12, -0.045, 0.055, 0.045, style.glint, 0.05);
  rectangle(enemy, 0.12, -0.045, 0.055, 0.045, style.glint, 0.05);
  polygon(enemy, [[-0.05, -0.20], [0, -0.27], [0.05, -0.20], [0, -0.13]], style.light, 0.05);
  return finishEnemy(enemy, 'A');
}

function createEnemyB() {
  const enemy = new THREE.Group();
  const style = ENEMY_STYLE.B;
  polygon(enemy, [
    [-0.23, -0.31], [0.23, -0.31], [0.31, -0.23], [0.31, 0.23],
    [0.23, 0.31], [-0.23, 0.31], [-0.31, 0.23], [-0.31, -0.23],
  ], style.outer, 0.01);
  polygon(enemy, [
    [-0.19, -0.26], [0.19, -0.26], [0.26, -0.19], [0.26, 0.19],
    [0.19, 0.26], [-0.19, 0.26], [-0.26, 0.19], [-0.26, -0.19],
  ], style.body, 0.02);
  rectangle(enemy, 0, 0.03, 0.26, 0.25, style.shadow, 0.03);
  rectangle(enemy, 0, 0.08, 0.15, 0.13, style.light, 0.04);
  rectangle(enemy, -0.105, -0.12, 0.055, 0.055, style.glint, 0.05);
  rectangle(enemy, 0.105, -0.12, 0.055, 0.055, style.glint, 0.05);
  rectangle(enemy, 0, -0.23, 0.18, 0.045, style.shadow, 0.05);
  return finishEnemy(enemy, 'B');
}

function createEnemyC() {
  const enemy = new THREE.Group();
  const style = ENEMY_STYLE.C;
  polygon(enemy, starPoints(0.465, 0.29), style.outer, 0.01);
  polygon(enemy, starPoints(0.395, 0.245), style.body, 0.02);
  polygon(enemy, starPoints(0.255, 0.17), style.shadow, 0.03);
  const core = polygon(enemy, starPoints(0.15, 0.095), style.light, 0.04);
  rectangle(enemy, 0, -0.10, 0.05, 0.055, style.glint, 0.05);
  rectangle(enemy, -0.13, -0.13, 0.055, 0.055, style.glint, 0.05);
  rectangle(enemy, 0.13, -0.13, 0.055, 0.055, style.glint, 0.05);
  finishEnemy(enemy, 'C');
  enemy.userData.damageMaterial = core.material;
  return enemy;
}

function createEnemy(type) {
  if (type === 'A') return createEnemyA();
  if (type === 'B') return createEnemyB();
  return createEnemyC();
}

export function createEnemyFormation({
  columnSpacing = ENEMY_FORMATION_TUNING.columnSpacing,
  verticalSpacing = ENEMY_FORMATION_TUNING.verticalSpacing,
  scale = 1,
} = {}) {
  const enemies = [];
  const topRowIndex = ENEMY_FORMATION_TUNING.rows.length - 1;

  for (const [rowIndex, row] of ENEMY_FORMATION_TUNING.rows.entries()) {
    const rowSpacing = row.type === 'C' ? 1.2 + (columnSpacing - 0.8) : columnSpacing;
    const startX = -((row.count - 1) * rowSpacing) / 2;
    const rowY = row.y + (verticalSpacing - ENEMY_FORMATION_TUNING.verticalSpacing) * (rowIndex - topRowIndex);
    for (let column = 0; column < row.count; column += 1) {
      const enemy = createEnemy(row.type);
      enemy.position.set(startX + column * rowSpacing, rowY, 0);
      enemy.scale.setScalar(scale);
      enemy.userData.formationRow = rowIndex;
      enemy.userData.formationColumn = column;
      enemy.userData.formationMember = true;
      enemy.userData.attacking = false;
      enemies.push(enemy);
    }
  }
  return enemies;
}

function enemyExplosionMaterial(color) {
  return new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, depthWrite: false });
}

export function createEnemyExplosion(x, y, color) {
  const explosion = new THREE.Group();
  explosion.position.set(x, y, 0.3);
  explosion.userData.age = 0;
  explosion.userData.lifetime = 0.24;
  explosion.userData.pieces = [];

  const pieceCount = Math.floor(THREE.MathUtils.randFloat(5, 8));
  for (let index = 0; index < pieceCount; index += 1) {
    const angle = Math.random() * Math.PI * 2;
    const radius = THREE.MathUtils.randFloat(0.025, 0.052);
    const points = index % 2 === 0
      ? [[-radius, -radius], [radius * 0.7, -radius], [radius, radius * 0.6], [-radius * 0.4, radius]]
      : [[-radius * 0.55, -radius], [radius * 0.4, -radius * 0.4], [radius * 0.8, radius], [-radius * 0.2, radius * 0.65]];
    const shape = new THREE.Shape();
    shape.moveTo(points[0][0], points[0][1]);
    for (const [pointX, pointY] of points.slice(1)) shape.lineTo(pointX, pointY);
    shape.closePath();
    const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), enemyExplosionMaterial(color));
    mesh.position.set(0, 0, 0.01 + index * 0.001);
    explosion.add(mesh);
    explosion.userData.pieces.push({
      mesh,
      vx: Math.cos(angle) * THREE.MathUtils.randFloat(0.4, 1.05),
      vy: Math.sin(angle) * THREE.MathUtils.randFloat(0.4, 1.05),
      spin: THREE.MathUtils.randFloat(-9, 9),
    });
  }
  return explosion;
}

export function updateEnemyExplosion(explosion, deltaSeconds) {
  explosion.userData.age += deltaSeconds;
  const progress = Math.min(1, explosion.userData.age / explosion.userData.lifetime);
  for (const piece of explosion.userData.pieces) {
    piece.mesh.position.x += piece.vx * deltaSeconds;
    piece.mesh.position.y += piece.vy * deltaSeconds;
    piece.mesh.rotation.z += piece.spin * deltaSeconds;
    piece.mesh.material.opacity = 0.95 * (1 - progress);
  }
  return progress < 1;
}

export function disposeEnemyObject(object) {
  object.traverse((part) => {
    if (!part.isMesh) return;
    part.geometry.dispose();
    if (Array.isArray(part.material)) {
      for (const material of part.material) material.dispose();
    } else {
      part.material.dispose();
    }
  });
}

export function enemyBoundsOverlap(first, second) {
  return first.left < second.right
    && first.right > second.left
    && first.bottom < second.top
    && first.top > second.bottom;
}
