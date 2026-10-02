const aspectRatio = 16 / 9;
const worldHeight = 9;
const worldWidth = worldHeight * aspectRatio;

export const GAME_LAYOUT = Object.freeze({
  aspectRatio,
  world: Object.freeze({
    width: worldWidth,
    height: worldHeight,
    left: -worldWidth / 2,
    right: worldWidth / 2,
    top: worldHeight / 2,
    bottom: -worldHeight / 2,
  }),
  playableArea: Object.freeze({
    left: -worldWidth / 4,
    right: worldWidth / 4,
    width: worldWidth / 2,
  }),
});
