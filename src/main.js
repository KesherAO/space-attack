import * as THREE from 'three';
import { GAME_LAYOUT } from './gameConfig.js';
import { createPlayerShip, PLAYER_SHIP_TUNING } from './playerShip.js';
import { createEnemyProjectile, createPhotonTorpedo, disposeProjectile, PHOTON_TORPEDO_TUNING } from './projectile.js';
import { createShipExplosion, disposeShipExplosion, updateShipExplosion } from './explosion.js';
import { renderSpareLives } from './hud.js';
import {
  createEnemyExplosion,
  createEnemyFormation,
  disposeEnemyObject,
  enemyBoundsOverlap,
  ENEMY_FORMATION_TUNING,
  updateEnemyExplosion,
} from './enemies.js';
import './style.css';

const gameFrame = document.querySelector('#game-frame');
const highScoreDisplay = document.querySelector('#high-score');
const currentScoreDisplay = document.querySelector('#current-score');
const waveTimeTrack = document.querySelector('#wave-time-track');
const waveTimeFill = document.querySelector('#wave-time-fill');
const waveNumberDisplay = document.querySelector('#wave-number');
const lifeDisplay = document.querySelector('#life-display');
const titleScreen = document.querySelector('#title-screen');
const tutorialPanel = document.querySelector('#tutorial-panel');
const gameOverPanel = document.querySelector('#game-over');
const restartPrompt = document.querySelector('#restart-prompt');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x080b16);

const camera = new THREE.OrthographicCamera(
  -GAME_LAYOUT.world.width / 2,
  GAME_LAYOUT.world.width / 2,
  GAME_LAYOUT.world.height / 2,
  -GAME_LAYOUT.world.height / 2,
  0.1,
  10,
);
camera.position.z = 1;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.domElement.setAttribute('aria-label', '16:9 game surface');
gameFrame.append(renderer.domElement);

const playerShip = createPlayerShip();
scene.add(playerShip);

const heldDirections = new Set();
const projectiles = new Set();
const explosions = new Set();
let enemies = new Set();
let formationEnemies = new Set();
const enemyExplosions = new Set();
const enemyProjectiles = new Set();
const keyDirections = new Map([
  ['ArrowLeft', -1],
  ['ArrowRight', 1],
]);

let spaceHeld = false;
let nextContinuousShotAt = 0;
let lastShotAt = -Infinity;
let gameState = 'title';
let livesRemaining = 3;
let deathElapsed = 0;
let respawnElapsed = 0;
let gameOverPromptDelay = 0;
let enemyFadeElapsed = 0;
let waveNumber = 0;
let nextWavePending = false;
let formationStepElapsed = 0;
let enemyDepartureElapsed = 0;
let formationDirection = 1;
let waveTimeRemaining = 60;
let waveTimeExpired = false;
const HIGH_SCORE_STORAGE_KEY = 'space-attack-high-score';
const ENEMY_POINTS = Object.freeze({ A: 50, B: 100, C: 500 });
let currentScore = 0;

function loadHighScore() {
  try {
    const savedScore = Number.parseInt(window.localStorage.getItem(HIGH_SCORE_STORAGE_KEY) ?? '0', 10);
    return Number.isFinite(savedScore) && savedScore >= 0 ? savedScore : 0;
  } catch {
    return 0;
  }
}

let highScore = loadHighScore();

function formattedScore(score) {
  return String(score).padStart(7, '0');
}

function renderScores() {
  currentScoreDisplay.value = formattedScore(currentScore);
  highScoreDisplay.value = formattedScore(highScore);
  currentScoreDisplay.textContent = formattedScore(currentScore);
  highScoreDisplay.textContent = formattedScore(highScore);
}

function awardEnemyPoints(enemy) {
  currentScore += ENEMY_POINTS[enemy.userData.type] ?? 0;
  if (currentScore > highScore) {
    highScore = currentScore;
    try {
      window.localStorage.setItem(HIGH_SCORE_STORAGE_KEY, String(highScore));
    } catch {
      // Keep the current session score usable if browser storage is unavailable.
    }
  }
  renderScores();
}

function renderWaveStatus() {
  const fraction = THREE.MathUtils.clamp(waveTimeRemaining / 60, 0, 1);
  waveTimeFill.style.transform = `scaleY(${fraction})`;
  waveTimeFill.classList.toggle('is-urgent', waveTimeRemaining <= 10);
  waveTimeTrack.setAttribute('aria-valuenow', String(Math.ceil(waveTimeRemaining)));
  waveNumberDisplay.textContent = `WAVE ${waveNumber}`;
}

function updateWaveTimer(deltaSeconds) {
  if (gameState !== 'playing' || waveTimeExpired || enemies.size === 0) return;
  if (enemyFadeElapsed < ENEMY_FORMATION_TUNING.fadeInDuration) return;

  waveTimeRemaining = Math.max(0, waveTimeRemaining - deltaSeconds);
  renderWaveStatus();
  if (waveTimeRemaining > 0) return;

  waveTimeExpired = true;
  startPlayerDeath({ greenFire: true });
}

function spareLifeCount() {
  return Math.max(0, livesRemaining - 1);
}

function showSpareLives(blinking = false) {
  renderSpareLives(lifeDisplay, spareLifeCount(), blinking);
}

showSpareLives();
renderScores();

function canControlShip() {
  return gameState === 'tutorial' || gameState === 'playing' || gameState === 'respawning';
}

function fireIfReady(now) {
  if (!canControlShip()) return false;
  if (now - lastShotAt < PHOTON_TORPEDO_TUNING.tapCooldown * 1000) return false;

  const muzzleY = playerShip.position.y + PLAYER_SHIP_TUNING.cannonMuzzleY;
  const projectile = createPhotonTorpedo(playerShip.position.x, muzzleY);
  scene.add(projectile);
  projectiles.add(projectile);
  playerShip.userData.triggerRecoil();
  lastShotAt = now;
  return true;
}

function clearProjectiles() {
  for (const projectile of projectiles) {
    scene.remove(projectile);
    disposeProjectile(projectile);
  }
  projectiles.clear();
}

function clearEnemyProjectiles() {
  for (const projectile of enemyProjectiles) {
    scene.remove(projectile);
    disposeProjectile(projectile);
  }
  enemyProjectiles.clear();
}

function startPlayerDeath({ greenFire = false } = {}) {
  if (gameState !== 'playing') return false;

  const bounds = playerShip.userData.getCollisionBounds();
  const centerX = (bounds.left + bounds.right) / 2;
  const centerY = (bounds.bottom + bounds.top) / 2;
  const explosion = createShipExplosion(centerX, centerY, { greenFire });
  scene.add(explosion);
  explosions.add(explosion);

  gameState = 'dying';
  deathElapsed = 0;
  playerShip.visible = false;
  heldDirections.clear();
  spaceHeld = false;
  clearProjectiles();
  clearEnemyProjectiles();
  showSpareLives(spareLifeCount() > 0);
  return true;
}

playerShip.userData.checkCollision = (otherBounds) => {
  if (gameState !== 'playing' || !playerShip.userData.overlapsBounds(otherBounds)) return false;
  return startPlayerDeath();
};

function restartGame() {
  for (const explosion of explosions) {
    scene.remove(explosion);
    disposeShipExplosion(explosion);
  }
  explosions.clear();
  for (const enemy of enemies) {
    scene.remove(enemy);
    disposeEnemyObject(enemy);
  }
  enemies.clear();
  formationEnemies.clear();
  for (const effect of enemyExplosions) {
    scene.remove(effect);
    disposeEnemyObject(effect);
  }
  enemyExplosions.clear();
  clearEnemyProjectiles();
  waveNumber = 0;
  nextWavePending = false;
  formationStepElapsed = 0;
  enemyDepartureElapsed = 0;
  clearProjectiles();
  heldDirections.clear();
  spaceHeld = false;
  nextContinuousShotAt = 0;
  lastShotAt = -Infinity;
  livesRemaining = 3;
  currentScore = 0;
  renderScores();
  deathElapsed = 0;
  respawnElapsed = 0;
  gameOverPromptDelay = 0;
  gameState = 'playing';
  titleScreen.hidden = true;
  tutorialPanel.hidden = true;
  playerShip.position.x = 0;
  playerShip.visible = true;
  gameOverPanel.hidden = true;
  restartPrompt.hidden = true;
  showSpareLives();
  beginNextWave();
}

function startFromTitle() {
  if (gameState !== 'title') return;
  gameState = 'tutorial';
  currentScore = 0;
  renderScores();
  titleScreen.hidden = true;
  tutorialPanel.hidden = false;
  beginNextWave();
}

function handleKeyDown(event) {
  if (event.code === 'Enter' && (gameState === 'title' || gameState === 'gameOver')) {
    event.preventDefault();
    if (gameState === 'title') startFromTitle();
    else restartGame();
    return;
  }

  if (event.code === 'KeyH' && !event.repeat) {
    event.preventDefault();
    startPlayerDeath();
    return;
  }

  if (event.code === 'Space') {
    event.preventDefault();
    if (!canControlShip()) return;
    if (!spaceHeld) {
      spaceHeld = true;
      const now = performance.now();
      fireIfReady(now);
      if (gameState === 'tutorial') {
        gameState = 'playing';
        tutorialPanel.hidden = true;
      }
      nextContinuousShotAt = now + PHOTON_TORPEDO_TUNING.holdInterval * 1000;
    }
    return;
  }

  const direction = keyDirections.get(event.key);
  if (direction === undefined) return;

  event.preventDefault();
  if (!canControlShip()) return;
  if (!event.repeat) playerShip.userData.moveByTap(direction);
  heldDirections.add(event.key);
}

window.addEventListener('keydown', handleKeyDown);
window.addEventListener('keyup', (event) => {
  if (event.code === 'Space') {
    event.preventDefault();
    spaceHeld = false;
    return;
  }
  if (!keyDirections.has(event.key)) return;
  event.preventDefault();
  heldDirections.delete(event.key);
});

function clearHeldInputs() {
  heldDirections.clear();
  spaceHeld = false;
}

window.addEventListener('blur', clearHeldInputs);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) clearHeldInputs();
});

function fitGameSurface() {
  const aspectRatio = GAME_LAYOUT.aspectRatio;
  const width = Math.min(window.innerWidth, window.innerHeight * aspectRatio);
  const height = width / aspectRatio;
  gameFrame.style.width = `${width}px`;
  gameFrame.style.height = `${height}px`;
  renderer.setSize(width, height);
}

window.addEventListener('resize', fitGameSurface);

function updateExplosions(deltaSeconds) {
  for (const explosion of explosions) {
    if (updateShipExplosion(explosion, deltaSeconds)) continue;
    scene.remove(explosion);
    disposeShipExplosion(explosion);
    explosions.delete(explosion);
  }
}

function updateProjectiles(deltaSeconds) {
  for (const projectile of projectiles) {
    projectile.position.y += projectile.userData.speed * deltaSeconds;
    if (projectile.position.y <= projectile.userData.removeAfterY) continue;
    scene.remove(projectile);
    disposeProjectile(projectile);
    projectiles.delete(projectile);
  }
}

function updateEnemyProjectiles(deltaSeconds) {
  for (const projectile of enemyProjectiles) {
    projectile.position.y -= projectile.userData.speed * deltaSeconds;
    if (projectile.position.y >= GAME_LAYOUT.world.bottom - 0.2) continue;
    scene.remove(projectile);
    disposeProjectile(projectile);
    enemyProjectiles.delete(projectile);
  }
}

function beginNextWave() {
  waveNumber += 1;
  enemyFadeElapsed = 0;
  formationStepElapsed = 0;
  enemyDepartureElapsed = 0;
  formationDirection = Math.random() < 0.5 ? -1 : 1;
  waveTimeRemaining = 60;
  waveTimeExpired = false;
  renderWaveStatus();
  clearEnemyProjectiles();
  enemies = new Set(createEnemyFormation());
  formationEnemies = new Set(enemies);
  for (const enemy of enemies) scene.add(enemy);
}

function attackIntervalForWave() {
  return Math.max(
    ENEMY_FORMATION_TUNING.minimumAttackerDepartureInterval,
    ENEMY_FORMATION_TUNING.attackerDepartureBaseInterval
      - (waveNumber - 1) * ENEMY_FORMATION_TUNING.attackerDepartureIntervalReductionPerWave,
  );
}

function shotIntervalForEnemy(enemy) {
  return Math.max(
    ENEMY_FORMATION_TUNING.attackerMinimumShotInterval[enemy.userData.type],
    ENEMY_FORMATION_TUNING.attackerShotInterval[enemy.userData.type]
      - (waveNumber - 1) * ENEMY_FORMATION_TUNING.attackerShotIntervalReductionPerWave,
  );
}

function formationStepIntervalForWave() {
  return Math.max(
    ENEMY_FORMATION_TUNING.minimumFormationStepInterval,
    ENEMY_FORMATION_TUNING.formationStepBaseInterval
      - (waveNumber - 1) * ENEMY_FORMATION_TUNING.formationStepIntervalReductionPerWave,
  );
}

function exitNextAttacker() {
  const remainingAttackerCandidates = [...formationEnemies].filter((enemy) => (
    enemy.userData.type !== 'C' && enemy.userData.formationRow >= 2
  ));
  const candidates = remainingAttackerCandidates.length > 0
    ? remainingAttackerCandidates
    : [...formationEnemies].filter((enemy) => (
      enemy.userData.type !== 'C' && enemy.userData.formationRow < 2
    ));
  if (candidates.length === 0) return false;

  const enemy = candidates[Math.floor(Math.random() * candidates.length)];
  enemy.userData.formationMember = false;
  enemy.userData.attacking = true;
  enemy.userData.attackDirection = Math.random() < 0.5 ? -1 : 1;
  enemy.userData.shotElapsed = ENEMY_FORMATION_TUNING.attackerFirstShotDelay;
  formationEnemies.delete(enemy);
  return true;
}

function updateFormationMovement(deltaSeconds) {
  formationStepElapsed += deltaSeconds;
  const stepInterval = formationStepIntervalForWave();
  if (formationStepElapsed < stepInterval) return;
  formationStepElapsed -= stepInterval;

  const movementLimitLeft = GAME_LAYOUT.playableArea.left + GAME_LAYOUT.playableArea.width * 0.1;
  const movementLimitRight = GAME_LAYOUT.playableArea.right - GAME_LAYOUT.playableArea.width * 0.1;
  const step = formationDirection * ENEMY_FORMATION_TUNING.formationStepDistance;
  for (const enemy of formationEnemies) enemy.position.x += step;

  const touchedLimit = [...formationEnemies].some((enemy) => {
    const bounds = enemy.userData.getCollisionBounds();
    return bounds.left <= movementLimitLeft || bounds.right >= movementLimitRight;
  });
  if (!touchedLimit) return;

  for (const enemy of formationEnemies) enemy.position.y -= ENEMY_FORMATION_TUNING.formationDropDistance;
  formationDirection *= -1;
}

function updateAttackingEnemies(deltaSeconds) {
  const descentSpeed = ENEMY_FORMATION_TUNING.attackerDescentSpeed;
  const zigzagAngle = THREE.MathUtils.degToRad(ENEMY_FORMATION_TUNING.attackerZigzagAngleDegrees);
  const horizontalSpeed = descentSpeed / Math.tan(zigzagAngle);
  const leftLimit = GAME_LAYOUT.playableArea.left + GAME_LAYOUT.playableArea.width * 0.1;
  const rightLimit = GAME_LAYOUT.playableArea.right - GAME_LAYOUT.playableArea.width * 0.1;

  for (const enemy of enemies) {
    if (!enemy.userData.attacking) continue;

    const nextX = enemy.position.x + enemy.userData.attackDirection * horizontalSpeed * deltaSeconds;
    if (nextX <= leftLimit) {
      enemy.position.x = leftLimit;
      enemy.userData.attackDirection = 1;
    } else if (nextX >= rightLimit) {
      enemy.position.x = rightLimit;
      enemy.userData.attackDirection = -1;
    } else {
      enemy.position.x = nextX;
    }
    enemy.position.y -= descentSpeed * deltaSeconds;
    if (enemy.position.y < GAME_LAYOUT.world.bottom - enemy.userData.size / 2) {
      enemy.position.y = GAME_LAYOUT.world.top + enemy.userData.size / 2;
    }

    enemy.userData.shotElapsed -= deltaSeconds;
    if (enemy.userData.shotElapsed > 0) continue;
    const shotY = enemy.position.y - enemy.userData.size / 2 - 0.06;
    const shot = createEnemyProjectile(
      enemy.position.x,
      shotY,
      enemy.userData.projectileColor,
      ENEMY_FORMATION_TUNING.enemyProjectileSpeed,
    );
    scene.add(shot);
    enemyProjectiles.add(shot);
    enemy.userData.shotElapsed += shotIntervalForEnemy(enemy);
  }
}

function destroyEnemy(enemy) {
  awardEnemyPoints(enemy);
  const burst = createEnemyExplosion(enemy.position.x, enemy.position.y, enemy.userData.explosionColor);
  scene.add(burst);
  enemyExplosions.add(burst);
  scene.remove(enemy);
  disposeEnemyObject(enemy);
  enemies.delete(enemy);
  formationEnemies.delete(enemy);
  if (enemies.size === 0) nextWavePending = true;
}

function checkEnemyCollisions() {
  for (const projectile of [...projectiles]) {
    const projectileBounds = projectile.userData.getCollisionBounds();
    for (const enemy of enemies) {
      if (!enemy.userData.active) continue;
      if (!enemyBoundsOverlap(projectileBounds, enemy.userData.getCollisionBounds())) continue;

      scene.remove(projectile);
      disposeProjectile(projectile);
      projectiles.delete(projectile);
      if (enemy.userData.takeHit()) destroyEnemy(enemy);
      break;
    }
  }

  for (const enemy of enemies) {
    if (!enemy.userData.active) continue;
    if (playerShip.userData.checkCollision(enemy.userData.getCollisionBounds())) break;
  }

  for (const projectile of [...enemyProjectiles]) {
    if (playerShip.userData.checkCollision(projectile.userData.getCollisionBounds())) break;
  }
}

function updateEnemyEffects(deltaSeconds) {
  for (const effect of enemyExplosions) {
    if (updateEnemyExplosion(effect, deltaSeconds)) continue;
    scene.remove(effect);
    disposeEnemyObject(effect);
    enemyExplosions.delete(effect);
  }
}

function updateEnemyFormation(deltaSeconds) {
  if (nextWavePending) {
    nextWavePending = false;
    beginNextWave();
  }

  if (gameState === 'title' || gameState === 'gameOver') return;

  let formationReady = true;
  if (enemies.size > 0 && !enemies.values().next().value.userData.active) {
    enemyFadeElapsed = Math.min(
      ENEMY_FORMATION_TUNING.fadeInDuration,
      enemyFadeElapsed + deltaSeconds,
    );
    const opacity = enemyFadeElapsed / ENEMY_FORMATION_TUNING.fadeInDuration;
    for (const enemy of enemies) enemy.userData.setFadeOpacity(opacity);
    formationReady = opacity >= 1;
  }

  if (gameState === 'tutorial') return;
  updateFormationMovement(deltaSeconds);
  if (!formationReady) return;
  enemyDepartureElapsed += deltaSeconds;
  if (enemyDepartureElapsed >= attackIntervalForWave()) {
    enemyDepartureElapsed -= attackIntervalForWave();
    exitNextAttacker();
  }
  updateAttackingEnemies(deltaSeconds);
}

function updateLifeSequence(deltaSeconds) {
  if (gameState === 'dying') {
    deathElapsed += deltaSeconds;
    if (deathElapsed >= 3) {
      livesRemaining = Math.max(0, livesRemaining - 1);
      showSpareLives();

      if (livesRemaining === 0) {
        gameState = 'gameOver';
        gameOverPanel.hidden = false;
        restartPrompt.hidden = true;
        gameOverPromptDelay = 1;
      } else {
        playerShip.position.x = 0;
        playerShip.visible = true;
        gameState = 'respawning';
        respawnElapsed = 0;
      }
    }
    return;
  }

  if (gameState === 'respawning') {
    respawnElapsed += deltaSeconds;
    playerShip.visible = Math.floor(respawnElapsed / 0.08) % 2 === 0;
    if (respawnElapsed >= 1) {
      gameState = 'playing';
      playerShip.visible = true;
    }
    return;
  }

  if (gameState === 'gameOver' && gameOverPromptDelay > 0) {
    gameOverPromptDelay = Math.max(0, gameOverPromptDelay - deltaSeconds);
    if (gameOverPromptDelay === 0) restartPrompt.hidden = false;
  }
}

let previousFrameTime = 0;
function render() {
  const frameTime = performance.now();
  const deltaSeconds = previousFrameTime === 0
    ? 0
    : Math.min((frameTime - previousFrameTime) / 1000, 0.05);
  previousFrameTime = frameTime;

  if (canControlShip()) {
    const direction = [...heldDirections]
      .reduce((sum, key) => sum + keyDirections.get(key), 0);
    if (direction !== 0) playerShip.userData.moveFor(Math.sign(direction), deltaSeconds);
  }
  playerShip.userData.updateEffects(deltaSeconds);

  if (spaceHeld && frameTime >= nextContinuousShotAt) {
    fireIfReady(frameTime);
    nextContinuousShotAt = frameTime + PHOTON_TORPEDO_TUNING.holdInterval * 1000;
  }

  updateProjectiles(deltaSeconds);
  updateEnemyFormation(deltaSeconds);
  updateWaveTimer(deltaSeconds);
  updateEnemyProjectiles(deltaSeconds);
  checkEnemyCollisions();
  updateEnemyEffects(deltaSeconds);
  updateExplosions(deltaSeconds);
  updateLifeSequence(deltaSeconds);

  renderer.render(scene, camera);
  requestAnimationFrame(render);
}

render();
fitGameSurface();
