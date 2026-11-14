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
// icebergs — айсберги, key — под каким ключом кораблик лежит в сохранении, creatures — сколько кого в море.
import { clamp, rnd, seeded, TAU, dist } from '../core/util.js';
import { ell, fillRR, line, poly, emoji } from '../core/draw.js';
import { drawHamster, blinkAt } from '../art/hamster.js';
import { G } from '../core/state.js';
import { award, setFlag, setDayFlag, patchState, touchState } from '../core/actions.js';
import { emit } from '../core/events.js';
import { run } from '../core/registry.js';
import { go, scene } from '../core/loop.js';
import { toast } from '../ui/toast.js';
import { sfx } from '../core/audio.js';
import { T, OUT, PS, SP, put, tileOf, defineObjects } from '../engine/topdown/kinds.js';
import './common/index.js';

/** Море города: где оно на карте, острова (центр в клетках, размеры и что на них стоит). */
export const WORLD_SEA = {
  key: 'boat',
  shallowY: 42,
  seaY: 44,
  buoyY: 74,
  boatHome: [52.5, 46.5], // у пирса
  creatures: { fish: 22, shark: 6, whale: 6 },
  icebergs: [
    [6, 87],
    [20, 98],
    [3, 99],
    [24, 84],
  ],
  isles: [
    {
      name: 'Остров Сундука',
      x: 22,
      y: 53,
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
      x: 47,
      y: 57,
      rx: 4.6,
      ry: 2.8,
      deco: [
        ['palm', -2, -1],
        ['palm', 1, -2],
        ['palm', 3, 0],
        ['starfish', -1, 1],
        ['crab', 1, 1],
      ],
    },
    {
      name: 'Крабий островок',
      x: 64,
      y: 51,
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
      x: 9,
      y: 63,
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
      x: 33,
      y: 68,
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
      x: 60,
      y: 67,
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
      x: 36,
      y: 90,
      rx: 7.2,
      ry: 4.2,
      treasure: true,
      deco: [
        ['volcano', 0, -2],
        ['palm', -5, -1],
        ['palm', -3, 1],
        ['palm', 4, -1],
        ['palm', 5, 1],
        ['chest', 1, 2],
        ['crab', -1, 2],
        ['flag', 3, 2],
      ],
    },
    {
      name: 'Ледяной остров',
      x: 12,
      y: 93,
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
      x: 61,
      y: 88,
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

const SEA_DUR = { fish: 0.85, shark: 2.4, whale: 5 };
const isDeep = (c) => c === 'w' || c === 'O';
const isSea = (c) => c === 'w' || c === 'O' || c === 'h'; // где проходит кораблик

export function createSea(cfg) {
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
    pass: (tx, ty) => isSea(ch(tx, ty)),
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
  }
  /** Предметы: то, что стоит на островах, буйки и айсберги. */
  function buildObjects(g) {
    for (const is of ISLES)
      for (const [type, dx, dy] of is.deco)
        g.add(type, Math.floor(is.x) + dx, Math.floor(is.y) + dy, type === 'umbrella' ? { beach: true } : {});
    for (let x = 1; x < g.w; x += 5) g.add('buoy', x, BUOY_Y);
    for (const [x, y] of cfg.icebergs || []) g.add('iceberg', x, y);
  }

  // ---------- кораблик ----------
  function boardBoat() {
    const p = sc.p,
      bt = boatState();
    if (dist(p.x, p.y, bt.x, bt.y) > T * 2.4) return;
    p.ride = BOAT;
    setBoat({ on: true });
    p.x = bt.x;
    p.y = bt.y;
    p.path = [];
    p.surf = ch(tileOf(p.x), tileOf(p.y));
    sfx('splash');
    sfx('ok');
    award('x_boat');
    if (!G.state.flags.boatHint) {
      setFlag('boatHint');
      toast('Ты на кораблике! Нажимай на воду — поплывём. Теперь можно и за буйки! ⛵');
    }
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
    if (dist(p.x / T, p.y / T, tx + 0.5, ty + 0.5) > 2.6 || !m.foot(tx, ty)) {
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
  /** Нажатие, когда хомячок на кораблике. */
  function boatTap(w, tx, ty) {
    const p = sc.p;
    for (const f of creatures)
      if (f.kind === 'fish' && dist(w.x, w.y, f.x, f.y) < 44) {
        if (sc.walkTo(f.x - 50, f.y + 20, true)) p.pending = { fn: feedFish };
        sfx('tap');
        return;
      }
    const c = ch(tx, ty);
    if (isSea(c)) {
      if (sc.walkTo(w.x, w.y, true)) sfx('paddle');
      return;
    }
    if (m.foot(tx, ty)) {
      if (sc.walkTo(w.x, w.y, false)) p.pending = { fn: () => landFromBoat(tx, ty) };
      sfx('tap');
      return;
    } // берег: подплыть и сойти
    sc.walkTo(w.x, w.y, false);
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
        if (c.kind === 'shark' && dist(c.x, c.y, p.x, p.y) < T * 3 && !G.state.dayFlags.shark) {
          setDayFlag('shark');
          toast('Акула улыбнулась тебе и поплыла дальше 🦈');
        }
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

  // ---------- ныряние ----------
  /** Нырять можно только там, где глубоко. */
  const canDive = () => !!sc && sc.built && isDeep(ch(tileOf(sc.p.x), tileOf(sc.p.y)));
  /** Нырнуть там, где стоим (если глубоко). */
  function dive() {
    if (canDive()) go('dive', { x: sc.p.x, boat: isBoating(), width: m.w * T });
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

    // ---------- крюки движка ----------
    built(s) {
      sc = s;
      m = s.map;
      initSea();
    },
    enter(s, from, params) {
      const p = s.p,
        bt = boatState();
      p.ride = bt.on ? BOAT : null;
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
      return d < T * 2 ? { d: d * 0.5, pending: { fn: boardBoat } } : null;
    },
    idle: dive,
    update(s, dt) {
      updateSea(dt);
    },
    surface(s, c) {
      const p = s.p;
      if (p.ride) {
        if (c === 'O' && award('x_far')) toast('Это открытое море. Где-то здесь прячутся дальние острова…');
      }
      if ((c === 's' || c === 'I') && tileOf(p.y) > SEA_Y) landOnIsle();
    },
    things(s, add, v) {
      for (const c of creatures)
        if (c.x > v.x0 && c.x < v.x1 && c.y > v.y0 && c.y < v.y1) add(c.y + 8, drawCreature, c);
      if (!s.p.ride) {
        const bt = boatState();
        add(bt.y + 12, drawFreeBoat, bt, true);
      }
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
    },
    /** Кнопки HUD: сойти с кораблика, нырнуть. */
    buttons() {
      const out = [];
      if (isBoating()) out.push({ id: 'boat', icon: '⚓', label: 'Сойти', on: true, fn: leaveBoat });
      if (canDive()) out.push({ id: 'dive', icon: '🤿', label: 'Нырнуть', on: true, fn: dive });
      return out;
    },

    // ---------- для тестов ----------
    debugSea() {
      const n = {};
      for (const c of creatures) n[c.kind] = (n[c.kind] || 0) + 1;
      return n;
    },
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

function drawBoat(ctx, x, y, dir, t, look, moving) {
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
