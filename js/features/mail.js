// Почта: письмо с заданием дня, его выполнение и награда.
import { award, earn, setMail, readMail, mailCount, mailGot, finishTask } from '../core/actions.js';
import { sfx } from '../core/audio.js';
import { on, emit } from '../core/events.js';
import { register } from '../core/registry.js';
import { G, cal, hasClothes, homesWith, villaStage, yardHas } from '../core/state.js';
import { esc, fmtMoney, pick } from '../core/util.js';
import {
  CLOTHES_BY_ID,
  SEED_BY_ID,
  SEEDS,
  DISHES,
  ING_BY_ID,
  TASKS,
  fashionReady,
  TASK_BY_ID,
  PLACES,
  TASK_COINS,
  TASK_COINS_DEFAULT,
  canSow,
  foodRule,
  JOBS,
  taskNeedsHealth,
  coldDay,
  NPC_BY_ID,
  guestHosts,
  HOME_BY_ID,
} from '../data/index.js';
import { getLocation, homeLocation } from '../engine/topdown/index.js';
import { celebrate } from '../ui/celebrate.js';
import { message } from '../ui/panel.js';
import { toast } from '../ui/toast.js';
import { grantSurprise, showSurprise } from './gifts.js';
import { waresHere, wareOrder } from './wares.js';

const S = () => G.state;

// первые письма новой игры — по дню: не повторяют вводную цепочку (обновка, работа, рынок, гости, купание — это
// показывают соседи, features/welcome.js), а зовут посмотреть городок: пляж с ракушками, пирс, башню, кораблик
const FIRST_TASKS = ['shells', 'fish', 'tower', 'boat'];
/** Письма-соревнования: за них сюрпризом может достаться кубок чемпиона. */
const COMPETITIONS = ['swim', 'fashion'];
/** Сколько монет дают за задание (в дополнение к наклейке). */
export const taskCoins = (id) => TASK_COINS[id] || TASK_COINS_DEFAULT;

/** Есть ли вещь (колесо, пианино) в каком-нибудь из своих домов — не в кладовке. */
const atHome = (id) => homesWith(id).length > 0;

export function newDayMail() {
  const s = S(),
    sea = cal().season;
  const ripe = s.garden.some((b) => b.seed && b.age >= SEED_BY_ID[b.seed].days);
  const hasWheel = atHome('wheel'),
    hasPiano = atHome('piano');
  // задание выполнимо сегодня: сезон, тепло, урожай, колесо и пианино дома, здоровье (простуженной — Ф1 — не
  // приходят работа, купание и ныряние)
  const fits = (t) =>
    (!t.seasons || t.seasons.includes(sea)) &&
    (!t.warm || !coldDay(s.day)) &&
    (!t.needsCrop || ripe) &&
    (t.type !== 'wheel' || hasWheel) &&
    (t.type !== 'piano' || hasPiano) &&
    // «Вилла растёт»: спа-день — когда на вилле есть сауна и джакузи (третий этаж), каток — когда есть пруд
    (t.type !== 'spa' || villaStage() >= 3) &&
    (t.type !== 'skate' || yardHas('pond')) &&
    // показ мод — когда в шкафу хватает нарядов (data/fashion.js): с пустым шкафом письмо на подиум не зовёт
    (t.id !== 'fashion' || fashionReady(s.clothes)) &&
    (!s.sick || !taskNeedsHealth(t, JOBS));
  let id;
  const played = s.day - (s.startDay || 0); // сколько дней идёт игра (новая начинается 1 июня)
  const first = played >= 0 && played < FIRST_TASKS.length && TASK_BY_ID[FIRST_TASKS[played]];
  // первые письма новой игры — по порядку; простуженной (Ф1) вместо купания — задание из общего набора
  if (first && (!s.sick || !taskNeedsHealth(first, JOBS))) id = first.id;
  else {
    let pool = TASKS.filter(
      (t) => fits(t) && !s.lastTasks.includes(t.id) && (t.id !== 'buy_clothes' || newClothesToday().length > 0), // «Обновка» — только когда на витринах есть что купить
    );
    if (!pool.length) pool = TASKS.filter(fits);
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

/** Одежда, которую сегодня можно купить в магазинах города (и которой у игрока ещё нет): витрина дня, wares.js. */
const newClothesToday = () =>
  ['mall', 'beach', 'boutique'].flatMap((shop) => waresHere(shop).map((q) => q.def)).filter((c) => !hasClothes(c.id));
/** Несколько вещей с сегодняшней витрины для подсказки: сначала сезонное и привоз (wareOrder), потом остальное. */
const shelfTip = (list) =>
  [...list]
    .sort((a, b) => wareOrder(a) - wareOrder(b))
    .slice(0, 3)
    .map((it) => it.name.toLowerCase())
    .join(', ');

/**
 * Сезонная подсказка к письму: что сегодня точно получится. Задания не требуют продукта, которого сегодня не достать:
 * «посади» — называет культуры этого сезона, «приготовь» — блюда, для которых всё есть на полках.
 */
function seasonTip(t) {
  const month = cal().month;
  if (t.type === 'plant') {
    const now = SEEDS.filter((sd) => canSow(sd, month)).map((sd) => `${ING_BY_ID[sd.crop].e} ${sd.name.toLowerCase()}`);
    return `Сейчас ${cal().seasonName.toLowerCase()} — на грядках сажают: <b>${now.join(', ')}</b>.`;
  }
  if (t.type === 'cook') {
    const sure = DISHES.filter(
      (d) =>
        d.needs &&
        S().recipes.includes(d.id) &&
        Object.keys(d.needs).every((id) => ING_BY_ID[id].price > 0 && foodRule(ING_BY_ID[id], month) === null),
    ).slice(0, 4);
    return sure.length
      ? `Сегодня в ТЦ точно есть всё для таких блюд: <b>${sure.map((d) => `${d.e} ${d.name.toLowerCase()}`).join(', ')}</b>.`
      : '';
  }
  // «купи обновку», «купи мебель»: витрина каждый день немного другая — называем то, что сегодня точно есть
  if (t.id === 'buy_clothes') {
    const mall = waresHere('mall')
      .map((q) => q.def)
      .filter((c) => !hasClothes(c.id));
    return mall.length ? `Сегодня в ТЦ «Модный» точно есть: <b>${shelfTip(mall)}</b> — и ещё много всего.` : '';
  }
  if (t.id === 'buy_furn')
    return `Сегодня в ТЦ «Уютный дом» точно есть: <b>${shelfTip(waresHere('home').map((q) => q.def))}</b> — и ещё много всего.`;
  return '';
}

/** «День гостей» (письмо с hosts): кто сегодня ждёт дома — по именам; звёздочка ведёт к ближайшему. */
function hostsTip(t) {
  if (!t.hosts) return '';
  const names = guestHosts(t, S().day).map((id) => `<b>${NPC_BY_ID[id].name}</b>`);
  const list = names.length > 1 ? names.slice(0, -1).join(', ') + ' и ' + names[names.length - 1] : names[0];
  return `🏠 Сегодня дома ждут: ${list}. Звёздочка ⭐ на улице покажет ближайший домик.`;
}

function letterHtml() {
  const m = S().mail,
    t = TASK_BY_ID[m.task],
    c = cal(),
    tip = m.done ? '' : hostsTip(t) || seasonTip(t);
  // колесо и пианино — в том доме (или домах), где они стоят
  const homes = t.thing ? homesWith(t.thing).map((h) => HOME_BY_ID[h].name) : [];
  const where = homes.length
    ? homes.join(' или ')
    : PLACES[t.where] || (t.where === 'beach' ? 'Пляж' : t.where === 'town' ? 'Город' : '');
  // первое письмо новой игры (1 июня): городок здоровается с новой соседкой
  const hello =
    S().startDay && S().day === S().startDay
      ? '<p>С приездом в <b>Ореховую Гавань</b>! Весь городок рад {новому соседу|новой соседке}. 🌰</p>'
      : '';
  return `<div class="letter"><h3>${t.sticker} ${t.title}</h3><p>{Дорогой|Дорогая} ${esc(S().name)}!</p>${hello}<p>${t.text}</p>${tip ? `<p class="tip">${tip}</p>` : ''}
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
    toast('Письмо ждёт в почтовом ящике у двери дома ✉️');
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
  // за соревнование (заплыв, показ мод) — может достаться кубок; за остальные письма — уместные мелочи (features/gifts.js)
  const win = t.type === 'minigame' && COMPETITIONS.includes(t.game);
  const gift = surprise ? grantSurprise(win ? 'win' : 'small') : null; // подарок выдаём сразу, окно — когда освободится экран
  emit('hud');
  celebrate({
    title: 'Задание выполнено!',
    icon: '🎉',
    sticker: t.sticker,
    head: t.title,
    lines: `<p class="reward">🪙 +${fmtMoney(coins)} монет</p><p>${isNew ? 'Новая наклейка в альбоме!' : 'Такая наклейка у тебя уже есть — молодец!'}</p>${surprise ? '<p>И это ещё не всё… 🎁</p>' : ''}`,
    button: surprise ? 'Открыть сюрприз!' : 'Ура!',
    delay: 700,
    party: false,
    after: () => gift && showSurprise(null, gift),
  });
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
