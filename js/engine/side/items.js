// «Движок домов», часть 3: мебель — предметы, которые стоят в доме: порядок рисования, попадание пальцем,
// рисование и «что будет, если потрогать».
//
// Что делает предмет, записано в каталоге мебели (data/furniture.js, поле act):
//  - то, что происходит прямо в комнате (сесть, включить, покрутить колесо), — в таблице USE ниже;
//  - остальное (лечь спать, открыть шкаф, холодильник, пианино) — действие с тем же именем из реестра
//    (core/registry.js); его регистрирует занятие из features/.
// Новый вид поведения мебели = новая строка в USE или новое действие в реестре.
import { G, darkness } from '../../core/state.js';
import { setFurnOn } from '../../core/actions.js';
import { emit } from '../../core/events.js';
import { run, has } from '../../core/registry.js';
import { pick } from '../../core/util.js';
import { rr } from '../../core/draw.js';
import { sfx } from '../../core/audio.js';
import { FURN_BY_ID } from '../../data/index.js';
import { drawFurn, furnRect } from '../../art/furniture.js';
import { toast } from '../../ui/toast.js';

/** На какой высоте сидит хомячок на мебели разного вида. */
export const SEAT_H = { sofa: 34, armchair: 34, chair: 50, beanbag: 36, throne: 54 };

/** Предметы в порядке рисования: коврики → настенные → напольные. */
export function itemsSorted(sc) {
  const key = (i) => {
    const d = FURN_BY_ID[i.id];
    return d.layer === 0 ? 0 : d.wall ? 1 : 2;
  };
  return sc
    .items()
    .filter((i) => FURN_BY_ID[i.id])
    .slice()
    .sort((a, b) => key(a) - key(b));
}

/** Какой предмет под точкой (wx, wy). forDecor — в режиме обустройства (берутся и «неживые» предметы). */
export function hitItem(sc, wx, wy, forDecor) {
  const list = itemsSorted(sc);
  for (let i = list.length - 1; i >= 0; i--) {
    const it = list[i],
      d = FURN_BY_ID[it.id];
    if (!forDecor && !sc.canUse(d)) continue;
    const r = furnRect(d, it.x, sc.geo.fy(it.floor), it.y);
    const pad = forDecor && d.layer === 0 ? 14 : 4;
    if (wx >= r.x - pad && wx <= r.x + r.w + pad && wy >= r.y - pad && wy <= r.y + r.h + pad) return it;
  }
  return null;
}

/** Включён ли предмет: временное состояние сцены, потом сохранённое, потом «по умолчанию» (камин горит, лампа — вечером). */
function isOn(sc, it, d) {
  const lv = sc.live.get(it);
  if (lv) return lv.on;
  if (it.on !== undefined) return it.on;
  return d.act === 'fire' || (d.kind === 'lamp' && darkness() > 0.4);
}

/** Включить или выключить (телевизор, лампа, музыка, диско-шар, камин). */
function toggle(sc, it, d) {
  const on = it.on === undefined ? d.act !== 'fire' : !it.on;
  if (sc.owned)
    setFurnOn(it, on); // своя мебель: состояние уходит в сохранение
  else it.on = on; // мебель дома-описания живёт только в сцене
  sfx(d.act === 'tv' && on ? 'tvOn' : d.act === 'lamp' ? 'click' : 'tap');
  if (d.act === 'music' && on) {
    sfx('note', 523);
    setTimeout(() => sfx('note', 659), 150);
    setTimeout(() => sfx('note', 784), 300);
  }
}
/** Качнуть растение или игрушку. */
function wiggle(sc, it, d) {
  sc.live.set(it, { on: true, t: 1.2 });
  sfx('pop');
  sc.burst(it.x, sc.geo.fy(it.floor) - d.h, 'spark', 4);
}

// Что происходит прямо в комнате: act из каталога мебели → функция (sc, предмет, его описание).
const USE = {
  sit(sc, it) {
    sc.p.state = 'sit';
    sc.p.item = it;
    sc.p.x = it.x;
    sfx('pop');
  },
  tv: toggle,
  lamp: toggle,
  music: toggle,
  disco: toggle,
  fire: toggle,
  plant: wiggle,
  toy: wiggle,
  wheel(sc, it) {
    sc.p.state = 'wheel';
    sc.p.item = it;
    sc.p.x = it.x;
    sc.live.set(it, { on: true, t: 0 });
    sc.stateT = 0;
    sfx('pop');
  },
  fish(sc, it, d) {
    const y = sc.geo.fy(it.floor);
    sfx('bubble');
    sfx('heart');
    sc.burst(it.x, y - d.h + 20, 'bubble', 7);
    sc.burst(it.x, y - d.h - 6, 'heart', 3);
    toast('Ты покормила рыбок. Они машут плавниками: «Спасибо!» 🐠');
    emit('feed');
  },
  book() {
    toast(
      pick([
        'Ты прочитала сказку про храброго хомяка 📖',
        'Книга рецептов: «100 блюд из семечек» 📖',
        'Интересно! Хомяки запасают еду за щеками 📖',
        'Стихи про море. Красиво! 📖',
      ]),
    );
    sfx('ok');
  },
  mirror(sc) {
    toast(pick(['Свет мой, зеркальце… Да, ты красотка! 💖', 'Отличный наряд сегодня!']));
    sc.playerHappy();
    sfx('magic');
  },
};
// Звук перед действием из реестра (дверца шкафа и холодильника).
const SFX_BEFORE = { wardrobe: 'door', fridge: 'door' };

/** Хомячок дошёл до предмета и «потрогал» его. */
export function useItem(sc, it) {
  const d = FURN_BY_ID[it.id];
  if (!d || !sc.canUse(d)) return;
  if (USE[d.act]) USE[d.act](sc, it, d);
  else if (has(d.act)) {
    if (SFX_BEFORE[d.act]) sfx(SFX_BEFORE[d.act]);
    run(d.act, { scene: sc, item: it });
  }
}

/** Идёт ли вечеринка: включена колонка или диско-шар (тогда и музыка другая). */
export function isParty(sc) {
  return sc
    .items()
    .some(
      (i) =>
        i.on === true && FURN_BY_ID[i.id] && (FURN_BY_ID[i.id].act === 'music' || FURN_BY_ID[i.id].act === 'disco'),
    );
}

/** Нарисовать всю мебель (и рамку вокруг выбранного предмета в режиме обустройства). */
export function drawItems(ctx, sc, t) {
  const minutes = G.state.minutes,
    sel = sc.decor.on ? sc.decor.sel : null;
  for (const it of itemsSorted(sc)) {
    const d = FURN_BY_ID[it.id],
      y = sc.geo.fy(it.floor);
    const on = isOn(sc, it, d);
    if (sel && sel.uid === it.uid) {
      const r = furnRect(d, it.x, y, it.y);
      ctx.save();
      ctx.setLineDash([8, 6]);
      ctx.lineDashOffset = -t * 20;
      rr(ctx, r.x - 6, r.y - 6, r.w + 12, r.h + 12, 10);
      ctx.strokeStyle = '#ff6b9d';
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.restore();
    }
    drawFurn(ctx, d, it.x, d.wall ? y - it.y : y, { t, on, minutes });
  }
}
