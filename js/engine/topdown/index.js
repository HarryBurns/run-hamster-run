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
  defineTiles,
  defineObjects,
  defineBuildings,
  defineArt,
} from './kinds.js';
export { createTopDownScene, locations, getLocation, homeLocation, currentLocation } from './scene.js';
export { spotlight } from './render.js';
