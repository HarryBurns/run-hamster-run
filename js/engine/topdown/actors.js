// «Движок локаций»: движение по пути и ЖИТЕЛИ локации (гуляют возле своего места, вечером идут домой).
//
// В описании локации:  actors: [{ npc, at: [x, y], home, act }]
//   npc     кто (id из data/npcs.js)
//   at      клетка, возле которой житель гуляет днём
//   home    его дом: id здания (встанет у двери) или клетка [x, y]; без home — всегда гуляет у своего места
//   act     действие из реестра, когда хомячок подошёл (по умолчанию 'npc:<id>' — разговор)
//   still   true — не гуляет, всегда на своём месте (русалочка на камне в воде — секретный пляж)
//   roam    гуляет не дальше стольких клеток от at (по умолчанию 3.5) — чтобы не заходил за ёлки и дома
// Где житель — одно правило для всех мест, npcPlace (core/queries.js; часы — VISIT и LAND_HOME в data/visits.js):
//   на улице ('out') — гуляет возле своего места at (хозяин тайного места — у своего дела);
//   дома ('home' — утром, вечером, позвал в гости, обедает; 'asleep' — спит) — идёт к своей двери и заходит: дошёл
//   до двери — и на улице его нет, пока он дома (внутри его дома он есть — interiors/, when: npcAtHome);
//   хомячок пришла в локацию (или вышла из его дома) — кто дома, тот уже внутри (settleResidents);
//   в гостях у хомячка, в отеле — на улице его нет; праздник в городе — locations/holidays_crowd.js (n.hold);
import { G, npcNow, questBadge, npcDress, npcRain } from '../../core/state.js';
import { rnd, dist } from '../../core/util.js';
import { ell } from '../../core/draw.js';
import { NPC_BY_ID, npcLook } from '../../data/index.js';
import { drawHamster, blinkAt } from '../../art/hamster.js';
import { T, PS, OUT, SP, OBJECTS, tileOf, doorX } from './kinds.js';

/**
 * Сдвинуть ent ({ x, y, dir, path, moving, walkT }) по его пути. true — в этом шаге дошли до конца.
 * Через «медленные» клетки (кусты) — медленнее.
 */
/**
 * Куда смотрит идущий (З6): шаг вбок — повернулся в его сторону (dir), шаг вверх или вниз — мордочкой прямо
 * (vert = true, рисуется без поворота). Совсем короткие шаги направление не меняют.
 */
export function faceTo(ent, dx, dy) {
  if (Math.abs(dy) > Math.abs(dx) * 1.5 && Math.abs(dy) > 2) ent.vert = true;
  else if (Math.abs(dx) > 2) {
    ent.vert = false;
    ent.dir = dx > 0 ? 1 : -1;
  }
}
/** Направление для позы хомячка: 1 / -1 — повёрнут, 0 — смотрит прямо (идёт или стоит после шага вверх-вниз). */
export const faceDir = (ent) => (ent.vert ? 0 : ent.dir);

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
    faceTo(ent, dx, dy);
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
      home: b ? [Math.floor(b.x + b.w / 2 + doorX(b) / T), b.y + b.h + 1] : Array.isArray(a.home) ? a.home : null,
      ph: 1 + i * 2.3,
      x: (a.at[0] + 0.5) * T,
      y: (a.at[1] + 0.5) * T,
      dir: 1,
      path: [],
      wait: rnd(0, 3),
      walkT: 0,
      moving: false,
      hidden: false,
      inside: false, // позвал в гости и уже зашёл к себе домой
      hold: null, // занят своим: { draw(n, t) } — не гуляет, рисуется сам (присел на скамейку рядом с хомячком, этап 17а)
      goingHome: false, // позвал в гости и идёт к своей двери
      lead: null, // { x, y } — вышел из дома вместе с хомячком и идёт туда по своим делам (walkOutWith)
    };
  });
}

/**
 * Где житель сейчас для этой локации — по его месту (npcNow, core/npc.js): 'out' — здесь, на улице; 'door' — здесь,
 * у своей двери (праздник); 'home' — у себя дома (идёт к своей двери и заходит); 'away' — в другом месте (в гостях
 * у хомячка, в отеле). Житель без расписания (free — пробная локация) — всегда 'out'.
 */
const placeOf = (sc, n) => {
  const p = n.def.free ? null : npcNow(n.id);
  if (!p) return 'out';
  if (p.scene === sc.name) return p.spot === 'door' ? 'door' : 'out';
  return p.scene === p.house ? 'home' : 'away';
};
const atHome = (at) => at === 'home';
const awayNow = (at) => at === 'away';
const cellDist = (n, c) => dist(n.x, n.y, (c[0] + 0.5) * T, (c[1] + 0.5) * T);

/**
 * Расставить жителей по местам, когда хомячок входит в локацию (её здесь не было — могло пройти полдня, или она
 * только что вышла из его дома): кто дома — уже внутри (на улице его нет), на празднике у своей двери — у двери,
 * на улице — у своего места.
 */
export function settleResidents(sc) {
  for (const n of sc.npcs) {
    if (!n.home) continue;
    const at = placeOf(sc, n);
    n.inside = atHome(at);
    n.goingHome = false;
    const c = (n.inside && !n.def.still) || at === 'door' ? n.home : n.hang; // still — всегда на своём месте
    if (cellDist(n, c) <= T * ((n.def.roam || 3.5) + 0.5)) continue; // уже рядом — пусть стоит, где стоял
    n.x = (c[0] + 0.5) * T;
    n.y = (c[1] + 0.5) * T;
    n.path = [];
    n.moving = false;
  }
}

/** Шаг логики жителей: кто спрятан, кто идёт, кому пора выбрать новую точку. */
export function updateResidents(sc, dt) {
  const m = sc.map;
  for (const n of sc.npcs) {
    // дома (утро, вечер, позвал в гости, обедает): идёт домой, у двери «заходит» — и на улице его нет, пока он дома
    const at = placeOf(sc, n),
      waits = !!n.home && atHome(at);
    if (!waits) n.inside = n.goingHome = false;
    else if (!n.inside && (n.def.still || cellDist(n, n.home) < T * 1.2)) n.inside = true;
    n.hidden = awayNow(at) || n.inside || (atHome(at) && !n.home);
    // hold — житель занят своим (присел рядом с хомячком на скамейку — features/relax.js, празднует —
    // locations/holidays_crowd.js): стоит на месте или его водят там
    if (n.hidden || G.modal || n.def.still || n.hold) continue;
    if (n.path.length) {
      if (moveAlong(m, n, 90, dt) && n.goingHome) n.inside = true; // дошёл до своей двери
      continue;
    }
    if (waits) n.wait = Math.min(n.wait, 0.8); // домой не мешкает
    n.wait -= dt;
    if (n.wait > 0) continue;
    n.wait = rnd(2.5, 7);
    // вышел от хомячка по своим делам (walkOutWith): идёт туда; дошёл (или пути нет) — дальше гуляет как обычно
    if (n.lead && !waits && at === 'out') {
      if (
        dist(n.x, n.y, n.lead.x, n.lead.y) < T * 1.5 ||
        !m.route(n, n.lead.x, n.lead.y, false, m.dry) ||
        !n.path.length
      )
        n.lead = null;
      continue;
    }
    n.lead = null;
    const [ax, ay] = waits || (at === 'door' && n.home) ? n.home : n.hang;
    const roam = n.def.roam || 3.5,
      far = waits || dist(n.x, n.y, (ax + 0.5) * T, (ay + 0.5) * T) > T * (roam + 0.5);
    const tx = far ? ax : tileOf(n.x) + Math.round(rnd(-2, 2)),
      ty = far ? ay : tileOf(n.y) + Math.round(rnd(-2, 2));
    if (!far && dist((tx + 0.5) * T, (ty + 0.5) * T, (ax + 0.5) * T, (ay + 0.5) * T) > T * roam) continue;
    const k = m.kindAt(tx, ty);
    if (k && k.wet) continue;
    const ok = m.route(n, (tx + 0.5) * T, (ty + 0.5) * T, false, m.dry);
    if (waits) {
      // пути до двери нет (или уже пришёл) — не стоять же на улице весь день
      if (ok && n.path.length) n.goingHome = true;
      else n.inside = true;
    }
  }
}

/**
 * Гость выходит из дома вместе с хомячком (features/guests.js): житель id встаёт рядом с ней (она только что вышла
 * из двери) и идёт к точке to ({ x, y } — его дело: например, место из его задания) или, без to, по своим делам —
 * к своему месту (днём) или домой (вечером), как обычно. false — такого жителя в этой локации нет.
 */
export function walkOutWith(sc, id, to = null) {
  const n = sc.npcs.find((q) => q.id === id);
  if (!n) return false;
  const p = sc.p,
    pass = sc.pass();
  const spot = [
    [30, 6],
    [-30, 6],
    [0, 24],
    [0, 0],
  ].find(([dx, dy]) => canStand(pass, p.x + dx, p.y + dy)) || [0, 0];
  n.x = p.x + spot[0];
  n.y = p.y + spot[1];
  n.dir = spot[0] < 0 ? 1 : -1;
  n.inside = n.goingHome = n.moving = false;
  n.path = [];
  n.wait = 0.5; // постоял рядом — и пошёл
  n.lead = to ? { x: to.x, y: to.y } : null;
  return true;
}

/** Под пальцем ли житель (точка мира w). */
/** На месте ли житель — виден и можно подойти (hold.off — занят вдали от своего места: русалочка уплыла с камня). */
export const residentOn = (n) => !n.hidden && !(n.hold && n.hold.off);
export const hitResident = (n, w) =>
  residentOn(n) && Math.abs(w.x - n.x) < 30 && w.y > n.y - 70 && w.y < n.y + 14;

// Житель из кэша спрайтов. Вместо плавной анимации — готовые кадры: 8 кадров шага или 4 кадра «дыхания»,
// глаза открыты или закрыты (моргание), смотрит влево или вправо. Игрок рисуется «вживую» (render.js).
const WALK_FRAMES = 8,
  IDLE_FRAMES = 4;
export function drawResident(n, t) {
  if (n.hold && n.hold.draw) {
    n.hold.draw(n, t);
    return;
  }
  const nd = NPC_BY_ID[n.id],
    sc = PS * (nd.small ? 0.8 : 1),
    shut = blinkAt(t, n.ph) > 0.5 ? 1 : 0;
  // кадр: 0..7 — шаг, 8..11 — стоит и дышит
  const fr = n.moving
    ? Math.floor((n.walkT % 1) * WALK_FRAMES)
    : WALK_FRAMES + Math.min(IDLE_FRAMES - 1, Math.floor(((Math.sin((t + n.ph) * 2.2) + 1) / 2) * IDLE_FRAMES));
  // в праздник — в праздничном наряде (этап 15): праздник входит в ключ кадра; в дождь — с зонтиком или в дождевике
  const fest = npcDress(),
    rain = n.home ? npcRain(n.id) : null,
    key = `npc:${n.id}:${fest || ''}${rain ? ':rain' : ''}:${faceDir(n)}:${fr}:${shut}`;
  let s = SP.find(key);
  if (!s) {
    // поза кадра: для шага — середина его отрезка фазы; для «дыхания» — время, в которое тело на нужной высоте
    const i = fr - WALK_FRAMES,
      time = i < 0 ? 0 : Math.asin((((i + 0.5) / IDLE_FRAMES) * 2 - 1) * 0.9) / 2.2;
    const pose = { dir: faceDir(n), time, walk: i < 0 ? (fr + 0.5) / WALK_FRAMES : null, blink: shut };
    s = SP.get(key, [-66 * sc, (rain && rain.umbrella ? -166 : -124) * sc, 66 * sc, 12 * sc], (c) => {
      drawHamster(c, 0, 0, sc, npcLook(n.id, fest, rain), pose);
      if (rain && rain.umbrella) drawUmbrella(c, sc, rain.umbrella);
    });
  }
  SP.draw(s, n.x, n.y + 10);
}

/**
 * На сколько поднять имя и значок над жителем в дождь: под зонтиком — над куполом (верх купола с шишечкой — на
 * 160 единиц рисунка выше лап, и подпись не должна его касаться), в дождевике — чуть выше капюшона. Житель «занят
 * своим» (n.hold) — сколько скажет занятие (hold.lift: за столиком кафе — над его зонтом).
 */
export const umbrellaLift = (n) => {
  if (n.hold) return n.hold.lift || 0;
  const r = n.home && npcRain(n.id);
  return !r ? 0 : r.umbrella ? 64 : 8;
};
/** Зонтик над жителем (в дождь): ручка от лапки и круглый купол с фестонами — в кадр спрайта жителя. s — масштаб. */
export function drawUmbrella(c, s, col) {
  c.save();
  c.scale(s, s);
  c.lineCap = 'round';
  c.lineJoin = 'round';
  // ручка
  c.strokeStyle = OUT;
  c.lineWidth = 5;
  c.beginPath();
  c.moveTo(30, -44);
  c.lineTo(30, -122);
  c.stroke();
  c.strokeStyle = '#c9a26b';
  c.lineWidth = 2.4;
  c.stroke();
  // купол
  c.beginPath();
  c.moveTo(-34, -120);
  c.bezierCurveTo(-30, -172, 90, -172, 94, -120);
  for (let i = 3; i >= 0; i--) c.quadraticCurveTo(-34 + (i + 0.5) * 32, -134, -34 + i * 32, -120);
  c.closePath();
  c.fillStyle = col;
  c.fill();
  c.strokeStyle = OUT;
  c.lineWidth = 2.6;
  c.stroke();
  // спицы и блик
  c.strokeStyle = 'rgba(60,40,30,.25)';
  c.lineWidth = 1.6;
  c.beginPath();
  for (const x of [-2, 30, 62]) {
    c.moveTo(30, -158);
    c.quadraticCurveTo((x + 30) / 2 + (x - 30) * 0.2, -150, x, -124);
  }
  c.stroke();
  c.strokeStyle = 'rgba(255,255,255,.55)';
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(-18, -134);
  c.quadraticCurveTo(-8, -154, 12, -160);
  c.stroke();
  c.fillStyle = OUT;
  c.beginPath();
  c.arc(30, -160, 3, 0, 6.2832);
  c.fill();
  c.restore();
}

/**
 * Значок над жителем (журнал заданий): '!' — у него можно взять задание, '?' — к нему пора с заданием (questBadge
 * в core/state.js). Рисунок — из кэша спрайтов, покачивается целыми шагами.
 */
export function drawBadge(n, t) {
  const mark = questBadge(n.id);
  if (!mark) return;
  const small = NPC_BY_ID[n.id].small ? 0.82 : 1;
  const s = SP.get('badge:' + mark, [-22, -24, 22, 22], (c) => {
    ell(c, 0, 2, 15, 15, 'rgba(60,40,30,.28)');
    ell(c, 0, 0, 15, 15, mark === '!' ? '#ffd43b' : '#8ce99a', OUT, 2.5);
    c.font = '900 22px ui-rounded, "Trebuchet MS", sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = OUT;
    c.fillText(mark, 0, 1.5);
  });
  SP.draw(s, n.x, n.y - (96 + umbrellaLift(n)) * small + Math.round(Math.sin(t * 3 + n.ph) * 3));
}
