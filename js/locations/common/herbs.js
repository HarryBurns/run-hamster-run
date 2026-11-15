// НАХОДКИ ДЛЯ ГЕРБАРИЯ — «часть» локации (parts): у некоторых клумб, деревьев и ёлок можно сорвать цветок, листок
// или шишку для гербария Мяты (сюжетное задание «Гербарий для Мяты», data/quests.js).
//
//   parts: [createHerbs([['flowers', 33, 33], ['tree', 40, 31], ['pine', 2, 6], …])]
//   вид места: flowers — клумба или цветы, tree — лиственное дерево, pine — ёлка; x, y — клетка этого предмета
//
// Правила:
//  - срывать можно, только пока находки нужны для взятого задания (findsWanted('herb') в core/state.js);
//  - что даёт место — по его виду, сезону и дню (herbFor в data/finds.js): за день в городе распускаются три разные
//    находки, так что пять разных — это два дня и больше;
//  - с каждого места — раз в день (отметка дня dayFlags.herbs); такую находку, которая уже есть в рюкзаке, место
//    не даёт («завтра здесь будет что-то новое»);
//  - над местом, где сейчас есть что сорвать, висит кружок со значком находки; рядом с ним — подпись, кнопка в HUD
//    и клавиша E; нажатие на кружок — хомячок подходит и срывает.
// Находка кладётся в рюкзак (сумка finds, не еда) и шлёт событие herb { id } — по нему считает журнал заданий.
import { G, cal, findsWanted } from '../../core/state.js';
import { addItem, setDayFlag } from '../../core/actions.js';
import { emit } from '../../core/events.js';
import { dist } from '../../core/util.js';
import { ell, emoji } from '../../core/draw.js';
import { sfx } from '../../core/audio.js';
import { toast } from '../../ui/toast.js';
import { FIND_BY_ID, herbFor } from '../../data/index.js';
import { T, OUT, SP, label } from '../../engine/topdown/kinds.js';

/** На какой высоте над клеткой висит кружок: над цветами — пониже, над кроной — повыше. */
const TOP = { flowers: 46, tree: 112, pine: 122 };
const REACH = T * 1.75;

export function createHerbs(list) {
  let spots = [],
    near = null;
  const season = (sc) => sc.desc.season || cal().season;
  /** Что даёт место сегодня (id находки). */
  const herbOf = (sc, h) => herbFor(h.type, season(sc), G.state.day);
  const picked = (h) => !!(G.state.dayFlags.herbs || {})[h.key];
  /** Есть ли на месте что сорвать прямо сейчас. */
  const ready = (sc, h) => !picked(h) && !(G.state.finds[herbOf(sc, h)] > 0);

  /** Сорвать находку с места h (хомячок рядом). */
  function pick(sc, h) {
    const id = herbOf(sc, h),
      f = FIND_BY_ID[id];
    sfx('paper');
    if (!findsWanted('herb')) {
      toast('Красиво! Мята говорит, цветы лучше оставить расти 🌼');
      return false;
    }
    if (picked(h)) {
      toast('Здесь сегодня уже сорвано. Завтра распустится что-то новое! 🌱');
      return false;
    }
    if (G.state.finds[id] > 0) {
      toast(`${f.e} ${f.name} у тебя уже есть. Завтра здесь будет что-то новое!`);
      return false;
    }
    setDayFlag(h.key, 1, 'herbs');
    addItem('finds', id, 1);
    sc.drops.push({ x: h.x + 6, y: h.y - TOP[h.type] + 18, t: 0, e: f.e });
    setTimeout(() => {
      sfx('pop');
      toast(`+1 ${f.e} ${f.name} — для гербария`, 'good');
    }, 400);
    emit('herb', { id });
    emit('hud');
    return true;
  }
  function find(sc) {
    const p = sc.p;
    if (p.ride || !findsWanted('herb')) return null;
    let best = null,
      bd = REACH;
    for (const h of spots) {
      const d = dist(p.x, p.y, h.x, h.y);
      if (d < bd && ready(sc, h)) {
        bd = d;
        best = h;
      }
    }
    return best;
  }
  /** Кружок со значком находки (из кэша спрайтов). */
  const bubble = (id, x, y) =>
    SP.put('herb:' + id, [-22, -22, 22, 22], (c) => {
      ell(c, 0, 1.5, 17, 17, 'rgba(60,40,30,.25)');
      ell(c, 0, 0, 17, 17, '#fffbe6', OUT, 2);
      emoji(c, FIND_BY_ID[id].e, 0, 0, 20);
    }, x, y);
  return {
    built(sc) {
      const m = sc.map;
      spots = list.map(([type, tx, ty]) => {
        if (!m.objs.some((o) => o.tx === tx && o.ty === ty))
          console.warn(`Гербарий: в клетке ${tx}, ${ty} локации «${sc.name}» ничего не растёт`);
        return { type, tx, ty, x: (tx + 0.5) * T, y: (ty + 0.5) * T, key: `${sc.name}:${tx}_${ty}` };
      });
    },
    enter() {
      near = null;
    },
    update(sc) {
      const h = find(sc);
      if (h !== near) {
        near = h;
        emit('hud');
      }
    },
    /** Нажали на кружок над местом — подойти и сорвать. */
    tap(sc, w) {
      if (!findsWanted('herb')) return false;
      for (const h of spots) {
        const top = h.y - TOP[h.type];
        if (Math.abs(w.x - h.x) < 26 && Math.abs(w.y - top) < 26 && ready(sc, h)) {
          sc.goNear(h.x, h.y, { fn: () => pick(sc, h) });
          return true;
        }
      }
      return false;
    },
    near: (sc) => (near ? { d: dist(sc.p.x, sc.p.y, near.x, near.y) * 0.8, pending: { fn: () => pick(sc, near) } } : null),
    buttons(sc) {
      if (!near) return [];
      const h = near;
      return [{ id: 'herb', icon: FIND_BY_ID[herbOf(sc, h)].e, label: 'Сорвать', on: true, fn: () => pick(sc, h) }];
    },
    over(ctx, sc, t) {
      if (!findsWanted('herb')) return;
      const v = sc.cam;
      for (const h of spots) {
        if (Math.abs(h.x - v.x) > 1400 || Math.abs(h.y - v.y) > 1000 || !ready(sc, h)) continue;
        bubble(herbOf(sc, h), h.x, h.y - TOP[h.type] + Math.round(Math.sin(t * 2.4 + h.tx) * 2));
      }
      SP.world();
      if (near) {
        const f = FIND_BY_ID[herbOf(sc, near)];
        label(ctx, `Для гербария: ${f.e} ${f.name}`, near.x, near.y - TOP[near.type] - 62, 230, 13, '#fffbe6');
      }
    },
    /** Куда показывает звёздочка задания «собери для гербария»: ближайшее место, где сейчас есть что сорвать. */
    where(sc, name) {
      if (name !== 'herb') return null;
      let best = null,
        bd = Infinity;
      for (const h of spots) {
        if (!ready(sc, h)) continue;
        const d = dist(sc.p.x, sc.p.y, h.x, h.y);
        if (d < bd) {
          bd = d;
          best = h;
        }
      }
      return best ? { x: best.x, y: best.y + T * 0.2 } : null;
    },
    /** Все места для гербария (для тестов): [{ type, tx, ty, x, y, key }]. */
    herbSpots: () => spots,
    herbOf: (sc, h) => herbOf(sc, h),
    pickHerb: (sc, h) => pick(sc, h),
  };
}
