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
  sc.decor.sel = placeFurn(sc.houseKey, id, f, clamp(c.x, d.w / 2 + 6, W - d.w / 2 - 6), d.wall ? 160 : 0);
  buildTray(sc);
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
    dc.drag = { it, dx: w.x - it.x, moved: false };
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
    moveFurn(
      it,
      clamp(w.x - dc.drag.dx, d.w / 2 + 6, W - d.w / 2 - 6),
      f,
      d.wall ? clamp(fy(f) - w.y, d.h / 2 + 60, RH - d.h / 2 - 8) : undefined,
    );
  } else if (dc.pan) {
    sc.cam.x = dc.pan.cx - (sx - dc.pan.sx) / sc.cam.zoom;
    sc.cam.y = dc.pan.cy - (sy - dc.pan.sy) / sc.cam.zoom;
    sc.cam.clamp();
  }
}
export function decorUp(sc) {
  const dc = sc.decor;
  if (dc.drag && dc.drag.moved) {
    sfx('pop');
    touchState();
  }
  dc.drag = null;
  dc.pan = null;
}
