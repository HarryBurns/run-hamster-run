// ПЕЩЕРЫ (П.9): что делают в пещерах. Сама локация (где что стоит, темнота и фонарик) — locations/caves.js; она
// называет действия реестра, а выполняются они здесь:
//   miner              поговорить с шахтёром Камушкиным (житель пещер у кристальной жилы): задание, «Кристаллы»,
//                      шкатулка самоцветов, грибной ночник, болтовня
//   caves:crystals     мини-игра «Кристаллы» (minigames/crystals.js): за первые CAVES.crystals.paid игр в день
//                      Камушкин даёт монеты и самоцветы по звёздам (самоцветы — по кругу, GEM_IDS); дальше —
//                      для удовольствия
//   caves:paint        древние рисунки хомяков на стене галереи: окно с картинкой, наклейка
//   caves:lake         подземное озеро: тихо, капли и отражения
//   caves:pick         нашли кирку Камушкина (задание «Счастливая кирка», data/quests.js)
//   caves:shroom:<i>   светящийся гриб: CAVES.shrooms в день (находка); из CAVES.lamp Камушкин делает ночник
// Ещё: летучие мыши вспархивают (событие caves { what: 'bats' } из локации) — в первый раз наклейка; самоцветы
// продаются на рынке (features/market.js, цены — CAVES.gems); фонарик продаётся в ТЦ «Уютный дом» (features/shops.js).
// Числа — CAVES в data/economy.js. Каждое занятие шлёт событие caves { what } — по нему считают задания.
// Состояние меняют только действия (core/actions.js); «раз в день» — отметки дня (dayFlags.caves).
import { setFlag, setDayFlag, addItem, award, earn } from '../core/actions.js';
import { sfx } from '../core/audio.js';
import { makeCanvas } from '../core/draw.js';
import { on, emit } from '../core/events.js';
import { register } from '../core/registry.js';
import { G, darkness, count } from '../core/state.js';
import { el, esc, pick, fmtMoney } from '../core/util.js';
import { NPC_BY_ID, FIND_BY_ID, GEM_IDS, CAVES, npcLook } from '../data/index.js';
import { ART } from '../engine/topdown/index.js';
import { dialog } from '../ui/dialog.js';
import { message, openPanel } from '../ui/panel.js';
import { toast } from '../ui/toast.js';
import { playMinigame } from './minigames.js';
import { questTalk } from './quests.js';
import { placeLine } from './tales.js';

const S = () => G.state;
const S3 = () => S().dayFlags.caves || {};

// ---------- шахтёр Камушкин ----------
const KAMUSHKIN = 'kamushkin';
/** Что сказать под настроение: в пещере сезонов нет, но часы у Камушкина есть. */
export function kamushkinLine() {
  const place = placeLine(KAMUSHKIN); // вспомнить соседнее место, которое хомячок открыла (data/tales.js)
  if (place) return place;
  const L = NPC_BY_ID[KAMUSHKIN].lines,
    m = S().minutes;
  if (darkness() > 0.6 || m >= 22 * 60 || m < 5 * 60) return pick(L.night);
  if (m >= 18 * 60) return pick(L.evening);
  return pick(L.summer.concat(L.autumn));
}
const sayK = (text, options, happy = false) =>
  dialog({ look: npcLook(KAMUSHKIN), name: NPC_BY_ID[KAMUSHKIN].name, text, options, happy });
/** Сколько разных самоцветов в рюкзаке (для шкатулки нужен каждый вид). */
export const gemKinds = () => GEM_IDS.filter((id) => count('finds', id) > 0).length;
const gemsLine = () =>
  GEM_IDS.map((id) => `${FIND_BY_ID[id].e} ${count('finds', id) ? '✓' : '—'}`).join(' ');

/** Разговор с шахтёром: сначала задание из журнала, потом — «Кристаллы», поделки и болтовня. */
export async function talkKamushkin() {
  const s = S();
  let text;
  if (!s.flags.metKamushkin) {
    setFlag('metKamushkin');
    text = `Ого, гостья! Здравствуй, ${esc(s.name)}! Я шахтёр Камушкин. Профессор Орешкин писал, что ты придёшь. Доски со входа я снял — гуляй, смотри, только свети под ноги! А захочешь — помоги мне добывать кристаллы: жила — вот она, рядом.`;
  } else text = pick([`Привет, ${esc(s.name)}!`, 'О, моя помощница пришла!', 'Здравствуй-здравствуй! Кап-кап — слышишь? Пещера тебе рада.']);
  emit('talk', { id: KAMUSHKIN });
  sfx('tap');
  const qt = await questTalk(KAMUSHKIN);
  if (qt && qt.end) return;
  if (qt && qt.text) text = qt.text;
  for (;;) {
    const opts = [{ text: '💎 Добывать кристаллы', cls: 'yellow', fn: async () => (await crystalDig(), null) }];
    for (const o of MORE_TALK) {
      const x = o(S());
      if (x) opts.push(x);
    }
    opts.push({ text: '💬 Поболтать', cls: 'blue', go: 'chat' }, { text: 'Пока!', go: 'bye' });
    const i = await sayK(text, opts);
    const o = opts[i] || {};
    if (o.go === 'chat') text = kamushkinLine();
    else if (o.fn) {
      const r = await o.fn();
      if (!r) return;
      text = r;
    } else return;
  }
}
/** Дополнительные ответы: (s) → { text, cls, fn: async () => следующая реплика | null } или ничего. */
const MORE_TALK = [
  // шкатулка самоцветов — по одному каждого вида
  () =>
    GEM_IDS.some((id) => count('finds', id) > 0) && {
      text: `🎁 Шкатулка самоцветов (${gemKinds()} из ${GEM_IDS.length})`,
      cls: 'green',
      fn: async () => {
        if (gemKinds() < GEM_IDS.length)
          return `Для шкатулки нужен один самоцвет каждого вида: ${gemsLine()}. Добывай кристаллы — каждый раз попадаются разные!`;
        for (const id of GEM_IDS) addItem('finds', id, -1);
        addItem('storage', 'gem_geode', 1);
        sfx('win');
        award('x_gems', { delay: 1200 });
        emit('caves', { what: 'geode' });
        return 'Готово: хрусталь, топаз, сапфир и рубин — в шкатулке с бархатом! Поставь дома — пусть сверкает 💎 Шкатулка уже в кладовке: дома нажми 🔨.';
      },
    },
  // грибной ночник из светящихся грибов
  (s) =>
    (s.finds.glow_shroom || 0) > 0 && {
      text: `🍄 Грибной ночник (${count('finds', 'glow_shroom')} из ${CAVES.lamp})`,
      cls: 'green',
      fn: async () => {
        if (count('finds', 'glow_shroom') < CAVES.lamp)
          return `Для ночника нужно ${CAVES.lamp} светящихся гриба, а у тебя ${count('finds', 'glow_shroom')}. Они растут в гроте на северо-западе — по ${CAVES.shrooms} в день!`;
        addItem('finds', 'glow_shroom', -CAVES.lamp);
        addItem('storage', 'shroom_lamp', 1);
        sfx('win');
        emit('caves', { what: 'lamp' });
        return 'Вот, держи: светящиеся грибы в стеклянной банке! Ночью они светят мягко-мягко. Ночник уже в кладовке: дома нажми 🔨 и поставь у кровати 🍄';
      },
    },
  // куда деть самоцветы
  () =>
    GEM_IDS.some((id) => count('finds', id) > 0) && {
      text: '🪙 А самоцветы можно продать?',
      fn: async () =>
        `Конечно! Торговец Грошик на рынке в городе берёт самоцветы: хрусталь — ${CAVES.gems.gem_crystal}, топаз — ${CAVES.gems.gem_topaz}, сапфир — ${CAVES.gems.gem_sapphire}, рубин — ${CAVES.gems.gem_ruby} монет. А можно собрать по одному каждого вида — я сделаю шкатулку!`,
    },
];
register('miner', () => talkKamushkin(), 'шахтёр Камушкин: разговор (житель пещер у кристальной жилы)');

// ---------- «Кристаллы» ----------
/** Сколько игр сегодня ещё с добычей. */
export const digsLeft = () => Math.max(0, CAVES.crystals.paid - (S3().digs || 0));
/** Какие самоцветы дадут за n следующих (по кругу, от номера дня: за два дня попадаются все виды). */
export function nextGems(n) {
  const got = S3().gems || 0,
    day = S().day;
  return Array.from({ length: n }, (_, k) => GEM_IDS[(day * 2 + got + k) % GEM_IDS.length]);
}
const gemIcons = (ids) => ids.map((id) => FIND_BY_ID[id].e).join('');
/** Поиграть в «Кристаллы»: за первые игры дня — монеты и самоцветы по звёздам. */
export async function crystalDig() {
  const left = digsLeft(),
    c = CAVES.crystals,
    note = (html) => `<div class="pay-note${left ? '' : ' off'}">${html}</div>`;
  const res = await playMinigame('crystals', {
    introNote: left
      ? note(
          `⛏️ <b>Добыча Камушкина:</b> ⭐ 🪙 ${c.coins[0]} + ${c.gems[0]} самоцвет · ⭐⭐ 🪙 ${c.coins[1]} + ${c.gems[1]} · ⭐⭐⭐ 🪙 ${c.coins[2]} + ${c.gems[2]}. Сегодня ещё ${left} ${left === 1 ? 'игра' : 'игры'} с добычей.`,
        )
      : note('💛 Сегодня жила уже поделилась самоцветами. Постучать можно для удовольствия — завтра добыча снова!'),
    resultNote: (stars) =>
      left
        ? note(`<span class="sum">🪙 +${fmtMoney(c.coins[stars - 1])} и ${gemIcons(nextGems(c.gems[stars - 1]))}</span>`)
        : note('💛 Эта игра была для удовольствия.'),
  });
  if (!res || !left) return res;
  const gems = nextGems(c.gems[res.stars - 1]);
  setDayFlag('digs', (S3().digs || 0) + 1, 'caves');
  setDayFlag('gems', (S3().gems || 0) + gems.length, 'caves');
  for (const id of gems) addItem('finds', id, 1);
  earn(c.coins[res.stars - 1], 'work');
  sfx('coin');
  toast(`Камушкин: «Вот это добыча!» 🪙 +${fmtMoney(c.coins[res.stars - 1])} и ${gems.map((id) => FIND_BY_ID[id].e + ' ' + FIND_BY_ID[id].name).join(', ')}`, 'good');
  return res;
}

// ---------- древние рисунки ----------
/** Нарисовать стену с рисунками крупно (те же куски, что в мире: ART.paintWall — caves_art.js). */
function paintWallPic(ctx, w, h) {
  ctx.fillStyle = '#2e2734';
  ctx.fillRect(0, 0, w, h);
  const k = Math.min(w / (5 * 56), h / 70);
  ctx.save();
  ctx.translate(w / 2 - 2.5 * 48 * k + 24 * k, (h - 64 * k) / 2);
  ctx.scale(k, k);
  for (let p = 0; p < 5; p++) {
    ART.paintWall[1](ctx, p);
    ctx.translate(48, 0);
  }
  ctx.restore();
  // тёплый свет фонарика по краям темнее
  const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, w * 0.6);
  g.addColorStop(0, 'rgba(255,214,140,.12)');
  g.addColorStop(1, 'rgba(10,8,26,.55)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}
/** Рассмотреть древние рисунки: окно с картинкой; в первый раз — наклейка. */
export function seePaintings() {
  sfx('magic');
  emit('caves', { what: 'paint' });
  award('x_cavepaint', { delay: 1400 });
  return openPanel({
    title: 'Древние рисунки',
    icon: '🎨',
    cls: 'wide',
    render(body) {
      const W = Math.min(560, window.innerWidth - 60),
        H = Math.round(W * 0.42);
      const { canvas, ctx } = makeCanvas(W, H);
      canvas.style.cssText += ';display:block;margin:0 auto;border-radius:14px;max-width:100%;height:auto';
      paintWallPic(ctx, W, H);
      body.appendChild(canvas);
      body.appendChild(
        el(
          'p',
          'center',
          'Ух ты! Древние хомяки рисовали охрой и угольком: солнце, хомячок бежит за огромной семечкой, трое танцуют у костра… А вот — хомячок в колесе! Значит, и тысячу лет назад хомяки любили бегать 🐹 Расскажи об этом Профессору Орешкину!',
        ),
      );
    },
    foot: [{ text: 'Здорово! 🎨', cls: 'green', fn: (api) => api.close() }],
  });
}

// ---------- озеро, кирка, грибы ----------
export function lookLake() {
  sfx('bubble');
  emit('caves', { what: 'lake' });
  toast('🌊 Подземное озеро. Вода тихая-тихая и прозрачная, в ней отражаются сталактиты. Кап… — по воде бегут круги. Купаться здесь нельзя: очень холодно!');
  return true;
}
/** Нашли кирку Камушкина (место pick видно, пока задание на первом шаге). */
export async function findPick() {
  emit('caves', { what: 'pick' });
  sfx('win');
  await message({
    title: 'Кирка нашлась!',
    icon: '⛏️',
    html: '<p class="center big-emoji">⛏️✨</p><p class="center">Вот она — с красной ручкой, у самой воды! Теперь попробуй добыть ею кристаллы у жилы — а потом отнеси кирку Камушкину.</p>',
    buttons: [{ text: 'Ура!' }],
  });
}
/** Сорвать светящийся гриб номер i (сегодня их растёт CAVES.shrooms). */
export function pickShroom(i) {
  const got = { ...(S3().shroom || {}) };
  if (got[i]) return false;
  got[i] = 1;
  setDayFlag('shroom', got, 'caves');
  addItem('finds', 'glow_shroom', 1);
  sfx('pop');
  const n = count('finds', 'glow_shroom');
  toast(
    `🍄 Светящийся гриб! Он светит сам, без фонарика. В рюкзаке: ${n}.${n < CAVES.lamp ? ` Собери ${CAVES.lamp} — Камушкин сделает из них ночник.` : ' Можно идти к Камушкину за ночником!'}`,
    'good',
  );
  emit('caves', { what: 'shroom' });
  return true;
}

const CAVES_ACTS = {
  crystals: crystalDig,
  paint: seePaintings,
  lake: lookLake,
  pick: findPick,
};
register(
  'caves',
  (p) => {
    const [what, i] = String(p.arg || '').split(':');
    if (what === 'shroom') return pickShroom(+i);
    return CAVES_ACTS[what] && CAVES_ACTS[what]();
  },
  'пещеры: caves:crystals | paint | lake | pick | shroom:<номер>',
);

// ---------- летучие мыши и первый вход ----------
on('caves', ({ what }) => {
  if (what !== 'bats' || !S()) return;
  sfx('flap');
  if (award('x_bats', { delay: 1500 }))
    toast('🦇 Летучие мыши! Днём они спят вниз головой, а ты их разбудила. Не бойся — они добрые и сейчас снова уснут.', 'good');
});
on('scene', ({ name }) => {
  if (name !== 'caves' || !S() || S().flags.cavesHint) return;
  setFlag('cavesHint');
  toast(
    S().finds.flashlight
      ? '🔦 Как темно! Хорошо, что у тебя есть фонарик. Кнопкой 🔦 его можно выключить — тогда видно, как светятся грибы.'
      : '🌑 Как темно! Без фонарика видно совсем чуть-чуть. Фонарик продают в ТЦ «Уютный дом».',
  );
});
