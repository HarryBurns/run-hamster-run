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
import { go } from '../core/loop.js';
import { register, run } from '../core/registry.js';
import { G, questNow, landOpen } from '../core/state.js';
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
} from '../data/index.js';
import { homeLocation, currentLocation, getLocation, setTargetHook } from '../engine/topdown/index.js';
import { dialog } from '../ui/dialog.js';
import { enqueue } from '../ui/modals.js';
import { message } from '../ui/panel.js';
import { toast } from '../ui/toast.js';
import { openMap } from './map.js';

const S = () => G.state;
const STICKER = Object.fromEntries(EXTRA_STICKERS.map((q) => [q.id, q]));
const her = (npc) => (NPC_BY_ID[npc].fem ? 'ней' : 'ним'); // «с ней / с ним»
const hisOf = (npc) => (NPC_BY_ID[npc].fem ? 'неё' : 'него'); // «у неё / у него»
const toHim = (npc) => (NPC_BY_ID[npc].fem ? 'ней' : 'нему'); // «к ней / к нему»

// ---------- звёздочка-указатель ----------
// К какому заданию показывает звёздочка (та же, что у письма; важнее письма). Берут задание — звёздочка ведёт
// к первому шагу; «Показать на карте» в журнале — к текущему шагу; нажали на плашку письма — снова к письму.
let tracked = null;
/** Показывать звёздочкой задание id (null — снова письмо). */
export function trackQuest(id) {
  tracked = id;
}
export const trackedQuest = () => tracked;
/** Куда ведёт задание сейчас: имя точки для sc.whereIs (житель, место, здание…) или null. */
function questWhere(w) {
  if (w.status === 'ready') return 'npc:' + w.q.npc;
  if (w.status !== 'active') return null;
  const step = w.q.steps[w.i];
  return step ? step.where || (step.talk ? 'npc:' + step.talk : null) : null;
}
setTargetHook((sc) => {
  if (!tracked || !S()) return null;
  const w = questNow(tracked);
  if (w.status === 'done') {
    tracked = null;
    return null;
  }
  const where = questWhere(w),
    p = where && sc.whereIs(where);
  if (!p) return null;
  // над жителем — повыше, над значком «!» / «?»
  return { x: p.x, y: where.startsWith('npc:') ? p.y - 62 : p.y, icon: '⭐' };
});
/** Где искать того, кто дал задание: «в городе» или «в лесу» (поле loc задания — локация, где оно идёт). */
const placeOf = (q) => (q.loc ? `в ${LOC_WORDS[q.loc] || 'другом месте'}` : 'в городе');
const LOC_WORDS = { forest: 'лесу', mountain: 'горах', caves: 'пещерах', desert: 'пустыне', jungle: 'джунглях' };
/** Показать задание на карте (звёздочкой). false — сейчас показать нечего (сегодня всё собрано и т. п.). */
export function showQuestOnMap(id) {
  const w = questNow(id),
    where = questWhere(w),
    q = QUEST_BY_ID[id];
  // задание в другой локации (лес): звёздочка видна только там — подсказать, куда идти
  if (q.loc && currentLocation().name !== q.loc) {
    trackQuest(id);
    sfx('ok');
    toast(`${q.icon} Это задание — ${placeOf(q)}. Звёздочка покажет дорогу, когда ты будешь там.`);
    openMap();
    return true;
  }
  const p = where && (q.loc ? getLocation(q.loc) : homeLocation()).whereIs(where);
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
const WATCH = new Set([...STEP_EVENTS, 'herb', 'find', 'gather', 'harvest', 'buy', 'sell', 'cook', 'eat', 'wake', 'wear']);

function countEvent(ev, d) {
  const s = S();
  for (const q of QUESTS) {
    const st = s.quests[q.id];
    if (!st || st.done !== null) continue;
    q.steps.forEach((step, i) => {
      if (step.on !== ev || (st.n[i] || 0) >= (step.n || 1)) return;
      if (step.if && Object.entries(step.if).some(([k, v]) => d[k] !== v)) return;
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
      if (cur && cur.talk) toast(`${q.icon} Всё готово! ${cur.text} — у ${hisOf(cur.talk)} над головой «?»`, 'good');
      else if (cur) toast(`✅ Сделано! Дальше: ${cur.text}`, 'good');
    } else if (w.i === wi && cur && w.steps[w.i].need > 1) toast(`${q.icon} ${q.title}: ${w.steps[w.i].have} из ${w.steps[w.i].need}`);
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
    if (s.flags['questHint:' + q.id] || questNow(q.id).status !== 'ready') continue;
    setFlag('questHint:' + q.id);
    const npc = NPC_BY_ID[q.npc];
    enqueue(() => toast(`❗ ${npc.name} хочет о чём-то тебя попросить — у ${hisOf(q.npc)} над головой «!»`, 'good'), {
      delay: 2500,
    });
  }
}
on('wake', hintNew);
on('scene', ({ from }) => {
  if (from === '') hintNew(); // игра только началась (новая или продолжение)
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
    if (w.status === 'ready' && q.npc === npcId) return offer(q);
    if (w.status !== 'active') continue;
    const cur = q.steps[w.i];
    if (cur && cur.talk === npcId) return talkStep(q, w);
  }
  for (const q of QUESTS) {
    const w = questNow(q.id);
    if (w.status === 'active' && q.npc === npcId) return howGoes(q, w);
  }
  return null;
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
  const j = await say(npc, q.lines.accept, [{ text: 'Хорошо!', cls: 'green' }, { text: '📖 Открыть журнал', cls: 'blue' }], true);
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
    // шаг «поговори» в середине цепочки
    questCount(q.id, w.i);
    await say(npc, step.say || 'Спасибо, что зашла!', [{ text: 'Хорошо!', cls: 'green' }], true);
    return { end: true };
  }
  const i = await say(npc, step.say || 'Ой! Неужели всё готово? Покажи скорее!', [
    { text: step.btn || `${q.icon} Вот, всё готово!`, cls: 'green' },
    { text: 'Потом' },
  ]);
  if (i !== 0) return { text: 'Хорошо, я подожду!' };
  const got = complete(q);
  await say(npc, q.lines.done, [{ text: 'Спасибо! 💖', cls: 'green' }], true);
  celebrate(q, got);
  return { end: true };
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
    else got.coins += QUEST_GIFT_COINS;
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
function celebrate(q, got) {
  const bits = Array.from({ length: 28 }, (_, i) => {
    const col = ['#ff6b9d', '#ffd43b', '#69db7c', '#74c0fc', '#b197fc', '#ffa94d'][i % 6];
    return `<i style="left:${(i * 37) % 100}%;background:${col};animation-delay:${((i * 0.13) % 1.4).toFixed(2)}s;animation-duration:${(2.2 + ((i * 0.31) % 1.2)).toFixed(2)}s"></i>`;
  }).join('');
  const st = got.sticker;
  const lines = [
    got.land ? `<p class="land-open">${got.land.icon} <b>${got.land.name} ${got.land.opened || 'открыт'}!</b><br>${got.land.at ? `Вход — ${got.land.at}.` : ''}</p>` : '',
    st ? `<p>Наклейка «${st.title}» ${st.isNew ? '— новая в альбоме!' : '— такая у тебя уже есть.'}</p>` : '',
    got.clothes ? `<p>🎁 Подарок: <b>${got.clothes.name}</b> — уже в шкафу!</p>` : '',
    got.recipe ? `<p>📜 Секретный рецепт: <b>${got.recipe.e} ${got.recipe.name}</b> — готовь на кухне!</p>` : '',
    got.coins ? `<p class="reward">🪙 +${fmtMoney(got.coins)} монет</p>` : '',
    got.hint ? `<p class="muted">${got.hint}</p>` : '',
  ].join('');
  enqueue(
    () => {
      sfx('fanfare');
      message({
        title: 'Задание выполнено!',
        icon: '🎉',
        html: `<div class="quest-done center"><div class="confetti">${bits}</div>${st ? `<div class="sticker got">${st.sticker}</div>` : ''}<p><b>${q.icon} ${q.title}</b></p>${lines}</div>`,
        buttons: [{ text: 'Ура!' }],
      });
    },
    { delay: 500 },
  );
}

// ---------- журнал (вкладка альбома) ----------
/** Нарисовать журнал в тело окна альбома. panel — окно (закрыть, когда идём к карте). */
export function renderJournal(body, panel) {
  const all = QUESTS.map((q) => questNow(q.id));
  const active = all.filter((w) => w.status === 'active'),
    ready = all.filter((w) => w.status === 'ready'),
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
      el('div', 'q-head', `<span class="q-ic">${q.icon}</span><div><div class="ttl">${q.title}</div><div class="sub">Просит ${npc.name}</div></div>`),
    );
    card.appendChild(el('p', 'q-story', q.story));
    const ol = el('ol', 'q-steps');
    q.steps.forEach((step, i) => {
      const x = w.steps[i],
        cur = i === w.i;
      const prog = x.need > 1 ? ` <b>${x.have}/${x.need}</b>` : '';
      const li = el(
        'li',
        x.ok ? 'ok' : cur ? 'cur' : 'todo',
        `${x.ok ? '✅' : cur ? '👉' : '▫️'} ${step.text}${prog}${cur && step.hint ? `<div class="q-hint">📍 ${step.hint}</div>` : ''}`,
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
        `<span class="q-ic">❗</span><div><div class="ttl">Новое задание!</div><div class="sub">${npc.name} хочет о чём-то попросить — найди ${npc.fem ? 'её' : 'его'} ${placeOf(q)}. Над головой у ${hisOf(q.npc)} «!».</div></div>`,
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
  const have = Object.keys(S().finds).filter((id) => FIND_BY_ID[id] && FIND_BY_ID[id].kind === kind && S().finds[id] > 0);
  return el(
    'div',
    'q-finds',
    have.length ? have.map((id) => `<span title="${FIND_BY_ID[id].name}">${FIND_BY_ID[id].e}</span>`).join('') : '<span class="muted">пока ничего</span>',
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
    all.find((x) => x.status === 'ready');
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

// ---------- входы в тайные места ----------
/** Вход в место из LANDS: закрыто — кто знает дорогу; открыто — в сцену места (или «готовится», пока её нет). */
export function openWay(id) {
  const land = LAND_BY_ID[id];
  if (!land) return;
  sfx('tap');
  if (landOpen(id)) {
    if (land.go) {
      run(land.go); // своя дорога (вагончик канатной дороги)
      return;
    }
    if (land.scene) {
      go(land.scene, { at: land.entry });
      return;
    }
    message({
      title: land.name,
      icon: land.icon,
      html: `<p class="center big-emoji">${land.icon}</p><p class="center">${land.ready || `${land.name} ${land.opened || 'открыт'}! Загляни чуть позже.`}</p>`,
      buttons: [{ text: 'Хорошо!' }],
    });
    return;
  }
  const q = land.quest && QUEST_BY_ID[land.quest],
    w = q && questNow(q.id),
    npc = land.npc && NPC_BY_ID[land.npc];
  const door = land.door || 'Сюда пока не пройти.';
  let text,
    buttons = [{ text: 'Хорошо' }],
    act = null;
  if (!w) {
    text = `${door} Говорят, ${land.who} знает, как туда попасть… Только дорогу сюда ещё прокладывают — она откроется в одном из следующих обновлений игры.`;
  } else if (w.status === 'locked') {
    text = `${door} Говорят, ${land.who} знает дорогу… Сегодня ${npc.fem ? 'она занята' : 'он занят'} — загляни к ${toHim(land.npc)} завтра!`;
  } else if (w.status === 'ready') {
    text = `${door} ${land.who} знает дорогу — поговори с ${her(land.npc)}! Над головой у ${hisOf(land.npc)} «!».`;
    buttons = [{ text: `⭐ Где ${npc.name}?`, cls: 'yellow' }, { text: 'Хорошо', cls: 'ghost' }];
    act = () => showQuestOnMap(q.id);
  } else {
    text = `${door} ${land.who} уже ${npc.fem ? 'рассказала' : 'рассказал'}, что нужно сделать, — всё записано в журнале 📖`;
    buttons = [{ text: '📖 Журнал', cls: 'blue' }, { text: 'Хорошо', cls: 'ghost' }];
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
