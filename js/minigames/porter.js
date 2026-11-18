// Мини-игра «Носильщица» (курортный отель, П.17; работа — её предлагает носильщик Тележкин, features/hotel.js).
// Отель в разрезе: этажи с дверями номеров (201–205, 301–305…), внизу — холл с тележкой. Сверху — чемодан гостя
// с биркой: на ней номер комнаты. Нажми на дверь с этим номером — хомячок довезёт чемодан на тележке (лифт слева).
// Угадала с первого раза — 2 очка, со второго — 1; довезла быстро — ещё +1. Ошиблась дверью — добрая подсказка
// («Здесь 204, а на бирке 203»), после двух ошибок нужная дверь подмигивает. Проигрыша нет. 8 чемоданов; звёзды —
// по очкам. Зарплату платит занятие (JOBS.porter — features/minigames.js).
// На опытных сменах (уровень LIFT_LEVEL и выше, От6) лифт не едет сам: слева — панель лифта с кнопками этажей, нажми
// этаж с бирки (первая цифра), приедешь — нажми дверь. Не тот этаж — добрая подсказка, считается как ошибка.
import { el, clamp, shuffle } from '../core/util.js';
import { ell, fillRR, line, star } from '../core/draw.js';
import { pic as kitPic } from './kit.js';

const N = 8; // чемоданов за смену
const OUT = '#4a3728';
/** Сколько очков на 2★ и 3★ (из 24). */
export const PORTER_STARS = [12, 19];
const FAST = 6; // довезла быстрее — ещё очко (секунды с появления чемодана; с лифтом — на 3 больше)
/** С какого уровня (host.level — сыграно смен / 2) этаж в лифте выбираешь сама. */
export const LIFT_LEVEL = 2;
const COLORS = ['#ff8fab', '#74c0fc', '#ffd43b', '#b197fc', '#8ce99a', '#ffa94d'];
const DOOR_COLORS = ['#ffd8a8', '#c5f6fa', '#d0bfff', '#b2f2bb', '#ffc9c9'];

function suitcase(ctx, x, y, w, h, col, tag) {
  fillRR(ctx, x - w / 2, y - h, w, h, w * 0.12, col, OUT, 2.2);
  fillRR(ctx, x - w * 0.16, y - h - w * 0.14, w * 0.32, w * 0.16, 4, null, OUT, 2.2);
  line(ctx, x - w / 2 + 6, y - h * 0.5, x + w / 2 - 6, y - h * 0.5, 'rgba(0,0,0,.18)', 3);
  for (const dx of [-0.3, 0.3]) ell(ctx, x + w * dx, y + 2, 5, 5, '#495057', OUT, 1.2);
  if (tag) {
    line(ctx, x + w * 0.3, y - h + 6, x + w * 0.55, y - h * 0.62, OUT, 1.5);
    fillRR(ctx, x + w * 0.42, y - h * 0.66, w * 0.62, h * 0.42, 6, '#fff', OUT, 2);
    ctx.font = `900 ${Math.round(h * 0.22)}px ui-rounded, "Trebuchet MS", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = OUT;
    ctx.fillText(tag, x + w * 0.73, y - h * 0.44);
  }
}
/** Картинка для правил. */
const pic = (draw, size = 64) => kitPic((x) => draw(x, size, size / 50), size, size);
function doorPic(ctx, size, s, n, col) {
  fillRR(ctx, size * 0.22, size * 0.12, size * 0.56, size * 0.84, 4, '#8d5524', OUT, 1.5);
  fillRR(ctx, size * 0.27, size * 0.17, size * 0.46, size * 0.79, 3, col, OUT, 1.2);
  fillRR(ctx, size * 0.3, size * 0.22, size * 0.4, size * 0.2, 4, '#fff', OUT, 1.2);
  ctx.font = `900 ${Math.round(size * 0.15)}px ui-rounded, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = OUT;
  ctx.fillText(n, size / 2, size * 0.33);
}

const CSS = `
.pt-rules{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin:8px 0 2px}
.pt-col{background:#fff;border-radius:14px;padding:4px 10px;border:3px solid #74c0fc;text-align:center}
.pt-col.ok{border-color:#8ce99a}
.pt-col.lift{border-color:#ffd43b}
.pt-col b{display:block;font-size:16px}
.pt-col .row{display:flex;gap:4px;justify-content:center;align-items:center;font-size:26px;font-weight:900}
.pt-col small{display:block;font-size:12px;opacity:.75;line-height:1.2}
.pt-top{position:absolute;left:0;right:0;top:0;display:flex;gap:8px;justify-content:center;padding:8px;pointer-events:none;z-index:2}
.pt-chip{background:rgba(255,255,255,.92);border-radius:12px;padding:4px 12px;font-weight:900;font-size:16px;box-shadow:0 2px 0 rgba(74,55,40,.15)}
.pt-col img{max-width:100%;height:auto}
/* телефон стоя (П7, В21): три карточки в ряд, поуже, — а не столбиком на три экрана */
@media (max-width:520px){
.pt-rules{flex-wrap:nowrap;gap:6px}
.pt-col{flex:1 1 0;min-width:0;padding:4px 4px;border-width:2.5px}
.pt-col b{font-size:13px;line-height:1.2}
.pt-col small{font-size:11px}
.pt-col small br{display:none}
}
/* телефон лёжа (В21): картинка слева от подписи — карточки вдвое ниже, «Начать!» видно без прокрутки */
@media (max-height:520px){
.pt-rules{flex-wrap:nowrap;margin:2px 0 0;gap:8px}
.pt-col{flex:1 1 0;min-width:0;max-width:250px;display:grid;grid-template-columns:auto 1fr;column-gap:6px;align-items:center;text-align:left;padding:3px 8px}
.pt-col .row{grid-column:1;grid-row:1 / span 2}
.pt-col .row img{width:42px;height:42px}
.pt-col b{grid-column:2;font-size:14px;line-height:1.15}
.pt-col small{grid-column:2;font-size:11.5px}
.pt-col small br{display:none}
}
`;

/** Кнопка лифта: круглая латунная с номером этажа (on — горит). */
function liftButton(ctx, x, y, r, label, on, glow) {
  if (glow) ell(ctx, x, y, r * 1.45, r * 1.45, 'rgba(255,212,59,.55)');
  ell(ctx, x, y + 2, r, r, 'rgba(0,0,0,.18)');
  ell(ctx, x, y, r, r, on ? '#ffd43b' : '#f1f3f5', OUT, 2.2);
  ell(ctx, x, y, r * 0.78, r * 0.78, on ? '#ffe066' : '#fff', on ? '#f59f00' : '#ced4da', 1.4);
  ctx.font = `900 ${Math.round(r * 0.95)}px ui-rounded, "Trebuchet MS", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = on ? '#c92a2a' : OUT;
  ctx.fillText(label, x, y + 1);
}

export default {
  id: 'porter',
  title: 'Носильщица',
  icon: '🧳',
  css: CSS,
  get howTo() {
    return `Гости приехали! Развези чемоданы по номерам.
      <div class="pt-rules">
        <div class="pt-col"><b>🏷️ Смотри на бирку</b><div class="row">${pic((c, size) => suitcase(c, size * 0.4, size * 0.9, size * 0.5, size * 0.55, '#ff8fab', '203'))}</div><small>на бирке — номер <br>комнаты</small></div>
        <div class="pt-col lift"><b>🛗 Лифт</b><div class="row">${pic((c, size) => {
          fillRR(c, size * 0.3, size * 0.06, size * 0.4, size * 0.88, 8, '#adb5bd', OUT, 1.6);
          liftButton(c, size / 2, size * 0.28, size * 0.13, '3', false);
          liftButton(c, size / 2, size * 0.56, size * 0.13, '2', true, true);
          liftButton(c, size / 2, size * 0.82, size * 0.11, '1', false);
        })}</div><small>на опытных сменах <br>этаж нажимаешь сама: <br>2 — второй этаж</small></div>
        <div class="pt-col ok"><b>👆 Нажми на дверь</b><div class="row">${pic((c, size, s) => doorPic(c, size, s, '203', '#d0bfff'))}</div><small>с тем же номером: <br>2 — этаж, 03 — дверь</small></div>
      </div>
      Чем меньше ошибок и чем быстрее — тем больше звёзд. Ошиблась — ничего страшного, подскажем!`;
  },
  start(host) {
    const top = el('div', 'pt-top');
    const tLeft = el('div', 'pt-chip'),
      tPts = el('div', 'pt-chip');
    top.append(tLeft, tPts);
    host.add(top);
    const cv = host.canvas();
    const ctx = cv.ctx;
    const level = host.level || 0;
    const floors = level >= 3 ? [2, 3, 4] : level >= 1 ? [2, 3] : [2];
    // кнопки этажей в лифте (От6): на старших сменах этаж выбираешь сама (info.lift — задать нарочно, для проверки)
    const lift = host.info && host.info.lift !== undefined ? !!host.info.lift : level >= LIFT_LEVEL;
    const rooms = floors.flatMap((f) => [1, 2, 3, 4, 5].map((d) => f * 100 + d));
    // чемоданы смены: разные номера (если номеров меньше, чем чемоданов, — по кругу)
    const order = [];
    while (order.length < N) order.push(...shuffle(rooms));
    const bags = order.slice(0, N).map((n, i) => ({ n, col: COLORS[i % COLORS.length] }));
    const fast = lift ? FAST + 3 : FAST;
    let t = 0,
      over = false,
      i = 0, // какой чемодан везём
      pts = 0,
      mistakes = 0,
      floorMiss = 0, // из них — не тот этаж в лифте
      tries = 0, // ошибок с этим чемоданом
      shown = 0, // когда появился чемодан
      move = null, // { pts: [{x, y, d}], k, q, then } — хомячок едет по точкам (d — секунды на отрезок)
      opened = null, // { door, t } — дверь открыта, гость машет
      at = -1, // где хомячок: −1 — холл, иначе индекс этажа в floors (с лифтом — где стоит кабина)
      pressed = null, // { f, t } — нажатая кнопка лифта (горит, пока едем)
      back = false, // с лифтом: едем в холл за следующим чемоданом (тележка пустая)
      hint = null; // { text, t }
    const hero = { x: 0, y: 0 };
    const pops = host.pops({ life: 1.2, rise: 26 });

    // ---------- раскладка ----------
    const L = () => {
      const W = cv.w,
        H = cv.h,
        head = clamp(H * 0.22, 96, 150),
        panelW = lift ? clamp(W * 0.11, 52, 76) : 0,
        bw = Math.min(W - 24 - (panelW ? panelW + 8 : 0), 720),
        left = (W - bw - (panelW ? panelW + 8 : 0)) / 2,
        bx = left + (panelW ? panelW + 8 : 0),
        liftW = clamp(bw * 0.12, 44, 70),
        rows = floors.length + 1,
        fh = Math.min(170, (H - head - 20) / rows),
        by = H - 14 - Math.max(0, (H - head - 20 - rows * fh) * 0.35); // пол холла (лишнее место — поровну сверху и снизу)
      const dw = (bw - liftW - 16) / 5;
      return { W, H, head, bw, bx, liftW, fh, by, dw, panelW, px: left };
    };
    const floorY = (k) => {
      const g = L();
      return k < 0 ? g.by : g.by - (k + 1) * g.fh; // k — индекс этажа в floors (0 — нижний из номерных), −1 — холл
    };
    const doors = () => {
      const g = L(),
        list = [];
      floors.forEach((f, k) => {
        const y = floorY(k);
        for (let d = 0; d < 5; d++) {
          const x = g.bx + g.liftW + 8 + g.dw * (d + 0.5);
          list.push({ n: f * 100 + d + 1, k, d, x, y, w: Math.min(g.dw * 0.66, g.fh * 0.5), h: g.fh * 0.72 });
        }
      });
      return list;
    };
    /** Кнопки лифта: 1 (холл) внизу, выше — номерные этажи; k — индекс этажа (−1 — холл). */
    const buttons = () => {
      if (!lift) return [];
      const g = L(),
        topY = floorY(floors.length - 1) - g.fh,
        n = floors.length + 1,
        r = clamp(Math.min(g.panelW * 0.36, ((g.by - topY) / n) * 0.3), 18, 30),
        gap = r * 2.7,
        cx = g.px + g.panelW / 2,
        cy = (topY + g.by) / 2 + 10;
      const list = [{ f: 1, k: -1 }, ...floors.map((f, k) => ({ f, k }))];
      return list.map((b, j) => ({ ...b, x: cx, y: cy + ((n - 1) / 2 - j) * gap, r }));
    };
    const liftX = () => {
      const g = L();
      return g.bx + g.liftW / 2;
    };
    const lobbyPos = () => {
      const g = L();
      return { x: g.bx + g.liftW + 40, y: g.by };
    };
    Object.assign(hero, lobbyPos());
    /** Поехать по точкам (каждая — {x, y, d}), потом then(). */
    const go = (list, then) => {
      move = { pts: list.filter((p) => p.d > 0), k: 0, q: 0, from: { ...hero }, then };
      if (!move.pts.length) {
        move = null;
        then && then();
      }
    };
    /** Путь в кабине лифта на этаж k (−1 — холл): к лифту, вверх-вниз. */
    const ridePts = (k) => {
      const lx = liftX(),
        y = floorY(k),
        far = Math.abs(hero.x - lx) > 2;
      return [
        { x: lx, y: hero.y, d: far ? 0.28 : 0 },
        { x: lx, y, d: Math.abs(y - hero.y) > 2 ? 0.22 + Math.abs(k - at) * 0.12 : 0 },
      ];
    };
    const say = (text) => (hint = { text, t: 0 });

    // ---------- управление ----------
    function pressFloor(b) {
      if (over || move || opened || i >= N) return;
      host.sfx('tap');
      if (b.k === at) return say(at < 0 ? 'Ты в холле. Нажми этаж с бирки!' : `Ты уже на ${b.f}-м этаже — нажми дверь!`);
      pressed = { f: b.f, t: 0 };
      go(ridePts(b.k), () => {
        at = b.k;
        host.sfx('bell');
        const want = Math.floor(bags[i].n / 100);
        if (b.k < 0) say(`Это холл. На бирке ${bags[i].n} — нужен ${want}-й этаж!`);
        else if (b.f !== want) {
          mistakes++;
          floorMiss++;
          tries++;
          say(`Это ${b.f}-й этаж, а на бирке ${bags[i].n}: первая цифра — ${want}. Нажми ${want}!`);
        } else say(`${b.f}-й этаж! Теперь найди дверь ${bags[i].n} →`);
      });
    }
    function tapDoor(hit) {
      if (lift && hit.k !== at) {
        host.sfx('tap');
        say(at < 0 ? 'Сначала — в лифт! Нажми кнопку этажа слева 🛗' : `Эта дверь на ${floors[hit.k]}-м этаже — поезжай туда на лифте 🛗`);
        return;
      }
      host.sfx('tap');
      if (lift) go([{ x: hit.x, y: hit.y, d: 0.25 + Math.abs(hero.x - hit.x) / 900 }], () => arrive(hit));
      else go([...ridePts(hit.k), { x: hit.x, y: hit.y, d: 0.24 }], () => ((at = hit.k), arrive(hit)));
    }
    function tapAt(px, py) {
      if (over || move || opened) return;
      const b = buttons().find((q) => Math.hypot(px - q.x, py - q.y) < q.r + 8);
      if (b) return pressFloor(b);
      const hit = doors().find((d) => px > d.x - d.w / 2 - 6 && px < d.x + d.w / 2 + 6 && py > d.y - d.h - 6 && py < d.y + 6);
      if (hit) tapDoor(hit);
    }
    const down = (e) => {
      const r = cv.canvas.getBoundingClientRect();
      tapAt(((e.clientX - r.left) / r.width) * cv.w, ((e.clientY - r.top) / r.height) * cv.h);
    };
    host.on(cv.canvas, 'pointerdown', down);
    // клавиатура: стрелки — выбрать дверь (↑↓ — этаж), Enter — к выбранной двери; с лифтом цифры 1–4 — кнопки этажей
    let sel = { k: 0, d: 0 };
    const kd = (e) => {
      const digit = /^Digit[1-4]$/.test(e.code) || /^Numpad[1-4]$/.test(e.code) ? +e.code.slice(-1) : 0;
      if (digit && lift) {
        const b = buttons().find((q) => q.f === digit);
        if (b) {
          pressFloor(b);
          if (b.k >= 0) sel.k = b.k;
        }
      } else if (e.code === 'ArrowLeft') sel.d = Math.max(0, sel.d - 1);
      else if (e.code === 'ArrowRight') sel.d = Math.min(4, sel.d + 1);
      else if (e.code === 'ArrowUp') sel.k = Math.min(floors.length - 1, sel.k + 1);
      else if (e.code === 'ArrowDown') sel.k = Math.max(0, sel.k - 1);
      else if (e.code === 'Enter' || e.code === 'Space') {
        const d = doors().find((q) => q.k === sel.k && q.d === sel.d);
        if (d) tapAt(d.x, d.y - 10);
      } else return;
      e.preventDefault();
    };
    host.on(window, 'keydown', kd);
    // для автотеста (dev/smoke_hotel.js, dev/smoke_games.js): номер на бирке, двери и кнопки лифта (CSS-пиксели
    // канвы), где хомячок (at: 1 — холл, иначе номер этажа), сколько довезено и ошибок
    cv.canvas.__porter = () => ({
      tag: bags[i] ? bags[i].n : null,
      done: i,
      mistakes,
      floorMiss,
      lift,
      at: at < 0 ? 1 : floors[at],
      busy: !!(move || opened),
      w: cv.w,
      h: cv.h,
      doors: doors().map((d) => ({ n: d.n, x: d.x, y: d.y - d.h / 2 })),
      buttons: buttons().map((b) => ({ f: b.f, x: b.x, y: b.y })),
    });

    function arrive(d) {
      const bag = bags[i];
      if (d.n === bag.n) {
        const quick = t - shown < fast;
        const got = (tries === 0 ? 2 : tries === 1 ? 1 : 0) + (quick ? 1 : 0);
        pts += got;
        host.sfx('win');
        opened = { door: d, t: 0, ok: true };
        pops.add(got ? `+${got} ⭐ Спасибо!` : 'Спасибо!', d.x, d.y - d.h - 10, '#2f9e44');
      } else {
        mistakes++;
        tries++;
        host.sfx('bad');
        opened = { door: d, t: 0, ok: false };
        say(`Здесь ${d.n}, а на бирке ${bag.n}. ${Math.floor(d.n / 100) !== Math.floor(bag.n / 100) ? `Нужен ${Math.floor(bag.n / 100)}-й этаж!` : bag.n > d.n ? 'Дальше вправо →' : '← Левее'}`);
      }
    }
    function update(dt) {
      t += dt;
      if (pressed) pressed.t += dt;
      if (move) {
        const p = move.pts[move.k],
          a = move.k ? move.pts[move.k - 1] : move.from;
        move.q = Math.min(1, move.q + dt / p.d);
        hero.x = a.x + (p.x - a.x) * move.q;
        hero.y = a.y + (p.y - a.y) * move.q;
        if (move.q >= 1) {
          move.k++;
          move.q = 0;
          if (move.k >= move.pts.length) {
            const then = move.then;
            move = null;
            pressed = null;
            then && then();
          }
        }
      } else if (opened) {
        opened.t += dt;
        if (opened.t > (opened.ok ? 0.9 : 0.6)) {
          const ok = opened.ok;
          opened = null;
          if (ok) {
            i++;
            tries = 0;
            hint = null;
            if (i >= N) finish();
            else if (lift) {
              // с лифтом — обратно в холл за следующим чемоданом
              back = true;
              go([...ridePts(-1), { ...lobbyPos(), d: 0.25 }], () => {
                at = -1;
                back = false;
                shown = t;
              });
            } else shown = t;
          }
        }
      }
      if (hint) hint.t += dt;
      pops.step(dt);
    }

    function draw() {
      const g = L(),
        { W, H } = g,
        bag = bags[Math.min(i, N - 1)];
      // небо и море за отелем
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#a5d8ff');
      sky.addColorStop(1, '#e7f5ff');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);
      // шапка: чемодан с биркой
      fillRR(ctx, 10, 46, W - 20, g.head - 50, 16, 'rgba(255,255,255,.9)', OUT, 2);
      const sh = g.head - 76;
      if (i < N) {
        suitcase(ctx, W / 2 - sh * 0.45, g.head - 12, sh * 0.85, sh * 0.8, bag.col, String(bag.n));
        ctx.font = `800 ${Math.round(clamp(W / 26, 13, 18))}px ui-rounded, "Trebuchet MS", sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = OUT;
        ctx.fillText(`В номер ${bag.n}!`, W / 2 + sh * 0.6, 40 + g.head * 0.42);
      }
      // здание
      const topY = floorY(floors.length - 1) - g.fh;
      fillRR(ctx, g.bx, topY, g.bw, g.by - topY + 4, 10, '#fff4e6', OUT, 2.5);
      fillRR(ctx, g.bx - 8, topY - 10, g.bw + 16, 14, 5, '#1098ad', OUT, 2);
      // шахта лифта
      fillRR(ctx, g.bx + 4, topY + 4, g.liftW - 4, g.by - topY - 4, 6, '#dee2e6', OUT, 1.5);
      // этажи: пол, номер этажа у лифта
      floors.forEach((f, k) => {
        const y = floorY(k);
        fillRR(ctx, g.bx + g.liftW, y, g.bw - g.liftW, 6, 2, '#c98b5a', OUT, 1.2);
        ctx.font = `900 ${Math.round(clamp(g.liftW * 0.36, 13, 22))}px ui-rounded, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#1098ad';
        ctx.fillText(String(f), g.bx + g.liftW / 2 + 2, y - g.fh * 0.55);
      });
      // холл
      fillRR(ctx, g.bx + g.liftW, g.by - 4, g.bw - g.liftW, 6, 2, '#1098ad', OUT, 1.2);
      ctx.font = `800 ${Math.round(clamp(g.fh * 0.16, 11, 16))}px ui-rounded, sans-serif`;
      ctx.fillStyle = '#0b7285';
      ctx.fillText('Холл', g.bx + g.bw - 40, g.by - g.fh * 0.5);
      // кабина лифта — там, где хомячок (с лифтом)
      if (lift) {
        const cy = move || Math.abs(hero.x - liftX()) < 3 ? hero.y : floorY(at),
          cw = g.liftW - 10;
        fillRR(ctx, g.bx + 7, cy - g.fh * 0.86, cw, g.fh * 0.86, 5, 'rgba(255,236,153,.55)', '#f59f00', 2);
      }
      // двери
      const want = i < N ? bags[i].n : 0,
        wantK = floors.indexOf(Math.floor(want / 100));
      for (const d of doors()) {
        const open = opened && opened.door.n === d.n,
          wink = tries >= 2 && d.n === want && (!lift || at === d.k) && Math.sin(t * 8) > 0;
        if (wink) ell(ctx, d.x, d.y - d.h / 2, d.w * 0.9, d.h * 0.62, 'rgba(255,212,59,.45)');
        fillRR(ctx, d.x - d.w / 2, d.y - d.h, d.w, d.h, 4, '#8d5524', OUT, 1.8);
        if (open && opened.ok) {
          fillRR(ctx, d.x - d.w / 2 + 3, d.y - d.h + 3, d.w - 6, d.h - 3, 3, '#fff3bf');
          host.drawHamster(ctx, d.x, d.y - 2, clamp(d.h / 190, 0.32, 0.6), host.friends.length ? host.friends[(i + d.n) % host.friends.length].look : host.look, { time: t, happy: true, armsUp: Math.sin(t * 10) > 0 });
        } else {
          const shake = open && !opened.ok ? Math.sin(t * 50) * 3 : 0;
          fillRR(ctx, d.x - d.w / 2 + 3 + shake, d.y - d.h + 3, d.w - 6, d.h - 3, 3, DOOR_COLORS[d.d], OUT, 1.2);
          ell(ctx, d.x + d.w * 0.28 + shake, d.y - d.h * 0.45, 2.6, 2.6, '#ffd43b', OUT, 1);
        }
        const pw = Math.max(30, d.w * 0.86);
        fillRR(ctx, d.x - pw / 2, d.y - d.h - 4 - 20, pw, 20, 6, '#fff', OUT, 1.5);
        ctx.font = `900 ${Math.round(clamp(d.w * 0.32, 11, 17))}px ui-rounded, "Trebuchet MS", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = OUT;
        ctx.fillText(String(d.n), d.x, d.y - d.h - 13);
      }
      // этажи, где хомячка нет, — чуть в тени (с лифтом: двери «работают» только на своём этаже)
      if (lift)
        floors.forEach((f, k) => {
          if (k === at && !move) return;
          const y = floorY(k);
          ctx.fillStyle = 'rgba(120,140,170,.16)';
          ctx.fillRect(g.bx + g.liftW, y - g.fh + 4, g.bw - g.liftW - 3, g.fh - 4);
        });
      // панель лифта с кнопками этажей
      if (lift) {
        const bs = buttons(),
          r = bs[0].r,
          y0 = bs[bs.length - 1].y - r * 2.7,
          y1 = bs[0].y + r * 1.5;
        fillRR(ctx, g.px, y0, g.panelW, y1 - y0, 12, '#ced4da', OUT, 2.2);
        fillRR(ctx, g.px + 5, y0 + 5, g.panelW - 10, y1 - y0 - 10, 9, '#e9ecef');
        ctx.font = `${Math.round(r * 0.9)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🛗', g.px + g.panelW / 2, y0 + r * 0.95);
        const waiting = !move && !opened && i < N && (at < 0 || floors[at] !== Math.floor(want / 100));
        for (const b of bs) liftButton(ctx, b.x, b.y, b.r, String(b.f), !!(pressed && pressed.f === b.f), waiting && tries >= 2 && b.k === wantK && Math.sin(t * 8) > 0);
        if (waiting && at < 0) {
          // подсказка «нажми этаж» — над панелью, мигает
          const fs = Math.round(clamp(r * 0.62, 11, 15));
          ctx.globalAlpha = 0.65 + 0.35 * Math.sin(t * 5);
          ctx.font = `900 ${fs}px ui-rounded, "Trebuchet MS", sans-serif`;
          ctx.fillStyle = '#c92a2a';
          ctx.fillText('Нажми', g.px + g.panelW / 2, y0 - fs * 1.9);
          ctx.fillText('этаж!', g.px + g.panelW / 2, y0 - fs * 0.8);
          ctx.globalAlpha = 1;
        }
      }
      // выбор клавиатурой
      const sd = doors().find((q) => q.k === sel.k && q.d === sel.d);
      if (sd && !move) {
        ctx.strokeStyle = 'rgba(28,126,214,.6)';
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 5]);
        ctx.strokeRect(sd.x - sd.w / 2 - 6, sd.y - sd.h - 30, sd.w + 12, sd.h + 32);
        ctx.setLineDash([]);
      }
      // хомячок с тележкой: платформа на колёсиках впереди, ручка — у лапок, чемодан на платформе
      const s = clamp(g.fh / 170, 0.34, 0.75),
        px = hero.x + 8 * s,
        pw = 70 * s;
      line(ctx, px + 4 * s, hero.y - 8, px + 4 * s, hero.y - 70 * s, '#f59f00', 4 * s);
      fillRR(ctx, px, hero.y - 14 * s, pw, 8 * s, 3, '#ffd43b', OUT, 1.4);
      for (const dx of [12, 58]) ell(ctx, px + dx * s, hero.y - 4 * s, 6 * s, 6 * s, '#495057', OUT, 1.2);
      if (i < N && !(opened && opened.ok) && !back) suitcase(ctx, px + pw * 0.55, hero.y - 14 * s, 46 * s, 40 * s, bags[i].col);
      host.drawHamster(ctx, hero.x - 10 * s, hero.y, s, host.look, { time: t, dir: 1, walk: move ? t * 3 : null, happy: !!(opened && opened.ok) });
      // подсказка
      if (hint && i < N) {
        const fs = Math.round(clamp(W / 26, 13, 17));
        ctx.font = `800 ${fs}px ui-rounded, "Trebuchet MS", sans-serif`;
        const tw = Math.min(W - 30, ctx.measureText(hint.text).width + 24);
        fillRR(ctx, W / 2 - tw / 2, g.head + 2, tw, fs + 14, 10, '#fff3bf', OUT, 2);
        ctx.textAlign = 'center';
        ctx.fillStyle = OUT;
        ctx.fillText(hint.text, W / 2, g.head + 9 + fs / 2, W - 40);
      }
      pops.draw(ctx, 18);
      if (i >= N) star(ctx, W / 2, H / 2, 40, '#ffd43b', OUT, 3);
    }

    host.loop((dt) => {
      if (!over) update(dt);
      tLeft.textContent = `🧳 ${Math.min(i + 1, N)} из ${N}`;
      tPts.textContent = `⭐ ${pts}`;
      draw();
    });
    function finish() {
      over = true;
      const stars = pts >= PORTER_STARS[1] ? 3 : pts >= PORTER_STARS[0] ? 2 : 1;
      const doorMiss = mistakes - floorMiss;
      host.finish({
        stars,
        text: `Все ${N} чемоданов на месте! Очков — ${pts}${
          mistakes
            ? `, ошибок дверью — ${doorMiss}${lift ? `, этажом в лифте — ${floorMiss}` : ''}.`
            : lift
              ? ', и ни одной ошибки — ни дверью, ни этажом в лифте!'
              : ', и ни одной ошибки!'
        }${stars === 3 ? ' Лучшая носильщица отеля!' : ''}`,
        extra: { pts, mistakes, floorMiss, lift },
      });
    }
  },
};
