// Мини-игра «Спасатель» (этап 17в) — работа на городском пляже, вышка у моря (спасатель Волна зовёт на смену).
// В море плавают жители. Время от времени кому-то нужна помощь — всё мягко и не страшно: «Устал плыть!» — нажми
// на него, и с вышки летит спасательный круг: держится за круг, его подтягивают к берегу, он отдыхает на песке;
// «Уронил мячик!» / «Уплыла уточка!» — вещь уносит волной: нажми на неё — хомячок-спасатель доплывёт, поймает
// и вернёт хозяину. Не успела — поможет спасатель Волна (без наказания, просто меньше звёзд). Нажала на того, кто
// плавает спокойно, — он помашет: «Всё хорошо!». CALLS просьб за смену; звёзды — по тому, скольким помогла сама.
// Dev-хуки на канве: __guard() — что сейчас, __guardHelp() — помочь первому, кто просит.
import { el, clamp, pick, shuffle } from '../core/util.js';
import { ell, fillRR, line, poly, heart } from '../core/draw.js';
import { CLOTHES_BY_ID } from '../data/index.js';
import { DEV } from '../core/dev.js';

export const CALLS = 8;
const STARS = [5, 7]; // помогла сама ⭐⭐ / ⭐⭐⭐
const W = 400,
  H = 300,
  SHORE = 236, // где начинается песок
  TOWER = [58, 214]; // площадка вышки (здесь стоит хомячок)
const OUT = '#4a3728';
const KINDS = [
  { id: 'tired', e: '😮‍💨', say: 'Устал плыть!', how: 'ring' },
  { id: 'ball', e: '🏐', say: 'Уронил мячик!', how: 'swim', item: 'ball' },
  { id: 'duck', e: '🦆', say: 'Уплыла уточка!', how: 'swim', item: 'duck' },
  { id: 'tired2', e: '🥱', say: 'Лапки устали!', how: 'ring' },
];
const SLOTS = [
  [150, 96],
  [250, 82],
  [345, 108],
  [205, 150],
  [310, 172],
];

const CSS = `
.lg-top{position:absolute;left:0;right:0;top:0;display:flex;gap:6px;justify-content:center;flex-wrap:wrap;padding:8px;pointer-events:none;z-index:2}
.lg-chip{background:rgba(255,255,255,.92);border-radius:12px;padding:4px 10px;font-weight:900;font-size:15px;box-shadow:0 2px 0 rgba(74,55,40,.15)}
`;

export default {
  id: 'lifeguard',
  title: 'Спасатель',
  icon: '🛟',
  howTo:
    'Ты — спасатель на вышке! Смотри на море: если кто-то устал плыть — <b>нажми на него</b>, и ты бросишь спасательный круг. Уплыл мячик или уточка — <b>нажми на вещь</b>, и ты доплывёшь и вернёшь её. Не волнуйся: если не успеешь, поможет спасатель Волна.',

  start(host) {
    const root = host.root;
    const level = host.level || 0;
    const patience = 8 - Math.min(4, level) * 0.6; // сколько секунд ждёт помощи
    const gap = 3.6 - Math.min(4, level) * 0.3; // как часто просят
    const maxAtOnce = level >= 2 ? 2 : 1;
    const top = el('div', 'lg-top');
    const tCount = el('div', 'lg-chip'),
      tSay = el('div', 'lg-chip');
    top.append(tCount, tSay);
    host.css(CSS);
    root.append(top);
    root.style.background = '#74c0fc';
    const cv = host.canvas();
    cv.canvas.classList.add('lg-canvas');
    const ctx = cv.ctx;
    const me = { ...host.look, outfit: { ...(host.look.outfit || {}), head: CLOTHES_BY_ID.panama_white || null } };
    const friends = shuffle(host.friends && host.friends.length ? host.friends : [{ name: 'Гость', look: host.look }]);
    let fi = 0;
    const nextFriend = () => friends[fi++ % friends.length];

    let t = 0,
      over = false,
      calls = 0, // сколько уже попросили
      helped = 0,
      missed = 0,
      nextCall = 2.2,
      flash = null; // { text, t } — надпись посреди моря
    const swimmers = SLOTS.map(([x, y], i) => ({
      i,
      x,
      y,
      hx: x,
      hy: y,
      ph: i * 1.7,
      f: nextFriend(),
      st: 'swim',
      st0: 0,
      kind: null,
      item: null,
      wave: -9,
    }));
    const rings = []; // летящие круги: { from, to, t0, s }
    // хомячок-спасатель: на вышке, плывёт к вещи, к хозяину, обратно
    const rescuer = { x: TOWER[0], y: TOWER[1], st: 'tower', target: null, carry: null, queue: [] };

    const say = (text) => {
      tSay.textContent = text;
    };
    const upd = () => {
      tCount.textContent = `🛟 Помогла: ${helped} из ${CALLS}`;
    };
    upd();
    say('Смотри на море 👀');

    // --- просьбы
    function newCall() {
      const free = swimmers.filter((s) => s.st === 'swim');
      if (!free.length) return false;
      const s = pick(free),
        k = pick(KINDS);
      s.st = 'call';
      s.st0 = t;
      s.kind = k;
      calls++;
      if (k.item) {
        // вещь уплывает от купальщика в сторону открытого моря
        const dir = s.x > 250 ? -1 : 1;
        s.item = { kind: k.item, x: s.x + dir * 14, y: s.y - 4, vx: dir * 9, vy: -6, s };
      }
      host.sfx('splash');
      return true;
    }
    function help(s, byMe) {
      if (s.st !== 'call') return;
      if (byMe) {
        helped++;
        host.sfx('ok');
      } else {
        missed++;
        flash = { text: '🚤 Спасатель Волна помогла!', t };
      }
      upd();
      if (s.kind.how === 'ring') {
        if (byMe) {
          s.st = 'ringWait';
          rings.push({ fx: TOWER[0] + 10, fy: TOWER[1] - 40, s, t0: t });
        } else {
          s.st = 'pulled';
          s.st0 = t;
        }
      } else if (byMe) {
        s.st = 'waitItem';
        rescuer.queue.push(s);
      } else {
        s.item = null;
        s.st = 'happy';
        s.st0 = t;
      }
      say(byMe ? pick(['Молодец! 💙', 'Спасибо, спасатель!', 'Ура, помогла!']) : 'Ничего страшного — Волна рядом 💙');
    }

    // --- нажатия
    const toWorld = (e) => {
      const r = cv.canvas.getBoundingClientRect(),
        k = view.k;
      return { x: (e.clientX - r.left - view.ox) / k, y: (e.clientY - r.top - view.oy) / k };
    };
    function tap(x, y) {
      if (over) return;
      let best = null,
        bd = 46;
      for (const s of swimmers) {
        const pts = [[s.x, s.y - 12]];
        if (s.item) pts.push([s.item.x, s.item.y]);
        for (const [px, py] of pts) {
          const d = Math.hypot(px - x, py - y);
          if (d < bd) {
            bd = d;
            best = s;
          }
        }
      }
      if (!best) return;
      if (best.st === 'call') help(best, true);
      else if (best.st === 'swim') {
        best.wave = t;
        host.sfx('pop');
        say(`${best.f.name}: «Всё хорошо, я плаваю!» 👋`);
      }
    }
    const down = (e) => {
      e.preventDefault();
      const p = toWorld(e);
      tap(p.x, p.y);
    };
    host.on(cv.canvas, 'pointerdown', down);

    // --- ход времени
    function update(dt) {
      t += dt;
      if (!over && calls < CALLS && t >= nextCall) {
        const active = swimmers.filter((s) => s.st === 'call').length;
        if (active < maxAtOnce && newCall()) nextCall = t + gap + Math.random() * 1.4;
        else nextCall = t + 0.6;
      }
      for (const s of swimmers) {
        s.hx = s.x + Math.sin(t * 0.7 + s.ph) * 6;
        s.hy = s.y + Math.sin(t * 1.9 + s.ph) * 2;
        if (s.st === 'call') {
          if (s.item) {
            s.item.x += s.item.vx * dt;
            s.item.y += s.item.vy * dt;
            s.item.vy *= 0.995;
            s.item.x = clamp(s.item.x, 100, W - 16);
            s.item.y = clamp(s.item.y, 34, SHORE - 30);
          }
          if (t - s.st0 > patience) help(s, false);
        } else if (s.st === 'waitItem' && s.item) {
          s.item.x += s.item.vx * dt * 0.4;
          s.item.y += s.item.vy * dt * 0.4;
          s.item.y = clamp(s.item.y, 34, SHORE - 30);
        } else if (s.st === 'pulled') {
          // держится за круг: подтягивают к берегу, к вышке
          const k = clamp((t - s.st0) / 2.4, 0, 1);
          s.hx = s.x + (TOWER[0] + 70 + s.i * 22 - s.x) * k;
          s.hy = s.y + (SHORE + 8 - s.y) * k;
          if (k >= 1) {
            s.st = 'rest';
            s.st0 = t;
          }
        } else if (s.st === 'rest') {
          s.hx = TOWER[0] + 70 + s.i * 22;
          s.hy = SHORE + 8;
          if (t - s.st0 > 2.2) respawn(s);
        } else if (s.st === 'happy' && t - s.st0 > 1.6) {
          s.st = 'swim';
          s.kind = null;
        }
      }
      // круги летят по дуге
      for (let i = rings.length - 1; i >= 0; i--) {
        const r = rings[i];
        if (t - r.t0 >= 0.7) {
          rings.splice(i, 1);
          r.s.st = 'pulled';
          r.s.st0 = t;
          host.sfx('splash');
        }
      }
      // хомячок-спасатель плывёт
      const R = rescuer,
        sp = 120;
      const goTo = (x, y) => {
        const dx = x - R.x,
          dy = y - R.y,
          d = Math.hypot(dx, dy);
        if (d < sp * dt) {
          R.x = x;
          R.y = y;
          return true;
        }
        R.x += (dx / d) * sp * dt;
        R.y += (dy / d) * sp * dt;
        return false;
      };
      if (R.st === 'tower' && R.queue.length) {
        R.target = R.queue.shift();
        R.st = 'toItem';
        host.sfx('splash');
      }
      if (R.st === 'toItem') {
        const it = R.target.item;
        if (!it || goTo(it.x, it.y + 6)) {
          R.carry = it ? it.kind : null;
          R.target.item = null;
          R.st = 'toOwner';
        }
      } else if (R.st === 'toOwner') {
        if (goTo(R.target.hx + 18, R.target.hy + 4)) {
          R.carry = null;
          R.target.st = 'happy';
          R.target.st0 = t;
          host.sfx('pop');
          R.st = R.queue.length ? 'tower' : 'back';
        }
      } else if (R.st === 'back') {
        if (R.queue.length) R.st = 'tower';
        else if (goTo(TOWER[0], TOWER[1])) R.st = 'tower';
      }
      if (R.st === 'tower' && !R.queue.length && Math.hypot(R.x - TOWER[0], R.y - TOWER[1]) > 1) R.st = 'back';
      // всё сделано: все просьбы отработаны, никто не ждёт
      if (
        !over &&
        calls >= CALLS &&
        swimmers.every((s) => ['swim', 'rest', 'happy'].includes(s.st)) &&
        R.st !== 'toItem' &&
        R.st !== 'toOwner'
      ) {
        over = true;
        host.later(() => {
          const stars = helped >= STARS[1] ? 3 : helped >= STARS[0] ? 2 : 1;
          host.finish({
            stars,
            text:
              helped === CALLS
                ? `Ты помогла всем ${CALLS} купальщикам! На пляже спокойно и весело.`
                : `Ты помогла сама ${helped} купальщикам из ${CALLS}. Смена прошла спокойно!`,
            extra: { helped, missed },
          });
        }, 1200);
      }
    }
    function respawn(s) {
      s.st = 'swim';
      s.kind = null;
      s.item = null;
      s.f = nextFriend();
    }

    // --- рисунок
    const view = { k: 1, ox: 0, oy: 0 };
    function drawSea() {
      // небо и горизонт
      const g = ctx.createLinearGradient(0, 0, 0, SHORE);
      ctx.fillStyle = '#d0ebff';
      ctx.fillRect(-2000, -2000, W + 4000, 2000);
      g.addColorStop(0, '#d0ebff');
      g.addColorStop(0.12, '#a5d8ff');
      g.addColorStop(0.13, '#4dabf7');
      g.addColorStop(1, '#74c0fc');
      ctx.fillStyle = g;
      ctx.fillRect(-2000, -2000, W + 4000, SHORE + 2000);
      // солнышко и облачко
      ell(ctx, 360, 14, 14, 14, '#ffe066', null);
      ell(ctx, 90, 16, 22, 7, '#fff', null);
      ell(ctx, 104, 12, 14, 7, '#fff', null);
      // буйки — граница, дальше которой не заплывают
      for (let x = 110; x < W; x += 48) {
        ell(ctx, x, 46 + Math.sin(t * 2 + x) * 1.2, 4, 3.5, x % 96 ? '#ff6b6b' : '#fff', OUT, 1.2);
      }
      ctx.strokeStyle = 'rgba(255,255,255,.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(110, 47);
      ctx.lineTo(W, 47);
      ctx.stroke();
      // волны — чёрточки
      ctx.strokeStyle = 'rgba(255,255,255,.55)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 26; i++) {
        const x = ((i * 67 + t * 14) % (W + 40)) - 20,
          y = 60 + ((i * 41) % (SHORE - 80));
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + 6, y - 3, x + 12, y);
      }
      ctx.stroke();
      // песок и пена прибоя
      ctx.fillStyle = '#ffe8a3';
      ctx.beginPath();
      ctx.moveTo(-200, SHORE);
      for (let x = -200; x <= W + 200; x += 20) ctx.lineTo(x, SHORE + Math.sin(x * 0.05 + t * 1.2) * 2.5);
      ctx.lineTo(W + 200, H + 2000);
      ctx.lineTo(-200, H + 2000);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.9)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let x = -200; x <= W + 200; x += 20) ctx.lineTo(x, SHORE + Math.sin(x * 0.05 + t * 1.2) * 2.5);
      ctx.stroke();
      ell(ctx, 330, 268, 9, 4, '#ffa94d', null);
      ell(ctx, 370, 282, 6, 3, '#f783ac', null);
    }
    function drawTower() {
      const [x, y] = TOWER;
      for (const dx of [-16, 16]) line(ctx, x + dx * 0.6, y - 2, x + dx, y + 46, OUT, 4);
      line(ctx, x - 13, y + 22, x + 13, y + 34, '#c98b5a', 3);
      fillRR(ctx, x - 24, y - 4, 48, 8, 3, '#e8b07a', OUT, 2);
      // зонт-навес
      line(ctx, x + 22, y - 92, x + 22, y - 4, OUT, 2.5);
      line(ctx, x - 22, y - 92, x - 22, y - 4, OUT, 2.5);
      poly(ctx, [x - 32, y - 90, x + 32, y - 90, x + 22, y - 106, x - 22, y - 106], '#ff6b6b', OUT, 2);
      for (const dx of [-12, 8])
        poly(ctx, [x + dx, y - 90, x + dx + 8, y - 90, x + dx + 6, y - 106, x + dx + 1, y - 106], '#fff', null);
      // круг на вышке, флажок
      ell(ctx, x - 20, y + 14, 7, 7, null, '#ff6b6b', 4);
      line(ctx, x, y - 106, x, y - 126, OUT, 2);
      poly(ctx, [x, y - 126, x + 18, y - 121, x, y - 116], '#ffd43b', OUT, 1.5);
    }
    function drawItem(kind, x, y) {
      if (kind === 'ball') {
        ell(ctx, x, y, 7, 7, '#fff', OUT, 1.5);
        ctx.fillStyle = '#ff6b6b';
        ctx.beginPath();
        ctx.arc(x, y, 7, -1.2, 0.2);
        ctx.lineTo(x, y);
        ctx.fill();
        ctx.fillStyle = '#4dabf7';
        ctx.beginPath();
        ctx.arc(x, y, 7, 1.9, 3.3);
        ctx.lineTo(x, y);
        ctx.fill();
      } else {
        ell(ctx, x, y + 1, 9, 5, '#ffd43b', OUT, 1.5);
        ell(ctx, x + 6, y - 5, 4.5, 4.5, '#ffd43b', OUT, 1.5);
        poly(ctx, [x + 10, y - 5, x + 14, y - 4, x + 10, y - 3], '#ff922b', OUT, 1);
      }
    }
    /** Купальщик в воде: видно голову и плечи, ниже — вода; держится за круг, если его подтягивают. */
    function drawSwimmer(s) {
      const onSand = s.st === 'rest';
      const call = s.st === 'call';
      const sc = 0.55;
      const x = s.hx,
        y = s.hy;
      if (!onSand) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(x - 40, y - 60, 80, 60);
        ctx.clip();
      }
      host.drawHamster(
        ctx,
        x,
        y + (onSand ? 0 : 16),
        sc,
        { ...s.f.look, outfit: { ...s.f.look.outfit, head: null } },
        {
          time: t,
          blink: (t + s.ph) % 3.3 < 0.13,
          armsUp: call || t - s.wave < 1 || s.st === 'happy',
          happy: s.st === 'happy' || s.st === 'rest' || t - s.wave < 1,
          sit: onSand,
          shadow: onSand,
        },
      );
      if (!onSand) {
        ctx.restore();
        // вода вокруг
        ell(ctx, x, y, 16, 4, 'rgba(255,255,255,.55)', null);
        if (s.st === 'pulled') {
          ell(ctx, x, y - 1, 15, 5, null, '#ff6b6b', 5);
          ctx.setLineDash([5, 4]);
          line(ctx, x, y, TOWER[0] + 8, TOWER[1] + 40, 'rgba(255,255,255,.8)', 1.5);
          ctx.setLineDash([]);
        }
      } else {
        heart(ctx, x + 12, y - 44 - Math.sin(t * 3) * 3, 5, '#ff6b9d');
      }
      if (call) {
        // облачко с просьбой и полоска «сколько ждёт»
        const k = clamp((t - s.st0) / patience, 0, 1);
        const bx = clamp(x, 60, W - 60),
          by = y - 52;
        fillRR(ctx, bx - 50, by - 16, 100, 26, 10, '#fff', OUT, 1.5);
        poly(ctx, [x - 5, by + 9, x + 5, by + 9, x, by + 16], '#fff', null);
        ctx.font = '900 11px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = OUT;
        ctx.fillText(`${s.kind.e} ${s.kind.say}`, bx, by - 4);
        fillRR(ctx, bx - 40, by + 4, 80, 3, 1.5, '#e9ecef', null);
        fillRR(ctx, bx - 40, by + 4, 80 * (1 - k), 3, 1.5, k > 0.7 ? '#ffa94d' : '#51cf66', null);
        // мигающее колечко «сюда»
        ctx.globalAlpha = 0.5 + Math.sin(t * 8) * 0.3;
        ell(ctx, x, y - 6, 22, 22, null, '#fff', 2);
        ctx.globalAlpha = 1;
      }
      if (t - s.wave < 1.2 && s.st === 'swim') {
        ctx.font = '16px system-ui';
        ctx.fillText('👋', x + 16, y - 36);
      }
    }
    function drawRescuer() {
      const R = rescuer;
      if (R.st === 'tower' || (R.st === 'back' && Math.hypot(R.x - TOWER[0], R.y - TOWER[1]) < 4)) {
        host.drawHamster(ctx, TOWER[0], TOWER[1] - 2, 0.62, me, {
          time: t,
          blink: t % 3.1 < 0.13,
          dir: 1,
          armsUp: rings.some((r) => t - r.t0 < 0.25),
        });
        return;
      }
      const x = R.x,
        y = R.y;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x - 40, y - 60, 80, 60);
      ctx.clip();
      host.drawHamster(ctx, x, y + 16, 0.55, me, { time: t, blink: false, walk: (t * 2) % 1 });
      ctx.restore();
      ell(ctx, x, y, 17, 4.5, 'rgba(255,255,255,.7)', null);
      if (R.carry) drawItem(R.carry, x + 12, y - 22);
    }

    host.loop((dt) => {
      update(dt);
      const k = Math.min(cv.w / W, cv.h / H);
      view.k = k;
      view.ox = (cv.w - W * k) / 2;
      view.oy = (cv.h - H * k) / 2;
      ctx.setTransform(cv.dpr * k, 0, 0, cv.dpr * k, cv.dpr * view.ox, cv.dpr * view.oy);
      drawSea();
      drawTower();
      // дальше → ближе
      const list = swimmers.slice().sort((a, b) => a.hy - b.hy);
      for (const s of list) {
        if (s.item && s.item !== null) drawItem(s.item.kind, s.item.x, s.item.y + Math.sin(t * 3 + s.ph) * 1.5);
        drawSwimmer(s);
      }
      for (const r of rings) {
        const q = clamp((t - r.t0) / 0.7, 0, 1),
          x = r.fx + (r.s.hx - r.fx) * q,
          y = r.fy + (r.s.hy - r.fy) * q - Math.sin(q * Math.PI) * 60;
        ell(ctx, x, y, 9, 9, null, '#ff6b6b', 4);
        ell(ctx, x, y, 9, 9, null, 'rgba(255,255,255,.8)', 1);
      }
      drawRescuer();
      if (flash && t - flash.t < 1.8) {
        ctx.globalAlpha = clamp(1.8 - (t - flash.t), 0, 1);
        fillRR(ctx, W / 2 - 100, 54, 200, 26, 12, 'rgba(255,255,255,.95)', OUT, 1.5);
        ctx.fillStyle = OUT;
        ctx.font = '900 13px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(flash.text, W / 2, 67);
        ctx.globalAlpha = 1;
      }
    });

    // dev-хуки
    const callers = () => swimmers.filter((s) => s.st === 'call');
    if (DEV)
      cv.canvas.__guard = () => ({
        calls,
        total: CALLS,
        helped,
        missed,
        over,
        active: callers().map((s) => ({
          kind: s.kind.id,
          x: s.x,
          y: s.y,
          item: s.item ? { x: s.item.x, y: s.item.y } : null,
        })),
        view: { ...view, W, H },
      });
    if (DEV)
      cv.canvas.__guardHelp = () => {
        const s = callers()[0];
        if (!s) return false;
        help(s, true);
        return true;
      };
    /** Нажать в точку мира (x, y) — как пальцем. */
    if (DEV) cv.canvas.__guardTap = (x, y) => tap(x, y);
  },
};
