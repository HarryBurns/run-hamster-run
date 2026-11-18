// НАБОР ДЛЯ ТАЙНЫХ МЕСТ (этап 24): общее у занятий леса, горы, пещер, пустыни, джунглей, секретного пляжа и острова.
// Место описывает своё данными, а ходят они здесь (рецепт — docs/ARCHITECTURE.md, раздел 13, «новое тайное место»):
//   npcLine(id, …)       реплика жителя «под настроение»: про соседнее место (tales), ночью, вечером, днём
//   sayAs(id, …)         окно разговора с жителем места
//   landNpc({ … })       разговор с жителем: знакомство (отметка met), приветствие, задание из журнала (questTalk),
//                        дальше — по кругу: свои кнопки, «Поболтать», «Пока!»; регистрирует действие разговора
//   craftSet({ … })      кнопка разговора «собери по одной находке каждого вида → вещь» (шкатулка, рамка, лея…)
//   craftCount({ … })    кнопка разговора «принеси n одинаковых находок → вещь» (ночник, венок, тотем…)
//   sellTalk({ … })      кнопка «🪙 А … можно продать?» — пока в рюкзаке есть такие находки
//   landFind(…)          окно «нашлось!» (вещь из задания: кирка, варежка, бубенчик…) и событие места
//   landView({ … })      окно-картинка с подписью (вид с домика на дереве, с вершины, древние рисунки)
//   landActs(…)          действие места group:<что>[:<ещё>] → функция из таблицы
//   landHint(…)          подсказка при первом входе в сцену места
//   landRide(…)          поездка туда и обратно картинкой-переездом (ui/fade.js) и её действие
// Призовые мини-игры — prizeGame (features/minigames.js), «раз в день» — отметки дня dayFlags[group] (dayFlags(group)).
// Состояние меняют только действия (core/actions.js).
import { setFlag, addItem, addClothes, award } from '../core/actions.js';
import { sfx } from '../core/audio.js';
import { on, emit } from '../core/events.js';
import { register } from '../core/registry.js';
import { G, cal, darkness, count } from '../core/state.js';
import { makeCanvas } from '../core/draw.js';
import { el, esc, pick } from '../core/util.js';
import { NPC_BY_ID, FIND_BY_ID, npcLook } from '../data/index.js';
import { dialog } from '../ui/dialog.js';
import { fadeScene } from '../ui/fade.js';
import { message, openPanel } from '../ui/panel.js';
import { hintOnce } from '../ui/toast.js';
import { questTalk } from './quests.js';
import { placeLine } from './tales.js';

const S = () => G.state;

/** Отметки дня места: () → dayFlags[group] или пустой объект. */
export const dayFlags = (group) => () => S().dayFlags[group] || {};

/**
 * Реплика жителя под настроение → функция без аргументов. Сначала first() (своё, если вернула строку), потом —
 * про соседнее открытое место (placeLine), ночью (темно, после 22 или до 5) — lines.night, с evening часов —
 * lines.evening, днём — из списка day(lines) (по умолчанию — реплики сезона).
 */
export const npcLine =
  (id, { evening = 18, day = (L) => L[cal().season], first = null } = {}) =>
  () => {
    const own = first && first();
    if (own) return own;
    const place = placeLine(id); // вспомнить соседнее место, которое хомячок открыла (data/tales.js)
    if (place) return place;
    const L = NPC_BY_ID[id].lines,
      m = S().minutes;
    if (darkness() > 0.6 || m >= 22 * 60 || m < 5 * 60) return pick(L.night);
    if (m >= evening * 60) return pick(L.evening);
    return pick(day(L));
  };

/** Окно разговора с жителем id: текст и кнопки; → номер нажатой кнопки. */
export const sayAs = (id, text, options, happy = false) =>
  dialog({ look: npcLook(id), name: NPC_BY_ID[id].name, text, options, happy });

/** Кнопка или (s) → кнопка | ничего. */
const optsOf = (list, s) => {
  const out = [];
  for (const o of list) {
    const x = typeof o === 'function' ? o(s) : o;
    if (x) out.push(x);
  }
  return out;
};

/**
 * Житель тайного места. Описание:
 *   id      житель (NPC_BY_ID; у него lines для npcLine)
 *   act     действие реестра «поговорить» и desc — его описание (если нет — не регистрируется)
 *   met     отметка знакомства (flags), hello(имя) — первая встреча, greet(имя) — список приветствий потом
 *   line    что сказать на «Поболтать» (по умолчанию npcLine(id))
 *   top     кнопки до «Поболтать» (обычно призовая игра), more — следом (craftSet, craftCount, sellTalk, свои),
 *   after   кнопки после «Поболтать». Кнопка: { text, cls, fn: async () → следующая реплика | null (конец) }
 *           или (s) → кнопка | ничего (пересчитывается на каждом круге).
 * → { say(text, options, happy), talk(), line() }.
 */
export function landNpc({ id, act, desc, met, hello, greet, line = npcLine(id), top = [], more = [], after = [] }) {
  const say = (text, options, happy) => sayAs(id, text, options, happy);
  async function talk() {
    const s = S();
    let text;
    if (!s.flags[met]) {
      setFlag(met);
      text = hello(esc(s.name));
    } else text = pick(greet(esc(s.name)));
    emit('talk', { id });
    sfx('tap');
    const qt = await questTalk(id);
    if (qt && qt.end) return;
    if (qt && qt.text) text = qt.text;
    for (;;) {
      const now = S(),
        opts = [
          ...optsOf(top, now),
          ...optsOf(more, now),
          { text: '💬 Поболтать', cls: 'blue', go: 'chat' },
          ...optsOf(after, now),
          { text: 'Пока!', go: 'bye' },
        ];
      const i = await say(text, opts);
      const o = opts[i] || {};
      if (o.go === 'chat') text = line();
      else if (o.fn) {
        const r = await o.fn();
        if (!r) return;
        text = r;
      } else return;
    }
  }
  if (act) register(act, () => talk(), desc);
  return { say, talk, line };
}

/** Отдать сделанную вещь: give — [сумка, id] (в кладовку — 'storage') или ['clothes', id] (в шкаф). */
function giveThing([bag, id]) {
  if (bag === 'clothes') addClothes(id);
  else addItem(bag, id, 1);
}
/** Сделали: звук, наклейка (если есть), событие места. */
function crafted({ sticker, event }) {
  sfx('win');
  if (sticker) award(sticker, { delay: 1200 });
  emit(event[0], { what: event[1] });
}

/**
 * «Собери по одной находке каждого вида → вещь» — кнопка разговора (видна, когда есть хоть одна такая находка и
 * when() не против). ids — виды (сумка finds), need — сколько разных нужно (по умолчанию все), title — подпись кнопки
 * (к ней — «(есть из всех)»), mark(id, i) и sep — строка «что есть» (✓ / —) для lack(строка), give — что получить,
 * sticker, event — [группа, what], done — что скажет житель.
 */
export function craftSet({
  ids,
  need = ids.length,
  title,
  mark = (id) => FIND_BY_ID[id].e,
  sep = ' ',
  when,
  lack,
  give,
  sticker,
  event,
  done,
}) {
  const kinds = () => ids.filter((id) => count('finds', id) > 0).length;
  return (s) =>
    ids.some((id) => count('finds', id) > 0) &&
    (!when || when(s)) && {
      text: `${title} (${kinds()} из ${ids.length})`,
      cls: 'green',
      fn: async () => {
        if (kinds() < need)
          return lack(ids.map((id, i) => `${mark(id, i)} ${count('finds', id) ? '✓' : '—'}`).join(sep));
        for (const id of ids) addItem('finds', id, -1);
        giveThing(give);
        crafted({ sticker, event });
        return done;
      },
    };
}

/**
 * «Принеси need одинаковых находок id → вещь» — кнопка разговора (видна, когда есть хоть одна). Подпись:
 * `${title} (${unit}есть из need)`, cap — «есть» не больше need. lack(есть) — если мало; остальное — как у craftSet.
 */
export function craftCount({ id, need, title, unit = '', cap = false, lack, give, sticker, event, done }) {
  return () => {
    const n = count('finds', id);
    return (
      n > 0 && {
        text: `${title} (${unit}${cap ? Math.min(n, need) : n} из ${need})`,
        cls: 'green',
        fn: async () => {
          const have = count('finds', id);
          if (have < need) return lack(have);
          addItem('finds', id, -need);
          giveThing(give);
          crafted({ sticker, event });
          return done;
        },
      }
    );
  };
}

/** «🪙 А ask можно продать?» — пока в рюкзаке есть хоть одна находка из ids; ответ — say(). */
export const sellTalk =
  ({ ids, ask, say }) =>
  () =>
    ids.some((id) => count('finds', id) > 0) && { text: `🪙 А ${ask} можно продать?`, fn: async () => say() };

/** Нашлась вещь из задания: событие group { what } и окно с картинкой pic и текстом. → async-функция. */
export const landFind =
  (group, what, { title, icon, pic, text, btn = 'Ура!', sound = 'win' }) =>
  async () => {
    emit(group, { what });
    sfx(sound);
    await message({
      title,
      icon,
      html: `<p class="center big-emoji">${pic}</p><p class="center">${text}</p>`,
      buttons: [{ text: btn }],
    });
  };

/**
 * Окно-картинка: рисунок paint(ctx, W, H) шириной до 560 (высота — W × ratio), под ним подпись text, внизу кнопка btn.
 */
export const landView = ({ title, icon, ratio, paint, text, btn }) =>
  openPanel({
    title,
    icon,
    cls: 'wide',
    render(body) {
      const W = Math.min(560, window.innerWidth - 60),
        H = Math.round(W * ratio);
      const { canvas, ctx } = makeCanvas(W, H);
      canvas.style.cssText += ';display:block;margin:0 auto;border-radius:14px;max-width:100%;height:auto';
      paint(ctx, W, H);
      body.appendChild(canvas);
      body.appendChild(el('p', 'center', text));
    },
    foot: [{ text: btn, cls: 'green', fn: (api) => api.close() }],
  });

/**
 * Действие места group:<что>[:<ещё>]: acts[что](ctx, p, ещё) — ctx реестра (сцена), p — параметры действия
 * ({ do, arg, … }), ещё — хвост после двоеточия (номер гриба, кусочек карты…).
 */
export function landActs(group, acts, desc) {
  register(
    group,
    (p, ctx) => {
      const [what, ...rest] = String(p.arg || '').split(':');
      const fn = Object.prototype.hasOwnProperty.call(acts, what) && acts[what];
      return fn ? fn(ctx, p, rest.join(':')) : undefined;
    },
    desc,
  );
}

/** Подсказка при первом входе в сцену scene (отметка flags[flag]); text — строка или () → строка. */
export const landHint = (scene, flag, text, kind = 'good') =>
  on('scene', ({ name }) => {
    if (name === scene && S()) hintOnce(flag, typeof text === 'function' ? text() : text, kind);
  });

/**
 * Поездка картинкой-переездом: действие act:<туда> | act:<back>. Описание:
 *   sound     звук в начале, check(туда) → false — не ехать (сама скажет почему)
 *   text      [надпись туда, надпись обратно]; cls, ms, ratio — как у fadeScene
 *   paint(туда) → (ctx, w, h, p, look, t) — рисунок (зовётся в начале поездки: можно запомнить сезон)
 *   to(туда)  переход в сцену (посреди затемнения); done(туда) — когда картинка закрылась (после звука ding)
 * → ride(туда) — true, если поехали.
 */
export function landRide({ act, back = 'back', desc, sound, check, text, cls, ms, ratio, paint, to, done }) {
  let busy = false;
  const ride = (fwd) => {
    if (busy) return false;
    if (check && check(fwd) === false) return false;
    busy = true;
    sfx(sound);
    fadeScene({ cls, text: fwd ? text[0] : text[1], ms, ratio, paint: paint(fwd), go: () => to(fwd) }).then(() => {
      busy = false;
      sfx('ding');
      if (done) done(fwd);
    });
    return true;
  };
  register(act, (p) => ride(p.arg !== back), desc);
  return ride;
}
