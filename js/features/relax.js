// Отдых в городе (этап 17а): присесть на скамейку, прилечь на лежак, покачаться на качелях — и «Пляжный волейбол».
//
//   relax            нажали на скамейку, лежак, качели, гамак, горку, полотенце, бортик фонтана, бревно у костра…
//                    (вид предмета с полем seat — locations/common/seats.js): хомячок подходит и садится / ложится /
//                    качается; ещё нажатие или любой шаг — встаёт. Первый отдых — наклейка «Отдыхаю красиво»
//   relax:volley     сетка на городском пляже: мини-игра «Пляжный волейбол» (minigames/volley.js), за первые
//                    RELAX_PRIZE.volley.paid игр в день — маленький приз по звёздам
//
// Как устроено. Отдыхающий хомячок — «способ передвижения» героя (sc.p.ride, как кораблик или горячий источник):
// стоит на клетке рядом с предметом (место ax, ay из seat.spots — туда же и встаёт), а рисуется на сиденье — кадрами
// из кэша спрайтов (SP: поза, фаза качелей или ног, моргание). Шаг мира (событие step) смотрит: пошла — встала.
// Мелочи: на лежаке и полотенце днём на солнце над хомячком солнышко («загорает»), через несколько секунд — «z-z-z»
// (в гамаке — тоже); на качелях качается выше-ниже; на скамейке болтает ногами. Посидела немного — иногда рядом
// садится житель (на второе место того же предмета или на соседний такой же предмет), говорит реплику (RELAX_LINES)
// и раз в день от этого чуть крепче дружба (+1). Житель на это время «занят» (n.hold, engine/topdown/actors.js).
import { G, cal, walkK, friendHearts, npcDress } from '../core/state.js';
import { award, addFriendPts, setDayFlag } from '../core/actions.js';
import { on, emit } from '../core/events.js';
import { register } from '../core/registry.js';
import { scene } from '../core/loop.js';
import { sfx } from '../core/audio.js';
import { dist, shuffle, TAU } from '../core/util.js';
import { line, fillRR, emoji } from '../core/draw.js';
import { drawHamster, blinkAt } from '../art/hamster.js';
import { NPCS, NPC_BY_ID, npcLook, RELAX, RELAX_LINES, RELAX_PRIZE } from '../data/index.js';
import { T, PS, SP, OUT, OBJECTS, TILES } from '../engine/topdown/kinds.js';
import { canStand } from '../engine/topdown/actors.js';
import { toast } from '../ui/toast.js';
import { prizeGame } from './minigames.js';

const S = () => G.state;
/** Сейчас отдыхаем: { sc, o, how, spot, ride, t, ax, ay, lk, mate, joinAt, say } или null. */
let cur = null;

register(
  'relax',
  (p, ctx) => (p.arg === 'volley' ? volleyGame() : relaxAt(ctx.scene, ctx.obj)),
  'отдых: relax — присесть на предмет ctx.obj (скамейка, лежак, качели…; вид с полем seat); relax:volley — «Пляжный волейбол»',
);

// ---------- присесть и встать ----------
/** Вид предмета знает, как на нём отдыхают: { how, spots } или undefined. */
const seatOf = (o) => (OBJECTS[o.type] || {}).seat;
/** Предмет сейчас «под снегом»: гамак и полотенце зимой убраны. */
const hiddenNow = (sc, o) => (o.type === 'hammock' || o.type === 'towel') && (sc.desc.season || cal().season) === 'winter';
/** Какие места предмета заняты (хомячком или жителем рядом). */
function takenSpots(o) {
  const out = new Set();
  if (cur && cur.o === o) out.add(cur.spot);
  if (cur && cur.mate && cur.mate.o === o) out.add(cur.mate.spot);
  return out;
}
const anchorOf = (o, s) => ({ x: o.x + s[2], y: o.y + s[3] });

/** Нажали на предмет для отдыха: дойти до свободного места и сесть; уже сидим на нём — встать. */
export function relaxAt(sc, o) {
  if (!sc || !o) return false;
  const st = seatOf(o);
  if (!st || hiddenNow(sc, o)) return false;
  if (cur && cur.o === o && cur.sc === sc) {
    standUp();
    return true;
  }
  if (cur) standUp(true);
  const p = sc.p,
    taken = takenSpots(o);
  let best = -1,
    bd = 1e9;
  st.spots.forEach((s, i) => {
    if (taken.has(i)) return;
    const a = anchorOf(o, s),
      d = dist(a.x, a.y, p.x, p.y);
    if (d < bd) {
      bd = d;
      best = i;
    }
  });
  if (best < 0) {
    toast('Здесь уже занято — давай найдём другое местечко!');
    return false;
  }
  const a = anchorOf(o, st.spots[best]),
    pass = sc.pass();
  // клетка у предмета, куда встать, занята (за скамейкой куст) — садимся оттуда, где стоим
  const ok = canStand(pass, a.x, a.y);
  if (ok && dist(a.x, a.y, p.x, p.y) > 6) {
    if (sc.walkTo(a.x, a.y, true)) {
      p.pending = { fn: (s2) => sitDown(s2, o, best, a) };
      return true;
    }
  }
  sitDown(sc, o, best, ok ? a : { x: p.x, y: p.y });
  return true;
}

/** Короткий ключ внешности для кадров в кэше спрайтов. */
function lookKey(look) {
  const str = JSON.stringify(look);
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** Сесть (лечь, начать качаться) на место spot предмета o; хомячок стоит в точке a. */
function sitDown(sc, o, spot, a) {
  const st = seatOf(o),
    p = sc.p,
    pass = sc.pass();
  p.path = [];
  p.pending = null;
  p.moving = false;
  p.x = a.x;
  p.y = a.y;
  const look = sc.heroLook();
  const ride = {
    relax: true,
    // встаём на первом же шаге (событие step): до этого кадра хомячок идёт как пешком
    speed: ((TILES[p.surf] && TILES[p.surf].speed) || 225) * walkK(),
    pass: (tx, ty) => pass(tx, ty),
    draw: (ctx, _sc, e, t) => drawSelf(ctx, t),
    drop: () => standUp(true),
  };
  p.ride = ride;
  cur = {
    sc,
    o,
    how: st.how,
    spot,
    ride,
    t: 0,
    ax: a.x,
    ay: a.y,
    lk: lookKey(look),
    look,
    mate: null,
    joinAt: RELAX.joinAfter[0] + Math.random() * (RELAX.joinAfter[1] - RELAX.joinAfter[0]),
    say: null, // { text, t } — что сказал сам хомячок («Уи-и!»)
  };
  if (st.how === 'swing') o.busy = spot + 1;
  sfx(st.how === 'slide' ? 'whistle' : 'pop');
  emit('relax', { how: st.how, type: o.type });
  if (award('x_relax', { delay: 600 }))
    toast('Хорошо отдыхать! Нажми ещё раз — и хомячок встанет. Или просто иди дальше.', 'good');
  return true;
}

/** Встать. quiet — без звука (ушли из локации, пересели). */
export function standUp(quiet) {
  const c = cur;
  if (!c) return false;
  cur = null;
  if (c.o.busy) c.o.busy = 0;
  if (c.sc.p.ride === c.ride) c.sc.p.ride = null;
  releaseMate(c);
  if (!quiet && c.how !== 'slide') sfx('tap');
  return true;
}
function releaseMate(c) {
  const m = c.mate;
  if (!m) return;
  c.mate = null;
  if (m.o.busy && m.o !== c.o) m.o.busy = 0;
  if (m.o === c.o && c.how === 'swing') m.o.busy = 0;
  m.n.hold = null;
  m.n.path = [];
  m.n.wait = 1 + Math.random() * 2;
}

// ---------- шаг мира ----------
const SLIDE_T = 1.4; // сколько секунд съезжать с горки
on('step', ({ dt }) => {
  const c = cur;
  if (!c) return;
  const sc = c.sc,
    p = sc.p;
  // ушли из локации, пересели на кораблик, пошли — встали
  if (scene() !== sc || p.ride !== c.ride) return standUp(true);
  if (p.moving || p.path.length) return standUp();
  c.t += dt;
  if (c.say && (c.t - c.say.t > 1.6)) c.say = null;
  if (c.how === 'slide') {
    if (c.t >= SLIDE_T) {
      standUp(true);
      sfx('thud');
    }
    return;
  }
  if (c.how === 'swing' && !c.say && Math.random() < dt * 0.12) c.say = { text: 'Уи-и!', t: c.t };
  updateMate(c, dt);
});
// ушли в другую сцену (дом, мини-карта не в счёт) — встали
on('scene', () => {
  if (cur && scene() !== cur.sc) standUp(true);
});

// ---------- житель присаживается рядом ----------
/** Свободное место для жителя: второе место того же предмета или соседний такой же предмет рядом. */
function mateSpot(c) {
  const st = seatOf(c.o);
  for (let i = 0; i < st.spots.length; i++) if (i !== c.spot) return { o: c.o, spot: i };
  let best = null,
    bd = T * 2.6;
  for (const o of c.sc.map.objs) {
    if (o === c.o || o.type !== c.o.type || Math.abs(o.y - c.o.y) > T * 0.5) continue;
    const d = Math.abs(o.x - c.o.x);
    if (d < bd) {
      bd = d;
      best = { o, spot: 0 };
    }
  }
  return best;
}
function tryJoin(c) {
  if (c.how !== 'sit' && c.how !== 'lie' && c.how !== 'swing') return;
  const free = mateSpot(c);
  if (!free) return;
  const sc = c.sc,
    m = sc.map,
    a = anchorOf(free.o, seatOf(free.o).spots[free.spot]);
  if (!canStand(m.dry, a.x, a.y)) return;
  const near = sc.npcs
    .filter((n) => !n.hidden && !n.hold && !n.goingHome && !n.inside && !n.def.still)
    .map((n) => ({ n, d: dist(n.x, n.y, a.x, a.y) }))
    .filter((q) => q.d < RELAX.joinFrom * T)
    .sort((q1, q2) => q1.d - q2.d);
  for (const { n } of near) {
    if (!m.route(n, a.x, a.y, true, m.dry)) continue;
    n.wait = 99;
    c.mate = { n, o: free.o, spot: free.spot, ax: a.x, ay: a.y, t: 0, seated: false, line: null, lineT: 0 };
    return;
  }
}
function updateMate(c, dt) {
  if (!c.mate) {
    if (c.joinAt > 0 && c.t > c.joinAt) {
      c.joinAt = 0; // одна попытка за отдых
      if (Math.random() < RELAX.joinChance) tryJoin(c);
    }
    return;
  }
  const m = c.mate,
    n = m.n;
  m.t += dt;
  if (n.hidden) return releaseMate(c);
  if (!m.seated) {
    if (n.path.length) {
      if (m.t > 20) releaseMate(c); // заблудился — не ждём
      return;
    }
    if (dist(n.x, n.y, m.ax, m.ay) > 14) return releaseMate(c);
    n.x = m.ax;
    n.y = m.ay;
    n.moving = false;
    m.seated = true;
    m.t = 0;
    if (c.how === 'swing' && m.o === c.o) m.o.busy = 3; // оба сиденья заняты
    n.hold = { draw: (nn, t) => drawMate(c, m, t) };
    const nd = NPC_BY_ID[n.id];
    const pool = RELAX_LINES[c.how] || RELAX_LINES.sit;
    let line = pool[Math.floor(Math.random() * pool.length)];
    if (typeof line === 'object') line = nd.fem ? line.fem : line.masc;
    m.line = line.replace('{name}', S().name || 'дружок');
    sfx('pop');
    // посидели рядом — раз в день дружба чуть крепче
    const flags = S().dayFlags.relaxWith || {};
    if (!flags[n.id] && S().friends[n.id]) {
      setDayFlag(n.id, 1, 'relaxWith');
      addFriendPts(n.id, 1);
    }
  } else if (c.how === 'swing' && m.o === c.o) m.o.busy = 3;
}

// ---------- рисунок ----------
const HB = [-46, -100, 46, 12]; // рамка кадра хомячка (единицы мира)
const TOWELS = ['#ff8fab', '#74c0fc', '#ffd43b', '#63e6be', '#b197fc']; // цвета пляжных полотенец (common/props.js)
/** Кадр хомячка из кэша: key — что в нём меняется, pose — поза drawHamster, k — размер (1 — как на ходу), rot — наклон. */
function frame(key, look, pose, k = 1, rot = 0) {
  return SP.get(key, HB, (c) => {
    if (rot) c.rotate(rot);
    drawHamster(c, 0, 0, PS * k, look, pose);
  });
}
const shutAt = (t, ph) => (blinkAt(t, ph) > 0.5 ? 1 : 0);
/** Нарисовать отдыхающего (хомячка или жителя): how, точка сиденья x, y, фаза t, ключ внешности. */
function drawSitter(ctx, how, look, lk, x, y, t, ph, o, spot, dir = 0) {
  const shut = shutAt(t, ph);
  if (how === 'sit') {
    const fr = Math.floor(((t * 0.9 + ph) % 1) * 8),
      kick = o.type === 'bench' || o.type === 'log' || o.type === 'fountain';
    const s = frame(`rx:${lk}:sit:${kick ? fr : 0}:${shut}:${dir}`, look, {
      sit: true,
      shadow: false,
      kick: kick ? (fr + 0.5) / 8 : undefined,
      blink: shut,
      dir,
    });
    SP.draw(s, x, y);
    return;
  }
  if (how === 'lie') {
    // лежак (полотенце) сверху: хомячок на спинке, головой к изголовью, ноги укрыты краем полотенца того же цвета;
    // задремал — глазки закрыты
    const doze = cur && cur.t > RELAX.dozeAfter ? 1 : 0;
    const br = Math.floor(((Math.sin(t * 1.6 + ph) + 1) / 2) * 3.99);
    const cov = o.type === 'towel' ? TOWELS[(o.v === undefined ? o.tx : o.v) % 5] : '#ff8fab';
    const s = SP.get(`rx:${lk}:lie:${cov}:${doze}:${br}:${doze ? 1 : shut}`, HB, (c) => {
      c.save();
      c.scale(1, 0.84);
      drawHamster(c, 0, 0, PS * 0.74, look, { sit: true, shadow: false, sleep: !!doze, happy: !doze, blink: doze ? 1 : shut, time: br * 0.3 });
      c.restore();
      const top = -15 - br * 0.4;
      fillRR(c, -13, top, 26, 17 + br * 0.4, 4, '#fff8ec', OUT, 1.6);
      c.fillStyle = cov;
      for (let i = 0; i < 2; i++) c.fillRect(-11, top + 3 + i * 7, 22, 4);
    });
    SP.draw(s, x, y);
    return;
  }
  if (how === 'hammock') {
    // в гамаке: лежит на боку головой к подушке, снизу — край ткани гамака (цвет — как у гамака, поле v)
    const br = Math.floor(((Math.sin(t * 1.6 + ph) + 1) / 2) * 3.99),
      col = ['#ff8fab', '#74c0fc', '#ffd43b'][(o.v || 0) % 3];
    const s = SP.get(`rx:${lk}:ham:${col}:${br}`, [-60, -50, 60, 30], (c) => {
      c.save();
      c.translate(30, -3 - br * 0.3);
      c.rotate(-1.45);
      drawHamster(c, 0, 0, PS, look, { sit: true, shadow: false, sleep: true, time: br * 0.3 });
      c.restore();
      c.beginPath();
      c.moveTo(-37, -20);
      c.quadraticCurveTo(0, 23, 37, -20);
      c.quadraticCurveTo(0, 10, -37, -20);
      c.closePath();
      c.fillStyle = col;
      c.fill();
      c.save();
      c.clip();
      c.fillStyle = 'rgba(255,255,255,.55)';
      for (let i = 0; i < 6; i++) c.fillRect(-31 + i * 12, -24, 5, 50);
      c.restore();
      c.strokeStyle = OUT;
      c.lineWidth = 2;
      c.stroke();
    });
    SP.draw(s, x, y);
    return;
  }
  if (how === 'swing') {
    // качели: сиденье ходит вперёд-назад, на краях поднимается выше
    const a = Math.sin(t * 2.3 + ph) * 0.55,
      fr = Math.round((a / 0.55) * 6), // −6..6
      aa = (fr / 6) * 0.55;
    const sx = x,
      sy = y - (1 - Math.cos(aa)) * 60 + Math.sin(aa) * 12;
    const s = SP.get(`rx:${lk}:swing:${spot}:${fr}:${shut}`, [-46, -100, 46, 14], (c) => {
      drawHamster(c, 0, 0, PS * 0.8, look, { sit: true, shadow: false, happy: Math.abs(fr) > 3, blink: shut });
      fillRR(c, -9, -4, 18, 6, 2, spot ? '#51cf66' : '#4dabf7', OUT, 1.5);
    });
    SP.draw(s, sx, sy);
    // цепочки — от перекладины к сиденью, впереди: хомячок держится за них лапками
    SP.world();
    const top = o.y - 78;
    line(ctx, x - 11, top, sx - 10, sy - 2, '#8a8f98', 1.6);
    line(ctx, x + 11, top, sx + 10, sy - 2, '#8a8f98', 1.6);
    return;
  }
  if (how === 'slide') {
    // горка: с площадки по жёлобу вниз (кривая как в рисунке горки, common/props.js)
    const u = Math.min(1, (cur ? cur.t : 0) / SLIDE_T),
      q = u * u * (3 - 2 * u),
      b = bez(q, [-10, -50], [14, -44], [24, -2], [38, 10]);
    const s = frame(`rx:${lk}:slide:${q > 0.15 && q < 0.95 ? 1 : 0}`, look, { sit: true, shadow: false, happy: true, armsUp: q > 0.15 && q < 0.95 });
    SP.draw(s, o.x + b[0], o.y + b[1]);
  }
}
const bez = (u, a, b, c, d) => {
  const v = 1 - u;
  return [0, 1].map((i) => v * v * v * a[i] + 3 * v * v * u * b[i] + 3 * v * u * u * c[i] + u * u * u * d[i]);
};
/** Хомячок на своём месте + мелочи (солнышко, «z», реплика). */
function drawSelf(ctx, t) {
  const c = cur;
  if (!c) return;
  const st = seatOf(c.o),
    s = st.spots[c.spot],
    x = c.o.x + s[0],
    y = c.o.y + s[1];
  const m = c.mate && c.mate.seated ? c.mate : null;
  const dir = m && m.t < 4 ? (m.ax > c.ax ? 1 : -1) : 0; // пока житель говорит — смотрит на него
  drawSitter(ctx, c.how, c.look, c.lk, x, y, c.t, 0, c.o, c.spot, dir);
  SP.world();
  const sky = c.sc.desc.sky !== false,
    sunny = sky && S().weather === 'sun' && c.sc.darkness() < 0.2 && (c.sc.desc.season || cal().season) !== 'winter';
  if (c.how === 'lie' && sunny) {
    // загорает: солнышко над лежаком тихонько пульсирует
    const k = 1 + Math.sin(t * 2) * 0.08;
    emoji(ctx, '☀️', x + 24, y - 58, 18 * k);
  }
  if (c.how === 'lie' && c.t > RELAX.dozeAfter) zzz(ctx, x - 22, y - 50, c.t);
  if (c.how === 'hammock') zzz(ctx, x - 30, y - 34, c.t);
  if (c.say) bubble(ctx, c.say.text, x, y - 92);
}
function drawMate(c, m, t) {
  const n = m.n,
    st = seatOf(m.o),
    s = st.spots[m.spot];
  const how = c.how === 'swing' && m.o !== c.o ? 'sit' : c.how;
  const dir = m.t < 4 ? (c.ax > m.ax ? 1 : -1) : 0;
  drawSitter(SP.ctx, how, npcLook(n.id, npcDress()), 'n' + n.id + (npcDress() || ''), m.o.x + s[0], m.o.y + s[1], m.t + 0.37, n.ph, m.o, m.spot, dir);
  if (m.line && m.t < 4.5) {
    SP.world();
    bubble(SP.ctx, m.line, m.o.x + s[0], m.o.y + s[1] - (c.how === 'lie' ? 100 : 110));
  }
}
/** «z-z-z» — дремлет. */
function zzz(ctx, x, y, t) {
  ctx.fillStyle = OUT;
  ctx.textAlign = 'center';
  for (let i = 0; i < 3; i++) {
    const ph = (t * 0.45 + i / 3) % 1;
    ctx.globalAlpha = Math.sin(ph * Math.PI) * 0.85;
    ctx.font = `900 ${10 + ph * 8}px ui-rounded, "Trebuchet MS", sans-serif`;
    ctx.fillText('z', x - ph * 12 + Math.sin(ph * TAU) * 3, y - ph * 26);
  }
  ctx.globalAlpha = 1;
}
/** Облачко с репликой (две строки, если длинная). */
function bubble(ctx, text, x, y) {
  const size = 12;
  ctx.font = `800 ${size}px ui-rounded, "Trebuchet MS", sans-serif`;
  let lines = [text];
  if (ctx.measureText(text).width > 170) {
    const words = text.split(' ');
    let a = '',
      i = 0;
    while (i < words.length && ctx.measureText(a + words[i]).width < Math.max(90, ctx.measureText(text).width / 2)) a += words[i++] + ' ';
    lines = [a.trim(), words.slice(i).join(' ')];
  }
  const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 18,
    h = lines.length * (size + 3) + 10;
  fillRR(ctx, x - w / 2, y - h, w, h, 9, 'rgba(255,255,255,.96)', OUT, 2);
  ctx.beginPath();
  ctx.moveTo(x - 6, y - 1);
  ctx.lineTo(x, y + 8);
  ctx.lineTo(x + 6, y - 1);
  ctx.fillStyle = 'rgba(255,255,255,.96)';
  ctx.fill();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 6, y);
  ctx.lineTo(x, y + 8);
  ctx.lineTo(x + 6, y);
  ctx.stroke();
  ctx.fillStyle = OUT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  lines.forEach((l, i) => ctx.fillText(l, x, y - h + 5 + (size + 3) * (i + 0.5)));
  ctx.textBaseline = 'alphabetic';
}

/** Для автотеста и консоли: как сейчас отдыхаем. */
export function relaxNow() {
  const c = cur;
  if (!c) return null;
  return {
    how: c.how,
    type: c.o.type,
    tx: c.o.tx,
    ty: c.o.ty,
    spot: c.spot,
    t: c.t,
    mate: c.mate ? { id: c.mate.n.id, seated: c.mate.seated, line: c.mate.line } : null,
  };
}
/** Для автотеста: позвать жителя присесть рядом прямо сейчас (без жребия). */
export function relaxJoinNow() {
  if (!cur || cur.mate) return false;
  cur.joinAt = 0;
  tryJoin(cur);
  return !!cur.mate;
}

// ---------- «Пляжный волейбол» ----------
/** Команды: друг — житель города с самыми крепкими сердечками (из равных — любой), соперники — двое других. */
export function volleyTeams() {
  const town = shuffle(NPCS.filter((n) => !n.land));
  town.sort((a, b) => friendHearts(b.id) - friendHearts(a.id));
  const who = (n) => ({ id: n.id, name: n.name, fem: !!n.fem, look: npcLook(n.id), small: !!n.small, hearts: friendHearts(n.id) });
  const rest = shuffle(town.slice(1));
  return { mate: who(town[0]), rivals: rest.slice(0, 2).map(who) };
}
/** Строчка на заставке: с кем играешь и как сердечки дружбы помогают другу. */
export function volleyTeamNote(team) {
  const m = team.mate,
    h = m.hearts ? '❤️'.repeat(Math.min(5, m.hearts)) : '🤍';
  const vs = team.rivals.length ? ` Соперники — <b>${team.rivals.map((r) => r.name).join('</b> и <b>')}</b>.` : '';
  return `<div class="pay-note">🏐 Твоя пара — <b>${m.name}</b> ${h}.${vs}<br>${
    m.hearts ? 'Вы дружите — у сетки друг возьмёт больше мячей!' : 'Подружитесь — и друг у сетки будет брать больше мячей.'
  }</div>`;
}
/** Сыграть в волейбол у сетки на пляже. */
export function volleyGame() {
  if (cur) standUp(true);
  const team = volleyTeams(),
    m = team.mate;
  return prizeGame('volley', {
    group: 'relax',
    flag: 'volleys',
    ...RELAX_PRIZE.volley,
    source: 'other',
    info: { team },
    intro: volleyTeamNote(team),
    label: '🏐 <b>Приз пляжа:</b>',
    done: '💛 Сегодня призы за волейбол уже получены. Играть можно для удовольствия — завтра призы снова!',
    fun: '💛 Эта игра была для удовольствия.',
    // сыграли вместе — раз в день дружба с напарником чуть крепче
    after: () => {
      if ((S().dayFlags.relaxWith || {})['v:' + m.id]) return;
      setDayFlag('v:' + m.id, 1, 'relaxWith');
      addFriendPts(m.id, 1);
    },
    sticker: 'x_volley',
    thanks: `${m.name}: «Мы отличная команда!»`,
  });
}
