import * as THREE from 'three';
import { GAME_LAYOUT } from './gameConfig.js';

const SHIP_SIZE = Object.freeze({ width: 1.58, height: 1.64 });
const SHIP_SCALE = 0.44;
const SHIP_VISUAL_BOTTOM = -0.62;
const SHIP_TAP_STEP = GAME_LAYOUT.playableArea.width * 0.03;
const SHIP_REFERENCE_CROSSING_TIME = 2.5;
const SHIP_SPEED_MULTIPLIER = 1.1;
const CANNON_BARREL_WIDTH = 0.075;
const CANNON_BASE_Y = 0.82;
const CANNON_MUZZLE_Y = 1.02;

export const PLAYER_SHIP_TUNING = Object.freeze({
  scale: SHIP_SCALE,
  barrelWidth: CANNON_BARREL_WIDTH * SHIP_SCALE,
  cannonMuzzleY: CANNON_MUZZLE_Y * SHIP_SCALE,
});

const colors = {
  outline: 0x101c33,
  hull: 0xb9d5dc,
  hullLight: 0xe4f2e8,
  hullShade: 0x547c91,
  wing: 0x86aebb,
  wingShade: 0x355c78,
  accent: 0xf1a84a,
  accentLight: 0xffd477,
  glass: 0x48d7df,
  engine: 0xff725d,
};

function polygon(points, color, z, parent, opacity = 1) {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  for (const [x, y] of points.slice(1)) shape.lineTo(x, y);
  shape.closePath();

  const mesh = new THREE.Mesh(
    new THREE.ShapeGeometry(shape),
    new THREE.MeshBasicMaterial({
      color,
      opacity,
      transparent: opacity < 1,
      depthWrite: opacity === 1,
    }),
  );
  mesh.position.z = z;
  parent.add(mesh);
  return mesh;
}

function block(width, height, color, x, y, z, parent) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({ color }),
  );
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

function addWing(ship, direction) {
  const mirror = (points) => points.map(([x, y]) => [x * direction, y]);

  polygon(mirror([
    [-0.19, 0.26], [-0.52, 0.38], [-0.79, 0.17], [-0.62, -0.47],
    [-0.39, -0.53], [-0.16, -0.13],
  ]), colors.outline, 0.02, ship);
  polygon(mirror([
    [-0.22, 0.22], [-0.51, 0.31], [-0.72, 0.14], [-0.57, -0.39],
    [-0.40, -0.45], [-0.20, -0.10],
  ]), colors.wing, 0.03, ship);
  polygon(mirror([
    [-0.55, 0.19], [-0.70, 0.10], [-0.57, -0.35], [-0.45, -0.39],
  ]), colors.wingShade, 0.04, ship);

  block(0.17, 0.12, colors.accent, direction * 0.47, 0.04, 0.05, ship);
  block(0.12, 0.08, colors.accentLight, direction * 0.47, 0.04, 0.06, ship);
  block(0.11, 0.16, colors.glass, direction * 0.63, -0.24, 0.05, ship);
  block(0.08, 0.09, colors.hullLight, direction * 0.37, -0.34, 0.05, ship);
}

export function createPlayerShip() {
  const ship = new THREE.Group();
  const art = new THREE.Group();
  const cannon = new THREE.Group();
  ship.name = 'Player Ship';
  art.scale.setScalar(SHIP_SCALE);
  ship.add(art);
  cannon.position.set(0, CANNON_BASE_Y, 0.12);
  art.add(cannon);

  addWing(art, -1);
  addWing(art, 1);

  polygon([
    [-0.19, -0.48], [-0.27, -0.22], [-0.23, 0.42], [-0.12, 0.61],
    [0, 0.84], [0.12, 0.61], [0.23, 0.42], [0.27, -0.22],
    [0.19, -0.48], [0, -0.62],
  ], colors.outline, 0.08, art);
  polygon([
    [-0.15, -0.43], [-0.22, -0.19], [-0.19, 0.39], [-0.10, 0.57],
    [0, 0.76], [0.10, 0.57], [0.19, 0.39], [0.22, -0.19],
    [0.15, -0.43], [0, -0.55],
  ], colors.hull, 0.09, art);

  polygon([
    [-0.11, 0.49], [-0.08, 0.66], [0, 0.82], [0.08, 0.66], [0.11, 0.49],
  ], colors.hullLight, 0.10, art);
  block(CANNON_BARREL_WIDTH, 0.38, colors.accent, 0, 0, 0, cannon);
  block(0.045, 0.28, colors.accentLight, 0, 0.03, 0.01, cannon);
  block(0.12, 0.06, colors.glass, 0, 0.17, 0.02, cannon);

  polygon([
    [-0.12, 0.29], [-0.07, 0.39], [0, 0.43], [0.07, 0.39], [0.12, 0.29],
    [0.08, 0.13], [0, 0.08], [-0.08, 0.13],
  ], colors.hullShade, 0.11, art);
  polygon([
    [-0.07, 0.29], [-0.04, 0.35], [0, 0.38], [0.04, 0.35], [0.07, 0.29],
    [0.05, 0.18], [0, 0.14], [-0.05, 0.18],
  ], colors.glass, 0.12, art);

  block(0.11, 0.18, colors.accent, -0.13, -0.22, 0.10, art);
  block(0.11, 0.18, colors.accent, 0.13, -0.22, 0.10, art);
  block(0.12, 0.12, colors.engine, -0.13, -0.46, 0.11, art);
  block(0.12, 0.12, colors.engine, 0.13, -0.46, 0.11, art);
  block(0.05, 0.08, colors.accentLight, -0.13, -0.46, 0.12, art);
  block(0.05, 0.08, colors.accentLight, 0.13, -0.46, 0.12, art);

  const visualTop = 1.02 * SHIP_SCALE;
  const visualBottom = SHIP_VISUAL_BOTTOM * SHIP_SCALE;
  const hitbox = Object.freeze({
    width: SHIP_SIZE.width * SHIP_SCALE,
    height: SHIP_SIZE.height * SHIP_SCALE,
    offsetY: (visualTop + visualBottom) / 2,
  });
  const verticalMargin = GAME_LAYOUT.world.height * 0.02;
  ship.position.y = GAME_LAYOUT.world.bottom + verticalMargin - visualBottom;

  const minX = GAME_LAYOUT.playableArea.left + hitbox.width / 2;
  const maxX = GAME_LAYOUT.playableArea.right - hitbox.width / 2;
  const movementSpeed = ((GAME_LAYOUT.playableArea.width - SHIP_SIZE.width)
    / SHIP_REFERENCE_CROSSING_TIME) * SHIP_SPEED_MULTIPLIER;
  let recoilTime = 0;

  ship.userData.hitbox = hitbox;
  ship.userData.getCollisionBounds = () => ({
    left: ship.position.x - hitbox.width / 2,
    right: ship.position.x + hitbox.width / 2,
    bottom: ship.position.y + hitbox.offsetY - hitbox.height / 2,
    top: ship.position.y + hitbox.offsetY + hitbox.height / 2,
  });
  ship.userData.overlapsBounds = (bounds) => {
    const own = ship.userData.getCollisionBounds();
    return own.left < bounds.right
      && own.right > bounds.left
      && own.bottom < bounds.top
      && own.top > bounds.bottom;
  };
  ship.userData.moveByTap = (direction) => {
    ship.position.x = THREE.MathUtils.clamp(
      ship.position.x + direction * SHIP_TAP_STEP,
      minX,
      maxX,
    );
  };
  ship.userData.moveFor = (direction, deltaSeconds) => {
    ship.position.x = THREE.MathUtils.clamp(
      ship.position.x + direction * movementSpeed * deltaSeconds,
      minX,
      maxX,
    );
  };
  ship.userData.movement = Object.freeze({
    tapStep: SHIP_TAP_STEP,
    crossingTime: (maxX - minX) / movementSpeed,
    speed: movementSpeed,
    minX,
    maxX,
  });
  ship.userData.scale = SHIP_SCALE;
  ship.userData.visualBounds = Object.freeze({ top: visualTop, bottom: visualBottom });
  ship.userData.triggerRecoil = () => {
    recoilTime = 0.12;
    cannon.position.y = CANNON_BASE_Y - 0.1;
  };
  ship.userData.updateEffects = (deltaSeconds) => {
    recoilTime = Math.max(0, recoilTime - deltaSeconds);
    cannon.position.y = CANNON_BASE_Y - 0.1 * (recoilTime / 0.12);
  };

  return ship;
}
