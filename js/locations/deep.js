// НИЖНИЙ ЯРУС ПЕЩЕР — «Подземная река» (П4, этап 17в). Описание для «движка локаций»; рецепт — docs/ARCHITECTURE.md,
// раздел 9; образец — пещеры (раздел 16, тёмная локация). Рисунки — deep_art.js (и общие с пещерами — caves_art.js).
//
// Как устроена: карта 38 × 26 правилами (build): вся она — толща скалы; через неё слева направо течёт река (RIVER —
// ломаная середины, полуширина RW). Сверху слева — площадка под верёвочной лестницей (спуск из шахты Камушкина,
// люк ropeHole в пещерах) и западные мостки с лодочкой; справа внизу — восточные мостки и кристальный грот
// с находками. Берега реки — скала: от мостков до мостков только по воде. Вдоль реки на уступах светятся грибы
// и кристаллы.
//
// Лодочка: нажми на неё у мостков — садишься, и течение несёт её по реке (ride: герой «едет» — sc.p.ride, путь
// ведёт крюк update: PATH по клеткам, сам хомячок не рулит). Доплыла — выходишь на другом берегу. Обратно —
// против течения, вдоль берега (быстрее: Камушкин натянул верёвку). Первая поездка вниз — наклейка x_river.
// Находки грота — один раз за игру (pickups once): пещерная жемчужина и светящийся камушек (data/finds.js, вид deep).
// Сохранение не менялось: лодочка стоит там, где хомячок (определяется при входе), подсказка — flags.deepHint.
import { G } from '../core/state.js';
import { award } from '../core/actions.js';
import { go } from '../core/loop.js';
import { sfx } from '../core/audio.js';
import { emit } from '../core/events.js';
import { toast, hintOnce } from '../ui/toast.js';
import { clamp, seeded } from '../core/util.js';
import { ell } from '../core/draw.js';
import { T, createTopDownScene, inEll } from '../engine/topdown/index.js';
import { drawRowboat, boatLampAt } from './deep_art.js';
import './caves_art.js';
import './common/index.js';

const W = 38,
  H = 26;
/** Середина реки (клетки) и её полуширина. */
const RIVER = [
  [0, 12.6],
  [6, 13],
  [11, 11.7],
  [16, 12.3],
  [21, 14.1],
  [26, 13.4],
  [31, 12.6],
  [38, 13],
];
const RW = 1.45;
// залы: [cx, cy, rx, ry] в клетках
const CHAMBERS = {
  landing: [7, 5.2, 4.6, 3.2], // площадка под лестницей
  west: [6.5, 10, 4, 1.8], // западный берег с мостками
  east: [31, 15.6, 3.8, 1.8], // восточный берег с мостками
  grotto: [30, 20.5, 5.5, 3.2], // кристальный грот
};
export const AT = {
  ladder: [7, 3], // лестница из люка в своде
  pierW: [7, 12], // мостки на воде
  pierE: [31, 13],
  boatW: [5.2, 13.1], // где ждёт лодочка (точка, клетки)
  boatE: [33, 13.1],
  landW: [5.6, 11.5], // куда выходишь из лодочки
  landE: [32.6, 14.6],
};
/** Путь лодочки вниз по течению (клетки): от западных мостков к восточным. */
const PATH = [
  AT.boatW,
  [8.5, 12.7],
  [11, 11.9],
  [13.5, 11.8],
  [16, 12.4],
  [18.5, 13.4],
  [21, 14.1],
  [23.5, 13.9],
  [26, 13.4],
  [29, 12.8],
  AT.boatE,
];
const SPEED = { down: 88, up: 150 }; // вниз — течение несёт неспешно (смотреть по сторонам), обратно — вдоль верёвки
/** Находки грота (один раз за игру). */
const FINDS_AT = [
  {
    id: 'cave_pearl',
    at: [27, 21],
    icon: '🔮',
    text: '+1 🔮 Пещерная жемчужина! Гладкая и тёплая — светится в темноте.',
  },
  { id: 'glow_pebble', at: [33, 22], icon: '💠', text: '+1 💠 Светящийся камушек! Им можно освещать дорогу.' },
];

// ---------- карта ----------
/** Расстояние от середины клетки до середины реки (в клетках) и её y на этом x. */
function riverAt(x) {
  const px = x + 0.5;
  for (let i = 1; i < RIVER.length; i++) {
    const [ax, ay] = RIVER[i - 1],
      [bx, by] = RIVER[i];
    if (px >= ax && px <= bx) return ay + ((by - ay) * (px - ax)) / (bx - ax);
  }
  return RIVER[RIVER.length - 1][1];
}
const isWater = (x, y) => Math.abs(y + 0.5 - riverAt(x)) <= RW;
const isRock = (m, x, y) => x < 0 || y < 0 || x >= W || y >= H || m.at(x, y) === 'caveWall';

function build(m) {
  const rnd = seeded(7741);
  // 1. залы, проход от лестницы к мосткам, река
  for (let y = 1; y < H - 1; y++)
    for (let x = 1; x < W - 1; x++) if (Object.values(CHAMBERS).some((c) => inEll(x, y, c))) m.set(x, y, 'caveFloor');
  for (let y = 7; y <= 10; y++) for (let x = 6; x <= 7; x++) m.set(x, y, 'caveFloor');
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (isWater(x, y)) m.set(x, y, 'deepRiver');
  // 2. уступы над водой: на них светятся грибы и кристаллы (до них не дойти — только любоваться с лодочки)
  const ledges = [];
  for (let x = 10, k = 0; x <= 28; x += 3, k++) {
    const c = riverAt(x),
      up = k % 2 === 0;
    const y = up ? Math.floor(c - RW - 0.5) : Math.ceil(c + RW - 0.5);
    if (y > 1 && y < H - 2 && m.at(x, y) === 'caveWall') {
      m.set(x, y, 'caveFloor');
      ledges.push([x, y, k]);
    }
  }
  // 3. стена «лицом» к нам — на скале, под которой пол или вода
  const face = (x, y) => isRock(m, x, y) && y >= 0 && y < H - 1 && !isRock(m, x, y + 1);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!face(x, y)) continue;
      const ends = (face(x - 1, y) ? 0 : 1) | (face(x + 1, y) ? 0 : 2);
      const r = rnd();
      m.add('caveFace', x, y, { v: r < 0.35 ? 1 : r < 0.55 ? 2 : r < 0.7 ? 3 : 0, ends });
    }
  // 4. что где стоит
  m.put1('ropeLadder', ...AT.ladder);
  m.put1('deepPier', ...AT.pierW, { v: 0 });
  m.put1('deepPier', ...AT.pierE, { v: 1 });
  ledges.forEach(([x, y, k]) => m.put1(k % 3 === 1 ? 'crystals' : 'glowShroom', x, y, { v: k }));
  // грот: кристаллы по стенам, грибы, колонна
  for (const [type, x, y, v] of [
    ['crystals', 26, 19, 0],
    ['crystals', 34, 20, 1],
    ['crystals', 29, 23, 2],
    ['crystals', 32, 18, 0],
    ['glowShroom', 25, 21, 1],
    ['glowShroom', 30, 22, 0],
    ['glowShroom', 35, 21, 1],
    ['column', 30, 19, 0],
    ['glowShroom', 4, 5, 0],
    ['glowShroom', 10, 6, 1],
    ['crystals', 11, 4, 2],
    ['stalagmite', 3, 7, 1],
    ['stalagmite', 10, 3, 0],
  ])
    if (m.at(x, y) === 'caveFloor') m.put1(type, x, y, { v });
}

// ---------- лодочка ----------
let boatAt = 'west', // где ждёт лодочка: west | east
  ride = null, // поездка: { down, pts, i, dir, sfxT }
  sparks = []; // огоньки над водой: { x, y, ph }
/** Хомячок сейчас плывёт в лодочке. */
export const riding = () => !!ride;
/** Где лодочка (для тестов): 'west' | 'east' | 'ride'. */
export const boatWhere = () => (ride ? 'ride' : boatAt);
const RIDE = {
  id: 'deepBoat',
  speed: 0,
  pass: () => false, // сама не рулишь: лодочку несёт течение (путь ведёт крюк update)
  draw: (ctx, s, p, t, look) => drawRowboat(ctx, p.x, p.y, ride ? ride.dir : p.dir || 1, t, look, !!ride),
};
/** Сесть в лодочку и поплыть: down — вниз по течению (с запада на восток). */
function startRide(sc, down) {
  if (ride) return;
  const p = sc.p;
  const pts = (down ? PATH : PATH.slice().reverse()).map(([x, y]) => ({ x: x * T, y: y * T }));
  ride = { down, pts, i: 1, dir: down ? 1 : -1, sfxT: 0 };
  p.ride = RIDE;
  p.path = [];
  p.pending = null;
  p.x = pts[0].x;
  p.y = pts[0].y;
  p.dir = ride.dir;
  sfx('splash');
  if (down && !G.state.flags.deepRide)
    toast('🛶 Течение подхватило лодочку! Смотри по сторонам — грибы и кристаллы светятся!');
  emit('hud');
}
/** Доплыли: выйти на берег. */
function endRide(sc) {
  const p = sc.p,
    down = ride.down;
  ride = null;
  p.ride = null;
  p.path = [];
  p.moving = false;
  const [lx, ly] = down ? AT.landE : AT.landW;
  p.x = lx * T;
  p.y = ly * T;
  boatAt = down ? 'east' : 'west';
  sfx('ok');
  emit('deep', { what: down ? 'ride' : 'back' });
  if (down) {
    award('x_river');
    hintOnce('deepRide', 'Приплыли! Здесь — кристальный грот. Поищи, что блестит! ✨');
  }
  emit('hud');
}
function updateRide(sc, dt) {
  const p = sc.p;
  let step = (ride.down ? SPEED.down : SPEED.up) * dt;
  while (ride && step > 0) {
    const t = ride.pts[ride.i],
      dx = t.x - p.x,
      dy = t.y - p.y,
      d = Math.hypot(dx, dy);
    if (d > step) {
      p.x += (dx / d) * step;
      p.y += (dy / d) * step;
      step = 0;
    } else {
      p.x = t.x;
      p.y = t.y;
      step -= d;
      ride.i++;
      if (ride.i >= ride.pts.length) endRide(sc);
    }
  }
  if (!ride) return;
  p.path = [];
  p.moving = true;
  p.walkT += dt * 2;
  ride.sfxT -= dt;
  if (ride.sfxT <= 0) {
    ride.sfxT = 1.1;
    sfx('paddle');
  }
}

// ---------- описание ----------
const gloomLights = [];
const deep = createTopDownScene({
  id: 'deep', // имя сцены лежит в сохранениях: { scene: 'deep', x, y } — не менять
  title: 'Подземная река',
  w: W,
  h: H,
  base: 'caveWall',
  bg: '#1f2733',
  sky: false,
  dark: 0,
  season: 'summer', // сезонов под землёй нет
  build,
  places: [
    {
      id: 'ladder',
      at: AT.ladder,
      hit: { dx: 40, up: 150, down: 26 },
      stand: [AT.ladder[0] + 0.5, AT.ladder[1] + 1.6],
      use() {
        sfx('tap');
        go('caves', { at: 'ladder' });
      },
      map: { icon: '🪜', at: [AT.ladder[0] + 0.5, AT.ladder[1] + 0.5], label: '🪜 Лестница наверх' },
    },
    {
      id: 'boatW',
      at: [Math.floor(AT.boatW[0]), Math.floor(AT.boatW[1])],
      hit: { r: 64 },
      stand: AT.landW,
      reach: 1.6,
      key: false,
      when: () => boatAt === 'west' && !ride,
      use: (sc) => startRide(sc, true),
      map: { icon: '🛶', at: [AT.boatW[0], AT.boatW[1] - 0.4], label: '🛶 Лодочка' },
    },
    {
      id: 'boatE',
      at: [Math.floor(AT.boatE[0]), Math.floor(AT.boatE[1])],
      hit: { r: 64 },
      stand: AT.landE,
      reach: 1.6,
      key: false,
      when: () => boatAt === 'east' && !ride,
      use: (sc) => startRide(sc, false),
    },
  ],
  pickups: FINDS_AT.map((f) => ({
    id: f.id,
    at: f.at,
    icon: f.icon,
    give: ['finds', f.id, 1],
    text: f.text,
    once: true,
  })),
  spots: {
    grotto: { at: [30, 21], label: '💎 Кристальный грот' },
  },
  // спуск — по верёвочной лестнице из люка в шахте Камушкина (way:deep в пещерах); наверх — лестница (место ladder)
  entries: { ladder: { at: [AT.ladder[0] + 0.5, AT.ladder[1] + 1.7] } },
  exits: [],
  built(sc) {
    // клетки, до которых от лестницы или от восточных мостков не дойти пешком, — закрыть (уступы над водой)
    sc.map.sealFrom([
      [Math.floor(AT.ladder[0]), AT.ladder[1] + 2],
      [Math.floor(AT.landE[0]), Math.floor(AT.landE[1])],
    ]);
    // огоньки над рекой: висят над водой и тихо мерцают
    const r = seeded(99);
    sparks = Array.from({ length: 34 }, () => {
      const x = 3 + r() * 32;
      return { x: x * T, y: (riverAt(Math.floor(x)) + (r() - 0.5) * 2.2) * T - 30, ph: r() * 6 };
    });
  },
  enter(sc) {
    ride = null;
    sc.p.ride = null;
    boatAt = sc.p.x > 20 * T ? 'east' : 'west';
    // сохранились посреди поездки (стоим на реке): выходим на тот берег, где ждёт лодочка, — иначе движок поставил
    // бы на ближайшую сушу, и хомячок с лодочкой могли оказаться на разных берегах
    const tx = Math.floor(sc.p.x / T),
      ty = Math.floor(sc.p.y / T);
    if (sc.map.inside(sc.p.x, sc.p.y) && isWater(tx, ty) && !sc.map.foot(tx, ty)) {
      const [lx, ly] = boatAt === 'east' ? AT.landE : AT.landW;
      sc.p.x = lx * T;
      sc.p.y = ly * T;
    }
    hintOnce(
      'deepHint',
      '🛶 Подземная река! Садись в лодочку у мостков — течение само понесёт её мимо светящихся грибов.',
      '',
      700,
    );
  },
  /** Пока плывёшь — нажатия на экран не уводят хомячка из лодочки. */
  tap: () => !!ride,
  update(sc, dt) {
    if (ride) updateRide(sc, dt);
  },
  /** Темнота и пятна света: хомячок (у него фонарик на каске или в лапке — внизу без света не страшно?), лестница, фонарь лодочки. */
  gloom(sc) {
    gloomLights.length = 0;
    gloomLights.push([(AT.ladder[0] + 0.5) * T, (AT.ladder[1] + 0.5) * T, 210, 170, 1]); // свет из люка
    if (!ride) {
      const [bx, by] = boatAt === 'west' ? AT.boatW : AT.boatE,
        q = boatLampAt(bx * T, by * T, boatAt === 'west' ? 1 : -1);
      gloomLights.push([q.x, q.y, 90, 80, 0.95]);
    } else {
      const q = boatLampAt(sc.p.x, sc.p.y, ride.dir);
      gloomLights.push([q.x, q.y, 150, 130, 1]);
    }
    return { tint: [6, 12, 26, 0.9], hero: [230, 200, 1], lights: gloomLights, warm: 0.22 };
  },
  things(sc, add, v) {
    const t = G.time;
    // пустая лодочка у мостков
    if (!ride) {
      const [bx, by] = boatAt === 'west' ? AT.boatW : AT.boatE;
      add(by * T + 4, (ctx) => drawRowboat(ctx, bx * T, by * T, boatAt === 'west' ? 1 : -1, t, null, false));
    }
    // огоньки над водой
    add(
      H * T,
      (ctx) => {
        ctx.fillStyle = '#c3fae8';
        for (const s of sparks) {
          if (s.x < v.x0 - 20 || s.x > v.x1 + 20 || s.y < v.y0 - 20 || s.y > v.y1 + 20) continue;
          const a = 0.35 + Math.sin(t * 2 + s.ph) * 0.3;
          if (a <= 0.05) continue;
          ctx.globalAlpha = a;
          ell(ctx, s.x + Math.sin(t * 0.7 + s.ph) * 10, s.y + Math.cos(t * 0.9 + s.ph) * 6, 2.4, 2.4, '#c3fae8');
        }
        ctx.globalAlpha = 1;
      },
      null,
      true,
    );
  },
  cold: () => false,
  /** Что слышно: музыка пещер, капли и шум реки. */
  sound(sc) {
    const ty = sc.p.y / T;
    return {
      force: 'caves',
      day: 'caves',
      sea: clamp(0.3 - Math.abs(ty - 13) * 0.03, 0.08, 0.3),
      rain: 0,
      birds: false,
      crickets: false,
      wind: 0,
      drips: 1,
    };
  },
});
export default deep;
