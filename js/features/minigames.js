// Мини-игры: запуск, запись результата, зарплата и другие награды.
import {
  addItem,
  addClothes,
  award,
  earn,
  setDayFlag,
  setFlag,
  spendMinutes,
  recordPlay,
  markBizWorked,
} from '../core/actions.js';
import { sfx } from '../core/audio.js';
import { emit } from '../core/events.js';
import { register } from '../core/registry.js';
import { G, cal, hasClothes, playerLook, ownsBiz, spaBoostOn } from '../core/state.js';
import { fmtMoney, plural, shuffle } from '../core/util.js';
import {
  NPCS,
  npcLook,
  FASHION_THEMES,
  JOBS,
  PAID_SHIFTS,
  PAID_DAY,
  ING_BY_ID,
  BUSINESSES,
  BIZ_BY_ID,
  BIZ_RULES,
  HOTEL,
} from '../data/index.js';
import { runMinigame } from '../minigames/host.js';
import { openLayer } from '../ui/modals.js';
import { toast } from '../ui/toast.js';
import { clothesPanel, scoreOutfit } from './wardrobe.js';
import { isJobGame, sickRefusal } from './health.js';

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
  mushrooms: '🍄 Грибная охота',
  sled: '🛷 Спуск с горы',
  crystals: '💎 Кристаллы',
  dig: '🦴 Раскопки',
  pairs: '🔺 Загадка пирамиды',
  vines: '🐒 Лианы',
  glyphs: '🗿 Узор храма',
  sandcastle: '🏰 Замок из песка',
  bowling: '🥥 Кокосовый боулинг',
  tug: '🪢 Перетягивание каната',
  splash: '💦 Водяная битва',
  slide: '🌀 Горка',
  porter: '🧳 Носильщица',
  volley: '🏐 Пляжный волейбол',
  hairdresser: '✂️ Парикмахер',
  lifeguard: '🛟 Спасатель',
  gardener: '🌷 Садовник',
  tree: '🎄 Нарядим ёлку',
  drum: '🥁 Танец у костра',
  mimic: '🤸 Повтори движение',
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
  const shifts = S().dayFlags.shifts || {},
    done = shifts[id] || 0,
    owner = ownerAt(id, biz);
  // общий предел на все работы за день (PAID_DAY, этап 17в): наработалась — сегодня больше не платят нигде
  const all = Object.keys(JOBS).reduce((n, k) => n + (shifts[k] || 0), 0),
    here = Math.max(0, PAID_SHIFTS - done),
    left = Math.min(here, Math.max(0, PAID_DAY - all));
  return {
    pay: owner ? job.pay.map((n) => Math.round(n * BIZ_RULES.ownerPay)) : job.pay,
    left,
    tired: here > 0 && !left,
    w: job.prize ? WORDS.prize : WORDS.job,
    owner,
  };
}
/** Наработалась за день на всех работах вместе (PAID_DAY смен): добрые слова вместо «здесь уже заплатили». */
const tiredLine = () =>
  `<div class="pay-note off">💛 Сегодня ты уже отработала ${PAID_DAY} смен — это очень много! Сыграть можно просто для удовольствия, без монет. Завтра заплатят снова!</div>`;

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
  if (j.tired) return tiredLine();
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
  if (j.tired) return tiredLine();
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
  let sum = j.pay[stars - 1];
  setDayFlag(id, ((S().dayFlags.shifts || {})[id] || 0) + 1, 'shifts');
  // бодрость после спа (От7): к оплате этой смены — приятная прибавка, и бодрость потрачена
  const bonus = spaBoostOn() ? Math.max(1, Math.round(sum * HOTEL.spaBoost)) : 0;
  if (bonus) {
    setFlag('spaBoost', null);
    sum += bonus;
  }
  earn(sum, 'work');
  sfx('coin');
  toast(`🪙 ${j.w.word}: +${coins(sum)}${bonus ? ` (из них 💆 +${coins(bonus)} — бодрость после спа!)` : ''}`, 'good');
  award('x_wage', { delay: 1500 });
  return sum;
}

export async function playMinigame(id, extra = {}) {
  const s = S();
  // простуженная не работает (Ф1): вежливый отказ; рыбалка и прочее «не работа» — можно
  if (s.sick && isJobGame(id)) {
    await sickRefusal(id);
    return null;
  }
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

// ---------- призовая мини-игра места (и праздника) ----------
/** Сколько игр сегодня ещё с призом: paid минус отметка дня dayFlags[group][flag]. */
export const prizeLeft = (group, flag, paid) => Math.max(0, paid - ((S().dayFlags[group] || {})[flag] || 0));
/** Шкала приза «⭐ 🪙 40 · ⭐⭐ 🪙 80 · ⭐⭐⭐ 🪙 120». */
export const prizeScale = (c) => `⭐ 🪙 ${c[0]} · ⭐⭐ 🪙 ${c[1]} · ⭐⭐⭐ 🪙 ${c[2]}`;
/**
 * Призовая мини-игра (лес, гора, пещеры, пустыня, джунгли, бухта, остров, отель, волейбол, праздники): первые paid
 * игр в день — монеты coins по звёздам (и что даст reward), дальше — «для удовольствия». Счётчик игр с призом —
 * отметка дня dayFlags[group][flag]; данные призов — в data/economy.js. Подписи на заставке и в итоге:
 *   label — начало строки о призе («🛷 <b>Приз Вершинкина:</b>»), scale — шкала (по умолчанию prizeScale(coins)),
 *   more — что после шкалы (по умолчанию «.»), дальше «Сегодня ещё 2 игры с призом.» (words — [«игра», «игры»],
 *   what — «с призом»); tail — вместо more и «Сегодня ещё…» (« — раз в день.»)
 *   done — заставка, когда призы на сегодня получены; fun — итог игры «для удовольствия»
 *   sum(stars) — итог игры с призом (по умолчанию «🪙 +80»)
 *   thanks — тост о призе: строка (к ней — «🪙 +80») или thanks(stars, got), got — что вернул reward
 *   intro — HTML над строкой о призе (команда у каната, пара в волейболе); info — что ещё передать игре
 *   after(res) — после любой сыгранной игры (отметки, дружба); sticker — наклейка после любой сыгранной игры
 *   reward(stars) — дополнительный приз (грибы, самоцветы, находка); source — откуда деньги (по умолчанию work)
 */
export async function prizeGame(id, o) {
  const c = o.coins,
    left = prizeLeft(o.group, o.flag, o.paid),
    words = o.words || ['игра', 'игры'],
    note = (html) => `<div class="pay-note${left ? '' : ' off'}">${html}</div>`,
    tail = o.tail || `${o.more || '.'} Сегодня ещё ${left} ${left === 1 ? words[0] : words[1]} ${o.what || 'с призом'}.`;
  const res = await playMinigame(id, {
    ...(o.info || {}),
    introNote: (o.intro || '') + (left ? note(`${o.label} ${o.scale || prizeScale(c)}${tail}`) : note(o.done)),
    resultNote: (stars) => (left ? note(`<span class="sum">${o.sum ? o.sum(stars) : `🪙 +${fmtMoney(c[stars - 1])}`}</span>`) : note(o.fun)),
  });
  if (!res) return res;
  if (o.after) o.after(res);
  if (o.sticker) award(o.sticker, { delay: 1200 });
  if (!left) return res;
  const got = o.reward ? o.reward(res.stars) : null;
  setDayFlag(o.flag, ((S().dayFlags[o.group] || {})[o.flag] || 0) + 1, o.group);
  earn(c[res.stars - 1], o.source || 'work');
  sfx('coin');
  if (o.thanks) toast(typeof o.thanks === 'function' ? o.thanks(res.stars, got) : `${o.thanks} 🪙 +${fmtMoney(c[res.stars - 1])}`, 'good');
  return res;
}

export function goFishing(spot) {
  playMinigame('fishing', { spot });
}

register('fish', (p) => goFishing(p.arg), 'рыбалка: fish:<место>');
