// Мини-игры: запуск, запись результата, зарплата и другие награды.
import { addItem, addClothes, award, earn, setDayFlag, spendMinutes, recordPlay } from '../core/actions.js';
import { sfx } from '../core/audio.js';
import { emit } from '../core/events.js';
import { register } from '../core/registry.js';
import { G, cal, hasClothes, playerLook } from '../core/state.js';
import { fmtMoney, plural, shuffle } from '../core/util.js';
import { NPCS, npcLook, FASHION_THEMES, JOBS, PAID_SHIFTS, ING_BY_ID } from '../data/index.js';
import { runMinigame } from '../minigames/host.js';
import { openLayer } from '../ui/modals.js';
import { toast } from '../ui/toast.js';
import { clothesPanel, scoreOutfit } from './wardrobe.js';

const S = () => G.state;

register('minigame', (p) => playMinigame(p.arg), 'мини-игра: minigame:<id>');

export const MG_NAMES = {
  swim: '🏊 Плавание',
  teacher: '👩‍🏫 Учительница',
  doctor: '🩺 Доктор',
  chef: '👩‍🍳 Шеф-повар',
  fishing: '🎣 Рыбалка',
  fashion: '👠 Показ мод',
};

// Чем занятия делятся с мини-играми (сами мини-игры features/ не импортируют — всё приходит через host.info).
const TOOLS = {
  fashion: () => ({ fashion: { clothesPanel, scoreOutfit, themes: FASHION_THEMES, getLook: playerLook } }),
};

// ---------- работа: зарплата по звёздам, PAID_SHIFTS оплачиваемых смен в день на каждом месте ----------
const coins = (n) => `${fmtMoney(n)} ${plural(n, 'монета', 'монеты', 'монет')}`;
const shiftsWord = (n) => plural(n, 'смену', 'смены', 'смен');

/**
 * Что сегодня с работой в мини-игре id: null — это не работа (рыбалка); иначе
 * { pay: [за 1★, 2★, 3★], left: сколько оплачиваемых смен осталось сегодня, word: 'Зарплата' | 'Приз' }.
 */
export function jobToday(id) {
  const job = JOBS[id];
  if (!job) return null;
  const done = (S().dayFlags.shifts || {})[id] || 0;
  return { pay: job.pay, left: Math.max(0, PAID_SHIFTS - done), word: job.prize ? 'Приз' : 'Зарплата' };
}

/** Строчка для диалога перед игрой и заставки мини-игры: сколько заплатят и сколько оплачиваемых смен осталось. */
export function jobNote(id) {
  const j = jobToday(id);
  if (!j) return '';
  if (!j.left)
    return `<div class="pay-note off">💛 Сегодня тебе здесь уже заплатили за ${PAID_SHIFTS} ${shiftsWord(PAID_SHIFTS)}. Сыграть ещё можно — просто для удовольствия, без монет. Завтра заплатят снова!</div>`;
  return `<div class="pay-note">🪙 <b>${j.word}:</b> ⭐ ${fmtMoney(j.pay[0])} · ⭐⭐ ${fmtMoney(j.pay[1])} · ⭐⭐⭐ ${fmtMoney(j.pay[2])}<br>Сегодня заплатят ещё за <b>${j.left}</b> ${shiftsWord(j.left)}.</div>`;
}

/** Рыбалка — не работа: за неё не платят, зато улов можно продать. */
const fishNote = () =>
  `<div class="pay-note">🐟 Улов — твой: рыбку можно приготовить или продать на рынке за 🪙 ${fmtMoney(ING_BY_ID.fish.sell)}.</div>`;

/** Строчка для экрана результата: сколько заработано (или что эта игра была «для удовольствия»). */
function payNote(id, stars) {
  const j = jobToday(id);
  if (!j) return '';
  if (!j.left)
    return `<div class="pay-note off">💛 Эта игра была для удовольствия: за ${PAID_SHIFTS} ${shiftsWord(PAID_SHIFTS)} сегодня тебе уже заплатили. Завтра заплатят снова!</div>`;
  const rest = j.left - 1;
  return `<div class="pay-note"><span class="sum">🪙 ${j.word}: +${coins(j.pay[stars - 1])}</span><br>${
    rest
      ? `Сегодня здесь заплатят ещё за ${rest} ${shiftsWord(rest)}.`
      : 'На сегодня это была последняя оплачиваемая смена здесь. Завтра заплатят снова!'
  }</div>`;
}

/** Выдать зарплату за сыгранную мини-игру, если на сегодня ещё остались оплачиваемые смены. */
function payJob(id, stars) {
  const j = jobToday(id);
  if (!j || !j.left) return 0;
  const sum = j.pay[stars - 1];
  setDayFlag(id, PAID_SHIFTS - j.left + 1, 'shifts');
  earn(sum, 'work');
  sfx('coin');
  toast(`🪙 ${j.word}: +${coins(sum)}`, 'good');
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
      introNote: id === 'fishing' ? fishNote() : jobNote(id),
      resultNote: (stars) => payNote(id, stars),
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
  res.paid = payJob(id, res.stars);
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
