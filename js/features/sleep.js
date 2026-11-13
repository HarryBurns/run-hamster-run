// Сон и ход времени: игровые часы, «уже поздно», новый день.
import { award, passTime, nextDay, setDayFlag } from '../core/actions.js';
import { sfx } from '../core/audio.js';
import { on, emit } from '../core/events.js';
import { register } from '../core/registry.js';
import { G, cal } from '../core/state.js';
import { fadeTo } from '../ui/fade.js';
import { enqueue } from '../ui/modals.js';
import { message, confirmBox } from '../ui/panel.js';
import { toast } from '../ui/toast.js';
import { newDayMail } from './mail.js';

const S = () => G.state;

export async function askSleep() {
  const early = S().minutes < 18 * 60;
  const ok = await confirmBox(
    'Пора спать?',
    `<div class="center big-emoji">🛏️</div><p class="center">${early ? 'Ещё светло, но можно и вздремнуть до завтра.' : 'День был длинный!'} Лечь спать? Наступит следующий день.</p>`,
    'Спать 😴',
    'Ещё погуляю',
  );
  if (!ok) return;
  const before = cal();
  sfx('sleep');
  const release = await fadeTo('Спокойной ночи… 💤', 1700);
  const s = S();
  nextDay();
  newDayMail();
  const c = cal();
  if (s.day > 0 && s.day % 36 === 0) award('x_year', { delay: 2500 });
  emit('wake'); // сцена-дом ставит хомячка у кровати
  emit('hud');
  release();
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
    else toast(`Доброе утро! ${c.seasonIcon} ${c.monthName}, день ${c.dom}. В ящике новое письмо ✉️`);
  }, 600);
}

register('sleep', () => askSleep(), 'кровать: лечь спать');

// Игровое время идёт, пока мир не на паузе; поздно вечером — напоминание, что пора спать.
function tickClock({ dt }) {
  const s = S();
  passTime(dt);
  if (s.minutes >= 22 * 60 && !s.dayFlags.late) {
    setDayFlag('late', true);
    toast('Уже поздно. Пора в кроватку 😴');
  }
}

on('step', tickClock);
