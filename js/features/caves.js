// ПЕЩЕРЫ (П.9): что делают в пещерах. Сама локация (где что стоит, темнота и фонарик) — locations/caves.js; она
// называет действия реестра, а выполняются они здесь:
//   miner              поговорить с шахтёром Камушкиным (житель пещер у кристальной жилы): задание, «Кристаллы»,
//                      шкатулка самоцветов, грибной ночник, болтовня
//   caves:crystals     мини-игра «Кристаллы» (minigames/crystals.js): за первые CAVES.crystals.paid игр в день
//                      Камушкин даёт монеты и самоцветы по звёздам (самоцветы — по кругу, GEM_IDS); дальше —
//                      для удовольствия
//   caves:paint        древние рисунки хомяков на стене галереи: окно с картинкой, наклейка
//   caves:lake         подземное озеро: тихо, капли и отражения
//   caves:pick         нашли кирку Камушкина (задание «Счастливая кирка», data/quests.js)
//   caves:shroom:<i>   светящийся гриб: CAVES.shrooms в день (находка); из CAVES.lamp Камушкин делает ночник
// Ещё: летучие мыши вспархивают (событие caves { what: 'bats' } из локации) — в первый раз наклейка; самоцветы
// продаются на рынке (features/market.js, цены — CAVES.gems); фонарик продаётся в ТЦ «Уютный дом» (features/shops.js).
// Числа — CAVES в data/economy.js. Каждое занятие шлёт событие caves { what } — по нему считают задания.
// Состояние меняют только действия (core/actions.js); «раз в день» — отметки дня (dayFlags.caves).
// Разговор, поделки, «нашлось», действие места и подсказка входа — общий набор тайных мест (features/land_kit.js).
import { setDayFlag, addItem, award } from '../core/actions.js';
import { sfx } from '../core/audio.js';
import { on, emit } from '../core/events.js';
import { G, count } from '../core/state.js';
import { fmtMoney } from '../core/util.js';
import { FIND_BY_ID, GEM_IDS, CAVES } from '../data/index.js';
import { toast } from '../ui/toast.js';
import { prizeGame } from './minigames.js';
import { paintWallPic } from './pictures_art.js';
import {
  dayFlags,
  npcLine,
  landNpc,
  craftSet,
  craftCount,
  sellTalk,
  landFind,
  landView,
  landActs,
  landHint,
} from './land_kit.js';

const S = () => G.state;
const S3 = dayFlags('caves');

// ---------- шахтёр Камушкин ----------
/** Что сказать под настроение: в пещере сезонов нет, но часы у Камушкина есть. */
export const kamushkinLine = npcLine('kamushkin', { day: (L) => L.summer.concat(L.autumn) });
/** Разговор с шахтёром: сначала задание из журнала, потом — «Кристаллы», поделки и болтовня. */
export const { talk: talkKamushkin } = landNpc({
  id: 'kamushkin',
  act: 'miner',
  desc: 'шахтёр Камушкин: разговор (житель пещер у кристальной жилы)',
  met: 'metKamushkin',
  hello: (name) =>
    `Ого, {гость|гостья}! Здравствуй, ${name}! Я шахтёр Камушкин. Профессор Орешкин писал, что ты придёшь. Доски со входа я снял — гуляй, смотри, только свети под ноги! А захочешь — помоги мне добывать кристаллы: жила — вот она, рядом.`,
  greet: (name) => [
    `Привет, ${name}!`,
    'О, {мой помощник пришёл|моя помощница пришла}!',
    'Здравствуй-здравствуй! Кап-кап — слышишь? Пещера тебе рада.',
  ],
  line: kamushkinLine,
  top: [{ text: '💎 Добывать кристаллы', cls: 'yellow', fn: async () => (await crystalDig(), null) }],
  more: [
    // шкатулка самоцветов — по одному каждого вида
    craftSet({
      ids: GEM_IDS,
      title: '🎁 Шкатулка самоцветов',
      lack: (have) =>
        `Для шкатулки нужен один самоцвет каждого вида: ${have}. Добывай кристаллы — каждый раз попадаются разные!`,
      give: ['storage', 'gem_geode'],
      sticker: 'x_gems',
      event: ['caves', 'geode'],
      done: 'Готово: хрусталь, топаз, сапфир и рубин — в шкатулке с бархатом! Поставь дома — пусть сверкает 💎 Шкатулка уже в кладовке: дома нажми 🔨.',
    }),
    // грибной ночник из светящихся грибов
    craftCount({
      id: 'glow_shroom',
      need: CAVES.lamp,
      title: '🍄 Грибной ночник',
      lack: (n) =>
        `Для ночника нужно ${CAVES.lamp} светящихся гриба, а у тебя ${n}. Они растут в гроте на северо-западе — по ${CAVES.shrooms} в день!`,
      give: ['storage', 'shroom_lamp'],
      event: ['caves', 'lamp'],
      done: 'Вот, держи: светящиеся грибы в стеклянной банке! Ночью они светят мягко-мягко. Ночник уже в кладовке: дома нажми 🔨 и поставь у кровати 🍄',
    }),
    // куда деть самоцветы
    sellTalk({
      ids: GEM_IDS,
      ask: 'самоцветы',
      say: () =>
        `Конечно! Торговец Грошик на рынке в городе берёт самоцветы: хрусталь — ${CAVES.gems.gem_crystal}, топаз — ${CAVES.gems.gem_topaz}, сапфир — ${CAVES.gems.gem_sapphire}, рубин — ${CAVES.gems.gem_ruby} монет. А можно собрать по одному каждого вида — я сделаю шкатулку!`,
    }),
  ],
});

// ---------- «Кристаллы» ----------
/** Какие самоцветы дадут за n следующих (по кругу, от номера дня: за два дня попадаются все виды). */
export function nextGems(n) {
  const got = S3().gems || 0,
    day = S().day;
  return Array.from({ length: n }, (_, k) => GEM_IDS[(day * 2 + got + k) % GEM_IDS.length]);
}
const gemIcons = (ids) => ids.map((id) => FIND_BY_ID[id].e).join('');
/** Поиграть в «Кристаллы»: за первые игры дня — монеты и самоцветы по звёздам. */
export function crystalDig() {
  const c = CAVES.crystals;
  return prizeGame('crystals', {
    group: 'caves',
    flag: 'digs',
    ...c,
    label: '⛏️ <b>Добыча Камушкина:</b>',
    scale: `⭐ 🪙 ${c.coins[0]} + ${c.gems[0]} самоцвет · ⭐⭐ 🪙 ${c.coins[1]} + ${c.gems[1]} · ⭐⭐⭐ 🪙 ${c.coins[2]} + ${c.gems[2]}`,
    what: 'с добычей',
    done: '💛 Сегодня жила уже поделилась самоцветами. Постучать можно для удовольствия — завтра добыча снова!',
    sum: (stars) => `🪙 +${fmtMoney(c.coins[stars - 1])} и ${gemIcons(nextGems(c.gems[stars - 1]))}`,
    fun: '💛 Эта игра была для удовольствия.',
    reward: (stars) => {
      const gems = nextGems(c.gems[stars - 1]);
      setDayFlag('gems', (S3().gems || 0) + gems.length, 'caves');
      for (const id of gems) addItem('finds', id, 1);
      return gems;
    },
    thanks: (stars, gems) =>
      `Камушкин: «Вот это добыча!» 🪙 +${fmtMoney(c.coins[stars - 1])} и ${gems.map((id) => FIND_BY_ID[id].e + ' ' + FIND_BY_ID[id].name).join(', ')}`,
  });
}

// ---------- древние рисунки ----------
/** Рассмотреть древние рисунки: окно с картинкой; в первый раз — наклейка. */
export function seePaintings() {
  sfx('magic');
  emit('caves', { what: 'paint' });
  award('x_cavepaint', { delay: 1400 });
  return landView({
    title: 'Древние рисунки',
    icon: '🎨',
    ratio: 0.42,
    paint: paintWallPic,
    text: 'Ух ты! Древние хомяки рисовали охрой и угольком: солнце, хомячок бежит за огромной семечкой, трое танцуют у костра… А вот — хомячок в колесе! Значит, и тысячу лет назад хомяки любили бегать 🐹 Расскажи об этом Профессору Орешкину!',
    btn: 'Здорово! 🎨',
  });
}

// ---------- озеро, кирка, грибы ----------
export function lookLake() {
  sfx('bubble');
  emit('caves', { what: 'lake' });
  toast(
    '🌊 Подземное озеро. Вода тихая-тихая и прозрачная, в ней отражаются сталактиты. Кап… — по воде бегут круги. Купаться здесь нельзя: очень холодно!',
  );
  return true;
}
/** Нашли кирку Камушкина (место pick видно, пока задание на первом шаге). */
export const findPick = landFind('caves', 'pick', {
  title: 'Кирка нашлась!',
  icon: '⛏️',
  pic: '⛏️✨',
  text: 'Вот она — с красной ручкой, у самой воды! Теперь попробуй добыть ею кристаллы у жилы — а потом отнеси кирку Камушкину.',
});
/** Сорвать светящийся гриб номер i (сегодня их растёт CAVES.shrooms). */
export function pickShroom(i) {
  const got = { ...(S3().shroom || {}) };
  if (got[i]) return false;
  got[i] = 1;
  setDayFlag('shroom', got, 'caves');
  addItem('finds', 'glow_shroom', 1);
  sfx('pop');
  const n = count('finds', 'glow_shroom');
  toast(
    `🍄 Светящийся гриб! Он светит сам, без фонарика. В рюкзаке: ${n}.${n < CAVES.lamp ? ` Собери ${CAVES.lamp} — Камушкин сделает из них ночник.` : ' Можно идти к Камушкину за ночником!'}`,
    'good',
  );
  emit('caves', { what: 'shroom' });
  return true;
}

landActs(
  'caves',
  {
    crystals: crystalDig,
    paint: seePaintings,
    lake: lookLake,
    pick: findPick,
    shroom: (ctx, p, i) => pickShroom(+i),
  },
  'пещеры: caves:crystals | paint | lake | pick | shroom:<номер>',
);

// ---------- летучие мыши и первый вход ----------
on('caves', ({ what }) => {
  if (what !== 'bats' || !S()) return;
  sfx('flap');
  if (award('x_bats', { delay: 1500 }))
    toast(
      '🦇 Летучие мыши! Днём они спят вниз головой, а ты их разбудил{|а}. Не бойся — они добрые и сейчас снова уснут.',
      'good',
    );
});
landHint(
  'caves',
  'cavesHint',
  () =>
    S().finds.flashlight
      ? '🔦 Как темно! Хорошо, что у тебя есть фонарик. Кнопкой 🔦 его можно выключить — тогда видно, как светятся грибы.'
      : '🌑 Как темно! Без фонарика видно совсем чуть-чуть. Фонарик продают в ТЦ «Уютный дом».',
  '',
);
