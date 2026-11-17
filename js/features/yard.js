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
// Поставить можно на свободную клетку двора (canPlace): нужный вид земли, не дорожка, не у двери и не там, где
// встают у почтового ящика и других мест, не под хомячка и не на предмет задания.
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
  (S().yard.store[id] || 0) + Object.values(S().yard.at).reduce((n, list) => n + list.filter((i) => i.id === id).length, 0);

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
/** Двор этой локации, в котором стоит точка (клетка), — только свой (вилла или купленное жильё). */
function yardAt(sc, tx, ty) {
  for (const y of YARDS)
    if (y.loc === sc.name && owns(y) && tx >= y.area[0] && tx <= y.area[2] && ty >= y.area[1] && ty <= y.area[3]) return y;
  return null;
}
/**
 * Можно ли поставить предмет на клетку двора. skip — предмет карты, который сейчас переставляют; soft — проверить
 * только саму карту (вид земли, занято ли): так сверяют сохранение, где бы ни стояла хомячок.
 */
function canPlace(sc, y, tx, ty, skip = null, soft = false) {
  const m = sc.map;
  if (tx < y.area[0] || tx > y.area[2] || ty < y.area[1] || ty > y.area[3]) return false;
  if (!y.tiles.includes(m.at(tx, ty))) return false;
  if (m.objs.some((o) => o !== skip && o.tx === tx && o.ty === ty)) return false; // занято (и цветами, и лежаком)
  if (m.solid[ty][tx] && !(skip && skip.tx === tx && skip.ty === ty)) return false;
  if (soft) return true;
  if (tileOf(sc.p.x) === tx && tileOf(sc.p.y) === ty) return false;
  // у дверей и там, где встают у особых мест (почтовый ящик, грядки), — свободно
  for (const b of m.buildings) {
    const d = m.doorPx(b);
    if (ty === tileOf(d.y) && Math.abs(tx - tileOf(d.x)) <= 1) return false;
  }
  for (const pl of sc.places) if (pl.stand && Math.floor(pl.stand[0]) === tx && Math.floor(pl.stand[1]) === ty) return false;
  for (const it of sc.taskItems()) if (!it.got && it.x === tx && it.y === ty) return false;
  for (const pk of sc.pickups) if (pk.tx === tx && pk.ty === ty) return false;
  return true;
}
/** Поставить на карту предмет двора по записи сохранения. */
function addToMap(sc, y, it) {
  const def = YARD_BY_ID[it.id];
  return sc.map.add(def.kind, it.x, it.y, { ...(def.o || {}), yard: y.id, it });
}
/** Предмет карты, который стоит по записи сохранения it (ищем по клетке: на клетке двора — один предмет). */
const objOf = (sc, it) => sc.map.objs.find((o) => o.yard && o.tx === it.x && o.ty === it.y) || null;
/** Сверить карту локации с сохранением: свои предметы убрать и поставить заново. */
function sync(sc) {
  if (!sc || !sc.built || !YARDS.some((y) => y.loc === sc.name)) return;
  const m = sc.map;
  for (const o of m.objs.filter((q) => q.yard)) m.remove(o);
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
export const yardMode = () => !!cur;

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
      const d = Math.hypot(tx - cx, ty - cy) + (Math.abs(tx - tileOf(sc.p.x)) + Math.abs(ty - tileOf(sc.p.y)) < 2 ? 3 : 0);
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
  /** В режиме: свободные клетки двора — точками, под выбранным предметом — кружок. */
  ground(ctx, sc) {
    const c = cur;
    if (!c || c.sc !== sc) return;
    const v = sc.cam.visible ? sc.cam.visible(T) : null,
      [ax0, ay0, ax1, ay1] = c.y.area;
    const x0 = v ? Math.max(ax0, tileOf(v.x0)) : ax0,
      x1 = v ? Math.min(ax1, tileOf(v.x1)) : ax1,
      y0 = v ? Math.max(ay0, tileOf(v.y0)) : ay0,
      y1 = v ? Math.min(ay1, tileOf(v.y1)) : ay1;
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    ctx.strokeStyle = 'rgba(74,55,40,.28)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let ty = y0; ty <= y1; ty++)
      for (let tx = x0; tx <= x1; tx++)
        if (canPlace(sc, c.y, tx, ty)) {
          const px = (tx + 0.5) * T,
            py = (ty + 0.5) * T;
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
});
export const yardCanPlace = (yardId, tx, ty) => {
  const y = YARDS.find((q) => q.id === yardId);
  return !!y && canPlace(getLocation(y.loc), y, tx, ty);
};
