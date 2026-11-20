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
// Кто празднует — решает общее правило «где житель сейчас» (npcPlace в core/queries.js: 'fest' или 'door' — по
// таблице HOLIDAY_GATHER в data/holidays.js); не празднует, кто в гостях у хомячка, позвал к себе, у бассейна отеля,
// у кого хомячок сейчас в гостях, и кто занят другим (сидит рядом с хомячком на скамейке — n.hold от features/relax.js).
//
// GATHER — по празднику: [{ from, to (часы), kind, c: [x, y] центр (клетки), r: [rx, ry] (клетки), speed, spots }]
//   ring    хоровод по эллипсу (шагом);  skate — то же, но скользят (кадры «стоит», как на коньках)
//   parade  колонной по эллипсу (дорожка вокруг пруда), друг за другом
//   dance   танцоры на своих местах spots — прыгают, руки вверх
//   crowd   стоят на своих местах spots лицом к центру c, иногда радуются
//   doors   стоят у двери своего домика (n.home)
import { G, npcPlace, npcDress } from '../core/state.js';
import { dist } from '../core/util.js';
import { NPC_BY_ID, npcLook, HOLIDAY_GATHER, gatherOn } from '../data/index.js';
import { drawHamster, blinkAt } from '../art/hamster.js';
import { T, PS, SP, tileOf } from '../engine/topdown/kinds.js';
import { moveAlong, faceTo } from '../engine/topdown/actors.js';

const S = () => G.state;
/** Где и когда празднуют — таблица HOLIDAY_GATHER (data/holidays.js): по ней и npcPlace (core/queries.js) знает,
 * что житель сейчас на празднике. */
export const GATHER = HOLIDAY_GATHER;
/** Что сейчас по таблице для праздника id (или null). */
export function gatherNow(id) {
  return S() ? gatherOn(id, S().minutes) : null;
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
  const free = (n) => {
    const p = npcPlace(n.id); // на празднике ли он по общему правилу (core/queries.js): 'fest' или «у своей двери»
    return !!p && (p.at === 'fest' || p.at === 'door') && !n.hidden && !n.inside && (!n.hold || n.hold.crowd);
  };
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
    if (!s)
      s = SP.get(key, [-56 * sc, -128 * sc, 56 * sc, 12 * sc], (c) =>
        drawHamster(c, 0, 0, sc, npcLook(n.id, fest), { dir, time: 0, happy: true, armsUp: !!up, blink: shut }),
      );
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
        crew: sc
          ? sc.npcs
              .filter((n) => n.hold && n.hold.crowd)
              .map((n) => ({
                id: n.id,
                x: +(n.x / T).toFixed(1),
                y: +(n.y / T).toFixed(1),
                tx: tileOf(n.x),
                ty: tileOf(n.y),
              }))
          : [],
      };
    },
  };
}
