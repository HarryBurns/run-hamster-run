// Дом Пончика: почти весь дом — кухня. Гигантский холодильник, духовка, кастрюли на стене и большой стол.
// Дом жителя: мебель из описания, хозяин внутри; вход — 'home-of:ponchik'.
export default {
  id: 'home_ponchik',
  name: 'Домик Пончика',
  owner: 'ponchik',
  floors: 1,
  width: 1500,
  maxZoom: 1.1,
  door: { f: 0, x: 110 },
  shell: { wall: '#d0ebff', roof: '#1971c2', chimneyX: 1100, bushes: true },
  rooms: [
    { id: 'living', f: 0, x0: 0, x1: 540, name: 'Комната', wall: '#d0ebff', paper: 'dots', floor: 'wood', win: 340 },
    {
      id: 'kitchen',
      f: 0,
      x0: 540,
      x1: 1500,
      name: 'Большая кухня',
      wall: '#ffec99',
      paper: 'brick',
      floor: 'check',
      win: 720,
    },
  ],
  built: [
    { id: 'door', type: 'door', f: 0, x: 110, c: '#1c7ed6' },
    {
      id: 'kitchen',
      type: 'kitchen',
      f: 0,
      x: 1175,
      c: '#4dabf7',
      acts: {
        stove: {
          do: 'say',
          text: [
            'У Пончика на плите суп на неделю. Говорит, хватит до вечера 🍲',
            'В кастрюльке что-то булькает и очень вкусно пахнет!',
          ],
        },
      },
    },
  ],
  furniture: {
    fixed: [
      ['rug_blue', 0, 340],
      ['sofa_red', 0, 340],
      ['pic_sun', 0, 215, 190],
      ['beanbag', 0, 480],
      ['chair', 0, 630],
      ['table', 0, 720],
      ['chair', 0, 812],
      ['fridge_giant', 0, 925],
      ['oven', 0, 1420],
      ['pot_rack', 0, 1415, 195],
      ['clock', 0, 808, 205],
    ],
  },
  actors: [{ npc: 'ponchik', f: 0, x: 600, roam: [220, 1330], act: 'host:ponchik' }],
};
