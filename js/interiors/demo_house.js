// Пробный домик — маленький дом-описание для проверки «движка домов» (engine/side).
// В игре входа в него нет: его открывают только отладочным вызовом — window.__dev.go('demo_house') —
// и проходит автотест (dev/smoke.js, шаги «пробный дом»).
//
// По устройству это «дом жителя»: одна комната с кухней, мебель стоит как в описании (переставить нельзя),
// внутри хозяйка, с которой можно поговорить; дверь ведёт туда, откуда пришли; своей позиции в сохранении нет.
// Автотест из этого же описания собирает и «своё жильё» — с мебелью в сохранении, режимом «Обустроить»
// и кроватью для сна (см. OWN ниже).
const house = {
  id: 'demo_house',
  name: 'Пробный домик',
  floors: 1,
  width: 1100,
  lift: false,
  maxZoom: 1.1,
  door: { f: 0, x: 120 },
  shell: { wall: '#ffe8cc', roof: '#e8590c', chimneyX: 780, bushes: true },
  rooms: [
    { id: 'room', f: 0, x0: 0, x1: 660, name: 'Комната', wall: '#ffe3b3', floor: 'wood', win: 400 },
    { id: 'kitchen', f: 0, x0: 660, x1: 1100, name: 'Кухня', wall: '#d8f5c8', floor: 'check', win: 1000 },
  ],
  built: [
    { id: 'door', type: 'door', f: 0, x: 110 },
    { id: 'sink', type: 'sink', f: 0, x: 730 },
  ],
  furniture: {
    fixed: [
      ['rug_pink', 0, 300],
      ['sofa_mint', 0, 300],
      ['lamp', 0, 190],
      ['pic_sea', 0, 250, 172],
      ['bed_green', 0, 535], // чужая кровать: лечь спать в ней нельзя
      ['table', 0, 930],
      ['chair', 0, 850],
    ],
  },
  actors: [{ npc: 'plusha', f: 0, x: 430, roam: [230, 1040] }],
};
export default house;

/** То же здание как «своё жильё»: мебель своя (ключ в сохранении), можно обустраивать, спать и звать гостей. */
export const OWN = {
  ...house,
  id: 'demo_flat',
  name: 'Пробная квартира',
  persist: true,
  actors: [],
  furniture: {
    key: 'demo_flat',
    editable: true,
    keepOneBed: true,
    start: [
      ['bed_green', 0, 420],
      ['lamp', 0, 215],
      ['table', 0, 930],
    ],
  },
  guests: { f: 0, enterX: 160, gap: 70, first: [250, 600], roam: [200, 1040] },
};
