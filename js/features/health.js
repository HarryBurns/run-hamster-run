// Болезнь (Ф1): простуда — редкое событие на день-два. Здесь — всё, что с ней происходит в игре:
//   - за день считаются «неосторожности» (долго на холоде без тёплой вещи, ледяное море, промокла под дождём) —
//     с добрыми подсказками заранее; при смене дня (features/sleep.js) решается, заболела ли (data/health.js);
//   - утром — доброе сообщение, в HUD — значок 🤒 (по нажатию — что делать), хомячок чихает;
//   - пока болеет: ходит медленнее (core/state.js, walkK), не работает (вежливый отказ), не купается и не ныряет
//     (у воды подсказка — сцены спрашивают canSwim()); остальное можно;
//   - лечение: приём у доктора в больнице (сразу, недорого или «за улыбку»), тёплое питьё дома облегчает, а через
//     два дня проходит само.
// Числа и тексты — data/health.js и DOCTOR_FEE в data/economy.js; состояние меняют fallSick / recoverSick.
import { fallSick, recoverSick, setDayFlag, spend, award } from '../core/actions.js';
import { sfx } from '../core/audio.js';
import { makeCanvas } from '../core/draw.js';
import { on, emit } from '../core/events.js';
import { scene, sceneName } from '../core/loop.js';
import { register, run } from '../core/registry.js';
import { G, playerLook, isSick, badWeather, weatherNow } from '../core/state.js';
import { el, esc, fmtMoney } from '../core/util.js';
import {
  HEALTH,
  CARELESS,
  JUST_BECAUSE,
  SICK_TEXT,
  WARM_DRINKS,
  DOCTOR_FEE,
  JOBS,
  DISH_BY_ID,
  VENDORS,
  nightHealth,
  dressedWarm,
  dressedForRain,
  coldDay,
  vendorLook,
  DOCTOR_STAGES,
} from '../data/index.js';
import { dialog } from '../ui/dialog.js';
import { enqueue } from '../ui/modals.js';
import { openPanel, message } from '../ui/panel.js';
import { toast, hintToday, hintOnce } from '../ui/toast.js';
import { paintSick, paintDoctor } from './health_art.js';

const S = () => G.state;
const careless = () => S().dayFlags.careless || {};

// ---------- смена дня: заболела ли, выздоровела ли ----------
/** Что случится этой ночью (зовут ДО nextDay(): нужны отметки прошедшего дня). → { fall } | { recover } | {} */
export function planNight() {
  const s = S();
  return nightHealth({ day: s.day + 1, sick: s.sick, immuneUntil: s.immuneUntil, careless: careless(), key: s.name });
}
/** Применить решение ночи (зовут ПОСЛЕ nextDay(), до письма дня: письмо учитывает болезнь). */
export function applyNight(plan) {
  if (plan.recover) recoverSick('self');
  if (plan.fall) fallSick(plan.fall);
  return plan;
}
/** Утреннее сообщение: простыла — что случилось и что делать; выздоровела сама — порадоваться. */
export function morningNews(plan) {
  if (plan.fall) enqueue(() => sickMorning(plan.fall));
  else if (plan.recover)
    setTimeout(() => toast(`Ура, ${esc(S().name)} выздоровел{|а}! 💪 Нос больше не красный.`, 'good'), 900);
}

/** Маленькая картинка: простуженная хомячок (иногда чихает). Возвращает { canvas, stop }. */
function sickPicture(W = 240, H = 150) {
  const { canvas, ctx } = makeCanvas(W, H);
  canvas.style.cssText += ';display:block;margin:0 auto 8px;border-radius:18px;background:#e7f5ff;max-width:100%';
  let raf = 0;
  const t0 = performance.now();
  const loop = () => {
    paintSick(ctx, W, H, (performance.now() - t0) / 1000, playerLook());
    raf = requestAnimationFrame(loop);
  };
  loop();
  return { canvas, stop: () => cancelAnimationFrame(raf) };
}

/** Что делать, когда простыла: три способа, коротко. */
function whatToDo() {
  const s = S(),
    left = s.sick ? s.sick.since + HEALTH.days - s.day : 0;
  const self = left <= 1 ? 'завтра утром' : 'послезавтра утром';
  return `<ul class="help">
    <li>🏥 <b>В больнице</b> доктор вылечит сразу. Приём — 🪙 ${fmtMoney(DOCTOR_FEE)}, а если монет нет — бесплатно, «за улыбку».</li>
    <li>🍵 Дома согреет <b>чай с мёдом и лимоном</b> или ☕ <b>горячий шоколад</b> — станет полегче и ноги снова побегут быстро.</li>
    <li>🛏️ А можно просто подождать: простуда пройдёт сама <b>${self}</b>.</li>
    <li>🤒 Пока болеешь, ходишь медленнее, работать, купаться и нырять нельзя. Готовить, наряжаться, обставлять дом, ходить в гости и играть на пианино — можно!</li></ul>`;
}

function sickMorning(cause) {
  const pic = sickPicture();
  const why = CARELESS[cause] ? CARELESS[cause].morning + ' ' + CARELESS[cause].tip : JUST_BECAUSE;
  return new Promise((resolve) => {
    openPanel({
      title: 'Апчхи!',
      icon: '🤧',
      cls: 'narrow',
      render(body) {
        body.appendChild(pic.canvas);
        body.appendChild(
          el(
            'p',
            'center',
            `Доброе утро! <b>Апчхи!</b> Кажется, ${esc(S().name)} простыл{|а} 🤧<br>Загляни в больницу — доктор поможет 🏥`,
          ),
        );
        body.appendChild(el('p', 'muted center', why));
        body.appendChild(
          el(
            'p',
            'center',
            '🍵 Дома полегчает от чая с мёдом. Пока болеешь, ходишь медленнее, а работать и купаться нельзя. Нажми 🤒 у даты — там всё написано.',
          ),
        );
      },
      foot: [{ text: 'Хорошо 💛', cls: 'green', fn: (p) => p.close() }],
      onClose: () => {
        pic.stop();
        resolve();
      },
    });
    sfx('sneeze');
  });
}

/** По нажатию на значок 🤒 в HUD: что с хомячком и что делать. */
export function showSickHelp() {
  if (!isSick()) return;
  const pic = sickPicture();
  openPanel({
    title: 'Простыл{|а}',
    icon: '🤒',
    cls: 'narrow',
    render(body) {
      body.appendChild(pic.canvas);
      body.appendChild(el('p', 'center', `${esc(S().name)} немножко простыл{|а}. Что делать?`));
      body.appendChild(el('div', '', whatToDo()));
    },
    foot: [{ text: 'Понятно!', cls: 'green', fn: (p) => p.close() }],
    onClose: pic.stop,
  });
}

// ---------- за день: неосторожности и подсказки ----------
let outDay = -1,
  coldMin = 0,
  wetMin = 0,
  nextSneeze = 0;
function markCareless(id) {
  if (!careless()[id]) setDayFlag(id, 1, 'careless');
}
function tick({ dt }) {
  const s = S();
  if (!s) return;
  if (s.day !== outDay) {
    outDay = s.day;
    coldMin = wetMin = 0;
  }
  // плохая погода в городе: жители сидят по домам — один раз за игру говорим об этом (хомячку гулять можно всегда)
  if (sceneName() === 'world' && !s.flags.badWeather && badWeather()) {
    const w = weatherNow();
    hintOnce(
      'badWeather',
      w.kind === 'snow'
        ? 'Метель! 🌨️ Жители сидят по домам — загляни к ним в гости. А тебе гулять можно: только оденься потеплее.'
        : w.force >= 3
          ? 'Гроза! ⛈️ Жители сидят по домам — загляни к ним в гости. Гром только ворчит, он совсем не страшный.'
          : 'Ливень! 🌧️ Жители сидят по домам — загляни к ним в гости. А тебе гулять можно: надень куртку или сапожки.',
    );
  }
  if (s.sick) {
    // чих: иногда, пока гуляем (мир не на паузе — шаг логики идёт только тогда)
    if (G.time > nextSneeze) {
      if (nextSneeze) {
        G.sneezeAt = G.time;
        sfx('sneeze');
      }
      nextSneeze = G.time + 9 + Math.random() * 8;
    }
    return;
  }
  nextSneeze = G.time + 3;
  // «на улице» — город, двор виллы, пляж, море; и места, которые сами говорят, холодно ли там (гора: на вершине
  // мороз круглый год — крюк cold у локации)
  const sc = scene(),
    here = sc && sc.cold ? sc.cold() : null;
  if (here === null && sceneName() !== 'world') return;
  if (G.still) return; // часы стоят (давно без касаний) — холод и дождь тоже не копятся
  const min = dt / 0.6,
    o = playerLook().outfit,
    cf = careless();
  if ((here === null ? coldDay(s.day) : here) && !dressedWarm(o) && !cf.cold) {
    coldMin += min;
    if (coldMin >= HEALTH.warnMin)
      hintToday(
        'cold',
        'Брр! 🥶 На улице холодно, а ты без тёплых вещей. Надень шапку, куртку или шарф — а то можно простыть!',
      );
    if (coldMin >= HEALTH.outMin) markCareless('cold');
  }
  // под землёй и в пустыне дождя нет (sc.dry — крюк сцены), там не промокнуть
  // (что идёт в этом месте — sc.wx(): на горе, в лесу и в городе дождь общий — data/weather.js)
  if ((sc.wx ? sc.wx().kind : s.weather) === 'rain' && !(sc.dry && sc.dry()) && !dressedForRain(o) && !cf.rain) {
    wetMin += min;
    if (wetMin >= HEALTH.warnMin)
      hintToday(
        'rain',
        'Кап-кап! ☔ Ты промокаешь под дождём. Надень куртку или резиновые сапожки — а то можно простыть!',
      );
    if (wetMin >= HEALTH.outMin) markCareless('rain');
  }
}
on('step', tick);
/** Согрелась (горячий источник на горе): мороза за день как не бывало — неосторожность «холод» снята. */
on('warmup', () => {
  coldMin = 0;
  if (careless().cold) setDayFlag('cold', 0, 'careless');
});
/** Набрала ли сегодня «мороза» (гуляла на холоде без тёплого) — для доброй фразы у источника. */
export const frostToday = () => !!careless().cold || coldMin >= HEALTH.warnMin;
/**
 * Ледяное море: купаться и нырять в холодные месяцы — неосторожность (сразу, с подсказкой). Место, которое само
 * говорит, холодно ли там (крюк cold), решает само: у острова, в джунглях и в бухте вода тёплая круглый год (В15).
 */
function icySea() {
  const s = S(),
    sc = scene(),
    here = sc && sc.cold ? sc.cold() : null;
  if (!s || s.sick || !(here === null ? coldDay(s.day) : here)) return;
  markCareless('sea');
  hintToday('sea', 'Ух, вода ледяная! 🥶 В холод в море лучше не купаться — можно простыть. Летом будет тёплая!');
}
on('swim', ({ where }) => {
  if (where === 'sea') icySea();
});
on('dive', icySea);
// тёплое питьё: сегодня полегче — обычный шаг (но не выздоровела)
on('eat', ({ id }) => {
  if (!isSick() || !WARM_DRINKS.includes(id) || S().dayFlags.sickTea) return;
  setDayFlag('sickTea');
  setTimeout(
    () =>
      toast(`${DISH_BY_ID[id].e} Тёплое — это то, что нужно! Стало полегче. Но к доктору всё же загляни 🏥`, 'good'),
    900,
  );
});

// ---------- что нельзя ----------
/** Мини-игра — работа (у неё есть зарплата или приз)? */
export const isJobGame = (id) => !!JOBS[id];
/** Вежливый отказ «Сначала выздоровей» (работа; в бассейне — «купаться нельзя»). */
export function sickRefusal(game) {
  sfx('pop');
  return message({
    title: 'Сначала выздоровей',
    icon: '🤒',
    html: `<p class="center big-emoji">🤧</p><p class="center">${game === 'swim' ? SICK_TEXT.pool : SICK_TEXT.work}</p>`,
    buttons: [{ text: 'Хорошо 💛' }],
  });
}
/**
 * Продавец спрашивает «поработаешь?», а хомячок простыла: вместо работы — доброе «сначала выздоровей».
 * Возвращает { text, options } без работы или null, если болезнь тут ни при чём.
 */
export function sickAsk(p) {
  const job = (o) => typeof o.do === 'string' && o.do.startsWith('minigame:') && isJobGame(o.do.slice(9));
  if (!isSick() || !p.options.some(job)) return null;
  const rest = p.options.filter((o) => !job(o));
  const swim = p.options.some((o) => o.do === 'minigame:swim');
  return {
    text: swim ? SICK_TEXT.pool : SICK_TEXT.work,
    options: rest.length > 1 ? rest : [{ text: 'Хорошо 💛' }],
  };
}

// ---------- больница: приём у доктора ----------
register(
  'hospital',
  (p, ctx) => (isSick() ? visitDoctor() : run(p.ask, ctx)),
  'больница: простыла — приём у доктора, иначе — p.ask (работа «Доктор»)',
);
register('health-tips', () => healthTips(), 'больница: «Как не простыть?»');

function healthTips() {
  return message({
    title: 'Как не простыть?',
    icon: '🌡️',
    html: `<p class="center">Доктор Витаминкин советует:</p><ul class="help">
      <li>🧣 Поздней осенью и зимой надевай что-нибудь тёплое: шапку, куртку, кофту или шарф.</li>
      <li>🌊 В холод в море не купайся и не ныряй — вода ледяная. Летом — пожалуйста!</li>
      <li>☔ В дождь надевай куртку или резиновые сапожки.</li>
      <li>🤧 А если всё-таки простыл{|а} — приходи ко мне, вылечу!</li></ul>`,
    buttons: [{ text: 'Спасибо, доктор!' }],
  });
}

/** Простуженная пришла в больницу: доктор зовёт на приём. */
export async function visitDoctor() {
  const s = S(),
    free = s.money < DOCTOR_FEE;
  const i = await dialog({
    look: vendorLook('doctor'),
    name: VENDORS.doctor.name,
    text: `Ой-ой, кто это у нас чихает? 🤧 Проходи, садись — сейчас посмотрим! ${
      free ? 'Монеток нет? Не беда — вылечу за улыбку 😊' : `Приём стоит 🪙 ${fmtMoney(DOCTOR_FEE)}.`
    }`,
    options: [
      { text: free ? '😊 На приём — за улыбку' : `🩺 На приём · 🪙 ${fmtMoney(DOCTOR_FEE)}`, cls: 'green' },
      { text: 'Потом' },
    ],
  });
  if (i !== 0 || !isSick()) return false;
  const paid = !free && spend(DOCTOR_FEE);
  await doctorScene(paid);
  return true;
}

/** Приём: градусник, «скажи а-а-а», витаминка — и здорова. Закрыть окно раньше — тоже здорова (приём был). */
function doctorScene(paid) {
  const W = 300,
    H = 180;
  const { canvas, ctx } = makeCanvas(W, H);
  canvas.style.cssText += ';display:block;margin:0 auto 8px;border-radius:18px;background:#e6fcf5;max-width:100%';
  let stage = 0,
    cured = false,
    raf = 0;
  const t0 = performance.now();
  const cure = () => {
    if (cured) return;
    cured = true;
    recoverSick('doctor');
  };
  const loop = () => {
    const t = (performance.now() - t0) / 1000;
    paintDoctor(ctx, W, H, t, stage, playerLook(), vendorLook('doctor'));
    raf = requestAnimationFrame(loop);
  };
  loop();
  return new Promise((resolve) => {
    let say = null;
    openPanel({
      title: 'Приём у доктора',
      icon: '🩺',
      cls: 'narrow',
      render(body) {
        body.appendChild(canvas);
        say = el('p', 'center', `<b>${VENDORS.doctor.name}:</b> ${DOCTOR_STAGES[stage]}`);
        body.appendChild(say);
        if (stage === 0)
          body.appendChild(
            el('p', 'muted center', paid ? `Приём — 🪙 ${fmtMoney(DOCTOR_FEE)}.` : 'Приём — за улыбку 😊'),
          );
      },
      foot: (api) =>
        stage < 2
          ? [
              {
                text: 'Дальше ▶',
                cls: 'green',
                fn: () => {
                  stage++;
                  sfx(stage === 2 ? 'magic' : 'tap');
                  if (stage === 2) cure();
                  api.refresh();
                },
              },
            ]
          : [{ text: 'Спасибо, доктор! 💖', cls: 'green', fn: (p) => p.close() }],
      onClose: () => {
        cancelAnimationFrame(raf);
        cure();
        award('x_healthy', { delay: 700 });
        toast('Будь здоров{|а}! 💪 Теперь можно и поработать, и поплавать.', 'good');
        emit('hud');
        resolve();
      },
    });
  });
}
