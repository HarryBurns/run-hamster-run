// ЖУРНАЛ СЮЖЕТНЫХ ЗАДАНИЙ (этап 5): ход заданий по событиям, разговор с жителем о задании, журнал (вкладка альбома),
// плашка в HUD, звёздочка-указатель, праздничное окно и входы в тайные места (действие way).
//
// Описания заданий — data/quests.js, места — LANDS в data/places.js. Состояние — state.quests и state.lands; меняют
// его только действия takeQuest, questCount, finishQuest, openLand (core/actions.js); читать — questNow, questBadge,
// landOpen, findsWanted (core/state.js). Как добавить задание — docs/ARCHITECTURE.md, «Сюжетные задания».
//
// Как считается ход: шаги «сделать» (on: событие) — подписка на события из core/events.js: событие пришло,
// задание взято, поля совпали — questCount. Шаги «принести» смотрят в рюкзак (их не надо считать). Шаг «поговорить» —
// разговор с жителем (questTalk зовут диалоги жителей: friends.js, visits.js). Каждое событие, которое может сдвинуть
// задание, сверяет «где задание сейчас» с прошлым разом — и подсказывает «3 из 5», «Дальше: …», «Всё готово!».
import {
  takeQuest,
  questCount,
  finishQuest,
  openLand,
  addItem,
  addClothes,
  award,
  earn,
  meetFriend,
  setFlag,
  learnRecipe,
} from '../core/actions.js';
import { sfx } from '../core/audio.js';
import { on, emit } from '../core/events.js';
import { go, scene } from '../core/loop.js';
import { register, run } from '../core/registry.js';
import { G, questNow, landOpen, npcSpot, invitedToday } from '../core/state.js';
import { el, esc, fmtMoney } from '../core/util.js';
import {
  QUESTS,
  QUEST_BY_ID,
  LAND_BY_ID,
  NPC_BY_ID,
  npcLook,
  FIND_BY_ID,
  CLOTHES_BY_ID,
  EXTRA_STICKERS,
  QUEST_GIFT_COINS,
  DISH_BY_ID,
  HOME_SCENE,
  HOME_BY_ID,
  NPC_HOME,
  LAND_HOME,
  SEED_BY_ID,
  ING_BY_ID,
} from '../data/index.js';
import { homeLocation, currentLocation, getLocation, setTargetHook } from '../engine/topdown/index.js';
import { celebrate } from '../ui/celebrate.js';
import { dialog } from '../ui/dialog.js';
import { enqueue } from '../ui/modals.js';
import { message } from '../ui/panel.js';
import { toast } from '../ui/toast.js';
import { openMap, setMapGoal, routeText } from './map.js';
import { taleTalk } from './tales.js';

const S = () => G.state;
const STICKER = Object.fromEntries(EXTRA_STICKERS.map((q) => [q.id, q]));
const her = (npc) => (NPC_BY_ID[npc].fem ? 'ней' : 'ним'); // «с ней / с ним»
const hisOf = (npc) => (NPC_BY_ID[npc].fem ? 'неё' : 'него'); // «у неё / у него»
const toHim = (npc) => (NPC_BY_ID[npc].fem ? 'ней' : 'нему'); // «к ней / к нему»

// ---------- звёздочка-указатель ----------
// К какому заданию показывает звёздочка (та же, что у письма; важнее письма). Берут задание — звёздочка ведёт
// к первому шагу; «Показать на карте» в журнале — к текущему шагу; нажали на плашку письма — снова к письму.
// «Карта мира» (этап 11): цель может быть в другом месте, чем хомячок. Тогда звёздочка встаёт у выхода или
// транспорта, который ведёт в нужную сторону (sc.wayTo — граф ROUTES в data/places.js), а в месте цели — у самой цели.
let tracked = null,
  extraTarget = null,
  extraScene = null,
  journalTop = null;
/**
 * Звёздочка не задания из журнала, а чего-то ещё (праздник — features/holidays.js): fn(sc) → { x, y, icon } | null —
 * зовётся в месте цели; sceneFn() → имя сцены, где эта цель сейчас (null — показывать нечего): в других местах
 * звёздочка ведёт к дороге туда. Спрашивается, только пока ни одно задание из журнала не показывается звёздочкой.
 */
export function setExtraTarget(fn, sceneFn) {
  extraTarget = fn;
  extraScene = sceneFn || null;
}
/** Своя карточка в начале журнала (праздник сегодня — features/holidays.js): fn(body, panel). */
export function setJournalTop(fn) {
  journalTop = fn;
}
/** Показывать звёздочкой задание id (null — снова письмо). */
export function trackQuest(id) {
  tracked = id;
}
/** Куда ведёт задание по описанию: имя точки для sc.whereIs (житель, место, здание…) или null. */
function questPoint(w) {
  if (w.status === 'ready') return w.q.npcAt || 'npc:' + w.q.npc; // лифтёр стоит в башне: звёздочка — к её двери
  if (w.status !== 'active') return null;
  const step = w.q.steps[w.i];
  return step ? step.where || (step.talk ? 'npc:' + step.talk : null) : null;
}
/**
 * Куда ведёт задание сейчас: { where — точка для sc.whereIs или null, scene — в каком месте (имя сцены) }.
 * Место — поле loc шага или задания, без них — город. Цель — житель города ('npc:<id>': «покажись Плюше», кто дал
 * задание) — звёздочка ведёт туда, где он на самом деле (npcSpot, core/queries.js): в гостях у хомячка — к двери
 * дома, где он гостит (вилла, квартира, лесной домик…), у бассейна или в номере 203 — к отелю, иначе — к нему самому
 * на улице или к его домику.
 */
function questGoal(w) {
  const step = w.status === 'active' ? w.q.steps[w.i] : null,
    where = questPoint(w),
    spot = where && where.startsWith('npc:') ? npcSpot(where.slice(4)) : null;
  if (spot) return { where: spot.where, scene: spot.scene, spot };
  return { where, scene: (step && step.loc) || w.q.loc || HOME_SCENE, spot: null };
}
/** Задание, которое показывает звёздочка, — { w, where, scene } или null (сделано — звёздочка снова свободна). */
function trackedNow() {
  if (!tracked) return null;
  const w = questNow(tracked);
  if (w.status === 'done') {
    tracked = null;
    return null;
  }
  return { w, ...questGoal(w) };
}
setTargetHook((sc) => {
  if (!S()) return null;
  const tr = trackedNow();
  if (!tr) {
    if (!extraTarget) return null;
    const at = extraScene ? extraScene() : sc.name;
    return at && at !== sc.name ? sc.wayTo(at) : extraTarget(sc);
  }
  if (!tr.where) return null;
  const at = tr.scene;
  if (at !== sc.name) return sc.wayTo(at); // цель в другом месте — к выходу или транспорту в ту сторону
  const p = sc.whereIs(tr.where);
  if (!p) return null;
  // над жителем — повыше, над значком «!» / «?»
  return { x: p.x, y: tr.where.startsWith('npc:') ? p.y - 62 : p.y, icon: '⭐' };
});
/** В каком месте (имя сцены) сейчас цель звёздочки — задание журнала, праздник или предметы письма; null — цели нет. */
export function starScene() {
  if (!S()) return null;
  const tr = trackedNow();
  if (tr) return tr.where ? tr.scene : null;
  const ex = extraScene && extraScene();
  if (ex) return ex;
  const m = S().mail,
    it = m && m.items && !m.done && m.items.find((q) => !q.got);
  return it ? it.loc || HOME_SCENE : null;
}
setMapGoal(starScene);
/**
 * Компас (О5, features/compass.js): какое задание журнала он показывает и где его цель. Звёздочка ни к чему
 * не ведёт, а в журнале есть начатые задания — компас берёт первое из них (как «Показать на карте»), праздник
 * не перебивает. → { q — задание или null, fest — цель — праздник, scene — место цели или null }.
 */
export function compassGoal() {
  if (!S()) return { q: null, scene: null };
  let tr = trackedNow();
  if (!tr && !(extraScene && extraScene())) {
    const w = QUESTS.map((q) => questNow(q.id)).find((x) => x.status === 'active' && questGoal(x).where);
    if (w) {
      trackQuest(w.q.id);
      tr = trackedNow();
    }
  }
  return { q: tr ? tr.w.q : null, fest: !tr && !!(extraScene && extraScene()), scene: starScene() };
}
/** Где искать того, кто дал задание: «в городе» или «в лесу» (поле loc задания — локация, где оно идёт). */
const placeOf = (q) => (q.loc ? LOC_WORDS[q.loc] || 'в другом месте' : 'в городе');
/** Карточка «Новое задание!»: где искать того, кто его даёт, — «найди её в городе…» или «сейчас она у тебя в гостях…». */
function readyWhere(q) {
  const npc = NPC_BY_ID[q.npc],
    away = !q.npcAt && whereWords(q.npc);
  if (away) return `сейчас ${npc.fem ? 'она' : 'он'} ${away}. Над головой у ${hisOf(q.npc)} «!».`;
  return `найди ${npc.fem ? 'её' : 'его'} ${placeOf(q)}. Над головой у ${hisOf(q.npc)} «!».`;
}
/** Где место — словами: «в лесу», «на секретном пляже» (журнал, компас). */
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
/**
 * Где житель города сейчас, если не там, где обычно (не на улице и не у своего домика), — словами после имени или
 * «она / он»: «у тебя в гостях, на вилле 🏡», «в отеле «Морская звезда» у бассейна 🏨», «… в номере 203 🏨».
 * null — житель на своём месте (или не житель города). Где он — npcSpot (core/queries.js).
 */
export function npcAwayWords(id) {
  const sp = npcSpot(id);
  if (!sp) return null;
  if (sp.at === 'guest') {
    const h = HOME_BY_ID[sp.home];
    return `у тебя в гостях, ${h.atWords} ${h.icon}`;
  }
  if (sp.at === 'pool') return 'в отеле «Морская звезда» у бассейна 🏨';
  if (sp.at === 'room') return 'в отеле «Морская звезда», в номере 203 🏨';
  if (sp.at === 'fest') return `на празднике: ${sp.fest} 🎉`;
  // хозяин тайного места у себя дома — разговор и задание там (дверь его дома)
  if (sp.at === 'home' && LAND_HOME[id]) return LAND_HOME[id].inWords;
  return null;
}
/** Где житель, если его не видно на улице: npcAwayWords, а житель города у себя дома — «у себя дома — постучись…». */
function whereWords(id) {
  const away = npcAwayWords(id),
    sp = npcSpot(id);
  if (away || !sp || !NPC_HOME[id]) return away;
  if (sp.at === 'asleep') return 'дома и уже спит 😴';
  return sp.at === 'home' ? 'у себя дома — постучись в дверь домика 🚪' : null;
}
/**
 * Подсказка в журнале «где житель сейчас» (шаг «поговори с …»): в гостях, в отеле, спит, ждёт дома, у домика или на
 * своём месте днём (NPC_HOME[id].away — data/visits.js). null — не житель города: обычная подсказка шага (hint).
 */
function npcHint(id) {
  const sp = npcSpot(id),
    npc = NPC_BY_ID[id],
    home = NPC_HOME[id];
  if (sp && LAND_HOME[id] && sp.at === 'home')
    return `Сейчас ${npc.name} ${LAND_HOME[id].inWords} — заходи к ${npc.fem ? 'ней' : 'нему'} в гости`;
  if (!sp || !home) return null;
  const away = npcAwayWords(id);
  if (away) return `Сейчас ${npc.name} ${away}`;
  if (sp.at === 'door') return `${npc.name} стоит у двери своего домика и встречает гостей 🚪`;
  if (sp.at === 'asleep')
    return `${npc.name} уже спит 😴 Утром ${npc.fem ? 'она' : 'он'} будет дома, а днём ${home.away}`;
  if (sp.at === 'home' && invitedToday(id)) return `${npc.name} ждёт тебя у себя дома — постучись в дверь домика 🚪`;
  if (sp.at === 'home') return `Сейчас ${npc.name} дома — постучись в дверь домика 🚪 А днём ${home.away}`;
  return `${npc.name} ${home.away}, а утром и вечером — дома`;
}
/** «у неё над головой «?»» — или где житель, если его не видно на улице: «она у тебя в гостях, на вилле 🏡». */
function lookFor(id, badge) {
  const away = whereWords(id);
  return away ? `${NPC_BY_ID[id].fem ? 'она' : 'он'} ${away}` : `у ${hisOf(id)} над головой «${badge}»`;
}
/** Показать задание на карте (звёздочкой). false — сейчас показать нечего (сегодня всё собрано и т. п.). */
export function showQuestOnMap(id) {
  const w = questNow(id),
    { where, scene: at } = questGoal(w),
    q = QUEST_BY_ID[id];
  // задание в другом месте, чем хомячок («карта мира»): звёздочка ведёт к дороге туда — подсказать, как идти
  const here = currentLocation().name;
  if (where && at !== here && getLocation(at)) {
    const way = routeText(here, at);
    trackQuest(id);
    sfx('ok');
    toast(
      way
        ? `${q.icon} Это задание — ${LOC_WORDS[at] || 'в другом месте'}. Звёздочка ⭐ покажет дорогу — ${way}.`
        : `${q.icon} Это задание — ${LOC_WORDS[at] || 'в другом месте'}. Туда пока нет дороги.`,
    );
    openMap();
    return true;
  }
  const p = where && (getLocation(at) || homeLocation()).whereIs(where);
  if (!p) {
    toast(
      where === 'herb'
        ? 'Сегодня все находки для гербария уже собраны. Завтра распустится что-то новое! 🌱'
        : 'Сейчас это место на карте не показать',
    );
    return false;
  }
  trackQuest(id);
  sfx('ok');
  openMap();
  return true;
}

// ---------- ход заданий по событиям ----------
const STEP_EVENTS = new Set(QUESTS.flatMap((q) => q.steps.filter((st) => st.on).map((st) => st.on)));
// после этих событий задание могло сдвинуться (шаг «принести» — что-то появилось в рюкзаке или пропало)
// (или шаг «приди в тёплом» — надели или сняли вещь)
const WATCH = new Set([
  ...STEP_EVENTS,
  'herb',
  'find',
  'gather',
  'harvest',
  'buy',
  'sell',
  'cook',
  'eat',
  'wake',
  'wear',
]);

function countEvent(ev, d) {
  const s = S();
  for (const q of QUESTS) {
    const st = s.quests[q.id];
    if (!st || st.done !== null) continue;
    q.steps.forEach((step, i) => {
      if (step.on !== ev || (st.n[i] || 0) >= (step.n || 1)) return;
      // значение в if может быть списком: «любая из работ»
      if (step.if && Object.entries(step.if).some(([k, v]) => (Array.isArray(v) ? !v.includes(d[k]) : d[k] !== v)))
        return;
      if (step.min && Object.entries(step.min).some(([k, v]) => !(d[k] >= v))) return;
      questCount(q.id, i, step.distinct ? d[step.distinct] : undefined);
    });
  }
}

let snap = {},
  snapState = null;
/** Где задания сейчас — сравнить с прошлым разом и подсказать, что изменилось. quiet — только запомнить. */
function refresh(quiet = false) {
  const s = S();
  if (!s) return;
  if (snapState !== s) {
    snapState = s;
    snap = {};
    quiet = true;
  }
  let changed = false;
  for (const q of QUESTS) {
    const w = questNow(q.id);
    const key = w.status === 'active' ? `${w.i}:${w.steps[w.i] ? w.steps[w.i].have : ''}` : w.status;
    const was = snap[q.id];
    snap[q.id] = key;
    if (was === key) continue;
    changed = true;
    if (quiet || was === undefined || w.status !== 'active' || !was.includes(':')) continue;
    const wi = +was.split(':')[0],
      cur = q.steps[w.i];
    if (w.i > wi) {
      sfx('ok');
      if (cur && cur.talk) toast(`${q.icon} Всё готово! ${cur.text} — ${lookFor(cur.talk, '?')}`, 'good');
      else if (cur) toast(`✅ Сделано! Дальше: ${cur.text}`, 'good');
    } else if (w.i === wi && cur && w.steps[w.i].need > 1)
      toast(`${q.icon} ${q.title}: ${w.steps[w.i].have} из ${w.steps[w.i].need}`);
  }
  if (changed) emit('hud');
}
for (const ev of WATCH)
  on(ev, (d) => {
    if (!S()) return;
    if (STEP_EVENTS.has(ev)) countEvent(ev, d);
    refresh();
  });
on('quest', () => refresh());
// новое задание стало можно взять (утром второго дня или при входе в игру) — подсказать один раз
function hintNew() {
  const s = S();
  if (!s) return;
  refresh(true);
  for (const q of QUESTS) {
    if (q.intro || s.flags['questHint:' + q.id] || questNow(q.id).status !== 'ready') continue; // вводное приносят домой
    setFlag('questHint:' + q.id);
    const npc = NPC_BY_ID[q.npc];
    enqueue(() => toast(`❗ ${npc.name} хочет о чём-то тебя попросить — ${lookFor(q.npc, '!')}`, 'good'), {
      delay: 2500,
    });
  }
}
on('wake', hintNew);
on('scene', ({ from }) => {
  if (from === '')
    hintNew(); // игра только началась (новая или продолжение)
  else refresh(); // после загрузки сохранения — запомнить, где задания, чтобы следующий шаг подсказать
});

// ---------- разговор с жителем ----------
/**
 * Зовут диалоги жителей (на улице, у них дома, в гостях) в самом начале: если у жителя есть задание — сначала оно.
 * Возвращает null — заданий нет, говорим как обычно; { end: true } — разговор окончен; { text } — дальше обычный
 * разговор с этой репликой.
 */
export async function questTalk(npcId) {
  if (!S()) return null;
  for (const q of QUESTS) {
    const w = questNow(q.id);
    if (w.status === 'ready' && q.npc === npcId && !q.intro) return offer(q);
    if (w.status !== 'active') continue;
    const cur = q.steps[w.i];
    if (cur && cur.talk === npcId) return talkStep(q, w);
  }
  for (const q of QUESTS) {
    const w = questNow(q.id);
    if (w.status === 'active' && q.npc === npcId) return howGoes(q, w);
  }
  // дел по журналу нет — может, жителю есть о чём расспросить (Профессор и древние рисунки — features/tales.js)
  return taleTalk(npcId);
}
const say = (npcId, text, options, happy = false) =>
  dialog({ look: npcLook(npcId), name: NPC_BY_ID[npcId].name, text, options, happy });

/** Познакомиться с жителем города (у жителей тайных мест — LAND_NPCS — дружбы нет). */
const meet = (npc) => {
  const fr = S().friends[npc];
  if (fr && !fr.met) meetFriend(npc);
};
async function offer(q) {
  const npc = q.npc;
  meet(npc);
  emit('talk', { id: npc });
  const i = await say(npc, q.lines.offer, [{ text: `${q.icon} Помогу!`, cls: 'green' }, { text: 'Потом' }]);
  if (i !== 0) return { text: q.lines.later || 'Хорошо, в другой раз!' };
  takeQuest(q.id);
  // «это уже было» (рекорд в мини-игре до задания) — засчитать сразу
  q.steps.forEach((step, i) => {
    if (step.on && step.already && step.already(S())) questCount(q.id, i);
  });
  trackQuest(q.id);
  sfx('bell');
  const j = await say(
    npc,
    q.lines.accept,
    [
      { text: 'Хорошо!', cls: 'green' },
      { text: '📖 Открыть журнал', cls: 'blue' },
    ],
    true,
  );
  toast(`📖 Новое задание в журнале: ${q.icon} ${q.title}`, 'good');
  emit('hud');
  if (j === 1) run('journal');
  return { end: true };
}

// Своё «как дела» у задания: занятие места (features/mountain.js — Сеня и тёплые вещи) может сказать что-то другое
// вместо строки lines.wait и при этом что-то сделать (подарить шапку). fn(w) → текст | null (тогда — lines.wait).
const waitHooks = {};
/** Своё «как дела» для задания id: fn(w) → текст или null. */
export function setWaitHook(id, fn) {
  waitHooks[id] = fn;
}
async function howGoes(q, w) {
  const npc = q.npc,
    st = w.steps[w.i];
  emit('talk', { id: npc });
  const own = waitHooks[q.id] ? waitHooks[q.id](w) : null;
  const wait = own || (typeof q.lines.wait === 'string' ? q.lines.wait : (q.lines.wait || {})[w.i]);
  const left = st && st.need > 1 ? ` У тебя уже ${st.have} из ${st.need}.` : '';
  const i = await say(npc, `${wait || 'Как успехи?'}${left}`, [
    { text: 'Хорошо, продолжу!', cls: 'green' },
    { text: '📖 Журнал', cls: 'blue' },
    { text: '💬 Поболтать' },
  ]);
  if (i === 1) {
    run('journal');
    return { end: true };
  }
  return i === 2 ? { text: 'Давай поболтаем! О чём?' } : { end: true };
}

async function talkStep(q, w) {
  const step = q.steps[w.i],
    npc = step.talk,
    last = w.i === q.steps.length - 1;
  meet(npc);
  emit('talk', { id: npc });
  if (!last) {
    // шаг «поговори» в середине цепочки; give — житель что-то дарит (Капитан Боб — компас)
    questCount(q.id, w.i);
    if (step.give) {
      const [bag, id, n = 1] = step.give;
      addItem(bag, id, n);
      const f = FIND_BY_ID[id];
      if (f) setTimeout(() => toast(`🎁 +${n} ${f.e} ${f.name} — уже в рюкзаке!`, 'good'), 300);
    }
    await say(npc, step.say || 'Спасибо, что заш{ёл|ла}!', [{ text: 'Хорошо!', cls: 'green' }], true);
    return { end: true };
  }
  const i = await say(npc, step.say || 'Ой! Неужели всё готово? Покажи скорее!', [
    { text: step.btn || `${q.icon} Вот, всё готово!`, cls: 'green' },
    { text: 'Потом' },
  ]);
  if (i !== 0) return { text: 'Хорошо, я подожду!' };
  const got = complete(q);
  await say(npc, q.lines.done, [{ text: 'Спасибо! 💖', cls: 'green' }], true);
  questDone(q, got);
  return { end: true };
}

/** Название вещи из рюкзака для окон: семена, продукт, блюдо. */
function itemName(bag, id) {
  const d =
    bag === 'seeds'
      ? SEED_BY_ID[id]
      : bag === 'ing'
        ? ING_BY_ID[id]
        : bag === 'dishes'
          ? DISH_BY_ID[id]
          : FIND_BY_ID[id];
  return d ? `${d.e ? d.e + ' ' : ''}${d.name}` : id;
}
/**
 * Взять задание без разговора «Поможешь?» (вводная цепочка: житель сам пришёл в гости — features/welcome.js):
 * задание в журнале, звёздочка ведёт к первому шагу.
 */
export function startQuest(id) {
  if (!takeQuest(id)) return false;
  trackQuest(id);
  emit('hud');
  return true;
}
/** Отдать принесённое (шаги bring): находки вида kind — все, предметы с id — сколько просили. */
function giveAway(b, n) {
  const bag = S()[b.bag];
  for (const id of Object.keys(bag)) {
    if (b.id ? id !== b.id : !FIND_BY_ID[id] || FIND_BY_ID[id].kind !== b.kind) continue;
    addItem(b.bag, id, -(b.id ? Math.min(n, bag[id]) : bag[id]));
  }
}
/** Задание сдано: забрать принесённое, выдать награду, открыть место. Возвращает, что получено (для окна). */
function complete(q) {
  for (const step of q.steps) if (step.bring) giveAway(step.bring, step.n || 1);
  finishQuest(q.id);
  const r = q.reward || {},
    got = { coins: r.coins || 0, clothes: null, sticker: null, land: null };
  if (r.clothes) {
    if (addClothes(r.clothes)) got.clothes = CLOTHES_BY_ID[r.clothes];
    else if (!q.intro) got.coins += QUEST_GIFT_COINS; // вводные задания — понемногу: без мешочка взамен
  }
  if (r.items) {
    for (const [bag, id, n = 1] of r.items) addItem(bag, id, n);
    got.items = r.items.map(([bag, id, n = 1]) => `${itemName(bag, id)} ×${n}`).join(', ');
  }
  if (got.coins) earn(got.coins, 'task');
  if (r.sticker) got.sticker = { ...STICKER[r.sticker], isNew: award(r.sticker, { quiet: true }) };
  if (r.open) {
    openLand(r.open);
    got.land = LAND_BY_ID[r.open];
  }
  if (r.recipe) {
    if (!S().recipes.includes(r.recipe)) learnRecipe(r.recipe);
    got.recipe = DISH_BY_ID[r.recipe];
  }
  got.hint = r.hint || null;
  if (tracked === q.id) tracked = null;
  emit('hud');
  return got;
}

/** Праздничное окно «Задание выполнено!»: конфетти, наклейка, подарок, открытое место. */
function questDone(q, got) {
  const st = got.sticker;
  const lines = [
    got.land
      ? `<p class="land-open">${got.land.icon} <b>${got.land.name} ${got.land.opened || 'открыт'}!</b><br>${got.land.at ? `Вход — ${got.land.at}.` : ''}</p>`
      : '',
    st ? `<p>Наклейка «${st.title}» ${st.isNew ? '— новая в альбоме!' : '— такая у тебя уже есть.'}</p>` : '',
    got.clothes ? `<p>🎁 Подарок: <b>${got.clothes.name}</b> — уже в шкафу!</p>` : '',
    got.items ? `<p>🎁 В рюкзаке: <b>${got.items}</b></p>` : '',
    got.recipe ? `<p>📜 Секретный рецепт: <b>${got.recipe.e} ${got.recipe.name}</b> — готовь на кухне!</p>` : '',
    got.coins ? `<p class="reward">🪙 +${fmtMoney(got.coins)} монет</p>` : '',
    got.hint ? `<p class="muted">${got.hint}</p>` : '',
  ].join('');
  const head = `${q.icon} ${q.title}`;
  celebrate({ title: 'Задание выполнено!', icon: '🎉', sticker: st && st.sticker, head, lines, delay: 500 });
}

// ---------- журнал (вкладка альбома) ----------
/** Нарисовать журнал в тело окна альбома. panel — окно (закрыть, когда идём к карте). */
export function renderJournal(body, panel) {
  if (journalTop) journalTop(body, panel);
  const all = QUESTS.map((q) => questNow(q.id));
  const active = all.filter((w) => w.status === 'active'),
    ready = all.filter((w) => w.status === 'ready' && !w.q.intro),
    done = all.filter((w) => w.status === 'done');
  const mapBtn = (w) => {
    const b = el('button', 'btn small yellow', '🗺️ Показать на карте');
    b.onclick = () => {
      if (showQuestOnMap(w.q.id)) panel.close();
    };
    return b;
  };
  if (!active.length && !ready.length)
    body.appendChild(
      el(
        'p',
        'muted center',
        done.length
          ? 'Новых заданий пока нет. Загляни сюда позже!'
          : 'Пока заданий нет. Жители города иногда просят о помощи: у кого над головой «!», у того есть задание.',
      ),
    );
  for (const w of active) {
    const q = w.q,
      npc = NPC_BY_ID[q.npc];
    const card = el('div', 'quest');
    card.appendChild(
      el(
        'div',
        'q-head',
        `<span class="q-ic">${q.icon}</span><div><div class="ttl">${q.title}</div><div class="sub">Просит ${npc.name}</div></div>`,
      ),
    );
    card.appendChild(el('p', 'q-story', q.story));
    const ol = el('ol', 'q-steps');
    q.steps.forEach((step, i) => {
      const x = w.steps[i],
        cur = i === w.i;
      const prog = x.need > 1 ? ` <b>${x.have}/${x.need}</b>` : '';
      const hint = cur && ((step.talk && npcHint(step.talk)) || step.hint);
      const li = el(
        'li',
        x.ok ? 'ok' : cur ? 'cur' : 'todo',
        `${x.ok ? '✅' : cur ? '👉' : '▫️'} ${step.text}${prog}${hint ? `<div class="q-hint">📍 ${hint}</div>` : ''}`,
      );
      if (cur && step.bring && step.bring.kind) li.appendChild(findsRow(step.bring.kind));
      ol.appendChild(li);
    });
    card.appendChild(ol);
    card.appendChild(mapBtn(w));
    body.appendChild(card);
  }
  for (const w of ready) {
    const q = w.q,
      npc = NPC_BY_ID[q.npc];
    const card = el('div', 'quest new');
    card.appendChild(
      el(
        'div',
        'q-head',
        `<span class="q-ic">❗</span><div><div class="ttl">Новое задание!</div><div class="sub">${npc.name} хочет о чём-то попросить — ${readyWhere(q)}</div></div>`,
      ),
    );
    card.appendChild(mapBtn(w));
    body.appendChild(card);
  }
  if (done.length) {
    body.appendChild(el('h4', 'q-done-h', '✅ Выполнено'));
    for (const w of done) {
      const land = w.q.reward && w.q.reward.open && LAND_BY_ID[w.q.reward.open];
      body.appendChild(
        el(
          'div',
          'list-item q-done',
          `<div class="grow"><div class="ttl">${w.q.icon} ${w.q.title}</div><div class="sub">${land ? `Открыто новое место: ${land.icon} ${land.name}` : 'Готово!'}</div></div>`,
        ),
      );
    }
  }
}
/** Что уже собрано для задания «принеси разные находки»: значки из рюкзака. */
function findsRow(kind) {
  const have = Object.keys(S().finds).filter(
    (id) => FIND_BY_ID[id] && FIND_BY_ID[id].kind === kind && S().finds[id] > 0,
  );
  return el(
    'div',
    'q-finds',
    have.length
      ? have.map((id) => `<span title="${FIND_BY_ID[id].name}">${FIND_BY_ID[id].e}</span>`).join('')
      : '<span class="muted">пока ничего</span>',
  );
}

// ---------- плашка в HUD ----------
/**
 * Плашка задания из журнала: { text, short, cls } или null — показывать нечего. short — коротко, для телефона.
 * Сначала задание, к которому сейчас звёздочка, потом любое взятое, потом то, которое можно взять.
 */
export function questChip() {
  if (!S()) return null;
  const all = QUESTS.map((q) => questNow(q.id));
  const w =
    all.find((x) => x.q.id === tracked && x.status === 'active') ||
    all.find((x) => x.status === 'active') ||
    all.find((x) => x.status === 'ready' && !x.q.intro);
  if (!w) return null;
  const q = w.q;
  if (w.status === 'ready') {
    const name = NPC_BY_ID[q.npc].name;
    return { text: `❗ ${name} просит о помощи`, short: `❗ ${name}`, cls: 'new' };
  }
  const step = q.steps[w.i],
    x = w.steps[w.i];
  if (step && step.talk) return { text: `❓ ${step.text}`, short: `❓ ${NPC_BY_ID[step.talk].name}`, cls: 'ready' };
  const prog = x && x.need > 1 ? `${x.have}/${x.need}` : `шаг ${w.i + 1}`;
  return { text: `${q.icon} ${q.title} · ${prog}`, short: `${q.icon} ${prog}`, cls: '' };
}

// ---------- закрытый проход: «поговори с …» ----------
// Задание с полем door (гербарий Мяты — тропа в лес) появляется, когда хомячок наткнулась на закрытый вход: подошла
// к воротам в городе или нажала на них (openWay) — отметка door:<место>. Как только задание можно взять (и вводная
// цепочка позади — when в data/quests.js), один раз: подсказка «поговори с Мятой» и звёздочка к ней (туда, где она
// сейчас, — npcSpot).
const DOOR_QUESTS = QUESTS.filter((q) => q.door),
  DOOR_NEAR = 2.5 * 48, // «подошла»: столько пикселей до ворот
  DOOR_EVERY = 0.3; // как часто проверять, секунды
let doorT = 0;
/** Хомячок у закрытого входа в место id — запомнить (один раз). */
function markDoor(id) {
  if (DOOR_QUESTS.some((q) => q.door === id) && !S().flags['door:' + id]) setFlag('door:' + id);
}
/** Задание «за закрытым входом» стало можно взять — подсказать и повести звёздочку к жителю. quiet — без подсказки. */
function doorHints(quiet = false) {
  const s = S();
  for (const q of DOOR_QUESTS) {
    if (!s.flags['door:' + q.door] || s.flags['doorHint:' + q.id] || questNow(q.id).status !== 'ready') continue;
    setFlag('doorHint:' + q.id);
    setFlag('questHint:' + q.id); // общая подсказка «хочет о чём-то попросить» уже не нужна
    trackQuest(q.id);
    emit('hud');
    const land = LAND_BY_ID[q.door],
      npc = NPC_BY_ID[q.npc];
    if (!quiet)
      toast(
        `${land.icon} ${land.door} ${land.who} знает дорогу — поговори с ${her(q.npc)}! ⭐ Звёздочка покажет, где ${npc.name}.`,
        'good',
      );
  }
}
on('step', ({ dt = 0 } = {}) => {
  const s = S(),
    sc = scene();
  if (!s || !sc || !DOOR_QUESTS.length) return;
  doorT += dt;
  if (doorT < DOOR_EVERY) return;
  doorT = 0;
  if (sc.name === HOME_SCENE && sc.whereIs)
    for (const q of DOOR_QUESTS) {
      if (s.flags['door:' + q.door] || landOpen(q.door)) continue;
      const p = sc.whereIs(q.door);
      if (p && Math.hypot(sc.p.x - p.x, sc.p.y - p.y) < DOOR_NEAR) markDoor(q.door);
    }
  doorHints();
});

// ---------- входы в тайные места ----------
/** Вход в место из LANDS: закрыто — кто знает дорогу; открыто — в сцену места (или своя дорога go). */
export function openWay(id) {
  const land = LAND_BY_ID[id];
  if (!land) return;
  sfx('tap');
  if (landOpen(id)) {
    if (land.go) {
      run(land.go); // своя дорога (вагончик канатной дороги)
      return;
    }
    go(land.scene, { at: land.entry });
    return;
  }
  markDoor(id); // наткнулась на закрытый вход — задание Мяты может появиться прямо сейчас
  doorHints(true); // окно ниже само скажет «поговори с …»
  // у каждого места в LANDS есть сцена и задание-открытие (data/places.js)
  const q = QUEST_BY_ID[land.quest],
    w = questNow(q.id),
    npc = NPC_BY_ID[land.npc];
  const door = land.door || 'Сюда пока не пройти.';
  let text,
    buttons = [{ text: 'Хорошо' }],
    act = null;
  if (w.status === 'locked' && S().flags.intro === 1) {
    // идёт вводная цепочка: сначала соседи покажут городок (data/quests.js, when гербария)
    text = `${door} Говорят, ${land.who} знает дорогу… Сейчас ${npc.fem ? 'она занята' : 'он занят'} — загляни к ${toHim(land.npc)}, когда освоишься в городке!`;
  } else if (w.status === 'locked') {
    text = `${door} Говорят, ${land.who} знает дорогу… Сегодня ${npc.fem ? 'она занята' : 'он занят'} — загляни к ${toHim(land.npc)} завтра!`;
  } else if (w.status === 'ready') {
    text = `${door} ${land.who} знает дорогу — поговори с ${her(land.npc)}! Над головой у ${hisOf(land.npc)} «!».`;
    buttons = [
      { text: `⭐ Где ${npc.name}?`, cls: 'yellow' },
      { text: 'Хорошо', cls: 'ghost' },
    ];
    act = () => showQuestOnMap(q.id);
  } else {
    text = `${door} ${land.who} уже ${npc.fem ? 'рассказала' : 'рассказал'}, что нужно сделать, — всё записано в журнале 📖`;
    buttons = [
      { text: '📖 Журнал', cls: 'blue' },
      { text: 'Хорошо', cls: 'ghost' },
    ];
    act = () => run('journal');
  }
  message({
    title: land.name,
    icon: '🔒',
    html: `<p class="center big-emoji way-lock"><span class="ic">${land.icon}</span><span class="lk">🔒</span></p><p class="center">${esc(text)}</p>`,
    buttons,
  }).then((i) => {
    if (i === 0 && act) act();
  });
}
register('way', (p) => openWay(p.arg || p.id), 'вход в тайное место: way:<место из LANDS> — закрыто: кто знает дорогу');
