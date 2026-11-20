// Вилла — первый дом на «движке домов» (engine/side). Здесь только описание: этажи, комнаты, встроенные
// предметы, чья мебель. Как это оживает — см. engine/side/scene.js; формат описания — там же в начале файла.
// Мебель виллы лежит в сохранении (state.villa); что стоит в начале игры — START_VILLA в core/save.js.
//
// «ВИЛЛА РАСТЁТ» (docs/DESIGN.md): дом начинается маленьким и достраивается (ступени — VILLA_UPS в data/estate.js,
// что построено — state.villaUp.house). У каждой ступени своё описание — VILLA_STAGES; сцена одна ('villa'): поле
// variant() говорит движку, какое описание сейчас (scene.js пересобирает дом при входе и когда строители закончили).
//   0  домик: душевая и комната с плиткой, без лифта          3  третий этаж: сауна, джакузи, бассейн (вилла, как была)
//   1  пристройка: туалет, гостиная, кухня (первый этаж виллы) 4  мансарда и открытая терраса под крышей
//   2  второй этаж: три спальни, ванная, лифт
// Левая часть домика — как у виллы (душевая на месте туалета, дверь там же): мебель при пристройке остаётся на местах.
import { villaStage } from '../core/state.js';

const base = {
  id: 'villa',
  persist: true, // на вилле можно начать игру после перезагрузки
  exit: 'scene:world', // входная дверь ведёт в город
  door: { f: 0, x: 290 },
  furniture: { key: 'villa', editable: true, keepOneBed: true },
  shell: { wall: '#fff3d6', roof: '#f76e5c', chimneyX: 300, bushes: true },
  variant: () => VILLA_STAGES[villaStage()] || VILLA_STAGES[3],
};

// ---- комнаты по этажам ----
const FLOOR0 = [
  { id: 'wc', f: 0, x0: 0, x1: 220, name: 'Туалет', wall: '#bfe9ff', floor: 'tile', win: null },
  { id: 'living', f: 0, x0: 220, x1: 920, name: 'Гостиная', wall: '#ffe3b3', floor: 'wood', win: 640 },
  { id: 'kitchen', f: 0, x0: 920, x1: 1600, name: 'Кухня', wall: '#d8f5c8', floor: 'check', win: 1500 },
];
const FLOOR1 = [
  { id: 'bed1', f: 1, x0: 0, x1: 520, name: 'Моя спальня', wall: '#ffd6e7', floor: 'wood', win: 330, main: true },
  { id: 'bed2', f: 1, x0: 520, x1: 920, name: 'Спальня', wall: '#cfe8ff', floor: 'wood', win: 800 },
  { id: 'bed3', f: 1, x0: 920, x1: 1320, name: 'Спальня', wall: '#d9f7d0', floor: 'wood', win: 1160 },
  { id: 'bath', f: 1, x0: 1320, x1: 1600, name: 'Ванная', wall: '#c5f0f0', floor: 'tile', win: null },
];
const FLOOR2 = [
  { id: 'sauna', f: 2, x0: 0, x1: 320, name: 'Сауна', wall: '#e0a86b', floor: 'wood', win: null, paper: 'planks' },
  { id: 'jacuzzi', f: 2, x0: 320, x1: 740, name: 'Джакузи', wall: '#e5dbff', floor: 'tile', win: 640 },
  { id: 'pool', f: 2, x0: 740, x1: 1600, name: 'Бассейн', wall: '#c5f6fa', floor: 'tile', win: null, glass: true },
];
const FLOOR3 = [
  { id: 'attic', f: 3, x0: 0, x1: 640, name: 'Мансарда', wall: '#ffec99', paper: 'stars', floor: 'wood', win: 320 },
  { id: 'terrace', f: 3, x0: 640, x1: 1600, name: 'Терраса', wall: '#c9ecff', paper: 'open', floor: 'deck', win: null },
];
// ---- встроенные предметы: их нельзя переставить, но с ними можно играть (типы — engine/side/fixtures.js) ----
const BUILT0 = [
  { id: 'door', type: 'door', f: 0, x: 285 },
  { id: 'toilet', type: 'toilet', f: 0, x: 62 },
  { id: 'sink_wc', type: 'sink', f: 0, x: 160 },
  { id: 'kitchen', type: 'kitchen', f: 0, x: 1225 }, // плита (готовка) и мойка
];
const BUILT1 = [
  { id: 'bathtub', type: 'bathtub', f: 1, x: 1490 },
  { id: 'sink_b', type: 'sink', f: 1, x: 1362, w: 64 },
];
const BUILT2 = [
  { id: 'sauna', type: 'sauna', f: 2, x: 190 },
  { id: 'jacuzzi', type: 'jacuzzi', f: 2, x: 520 },
  { id: 'pool', type: 'pool', f: 2, x: 1150 },
];
const GUESTS = { f: 0, enterX: 300, gap: 70, first: [420, 880], roam: [250, 1540] };

/** Описания дома по ступеням (state.villaUp.house). */
export const VILLA_STAGES = [
  {
    ...base,
    name: 'Мой домик',
    floors: 1,
    width: 1000,
    lift: false,
    guests: { f: 0, enterX: 300, gap: 70, first: [420, 860], roam: [250, 950] },
    rooms: [
      { id: 'wc', f: 0, x0: 0, x1: 220, name: 'Душевая', wall: '#bfe9ff', floor: 'tile', win: null },
      { id: 'living', f: 0, x0: 220, x1: 1000, name: 'Комната', wall: '#ffe3b3', floor: 'wood', win: 640, main: true },
    ],
    built: [
      { id: 'door', type: 'door', f: 0, x: 285 },
      { id: 'sink_wc', type: 'sink', f: 0, x: 160 },
      { id: 'stove', type: 'stove', f: 0, x: 934 }, // плитка: готовить можно с первого дня
    ],
  },
  {
    ...base,
    name: 'Мой дом',
    floors: 1,
    width: 1600,
    lift: false,
    guests: GUESTS,
    rooms: FLOOR0.map((r) => (r.id === 'living' ? { ...r, main: true } : r)),
    built: BUILT0,
  },
  {
    ...base,
    name: 'Мой дом',
    floors: 2,
    width: 1600,
    lift: true,
    guests: GUESTS,
    rooms: [...FLOOR0, ...FLOOR1],
    built: [...BUILT0, ...BUILT1],
  },
  {
    ...base,
    name: 'Моя вилла',
    floors: 3,
    width: 1600,
    lift: true,
    guests: GUESTS,
    rooms: [...FLOOR0, ...FLOOR1, ...FLOOR2],
    built: [...BUILT0, ...BUILT1, ...BUILT2],
  },
  {
    ...base,
    name: 'Моя вилла',
    floors: 4,
    width: 1600,
    lift: true,
    fitMin: 0.52, // на компьютере четыре этажа видны целиком (иначе камера следит за хомячком, как в отеле)
    guests: GUESTS,
    rooms: [...FLOOR0, ...FLOOR1, ...FLOOR2, ...FLOOR3],
    built: [...BUILT0, ...BUILT1, ...BUILT2],
  },
];

/** Вилла целиком, как до «Вилла растёт» (три этажа): для списков домов; в игре — VILLA_STAGES[ступень] (variant). */
export default VILLA_STAGES[3];
