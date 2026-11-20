// «Движок домов», часть 5: режим «Обустроить» — перетаскивание мебели и кладовка.
// Работает в любом доме, у которого мебель своя (в описании furniture: { key, editable }): мебель лежит
// в сохранении под ключом дома, кладовка — общая на все дома (state.storage).
import { G } from '../../core/state.js';
import { placeFurn, stashFurn, moveFurn, touchState, countFurnAct } from '../../core/actions.js';
import { emit } from '../../core/events.js';
import { clamp, el } from '../../core/util.js';
import { sfx } from '../../core/audio.js';
import { FURN_BY_ID } from '../../data/index.js';
import { furnIcon } from '../../ui/icons.js';
import { furnRect } from '../../art/furniture.js';
import { toast } from '../../ui/toast.js';
import { hitItem } from './items.js';

/** Включить или выключить режим обустройства. */
export function setDecor(sc, on) {
  const dc = sc.decor;
  dc.on = on && sc.editable;
  dc.sel = null;
  dc.drag = null;
  if (dc.tray) {
    dc.tray.remove();
    dc.tray = null;
  }
  if (dc.on) {
    sc.p.path = [];
    sc.standUp();
    buildTray(sc);
  }
  emit('hud');
}

/** Панель внизу экрана: выбранный предмет, кнопки и кладовка. */
function buildTray(sc) {
  const dc = sc.decor;
  if (dc.tray) dc.tray.remove();
  const t = el('div', 'decor-tray');
  const s = G.state;
  const head = el('div', 'tray-head');
  const def = dc.sel ? FURN_BY_ID[dc.sel.id] : null;
  head.appendChild(el('span', '', def ? `<b>${def.name}</b>` : 'Перетаскивай мебель пальцем. Кладовка:'));
  if (dc.sel) {
    const b = el('button', 'btn small blue', '📦 Убрать в кладовку');
    b.onclick = () => {
      sfx('tap');
      stash(sc, dc.sel);
    };
    head.appendChild(b);
  }
  const done = el('button', 'btn small green', '✔ Готово');
  done.onclick = () => {
    sfx('tap');
    setDecor(sc, false);
  };
  head.appendChild(done);
  t.appendChild(head);
  const list = el('div', 'tray-list');
  const ids = Object.keys(s.storage);
  if (!ids.length) list.appendChild(el('div', 'muted', 'Кладовка пуста. Мебель продаётся в ТЦ «Уютный дом».'));
  for (const id of ids) {
    const d = FURN_BY_ID[id];
    if (!d) continue;
    const c = el('button', 'tray-item');
    c.appendChild(furnIcon(d, 58));
    if (s.storage[id] > 1) c.appendChild(el('span', 'cnt', '×' + s.storage[id]));
    c.onclick = () => {
      sfx('pop');
      placeFromStorage(sc, id);
    };
    list.appendChild(c);
  }
  t.appendChild(list);
  document.body.appendChild(t);
  dc.tray = t;
}

/** Достать предмет из кладовки: он появляется посередине экрана. */
function placeFromStorage(sc, id) {
  const d = FURN_BY_ID[id],
    { W } = sc.geo;
  const c = sc.cam.toWorld(G.view.w / 2, G.view.h / 2);
  const f = sc.geo.floorAt(c.y, 40);
  const x = clamp(c.x, d.w / 2 + 6, W - d.w / 2 - 6);
  // настенный предмет посередине экрана мог попасть на окно — тогда рядом, на свободной стене (не на окне, не на
  // нарисованных шкафчиках, не на другой картине); и не за пальмой или шкафом: спрятанный за ними, он почти не виден,
  // а палец берёт то, что впереди (раньше часы вставали за пальму). Напольный — тоже не за другой мебелью (З21).
  sc.decor.sel = placeFurn(
    sc.houseKey,
    id,
    f,
    d.wall ? freeWallX(sc, d, x, f, 160, true) : freeFloorX(sc, d, x, f),
    d.wall ? 160 : 0,
  );
  buildTray(sc);
}

// ---------- стена: окна, нарисованное на стене, другое настенное ----------
/** Зазор, с которым игра сама вешает настенное рядом с окном или другим предметом (З16: не вплотную к раме). */
const GAP = 12;
/**
 * Налезает ли настенный предмет d (центр x, высота y над полом этажа floor) на окно дома (gap — с зазором). Рама
 * окна — как её рисует engine/side/rooms.js (windowAt): x ± (половина стекла + 8), от 104 до 208 над полом; стекло —
 * winW комнаты или 88.
 */
export function onWindow(sc, d, x, floor, y, gap = 0) {
  if (!d.wall || y - d.h / 2 >= 208 + gap || y + d.h / 2 <= 104 - gap) return false;
  for (const r of sc.desc.rooms) {
    if (r.f !== floor || !r.win) continue;
    const hw = (r.winW || 88) / 2 + 8 + gap;
    for (const wx of [].concat(r.win)) if (Math.abs(x - wx) < d.w / 2 + hw) return true;
  }
  return false;
}
/**
 * Что мешает повесить настенный предмет d (центр x, высота y над полом этажа floor): 'window' — окно; 'fixture' —
 * нарисованное на стене (шкафчики кухни, зеркало над раковиной: поле wall встроенного предмета, fixtures.js);
 * 'wall' — другое настенное (З16: не перекрывают друг друга); null — ничего. self — сам предмет (его не считаем),
 * gap — с зазором.
 */
export function wallBusy(sc, d, x, floor, y, self = null, gap = 0) {
  if (!d.wall) return null;
  if (onWindow(sc, d, x, floor, y, gap)) return 'window';
  const x0 = x - d.w / 2 - gap,
    x1 = x + d.w / 2 + gap,
    lo = y - d.h / 2 - gap, // высота над полом: низ и верх предмета
    hi = y + d.h / 2 + gap;
  for (const b of sc.fixtures || []) {
    if (b.f !== floor || !b.def.wall) continue;
    for (const [a0, a1, h0, h1] of b.def.wall)
      if (x0 < b.x + a1 && b.x + a0 < x1 && lo < h1 && h0 < hi) return 'fixture';
  }
  for (const it of sc.items()) {
    const q = FURN_BY_ID[it.id];
    if (!q || !q.wall || it.floor !== floor || (self && it.uid === self.uid)) continue;
    if (x0 < it.x + q.w / 2 && it.x - q.w / 2 < x1 && lo < it.y + q.h / 2 && it.y - q.h / 2 < hi) return 'wall';
  }
  return null;
}
/** Что сказать, когда отпущенный предмет вернулся на свободное место (по ответу wallBusy). */
const BUSY_SAY = {
  window: 'На окно не повесить — закроет вид. Повесь рядом, на стену!',
  fixture: 'Тут уже шкафчики — повесь рядом, на свободную стену!',
  wall: 'Здесь уже что-то висит — повесь рядом, на свободную стену!',
};
/**
 * Занят ли пол этажа для напольного предмета d с центром x: другой напольной мебелью (не коврами) или встроенным
 * предметом (дверь, ванна, кухня — поле foot или ширина w). Коврик ложится под всё — ему всегда свободно.
 */
function floorBusy(sc, d, x, floor) {
  if (d.layer === 0) return false;
  const x0 = x - d.w / 2,
    x1 = x + d.w / 2;
  for (const it of sc.items()) {
    const q = FURN_BY_ID[it.id];
    if (!q || q.wall || q.layer === 0 || it.floor !== floor) continue;
    if (x0 < it.x + q.w / 2 && it.x - q.w / 2 < x1) return true;
  }
  for (const b of sc.fixtures || []) {
    if (b.f !== floor || !b.type || b.type === 'zone') continue;
    const s = b.def.foot || (b.w ? [-b.w / 2, b.w / 2] : null);
    if (s && x0 < b.x + s[1] && b.x + s[0] < x1) return true;
  }
  return false;
}
/** Ближайший к x центр напольного предмета на этом этаже, где он не за другой мебелью (не нашлось — сам x). */
function freeFloorX(sc, d, x, floor) {
  const W = sc.geo.W;
  for (let k = 0; k <= W; k += 8)
    for (const nx of [x - k, x + k])
      if (nx >= d.w / 2 + 6 && nx <= W - d.w / 2 - 6 && !floorBusy(sc, d, nx, floor)) return nx;
  return x;
}
/**
 * Закрывает ли настенный предмет d (центр x, высота y над полом этажа floor) другая мебель этажа: напольная повыше
 * (рисуется впереди) или другое настенное (налезают друг на друга). Коврики не в счёт.
 */
function hidden(sc, d, x, floor, y) {
  const fy = sc.geo.fy(floor),
    a = furnRect(d, x, fy, y);
  for (const it of sc.items()) {
    const q = FURN_BY_ID[it.id];
    if (it.floor !== floor || !q || q.layer === 0) continue;
    const b = furnRect(q, it.x, fy, it.y);
    if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) return true;
  }
  return false;
}
/**
 * Ближайший к x центр настенного предмета на этом этаже, где стена свободна (wallBusy) — с зазором GAP, а если так
 * места нет, то вплотную; seen — ещё и не закрыт напольной мебелью, если такое место есть. self — сам предмет
 * (его место не занято). Не нашлось — сам x.
 */
function freeWallX(sc, d, x, floor, y, seen, self = null) {
  const W = sc.geo.W,
    tries = seen
      ? [
          [GAP, true],
          [GAP, false],
          [0, false],
        ]
      : [
          [GAP, false],
          [0, false],
        ];
  for (const [gap, look] of tries)
    for (let k = 0; k <= W; k += 8)
      for (const nx of [x - k, x + k])
        if (
          nx >= d.w / 2 + 6 &&
          nx <= W - d.w / 2 - 6 &&
          !wallBusy(sc, d, nx, floor, y, self, gap) &&
          !(look && hidden(sc, d, nx, floor, y))
        )
          return nx;
  return x;
}
function stash(sc, it) {
  const d = FURN_BY_ID[it.id];
  if (sc.desc.furniture.keepOneBed && d.act === 'sleep' && countFurnAct(sc.houseKey, 'sleep') <= 1) {
    toast('Последнюю кровать убирать нельзя — где же спать?');
    return;
  }
  stashFurn(sc.houseKey, it.uid);
  sc.decor.sel = null;
  buildTray(sc);
}

// ---------- палец в режиме обустройства ----------
export function decorDown(sc, sx, sy) {
  const dc = sc.decor,
    w = sc.cam.toWorld(sx, sy);
  const it = hitItem(sc, w.x, w.y, true);
  if (it) {
    dc.sel = it;
    // ok — последнее место, где предмет можно оставить (настенный — на свободной стене); bad — сейчас он на окне,
    // на шкафчиках или на другом настенном (ответ wallBusy)
    dc.drag = { it, dx: w.x - it.x, moved: false, ok: { x: it.x, floor: it.floor, y: it.y }, bad: false };
    buildTray(sc);
  } else {
    // мимо мебели — двигаем камеру
    dc.pan = { sx, sy, cx: sc.cam.x, cy: sc.cam.y };
    if (dc.sel) {
      dc.sel = null;
      buildTray(sc);
    }
  }
}
export function decorMove(sc, sx, sy) {
  const dc = sc.decor,
    { W, RH, fy } = sc.geo,
    w = sc.cam.toWorld(sx, sy);
  if (dc.drag) {
    const it = dc.drag.it,
      d = FURN_BY_ID[it.id];
    dc.drag.moved = true;
    const f = sc.geo.floorAt(w.y, d.wall ? 0 : 30);
    const x = clamp(w.x - dc.drag.dx, d.w / 2 + 6, W - d.w / 2 - 6),
      y = d.wall ? clamp(fy(f) - w.y, d.h / 2 + 60, RH - d.h / 2 - 8) : undefined;
    moveFurn(it, x, f, y);
    // на окне (шкафчиках, другом настенном) предмет идёт за пальцем, но рамка красная («сюда нельзя»), а отпущенный
    // он вернётся на ближайшее свободное место у последнего хорошего — с небольшим зазором (decorUp)
    dc.drag.bad = wallBusy(sc, d, x, f, y, it);
    if (!dc.drag.bad) dc.drag.ok = { x, floor: f, y: it.y };
  } else if (dc.pan) {
    sc.cam.x = dc.pan.cx - (sx - dc.pan.sx) / sc.cam.zoom;
    sc.cam.y = dc.pan.cy - (sy - dc.pan.sy) / sc.cam.zoom;
    sc.cam.clamp();
  }
}
export function decorUp(sc) {
  const dc = sc.decor;
  if (dc.drag && dc.drag.moved) {
    const { it, ok, bad } = dc.drag;
    if (bad) {
      const d = FURN_BY_ID[it.id];
      moveFurn(it, freeWallX(sc, d, ok.x, ok.floor, ok.y, false, it), ok.floor, ok.y);
      sfx('bad');
      toast(BUSY_SAY[bad]);
    } else sfx('pop');
    touchState();
  }
  dc.drag = null;
  dc.pan = null;
}
