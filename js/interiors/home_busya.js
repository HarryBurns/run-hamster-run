// Дом Буси: будуар с туалетным столиком и целая гардеробная — шкафы, вешалка с нарядами, манекен, зеркала.
// Дом жителя: мебель из описания, хозяйка внутри; вход — 'home-of:busya'.
export default {
  id: 'home_busya',
  name: 'Домик Буси',
  owner: 'busya',
  floors: 1,
  width: 1440,
  maxZoom: 1.1,
  door: { f: 0, x: 110 },
  shell: { wall: '#ffdeeb', roof: '#c2255c', chimneyX: null, bushes: true },
  rooms: [
    {
      id: 'boudoir',
      f: 0,
      x0: 0,
      x1: 660,
      name: 'Будуар',
      wall: '#ffdeeb',
      paper: 'diamonds',
      floor: 'wood',
      win: 440,
    },
    { id: 'closet', f: 0, x0: 660, x1: 1440, name: 'Гардеробная', wall: '#e5dbff', floor: 'wood', win: 1365 },
  ],
  built: [{ id: 'door', type: 'door', f: 0, x: 110, c: '#d6336c' }],
  furniture: {
    fixed: [
      ['rug_pink', 0, 440],
      ['vanity', 0, 250],
      ['sofa_purple', 0, 440],
      ['mirror', 0, 562, 190],
      ['lamp_pink', 0, 625],
      ['wardrobe_white', 0, 735],
      ['clothes_rack', 0, 895],
      ['discoball', 0, 895, 205],
      ['mirror', 0, 1020, 150],
      ['mannequin', 0, 1110],
      ['wardrobe', 0, 1230],
      ['beanbag', 0, 1365],
    ],
  },
  actors: [{ npc: 'busya', f: 0, x: 520, roam: [200, 1320], act: 'host:busya' }],
};
