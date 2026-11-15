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
  defineTiles,
  defineObjects,
  defineBuildings,
  defineArt,
  ART,
} from './kinds.js';
export { createTopDownScene, locations, getLocation, homeLocation, currentLocation, setTargetHook } from './scene.js';
export { spotlight } from './render.js';
