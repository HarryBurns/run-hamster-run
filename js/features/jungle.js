// ДЖУНГЛИ (П.9): что делают в джунглях и по дороге туда. Сама локация (где что стоит, попугаи, водопад, мост) —
// locations/jungle.js; она называет действия реестра, а выполняются они здесь:
//   explorer          поговорить с исследовательницей Лианой (жительница джунглей у палатки): задание, «Лианы»,
//                     «Перья в рамке», куда деть перья, болтовня по времени суток
//   jungle:vines      мини-игра «Лианы» (minigames/vines.js): за первые JUNGLE.vines.paid игр в день — монеты по
//                     звёздам; дальше — для удовольствия; в первый раз — наклейка
//   jungle:temple     руины храма: загадка «Узор храма» (minigames/glyphs.js) — приз раз в день, в первый раз наклейка
//   jungle:fall       искупаться под водопадом (хомячок в заводи) — наклейка
//   jungle:parrot     поболтать с попугаем ({ do: 'jungle', arg: 'parrot', i }): он отвечает, а раз в день роняет перо
//   jungle:notebook   нашли дневник Лианы у водопада (задание «Дневник исследовательницы», data/quests.js)
//   voyage:go | back  кораблик: из моря города к причалу в джунглях (кораблик подошёл к причалу за буйками —
//                     LANDS.jungle.go) и обратно с причала в джунглях к пирсу; короткая картинка-переезд
// Ещё: попугай заговорил в первый раз и прошла по подвесному мосту — наклейки (событие jungle из локации); перья
// продаются на рынке (features/market.js, цены — JUNGLE.feathers). Числа — JUNGLE в data/economy.js. Каждое занятие
// шлёт событие jungle { what } — по нему считают задания. Состояние меняют только действия (core/actions.js);
// «раз в день» — отметки дня (dayFlags.jungle).
import { setFlag, setDayFlag, addItem, award, teachParrot } from '../core/actions.js';
import { sfx } from '../core/audio.js';
import { makeCanvas, ell, fillRR, line, poly } from '../core/draw.js';
import { on, emit } from '../core/events.js';
import { go, sceneName } from '../core/loop.js';
import { register } from '../core/registry.js';
import { G, cal, darkness, count, playerLook } from '../core/state.js';
import { el, esc, pick, fmtMoney } from '../core/util.js';
import { NPC_BY_ID, FIND_BY_ID, FEATHER_IDS, JUNGLE, LAND_BY_ID, PARROT_WORDS, PARROT_MEMORY, npcLook } from '../data/index.js';
import { getLocation } from '../engine/topdown/index.js';
import { startFallBath, parrotSay, parrotWords, PARROTS } from '../locations/jungle.js';
import { paintParrot } from '../locations/jungle_art.js';
import { drawBoat } from '../locations/sea.js';
import { sea } from '../locations/town.js';
import { dialog } from '../ui/dialog.js';
import { openLayer } from '../ui/modals.js';
import { message, openPanel } from '../ui/panel.js';
import { toast } from '../ui/toast.js';
import { prizeGame } from './minigames.js';
import { questTalk } from './quests.js';
import { placeLine } from './tales.js';

const S = () => G.state;
const OUT = '#4a3728';
const SJ = () => S().dayFlags.jungle || {};

// ---------- исследовательница Лиана ----------
const LIANA = 'liana';
/** Что сказать под настроение: ночью — про ночные звуки, вечером — про лягушек, днём — про фрукты по сезону. */
export function lianaLine() {
  const place = placeLine(LIANA); // вспомнить соседнее место, которое хомячок открыла (data/tales.js)
  if (place) return place;
  const L = NPC_BY_ID[LIANA].lines,
    m = S().minutes;
  if (darkness() > 0.6 || m >= 22 * 60 || m < 5 * 60) return pick(L.night);
  if (m >= 18 * 60) return pick(L.evening);
  return pick(L[cal().season]);
}
const sayL = (text, options, happy = false) => dialog({ look: npcLook(LIANA), name: NPC_BY_ID[LIANA].name, text, options, happy });
/** Сколько разных перьев в рюкзаке (для рамки нужно по одному каждого цвета). */
export const featherKinds = () => FEATHER_IDS.filter((id) => count('finds', id) > 0).length;
const feathersLine = () => FEATHER_IDS.map((id, i) => `${PARROTS[i].name} ${count('finds', id) ? '✓' : '—'}`).join(' · ');

/** Разговор с Лианой: сначала задание из журнала, потом — лианы, перья и болтовня. */
export async function talkLiana() {
  const s = S();
  let text;
  if (!s.flags.metLiana) {
    setFlag('metLiana');
    text = `Ой, гостья! Добро пожаловать в джунгли, ${esc(s.name)}! Я исследовательница Лиана — зарисовываю бабочек, цветы и попугаев. Капитан Боб писал, что приплывёт юнга! Здесь есть водопад, подвесной мост, древний храм и лианы, на которых можно качаться. А попугаи повторяют всё, что услышат!`;
  } else text = pick([`Привет, ${esc(s.name)}!`, 'О, это ты! Смотри, какую бабочку я сегодня зарисовала!', 'Здравствуй! Попугаи весь день повторяли твоё имя!']);
  emit('talk', { id: LIANA });
  sfx('tap');
  const qt = await questTalk(LIANA);
  if (qt && qt.end) return;
  if (qt && qt.text) text = qt.text;
  for (;;) {
    const opts = [{ text: '🐒 Покачаться на лианах', cls: 'yellow', fn: async () => (await vinesGame(), null) }];
    for (const o of MORE_TALK) {
      const x = o(S());
      if (x) opts.push(x);
    }
    opts.push({ text: '💬 Поболтать', cls: 'blue', go: 'chat' }, { text: 'Пока!', go: 'bye' });
    const i = await sayL(text, opts);
    const o = opts[i] || {};
    if (o.go === 'chat') text = lianaLine();
    else if (o.fn) {
      const r = await o.fn();
      if (!r) return;
      text = r;
    } else return;
  }
}
/** Дополнительные ответы: (s) → { text, cls, fn: async () => следующая реплика | null } или ничего. */
const MORE_TALK = [
  // перья в рамке — по одному каждого цвета
  () =>
    FEATHER_IDS.some((id) => count('finds', id) > 0) && {
      text: `🪶 Перья в рамке (${featherKinds()} из ${FEATHER_IDS.length})`,
      cls: 'green',
      fn: async () => {
        if (featherKinds() < FEATHER_IDS.length)
          return `Для рамки нужно по перышку от каждого попугая: ${feathersLine()}. Поболтай с ними — каждый раз в день роняет своё перо!`;
        for (const id of FEATHER_IDS) addItem('finds', id, -1);
        addItem('storage', 'feather_frame', 1);
        sfx('win');
        award('x_feathers', { delay: 1200 });
        emit('jungle', { what: 'frame' });
        return 'Готово: красное, синее и жёлтое — перья под стеклом в бамбуковой рамке! Как радуга из джунглей 🦜 Рамка уже в кладовке: дома нажми 🔨.';
      },
    },
  // куда деть перья
  () =>
    FEATHER_IDS.some((id) => count('finds', id) > 0) && {
      text: '🪙 А перья можно продать?',
      fn: async () =>
        `Конечно! Торговец Грошик на рынке в городе берёт перья: красное — ${JUNGLE.feathers.feather_red}, синее — ${JUNGLE.feathers.feather_blue}, жёлтое — ${JUNGLE.feathers.feather_yellow} монет. А можно собрать по одному каждого цвета — я сделаю красивую рамку!`,
    },
];
register('explorer', () => talkLiana(), 'исследовательница Лиана: разговор (жительница джунглей у палатки)');

// ---------- «Лианы» ----------
/** Покачаться на лианах: за первые игры дня — монеты по звёздам. */
export const vinesGame = () =>
  prizeGame('vines', {
    group: 'jungle',
    flag: 'vines',
    ...JUNGLE.vines,
    label: '🐒 <b>Приз Лианы:</b>',
    words: ['полёт', 'полёта'],
    done: '💛 Сегодня призы за лианы уже получены. Покачаться можно для удовольствия — завтра призы снова!',
    fun: '💛 Этот полёт был для удовольствия.',
    sticker: 'x_vines',
    thanks: 'Лиана: «Вот это полёт!»',
  });

// ---------- руины храма: «Узор храма» ----------
/** Разгадать узор храма: приз — раз в день (по звёздам), в первый раз — наклейка. */
export function glyphsGame() {
  sfx('door');
  return prizeGame('glyphs', {
    group: 'jungle',
    flag: 'glyphs',
    paid: 1,
    coins: JUNGLE.glyphs.coins,
    label: '🗿 <b>Сокровище храма:</b>',
    tail: ' — раз в день.',
    done: '💛 Сегодня храм уже открыл тебе сокровище. Повторять узор можно для удовольствия — завтра снова!',
    sum: (stars) => `🪙 Сокровище: +${fmtMoney(JUNGLE.glyphs.coins[stars - 1])}`,
    fun: '💛 Этот узор был для удовольствия.',
    sticker: 'x_temple',
    thanks: '🗿 Узор разгадан — каменная маска улыбнулась!',
  });
}

// ---------- водопад, попугаи, дневник ----------
const jungleScene = (ctx) => (ctx && ctx.scene) || (sceneName() === 'jungle' ? getLocation('jungle') : null);
/** Искупаться под водопадом: хомячок садится в заводь (вылезти — нажатие, стрелка или кнопка). */
export function fallBath(ctx) {
  const sc = jungleScene(ctx);
  if (!sc) return false;
  startFallBath(sc);
  sfx('splash');
  emit('jungle', { what: 'fall' });
  if (award('x_fall', { delay: 1400 })) toast('💦 Брр-ух! Прохладная вода водопада — как душ в жаркий день! Нажми куда угодно, чтобы вылезти.', 'good');
  else toast('💦 Плюх! Водопад шумит прямо над головой. Нажми куда угодно, чтобы вылезти.', 'good');
  return true;
}
/** Поболтать с попугаем i: он отвечает фразой, а раз в день роняет перо; потом можно научить его слову. */
export function parrotChat(i) {
  const p = PARROTS[i];
  if (!p) return false;
  // через раз попугай хвастается выученным словом
  const own = parrotWords(i),
    line = parrotSay(i, own.length && Math.random() < 0.5 ? pick(own) : pick([`Кр-р-ра! ${p.name} хор-р-роший!`, 'Пр-р-ривет, {name}!', `${p.name} любит тебя!`, 'Ещё! Ещё!']));
  emit('jungle', { what: 'parrot', i });
  const id = FEATHER_IDS[i];
  let note, kind;
  if (SJ()['f' + i]) note = `🦜 ${p.name} радостно машет крыльями. Перо он уже уронил сегодня — приходи завтра!`;
  else {
    setDayFlag('f' + i, 1, 'jungle');
    addItem('finds', id, 1);
    emit('jungle', { what: 'feather', id });
    note = `🦜 ${p.name} уронил перо! +1 ${FIND_BY_ID[id].e} ${FIND_BY_ID[id].name}`;
    kind = 'good';
    setTimeout(() => sfx('pop'), 400);
  }
  // про перо — в окне разговора; окно уже открыто (нажали ещё раз) — подсказкой
  if (!parrotTalk(i, line, note)) toast(note, kind);
  return true;
}
// ---------- учить попугая словам (Дж6) ----------
let parrotOpen = false;
/** Разговор с попугаем i после его фразы line (note — что с пером): «Научить слову» или «Пока!». Одно окно за раз. */
function parrotTalk(i, line, note) {
  if (parrotOpen) return false;
  parrotOpen = true;
  parrotWindow(i, line, note);
  return true;
}
async function parrotWindow(i, line, note) {
  const p = PARROTS[i],
    own = parrotWords(i).map((t) => t.replace(/\{name\}/g, S().name));
  const knows = own.length ? `<p class="muted center">${p.name} выучил: ${own.map((t) => `«${esc(t)}»`).join(', ')}</p>` : '';
  const b = await message({
    title: `Попугай ${p.name}`,
    icon: '🦜',
    html: `<p class="center big-emoji">🦜</p><p class="center"><b>${p.name}:</b> «${esc(line)}»</p><p class="center">${esc(note)}</p>${knows}`,
    buttons: [{ text: '🎓 Научить слову', cls: 'green' }, { text: 'Пока!', cls: 'ghost' }],
  });
  parrotOpen = false;
  if (b === 0) teachWindow(i);
}
/** Окно «Чему научить попугая»: выбери фразу — попугай i её запомнит (state.parrots) и будет повторять. */
export function teachWindow(i) {
  const p = PARROTS[i];
  if (!p) return null;
  return openPanel({
    title: `Чему научить: ${p.name}`,
    icon: '🎓',
    cls: 'narrow',
    render(body, tab, panel) {
      const known = (S().parrots && S().parrots[i]) || [];
      body.appendChild(
        el('p', 'center', `Выбери фразу — ${p.name} её запомнит и будет повторять. Он помнит ${PARROT_MEMORY} последние фразы.`),
      );
      const list = el('div', 'parrot-words');
      for (const w of PARROT_WORDS) {
        const text = w.text.replace(/\{name\}/g, S().name),
          has = known.includes(w.id);
        const b = el('button', 'opt' + (has ? ' been' : ''), `${w.e} ${esc(text)}${has ? ' ✓' : ''}`);
        b.onclick = () => {
          teachParrot(i, w.id);
          emit('jungle', { what: 'teach', i, id: w.id });
          panel.close();
          parrotSay(i, w.text);
          sfx('win');
          toast(has ? `🦜 ${p.name} повторил: «${esc(text)}»` : `🦜 ${p.name} запомнил: «${esc(text)}» Теперь он будет это повторять!`, 'good');
        };
        list.appendChild(b);
      }
      body.appendChild(list);
    },
  });
}
/** Нашли дневник Лианы (место notebook видно, пока задание на первом шаге). */
export async function findNotebook() {
  emit('jungle', { what: 'notebook' });
  sfx('win');
  await message({
    title: 'Дневник нашёлся!',
    icon: '📓',
    html: '<p class="center big-emoji">📓✨</p><p class="center">Вот он — зелёный, с красной закладкой, лежит у самой воды! На последней странице нарисован узор из кружочков, треугольников и волн. Теперь — к руинам храма: повтори узор на камнях!</p>',
    buttons: [{ text: 'Ура!' }],
  });
}
const JUNGLE_ACTS = {
  vines: vinesGame,
  temple: glyphsGame,
  fall: fallBath,
  notebook: findNotebook,
};
register(
  'jungle',
  (p, ctx) => (p.arg === 'parrot' ? parrotChat(p.i || 0) : JUNGLE_ACTS[p.arg] && JUNGLE_ACTS[p.arg](ctx)),
  'джунгли: jungle:vines | temple | fall | notebook; { do: jungle, arg: parrot, i }',
);

// ---------- наклейки и подсказки по событиям локации ----------
on('jungle', ({ what }) => {
  if (!S()) return;
  if (what === 'parrot' && award('x_parrot', { delay: 1600 }))
    toast('🦜 Попугай повторяет слова! Скажи ему что-нибудь доброе — и он тоже скажет. А если поболтать (нажми на него), может уронить перо.', 'good');
  else if (what === 'bridge' && award('x_bridge', { delay: 900 })) toast('🌉 Подвесной мост качается — ух! Внизу шумит река. Держись за верёвочные перила!', 'good');
});
on('scene', ({ name }) => {
  if (name !== 'jungle' || !S() || S().flags.jungleHint) return;
  setFlag('jungleHint');
  toast('🦜 Вот они — джунгли! Лиана — у палатки, прямо по тропе на север. Слышишь попугаев?', 'good');
});

// ---------- кораблик: из моря города к причалу в джунглях и обратно ----------
/** Картинка переезда: море, буйки, остров с пальмами; кораблик плывёт (k — 0..1 пути). */
export function paintVoyage(ctx, w, h, k, toJungle, look, t) {
  if (!toJungle) return paintVoyageHome(ctx, w, h, k, look, t);
  const sky = ctx.createLinearGradient(0, 0, 0, h * 0.55);
  sky.addColorStop(0, '#4dabf7');
  sky.addColorStop(1, '#d0ebff');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  ell(ctx, w * 0.16, h * 0.18, 24, 24, '#ffe066');
  ell(ctx, w * 0.16, h * 0.18, 34, 34, 'rgba(255,224,102,.3)');
  for (const [x, y, s] of [
    [0.4, 0.12, 1],
    [0.7, 0.2, 0.8],
  ]) {
    const cx = ((x + t * 0.01) % 1.2) * w;
    ell(ctx, cx, h * y, 30 * s, 10 * s, '#fff');
    ell(ctx, cx + 18 * s, h * y - 6 * s, 18 * s, 10 * s, '#fff');
  }
  // остров джунглей справа: горы в зелени, пальмы, причал; город — маленький слева
  const sx = w * 0.62;
  poly(ctx, [sx, h * 0.56, sx + w * 0.1, h * 0.3, sx + w * 0.22, h * 0.36, sx + w * 0.3, h * 0.26, w + 10, h * 0.4, w + 10, h * 0.56], '#2f9e44', OUT, 2);
  poly(ctx, [sx + w * 0.1, h * 0.3, sx + w * 0.16, h * 0.4, sx + w * 0.22, h * 0.36], 'rgba(0,0,0,.12)');
  for (let i = 0; i < 7; i++) ell(ctx, sx + w * 0.03 + i * w * 0.055, h * 0.47 - (i % 2) * h * 0.04, w * 0.04, h * 0.05, i % 2 ? '#37b24d' : '#2b8a3e', OUT, 1.4);
  // водопад на горе
  fillRR(ctx, sx + w * 0.235, h * 0.3, w * 0.02, h * 0.18, 3, '#a5d8ff', OUT, 1.2);
  for (const x of [0.05, 0.3]) {
    line(ctx, sx + w * x, h * 0.56, sx + w * x + 6, h * 0.36, OUT, 4);
    line(ctx, sx + w * x, h * 0.56, sx + w * x + 6, h * 0.36, '#a8703f', 2.4);
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i - 2) * 0.6;
      ell(ctx, sx + w * x + 6 + Math.cos(a) * 14, h * 0.36 + Math.sin(a) * 6 + 4, 14, 4, '#40c057', OUT, 1, a);
    }
  }
  ctx.fillStyle = '#b6c6dd';
  for (const [x, bw, bh] of [
    [0.02, 0.03, 0.12],
    [0.05, 0.02, 0.08],
    [0.075, 0.035, 0.16],
  ])
    ctx.fillRect(w * x, h * (0.56 - bh), w * bw, h * bh);
  // море с волнами
  const seaG = ctx.createLinearGradient(0, h * 0.55, 0, h);
  seaG.addColorStop(0, '#3bc9db');
  seaG.addColorStop(1, '#1971c2');
  ctx.fillStyle = seaG;
  ctx.fillRect(0, h * 0.55, w, h * 0.45);
  ctx.strokeStyle = 'rgba(255,255,255,.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let r = 0; r < 4; r++) {
    const y = h * (0.62 + r * 0.09);
    for (let x = ((t * (30 + r * 12)) % 60) - 60; x < w; x += 60) {
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + 10, y - 4, x + 20, y);
    }
  }
  ctx.stroke();
  // буйки
  for (let i = 0; i < 5; i++) {
    const bx = w * (0.08 + i * 0.22),
      by = h * 0.66 + Math.sin(t * 2 + i) * 2;
    ell(ctx, bx, by, 7, 7, '#fa5252', OUT, 1.4);
    ctx.fillStyle = '#fff';
    ctx.fillRect(bx - 6, by - 1.5, 12, 3);
  }
  // кораблик с хомячком
  const z = w / 560,
    dir = toJungle ? 1 : -1,
    bx = toJungle ? -60 * z + k * (w * 0.62 + 40 * z) : w * 0.58 - k * (w * 0.58 + 90 * z),
    by = h * 0.8;
  ctx.save();
  ctx.translate(bx, by);
  ctx.scale(0.9 * z, 0.9 * z);
  drawBoat(ctx, 0, 0, dir, t, look, true);
  ctx.restore();
  // попугай летит рядом
  ctx.save();
  ctx.translate(bx + dir * 70 * z, by - 120 * z + Math.sin(t * 6) * 6);
  ctx.scale(dir * 0.9 * z, 0.9 * z);
  paintParrot(ctx, 0, Math.floor(t * 8) % 2);
  ctx.restore();
}
/**
 * Картинка «домой» (Дж12) — не зеркало дороги туда: тёплый вечерний свет, остров джунглей уходит назад, налево
 * (на берегу на пальме сидит попугай и машет крылом вслед), а впереди, справа, растёт городок у моря — домики,
 * маяк и пирс. Кораблик плывёт слева направо, как и туда, — хомячок и попугай не отражаются зеркально.
 */
function paintVoyageHome(ctx, w, h, k, look, t) {
  const sky = ctx.createLinearGradient(0, 0, 0, h * 0.55);
  sky.addColorStop(0, '#74c0fc');
  sky.addColorStop(1, '#ffe8cc');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  ell(ctx, w * 0.84, h * 0.24, 26, 26, '#ffc078');
  ell(ctx, w * 0.84, h * 0.24, 38, 38, 'rgba(255,192,120,.3)');
  for (const [x, y, s2] of [
    [0.3, 0.14, 0.9],
    [0.62, 0.1, 0.7],
  ]) {
    const cx = ((x + t * 0.008) % 1.2) * w;
    ell(ctx, cx, h * y, 30 * s2, 10 * s2, '#fff4e6');
    ell(ctx, cx + 18 * s2, h * y - 6 * s2, 18 * s2, 10 * s2, '#fff4e6');
  }
  // остров джунглей позади, слева: уходит, становится меньше
  const back = 1 - k * 0.25,
    ix = -w * 0.06 - k * w * 0.05;
  ctx.save();
  ctx.translate(ix, h * 0.56);
  ctx.scale(back, back);
  poly(ctx, [0, 0, w * 0.06, -h * 0.3, w * 0.14, -h * 0.22, w * 0.24, -h * 0.28, w * 0.36, 0], '#2f9e44', OUT, 2);
  for (let i = 0; i < 6; i++) ell(ctx, w * 0.03 + i * w * 0.055, -h * 0.08 - (i % 2) * h * 0.04, w * 0.04, h * 0.05, i % 2 ? '#37b24d' : '#2b8a3e', OUT, 1.4);
  fillRR(ctx, w * 0.12, -h * 0.25, w * 0.02, h * 0.17, 3, '#a5d8ff', OUT, 1.2); // водопад
  // пальма на берегу — на ней попугай машет вслед
  const px = w * 0.3;
  line(ctx, px, 0, px + 6, -h * 0.22, OUT, 4);
  line(ctx, px, 0, px + 6, -h * 0.22, '#a8703f', 2.4);
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i - 2) * 0.6;
    ell(ctx, px + 6 + Math.cos(a) * 14, -h * 0.22 + Math.sin(a) * 6 + 4, 14, 4, '#40c057', OUT, 1, a);
  }
  ctx.translate(px + 8, -h * 0.22 - 4 + Math.sin(t * 5) * 1.5);
  ctx.scale(0.8, 0.8);
  paintParrot(ctx, 0, Math.floor(t * 6) % 2);
  ctx.restore();
  // городок впереди, справа: растёт, пока подплываем — домики с крышами, маяк, пирс
  const near = 0.7 + k * 0.45,
    tx = w * 0.98;
  ctx.save();
  ctx.translate(tx, h * 0.56);
  ctx.scale(near, near);
  poly(ctx, [-w * 0.42, 0, -w * 0.38, -h * 0.05, 40, -h * 0.07, 40, 0], '#e6c98f', OUT, 1.6); // берег
  const HOUSES = [
    [-0.38, 0.1, '#ffd8a8', '#e8590c'],
    [-0.3, 0.13, '#d0ebff', '#1971c2'],
    [-0.22, 0.09, '#ffdeeb', '#c2255c'],
    [-0.14, 0.12, '#fff3bf', '#2f9e44'],
  ];
  for (const [x, hh, wall, roof] of HOUSES) {
    const X = w * x,
      bw = w * 0.07,
      top = -h * 0.05 - h * hh;
    fillRR(ctx, X, top, bw, h * hh, 2, wall, OUT, 1.4);
    poly(ctx, [X - 4, top, X + bw / 2, top - h * 0.06, X + bw + 4, top], roof, OUT, 1.4);
    ctx.fillStyle = '#74c0fc';
    ctx.fillRect(X + bw * 0.25, top + h * hh * 0.25, bw * 0.2, h * hh * 0.25);
    ctx.fillRect(X + bw * 0.6, top + h * hh * 0.25, bw * 0.2, h * hh * 0.25);
  }
  // маяк
  const LX = -w * 0.04;
  poly(ctx, [LX - 9, -h * 0.05, LX - 6, -h * 0.34, LX + 6, -h * 0.34, LX + 9, -h * 0.05], '#fff', OUT, 1.6);
  ctx.fillStyle = '#fa5252';
  ctx.fillRect(LX - 8, -h * 0.25, 16, h * 0.05);
  ctx.fillRect(LX - 7, -h * 0.15, 14, h * 0.05);
  fillRR(ctx, LX - 7, -h * 0.4, 14, h * 0.06, 2, '#ffe066', OUT, 1.4);
  poly(ctx, [LX - 9, -h * 0.4, LX, -h * 0.45, LX + 9, -h * 0.4], '#fa5252', OUT, 1.4);
  // пирс
  fillRR(ctx, -w * 0.12, -h * 0.02, w * 0.1, h * 0.03, 2, '#c98b5a', OUT, 1.2);
  ctx.restore();
  // море с волнами
  const seaG = ctx.createLinearGradient(0, h * 0.55, 0, h);
  seaG.addColorStop(0, '#66d9e8');
  seaG.addColorStop(1, '#1c7ed6');
  ctx.fillStyle = seaG;
  ctx.fillRect(0, h * 0.55, w, h * 0.45);
  ctx.strokeStyle = 'rgba(255,255,255,.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let r = 0; r < 4; r++) {
    const y = h * (0.62 + r * 0.09);
    for (let x = ((t * (30 + r * 12)) % 60) - 60; x < w; x += 60) {
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + 10, y - 4, x + 20, y);
    }
  }
  ctx.stroke();
  // солнечная дорожка
  ctx.fillStyle = 'rgba(255,212,140,.45)';
  for (let i = 0; i < 6; i++) ctx.fillRect(w * 0.8 + Math.sin(t * 3 + i) * 8 - 14 + i * 2, h * (0.58 + i * 0.06), 28 - i * 3, 3);
  // кораблик с хомячком — слева направо, к городу
  const z = w / 560,
    bx = w * 0.06 + k * w * 0.62,
    by = h * 0.8;
  ctx.save();
  ctx.translate(bx, by);
  ctx.scale(0.9 * z, 0.9 * z);
  drawBoat(ctx, 0, 0, 1, t, look, true);
  ctx.restore();
}
let voyaging = false;
/** Проплыть на кораблике: toJungle — из моря города к причалу в джунглях, иначе — обратно к пирсу города. */
export function rideVoyage(toJungle) {
  if (voyaging) return false;
  const land = LAND_BY_ID.jungle;
  voyaging = true;
  sfx('splash');
  const W = Math.min(560, window.innerWidth - 32),
    H = Math.round(W * 0.56);
  const f = el(
    'div',
    'fade cable-ride voyage-ride',
    `<div class="msg"><div><div class="ride-pic"></div><p>${toJungle ? '⛵ Плывём в джунгли!' : '⛵ Плывём домой, в город!'}</p></div></div>`,
  );
  const { canvas, ctx } = makeCanvas(W, H);
  canvas.style.borderRadius = '18px';
  f.querySelector('.ride-pic').appendChild(canvas);
  document.body.appendChild(f);
  const closeLayer = openLayer();
  let cover = null,
    raf = 0;
  const t0 = performance.now(),
    look = playerLook(),
    DUR = 2600;
  const loop = (now) => {
    const t = (now - t0) / 1000,
      p = Math.min(1, (now - t0) / DUR),
      e = p * p * (3 - 2 * p);
    paintVoyage(ctx, W, H, e, toJungle, look, t);
    if (p < 1) raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  requestAnimationFrame(() => f.classList.add('on'));
  setTimeout(() => {
    cover = openLayer({ pause: false, cover: true }); // экран уже тёмный — сцену под ним не рисуем
  }, 400);
  setTimeout(() => {
    sea.boatHome(); // кораблик ждёт у пирса города (в джунглях — свой, у причала)
    if (toJungle) go(land.scene, { at: land.entry });
    else go('world', { at: 'pier' });
  }, DUR - 300);
  setTimeout(() => {
    cancelAnimationFrame(raf);
    if (cover) cover();
    f.classList.remove('on');
    setTimeout(() => {
      f.remove();
      closeLayer();
      voyaging = false;
      sfx('ding');
    }, 380);
  }, DUR + 150);
  return true;
}
register('voyage', (p) => rideVoyage(p.arg !== 'back'), 'кораблик в джунгли: voyage:go (из моря города к причалу в джунглях) | voyage:back');
