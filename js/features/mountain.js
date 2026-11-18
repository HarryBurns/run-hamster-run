// ГОРА (П.9): что делают на горе и по дороге туда. Сама локация (где что стоит) — locations/mountain.js; она называет
// действия реестра, а выполняются они здесь:
//   задание Сени «На вершину!» (data/quests.js, summit) — своё «как дела» (hintWarm): нет тёплых вещей — где купить,
//                        а если и назавтра нет — Сеня дарит свою шапку (так задание выполнимо в любой сезон)
//   mountain:spring     горячий источник: окунуться (хомячок сидит в воде, пар); снимает «мороз» за день (событие
//                       warmup — features/health.js); простуду не лечит — добрая фраза
//   mountain:edelweiss  эдельвейс: летом один в день (находка); из трёх Вершинкин делает «Эдельвейсы в рамке»
//   mountain:view       смотровая площадка с флагом: окно-панорама — лес, город и море; в первый раз — наклейка
//   mountain:snowman    снеговик-строитель: покатать три кома, надеть ведро, нос-морковка из рюкзака; стоит до конца дня
//   mountain:sled       мини-игра «Спуск на санках» (minigames/sled.js) — её предлагает Вершинкин (и старт трассы):
//                       за первые MOUNTAIN.sled.paid игр в день он платит монетами по звёздам
//   instructor          поговорить с инструктором Вершинкиным (житель горы у шале на трассе): задание, санки, болтовня
//   cableway:up | down   канатная дорога: вагончик едет на гору из леса (вход way:mountain у станции в лесу —
//                        LANDS.mountain.go) и обратно в лес (станция на горе); короткая картинка-переезд
// Числа — MOUNTAIN в data/economy.js. Каждое занятие шлёт событие mountain { what } — по нему считают задания.
// Состояние меняют только действия (core/actions.js); «раз в день» — отметки дня (dayFlags.mountain).
import { setFlag, setDayFlag, addClothes, addItem, award } from '../core/actions.js';
import { sfx } from '../core/audio.js';
import { makeCanvas, ell, fillRR, line, poly } from '../core/draw.js';
import { go } from '../core/loop.js';
import { register } from '../core/registry.js';
import { emit } from '../core/events.js';
import { G, cal, darkness, hasClothes, playerLook, isSick, count } from '../core/state.js';
import { el, esc, pick, fmtMoney } from '../core/util.js';
import { drawHamster } from '../art/hamster.js';
import {
  CLOTHES,
  CLOTHES_BY_ID,
  LAND_BY_ID,
  NPC_BY_ID,
  ING_BY_ID,
  FIND_BY_ID,
  MOUNTAIN,
  npcLook,
  isWarmItem,
} from '../data/index.js';
import { ART } from '../engine/topdown/index.js';
import { VIEW_LAYERS, viewEnv, renderViewLayer } from '../interiors/tower_view.js';
import { startBath, snowmanNow } from '../locations/mountain.js';
import { dialog } from '../ui/dialog.js';
import { openLayer } from '../ui/modals.js';
import { message, openPanel } from '../ui/panel.js';
import { toast } from '../ui/toast.js';
import { frostToday } from './health.js';
import { prizeGame } from './minigames.js';
import { setWaitHook, questTalk } from './quests.js';
import { placeLine } from './tales.js';

const S = () => G.state;

// ---------- задание Сени: тёплые вещи ----------
/** Шапка, которую Сеня дарит, если у хомячка совсем нет тёплых вещей. */
export const SENYA_HAT = 'beanie_blue';
/** Есть ли в шкафу хоть одна тёплая вещь (шапка, куртка, кофта, шарф…). */
export const ownsWarm = () => CLOTHES.some((c) => isWarmItem(c) && hasClothes(c.id));
/**
 * «Как дела?» у Сени на шаге «оденься тепло»: тёплое в шкафу есть — надень; нет — где купить (отметка дня
 * flags.senyaNoWarm); пришла назавтра и всё ещё нет — Сеня дарит свою шапку.
 */
export function hintWarm(w) {
  if (w.i !== 1) return null;
  const s = S();
  if (ownsWarm())
    return 'Плаваешь ты как чемпион! Теперь оденься потеплее: у тебя в шкафу есть тёплые вещи — надень шапку, куртку, кофту или шарф (шкаф — дома 🏡) и приходи!';
  const asked = s.flags.senyaNoWarm;
  if (Number.isFinite(asked) && s.day > asked && !hasClothes(SENYA_HAT)) {
    addClothes(SENYA_HAT);
    sfx('win');
    toast(`🎁 Подарок от Сени: ${CLOTHES_BY_ID[SENYA_HAT].name} — уже в шкафу!`, 'good');
    return `Не нашла тёплых вещей? Ничего! Держи мою запасную шапку — ${CLOTHES_BY_ID[SENYA_HAT].name.toLowerCase()}. Она уже у тебя в шкафу: надень её дома и приходи!`;
  }
  if (!Number.isFinite(asked)) setFlag('senyaNoWarm', s.day);
  return 'Ой, а у тебя совсем нет тёплых вещей? Кофты продаются в ТЦ «Модный» каждый день, а шапки, куртки и шарфы — осенью и зимой. Не найдёшь — загляни ко мне завтра, что-нибудь придумаем!';
}
setWaitHook('summit', hintWarm);

// ---------- инструктор Вершинкин ----------
const VERSHINKIN = 'vershinkin';
/** Что сказать под настроение: ночью — про звёзды, вечером — про закат, днём — про сезон. */
export function vershinkinLine() {
  const place = placeLine(VERSHINKIN); // вспомнить соседнее место, которое хомячок открыла (data/tales.js)
  if (place) return place;
  const L = NPC_BY_ID[VERSHINKIN].lines,
    m = S().minutes;
  if (darkness() > 0.6 || m >= 22 * 60 || m < 5 * 60) return pick(L.night);
  if (m >= 18 * 60) return pick(L.evening);
  return pick(L[cal().season]);
}
const sayV = (text, options, happy = false) =>
  dialog({ look: npcLook(VERSHINKIN), name: NPC_BY_ID[VERSHINKIN].name, text, options, happy });
/** Разговор с инструктором: сначала задание из журнала (взять, как дела, сдать), потом — санки и болтовня. */
export async function talkVershinkin() {
  const s = S();
  let text;
  if (!s.flags.metVershinkin) {
    setFlag('metVershinkin');
    text = `Привет-привет, ${esc(s.name)}! Я инструктор Вершинкин. Сеня написал, что к нам поднимается чемпионка! На горе есть трасса для санок, горячий источник, а на самой вершине — смотровая площадка с флагом. Добро пожаловать!`;
  } else text = pick([`Привет, ${esc(s.name)}!`, 'О, снова ты! Здорово!', 'Привет, покорительница вершин!']);
  emit('talk', { id: VERSHINKIN });
  sfx('tap');
  const qt = await questTalk(VERSHINKIN);
  if (qt && qt.end) return;
  if (qt && qt.text) text = qt.text;
  for (;;) {
    const opts = [];
    for (const o of MORE_TALK) {
      const x = o(S());
      if (x) opts.push(x);
    }
    opts.unshift({ text: '🛷 Спуск с горы', cls: 'yellow', fn: async () => (await sledRide(), null) });
    opts.push({ text: '💬 Поболтать', cls: 'blue', go: 'chat' }, { text: 'Пока!', go: 'bye' });
    const i = await sayV(text, opts);
    const o = opts[i] || {};
    if (o.go === 'chat') text = vershinkinLine();
    else if (o.fn) {
      const r = await o.fn();
      if (!r) return;
      text = r;
    } else return;
  }
}
/** Дополнительные ответы в разговоре с инструктором: (s) → { text, cls, fn: async () => следующая реплика | null }. */
const MORE_TALK = [
  // эдельвейсы в рамке (украшение для дома) из MOUNTAIN.frame эдельвейсов
  (s) =>
    (s.finds.edelweiss || 0) > 0 && {
      text: `🖼️ Эдельвейсы в рамке (${s.finds.edelweiss} из ${MOUNTAIN.frame})`,
      cls: 'green',
      fn: async () => {
        if (count('finds', 'edelweiss') < MOUNTAIN.frame)
          return `Для рамки нужно ${MOUNTAIN.frame} эдельвейса, а у тебя ${count('finds', 'edelweiss')}. Летом ищи их на лугах — по одному в день!`;
        addItem('finds', 'edelweiss', -MOUNTAIN.frame);
        addItem('storage', 'edelweiss_frame', 1);
        sfx('win');
        award('x_edelweiss', { delay: 1200 });
        emit('mountain', { what: 'frame' });
        return 'Вот, держи: эдельвейсы под стеклом в рамке! Повесь дома на стену — будет напоминать о горах 🏔️ Рамка уже в кладовке: дома нажми 🔨.';
      },
    },
  // морковка для снеговика: снеговик ждёт носик, а в рюкзаке морковки нет — раз в день
  (s) =>
    snowmanNow().stage === 4 &&
    !count('ing', 'carrot') &&
    !(s.dayFlags.mountain || {}).carrot && {
      text: '🥕 Морковку для снеговика',
      cls: 'yellow',
      fn: async () => {
        setDayFlag('carrot', 1, 'mountain');
        addItem('ing', 'carrot', 1);
        sfx('coin');
        return `Держи! Я всегда храню морковку для снеговиков 🥕 Беги на снежную поляну — пусть у него будет нос!`;
      },
    },
];
register('instructor', () => talkVershinkin(), 'инструктор Вершинкин: разговор (житель горы у шале)');

// ---------- горячий источник ----------
const S2 = () => S().dayFlags.mountain || {};
/** Окунуться в горячий источник: хомячок садится в воду (сцена горы); снимает «мороз» за день. */
export function visitSpring(sc) {
  if (sc && sc.name === 'mountain') startBath(sc);
  sfx('splash');
  const frost = frostToday();
  emit('warmup');
  emit('mountain', { what: 'spring' });
  if (!S2().spring) {
    setDayFlag('spring', 1, 'mountain');
    award('x_spring', { delay: 1600 });
  }
  if (isSick())
    toast(
      '♨️ Тёплая водичка… Ох, хорошо! Только простуду источник не лечит — загляни к доктору в больницу 🏥 А пока грейся!',
    );
  else if (frost) toast('♨️ Ах, тепло! Лапки согрелись — мороза как не бывало 🥰', 'good');
  else toast('♨️ Ах, как тепло! Над водой пар, а вокруг — горы. Нажми куда-нибудь, чтобы вылезти.', 'good');
  return true;
}

// ---------- эдельвейсы ----------
/** Сорвать эдельвейс: летом один в день на всю гору — в рюкзак (находка). */
export function pickEdelweiss() {
  if (cal().season !== 'summer') {
    toast(FIND_BY_ID.edelweiss.e + ' Эдельвейсы цветут только летом. Приходи в июне, июле или августе!');
    return false;
  }
  if (S2().edelweiss) {
    toast(FIND_BY_ID.edelweiss.e + ' Эдельвейс — редкий цветок: один в день. Завтра распустится ещё!');
    return false;
  }
  setDayFlag('edelweiss', MOUNTAIN.edelweiss, 'mountain');
  addItem('finds', 'edelweiss', MOUNTAIN.edelweiss);
  sfx('coin');
  const n = count('finds', 'edelweiss');
  toast(
    `${FIND_BY_ID.edelweiss.e} Эдельвейс — редкий горный цветок! В рюкзаке: ${n}.${n < MOUNTAIN.frame ? ` Собери ${MOUNTAIN.frame} — Вершинкин сделает из них картину в рамке.` : ' Можно идти к Вершинкину за рамкой!'}`,
    'good',
  );
  emit('mountain', { what: 'edelweiss' });
  return true;
}

// ---------- смотровая площадка ----------
/**
 * Вид с вершины на юг: вдали — город и море слоями вида с башни (interiors/tower_view.js — те же небо, море
 * с островами, пляж и кварталы, только мельче: гора дальше от города, чем башня), над ними — Хомяк-Тауэр, ближе —
 * лес под горой, облака ниже вершины и снежный край вершины с флагом.
 */
export function paintSummitView(ctx, w, h, season, dark) {
  const env = viewEnv(season, dark),
    dpr = Math.min(window.devicePixelRatio || 1, 2.5),
    cityBot = h * 0.6,
    k = cityBot / VIEW_LAYERS.find((l) => l.id === 'mid').y1, // пикселей на единицу панорамы
    L = w / k;
  for (const l of VIEW_LAYERS) {
    if (l.id === 'near') continue; // крыши у самой башни отсюда не видно
    const r = renderViewLayer(l, L, env, k * dpr);
    ctx.drawImage(r.c, 0, r.top / dpr, r.c.width / dpr, r.c.height / dpr);
  }
  // Хомяк-Тауэр посреди города (с башни её не видно — мы на ней стояли)
  const tx = w * 0.5,
    tb = cityBot - 18,
    th = h * 0.27;
  fillRR(ctx, tx - 8, tb - th, 16, th, 4, env.c('#a5d8ff', 0.5), env.out, 1.6);
  for (let y = tb - th + 8; y < tb - 6; y += 9) {
    ctx.fillStyle = env.lit ? '#ffe066' : 'rgba(255,255,255,.7)';
    ctx.fillRect(tx - 4.5, y, 3, 4);
    ctx.fillRect(tx + 1.5, y, 3, 4);
  }
  poly(ctx, [tx - 9, tb - th, tx, tb - th - 15, tx + 9, tb - th], env.c('#ffd43b', 0.5), env.out, 1.4);
  ell(ctx, tx, tb - th - 17, 3, 3, '#ff6b6b');
  // лес под горой: ряды крон и ёлок, ближние крупнее
  const leaf = env.leaf;
  for (let row = 0; row < 4; row++) {
    const y = h * (0.6 + row * 0.07),
      sc = 0.6 + row * 0.18;
    for (let i = 0, x = -10 + row * 9; x < w + 30; i++, x += 24 * sc) {
      const yy = y + ((i * 13) % 7);
      if ((i + row) % 3 === 0) {
        poly(ctx, [x - 14 * sc, yy + 14 * sc, x, yy - 28 * sc, x + 14 * sc, yy + 14 * sc], env.fir, env.out, 1.2);
        if (env.snow) poly(ctx, [x - 6 * sc, yy - 14 * sc, x, yy - 28 * sc, x + 6 * sc, yy - 14 * sc], '#ffffff');
      } else {
        ell(ctx, x, yy, 16 * sc, 12 * sc, leaf[(i + row) % leaf.length], env.out, 1.2);
        ell(ctx, x - 5 * sc, yy - 4 * sc, 6 * sc, 3.5 * sc, 'rgba(255,255,255,.3)');
      }
    }
  }
  // облака ниже вершины
  for (let i = 0; i < 6; i++) {
    const x = ((i * 0.23 + 0.05) % 1) * w,
      y = h * (0.6 + (i % 3) * 0.06);
    ctx.globalAlpha = env.d > 0.5 ? 0.45 : 0.85;
    for (const [dx, dy, r] of [
      [0, 0, 34],
      [30, -10, 26],
      [58, 2, 30],
    ])
      ell(ctx, x + dx, y + dy, r, r * 0.55, '#ffffff');
    ctx.globalAlpha = 1;
  }
  // край вершины в снегу и флаг
  const snowTop = [0, h * 0.88, w * 0.18, h * 0.84, w * 0.36, h * 0.86, w * 0.55, h * 0.82, w * 0.78, h * 0.85, w, h * 0.83];
  poly(ctx, [0, h, ...snowTop, w, h], '#ffffff', OUT, 2);
  poly(ctx, [w * 0.55, h * 0.82, w * 0.78, h * 0.85, w, h * 0.83, w, h, w * 0.62, h], '#e3eef8');
  for (let i = 0; i < 6; i++) ell(ctx, w * (0.1 + i * 0.15), h * 0.93 + (i % 2) * 6, 14, 4, '#e7f1f9');
  line(ctx, w * 0.84, h * 0.86, w * 0.84, h * 0.56, OUT, 4);
  line(ctx, w * 0.84, h * 0.86, w * 0.84, h * 0.56, '#dee2e6', 2);
  poly(ctx, [w * 0.84, h * 0.56, w * 0.95, h * 0.59, w * 0.84, h * 0.635], '#ff6b9d', OUT, 1.6);
  if (env.d > 0.3) {
    // вечером и ночью — темнее (слои города уже тёмные)
    ctx.fillStyle = `rgba(27,31,74,${(env.d * 0.35).toFixed(2)})`;
    ctx.fillRect(0, h * 0.55, w, h * 0.45);
  }
}
/** Подняться на смотровую площадку: окно с видом на лес, город и море; в первый раз — наклейка. */
export function climbLookout() {
  sfx('door');
  emit('mountain', { what: 'summit' });
  emit('visit', { place: 'summit' });
  award('x_summit', { delay: 1400 });
  const season = cal().season,
    dark = darkness();
  return openPanel({
    title: 'Смотровая площадка',
    icon: '🔭',
    cls: 'wide',
    render(body) {
      const W = Math.min(560, window.innerWidth - 60),
        H = Math.round(W * 0.62);
      const { canvas, ctx } = makeCanvas(W, H);
      canvas.style.cssText += ';display:block;margin:0 auto;border-radius:14px;max-width:100%;height:auto';
      paintSummitView(ctx, W, H, season, dark);
      body.appendChild(canvas);
      body.appendChild(
        el(
          'p',
          'center',
          'Ты на самой вершине! Облака — внизу, под ними шумит лес, дальше — город с Хомяк-Тауэром, а на горизонте блестит море. Флаг на вершине машет тебе: «Ура, покорительница вершин!» 🚩',
        ),
      );
    },
    foot: [{ text: 'Красота! 🏔️', cls: 'green', fn: (api) => api.close() }],
  });
}

// ---------- снеговик-строитель ----------
/** Нарисовать снеговик в окне (stage, roll — как в мире). */
function paintSnowmanPic(ctx, w, h, sm) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#d0ebff');
  g.addColorStop(1, '#f8fbff');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ell(ctx, w / 2, h - 10, w * 0.6, 26, '#ffffff', '#cfe3f0', 2);
  ctx.save();
  ctx.translate(w / 2 - 20, h - 18);
  ctx.scale(1.5, 1.5);
  ART.snowman[1](ctx, sm.stage, sm.stage < 3 ? sm.roll : 0); // тот же рисунок, что в мире (mountain_art.js)
  ctx.restore();
  // ведёрко ждёт рядом, пока его не надели
  if (sm.stage < 4) {
    poly(ctx, [w - 70, h - 22, w - 46, h - 22, w - 49, h - 46, w - 67, h - 46], '#74c0fc', OUT, 2);
    line(ctx, w - 72, h - 22, w - 44, h - 22, OUT, 3);
  }
}
/** Слепить снеговика: окно с картинкой и кнопкой следующего шага. Сделанное лежит в отметках дня. */
export function buildSnowman() {
  let pic = null;
  const step = () => {
    const sm = snowmanNow();
    if (sm.stage < 3) {
      const roll = sm.roll + 1;
      sfx('stepSnow');
      if (roll >= MOUNTAIN.snowman) {
        setDayFlag('snowman', sm.stage + 1, 'mountain');
        setDayFlag('roll', 0, 'mountain');
        sfx('pop');
      } else setDayFlag('roll', roll, 'mountain');
      return;
    }
    if (sm.stage === 3) {
      setDayFlag('snowman', 4, 'mountain');
      sfx('tap');
      return;
    }
    if (sm.stage === 4) {
      if (!count('ing', 'carrot')) {
        toast(
          `🥕 Нос — из морковки! В рюкзаке её нет. Морковку продают в ТЦ «Вкусный», она растёт на грядке — а ещё она всегда есть у инструктора Вершинкина.`,
        );
        return;
      }
      addItem('ing', 'carrot', -1);
      setDayFlag('snowman', 5, 'mountain');
      if (cal().season === 'winter') setFlag('snowmanDay', S().day); // зимой простоит несколько дней (Г7)
      sfx('win');
      award('x_snowman', { delay: 900 });
      emit('mountain', { what: 'snowman' });
    }
  };
  const label = (sm) =>
    sm.stage < 3
      ? `⛄ Катать ${['большой', 'средний', 'маленький'][sm.stage]} ком (${sm.roll}/${MOUNTAIN.snowman})`
      : sm.stage === 3
        ? '🪣 Надеть ведро-шапку'
        : sm.stage === 4
          ? `🥕 Нос-морковка${count('ing', 'carrot') ? '' : ' (нет в рюкзаке)'}`
          : '';
  const say = (sm) =>
    sm.stage < 3
      ? 'Катай снежный ком — он растёт с каждым разом! Три кома — большой, средний и маленький — и снеговик готов стоять.'
      : sm.stage === 3
        ? 'Снеговик стоит! Глазки-угольки и ручки-веточки уже есть. Рядом лежит ведёрко — надень его снеговику как шапку!'
        : sm.stage === 4
          ? 'Осталось самое главное — нос! Нужна морковка из рюкзака 🥕'
          : sm.kept
            ? 'Снеговик, которого ты слепила, всё ещё стоит — зима, он не тает! Можно полюбоваться ⛄'
            : cal().season === 'winter'
              ? `Ура! Снеговик готов — с ведром на голове и носом-морковкой. Пока зима, он простоит здесь ${MOUNTAIN.snowmanDays} дня! ⛄`
              : 'Ура! Снеговик готов — с ведром на голове и носом-морковкой. Он простоит здесь до конца дня! ⛄';
  return openPanel({
    title: 'Снеговик',
    icon: '⛄',
    cls: 'narrow',
    render(body, tab, api) {
      const sm = snowmanNow();
      const W = Math.min(320, window.innerWidth - 60),
        H = 200;
      pic = makeCanvas(W, H);
      pic.canvas.style.cssText += ';display:block;margin:0 auto 8px;border-radius:14px';
      paintSnowmanPic(pic.ctx, W, H, sm);
      body.appendChild(pic.canvas);
      body.appendChild(el('p', 'center', say(sm)));
      if (sm.stage < 5) {
        const b = el('button', 'btn big green snow-step', label(sm));
        b.style.cssText = 'display:block;margin:6px auto 0';
        b.onclick = () => {
          step();
          api.refresh();
        };
        body.appendChild(b);
      }
    },
    foot: [{ text: 'Готово', cls: 'ghost', fn: (api) => api.close() }],
  });
}

// ---------- «Спуск на санках» ----------
/** Спуститься на санках: за первые игры дня Вершинкин платит монетами по звёздам. */
export const sledRide = () =>
  prizeGame('sled', {
    group: 'mountain',
    flag: 'sleds',
    ...MOUNTAIN.sled,
    label: '🛷 <b>Приз Вершинкина:</b>',
    words: ['спуск', 'спуска'],
    done: '💛 Сегодня Вершинкин уже вручил тебе призы. Скатиться можно для удовольствия — завтра призы снова!',
    sum: (stars) => `🪙 Приз: +${fmtMoney(MOUNTAIN.sled.coins[stars - 1])}`,
    fun: '💛 Этот спуск был для удовольствия.',
    thanks: 'Вершинкин: «Вот это спуск!»',
  });

// ---------- варежка Вершинкина (задание «Потерянная варежка», data/quests.js) ----------
/** Нашли варежку на вершине (место mitten видно, пока задание на первом шаге). */
export async function findMitten() {
  emit('mountain', { what: 'mitten' });
  sfx('win');
  await message({
    title: 'Варежка нашлась!',
    icon: '🧤',
    html: '<p class="center big-emoji">🧤❄️</p><p class="center">Вот она — синяя, со снежинкой! Зацепилась за сугроб у смотровой площадки. Теперь — скатиться на санках и отнести варежку Вершинкину!</p>',
    buttons: [{ text: 'Ура!' }],
  });
}

// ---------- действия на горе ----------
const MOUNTAIN_ACTS = {
  spring: (ctx) => visitSpring(ctx && ctx.scene),
  edelweiss: pickEdelweiss,
  view: climbLookout,
  snowman: buildSnowman,
  sled: sledRide,
  mitten: findMitten,
};
register(
  'mountain',
  (p, ctx) => MOUNTAIN_ACTS[p.arg] && MOUNTAIN_ACTS[p.arg](ctx),
  'гора: mountain:spring | edelweiss | view | snowman | sled | mitten',
);

// ---------- канатная дорога ----------
const OUT = '#4a3728';
/** Картинка переезда: лес внизу слева, гора со снежной шапкой справа, по тросу едет вагончик (k — 0..1 пути). */
export function paintRide(ctx, w, h, k, season, look, t) {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, season === 'winter' ? '#a9d4f2' : '#7cc8f8');
  sky.addColorStop(1, '#e7f6ff');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  // гора
  const mx = w * 0.72;
  poly(ctx, [mx - w * 0.5, h, mx, h * 0.12, mx + w * 0.5, h], '#9aa9c9', OUT, 2.5);
  poly(ctx, [mx, h * 0.12, mx + w * 0.5, h, mx + w * 0.12, h], '#7d8db0');
  poly(ctx, [mx - 52, h * 0.12 + 62, mx, h * 0.12, mx + 56, h * 0.12 + 66, mx + 26, h * 0.12 + 52, mx + 6, h * 0.12 + 70, mx - 22, h * 0.12 + 54], '#ffffff', OUT, 2);
  // облака ниже вершины
  for (let i = 0; i < 4; i++) {
    const cx = ((i * 0.31 + t * 0.03) % 1.3) * w - w * 0.15,
      cy = h * (0.36 + (i % 2) * 0.08);
    ctx.globalAlpha = 0.85;
    for (const [dx, dy, r] of [
      [0, 0, 30],
      [26, -8, 24],
      [50, 2, 26],
    ])
      ell(ctx, cx + dx, cy + dy, r, r * 0.6, '#ffffff');
    ctx.globalAlpha = 1;
  }
  // лес внизу
  const fir = season === 'winter' ? '#cfe3f0' : '#2b8a3e';
  for (let i = 0; i < 16; i++) {
    const x = (i / 15) * w * 0.75 - 10,
      y = h - 8 - ((i * 37) % 23);
    poly(ctx, [x - 20, y + 20, x, y - 38, x + 20, y + 20], fir, OUT, 1.6);
  }
  // трос и вагончик
  const ax = w * 0.06,
    ay = h * 0.82,
    bx = mx - 8,
    by = h * 0.2;
  line(ctx, ax, ay, bx, by, OUT, 2.2);
  const x = ax + (bx - ax) * k,
    y = ay + (by - ay) * k,
    sway = Math.sin(t * 3) * 0.06;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(sway);
  line(ctx, 0, 0, 0, 22, OUT, 2.4);
  fillRR(ctx, -34, 22, 68, 56, 14, '#fa5252', OUT, 2.5);
  fillRR(ctx, -26, 30, 52, 28, 6, '#cfeaff', OUT, 2);
  ctx.save();
  ctx.beginPath();
  ctx.rect(-26, 30, 52, 28);
  ctx.clip();
  drawHamster(ctx, 0, 80, 0.5, look, { time: t, shadow: false, happy: true });
  ctx.restore();
  ctx.fillStyle = 'rgba(0,0,0,.14)';
  ctx.fillRect(18, 24, 12, 52);
  ctx.restore();
}
let riding = false;
/** Проехать на канатной дороге: up — из леса на гору, иначе — с горы в лес. */
export function rideCableway(up) {
  if (riding) return false;
  const land = LAND_BY_ID.mountain;
  riding = true;
  sfx('lift');
  const W = Math.min(560, window.innerWidth - 32),
    H = Math.round(W * 0.62);
  const f = el('div', 'fade cable-ride', `<div class="msg"><div><div class="ride-pic"></div><p>${up ? '🚡 Едем на гору!' : '🚡 Едем вниз, в лес!'}</p></div></div>`);
  const { canvas, ctx } = makeCanvas(W, H);
  canvas.style.borderRadius = '18px';
  f.querySelector('.ride-pic').appendChild(canvas);
  document.body.appendChild(f);
  const closeLayer = openLayer();
  let cover = null,
    raf = 0;
  const t0 = performance.now(),
    look = playerLook(),
    season = cal().season,
    DUR = 2300;
  const loop = (now) => {
    const t = (now - t0) / 1000,
      p = Math.min(1, (now - t0) / DUR),
      e = p * p * (3 - 2 * p);
    paintRide(ctx, W, H, up ? 0.08 + e * 0.84 : 0.92 - e * 0.84, season, look, t);
    if (p < 1) raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  requestAnimationFrame(() => f.classList.add('on'));
  setTimeout(() => {
    cover = openLayer({ pause: false, cover: true }); // экран уже тёмный — сцену под ним не рисуем
  }, 400);
  setTimeout(() => {
    if (up) go(land.scene, { at: land.entry });
    else go(land.from, { at: 'station' });
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
register('cableway', (p) => rideCableway(p.arg !== 'down'), 'канатная дорога: cableway:up (из леса на гору) | cableway:down');
