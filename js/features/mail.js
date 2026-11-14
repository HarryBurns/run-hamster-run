// Почта: письмо с заданием дня, его выполнение и награда.
import { award, earn, setMail, readMail, mailCount, mailGot, finishTask } from '../core/actions.js';
import { sfx } from '../core/audio.js';
import { on, emit } from '../core/events.js';
import { register } from '../core/registry.js';
import { G, cal } from '../core/state.js';
import { esc, fmtMoney, pick } from '../core/util.js';
import { CLOTHES_BY_ID, SEED_BY_ID, TASKS, TASK_BY_ID, PLACES, TASK_COINS, TASK_COINS_DEFAULT } from '../data/index.js';
import { getLocation, homeLocation } from '../engine/topdown/index.js';
import { enqueue } from '../ui/modals.js';
import { message } from '../ui/panel.js';
import { toast } from '../ui/toast.js';
import { grantSurprise, showSurprise } from './gifts.js';

const S = () => G.state;

const FIRST_TASKS = ['buy_clothes', 'swim', 'treat', 'market'];
/** Сколько монет дают за задание (в дополнение к наклейке). */
export const taskCoins = (id) => TASK_COINS[id] || TASK_COINS_DEFAULT;

export function newDayMail() {
  const s = S(),
    sea = cal().season;
  let id;
  if (s.day < FIRST_TASKS.length) id = FIRST_TASKS[s.day];
  else {
    const ripe = s.garden.some((b) => b.seed && b.age >= SEED_BY_ID[b.seed].days);
    const hasWheel = s.villa.some((i) => i.id === 'wheel'),
      hasPiano = s.villa.some((i) => i.id === 'piano');
    let pool = TASKS.filter(
      (t) =>
        (!t.seasons || t.seasons.includes(sea)) &&
        !s.lastTasks.includes(t.id) &&
        (!t.needsCrop || ripe) &&
        (t.type !== 'wheel' || hasWheel) &&
        (t.type !== 'piano' || hasPiano),
    );
    if (!pool.length) pool = TASKS.filter((t) => !t.seasons || t.seasons.includes(sea));
    id = pick(pool).id;
  }
  setMail(id);
}

function taskProgress() {
  const m = S().mail,
    t = TASK_BY_ID[m.task];
  if (t.type === 'collect' || t.type === 'talk') return ` (${m.n}/${t.n})`;
  if (t.type === 'spa') return ` (${Object.keys(m.got).length}/3)`;
  return '';
}

export function taskChip() {
  const m = S().mail;
  if (!m) return { text: '📭 Писем нет', cls: '' };
  if (!m.read) return { text: '✉️ В почтовом ящике письмо!', cls: '' };
  const t = TASK_BY_ID[m.task];
  if (!t) return { text: '📭 Писем нет', cls: '' };
  if (m.done) return { text: `✅ ${t.title}`, cls: 'done' };
  return { text: `${t.sticker} ${t.title}${taskProgress()}`, cls: '' };
}

function letterHtml() {
  const m = S().mail,
    t = TASK_BY_ID[m.task],
    c = cal();
  const where = PLACES[t.where] || (t.where === 'beach' ? 'Пляж' : t.where === 'town' ? 'Город' : '');
  return `<div class="letter"><h3>${t.sticker} ${t.title}</h3><p>Дорогая ${esc(S().name)}!</p><p>${t.text}</p>
    <p class="muted">${c.seasonIcon} ${c.monthName}, день ${c.dom}${where ? ` · Куда идти: <b>${where}</b>` : ''}</p></div>
    <p class="center">${m.done ? '✅ <b>Задание выполнено!</b>' : `Награда: <b>🪙 ${fmtMoney(taskCoins(t.id))}</b>, наклейка ${t.sticker} и, может быть, сюрприз 🎁${taskProgress() ? '<br>Сделано' + taskProgress() : ''}`}</p>`;
}

/**
 * Где лежат предметы задания «собери»: случайные места в зоне локации. Локация — поле loc задания (имя сцены),
 * без него — главная (город); зона — пляж или улицы. Предметы не из главной локации помечаются её именем.
 */
function taskSpots(t) {
  const loc = (t.loc && getLocation(t.loc)) || homeLocation();
  const spots = loc.randomSpots(t.zone || (t.where === 'beach' ? 'beach' : 'town'), t.n + 2, 1000 + S().day * 7);
  return loc === homeLocation() ? spots : spots.map((it) => ({ ...it, loc: loc.name }));
}

export function openMailbox() {
  const m = S().mail;
  if (!m) {
    toast('Ящик пуст. Новое письмо придёт завтра утром 📭');
    return;
  }
  if (!m.read) {
    sfx('mail');
    const t = TASK_BY_ID[m.task];
    readMail(t.type === 'collect' ? taskSpots(t) : null);
    emit('hud');
  }
  showLetter();
}

export function showLetter() {
  const m = S().mail;
  if (!m) {
    toast('Сегодня писем нет 📭');
    return;
  }
  if (!m.read) {
    toast('Письмо ждёт в почтовом ящике у двери виллы ✉️');
    return;
  }
  sfx('paper');
  message({
    title: 'Письмо',
    icon: '✉️',
    cls: '',
    html: letterHtml(),
    buttons: [{ text: m.done ? 'Отлично!' : 'Вперёд!' }],
  });
}

function completeTask() {
  const s = S(),
    m = s.mail,
    t = TASK_BY_ID[m.task];
  if (m.done) return;
  const done = finishTask();
  const coins = taskCoins(t.id);
  earn(coins, 'task');
  const isNew = award(t.id, { quiet: true }); // о наклейке расскажет окно «Задание выполнено»
  const surprise = done <= 2 || Math.random() < 0.5;
  const gift = surprise ? grantSurprise() : null; // подарок выдаём сразу, окно — когда освободится экран
  emit('hud');
  enqueue(
    () => {
      sfx('fanfare');
      message({
        title: 'Задание выполнено!',
        icon: '🎉',
        html: `<div class="center"><div class="sticker got">${t.sticker}</div><p><b>${t.title}</b></p><p class="reward">🪙 +${fmtMoney(coins)} монет</p><p>${isNew ? 'Новая наклейка в альбоме!' : 'Такая наклейка у тебя уже есть — молодец!'}</p>${surprise ? '<p>И это ещё не всё… 🎁</p>' : ''}</div>`,
        buttons: [{ text: surprise ? 'Открыть сюрприз!' : 'Ура!' }],
      }).then(() => {
        if (gift) showSurprise(null, gift);
      });
    },
    { delay: 700 },
  );
}

function onEvent(type, d = {}) {
  const m = S() && S().mail;
  if (!m || !m.read || m.done) return;
  const t = TASK_BY_ID[m.task];
  if (!t) return;
  let ok = false;
  switch (t.type) {
    case 'minigame':
      ok = type === 'minigame' && d.id === t.game;
      break;
    case 'buy':
      ok = type === 'buy' && d.cat === t.cat;
      break;
    case 'sell':
      ok = type === 'sell';
      break;
    case 'cook':
      ok = type === 'cook';
      break;
    case 'treat':
      ok = type === 'treat';
      break;
    case 'gift':
      ok = type === 'gift' || type === 'treat';
      break;
    case 'plant':
      ok = type === 'plant';
      break;
    case 'harvest':
      ok = type === 'harvest';
      break;
    case 'salon':
      ok = type === 'salon';
      break;
    case 'place':
      ok = type === 'place';
      break;
    case 'visit':
      ok = type === 'visit' && d.place === t.place;
      break;
    case 'wheel':
      ok = type === 'wheel';
      break;
    case 'skate':
      ok = type === 'skate';
      break;
    case 'feed':
      ok = type === 'feed';
      break;
    case 'coconut':
      ok = type === 'coconut';
      break;
    case 'pearl':
      ok = type === 'pearl';
      break;
    case 'boat':
      ok = type === 'boat';
      break;
    case 'piano':
      ok = type === 'piano';
      break;
    case 'swim':
      if (type === 'swim' && d.where === 'sea') {
        const b = S().look.outfit.body;
        if (b && CLOTHES_BY_ID[b] && CLOTHES_BY_ID[b].kind === 'swim') ok = true;
        else toast('Для задания нужен купальник! Переоденься дома в шкафу 🩱');
      }
      break;
    case 'collect':
      if (type === 'collect') {
        mailCount();
        emit('hud');
        ok = m.n >= t.n;
        if (!ok) toast(`${t.sticker} ${m.n} из ${t.n}`);
      }
      break;
    case 'talk':
      if (type === 'talk' && !m.got[d.id]) {
        mailGot(d.id);
        mailCount();
        emit('hud');
        ok = m.n >= t.n;
      }
      break;
    case 'spa':
      if (type === 'spa') {
        mailGot(d.what);
        emit('hud');
        ok = Object.keys(m.got).length >= 3;
      }
      break;
    default:
      break;
  }
  if (ok) completeTask();
}

export function initEvents() {
  for (const ev of [
    'minigame',
    'buy',
    'sell',
    'cook',
    'treat',
    'gift',
    'plant',
    'harvest',
    'salon',
    'place',
    'visit',
    'wheel',
    'skate',
    'swim',
    'collect',
    'talk',
    'spa',
    'feed',
    'coconut',
    'pearl',
    'piano',
    'boat',
  ])
    on(ev, (d) => onEvent(ev, d));
}

register('mailbox', () => openMailbox(), 'почтовый ящик');
