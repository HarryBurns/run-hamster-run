// Мини-игра «Садовник» (этап 17в) — работа в городском парке (зовёт Мята у садовой тележки).
// Смена из трёх дел:
//   💧 полить — нажимай на поникшие цветы, лейка их напоит (политый — «уже напился», просто подсказка);
//   ✂️ подстричь куст по шаблону — на карточке фигура (сердечко, шарик, зайчик, звёздочка): нажимай или веди
//      пальцем по лишним веточкам; лист из фигуры срезать нельзя — «это оставим!», он сразу отрастает;
//   🌷 посадить цветы по схеме — выбери цвет внизу и нажми на лунку; не тот цвет — «по схеме здесь …».
// Без таймера и проигрыша; звёзды — по числу подсказок. Dev-хуки на канве: __garden() — что сейчас и где нажать
// (точки мира), __gardenDo() — сделать одно верное действие, __gardenTap(x, y) — нажать в точку мира.
import { el, clamp, pick, shuffle } from '../core/util.js';
import { ell, fillRR, line, poly } from '../core/draw.js';
import { CLOTHES_BY_ID } from '../data/index.js';

const W = 400,
  H = 300,
  OUT = '#4a3728';
const STARS = [1, 4]; // подсказок не больше: ⭐⭐⭐ / ⭐⭐
export const SHAPES = {
  heart: { name: 'сердечко', rows: ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'] },
  ball: { name: 'шарик', rows: ['..XXX..', '.XXXXX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..'] },
  bunny: { name: 'зайчик', rows: ['.X...X.', '.X...X.', '.XXXXX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.'] },
  star: { name: 'звёздочка', rows: ['...X...', '..XXX..', 'XXXXXXX', '.XXXXX.', '.XX.XX.', '.X...X.'] },
};
const COLORS = [
  { c: '#ff6b9d', name: 'розовый' },
  { c: '#ffd43b', name: 'жёлтый' },
  { c: '#9775fa', name: 'сиреневый' },
  { c: '#fff', name: 'белый' },
];
const STAGES = [
  { id: 'water', icon: '💧', title: 'Полей поникшие цветы' },
  { id: 'trim', icon: '✂️', title: 'Подстриги куст, как на карточке' },
  { id: 'plant', icon: '🌷', title: 'Посади цветы по схеме' },
];

const CSS = `
.gd-top{position:absolute;left:0;right:0;top:0;display:flex;gap:6px;justify-content:center;flex-wrap:wrap;padding:8px;pointer-events:none;z-index:2}
.gd-chip{background:rgba(255,255,255,.92);border-radius:12px;padding:4px 10px;font-weight:900;font-size:15px;box-shadow:0 2px 0 rgba(74,55,40,.15)}
.gd-pal{position:absolute;left:0;right:0;bottom:0;display:flex;gap:10px;justify-content:center;padding:8px 8px calc(10px + env(safe-area-inset-bottom));z-index:2}
.gd-pal button{width:58px;height:58px;border-radius:50%;border:3px solid #4a3728;box-shadow:0 4px 0 rgba(0,0,0,.25);font-size:26px;touch-action:manipulation;cursor:pointer}
.gd-pal button.on{transform:translateY(-4px) scale(1.08);box-shadow:0 0 0 4px #fff,0 0 14px 4px rgba(255,255,255,.85)}
.gd-pal.hide{display:none}
@media (max-height:460px){.gd-pal button{width:46px;height:46px;font-size:20px}}
`;

export default {
  id: 'gardener',
  title: 'Садовник',
  icon: '🌷',
  howTo:
    'Парку нужна твоя помощь! Три дела: <b>💧 полей</b> поникшие цветы, <b>✂️ подстриги куст</b> как на карточке (нажимай или веди пальцем по лишним веточкам) и <b>🌷 посади цветы</b> по схеме — выбери цвет внизу и нажми на лунку. Торопиться некуда!',

  start(host) {
    const root = host.root;
    const level = host.level || 0;
    const style = el('style', '', CSS);
    const top = el('div', 'gd-top');
    const tStage = el('div', 'gd-chip'),
      tSay = el('div', 'gd-chip');
    top.append(tStage, tSay);
    const pal = el('div', 'gd-pal hide');
    root.append(style, top, pal);
    root.style.background = '#b2f2bb';
    const cv = host.canvas();
    cv.canvas.classList.add('gd-canvas');
    const ctx = cv.ctx;
    const me = { ...host.look, outfit: { ...(host.look.outfit || {}), head: (host.look.outfit && host.look.outfit.head) || CLOTHES_BY_ID.panama_green || null } };

    let t = 0,
      last = performance.now(),
      raf = 0,
      stopped = false,
      over = false,
      stage = 0,
      hints = 0,
      stageAt = 0,
      fx = []; // искорки, капли, листики: { x, y, vx, vy, t0, kind, c }
    const say = (s) => (tSay.innerHTML = s);
    const updTop = () => {
      const st = STAGES[stage];
      tStage.textContent = `${st.icon} ${stage + 1}/3 · ${st.title}`;
    };

    // ---------- 1. полить ----------
    const PLANTS = 8;
    const plants = Array.from({ length: PLANTS }, (_, i) => ({
      x: 92 + (i % 4) * 72 + (Math.floor(i / 4) ? 34 : 0),
      y: 150 + Math.floor(i / 4) * 72,
      c: COLORS[i % 3].c,
      dry: false,
      wet: -9, // когда полили
    }));
    shuffle(plants.map((_, i) => i))
      .slice(0, 5)
      .forEach((i) => (plants[i].dry = true));
    let can = null; // { x, y, t0 } — лейка над цветком

    // ---------- 2. куст ----------
    const shapeId = pick(Object.keys(SHAPES)),
      shape = SHAPES[shapeId].rows;
    const BC = 7,
      BR = 6,
      CELL = 26,
      BX = 140 - (BC * CELL) / 2 + 40,
      BY = 70;
    const bush = shape.map((r) => [...r].map((ch) => ({ keep: ch === 'X', cut: false, shake: -9 })));
    const cellAt = (x, y) => {
      const cx = Math.floor((x - BX) / CELL),
        cy = Math.floor((y - BY) / CELL);
      return cx >= 0 && cy >= 0 && cx < BC && cy < BR ? { cx, cy, b: bush[cy][cx] } : null;
    };

    // ---------- 3. клумба по схеме ----------
    const FC = level >= 2 ? 5 : 4,
      FR = 3,
      FCELL = 46,
      FX = Math.min(70, 284 - FC * FCELL),
      FY = 92;
    const ncol = level >= 1 ? 3 : 2;
    const cols = shuffle(COLORS.slice(0, 4)).slice(0, ncol);
    const patterns = [
      (x, y) => y % ncol, // полосы рядами
      (x, y) => x % ncol, // полосы столбиками
      (x, y) => (x + y) % ncol, // наискосок
      (x, y) => (x === 0 || y === 0 || x === FC - 1 || y === FR - 1 ? 0 : 1 % ncol), // рамка и середина
    ];
    const pat = pick(patterns);
    const bed = Array.from({ length: FR }, (_, y) => Array.from({ length: FC }, (_, x) => ({ want: pat(x, y), got: null, shake: -9 })));
    let sel = 0;
    function buildPalette() {
      pal.innerHTML = '';
      cols.forEach((c, i) => {
        const b = el('button', i === sel ? 'on' : '', '🌸');
        b.style.background = c.c;
        b.title = c.name;
        b.onclick = () => {
          sel = i;
          host.sfx('tap');
          buildPalette();
        };
        pal.appendChild(b);
      });
    }

    function nextStage() {
      stage++;
      stageAt = t;
      if (stage >= STAGES.length) return finish();
      updTop();
      host.sfx('win');
      if (STAGES[stage].id === 'trim') say(`Сделай из куста <b>${SHAPES[shapeId].name}</b> ✂️`);
      if (STAGES[stage].id === 'plant') {
        pal.classList.remove('hide');
        buildPalette();
        say('Выбери цвет внизу и нажми на лунку 🌱');
      }
    }
    function finish() {
      over = true;
      pal.classList.add('hide');
      say('Парк — как картинка! 🌳');
      setTimeout(() => {
        if (stopped) return;
        const stars = hints <= STARS[0] ? 3 : hints <= STARS[1] ? 2 : 1;
        host.finish({
          stars,
          text: hints ? `Цветы политы, куст подстрижен, клумба посажена! Подсказок: ${hints}.` : 'Цветы политы, куст — точь-в-точь как на карточке, клумба — по схеме. И ни одной подсказки!',
          extra: { hints },
        });
      }, 900);
    }
    const puff = (x, y, kind, c, n = 6) => {
      for (let i = 0; i < n; i++) fx.push({ x, y, vx: (Math.random() - 0.5) * 60, vy: -30 - Math.random() * 40, t0: t, kind, c });
    };

    // ---------- нажатия ----------
    function tap(x, y, drag) {
      if (over || t - stageAt < 0.3) return;
      const st = STAGES[stage].id;
      if (st === 'water') {
        if (drag || can) return;
        let best = null,
          bd = 34;
        for (const p of plants) {
          const d = Math.hypot(p.x - x, p.y - 20 - y);
          if (d < bd) {
            bd = d;
            best = p;
          }
        }
        if (!best) return;
        if (!best.dry) {
          hints++;
          host.sfx('bad');
          say('Этот цветок уже напился 💧 Ищи поникшие!');
          best.wet = t;
          return;
        }
        can = { p: best, t0: t };
        host.sfx('splash');
      } else if (st === 'trim') {
        const c = cellAt(x, y);
        if (!c || c.b.cut) return;
        if (c.b.keep) {
          if (drag) return; // ведёшь пальцем — листья фигуры не трогаем
          hints++;
          c.b.shake = t;
          host.sfx('bad');
          say(`Это оставим — это часть фигуры! Смотри на карточку 💡`);
          return;
        }
        c.b.cut = true;
        puff(BX + (c.cx + 0.5) * CELL, BY + (c.cy + 0.5) * CELL, 'leaf', '#69db7c', 3);
        host.sfx('pop');
        if (bush.every((r) => r.every((b) => b.keep || b.cut))) {
          say('Точь-в-точь как на карточке! ✨');
          setTimeout(() => !stopped && nextStage(), 700);
          stageAt = t + 5; // пока не перешли — нажатия не считаем
        }
      } else if (st === 'plant') {
        if (drag) return;
        const cx = Math.floor((x - FX) / FCELL),
          cy = Math.floor((y - FY) / FCELL);
        if (cx < 0 || cy < 0 || cx >= FC || cy >= FR) return;
        const b = bed[cy][cx];
        if (b.got !== null) return;
        if (b.want !== sel) {
          hints++;
          b.shake = t;
          host.sfx('bad');
          say(`По схеме здесь — <b>${cols[b.want].name}</b> цветок 💡`);
          return;
        }
        b.got = sel;
        puff(FX + (cx + 0.5) * FCELL, FY + (cy + 0.5) * FCELL, 'spark', cols[sel].c, 5);
        host.sfx('pop');
        if (bed.every((r) => r.every((q) => q.got !== null))) {
          say('Клумба — как на схеме! 🌷');
          stageAt = t + 5;
          setTimeout(() => !stopped && nextStage(), 700);
        }
      }
    }
    const view = { k: 1, ox: 0, oy: 0 };
    const toWorld = (e) => {
      const r = cv.canvas.getBoundingClientRect();
      return { x: (e.clientX - r.left - view.ox) / view.k, y: (e.clientY - r.top - view.oy) / view.k };
    };
    let pressed = false;
    const down = (e) => {
      e.preventDefault();
      pressed = true;
      const p = toWorld(e);
      tap(p.x, p.y, false);
    };
    const move = (e) => {
      if (!pressed) return;
      const p = toWorld(e);
      tap(p.x, p.y, true);
    };
    const up = () => (pressed = false);
    cv.canvas.addEventListener('pointerdown', down);
    cv.canvas.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);

    // ---------- ход времени ----------
    function update(dt) {
      t += dt;
      if (can && t - can.t0 > 0.9) {
        can.p.dry = false;
        can.p.wet = t;
        puff(can.p.x, can.p.y - 30, 'spark', '#ffd43b', 5);
        host.sfx('ok');
        can = null;
        const left = plants.filter((p) => p.dry).length;
        say(left ? `Ещё ${left} 💧` : 'Все цветы напились! 🌼');
        if (!left) {
          stageAt = t + 5;
          setTimeout(() => !stopped && nextStage(), 700);
        }
      }
      for (let i = fx.length - 1; i >= 0; i--) {
        const f = fx[i];
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        f.vy += 120 * dt;
        if (t - f.t0 > 0.9) fx.splice(i, 1);
      }
    }

    // ---------- рисунок ----------
    function flower(x, y, c, dry, k = 1, wig = 0) {
      const bend = dry ? 10 : Math.sin(t * 2 + x) * 1.2 + wig;
      const hx = x + bend * k,
        hy = y - (dry ? 22 : 32) * k;
      ctx.strokeStyle = dry ? '#a9a36b' : '#2f9e44';
      ctx.lineWidth = 3 * k;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x, y - 18 * k, hx, hy);
      ctx.stroke();
      ell(ctx, x - 6 * k, y - 10 * k, 6 * k, 3 * k, dry ? '#c0b97a' : '#51cf66', OUT, 1, -0.5);
      ell(ctx, x + 6 * k, y - 14 * k, 6 * k, 3 * k, dry ? '#c0b97a' : '#51cf66', OUT, 1, 0.5);
      const pc = dry ? '#d9cfc1' : c;
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + (dry ? 0.8 : 0);
        ell(ctx, hx + Math.cos(a) * 6 * k, hy + Math.sin(a) * 6 * k + (dry ? 3 : 0), 5 * k, 5 * k, pc, OUT, 1);
      }
      ell(ctx, hx, hy + (dry ? 3 : 0), 4 * k, 4 * k, dry ? '#bfa76f' : '#ffa94d', OUT, 1);
    }
    function drawGround() {
      ctx.fillStyle = '#b2f2bb';
      ctx.fillRect(-200, -200, W + 400, H + 400);
      ctx.fillStyle = '#8ce99a';
      for (let i = 0; i < 40; i++) {
        const x = (i * 97) % W,
          y = 40 + ((i * 61) % (H - 40));
        ctx.fillRect(x, y, 3, 6);
        ctx.fillRect(x + 4, y + 2, 3, 5);
      }
    }
    function drawWater() {
      fillRR(ctx, 50, 104, 300, 150, 30, '#a47148', OUT, 2.5);
      fillRR(ctx, 58, 112, 284, 134, 24, '#8d5a35', null);
      for (const p of plants) flower(p.x, p.y, p.c, p.dry, 1.1, t - p.wet < 0.5 ? Math.sin((t - p.wet) * 30) * 3 : 0);
      if (can) {
        const k = clamp((t - can.t0) / 0.9, 0, 1),
          x = can.p.x + 22,
          y = can.p.y - 62 - Math.sin(k * Math.PI) * 4;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(-0.5 * Math.min(1, k * 3));
        fillRR(ctx, -12, -10, 24, 20, 5, '#4dabf7', OUT, 2);
        poly(ctx, [-12, 0, -30, -10, -30, -6, -12, 6], '#339af0', OUT, 1.5);
        ctx.strokeStyle = OUT;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(4, -10, 8, Math.PI, 0);
        ctx.stroke();
        ctx.restore();
        if (k > 0.3)
          for (let i = 0; i < 4; i++) {
            const q = (t * 3 + i * 0.25) % 1;
            ell(ctx, x - 26 + i * 2, y - 2 + q * 34, 1.8, 3, '#74c0fc', null);
          }
      }
    }
    function drawCard(x, y, w, h, title) {
      fillRR(ctx, x, y, w, h, 10, '#fff', OUT, 2);
      ctx.fillStyle = OUT;
      ctx.font = '900 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(title, x + w / 2, y + 11);
    }
    function drawTrim() {
      // карточка с фигурой
      const cx = 300,
        cy = 70,
        s = 11;
      drawCard(cx, cy - 6, 90, 92, '📋 Как надо');
      shape.forEach((r, yy) => [...r].forEach((ch, xx) => ch === 'X' && fillRR(ctx, cx + 6 + xx * s, cy + 14 + yy * s, s - 1, s - 1, 3, '#51cf66', null)));
      // земля под кустом
      ell(ctx, BX + (BC * CELL) / 2, BY + BR * CELL + 6, (BC * CELL) / 2 + 6, 12, 'rgba(74,55,40,.18)', null);
      for (let yy = 0; yy < BR; yy++)
        for (let xx = 0; xx < BC; xx++) {
          const b = bush[yy][xx];
          if (b.cut) continue;
          const sh = t - b.shake < 0.4 ? Math.sin((t - b.shake) * 40) * 2 : 0;
          const x = BX + xx * CELL + sh,
            y = BY + yy * CELL;
          const extra = !b.keep;
          ell(ctx, x + CELL / 2, y + CELL / 2, CELL * 0.62, CELL * 0.58, extra ? '#8fd694' : '#40c057', OUT, 1.2);
          ell(ctx, x + CELL / 2 - 4, y + CELL / 2 - 4, CELL * 0.22, CELL * 0.18, extra ? '#b8eab9' : '#69db7c', null);
          if (extra) {
            // лишние веточки торчат
            line(ctx, x + CELL / 2, y + CELL / 2, x + CELL / 2 + 8, y + 2, '#8d5a35', 1.5);
            ell(ctx, x + CELL / 2 + 9, y + 2, 3, 2, '#8fd694', OUT, 0.8);
          }
        }
      // ствол
      fillRR(ctx, BX + (BC * CELL) / 2 - 6, BY + BR * CELL - 4, 12, 18, 3, '#8d5a35', OUT, 1.5);
    }
    function drawPlant() {
      // схема
      const sx = 300,
        sy = 64,
        s = 15;
      drawCard(sx, sy - 6, 92, 28 + FR * s, '📋 Схема');
      bed.forEach((r, y) => r.forEach((b, x) => ell(ctx, sx + 46 - (FC * s) / 2 + (x + 0.5) * s, sy + 18 + (y + 0.5) * s, s * 0.38, s * 0.38, cols[b.want].c, OUT, 1)));
      // клумба
      fillRR(ctx, FX - 8, FY - 8, FC * FCELL + 16, FR * FCELL + 16, 16, '#adb5bd', OUT, 2.5);
      fillRR(ctx, FX - 2, FY - 2, FC * FCELL + 4, FR * FCELL + 4, 12, '#8d5a35', null);
      bed.forEach((r, y) =>
        r.forEach((b, x) => {
          const cx = FX + (x + 0.5) * FCELL,
            cy = FY + (y + 0.5) * FCELL;
          const sh = t - b.shake < 0.4 ? Math.sin((t - b.shake) * 40) * 3 : 0;
          if (b.got === null) {
            ell(ctx, cx + sh, cy + 6, 12, 6, '#6b4226', null);
            ell(ctx, cx + sh, cy + 5, 9, 4, '#5a371f', null);
          } else flower(cx, cy + 14, cols[b.got].c, false, 0.9);
        }),
      );
    }
    function drawFx() {
      for (const f of fx) {
        const a = 1 - (t - f.t0) / 0.9;
        ctx.globalAlpha = clamp(a, 0, 1);
        if (f.kind === 'leaf') ell(ctx, f.x, f.y, 4, 2.5, f.c, OUT, 0.8, f.vx * 0.05);
        else ell(ctx, f.x, f.y, 2.5, 2.5, f.c, null);
      }
      ctx.globalAlpha = 1;
    }
    const frame = (ts) => {
      if (stopped) return;
      const dt = Math.min(0.05, (ts - last) / 1000);
      last = ts;
      update(dt);
      const palH = pal.classList.contains('hide') ? 0 : pal.getBoundingClientRect().height;
      const k = Math.min(cv.w / W, (cv.h - palH) / H);
      view.k = k;
      view.ox = (cv.w - W * k) / 2;
      view.oy = Math.max(0, (cv.h - palH - H * k) / 2);
      ctx.setTransform(cv.dpr, 0, 0, cv.dpr, 0, 0);
      ctx.fillStyle = '#b2f2bb';
      ctx.fillRect(0, 0, cv.w, cv.h);
      ctx.setTransform(cv.dpr * k, 0, 0, cv.dpr * k, cv.dpr * view.ox, cv.dpr * view.oy);
      drawGround();
      const st = STAGES[Math.min(stage, STAGES.length - 1)].id;
      if (st === 'water') drawWater();
      else if (st === 'trim') drawTrim();
      else drawPlant();
      drawFx();
      // садовник — хомячок в уголке
      host.drawHamster(ctx, 34, 282, 0.7, me, { time: t, blink: t % 3.2 < 0.13, dir: 1, happy: over, armsUp: over });
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    updTop();
    say(`Поникших цветов: ${plants.filter((p) => p.dry).length} 💧`);

    // ---------- dev-хуки ----------
    const todo = () => {
      const st = STAGES[Math.min(stage, 2)].id;
      if (st === 'water') return plants.filter((p) => p.dry).map((p) => ({ x: p.x, y: p.y - 20 }));
      if (st === 'trim') {
        const out = [];
        bush.forEach((r, y) => r.forEach((b, x) => !b.keep && !b.cut && out.push({ x: BX + (x + 0.5) * CELL, y: BY + (y + 0.5) * CELL })));
        return out;
      }
      const out = [];
      bed.forEach((r, y) => r.forEach((b, x) => b.got === null && out.push({ x: FX + (x + 0.5) * FCELL, y: FY + (y + 0.5) * FCELL, color: b.want })));
      return out;
    };
    cv.canvas.__garden = () => ({ stage: STAGES[Math.min(stage, 2)].id, i: stage, over, hints, busy: !!can || t - stageAt < 0.3, todo: todo(), shape: shapeId, view: { ...view, W, H } });
    cv.canvas.__gardenDo = () => {
      const q = todo()[0];
      if (!q || can || t - stageAt < 0.3) return false;
      if (q.color !== undefined) sel = q.color;
      tap(q.x, q.y, false);
      return true;
    };
    cv.canvas.__gardenTap = (x, y) => tap(x, y, false);
    cv.canvas.__gardenSel = (i) => {
      sel = i;
      buildPalette();
    };

    return {
      stop() {
        stopped = true;
        cancelAnimationFrame(raf);
        cv.canvas.removeEventListener('pointerdown', down);
        cv.canvas.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        cv.destroy();
      },
    };
  },
};
