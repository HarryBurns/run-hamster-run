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
import { dist, shuffle, readSec } from '../core/util.js';
import { NPCS, NPC_BY_ID, npcLook, RELAX, RELAX_LINES, RELAX_PRIZE } from '../data/index.js';
import { T, SP, OBJECTS, TILES } from '../engine/topdown/kinds.js';
import { canStand } from '../engine/topdown/actors.js';
import { toast } from '../ui/toast.js';
import { prizeGame } from './minigames.js';
import { drawSitter, drawRestExtras, bubble } from './relax_art.js';

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
const hiddenNow = (sc, o) =>
  (o.type === 'hammock' || o.type === 'towel') && (sc.desc.season || cal().season) === 'winter';
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
  if (st.how === 'swing' || st.how === 'hammock') o.busy = spot + 1; // качели и гамак прячут занятое место
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
on('step', ({ dt }) => {
  const c = cur;
  if (!c) return;
  const sc = c.sc,
    p = sc.p;
  // ушли из локации, пересели на кораблик, пошли — встали
  if (scene() !== sc || p.ride !== c.ride) return standUp(true);
  if (p.moving || p.path.length) return standUp();
  c.t += dt;
  if (c.say && c.t - c.say.t > 1.6) c.say = null;
  if (c.how === 'slide') {
    if (c.t >= RELAX.slide) {
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
    m.lineT = readSec(m.line, 4.5); // облачко висит, пока медленно читающий успеет прочитать (core/util.js)
    sfx('pop');
    // посидели рядом — раз в день дружба чуть крепче
    const flags = S().dayFlags.relaxWith || {};
    if (!flags[n.id] && S().friends[n.id]) {
      setDayFlag(n.id, 1, 'relaxWith');
      addFriendPts(n.id, 1);
    }
  } else if (c.how === 'swing' && m.o === c.o) m.o.busy = 3;
}

// ---------- рисунок (сами рисунки — relax_art.js) ----------
/** Хомячок на своём месте + мелочи (солнышко, «z», реплика). */
function drawSelf(ctx, t) {
  const c = cur;
  if (!c) return;
  const st = seatOf(c.o),
    s = st.spots[c.spot],
    x = c.o.x + s[0],
    y = c.o.y + s[1];
  const m = c.mate && c.mate.seated ? c.mate : null;
  const dir = m && m.t < m.lineT - 0.5 ? (m.ax > c.ax ? 1 : -1) : 0; // пока житель говорит — смотрит на него
  drawSitter(ctx, c.how, c.look, c.lk, x, y, c.t, 0, c.o, c.spot, dir, c.t);
  SP.world();
  const sky = c.sc.desc.sky !== false,
    sunny = sky && S().weather === 'sun' && c.sc.darkness() < 0.2 && (c.sc.desc.season || cal().season) !== 'winter';
  drawRestExtras(ctx, c.how, x, y, t, c.t, sunny, c.say && c.say.text);
}
function drawMate(c, m, t) {
  const n = m.n,
    st = seatOf(m.o),
    s = st.spots[m.spot];
  const how = c.how === 'swing' && m.o !== c.o ? 'sit' : c.how;
  const dir = m.t < m.lineT - 0.5 ? (c.ax > m.ax ? 1 : -1) : 0;
  drawSitter(
    SP.ctx,
    how,
    npcLook(n.id, npcDress()),
    'n' + n.id + (npcDress() || ''),
    m.o.x + s[0],
    m.o.y + s[1],
    m.t + 0.37,
    n.ph,
    m.o,
    m.spot,
    dir,
    cur ? cur.t : 0,
  );
  if (m.line && m.t < m.lineT) {
    SP.world();
    bubble(SP.ctx, m.line, m.o.x + s[0], m.o.y + s[1] - (c.how === 'lie' ? 100 : 110));
  }
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
  const who = (n) => ({
    id: n.id,
    name: n.name,
    fem: !!n.fem,
    look: npcLook(n.id),
    small: !!n.small,
    hearts: friendHearts(n.id),
  });
  const rest = shuffle(town.slice(1));
  return { mate: who(town[0]), rivals: rest.slice(0, 2).map(who) };
}
/** Строчка на заставке: с кем играешь и как сердечки дружбы помогают другу. */
export function volleyTeamNote(team) {
  const m = team.mate,
    h = m.hearts ? '❤️'.repeat(Math.min(5, m.hearts)) : '🤍';
  const vs = team.rivals.length ? ` Соперники — <b>${team.rivals.map((r) => r.name).join('</b> и <b>')}</b>.` : '';
  return `<div class="pay-note">🏐 Твоя пара — <b>${m.name}</b> ${h}.${vs}<br>${
    m.hearts
      ? 'Вы дружите — у сетки друг возьмёт больше мячей!'
      : 'Подружитесь — и друг у сетки будет брать больше мячей.'
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
