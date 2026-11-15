// Дом Сени: спортзал (колесо, штанга, груша) и комната чемпиона с кубками.
// Дом жителя: мебель из описания, хозяин внутри; вход — 'home-of:senya'.
export default {
  id: 'home_senya',
  name: 'Домик Сени',
  owner: 'senya',
  floors: 1,
  width: 1400,
  maxZoom: 1.1,
  door: { f: 0, x: 110 },
  shell: { wall: '#e9ecef', roof: '#495057', chimneyX: 980, bushes: true },
  rooms: [
    { id: 'gym', f: 0, x0: 0, x1: 820, name: 'Спортзал', wall: '#dbe4ff', paper: 'brick', floor: 'tile', win: 560 },
    { id: 'room', f: 0, x0: 820, x1: 1400, name: 'Комната чемпиона', wall: '#cfe8ff', floor: 'wood', win: 1170 },
  ],
  built: [{ id: 'door', type: 'door', f: 0, x: 110, c: '#495057' }],
  furniture: {
    fixed: [
      ['wheel', 0, 300],
      ['trophy_shelf', 0, 300, 212],
      ['music', 0, 425],
      ['barbell', 0, 560],
      ['punchbag', 0, 735],
      ['rug_blue', 0, 1000],
      ['bed_blue', 0, 1000],
      ['trophy_shelf', 0, 1000, 185],
      ['cup', 0, 1140],
      ['nightstand', 0, 1205],
      ['aquarium', 0, 1320],
      ['pic_sea', 0, 1320, 185],
    ],
  },
  actors: [{ npc: 'senya', f: 0, x: 650, roam: [200, 1260], act: 'host:senya' }],
};
