// Дом Зефирки: игровая (ящик с игрушками, кукольный домик, лошадка-качалка, шарики) и детская спальня.
// Дом жителя: мебель из описания, хозяйка внутри; вход — 'home-of:zefirka'.
export default {
  id: 'home_zefirka',
  name: 'Домик Зефирки',
  owner: 'zefirka',
  floors: 1,
  width: 1300,
  maxZoom: 1.1,
  door: { f: 0, x: 110 },
  shell: { wall: '#fff0f6', roof: '#f06595', chimneyX: 900, bushes: true },
  rooms: [
    { id: 'play', f: 0, x0: 0, x1: 780, name: 'Игровая', wall: '#ffe3ec', paper: 'dots', floor: 'wood', win: 545 },
    { id: 'bed', f: 0, x0: 780, x1: 1300, name: 'Детская', wall: '#d0bfff', paper: 'stars', floor: 'wood', win: 1150 },
  ],
  built: [{ id: 'door', type: 'door', f: 0, x: 110, c: '#f06595' }],
  furniture: {
    fixed: [
      ['rug_rainbow', 0, 450],
      ['toybox', 0, 230],
      ['shelf', 0, 240, 190],
      ['dollhouse', 0, 375],
      ['garland', 0, 390, 228],
      ['rocking_horse', 0, 545],
      ['balloons', 0, 665],
      ['teddy', 0, 730],
      ['bed_pink', 0, 925],
      ['pic_hamster', 0, 925, 190],
      ['rocket', 0, 1065],
      ['beanbag', 0, 1160],
      ['lamp_pink', 0, 1250],
    ],
  },
  actors: [{ npc: 'zefirka', f: 0, x: 620, roam: [200, 1200], act: 'host:zefirka' }],
};
