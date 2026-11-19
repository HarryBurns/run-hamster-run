// Мини-игра «Пляжный волейбол» (отдых в городе, этап 17а; запускает сетка на городском пляже — features/relax.js).
// Слева — хомячок и друг-житель, справа — пара жителей. Мяч летит медленно и всегда по дуге: где он опустится на
// нашей стороне, видно кружок на песке. Беги под мяч (нажми или проведи пальцем, мышкой, стрелками) и нажми, когда
// он рядом над головой (пробел или Enter — тоже нажатие) — хомячок подпрыгнет и отобьёт через сетку.
// Друг стоит у сетки и берёт мячи, которые падают в его зону; чем больше у него сердечек дружбы (info.team.mate.hearts),
// тем шире его зона и тем чаще он сразу перебрасывает мяч на ту сторону (иначе — пасует хомячку). Соперники
// отбивают не всегда, и чем дольше розыгрыш — тем чаще промахиваются; если они далеко впереди, промахиваются чаще.
// Матч до VOLLEY.points очков. Проигрыша «в ноль» нет: звёзды — по счёту (data/relax.js, VOLLEY.stars), за участие —
// хотя бы одна. Монеты по звёздам выдаёт занятие (features/relax.js).
import { el, clamp } from '../core/util.js';
import { ell, fillRR, line, poly } from '../core/draw.js';
import { pic as kitPic } from './kit.js';
import { VOLLEY } from '../data/relax.js';
import { DEV } from '../core/dev.js';

const OUT = '#4a3728';
// мир игры — 800 × 450 единиц: сетка посередине, песок внизу
const W = 800,
  H = 450,
  G = 392, // песок (ноги игроков)
  NET = 400,
  NET_TOP = 250,
  NET_LOW = 312,
  GRAV = 250,
  HIT_Y = 292, // на этой высоте мяч обычно отбивают
  BALL_R = 15,
  REACH = 62, // насколько далеко вбок хомячок достаёт мяч
  SWING = 0.55, // сколько секунд после нажатия хомячок «готов отбить»
  SPEED = 340; // скорость хомячка, единиц в секунду
/** Звёзды по счёту: us — наши очки, them — соперников. */
export function volleyStars(us, them, rule = VOLLEY) {
  if (us > them) return them <= rule.stars.threeLost ? 3 : 2;
  return us >= rule.stars.two ? 2 : 1;
}
/** Насколько друг помогает: ширина его зоны у сетки и вероятность сразу перебросить мяч (hearts — 0..5). */
export function mateSkill(hearts, rule = VOLLEY) {
  const h = clamp(hearts || 0, 0, 5);
  return { zone: rule.mateZone + h * rule.mateZoneHeart, over: Math.min(0.92, rule.mateOver + h * rule.mateOverHeart) };
}

/** Маленькая картинка для правил (data: URL). */
const pic = (draw, w = 96, h = 56) => kitPic(draw, w, h, { cap: true });
function ball(ctx, x, y, r, rot = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ell(ctx, 0, 0, r, r, '#fff', OUT, 2);
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, r - 1, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = '#ffd43b';
  ctx.beginPath();
  ctx.ellipse(-r * 0.55, 0, r * 0.5, r * 1.1, 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#4dabf7';
  ctx.beginPath();
  ctx.ellipse(r * 0.55, -r * 0.1, r * 0.45, r * 1.1, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ell(ctx, 0, 0, r, r, null, OUT, 2);
  ell(ctx, -r * 0.35, -r * 0.4, r * 0.28, r * 0.18, 'rgba(255,255,255,.7)');
  ctx.restore();
}
function net(ctx) {
  for (const x of [NET - 3, NET + 3]) fillRR(ctx, x - 3, NET_TOP - 14, 6, G - NET_TOP + 16, 2, '#fff', OUT, 1.6);
  ctx.fillStyle = 'rgba(255,255,255,.35)';
  ctx.fillRect(NET - 40, NET_TOP, 80, NET_LOW - NET_TOP);
  ctx.strokeStyle = 'rgba(74,55,40,.45)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = NET - 38; x <= NET + 38; x += 7) {
    ctx.moveTo(x, NET_TOP);
    ctx.lineTo(x, NET_LOW);
  }
  for (let y = NET_TOP + 6; y < NET_LOW; y += 7) {
    ctx.moveTo(NET - 40, y);
    ctx.lineTo(NET + 40, y);
  }
  ctx.stroke();
  line(ctx, NET - 42, NET_TOP, NET + 42, NET_TOP, '#fa5252', 4);
  line(ctx, NET - 42, NET_LOW, NET + 42, NET_LOW, '#fff', 2.5);
}

const CSS = `
.vb-rules{display:flex;gap:6px;justify-content:center;flex-wrap:wrap;margin:6px 0 2px}
.vb-col{background:#fff;border-radius:14px;padding:3px 6px;border:3px solid #ffd43b;text-align:center;max-width:112px}
.vb-col.blue{border-color:#74c0fc}
.vb-col.pink{border-color:#ff8fab}
.vb-col b{display:block;font-size:14px}
.vb-col small{display:block;font-size:12px;opacity:.75;line-height:1.2}
.vb-top{position:absolute;left:0;right:0;top:0;display:flex;gap:6px;justify-content:center;flex-wrap:wrap;padding:8px;pointer-events:none;z-index:2}
.vb-chip{background:rgba(255,255,255,.92);border-radius:12px;padding:4px 10px;font-weight:900;font-size:15px;box-shadow:0 2px 0 rgba(74,55,40,.15)}
`;

export default {
  id: 'volley',
  title: 'Пляжный волейбол',
  icon: '🏐',
  css: CSS,
  get howTo() {
    return howTo();
  },
  start(host) {
    return start(host);
  },
};

/** Правила на заставке. С кем играешь и сколько у друга сердечек — пишет занятие (features/relax.js, volleyTeamNote). */
function howTo() {
  return `Перекинь мяч через сетку — пусть он упадёт на той стороне!
    <div class="vb-rules">
      <div class="vb-col"><b>1 · Беги</b>${pic((c, w, h) => {
        c.fillStyle = '#ffe9a8';
        c.fillRect(0, h - 16, w, 16);
        c.strokeStyle = '#ff922b';
        c.setLineDash([4, 3]);
        c.lineWidth = 2;
        c.beginPath();
        c.ellipse(w * 0.65, h - 10, 16, 5, 0, 0, Math.PI * 2);
        c.stroke();
        c.setLineDash([]);
        ball(c, w * 0.62, 18, 9);
        c.font = '18px sans-serif';
        c.fillText('👆', w * 0.2, h - 22);
      })}<small>нажми на кружок — мяч летит туда</small></div>
      <div class="vb-col blue"><b>2 · Отбей!</b>${pic((c, w, h) => {
        ball(c, w / 2, 20, 10);
        line(c, w / 2 - 14, 46, w / 2 - 6, 34, OUT, 3);
        line(c, w / 2 + 14, 46, w / 2 + 6, 34, OUT, 3);
        c.font = '18px sans-serif';
        c.fillText('👆', w / 2 + 16, h - 6);
      })}<small>мяч над головой — нажми ещё раз</small></div>
      <div class="vb-col pink"><b>3 · Друг</b>${pic((c, w, h) => {
        c.fillStyle = 'rgba(255,143,171,.35)';
        c.fillRect(w * 0.5, h - 22, w * 0.42, 22);
        c.fillStyle = '#fff';
        c.fillRect(w * 0.92, 14, 4, h - 14);
        c.font = '16px sans-serif';
        c.fillText('❤️', w * 0.62, h - 30);
      })}<small>у сетки мяч берёт друг</small></div>
    </div>
    Матч до ${VOLLEY.points} очков. Мяч летит медленно — успеешь! 🏐`;
}

function start(host) {
  const top = el('div', 'vb-top');
  const tScore = el('div', 'vb-chip'),
    tSay = el('div', 'vb-chip');
  top.append(tScore, tSay);
  host.root.append(top);
  const cv = host.canvas();
  const ctx = cv.ctx;
  const info = host.info || {};
  const team = info.team || {
    mate: { ...(host.friends[0] || { name: 'Друг', look: host.look }), hearts: 0 },
    rivals: host.friends.slice(1, 3),
  };
  const mate = team.mate,
    rivals = (team.rivals && team.rivals.length ? team.rivals : host.friends.slice(1, 3)).slice(0, 2);
  const sk = mateSkill(mate.hearts);
  const zone0 = NET - 16 - sk.zone; // зона друга: от zone0 до сетки

  let t = 0,
    over = false,
    phase = 'serve', // serve → fly → point → serve …
    phaseT = 0,
    us = 0,
    them = 0,
    rally = 0,
    server = 'us', // кто подаёт: кто выиграл последнее очко
    say = '',
    sayT = 0,
    hits = 0, // сколько раз отбила сама
    autoServe = 0,
    bot = false; // автотест: играет сама
  // герои: x — где стоит, tx — куда бежит, jump — прыжок 0..1, happy — радуется
  const me = { x: 200, tx: 200, jump: 0, swing: 0, happy: 0, dir: 1, walk: 0 };
  const pal = { x: NET - 70, tx: NET - 70, jump: 0, happy: 0, dir: 1, walk: 0 };
  const foes = [
    { x: NET + 90, tx: NET + 90, home: NET + 90, jump: 0, happy: 0, dir: -1, walk: 0, f: rivals[0] },
    { x: NET + 260, tx: NET + 260, home: NET + 260, jump: 0, happy: 0, dir: -1, walk: 0, f: rivals[1] || rivals[0] },
  ];
  // мяч: летит по дуге из (x0, y0) — к точке (tx, HIT_Y) на одной из сторон; who — кто его возьмёт
  const b = { x: 200, y: 230, vx: 0, vy: 0, rot: 0, tx: 0, who: null, will: true, side: 'us', held: true };
  const puffs = [];

  const K = () => Math.min(cv.w / W, (cv.h - 34) / H);
  const OX = () => (cv.w - W * K()) / 2;
  const OY = () => Math.max(34, cv.h - H * K() - Math.max(0, (cv.h - H * K() - 34) * 0.35));
  const toGame = (sx, sy) => ({ x: (sx - OX()) / K(), y: (sy - OY()) / K() });

  function shout(text, s = 1.4) {
    say = text;
    sayT = s;
  }
  function chips() {
    tScore.textContent = `🐹 Ты и ${mate.name.split(' ').pop()}  ${us} : ${them}  ${rivals.map((r) => r.name.split(' ').pop()).join(' и ')}`;
    tSay.textContent =
      say ||
      (phase === 'serve' && server === 'us'
        ? '👆 Нажми — подача!'
        : phase === 'fly' && b.side === 'us' && b.who === me
          ? '🏐 Беги под мяч и нажми!'
          : `🏐 До ${VOLLEY.points} очков`);
  }
  /** Запустить мяч из (x, y) к точке tx на высоте HIT_Y за время tf. */
  function launch(x, y, tx, tf) {
    b.x = x;
    b.y = y;
    b.tx = tx;
    b.held = false;
    // над сеткой — с запасом: если низко, летим дольше (выше)
    for (let i = 0; i < 6; i++) {
      b.vx = (tx - x) / tf;
      b.vy = (HIT_Y - y - 0.5 * GRAV * tf * tf) / tf;
      const tn = (NET - x) / b.vx;
      if (!(tn > 0 && tn < tf) || y + b.vy * tn + 0.5 * GRAV * tn * tn < NET_TOP - 30) break;
      tf += 0.2;
    }
    b.side = tx < NET ? 'us' : 'them';
    b.who = null;
    phase = 'fly';
    phaseT = 0;
  }
  /** Мяч летит на нашу сторону: кто его возьмёт — друг (в своей зоне у сетки) или хомячок. */
  function toUs(x, y, tf = 2.1) {
    let tx = 70 + Math.random() * 300;
    launch(x, y, tx, tf);
    b.who = tx > zone0 ? pal : me;
    if (b.who === pal) pal.tx = clamp(tx, zone0 + 10, NET - 30);
    else if (bot) me.tx = tx;
  }
  /** Мяч летит к соперникам: кто ближе — бежит, отобьёт ли — решено заранее (жребий). */
  function toThem(x, y, tf = 1.9) {
    const tx = NET + 60 + Math.random() * 300;
    launch(x, y, tx, tf);
    const f = Math.abs(foes[0].home - tx) < Math.abs(foes[1].home - tx) ? foes[0] : foes[1];
    b.who = f;
    f.tx = tx;
    let p = VOLLEY.rivalHit - VOLLEY.rally * Math.max(0, rally - 1);
    if (them - us >= 2) p -= VOLLEY.lead;
    if (us === 0 && them >= 3) p = 0; // в ноль не проигрывают
    b.will = Math.random() < clamp(p, 0.2, 0.9);
  }
  function serve() {
    rally = 0;
    phase = 'serve';
    phaseT = 0;
    b.held = true;
    if (server === 'us') {
      me.tx = me.x = 120;
      b.who = me;
      autoServe = 0;
    } else b.who = foes[1];
  }
  function point(ours) {
    phase = 'point';
    phaseT = 0;
    b.vx *= 0.3;
    if (ours) {
      us++;
      server = 'us';
      me.happy = pal.happy = 1.4;
      host.sfx('ok');
      shout(['🎉 Очко!', '✨ Есть!', '🏐 Наше очко!'][us % 3]);
    } else {
      them++;
      server = 'them';
      for (const f of foes) f.happy = 1.4;
      host.sfx('thud');
      shout(['🙂 Ничего, следующий наш!', '🙂 Упал — не беда!', '🙂 Мимо! Ещё отобьём'][them % 3]);
    }
  }
  function tap(gx) {
    if (over) return;
    if (gx !== undefined) me.tx = clamp(gx, 40, NET - 34);
    if (phase === 'serve' && server === 'us' && phaseT > 0.4) {
      // подача: хомячок подбрасывает мяч и бьёт через сетку
      me.jump = 1;
      me.swing = 0;
      host.sfx('pop');
      rally = 1;
      toThem(me.x + 10, G - 110, 2.1);
      return;
    }
    me.swing = SWING;
  }
  function finish() {
    over = true;
    const stars = volleyStars(us, them);
    const short = mate.name.split(' ').pop(),
      glad = mate.fem ? 'рада' : 'рад';
    const text =
      us > them
        ? `Счёт ${us} : ${them} — победа! ${short} ${glad}: «Вот это команда!» Мячей отбила сама: ${hits}.`
        : `Счёт ${us} : ${them}. Почти получилось! ${short}: «В следующий раз точно выиграем!» Мячей отбила сама: ${hits}.`;
    host.later(() => {
      host.finish({ stars, text, extra: { us, them, hits, mate: mate.id } });
    }, 1300);
  }

  function moveTo(h, dt, sp) {
    const d = h.tx - h.x;
    if (Math.abs(d) > 2) {
      h.x += Math.sign(d) * Math.min(Math.abs(d), sp * dt);
      h.walk += dt * 2.4;
      h.dir = Math.sign(d);
      h.moving = true;
    } else h.moving = false;
  }
  function update(dt) {
    t += dt;
    phaseT += dt;
    if (sayT > 0 && (sayT -= dt) <= 0) say = '';
    for (const h of [me, pal, ...foes]) {
      h.jump = Math.max(0, h.jump - dt * 2.6);
      h.happy = Math.max(0, h.happy - dt);
    }
    me.swing = Math.max(0, me.swing - dt);
    // автотест: бежать под мяч и нажимать, когда он рядом
    if (bot) {
      if (phase === 'serve' && server === 'us' && phaseT > 0.6) tap();
      if (phase === 'fly' && b.who === me && b.side === 'us') {
        me.tx = b.tx;
        if (b.vy > 0 && Math.abs(b.x - me.x) < REACH * 0.8 && b.y > G - 190) tap();
      }
    }
    // клавиши
    if (keys.left) me.tx = clamp(me.x - 60, 40, NET - 34);
    if (keys.right) me.tx = clamp(me.x + 60, 40, NET - 34);
    moveTo(me, dt, SPEED);
    moveTo(pal, dt, 260);
    for (const f of foes) moveTo(f, dt, 280);
    for (const q of puffs) q.t += dt;
    for (let i = puffs.length - 1; i >= 0; i--) if (puffs[i].t > 0.6) puffs.splice(i, 1);

    if (phase === 'serve') {
      b.x = server === 'us' ? me.x + 14 : foes[1].x - 14;
      b.y = G - 100 + Math.sin(t * 5) * 4;
      if (server === 'us') {
        autoServe += dt;
        if (autoServe > 5) tap(); // задумалась — подаст сама
      } else if (phaseT > 1.3) {
        foes[1].jump = 1;
        host.sfx('pop');
        rally = 1;
        toUs(foes[1].x - 10, G - 110, 2.3);
      }
      return;
    }
    if (phase === 'point') {
      if (b.y < G - BALL_R) {
        b.vy += GRAV * dt;
        b.y = Math.min(G - BALL_R, b.y + b.vy * dt);
      }
      b.x += b.vx * dt;
      if (phaseT > 1.5) {
        if (us >= VOLLEY.points || them >= VOLLEY.points) {
          if (!over) finish();
          return;
        }
        serve();
      }
      return;
    }
    // мяч летит
    b.vy += GRAV * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.rot += b.vx * dt * 0.03;
    const down = b.vy > 0;
    if (b.side === 'us') {
      if (b.who === pal && down && b.y >= HIT_Y - 6) {
        // друг: сразу через сетку или пас хомячку
        pal.jump = 1;
        host.sfx('pop');
        rally++;
        if (Math.random() < sk.over) {
          shout(`💪 ${mate.name.split(' ').pop()}!`, 1);
          toThem(b.x, b.y, 1.7);
        } else {
          const tx = 80 + Math.random() * Math.max(60, zone0 - 120);
          launch(b.x, b.y, tx, 1.5);
          b.who = me;
          if (bot) me.tx = tx;
          shout('🙌 Пас тебе!', 1);
        }
        return;
      }
      if (b.who === me && down && me.swing > 0 && Math.abs(b.x - me.x) < REACH && b.y > G - 200 && b.y < G - 40) {
        me.jump = 1;
        me.swing = 0;
        me.happy = 0.6;
        hits++;
        rally++;
        host.sfx('pop');
        toThem(b.x, b.y, 1.9);
        return;
      }
    } else if (down && b.y >= HIT_Y - 6 && b.will && b.who) {
      const f = b.who;
      f.jump = 1;
      host.sfx('pop');
      rally++;
      f.tx = f.home;
      toUs(b.x, b.y, 2.2);
      return;
    } else if (down && b.y >= HIT_Y && !b.will && b.who) {
      // соперник тянется — и не достаёт
      b.who.jump = Math.max(b.who.jump, 0.5);
      b.who = null;
    }
    if (b.y >= G - BALL_R) {
      b.y = G - BALL_R;
      b.vy = -b.vy * 0.25;
      puffs.push({ x: b.x, t: 0 });
      point(b.x > NET);
      for (const f of foes) f.tx = f.home;
      pal.tx = NET - 70;
    }
  }

  // ---------- рисунок ----------
  function hamster(h, look, s, small, flip) {
    const jy = Math.sin(h.jump * Math.PI) * 34;
    host.drawHamster(ctx, h.x, G - jy, s * (small ? 0.84 : 1), look, {
      time: t,
      dir: h.moving ? h.dir : flip,
      walk: h.moving && !h.jump ? h.walk : null,
      armsUp: h.jump > 0.2 || h.happy > 0.5,
      happy: h.happy > 0,
      blink: Math.sin(t * 1.3 + h.x) > 0.97 ? 1 : 0,
    });
  }
  function drawScene() {
    const k = K(),
      ox = OX(),
      oy = OY();
    ctx.setTransform(cv.dpr, 0, 0, cv.dpr, 0, 0);
    // небо, море и песок — на весь экран
    const sea = oy + 200 * k;
    const sky = ctx.createLinearGradient(0, 0, 0, sea);
    sky.addColorStop(0, '#8fd3ff');
    sky.addColorStop(1, '#d6f1ff');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, cv.w, sea);
    ctx.fillStyle = '#4dabf7';
    ctx.fillRect(0, sea, cv.w, 70 * k);
    ctx.fillStyle = '#a5e1ff';
    for (let i = 0; i < 9; i++) {
      const x = ((i * 137 + t * 14) % (cv.w + 80)) - 40;
      ctx.fillRect(x, sea + (12 + (i % 3) * 18) * k, 34 * k, 3 * k);
    }
    ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(0, sea + 66 * k, cv.w, cv.h);
    ctx.fillStyle = '#fff3c4';
    ctx.fillRect(0, sea + 66 * k, cv.w, 8 * k);
    ctx.fillStyle = 'rgba(214,170,90,.35)';
    for (let i = 0; i < 40; i++) ctx.fillRect((i * 97) % cv.w, sea + 90 * k + ((i * 53) % 400) * k, 3, 2);
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(k, k);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    // солнце и облака
    ell(ctx, 690, 60, 30, 30, '#ffe066', '#fab005', 2);
    for (const [x, y, s] of [
      [130, 70, 1],
      [470, 45, 0.8],
    ]) {
      const cx = ((x + t * 6) % (W + 160)) - 60;
      ell(ctx, cx, y, 34 * s, 14 * s, '#fff');
      ell(ctx, cx + 20 * s, y - 8 * s, 20 * s, 14 * s, '#fff');
    }
    // площадка: линии, зона друга, кружок «мяч упадёт здесь»
    line(ctx, 20, G + 8, W - 20, G + 8, 'rgba(255,255,255,.85)', 3);
    ctx.fillStyle = 'rgba(255,143,171,.22)';
    ctx.fillRect(zone0, G - 2, NET - zone0, 16);
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(mate.hearts ? '❤️'.repeat(Math.min(5, mate.hearts)) : '🤍', (zone0 + NET) / 2, G + 30);
    if (phase === 'fly' && b.side === 'us' && b.who === me) {
      ctx.save();
      ctx.setLineDash([7, 5]);
      ell(ctx, b.tx, G + 4, 30, 8, 'rgba(255,146,43,.18)', '#ff922b', 3);
      ctx.restore();
    }
    // тень мяча
    const hgt = clamp((G - b.y) / 300, 0, 1);
    ell(ctx, b.x, G + 4, BALL_R * (1.2 - hgt * 0.6), 4, 'rgba(120,80,30,.25)');
    // игроки (дальние — соперники; наш друг у сетки)
    for (const f of foes) hamster(f, f.f.look, 0.95, f.f.small, -1);
    hamster(pal, mate.look, 0.95, mate.small, 1);
    hamster(me, host.look, 1, false, 1);
    net(ctx);
    // подписи над головами
    ctx.font = '900 13px ui-rounded, "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    const tag = (h, text, col) => {
      const jy = Math.sin(h.jump * Math.PI) * 34,
        w = ctx.measureText(text).width + 14;
      fillRR(ctx, h.x - w / 2, G - jy - 124, w, 18, 8, col, OUT, 1.5);
      ctx.fillStyle = OUT;
      ctx.fillText(text, h.x, G - jy - 111);
    };
    tag(me, host.name || 'Я', '#fff3bf');
    tag(pal, `${mate.name.split(' ').pop()} ${mate.hearts ? '❤' + mate.hearts : ''}`.trim(), '#ffdeeb');
    for (const f of foes) tag(f, f.f.name.split(' ').pop(), '#d0ebff');
    // песок из-под мяча
    for (const q of puffs) {
      ctx.globalAlpha = 1 - q.t / 0.6;
      for (let i = 0; i < 5; i++)
        ell(ctx, q.x + (i - 2) * 9 * (1 + q.t * 2), G - q.t * 30 - (i % 2) * 6, 4, 3, '#f2d48a');
      ctx.globalAlpha = 1;
    }
    ball(ctx, b.x, b.y, BALL_R, b.rot);
    // хомячок готов отбить — искорка над головой
    if (me.swing > 0 && phase === 'fly')
      poly(ctx, [me.x - 6, G - 108, me.x, G - 122, me.x + 6, G - 108], '#ffd43b', OUT, 1.4);
    ctx.restore();
  }
  host.loop((dt) => {
    if (!over || phase === 'point') update(dt);
    drawScene();
    chips();
  });
  serve();

  // ввод: нажатие — бежать туда и отбить; провести пальцем — бежать за пальцем
  let held = false;
  const at = (e) => {
    const r = cv.canvas.getBoundingClientRect();
    return toGame(e.clientX - r.left, e.clientY - r.top);
  };
  const pd = (e) => {
    e.preventDefault();
    held = true;
    try {
      cv.canvas.setPointerCapture(e.pointerId);
    } catch (er) {
      /* нет захвата — не страшно */
    }
    tap(at(e).x);
  };
  const pm = (e) => {
    if (held) me.tx = clamp(at(e).x, 40, NET - 34);
  };
  const pu = () => (held = false);
  host.on(cv.canvas, 'pointerdown', pd);
  host.on(cv.canvas, 'pointermove', pm);
  host.on(cv.canvas, 'pointerup', pu);
  host.on(cv.canvas, 'pointercancel', pu);
  const keys = { left: false, right: false };
  const key = (e) => {
    const dn = e.type === 'keydown';
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = dn;
    else if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = dn;
    else if (dn && (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowUp')) {
      e.preventDefault();
      tap();
    } else return;
    e.preventDefault();
  };
  host.on(window, 'keydown', key);
  host.on(window, 'keyup', key);
  // для автотеста: что сейчас в игре; __volleyBot(true) — играет сама
  if (DEV)
    cv.canvas.__volley = () => ({
      phase,
      us,
      them,
      rally,
      hits,
      over,
      server,
      me: me.x,
      zone: NET - zone0,
      over2: sk.over,
      ball: {
        x: b.x,
        y: b.y,
        side: b.side,
        who: b.who === me ? 'me' : b.who === pal ? 'mate' : b.who ? 'rival' : null,
        tx: b.tx,
      },
    });
  if (DEV) cv.canvas.__volleyBot = (on = true) => (bot = !!on);
  /** Точка игры (единицы мира 800 × 450) → CSS-пиксели канвы: куда нажимать автотесту. */
  if (DEV) cv.canvas.__volleyScreen = (x, y) => ({ x: OX() + x * K(), y: OY() + y * K() });
  cv.canvas.classList.add('vb-canvas');
}
