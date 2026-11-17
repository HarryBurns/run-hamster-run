// ПРАЗДНИКИ (П.13): ОБЩИЕ ПРИЁМЫ ЗАНЯТИЙ — сценки, «обойти домики вечером», призовая мини-игра. Ими пользуются
// features/holidays_winter.js (ёлка, колядки, фонарики, карусель, канат), holidays_summer.js (клумбы, парад, венок,
// тыква, «сладость или гадость», «Водяная битва») и holidays_bday.js (торт со свечами).
//   tapScene({...})    окно-сценка с картинкой: каждое нажатие (картинка, кнопка, пробел, Enter) — шаг, в конце «Ура!»
//   playScene(текст, paint, мс)   короткая сценка без нажатий (затемнение с картинкой)
//   doorRound({...})   обход домиков вечером: колядки на Рождество, «сладость или гадость» на Хеллоуин — у двери
//                      домика (holidayDoor), в свои часы (HOLIDAY.carols), сценка, хозяин угощает, шаг «разные домики»
//   prizeGame(игра, {...})  мини-игра праздника с призом по звёздам за первые paid игр в день (канат, водяная битва)
import { addItem, setDayFlag, earn, award, meetFriend, spendMinutes } from '../core/actions.js';
import { sfx } from '../core/audio.js';
import { makeCanvas, ell } from '../core/draw.js';
import { G, playerLook } from '../core/state.js';
import { el, fmtMoney } from '../core/util.js';
import { NPC_BY_ID, DISH_BY_ID, HOLIDAY, npcLook } from '../data/index.js';
import { dialog } from '../ui/dialog.js';
import { openLayer } from '../ui/modals.js';
import { openPanel, message } from '../ui/panel.js';
import { toast } from '../ui/toast.js';
import { addPts } from './friends.js';
import { holidayDoor, holidayStep, stepDoneFor, stepWanted } from './holidays.js';
import { playMinigame } from './minigames.js';

const S = () => G.state;
const HF = () => S().dayFlags.holiday || {};
export const holidaySay = (id, text, options, happy = false) => dialog({ look: npcLook(id), name: NPC_BY_ID[id].name, text, options, happy });

/**
 * Окно-сценка с картинкой и кнопкой «действия»: каждое нажатие (на картинку, кнопку, пробел или Enter) — шаг; после
 * steps шагов — «готово». paint(ctx, w, h, k, a, t) рисует кадр (k — сколько шагов уже сделано, a — 0..1 анимация
 * последнего шага). btns — подписи кнопки по шагам (btns[k] — перед шагом k+1; нет — btn), lastBtn — перед последним.
 * Возвращает Promise<boolean> — дошли ли до конца.
 */
export function tapScene({ title, icon, steps, btn, btns, lastBtn, hint, hints, doneText, paint, onStep }) {
  return new Promise((resolve) => {
    // на телефоне лёжа (высота ~340 px) картинка меньше, чтобы подсказка и кнопка помещались без прокрутки
    const W = Math.round(Math.max(150, Math.min(380, window.innerWidth - 48, (window.innerHeight - 215) / 0.86))),
      H = Math.round(W * 0.86);
    const { canvas, ctx } = makeCanvas(W, H);
    canvas.style.cssText += ';display:block;margin:0 auto;border-radius:16px;touch-action:manipulation;cursor:pointer';
    canvas.className = 'hol-scene';
    let n = 0,
      since = 0,
      raf = 0,
      done = false;
    const t0 = performance.now();
    const note = el('p', 'center', hint);
    const label = (k) => (btns && btns[k]) || (k === steps - 1 && lastBtn) || btn;
    const b = el('button', 'btn big green', label(0));
    const step = () => {
      if (done || n >= steps) return;
      n++;
      since = performance.now();
      if (onStep) onStep(n);
      if (n >= steps) {
        done = true;
        sfx('magic');
        note.innerHTML = doneText;
        b.textContent = 'Ура! 🎉';
        b.onclick = () => panel.close();
      } else {
        sfx('pop');
        b.textContent = label(n);
        if (hints && hints[n]) note.innerHTML = hints[n];
      }
    };
    b.onclick = step;
    canvas.onpointerdown = (e) => {
      e.preventDefault();
      if (!done) step();
    };
    const key = (e) => {
      if ((e.code === 'Space' || e.code === 'Enter') && !done) {
        e.preventDefault();
        step();
      }
    };
    window.addEventListener('keydown', key);
    const panel = openPanel({
      title,
      icon,
      cls: 'narrow hol-scene-panel',
      render(body) {
        body.append(canvas, note, b);
      },
      onClose() {
        cancelAnimationFrame(raf);
        window.removeEventListener('keydown', key);
        resolve(done);
      },
    });
    const loop = (now) => {
      const t = (now - t0) / 1000,
        a = Math.min(1, (now - since) / 450); // анимация последнего шага
      ctx.clearRect(0, 0, W, H);
      paint(ctx, W, H, n, a, t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
  });
}

/** Короткая сценка без нажатий (колядки, карусель, парад): затемнение с картинкой на ms миллисекунд. */
export function playScene(text, paint, ms = 2600) {
  return new Promise((resolve) => {
    const W = Math.min(520, window.innerWidth - 32),
      H = Math.round(W * 0.58);
    const f = el('div', 'fade cable-ride hol-fade', `<div class="msg"><div><div class="ride-pic"></div><p>${text}</p></div></div>`);
    const { canvas, ctx } = makeCanvas(W, H);
    canvas.style.borderRadius = '18px';
    f.querySelector('.ride-pic').appendChild(canvas);
    document.body.appendChild(f);
    const closeLayer = openLayer();
    const t0 = performance.now(),
      look = playerLook();
    let raf = 0;
    const loop = (now) => {
      const t = (now - t0) / 1000;
      paint(ctx, W, H, Math.min(1, (now - t0) / ms), look, t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    requestAnimationFrame(() => f.classList.add('on'));
    setTimeout(() => {
      cancelAnimationFrame(raf);
      f.classList.remove('on');
      setTimeout(() => {
        f.remove();
        closeLayer();
        resolve();
      }, 380);
    }, ms);
  });
}

/** Ночное небо со снежинками или звёздами (фон сценок). snow: false — мерцающие звёзды. */
export function nightSky(ctx, w, h, t, top = '#1b2a5a', bot = '#4a5a9a', snow = true) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, top);
  g.addColorStop(1, bot);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 26; i++) {
    if (snow) {
      const x = ((i * 0.377 + Math.sin(t * 0.5 + i) * 0.01) % 1) * w,
        y = ((i * 0.613 + t * 0.05 * (1 + (i % 3) * 0.3)) % 1) * h;
      ell(ctx, x, y, 1.6 + (i % 3) * 0.5, 1.6 + (i % 3) * 0.5, 'rgba(255,255,255,.75)');
    } else {
      const x = ((i * 0.377) % 1) * w,
        y = ((i * 0.613) % 1) * h * 0.55,
        r = 1 + (i % 3) * 0.5 + Math.sin(t * 3 + i) * 0.4;
      ell(ctx, x, y, r, r, 'rgba(255,250,220,.85)');
    }
  }
}

/**
 * Обход домиков вечером — колядки на Рождество, «сладость или гадость» на Хеллоуин. Регистрирует свой стук в дверь
 * домика жителя (holidayDoor): в праздник holiday, пока нужен шаг step и у этого домика ещё не были, в часы
 * HOLIDAY.carols — окно-приглашение, сценка (scene: [текст, paint]), хозяин угощает блюдом из treats (в рюкзак),
 * дружба +1, шаг засчитан. Днём дверь работает как обычно (с подсказкой hourHint).
 *   ask(name) — HTML окна у двери;  go — кнопка;  thanks(npc, блюдо, late) — что говорит хозяин;  ok — ответ хомячка
 */
export function doorRound({ holiday, step, title, icon, ask, go, scene, treats, thanks, ok, hourHint }) {
  holidayDoor(holiday, async (npc, ctx, where) => {
    if (!stepWanted(holiday, step) || stepDoneFor(holiday, step, npc)) return false;
    const m = S().minutes;
    if (m < HOLIDAY.carols[0] * 60 || m >= HOLIDAY.carols[1] * 60) {
      // ходят вечером; днём дверь — как обычно, а напомнить — можно
      setTimeout(() => toast(hourHint), 1200);
      return false;
    }
    sfx('bell');
    const i = await message({
      title,
      icon,
      html: ask(NPC_BY_ID[npc].name),
      buttons: [{ text: go, cls: 'green' }, { text: where === 'home' ? '🚪 Просто зайти в гости' : 'Не сейчас', cls: 'ghost' }],
    });
    if (i !== 0) return where !== 'home'; // «просто в гости» — обычный визит (если хозяин дома)
    sfx('fanfare');
    await playScene(scene[0], scene[1], 2600);
    const fr = S().friends[npc];
    if (fr && !fr.met) meetFriend(npc);
    const treat = treats[(S().day + Object.keys(NPC_BY_ID).indexOf(npc)) % treats.length],
      d = DISH_BY_ID[treat];
    addItem('dishes', treat, 1);
    holidayStep(holiday, step, npc);
    if (fr) addPts(npc, 1);
    spendMinutes(15, 22 * 60);
    const late = where === 'out' ? ` А я как раз забежал${NPC_BY_ID[npc].fem ? 'а' : ''} домой за угощением!` : '';
    await holidaySay(npc, thanks(npc, d, late), [{ text: ok, cls: 'green' }], true);
    toast(`+1 ${d.e} ${d.name} — в рюкзаке`, 'good');
    return true;
  });
}

/**
 * Мини-игра праздника с призом: за первые cfg.paid игр в день — монеты cfg.coins по звёздам (отметка дня flag), потом —
 * «для удовольствия». label — как назвать приз («🥞 Приз ярмарки»). После игры — наклейка sticker. info — что ещё
 * передать игре (команда друзей у каната), intro — HTML на заставке над строкой про приз.
 */
export async function prizeGame(id, { flag, cfg, label, sticker, info = {}, intro = '' }) {
  const c = cfg.coins,
    left = Math.max(0, cfg.paid - (HF()[flag] || 0)),
    note = (html) => `<div class="pay-note${left ? '' : ' off'}">${html}</div>`;
  const res = await playMinigame(id, {
    ...info,
    introNote:
      intro +
      (left
      ? note(`${label}: ⭐ 🪙 ${c[0]} · ⭐⭐ 🪙 ${c[1]} · ⭐⭐⭐ 🪙 ${c[2]}. Сегодня ещё ${left} ${left === 1 ? 'игра' : 'игры'} с призом.`)
      : note('💛 Призы уже получены. Играть можно для удовольствия!')),
    resultNote: (stars) => (left ? note(`<span class="sum">🪙 +${fmtMoney(c[stars - 1])}</span>`) : note('💛 Эта игра была для удовольствия.')),
  });
  if (!res) return res;
  if (sticker) award(sticker, { delay: 1200 });
  if (!left) return res;
  setDayFlag(flag, (HF()[flag] || 0) + 1, 'holiday');
  earn(c[res.stars - 1], 'gift');
  sfx('coin');
  return res;
}
