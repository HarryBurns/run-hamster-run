// ПРАЗДНИКИ (этап 15, Пр4, Пр5, Пр19, Пр20): ЖИТЕЛИ ПРАЗДНУЮТ ВМЕСТЕ. В праздник, в свои часы, жители города
// (в праздничных нарядах — HOLIDAY_DRESS в data/holidays.js) сами собираются: катаются на коньках на замёрзшем пруду
// в парке и водят хоровод вокруг ёлки на площади (Новый год), смотрят на вертеп (Рождество), танцуют у дракона
// (Китайский Новый год), гуляют по ярмарке (Масленица), идут парадом с шариками вокруг пруда в парке (1 Мая), водят
// хоровод у купальского костра на пляже (Иван Купала). Вечером Рождества и Хеллоуина хозяева ждут у своих дверей —
// колядующих и «сладость или гадость» (с 16:00, как и колядки: Пр5 — больше не «забегают домой за угощением»).
//
// Как устроено. Это кусочек части украшений города (locations/holidays.js зовёт crowd.update / crowd.debug):
// житель, которого праздник «взял», получает n.hold = { crowd: true } — движок (engine/topdown/actors.js) его больше
// не водит, а здесь он сначала идёт по пути к своему месту (moveAlong), потом встаёт в круг: по кругу (ring, skate,
// parade) его ведёт эллипс — место в кругу едет со временем, житель «догоняет» его; танцоры (dance) прыгают на месте —
// свой кадр из кэша спрайтов (руки вверх). Кончилось время — n.hold снят, житель снова гуляет сам.
// Кто не празднует: кого не видно (ночь, в гостях у хомячка, позвал к себе, у бассейна отеля), кто занят другим
// (сидит рядом с хомячком на скамейке — n.hold от features/relax.js).
//
// GATHER — по празднику: [{ from, to (часы), kind, c: [x, y] центр (клетки), r: [rx, ry] (клетки), speed, spots }]
//   ring    хоровод по эллипсу (шагом);  skate — то же, но скользят (кадры «стоит», как на коньках)
//   parade  колонной по эллипсу (дорожка вокруг пруда), друг за другом
//   dance   танцоры на своих местах spots — прыгают, руки вверх
//   crowd   стоят на своих местах spots лицом к центру c, иногда радуются
//   doors   стоят у двери своего домика (n.home)
import { G, invitedToday, npcDress } from '../core/state.js';
import { dist } from '../core/util.js';
import { NPC_BY_ID, npcLook } from '../data/index.js';
import { drawHamster, blinkAt } from '../art/hamster.js';
import { T, PS, SP, tileOf } from '../engine/topdown/kinds.js';
import { moveAlong, faceTo } from '../engine/topdown/actors.js';

const S = () => G.state;
/** Где и когда празднуют (клетки города; часы — с from до to). */
export const GATHER = {
  newyear: [
    { from: 11, to: 16, kind: 'skate', c: [40.5, 38.6], r: [3.1, 1.25], speed: 0.42, where: 'каток в парке' },
    { from: 17, to: 22, kind: 'ring', c: [44.5, 23.15], r: [2.45, 1.15], speed: 0.3, where: 'хоровод у ёлки' },
  ],
  xmas: [
    { from: 11, to: 15, kind: 'crowd', c: [54, 23], spots: [[52.4, 24.6], [55.6, 24.2], [53.3, 25.5], [54.8, 25.7], [51.3, 23.9], [56.8, 23.6], [51.9, 25.8], [56.6, 25.4]], where: 'у вертепа' },
    { from: 16, to: 22, kind: 'doors', where: 'у своих дверей' },
  ],
  cny: [
    {
      from: 11,
      to: 18,
      kind: 'dance',
      c: [45.5, 23.3],
      spots: [[42.9, 25.3], [44.3, 25.7], [47.6, 25.6], [49.1, 25.2], [50.3, 24.4], [41.7, 24.5], [48.6, 21.6], [42.5, 21.5]],
      where: 'танцуют у дракона',
    },
  ],
  maslenitsa: [
    {
      from: 11,
      to: 17,
      kind: 'crowd',
      c: [50, 24],
      spots: [[42.6, 24.6], [47.4, 24.4], [57.8, 26.1], [61.7, 26.4], [49.6, 25.7], [53.6, 25.9], [56.3, 24.1], [47.2, 22.3]],
      where: 'на ярмарке',
    },
  ],
  mayday: [{ from: 10, to: 14, kind: 'parade', c: [40.5, 38.5], r: [6, 5], speed: 0.16, where: 'парад вокруг пруда' }],
  kupala: [{ from: 18, to: 22, kind: 'ring', c: [49.5, 53.3], r: [2.7, 1.3], speed: 0.34, where: 'хоровод у костра' }],
  halloween: [{ from: 16, to: 22, kind: 'doors', where: 'у своих дверей' }],
};
/** Что сейчас по таблице для праздника id (или null). */
export function gatherNow(id) {
  if (!S() || !id) return null;
  const h = S().minutes / 60;
  return (GATHER[id] || []).find((g) => h >= g.from && h < g.to) || null;
}

const CIRCLE = { ring: 1, skate: 1, parade: 1 };
const SPEED = 110; // шагом к своему месту (чуть быстрее, чем гуляют: торопятся на праздник)
/** Точка на эллипсе праздника для места i из n (в единицах мира). */
function circleAt(g, i, n, t) {
  const a = g.kind === 'parade' ? t * g.speed - i * 0.42 : t * g.speed + (i / n) * Math.PI * 2;
  return { x: g.c[0] * T + Math.cos(a) * g.r[0] * T, y: g.c[1] * T + Math.sin(a) * g.r[1] * T };
}

export function createCrowd() {
  let cur = null, // праздник и строка GATHER, что идёт сейчас
    snap = false;
  const crew = new Map(); // id жителя → { i, phase: 'go' | 'in', since }
  /** Отпустить всех: жители снова гуляют сами. */
  function release(sc) {
    for (const n of sc.npcs)
      if (n.hold && n.hold.crowd) {
        n.hold = null;
        n.path = [];
        n.moving = false;
        n.wait = 0.5;
      }
    crew.clear();
  }
  /** Может ли житель праздновать сейчас. */
  const free = (n) => !n.hidden && !n.inside && !n.goingHome && !invitedToday(n.id) && (!n.hold || n.hold.crowd) && !!NPC_BY_ID[n.id];
  /** Куда встать жителю (единицы мира). */
  function placeOf(sc, g, n, slot, total, t) {
    if (CIRCLE[g.kind]) return circleAt(g, slot, total, t);
    if (g.kind === 'doors') return n.home ? { x: (n.home[0] + 0.5) * T, y: (n.home[1] + 0.5) * T } : null;
    const s = g.spots[slot % g.spots.length];
    return { x: s[0] * T, y: s[1] * T };
  }
  /** Танцор у дракона: прыжок и руки вверх — свои кадры из кэша спрайтов. */
  function drawDancer(n, t) {
    const nd = NPC_BY_ID[n.id],
      sc = PS * (nd.small ? 0.8 : 1),
      fest = npcDress(),
      ph = t * 3.2 + n.ph,
      up = Math.sin(ph) > 0 ? 1 : 0,
      hop = Math.round(Math.abs(Math.sin(ph * 2)) * 9),
      shut = blinkAt(t, n.ph) > 0.5 ? 1 : 0,
      dir = n.dir === -1 ? -1 : 1;
    const key = `npcd:${n.id}:${fest || ''}:${dir}:${up}:${shut}`;
    let s = SP.find(key);
    if (!s) s = SP.get(key, [-56 * sc, -128 * sc, 56 * sc, 12 * sc], (c) => drawHamster(c, 0, 0, sc, npcLook(n.id, fest), { dir, time: 0, happy: true, armsUp: !!up, blink: shut }));
    SP.draw(s, n.x, n.y + 10 - hop);
  }
  return {
    /** Шаг логики (крюк update части украшений): id — праздник сегодня (или null). */
    update(sc, dt, id) {
      const g = gatherNow(id);
      if (!g || sc.name !== 'world') {
        if (cur) release(sc);
        cur = null;
        return;
      }
      if (!cur || cur.g !== g) {
        release(sc);
        cur = { id, g };
      }
      if (G.modal) return;
      const t = G.time,
        m = sc.map,
        list = sc.npcs.filter(free);
      // кто ушёл (позвали в гости, стемнело) — отпустить
      for (const n of sc.npcs)
        if (n.hold && n.hold.crowd && !list.includes(n)) {
          n.hold = null;
          crew.delete(n.id);
        }
      list.forEach((n, i) => {
        let c = crew.get(n.id);
        if (!c) {
          c = { i, phase: 'go' };
          crew.set(n.id, c);
          n.hold = { crowd: true, draw: g.kind === 'dance' ? null : undefined };
          n.path = [];
        }
        c.i = i;
        const p = placeOf(sc, g, n, i, list.length, t);
        if (!p) return;
        if (snap) {
          // хомячок только что пришла в город — все уже на местах
          n.x = p.x;
          n.y = p.y;
          n.path = [];
          c.phase = 'in';
        }
        if (c.phase === 'go') {
          if (!n.path.length) {
            if (dist(n.x, n.y, p.x, p.y) < T * 1.6) c.phase = 'in';
            else if (!m.route(n, p.x, p.y, false, m.dry)) c.phase = 'in'; // пути нет — пусть «подойдёт» по прямой
          } else moveAlong(m, n, SPEED, dt);
          return;
        }
        // на месте: догоняем своё место (по кругу оно едет)
        const dx = p.x - n.x,
          dy = p.y - n.y,
          d = Math.hypot(dx, dy),
          v = (g.kind === 'skate' ? 150 : 120) * dt;
        if (d > 1) {
          const k = Math.min(1, v / d);
          n.x += dx * k;
          n.y += dy * k;
        }
        const moving = CIRCLE[g.kind] ? true : d > 3;
        if (moving) faceTo(n, dx, dy);
        else if (g.c) {
          n.vert = false;
          n.dir = g.c[0] * T >= n.x ? 1 : -1; // лицом к ёлке, вертепу, ярмарке
        }
        // на коньках скользят (кадры «стоит»), остальные идут шагом
        n.moving = moving && g.kind !== 'skate';
        if (n.moving) n.walkT += dt * 2.4;
        n.hold.draw = g.kind === 'dance' ? drawDancer : null;
      });
      snap = false;
    },
    /** Хомячок пришла в город: если праздник уже идёт — жители сразу на местах. */
    enter() {
      snap = true;
    },
    leave(sc) {
      if (cur) release(sc);
      cur = null;
    },
    /** Для тестов: что празднуют сейчас и кто где. */
    debug(sc) {
      return {
        kind: cur ? cur.g.kind : '',
        where: cur ? cur.g.where : '',
        crew: sc ? sc.npcs.filter((n) => n.hold && n.hold.crowd).map((n) => ({ id: n.id, x: +(n.x / T).toFixed(1), y: +(n.y / T).toFixed(1), tx: tileOf(n.x), ty: tileOf(n.y) })) : [],
      };
    },
  };
}
