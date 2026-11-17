// ПУСТЫНЯ (П.9): что делают в пустыне и по дороге туда. Сама локация (где что стоит, верблюд, мираж) —
// locations/desert.js; она называет действия реестра, а выполняются они здесь:
//   nomad             поговорить с кочевником Барханом (житель пустыни у шатра в оазисе): задание, «Раскопки»,
//                     катание на верблюде, коллекция окаменелостей, болтовня
//   desert:dig        мини-игра «Раскопки» (minigames/dig.js): за первые DESERT.dig.paid игр в день — монеты по
//                     звёздам и окаменелость (виды по кругу — FOSSIL_IDS); дальше — для удовольствия
//   desert:pairs      пирамида: загадка «Пары» (minigames/pairs.js) — приз раз в день, в первый раз наклейка
//   desert:camel      сесть на верблюда Финика: круг по верблюжьей тропе (locations/desert.js) — наклейка
//   desert:stars      Звёздный бархан: ночью — окно со звездопадом, загадать желание (наклейка); днём — подсказка
//   desert:oasis      попить воды из оазиса (и в жару сразу легче)
//   desert:well       старый колодец: эхо
//   desert:bell       нашли бубенчик Финика (задание «Бубенчик верблюда», data/quests.js)
//   caravan:go | back  караван-автобус: из города в пустыню (вход way:desert и выезд за шлагбаум — LANDS.desert.go)
//                     и обратно с остановки в пустыне; короткая картинка-переезд
// Ещё: мираж (событие desert { what: 'mirage' } из локации) — в первый раз наклейка; днём без шляпы — добрая
// подсказка про солнце (крюк hot локации, раз в день); окаменелости продаются на рынке (features/market.js, цены —
// DESERT.fossils). Числа — DESERT в data/economy.js. Каждое занятие шлёт событие desert { what } — по нему считают
// задания. Состояние меняют только действия (core/actions.js); «раз в день» — отметки дня (dayFlags.desert).
import { setFlag, setDayFlag, addItem, award, earn } from '../core/actions.js';
import { sfx } from '../core/audio.js';
import { makeCanvas, ell, fillRR, line, poly } from '../core/draw.js';
import { on, emit } from '../core/events.js';
import { go, scene, sceneName } from '../core/loop.js';
import { register } from '../core/registry.js';
import { G, cal, darkness, count, playerLook } from '../core/state.js';
import { el, esc, pick, fmtMoney } from '../core/util.js';
import { drawHamster } from '../art/hamster.js';
import { NPC_BY_ID, FIND_BY_ID, FOSSIL_IDS, DESERT, LAND_BY_ID, CLOTHES_BY_ID, npcLook, isSunHat } from '../data/index.js';
import { getLocation } from '../engine/topdown/index.js';
import { startCamelRide } from '../locations/desert.js';
import { paintBus, paintCamel } from '../locations/desert_art.js';
import { dialog } from '../ui/dialog.js';
import { openLayer } from '../ui/modals.js';
import { message, openPanel } from '../ui/panel.js';
import { toast } from '../ui/toast.js';
import { playMinigame } from './minigames.js';
import { questTalk } from './quests.js';
import { placeLine } from './tales.js';

const S = () => G.state;
const OUT = '#4a3728';
const SD = () => S().dayFlags.desert || {};

// ---------- кочевник Бархан ----------
const BARKHAN = 'barkhan';
/** Что сказать под настроение: ночью — про звёзды, вечером — про закат, днём — про сезон. */
export function barkhanLine() {
  const place = placeLine(BARKHAN); // вспомнить соседнее место, которое хомячок открыла (data/tales.js)
  if (place) return place;
  const L = NPC_BY_ID[BARKHAN].lines,
    m = S().minutes;
  if (darkness() > 0.6 || m >= 22 * 60 || m < 5 * 60) return pick(L.night);
  if (m >= 18 * 60) return pick(L.evening);
  return pick(L[cal().season]);
}
const sayB = (text, options, happy = false) =>
  dialog({ look: npcLook(BARKHAN), name: NPC_BY_ID[BARKHAN].name, text, options, happy });
/** Сколько разных окаменелостей в рюкзаке (для коллекции нужен каждый вид). */
export const fossilKinds = () => FOSSIL_IDS.filter((id) => count('finds', id) > 0).length;
const fossilsLine = () => FOSSIL_IDS.map((id) => `${FIND_BY_ID[id].e} ${count('finds', id) ? '✓' : '—'}`).join(' ');

/** Разговор с кочевником: сначала задание из журнала, потом — раскопки, верблюд, коллекция и болтовня. */
export async function talkBarkhan() {
  const s = S();
  let text;
  if (!s.flags.metBarkhan) {
    setFlag('metBarkhan');
    text = `Добро пожаловать в пески, ${esc(s.name)}! Я кочевник Бархан, а это мой верблюд Финик. Буся писала, что приедет звезда подиума! Здесь есть оазис, пирамида с загадкой, раскопки древних окаменелостей, а ночью — звездопад. Только днём надевай шляпу: солнце у нас горячее!`;
  } else text = pick([`Привет, ${esc(s.name)}!`, 'О, гостья из города! Садись, выпей чаю с финиками.', 'Здравствуй-здравствуй! Финик тебе рад — слышишь, фыркает?']);
  emit('talk', { id: BARKHAN });
  sfx('tap');
  const qt = await questTalk(BARKHAN);
  if (qt && qt.end) return;
  if (qt && qt.text) text = qt.text;
  for (;;) {
    const opts = [
      { text: '🦴 Раскопки', cls: 'yellow', fn: async () => (await digGame(), null) },
      { text: '🐫 Покататься на Финике', cls: 'yellow', fn: async () => (rideCamel(), null) },
    ];
    for (const o of MORE_TALK) {
      const x = o(S());
      if (x) opts.push(x);
    }
    opts.push({ text: '💬 Поболтать', cls: 'blue', go: 'chat' }, { text: 'Пока!', go: 'bye' });
    const i = await sayB(text, opts);
    const o = opts[i] || {};
    if (o.go === 'chat') text = barkhanLine();
    else if (o.fn) {
      const r = await o.fn();
      if (!r) return;
      text = r;
    } else return;
  }
}
/** Дополнительные ответы: (s) → { text, cls, fn: async () => следующая реплика | null } или ничего. */
const MORE_TALK = [
  // коллекция окаменелостей — по одной каждого вида
  () =>
    FOSSIL_IDS.some((id) => count('finds', id) > 0) && {
      text: `🦴 Коллекция окаменелостей (${fossilKinds()} из ${FOSSIL_IDS.length})`,
      cls: 'green',
      fn: async () => {
        if (fossilKinds() < FOSSIL_IDS.length)
          return `Для коллекции нужна одна окаменелость каждого вида: ${fossilsLine()}. Копай на раскопе — каждый раз попадается что-то новое!`;
        for (const id of FOSSIL_IDS) addItem('finds', id, -1);
        addItem('storage', 'fossil_box', 1);
        sfx('win');
        award('x_fossils', { delay: 1200 });
        emit('desert', { what: 'fossils' });
        return 'Готово: аммонит, отпечаток листа, зуб ящера и косточка динозавра — в витрине под стеклом! Настоящий музей 🦴 Коллекция уже в кладовке: дома нажми 🔨.';
      },
    },
  // куда деть окаменелости
  () =>
    FOSSIL_IDS.some((id) => count('finds', id) > 0) && {
      text: '🪙 А окаменелости можно продать?',
      fn: async () =>
        `Конечно! Торговец Грошик на рынке в городе берёт окаменелости: аммонит — ${DESERT.fossils.fossil_shell}, отпечаток листа — ${DESERT.fossils.fossil_leaf}, зуб — ${DESERT.fossils.fossil_tooth}, косточка — ${DESERT.fossils.fossil_bone} монет. А можно собрать по одной каждого вида — я сделаю витрину-коллекцию!`,
    },
];
register('nomad', () => talkBarkhan(), 'кочевник Бархан: разговор (житель пустыни у шатра в оазисе)');

// ---------- «Раскопки» ----------
/** Сколько игр сегодня ещё с находкой. */
export const digsLeft = () => Math.max(0, DESERT.dig.paid - (SD().digs || 0));
/** Какую окаменелость откопают следующей (по кругу, от номера дня: за два дня — все виды). */
export const nextFossil = () => FOSSIL_IDS[(S().day * 2 + (SD().digs || 0)) % FOSSIL_IDS.length];
/** Покопать: за первые игры дня — монеты по звёздам и окаменелость. */
export async function digGame() {
  const left = digsLeft(),
    c = DESERT.dig.coins,
    fossil = left ? nextFossil() : FOSSIL_IDS[(S().day + 1) % FOSSIL_IDS.length],
    f = FIND_BY_ID[fossil],
    note = (html) => `<div class="pay-note${left ? '' : ' off'}">${html}</div>`;
  const res = await playMinigame('dig', {
    fossil,
    introNote: left
      ? note(
          `🦴 <b>Приз Бархана:</b> ⭐ 🪙 ${c[0]} · ⭐⭐ 🪙 ${c[1]} · ⭐⭐⭐ 🪙 ${c[2]} — и находка остаётся у тебя! Сегодня ещё ${left} ${left === 1 ? 'раскопка' : 'раскопки'} с призом.`,
        )
      : note('💛 Сегодня раскоп уже поделился находками. Покопать можно для удовольствия — завтра находки снова!'),
    resultNote: (stars) =>
      left ? note(`<span class="sum">🪙 +${fmtMoney(c[stars - 1])} и ${f.e} ${f.name}</span>`) : note('💛 Эта раскопка была для удовольствия.'),
  });
  if (!res || !left) return res;
  setDayFlag('digs', (SD().digs || 0) + 1, 'desert');
  addItem('finds', fossil, 1);
  earn(c[res.stars - 1], 'work');
  sfx('coin');
  toast(`Бархан: «Вот это находка!» 🪙 +${fmtMoney(c[res.stars - 1])} и ${f.e} ${f.name}`, 'good');
  return res;
}

// ---------- загадка пирамиды «Пары» ----------
/** Решить загадку пирамиды: приз — раз в день (по звёздам), в первый раз — наклейка. */
export async function pairsGame() {
  sfx('door');
  const paid = !SD().pairs,
    c = DESERT.pairs.coins,
    note = (html) => `<div class="pay-note${paid ? '' : ' off'}">${html}</div>`;
  const res = await playMinigame('pairs', {
    introNote: paid
      ? note(`🔺 <b>Сокровище пирамиды:</b> ⭐ 🪙 ${c[0]} · ⭐⭐ 🪙 ${c[1]} · ⭐⭐⭐ 🪙 ${c[2]} — раз в день.`)
      : note('💛 Сегодня пирамида уже открыла тебе сокровище. Решить загадку можно для удовольствия — завтра снова!'),
    resultNote: (stars) => (paid ? note(`<span class="sum">🪙 Сокровище: +${fmtMoney(c[stars - 1])}</span>`) : note('💛 Эта загадка была для удовольствия.')),
  });
  if (!res) return res;
  award('x_pyramid', { delay: 1200 });
  if (!paid) return res;
  setDayFlag('pairs', 1, 'desert');
  earn(c[res.stars - 1], 'work');
  sfx('coin');
  toast(`🔺 Тайна пирамиды разгадана! 🪙 +${fmtMoney(c[res.stars - 1])}`, 'good');
  return res;
}

// ---------- верблюд Финик ----------
/** Покататься на верблюде (из разговора с Барханом или у привязи): хомячок садится на Финика. */
export function rideCamel(ctx) {
  const sc = (ctx && ctx.scene) || (sceneName() === 'desert' ? getLocation('desert') : null);
  if (!sc || !startCamelRide(sc)) return false;
  sfx('pop');
  toast('🐫 Держись крепче! Финик идёт по кругу — цок-цок по песку…', 'good');
  return true;
}
on('desert', ({ what }) => {
  if (!S()) return;
  if (what === 'ride') {
    sfx('win');
    if (award('x_camel', { delay: 900 })) toast('🐫 Вот это прогулка! Финик доволен и фыркает от радости.', 'good');
    else toast('🐫 Финик довёз тебя обратно к шатру. Прокатимся ещё?', 'good');
  } else if (what === 'mirage') {
    sfx('magic');
    toast('🏝️ Ой! Озеро с пальмами… исчезло! Это был мираж: в жару воздух дрожит и «рисует» воду вдали.', 'good');
    award('x_mirage', { delay: 1800 });
  }
});

// ---------- Звёздный бархан: звездопад и желание ----------
const WISHES = [
  '🐹 Чтобы все друзья были счастливы',
  '🏰 Свой замок до самых облаков',
  '🌈 Чтобы завтра светило солнышко',
  '🦄 Встретить настоящего единорога',
];
/** Ночное небо над барханами: звёзды и падающие звёзды (t — время, для мерцания). */
function paintStarSky(ctx, w, h, t, look) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#0b1340');
  g.addColorStop(0.7, '#2b2a6e');
  g.addColorStop(1, '#5a3d7a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 90; i++) {
    const x = ((i * 0.618) % 1) * w,
      y = ((i * 0.377) % 1) * h * 0.72,
      r = 0.6 + ((i * 7) % 5) * 0.35,
      a = 0.5 + Math.sin(t * 2 + i) * 0.4;
    ctx.globalAlpha = Math.max(0.15, a);
    ell(ctx, x, y, r, r, '#ffffff');
  }
  ctx.globalAlpha = 1;
  ell(ctx, w * 0.82, h * 0.16, 16, 16, '#fff3bf');
  ell(ctx, w * 0.82 + 6, h * 0.16 - 4, 13, 13, '#1a1f5a');
  // падающие звёзды
  for (let i = 0; i < 3; i++) {
    const k = (t * 0.45 + i / 3) % 1,
      sx = w * (0.1 + i * 0.28),
      sy = h * (0.04 + (i % 2) * 0.1),
      x = sx + k * w * 0.3,
      y = sy + k * h * 0.3;
    ctx.globalAlpha = Math.sin(k * Math.PI);
    line(ctx, x - 40, y - 40 * (h / w), x, y, 'rgba(255,250,210,.9)', 2.4);
    ell(ctx, x, y, 3, 3, '#ffffff');
  }
  ctx.globalAlpha = 1;
  // барханы и хомячок на гребне
  poly(ctx, [0, h, 0, h * 0.8, w * 0.3, h * 0.72, w * 0.6, h * 0.8, w, h * 0.74, w, h], '#6b4f7a');
  poly(ctx, [0, h, 0, h * 0.9, w * 0.4, h * 0.84, w * 0.75, h * 0.92, w, h * 0.88, w, h], '#4f3b62');
  drawHamster(ctx, w * 0.32, h * 0.76, 0.55, look, { time: t, dir: 0, happy: true, armsUp: Math.sin(t * 3) > 0.6, shadow: false });
}
/** Загадать желание на Звёздном бархане: ночью — окно со звездопадом; днём — когда приходить. */
export function makeWish() {
  if (darkness() < 0.5) {
    toast('🌠 Днём звёзд не видно. Приходи на Звёздный бархан ночью — когда стемнеет, здесь падают звёзды!');
    return false;
  }
  sfx('magic');
  let wished = null,
    raf = 0;
  const look = playerLook();
  return openPanel({
    title: 'Звездопад',
    icon: '🌠',
    cls: 'wide',
    render(body, tab, api) {
      cancelAnimationFrame(raf);
      const W = Math.min(520, window.innerWidth - 60),
        H = Math.round(W * 0.5);
      const { canvas, ctx } = makeCanvas(W, H);
      canvas.style.cssText += ';display:block;margin:0 auto;border-radius:14px;max-width:100%;height:auto';
      body.appendChild(canvas);
      const t0 = performance.now();
      const loop = (now) => {
        if (api.closed) return;
        paintStarSky(ctx, W, H, (now - t0) / 1000, look);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
      if (wished) {
        body.appendChild(el('p', 'center', `Желание загадано: «${esc(wished.replace(/^\S+\s/, ''))}». Тс-с — никому не говори, и оно обязательно сбудется! ✨`));
        return;
      }
      body.appendChild(el('p', 'center', 'Смотри — падают звёзды! Скорее загадай желание:'));
      const box = el('div', 'wish-list');
      box.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:6px';
      for (const w of WISHES) {
        const b = el('button', 'btn blue wish', esc(w));
        b.onclick = () => {
          wished = w;
          sfx('win');
          award('x_wish', { delay: 900 });
          emit('desert', { what: 'wish' });
          api.refresh();
        };
        box.appendChild(b);
      }
      body.appendChild(box);
    },
    onClose: () => cancelAnimationFrame(raf),
    foot: [{ text: 'Спокойной ночи, звёзды! 🌙', cls: 'green', fn: (api) => api.close() }],
  });
}

// ---------- оазис, колодец, бубенчик ----------
let heatMin = 0,
  heatDay = -1;
export function drinkOasis() {
  sfx('splash');
  heatMin = 0;
  emit('desert', { what: 'oasis' });
  toast('🌴 Прохладная вода оазиса! Ты умылась и попила — сразу легче. Вокруг шелестят пальмы.', 'good');
  return true;
}
export function lookWell() {
  sfx('bubble');
  toast('🪣 Старый колодец. Крикни в него: «Ау-у!» — и колодец ответит эхом: «у-у-у…» Воды в нём давно нет — вся вода в оазисе.');
  return true;
}
/** Нашли бубенчик Финика (место bell видно, пока задание на первом шаге). */
export async function findBell() {
  emit('desert', { what: 'bell' });
  sfx('win');
  await message({
    title: 'Бубенчик нашёлся!',
    icon: '🔔',
    html: '<p class="center big-emoji">🔔✨</p><p class="center">Дзынь-дзынь! Вот он — золотой, на красной ленточке, у самого колодца. Теперь отнеси его Финику и прокатись на нём — пусть звенит!</p>',
    buttons: [{ text: 'Ура!' }],
  });
}

const DESERT_ACTS = {
  dig: digGame,
  pairs: pairsGame,
  camel: rideCamel,
  stars: makeWish,
  oasis: drinkOasis,
  well: lookWell,
  bell: findBell,
};
register(
  'desert',
  (p, ctx) => DESERT_ACTS[p.arg] && DESERT_ACTS[p.arg](ctx),
  'пустыня: desert:dig | pairs | camel | stars | oasis | well | bell',
);

// ---------- жара: днём без шляпы — добрая подсказка (раз в день) ----------
on('step', ({ dt }) => {
  const s = S();
  if (!s || sceneName() !== 'desert') return;
  if (s.day !== heatDay) {
    heatDay = s.day;
    heatMin = 0;
  }
  const sc = scene();
  if (!sc.hot || !sc.hot() || SD().heat) return;
  const head = playerLook().outfit.head;
  if (isSunHat(typeof head === 'string' ? CLOTHES_BY_ID[head] : head)) return;
  heatMin += dt / 0.6;
  if (heatMin < DESERT.heat) return;
  setDayFlag('heat', 1, 'desert');
  toast('☀️ Ух, как печёт солнышко! Надень шляпу от солнца или панамку — в пустыне без неё жарко. И попей водички в оазисе 🌴');
});
on('scene', ({ name }) => {
  if (name !== 'desert' || !S() || S().flags.desertHint) return;
  setFlag('desertHint');
  toast('🐫 Вот она — пустыня! Барханы, пальмы и жаркое солнце. Кочевник Бархан — у шатра в оазисе, прямо по тропе на север.', 'good');
});

// ---------- караван-автобус ----------
/** Картинка переезда: город вдали, барханы и кактусы, по дороге едет караван-автобус (k — 0..1 пути). */
export function paintCaravan(ctx, w, h, k, toDesert, look, t) {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#74c0fc');
  sky.addColorStop(1, '#fff3d6');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  ell(ctx, w * 0.84, h * 0.2, 26, 26, '#ffe066');
  ell(ctx, w * 0.84, h * 0.2, 36, 36, 'rgba(255,224,102,.3)');
  // город — у левого края, пирамида — у правого
  ctx.fillStyle = '#a5b4cf';
  for (const [x, bw, bh] of [
    [0.02, 0.05, 0.32],
    [0.07, 0.04, 0.22],
    [0.11, 0.06, 0.4],
    [0.17, 0.04, 0.18],
  ])
    ctx.fillRect(w * x, h * (0.62 - bh), w * bw, h * bh);
  poly(ctx, [w * 0.68, h * 0.62, w * 0.78, h * 0.4, w * 0.88, h * 0.62], '#e8b974', OUT, 1.6);
  // барханы
  poly(ctx, [0, h, 0, h * 0.62, w * 0.3, h * 0.58, w * 0.55, h * 0.64, w * 0.8, h * 0.56, w, h * 0.62, w, h], '#f2d39a', OUT, 2);
  poly(ctx, [0, h, 0, h * 0.86, w * 0.35, h * 0.8, w * 0.7, h * 0.88, w, h * 0.82, w, h], '#e6c288');
  // кактусы и пальма
  for (const x of [0.28, 0.58, 0.9]) {
    fillRR(ctx, w * x - 5, h * 0.6, 10, 28, 5, '#4f9a3a', OUT, 1.6);
    fillRR(ctx, w * x + 4, h * 0.62, 7, 12, 3, '#4f9a3a', OUT, 1.2);
  }
  // дорога
  fillRR(ctx, -10, h * 0.7, w + 20, 22, 8, '#d9b06c', OUT, 1.6);
  for (let x = ((t * 120) % 40) - 40; x < w; x += 40) fillRR(ctx, x, h * 0.7 + 10, 18, 3, 1.5, '#fff3d6');
  // автобус: едет вправо (в пустыню) или влево (в город)
  const dir = toDesert ? 1 : -1,
    z = w / 560, // масштаб картинки
    bx = toDesert ? -150 * z + k * (w + 120 * z) : w + 30 * z - k * (w + 180 * z),
    by = h * 0.74 + Math.sin(t * 18) * 1.2;
  ctx.save();
  ctx.translate(bx, by);
  ctx.scale(0.95 * z, 0.95 * z);
  paintBus(ctx, dir);
  // хомячок в окошке
  ctx.save();
  ctx.beginPath();
  ctx.rect(dir > 0 ? 44 : 22, -52, 24, 22);
  ctx.clip();
  drawHamster(ctx, dir > 0 ? 56 : 34, -16, 0.42, look, { time: t, dir, happy: true, shadow: false });
  ctx.restore();
  ctx.restore();
  // пыль из-под колёс
  for (let i = 0; i < 4; i++) {
    const ph = (t * 2 + i / 4) % 1;
    ctx.globalAlpha = 0.5 * (1 - ph);
    ell(ctx, bx + (toDesert ? -30 * z - ph * 50 * z : 120 * z + ph * 50 * z), by + 4 - ph * 12, (8 + ph * 12) * z, (5 + ph * 7) * z, '#e6c288');
  }
  ctx.globalAlpha = 1;
  // верблюд идёт рядом (караван!)
  ctx.save();
  ctx.translate(toDesert ? bx - 95 * z : bx + 215 * z, h * 0.69);
  ctx.scale(0.6 * z, 0.6 * z);
  paintCamel(ctx, dir, 1 + (Math.floor(t * 6) % 2));
  ctx.restore();
}
let riding = false;
/** Проехать на караван-автобусе: toDesert — из города в пустыню, иначе — обратно в город. */
export function rideCaravan(toDesert) {
  if (riding) return false;
  const land = LAND_BY_ID.desert;
  riding = true;
  sfx('door');
  const W = Math.min(560, window.innerWidth - 32),
    H = Math.round(W * 0.56);
  const f = el(
    'div',
    'fade cable-ride caravan-ride',
    `<div class="msg"><div><div class="ride-pic"></div><p>${toDesert ? '🚌 Едем в пустыню!' : '🚌 Едем домой, в город!'}</p></div></div>`,
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
    DUR = 2400;
  const loop = (now) => {
    const t = (now - t0) / 1000,
      p = Math.min(1, (now - t0) / DUR),
      e = p * p * (3 - 2 * p);
    paintCaravan(ctx, W, H, e, toDesert, look, t);
    if (p < 1) raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  requestAnimationFrame(() => f.classList.add('on'));
  setTimeout(() => {
    cover = openLayer({ pause: false, cover: true }); // экран уже тёмный — сцену под ним не рисуем
  }, 400);
  setTimeout(() => {
    if (toDesert) go(land.scene, { at: land.entry });
    else go(land.from, { at: 'bus' });
  }, DUR - 300);
  setTimeout(() => {
    cancelAnimationFrame(raf);
    if (cover) cover();
    f.classList.remove('on');
    setTimeout(() => {
      f.remove();
      closeLayer();
      riding = false;
      sfx('ding');
    }, 380);
  }, DUR + 150);
  return true;
}
register('caravan', (p) => rideCaravan(p.arg !== 'back'), 'караван-автобус: caravan:go (из города в пустыню) | caravan:back');
