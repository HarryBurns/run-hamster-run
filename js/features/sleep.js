// Сон и ход времени: игровые часы, «уже поздно», новый день.
import { award, passTime, nextDay, setDayFlag } from '../core/actions.js';
import { sfx } from '../core/audio.js';
import { on, emit } from '../core/events.js';
import { register } from '../core/registry.js';
import { G, cal, isSick } from '../core/state.js';
import { fmtMoney } from '../core/util.js';
import { SLEEP_FROM } from '../data/index.js';
import { fadeTo } from '../ui/fade.js';
import { enqueue } from '../ui/modals.js';
import { message, confirmBox } from '../ui/panel.js';
import { toast } from '../ui/toast.js';
import { newDayMail } from './mail.js';
import { planNight, applyNight, morningNews } from './health.js';

const S = () => G.state;

const hhmm = (m) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;

/** Можно ли сейчас лечь спать: только вечером, с SLEEP_FROM (data/calendar.js; этап 18). */
export const canSleepNow = () => S().minutes >= SLEEP_FROM;

/** Рано спать: доброе окно вместо сна (день не меняется, ничего не тратится). */
function tooEarly() {
  const s = S(),
    c = cal(),
    sunset = s.minutes >= 17 * 60;
  setDayFlag('early', 1); // в 19:00 подскажем, что уже можно (tickClock)
  sfx('tap');
  return message({
    title: 'Ещё рано спать',
    icon: '🌞',
    html: `<div class="center big-emoji">${sunset ? '🌇' : '🌞'}</div><p class="center">${sunset ? 'Солнышко уже садится, но спать ещё рано!' : 'Ещё рано спать — солнышко высоко!'} Ложись после ${hhmm(SLEEP_FROM)} 🌙</p><p class="center muted">Сейчас ${c.time}. Время идёт само — а пока можно погулять, поиграть и заглянуть к друзьям.</p>${isSick() ? '<p class="center">🤒 Нос красный? Доктор в больнице вылечит сразу — а если монет нет, то бесплатно, «за улыбку».</p>' : ''}`,
    buttons: [{ text: 'Хорошо, погуляю! 🐹' }],
  });
}

/** Окно «Пора спать?» и новый день (только вечером, с SLEEP_FROM; раньше — «Ещё рано спать»).
 *  Возвращает true, если уснула, false — если передумала или ещё рано. */
export async function askSleep() {
  if (!canSleepNow()) {
    await tooEarly();
    return false;
  }
  const ok = await confirmBox(
    'Пора спать?',
    `<div class="center big-emoji">🛏️</div><p class="center">День был длинный! Лечь спать? Наступит следующий день.</p>`,
    'Спать 😴',
    'Ещё погуляю',
  );
  if (!ok) return false;
  const before = cal();
  sfx('sleep');
  const release = await fadeTo('Спокойной ночи… 💤', 1700);
  const s = S();
  let night, c;
  // затемнение снимается всегда: ошибка в новом дне не оставит чёрный экран «Спокойной ночи…» до перезагрузки
  try {
    night = planNight(); // болезнь (Ф1): решается по прошедшему дню, применяется к новому — до письма дня
    nextDay();
    applyNight(night);
    newDayMail();
    c = cal();
    const played = s.day - (s.startDay || 0); // год игры — от дня, когда она началась (новая — 1 июня)
    if (played > 0 && played % 36 === 0) award('x_year', { delay: 2500 });
    emit('wake'); // сцена-дом ставит хомячка у кровати
    emit('hud');
  } finally {
    release();
  }
  setTimeout(() => {
    sfx(c.season !== before.season ? 'fanfare' : 'morning');
    if (c.season !== before.season)
      enqueue(() =>
        message({
          title: `${c.seasonName}!`,
          icon: c.seasonIcon,
          html: `<div class="center big-emoji">${c.seasonIcon}</div><p class="center">Наступил${c.season === 'winter' || c.season === 'spring' ? 'а' : c.season === 'summer' ? 'о' : 'а'} ${c.seasonName.toLowerCase()}! Сегодня ${c.monthName.toLowerCase()}, день ${c.dom}.<br>${{ winter: 'Доставай тёплую куртку и шапку!', spring: 'Пора сажать грядки и гулять в лёгкой курточке.', summer: 'Купальник, панамка — и на пляж!', autumn: 'Самое время для дождевика и резиновых сапожек.' }[c.season]}</p>`,
        }),
      );
    else if (!night.fall) toast(`Доброе утро! ${c.seasonIcon} ${c.monthName}, день ${c.dom}. В ящике новое письмо ✉️`);
    // итог вчерашнего дня: сколько монет заработано (подробно — в Хомяк-Банке)
    const got = Object.values(s.ledger.yesterday.in).reduce((a, b) => a + b, 0);
    if (got > 0) setTimeout(() => toast(`Вчера ты заработала 🪙 ${fmtMoney(got)}. Молодец!`, 'good'), 1800);
    morningNews(night);
  }, 600);
  return true;
}

register('sleep', () => askSleep(), 'кровать: лечь спать');

// Игровое время идёт, пока мир не на паузе; вечером — «теперь можно спать» (если днём пробовала лечь),
// поздно вечером — напоминание, что пора спать.
function tickClock({ dt }) {
  const s = S();
  passTime(dt);
  if (s.minutes >= SLEEP_FROM && s.dayFlags.early && !s.dayFlags.eve) {
    setDayFlag('eve', 1);
    toast('🌙 Вот и вечер! Теперь можно лечь спать, когда захочешь.');
  }
  if (s.minutes >= 22 * 60 && !s.dayFlags.late) {
    setDayFlag('late', true);
    toast('Уже поздно. Пора в кроватку 😴');
  }
}

on('step', tickClock);
