// «Движок локаций»: сцена «вид сверху» по описанию локации.
//
//   const town = createTopDownScene(описание);  registerScene(town.name, town);
//
// ОПИСАНИЕ ЛОКАЦИИ (locations/*.js) — обычный объект. Всё, кроме id и карты, необязательно.
//   id            имя сцены (оно же попадает в сохранение позиции: { scene: id, x, y })
//   title         название для окна карты;  home: true — главная локация (город): к ней относятся предметы
//                 заданий без указания локации, её карту показывают, пока хомячок в доме
//   w, h, base, build(m)  или  rows, legend    карта — см. map.js
//   buildings     [{ id, kind, x, y, w, h, name, icon, act, … }] — «пятно» в клетках, дверь снизу по центру;
//                 act — действие из реестра, когда хомячок вошёл (ему передаётся { building, back })
//   places        ОСОБЫЕ МЕСТА: [{ id, act | use(sc), … }] — где оно и как до него дойти:
//                   at: [x, y] + hit: { dx, up, down } | { r }   нажимают на предмет (зона вокруг центра клетки)
//                   cell: [x, y] | area: [x0, y0, x1, y1] | tile: 'вид'   нажимают на клетку(и)
//                   stand: [x, y]   куда встать (в клетках, 15.5 — середина клетки 15); без stand — рядом
//                   when()          место работает только когда true (лунка — зимой)
//                   mark: [x, y]    куда показывает звёздочка задания (по умолчанию stand)
//                   map: { icon, at: [x, y], label }   значок на мини-карте и кнопка «дойти» в окне карты
//                   key: false      с клавиши E не срабатывает;  shy: 0.6 — с клавиши только если совсем рядом;
//                   reach: 1.5      с клавиши срабатывает всегда, если ближе стольких клеток
//   spots         просто точки с именем: { beach: { at: [x, y], mark: [x, y], label: '🏖️ Пляж' } }
//   actors        жители: [{ npc, at, home, act, always }] — см. actors.js
//   entries       ТОЧКИ ВХОДА: { имя: { at: [x, y] } | { building: id }, from: 'сцена' } — from: кто пришёл из
//                 этой сцены без точного места, появляется здесь;  start — имя входа «по умолчанию»
//   exits         ВЫХОДЫ: [{ id, area: [x0, y0, x1, y1], to: 'сцена', entry: 'имя входа', off, when() }] —
//                 хомячок наступил на клетку area → go(to, { at: entry }). off: true — выход закрыт
//                 (открыть: sc.exit(id).off = false). Вместо to можно act — действие из реестра.
//   pickups       НАХОДКИ: [{ id, at: [x, y], icon, give: [сумка, id, сколько], text, once, act }] — лежат на
//                 земле, подбираются на ходу; снова появляются утром (once: true — только один раз за игру).
//                 Каждый день в новых местах — sc.setPickups(список) из крюка enter (места даст randomSpots)
//   zones         где разбрасывать предметы заданий: { имя: { x: [x0, x1], y: [y0, y1], tiles: [виды],
//                 avoid: [[x0, y0, x1, y1]], reach: { from: [x, y], tiles } } } — см. randomSpots();
//                 reach — предмет должен быть достижим из клетки from (tiles — проверять только на этих видах)
//   water         { shoreY, foamY } — подсказки рисункам воды;  bg — цвет за краем карты
//   sky: false    под крышей или под землёй: без погоды и ночного затемнения;  dark — своя темнота 0..1
//                 (число или функция);  season — всегда рисовать этим сезоном ('winter' — снежная вершина)
//   sound(sc)     что слышно: { day, sea, rain, birds, crickets }
//   parts         ЧАСТИ локации: объекты с теми же крюками, что и у самого описания (море города — sea.js)
//
// КРЮКИ — функции в описании или в его частях (всё, что у локации уникально):
//   built(sc)                    карта построена (один раз)
//   enter(sc, from, params)      вошли в сцену; герой уже стоит на месте
//   tap(sc, w, tx, ty)           нажали в точку мира w (клетка tx, ty): true — нажатие обработано. Зовётся первым
//   tapThing(sc, w, tx, ty)      то же, но после жителей и особых мест-предметов (своя живность локации)
//   interact(sc)                 клавиша E: true — обработано. Зовётся первым
//   near(sc)                     клавиша E: { d, pending } — «рядом есть вот что» (d — насколько близко)
//   idle(sc)                     клавиша E, а рядом ничего нет
//   update(sc, dt)               шаг логики — после героя, жителей и погоды
//   surface(sc, вид, прежний)    герой перешёл на клетку другого вида
//   ground(ctx, sc, env)         дорисовать поверх земли;  over(ctx, sc, t) — поверх всего, что стоит
//   things(sc, add, view)        своё в общем порядке «дальше → ближе»: add(y, fn(ctx, v, t, sc), v, late)
//   overlay(ctx, sc, w, h)       поверх кадра в экранных координатах;  miniMap(ctx, sc, k) — на мини-карту
//   target(sc)                   куда показывать звёздочку задания: { x, y, icon } или null
//   buttons(sc)                  кнопки HUD: [{ id, icon, label, on, fn }]
//
// СЦЕНА (то, что вернул createTopDownScene) умеет: ходьбу по нажатию и стрелками, «дойти и сделать», вход в
// здания, особые места, жителей, предметы заданий и находки, переходы, камеру, погоду и ночь, сохранение позиции.
// Крюкам и занятиям пригодятся: sc.map, sc.p (герой), sc.cam, sc.walkTo(x, y, точно), sc.goNear(x, y, pending),
// sc.pass(), sc.spot(id), sc.walkToPlace(id), sc.randomSpots(зона, n, seed), sc.drops, sc.exit(id).
// pending — «что сделать, когда дойдём»: { fn(sc) } | { place } | { b: здание } | { npc } | { obj }.
// Способ передвижения героя (кораблик): sc.p.ride = { speed, pass(tx, ty), step: { sfx, pause }, moved(sc),
// draw(ctx, sc, p, t, look), drop(sc) } — пока он задан, герой ходит по его правилам; null — пешком.
import { G, darkness } from '../../core/state.js';
import { addItem, setFlag, setDayFlag, collectMailItem } from '../../core/actions.js';
import { emit } from '../../core/events.js';
import { run } from '../../core/registry.js';
import { go, scene } from '../../core/loop.js';
import { keys } from '../../core/input.js';
import { Camera } from '../../core/camera.js';
import { clamp, dist, seeded } from '../../core/util.js';
import { sfx } from '../../core/audio.js';
import { toast } from '../../ui/toast.js';
import { TASK_BY_ID } from '../../data/index.js';
import { T, SP, TILES, OBJECTS, BUILDING_KINDS, tileOf } from './kinds.js';
import { createMap, mapSize } from './map.js';
import { moveAlong, canStand, makeResidents, updateResidents, hitResident } from './actors.js';
import { drawFrame, drawMiniMapBase, drawMiniMapPlayer, initWeather, updateWeather } from './render.js';

// ---------- локации игры ----------
/** Все локации: имя сцены → сцена. */
export const locations = {};
let currentName = '';
/** Локация по имени сцены (или undefined). */
export const getLocation = (name) => locations[name];
/** Главная локация (home: true в описании) — город. */
export const homeLocation = () => Object.values(locations).find((l) => l.desc.home) || Object.values(locations)[0];
/** Локация, в которой хомячок сейчас, а пока он в доме — та, что снаружи (или где был последней). */
export function currentLocation() {
  const sc = scene(),
    pos = sc && sc.savePos ? sc.savePos() : null; // дом без своего сохранения отдаёт место снаружи
  return (pos && locations[pos.scene]) || locations[currentName] || homeLocation();
}

const NONE = [];
const cellPx = (c) => ({ x: c[0] * T, y: c[1] * T }); // [15.5, 8.5] «в клетках» → единицы мира

export function createTopDownScene(desc) {
  const parts = [desc, ...(desc.parts || [])];
  const size = mapSize(desc);
  const places = desc.places || [],
    placeById = Object.fromEntries(places.map((pl) => [pl.id, pl])),
    spots = desc.spots || {},
    entries = desc.entries || {},
    exits = (desc.exits || []).map((e) => ({ ...e }));
  const startName = desc.start || Object.keys(entries)[0];
  let map = null;

  /** Позиция входа: имя из entries или сама точка [x, y] в клетках. Нужна построенная карта (двери зданий). */
  function entryPx(at) {
    if (Array.isArray(at)) return cellPx(at);
    const e = entries[at];
    if (!e) return null;
    if (e.building) return map.doorPx(map.bById[e.building]);
    return cellPx(e.at);
  }
  const placeOn = (pl) => !pl.when || pl.when();

  const sc = {
    name: desc.id,
    desc,
    w: size.w,
    h: size.h,
    cam: new Camera(),
    // герой: path — куда идём; pending — что сделать, когда дойдём; surf — вид клетки под ногами;
    // ride — на чём едет (кораблик) или null
    p: { x: 0, y: 0, dir: 1, path: [], moving: false, walkT: 0, pending: null, surf: desc.base || 'g', ride: null },
    npcs: [],
    places,
    pickups: [],
    drops: [], // падающие значки: { x, y, t, e }
    weather: [],
    weatherKind: null,
    down: null,
    built: false,
    env: null,
    get map() {
      return ensure();
    },

    /** Вызвать крюк name у описания и всех его частей. */
    call(name, ...a) {
      for (const part of parts) if (part[name]) part[name](...a);
    },
    /** Вызвать крюк name по очереди, пока кто-нибудь не вернёт «да»; вернуть этот ответ. */
    first(name, ...a) {
      for (const part of parts)
        if (part[name]) {
          const r = part[name](...a);
          if (r) return r;
        }
      return null;
    },
    darkness: () =>
      desc.dark === undefined ? darkness() : typeof desc.dark === 'function' ? desc.dark(sc) : desc.dark,
    /** Куда показывает звёздочка задания: что скажет крюк target, а иначе — ближайший несобранный предмет задания. */
    target() {
      const tg = sc.first('target', sc);
      if (tg) return tg;
      for (const it of sc.taskItems())
        if (!it.got && sc.itemHere(it))
          return {
            x: (it.x + 0.5) * T,
            y: (it.y + 0.5) * T,
            icon: (TASK_BY_ID[G.state.mail.task] || {}).sticker || '⭐',
          };
      return null;
    },

    // ---------- «дойти и сделать» ----------
    /** Кто и где сейчас может пройти: правило героя (пешком или «верхом»). */
    pass: () => (sc.p.ride ? sc.p.ride.pass : map.foot),
    /** Отправить героя в точку мира. exact — встать ровно в неё. false — туда не дойти. */
    walkTo: (px, py, exact) => map.route(sc.p, px, py, exact, sc.pass()),
    /** Подойти к клетке рядом с точкой (сама она может быть занята) и выполнить pending. */
    goNear(px, py, pending) {
      const p = sc.p,
        pass = sc.pass(),
        tx = tileOf(px),
        ty = tileOf(py);
      let best = null,
        bd = 1e9;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if ((!dx && !dy) || !pass(tx + dx, ty + dy)) continue;
          const d = dist((tx + dx + 0.5) * T, (ty + dy + 0.5) * T, p.x, p.y) + (dx && dy ? 20 : 0);
          if (d < bd) {
            bd = d;
            best = [tx + dx, ty + dy];
          }
        }
      if (!best) {
        const nw = map.nearest(pass, tx, ty);
        if (!nw) return;
        best = nw;
      }
      if (dist(p.x, p.y, px, py) < T * 1.6) {
        p.path = [];
        p.pending = pending;
        arrive();
        return;
      }
      if (sc.walkTo((best[0] + 0.5) * T, (best[1] + 0.5) * T, true)) p.pending = pending;
    },
    /** Вошли в здание: что при этом происходит, записано в его поле act и выполняется реестром действий. */
    enterBuilding(b) {
      if (!b.act) return;
      const d = ensure().doorPx(b);
      run(b.act, { building: b, scene: sc, back: { scene: sc.name, x: d.x, y: d.y } });
    },
    /** Точка с именем (в единицах мира): место, точка из spots или дверь здания; null — такого здесь нет. */
    spot(id) {
      ensure();
      const pl = placeById[id] || spots[id];
      if (pl) {
        const c = pl.mark || pl.stand || (pl.at && [pl.at[0] + 0.5, pl.at[1] + 0.5]);
        return c ? cellPx(c) : null;
      }
      const b = map.bById[id];
      return b ? map.doorPx(b) : null;
    },
    /** Отправить хомячка к зданию, особому месту или точке по имени. */
    walkToPlace(id) {
      ensure();
      const p = sc.p;
      p.pending = null;
      const pl = placeById[id];
      if (pl && pl.stand) {
        if (sc.walkTo(pl.stand[0] * T, pl.stand[1] * T, true)) p.pending = { place: pl };
        return true;
      }
      if (spots[id]) return sc.walkTo(spots[id].at[0] * T, spots[id].at[1] * T, true);
      const b = map.bById[id];
      if (!b) return false;
      const d = map.doorPx(b);
      if (!sc.walkTo(d.x, d.y, true)) return false;
      p.pending = { b };
      return true;
    },
    exit: (id) => exits.find((e) => e.id === id),

    // ---------- предметы заданий и находки ----------
    /** Предметы задания дня (из письма), пока оно не выполнено. Чьи они — см. itemHere. */
    taskItems() {
      const m = G.state.mail;
      return m && m.items && !m.done ? m.items : NONE;
    },
    /** Лежит ли предмет задания в этой локации (без пометки loc — в главной). */
    itemHere: (it) => (it.loc ? it.loc === sc.name : !!desc.home),
    /** Заменить находки локации (тот же вид записей, что и pickups в описании). */
    setPickups(list) {
      sc.pickups = (list || []).map((pk) => ({
        ...pk,
        key: `${desc.id}:${pk.id}`,
        tx: pk.at[0],
        ty: pk.at[1],
        x: (pk.at[0] + 0.5) * T,
        y: (pk.at[1] + 0.5) * T,
      }));
    },
    /** Лежит ли находка на месте (не подобрана сегодня / вообще). */
    pickupThere(pk) {
      const s = G.state;
      return pk.once ? !s.flags['find:' + pk.key] : !(s.dayFlags.finds && s.dayFlags.finds[pk.key]);
    },
    /**
     * Случайные свободные клетки зоны zone (описание.zones) для n предметов задания: [{ x, y, got: false }].
     * seed — число: один и тот же seed даёт одни и те же места.
     */
    randomSpots(zone, n, seed) {
      const m = ensure(),
        z = (desc.zones || {})[zone],
        rng = seeded(seed),
        out = [];
      if (!z) throw new Error(`Локация «${desc.id}»: нет зоны «${zone}» (zones в описании)`);
      const [zx0, zx1] = z.x || [0, m.w - 1],
        [zy0, zy1] = z.y || [0, m.h - 1];
      let guard = 0;
      while (out.length < n && guard++ < 4000) {
        const x = zx0 + Math.floor(rng() * (zx1 - zx0 + 1)),
          y = zy0 + Math.floor(rng() * (zy1 - zy0 + 1));
        const c = m.at(x, y);
        if (!m.foot(x, y)) continue;
        if (z.tiles && !z.tiles.includes(c)) continue;
        if ((z.avoid || []).some(([x0, y0, x1, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1)) continue;
        if (out.some((o) => Math.abs(o.x - x) + Math.abs(o.y - y) < 4)) continue;
        if (z.reach && (!z.reach.tiles || z.reach.tiles.includes(c))) {
          // достижимо с улицы
          const s = m.nearest(m.foot, z.reach.from[0], z.reach.from[1]);
          if (!s || !m.path(m.foot, s[0], s[1], x, y)) continue;
        }
        out.push({ x, y, got: false });
      }
      return out;
    },

    // ---------- интерфейс сцены ----------
    enter(from, params = {}) {
      ensure();
      const p = sc.p;
      p.path = [];
      p.pending = null;
      p.moving = false;
      // куда встать: названный вход → вход «для пришедших из этой сцены» → позиция из сохранения → где стояли
      const fromEntry = Object.keys(entries).find((id) => entries[id].from === from);
      const e = params.at !== undefined ? entryPx(params.at) : fromEntry ? entryPx(fromEntry) : null;
      if (e) {
        p.x = e.x;
        p.y = e.y;
      } else if (params.pos) sc.restorePos(params.pos);
      sc.call('enter', sc, from, params);
      // позиция из сохранения могла испортиться или оказаться в стене — тогда встаём рядом, а если никак — у входа
      const pass = sc.pass(),
        onMap = map.inside(p.x, p.y);
      if (!onMap || !pass(tileOf(p.x), tileOf(p.y))) {
        const nw = onMap ? map.nearest(pass, tileOf(p.x), tileOf(p.y)) : null;
        if (nw) {
          p.x = (nw[0] + 0.5) * T;
          p.y = (nw[1] + 0.5) * T;
        } else {
          const d = entryPx(startName);
          p.x = d.x;
          p.y = d.y;
          if (p.ride) {
            const r = p.ride;
            p.ride = null;
            if (r.drop) r.drop(sc);
          }
        }
      }
      p.exit = exitAt(); // стоим на клетке выхода — он сработает, только когда сойдём с неё и вернёмся
      currentName = sc.name;
      layout();
      sc.cam.snap(p.x, p.y);
      if (desc.sky !== false) initWeather(sc);
    },
    leave() {},
    savePos: () => ({ scene: sc.name, x: sc.p.x, y: sc.p.y }),
    restorePos(pos) {
      if (!pos || !Number.isFinite(pos.x) || !Number.isFinite(pos.y)) return false;
      sc.p.x = pos.x;
      sc.p.y = pos.y;
      return true;
    },

    pointerDown(sx, sy) {
      sc.down = { sx, sy };
    },
    pointerMove() {},
    pointerUp(sx, sy) {
      if (!sc.down) return;
      const moved = Math.hypot(sx - sc.down.sx, sy - sc.down.sy) > 16;
      sc.down = null;
      if (moved) return;
      const w = sc.cam.toWorld(sx, sy),
        p = sc.p;
      const tx = tileOf(w.x),
        ty = tileOf(w.y);
      p.pending = null;
      if (sc.first('tap', sc, w, tx, ty)) return;
      // житель?
      for (const n of sc.npcs)
        if (hitResident(n, w)) {
          sc.goNear(n.x, n.y, { npc: n });
          sfx('tap');
          return;
        }
      // особое место-предмет (почтовый ящик…)
      for (const pl of places) {
        if (!pl.hit || !placeOn(pl)) continue;
        const cx = (pl.at[0] + 0.5) * T,
          cy = (pl.at[1] + 0.5) * T,
          hh = pl.hit;
        if (
          hh.r ? dist(w.x, w.y, cx, cy) < hh.r : Math.abs(w.x - cx) < hh.dx && w.y > cy - hh.up && w.y < cy + hh.down
        ) {
          toPlace(pl, tx, ty);
          sfx('tap');
          return;
        }
      }
      if (sc.first('tapThing', sc, w, tx, ty)) return;
      // предмет, с которым можно что-то сделать (пальма — потрясти)
      for (const o of map.tappable) {
        const tp = OBJECTS[o.type].tap;
        if (Math.abs(w.x - o.x - (tp.ox || 0)) < tp.dx && w.y > o.y - tp.up && w.y < o.y + tp.down) {
          sc.goNear(o.x, o.y, { obj: o });
          sfx('tap');
          return;
        }
      }
      // особое место на клетках (грядка, пруд, пирс)
      const c = map.at(tx, ty);
      for (const pl of places) {
        if (pl.hit || !placeOn(pl)) continue;
        const on = pl.cell
          ? pl.cell[0] === tx && pl.cell[1] === ty
          : pl.area
            ? tx >= pl.area[0] && tx <= pl.area[2] && ty >= pl.area[1] && ty <= pl.area[3]
            : pl.tile !== undefined && pl.tile === c;
        if (on) {
          toPlace(pl, tx, ty);
          sfx('tap');
          return;
        }
      }
      // здание? (попадание в нарисованную часть)
      for (const b of map.buildings) {
        const kind = BUILDING_KINDS[b.kind],
          topPad = kind.hitUp ? kind.hitUp(b) : T * 0.8;
        if (w.x >= b.x * T && w.x <= (b.x + b.w) * T && w.y >= b.y * T - topPad && w.y <= (b.y + b.h) * T) {
          const d = map.doorPx(b);
          if (sc.walkTo(d.x, d.y, true)) p.pending = { b };
          sfx('tap');
          return;
        }
      }
      if (sc.walkTo(w.x, w.y, true)) sfx('step');
    },
    interact() {
      const p = sc.p;
      if (sc.first('interact', sc)) return;
      let best = null,
        bd = T * 1.7;
      for (const part of parts)
        if (part.near) {
          const c = part.near(sc);
          if (c) {
            bd = c.d;
            best = c.pending;
          }
        }
      for (const n of sc.npcs) {
        if (n.hidden) continue;
        const d = dist(p.x, p.y, n.x, n.y);
        if (d < bd) {
          bd = d;
          best = { npc: n };
        }
      }
      for (const b of map.buildings) {
        const dd = map.doorPx(b),
          d = dist(p.x, p.y, dd.x, dd.y);
        if (d < bd) {
          bd = d;
          best = { b };
        }
      }
      for (const pl of places) {
        if (!pl.stand || pl.key === false || !placeOn(pl)) continue;
        const d = dist(p.x, p.y, pl.stand[0] * T, pl.stand[1] * T);
        if (pl.reach) {
          if (d < pl.reach * T) best = { place: pl };
        } else if (d < bd * (pl.shy || 1)) {
          bd = d;
          best = { place: pl };
        }
      }
      if (!best) {
        // рядом клетка особого места (пруд)?
        const tx = tileOf(p.x),
          ty = tileOf(p.y);
        for (const pl of places) {
          if (pl.tile === undefined || pl.key === false || !placeOn(pl)) continue;
          for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++) if (map.at(tx + dx, ty + dy) === pl.tile) best = { place: pl };
        }
      }
      if (best) {
        p.path = [];
        p.pending = best;
        arrive();
      } else sc.call('idle', sc);
    },

    update(dt) {
      const p = sc.p,
        m = map;
      const kx =
        (keys.has('ArrowRight') || keys.has('KeyD') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('KeyA') ? 1 : 0);
      const ky =
        (keys.has('ArrowDown') || keys.has('KeyS') ? 1 : 0) - (keys.has('ArrowUp') || keys.has('KeyW') ? 1 : 0);
      const sp = p.ride ? p.ride.speed : (TILES[p.surf] && TILES[p.surf].speed) || 225;
      if (kx || ky) {
        p.path = [];
        p.pending = null;
        const so = m.slowAt(p.x, p.y),
          pass = sc.pass();
        const k = ((so ? OBJECTS[so.type].slow : 1) * sp * dt) / Math.hypot(kx, ky);
        if (canStand(pass, p.x + kx * k, p.y)) p.x += kx * k;
        if (canStand(pass, p.x, p.y + ky * k)) p.y += ky * k;
        if (kx) p.dir = kx;
        p.moving = true;
        p.walkT += dt * 2.4;
      } else if (moveAlong(m, p, sp, dt)) arrive();
      if (p.ride && p.ride.moved) p.ride.moved(sc);
      // на чём стоим
      const surf = m.at(tileOf(p.x), tileOf(p.y)),
        kind = TILES[surf];
      {
        const so = m.slowAt(p.x, p.y);
        if (so && !p.inSlow && OBJECTS[so.type].rustle) sfx(OBJECTS[so.type].rustle);
        p.inSlow = !!so;
      }
      // шаги: звук зависит от поверхности
      if (p.moving) {
        p.stepT = (p.stepT || 0) + dt;
        if (p.stepT > ((kind && kind.stepEvery) || 0.3)) {
          p.stepT = 0;
          if (p.ride && p.ride.step) {
            p.stepT = -p.ride.step.pause;
            sfx(p.ride.step.sfx);
          } else {
            const st = kind && kind.step;
            sfx((typeof st === 'function' ? st() : st) || 'stepStone');
          }
        }
      } else p.stepT = 0.2;
      if (surf !== p.surf) {
        const was = TILES[p.surf];
        if (!p.ride && kind && kind.swim && !(was && was.swim)) {
          sfx('splash');
          emit('swim', { where: kind.swim.where });
        }
        if (kind && kind.onEnter) kind.onEnter(sc);
        sc.call('surface', sc, surf, p.surf);
        p.surf = surf;
        emit('hud');
      }
      // предметы задания и находки
      for (const it of sc.taskItems())
        if (!it.got && sc.itemHere(it) && dist(p.x, p.y, (it.x + 0.5) * T, (it.y + 0.5) * T) < 34) {
          collectMailItem(it);
          sfx('coin');
          emit('collect');
        }
      for (const pk of sc.pickups) if (dist(p.x, p.y, pk.x, pk.y) < 34 && sc.pickupThere(pk)) pickUp(pk);
      updateResidents(sc, dt);
      // камера
      layout();
      sc.cam.follow(p.x, p.y - 20, dt, 6);
      if (desc.sky !== false) updateWeather(sc, dt);
      sc.call('update', sc, dt);
      for (const q of sc.drops) q.t += dt;
      sc.drops = sc.drops.filter((q) => q.t < 0.9);
      // выход: наступили на его клетку
      const ex = exitAt();
      if (ex !== p.exit) {
        p.exit = ex;
        if (ex) leaveBy(ex);
      }
    },
    draw(ctx) {
      layout(); // масштаб — по текущему размеру экрана, даже если мир на паузе под окном
      drawFrame(ctx, sc);
    },
    hud() {
      const buttons = [];
      for (const part of parts) if (part.buttons) buttons.push(...part.buttons(sc));
      return { buttons };
    },
    sound: () =>
      desc.sound ? desc.sound(sc) : { day: 'town', rain: desc.sky !== false ? 1 : 0, birds: true, crickets: true },

    // ---------- мини-карта (features/map.js) ----------
    drawMiniMapBase(ctx, k) {
      ensure();
      drawMiniMapBase(ctx, sc, k);
    },
    drawMiniMapPlayer: (ctx, k) => drawMiniMapPlayer(ctx, sc, k),
    /** Какое здание под точкой карты (в клетках); null — если рядом ничего нет. */
    mapHit(tx, ty) {
      let best = null,
        bd = 3.2;
      for (const b of ensure().buildings) {
        const dx = Math.max(b.x - tx, 0, tx - (b.x + b.w)),
          dy = Math.max(b.y - ty, 0, ty - (b.y + b.h)),
          d = Math.hypot(dx, dy);
        if (d < bd) {
          bd = d;
          best = b;
        }
      }
      return best;
    },
    /** Кнопки «дойти» для окна карты: [[id, подпись], …] — здания с названием, затем точки и места с label. */
    mapPlaces() {
      const out = [];
      for (const b of ensure().buildings)
        if (b.name) out.push([b.id, `${b.icon || BUILDING_KINDS[b.kind].icon || ''} ${b.name}`.trim()]);
      for (const [id, s] of Object.entries(spots)) if (s.label) out.push([id, s.label]);
      for (const pl of places) if (pl.map && pl.map.label) out.push([pl.id, pl.map.label]);
      return out;
    },

    // ---------- для тестов и отладки ----------
    playerPos: () => ({ x: sc.p.x, y: sc.p.y }),
    doorOf: (id) => ensure().doorPx(map.bById[id]),
    debugSprites: () => SP.stats(),
    debugScreen: (wx, wy) => sc.cam.toScreen(wx, wy),
    debugNpc(id) {
      const n = sc.npcs.find((q) => q.id === id);
      return { ...sc.debugScreen(n.x, n.y - 20), tx: Math.floor(n.x / T), ty: Math.floor(n.y / T), hidden: n.hidden };
    },
    debugTeleport(tx, ty) {
      const p = sc.p;
      p.x = (tx + 0.5) * T;
      p.y = (ty + 0.5) * T;
      p.path = [];
      sc.cam.x = p.x;
      sc.cam.y = p.y;
    },
  };
  sc.env = { t: 0, season: '', dark: 0, map: null, hero: sc.p, sc };

  /** Построить карту и жителей — один раз, когда локация впервые понадобилась. */
  function ensure() {
    if (map) return map;
    map = createMap(desc);
    sc.env.map = map;
    sc.cam.setBounds(0, 0, map.w * T, map.h * T);
    sc.setPickups(desc.pickups);
    sc.built = true;
    const st = entryPx(startName);
    if (!st) throw new Error(`Локация «${desc.id}»: нет точки входа (entries, start)`);
    sc.p.x = st.x;
    sc.p.y = st.y;
    sc.call('built', sc);
    sc.npcs = makeResidents(map);
    return map;
  }
  function layout() {
    const { w, h } = G.view;
    let z = clamp(Math.min(w, h) / (T * 9.4), 0.8, 1.4);
    // На большом экране не показываем всё больше клеток (каждая — работа в каждом кадре), а приближаем:
    // не больше 14 клеток по короткой стороне и 26 по длинной.
    z = Math.max(z, Math.min(w, h) / (T * 14), Math.max(w, h) / (T * 26));
    sc.cam.setTileZoom(z, T); // клетка — целое чётное число пикселей устройства: спрайты из кэша ложатся 1:1
  }
  /** Идти к особому месту: на его stand, а если его нет — к клетке рядом с нажатой. */
  function toPlace(pl, tx, ty) {
    const p = sc.p;
    if (pl.stand) {
      if (sc.walkTo(pl.stand[0] * T, pl.stand[1] * T, true)) p.pending = { place: pl };
    } else sc.goNear((tx + 0.5) * T, (ty + 0.5) * T, { place: pl });
  }
  /** Дошли: выполнить то, за чем шли. */
  function arrive() {
    const p = sc.p,
      pd = p.pending;
    p.pending = null;
    if (!pd) return;
    if (pd.npc) {
      p.dir = pd.npc.x >= p.x ? 1 : -1;
      pd.npc.dir = -p.dir;
      pd.npc.path = [];
      pd.npc.wait = 4;
      run(pd.npc.act, { scene: sc, actor: pd.npc });
      return;
    }
    if (pd.b) {
      sfx('door');
      sc.enterBuilding(pd.b);
      return;
    }
    if (pd.place) {
      if (pd.place.act) run(pd.place.act, { scene: sc, place: pd.place });
      else if (pd.place.use) pd.place.use(sc, pd.place);
    } else if (pd.obj) OBJECTS[pd.obj.type].use(sc, pd.obj);
    else if (pd.fn) pd.fn(sc);
  }
  /** Подобрать находку. */
  function pickUp(pk) {
    if (pk.once) setFlag('find:' + pk.key);
    else setDayFlag(pk.key, 1, 'finds');
    if (pk.give) addItem(pk.give[0], pk.give[1], pk.give[2] || 1);
    sfx('coin');
    if (pk.text !== '') toast(pk.text || `Находка: ${pk.icon}`, 'good');
    emit('find', { loc: sc.name, id: pk.id });
    if (pk.act) run(pk.act, { scene: sc, pickup: pk });
  }
  /** Открытый выход, на клетке которого стоит герой, или null. */
  function exitAt() {
    const tx = tileOf(sc.p.x),
      ty = tileOf(sc.p.y);
    for (const e of exits)
      if (!e.off && (!e.when || e.when()) && tx >= e.area[0] && tx <= e.area[2] && ty >= e.area[1] && ty <= e.area[3])
        return e;
    return null;
  }
  function leaveBy(e) {
    sc.p.path = [];
    sc.p.pending = null;
    if (e.act) run(e.act, { scene: sc, exit: e, back: sc.savePos() });
    else go(e.to, { at: e.entry });
  }

  locations[sc.name] = sc;
  return sc;
}
