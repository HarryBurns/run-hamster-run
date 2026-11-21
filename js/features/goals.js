// КВЕСТЫ И ЗВЁЗДОЧКА — ОДНО МЕСТО, где решается, какой квест активен и куда ведёт указатель.
//
// Квест — любое дело, к которому может вести звёздочка: задание жителя (сюжетное, вводное, «дверное» —
// features/quests.js), праздник сегодня (features/holidays.js), письмо дня (features/mail.js). Каждое занятие само
// описывает свои квесты — registerGoalSource; здесь они складываются в один список.
//
// ПРАВИЛА (их три, и других нет):
//   1. АКТИВНЫЙ КВЕСТ — ОДИН (state.goal: 'quest:<id>' | 'holiday' | 'mail' | null). Только у него есть указатель:
//      звёздочка в месте, у выхода в нужную сторону («карта мира»), стрелка у края экрана, мини-карта, окно карты,
//      компас — всё это спрашивает starFor / goalPlace. Только он — на плашке HUD (goalChip).
//   2. СМЕНИТЬ АКТИВНЫЙ КВЕСТ МОЖЕТ ТОЛЬКО ИГРОК: «⭐ Веди меня» в журнале, «⭐ Покажи дорогу!» у нового квеста
//      (chooseGoal). Сама игра активный квест не трогает, пока он не закончен.
//   3. КВЕСТ ЗАКОНЧЕН (или активного не было) — активным становится первый по порядку (settleGoal). Порядок — одна
//      функция goalRank в data/goals.js: начатые → задания жителей → праздник → рутина (письмо дня).
// Состояние меняет только действие setGoal (core/actions.js), а зовут его только chooseGoal и settleGoal отсюда.
//
// ОПИСАНИЕ КВЕСТА (что отдаёт источник в list()):
//   { id, group: 'story' | 'holiday' | 'routine', started, since, icon, title,
//     chip: { text, short, cls },        плашка HUD (short — для телефона)
//     place() → { scene, where?, point?(sc), icon? } | null
//                                        где цель СЕЙЧАС: scene — имя сцены-локации; where — имя точки для
//                                        sc.whereIs, либо point(sc) → { x, y } | null — своя точка в этой локации
//                                        (ближайшая пальма, предмет письма); icon — значок вместо ⭐ (✉️, наклейка).
//                                        null — у шага нет места («надень обновку»): указателя нет, квест остаётся
//                                        активным. Житель — всегда через npcPlace (core/queries.js): в отеле — к отелю.
//     nowhere?                           что сказать, когда «⭐ Веди меня», а места нет
//     card(panel) → элемент              карточка в журнале (features/journal.js добавит кнопку «⭐ Веди меня») }
import { setGoal } from '../core/actions.js';
import { sfx } from '../core/audio.js';
import { on, emit } from '../core/events.js';
import { G, stateStamp } from '../core/state.js';
import { sortGoals, nextGoal } from '../data/index.js';
import { setStar, currentLocation } from '../engine/topdown/index.js';
import { toast } from '../ui/toast.js';

const S = () => G.state;
/** Где место — словами: «в лесу», «на секретном пляже» (журнал, компас, подсказки). */
export const LOC_WORDS = {
  world: 'в городе',
  forest: 'в лесу',
  mountain: 'в горах',
  caves: 'в пещерах',
  desert: 'в пустыне',
  jungle: 'в джунглях',
  cove: 'на секретном пляже',
  island: 'на удалённом острове',
  deep: 'у подземной реки',
};

// ---------- список квестов ----------
const SOURCES = [];
/**
 * Занятие рассказывает о своих квестах: src = { list() → [описание квеста], note?(body), done?(body) }.
 * note — своя заметка над списком в журнале («завтра праздник»), done — строки раздела «Выполнено».
 */
export function registerGoalSource(src) {
  SOURCES.push(src);
}
/** Источники квестов (журнал рисует их заметки и раздел «Выполнено»). */
export const goalSources = () => SOURCES;

let listState = null,
  listStamp = -1,
  listCache = [];
/** Все квесты, которые сейчас есть, — по порядку (data/goals.js). Кэш до следующего изменения состояния. */
export function goalList() {
  const s = S();
  if (!s) return [];
  const stamp = stateStamp();
  if (listState !== s || listStamp !== stamp) {
    listState = s;
    listStamp = stamp;
    listCache = sortGoals(SOURCES.flatMap((src) => src.list()));
  }
  return listCache;
}
/** Квест по id (или null — такого сейчас нет: закончен, не появился). */
export const findGoal = (id) => goalList().find((g) => g.id === id) || null;

// ---------- активный квест ----------
/** Активный квест (или null). Только читает: кто следующий — решает settleGoal по событиям игры. */
export function goalNow() {
  const s = S();
  return s && s.goal ? findGoal(s.goal) : null;
}
/**
 * Активный квест закончен (или его не было) — взять первый по порядку. Пока активный квест есть, ничего не делает.
 * Зовётся после каждого изменения состояния (шаг игры, обновление HUD) и перед тем, как спросить «Покажи дорогу?».
 */
export function settleGoal() {
  const s = S();
  if (!s) return;
  guard();
  const next = nextGoal(s.goal, goalList());
  if (next !== s.goal) setGoal(next, 'next');
}
/** Игрок выбрал квест («⭐ Веди меня», «⭐ Покажи дорогу!»). false — такого квеста сейчас нет. */
export function chooseGoal(id, why = 'player') {
  if (!S() || !findGoal(id)) return false;
  guard();
  setGoal(id, why);
  return true;
}
/**
 * Появился новый квест id: занята ли звёздочка другим квестом? true — занята, надо спросить игрока («⭐ Покажи
 * дорогу!» / «Потом»); false — активного квеста не было (или это он и есть), новый уже активен.
 */
export function goalBusy(id) {
  settleGoal();
  return !!S() && S().goal !== id;
}
/**
 * Кнопки окна, в котором появился новый квест id (житель дал задание, сосед принёс вводное, письмо прочитано, утро
 * праздника). Звёздочка занята другим квестом — { ask: true, buttons: «⭐ Покажи дорогу!» / «Потом» }: нажали
 * первую — leadNow(id). Свободна — новый квест уже активен: { ask: false, buttons: ok } (обычные кнопки окна).
 */
export function leadButtons(id, ok) {
  return goalBusy(id)
    ? { ask: true, buttons: [{ text: '⭐ Покажи дорогу!', cls: 'green lead' }, { text: 'Потом' }] }
    : { ask: false, buttons: ok };
}
/** «⭐ Покажи дорогу!»: квест id — активный, коротко сказать об этом. */
export function leadNow(id) {
  if (!chooseGoal(id)) return false;
  const g = findGoal(id);
  sfx('ok');
  toast(`⭐ Звёздочка ведёт: ${g.icon} ${g.title}`, 'good');
  return true;
}
let stepStamp = -1;
on('step', () => {
  if (!S() || stepStamp === stateStamp()) return;
  settleGoal();
  stepStamp = stateStamp();
});
// После событий игры — тоже, но НЕ посреди них, а когда всё, что делается разом, доделано (микрозадача): задание
// сдано → награда открывает лес → у лесника появляется «!» — следующий квест выбирается уже из полного списка.
let later = false;
function settleSoon() {
  if (later) return;
  later = true;
  queueMicrotask(() => {
    later = false;
    settleGoal();
  });
}
on('hud', settleSoon);
on('scene', settleSoon);

// ---------- куда ведёт указатель ----------
/** Где цель активного квеста сейчас: { scene, where?, point?, icon? } или null (квеста нет или у шага нет места). */
export function goalPlace() {
  const g = goalNow();
  return (g && g.place && g.place()) || null;
}
/**
 * ЕДИНСТВЕННОЕ ПРАВИЛО «КУДА ЗВЁЗДОЧКА» в локации sc: { x, y, icon, of — значок квеста, to?, next?, via? } | null.
 * Цель в другом месте — у выхода или транспорта в ту сторону (sc.wayTo, граф ROUTES в data/places.js); в этом —
 * у самой цели. Движок локаций (sc.target()) зовёт только её.
 */
export function starFor(sc) {
  const g = goalNow(),
    pl = g && g.place && g.place();
  if (!pl) return null;
  if (pl.scene !== sc.name) {
    const way = sc.wayTo(pl.scene);
    return way ? { ...way, of: g.icon } : null;
  }
  const p = pl.point ? pl.point(sc) : sc.whereIs(pl.where);
  if (!p) return null;
  // над жителем — повыше, над значком «!» / «?»
  const up = pl.where && pl.where.startsWith('npc:') ? 62 : 0;
  return { x: p.x, y: p.y - up, icon: pl.icon || '⭐', of: g.icon };
}
setStar((sc) => (S() ? starFor(sc) : null));

/** Плашка HUD: { text, short, cls, more — сколько ещё квестов, mail — среди них непрочитанное письмо } или null. */
export function goalChip() {
  if (!S()) return null;
  const list = goalList(),
    g = goalNow();
  if (!g) return list.length ? null : { text: '✅ Все дела сделаны!', short: '✅', cls: 'done', more: 0, mail: false };
  return {
    ...g.chip,
    more: list.length - 1,
    mail: list.some((q) => q !== g && q.unread),
  };
}

// ---------- сторож (для автотестов и отладки) ----------
// Активный квест не должен меняться сам: только по выбору игрока или когда прежний закончен. Здесь записывается
// каждая смена и то, была ли она честной; автотест после каждого шага спрашивает __dev.goal.jumps().
const log = [],
  jumps = [];
let seen = { state: null, goal: null };
/** Состояние поменяли мимо setGoal? (Новая игра или загрузка — другое состояние — не в счёт.) */
function guard() {
  const s = S();
  if (seen.state !== s) seen = { state: s, goal: s.goal };
  else if (seen.goal !== s.goal) {
    jumps.push(`активный квест сменился мимо действия setGoal: ${seen.goal} → ${s.goal}`);
    seen = { state: s, goal: s.goal };
  }
}
on('goal', ({ from, to, why }) => {
  const alive = !!from && !!findGoal(from);
  log.push({ from, to, why });
  if (log.length > 50) log.shift();
  if (why === 'next' && alive) jumps.push(`активный квест сменился сам, хотя прежний не закончен: ${from} → ${to}`);
  else if (!['player', 'next', 'dev'].includes(why)) jumps.push(`неизвестная причина смены квеста «${why}»: ${from} → ${to}`);
  seen = { state: S(), goal: to };
  emit('hud'); // плашка HUD — сразу про новый активный квест
});
/** Для автотестов (__dev.goal): выбрать квест, посмотреть активный, список по порядку, цель, нарушения сторожа. */
export const debugGoal = {
  /** Сделать квест активным: 'mail', 'holiday', 'quest:<id>' или просто id задания. false — такого квеста нет. */
  set: (id) => chooseGoal(id && !id.includes(':') && id !== 'mail' && id !== 'holiday' ? 'quest:' + id : id, 'dev'),
  now: () => {
    settleGoal();
    return S() ? S().goal : null;
  },
  list: () => goalList().map((g) => g.id),
  /** В каком месте цель активного квеста (имя сцены) и точка: { scene, where } | null. */
  place: () => {
    settleGoal();
    const pl = goalPlace();
    return pl ? { scene: pl.scene, where: pl.where || null } : null;
  },
  /** Звёздочка в месте, где хомячок сейчас: { x, y, icon, of, next? } | null. */
  star: () => {
    settleGoal();
    return starFor(currentLocation());
  },
  chip: goalChip,
  log: () => log.slice(),
  /** Нарушения «квест сменился сам» с прошлого вызова (и очистить). */
  jumps: () => jumps.splice(0),
};
