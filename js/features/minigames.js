// Мини-игры: запуск, запись результата, зарплата и другие награды.
import {
  addItem,
  addClothes,
  award,
  earn,
  setDayFlag,
  spendMinutes,
  recordPlay,
  markBizWorked,
} from '../core/actions.js';
import { sfx } from '../core/audio.js';
import { emit } from '../core/events.js';
import { register } from '../core/registry.js';
import { G, cal, hasClothes, playerLook, ownsBiz } from '../core/state.js';
import { fmtMoney, plural, shuffle } from '../core/util.js';
import {
  NPCS,
  npcLook,
  FASHION_THEMES,
  JOBS,
  PAID_SHIFTS,
  ING_BY_ID,
  BUSINESSES,
  BIZ_BY_ID,
  BIZ_RULES,
} from '../data/index.js';
import { runMinigame } from '../minigames/host.js';
import { openLayer } from '../ui/modals.js';
import { toast } from '../ui/toast.js';
import { clothesPanel, scoreOutfit } from './wardrobe.js';

const S = () => G.state;

register(
  'minigame',
  (p) => playMinigame(p.arg, p.biz ? { biz: p.biz } : {}),
  'мини-игра: minigame:<id> или { do: "minigame", arg: id, biz: id заведения, где работаем }',
);

export const MG_NAMES = {
  swim: '🏊 Плавание',
  teacher: '👩‍🏫 Учительница',
  doctor: '🩺 Доктор',
  chef: '👩‍🍳 Шеф-повар',
  fishing: '🎣 Рыбалка',
  fashion: '👠 Показ мод',
  barista: '☕ Бариста',
  stylist: '💇 Стилист',
  window: '🎀 Витрина',
};

// Чем занятия делятся с мини-играми (сами мини-игры features/ не импортируют — всё приходит через host.info).
const TOOLS = {
  fashion: () => ({ fashion: { clothesPanel, scoreOutfit, themes: FASHION_THEMES, getLook: playerLook } }),
};

// ---------- работа: зарплата по звёздам, PAID_SHIFTS оплачиваемых смен в день на каждом месте ----------
const coins = (n) => `${fmtMoney(n)} ${plural(n, 'монета', 'монеты', 'монет')}`;
// Слова: за работу платят зарплату за смены, в бассейне дают приз за заплывы.
const WORDS = {
  job: {
    word: 'Зарплата',
    unit: (n) => plural(n, 'смену', 'смены', 'смен'),
    more: 'Сегодня заплатят ещё за',
    done: 'Сегодня тебе здесь уже заплатили за',
    last: 'На сегодня это была последняя оплачиваемая смена здесь.',
    again: 'Завтра заплатят снова!',
  },
  prize: {
    word: 'Приз',
    unit: (n) => plural(n, 'заплыв', 'заплыва', 'заплывов'),
    more: 'Сегодня приз дадут ещё за',
    done: 'Сегодня тебе уже дали приз за',
    last: 'На сегодня это был последний заплыв с призом.',
    again: 'Завтра призы будут снова!',
  },
};

/**
 * В каком заведении идёт работа в мини-игре id: biz — подсказка от вызвавшего (бариста работает в двух кафе);
 * без неё — единственное заведение с такой игрой (шеф-повар — ресторан). null — мини-игра не про заведение.
 */
export function bizOfGame(id, biz) {
  if (biz && BIZ_BY_ID[biz] && BIZ_BY_ID[biz].game === id) return biz;
  const list = BUSINESSES.filter((b) => b.game === id);
  return list.length === 1 ? list[0].id : null;
}
/** Работает ли хозяйка в своём заведении (тогда платят больше и растёт выручка дня). */
const ownerAt = (id, biz) => {
  const b = bizOfGame(id, biz);
  return b && ownsBiz(b) ? b : null;
};

/**
 * Что сегодня с работой в мини-игре id: null — это не работа (рыбалка); иначе
 * { pay: [за 1★, 2★, 3★], left: сколько оплачиваемых смен осталось сегодня, w: слова (WORDS), owner }.
 * biz — в каком заведении работаем: хозяйке в своём заведении платят в BIZ_RULES.ownerPay раз больше.
 */
export function jobToday(id, biz) {
  const job = JOBS[id];
  if (!job) return null;
  const done = (S().dayFlags.shifts || {})[id] || 0,
    owner = ownerAt(id, biz);
  return {
    pay: owner ? job.pay.map((n) => Math.round(n * BIZ_RULES.ownerPay)) : job.pay,
    left: Math.max(0, PAID_SHIFTS - done),
    w: job.prize ? WORDS.prize : WORDS.job,
    owner,
  };
}

/** Строчка про своё заведение: поработаешь сама — выручка дня больше. */
function ownerNote(id, biz) {
  const b = ownerAt(id, biz);
  if (!b) return '';
  const k = BIZ_RULES.workBonus;
  return `<div class="pay-note boss">👑 <b>Ты здесь хозяйка!</b> За твою работу выручка заведения сегодня вырастет: ⭐ +${Math.round(k[0] * 100)}% · ⭐⭐ +${Math.round(k[1] * 100)}% · ⭐⭐⭐ +${Math.round(k[2] * 100)}%.</div>`;
}

/** Строчка для диалога перед игрой и заставки мини-игры: сколько заплатят и сколько оплачиваемых смен осталось. */
export function jobNote(id, biz) {
  const j = jobToday(id, biz);
  if (!j) return ownerNote(id, biz);
  return jobLine(j) + ownerNote(id, biz);
}
function jobLine(j) {
  const w = j.w;
  if (!j.left)
    return `<div class="pay-note off">💛 ${w.done} ${PAID_SHIFTS} ${w.unit(PAID_SHIFTS)}. Сыграть ещё можно — просто для удовольствия, без монет. ${w.again}</div>`;
  return `<div class="pay-note">🪙 <b>${w.word}:</b> ⭐ ${fmtMoney(j.pay[0])} · ⭐⭐ ${fmtMoney(j.pay[1])} · ⭐⭐⭐ ${fmtMoney(j.pay[2])}<br>${w.more} <b>${j.left}</b> ${w.unit(j.left)}.</div>`;
}

/** Рыбалка — не работа: за неё не платят, зато улов можно продать. */
const fishNote = () =>
  `<div class="pay-note">🐟 Улов — твой: рыбку можно приготовить или продать на рынке за 🪙 ${fmtMoney(ING_BY_ID.fish.sell)}.</div>`;

/** Строчка для экрана результата: сколько заработано (или что эта игра была «для удовольствия»). */
function payNote(id, stars, biz) {
  const j = jobToday(id, biz);
  const b = ownerAt(id, biz);
  const boss = b
    ? `<div class="pay-note boss">👑 Выручка заведения сегодня: <b>+${Math.round(BIZ_RULES.workBonus[stars - 1] * 100)}%</b> за твою работу.</div>`
    : '';
  if (!j) return boss;
  return payLine(j, stars) + boss;
}
function payLine(j, stars) {
  const w = j.w;
  if (!j.left)
    return `<div class="pay-note off">💛 Эта игра была для удовольствия. ${w.done} ${PAID_SHIFTS} ${w.unit(PAID_SHIFTS)}. ${w.again}</div>`;
  const rest = j.left - 1;
  return `<div class="pay-note"><span class="sum">🪙 ${w.word}: +${coins(j.pay[stars - 1])}</span><br>${
    rest ? `${w.more} ${rest} ${w.unit(rest)}.` : `${w.last} ${w.again}`
  }</div>`;
}

/** Выдать зарплату за сыгранную мини-игру, если на сегодня ещё остались оплачиваемые смены. */
function payJob(id, stars, biz) {
  const j = jobToday(id, biz);
  if (!j || !j.left) return 0;
  const sum = j.pay[stars - 1];
  setDayFlag(id, PAID_SHIFTS - j.left + 1, 'shifts');
  earn(sum, 'work');
  sfx('coin');
  toast(`🪙 ${j.w.word}: +${coins(sum)}`, 'good');
  award('x_wage', { delay: 1500 });
  return sum;
}

export async function playMinigame(id, extra = {}) {
  const s = S();
  const plays = s.plays[id] || 0;
  const closeLayer = openLayer({ cover: true }); // мини-игра закрывает весь экран: город под ней не рисуем
  let res = null;
  try {
    res = await runMinigame(id, {
      look: playerLook(),
      name: s.name,
      season: cal().season,
      level: Math.min(4, Math.floor(plays / 2)),
      friends: shuffle(NPCS).map((n) => ({ id: n.id, name: n.name, look: npcLook(n.id), small: n.small })),
      // зарплата: что написать на заставке и на экране результата (сама мини-игра про монеты не знает)
      introNote: id === 'fishing' ? fishNote() : jobNote(id, extra.biz),
      resultNote: (stars) => payNote(id, stars, extra.biz),
      ...(TOOLS[id] ? TOOLS[id]() : {}),
      ...extra,
    });
  } catch (e) {
    console.error(e);
    toast('Не получилось открыть игру. Попробуй ещё раз!');
  }
  closeLayer();
  if (!res) return null;
  recordPlay(id, res.stars);
  spendMinutes(40, 23 * 60 + 30);
  res.paid = payJob(id, res.stars, extra.biz);
  // хозяйка сама поработала в своём заведении: выручка этого дня будет больше
  const mine = ownerAt(id, extra.biz);
  if (mine) {
    markBizWorked(mine, res.stars);
    award('x_biz_work', { delay: 2200 });
  }
  if (id === 'fishing' && res.extra && res.extra.fish) {
    addItem('ing', 'fish', res.extra.fish);
    toast(`В рюкзаке +${res.extra.fish} 🐟 Рыбку можно приготовить или продать на рынке.`, 'good');
  }
  if (res.stars === 3) award('x_3stars');
  if (id === 'swim' && res.stars === 3 && !hasClothes('medal')) {
    addClothes('medal');
    toast('Тебе вручили золотую медаль! Она в шкафу 🥇', 'good');
  }
  emit('minigame', { id, stars: res.stars });
  emit('hud');
  return res;
}

export function goFishing(spot) {
  playMinigame('fishing', { spot });
}

register('fish', (p) => goFishing(p.arg), 'рыбалка: fish:<место>');
