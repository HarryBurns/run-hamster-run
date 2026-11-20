// Мини-игра «Грибная охота» (лес, П.9; запускает лесник Шишкин — features/forest.js).
// На лесной полянке из-под листьев и травы выглядывают грибы и прячутся обратно. Съедобные — белый гриб,
// подосиновик, лисички — нажимай (мышью или пальцем), они летят в корзинку. Несъедобные — мухомор и поганку —
// не трогай: нажала — «Ой, этот нельзя!», гриб остаётся в лесу (проигрыша нет, просто звёзд меньше).
// 40 секунд; звёзды — по тому, сколько собрано (минус ошибки). Награду (монеты и грибы) даёт занятие по звёздам.
import { el, clamp, plural } from '../core/util.js';
import { ell, poly, fillRR } from '../core/draw.js';
import { pic as kitPic } from './kit.js';
import { DEV } from '../core/dev.js';

const TIME = 40;
const OUT = '#4a3728';
// виды грибов: good — съедобный; cap — шляпка, stem — ножка, dots — белые пятнышки (мухомор), shape — форма
export const MUSHROOMS = {
  porcini: { good: true, name: 'Белый гриб', cap: '#8d4a26', stem: '#fff4de', shape: 'dome' },
  aspen: { good: true, name: 'Подосиновик', cap: '#e8590c', stem: '#f1e3d3', shape: 'dome', tall: true },
  chanterelle: { good: true, name: 'Лисички', cap: '#fcc419', stem: '#fcc419', shape: 'funnel' },
  amanita: { good: false, name: 'Мухомор', cap: '#fa5252', stem: '#ffffff', shape: 'dome', dots: true, skirt: true },
  toadstool: { good: false, name: 'Поганка', cap: '#d8e6c1', stem: '#f8f9fa', shape: 'bell', skirt: true, tall: true },
};
const GOOD = ['porcini', 'aspen', 'chanterelle'],
  BAD = ['amanita', 'toadstool'];

/** Нарисовать гриб: (x, y) — низ ножки, s — масштаб. */
export function drawMushroom(ctx, kind, x, y, s) {
  const m = MUSHROOMS[kind],
    h = (m.tall ? 30 : 22) * s;
  ctx.save();
  ctx.translate(x, y);
  ctx.lineJoin = 'round';
  // ножка
  ctx.beginPath();
  if (m.shape === 'funnel') {
    ctx.moveTo(-4 * s, 0);
    ctx.quadraticCurveTo(-6 * s, -h * 0.5, -3 * s, -h);
    ctx.lineTo(3 * s, -h);
    ctx.quadraticCurveTo(6 * s, -h * 0.5, 4 * s, 0);
  } else {
    const w = (kind === 'porcini' ? 8 : 5) * s;
    ctx.moveTo(-w * 0.7, -h);
    ctx.quadraticCurveTo(-w * 1.3, -h * 0.2, -w, 0);
    ctx.lineTo(w, 0);
    ctx.quadraticCurveTo(w * 1.3, -h * 0.2, w * 0.7, -h);
  }
  ctx.closePath();
  ctx.fillStyle = m.stem;
  ctx.fill();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 1.8 * Math.min(1.4, s);
  ctx.stroke();
  if (kind === 'aspen')
    for (let i = 0; i < 5; i++) ell(ctx, (i % 2 ? 2 : -2) * s, -h * (0.2 + i * 0.15), 1.2 * s, 0.8 * s, '#495057');
  if (m.skirt) ell(ctx, 0, -h * 0.72, 6 * s, 2.4 * s, '#ffffff', OUT, 1.2);
  // шляпка
  const cw = (m.shape === 'bell' ? 12 : kind === 'porcini' ? 17 : 15) * s;
  ctx.beginPath();
  if (m.shape === 'funnel') {
    // лисичка: шляпка-воронка с волнистым краем, сверху чуть вогнутая
    ctx.moveTo(-cw, -h - 8 * s);
    ctx.quadraticCurveTo(-cw * 0.5, -h - 12 * s, 0, -h - 7 * s);
    ctx.quadraticCurveTo(cw * 0.5, -h - 12 * s, cw, -h - 8 * s);
    ctx.quadraticCurveTo(cw * 0.6, -h - 1 * s, 3 * s, -h + 2 * s);
    ctx.lineTo(-3 * s, -h + 2 * s);
    ctx.quadraticCurveTo(-cw * 0.6, -h - 1 * s, -cw, -h - 8 * s);
  } else if (m.shape === 'bell') {
    ctx.moveTo(-cw, -h + 2 * s);
    ctx.bezierCurveTo(-cw, -h - 20 * s, cw, -h - 20 * s, cw, -h + 2 * s);
    ctx.quadraticCurveTo(0, -h - 2 * s, -cw, -h + 2 * s);
  } else {
    ctx.moveTo(-cw, -h + 2 * s);
    ctx.bezierCurveTo(-cw, -h - 18 * s, cw, -h - 18 * s, cw, -h + 2 * s);
    ctx.quadraticCurveTo(0, -h + 5 * s, -cw, -h + 2 * s);
  }
  ctx.closePath();
  ctx.fillStyle = m.cap;
  ctx.fill();
  ctx.stroke();
  // блик и пятнышки
  if (m.shape === 'funnel') ell(ctx, 0, -h - 8 * s, cw * 0.75, 2.4 * s, 'rgba(255,255,255,.35)');
  else ell(ctx, -cw * 0.4, -h - 7 * s, cw * 0.28, 2.6 * s, 'rgba(255,255,255,.4)', null, 1, -0.3);
  if (m.dots)
    for (const [dx, dy] of [
      [-8, -6],
      [0, -11],
      [7, -5],
      [-2, -3],
      [10, -1],
    ])
      ell(ctx, dx * s, -h + dy * s, 2.2 * s, 1.8 * s, '#ffffff');
  ctx.restore();
}

/** Маленькая картинка гриба для правил (data: URL — заставка правил собирается строкой HTML). */
const pic = (kind, size = 40) =>
  kitPic((x) => drawMushroom(x, kind, size / 2, size - 6, size / 44), size, size, {
    join: false,
    alt: MUSHROOMS[kind].name,
    title: MUSHROOMS[kind].name,
  });

const CSS = `
.mh-rules{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin:8px 0 2px}
.mh-col{background:#fff;border-radius:14px;padding:4px 8px;border:3px solid #8ce99a;text-align:center}
.mh-col.no{border-color:#ffa8a8}
.mh-col b{display:block;font-size:16px}
.mh-col .row{display:flex;gap:2px;justify-content:center}
.mh-col small{display:block;font-size:12px;opacity:.75;line-height:1.2}
.mh-top{position:absolute;left:0;right:0;top:0;display:flex;gap:8px;justify-content:center;padding:8px;pointer-events:none;z-index:2}
.mh-chip{background:rgba(255,255,255,.92);border-radius:12px;padding:4px 12px;font-weight:900;font-size:16px;box-shadow:0 2px 0 rgba(74,55,40,.15)}
`;

export default {
  id: 'mushrooms',
  title: 'Грибная охота',
  icon: '🍄',
  css: CSS,
  get howTo() {
    return `Грибы выглядывают из-под листьев и прячутся обратно. <b>Нажимай только на съедобные</b> — они полетят в корзинку!
      <div class="mh-rules">
        <div class="mh-col"><b>✅ Можно</b><div class="row">${GOOD.map((k) => pic(k)).join('')}</div><small>белый, подосиновик,<br>лисички</small></div>
        <div class="mh-col no"><b>⛔ Нельзя</b><div class="row">${BAD.map((k) => pic(k)).join('')}</div><small>мухомор, поганка —<br>ядовитые!</small></div>
      </div>
      За 40 секунд собери побольше!`;
  },
  start(host) {
    const top = el('div', 'mh-top');
    const tTime = el('div', 'mh-chip'),
      tGot = el('div', 'mh-chip'),
      tBad = el('div', 'mh-chip');
    top.append(tTime, tGot, tBad);
    host.add(top);
    const cv = host.canvas();
    const ctx = cv.ctx;
    const level = host.level || 0;
    let t = 0,
      over = false,
      got = 0,
      bad = 0,
      nextSpawn = 0.4;
    const pops = host.pops(); // всплывающие надписи
    const flies = []; // гриб летит в корзинку
    // места, где прячутся грибы: 3 × 3 кучки листьев (доли экрана), чуть вразброс
    const SPOTS = [];
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 3; c++)
        SPOTS.push({ fx: 0.2 + c * 0.3 + (r % 2 ? 0.05 : -0.04), fy: 0.38 + r * 0.22, m: null });
    const season = host.season || 'summer';
    const grass =
      season === 'autumn'
        ? ['#c3cc66', '#a8b44f']
        : season === 'winter'
          ? ['#e9f2f8', '#cfdeea']
          : ['#86d45c', '#5fb83f'];
    const leaves =
      season === 'autumn'
        ? ['#e8590c', '#f59f00', '#fcc419']
        : season === 'winter'
          ? ['#ffffff', '#e3eef6', '#cfe3f0']
          : ['#2f9e44', '#40c057', '#69db7c'];

    function spawn() {
      const free = SPOTS.filter((s) => !s.m);
      if (!free.length) return;
      const s = free[Math.floor(Math.random() * free.length)];
      const good = Math.random() < 0.64;
      const list = good ? GOOD : BAD;
      const stay = clamp(2.3 - level * 0.15 - (t / TIME) * 0.7, 1.1, 2.4);
      s.m = { kind: list[Math.floor(Math.random() * list.length)], t: 0, stay, hit: false };
    }
    const geo = (s) => {
      const k = Math.min(cv.w / 420, cv.h / 520) * 1.25 + 0.4;
      return { x: s.fx * cv.w, y: 50 + s.fy * (cv.h - 60), k };
    };
    /** Насколько гриб вылез (0..1): выезжает, стоит, прячется. */
    const rise = (m) => {
      if (m.hit) return 1;
      if (m.t < 0.25) return m.t / 0.25;
      if (m.t > m.stay - 0.25) return Math.max(0, (m.stay - m.t) / 0.25);
      return 1;
    };

    function tap(e) {
      if (over) return;
      const r = cv.canvas.getBoundingClientRect(),
        px = e.clientX - r.left,
        py = e.clientY - r.top;
      let best = null,
        bd = 1e9;
      for (const s of SPOTS) {
        if (!s.m || s.m.hit || rise(s.m) < 0.35) continue;
        const g = geo(s),
          d = Math.hypot(px - g.x, py - (g.y - 34 * g.k));
        if (d < 44 * g.k && d < bd) {
          bd = d;
          best = s;
        }
      }
      if (!best) return;
      const m = best.m,
        g = geo(best);
      m.hit = true;
      if (MUSHROOMS[m.kind].good) {
        got++;
        host.sfx('pop');
        flies.push({ kind: m.kind, x: g.x, y: g.y, t: 0, k: g.k });
        pops.add('+1', g.x, g.y - 60 * g.k, '#2f9e44');
        best.m = null;
      } else {
        bad++;
        host.sfx('bad');
        pops.add('Ой! Этот нельзя!', g.x, g.y - 60 * g.k, '#e03131');
        m.shake = 0.5;
        m.hit = false;
        m.t = Math.max(m.t, m.stay - 0.4); // ядовитый прячется обратно
      }
    }
    host.on(cv.canvas, 'pointerdown', tap);
    // для автотеста (dev/smoke_forest.js): где сейчас какие грибы и куда нажать
    if (DEV)
      cv.canvas.__mh = () =>
        SPOTS.map((s) => {
          const g = geo(s);
          return s.m && !s.m.hit && rise(s.m) > 0.9
            ? { good: MUSHROOMS[s.m.kind].good, x: g.x, y: g.y - 34 * g.k }
            : null;
        }).filter(Boolean);

    function draw() {
      const W = cv.w,
        H = cv.h;
      // полянка
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, grass[0]);
      g.addColorStop(1, grass[1]);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      // ёлки по краю сверху
      for (let x = -10, i = 0; x < W + 30; x += 46, i++) {
        const y = 40 + (i % 2) * 10;
        poly(ctx, [x - 26, y + 20, x, y - 40, x + 26, y + 20], season === 'winter' ? '#cfe3f0' : '#2b8a3e', OUT, 2);
      }
      // корзинка в углу
      const bx = W - 60,
        by = H - 50;
      fillRR(ctx, bx - 34, by - 18, 68, 40, 12, '#c98b5a', OUT, 2.5);
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(bx, by - 18, 26, Math.PI, 0);
      ctx.stroke();
      for (let i = 0; i < Math.min(got, 12); i++)
        drawMushroom(ctx, GOOD[i % 3], bx - 24 + (i % 6) * 10, by - 12 + Math.floor(i / 6) * 8, 0.5);
      // грибы за кучками листьев (сначала гриб, потом кучка — кучка его закрывает снизу)
      const order = SPOTS.slice().sort((a, b) => a.fy - b.fy);
      for (const s of order) {
        const gg = geo(s);
        if (s.m) {
          const k = rise(s.m),
            sh = s.m.shake > 0 ? Math.sin(t * 60) * 4 : 0;
          ctx.save();
          ctx.beginPath();
          ctx.rect(gg.x - 60 * gg.k, gg.y - 110 * gg.k, 120 * gg.k, 110 * gg.k + 2);
          ctx.clip();
          drawMushroom(ctx, s.m.kind, gg.x + sh, gg.y - 4 * gg.k + (1 - k) * 62 * gg.k, 1.6 * gg.k);
          ctx.restore();
        }
        // кучка листьев
        ell(ctx, gg.x + 4, gg.y + 6 * gg.k, 36 * gg.k, 10 * gg.k, 'rgba(52,38,70,.18)');
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * Math.PI;
          ell(
            ctx,
            gg.x + Math.cos(a) * 24 * gg.k,
            gg.y + 2 * gg.k - Math.sin(a) * 5 * gg.k,
            12 * gg.k,
            7 * gg.k,
            leaves[i % 3],
            OUT,
            1.5,
            a,
          );
        }
      }
      // летят в корзинку
      for (const f of flies) {
        const k = Math.min(1, f.t / 0.5),
          x = f.x + (bx - f.x) * k,
          y = f.y + (by - f.y) * k - Math.sin(k * Math.PI) * 80;
        drawMushroom(ctx, f.kind, x, y, 1.1 * f.k * (1 - k * 0.5));
      }
      // надписи
      pops.draw(ctx);
      // хомячок с корзинкой
      host.drawHamster(ctx, 52, H - 12, 0.75, host.look, { time: t, happy: flies.length > 0, blink: t % 3.3 < 0.12 });
    }

    host.loop((dt) => {
      if (!over) {
        t += dt;
        nextSpawn -= dt;
        if (nextSpawn <= 0) {
          spawn();
          nextSpawn = clamp(0.75 - level * 0.05 - (t / TIME) * 0.25, 0.4, 0.8);
        }
        for (const s of SPOTS)
          if (s.m) {
            s.m.t += dt;
            if (s.m.shake > 0) s.m.shake -= dt;
            if (s.m.t >= s.m.stay) s.m = null;
          }
        if (t >= TIME) finish();
      }
      for (const f of flies) f.t += dt;
      for (let i = flies.length - 1; i >= 0; i--) if (flies[i].t > 0.5) flies.splice(i, 1);
      pops.step(dt);
      tTime.textContent = `⏱️ ${Math.max(0, Math.ceil(TIME - t))}`;
      tGot.textContent = `🧺 ${got}`;
      tBad.textContent = `❌ ${bad}`;
      draw();
    });
    function finish() {
      over = true;
      const score = got - bad;
      const stars = score >= 18 ? 3 : score >= 10 ? 2 : 1;
      host.finish({
        stars,
        text: `В корзинке ${got} ${plural(got, 'гриб', 'гриба', 'грибов')}${bad ? `, ядовитых тронул{|а} ${bad}` : ', и ни одного ядовитого!'}${stars === 3 ? ' Настоящий грибник!' : ''}`,
        extra: { got, bad },
      });
    }
  },
};
