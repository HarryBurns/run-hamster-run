// Вилла — первый дом на «движке домов» (engine/side). Здесь только описание: этажи, комнаты, встроенные
// предметы, чья мебель. Как это оживает — см. engine/side/scene.js; формат описания — там же в начале файла.
// Мебель виллы лежит в сохранении (state.villa); что стоит в начале игры — START_VILLA в core/state.js.
export default {
  id: 'villa',
  name: 'Моя вилла',
  floors: 3,
  width: 1600,
  lift: true,
  persist: true, // на вилле можно начать игру после перезагрузки
  exit: 'scene:world', // входная дверь ведёт в город
  door: { f: 0, x: 290 },
  furniture: { key: 'villa', editable: true, keepOneBed: true },
  guests: { f: 0, enterX: 300, gap: 70, first: [420, 880], roam: [250, 1540] },
  shell: { wall: '#fff3d6', roof: '#f76e5c', chimneyX: 300, bushes: true },

  rooms: [
    { id: 'wc', f: 0, x0: 0, x1: 220, name: 'Туалет', wall: '#bfe9ff', floor: 'tile', win: null },
    { id: 'living', f: 0, x0: 220, x1: 920, name: 'Гостиная', wall: '#ffe3b3', floor: 'wood', win: 640 },
    { id: 'kitchen', f: 0, x0: 920, x1: 1600, name: 'Кухня', wall: '#d8f5c8', floor: 'check', win: 1500 },
    { id: 'bed1', f: 1, x0: 0, x1: 520, name: 'Моя спальня', wall: '#ffd6e7', floor: 'wood', win: 330, main: true },
    { id: 'bed2', f: 1, x0: 520, x1: 920, name: 'Спальня', wall: '#cfe8ff', floor: 'wood', win: 800 },
    { id: 'bed3', f: 1, x0: 920, x1: 1320, name: 'Спальня', wall: '#d9f7d0', floor: 'wood', win: 1160 },
    { id: 'bath', f: 1, x0: 1320, x1: 1600, name: 'Ванная', wall: '#c5f0f0', floor: 'tile', win: null },
    { id: 'sauna', f: 2, x0: 0, x1: 320, name: 'Сауна', wall: '#e0a86b', floor: 'wood', win: null, paper: 'planks' },
    { id: 'jacuzzi', f: 2, x0: 320, x1: 740, name: 'Джакузи', wall: '#e5dbff', floor: 'tile', win: 640 },
    { id: 'pool', f: 2, x0: 740, x1: 1600, name: 'Бассейн', wall: '#c5f6fa', floor: 'tile', win: null, glass: true },
  ],

  // Встроенные предметы: их нельзя переставить, но с ними можно играть (типы — engine/side/fixtures.js).
  built: [
    { id: 'door', type: 'door', f: 0, x: 285 },
    { id: 'toilet', type: 'toilet', f: 0, x: 62 },
    { id: 'sink_wc', type: 'sink', f: 0, x: 160 },
    { id: 'kitchen', type: 'kitchen', f: 0, x: 1225 }, // плита (готовка) и мойка
    { id: 'bathtub', type: 'bathtub', f: 1, x: 1490 },
    { id: 'sink_b', type: 'sink', f: 1, x: 1362, w: 64 },
    { id: 'sauna', type: 'sauna', f: 2, x: 190 },
    { id: 'jacuzzi', type: 'jacuzzi', f: 2, x: 520 },
    { id: 'pool', type: 'pool', f: 2, x: 1150 },
  ],
};
