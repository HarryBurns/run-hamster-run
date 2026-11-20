// Мини-игра «Горка» (курортный отель, П.17; запускается с водной горки на крыше — features/hotel.js).
// Вид сверху: хомячок на надувном круге несётся по извилистой трубе водной горки (труба бежит навстречу). Рули —
// пальцем или мышью (круг едет туда, где палец), или стрелками ← →: на поворотах «наклоняйся» внутрь, чтобы не
// вылететь к бортику. Круг тяжёлый (руль с инерцией, STEER) — рулить надо чуть заранее. Собирай пузыри и звёздочки.
// Проигрыша нет: задела бортик на скорости — «плюх!», брызги, круг почти встаёт, мягко отплывает к середине и снова
// разгоняется; коснулась тихонько — скользит вдоль бортика. 40 секунд; в конце — в бассейн с брызгами. Звёзды — по
// тому, сколько собрано. Приз даёт занятие.
// Горок четыре (От5, TRACKS): после «Начать!» выбираешь трассу — у каждой свой рисунок поворотов, ширина и скорость.
// Общее со «Спуском с горы» (выбор карточками, руль, полоса, табло, звёзды) — runner.js; здесь — труба и вода.
import { clamp, plural } from '../core/util.js';
import { ell, fillRR, line, star } from '../core/draw.js';
import { runnerGame, runnerCss, rulePic, cardPic } from './runner.js';

const TIME = 40;
const OUT = '#4a3728';
/** Сколько очков на 2★ и 3★ (пузырь — 1, звёздочка — 3). */
export const SLIDE_STARS = [24, 44];
const KINDS = { bubble: { pts: 1, r: 14 }, star: { pts: 3, r: 16 } };
/**
 * Руль с инерцией: k — как сильно круг стремится к пальцу (скорость = k × расстояние), max — самая большая скорость
 * поперёк трубы (доля ширины в секунду), grip — как быстро скорость догоняет желаемую (чем меньше, тем «тяжелее» круг).
 */
const STEER = { k: 4, max: 1.1, grip: 4.5 };
/** С какой скорости (поперёк) удар о бортик — «плюх!»; тише — круг просто скользит вдоль бортика. */
const BUMP_SPEED = 0.12;
/**
 * Трассы (От5): c(u) — центр трубы (доля ширины полосы) на расстоянии u (в экранах) от старта; half — полуширина
 * трубы; speed — множитель скорости; rim/water — цвета бортика и воды. Центр всегда в 0.25…0.75 — труба на экране.
 */
export const TRACKS = [
  {
    id: 'kid',
    name: 'Детская',
    icon: '🐣',
    say: 'широкая и спокойная',
    half: 0.2,
    speed: 0.88,
    rim: '#8ce99a',
    water: '#74c0fc',
    c: (u) => 0.5 + 0.13 * Math.sin(u * 1.25) + 0.04 * Math.sin(u * 2.7 + 0.5),
  },
  {
    id: 'snake',
    name: 'Змейка',
    icon: '🐍',
    say: 'плавные повороты',
    half: 0.17,
    speed: 1,
    rim: '#ffd43b',
    water: '#74c0fc',
    c: (u) => 0.5 + 0.2 * Math.sin(u * 1.9) + 0.09 * Math.sin(u * 4.3 + 1.2),
  },
  {
    id: 'zigzag',
    name: 'Зигзаг',
    icon: '⚡',
    say: 'прямо — и резко вбок!',
    half: 0.18,
    speed: 0.95,
    rim: '#ff8787',
    water: '#66d9e8',
    c: (u) => 0.5 + (0.23 * Math.tanh(3 * Math.sin(u * 1.5))) / Math.tanh(3),
  },
  {
    id: 'typhoon',
    name: 'Тайфун',
    icon: '🌪️',
    say: 'чем дальше, тем круче',
    half: 0.16,
    speed: 1.05,
    rim: '#b197fc',
    water: '#4dabf7',
    c: (u) => 0.5 + (0.09 + 0.15 * Math.min(1, u / 12)) * Math.sin(u * 1.5 + u * u * 0.035),
  },
];
export const TRACK_BY_ID = Object.fromEntries(TRACKS.map((q) => [q.id, q]));
/** Хомячок на круге (вид сверху-сзади). */
function drawRing(ctx, x, y, s, tilt) {
  ell(ctx, x + 3 * s, y + 8 * s, 30 * s, 10 * s, 'rgba(20,60,120,.18)');
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  ell(ctx, 0, 0, 30 * s, 16 * s, '#ff6b9d', OUT, 2);
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + 0.4;
    ell(ctx, Math.cos(a) * 24 * s, Math.sin(a) * 12 * s, 6 * s, 4 * s, '#fff', null, 0, a);
  }
  ell(ctx, 0, 0, 16 * s, 7 * s, '#74c0fc', OUT, 1.5);
  ctx.restore();
}
function drawBubble(ctx, x, y, s, t) {
  const r = (11 + Math.sin(t * 4 + x) * 1.2) * s;
  ell(ctx, x, y, r, r, 'rgba(231,245,255,.75)', '#4dabf7', 2);
  ell(ctx, x - r * 0.35, y - r * 0.35, r * 0.28, r * 0.2, '#fff');
}
function drawStar(ctx, x, y, s, t) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.sin(t * 3 + x) * 0.3);
  star(ctx, 0, 0, 14 * s, '#ffd43b', OUT, 2);
  ctx.restore();
}

/** Картинка «наклоняйся на повороте»: кусок трубы с поворотом и стрелка внутрь. */
function turnPic(x, cx, cy, s) {
  x.lineCap = 'round';
  const path = () => {
    x.beginPath();
    x.moveTo(cx - 8 * s, cy + 19 * s);
    x.quadraticCurveTo(cx - 10 * s, cy - 12 * s, cx + 18 * s, cy - 13 * s);
  };
  for (const [w, col] of [
    [22, OUT],
    [18, '#ffd43b'],
    [10, '#74c0fc'],
  ]) {
    path();
    x.strokeStyle = col;
    x.lineWidth = w * s;
    x.stroke();
  }
  x.lineCap = 'butt';
  // стрелка «рули внутрь поворота»
  line(x, cx + 14 * s, cy + 12 * s, cx + 3 * s, cy + 1 * s, '#e64980', 3 * s);
  line(x, cx + 3 * s, cy + 1 * s, cx + 10 * s, cy + 0.5 * s, '#e64980', 3 * s);
  line(x, cx + 3 * s, cy + 1 * s, cx + 3.5 * s, cy + 8 * s, '#e64980', 3 * s);
}

/** Маленькая картинка для правил. */
const pic = (draw) => rulePic(draw, 23);
/** Картинка трассы для выбора: труба сверху вниз (u от 0 до len). */
const trackPic = (tr, w = 84, h = 104, len = 9) =>
  cardPic(
    (x) => {
      const path = () => {
        x.beginPath();
        for (let i = 0; i <= 60; i++) {
          const u = (i / 60) * len,
            px = 6 + tr.c(u) * (w - 12),
            py = h - 4 - (i / 60) * (h - 8);
          if (i) x.lineTo(px, py);
          else x.moveTo(px, py);
        }
      };
      for (const [lw, col] of [
        [tr.half * w * 1.3 + 5, OUT],
        [tr.half * w * 1.3 + 2, tr.rim],
        [tr.half * w * 1.3 - 3, tr.water],
      ]) {
        path();
        x.strokeStyle = col;
        x.lineWidth = lw;
        x.stroke();
      }
    },
    w,
    h,
    '#fff4e6',
  );

const CSS =
  runnerCss('sd') +
  `
.sd-col.turn{border-color:#ffd43b}
.sd-pick{gap:10px;background:rgba(231,245,255,.92);overflow:auto}
.sd-pick .cards{gap:10px;max-width:720px}
.sd-pick button{border-radius:16px;padding:6px 8px;gap:2px;width:146px}
.sd-pick button b{font-size:16px;white-space:nowrap}
.sd-pick button small{font-size:12px;opacity:.75;line-height:1.2}
.sd-pick img{border-radius:10px}
@media (max-width:420px){.sd-pick button{width:136px}}
@media (max-height:460px){.sd-pick button{width:112px}.sd-pick img{height:60px;width:auto}}
`;

export default {
  id: 'slide',
  title: 'Горка',
  icon: '🌀',
  css: CSS,
  get howTo() {
    return `Ух! Водная горка! <b>Рули влево и вправо</b> — пальцем, мышкой или стрелками.
      <div class="sd-rules">
        <div class="sd-col how"><b>🛟 Рули</b><div class="row">◀ ${pic((c, x, y, s) => drawRing(c, x, y + 6, s * 1.1, 0))} ▶</div><small>пальцем, мышкой<br>или стрелками ← →</small></div>
        <div class="sd-col turn"><b>↪ Поворот</b><div class="row">${pic((c, x, y, s) => turnPic(c, x, y, s))}</div><small>на повороте рули внутрь —<br>не задевай бортик</small></div>
        <div class="sd-col"><b>✅ Собирай</b><div class="row">${pic((c, x, y, s) => drawBubble(c, x, y, s * 1.4, 0))}${pic((c, x, y, s) => drawStar(c, x, y, s * 1.3, 0))}</div><small>пузыри и звёздочки<br>(звёздочка — за три!)</small></div>
      </div>
      За ${TIME} секунд собери побольше! Задел{|а} бортик — «плюх!», и катишься дальше.
      Горок — ${TRACKS.length}: ${TRACKS.map((q) => `${q.icon} ${q.name}`).join(', ')}. Выбирай любую!`;
  },
  start(host) {
    let track = TRACK_BY_ID[host.info && host.info.track] || null; // трасса: выбирают после «Начать!» (или задана заранее)
    const center = (u) => (track || TRACKS[1]).c(u);
    const halfW = () => (track || TRACKS[1]).half;
    let dist = 0, // сколько проехали (пиксели экрана)
      spawn = 0.4,
      slow = 1,
      vx = 0, // скорость круга поперёк трубы (доля ширины в секунду): руль меняет её плавно; и для наклона
      bounce = 0, // > 0 — круг отплывает от бортика после удара, руль не слушается
      cPrev = null, // середина трубы в прошлом шаге
      splash = 0, // > 0 — брызги от бортика
      end = 0; // > 0 — финиш: плюх в бассейн
    const items = []; // { kind, d (пиксели от старта), off (−1..1 поперёк трубы), hit }
    const drops = [];
    let run; // общий ход (runner.js): канва, полоса, счёт
    const U = (d) => d / Math.max(300, run.cv.h); // расстояние в «экранах»

    // шаг: время и руль (куда едем) уже сдвинул runner.js
    function update(dt, r) {
      const { cv, pops, PX, LW, t } = r,
        ring = r.pos;
      if (end > 0) {
        end += dt;
        if (end > 1.3) finish(r);
        return;
      }
      const v = cv.h * (0.5 + Math.min(t / TIME, 1) * 0.25 + r.level * 0.02) * slow * track.speed;
      dist += v * dt;
      // круг едет к пальцу; на повороте вода сносит его наружу — надо рулить внутрь
      const u = U(dist),
        c = center(u),
        curve = (center(u + 0.04) - 2 * c + center(u - 0.04)) / 0.0016; // кривизна трубы (куда она загибает)
      // как быстро сейчас сдвигается сама труба (её стенка «наезжает» на круг на повороте)
      const cv0 = cPrev == null ? 0 : (c - cPrev) / Math.max(dt, 0.001);
      cPrev = c;
      // руль с инерцией: круг не прыгает к пальцу, а набирает скорость поперёк трубы постепенно (и чуть
      // проскакивает) — рулить надо заранее. После удара о бортик руль на миг не слушается: круг отплывает сам.
      if (bounce > 0) {
        bounce -= dt;
        vx += (cv0 - vx) * Math.min(1, dt * 2.5); // отплывает от бортика и успокаивается
      } else {
        // палец за бортиком — круг прижимается к бортику тихо (цель — чуть за стенкой, а не за краем экрана)
        const lim = halfW() - 0.035,
          to = clamp(ring.to, c - lim - 0.03, c + lim + 0.03),
          dir = Math.sign(to - ring.x),
          near = lim - (ring.x - c) * dir; // сколько осталось до бортика, к которому рулим
        // у самого бортика руль толкает едва-едва: прижаться можно, «плюх» — только с разгона (или на повороте)
        const want = clamp((to - ring.x) * STEER.k, -STEER.max, STEER.max) * (near < 0.1 ? 0.1 : 1);
        vx += (want - vx) * Math.min(1, dt * STEER.grip);
      }
      ring.x += (vx - clamp(curve, -3, 3) * 0.02) * dt; // на повороте вода сносит наружу
      slow = Math.min(1, slow + dt * (slow < 0.5 ? 0.45 : 0.7)); // после удара разгоняется плавно
      if (splash > 0) splash -= dt;
      const ry = r.Y(),
        s = r.S();
      // бортик: на скорости — «плюх!», брызги, круг почти останавливается, мягко отплывает к середине и снова
      // разгоняется; тихонько коснулся — просто скользит вдоль бортика (без колошматинья туда-сюда)
      const lim = halfW() - 0.035;
      if (Math.abs(ring.x - c) > lim) {
        const side = Math.sign(ring.x - c),
          hit = (vx - cv0) * side; // с какой скоростью круг наезжает на бортик
        ring.x = c + side * lim;
        if (hit > BUMP_SPEED && splash <= 0) {
          r.bumps++;
          splash = 0.7;
          slow = 0.15;
          bounce = 0.5;
          vx = cv0 - side * 0.3;
          host.sfx('splash');
          pops.add('Плюх!', PX(ring.x), ry - 60 * s, '#1c7ed6');
          for (let i = 0; i < 10; i++)
            drops.push({ x: PX(ring.x), y: ry, vx: (Math.random() - 0.5) * 200, vy: -Math.random() * 180, t: 0 });
        } else if (hit > 0) {
          vx = cv0 - side * Math.min(0.12, hit * 0.4); // мягко: отталкивает чуть-чуть
          slow = Math.min(slow, 0.85);
        }
      }
      // пузыри и звёздочки впереди — внутри трубы
      spawn -= dt;
      if (spawn <= 0) {
        spawn = 0.42 + Math.random() * 0.25;
        const kind = Math.random() < 0.22 ? 'star' : 'bubble';
        items.push({ kind, d: dist + cv.h * 0.95, off: (Math.random() * 2 - 1) * 0.75, hit: false });
      }
      for (const q of items) {
        if (q.hit) continue;
        const qy = ry - (q.d - dist),
          qx = (center(U(q.d)) + q.off * halfW() * 0.8 - ring.x) * LW();
        const rad = (KINDS[q.kind].r + 22) * s;
        if (qx * qx + (qy - ry) * (qy - ry) > rad * rad) continue;
        q.hit = true;
        r.got += KINDS[q.kind].pts;
        host.sfx(q.kind === 'star' ? 'magic' : 'pop');
        pops.add('+' + KINDS[q.kind].pts, PX(ring.x), qy - 30, q.kind === 'star' ? '#f59f00' : '#1c7ed6');
      }
      for (let i = items.length - 1; i >= 0; i--) if (ry - (items[i].d - dist) > cv.h + 40) items.splice(i, 1);
      pops.step(dt);
      for (const p of drops) {
        p.t += dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 380 * dt;
      }
      for (let i = drops.length - 1; i >= 0; i--) if (drops[i].t > 0.8) drops.splice(i, 1);
      if (t >= TIME) {
        end = 0.001;
        host.sfx('splash');
        for (let i = 0; i < 24; i++)
          drops.push({ x: PX(ring.x), y: ry, vx: (Math.random() - 0.5) * 320, vy: -Math.random() * 300, t: 0 });
      }
    }

    function draw(r) {
      const { cv, ctx, PX, t } = r,
        ring = r.pos,
        W = cv.w,
        H = cv.h,
        s = r.S(),
        ry = r.Y(),
        HALF = halfW(),
        tr = track || TRACKS[1];
      // палуба у бассейна: плитка бежит навстречу, по краям — пальмы и шезлонги
      ctx.fillStyle = '#fff4e6';
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(214,180,140,.35)';
      ctx.lineWidth = 2;
      const tile = 46 * s,
        off = dist % tile;
      ctx.beginPath();
      for (let y = off - tile; y < H; y += tile) {
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
      }
      for (let x = 0; x < W; x += tile) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
      }
      ctx.stroke();
      const x0 = r.X0(),
        lw = r.LW();
      for (let i = 0; i < 6; i++) {
        const y = ((i * (H / 5) + dist * 0.9) % (H + 160)) - 80;
        for (const px of [x0 - 30 * s, x0 + lw + 30 * s]) {
          ell(ctx, px + 6, y + 6, 30 * s, 26 * s, 'rgba(60,40,30,.12)');
          for (let k = 0; k < 6; k++) {
            const a = (k * Math.PI) / 3 + i;
            ell(
              ctx,
              px + Math.cos(a) * 18 * s,
              y + Math.sin(a) * 18 * s,
              18 * s,
              7 * s,
              k % 2 ? '#40c057' : '#2f9e44',
              OUT,
              1.2,
              a,
            );
          }
          ell(ctx, px, y, 6 * s, 6 * s, '#8d5524', OUT, 1.2);
        }
      }
      // труба: бортик и вода — одним многоугольником на экран
      const edge = (side, w) => {
        const pts = [];
        for (let y = -20; y <= H + 20; y += 10) {
          const u = U(dist + (ry - y));
          pts.push([PX(center(u) + side * w), y]);
        }
        return pts;
      };
      const band = (w, fill, stroke) => {
        const L = edge(-1, w),
          R = edge(1, w);
        ctx.beginPath();
        L.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        for (let i = R.length - 1; i >= 0; i--) ctx.lineTo(R[i][0], R[i][1]);
        ctx.closePath();
        ctx.fillStyle = fill;
        ctx.fill();
        if (stroke) {
          ctx.strokeStyle = stroke;
          ctx.lineWidth = 2.5;
          ctx.stroke();
        }
      };
      band(HALF + 0.035, tr.rim, OUT);
      band(HALF, tr.water, null);
      band(HALF * 0.55, 'rgba(165,216,255,.6)', null);
      // струйки воды бегут вниз
      ctx.strokeStyle = 'rgba(255,255,255,.75)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let k = -1; k <= 1; k += 2)
        for (let y = -40 + ((dist * 1.4) % 60); y < H + 20; y += 60) {
          const u = U(dist + (ry - y)),
            x = PX(center(u) + k * HALF * 0.5);
          ctx.moveTo(x, y);
          ctx.lineTo(PX(center(U(dist + (ry - y - 18))) + k * HALF * 0.5), y + 18);
        }
      ctx.stroke();
      // полоски на бортике
      ctx.fillStyle = '#ff922b';
      for (let y = -20 + ((dist * 1) % 50); y < H + 20; y += 50) {
        const c = center(U(dist + (ry - y)));
        for (const k of [-1, 1]) ell(ctx, PX(c + k * (HALF + 0.018)), y, 5 * s, 8 * s, '#ff922b');
      }
      // финиш: бассейн внизу экрана
      if (end > 0) {
        ctx.globalAlpha = Math.min(1, end * 2);
        fillRR(ctx, 0, ry - 30, W, H, 0, '#4dabf7');
        ctx.globalAlpha = 1;
      }
      // пузыри и звёздочки
      for (const q of items) {
        if (q.hit) continue;
        const y = ry - (q.d - dist),
          x = PX(center(U(q.d)) + q.off * HALF * 0.8);
        if (q.kind === 'star') drawStar(ctx, x, y, s, t);
        else drawBubble(ctx, x, y, s, t);
      }
      // хомячок на круге: наклоняется в сторону поворота
      const x = PX(ring.x),
        tilt = clamp(vx * 0.9, -0.5, 0.5);
      drawRing(ctx, x, ry, s, tilt);
      ctx.save();
      ctx.translate(x, ry);
      ctx.rotate(tilt);
      host.drawHamster(ctx, 0, 2 * s, 0.62 * s, host.look, {
        time: t,
        clipBelow: -18,
        happy: splash <= 0,
        armsUp: end > 0 || Math.abs(tilt) > 0.3,
        blink: t % 3.1 < 0.12,
      });
      ctx.restore();
      for (const p of drops) {
        ctx.globalAlpha = 1 - p.t / 0.8;
        ell(ctx, p.x, p.y, 5, 6, '#a5d8ff', '#4dabf7', 1);
      }
      ctx.globalAlpha = 1;
      r.pops.draw(ctx);
    }

    function finish(r) {
      const { got, bumps } = r,
        stars = r.stars(SLIDE_STARS);
      r.finish({
        stars,
        text: `${track.icon} «${track.name}» — плюх, и в бассейн! На счету ${got} 🫧 — пузыри и звёздочки${bumps ? `, задел{|а} бортик ${bumps} ${plural(bumps, 'раз', 'раза', 'раз')}.` : ', и ни разу не задел{|а} бортик!'}${stars === 3 ? ' {Король|Королева} водной горки!' : ''}`,
        extra: { got, bumps, track: track.id },
      });
    }

    run = runnerGame(host, {
      p: 'sd',
      id: 'slide', // автотест (dev/smoke_hotel.js, dev/smoke_games.js): canvas.__slide(), canvas.__slideSkip(сек)
      time: TIME,
      lim: [0.05, 0.95],
      keySpeed: 1.1,
      icons: ['🫧', '💦'],
      pick: {
        title: 'Какую горку выберешь?',
        attr: 'track',
        preset: track,
        sfx: 'splash',
        cards: TRACKS.map((q) => ({ id: q.id, name: `${q.icon} ${q.name}`, say: q.say, img: () => trackPic(q) })),
        on: (id) => (track = TRACK_BY_ID[id]),
      },
      update,
      draw,
      debug: (r) => ({
        tube: center(U(dist)),
        slow,
        vx,
        bumps: r.bumps,
        track: track ? track.id : null,
        half: halfW(),
        items: items
          .filter((q) => !q.hit)
          .map((q) => ({ kind: q.kind, x: center(U(q.d)) + q.off * halfW() * 0.8, y: r.Y() - (q.d - dist) })),
      }),
    });
  },
};
