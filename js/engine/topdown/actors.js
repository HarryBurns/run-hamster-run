// «Движок локаций»: движение по пути и ЖИТЕЛИ локации (гуляют возле своего места, вечером идут домой).
//
// В описании локации:  actors: [{ npc, at: [x, y], home, act, always }]
//   npc     кто (id из data/npcs.js)
//   at      клетка, возле которой житель гуляет днём
//   home    куда он идёт вечером (с 19:00): id здания (встанет у двери) или клетка [x, y]; без home — остаётся
//   act     действие из реестра, когда хомячок подошёл (по умолчанию 'npc:<id>' — разговор)
//   always  true — не уходит спать ночью (иначе с 22:00 до 6:30 жителя на улице нет)
// Житель, который сейчас в гостях у хомячка дома, на улице не показывается.
import { G } from '../../core/state.js';
import { rnd, dist } from '../../core/util.js';
import { NPC_BY_ID, npcLook } from '../../data/index.js';
import { drawHamster, blinkAt } from '../../art/hamster.js';
import { T, PS, SP, OBJECTS, tileOf } from './kinds.js';

/**
 * Сдвинуть ent ({ x, y, dir, path, moving, walkT }) по его пути. true — в этом шаге дошли до конца.
 * Через «медленные» клетки (кусты) — медленнее.
 */
export function moveAlong(m, ent, speed, dt) {
  if (!ent.path.length) {
    ent.moving = false;
    return false;
  }
  const so = m.slowAt(ent.x, ent.y);
  if (so) speed *= OBJECTS[so.type].slow;
  let step = speed * dt;
  ent.moving = true;
  ent.walkT += dt * 2.4;
  // Дошли до точки пути — остаток шага тратим на следующий отрезок в этом же кадре.
  // Иначе на каждой точке терялась часть шага, и хомячок запинался.
  while (ent.path.length) {
    const t = ent.path[0],
      dx = t.x - ent.x,
      dy = t.y - ent.y,
      d = Math.hypot(dx, dy);
    if (Math.abs(dx) > 2) ent.dir = dx > 0 ? 1 : -1;
    if (d > step) {
      ent.x += (dx / d) * step;
      ent.y += (dy / d) * step;
      return false;
    }
    ent.x = t.x;
    ent.y = t.y;
    step -= d;
    ent.path.shift();
  }
  ent.moving = false;
  return true;
}

/** Помещается ли идущий (стрелками) в точке (px, py): проверяются четыре угла его «следа». */
export function canStand(pass, px, py) {
  const r = 11;
  for (const [ox, oy] of [
    [-r, -6],
    [r, -6],
    [-r, 6],
    [r, 6],
  ])
    if (!pass(tileOf(px + ox), tileOf(py + oy))) return false;
  return true;
}

/** Жители по описанию локации. */
export function makeResidents(m) {
  return (m.desc.actors || []).map((a, i) => {
    if (!NPC_BY_ID[a.npc]) throw new Error(`Локация «${m.id}»: нет жителя «${a.npc}»`);
    const b = typeof a.home === 'string' ? m.bById[a.home] : null;
    return {
      id: a.npc,
      def: a,
      act: a.act || 'npc:' + a.npc,
      hang: a.at,
      home: b ? [b.x + Math.floor(b.w / 2), b.y + b.h + 1] : Array.isArray(a.home) ? a.home : null,
      ph: 1 + i * 2.3,
      x: (a.at[0] + 0.5) * T,
      y: (a.at[1] + 0.5) * T,
      dir: 1,
      path: [],
      wait: rnd(0, 3),
      walkT: 0,
      moving: false,
      hidden: false,
    };
  });
}

/** Шаг логики жителей: кто спрятан, кто идёт, кому пора выбрать новую точку. */
export function updateResidents(sc, dt) {
  const m = sc.map,
    min = G.state.minutes,
    night = min >= 22 * 60 || min < 6.5 * 60;
  for (const n of sc.npcs) {
    n.hidden = (night && !n.def.always) || G.state.guests.includes(n.id);
    if (n.hidden || G.modal) continue;
    if (n.path.length) {
      moveAlong(m, n, 90, dt);
      continue;
    }
    n.wait -= dt;
    if (n.wait > 0) continue;
    n.wait = rnd(2.5, 7);
    const [ax, ay] = min >= 19 * 60 && n.home ? n.home : n.hang;
    const far = dist(n.x, n.y, (ax + 0.5) * T, (ay + 0.5) * T) > T * 4;
    const tx = far ? ax : tileOf(n.x) + Math.round(rnd(-2, 2)),
      ty = far ? ay : tileOf(n.y) + Math.round(rnd(-2, 2));
    if (!far && dist((tx + 0.5) * T, (ty + 0.5) * T, (ax + 0.5) * T, (ay + 0.5) * T) > T * 3.5) continue;
    const k = m.kindAt(tx, ty);
    if (k && k.wet) continue;
    m.route(n, (tx + 0.5) * T, (ty + 0.5) * T, false, m.dry);
  }
}

/** Под пальцем ли житель (точка мира w). */
export const hitResident = (n, w) => !n.hidden && Math.abs(w.x - n.x) < 30 && w.y > n.y - 70 && w.y < n.y + 14;

// Житель из кэша спрайтов. Вместо плавной анимации — готовые кадры: 8 кадров шага или 4 кадра «дыхания»,
// глаза открыты или закрыты (моргание), смотрит влево или вправо. Игрок рисуется «вживую» (render.js).
const WALK_FRAMES = 8,
  IDLE_FRAMES = 4;
export function drawResident(n, t) {
  const nd = NPC_BY_ID[n.id],
    sc = PS * (nd.small ? 0.8 : 1),
    shut = blinkAt(t, n.ph) > 0.5 ? 1 : 0;
  // кадр: 0..7 — шаг, 8..11 — стоит и дышит
  const fr = n.moving
    ? Math.floor((n.walkT % 1) * WALK_FRAMES)
    : WALK_FRAMES + Math.min(IDLE_FRAMES - 1, Math.floor(((Math.sin((t + n.ph) * 2.2) + 1) / 2) * IDLE_FRAMES));
  const key = `npc:${n.id}:${n.dir}:${fr}:${shut}`;
  let s = SP.find(key);
  if (!s) {
    // поза кадра: для шага — середина его отрезка фазы; для «дыхания» — время, в которое тело на нужной высоте
    const i = fr - WALK_FRAMES,
      time = i < 0 ? 0 : Math.asin((((i + 0.5) / IDLE_FRAMES) * 2 - 1) * 0.9) / 2.2;
    const pose = { dir: n.dir, time, walk: i < 0 ? (fr + 0.5) / WALK_FRAMES : null, blink: shut };
    s = SP.get(key, [-56 * sc, -124 * sc, 56 * sc, 12 * sc], (c) => drawHamster(c, 0, 0, sc, npcLook(n.id), pose));
  }
  SP.draw(s, n.x, n.y + 10);
}
