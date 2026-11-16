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
import { makeCanvas, ell, fillRR, line, star, emoji } from '../core/draw.js';
import { on, emit } from '../core/events.js';
import { scene, sceneName } from '../core/loop.js';
import { register, run } from '../core/registry.js';
import { G, playerLook, isSick } from '../core/state.js';
import { el, esc, fmtMoney } from '../core/util.js';
import { drawHamster, blinkAt } from '../art/hamster.js';
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
} from '../data/index.js';
import { dialog } from '../ui/dialog.js';
import { enqueue } from '../ui/modals.js';
import { openPanel, message } from '../ui/panel.js';
import { toast } from '../ui/toast.js';

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
    setTimeout(() => toast(`Ура, ${S().name} выздоровела! 💪 Нос больше не красный.`, 'good'), 900);
}

/** Маленькая картинка: простуженная хомячок (иногда чихает). Возвращает { canvas, stop }. */
function sickPicture(W = 240, H = 150) {
  const { canvas, ctx } = makeCanvas(W, H);
  canvas.style.cssText += ';display:block;margin:0 auto 8px;border-radius:18px;background:#e7f5ff;max-width:100%';
  let raf = 0;
  const t0 = performance.now();
  const loop = () => {
    const t = (performance.now() - t0) / 1000,
      sn = (t % 4.2) - 1.6;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#d0ebff';
    ctx.fillRect(0, H - 18, W, 18);
    drawHamster(ctx, W / 2, H - 20, 1.25, playerLook(), {
      time: t,
      blink: blinkAt(t),
      sneeze: sn >= 0 && sn < 1.1 ? sn / 1.1 : null,
      shadow: false,
    });
    // кружка с тёплым чаем рядом
    ell(ctx, W / 2 + 94, H - 30, 5, 6, null, '#4a3728', 1.5);
    fillRR(ctx, W / 2 + 70, H - 42, 22, 24, 6, '#fff', '#4a3728', 1.5);
    ell(ctx, W / 2 + 81, H - 30, 4, 4, '#ff8fab');
    for (let i = 0; i < 2; i++) {
      const p = (t * 0.5 + i * 0.5) % 1;
      ctx.globalAlpha = 0.7 * (1 - p);
      ell(ctx, W / 2 + 77 + i * 8 + Math.sin(p * 6 + i) * 3, H - 48 - p * 24, 4, 4, '#a5d8ff');
    }
    ctx.globalAlpha = 1;
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
            `Доброе утро! <b>Апчхи!</b> Кажется, ${esc(S().name)} простыла 🤧<br>Загляни в больницу — доктор поможет 🏥`,
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
    title: 'Простыла',
    icon: '🤒',
    cls: 'narrow',
    render(body) {
      body.appendChild(pic.canvas);
      body.appendChild(el('p', 'center', `${esc(S().name)} немножко простыла. Что делать?`));
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
/** Добрая подсказка один раз в день (отметка дня warn:<id>). */
function warnOnce(id, text) {
  if ((S().dayFlags.warn || {})[id]) return;
  setDayFlag(id, 1, 'warn');
  toast(text);
}
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
  const min = dt / 0.6,
    o = playerLook().outfit,
    cf = careless();
  if ((here === null ? coldDay(s.day) : here) && !dressedWarm(o) && !cf.cold) {
    coldMin += min;
    if (coldMin >= HEALTH.warnMin)
      warnOnce(
        'cold',
        'Брр! 🥶 На улице холодно, а ты без тёплых вещей. Надень шапку, куртку или шарф — а то можно простыть!',
      );
    if (coldMin >= HEALTH.outMin) markCareless('cold');
  }
  // под землёй и в пустыне дождя нет (sc.dry — крюк сцены), там не промокнуть
  if (s.weather === 'rain' && !(sc.dry && sc.dry()) && !dressedForRain(o) && !cf.rain) {
    wetMin += min;
    if (wetMin >= HEALTH.warnMin)
      warnOnce(
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
/** Ледяное море: купаться и нырять в холодные месяцы — неосторожность (сразу, с подсказкой). */
function icySea() {
  const s = S();
  if (!s || s.sick || !coldDay(s.day)) return;
  markCareless('sea');
  warnOnce('sea', 'Ух, вода ледяная! 🥶 В холод в море лучше не купаться — можно простыть. Летом будет тёплая!');
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
      <li>🤧 А если всё-таки простыла — приходи ко мне, вылечу!</li></ul>`,
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
  const STAGES = [
    '🌡️ «Сначала градусник… Так-так: 37,2. Немножко простыла!»',
    '👄 «А теперь открой ротик и скажи: А-а-а!» Горлышко красненькое — это скоро пройдёт.',
    '🍬 «Вот тебе витаминка и тёплый чай с мёдом. Вот и всё — будь здорова!»',
  ];
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
    ctx.clearRect(0, 0, W, H);
    // кабинет: плакат с крестиком, кушетка
    fillRR(ctx, 18, 16, 46, 46, 8, '#fff', '#4a3728', 1.5);
    ctx.fillStyle = '#fa5252';
    ctx.fillRect(36, 24, 10, 30);
    ctx.fillRect(26, 34, 30, 10);
    ctx.fillStyle = '#c3fae8';
    ctx.fillRect(0, H - 20, W, 20);
    // кушетка: спинка, сиденье, ножки
    fillRR(ctx, 34, H - 92, 112, 50, 10, '#ffd8e4', '#4a3728', 1.5);
    for (const lx of [44, 132]) fillRR(ctx, lx, H - 36, 6, 18, 2, '#adb5bd', '#4a3728', 1.2);
    fillRR(ctx, 30, H - 48, 120, 14, 6, '#fff', '#4a3728', 1.5);
    const happy = stage === 2;
    drawHamster(ctx, 92, H - 44, 1.2, playerLook(), {
      time: t,
      dir: 1,
      sit: true,
      blink: blinkAt(t),
      talk: stage === 1,
      happy,
      armsUp: happy && Math.sin(t * 8) > 0.3,
      shadow: false,
    });
    const dx = W - 72,
      dy = H - 20,
      ds = 1.25;
    drawHamster(ctx, dx, dy, ds, vendorLook('doctor'), {
      time: t + 1.3,
      dir: -1,
      blink: blinkAt(t, 1.3),
      talk: t % 3 < 1.4,
      shadow: false,
    });
    // зеркальце доктора на лбу и трубка-стетоскоп на шее
    line(ctx, dx - 26 * ds, dy - 66 * ds, dx + 26 * ds, dy - 66 * ds, '#868e96', 2.5);
    ell(ctx, dx - 6 * ds, dy - 67 * ds, 7, 7, '#e9ecef', '#4a3728', 1.5);
    ell(ctx, dx - 6 * ds, dy - 67 * ds, 3, 3, '#fff');
    ctx.strokeStyle = '#495057';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(dx - 12 * ds, dy - 30 * ds);
    ctx.quadraticCurveTo(dx - 16 * ds, dy - 14 * ds, dx - 4 * ds, dy - 12 * ds);
    ctx.stroke();
    ell(ctx, dx - 3 * ds, dy - 12 * ds, 4, 4, '#adb5bd', '#4a3728', 1.2);
    if (stage === 1) {
      // фонарик: лучик к ротику
      ctx.fillStyle = 'rgba(255,224,102,.45)';
      ctx.beginPath();
      ctx.moveTo(dx - 34, dy - 50);
      ctx.lineTo(112, H - 104);
      ctx.lineTo(112, H - 88);
      ctx.closePath();
      ctx.fill();
      fillRR(ctx, dx - 44, dy - 56, 14, 8, 3, '#ffd43b', '#4a3728', 1.2);
    }
    if (stage === 2) {
      emoji(ctx, '🍬', 150 + Math.sin(t * 3) * 3, 70, 22);
      emoji(ctx, '🍵', 176, H - 56, 22);
      for (let i = 0; i < 3; i++) {
        const p = (t * 0.4 + i / 3) % 1;
        ctx.globalAlpha = 1 - p;
        star(ctx, 60 + i * 50 + Math.sin(p * 5) * 8, 70 - p * 30, 5, '#ffd43b');
      }
      ctx.globalAlpha = 1;
    }
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
        say = el('p', 'center', `<b>${VENDORS.doctor.name}:</b> ${STAGES[stage]}`);
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
        toast('Будь здорова! 💪 Теперь можно и поработать, и поплавать.', 'good');
        emit('hud');
        resolve();
      },
    });
  });
}
