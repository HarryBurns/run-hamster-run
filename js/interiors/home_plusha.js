// Дом Плюши: тепло и уютно — кресло-качалка с пледом, камин, чайный столик, на кухне всегда пахнет пирогом.
// Дом жителя: мебель стоит как в описании (переставить нельзя), хозяйка внутри; вход — 'home-of:plusha'.
export default {
  id: 'home_plusha',
  name: 'Домик Плюши',
  owner: 'plusha',
  floors: 1,
  width: 1360,
  maxZoom: 1.1,
  door: { f: 0, x: 110 },
  shell: { wall: '#ffe8cc', roof: '#e8590c', chimneyX: 880, bushes: true },
  rooms: [
    {
      id: 'living',
      f: 0,
      x0: 0,
      x1: 760,
      name: 'Гостиная',
      wall: '#ffe3b3',
      paper: 'flowers',
      floor: 'wood',
      win: 400,
    },
    {
      id: 'kitchen',
      f: 0,
      x0: 760,
      x1: 1360,
      name: 'Кухня',
      wall: '#ffd8c2',
      paper: 'dots',
      floor: 'check',
      win: 1285,
    },
  ],
  built: [
    { id: 'door', type: 'door', f: 0, x: 110, c: '#f76707' },
    {
      id: 'kitchen',
      type: 'kitchen',
      f: 0,
      x: 1040,
      c: '#ffa94d',
      acts: {
        stove: {
          do: 'say',
          text: [
            'На плите у Плюши томится варенье. Мешать можно, облизывать ложку — тоже 🍓',
            'Кастрюлька булькает: буль-буль. Это компот!',
          ],
        },
      },
    },
  ],
  furniture: {
    fixed: [
      ['rug_pink', 0, 400],
      ['clock', 0, 215, 190],
      ['lamp_pink', 0, 195],
      ['rocking_chair', 0, 285],
      ['tea_table', 0, 410],
      ['armchair', 0, 520],
      ['fireplace', 0, 645],
      ['pic_flowers', 0, 645, 190],
      ['teddy', 0, 735],
      ['garland', 0, 545, 228],
      ['fridge_pink', 0, 812],
      ['oven', 0, 1285],
      ['plant_flowers', 0, 1340],
    ],
  },
  actors: [{ npc: 'plusha', f: 0, x: 470, roam: [200, 1220], act: 'host:plusha' }],
};
