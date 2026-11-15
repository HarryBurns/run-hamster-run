// ГОРА (П.9) — второе тайное место. Описание для «движка локаций» (engine/topdown/scene.js); рецепт —
// docs/ARCHITECTURE.md, раздел 9 («…новую локацию»), образец — лес (раздел 14). Рисунки — mountain_art.js.
//
// Как устроена: карта 40 × 45 правилами (build), снизу вверх: станция канатной дороги (приехали из леса) → альпийские
// луга (по сезону: весной крокусы, летом цветы и эдельвейсы, осенью сухая трава, зимой снег), горячий источник,
// коровы на лугу → ельник с шале инструктора Вершинкина и трассой для санок → вечный снег на вершине: снежная
// поляна для снеговика, вход в пещеры в скале (закрыт — LANDS.caves), смотровая площадка с флагом. Серпантин-тропа
// петляет от станции до вершины; скалы и валуны непроходимы; с уступа на востоке падает водопад, горный ручей
// бежит вниз (в него не зайти). Всё случайное — от seeded(), карта всегда одна и та же. Клетки, до которых от станции
// не дойти, после постройки закрываются (sealPockets).
//
// Атмосфера: облака ниже вершины плывут в слое неба (крюк sky), наверху ветер несёт снежинки (overlay), зимой
// снег идёт везде; своя музыка, ветер и колокольчики коров (sound → features/soundscape.js).
import { G, cal } from '../core/state.js';
import { clamp, seeded } from '../core/util.js';
import { T, put, createTopDownScene } from '../engine/topdown/index.js';
import { chaletArt, cloudPuff } from './mountain_art.js';
import './common/index.js';

const W = 40,
  H = 45;
/** Нижний край вечного снега в столбце x (в клетках): выше — снег круглый год. */
export const snowLine = (x) => 11.5 + Math.sin(x * 0.37 + 0.6) * 1.3;
/** Где кончается ельник и начинаются луга. */
const treeLine = (x) => 24.5 + Math.sin(x * 0.29 + 1.2) * 1.6;
/** Левая клетка горного ручья в ряду y (две клетки шириной; течёт от водопада вниз). */
const streamX = (y) => 34 + Math.round(Math.sin((y - FALL[1] - 1) * 0.3));
const FALL = [34, 13]; // уступ с водопадом (две клетки)

// ---------- тропы (ломаные в клетках; r — полуширина: 0,75 — две клетки, 0,55 — одна) ----------
const PATHS = [
  {
    r: 0.75,
    pts: [
      [20.5, 43],
      [24.5, 42],
      [26, 37.5],
      [14, 34],
      [11, 30.5],
      [24, 27],
      [27, 22],
      [15, 19],
      [12, 15.5],
      [21, 12],
      [20.5, 7],
      [20.5, 4],
    ],
  }, // серпантин: от станции до смотровой площадки
  {
    r: 0.55,
    pts: [
      [11, 30.5],
      [7.5, 29.3],
    ],
  }, // к горячему источнику
  {
    r: 0.55,
    pts: [
      [26, 37.5],
      [29.5, 36.5],
    ],
  }, // к лугу с коровами
  {
    r: 0.55,
    pts: [
      [27, 22],
      [28.5, 19.6],
      [32.5, 15.5],
    ],
  }, // к шале и к водопаду
  {
    r: 0.55,
    pts: [
      [12, 15.5],
      [9, 11],
    ],
  }, // к снежной поляне
  {
    r: 0.55,
    pts: [
      [20.5, 7],
      [29.5, 6.6],
    ],
  }, // ко входу в пещеры
];
// поляны: круг [cx, cy, r] или прямоугольник [x0, y0, x1, y1] — там не растут деревья
const GLADES = {
  station: { box: [15, 38, 29, 44] },
  spring: { box: [1, 25, 9, 31] },
  pasture: { box: [26, 29, 32, 36] },
  chalet: { box: [24, 15, 33, 23] },
  snowman: { box: [4, 6, 13, 12] },
  summit: { c: [20.5, 3.5, 3.6] },
  cave: { box: [25, 5, 33, 8] },
};
const inGlade = (x, y) => {
  const cx = x + 0.5,
    cy = y + 0.5;
  return Object.values(GLADES).some((g) =>
    g.c
      ? Math.hypot(cx - g.c[0], cy - g.c[1]) <= g.c[2]
      : x >= g.box[0] && x <= g.box[2] && y >= g.box[1] && y <= g.box[3],
  );
};
// особые места
export const AT = {
  station: { x: 18, y: 40, w: 4, h: 2 }, // верхняя станция канатной дороги: дверь — клетка (20, 42)
  chalet: { x: 26, y: 17, w: 4, h: 2 }, // шале Вершинкина: дверь — клетка (28, 19)
  spring: [3, 27, 5, 28], // горячий источник (клетки)
  snowman: [8, 9], // где лепят снеговика
  cave: [29, 5], // вход в пещеры (скала на три клетки)
  deck: [19, 2, 22, 3], // смотровая площадка (доски)
  viewer: [20, 2],
  flag: [22, 2],
  run: [30, 31, 8, 18], // трасса для санок: x0, x1, y0, y1
  pasture: [26, 29, 32, 36], // загон для коров (забор)
};
/** Корову видно на лугу (зимой коровы в тёплом хлеву). */
const cowsOut = () => cal().season !== 'winter';

function build(m) {
  const rnd = seeded(4471);
  // 1. вечный снег на вершине; трасса для санок
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (y < snowLine(x)) m.set(x, y, 'snowCap');
  const [rx0, rx1, ry0, ry1] = AT.run;
  for (let y = ry0; y <= ry1; y++) for (let x = rx0; x <= rx1; x++) m.set(x, y, 'skiRun');
  // 2. тропы: в снегу — утоптанный снег, ниже — земляная тропинка
  const path = new Set();
  for (const { r, pts } of PATHS)
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1],
        [bx, by] = pts[i],
        n = Math.ceil(Math.hypot(bx - ax, by - ay) * 4);
      for (let k = 0; k <= n; k++) {
        const px = ax + ((bx - ax) * k) / n,
          py = ay + ((by - ay) * k) / n;
        for (let y = Math.floor(py - 1); y <= py + 1; y++)
          for (let x = Math.floor(px - 1); x <= px + 1; x++)
            if (x >= 0 && y >= 0 && x < W && y < H && Math.hypot(x + 0.5 - px, y + 0.5 - py) <= r) {
              const c = m.at(x, y);
              if (c !== 'skiRun') m.set(x, y, c === 'snowCap' ? 'snowPath' : 'y');
              path.add(x + ',' + y);
            }
      }
    }
  // 3. смотровая площадка — доски; горячий источник; ручей от водопада вниз
  const [dx0, dy0, dx1, dy1] = AT.deck;
  for (let y = dy0; y <= dy1; y++) for (let x = dx0; x <= dx1; x++) m.set(x, y, 'logBridge');
  const [sx0, sy0, sx1, sy1] = AT.spring;
  for (let y = sy0; y <= sy1; y++) for (let x = sx0; x <= sx1; x++) m.set(x, y, 'hotSpring');
  const water = new Set();
  for (let y = FALL[1] + 1; y < H; y++)
    for (const x of [streamX(y), streamX(y) + 1]) {
      m.set(x, y, 'brook');
      water.add(x + ',' + y);
    }
  const free = (x, y) =>
    !path.has(x + ',' + y) &&
    !water.has(x + ',' + y) &&
    !['skiRun', 'logBridge', 'hotSpring'].includes(m.at(x, y));
  // 4. ельник, луга, камни: по краю — стеной (скалы и ели), внутри — по поясам высоты
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!free(x, y)) continue;
      const r = rnd(),
        v = Math.floor(rnd() * 3),
        edge = x < 2 || y < 2 || x > W - 3 || y > H - 3,
        top = y < snowLine(x),
        firs = !top && y < treeLine(x),
        snowy = y < snowLine(x) + 2.5; // у самой границы снега ели всегда в снегу
      if (edge) {
        if (r < 0.95) m.add(top || rnd() < 0.35 ? 'crag' : 'alpineFir', x, y, { v, snow: snowy ? 1 : 0 });
        continue;
      }
      if (inGlade(x, y)) {
        if (!top && r < 0.1) m.add('alpFlowers', x, y, { v });
        continue;
      }
      // прямо под тропинкой высокое не ставим: ель закрыла бы тропинку и хомячка на ней
      const belowPath = path.has(x + ',' + (y - 1)) || path.has(x + ',' + (y - 2));
      const nearWater = Math.abs(x - streamX(Math.max(y, FALL[1] + 1)) - 0.5) < 2.2 && y > FALL[1];
      if (top) {
        if (r < 0.05) m.add('mtRock', x, y, { v, snow: 1 });
        else if (r < 0.09 && y > snowLine(x) - 3) m.add('alpineFir', x, y, { v, snow: 1 });
        else if (r < 0.11) m.add('crag', x, y, { v, snow: 1 });
      } else if (firs) {
        if (r < (nearWater ? 0.22 : belowPath ? 0.06 : 0.4)) m.add('alpineFir', x, y, { v, snow: snowy ? 1 : 0 });
        else if (r < 0.52) m.add('mtRock', x, y, { v });
        else if (r < 0.58) m.add('fern', x, y, { v: v % 2 });
      } else if (r < (belowPath ? 0.01 : 0.05)) m.add('alpineFir', x, y, { v });
      else if (r < 0.09) m.add('mtRock', x, y, { v });
      else if (r < 0.1) m.add('crag', x, y, { v });
      else if (r < 0.32) m.add('alpFlowers', x, y, { v });
    }
  // 5. особые предметы — на место того, что выросло (m.clear)
  const put1 = (type, x, y, o) => {
    m.clear(x, y);
    m.add(type, x, y, o);
  };
  // скалы над входом в пещеры; сама скала со входом
  for (let x = 25; x <= 34; x++) put1('crag', x, 3, { v: x % 2, snow: 1 });
  for (const x of [26, 27, 31, 32, 33]) put1('crag', x, 4, { v: (x + 1) % 2, snow: 1 });
  for (const x of [28, 29, 30]) m.clear(x, 5);
  m.add('caveRock', ...AT.cave);
  // уступ с водопадом
  for (const x of [FALL[0], FALL[0] + 1]) m.clear(x, FALL[1]);
  m.add('fallRock', ...FALL, { snow: 1 });
  // смотровая площадка: подзорная труба и флаг
  put1('viewer', ...AT.viewer);
  put1('flagPole', ...AT.flag);
  // флажки вдоль трассы
  for (let y = ry0 + 1; y <= ry1; y += 3) {
    put1('skiFlag', rx0 - 1, y, { v: 0 });
    put1('skiFlag', rx1 + 1, y + 1, { v: 1 });
  }
  // камни вокруг горячего источника
  for (const [x, y, v] of [
    [2, 26, 0],
    [6, 26, 1],
    [2, 29, 2],
    [6, 28, 1],
  ])
    put1('mtRock', x, y, { v });
  // загон для коров: деревянный забор, проход снизу у тропинки
  const [px0, py0, px1, py1] = AT.pasture;
  for (let x = px0; x <= px1; x++) {
    put1('fenceH', x, py0, { v: 1 });
    if (x !== 29) put1('fenceH', x, py1, { v: 1 });
    else m.clear(x, py1);
  }
  for (let y = py0 + 1; y < py1; y++) {
    put1('fenceV', px0, y, { v: 1 });
    put1('fenceV', px1, y, { v: 1 });
  }
  // скамейка у водопада, указатели
  put1('bench', 32, 16);
  put1('signpost', 23, 40, { text: '🔭 Вершина', text2: '♨️ Источник' });
  put1('signpost', 22, 13, { text: '⛄ Поляна', text2: '💎 Пещеры' });
  // перед зданиями — свободно (там двери)
  for (const b of [AT.station, AT.chalet])
    for (let x = b.x - 1; x <= b.x + b.w; x++) for (let y = b.y; y <= b.y + b.h + 1; y++) m.clear(x, y);
}

/** Клетки, до которых от станции не дойти пешком, — закрыть (чтобы туда не попасть и ничего там не потерять). */
function sealPockets(m) {
  const seen = new Uint8Array(W * H),
    q = [[20, 42]];
  seen[42 * W + 20] = 1;
  while (q.length) {
    const [x, y] = q.pop();
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + dx,
        ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen[ny * W + nx] || !m.foot(nx, ny)) continue;
      seen[ny * W + nx] = 1;
      q.push([nx, ny]);
    }
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!seen[y * W + x] && m.foot(x, y)) m.block(x, y);
}

// ---------- облака ниже вершины (в слое неба) ----------
const CLOUDS = Array.from({ length: 6 }, (_, i) => ({
  y: 13.5 + ((i * 2.7) % 6), // ряд карты: пояс облаков между ельником и вершиной
  x: (i * 0.37) % 1,
  rx: 150 + ((i * 53) % 90),
  sp: 6 + ((i * 7) % 5),
}));
function drawClouds(c, sc, lw, lh) {
  const f = (lw - 1) / G.view.w, // точек слоя на CSS-пиксель
    z = sc.cam.zoom,
    span = W * T + 800;
  for (const q of CLOUDS) {
    const wx = ((q.x * span + G.time * q.sp) % span) - 400,
      p = sc.cam.toScreen(wx, q.y * T),
      rx = q.rx * z * f,
      sx = p.x * f,
      sy = p.y * f;
    if (sx + rx < 0 || sx - rx > lw || sy + rx < 0 || sy - rx > lh) continue;
    cloudPuff(c, sx, sy, rx, rx * 0.42, 0.55);
  }
}
// ---------- ветер со снежинками наверху; зимой снег везде ----------
const flakes = Array.from({ length: 60 }, (_, i) => ({
  x: (i * 0.618) % 1,
  y: (i * 0.377) % 1,
  s: 0.6 + ((i * 0.29) % 0.7),
  ph: i,
}));
function drawWindSnow(ctx, w, h, t, n, wind) {
  ctx.fillStyle = 'rgba(255,255,255,.9)';
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const q = flakes[i],
      x = (((q.x + t * (0.02 + wind * 0.16) * q.s) % 1) + 1) % 1,
      y = (q.y + t * 0.04 * q.s + Math.sin(t * 1.3 + q.ph) * 0.01) % 1,
      r = 1.4 + q.s * 1.5;
    ctx.moveTo(x * w + r, y * h);
    ctx.arc(x * w, y * h, r, 0, 6.2832);
  }
  ctx.fill();
}
/** Насколько герой у вершины: 1 — в снегу, 0 — на лугах. */
export const highUp = (sc) => clamp((snowLine(sc.p.x / T) + 4 - sc.p.y / T) / 5, 0, 1);

// ---------- коровы на лугу (летом, весной и осенью) ----------
const COWS = [
  [29, 32, 0],
  [28, 34.5, 2.1],
  [30.5, 33.8, 4.2],
];
function drawCows(sc, add, v) {
  if (!cowsOut()) return;
  for (const [cx, cy, ph] of COWS) {
    const t = G.time * 0.05 + ph,
      x = (cx + Math.sin(t) * 1.4) * T,
      y = (cy + Math.sin(t * 0.7 + 1) * 0.6) * T;
    if (x < v.x0 || x > v.x1 || y < v.y0 || y > v.y1) continue;
    const dir = Math.cos(t) >= 0 ? 1 : -1,
      leg = Math.floor(G.time * 2 + ph) % 2;
    add(y, () => put('cow', x, y, dir, leg));
  }
}

const mountain = createTopDownScene({
  id: 'mountain', // имя сцены лежит в сохранениях: { scene: 'mountain', x, y } — не менять
  title: 'Карта горы',
  w: W,
  h: H,
  base: 'g',
  bg: '#9aa3b0',
  build,
  buildings: [
    // верхняя станция канатной дороги: вниз, в лес (cableway:down — features/mountain.js)
    {
      id: 'station',
      kind: 'cableway',
      ...AT.station,
      name: 'Канатная дорога',
      mapName: 'Канатная дорога в лес',
      icon: '🚡',
      cable: 'down',
      signText: () => '🌲 В лес',
      running: () => true,
      act: 'cableway:down',
    },
    // шале инструктора Вершинкина у трассы
    {
      id: 'chalet',
      kind: 'house',
      ...AT.chalet,
      name: 'Шале',
      icon: '🏠',
      wall: '#c98b5a',
      roof: '#c92a2a',
      shutters: '#1971c2',
      smoke: true,
      attic: false,
      npc: 'vershinkin',
      art: chaletArt,
      frame: [-46, -100, 4 * T + 76, 2 * T + 44],
      act: 'instructor', // постучать — выйдет Вершинкин
    },
  ],
  actors: [{ npc: 'vershinkin', at: [27.5, 21.5], home: 'chalet', always: true, act: 'instructor' }],
  spots: {
    pasture: { at: [29.5, 37.5], label: '🐄 Луг с коровами' },
    waterfall: { at: [32.5, 15.5], label: '🌊 Водопад' },
    run: { at: [30.5, 9.5], label: '🛷 Трасса' },
  },
  // из леса приезжают на канатной дороге (вход station — у двери станции)
  entries: { station: { building: 'station' } },
  // где разбрасывать предметы заданий (письма с loc: 'mountain'): тропы и луга
  zones: { meadow: { tiles: ['g', 'y'], reach: { from: [20, 42] } } },
  built(sc) {
    sealPockets(sc.map);
  },
  /** Облака ниже вершины — в слое неба (он есть, когда видны тени облаков: днём без дождя и снега). */
  sky(c, sc, lw, lh) {
    if (sc.darkness() < 0.5) drawClouds(c, sc, lw, lh);
  },
  /** Наверху ветер несёт снежинки; зимой (если в погоде нет снегопада) снег идёт везде. */
  overlay(ctx, sc, w, h) {
    const wx = G.state.weather,
      up = highUp(sc),
      winter = cal().season === 'winter' && wx !== 'snow' && wx !== 'rain';
    const n = Math.round(Math.max(winter ? 50 : 0, up * 60));
    if (n) drawWindSnow(ctx, w, h, G.time, n, up);
  },
  things(sc, add, v) {
    drawCows(sc, add, v);
  },
  /** Что слышно: горная музыка, ветер наверху, у водопада и ручья — шум воды, на лугу — колокольчики коров. */
  sound(sc) {
    const tx = sc.p.x / T,
      ty = sc.p.y / T,
      fall = Math.hypot(tx - FALL[0] - 1, ty - FALL[1] - 1);
    return {
      day: 'mountain',
      sea: ty > FALL[1] ? clamp(0.35 - Math.min(fall * 0.04, Math.abs(tx - streamX(Math.floor(ty)) - 1) * 0.06), 0, 0.35) : 0,
      rain: 1,
      birds: !highUp(sc),
      crickets: true,
      wind: 0.25 + highUp(sc) * 0.75,
      bells: cowsOut() ? clamp(1 - Math.hypot(tx - 29.5, ty - 33) / 9, 0, 1) : 0,
    };
  },
});
export default mountain;
