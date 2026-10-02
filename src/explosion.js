import * as THREE from 'three';

const FIRE_COLORS = [0xff4f35, 0xff782e, 0xffb33f, 0xffe28a];
const GREEN_FIRE_COLORS = [0x23c95d, 0x47ed77, 0x9cff8c, 0xe3ffb5];
const DEBRIS_COLORS = [0x233751, 0x547c91, 0xb9d5dc, 0xf1a84a];
const rand = (min, max) => min + Math.random() * (max - min);

function irregularPoints(count, radius, variation = 0.38) {
  const points = [];
  const step = (Math.PI * 2) / count;
  for (let index = 0; index < count; index += 1) {
    const angle = -Math.PI / 2 + index * step;
    const distance = radius * rand(1 - variation, 1 + variation);
    points.push([Math.cos(angle) * distance, Math.sin(angle) * distance]);
  }
  return points;
}

function addParticle(explosion, points, color, options) {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  for (const [x, y] of points.slice(1)) shape.lineTo(x, y);
  shape.closePath();

  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: options.opacity ?? 1,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), material);
  mesh.position.set(options.x ?? 0, options.y ?? 0, options.z ?? 0.01);
  explosion.add(mesh);
  explosion.userData.particles.push({
    mesh,
    age: 0,
    life: options.life,
    baseOpacity: options.opacity ?? 1,
    vx: options.vx ?? 0,
    vy: options.vy ?? 0,
    spin: options.spin ?? 0,
    kind: options.kind ?? 'debris',
    startScale: options.startScale ?? 1,
    endScale: options.endScale ?? 0.55,
  });
}

export function createShipExplosion(x, y, { greenFire = false } = {}) {
  const fireColors = greenFire ? GREEN_FIRE_COLORS : FIRE_COLORS;
  const coreFireColor = greenFire ? 0xd9ffb2 : 0xfff0b6;
  const explosion = new THREE.Group();
  explosion.name = 'Player Ship Explosion';
  explosion.position.set(x, y, 0.25);
  explosion.userData.elapsed = 0;
  explosion.userData.duration = 3;
  explosion.userData.particles = [];

  const burstRadius = rand(0.23, 0.36);
  const burstCount = Math.floor(rand(9, 15));
  addParticle(
    explosion,
    irregularPoints(burstCount, burstRadius, 0.48),
    fireColors[Math.floor(rand(1, 3))],
    { kind: 'burst', life: 0.58, opacity: 0.94, startScale: 0.2, endScale: rand(1.45, 2.1), z: 0.02 },
  );
  addParticle(
    explosion,
    irregularPoints(Math.floor(rand(7, 11)), burstRadius * 0.44, 0.3),
    coreFireColor,
    { kind: 'burst', life: 0.26, opacity: 0.96, startScale: 0.25, endScale: 1.1, z: 0.04 },
  );

  const fireCount = Math.floor(rand(12, 19));
  for (let index = 0; index < fireCount; index += 1) {
    const angle = rand(0, Math.PI * 2);
    const speed = rand(0.8, 2.7);
    const length = rand(0.07, 0.18);
    const width = rand(0.035, 0.085);
    const points = [
      [-width / 2, -length / 2],
      [-width * rand(0.15, 0.45), length * 0.15],
      [rand(-width * 0.3, width * 0.3), length / 2],
      [width / 2, -length * 0.2],
    ];
    const color = fireColors[Math.floor(rand(0, fireColors.length))];
    addParticle(explosion, points, color, {
      kind: 'fire',
      x: rand(-0.08, 0.08),
      y: rand(-0.08, 0.08),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      spin: rand(-8, 8),
      life: rand(0.65, 1.65),
      opacity: rand(0.75, 1),
      startScale: rand(0.75, 1.2),
      endScale: 0.15,
      z: 0.06,
    });
  }

  const debrisCount = Math.floor(rand(9, 15));
  for (let index = 0; index < debrisCount; index += 1) {
    const angle = rand(0, Math.PI * 2);
    const speed = rand(0.45, 2.25);
    const size = rand(0.045, 0.11);
    const chamfer = size * rand(0.12, 0.36);
    const points = [
      [-size / 2 + chamfer, -size / 2],
      [size / 2, -size / 2 + chamfer],
      [size / 2 - chamfer, size / 2],
      [-size / 2, size / 2 - chamfer],
    ];
    const color = DEBRIS_COLORS[Math.floor(rand(0, DEBRIS_COLORS.length))];
    addParticle(explosion, points, color, {
      kind: 'debris',
      x: rand(-0.07, 0.07),
      y: rand(-0.07, 0.07),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      spin: rand(-11, 11),
      life: rand(1.1, 2.8),
      opacity: 1,
      startScale: rand(0.8, 1.25),
      endScale: rand(0.45, 0.85),
      z: 0.08,
    });
  }

  return explosion;
}

export function updateShipExplosion(explosion, deltaSeconds) {
  explosion.userData.elapsed += deltaSeconds;
  for (const particle of explosion.userData.particles) {
    particle.age += deltaSeconds;
    if (particle.age >= particle.life) {
      particle.mesh.visible = false;
      continue;
    }

    const progress = particle.age / particle.life;
    particle.mesh.visible = true;
    particle.mesh.position.x += particle.vx * deltaSeconds;
    particle.mesh.position.y += particle.vy * deltaSeconds;
    particle.mesh.rotation.z += particle.spin * deltaSeconds;

    if (particle.kind === 'burst') {
      const easedProgress = 1 - (1 - progress) ** 2;
      const scale = THREE.MathUtils.lerp(particle.startScale, particle.endScale, easedProgress);
      particle.mesh.scale.setScalar(scale);
    } else {
      const scale = THREE.MathUtils.lerp(particle.startScale, particle.endScale, progress);
      particle.mesh.scale.setScalar(scale);
    }

    const fade = progress < 0.5 ? 1 : 1 - (progress - 0.5) / 0.5;
    particle.mesh.material.opacity = particle.baseOpacity * Math.max(0, fade);
  }
  return explosion.userData.elapsed < explosion.userData.duration;
}

export function disposeShipExplosion(explosion) {
  explosion.traverse((part) => {
    if (!part.isMesh) return;
    part.geometry.dispose();
    part.material.dispose();
  });
}
