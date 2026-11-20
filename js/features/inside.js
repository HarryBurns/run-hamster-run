// Войти внутрь (этап 13): двери домиков «тайных мест» — избушка лесника, шале, пирамида, шатёр, храм, палатка, хижины
// острова, подводный грот — ведут внутрь, в дома на «движке домов» (описания — interiors/, список LAND_HOUSES в
// interiors/houses.js). Хозяин внутри, когда он дома (одно правило «где житель» — npcAtHome, core/queries.js; часы —
// LAND_HOME в data/visits.js), с теми же действиями, что снаружи: разговор, задание, обмен, мини-игра. Дверь изнутри
// возвращает к двери снаружи.
//
// Действие реестра: 'inside:<id дома>' — у здания в описании локации (ctx.back — место у двери снаружи).
// Первое посещение каждого дома — подсказка (поле hello в описании дома), все дома — наклейка x_inside.
// Отметки — flags['in:<id>'] (сохранение не менялось).
import { award, setFlag } from '../core/actions.js';
import { sfx } from '../core/audio.js';
import { emit } from '../core/events.js';
import { go } from '../core/loop.js';
import { register } from '../core/registry.js';
import { G, npcAtHome } from '../core/state.js';
import { pick } from '../core/util.js';
import { NPC_BY_ID } from '../data/index.js';
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
  } else if (h.owner && !npcAtHome(h.owner)) {
    // хозяина нет дома (одно правило «где житель» — core/queries.js): он снаружи, у своего дела
    const n = NPC_BY_ID[h.owner];
    setTimeout(
      () => toast(`${n.name.split(' ').pop()} сейчас не дома — ${n.fem ? 'она' : 'он'} снаружи, у своих дел 🚶`),
      500,
    );
  } else if (h.greet) setTimeout(() => toast(pick(h.greet)), 500);
  return true;
}

// Записка хозяина в его доме (домики Бума и Лагуны): нет дома — «ушёл к костру» (say), дома — sayHome.
// Где хозяин — одно правило npcAtHome (core/queries.js).
register(
  'note',
  (p, ctx) => {
    const b = ctx.fixture || {};
    toast(npcAtHome(p.arg) && b.sayHome ? b.sayHome : pick([].concat(b.say || '')));
  },
  'записка хозяина в его доме: note:<житель>; у предмета say — его нет дома, sayHome — он дома',
);

register(
  'inside',
  (p, ctx) => enterInside(p.arg, ctx),
  'войти в дом «тайного места»: inside:<id дома>; ctx.back — место у двери',
);
