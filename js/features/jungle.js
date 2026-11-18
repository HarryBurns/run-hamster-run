// ДЖУНГЛИ (П.9): что делают в джунглях и по дороге туда. Сама локация (где что стоит, попугаи, водопад, мост) —
// locations/jungle.js; она называет действия реестра, а выполняются они здесь:
//   explorer          поговорить с исследовательницей Лианой (жительница джунглей у палатки): задание, «Лианы»,
//                     «Перья в рамке», куда деть перья, болтовня по времени суток
//   jungle:vines      мини-игра «Лианы» (minigames/vines.js): за первые JUNGLE.vines.paid игр в день — монеты по
//                     звёздам; дальше — для удовольствия; в первый раз — наклейка
//   jungle:temple     руины храма: загадка «Узор храма» (minigames/glyphs.js) — приз раз в день, в первый раз наклейка
//   jungle:fall       искупаться под водопадом (хомячок в заводи) — наклейка
//   jungle:parrot     поболтать с попугаем ({ do: 'jungle', arg: 'parrot', i }): он отвечает, а раз в день роняет перо
//   jungle:notebook   нашли дневник Лианы у водопада (задание «Дневник исследовательницы», data/quests.js)
//   voyage:go | back  кораблик: из моря города к причалу в джунглях (кораблик подошёл к причалу за буйками —
//                     LANDS.jungle.go) и обратно с причала в джунглях к пирсу; короткая картинка-переезд
// Ещё: попугай заговорил в первый раз и прошла по подвесному мосту — наклейки (событие jungle из локации); перья
// продаются на рынке (features/market.js, цены — JUNGLE.feathers). Числа — JUNGLE в data/economy.js. Каждое занятие
// шлёт событие jungle { what } — по нему считают задания. Состояние меняют только действия (core/actions.js);
// «раз в день» — отметки дня (dayFlags.jungle).
import { setFlag, setDayFlag, addItem, award, teachParrot } from '../core/actions.js';
import { sfx } from '../core/audio.js';
import { on, emit } from '../core/events.js';
import { go, sceneName } from '../core/loop.js';
import { register } from '../core/registry.js';
import { G, cal, darkness, count } from '../core/state.js';
import { el, esc, pick, fmtMoney } from '../core/util.js';
import { NPC_BY_ID, FIND_BY_ID, FEATHER_IDS, JUNGLE, LAND_BY_ID, PARROT_WORDS, PARROT_MEMORY, npcLook } from '../data/index.js';
import { getLocation } from '../engine/topdown/index.js';
import { startFallBath, parrotSay, parrotWords, PARROTS } from '../locations/jungle.js';
import { sea } from '../locations/town.js';
import { dialog } from '../ui/dialog.js';
import { fadeScene, smooth } from '../ui/fade.js';
import { message, openPanel } from '../ui/panel.js';
import { toast, hintOnce } from '../ui/toast.js';
import { prizeGame } from './minigames.js';
import { questTalk } from './quests.js';
import { placeLine } from './tales.js';
import { paintVoyage } from './trips_art.js';
export { paintVoyage } from './trips_art.js';

const S = () => G.state;
const SJ = () => S().dayFlags.jungle || {};

// ---------- исследовательница Лиана ----------
const LIANA = 'liana';
/** Что сказать под настроение: ночью — про ночные звуки, вечером — про лягушек, днём — про фрукты по сезону. */
export function lianaLine() {
  const place = placeLine(LIANA); // вспомнить соседнее место, которое хомячок открыла (data/tales.js)
  if (place) return place;
  const L = NPC_BY_ID[LIANA].lines,
    m = S().minutes;
  if (darkness() > 0.6 || m >= 22 * 60 || m < 5 * 60) return pick(L.night);
  if (m >= 18 * 60) return pick(L.evening);
  return pick(L[cal().season]);
}
const sayL = (text, options, happy = false) => dialog({ look: npcLook(LIANA), name: NPC_BY_ID[LIANA].name, text, options, happy });
/** Сколько разных перьев в рюкзаке (для рамки нужно по одному каждого цвета). */
export const featherKinds = () => FEATHER_IDS.filter((id) => count('finds', id) > 0).length;
const feathersLine = () => FEATHER_IDS.map((id, i) => `${PARROTS[i].name} ${count('finds', id) ? '✓' : '—'}`).join(' · ');

/** Разговор с Лианой: сначала задание из журнала, потом — лианы, перья и болтовня. */
export async function talkLiana() {
  const s = S();
  let text;
  if (!s.flags.metLiana) {
    setFlag('metLiana');
    text = `Ой, гостья! Добро пожаловать в джунгли, ${esc(s.name)}! Я исследовательница Лиана — зарисовываю бабочек, цветы и попугаев. Капитан Боб писал, что приплывёт юнга! Здесь есть водопад, подвесной мост, древний храм и лианы, на которых можно качаться. А попугаи повторяют всё, что услышат!`;
  } else text = pick([`Привет, ${esc(s.name)}!`, 'О, это ты! Смотри, какую бабочку я сегодня зарисовала!', 'Здравствуй! Попугаи весь день повторяли твоё имя!']);
  emit('talk', { id: LIANA });
  sfx('tap');
  const qt = await questTalk(LIANA);
  if (qt && qt.end) return;
  if (qt && qt.text) text = qt.text;
  for (;;) {
    const opts = [{ text: '🐒 Покачаться на лианах', cls: 'yellow', fn: async () => (await vinesGame(), null) }];
    for (const o of MORE_TALK) {
      const x = o(S());
      if (x) opts.push(x);
    }
    opts.push({ text: '💬 Поболтать', cls: 'blue', go: 'chat' }, { text: 'Пока!', go: 'bye' });
    const i = await sayL(text, opts);
    const o = opts[i] || {};
    if (o.go === 'chat') text = lianaLine();
    else if (o.fn) {
      const r = await o.fn();
      if (!r) return;
      text = r;
    } else return;
  }
}
/** Дополнительные ответы: (s) → { text, cls, fn: async () => следующая реплика | null } или ничего. */
const MORE_TALK = [
  // перья в рамке — по одному каждого цвета
  () =>
    FEATHER_IDS.some((id) => count('finds', id) > 0) && {
      text: `🪶 Перья в рамке (${featherKinds()} из ${FEATHER_IDS.length})`,
      cls: 'green',
      fn: async () => {
        if (featherKinds() < FEATHER_IDS.length)
          return `Для рамки нужно по перышку от каждого попугая: ${feathersLine()}. Поболтай с ними — каждый раз в день роняет своё перо!`;
        for (const id of FEATHER_IDS) addItem('finds', id, -1);
        addItem('storage', 'feather_frame', 1);
        sfx('win');
        award('x_feathers', { delay: 1200 });
        emit('jungle', { what: 'frame' });
        return 'Готово: красное, синее и жёлтое — перья под стеклом в бамбуковой рамке! Как радуга из джунглей 🦜 Рамка уже в кладовке: дома нажми 🔨.';
      },
    },
  // куда деть перья
  () =>
    FEATHER_IDS.some((id) => count('finds', id) > 0) && {
      text: '🪙 А перья можно продать?',
      fn: async () =>
        `Конечно! Торговец Грошик на рынке в городе берёт перья: красное — ${JUNGLE.feathers.feather_red}, синее — ${JUNGLE.feathers.feather_blue}, жёлтое — ${JUNGLE.feathers.feather_yellow} монет. А можно собрать по одному каждого цвета — я сделаю красивую рамку!`,
    },
];
register('explorer', () => talkLiana(), 'исследовательница Лиана: разговор (жительница джунглей у палатки)');

// ---------- «Лианы» ----------
/** Покачаться на лианах: за первые игры дня — монеты по звёздам. */
export const vinesGame = () =>
  prizeGame('vines', {
    group: 'jungle',
    flag: 'vines',
    ...JUNGLE.vines,
    label: '🐒 <b>Приз Лианы:</b>',
    words: ['полёт', 'полёта'],
    done: '💛 Сегодня призы за лианы уже получены. Покачаться можно для удовольствия — завтра призы снова!',
    fun: '💛 Этот полёт был для удовольствия.',
    sticker: 'x_vines',
    thanks: 'Лиана: «Вот это полёт!»',
  });

// ---------- руины храма: «Узор храма» ----------
/** Разгадать узор храма: приз — раз в день (по звёздам), в первый раз — наклейка. */
export function glyphsGame() {
  sfx('door');
  return prizeGame('glyphs', {
    group: 'jungle',
    flag: 'glyphs',
    paid: 1,
    coins: JUNGLE.glyphs.coins,
    label: '🗿 <b>Сокровище храма:</b>',
    tail: ' — раз в день.',
    done: '💛 Сегодня храм уже открыл тебе сокровище. Повторять узор можно для удовольствия — завтра снова!',
    sum: (stars) => `🪙 Сокровище: +${fmtMoney(JUNGLE.glyphs.coins[stars - 1])}`,
    fun: '💛 Этот узор был для удовольствия.',
    sticker: 'x_temple',
    thanks: '🗿 Узор разгадан — каменная маска улыбнулась!',
  });
}

// ---------- водопад, попугаи, дневник ----------
const jungleScene = (ctx) => (ctx && ctx.scene) || (sceneName() === 'jungle' ? getLocation('jungle') : null);
/** Искупаться под водопадом: хомячок садится в заводь (вылезти — нажатие, стрелка или кнопка). */
export function fallBath(ctx) {
  const sc = jungleScene(ctx);
  if (!sc) return false;
  startFallBath(sc);
  sfx('splash');
  emit('jungle', { what: 'fall' });
  if (award('x_fall', { delay: 1400 })) toast('💦 Брр-ух! Прохладная вода водопада — как душ в жаркий день! Нажми куда угодно, чтобы вылезти.', 'good');
  else toast('💦 Плюх! Водопад шумит прямо над головой. Нажми куда угодно, чтобы вылезти.', 'good');
  return true;
}
/** Поболтать с попугаем i: он отвечает фразой, а раз в день роняет перо; потом можно научить его слову. */
export function parrotChat(i) {
  const p = PARROTS[i];
  if (!p) return false;
  // через раз попугай хвастается выученным словом
  const own = parrotWords(i),
    line = parrotSay(i, own.length && Math.random() < 0.5 ? pick(own) : pick([`Кр-р-ра! ${p.name} хор-р-роший!`, 'Пр-р-ривет, {name}!', `${p.name} любит тебя!`, 'Ещё! Ещё!']));
  emit('jungle', { what: 'parrot', i });
  const id = FEATHER_IDS[i];
  let note, kind;
  if (SJ()['f' + i]) note = `🦜 ${p.name} радостно машет крыльями. Перо он уже уронил сегодня — приходи завтра!`;
  else {
    setDayFlag('f' + i, 1, 'jungle');
    addItem('finds', id, 1);
    emit('jungle', { what: 'feather', id });
    note = `🦜 ${p.name} уронил перо! +1 ${FIND_BY_ID[id].e} ${FIND_BY_ID[id].name}`;
    kind = 'good';
    setTimeout(() => sfx('pop'), 400);
  }
  // про перо — в окне разговора; окно уже открыто (нажали ещё раз) — подсказкой
  if (!parrotTalk(i, line, note)) toast(note, kind);
  return true;
}
// ---------- учить попугая словам (Дж6) ----------
let parrotOpen = false;
/** Разговор с попугаем i после его фразы line (note — что с пером): «Научить слову» или «Пока!». Одно окно за раз. */
function parrotTalk(i, line, note) {
  if (parrotOpen) return false;
  parrotOpen = true;
  parrotWindow(i, line, note);
  return true;
}
async function parrotWindow(i, line, note) {
  const p = PARROTS[i],
    own = parrotWords(i).map((t) => t.replace(/\{name\}/g, S().name));
  const knows = own.length ? `<p class="muted center">${p.name} выучил: ${own.map((t) => `«${esc(t)}»`).join(', ')}</p>` : '';
  const b = await message({
    title: `Попугай ${p.name}`,
    icon: '🦜',
    html: `<p class="center big-emoji">🦜</p><p class="center"><b>${p.name}:</b> «${esc(line)}»</p><p class="center">${esc(note)}</p>${knows}`,
    buttons: [{ text: '🎓 Научить слову', cls: 'green' }, { text: 'Пока!', cls: 'ghost' }],
  });
  parrotOpen = false;
  if (b === 0) teachWindow(i);
}
/** Окно «Чему научить попугая»: выбери фразу — попугай i её запомнит (state.parrots) и будет повторять. */
export function teachWindow(i) {
  const p = PARROTS[i];
  if (!p) return null;
  return openPanel({
    title: `Чему научить: ${p.name}`,
    icon: '🎓',
    cls: 'narrow',
    render(body, tab, panel) {
      const known = (S().parrots && S().parrots[i]) || [];
      body.appendChild(
        el('p', 'center', `Выбери фразу — ${p.name} её запомнит и будет повторять. Он помнит ${PARROT_MEMORY} последние фразы.`),
      );
      const list = el('div', 'parrot-words');
      for (const w of PARROT_WORDS) {
        const text = w.text.replace(/\{name\}/g, S().name),
          has = known.includes(w.id);
        const b = el('button', 'opt' + (has ? ' been' : ''), `${w.e} ${esc(text)}${has ? ' ✓' : ''}`);
        b.onclick = () => {
          teachParrot(i, w.id);
          emit('jungle', { what: 'teach', i, id: w.id });
          panel.close();
          parrotSay(i, w.text);
          sfx('win');
          toast(has ? `🦜 ${p.name} повторил: «${esc(text)}»` : `🦜 ${p.name} запомнил: «${esc(text)}» Теперь он будет это повторять!`, 'good');
        };
        list.appendChild(b);
      }
      body.appendChild(list);
    },
  });
}
/** Нашли дневник Лианы (место notebook видно, пока задание на первом шаге). */
export async function findNotebook() {
  emit('jungle', { what: 'notebook' });
  sfx('win');
  await message({
    title: 'Дневник нашёлся!',
    icon: '📓',
    html: '<p class="center big-emoji">📓✨</p><p class="center">Вот он — зелёный, с красной закладкой, лежит у самой воды! На последней странице нарисован узор из кружочков, треугольников и волн. Теперь — к руинам храма: повтори узор на камнях!</p>',
    buttons: [{ text: 'Ура!' }],
  });
}
const JUNGLE_ACTS = {
  vines: vinesGame,
  temple: glyphsGame,
  fall: fallBath,
  notebook: findNotebook,
};
register(
  'jungle',
  (p, ctx) => (p.arg === 'parrot' ? parrotChat(p.i || 0) : JUNGLE_ACTS[p.arg] && JUNGLE_ACTS[p.arg](ctx)),
  'джунгли: jungle:vines | temple | fall | notebook; { do: jungle, arg: parrot, i }',
);

// ---------- наклейки и подсказки по событиям локации ----------
on('jungle', ({ what }) => {
  if (!S()) return;
  if (what === 'parrot' && award('x_parrot', { delay: 1600 }))
    toast('🦜 Попугай повторяет слова! Скажи ему что-нибудь доброе — и он тоже скажет. А если поболтать (нажми на него), может уронить перо.', 'good');
  else if (what === 'bridge' && award('x_bridge', { delay: 900 })) toast('🌉 Подвесной мост качается — ух! Внизу шумит река. Держись за верёвочные перила!', 'good');
});
on('scene', ({ name }) => {
  if (name === 'jungle') hintOnce('jungleHint', '🦜 Вот они — джунгли! Лиана — у палатки, прямо по тропе на север. Слышишь попугаев?', 'good');
});

// ---------- кораблик: из моря города к причалу в джунглях и обратно ----------
let voyaging = false;
/** Проплыть на кораблике: toJungle — из моря города к причалу в джунглях, иначе — обратно к пирсу города. */
export function rideVoyage(toJungle) {
  if (voyaging) return false;
  const land = LAND_BY_ID.jungle;
  voyaging = true;
  sfx('splash');
  fadeScene({
    cls: 'voyage-ride',
    text: toJungle ? '⛵ Плывём в джунгли!' : '⛵ Плывём домой, в город!',
    ms: 2600,
    paint: (ctx, w, h, p, look, t) => paintVoyage(ctx, w, h, smooth(p), toJungle, look, t),
    go: () => {
      sea.boatHome(); // кораблик ждёт у пирса города (в джунглях — свой, у причала)
      if (toJungle) go(land.scene, { at: land.entry });
      else go('world', { at: 'pier' });
    },
  }).then(() => {
    voyaging = false;
    sfx('ding');
  });
  return true;
}
register('voyage', (p) => rideVoyage(p.arg !== 'back'), 'кораблик в джунгли: voyage:go (из моря города к причалу в джунглях) | voyage:back');
