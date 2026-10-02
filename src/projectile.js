import * as THREE from 'three';
import { GAME_LAYOUT } from './gameConfig.js';
import { PLAYER_SHIP_TUNING } from './playerShip.js';

export const PHOTON_TORPEDO_TUNING = Object.freeze({
  width: PLAYER_SHIP_TUNING.barrelWidth,
  travelTime: 0.2 / 0.7,
  tapCooldown: 0.2,
  holdInterval: 0.5,
  trailLength: 0.12,
});

function addShape(parent, points, color, z, opacity = 1) {
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
}

export function createPhotonTorpedo(x, y) {
  const torpedo = new THREE.Group();
  const width = PHOTON_TORPEDO_TUNING.width;
  const halfWidth = width / 2;

  const trail = new THREE.Mesh(
    new THREE.PlaneGeometry(width * 0.42, PHOTON_TORPEDO_TUNING.trailLength),
    new THREE.MeshBasicMaterial({
      color: 0x4deaf2,
      opacity: 0.66,
      transparent: true,
      depthWrite: false,
    }),
  );
  trail.position.set(0, -0.13, 0.01);
  torpedo.add(trail);

  addShape(torpedo, [
    [-halfWidth, -0.055], [-halfWidth * 0.68, 0.035], [0, 0.105],
    [halfWidth * 0.68, 0.035], [halfWidth, -0.055], [0, -0.09],
  ], 0x35dfe9, 0.02);
  addShape(torpedo, [
    [-halfWidth * 0.38, -0.025], [0, 0.073], [halfWidth * 0.38, -0.025],
    [0, -0.048],
  ], 0xf1ffff, 0.03);

  torpedo.position.set(x, y, 0.2);
  torpedo.userData.speed = (GAME_LAYOUT.world.top - y) / PHOTON_TORPEDO_TUNING.travelTime;
  torpedo.userData.removeAfterY = GAME_LAYOUT.world.top + PHOTON_TORPEDO_TUNING.trailLength;
  torpedo.userData.getCollisionBounds = () => ({
    left: torpedo.position.x - width / 2,
    right: torpedo.position.x + width / 2,
    bottom: torpedo.position.y - 0.19,
    top: torpedo.position.y + 0.105,
  });
  return torpedo;
}

export function createEnemyProjectile(x, y, color, speed = 5) {
  const shot = new THREE.Group();
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(0.14, 0.25),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.28, depthWrite: false }),
  );
  glow.position.z = 0.005;
  shot.add(glow);

  const bolt = new THREE.Mesh(
    new THREE.PlaneGeometry(0.075, 0.19),
    new THREE.MeshBasicMaterial({ color, depthWrite: false }),
  );
  bolt.position.z = 0.01;
  shot.add(bolt);

  const core = new THREE.Mesh(
    new THREE.PlaneGeometry(0.03, 0.11),
    new THREE.MeshBasicMaterial({ color: 0xfff6e8, depthWrite: false }),
  );
  core.position.z = 0.02;
  shot.add(core);

  shot.position.set(x, y, 0.2);
  shot.userData.speed = speed;
  shot.userData.getCollisionBounds = () => ({
    left: shot.position.x - 0.07,
    right: shot.position.x + 0.07,
    bottom: shot.position.y - 0.125,
    top: shot.position.y + 0.125,
  });
  return shot;
}

export function disposeProjectile(projectile) {
  projectile.traverse((part) => {
    if (!part.isMesh) return;
    part.geometry.dispose();
    if (Array.isArray(part.material)) {
      for (const material of part.material) material.dispose();
    } else {
      part.material.dispose();
    }
  });
}
