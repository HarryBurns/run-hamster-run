// Двор у дома (этап 17б): режим «Обустроить двор» — клумбы, кустики, фонарики, скамейка, качели, бассейн-лягушатник…
//
// Дворы — таблица YARDS (data/buddy.js): двор виллы и дворик пляжного бунгало. Купленное (вкладка «Для двора»
// в ТЦ «Уютный дом»: renderYardShop — её зовёт features/shops.js) лежит в «садовом сарайчике» state.yard.store,
// поставленное — в state.yard.at[двор] = [{ id, x, y }] (клетки локации).
//
// Как устроено. Предметы двора — обычные предметы карты «вид сверху» (YARD_ITEMS: вид из реестра + его поля), поэтому
// фонарик ночью светит, клумба цветёт по сезону, а на скамейку и качели можно сесть (этап 17а) — без единой строчки
// здесь. Занятие только сверяет карту с сохранением (sync): при входе в локацию и по событию yard убирает свои
// предметы (map.remove) и ставит заново (map.add с пометкой yard). Режим «Обустроить двор» — sc.mode: палец идёт
// сюда, хомячок стоит, камера идёт за точкой focus (двор листают пальцем), внизу — панель, как в доме.
// «Дикие» цветы на траве (В6) клетку не занимают: предмет встаёт прямо на них — цветы прячутся под него (hideWild),
// а когда предмет унесли или переставили, вырастают снова (sync: сначала вернуть спрятанные, потом поставить предметы).
// Поставить можно на свободную клетку двора (canPlace): нужный вид земли, не дорожка, не у двери и не там, где
// встают у почтового ящика и других мест, не под хомячка и не на предмет задания — и так, чтобы не перекрыть проход:
// от двери дома, мест двора и хомячка можно дойти до выхода со двора (keepsWay).
import { G } from '../core/state.js';
import { addYardItem, placeYard, moveYard, stashYard, award } from '../core/actions.js';
import { on, emit } from '../core/events.js';
import { scene } from '../core/loop.js';
import { sfx } from '../core/audio.js';
import { cachedIcon } from '../core/sprites.js';
import { clamp, el } from '../core/util.js';
import { YARD_ITEMS, YARD_BY_ID, YARDS } from '../data/index.js';
import { T, ART, tileOf, addWorldPart, getLocation } from '../engine/topdown/index.js';
import { toast } from '../ui/toast.js';
import { buy, priceTag, buyBtn } from './purchase.js';

const S = () => G.state;
const owns = (y) => y.home === 'villa' || S().homesOwned.includes(y.home);
const itemsOf = (y) => S().yard.at[y.id] || [];
/** Сколько таких предметов у хозяйки всего: в сарайчике и во дворах. */
const ownedCount = (id) =>
  (S().yard.store[id] || 0) +
  Object.values(S().yard.at).reduce((n, list) => n + list.filter((i) => i.id === id).length, 0);

/** Значок предмета двора — его же рисунок из реестра (ART), вписанный в квадрат. */
export function yardIcon(def, size = 84) {
  return cachedIcon('yard:' + def.id, size, size, (ctx) => {
    const art = ART[def.art[0]];
    if (!art) return;
    const [x0, y0, x1, y1] = art[0],
      k = Math.min((size - 10) / (x1 - x0), (size - 10) / (y1 - y0));
    ctx.save();
    ctx.translate(size / 2 - ((x0 + x1) / 2) * k, size / 2 - ((y0 + y1) / 2) * k);
    ctx.scale(k, k);
    ctx.lineJoin = 'round';
    art[1](ctx, def.art[1], def.art[2]);
    ctx.restore();
  });
}

// ---------- карта ↔ сохранение ----------
/** «Дикие» цветы двора (зелень карты, не предмет двора): на них можно ставить. */
const wildFlower = (o) => o.type === 'flowers' && !o.yard;
/** Цветы, спрятанные под предметами двора: локация → [{ tx, ty, v }]. */
const hiddenWild = new Map();
/** Двор этой локации, в котором стоит точка (клетка), — только свой (вилла или купленное жильё). */
function yardAt(sc, tx, ty) {
  for (const y of YARDS)
    if (y.loc === sc.name && owns(y) && tx >= y.area[0] && tx <= y.area[2] && ty >= y.area[1] && ty <= y.area[3])
      return y;
  return null;
}
/**
 * Можно ли поставить предмет на клетку двора. skip — предмет карты, который сейчас переставляют; soft — проверить
 * только саму карту (вид земли, занято ли): так сверяют сохранение, где бы ни стояла хомячок.
 */
function canPlace(sc, y, tx, ty, skip = null, soft = false) {
  const m = sc.map;
  wayBlocked = false;
  if (tx < y.area[0] || tx > y.area[2] || ty < y.area[1] || ty > y.area[3]) return false;
  if (!y.tiles.includes(m.at(tx, ty))) return false;
  // занято (клумбой, лежаком…); «дикие» цветы не мешают — спрячутся под предмет
  if (m.objs.some((o) => o !== skip && o.tx === tx && o.ty === ty && !wildFlower(o))) return false;
  if (m.solid[ty][tx] && !(skip && skip.tx === tx && skip.ty === ty)) return false;
  if (soft) return true;
  if (tileOf(sc.p.x) === tx && tileOf(sc.p.y) === ty) return false;
  // у дверей и там, где встают у особых мест (почтовый ящик, грядки), — свободно
  for (const b of m.buildings) {
    const d = m.doorPx(b);
    if (ty === tileOf(d.y) && Math.abs(tx - tileOf(d.x)) <= 1) return false;
  }
  for (const pl of sc.places)
    if (pl.stand && Math.floor(pl.stand[0]) === tx && Math.floor(pl.stand[1]) === ty) return false;
  for (const it of sc.taskItems()) if (!it.got && it.x === tx && it.y === ty) return false;
  for (const pk of sc.pickups) if (pk.tx === tx && pk.ty === ty) return false;
  return keepsWay(sc, y, tx, ty, skip);
}

// ---------- проход через двор ----------
// Твёрдый предмет (а во дворе твёрдые все) не должен запирать ни хомячка, ни дверь дома, ни места (почтовый ящик…):
// всё, до чего со двора можно было дойти «снаружи», должно остаться достижимым. «Снаружи» — клетки в одну клетку
// вокруг двора: оттуда открыт весь город (sealPockets). Ответы по клеткам запоминаются, пока двор и хомячок те же:
// точки свободных клеток рисуются каждый кадр.
let wayVer = 0, // растёт при каждой сверке карты с сохранением (sync)
  wayBase = null; // что достижимо без нового предмета
const wayMemo = new Map();
/** Отказ последнего canPlace — из-за прохода (для подсказки при перетаскивании). */
let wayBlocked = false;
/** Клетки, до которых нельзя перестать доходить: двери и места во дворе, хомячок (если во дворе). */
function wayTargets(sc, y) {
  const m = sc.map,
    [ax0, ay0, ax1, ay1] = y.area,
    inArea = (x, yy) => x >= ax0 && x <= ax1 && yy >= ay0 && yy <= ay1,
    out = [];
  for (const b of m.buildings) {
    const d = m.doorPx(b);
    if (inArea(tileOf(d.x), tileOf(d.y))) out.push([tileOf(d.x), tileOf(d.y)]);
  }
  for (const pl of sc.places)
    if (pl.stand && inArea(Math.floor(pl.stand[0]), Math.floor(pl.stand[1])))
      out.push([Math.floor(pl.stand[0]), Math.floor(pl.stand[1])]);
  if (inArea(tileOf(sc.p.x), tileOf(sc.p.y))) out.push([tileOf(sc.p.x), tileOf(sc.p.y)]);
  return out;
}
/** Обход от клеток вокруг двора внутрь (рамка — двор и одна клетка вокруг): Uint8Array по рамке. */
function wayReach(m, box) {
  const [x0, y0, x1, y1] = box,
    bw = x1 - x0 + 1,
    seen = new Uint8Array(bw * (y1 - y0 + 1)),
    q = [];
  for (let yy = y0; yy <= y1; yy++)
    for (let x = x0; x <= x1; x++)
      if ((x === x0 || x === x1 || yy === y0 || yy === y1) && m.foot(x, yy)) {
        seen[(yy - y0) * bw + x - x0] = 1;
        q.push(x, yy);
      }
  for (let i = 0; i < q.length; i += 2) {
    const x = q[i],
      yy = q[i + 1];
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + dx,
        ny = yy + dy;
      if (nx < x0 || nx > x1 || ny < y0 || ny > y1) continue;
      const k = (ny - y0) * bw + nx - x0;
      if (seen[k] || !m.foot(nx, ny)) continue;
      seen[k] = 1;
      q.push(nx, ny);
    }
  }
  return (x, yy) => seen[(yy - y0) * bw + x - x0] === 1;
}
/** 8 соседей клетки по кругу: С, СВ, В, ЮВ, Ю, ЮЗ, З, СЗ (чётные — по сторонам). */
const RING = [
  [0, -1],
  [1, -1],
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
];
/**
 * Занять клетку точно безопасно, если соседи по сторонам, куда можно пройти, связаны между собой в обход неё — через
 * углы её же квадрата 3×3 (открытая лужайка, край двора). Тогда обход не нужен.
 */
function ringSafe(m, tx, ty) {
  const f = RING.map(([dx, dy]) => m.foot(tx + dx, ty + dy));
  if (f.every(Boolean)) return true;
  // идём по кругу от закрытой клетки: каждая цепочка открытых клеток связна; считаем цепочки с соседом по стороне
  const start = f.indexOf(false);
  let runs = 0,
    side = false;
  for (let k = 1; k <= 8; k++) {
    const i = (start + k) % 8;
    if (f[i]) side = side || i % 2 === 0;
    else {
      if (side) runs++;
      side = false;
    }
  }
  return runs <= 1;
}
/** Поставить твёрдый предмет на (tx, ty) (skip — переставляемый, его клетка свободна) и не перекрыть проход. */
const wayAt = { sc: null, y: null, ver: -1, n: -1, px: -1, py: -1, skip: null };
function keepsWay(sc, y, tx, ty, skip) {
  const m = sc.map,
    k = wayAt,
    px = tileOf(sc.p.x),
    py = tileOf(sc.p.y);
  if (
    k.sc !== sc ||
    k.y !== y ||
    k.ver !== wayVer ||
    k.n !== m.objs.length ||
    k.px !== px ||
    k.py !== py ||
    k.skip !== skip
  ) {
    Object.assign(k, { sc, y, ver: wayVer, n: m.objs.length, px, py, skip });
    wayMemo.clear();
    wayBase = null;
  }
  const mk = ty * 4096 + tx;
  let ok = wayMemo.get(mk);
  if (ok === undefined) {
    const box = [
        Math.max(0, y.area[0] - 1),
        Math.max(0, y.area[1] - 1),
        Math.min(m.w - 1, y.area[2] + 1),
        Math.min(m.h - 1, y.area[3] + 1),
      ],
      solid = m.solid,
      skipWas = skip ? solid[skip.ty][skip.tx] : false;
    if (skip) solid[skip.ty][skip.tx] = false;
    if (ringSafe(m, tx, ty)) ok = true;
    else {
      if (!wayBase) {
        const r = wayReach(m, box);
        wayBase = wayTargets(sc, y).filter(([x, yy]) => r(x, yy));
      }
      const was = solid[ty][tx];
      solid[ty][tx] = true;
      const r = wayReach(m, box);
      solid[ty][tx] = was;
      ok = wayBase.every(([x, yy]) => r(x, yy));
    }
    if (skip) solid[skip.ty][skip.tx] = skipWas;
    wayMemo.set(mk, ok);
  }
  wayBlocked = !ok;
  return ok;
}
/**
 * Свободные клетки двора для точек в режиме (Т: canPlace каждый кадр по всем клеткам перебирал все предметы города —
 * ~2–4 мс за кадр). Список считается заново, только когда что-то поменялось: сверка карты с сохранением (wayVer —
 * поставили, переставили, убрали), число предметов карты, клетка хомячка, предметы задания и находки на земле.
 */
const freeMemo = { key: '', cells: [], wild: [] };
function freeCells(sc, y) {
  const m = sc.map;
  let left = 0;
  for (const it of sc.taskItems()) if (!it.got) left++;
  const key = `${sc.name}|${y.id}|${wayVer}|${m.objs.length}|${tileOf(sc.p.x)},${tileOf(sc.p.y)}|${left}|${sc.pickups.length}`;
  if (key !== freeMemo.key) {
    const [ax0, ay0, ax1, ay1] = y.area,
      cells = [];
    for (let ty = ay0; ty <= ay1; ty++)
      for (let tx = ax0; tx <= ax1; tx++) if (canPlace(sc, y, tx, ty)) cells.push(tx, ty);
    freeMemo.key = key;
    freeMemo.cells = cells;
    // свободные клетки с «дикими» цветами: их точки рисуются поверх цветов (things), иначе цветы их закрывают
    const wild = new Set(m.objs.filter(wildFlower).map((o) => o.ty * 4096 + o.tx));
    freeMemo.wild = [];
    for (let i = 0; i < cells.length; i += 2)
      if (wild.has(cells[i + 1] * 4096 + cells[i])) freeMemo.wild.push(cells[i], cells[i + 1]);
    wayBlocked = false; // перебор клеток — не попытка поставить: подсказка «будет не пройти» не о нём
  }
  return freeMemo.cells;
}
/** Поставить на карту предмет двора по записи сохранения; «дикие» цветы на его клетке прячутся под него. */
function addToMap(sc, y, it) {
  const def = YARD_BY_ID[it.id],
    m = sc.map;
  for (const o of m.objs.filter((q) => q.tx === it.x && q.ty === it.y && wildFlower(q))) {
    m.remove(o);
    hiddenWild.get(sc.name).push({ tx: o.tx, ty: o.ty, v: o.v });
  }
  return m.add(def.kind, it.x, it.y, { ...(def.o || {}), yard: y.id, it });
}
/** Вернуть цветы, спрятанные под предметами двора, — там, где клетка снова свободна. */
function regrowWild(sc) {
  const m = sc.map,
    list = hiddenWild.get(sc.name) || [];
  for (const h of list)
    // клетку могли перекопать (пруд, бассейн, грядка — «Вилла растёт»): цветы растут только на свободной траве
    if (m.at(h.tx, h.ty) === 'g' && !m.solid[h.ty][h.tx] && !m.objs.some((o) => o.tx === h.tx && o.ty === h.ty))
      m.add('flowers', h.tx, h.ty, { v: h.v });
  hiddenWild.set(sc.name, []);
}
/** Предмет карты, который стоит по записи сохранения it (ищем по клетке: на клетке двора — один предмет). */
const objOf = (sc, it) => sc.map.objs.find((o) => o.yard && o.tx === it.x && o.ty === it.y) || null;
/** Сверить карту локации с сохранением: свои предметы убрать и поставить заново. */
function sync(sc) {
  if (!sc || !sc.built || !YARDS.some((y) => y.loc === sc.name)) return;
  const m = sc.map;
  wayVer++;
  for (const o of m.objs.filter((q) => q.yard)) m.remove(o);
  regrowWild(sc);
  for (const y of YARDS) {
    if (y.loc !== sc.name || !owns(y)) continue;
    for (const it of [...itemsOf(y)]) {
      // место занято (карту города перерисовали) — предмет возвращается в сарайчик
      if (canPlace(sc, y, it.x, it.y, null, true)) addToMap(sc, y, it);
      else stashYard(y.id, it);
    }
  }
}

// ---------- режим «Обустроить двор» ----------
/** Сейчас обустраиваем: { sc, y, mode, tray, sel (предмет карты), drag, pan } или null. */
let cur = null;

function focusClamp(c) {
  const [x0, y0, x1, y1] = c.y.area,
    f = c.mode.focus;
  f.x = clamp(f.x, x0 * T, (x1 + 1) * T);
  f.y = clamp(f.y, y0 * T, (y1 + 1) * T);
}
/** Войти в режим (хомячок стоит во дворе y) или выйти из него. */
export function setYardMode(sc, y) {
  if (cur) {
    const c = cur;
    cur = null;
    if (c.tray) c.tray.remove();
    if (c.sc.mode === c.mode) c.sc.mode = null;
    emit('hud');
  }
  if (!sc || !y) return;
  const p = sc.p;
  p.path = [];
  p.pending = null;
  if (p.ride && p.ride.relax && p.ride.drop) p.ride.drop(sc); // сидела на скамейке — встала
  const mode = {
    cls: 'decor',
    focus: { x: p.x, y: p.y },
    down: (s, sx, sy) => down(sx, sy),
    move: (s, sx, sy) => move(sx, sy),
    up: () => up(),
    end: () => setYardMode(null),
  };
  sc.mode = mode;
  cur = { sc, y, mode, tray: null, sel: null, drag: null, pan: null };
  buildTray();
  emit('hud');
}

function buildTray() {
  const c = cur;
  if (!c) return;
  if (c.tray) c.tray.remove();
  const t = el('div', 'decor-tray yard-tray'),
    head = el('div', 'tray-head'),
    def = c.sel ? YARD_BY_ID[c.sel.it.id] : null;
  head.appendChild(el('span', '', def ? `<b>${def.name}</b>` : 'Перетаскивай предметы по двору. Садовый сарайчик:'));
  if (c.sel) {
    const b = el('button', 'btn small blue', '📦 Убрать');
    b.onclick = () => {
      sfx('tap');
      stashYard(c.y.id, c.sel.it);
      c.sel = null;
      buildTray();
    };
    head.appendChild(b);
  }
  const done = el('button', 'btn small green', '✔ Готово');
  done.onclick = () => {
    sfx('tap');
    setYardMode(null);
  };
  head.appendChild(done);
  t.appendChild(head);
  const list = el('div', 'tray-list'),
    store = S().yard.store,
    ids = Object.keys(store);
  if (!ids.length) list.appendChild(el('div', 'muted', 'Сарайчик пуст. Всё для двора продаётся в ТЦ «Уютный дом».'));
  for (const id of ids) {
    const d = YARD_BY_ID[id];
    if (!d) continue;
    const b = el('button', 'tray-item yard-' + id);
    b.title = d.name;
    b.appendChild(yardIcon(d, 58));
    if (store[id] > 1) b.appendChild(el('span', 'cnt', '×' + store[id]));
    b.onclick = () => {
      sfx('pop');
      fromStore(id);
    };
    list.appendChild(b);
  }
  t.appendChild(list);
  document.body.appendChild(t);
  c.tray = t;
}

/** Достать предмет из сарайчика: встаёт на свободную клетку поближе к середине экрана. */
function fromStore(id) {
  const c = cur,
    sc = c.sc,
    y = c.y;
  if (itemsOf(y).length >= y.max) {
    toast('Во дворе уже тесно! Убери что-нибудь в сарайчик — и место появится.');
    return;
  }
  const cx = tileOf(c.mode.focus.x),
    cy = tileOf(c.mode.focus.y);
  let best = null,
    bd = 1e9;
  for (let ty = y.area[1]; ty <= y.area[3]; ty++)
    for (let tx = y.area[0]; tx <= y.area[2]; tx++) {
      const d =
        Math.hypot(tx - cx, ty - cy) + (Math.abs(tx - tileOf(sc.p.x)) + Math.abs(ty - tileOf(sc.p.y)) < 2 ? 3 : 0);
      if (d < bd && canPlace(sc, y, tx, ty)) {
        bd = d;
        best = [tx, ty];
      }
    }
  if (!best) {
    toast('Здесь нет свободного местечка. Попробуй убрать что-нибудь.');
    return;
  }
  const it = placeYard(y.id, id, best[0], best[1]);
  if (!it) return;
  c.sel = objOf(sc, it);
  award('x_yard', { delay: 500 });
  buildTray();
}

/** Предмет двора под точкой мира (ближний — первым). */
function hit(c, w) {
  let best = null;
  for (const o of c.sc.map.objs) {
    if (o.yard !== c.y.id) continue;
    if (Math.abs(w.x - o.x) < 26 && w.y > o.y - 52 && w.y < o.y + 24 && (!best || o.y > best.y)) best = o;
  }
  return best;
}
function down(sx, sy) {
  const c = cur,
    w = c.sc.cam.toWorld(sx, sy),
    o = hit(c, w);
  if (o) {
    c.drag = { o, dx: w.x - o.x, dy: w.y - o.y, moved: false };
    if (c.sel !== o) {
      c.sel = o;
      buildTray();
    }
  } else {
    c.pan = { sx, sy, fx: c.mode.focus.x, fy: c.mode.focus.y, moved: false };
  }
}
function move(sx, sy) {
  const c = cur,
    sc = c.sc;
  if (c.drag) {
    const w = sc.cam.toWorld(sx, sy),
      o = c.drag.o,
      tx = tileOf(w.x - c.drag.dx),
      ty = tileOf(w.y - c.drag.dy);
    if ((tx !== o.tx || ty !== o.ty) && canPlace(sc, c.y, tx, ty, o)) {
      const it = o.it;
      c.drag.moved = true;
      c.keep = true; // не терять выбранный предмет, пока карта сверяется с сохранением
      moveYard(c.y.id, it, tx, ty);
      c.keep = false;
      c.drag.o = c.sel = objOf(sc, it);
    } else if (wayBlocked && !c.drag.told) {
      c.drag.told = true;
      toast('Сюда не поставить: будет не пройти к дому или со двора 🚧');
    }
  } else if (c.pan) {
    const z = sc.cam.zoom || 1;
    if (Math.hypot(sx - c.pan.sx, sy - c.pan.sy) > 8) c.pan.moved = true;
    c.mode.focus.x = c.pan.fx - (sx - c.pan.sx) / z;
    c.mode.focus.y = c.pan.fy - (sy - c.pan.sy) / z;
    focusClamp(c);
  }
}
function up() {
  const c = cur;
  if (c.drag && c.drag.moved) sfx('pop');
  else if (c.pan && !c.pan.moved && c.sel) {
    c.sel = null; // нажали мимо — выбор снят
    buildTray();
  }
  c.drag = null;
  c.pan = null;
}

on('yard', ({ what }) => {
  // купили — карта не меняется; остальное — сверить карту локации двора
  if (what !== 'buy') for (const y of YARDS) sync(getLocation(y.loc));
  if (cur) {
    const it = cur.sel && cur.sel.it;
    cur.sel = it ? objOf(cur.sc, it) : null;
    if (!cur.keep) buildTray();
  }
});
on('estate', () => {
  for (const y of YARDS) sync(getLocation(y.loc)); // купили бунгало — у него появился дворик
});
on('scene', () => {
  if (cur && scene() !== cur.sc) setYardMode(null);
});

/** Точка свободной клетки (как в ground) — поверх «диких» цветов. */
function freeDot(ctx, [px, py]) {
  ctx.fillStyle = 'rgba(255,255,255,.85)';
  ctx.strokeStyle = 'rgba(74,55,40,.28)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(px, py, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

// ---------- общая часть локаций: кнопка, подсветка клеток ----------
let inYard = null;
addWorldPart({
  enter(sc) {
    inYard = null;
    sync(sc);
  },
  update(sc) {
    if (!YARDS.some((y) => y.loc === sc.name)) return;
    const y = yardAt(sc, tileOf(sc.p.x), tileOf(sc.p.y));
    if (y !== inYard) {
      inYard = y;
      emit('hud');
    }
  },
  buttons(sc) {
    if (cur || !inYard || sc.mode || (sc.p.ride && !sc.p.ride.relax && !sc.p.ride.wheels)) return [];
    const y = inYard;
    return [{ id: 'yard', icon: '🌷', label: 'Мой двор', on: false, fn: () => setYardMode(sc, y) }];
  },
  /** Точки свободных клеток с «дикими» цветами — над цветами (плоское рисуется поверх земли), но под всем, что стоит. */
  things(sc, add, v) {
    const c = cur;
    if (!c || c.sc !== sc) return;
    freeCells(sc, c.y);
    const w = freeMemo.wild;
    for (let i = 0; i < w.length; i += 2) {
      const px = (w[i] + 0.5) * T,
        py = (w[i + 1] + 0.5) * T;
      if (px > v.x0 - T && px < v.x1 + T && py > v.y0 - T && py < v.y1 + T) add(py - 39, freeDot, [px, py]);
    }
  },
  /** В режиме: свободные клетки двора — точками, под выбранным предметом — кружок. */
  ground(ctx, sc) {
    const c = cur;
    if (!c || c.sc !== sc) return;
    const v = sc.cam.visible ? sc.cam.visible(T) : null,
      cells = freeCells(sc, c.y);
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    ctx.strokeStyle = 'rgba(74,55,40,.28)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < cells.length; i += 2) {
      const px = (cells[i] + 0.5) * T,
        py = (cells[i + 1] + 0.5) * T;
      if (v && (px < v.x0 || px > v.x1 || py < v.y0 || py > v.y1)) continue;
      ctx.moveTo(px + 4.5, py);
      ctx.arc(px, py, 4.5, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.stroke();
    if (c.sel) {
      const o = c.sel,
        pulse = 1 + Math.sin(G.time * 5) * 0.06;
      ctx.strokeStyle = 'rgba(255,255,255,.95)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.ellipse(o.x, o.y + 8, 25 * pulse, 13 * pulse, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = '#ff6b9d';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  },
});

// ---------- магазин: вкладка «Для двора» в ТЦ «Уютный дом» ----------
export function renderYardShop(body, panel) {
  const yards = YARDS.filter(owns)
    .map((y) => y.name)
    .join(' и ');
  body.appendChild(
    el(
      'p',
      'muted',
      `Всё, чтобы украсить ${yards}. Покупки ложатся в садовый сарайчик: встань во дворе и нажми «🌷 Мой двор».`,
    ),
  );
  const grid = el('div', 'grid');
  for (const d of YARD_ITEMS) {
    const card = el('div', 'card yard-' + d.id),
      n = ownedCount(d.id);
    card.appendChild(yardIcon(d, 112));
    card.appendChild(el('div', 'nm', d.name));
    card.appendChild(priceTag(d.price));
    if (n) card.appendChild(el('span', 'cnt', '×' + n));
    card.appendChild(
      buyBtn('Купить', d.price, () => {
        if (!buy(d.price)) return;
        addYardItem(d.id, 1);
        emit('buy', { cat: 'yard', id: d.id });
        toast(`${d.name} — в садовом сарайчике. Во дворе нажми «🌷 Мой двор»!`, 'good');
        panel.refresh();
      }),
    );
    grid.appendChild(card);
  }
  body.appendChild(grid);
}

/** Для тестов: что в сарайчике, что стоит, режим, свободна ли клетка. */
export const yardDebug = () => ({
  mode: cur ? cur.y.id : '',
  sel: cur && cur.sel ? { id: cur.sel.it.id, tx: cur.sel.tx, ty: cur.sel.ty } : null,
  inYard: inYard ? inYard.id : '',
  focus: cur ? { ...cur.mode.focus } : null,
  // точки свободных клеток в режиме: сколько и совпадает ли запомненный список с честным перебором canPlace
  free: cur ? freeMemo.cells.length / 2 : 0,
  freeFresh: cur ? freeFresh(cur.sc, cur.y) : true,
});
function freeFresh(sc, y) {
  const got = freeCells(sc, y).join(),
    [ax0, ay0, ax1, ay1] = y.area,
    all = [];
  for (let ty = ay0; ty <= ay1; ty++) for (let tx = ax0; tx <= ax1; tx++) if (canPlace(sc, y, tx, ty)) all.push(tx, ty);
  return got === all.join();
}
export const yardCanPlace = (yardId, tx, ty) => {
  const y = YARDS.find((q) => q.id === yardId);
  return !!y && canPlace(getLocation(y.loc), y, tx, ty);
};
