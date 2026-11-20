// «Движок локаций» одним импортом — для описаний локаций (js/locations/) и занятий (js/features/).
export {
  T,
  OUT,
  PS,
  SP,
  put,
  hash,
  label,
  tileOf,
  doorX,
  TILES,
  defineTiles,
  defineObjects,
  defineBuildings,
  defineArt,
  ART,
} from './kinds.js';
export {
  createTopDownScene,
  locations,
  getLocation,
  homeLocation,
  currentLocation,
  setTargetHook,
  addWorldPart,
} from './scene.js';
export { walkOutWith } from './actors.js';
export { spotlight } from './render.js';
export { inEll } from './map.js';
export { resetGround } from './ground.js';
