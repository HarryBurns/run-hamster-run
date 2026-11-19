// Войти внутрь (этап 13): двери домиков «тайных мест» — избушка лесника, шале, пирамида, шатёр, храм, палатка, хижины
// острова, подводный грот — ведут внутрь, в дома на «движке домов» (описания — interiors/, список LAND_HOUSES в
// interiors/houses.js). Хозяин — внутри (его прежние действия: разговор, задание, обмен, мини-игра — теперь там),
// дверь изнутри возвращает к двери снаружи.
//
// Действие реестра: 'inside:<id дома>' — у здания в описании локации (ctx.back — место у двери снаружи).
// Первое посещение каждого дома — подсказка (поле hello в описании дома), все дома — наклейка x_inside.
// Отметки — flags['in:<id>'] (сохранение не менялось).
import { award, setFlag } from '../core/actions.js';
import { sfx } from '../core/audio.js';
import { emit } from '../core/events.js';
import { go } from '../core/loop.js';
import { register } from '../core/registry.js';
import { G } from '../core/state.js';
import { pick } from '../core/util.js';
import { LAND_HOUSES, HOUSE_BY_ID } from '../interiors/houses.js';
import { toast } from '../ui/toast.js';

const S = () => G.state;

/** В каких домах «тайных мест» хомячок уже побывала. */
export const insideSeen = () => LAND_HOUSES.filter((h) => S().flags['in:' + h.id]).map((h) => h.id);

/** Войти в дом id (ctx.back — куда выведет дверь изнутри). */
export function enterInside(id, ctx = {}) {
  const h = HOUSE_BY_ID[id];
  if (!h) return false;
  sfx('door');
  const back = ctx.back || (ctx.scene && ctx.scene.savePos && ctx.scene.savePos()); // у «места» (грот) — где стоим
  go(id, back ? { back } : {});
  const first = !S().flags['in:' + id];
  emit('visit', { place: id });
  if (first) {
    setFlag('in:' + id);
    if (h.hello) setTimeout(() => toast(h.hello, 'good'), 500);
    if (insideSeen().length >= LAND_HOUSES.length) award('x_inside', { delay: 2200 });
  } else if (h.greet) setTimeout(() => toast(pick(h.greet)), 500);
  return true;
}

register(
  'inside',
  (p, ctx) => enterInside(p.arg, ctx),
  'войти в дом «тайного места»: inside:<id дома>; ctx.back — место у двери',
);
