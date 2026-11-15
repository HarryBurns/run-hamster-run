// Хомяк-Тауэр изнутри: холл → лифт → смотровая площадка на 101-м этаже, по которой можно гулять.
import { clamp, rnd, TAU, el } from '../core/util.js';
import { ell, fillRR, line, poly, mix, rr, star, text, emoji, makeCanvas } from '../core/draw.js';
import { drawHamster, blinkAt } from '../art/hamster.js';
import { vendorLook, VENDORS } from '../data/index.js';
import { G, playerLook, cal, darkness, ownsHome, walkK, sneezePhase } from '../core/state.js';
import { award, bumpFlag } from '../core/actions.js';
import { emit } from '../core/events.js';
import { run } from '../core/registry.js';
import { go } from '../core/loop.js';
import { axisX } from '../core/input.js';
import { Camera } from '../core/camera.js';
import { sfx } from '../core/audio.js';
import { openPanel } from '../ui/panel.js';
import { dialog } from '../ui/dialog.js';
import { toast } from '../ui/toast.js';
import {
  VIEW_H,
  VIEW_LAYERS,
  VIEW_TOWN,
  viewEnv,
  viewSky,
  renderViewLayer,
  paintViewLive,
  cloud,
} from './tower_view.js';

const OUT = '#4a3728',
  HS = 1.45;
const LOBBY_W = 1100,
  DECK_W = 2100,
  RIDE_T = 4.6;

// Всё, с чем можно играть: x — центр, w/h — размер области нажатия.
const HOT = {
  lobby: [
    { id: 'exit', x: 120, w: 110, h: 200, act: 'exit' },
    { id: 'sofa', x: 330, w: 190, h: 90, act: 'sit' },
    { id: 'clerk', x: 610, w: 150, h: 170, act: 'talk' },
    { id: 'lift', x: 940, w: 170, h: 230, act: 'lift' },
  ],
  deck: [
    { id: 'lift', x: 170, w: 170, h: 230, act: 'lift' },
    { id: 'scope1', x: 620, w: 90, h: 150, act: 'scope_city' },
    { id: 'bench', x: 990, w: 200, h: 90, act: 'sit' },
    { id: 'planes', x: 1340, w: 120, h: 120, act: 'plane' },
    { id: 'scope2', x: 1660, w: 90, h: 150, act: 'scope_sea' },
    { id: 'flag', x: 1960, w: 80, h: 300, act: 'flag' },
  ],
};

const S = {
  level: 'lobby',
  cam: new Camera(),
  back: null, // позиция снаружи (у дверей башни): туда выходим и её же кладём в сохранение
  floorY: 500,
  p: { x: 200, dir: 1, tx: null, moving: false, walkT: 0, pending: null, state: 'idle', happy: 0, stepT: 0 },
  ride: null,
  planes: [],
  balloons: [],
  pops: [],
  aim: null,
  seenDeck: false,
};

// ---------- вход / выход ----------
export function enter(from, params = {}) {
  const p = S.p;
  S.back = params.back || { scene: 'world' };
  S.level = 'lobby';
  S.ride = null;
  S.planes = [];
  S.balloons = [];
  S.pops = [];
  S.aim = null;
  p.x = 190;
  p.dir = 1;
  p.tx = null;
  p.pending = null;
  p.state = 'idle';
  p.moving = false;
  layout();
  S.cam.x = p.x;
  clampCam();
}
export function leave() {
  // картинки слоёв панорамы — несколько мегабайт: вне башни они не нужны (пока едет лифт, нарисуются заново)
  VIEW.layers = [];
  VIEW.geo = '';
}
/** В сохранении башня не хранится: после перезагрузки хомячок окажется у её дверей. */
export function savePos() {
  return S.back;
}
export const onDeck = () => S.level === 'deck';
/** Для тестов: состояние и экранные координаты шариков. */
export function debugState() {
  const z = S.cam.zoom,
    sc = (x, y) => S.cam.toScreen(x, y);
  return {
    level: S.level,
    state: S.p.state,
    px: S.p.x,
    planes: S.planes.length,
    balloons: S.balloons.map((b) => ({ ...sc(b.x, b.y), vx: b.vx, vy: b.vy, out: !!b.out })),
    pops: G.state.flags.balloons || 0,
    zoom: z,
  };
}
/** Для тестов: поставить хомячка в точку x (у лифта, у выхода). */
export function debugAt(x) {
  S.p.x = x;
  S.p.tx = null;
  S.p.state = 'idle';
}
export function debugDeck() {
  S.level = 'deck';
  S.p.x = 1100;
  S.p.state = 'idle';
  S.p.tx = null;
}

const width = () => (S.level === 'deck' ? DECK_W : LOBBY_W);
function layout() {
  const { w, h } = G.view;
  S.cam.setZoom(clamp(Math.min(w, h) / 470, 0.62, 1.05));
  S.floorY = h * (h > w ? 0.72 : 0.8); // пол (y = 0 в мире) — на этой высоте экрана
  S.cam.setAnchor(null, S.floorY);
}
function clampCam() {
  S.cam.setBounds(0, null, width(), null); // камера ездит только по горизонтали
  S.cam.clamp();
}
const toWorld = (sx, sy) => S.cam.toWorld(sx, sy);

// ---------- действия ----------
function goTo(x, pending) {
  const p = S.p;
  p.state = 'idle';
  p.tx = clamp(x, 50, width() - 50);
  p.pending = pending || null;
}
function act(o) {
  const p = S.p;
  switch (o.act) {
    case 'exit':
      sfx('door');
      go(S.back.scene, { pos: S.back });
      break;
    case 'sit':
      p.state = 'sit';
      p.x = o.x;
      sfx('pop');
      break;
    case 'talk':
      dialog({
        look: vendorLook('tower'),
        name: VENDORS.tower.name,
        text: 'Добро пожаловать в Хомяк-Тауэр! Лифт справа: заходи — и вжух на 101-й этаж. Наверху смотровая площадка, подзорные трубы и бумажные самолётики!',
        options: [{ text: 'Спасибо!', cls: 'green' }],
      });
      break;
    case 'lift':
      // у хозяйки пентхауса в лифте две кнопки: смотровая площадка и «домой, на сотый»
      if (S.level === 'lobby' && ownsHome('penthouse')) {
        dialog({
          look: vendorLook('tower'),
          name: VENDORS.tower.name,
          text: 'Вам на какой этаж? Сотый — ваш пентхаус, сто первый — смотровая площадка.',
          options: [
            { text: '🌇 100 — мой пентхаус', cls: 'green' },
            { text: '🔭 101 — площадка', cls: 'blue' },
            { text: 'Никуда' },
          ],
        }).then((i) => {
          if (i === 0) run('home:penthouse', { back: S.back });
          else if (i === 1) startRide();
        });
        break;
      }
      startRide();
      break;
    case 'scope_city':
      sfx('pop');
      run('panorama');
      break;
    case 'scope_sea':
      sfx('pop');
      openSeaScope();
      break;
    case 'plane':
      // берём самолётик и целимся: дальше нажатия по небу — это прицел
      p.state = 'aim';
      p.x = o.x - 90;
      p.dir = 1;
      S.aim = null;
      sfx('pop');
      if (!S.balloons.some((b) => !b.out)) spawnBalloon(rnd(-250, -130)); // первая мишень — сразу, не ждать
      if (!S.planeHint) {
        S.planeHint = true;
        toast('Нажми на небо и тяни: пунктир покажет, куда полетит самолётик. Отпусти — и он летит! ✈️');
      }
      break;
    case 'flag':
      toast('Выше только облака! До земли — 101 этаж 🏁');
      sfx('magic');
      p.happy = 1.5;
      break;
    default:
      break;
  }
}
function startRide() {
  S.ride = { dir: S.level === 'lobby' ? 1 : -1, t: 0, from: S.level };
  S.level = 'ride';
  S.balloons = [];
  S.aim = null;
  sfx('door');
}
function arrive() {
  const pd = S.p.pending;
  S.p.pending = null;
  if (pd) act(pd);
}
function hit(wx, wy) {
  for (const o of HOT[S.level] || []) if (Math.abs(wx - o.x) <= o.w / 2 && wy >= -o.h && wy <= 14) return o;
  return null;
}

// ---------- ввод ----------
let down = null;
export function pointerDown(sx, sy) {
  if (S.level === 'deck' && S.p.state === 'aim') {
    const w = toWorld(sx, sy);
    if (w.y < -24) {
      S.aim = { x: w.x, y: w.y };
      S.p.dir = w.x >= S.p.x ? 1 : -1;
      down = null;
      return;
    } // по небу — целимся
  }
  down = { sx, sy };
}
export function pointerMove(sx, sy) {
  if (!S.aim) return;
  const w = toWorld(sx, sy);
  S.aim = { x: w.x, y: Math.min(w.y, -24) };
  S.p.dir = w.x >= S.p.x ? 1 : -1;
}
export function pointerUp(sx, sy) {
  if (S.aim) {
    launch(S.aim);
    S.aim = null;
    return;
  }
  if (!down) return;
  const moved = Math.hypot(sx - down.sx, sy - down.sy) > 16;
  down = null;
  if (moved || S.level === 'ride') return;
  const w = toWorld(sx, sy),
    o = hit(w.x, w.y);
  if (o) {
    goTo(o.x, o);
    sfx('tap');
  } else {
    goTo(w.x);
    sfx('step');
  }
}
export function interact() {
  if (S.level === 'ride') return;
  if (S.p.state === 'aim') {
    launch({ x: S.p.x + S.p.dir * 420, y: -300 });
    return;
  }
  let best = null,
    bd = 160;
  for (const o of HOT[S.level]) {
    const d = Math.abs(o.x - S.p.x);
    if (d < bd) {
      bd = d;
      best = o;
    }
  }
  if (best) {
    S.p.tx = null;
    act(best);
  }
}

// ---------- самолётики: прицел и полёт ----------
const PG = 130; // «сила тяжести» для самолётика
const planeOrigin = () => ({ x: S.p.x + S.p.dir * 34, y: -128 });
/** Скорость броска, при которой самолётик пролетит точно через точку прицела. */
function launchVel(tg) {
  const o = planeOrigin(),
    dx = tg.x - o.x,
    dy = tg.y - o.y;
  const T = clamp(Math.hypot(dx, dy) / 520, 0.45, 1.5);
  return { o, T, vx: dx / T, vy: dy / T - 0.5 * PG * T };
}
function launch(tg) {
  const v = launchVel(tg);
  S.planes.push({
    x0: v.o.x,
    y0: v.o.y,
    x: v.o.x,
    y: v.o.y,
    vx: v.vx,
    vy0: v.vy,
    vy: v.vy,
    t: 0,
    c: ['#fff', '#ffe066', '#ffc9de', '#a5d8ff', '#b2f2bb'][Math.floor(rnd(0, 5))],
  });
  S.p.happy = 0.6;
  sfx('whistle');
}
// Шарики-мишени есть, только пока хомячок держит самолётик (режим прицела). Вышла из режима, ушла от столика —
// шарики за BALLOON_OUT секунд улетают вверх и тают; вне режима небо над площадкой без мишеней.
const BALLOON_IN = 0.4,
  BALLOON_OUT = 0.9;
function spawnBalloon(y = -70) {
  const vw = G.view.w / S.cam.zoom;
  S.balloons.push({
    x: S.cam.x + rnd(-vw / 2 + 40, vw / 2 - 40),
    y,
    vx: rnd(-14, 14),
    vy: rnd(-46, -26),
    ph: rnd(0, 6),
    age: 0,
    out: 0,
    c: ['#fa5252', '#ffd43b', '#4dabf7', '#51cf66', '#f783ac', '#b197fc'][Math.floor(rnd(0, 6))],
  });
}
const balloonAlpha = (b) => Math.min(1, b.age / BALLOON_IN) * (b.out ? Math.max(0, 1 - b.out / BALLOON_OUT) : 1);
function updatePlanes(dt) {
  const top = -(S.floorY / S.cam.zoom) - 80,
    aiming = S.p.state === 'aim';
  // воздушные шарики поднимаются из города — в них можно попасть
  if (aiming && S.balloons.filter((b) => !b.out).length < 4 && Math.random() < dt * 0.7) spawnBalloon();
  for (const b of S.balloons) {
    b.age += dt;
    if (!aiming || b.out) {
      b.out += dt;
      b.vy -= 260 * dt; // улетает всё быстрее
    }
    b.x += (b.vx + Math.sin(G.time * 1.3 + b.ph) * 16) * dt;
    b.y += b.vy * dt;
  }
  S.balloons = S.balloons.filter((b) => b.y > top && !b.dead && b.out < BALLOON_OUT);
  for (const q of S.planes) {
    if (q.land) {
      q.land += dt;
      continue;
    }
    q.t += dt;
    q.x = q.x0 + q.vx * q.t;
    q.y = q.y0 + q.vy0 * q.t + 0.5 * PG * q.t * q.t;
    q.vy = q.vy0 + PG * q.t;
    if (q.y >= -8 && q.t > 0.3) {
      q.y = -8;
      q.land = 0.001;
      continue;
    } // сел на пол площадки
    for (const b of S.balloons)
      if (!b.dead && b.out < BALLOON_OUT / 2 && Math.hypot(q.x - b.x, q.y - b.y) < 40) {
        b.dead = true;
        sfx('pop');
        sfx('coin');
        S.p.happy = 1.4;
        for (let i = 0; i < 10; i++)
          S.pops.push({ x: b.x, y: b.y, vx: rnd(-150, 150), vy: rnd(-170, 60), t: 0, c: b.c });
        const n = bumpFlag('balloons');
        if (n === 1) toast('Попала! 🎈 Целься в шарики — они лопаются!', 'good');
        if (n >= 5) award('x_ace');
      }
  }
  S.planes = S.planes.filter((q) => q.t < 9 && !(q.land > 1.8));
  for (const c of S.pops) {
    c.t += dt;
    c.x += c.vx * dt;
    c.y += c.vy * dt;
    c.vy += 320 * dt;
  }
  S.pops = S.pops.filter((c) => c.t < 0.9);
}

// ---------- обновление ----------
export function update(dt) {
  const p = S.p;
  layout();
  if (p.happy > 0) p.happy -= dt;
  if (S.level === 'ride') {
    const r = S.ride;
    r.t += dt;
    if (Math.floor(r.t / 0.55) !== Math.floor((r.t - dt) / 0.55) && r.t < RIDE_T - 0.6) sfx('lift');
    if (r.t >= RIDE_T) {
      S.level = r.dir > 0 ? 'deck' : 'lobby';
      S.ride = null;
      const lift = HOT[S.level].find((o) => o.id === 'lift');
      p.x = lift.x;
      p.dir = r.dir > 0 ? 1 : -1;
      p.tx = lift.x + (r.dir > 0 ? 170 : -170);
      p.pending = null;
      S.cam.x = p.x;
      sfx('ding');
      if (S.level === 'deck') {
        emit('visit', { place: 'tower' });
        if (!award('x_tower') && !S.seenDeck) toast('101-й этаж! Смотровая площадка 🔭');
        S.seenDeck = true;
      }
    }
    return;
  }
  const kx = axisX();
  p.moving = false;
  if (kx) {
    p.state = 'idle';
    p.tx = null;
    p.pending = null;
    p.x = clamp(p.x + kx * 320 * walkK() * dt, 50, width() - 50);
    p.dir = kx;
    p.moving = true;
  } else if (p.tx !== null) {
    const dx = p.tx - p.x,
      step = 340 * walkK() * dt;
    if (Math.abs(dx) <= step) {
      p.x = p.tx;
      p.tx = null;
      arrive();
    } else {
      p.x += Math.sign(dx) * step;
      p.dir = Math.sign(dx);
      p.moving = true;
    }
  }
  if (p.moving) {
    p.walkT += dt * 2.6;
    p.stepT += dt;
    if (p.stepT > 0.3) {
      p.stepT = 0;
      sfx(S.level === 'deck' ? 'stepStone' : 'stepWood');
    }
  }
  if (S.level === 'deck') updatePlanes(dt);
  S.cam.setBounds(0, null, width(), null);
  S.cam.follow(p.x, null, dt, 5);
}

// =====================================================================
//                              РИСОВАНИЕ
// =====================================================================
function skyColors() {
  const d = darkness(),
    sea = cal().season;
  return { d, sea, ...viewSky(sea, d) };
}

// ---------- вид с площадки: панорама слоями ----------
// Слои панорамы (небо, море, пляж, дальние кварталы, площадь, крыши у башни — см. tower_view.js) лежат готовыми
// картинками в размер экрана. Кадр — это шесть копий со сдвигом: чем ближе слой, тем сильнее он едет при ходьбе
// (но всегда медленнее самой площадки). Перерисовываются слои, только когда сменились сезон, время суток
// (темнота идёт ступеньками) или размер экрана; вживую рисуется лишь то, что шевелится, — облака, кораблики, кит.
const VIEW = { geo: '', envKey: '', env: null, layers: [], todo: [] };
function viewGeom() {
  const { w, dpr = 1 } = G.view,
    z = S.cam.zoom,
    vw = w / z,
    maxCam = Math.max(1, DECK_W - vw);
  return {
    w,
    dpr,
    s: (S.floorY + 4) / VIEW_H, // CSS-пикселей в единице панорамы: её низ — у пола площадки
    travel: maxCam * z, // на сколько пикселей уезжает площадка от края до края
    f: clamp(S.cam.x - vw / 2, 0, maxCam) / maxCam, // где камера: 0 — левый край площадки, 1 — правый
  };
}
/** Картинки слоёв для такого экрана, сезона и времени суток. lazy — готовить по одной за вызов (пока едет лифт). */
function viewLayers(g, lazy) {
  const geo = [g.w, g.s, g.dpr, Math.round(g.travel)].join(':'),
    env = viewEnv(cal().season, darkness());
  if (geo !== VIEW.geo) {
    VIEW.geo = geo;
    VIEW.envKey = '';
    VIEW.layers = [];
  }
  if (env.key !== VIEW.envKey) {
    VIEW.envKey = env.key;
    VIEW.env = env;
    VIEW.todo = VIEW_LAYERS.map((l, i) => i);
  }
  // первый раз нужны все слои сразу; когда темнеет — по одному за кадр, чтобы игра не запнулась
  while (VIEW.todo.length) {
    const i = VIEW.todo.shift(),
      l = VIEW_LAYERS[i],
      fresh = !VIEW.layers[i];
    VIEW.layers[i] = renderViewLayer(l, (g.w + l.par * g.travel) / g.s, VIEW.env, g.s * g.dpr);
    if (lazy || !fresh) break;
  }
  return VIEW.layers;
}
function drawView(ctx, t) {
  const g = viewGeom(),
    layers = viewLayers(g),
    k = g.s * g.dpr,
    W = Math.round(g.w * g.dpr);
  for (let i = 0; i < VIEW_LAYERS.length; i++) {
    const l = VIEW_LAYERS[i],
      img = layers[i],
      off = Math.round(g.f * l.par * g.travel * g.dpr); // сдвиг — в целых пикселях экрана: копия 1:1
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(img.c, off, 0, W, img.c.height, 0, img.top, W, img.c.height);
    if (l.live) {
      ctx.setTransform(k, 0, 0, k, -off, 0);
      paintViewLive(ctx, l, img.L, VIEW.env, t);
    }
  }
  ctx.setTransform(g.dpr, 0, 0, g.dpr, 0, 0);
}
/** Для тестов: слои панорамы (размеры картинок, сдвиги) и таблица города, по которой она нарисована. */
export function debugView() {
  const g = viewGeom();
  return {
    town: VIEW_TOWN.map(([id, x, y, w, h]) => ({ id, x, y, w, h })),
    built: VIEW.envKey,
    todo: VIEW.todo.length,
    screen: Math.round(g.w * g.dpr),
    layers: VIEW_LAYERS.map((l, i) => ({
      id: l.id,
      par: l.par,
      w: VIEW.layers[i] ? VIEW.layers[i].c.width : 0,
      h: VIEW.layers[i] ? VIEW.layers[i].c.height : 0,
      off: Math.round(g.f * l.par * g.travel * g.dpr),
      maxOff: Math.round(l.par * g.travel * g.dpr),
    })),
  };
}

function liftDoors(ctx, x, open, label) {
  fillRR(ctx, x - 78, -232, 156, 232, 8, '#868e96', OUT, 2.5);
  fillRR(ctx, x - 64, -214, 128, 214, 4, '#fff9db', OUT, 2);
  const dw = 64 * (1 - open);
  if (dw > 1) {
    fillRR(ctx, x - 64, -214, dw, 214, 2, '#ffd43b', OUT, 2);
    fillRR(ctx, x + 64 - dw, -214, dw, 214, 2, '#ffd43b', OUT, 2);
  }
  fillRR(ctx, x - 44, -266, 88, 28, 8, '#343a40', OUT, 2);
  text(ctx, label, x, -251, 16, '#ffe066');
  ell(ctx, x + 96, -110, 8, 8, '#fa5252', OUT, 2);
}
function drawPlayer(ctx, t) {
  const p = S.p,
    pose = {
      time: t,
      dir: p.dir,
      walk: p.moving ? p.walkT : null,
      blink: blinkAt(t),
      happy: p.happy > 0,
      armsUp: p.happy > 0 && Math.sin(t * 10) > 0,
      sneeze: sneezePhase(),
    };
  if (p.state === 'aim') pose.armsUp = true;
  if (p.state === 'sit') drawHamster(ctx, p.x, -36, HS, playerLook(), { ...pose, sit: true, shadow: false });
  else drawHamster(ctx, p.x, 0, HS, playerLook(), pose);
}

function drawLobby(ctx, t) {
  const { w, h } = G.view,
    z = S.cam.zoom,
    d = darkness();
  ctx.fillStyle = '#5c7cfa';
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  S.cam.apply(ctx);
  ctx.lineJoin = 'round';
  // стены и пол
  ctx.fillStyle = '#dbe4ff';
  ctx.fillRect(-400, -330, LOBBY_W + 800, 330);
  ctx.fillStyle = 'rgba(255,255,255,.35)';
  for (let x = -380; x < LOBBY_W + 400; x += 60) ctx.fillRect(x, -330, 22, 296);
  ctx.fillStyle = '#bac8ff';
  ctx.fillRect(-400, -34, LOBBY_W + 800, 34);
  ctx.fillStyle = '#fff';
  ctx.fillRect(-400, -38, LOBBY_W + 800, 5);
  ctx.fillStyle = '#4263eb';
  ctx.fillRect(-400, -1200, LOBBY_W + 800, 870);
  ctx.fillStyle = '#364fc7';
  ctx.fillRect(-400, -340, LOBBY_W + 800, 12);
  for (let x = -400, i = 0; x < LOBBY_W + 400; x += 70, i++) {
    ctx.fillStyle = i % 2 ? '#f1f3f5' : '#dee2e6';
    ctx.fillRect(x, 0, 70, 400);
  }
  line(ctx, -400, 0, LOBBY_W + 400, 0, OUT, 2.5);
  fillRR(ctx, 700, -4, 330, 12, 4, '#fa5252', OUT, 1.5); // ковровая дорожка к лифту
  // окна на улицу
  const sky = skyColors();
  for (const x of [330, 760]) {
    fillRR(ctx, x - 90, -250, 180, 150, 10, '#fff', OUT, 2.5);
    fillRR(ctx, x - 80, -240, 160, 130, 6, sky.bot, null);
    for (let i = 0; i < 4; i++)
      fillRR(
        ctx,
        x - 70 + i * 38,
        -150 - ((i * 37) % 50),
        28,
        40 + ((i * 37) % 50),
        2,
        mix(['#f783ac', '#ffd43b', '#74c0fc', '#b2f2bb'][i], '#2a2f5e', d * 0.5),
      );
    line(ctx, x, -240, x, -110, '#fff', 5);
  }
  // вывеска
  fillRR(ctx, 430, -318, 320, 46, 14, '#ffd43b', OUT, 2.5);
  text(ctx, 'ХОМЯК-ТАУЭР · 101 этаж', 590, -294, 22, OUT);
  // выход
  fillRR(ctx, 66, -200, 108, 200, 8, '#8d5524', OUT, 2.5);
  fillRR(ctx, 76, -190, 88, 190, 5, '#74c0fc', OUT, 2);
  line(ctx, 120, -190, 120, 0, OUT, 2);
  fillRR(ctx, 80, -236, 80, 26, 8, '#2f9e44', OUT, 2);
  text(ctx, 'ВЫХОД', 120, -222, 14, '#fff');
  // диван и пальма
  fillRR(ctx, 245, -84, 170, 60, 16, '#f06595', OUT, 2);
  fillRR(ctx, 232, -56, 28, 50, 12, '#f783ac', OUT, 2);
  fillRR(ctx, 400, -56, 28, 50, 12, '#f783ac', OUT, 2);
  fillRR(ctx, 254, -40, 152, 34, 10, '#faa2c1', OUT, 2);
  poly(ctx, [470, 0, 510, 0, 504, -36, 476, -36], '#e8590c', OUT, 2);
  line(ctx, 490, -36, 494, -130, '#a8703f', 7);
  for (let i = 0; i < 6; i++) {
    ctx.save();
    ctx.translate(494, -130);
    ctx.rotate(-Math.PI * (0.05 + i * 0.18));
    ell(ctx, 32, 0, 34, 9, i % 2 ? '#37b24d' : '#2f9e44', OUT, 1.6);
    ctx.restore();
  }
  // лифтёр за стойкой
  drawHamster(ctx, 610, -66, HS * 0.95, vendorLook('tower'), { time: t, blink: blinkAt(t), shadow: false });
  fillRR(ctx, 520, -92, 180, 92, 8, '#ffd8a8', OUT, 2.5);
  fillRR(ctx, 512, -102, 196, 16, 6, '#e8590c', OUT, 2);
  ell(ctx, 668, -110, 9, 7, '#ffd43b', OUT, 1.5);
  line(ctx, 668, -117, 668, -122, OUT, 2);
  emoji(ctx, '🔭', 560, -50, 30);
  liftDoors(ctx, 940, 0, '▲ 101');
  drawPlayer(ctx, t);
  ctx.restore();
}

function drawDeck(ctx, t) {
  const { w, h } = G.view,
    z = S.cam.zoom,
    d = darkness();
  const railTop = S.floorY - 96 * z;
  drawView(ctx, t);
  ctx.save();
  S.cam.apply(ctx);
  ctx.lineJoin = 'round';
  // стеклянное ограждение (за хомячком)
  ctx.fillStyle = 'rgba(210,240,255,.28)';
  ctx.fillRect(-300, -96, DECK_W + 600, 96);
  for (let x = -280; x < DECK_W + 300; x += 140) fillRR(ctx, x - 4, -104, 8, 104, 3, '#dee2e6', OUT, 1.5);
  fillRR(ctx, -300, -108, DECK_W + 600, 10, 4, '#f1f3f5', OUT, 2);
  // пол
  for (let x = -350, i = 0; x < DECK_W + 350; x += 70, i++) {
    ctx.fillStyle = i % 2 ? '#ced4da' : '#dee2e6';
    ctx.fillRect(x, 0, 70, 500);
  }
  ctx.fillStyle = 'rgba(0,0,0,.12)';
  ctx.fillRect(-350, 0, DECK_W + 700, 8);
  line(ctx, -350, 0, DECK_W + 350, 0, OUT, 2.5);
  // будка лифта
  fillRR(ctx, 60, -292, 220, 292, 10, '#74c0fc', OUT, 2.5);
  poly(ctx, [44, -288, 170, -330, 296, -288], '#1c7ed6', OUT, 2.5);
  liftDoors(ctx, 170, 0, '▼ 1');
  // подзорные трубы
  for (const [x, dir] of [
    [620, 1],
    [1660, -1],
  ]) {
    fillRR(ctx, x - 7, -96, 14, 96, 4, '#868e96', OUT, 2);
    ell(ctx, x, -2, 26, 7, '#868e96', OUT, 2);
    ctx.save();
    ctx.translate(x, -108);
    ctx.rotate(-0.18 * dir);
    fillRR(ctx, -44, -18, 88, 36, 12, '#fa5252', OUT, 2.5);
    fillRR(ctx, 36 * dir - (dir > 0 ? 0 : 16), -22, 16, 44, 6, '#343a40', OUT, 2);
    ell(ctx, -44 * dir, 0, 7, 12, '#343a40', OUT, 2);
    ctx.restore();
    emoji(ctx, x < 1000 ? '🏙️' : '🌊', x, -164 + Math.sin(t * 3 + x) * 4, 26);
  }
  // скамейка
  fillRR(ctx, 900, -44, 180, 12, 5, '#d9a066', OUT, 2);
  fillRR(ctx, 900, -90, 180, 34, 6, '#c98b5a', OUT, 2);
  for (const x of [918, 1062]) fillRR(ctx, x - 5, -34, 10, 34, 3, '#868e96', OUT, 1.5);
  // столик с бумажными самолётиками
  fillRR(ctx, 1290, -70, 100, 10, 4, '#d9a066', OUT, 2);
  fillRR(ctx, 1300, -60, 8, 60, 3, '#a8703f', OUT, 1.5);
  fillRR(ctx, 1372, -60, 8, 60, 3, '#a8703f', OUT, 1.5);
  for (let i = 0; i < 3; i++)
    poly(
      ctx,
      [1304 + i * 26, -76, 1334 + i * 26, -84 - i * 2, 1314 + i * 26, -72],
      ['#fff', '#ffe066', '#ffc9de'][i],
      OUT,
      1.5,
    );
  fillRR(ctx, 1300, -150, 80, 30, 8, '#fff', OUT, 2);
  emoji(ctx, '✈️', 1340, -135, 20);
  // флаг и антенна
  fillRR(ctx, 1955, -300, 8, 300, 3, '#adb5bd', OUT, 2);
  ctx.beginPath();
  ctx.moveTo(1963, -296);
  for (let i = 0; i <= 8; i++) ctx.lineTo(1963 + i * 11, -296 + Math.sin(t * 5 + i * 0.8) * 5);
  for (let i = 8; i >= 0; i--) ctx.lineTo(1963 + i * 11, -246 + Math.sin(t * 5 + i * 0.8) * 5);
  ctx.closePath();
  ctx.fillStyle = '#ff6b9d';
  ctx.fill();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 2;
  ctx.stroke();
  emoji(ctx, '🐹', 2005, -270 + Math.sin(t * 5 + 3) * 4, 26);
  line(ctx, 2060, 0, 2060, -380, '#868e96', 5);
  ell(ctx, 2060, -386, 8, 8, Math.sin(t * 4) > 0 ? '#fa5252' : '#7a1f1f', OUT, 2);
  // цветы в кадках
  for (const x of [420, 1180, 1820]) {
    poly(ctx, [x - 24, 0, x + 24, 0, x + 19, -30, x - 19, -30], '#e8590c', OUT, 2);
    for (let i = -1; i <= 1; i++) {
      line(ctx, x + i * 6, -30, x + i * 14, -62, '#2f9e44', 3);
      for (let k = 0; k < 5; k++)
        ell(
          ctx,
          x + i * 14 + Math.cos((k * TAU) / 5) * 6,
          -64 + Math.sin((k * TAU) / 5) * 6,
          4.5,
          4.5,
          ['#ff6b9d', '#ffd43b', '#b197fc'][i + 1],
        );
      ell(ctx, x + i * 14, -64, 3, 3, '#fff3bf');
    }
  }
  drawPlayer(ctx, t);
  // шарики, самолётики и прицел
  for (const b of S.balloons) {
    ctx.globalAlpha = balloonAlpha(b); // появляются и тают плавно
    line(ctx, b.x, b.y + 26, b.x + Math.sin(t * 2 + b.ph) * 5, b.y + 64, 'rgba(74,55,40,.6)', 1.5);
    ell(ctx, b.x, b.y, 22, 27, b.c, OUT, 2);
    poly(ctx, [b.x - 5, b.y + 26, b.x + 5, b.y + 26, b.x, b.y + 33], b.c, OUT, 1.5);
    ell(ctx, b.x - 8, b.y - 10, 5, 8, 'rgba(255,255,255,.55)');
  }
  ctx.globalAlpha = 1;
  for (const c of S.pops) {
    ctx.globalAlpha = 1 - c.t / 0.9;
    fillRR(ctx, c.x - 4, c.y - 4, 8, 8, 2, c.c);
  }
  ctx.globalAlpha = 1;
  const paperPlane = (x, y, ang, flip, col, s = 1) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.scale(s, s * flip);
    poly(ctx, [-18, -4, 20, 0, -18, 10, -10, 1], col, OUT, 1.6);
    line(ctx, -10, 1, 20, 0, OUT, 1.2);
    ctx.restore();
  };
  for (const q of S.planes)
    paperPlane(
      q.x,
      q.y,
      q.land ? 0 : Math.atan2(q.vy, q.vx),
      q.vx < 0 ? -1 : 1,
      q.c,
      q.land ? 1 : Math.max(0.55, 1 - q.t * 0.06),
    );
  if (S.p.state === 'aim') {
    const o = planeOrigin();
    if (S.aim) {
      const v = launchVel(S.aim);
      for (let i = 1; i <= 16; i++) {
        const tt = (i / 11) * v.T,
          dx = o.x + v.vx * tt,
          dy = o.y + v.vy * tt + 0.5 * PG * tt * tt;
        if (dy > -6) break;
        ctx.globalAlpha = i <= 11 ? 0.95 : 0.95 - (i - 11) * 0.17;
        ell(ctx, dx, dy, 5.5, 5.5, '#fff', OUT, 1.5);
      }
      ctx.globalAlpha = 1;
      const r = 20 + Math.sin(t * 8) * 3;
      ell(ctx, S.aim.x, S.aim.y, r, r, 'rgba(255,107,157,.18)', '#ff3d7f', 3.5);
      line(ctx, S.aim.x - r - 8, S.aim.y, S.aim.x + r + 8, S.aim.y, '#ff3d7f', 2.5);
      line(ctx, S.aim.x, S.aim.y - r - 8, S.aim.x, S.aim.y + r + 8, '#ff3d7f', 2.5);
      paperPlane(o.x, o.y, Math.atan2(v.vy, v.vx), v.vx < 0 ? -1 : 1, '#fff', 1.15);
    } else
      paperPlane(
        o.x,
        o.y + Math.sin(t * 3) * 3,
        S.p.dir > 0 ? -0.35 : Math.PI + 0.35,
        S.p.dir > 0 ? 1 : -1,
        '#fff',
        1.15,
      );
  }
  ctx.restore();
  // облака на уровне глаз и ночь
  for (let i = 0; i < 3; i++)
    cloud(
      ctx,
      ((i * 0.41 + t * 0.012 * (1 + i * 0.3)) % 1.3) * (w + 300) - 200,
      railTop - 40 - i * 70,
      1.2 + i * 0.3,
      0.5,
    );
  if (d > 0) {
    ctx.fillStyle = `rgba(24,24,72,${d * 0.32})`;
    ctx.fillRect(0, 0, w, h);
  }
  if (S.p.state === 'aim') {
    // подсказка
    const label =
      w < 520
        ? '✈️ Тяни по небу — целься · пол — уйти'
        : '✈️ Нажми на небо и тяни — целься. Отпусти — летит! Нажми на пол, чтобы уйти.';
    ctx.font = '900 14px ui-rounded, "Trebuchet MS", sans-serif';
    const tw = Math.min(w - 16, ctx.measureText(label).width + 28);
    fillRR(ctx, w / 2 - tw / 2, h - 44, tw, 30, 15, 'rgba(255,250,240,.94)');
    ctx.fillStyle = OUT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, w / 2, h - 28, tw - 16);
  }
}

function drawRide(ctx, t) {
  const { w, h } = G.view,
    r = S.ride;
  const k = clamp(r.t / RIDE_T, 0, 1),
    e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; // плавный разгон и торможение
  const prog = r.dir > 0 ? e : 1 - e,
    floor = Math.round(1 + prog * 100);
  const sky = skyColors();
  if (r.dir > 0) viewLayers(viewGeom(), true); // пока едем наверх, готовим вид с площадки
  ctx.fillStyle = '#343a40';
  ctx.fillRect(0, 0, w, h);
  const s = Math.min(w / 420, h / 560),
    cx = w / 2,
    cy = h / 2 + 12 * s;
  // шахта: балки проносятся мимо
  const speed = Math.sin(k * Math.PI) * 2600,
    sh = (prog * 9000) % 140;
  for (let y = -140; y < h + 140; y += 140) {
    ctx.fillStyle = '#495057';
    ctx.fillRect(0, y + sh * r.dir * (r.dir > 0 ? 1 : 1), w, 14);
  }
  for (const x of [cx - 190 * s, cx + 190 * s]) {
    ctx.fillStyle = '#212529';
    ctx.fillRect(x - 6, 0, 12, h);
  }
  // кабина
  const sway = Math.sin(t * 30) * Math.min(1.5, speed / 1500);
  ctx.save();
  ctx.translate(cx, cy + sway);
  ctx.scale(s, s);
  fillRR(ctx, -170, -230, 340, 430, 22, '#ffd43b', OUT, 4);
  fillRR(ctx, -150, -150, 300, 330, 12, '#fff9db', OUT, 3);
  // окно: за ним город уходит вниз, а небо светлеет
  ctx.save();
  rr(ctx, -130, -130, 260, 150, 10);
  ctx.clip();
  const g = ctx.createLinearGradient(0, -130, 0, 20);
  g.addColorStop(0, sky.top);
  g.addColorStop(1, sky.bot);
  ctx.fillStyle = g;
  ctx.fillRect(-130, -130, 260, 150);
  const cityY = 20 - 150 * (1 - prog) + prog * 60;
  for (let i = 0; i < 9; i++)
    fillRR(
      ctx,
      -130 + i * 30,
      cityY - 30 - ((i * 37) % 90) + prog * 190,
      26,
      300,
      3,
      mix(['#f783ac', '#74c0fc', '#ffd43b', '#b2f2bb', '#e5dbff'][i % 5], '#2a2f5e', sky.d * 0.5),
    );
  for (let i = 0; i < 4; i++)
    cloud(ctx, -100 + i * 70 + Math.sin(i * 3) * 20, -200 + i * 60 + prog * 330 - 120, 0.6, 0.85);
  ctx.restore();
  rr(ctx, -130, -130, 260, 150, 10);
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 3;
  ctx.stroke();
  line(ctx, -150, 40, 150, 40, OUT, 3);
  fillRR(ctx, -150, 36, 300, 10, 4, '#e0a800', OUT, 2); // поручень
  // табло с этажом
  fillRR(ctx, -70, -214, 140, 50, 10, '#212529', OUT, 3);
  text(ctx, `${r.dir > 0 ? '▲' : '▼'} ${floor}`, 0, -188, 30, '#ffe066');
  for (let i = 0; i < 5; i++)
    ell(ctx, 120, 70 + i * 22, 7, 7, i === Math.floor(prog * 4.99) ? '#ffe066' : '#dee2e6', OUT, 1.5);
  drawHamster(ctx, 0, 176, 1.75, playerLook(), {
    time: t,
    happy: k > 0.2 && k < 0.85,
    armsUp: k > 0.3 && k < 0.7 && Math.sin(t * 9) > 0,
    blink: blinkAt(t),
  });
  // двери: закрываются в начале и открываются в конце
  // (в пути кабина показана «в разрезе», чтобы было видно хомячка)
  const shut = k < 0.1 ? k / 0.1 : k > 0.9 ? 1 - (k - 0.9) / 0.1 : 1;
  const alpha = k < 0.1 || k > 0.9 ? 1 : k < 0.2 ? 1 - (k - 0.1) / 0.1 : k > 0.82 ? (k - 0.82) / 0.08 : 0;
  const dw = 150 * shut;
  if (dw > 1 && alpha > 0.01) {
    ctx.globalAlpha = alpha;
    fillRR(ctx, -150, -150, dw, 330, 4, '#ffe066', OUT, 3);
    fillRR(ctx, 150 - dw, -150, dw, 330, 4, '#ffe066', OUT, 3);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  ctx.font = `900 ${Math.round(18 * s)}px ui-rounded, "Trebuchet MS", sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.fillText(r.dir > 0 ? 'Едем наверх…' : 'Едем вниз…', cx, cy + 236 * s);
}

export function draw(ctx) {
  const t = G.time;
  if (S.level === 'ride') drawRide(ctx, t);
  else if (S.level === 'deck') drawDeck(ctx, t);
  else drawLobby(ctx, t);
}
/** Что слышно: музыка города; на площадке — немного моря и птицы. */
function sound() {
  return { day: 'town', sea: onDeck() ? 0.3 : 0, rain: 0.3, birds: onDeck(), crickets: false };
}
export default { enter, leave, update, draw, pointerDown, pointerMove, pointerUp, interact, savePos, sound };

// ---------- вид в подзорную трубу: море ----------
function openSeaScope() {
  let raf = 0;
  openPanel({
    title: 'Подзорная труба: море',
    icon: '🔭',
    cls: 'narrow',
    onClose: () => cancelAnimationFrame(raf),
    render(body) {
      const N = 320,
        { canvas, ctx } = makeCanvas(N, N);
      canvas.style.cssText +=
        ';display:block;margin:0 auto;border-radius:50%;border:10px solid #343a40;max-width:100%;height:auto';
      const sky = skyColors();
      const loop = () => {
        const t = G.time;
        const g = ctx.createLinearGradient(0, 0, 0, 120);
        g.addColorStop(0, sky.top);
        g.addColorStop(1, sky.bot);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, N, 120);
        ell(ctx, 250, 50, 24, 24, sky.d > 0.5 ? '#fff3bf' : '#ffe066');
        cloud(ctx, 80 + Math.sin(t * 0.2) * 20, 50, 0.8, 0.9);
        const sg = ctx.createLinearGradient(0, 118, 0, N);
        sg.addColorStop(0, mix('#1c6fc4', '#0f1f52', sky.d * 0.8));
        sg.addColorStop(1, mix('#58c6f2', '#1f3a78', sky.d * 0.8));
        ctx.fillStyle = sg;
        ctx.fillRect(0, 118, N, N);
        for (let i = 0; i < 16; i++)
          line(
            ctx,
            (i * 53 + t * 8) % N,
            130 + ((i * 41) % 180),
            ((i * 53 + t * 8) % N) + 16,
            130 + ((i * 41) % 180),
            'rgba(255,255,255,.5)',
            2,
          );
        // остров с пальмой и сундуком
        ell(ctx, 110, 236, 92, 20, 'rgba(255,255,255,.55)');
        ell(ctx, 110, 230, 78, 18, '#ffe9a8', OUT, 2);
        line(ctx, 96, 228, 104, 150, '#a8703f', 8);
        for (let a = 0; a < 6; a++) {
          ctx.save();
          ctx.translate(104, 150);
          ctx.rotate(-Math.PI * (0.03 + a * 0.19) + Math.sin(t * 1.5) * 0.04);
          ell(ctx, 28, 0, 30, 8, a % 2 ? '#40c057' : '#2f9e44', OUT, 1.5);
          ctx.restore();
        }
        fillRR(ctx, 136, 208, 30, 20, 4, '#a8703f', OUT, 2);
        fillRR(ctx, 135, 200, 32, 11, 5, '#c98b5a', OUT, 2);
        star(ctx, 168, 196 + Math.sin(t * 4) * 2, 5, '#fff3bf');
        // кит с фонтаном
        const wk = (t * 0.25) % 1,
          wy = 150 - Math.sin(wk * Math.PI) * 14;
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, N, 156);
        ctx.clip();
        ctx.beginPath();
        ctx.ellipse(236, wy + 16, 44, 24, 0, Math.PI, 0);
        ctx.closePath();
        ctx.fillStyle = '#4c6ea8';
        ctx.fill();
        ctx.strokeStyle = OUT;
        ctx.lineWidth = 2;
        ctx.stroke();
        ell(ctx, 262, wy + 6, 2.5, 3, '#1d1b1b');
        ctx.restore();
        if (wk > 0.2 && wk < 0.7)
          for (let i = 0; i < 7; i++) {
            const ph = (t * 1.6 + i / 7) % 1;
            ell(ctx, 240 + (i % 2 ? 1 : -1) * ph * 14, wy - 8 - ph * 38 + ph * ph * 26, 3, 4, '#fff');
          }
        ell(ctx, 236, 156, 50, 6, 'rgba(255,255,255,.6)');
        // плавник акулы и прыгающая рыбка
        const sx = 40 + ((t * 22) % 260);
        poly(ctx, [sx - 10, 286, sx + 4, 262, sx + 12, 286], '#748ba0', OUT, 2);
        line(ctx, sx - 30, 288, sx - 12, 286, 'rgba(255,255,255,.7)', 2);
        const fk = (t * 0.7) % 1,
          fx = 200 + fk * 50,
          fy = 262 - Math.sin(fk * Math.PI) * 34;
        ctx.save();
        ctx.translate(fx, fy);
        ctx.rotate(-Math.cos(fk * Math.PI) * 0.9);
        poly(ctx, [-8, 0, -16, -6, -16, 6], '#ff922b', OUT, 1.5);
        ell(ctx, 0, 0, 10, 6, '#ff922b', OUT, 1.6);
        ell(ctx, 5, -2, 1.4, 1.4, OUT);
        ctx.restore();
        raf = requestAnimationFrame(loop);
      };
      loop();
      body.appendChild(canvas);
      body.appendChild(
        el(
          'p',
          'center',
          'В море — необитаемые острова, а между ними плавают киты, акулы и рыбки. Туда можно доплыть от пляжа!',
        ),
      );
    },
  });
}
