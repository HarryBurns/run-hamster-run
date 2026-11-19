// Питомец хомячка (этап 17б): котёнок, щенок, крольчонок или ёжик из приюта «Тёплые лапки».
//
//   shelter          дверь приюта (здание shelter в городе): питомца нет — выбрать друга, дать имя, взнос на корм;
//                    питомец есть — корм и мячик
//   pet              окно питомца: погладить, покормить, поиграть, имя, «подожди дома» / «пойдём гулять»
//
// Как устроено. Питомец один: state.pet (вид, имя, очки дружбы love, дни последней еды / ласки / игры, корм, мячик,
// stay — ждёт дома). Очки только растут; два дня без еды — грустит и просит (облачко с миской), без штрафов.
//   В ЛОКАЦИЯХ — общая часть (addWorldPart): питомец не житель и не предмет карты, он идёт по СЛЕДУ хомячка —
// точкам, где она прошла по суше (каждые STEP единиц), и останавливается в паре шагов. Поэтому он не застревает
// и пути не мешает. Хомячок в воде, на кораблике или далеко (быстрый переход, вход в локацию) — питомец ждёт,
// а потом «прибегает»: появляется рядом. Кадры — в кэше спрайтов SP.
//   ДОМА (свои дома: вилла и купленное жильё) — общая часть домов (addSidePart): гуляет по этажу, где хомячок. В чужие дома,
// магазины и мини-игры не заходит. «Подожди дома» — остаётся в основном доме (кнопка «Домой»).
import { G } from '../core/state.js';
import { adoptPet, renamePet, petCare, addPetGood, setPetStay, award } from '../core/actions.js';
import { on, emit } from '../core/events.js';
import { register } from '../core/registry.js';
import { scene } from '../core/loop.js';
import { sfx } from '../core/audio.js';
import { dist, el, esc, clamp } from '../core/util.js';
import { blinkAt } from '../art/hamster.js';
import { petIcon, PET_BOX } from '../art/pets.js';
import { PETS, PET_BY_ID, PET, PET_GOODS, PET_LINES, vendorLook, VENDORS } from '../data/index.js';
import { T, SP, tileOf, label, addWorldPart, locations } from '../engine/topdown/index.js';
import { canStand } from '../engine/topdown/actors.js';
import { addSidePart } from '../engine/side/scene.js';
import { HS } from '../engine/side/rooms.js';
import { openPanel } from '../ui/panel.js';
import { dialog } from '../ui/dialog.js';
import { toast } from '../ui/toast.js';
import { buy, priceTag, buyBtn } from './purchase.js';
import { paintPet, drawProps, drawBubble, drawHearts } from './pet_art.js';

const S = () => G.state;
const pet = () => (S() ? S().pet : null);
/** Сколько сердечек у дружбы (0..PET.hearts). */
export const petHearts = () => (pet() ? Math.min(PET.hearts, Math.floor(pet().love / PET.heart)) : 0);
/** Питомец голоден: два дня без еды. Только картинка и подсказка. */
export const petHungry = () => !!pet() && S().day - pet().fed >= PET.hungryAfter;
const moodNow = () => (petHungry() ? 'sad' : 'ok');

// ---------- где питомец сейчас ----------
// w — в локации: { sc, x, y, dir, moving, walkT, trail: [{ x, y }], last: {x, y} — последняя точка следа,
//                  fx: { kind: 'pet' | 'feed' | 'play', t, … } — что он сейчас делает, pop: время появления,
//                  away — хомячок уплыла или далеко, hidden — ещё ни разу не встал рядом (вошли в локацию по воде) }
// h — дома:      { sc, x, f, dir, moving, walkT, fx }
let w = null,
  h = null;
const hearts = []; // всплывающие сердечки: { x, y, t, side: в доме }
const STEP = 14, // шаг следа
  KEEP = 3, // сколько точек следа до хомячка питомец оставляет (идёт в паре шагов)
  FAR = T * 7; // дальше — «прибегает»

/** Гуляет ли питомец с хомячком (а не ждёт дома). */
const walks = () => !!pet() && !pet().stay;
/** Хомячок на суше и пешком (или на колёсах): по её следу можно идти. */
function heroOnLand(sc) {
  const p = sc.p;
  if (p.ride && !p.ride.wheels && !p.ride.relax) return false; // кораблик, пирога, верблюд, источник
  return sc.map.dry(tileOf(p.x), tileOf(p.y));
}
/** Поставить питомца рядом с хомячком: на свободное сухое место позади неё. */
function popNear(sc) {
  const p = sc.p,
    m = sc.map,
    d = p.dir >= 0 ? 1 : -1;
  let spot = null;
  for (const [dx, dy] of [
    [-34 * d, 6],
    [34 * d, 6],
    [-24 * d, 26],
    [24 * d, 26],
    [0, 30],
    [-24 * d, -22],
    [24 * d, -22],
    [0, 0],
  ])
    if (canStand(m.dry, p.x + dx, p.y + dy)) {
      spot = { x: p.x + dx, y: p.y + dy };
      break;
    }
  if (!spot) return false;
  w.x = spot.x;
  w.y = spot.y;
  w.dir = p.x >= w.x ? 1 : -1;
  w.trail = [];
  w.last = { x: p.x, y: p.y };
  w.moving = false;
  w.pop = G.time;
  w.spot = null;
  w.away = false;
  w.hidden = false;
  return true;
}
/** Место сбоку от стоящей хомячка, куда питомец дойдёт по прямой: { x, y, hx, hy } или null — остаться где стоит. */
function sideSpot(sc) {
  const p = sc.p,
    m = sc.map,
    sx = w.x >= p.x ? 1 : -1,
    far = p.ride && p.ride.wheels ? 68 : 38; // рядом с велосипедом и машинкой — подальше, не под колёса
  for (const [dx, dy] of [
    [far * sx, 6],
    [-far * sx, 6],
    [30 * sx, 26],
    [-30 * sx, 26],
  ]) {
    const x = p.x + dx,
      y = p.y + dy;
    let ok = canStand(m.dry, x, y);
    for (let k = 0.25; k < 1 && ok; k += 0.25) ok = canStand(m.dry, w.x + (x - w.x) * k, w.y + (y - w.y) * k);
    if (ok) return { x, y, hx: p.x, hy: p.y };
  }
  return { x: w.x, y: w.y, hx: p.x, hy: p.y };
}
function enterWorld(sc) {
  w = null;
  if (!walks()) return;
  w = { sc, x: sc.p.x, y: sc.p.y, dir: 1, moving: false, walkT: 0, trail: [], last: null, fx: null, pop: 0, away: true, hidden: true };
  if (heroOnLand(sc)) popNear(sc);
}

function updateWorld(sc, dt) {
  if (!walks()) {
    w = null;
    return;
  }
  if (!w || w.sc !== sc) enterWorld(sc);
  const p = sc.p,
    land = heroOnLand(sc);
  if (w.fx) return updateFx(w, dt, sc);
  // след хомячка
  if (land) {
    if (w.away || !w.last || dist(p.x, p.y, w.last.x, w.last.y) > T * 2.5 || dist(p.x, p.y, w.x, w.y) > FAR) {
      // вышла из воды, перенеслась по карте или убежала далеко — питомец прибегает
      if (!popNear(sc)) return;
    } else if (dist(p.x, p.y, w.last.x, w.last.y) >= STEP) {
      w.last = { x: p.x, y: p.y };
      w.trail.push(w.last);
      if (w.trail.length > 60) w.trail.shift();
    }
  } else if (!w.away && dist(p.x, p.y, w.x, w.y) > T * 2.2) w.away = true; // уплыла — ждём на берегу
  // идём по следу, оставляя до хомячка пару шагов
  let step = 0;
  if (w.trail.length > KEEP) {
    const base = p.ride ? p.ride.speed : 225,
      sp = Math.max(190, base * (w.trail.length > KEEP + 4 ? 1.25 : 1));
    step = sp * dt;
  }
  w.moving = step > 0;
  w.idleT = !p.moving && !p.path.length ? (w.idleT || 0) + dt : 0;
  if (step > 0) w.spot = null;
  else if (land && w.idleT > 0.3 && !w.away) {
    // хозяйка остановилась — встать сбоку от неё, а не прятаться за спиной
    if (!w.spot || dist(w.spot.hx, w.spot.hy, p.x, p.y) > 6) w.spot = sideSpot(sc);
    const q = w.spot;
    if (q) {
      const dx = q.x - w.x,
        dy = q.y - w.y,
        d = Math.hypot(dx, dy),
        st = 170 * dt;
      if (d > 1.5) {
        w.trail = []; // сошли со следа: дальше — от хомячка
        w.last = { x: p.x, y: p.y };
        w.moving = true;
        if (Math.abs(dx) > 1.5) w.dir = dx > 0 ? 1 : -1;
        w.x += (dx / d) * Math.min(d, st);
        w.y += (dy / d) * Math.min(d, st);
      }
    }
  }
  while (step > 0 && w.trail.length > KEEP) {
    const q = w.trail[0],
      dx = q.x - w.x,
      dy = q.y - w.y,
      d = Math.hypot(dx, dy);
    if (Math.abs(dx) > 1.5) w.dir = dx > 0 ? 1 : -1;
    if (d > step) {
      w.x += (dx / d) * step;
      w.y += (dy / d) * step;
      step = 0;
    } else {
      w.x = q.x;
      w.y = q.y;
      step -= d;
      w.trail.shift();
    }
  }
  if (w.moving) w.walkT += dt * 2.6;
  else if (Math.abs(p.x - w.x) > 20) w.dir = p.x > w.x ? 1 : -1; // стоит — смотрит на хозяйку
}

// ---------- погладить, покормить, поиграть: что видно ----------
function burst(x, y, n, side) {
  for (let i = 0; i < n; i++) hearts.push({ x: x + (Math.random() - 0.5) * 30, y: y - Math.random() * 10, t: -i * 0.12, side });
}
/** Свободное место для мячика: прямая от питомца в одну из сторон, по суше. */
function ballSpot(sc) {
  const m = sc.map,
    p = sc.p;
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0.7, 0.7],
    [-0.7, 0.7],
    [0, -1],
    [0.7, -0.7],
    [-0.7, -0.7],
  ].sort((a, b) => b[0] * (w.x - p.x) + b[1] * (w.y - p.y) - (a[0] * (w.x - p.x) + a[1] * (w.y - p.y))); // от хомячка
  for (const len of [T * 2.6, T * 1.6])
    for (const [dx, dy] of dirs) {
      let ok = true;
      for (let k = 0.25; k <= 1.001 && ok; k += 0.25) ok = canStand(m.dry, w.x + dx * len * k, w.y + dy * len * k);
      if (ok) return { x: w.x + dx * len, y: w.y + dy * len };
    }
  return null;
}
/** Показать заботу там, где питомец сейчас (в локации или дома). gain — сколько очков дружбы прибавилось. */
function showCare(what, gain) {
  const e = w && scene() === w.sc ? w : h && scene() === h.sc ? h : null;
  if (!e) return;
  const side = e === h;
  if (what === 'pet') {
    e.fx = { kind: 'pet', t: 0, dur: 1.6 };
    sfx('heart');
  } else if (what === 'feed') {
    e.fx = { kind: 'feed', t: 0, dur: 2.4 };
    sfx('eat');
  } else if (what === 'play') {
    const to = side ? { x: clamp(e.x + (e.x > e.sc.p.x ? 1 : -1) * 150, 50, e.sc.geo.W - 50), y: 0 } : ballSpot(e.sc);
    e.fx = { kind: 'play', t: 0, dur: 3, from: { x: e.x, y: e.y || 0 }, to: to || { x: e.x, y: e.y || 0 }, hop: !to };
    sfx('whistle');
  }
  e.fx.gain = gain;
  e.moving = false;
}
function updateFx(e, dt, sc) {
  const fx = e.fx,
    side = e === h;
  fx.t += dt;
  const k = fx.t / fx.dur;
  if (fx.kind === 'pet') {
    if (!fx.done && fx.t > 0.15) {
      fx.done = true;
      burst(e.x, petTop(e, side), fx.gain ? 5 : 3, side);
    }
  } else if (fx.kind === 'feed') {
    if (!fx.done && k > 0.8) {
      fx.done = true;
      burst(e.x, petTop(e, side), fx.gain ? 5 : 3, side);
      sfx('heart');
    }
  } else if (fx.kind === 'play') {
    // 0–0,3 мячик летит; 0,25–0,6 питомец бежит к нему; 0,6–0,95 несёт назад
    const run = clamp((k - 0.25) / 0.35, 0, 1),
      back = clamp((k - 0.62) / 0.33, 0, 1),
      q = run - back;
    const nx = fx.from.x + (fx.to.x - fx.from.x) * q,
      ny = fx.from.y + (fx.to.y - fx.from.y) * q;
    if (Math.abs(nx - e.x) > 0.3) e.dir = nx > e.x ? 1 : -1;
    e.moving = (run > 0 && run < 1) || (back > 0 && back < 1) || !!fx.hop;
    e.x = nx;
    if (!side) e.y = ny;
    e.walkT += dt * 3.4;
    if (!fx.done && k > 0.95) {
      fx.done = true;
      burst(e.x, petTop(e, side), fx.gain ? 5 : 3, side);
      sfx('heart');
    }
  }
  if (fx.t >= fx.dur) {
    e.fx = null;
    e.moving = false;
    if (!side && sc) {
      // след за время игры устарел — начнём от хомячка
      e.trail = [];
      e.last = { x: sc.p.x, y: sc.p.y };
    }
  }
}
const petTop = (e, side) => (side ? e.sc.geo.fy(e.f) - 62 : e.y - PET_BY_ID[pet().kind].size - 6);

// ---------- рисунок (сами рисунки — pet_art.js) ----------
const WALK_FRAMES = 6;
/** Кадр питомца: что в нём меняется — в ключе. */
function frameOf(e, t) {
  const pt = pet(),
    fx = e.fx,
    mood = fx && (fx.kind === 'pet' || (fx.kind !== 'play' && fx.t / fx.dur > 0.8) || fx.done) ? 'happy' : moodNow(),
    fr = e.moving ? Math.floor((e.walkT % 1) * WALK_FRAMES) : -1,
    wag = e.moving ? 0 : Math.floor(((t * (mood === 'sad' ? 0.4 : 1.6)) % 1) * 4),
    shut = blinkAt(t, 2.3) > 0.5 ? 1 : 0,
    eat = fx && fx.kind === 'feed' && fx.t / fx.dur < 0.8 ? (Math.floor(fx.t * 5) % 2 ? 1 : 0.55) : 0;
  return {
    key: `pet:${pt.kind}:${e.dir}:${fr}:${wag}:${mood}:${shut}:${eat}`,
    pose: { walk: fr < 0 ? null : (fr + 0.5) / WALK_FRAMES, wag: wag / 4, mood, blink: shut, eat },
  };
}
on('step', ({ dt }) => {
  for (const q of hearts) q.t += dt;
  for (let i = hearts.length - 1; i >= 0; i--) if (hearts[i].t > 1.2) hearts.splice(i, 1);
  updateHome(dt);
});

// ---------- общая часть локаций ----------
const hitWorld = (pt) => !!w && !w.hidden && Math.abs(pt.x - w.x) < 24 && pt.y > w.y - PET_BY_ID[pet().kind].size - 10 && pt.y < w.y + 12;
addWorldPart({
  enter(sc) {
    enterWorld(sc);
  },
  update(sc, dt) {
    if (pet() || w) updateWorld(sc, dt);
  },
  /** Нажали на питомца — подойти и открыть его окно. */
  tap(sc, pt) {
    if (!w || w.sc !== sc || !walks() || !hitWorld(pt)) return false;
    sc.goNear(w.x, w.y, { fn: () => openPet() });
    sfx('tap');
    return true;
  },
  near(sc) {
    if (!w || w.sc !== sc || !walks() || w.hidden) return null;
    const d = dist(sc.p.x, sc.p.y, w.x, w.y);
    return d < T * 0.9 ? { d: d * 1.3, pending: { fn: () => openPet() } } : null;
  },
  things(sc, add, v) {
    if (!w || w.sc !== sc || !walks() || w.hidden) return;
    if (w.x < v.x0 || w.x > v.x1 || w.y < v.y0 || w.y > v.y1) return;
    add(w.y + 9, drawWorldPet, w);
  },
  over(ctx, sc, t) {
    if (!w || w.sc !== sc || !walks() || w.hidden) return;
    drawHearts(ctx, hearts, false);
    const size = PET_BY_ID[pet().kind].size;
    if (petHungry() && !w.fx) drawBubble(ctx, w.x, w.y - size - 4, t);
    else if (dist(sc.p.x, sc.p.y, w.x, w.y) < T * 1.6 && !sc.p.moving && !w.moving && !w.fx)
      label(ctx, pet().name, w.x, w.y - size - 12, 150, 11, 'rgba(255,255,255,.92)');
  },
});
function drawWorldPet(ctx, e, t) {
  const pt = pet();
  if (!pt) return;
  const f = frameOf(e, t),
    kind = pt.kind,
    dir = e.dir;
  // появился рядом — подпрыгнул
  const pop = G.time - e.pop,
    hop = pop < 0.35 ? Math.sin((pop / 0.35) * Math.PI) * 9 : 0;
  const s = SP.get(f.key, PET_BOX, (c) => paintPet(c, kind, dir, f.pose));
  SP.draw(s, e.x, e.y - hop);
  SP.world();
  drawProps(ctx, e, e.x, e.y, 1, false);
}

// ---------- дома ----------
const HK = HS / 0.78; // во столько раз питомец в доме крупнее, чем на карте
/** В этом ли доме питомец: свой дом с мебелью; «ждёт дома» — только основной. */
const homeHere = (sc) => !!pet() && !!sc && !!sc.geo && sc.owned && (!pet().stay || sc.name === S().homeMain);
function updateHome(dt) {
  const sc = scene();
  if (!homeHere(sc)) {
    h = null;
    return;
  }
  const p = sc.p,
    W = sc.geo.W;
  if (!h || h.sc !== sc) h = { sc, x: clamp(p.x - 80, 50, W - 50), f: p.f, dir: 1, moving: false, walkT: 0, fx: null };
  if (h.fx) return updateFx(h, dt, null);
  if (p.lift) return; // хомячок в лифте — ждём
  if (h.f !== p.f) {
    h.f = p.f;
    h.x = clamp(p.x + (p.dir >= 0 ? -70 : 70), 50, W - 50);
  }
  const want = clamp(p.x + (p.dir >= 0 ? -78 : 78), 46, W - 46),
    dx = want - h.x;
  h.moving = Math.abs(dx) > (h.moving ? 6 : 46);
  if (h.moving) {
    h.dir = dx > 0 ? 1 : -1;
    h.x += Math.sign(dx) * Math.min(Math.abs(dx), 250 * dt);
    h.walkT += dt * 2.6;
  } else if (Math.abs(p.x - h.x) > 30) h.dir = p.x > h.x ? 1 : -1;
}
addSidePart({
  draw(ctx, sc, t) {
    if (!h || h.sc !== sc || !pet()) return;
    const y = sc.geo.fy(h.f),
      f = frameOf(h, t),
      kind = pet().kind,
      dir = h.dir,
      b = PET_BOX.map((v) => v * HK);
    sc.sprite('h' + f.key, b, (c) => paintPet(c, kind, dir, f.pose, HK), h.x, y);
    drawProps(ctx, h, h.x, y, HK, true);
    drawHearts(ctx, hearts, true);
    if (petHungry() && !h.fx) drawBubble(ctx, h.x + 8, y - PET_BY_ID[kind].size * HK - 6, t);
  },
  tap(sc, pt) {
    if (!h || h.sc !== sc || !pet()) return false;
    const y = sc.geo.fy(h.f);
    if (Math.abs(pt.x - h.x) > 38 || pt.y < y - PET_BY_ID[pet().kind].size * HK - 14 || pt.y > y + 10) return false;
    sfx('tap');
    openPet();
    return true;
  },
});

on('pet', ({ what }) => {
  // «подожди дома» / «пойдём гулять»: питомец исчезает из локации или появляется рядом
  if (what === 'stay' || what === 'adopt') {
    const sc = scene();
    if (sc && locations[sc.name] === sc) enterWorld(sc);
    else w = null;
  }
});

// ---------- окно питомца ----------
function heartsRow() {
  const n = petHearts(),
    row = el('div', 'pet-hearts');
  row.setAttribute('aria-label', `Сердечек дружбы: ${n} из ${PET.hearts}`);
  for (let i = 0; i < PET.hearts; i++) row.appendChild(el('span', i < n ? 'on' : '', i < n ? '❤️' : '🤍'));
  return row;
}
/** Позаботиться: действие состояния + то, что видно в игре. Возвращает false, если нельзя. */
export function careForPet(what) {
  const gain = petCare(what);
  if (gain === false) return false;
  showCare(what, gain);
  if (petHearts() >= PET.hearts) award('x_pet_best', { delay: 1800 });
  return true;
}
export function openPet() {
  const pt = pet();
  if (!pt) return null;
  const def = PET_BY_ID[pt.kind];
  const act = (panel, what) => {
    panel.close();
    careForPet(what);
  };
  return openPanel({
    title: pt.name,
    icon: def.icon,
    cls: 'narrow pet-win',
    render(body, tab, panel) {
      const p2 = pet(),
        hungry = petHungry(),
        top = el('div', 'pet-top');
      top.appendChild(petIcon(p2.kind, 96, hungry ? 'sad' : 'happy'));
      const info = el('div', 'pet-info');
      info.appendChild(heartsRow());
      const today = S().day;
      info.appendChild(
        el(
          'div',
          'muted',
          hungry
            ? `${esc(p2.name)} грустит и просит поесть.`
            : petHearts() >= PET.hearts
              ? `${esc(p2.name)} — твой лучший друг!`
              : p2.feedDay === today && p2.pet === today && (p2.play === today || !p2.ball)
                ? `${esc(p2.name)} сегодня счастлив. Завтра дружба станет ещё крепче!`
                : 'Гладь, корми и играй каждый день — и сердечек станет больше.',
        ),
      );
      top.appendChild(info);
      body.appendChild(top);
      const row = el('div', 'pet-acts');
      const btn = (cls, html, fn, hint) => {
        const b = el('button', 'btn ' + cls, html);
        b.onclick = () => {
          sfx('tap');
          fn();
        };
        row.appendChild(b);
        if (hint) b.title = hint;
        return b;
      };
      btn('pink act-pet', '🤚 Погладить', () => act(panel, 'pet'));
      btn(p2.food > 0 ? 'green act-feed' : 'ghost act-feed', `🥣 Покормить${p2.food > 0 ? ` <small>×${p2.food}</small>` : ''}`, () => {
        if (p2.food > 0) act(panel, 'feed');
        else toast('Корм закончился. Он продаётся в приюте «Тёплые лапки» — за школой, у детской площадки.');
      });
      btn(p2.ball ? 'blue act-play' : 'ghost act-play', '🎾 Поиграть', () => {
        if (p2.ball) act(panel, 'play');
        else toast('Нужен мячик! Он продаётся в приюте «Тёплые лапки».');
      });
      body.appendChild(row);
      // имя
      const nm = el('div', 'pet-name biz-signedit');
      nm.appendChild(el('div', 'muted', 'Имя:'));
      const inp = el('input');
      inp.maxLength = PET.nameMax;
      inp.value = p2.name;
      inp.setAttribute('aria-label', 'Имя питомца');
      inp.onchange = () => {
        if (renamePet(inp.value)) {
          sfx('ok');
          toast(`Теперь его зовут ${esc(pet().name)}!`, 'good');
        }
        inp.value = pet().name;
      };
      nm.appendChild(inp);
      body.appendChild(nm);
    },
    foot: () => [
      pet().stay
        ? {
            text: '🐾 Пойдём гулять!',
            cls: 'green act-walk',
            fn: (panel) => {
              setPetStay(false);
              panel.close();
              toast(`${esc(pet().name)} идёт с тобой!`, 'good');
            },
          }
        : {
            text: '🏠 Подожди дома',
            cls: 'ghost act-stay',
            fn: (panel) => {
              setPetStay(true);
              panel.close();
              toast(`${esc(pet().name)} подождёт тебя дома.`);
            },
          },
      { text: 'Закрыть', cls: 'ghost', fn: (panel) => panel.close() },
    ],
  });
}
register('pet', () => openPet(), 'питомец: окно — погладить, покормить, поиграть, имя, «подожди дома»');

// ---------- приют «Тёплые лапки» ----------
const VENDOR = 'shelter';
function goodsCards(grid, panel) {
  for (const g of PET_GOODS) {
    const pt = pet(),
      card = el('div', 'card pet-good-' + g.id),
      have = g.id === 'ball' ? (pt.ball ? 1 : 0) : pt.food;
    card.appendChild(el('div', 'e', g.icon));
    card.appendChild(el('div', 'nm', g.name));
    card.appendChild(el('div', 'muted', g.about));
    if (g.once && have) {
      card.appendChild(el('span', 'cnt', '✓'));
      card.appendChild(el('div', 'muted', '<b>Уже есть!</b>'));
    } else {
      card.appendChild(priceTag(g.price));
      if (have) card.appendChild(el('span', 'cnt', '×' + have));
      card.appendChild(
        buyBtn('Купить', g.price, () => {
          if (!buy(g.price, g.name)) return;
          addPetGood(g.id, 1);
          emit('buy', { cat: 'pet', id: g.id });
          panel.refresh();
        }),
      );
    }
    grid.appendChild(card);
  }
}
function openShelterShop() {
  return openPanel({
    title: 'Приют «Тёплые лапки»',
    portrait: vendorLook(VENDOR),
    money: true,
    cls: 'pet-shop',
    render(body, tab, panel) {
      const pt = pet(),
        top = el('div', 'pet-top');
      top.appendChild(petIcon(pt.kind, 84, petHungry() ? 'sad' : 'happy'));
      const info = el('div', 'pet-info');
      info.appendChild(el('div', 'nm', `<b>${esc(pt.name)}</b>`));
      info.appendChild(heartsRow());
      info.appendChild(el('div', 'muted', 'Чтобы покормить или поиграть, нажми на питомца — он ждёт тебя у двери.'));
      top.appendChild(info);
      body.appendChild(top);
      const grid = el('div', 'grid');
      goodsCards(grid, panel);
      body.appendChild(grid);
    },
  });
}
/** Выбрать друга: карточки зверят, имя, взнос. */
function openAdopt() {
  let kind = PETS[0].id,
    name = PETS[0].names[0],
    typed = false,
    ni = 0;
  return openPanel({
    title: 'Приют «Тёплые лапки»',
    portrait: vendorLook(VENDOR),
    money: true,
    cls: 'pet-shop',
    render(body, tab, panel) {
      body.appendChild(el('p', 'muted', 'Кто станет твоим другом? Выбирай сердцем: питомец — один и навсегда.'));
      const grid = el('div', 'grid');
      for (const d of PETS) {
        const card = el('div', 'card tap pet-' + d.id + (d.id === kind ? ' sel' : ''));
        card.appendChild(petIcon(d.id, 92, d.id === kind ? 'happy' : 'ok'));
        card.appendChild(el('div', 'nm', d.name));
        card.appendChild(el('div', 'muted', d.about));
        card.onclick = () => {
          sfx('tap');
          kind = d.id;
          if (!typed) {
            ni = 0;
            name = d.names[0];
          }
          panel.refresh();
        };
        grid.appendChild(card);
      }
      body.appendChild(grid);
      const nm = el('div', 'pet-name biz-signedit');
      nm.appendChild(el('div', 'muted', 'Как его зовут?'));
      const inp = el('input');
      inp.maxLength = PET.nameMax;
      inp.value = name;
      inp.setAttribute('aria-label', 'Имя питомца');
      inp.oninput = () => {
        name = inp.value;
        typed = true;
      };
      nm.appendChild(inp);
      const dice = el('button', 'btn small ghost pet-dice', '🎲 Другое имя');
      dice.onclick = () => {
        sfx('tap');
        const list = PET_BY_ID[kind].names;
        ni = (ni + 1) % list.length;
        name = list[ni];
        typed = false;
        panel.refresh();
      };
      nm.appendChild(dice);
      body.appendChild(nm);
      body.appendChild(el('p', 'muted', `Взнос приюту — на корм тем, кто ещё ждёт друга. В подарок — две мисочки корма.`));
    },
    foot: () => [
      {
        text: `💞 Взять друга — взнос 🪙 ${PET.fee}`,
        cls: S().money >= PET.fee ? 'green pet-take' : 'ghost pet-take',
        fn: (panel) => {
          const nm = (name || '').trim() || PET_BY_ID[kind].names[0];
          if (pet() || !PET_BY_ID[kind]) return; // взять можно одного: сначала проверка, потом взнос
          if (!buy(PET.fee)) return;
          adoptPet(kind, nm);
          panel.close();
          sfx('fanfare');
          award('x_pet', { delay: 900 });
          dialog({
            look: vendorLook(VENDOR),
            name: VENDORS[VENDOR].name,
            text: PET_LINES.done(esc(pet().name)) + ' Нажми на него — и сможешь погладить, покормить и поиграть.',
            options: [{ text: 'Спасибо!', cls: 'green' }],
            happy: true,
          });
        },
      },
      { text: 'Я ещё подумаю', cls: 'ghost', fn: (panel) => panel.close() },
    ],
  });
}
register(
  'shelter',
  async () => {
    const who = { look: vendorLook(VENDOR), name: VENDORS[VENDOR].name };
    if (!pet()) {
      const i = await dialog({
        ...who,
        text: PET_LINES.hello,
        options: [{ text: '🐾 Посмотреть зверят', cls: 'green' }, { text: 'Не сейчас' }],
      });
      if (i === 0) openAdopt();
      return;
    }
    const i = await dialog({
      ...who,
      text: PET_LINES.have(esc(pet().name)),
      options: [{ text: '🥣 Корм и игрушки', cls: 'green' }, { text: 'Пока!' }],
      happy: true,
    });
    if (i === 0) openShelterShop();
  },
  'приют «Тёплые лапки»: взять питомца (выбор, имя, взнос) или купить корм и мячик',
);

/** Для тестов: где питомец и что делает. */
export const petDebug = () => ({
  world: w ? { scene: w.sc.name, x: w.x, y: w.y, trail: w.trail.length, moving: w.moving, fx: w.fx ? w.fx.kind : '', away: w.away } : null,
  home: h ? { scene: h.sc.name, x: h.x, f: h.f, fx: h.fx ? h.fx.kind : '' } : null,
  hearts: petHearts(),
  hungry: petHungry(),
  screen:
    h && scene() === h.sc
      ? h.sc.cam.toScreen(h.x, h.sc.geo.fy(h.f) - 24)
      : w && scene() === w.sc
        ? w.sc.cam.toScreen(w.x, w.y - 14)
        : null,
});
