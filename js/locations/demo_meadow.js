// ПРОБНАЯ ЛОКАЦИЯ «Полянка» — маленькое описание для «движка локаций» (engine/topdown/scene.js).
// Входа из игры нет: она нужна, чтобы движок был проверен делом (автотест dev/smoke.js) и чтобы было с чего
// списывать новые локации. Посмотреть: в консоли браузера __dev.go('demo_meadow').
//
// Здесь есть всё, из чего собирают локацию: карта картинкой из строк, общие виды (трава, тропинка, деревья,
// кусты, цветы), свой вид клетки (клевер) и свой предмет со спрайтом (валун), житель, особое место
// с действием из реестра, находка, зона для предметов заданий, точка входа и выход обратно в город.
import { ell, poly } from '../core/draw.js';
import { OUT, put, defineTiles, defineObjects, createTopDownScene } from '../engine/topdown/index.js';
import './common/index.js';

// свой вид клетки: клевер — трава потемнее, с листиками (зимой под снегом, как и трава)
defineTiles({
  clover: {
    map: (env) => (env.season === 'winter' ? '#eaf4fb' : '#5fbf5a'),
    step: 'step',
    z: 4.5, // слой: поверх травы (4), под тропинкой (5) — см. ground.js
    fill: (env) => (env.season === 'winter' ? '#eaf4fb' : '#67c85e'),
    edge: { wob: 6, in: [[(env) => (env.season === 'winter' ? '#d5e6f3' : '#4fae4a'), 6]] },
    // мелочи клетки: листики клевера (rnd(i) — постоянные «случайные» числа клетки)
    deco(ctx, x, y, tx, ty, env, rnd) {
      if (env.season === 'winter') return;
      for (let i = 0; i < 3; i++) {
        const cx = x + 8 + rnd(i) * 32,
          cy = y + 8 + rnd(i + 7) * 32;
        for (const [dx, dy] of [
          [-3, 0],
          [3, 0],
          [0, -3],
        ])
          ell(ctx, cx + dx, cy + dy, 3, 3, '#2f9e44');
      }
    },
  },
});

// свой предмет: валун. Неподвижный рисунок — в кэш спрайтов (art), draw только ставит его на место.
defineObjects({
  boulder: {
    solid: true,
    art: {
      boulder: [
        [-30, -40, 30, 22],
        (ctx, snow) => {
          ell(ctx, 0, 12, 24, 7, 'rgba(0,0,0,.14)');
          poly(ctx, [-24, 12, -20, -12, -6, -30, 12, -26, 24, -6, 22, 12], '#adb5bd', OUT, 2.5);
          poly(ctx, [-6, -30, 12, -26, 6, -10, -8, -8], '#ced4da');
          if (snow) poly(ctx, [-16, -18, -6, -30, 12, -26, 20, -12, 6, -16, -4, -12], '#fff', '#cfe3f0', 1.5);
        },
      ],
    },
    draw(ctx, o, env) {
      put('boulder', o.x, o.y, env.season === 'winter' ? 1 : 0);
    },
  },
});

export default createTopDownScene({
  id: 'demo_meadow',
  title: 'Полянка',
  bg: '#2f9e44', // цвет за краем карты
  // карта: символ — клетка (и, если надо, предмет на ней), см. legend
  rows: [
    'TPTTPTTTTPTTTPTTTTPT',
    'T....cc.....t......T',
    'P..B.ccc........S..P',
    'T....cc...t........T',
    'T.........===......T',
    'T..t......=.=...B..T',
    'P.........=.=......T',
    'T....B....===..cc..P',
    'T.........==...ccc.T',
    'T..F......==....c..T',
    'P.........==..F....T',
    'T...t.....==.......P',
    'T.........==....t..T',
    'TTPTTTPTTT==TTPTTTTT',
  ],
  legend: {
    '.': 'g', // трава
    '=': 'y', // тропинка
    c: 'clover',
    T: ['g', 'tree'],
    t: ['g', 'tree', { v: 2 }],
    P: ['g', 'pine'],
    B: ['g', 'bush', { v: 1 }],
    F: ['g', 'flowers', { v: 1 }],
    S: ['g', 'boulder'],
  },
  // житель: гуляет возле своего места и никуда не уходит
  actors: [{ npc: 'myata', at: [6, 5] }],
  // особое место: нажми на валун — хомячок подойдёт и посмотрит вдаль (действие 'panorama' из реестра)
  places: [
    {
      id: 'lookout',
      at: [16, 2],
      hit: { dx: 30, up: 46, down: 24 },
      stand: [16.5, 3.5],
      act: 'panorama',
      map: { icon: '🔭', at: [16.5, 2.5], label: '🔭 Валун' },
    },
  ],
  // находка: клубника на клевере, каждый день новая
  pickups: [{ id: 'berry', at: [16, 8], icon: '🍓', give: ['ing', 'strawberry', 1], text: '+1 🍓 Клубника' }],
  // где можно разбросать предметы ежедневного задания (или находки — sc.randomSpots('glade', n, seed))
  zones: { glade: { x: [1, 18], y: [1, 12], tiles: ['g', 'clover'], reach: { from: [11, 11] } } },
  // вход — на тропинке у нижнего края; выход — сама нижняя кромка тропинки: назад в город
  entries: { gate: { at: [11, 11.5] } },
  exits: [{ id: 'town', area: [10, 13, 11, 13], to: 'world', entry: 'forest' }],
});
