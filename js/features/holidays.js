// ПРАЗДНИКИ (П.13): ОБЩИЙ МЕХАНИЗМ — какой сегодня праздник, утреннее объявление, праздничное задание в журнале,
// плашка и значок в HUD, праздничный календарь, ход праздничных занятий, подарок раз в год, звёздочка-указатель.
//
// Таблица праздников — data/holidays.js (HOLIDAYS), числа — HOLIDAY в economy.js, украшения города —
// locations/holidays.js. Сами занятия праздников (нарядить ёлку, колядки, фонарики, блины, канат…) — в своих файлах:
// features/holidays_winter.js — Новый год, Рождество, Китайский Новый год, Масленица. Они регистрируют:
//   holidayActs({ имя: fn(p, ctx) })   действия holiday:<имя> (места в городе, находки)
//   holidayTalk(id, { talk })          свой разговор с жителем в этот праздник (подарок другу на Новый год)
//   holidayDoor(id, { knock })         свой стук в дверь домика (колядки на Рождество)
// и зовут holidayStep(праздник, шаг, кто?) — шаг сделан. Шаги, которые считаются по событиям (испекла блины, угостила
// друга, сыграла в мини-игру), описаны прямо в таблице: on — событие, if — какие поля должны совпасть, distinct —
// по какому полю считать «разных» (друзей).
//
// Состояние. Ход праздника — в отметках дня dayFlags.holiday (шаг → сколько или список «кто уже»; told — объявление
// показано), поэтому утром он сбрасывается сам, а сохранение и загрузка посреди праздника его не теряют. Подарок
// и монеты — раз в год: flags['hol:<праздник>'] = номер года (праздник повторяется каждый игровой год). Версия
// сохранения не менялась (5). Меняют состояние только действия (setDayFlag, setFlag, earn, addClothes…).
import { setDayFlag, setFlag, earn, addClothes, addItem, learnRecipe, award } from '../core/actions.js';
import { sfx } from '../core/audio.js';
import { on, emit } from '../core/events.js';
import { register } from '../core/registry.js';
import { G, cal, hasClothes, houseItems, ownedHomes, questNow } from '../core/state.js';
import { el, fmtMoney, pick } from '../core/util.js';
import {
  HOLIDAYS,
  HOLIDAY_BY_ID,
  HOLIDAY,
  MONTHS,
  NPC_BY_ID,
  CLOTHES_BY_ID,
  DISH_BY_ID,
  FURN_BY_ID,
  EXTRA_STICKERS,
  holidayOn,
  holidayOffset,
  holidayYear,
  nextHoliday,
  holidayLine,
  decorsOn,
} from '../data/index.js';
import { currentLocation } from '../engine/topdown/index.js';
import { enqueue } from '../ui/modals.js';
import { message, openPanel } from '../ui/panel.js';
import { toast } from '../ui/toast.js';
import { talkHooks } from './friends.js';
import { doorHooks } from './visits.js';
import { setExtraTarget, setJournalTop, trackQuest, trackedQuest } from './quests.js';
import { openMap } from './map.js';

const S = () => G.state;
const HF = () => (S() && S().dayFlags.holiday) || {};
const STICKER = Object.fromEntries(EXTRA_STICKERS.map((q) => [q.id, q]));

// ---------- что сегодня ----------
/** Праздник сегодня (или null). */
export const holidayToday = () => (S() ? holidayOn(S().day) : null);
/** Праздник завтра (сегодня — канун; или null). */
export const holidayTomorrow = () => (S() ? holidayOn(S().day + 1) : null);
/** Год праздника сегодня (подарок — раз в этот год). */
const yearNow = () => holidayYear(S().day);
/** Подарок и монеты этого праздника уже получены в этом году. */
export const holidayRewarded = (h) => !!S() && S().flags['hol:' + h.id] === yearNow();

// ---------- ход праздничных занятий ----------
/** Сколько сделано на шаге (список «кто уже» — его длина). */
function stepHave(step) {
  const v = HF()[step.id];
  return Array.isArray(v) ? v.length : v || 0;
}
/**
 * Где праздник сейчас: { h, steps: [{ step, have, need, ok }], i — первый несделанный шаг (steps.length — всё),
 * done — всё сделано, rewarded — подарок этого года получен }. h — праздник сегодня (или переданный).
 */
export function holidayState(h = holidayToday()) {
  if (!h) return null;
  const today = holidayToday() === h;
  const steps = h.steps.map((step) => {
    const need = step.n || 1,
      have = today ? Math.min(need, stepHave(step)) : 0;
    return { step, have, need, ok: have >= need };
  });
  let i = steps.findIndex((x) => !x.ok);
  if (i < 0) i = steps.length;
  return { h, steps, i, done: i >= steps.length, rewarded: holidayRewarded(h), today };
}
/** Сделан ли сегодня шаг праздника (для разговоров и сцен). who — «у этого ли друга / дома». */
export function stepDoneFor(holidayId, stepId, who) {
  const h = holidayToday();
  if (!h || h.id !== holidayId) return false;
  const v = HF()[stepId];
  return who === undefined ? !!v : Array.isArray(v) && v.includes(who);
}
/** Нужен ли ещё шаг (праздник сегодня, шаг не доделан). */
export function stepWanted(holidayId, stepId) {
  const st = holidayState();
  if (!st || st.h.id !== holidayId) return false;
  const x = st.steps.find((q) => q.step.id === stepId);
  return !!x && !x.ok;
}
/**
 * Шаг праздника сделан ещё раз. who — для шагов «разные» (друг, домик, конверт): один и тот же второй раз не
 * считается. Возвращает true, если засчитано. Праздник не сегодня — ничего.
 */
export function holidayStep(holidayId, stepId, who) {
  const h = holidayToday();
  if (!h || h.id !== holidayId) return false;
  const step = h.steps.find((q) => q.id === stepId);
  if (!step) return false;
  const need = step.n || 1,
    v = HF()[stepId];
  if (who !== undefined) {
    const list = Array.isArray(v) ? v : [];
    if (list.includes(who) || list.length >= need) return false;
    setDayFlag(stepId, [...list, who], 'holiday');
  } else {
    if ((v || 0) >= need) return false;
    setDayFlag(stepId, (v || 0) + 1, 'holiday');
  }
  emit('holiday', { id: h.id, what: stepId });
  const st = holidayState(h),
    x = st.steps.find((q) => q.step.id === stepId);
  if (st.done) finishHoliday(h);
  else if (x.ok) {
    const next = st.steps[st.i];
    sfx('ok');
    toast(`✅ ${h.icon} Готово! Дальше: ${next.step.text}`, 'good');
  } else if (x.need > 1) toast(`${h.icon} ${step.text}: ${x.have} из ${x.need}`);
  emit('hud');
  return true;
}
// Шаги, которые считаются по событиям: { on: событие, if: { поле: значение }, distinct: поле «кто» }
const STEP_EVENTS = new Set(HOLIDAYS.flatMap((h) => h.steps.filter((st) => st.on).map((st) => st.on)));
for (const ev of STEP_EVENTS)
  on(ev, (d = {}) => {
    const h = holidayToday();
    if (!h) return;
    for (const step of h.steps) {
      if (step.on !== ev) continue;
      if (step.if && Object.entries(step.if).some(([k, val]) => d[k] !== val)) continue;
      holidayStep(h.id, step.id, step.distinct ? d[step.distinct] : undefined);
    }
  });

// ---------- подарок раз в год ----------
/** Есть ли уже вещь-подарок: одежда в шкафу, рецепт в книге, мебель — в кладовке или в любом своём доме. */
function giftOwned(g) {
  const s = S();
  if (g.clothes) return hasClothes(g.clothes);
  if (g.recipe) return s.recipes.includes(g.recipe);
  if (g.furn) return (s.storage[g.furn] || 0) > 0 || ownedHomes().some((k) => houseItems(k).some((i) => i.id === g.furn));
  return false;
}
/** Название подарка (для окон): «Новогодний колпак», «рецепт: Медовые пряники», «Самовар». */
export function giftName(g) {
  if (g.clothes) return `${CLOTHES_BY_ID[g.clothes].name}`;
  if (g.recipe) return `рецепт «${DISH_BY_ID[g.recipe].e} ${DISH_BY_ID[g.recipe].name}»`;
  if (g.furn) return `${FURN_BY_ID[g.furn].name}`;
  return '';
}
/** Все праздничные занятия дня сделаны: монеты, подарок (раз в год), наклейка, праздничное окно. */
function finishHoliday(h) {
  if (holidayRewarded(h)) {
    sfx('fanfare');
    toast(`${h.icon} Ура! Всё на празднике сделано. Подарок этого года у тебя уже есть 💝`, 'good');
    emit('holiday', { id: h.id, what: 'done' });
    return;
  }
  setFlag('hol:' + h.id, yearNow());
  const g = h.gift || {},
    got = { coins: HOLIDAY.coins[h.id] || 0, gift: null, again: false };
  if (giftOwned(g)) {
    got.again = true;
    got.coins += HOLIDAY.again;
  } else {
    if (g.clothes) addClothes(g.clothes);
    if (g.recipe) learnRecipe(g.recipe);
    if (g.furn) addItem('storage', g.furn, 1);
    got.gift = giftName(g);
  }
  if (got.coins) earn(got.coins, 'gift');
  const isNew = h.sticker ? award(h.sticker, { quiet: true }) : false;
  if (tracking) tracking = false;
  emit('holiday', { id: h.id, what: 'done' });
  emit('hud');
  celebrate(h, got, isNew);
}
function celebrate(h, got, isNew) {
  const bits = Array.from({ length: 28 }, (_, i) => {
    const col = ['#ff6b9d', '#ffd43b', '#69db7c', '#74c0fc', '#b197fc', '#ffa94d'][i % 6];
    return `<i style="left:${(i * 37) % 100}%;background:${col};animation-delay:${((i * 0.13) % 1.4).toFixed(2)}s;animation-duration:${(2.2 + ((i * 0.31) % 1.2)).toFixed(2)}s"></i>`;
  }).join('');
  const st = STICKER[h.sticker];
  const g = h.gift || {};
  const where = g.clothes ? 'уже в шкафу!' : g.recipe ? 'готовь на кухне!' : g.furn ? 'лежит в кладовке — поставь дома через 🔨!' : '';
  const lines = [
    got.gift ? `<p>🎁 Праздничный подарок: <b>${got.gift}</b> — ${where}</p>` : '',
    got.again ? `<p>🎁 ${giftName(g)} у тебя уже есть — держи праздничный мешочек монет!</p>` : '',
    st ? `<p>Наклейка «${st.title}» ${isNew ? '— новая в альбоме!' : '— такая у тебя уже есть.'}</p>` : '',
    got.coins ? `<p class="reward">🪙 +${fmtMoney(got.coins)} монет</p>` : '',
    '<p class="muted">Этот праздник будет снова через год — с новым подарком!</p>',
  ].join('');
  enqueue(
    () => {
      sfx('fanfare');
      message({
        title: `${h.name}!`,
        icon: h.icon,
        html: `<div class="quest-done center"><div class="confetti">${bits}</div>${st ? `<div class="sticker got">${st.sticker}</div>` : ''}<p><b>${h.icon} Все праздничные занятия сделаны!</b></p>${lines}</div>`,
        buttons: [{ text: 'Ура!' }],
      });
    },
    { delay: 600 },
  );
}

// ---------- объявление утром ----------
const dateText = (h) => `${MONTHS[h.month].toLowerCase()}, день ${h.dom}`;
function stepsHtml(h) {
  return `<ol class="hol-steps">${h.steps.map((st) => `<li>${st.text}${st.n > 1 ? ` <b>(${st.n})</b>` : ''}</li>`).join('')}</ol>`;
}
/** Сказать о празднике один раз за день: утром (после сна) и когда игра только открылась. */
export function announceHoliday() {
  const s = S();
  if (!s || HF().told) return;
  const h = holidayToday(),
    t = holidayTomorrow();
  const after = decorsOn(s.day).find(({ k }) => k > 0);
  if (!h && !t && !after) return;
  setDayFlag('told', 1, 'holiday');
  if (h) {
    enqueue(
      () => {
        sfx('fanfare');
        return message({
          title: `${h.name}!`,
          icon: h.icon,
          html: `<div class="center big-emoji">${h.icon}</div><p class="center">Сегодня <b>${h.name}</b>! ${h.story}</p>${stepsHtml(h)}<p class="center">🎁 Подарок праздника: <b>${giftName(h.gift)}</b>${holidayRewarded(h) ? ' — в этом году уже получен ✅' : ''}</p>`,
          buttons: [{ text: 'Ура! 🎉' }, { text: '⭐ Показать на карте', cls: 'yellow' }],
        }).then((i) => {
          if (i === 1) showHolidayOnMap();
        });
      },
      { delay: 1300 },
    );
  } else {
    // наутро после Нового года — поздравление (и про завтрашний праздник, если он есть)
    const ny = after && after.h.id === 'newyear' ? `🎆 С Новым годом! Наступил год ${cal().year}. Ёлка на площади ещё постоит!` : '';
    const eve = t ? `${t.icon} Завтра — ${t.name}! Город уже украшают к празднику.` : '';
    if (ny || eve) enqueue(() => toast([ny, eve].filter(Boolean).join(' '), 'good'), { delay: 2600 });
  }
}
on('wake', announceHoliday);
on('scene', ({ from }) => {
  if (from === '') setTimeout(announceHoliday, 400); // игра только открылась (новая или продолжение)
});

// ---------- жители радуются празднику ----------
/** Праздничная реплика жителя id (накануне, в праздник, наутро) или null. */
export function holidayLineFor(id) {
  const s = S(),
    npc = NPC_BY_ID[id];
  if (!s || !npc) return null;
  for (const { h, k } of decorsOn(s.day)) {
    const list = h.lines[k < 0 ? 'eve' : k === 0 ? 'day' : 'after'];
    if (list && list.length) return holidayLine(pick(list), s.name, npc.fem);
  }
  return null;
}
talkHooks.greet = (id) => holidayLineFor(id);
talkHooks.chat = (id) => (Math.random() < 0.5 ? holidayLineFor(id) : null);
// свои разговоры и двери праздников (holidays_winter.js): по празднику — функция
const TALK = {},
  DOOR = {};
/** Свой разговор с жителем в праздник id: talk(npc, text) → { end } | { text } | null. */
export function holidayTalk(id, fn) {
  TALK[id] = fn;
}
/** Свой стук в дверь домика в праздник id: knock(npc, ctx, where) → true — дверь занята праздником. */
export function holidayDoor(id, fn) {
  DOOR[id] = fn;
}
talkHooks.talk = async (npc, text) => {
  const h = holidayToday();
  return h && TALK[h.id] ? TALK[h.id](npc, text) : null;
};
doorHooks.knock = async (npc, ctx, where) => {
  const h = holidayToday();
  return h && DOOR[h.id] ? DOOR[h.id](npc, ctx, where) : false;
};

// ---------- действия holiday:<что> ----------
const ACTS = {};
/** Зарегистрировать занятия праздников: { имя: fn(p, ctx) } — действие реестра holiday:<имя>. */
export function holidayActs(acts) {
  Object.assign(ACTS, acts);
}
register(
  'holiday',
  (p, ctx) => {
    const fn = ACTS[p.arg];
    if (fn) return fn(p, ctx);
    console.error('Неизвестное праздничное действие: holiday:' + p.arg);
  },
  'праздники (П.13): holiday:<что> — tree, crib, lanterns, envelope, dragon, carousel, effigy, blini, tug (features/holidays_winter.js)',
);

// ---------- звёздочка-указатель ----------
let tracking = false;
/** Вести звёздочкой к празднику (true) или перестать (false). */
export function trackHoliday(onOff) {
  tracking = !!onOff;
}
const WHERE = {};
/** Свой поиск места для шага: where-имя → fn(sc, h, x) → { x, y } | null (друзья, двери, конверты — ниже). */
export function holidayWhere(name, fn) {
  WHERE[name] = fn;
}
const near = (sc, pts) => {
  let best = null,
    bd = Infinity;
  for (const p of pts) {
    if (!p) continue;
    const d = Math.hypot(p.x - sc.p.x, p.y - sc.p.y);
    if (d < bd) {
      bd = d;
      best = p;
    }
  }
  return best;
};
holidayWhere('friend', (sc, h, x) => {
  const list = HF()[x.step.id] || [];
  return near(
    sc,
    sc.npcs.filter((n) => NPC_BY_ID[n.id] && S().friends[n.id] && !n.hidden && !list.includes(n.id)).map((n) => ({ x: n.x, y: n.y - 62 })),
  );
});
holidayWhere('door', (sc, h, x) => {
  const list = HF()[x.step.id] || [];
  return near(
    sc,
    sc.map.buildings.filter((b) => b.npc && !list.includes(b.npc)).map((b) => {
      const d = sc.map.doorPx(b);
      return { x: d.x, y: d.y - 40 };
    }),
  );
});
holidayWhere('envelope', (sc) =>
  near(
    sc,
    sc.pickups.filter((p) => p.id.startsWith('env') && sc.pickupThere(p)),
  ),
);
holidayWhere('villa', (sc) => sc.whereIs('villa'));
/** Куда показывает звёздочка праздника в этой локации: { x, y } | null. */
function holidayTarget(sc) {
  const st = holidayState();
  if (!st || st.done || !sc.desc.home) return null;
  const x = st.steps[st.i],
    w = x.step.where || '';
  if (w.startsWith('place:')) return sc.whereIs(w.slice(6));
  return WHERE[w] ? WHERE[w](sc, st.h, x) : null;
}
setExtraTarget((sc) => {
  if (!tracking) return null;
  const p = holidayTarget(sc);
  return p ? { x: p.x, y: p.y, icon: '⭐' } : null;
});
/** «Показать на карте»: звёздочка — к текущему шагу праздника, окно карты города. */
export function showHolidayOnMap() {
  const st = holidayState();
  if (!st || st.done) return false;
  trackQuest(null);
  tracking = true;
  sfx('ok');
  if (!currentLocation().desc.home) {
    toast(`${st.h.icon} Праздник — в городе. Звёздочка покажет дорогу, когда ты будешь там.`);
    return true;
  }
  openMap();
  return true;
}

// ---------- журнал, плашка, календарь ----------
/** Карточка праздника: шаги с ходом, подсказка, подарок. */
function holidayCard(h, panel) {
  const st = holidayState(h),
    card = el('div', 'quest holiday');
  card.appendChild(el('div', 'q-head', `<span class="q-ic">${h.icon}</span><div><div class="ttl">Сегодня — ${h.name}!</div><div class="sub">Праздник один день — ${dateText(h)}</div></div>`));
  card.appendChild(el('p', 'q-story', h.story));
  const ol = el('ol', 'q-steps');
  st.steps.forEach((x, i) => {
    const cur = i === st.i;
    const prog = x.need > 1 ? ` <b>${x.have}/${x.need}</b>` : '';
    ol.appendChild(el('li', x.ok ? 'ok' : cur ? 'cur' : 'todo', `${x.ok ? '✅' : cur ? '👉' : '▫️'} ${x.step.text}${prog}${cur && x.step.hint ? `<div class="q-hint">📍 ${x.step.hint}</div>` : ''}`));
  });
  card.appendChild(ol);
  card.appendChild(el('p', 'hol-gift', `🎁 Подарок: <b>${giftName(h.gift)}</b>${st.rewarded ? ' — в этом году уже получен ✅' : ''}`));
  if (!st.done) {
    const b = el('button', 'btn small yellow', '🗺️ Показать на карте');
    b.onclick = () => {
      if (showHolidayOnMap() && panel) panel.close();
    };
    card.appendChild(b);
  }
  return card;
}
setJournalTop((body, panel) => {
  const h = holidayToday();
  if (h) return void body.appendChild(holidayCard(h, panel));
  const t = holidayTomorrow();
  if (t) body.appendChild(el('div', 'quest holiday soon', `<div class="q-head"><span class="q-ic">${t.icon}</span><div><div class="ttl">Завтра — ${t.name}!</div><div class="sub">Город уже украшают. Завтра — праздничные занятия и подарок.</div></div></div>`));
});
/** Плашка праздника в HUD (вместо плашки журнала): пока праздник сегодня и не всё сделано. */
export function holidayChip() {
  const st = holidayState();
  if (!st || st.done) return null;
  const tq = trackedQuest();
  if (tq && questNow(tq).status === 'active') return null; // к заданию из журнала сейчас ведёт звёздочка — плашка его
  const n = st.steps.filter((x) => x.ok).length;
  return { text: `${st.h.icon} ${st.h.short || st.h.name} · ${n}/${st.steps.length}`, short: `${st.h.icon} ${n}/${st.steps.length}`, cls: 'holiday' };
}
/** Значок праздника на плашке даты: сегодня — ярко, завтра — бледнее. */
export function holidayBadge() {
  const h = holidayToday();
  if (h) return ` <span class="hol-badge" title="${h.name}">${h.icon}</span>`;
  const t = holidayTomorrow();
  return t ? ` <span class="hol-badge eve" title="Завтра — ${t.name}">${t.icon}</span>` : '';
}
/** Праздничный календарь: все праздники года, сегодняшний — с шагами. */
export function openHolidays() {
  const s = S();
  openPanel({
    title: 'Праздники',
    icon: '📅',
    cls: 'narrow',
    render(body, tab, panel) {
      const c = cal(),
        h = holidayToday();
      body.appendChild(el('p', 'center', `Сегодня: <b>${c.monthName}, день ${c.dom}</b> · год ${c.year}`));
      if (h) body.appendChild(holidayCard(h, panel));
      const nx = nextHoliday(s.day + (h ? 1 : 0));
      if (!h && nx) body.appendChild(el('p', 'center muted', nx.days === 1 ? `Завтра — ${nx.h.icon} ${nx.h.name}!` : `До праздника «${nx.h.name}» — дней: ${nx.days}`));
      for (const q of HOLIDAYS) {
        const k = holidayOffset(q, s.day);
        const when = k === 0 ? 'сегодня!' : k === -1 ? 'завтра' : dateText(q);
        const li = el('div', 'list-item hol-row' + (k === 0 ? ' now' : ''));
        li.appendChild(el('div', 'e', `<span style="font-size:32px">${q.icon}</span>`));
        li.appendChild(el('div', 'grow', `<div class="ttl">${q.name}</div><div class="sub">${when} · 🎁 ${giftName(q.gift)}${holidayRewarded(q) ? ' ✅' : ''}</div>`));
        body.appendChild(li);
      }
      body.appendChild(el('p', 'muted center', 'Праздник длится один день, а накануне город уже украшен. Подарок праздника — раз в год.'));
    },
    foot: [{ text: 'Хорошо', cls: 'green', fn: (p) => p.close() }],
  });
}
register('holidays', () => openHolidays(), 'праздничный календарь (П.13)');

/** Для тестов и отладки: где праздник сейчас. */
export function debugHoliday() {
  const s = S(),
    st = holidayState();
  return {
    today: st ? st.h.id : null,
    tomorrow: holidayTomorrow() ? holidayTomorrow().id : null,
    decor: s ? decorsOn(s.day).map(({ h, k }) => `${h.id}:${k}`) : [],
    steps: st ? st.steps.map((x) => `${x.step.id}:${x.have}/${x.need}`) : [],
    done: st ? st.done : false,
    rewarded: st ? st.rewarded : false,
    year: s ? holidayYear(s.day) : 0,
    flags: s ? Object.fromEntries(Object.entries(s.flags).filter(([k]) => k.startsWith('hol:'))) : {},
    day: HF(),
    tracking,
  };
}
