// МОРЕ — часть локации «вид сверху»: кораблик, необитаемые острова, морские жители, буйки и ныряние.
//
// Это не отдельная карта, а «часть» (parts) локации, на карте которой есть море: createSea(настройки)
// возвращает объект с крюками движка (engine/topdown/scene.js) и свои функции. Город подключает его так:
//
//   const sea = createSea(WORLD_SEA);
//   build(m) { …; sea.buildGround(m); …; sea.buildObjects(m); … }      // в правилах постройки карты
//   parts: [sea]
//
// Настройки: shallowY — первая строка мелководья у берега, seaY — с этой строки глубокое море, buoyY — линия
// буйков (дальше — открытое море, туда только на кораблике), boatHome — стоянка кораблика, isles — острова,
// icebergs — айсберги, key — под каким ключом кораблик лежит в сохранении, creatures — сколько кого в море,
// port — причал тайного места за буйками (джунгли, П.9): остров с причалом, кораблик подходит к его концу — действие
// way:<место> (закрыто — окно «кто знает дорогу», открыто — переезд картинкой). Остров причала — не «необитаемый»:
// в счёт островов (наклейка «Все острова открыты») не входит.
// grotto — подводный грот тайного места (секретный пляж, П.9): буёк-ракушка, скалы и круги на воде (значок на
// мини-карте); нырнула рядом (кнопка 🤿 или нажатие на буёк) — действие way:<место> вместо обычного ныряния.
// far — отметка дальнего пути (удалённый остров, П.9): у самого юга моря, за последними буйками, — плотик со столбом
// и табличкой «🧭 Далеко на юг»; кораблик подплыл к ней — действие way:<место> (закрыто — окно «кто знает дорогу»,
// открыто — долгое плавание картинкой).
import { clamp, rnd, seeded, TAU, dist } from '../core/util.js';
import { ell, fillRR, line, poly, emoji } from '../core/draw.js';
import { drawHamster, blinkAt } from '../art/hamster.js';
import { G, canSwim, landOpen } from '../core/state.js';
import { award, setFlag, patchState, touchState, markVisited } from '../core/actions.js';
import { emit } from '../core/events.js';
import { run } from '../core/registry.js';
import { go, scene } from '../core/loop.js';
import { toast, hintOnce, hintToday } from '../ui/toast.js';
import { sfx } from '../core/audio.js';
import { T, OUT, PS, SP, put, tileOf, defineObjects, defineArt } from '../engine/topdown/kinds.js';
import { signBoard } from './common/paint.js';
import { drawDolphinJump, DOLPHIN_JUMP } from './cove_art.js'; // буёк-ракушка над подводным гротом (рисунок seaMarker), дельфины
import { SICK_TEXT, LAND_BY_ID } from '../data/index.js';
import './common/index.js';

/** Море города: где оно на карте, острова (центр в клетках, размеры и что на них стоит). */
export const WORLD_SEA = {
  key: 'boat',
  shallowY: 57,
  seaY: 59,
  buoyY: 89,
  boatHome: [65.5, 61.5], // у пирса
  creatures: { fish: 28, shark: 7, whale: 7 },
  // причал джунглей (П.9): остров на юге за буйками, причал смотрит на север; dock — куда подплыть кораблику
  port: { land: 'jungle', x: 66, y: 113, rx: 5, ry: 3, pier: [65, 66, 107, 110], dock: [66, 106.2], sign: [67, 110] },
  // подводный грот секретного пляжа (П.9): буёк-ракушка у скал на востоке моря, круги на воде; нырнуть здесь — заплыв
  // через грот (way:cove: закрыто — окно «кто знает дорогу», открыто — переезд картинкой)
  grotto: { land: 'cove', x: 89.5, y: 75.5 },
  // отметка дальнего пути к удалённому острову (П.9): у самого юга моря, за последними буйками, между айсбергами
  // и причалом джунглей; кораблик подплыл — way:island (закрыто — окно про Лифтёра Этажкина, открыто — плавание на юг)
  far: { land: 'island', x: 45.5, y: 117.5 },
  icebergs: [
    [8, 102],
    [27, 113],
    [4, 114],
    [32, 99],
  ],
  isles: [
    {
      name: 'Остров Сундука',
      x: 29,
      y: 68,
      rx: 3.6,
      ry: 2.3,
      deco: [
        ['palm', 0, -1],
        ['umbrella', -2, 0],
        ['chest', 2, 0],
      ],
    },
    {
      name: 'Пальмовый остров',
      x: 62,
      y: 73,
      rx: 4.6,
      ry: 2.8,
      deco: [
        ['palm', -2, -1],
        ['cocoPalm', 1, -2], // кокосовая: до неё можно доплыть
        ['palm', 3, 0],
        ['starfish', -1, 1],
        ['crab', 1, 1],
      ],
    },
    {
      name: 'Крабий островок',
      x: 85,
      y: 67,
      rx: 2.4,
      ry: 1.7,
      deco: [
        ['palm', 0, -1],
        ['crab', -1, 0],
        ['crab', 1, 0],
      ],
    },
    {
      name: 'Звёздный остров',
      x: 12,
      y: 78,
      rx: 3.4,
      ry: 2.5,
      deco: [
        ['palm', -1, -1],
        ['starfish', 1, 0],
        ['starfish', -2, 1],
        ['starfish', 0, 1],
        ['flag', 2, -1],
      ],
    },
    {
      name: 'Остров Кораблика',
      x: 44,
      y: 83,
      rx: 5.2,
      ry: 2.9,
      deco: [
        ['palm', -3, -1],
        ['palm', 3, -1],
        ['wreck', 0, 0],
        ['chest', -2, 1],
        ['crab', 2, 1],
      ],
    },
    {
      name: 'Остров-крошка',
      x: 80,
      y: 82,
      rx: 1.9,
      ry: 1.5,
      deco: [
        ['palm', 0, -1],
        ['starfish', 0, 0],
      ],
    },
    // за буйками — только на кораблике
    {
      name: 'Остров Сокровищ',
      x: 48,
      y: 105,
      rx: 7.2,
      ry: 4.2,
      treasure: true,
      deco: [
        ['volcano', 0, -2],
        ['palm', -5, -1],
        ['palm', -3, 1],
        ['cocoPalm', 4, -1], // кокосовая: награда тем, кто доплыл на кораблике
        ['palm', 5, 1],
        ['chest', 1, 2],
        ['crab', -1, 2],
        ['flag', 3, 2],
      ],
    },
    {
      name: 'Ледяной остров',
      x: 16,
      y: 108,
      rx: 4.4,
      ry: 2.8,
      ice: true,
      deco: [
        ['igloo', 0, -1],
        ['penguin', -2, 0],
        ['penguin', 0, 1],
        ['penguin', 2, 0],
      ],
    },
    {
      name: 'Остров Маяка',
      x: 81,
      y: 103,
      rx: 3.2,
      ry: 2.3,
      deco: [
        ['lighthouse', 0, -1],
        ['starfish', -2, 0],
        ['crab', 1, 1],
      ],
    },
  ],
};

// ---------- свои предметы моря ----------
defineObjects({
  buoy: {
    draw(ctx, o, env) {
      const x = o.x,
        by = o.y + Math.sin(env.t * 2 + o.tx) * 4;
      SP.world();
      ell(ctx, x, by + 8, 16, 5, 'rgba(255,255,255,.5)');
      ell(ctx, x, by, 13, 13, '#fa5252', OUT, 2);
      ctx.fillStyle = '#fff';
      ctx.fillRect(x - 12, by - 3, 24, 6);
      line(ctx, x, by - 13, x, by - 24, OUT, 2.5);
      ell(ctx, x, by - 26, 3.5, 3.5, '#ffd43b', OUT, 1.5);
    },
  },
  iceberg: {
    draw(ctx, o, env) {
      const x = o.x,
        by = o.y + Math.sin(env.t * 1.3 + o.tx) * 4;
      SP.world();
      ell(ctx, x, by + 20, 44, 8, 'rgba(255,255,255,.5)');
      poly(
        ctx,
        [x - 40, by + 18, x - 24, by - 30, x - 6, by - 12, x + 10, by - 52, x + 30, by - 14, x + 42, by + 18],
        '#f4fbff',
        OUT,
        2.5,
      );
      poly(ctx, [x + 10, by - 52, x + 30, by - 14, x + 42, by + 18, x + 12, by + 18], '#cfe8f9');
    },
  },
  // затонувший кораблик на острове
  wreck: {
    art: {
      wreck: [
        [-56, -70, 56, 28],
        (ctx) => {
          ell(ctx, 0, 14, 44, 8, 'rgba(0,0,0,.14)');
          ctx.rotate(-0.12);
          ctx.beginPath();
          ctx.moveTo(-46, -8);
          ctx.lineTo(46, -8);
          ctx.quadraticCurveTo(36, 16, 16, 16);
          ctx.lineTo(-22, 16);
          ctx.quadraticCurveTo(-40, 14, -46, -8);
          ctx.closePath();
          ctx.fillStyle = '#a8703f';
          ctx.fill();
          ctx.strokeStyle = OUT;
          ctx.lineWidth = 2;
          ctx.stroke();
          line(ctx, -38, 2, 38, 2, 'rgba(0,0,0,.25)', 2);
          line(ctx, 0, -8, 0, -58, OUT, 3);
          poly(ctx, [2, -56, 30, -22, 2, -18], '#fff3bf', OUT, 1.8);
          ell(ctx, -22, 8, 5, 5, '#343a40');
        },
      ],
    },
    draw(ctx, o) {
      put('wreck', o.x, o.y);
    },
  },
  penguin: {
    draw(ctx, o, env) {
      const t = env.t,
        px = o.x + Math.sin(t * 1.1 + o.tx * 3) * 16,
        py = o.y + 8,
        wob = Math.sin(t * 7 + o.tx) * 0.12;
      SP.world();
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(wob);
      ell(ctx, -6, 2, 6, 3, '#ff922b', OUT, 1.2);
      ell(ctx, 6, 2, 6, 3, '#ff922b', OUT, 1.2);
      ell(ctx, 0, -18, 14, 20, '#343a40', OUT, 2);
      ell(ctx, 0, -14, 9, 14, '#fff');
      ell(ctx, -15, -16, 4, 10, '#343a40', OUT, 1.5, 0.3);
      ell(ctx, 15, -16, 4, 10, '#343a40', OUT, 1.5, -0.3);
      ell(ctx, -4, -28, 2, 2.4, '#fff');
      ell(ctx, 4, -28, 2, 2.4, '#fff');
      ell(ctx, -4, -28, 1, 1.2, '#000');
      ell(ctx, 4, -28, 1, 1.2, '#000');
      poly(ctx, [-3, -24, 3, -24, 0, -19], '#ff922b', OUT, 1);
      ctx.restore();
    },
  },
  igloo: {
    solid: true,
    art: {
      igloo: [
        [-40, -34, 40, 26],
        (ctx) => {
          ell(ctx, 0, 14, 34, 8, 'rgba(0,0,0,.1)');
          ctx.beginPath();
          ctx.ellipse(0, 14, 34, 42, 0, Math.PI, 0);
          ctx.closePath();
          ctx.fillStyle = '#fff';
          ctx.fill();
          ctx.strokeStyle = OUT;
          ctx.lineWidth = 2.5;
          ctx.stroke();
          for (const [ax, ay, bx, by] of [
            [-30, -2, 30, -2],
            [-24, -16, 24, -16],
            [-12, -27, 12, -27],
            [-12, 14, -12, -2],
            [12, 14, 12, -2],
            [0, -2, 0, -16],
          ])
            line(ctx, ax, ay, bx, by, 'rgba(120,170,210,.7)', 1.6);
          ctx.beginPath();
          ctx.ellipse(0, 14, 11, 16, 0, Math.PI, 0);
          ctx.closePath();
          ctx.fillStyle = '#343a40';
          ctx.fill();
          ctx.strokeStyle = OUT;
          ctx.lineWidth = 2.5;
          ctx.stroke();
        },
      ],
    },
    draw(ctx, o) {
      put('igloo', o.x, o.y);
    },
  },
  lighthouse: {
    solid: true,
    art: {
      lighthouse: [
        [-34, -158, 34, 26],
        (ctx, lit) => {
          ell(ctx, 0, 14, 28, 7, 'rgba(0,0,0,.14)');
          poly(ctx, [-22, 14, -14, -100, 14, -100, 22, 14], '#fff', OUT, 2.5);
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(-22, 14);
          ctx.lineTo(-14, -100);
          ctx.lineTo(14, -100);
          ctx.lineTo(22, 14);
          ctx.closePath();
          ctx.clip();
          ctx.fillStyle = '#fa5252';
          ctx.fillRect(-30, -78, 60, 22);
          ctx.fillRect(-30, -34, 60, 22);
          ctx.restore();
          fillRR(ctx, -7, -10, 14, 24, 6, '#8d5524', OUT, 2);
          fillRR(ctx, -20, -108, 40, 10, 3, '#343a40', OUT, 2);
          fillRR(ctx, -13, -132, 26, 26, 3, lit ? '#ffe066' : '#d0ebff', OUT, 2);
          poly(ctx, [-18, -132, 0, -152, 18, -132], '#fa5252', OUT, 2);
        },
      ],
    },
    draw(ctx, o, env) {
      const x = o.x,
        y = o.y,
        lit = env.dark > 0.3;
      if (lit) {
        // луч вращается — рисуем его линиями под башней
        const a = env.t * 0.8;
        SP.world();
        ctx.globalAlpha = 0.28;
        for (const s2 of [0, Math.PI])
          poly(
            ctx,
            [
              x,
              y - 118,
              x + Math.cos(a + s2 - 0.16) * 420,
              y - 118 + Math.sin(a + s2 - 0.16) * 150,
              x + Math.cos(a + s2 + 0.16) * 420,
              y - 118 + Math.sin(a + s2 + 0.16) * 150,
            ],
            '#fff3bf',
          );
        ctx.globalAlpha = 1;
      }
      put('lighthouse', x, y, lit ? 1 : 0);
    },
  },
  volcano: {
    solid: [
      [-1, 0],
      [0, 0],
      [1, 0],
    ],
    art: {
      volcano: [
        [-104, -118, 104, 36],
        (ctx) => {
          ell(ctx, 0, 16, 92, 14, 'rgba(0,0,0,.14)');
          poly(ctx, [-96, 18, -28, -104, 28, -104, 96, 18], '#8d6e53', OUT, 3);
          poly(ctx, [-28, -104, -12, -70, -2, -92, 10, -62, 28, -104], '#ff922b', OUT, 2);
          ell(ctx, 0, -104, 28, 8, '#ff6b6b', OUT, 2);
          poly(ctx, [-60, -20, -44, -46, -30, -22], 'rgba(0,0,0,.12)');
          poly(ctx, [30, -4, 48, -36, 62, -6], 'rgba(0,0,0,.12)');
        },
      ],
    },
    draw(ctx, o, env) {
      put('volcano', o.x, o.y);
      SP.world(); // дым
      for (let i = 0; i < 4; i++) {
        const k = (env.t * 0.25 + i / 4) % 1;
        ctx.globalAlpha = 0.7 * (1 - k);
        ell(ctx, o.x + Math.sin(k * 5 + i) * 14, o.y - 116 - k * 90, 12 + k * 18, 10 + k * 14, '#dee2e6');
      }
      ctx.globalAlpha = 1;
    },
  },
});

// настоящие препятствия в море (С11, О12): скалы у буйка-ракушки и плотик у отметки «Далеко на юг» занимают свою
// клетку — сквозь них не проплыть ни на кораблике, ни вплавь (кораблик обходит их, поиск пути — BOAT.pass)
defineObjects({
  seaCrag: {
    solid: true,
    art: { seaCrag: [[-34, -30, 34, 24], (ctx, r) => paintSeaCrag(ctx, r)] },
    draw(ctx, o, env) {
      SP.world(); // пена вокруг камня набегает и тает
      const ph = (env.t * 0.45 + o.tx * 0.37) % 1;
      ell(
        ctx,
        o.x,
        o.y + o.r * 0.35,
        o.r * 1.2 + ph * 12,
        o.r * 0.42 + ph * 5,
        null,
        `rgba(255,255,255,${(0.6 * (1 - ph)).toFixed(2)})`,
        1.8,
      );
      put('seaCrag', o.x, o.y, o.r);
    },
  },
  farRaft: {
    solid: true,
    draw(ctx, o, env) {
      SP.world();
      drawFarRaft(ctx, o, env.t);
    },
  },
});
/** Скалы у буйка-ракушки: сдвиг от буйка (единицы мира) и размер — так они стояли и раньше, только картинкой. */
const GROT_ROCKS = [
  [52, -26, 24],
  [78, 4, 18],
  [-46, -34, 16],
];

const SEA_DUR = { fish: 0.85, shark: 2.4, whale: 5 };
const isDeep = (c) => c === 'w' || c === 'O';
const isSea = (c) => c === 'w' || c === 'O' || c === 'h'; // где проходит кораблик

export function createSea(cfg) {
  const PORT = cfg.port || null;
  const GROT = cfg.grotto || null,
    GROT_PX = GROT ? { x: GROT.x * T, y: GROT.y * T } : null;
  const ISLES = cfg.isles,
    SEA_Y = cfg.seaY,
    BUOY_Y = cfg.buoyY;
  const BOAT_HOME = { x: cfg.boatHome[0] * T, y: cfg.boatHome[1] * T };
  // Кораблик лежит в сохранении (state[key]): где стоит и сидит ли в нём хомячок. Меняется через setBoat.
  const BOAT_INIT = { x: BOAT_HOME.x, y: BOAT_HOME.y, on: false };
  const boatState = () => G.state[cfg.key] || patchState(cfg.key, null, BOAT_INIT);
  const setBoat = (patch) => patchState(cfg.key, patch, BOAT_INIT);
  let sc = null, // сцена локации, к которой подключено море
    m = null,
    creatures = [],
    crumbs = null; // крошки для рыбок: { x, y, until }
  const ch = (tx, ty) => m.at(tx, ty);

  // Кораблик — «способ передвижения» героя (sc.p.ride): только по воде, зато быстро и за буйки.
  const BOAT = {
    id: 'boat',
    speed: 330,
    pass: (tx, ty) => isSea(ch(tx, ty)) && !m.solid[ty][tx], // по воде, в обход скал и плотика (С11, О12)
    step: { sfx: 'paddle', pause: 0.25 },
    moved: () => setBoat({ x: sc.p.x, y: sc.p.y }),
    draw: (ctx, s, p, t, look) => drawBoat(ctx, p.x, p.y, p.dir, t, look, p.moving),
    drop: () => setBoat({ on: false }),
  };
  const isBoating = () => !!sc && sc.p.ride === BOAT;

  // ---------- карта ----------
  /** Земля: мелководье у берега, море, открытое море и острова (песок, а вокруг мелководье). */
  function buildGround(g) {
    g.fill(0, cfg.shallowY, g.w - 1, SEA_Y - 1, 'h');
    g.fill(0, SEA_Y, g.w - 1, BUOY_Y, 'w');
    g.fill(0, BUOY_Y + 1, g.w - 1, g.h - 1, 'O');
    for (const is of ISLES)
      for (let y = Math.floor(is.y - is.ry - 2); y <= is.y + is.ry + 2; y++)
        for (let x = Math.floor(is.x - is.rx - 2); x <= is.x + is.rx + 2; x++) {
          const d = ((x + 0.5 - is.x) / is.rx) ** 2 + ((y + 0.5 - is.y) / is.ry) ** 2;
          if (d <= 1) g.ground[y][x] = is.ice ? 'I' : 's';
          else if (d <= 2.1 && isDeep(g.ground[y][x])) g.ground[y][x] = 'h';
        }
    if (PORT) {
      for (let y = Math.floor(PORT.y - PORT.ry - 2); y <= PORT.y + PORT.ry + 2; y++)
        for (let x = Math.floor(PORT.x - PORT.rx - 2); x <= PORT.x + PORT.rx + 2; x++) {
          const d = ((x + 0.5 - PORT.x) / PORT.rx) ** 2 + ((y + 0.5 - PORT.y) / PORT.ry) ** 2;
          if (d <= 0.5) g.ground[y][x] = 'jfloor';
          else if (d <= 1) g.ground[y][x] = 's';
          else if (d <= 2.1 && isDeep(g.ground[y][x])) g.ground[y][x] = 'h';
        }
      const [px0, px1, py0, py1] = PORT.pier;
      for (let y = py0; y <= py1; y++) for (let x = px0; x <= px1; x++) g.ground[y][x] = 'i';
    }
  }
  /** Предметы: то, что стоит на островах, буйки и айсберги. */
  function buildObjects(g) {
    for (const is of ISLES)
      for (const [type, dx, dy] of is.deco)
        g.add(type, Math.floor(is.x) + dx, Math.floor(is.y) + dy, type === 'umbrella' ? { beach: true } : {});
    for (let x = 1; x < g.w; x += 5) g.add('buoy', x, BUOY_Y);
    for (const [x, y] of cfg.icebergs || []) g.add('iceberg', x, y);
    // настоящие скалы у буйка-ракушки и плотик у отметки «Далеко на юг» (С11, О12)
    if (GROT_PX)
      for (const [dx, dy, r] of GROT_ROCKS)
        g.add('seaCrag', tileOf(GROT_PX.x + dx), tileOf(GROT_PX.y + dy), { x: GROT_PX.x + dx, y: GROT_PX.y + dy, r });
    if (FAR_PX) g.add('farRaft', tileOf(FAR_PX.x), tileOf(FAR_PX.y), { land: FAR.land });
    if (PORT) {
      // остров причала: джунгли (рисунки — jungle_art.js) и табличка с замочком, пока место закрыто
      const X = Math.floor(PORT.x),
        Y = Math.floor(PORT.y);
      for (const [type, dx, dy, v] of [
        ['jtree', -2, -1, 0],
        ['jtree', 2, 0, 2],
        ['palm', -4, 0],
        ['palm', 4, -1],
        ['bamboo', 0, 1, 1],
        ['jtree', -1, 2, 1],
        ['perch', 2, 2, 0],
      ])
        g.add(type, X + dx, Y + dy, v === undefined ? {} : { v });
      const land = LAND_BY_ID[PORT.land];
      g.add('signpost', ...PORT.sign, {
        text: `${land.icon} ${land.name}`,
        text2: () => (landOpen(PORT.land) ? '⛵ Причал' : '🔒 Спроси Боба'),
      });
    }
  }

  // ---------- отметка дальнего пути (удалённый остров) ----------
  const FAR = cfg.far || null,
    FAR_PX = FAR ? { x: FAR.x * T, y: FAR.y * T } : null;
  let farNear = false;
  /** Отплыть по дальнему пути: окно места (закрыто — кто знает дорогу; открыто — долгое плавание картинкой). */
  function farGo() {
    farNear = true;
    run('way:' + FAR.land);
  }
  /** Хомячок на кораблике подплыл к отметке — отплыть (один раз, пока не отплывёт подальше). */
  function updateFar() {
    if (!FAR_PX || !isBoating()) return;
    const d = dist(sc.p.x, sc.p.y, FAR_PX.x, FAR_PX.y);
    if (d < T * 1.9 && !farNear && !sc.p.path.length) farGo();
    else if (d > T * 4) farNear = false;
  }

  // ---------- кораблик ----------
  // Одно расстояние (в клетках) на «сойти на берег» и «сесть обратно»: откуда сошла — оттуда и сядет, даже простуженная,
  // которой в воду нельзя (Б1 ревью мест: было 2,6 и 2,4 — сойдя «с дальней клетки», на кораблик было не сесть).
  const BOARD_R = 2.6;
  /** Сесть в кораблик. auto — кораблик сейчас поплывёт сам (кнопка места на «карте мира»): подсказка «нажимай на
   * воду» ни к чему — она покажется, когда хомячок сядет сама. Из pending движок зовёт fn(сцена) — это не auto. */
  function boardBoat(auto) {
    const p = sc.p,
      bt = boatState();
    if (dist(p.x, p.y, bt.x, bt.y) > T * BOARD_R) return;
    p.ride = BOAT;
    setBoat({ on: true });
    p.x = bt.x;
    p.y = bt.y;
    p.path = [];
    p.surf = ch(tileOf(p.x), tileOf(p.y));
    markVisited(sc.name, 'boat'); // была у кораблика — кнопка места с морским путём потом ведёт к нему быстро (⚡, В14)
    sfx('splash');
    sfx('ok');
    award('x_boat');
    if (auto !== true) hintOnce('boatHint', 'Ты на кораблике! Нажимай на воду — поплывём. Теперь можно и за буйки! ⛵');
    emit('boat');
    emit('hud');
    touchState();
  }
  function getOff(px, py) {
    const p = sc.p;
    setBoat({ x: p.x, y: p.y, on: false });
    p.ride = null;
    p.path = [];
    p.pending = null;
    p.x = px;
    p.y = py;
    sfx('pop');
    emit('hud');
    touchState();
  }
  function landFromBoat(tx, ty) {
    const p = sc.p;
    if (dist(p.x / T, p.y / T, tx + 0.5, ty + 0.5) > BOARD_R || !m.foot(tx, ty)) {
      toast('Ближе на кораблике не подплыть. Попробуй с другой стороны!');
      return;
    }
    getOff((tx + 0.5) * T, (ty + 0.5) * T);
  }
  /** Сойти с кораблика там, где он сейчас: на берег рядом или в воду. */
  function leaveBoat() {
    if (!isBoating()) return;
    const p = sc.p,
      tx = tileOf(p.x),
      ty = tileOf(p.y);
    let best = null,
      bd = 1e9;
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++) {
        const c = ch(tx + dx, ty + dy);
        if (c === 'w' || c === 'O' || c === 'h' || c === 'o' || !m.foot(tx + dx, ty + dy)) continue;
        if (dist(p.x / T, p.y / T, tx + dx + 0.5, ty + dy + 0.5) > BOARD_R) continue; // оттуда не сесть обратно
        const d = dx * dx + dy * dy;
        if (d < bd) {
          bd = d;
          best = [tx + dx, ty + dy];
        }
      }
    if (best) {
      getOff((best[0] + 0.5) * T, (best[1] + 0.5) * T);
      return;
    }
    if (ch(tx, ty) === 'O') {
      toast('Здесь открытое море — слишком далеко и глубоко. Сойти можно у берега или внутри буйков.');
      return;
    }
    const ox = p.x - 46,
      oy = p.y + 26,
      okSpot = m.foot(tileOf(ox), tileOf(oy));
    getOff(okSpot ? ox : p.x, okSpot ? oy : p.y);
    sfx('splash');
  }
  // ---------- причал тайного места за буйками ----------
  const PORT_PX = PORT ? { x: PORT.dock[0] * T, y: PORT.dock[1] * T } : null;
  let portNear = false;
  /** Нажали у причала (или рядом с табличкой). */
  const nearPort = (x, y, r) => !!PORT_PX && dist(x, y, PORT_PX.x, PORT_PX.y) < r;
  /** Причалить: окно места (закрыто — кто знает дорогу; открыто — кораблик плывёт туда картинкой). */
  function dock() {
    portNear = true;
    run('way:' + PORT.land);
  }
  /** Хомячок на кораблике подплыл к причалу — причалить (один раз, пока не отплывёт подальше). */
  function updatePort() {
    if (!PORT_PX || !isBoating()) return;
    const d = dist(sc.p.x, sc.p.y, PORT_PX.x, PORT_PX.y);
    if (d < T * 1.9 && !portNear && !sc.p.path.length) dock();
    else if (d > T * 4) portNear = false;
  }
  /** Клетка на острове причала (там не «открывают необитаемые острова»). */
  const onPortIsle = (px, py) =>
    !!PORT && ((px / T - PORT.x) / (PORT.rx + 1.5)) ** 2 + ((py / T - PORT.y) / (PORT.ry + 1.5)) ** 2 <= 1;

  // ---------- подводный грот тайного места ----------
  let grotNear = false;
  /** Рядом ли хомячок (пешком в воде или на кораблике) с буйком над гротом. */
  const atGrotto = (r = 1.7) => !!GROT_PX && !!sc && dist(sc.p.x, sc.p.y, GROT_PX.x, GROT_PX.y) < T * r;
  /** Нырнуть в грот: окно места (закрыто — кто знает дорогу; открыто — заплыв через грот картинкой). */
  function grottoDive() {
    if (!atGrotto(2.4)) return;
    run('way:' + GROT.land);
  }
  /** Подплыла к буйку — подсказка (один раз, пока не отплывёт подальше). */
  function updateGrotto() {
    if (!GROT_PX) return;
    const d = dist(sc.p.x, sc.p.y, GROT_PX.x, GROT_PX.y);
    if (d < T * 2 && !grotNear) {
      grotNear = true;
      toast(
        landOpen(GROT.land)
          ? '🌊 Под буйком-ракушкой — вход в подводный грот! Нажми 🤿 «Нырнуть».'
          : '🔒 Под водой у скал темнеет проход… Без карты в нём не разобраться. Может, Зефирка что-то знает?',
      );
    } else if (d > T * 4.5) grotNear = false;
  }
  /** Нажали на буёк над гротом: подплыть и нырнуть. */
  function grottoTap(w) {
    if (!GROT_PX || dist(w.x, w.y, GROT_PX.x, GROT_PX.y - 14) > 46) return false;
    if (atGrotto()) grottoDive();
    else if (sc.walkTo(GROT_PX.x - 20, GROT_PX.y + 30, true)) sc.p.pending = { fn: grottoDive };
    sfx('tap');
    return true;
  }
  const drawGrotto = (ctx, g, t) => {
    const x = g.x,
      y = g.y;
    // круги на воде
    for (let i = 0; i < 2; i++) {
      const ph = (t * 0.45 + i * 0.5) % 1;
      ell(ctx, x, y + 6, 18 + ph * 46, 7 + ph * 17, null, `rgba(255,255,255,${(0.7 * (1 - ph)).toFixed(2)})`, 2);
    }
    put('seaMarker', x, Math.round(y + Math.sin(t * 2) * 3));
    SP.world();
    if (!landOpen(g.land)) emoji(ctx, '🔒', x + 16, y - 30, 16);
  };
  /**
   * Суша, на которую можно сойти, вплотную к точке w (не дальше клетки): клетка [tx, ty] или null. Так нажатие на
   * мокрый песок у кромки (клетка мелководья h рядом с берегом) высаживает, а не гонит кораблик вдоль берега.
   */
  function shoreBy(w) {
    const tx = tileOf(w.x),
      ty = tileOf(w.y);
    let best = null,
      bd = T * 1.01;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const x = tx + dx,
          y = ty + dy,
          c = ch(x, y);
        if (!c || isSea(c) || c === 'o' || !m.foot(x, y)) continue;
        // расстояние от точки нажатия до клетки (0 — внутри)
        const ex = Math.max(x * T - w.x, 0, w.x - (x + 1) * T),
          ey = Math.max(y * T - w.y, 0, w.y - (y + 1) * T),
          d = Math.hypot(ex, ey);
        if (d < bd) {
          bd = d;
          best = [x, y];
        }
      }
    return best;
  }
  /** Нажатие, когда хомячок на кораблике. */
  function boatTap(w, tx, ty) {
    const p = sc.p;
    if (grottoTap(w)) return;
    if (FAR_PX && dist(w.x, w.y, FAR_PX.x, FAR_PX.y - 40) < T * 2.4) {
      // к отметке «Далеко на юг»: подплыть и отплыть
      if (sc.walkTo(FAR_PX.x, FAR_PX.y + T * 0.6, false)) p.pending = { fn: farGo };
      else farGo();
      sfx('paddle');
      return;
    }
    if (nearPort(w.x, w.y, T * 2.6)) {
      // к причалу: подплыть к его концу и причалить
      if (sc.walkTo(PORT_PX.x, PORT_PX.y, false)) p.pending = { fn: dock };
      else dock();
      sfx('paddle');
      return;
    }
    for (const f of creatures)
      if (f.kind === 'fish' && dist(w.x, w.y, f.x, f.y) < 44) {
        if (sc.walkTo(f.x - 50, f.y + 20, true)) p.pending = { fn: feedFish };
        sfx('tap');
        return;
      }
    const c = ch(tx, ty);
    if (c === 'h') {
      // мокрый песок у кромки (Ф3): первая полоса мелководья у берега на вид — песок с пеной; нажали туда — сойти
      // на ближайшую клетку суши (подплыть к нажатому месту), а не плыть вдоль берега
      const land = shoreBy(w);
      if (land) {
        if (dist(p.x / T, p.y / T, land[0] + 0.5, land[1] + 0.5) <= 2.6) landFromBoat(land[0], land[1]);
        else if (sc.walkTo(w.x, w.y, true)) p.pending = { fn: () => landFromBoat(land[0], land[1]) };
        sfx('tap');
        return;
      }
    }
    if (isSea(c)) {
      if (sc.walkTo(w.x, w.y, true)) sfx('paddle');
      return;
    }
    if (m.foot(tx, ty)) {
      // берег совсем рядом (пирс у борта) — сразу сойти: путь туда пустой, и «дойти и сойти» не срабатывало
      if (dist(p.x / T, p.y / T, tx + 0.5, ty + 0.5) <= 2.6) landFromBoat(tx, ty);
      else if (sc.walkTo(w.x, w.y, false)) p.pending = { fn: () => landFromBoat(tx, ty) };
      sfx('tap');
      return;
    } // берег: подплыть и сойти
    sc.walkTo(w.x, w.y, false);
  }

  /** Плыть по морскому пути в место land (кнопка «карты мира», В14): к причалу, буйку над гротом или отметке. */
  function sailTo(land) {
    const p = sc.p;
    if (PORT && PORT.land === land) {
      if (sc.walkTo(PORT_PX.x, PORT_PX.y, false)) p.pending = { fn: dock };
      else dock();
    } else if (GROT && GROT.land === land) {
      if (atGrotto()) grottoDive();
      else if (sc.walkTo(GROT_PX.x - 20, GROT_PX.y + 30, true)) p.pending = { fn: grottoDive };
      else return false;
    } else if (FAR && FAR.land === land) {
      if (sc.walkTo(FAR_PX.x, FAR_PX.y + T * 0.6, false)) p.pending = { fn: farGo };
      else farGo();
    } else return false;
    sfx('paddle');
    return true;
  }

  // ---------- корм для рыбок ----------
  function feedFish() {
    const p = sc.p;
    const fx = p.x + p.dir * 46,
      fy = p.y + 6;
    crumbs = { x: fx, y: fy, until: G.time + 7 };
    let n = 0;
    for (const f of creatures)
      if (f.kind === 'fish' && dist(f.x, f.y, fx, fy) < T * 9) {
        f.feed = G.time + 7;
        f.timer = Math.min(f.timer, rnd(0.4, 1.6));
        n++;
      }
    sfx('paddle');
    sfx('heart');
    toast(n > 1 ? 'Рыбки со всех сторон плывут на угощение! 🐟🐠' : 'Рыбки пробуют крошки — вкусно! 🐟');
    award('x_feed', { delay: 900 });
    emit('feed');
  }

  // ---------- острова ----------
  function landOnIsle() {
    const p = sc.p,
      s = G.state;
    let bi = 0,
      bd = 1e9;
    ISLES.forEach((is, i) => {
      const d = dist(p.x / T, p.y / T, is.x, is.y);
      if (d < bd) {
        bd = d;
        bi = i;
      }
    });
    const found = s.flags.isles || {};
    if (found[bi]) return;
    if (ISLES[bi].treasure) run({ do: 'surprise', title: 'Клад с Острова Сокровищ!', delay: 1600 });
    setFlag('isles', { ...found, [bi]: 1 });
    const n = Object.keys(found).length + 1;
    award('x_island');
    toast(`Открыт «${ISLES[bi].name}» — ${n} из ${ISLES.length} 🏝️`, 'good');
    if (n >= ISLES.length) award('x_isles', { delay: 1200 });
    sfx('magic');
  }

  // ---------- морские жители: рыбки, акулы и киты ----------
  function initSea() {
    const rng = seeded(777),
      list = [];
    const spawn = (kind, n) => {
      let guard = 0;
      while (n > 0 && guard++ < 500) {
        const tx = 2 + Math.floor(rng() * (m.w - 4)),
          ty = SEA_Y + 2 + Math.floor(rng() * (m.h - SEA_Y - 5));
        let ok = true;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (!isDeep(ch(tx + dx, ty + dy))) ok = false;
        if (!ok) continue;
        list.push({
          kind,
          x: (tx + 0.5) * T,
          y: (ty + 0.5) * T,
          a: rng() * TAU,
          turn: rng() * 3,
          timer: 1 + rng() * 8,
          up: 0,
          v: Math.floor(rng() * 3),
        });
        n--;
      }
    };
    spawn('fish', cfg.creatures.fish);
    spawn('shark', cfg.creatures.shark);
    spawn('whale', cfg.creatures.whale);
    creatures = list;
  }
  function updateSea(dt) {
    const p = sc.p;
    for (const c of creatures) {
      c.turn -= dt;
      if (c.turn <= 0) {
        c.a += rnd(-0.9, 0.9);
        c.turn = rnd(2, 5);
      }
      if (c.feed && crumbs && G.time < c.feed) {
        // плывём к угощению и чаще выпрыгиваем
        const dd = dist(c.x, c.y, crumbs.x, crumbs.y);
        c.a = dd > 34 ? Math.atan2(crumbs.y - c.y, crumbs.x - c.x) : c.a + dt * 2.5;
        if (dd > 34) {
          c.x += Math.cos(c.a) * 60 * dt;
          c.y += Math.sin(c.a) * 60 * dt;
        }
        c.timer -= dt * 2.5;
      }
      const sp = { fish: 42, shark: 58, whale: 24 }[c.kind] * (c.up > 0 && c.kind !== 'fish' ? 0.25 : 1);
      const cs = Math.cos(c.a),
        sn = Math.sin(c.a);
      const ax = c.x + cs * 90,
        ay = c.y + sn * 90; // смотрим вперёд: не заплываем на мель и за край
      if (!isDeep(ch(tileOf(ax), tileOf(ay))) || ay > (m.h - 3) * T || ay < (SEA_Y + 1) * T)
        c.a += Math.PI * 0.55 + rnd(0, 0.5);
      else {
        c.x += cs * sp * dt;
        c.y += sn * sp * dt;
      }
      if (c.up > 0) {
        c.up -= dt;
        if (c.kind === 'whale' && dist(c.x, c.y, p.x, p.y) < T * 6.5) award('x_whale');
        if (c.kind === 'shark' && dist(c.x, c.y, p.x, p.y) < T * 3)
          hintToday('shark', 'Акула улыбнулась тебе и поплыла дальше 🦈', '', null);
        continue;
      }
      c.timer -= dt;
      if (c.timer <= 0) {
        c.up = SEA_DUR[c.kind];
        c.dir = cs >= 0 ? 1 : -1;
        c.timer = c.kind === 'fish' ? rnd(2.5, 7) : c.kind === 'shark' ? rnd(8, 15) : rnd(10, 18);
        if (dist(c.x, c.y, p.x, p.y) < T * 7 && scene() === sc) sfx(c.kind === 'whale' ? 'spout' : 'paddle');
      }
    }
  }

  // ---------- дельфины (С5): плывёшь на кораблике по глубокой воде — иногда рядом выпрыгивает пара дельфинов ----------
  let dolph = null, // { x, y, dir, t0 } — прыжок, который сейчас виден
    dolphT = 6; // через сколько секунд плавания следующий (в открытом море — чаще)
  function updateDolphins(dt) {
    if (dolph && G.time - dolph.t0 > DOLPHIN_JUMP * 1.8) dolph = null;
    if (!isBoating() || !sc.p.moving || dolph) return;
    const p = sc.p,
      c = ch(tileOf(p.x), tileOf(p.y));
    if (!isDeep(c)) return;
    dolphT -= dt * (c === 'O' ? 1.8 : 1);
    if (dolphT > 0) return;
    dolphT = rnd(10, 20);
    showDolphins(p.x + p.dir * rnd(170, 230), p.y + rnd(55, 85), p.dir, 250); // плывут рядом, чуть медленнее кораблика
  }
  /** Пара дельфинов выпрыгивает в точке (x, y) мира и плывёт в сторону dir со скоростью v — если там глубоко. */
  function showDolphins(x, y, dir, v = 0) {
    for (const dx of [-80, 0, 80, 80 + v * 1.6]) if (!isDeep(ch(tileOf(x + dir * dx), tileOf(y)))) return false;
    dolph = { x, y, dir, v, t0: G.time };
    if (scene() === sc) sfx('splash');
    hintToday('dolphins', 'Дельфины! Плывут рядом с корабликом и прыгают из воды 🐬', 'good', null);
    return true;
  }

  // ---------- ныряние ----------
  /** Нырять можно только там, где глубоко. */
  const canDive = () => !!sc && sc.built && isDeep(ch(tileOf(sc.p.x), tileOf(sc.p.y)));
  /** Нырнуть там, где стоим (если глубоко). */
  function dive() {
    if (!canDive()) return;
    if (!canSwim()) return void toast(SICK_TEXT.water); // простуженной нырять нельзя (Ф1)
    if (atGrotto()) return void grottoDive(); // у буйка-ракушки — в подводный грот
    go('dive', { x: sc.p.x, boat: isBoating(), width: m.w * T });
  }
  /** Где всплыть: ближайшая глубокая клетка к точке (x, y). */
  function surfaceAt(x, y) {
    const tx = clamp(tileOf(x), 0, m.w - 1),
      ty = clamp(tileOf(y), SEA_Y, m.h - 2);
    for (let r = 0; r < 14; r++)
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          if (ch(tx + dx, ty + dy) === 'w') return { x: (tx + dx + 0.5) * T, y: (ty + dy + 0.5) * T };
        }
    return { x: sc.p.x, y: sc.p.y };
  }

  const drawCreature = (ctx, c, t) => drawSeaCreature(ctx, c, t);
  const drawFreeBoat = (ctx, bt, t) => drawBoat(ctx, bt.x, bt.y, 1, t, null, false);

  return {
    cfg,
    buildGround,
    buildObjects,
    isBoating,
    leaveBoat,
    dive,
    canDive,
    surfaceAt,
    boatState,
    /** Вернуть кораблик на стоянку (хомячок из него выходит). */
    boatHome: () => setBoat({ x: BOAT_HOME.x, y: BOAT_HOME.y, on: false }),
    /** Хомячок уплыла с кораблика через грот: кораблик ждёт там, где стоит. */
    parkBoat() {
      setBoat({ on: false });
      if (sc && sc.p.ride === BOAT) sc.p.ride = null;
    },
    /**
     * «Карта мира» (ROUTES в data/places.js): морской путь 'sea:<место>' — куда показывать звёздочку. Хомячок
     * на кораблике — к причалу, буйку над гротом или отметке дальнего пути; на берегу — сначала к кораблику.
     */
    where(s, name) {
      if (!name.startsWith('sea:')) return null;
      const land = name.slice(4),
        goal =
          PORT && PORT.land === land
            ? PORT_PX
            : GROT && GROT.land === land
              ? GROT_PX
              : FAR && FAR.land === land
                ? FAR_PX
                : null;
      if (!goal) return null;
      if (isBoating()) return { x: goal.x, y: goal.y + 30 };
      // вплавь у самого буйка над гротом (приплыла сама или вынырнула из грота) — нырять можно и без кораблика
      if (goal === GROT_PX && atGrotto(6)) return { x: goal.x, y: goal.y + 30 };
      const bt = boatState();
      return { x: bt.x, y: bt.y + 20 };
    },
    /**
     * Кнопка места на «карте мира» (В14): морской путь 'sea:<место>'. Пешком — дойти до кораблика, сесть в него и
     * плыть дальше; на кораблике — сразу плыть к причалу, буйку над гротом или отметке дальнего пути, а там — как
     * обычно (окно места). Вплавь у самого буйка над гротом — нырнуть без кораблика. false — путь не морской.
     */
    goTo(s, name) {
      if (!name.startsWith('sea:')) return false;
      const land = name.slice(4);
      if (!((PORT && PORT.land === land) || (GROT && GROT.land === land) || (FAR && FAR.land === land))) return false;
      if (isBoating() || (GROT && GROT.land === land && atGrotto(6))) return sailTo(land);
      const bt = boatState();
      s.goNear(bt.x, bt.y, {
        fn: () => {
          boardBoat(true);
          if (isBoating()) sailTo(land);
          else toast('До кораблика отсюда не достать — подойди к нему поближе ⛵');
        },
      });
      return true;
    },
    /** Буёк над подводным гротом (единицы мира) — для тестов. */
    grottoAt: () => GROT_PX,
    /** Отметка «Далеко на юг» (единицы мира) — для тестов. */
    farAt: () => FAR_PX,

    // ---------- крюки движка ----------
    built(s) {
      sc = s;
      m = s.map;
      initSea();
    },
    enter(s, from, params) {
      const p = s.p;
      let bt = boatState();
      // карту могли перерисовать (старое сохранение): кораблик, оказавшийся не на воде, возвращается к пирсу
      if (!Number.isFinite(bt.x) || !Number.isFinite(bt.y) || !BOAT.pass(tileOf(bt.x), tileOf(bt.y))) {
        if (bt.on && isSea(ch(tileOf(p.x), tileOf(p.y)))) setBoat({ x: p.x, y: p.y });
        else setBoat({ x: BOAT_HOME.x, y: BOAT_HOME.y, on: false });
        bt = boatState();
      }
      // в кораблик сажаем, только если стоим на воде: «Домой» с кораблика, а потом выход из своего дома
      // (квартира, бунгало, лесной домик) ставит у двери на суше — там кораблика нет, он ждёт, где оставили
      const onSea = isSea(ch(tileOf(p.x), tileOf(p.y)));
      if (bt.on && !onSea) setBoat({ on: false });
      p.ride = bt.on && onSea ? BOAT : null;
      // всплыли после ныряния: рядом с тем местом, куда доплыли под водой (а с кораблика — к нему же)
      if (params.surface && !p.ride) {
        const sf = surfaceAt(params.surface.x, params.surface.y);
        p.x = sf.x;
        p.y = sf.y;
      }
    },
    tap(s, w, tx, ty) {
      if (isBoating()) {
        boatTap(w, tx, ty);
        return true;
      }
      // пешком на острове причала: нажали на причал или табличку — окно места
      if (PORT && nearPort(w.x, w.y, T * 4) && dist(s.p.x, s.p.y, PORT_PX.x, PORT_PX.y) < T * 8) {
        s.goNear(PORT.sign[0] * T + T / 2, (PORT.sign[1] + 1) * T + T / 2, { fn: dock });
        sfx('tap');
        return true;
      }
      if (grottoTap(w)) return true; // буёк над гротом
      const bt = boatState();
      if (dist(w.x, w.y, bt.x, bt.y - 20) < 60) {
        s.goNear(bt.x, bt.y, { fn: boardBoat });
        sfx('tap');
        return true;
      } // кораблик
      return false;
    },
    tapThing(s, w) {
      // стайка рыбок — покормить
      for (const f of creatures)
        if (f.kind === 'fish' && dist(w.x, w.y, f.x, f.y) < 44) {
          if (s.walkTo(f.x - 30, f.y + 20, true)) s.p.pending = { fn: feedFish };
          sfx('tap');
          return true;
        }
      return false;
    },
    interact() {
      if (!isBoating()) return false;
      leaveBoat();
      return true;
    },
    near(s) {
      const bt = boatState(),
        d = dist(s.p.x, s.p.y, bt.x, bt.y);
      return d < T * BOARD_R ? { d: d * 0.5, pending: { fn: boardBoat } } : null;
    },
    idle: dive,
    update(s, dt) {
      updateSea(dt);
      updateDolphins(dt);
      updatePort();
      updateGrotto();
      updateFar();
    },
    surface(s, c) {
      const p = s.p;
      if (p.ride) {
        if (c === 'O' && award('x_far')) toast('Это открытое море. Где-то здесь прячутся дальние острова…');
      }
      if ((c === 's' || c === 'I') && tileOf(p.y) > SEA_Y && !onPortIsle(p.x, p.y)) landOnIsle();
    },
    things(s, add, v) {
      for (const c of creatures)
        if (c.x > v.x0 && c.x < v.x1 && c.y > v.y0 && c.y < v.y1) add(c.y + 8, drawCreature, c);
      if (!s.p.ride) {
        const bt = boatState();
        add(bt.y + 12, drawFreeBoat, bt, true);
      }
      if (dolph) add(dolph.y + 4, (ctx, j, t) => drawDolphinJump(ctx, j, t), dolph);
      if (GROT_PX && GROT_PX.x > v.x0 - 120 && GROT_PX.x < v.x1 + 120 && GROT_PX.y > v.y0 && GROT_PX.y < v.y1)
        add(GROT_PX.y, drawGrotto, { ...GROT_PX, land: GROT.land });
    },
    over(ctx, s, t) {
      // крошки для рыбок
      if (crumbs && t < crumbs.until) {
        const cr = crumbs,
          a = Math.min(1, (cr.until - t) / 2);
        ctx.globalAlpha = a;
        ell(ctx, cr.x, cr.y, 26 + Math.sin(t * 3) * 3, 9, null, 'rgba(255,255,255,.8)', 2);
        for (let i = 0; i < 7; i++)
          ell(
            ctx,
            cr.x + Math.cos(i * 2.4) * (8 + (i % 3) * 6),
            cr.y + Math.sin(i * 2.4) * 4 + Math.sin(t * 4 + i) * 1.5,
            2.2,
            1.8,
            '#c98b5a',
          );
        ctx.globalAlpha = 1;
      }
    },
    miniMap(ctx, s, k) {
      ctx.setLineDash([k, k]);
      line(ctx, 0, (BUOY_Y + 0.5) * k, m.w * k, (BUOY_Y + 0.5) * k, '#fa5252', 1.5);
      ctx.setLineDash([]);
      const bt = boatState();
      emoji(ctx, '⛵', (bt.x / T) * k, (bt.y / T) * k - k, Math.max(12, k * 2.6));
      if (GROT) {
        // подводный грот: значок места и кружок, пока закрыто — с замочком
        const land = LAND_BY_ID[GROT.land],
          sz = Math.max(12, k * 2.6);
        ell(ctx, GROT.x * k, GROT.y * k, k * 1.4, k * 1.4, null, '#fff', 1.5);
        emoji(ctx, land.icon, GROT.x * k, GROT.y * k - k * 1.6, sz);
        if (!landOpen(GROT.land)) emoji(ctx, '🔒', GROT.x * k + sz * 0.55, GROT.y * k - k * 1.6 + sz * 0.3, sz * 0.6);
      }
      if (FAR) {
        // отметка дальнего пути: компас, пока закрыто — с замочком
        const sz = Math.max(12, k * 2.6);
        emoji(ctx, '🧭', FAR.x * k, FAR.y * k - k, sz);
        if (!landOpen(FAR.land)) emoji(ctx, '🔒', FAR.x * k + sz * 0.55, FAR.y * k - k + sz * 0.3, sz * 0.6);
      }
      if (PORT) {
        // причал тайного места: значок, пока закрыто — с замочком
        const land = LAND_BY_ID[PORT.land],
          sz = Math.max(12, k * 2.6);
        emoji(ctx, land.icon, PORT.dock[0] * k, PORT.dock[1] * k + k, sz);
        if (!landOpen(PORT.land))
          emoji(ctx, '🔒', PORT.dock[0] * k + sz * 0.55, PORT.dock[1] * k + k + sz * 0.3, sz * 0.6);
      }
    },
    /** Кнопки HUD: сойти с кораблика, нырнуть. */
    buttons() {
      const out = [];
      if (isBoating()) out.push({ id: 'boat', icon: '⚓', label: 'Сойти', on: true, fn: leaveBoat });
      if (canDive()) out.push({ id: 'dive', icon: '🤿', label: 'Нырнуть', on: true, fn: dive });
      return out;
    },

    /** Причал тайного места за буйками: где кораблику причалить (единицы мира) — для тестов. */
    portAt: () => PORT_PX,
    // ---------- для тестов ----------
    debugSea() {
      const n = {};
      for (const c of creatures) n[c.kind] = (n[c.kind] || 0) + 1;
      return n;
    },
    /** Дельфины выпрыгивают прямо сейчас перед хомячком (true — выпрыгнули; false — там мелко). */
    debugDolphins() {
      dolph = null;
      const d0 = sc.p.dir || 1;
      return showDolphins(sc.p.x + d0 * 170, sc.p.y + 30, d0) || showDolphins(sc.p.x - d0 * 170, sc.p.y + 30, -d0)
        ? sc.debugScreen(dolph.x, dolph.y)
        : false;
    },
    /** Прыжок дельфинов, который сейчас виден (или null), — для тестов. */
    dolphinJump: () => dolph,
    /** Перенести ближайшее существо этого вида к хомячку и заставить вынырнуть. */
    debugSeaShow(kind) {
      const c = creatures.find((q) => q.kind === kind);
      c.x = sc.p.x + 110;
      c.y = sc.p.y + 60;
      c.up = SEA_DUR[kind];
      c.dir = 1;
      c.feed = 0;
      return sc.debugScreen(c.x, c.y);
    },
  };
}

// ---------- рисунки ----------
/** Скала в море у буйка-ракушки: серый камень с бликом и отражением в воде (r — размер). */
function paintSeaCrag(ctx, r) {
  ell(ctx, 0, r * 0.35, r * 1.15, r * 0.4, 'rgba(255,255,255,.55)');
  ell(ctx, 0, 0, r, r * 0.75, '#a7aeb6', OUT, 2);
  ell(ctx, r * 0.25, r * 0.2, r * 0.6, r * 0.35, 'rgba(70,80,95,.22)');
  ell(ctx, -r * 0.3, -r * 0.25, r * 0.45, r * 0.25, '#cfd5db');
}
/** Плотик «Далеко на юг» (предмет farRaft): круги на воде, сам плотик из кэша, стрелка на юг, замочек, пока закрыто. */
function drawFarRaft(ctx, g, t) {
  const x = g.x,
    y = g.y,
    bob = Math.round(Math.sin(t * 1.6) * 2);
  for (let i = 0; i < 2; i++) {
    const ph = (t * 0.35 + i * 0.5) % 1;
    ell(ctx, x, y + 12, 34 + ph * 30, 9 + ph * 8, null, `rgba(255,255,255,${(0.55 * (1 - ph)).toFixed(2)})`, 2);
  }
  put('farMarker', x, y + bob);
  SP.world();
  // стрелка на юг покачивается под табличкой
  const ay = y - 30 + bob + Math.sin(t * 3) * 3;
  poly(
    ctx,
    [x + 22, ay - 6, x + 32, ay - 6, x + 32, ay + 4, x + 37, ay + 4, x + 27, ay + 14, x + 17, ay + 4, x + 22, ay + 4],
    '#ffd43b',
    OUT,
    1.6,
  );
  if (!landOpen(g.land)) emoji(ctx, '🔒', x + 40, y - 100 + bob, 18);
}
/** Отметка «Далеко на юг»: плотик из брёвен, столб и табличка (неподвижное — в кэше спрайтов). */
function paintFarMarker(ctx) {
  ell(ctx, 0, 12, 40, 9, 'rgba(255,255,255,.45)');
  for (let i = -2; i <= 2; i++) fillRR(ctx, i * 13 - 6, -2, 12, 18, 5, i % 2 ? '#a0662d' : '#b5793a', OUT, 1.6);
  line(ctx, -30, 4, 30, 4, 'rgba(74,55,40,.6)', 2);
  line(ctx, 0, 4, 0, -96, OUT, 6);
  line(ctx, 0, 4, 0, -96, '#c98b5a', 3.6);
  signBoard(ctx, '🧭 Далеко на юг', 0, -80, 104, 26, 'wood');
  poly(ctx, [0, -112, 12, -104, 0, -96], '#ff6b6b', OUT, 1.4);
  line(ctx, 0, -96, 0, -114, OUT, 2);
}
defineArt({ farMarker: [[-60, -120, 60, 24], paintFarMarker] });
function drawSeaCreature(ctx, c, t) {
  const x = c.x,
    y = c.y,
    k = c.up > 0 ? 1 - c.up / SEA_DUR[c.kind] : -1,
    dir = c.dir || (Math.cos(c.a) >= 0 ? 1 : -1);
  const rise = k < 0 ? 0 : Math.sin(Math.min(1, k * (c.kind === 'fish' ? 1 : 1.15)) * Math.PI); // 0 → 1 → 0
  if (c.kind === 'fish') {
    ctx.fillStyle = 'rgba(15,55,120,.28)';
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.ellipse(x + ((i * 23) % 40) - 20 + Math.sin(t * 3 + i) * 3, y + ((i * 17) % 26) - 13, 8, 3.5, c.a, 0, TAU);
      ctx.fill();
    }
    if (k >= 0) {
      const jx = x + dir * (k - 0.5) * 70,
        jy = y - Math.sin(k * Math.PI) * 50,
        col = ['#ff922b', '#ffd43b', '#f783ac'][c.v];
      ell(ctx, x - dir * 35, y, 12 * (1 - k) + 4, 4, 'rgba(255,255,255,.7)');
      if (k > 0.7) ell(ctx, x + dir * 35, y, 14, 4.5, 'rgba(255,255,255,.7)');
      ctx.save();
      ctx.translate(jx, jy);
      ctx.scale(dir, 1);
      ctx.rotate(-Math.cos(k * Math.PI) * 0.9);
      poly(ctx, [-9, 0, -18, -7, -18, 7], col, OUT, 1.5);
      ell(ctx, 0, 0, 12, 7, col, OUT, 1.8);
      ell(ctx, 6, -2, 1.6, 1.6, OUT);
      poly(ctx, [-2, -6, 4, -12, 5, -6], col, OUT, 1.2);
      ctx.restore();
    }
    return;
  }
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir, 1);
  if (c.kind === 'shark') {
    ell(ctx, 0, 4, 44, 13, 'rgba(15,45,100,.28)');
    ctx.strokeStyle = 'rgba(255,255,255,.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-14, 2);
    ctx.quadraticCurveTo(-34, -2, -50, 6);
    ctx.moveTo(-14, 6);
    ctx.quadraticCurveTo(-32, 10, -46, 14);
    ctx.stroke();
    if (rise < 0.25) poly(ctx, [-12, 4, 4, -24 + rise * 30, 12, 4], '#748ba0', OUT, 2); // плавник
    if (rise > 0.02) {
      ctx.beginPath();
      ctx.rect(-90, -160, 180, 166);
      ctx.clip();
      ctx.scale(1.4, 1.4);
      const hy = 34 - rise * 66;
      ctx.beginPath();
      ctx.moveTo(-26, hy + 60);
      ctx.quadraticCurveTo(-30, hy + 10, 6, hy - 16);
      ctx.quadraticCurveTo(30, hy + 6, 28, hy + 60);
      ctx.closePath();
      ctx.fillStyle = '#748ba0';
      ctx.fill();
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-4, hy + 60);
      ctx.quadraticCurveTo(2, hy + 14, 20, hy + 8);
      ctx.quadraticCurveTo(28, hy + 20, 28, hy + 60);
      ctx.closePath();
      ctx.fillStyle = '#f1f3f5';
      ctx.fill();
      ell(ctx, 2, hy + 4, 3.2, 3.6, '#1d1b1b');
      ell(ctx, 1, hy + 3, 1.1, 1.1, '#fff');
      ctx.beginPath();
      ctx.arc(14, hy + 16, 10, 0.1 * Math.PI, 0.85 * Math.PI);
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 2;
      ctx.stroke();
      for (let i = 0; i < 3; i++)
        poly(
          ctx,
          [8 + i * 5, hy + 24 - i, 10.5 + i * 5, hy + 29 - i * 1.5, 13 + i * 5, hy + 23.5 - i * 1.6],
          '#fff',
          OUT,
          1,
        );
      ctx.scale(1 / 1.4, 1 / 1.4);
      ell(ctx, 0, 6, 44, 7, 'rgba(255,255,255,.8)');
    }
  } else {
    ell(ctx, 0, 6, 92, 30, 'rgba(15,45,100,.26)');
    if (rise > 0.02) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(-140, -160, 280, 168);
      ctx.clip();
      const by = 50 - rise * 74;
      ctx.beginPath();
      ctx.ellipse(0, by + 26, 90, 54, 0, Math.PI, 0);
      ctx.closePath();
      ctx.fillStyle = '#34558f';
      ctx.fill();
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(-6, by + 22, 62, 38, 0, Math.PI * 1.15, Math.PI * 1.75);
      ctx.strokeStyle = 'rgba(255,255,255,.4)';
      ctx.lineWidth = 5;
      ctx.stroke();
      ell(ctx, 58, by + 6, 4, 4.6, '#1d1b1b');
      ell(ctx, 57, by + 5, 1.4, 1.4, '#fff');
      ctx.beginPath();
      ctx.arc(68, by + 8, 13, 0.25 * Math.PI, 0.8 * Math.PI);
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 2;
      ctx.stroke();
      if (k > 0.6) {
        const ty2 = by + 6 - (k - 0.6) * 60;
        poly(
          ctx,
          [-70, ty2 + 30, -84, ty2 - 6, -104, ty2 - 16, -92, ty2 + 2, -112, ty2 + 8, -90, ty2 + 14, -80, ty2 + 34],
          '#4c6ea8',
          OUT,
          2,
        );
      }
      ctx.restore();
      if (k > 0.1 && k < 0.6) {
        // фонтан
        const top = 50 - rise * 74 - 28;
        for (let i = 0; i < 9; i++) {
          const ph = (t * 1.6 + i / 9) % 1,
            sx = (i % 2 ? 1 : -1) * ph * (10 + (i % 3) * 7);
          ell(ctx, 14 + sx, top - ph * 70 + ph * ph * 46, 5 - ph * 2.4, 6 - ph * 2.4, 'rgba(255,255,255,.95)');
        }
      }
      ell(ctx, 0, 9, 96, 8, 'rgba(255,255,255,.7)');
    }
  }
  ctx.restore();
}

/** Кораблик (и хомячок в нём, если look): (x, y) — середина на воде; рисуется линиями, каждый кадр. */
export function drawBoat(ctx, x, y, dir, t, look, moving) {
  const bob = Math.sin(t * 2.2 + x * 0.01) * 3;
  ell(ctx, x, y + 16, 62, 12, 'rgba(255,255,255,.4)');
  if (moving) {
    ctx.strokeStyle = 'rgba(255,255,255,.8)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const k = (t * 1.6 + i / 3) % 1;
      ctx.globalAlpha = 1 - k;
      ctx.beginPath();
      ctx.ellipse(x - dir * (50 + k * 46), y + 16, 10 + k * 16, 4 + k * 5, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  ctx.save();
  ctx.translate(x, y + bob);
  ctx.scale(dir, 1); // мачта и паруса — позади хомячка
  line(ctx, 2, -8, 2, -104, OUT, 6);
  line(ctx, 2, -8, 2, -104, '#a8703f', 3);
  const puff = moving ? 6 : 2;
  ctx.beginPath();
  ctx.moveTo(6, -100);
  ctx.quadraticCurveTo(40 + puff, -66, 48, -28);
  ctx.lineTo(6, -24);
  ctx.closePath();
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = '#ff8fab';
  ctx.fillRect(0, -74, 60, 12);
  ctx.fillRect(0, -48, 60, 12);
  ctx.restore();
  poly(ctx, [-2, -92, -30, -30, -2, -26], '#ffe066', OUT, 2);
  poly(ctx, [2, -104, -16, -98 + Math.sin(t * 6) * 2, 2, -92], '#fa5252', OUT, 1.5);
  ctx.restore();
  if (look)
    drawHamster(ctx, x - dir * 6, y + 8 + bob, PS, look, {
      dir,
      time: t,
      clipBelow: -26,
      shadow: false,
      blink: blinkAt(t),
      happy: moving,
    });
  ctx.save();
  ctx.translate(x, y + bob);
  ctx.scale(dir, 1); // борт — перед хомячком
  ctx.beginPath();
  ctx.moveTo(-54, -12);
  ctx.lineTo(60, -12);
  ctx.quadraticCurveTo(52, 16, 28, 20);
  ctx.lineTo(-34, 20);
  ctx.quadraticCurveTo(-52, 16, -54, -12);
  ctx.closePath();
  ctx.fillStyle = '#e8590c';
  ctx.fill();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  fillRR(ctx, -57, -17, 120, 9, 4, '#fff3bf', OUT, 2);
  ell(ctx, 14, 4, 5.5, 5.5, '#74c0fc', OUT, 1.5);
  ell(ctx, -12, 4, 5.5, 5.5, '#74c0fc', OUT, 1.5);
  ctx.restore();
  ell(ctx, x, y + 22 + bob * 0.3, 52, 5, 'rgba(255,255,255,.75)');
}
