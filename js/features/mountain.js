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
import { makeCanvas } from '../core/draw.js';
import { go } from '../core/loop.js';
import { register } from '../core/registry.js';
import { emit } from '../core/events.js';
import { G, cal, darkness, hasClothes, isSick, count } from '../core/state.js';
import { el, esc, pick, fmtMoney } from '../core/util.js';
import {
  CLOTHES,
  CLOTHES_BY_ID,
  LAND_BY_ID,
  NPC_BY_ID,
  FIND_BY_ID,
  MOUNTAIN,
  npcLook,
  isWarmItem,
} from '../data/index.js';
import { startBath, snowmanNow } from '../locations/mountain.js';
import { dialog } from '../ui/dialog.js';
import { fadeScene, smooth } from '../ui/fade.js';
import { message, openPanel } from '../ui/panel.js';
import { toast } from '../ui/toast.js';
import { frostToday } from './health.js';
import { prizeGame } from './minigames.js';
import { setWaitHook, questTalk } from './quests.js';
import { placeLine } from './tales.js';
import { paintSummitView, paintSnowmanPic } from './pictures_art.js';
import { paintRide } from './trips_art.js';

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
let riding = false;
/** Проехать на канатной дороге: up — из леса на гору, иначе — с горы в лес. */
export function rideCableway(up) {
  if (riding) return false;
  const land = LAND_BY_ID.mountain,
    season = cal().season;
  riding = true;
  sfx('lift');
  fadeScene({
    text: up ? '🚡 Едем на гору!' : '🚡 Едем вниз, в лес!',
    ratio: 0.62,
    ms: 2300,
    paint: (ctx, w, h, p, look, t) => {
      const e = smooth(p);
      paintRide(ctx, w, h, up ? 0.08 + e * 0.84 : 0.92 - e * 0.84, season, look, t);
    },
    go: () => (up ? go(land.scene, { at: land.entry }) : go(land.from, { at: 'station' })),
  }).then(() => {
    riding = false;
    sfx('ding');
  });
  return true;
}
register('cableway', (p) => rideCableway(p.arg !== 'down'), 'канатная дорога: cableway:up (из леса на гору) | cableway:down');
