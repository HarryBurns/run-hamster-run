// Мини-игра «Рыбалка»: 5 забросов, подсекай, когда поплавок нырнул и появился «!».
import { clamp, pick, el, ell, fillRR, line, poly, text, plural, TAU } from '../util.js';

const CASTS = 5;
const FISH = [
  { name: 'Карасик', c: '#ffa94d', c2: '#ffd8a8', k: 0.9 },
  { name: 'Окунёк', c: '#69db7c', c2: '#2f9e44', k: 1, stripes: true },
  { name: 'Золотая рыбка', c: '#ffd43b', c2: '#ff922b', k: 0.8, fancy: true },
  { name: 'Щучка', c: '#74c0fc', c2: '#1c7ed6', k: 1.35, long: true },
  { name: 'Пузатик', c: '#f783ac', c2: '#c2255c', k: 1.1, round: true },
];
const SEA_FISH = [
  { name: 'Рыба-клоун', c: '#ff922b', c2: '#fff', k: 0.9, stripes: true },
  { name: 'Морской окунь', c: '#ff6b6b', c2: '#c92a2a', k: 1.15 },
  { name: 'Синяя рыбка', c: '#4dabf7', c2: '#ffd43b', k: 0.85, fancy: true },
  { name: 'Тунец-малыш', c: '#91a7ff', c2: '#3b5bdb', k: 1.4, long: true },
  { name: 'Рыба-шар', c: '#ffe066', c2: '#f08c00', k: 1.1, round: true },
];
const JUNK = [
  { name: 'Старый башмак', junk: 'boot' },
  { name: 'Консервная банка', junk: 'can' },
  { name: 'Полосатый носок', junk: 'sock' },
];

function drawFish(ctx, x, y, s, f, rot = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(s * f.k, s * f.k);
  const O = '#4a3728';
  const rx = f.long ? 30 : f.round ? 19 : 23,
    ry = f.long ? 9 : f.round ? 17 : 12;
  poly(ctx, [-rx + 3, 0, -rx - 13, -11, -rx - 9, 0, -rx - 13, 11], f.c2, O, 2); // хвост
  poly(ctx, [-4, -ry + 2, 4, -ry - 8, 10, -ry + 2], f.c2, O, 2); // плавник
  ell(ctx, 0, 0, rx, ry, f.c, O, 2);
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, TAU);
  ctx.clip();
  if (f.stripes) {
    ctx.fillStyle = f.c2;
    for (let i = -1; i <= 1; i++) ctx.fillRect(i * 11 - 6, -20, 5, 40);
  }
  ctx.fillStyle = 'rgba(255,255,255,.35)';
  ctx.beginPath();
  ctx.ellipse(0, ry * 0.75, rx, ry * 0.6, 0, 0, TAU);
  ctx.fill();
  if (f.fancy) {
    ctx.fillStyle = 'rgba(255,255,255,.7)';
    for (const [dx, dy] of [
      [-8, -3],
      [0, 2],
      [-3, 5],
    ]) {
      ctx.beginPath();
      ctx.arc(dx, dy, 2, 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();
  poly(ctx, [-2, 3, -9, 10, 3, 8], f.c2, O, 1.5);
  ell(ctx, rx - 9, -3, 4.2, 4.2, '#fff', O, 1.4);
  ell(ctx, rx - 8, -3, 2, 2, '#1d1b1b');
  ctx.beginPath();
  ctx.arc(rx - 3, 3, 3, 0.2 * Math.PI, 0.9 * Math.PI);
  ctx.strokeStyle = O;
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.restore();
}

function drawJunk(ctx, x, y, s, kind, rot = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(s, s);
  const O = '#4a3728';
  if (kind === 'boot') {
    ctx.beginPath();
    ctx.moveTo(-10, -24);
    ctx.lineTo(6, -24);
    ctx.lineTo(6, 0);
    ctx.quadraticCurveTo(26, 2, 26, 12);
    ctx.lineTo(26, 16);
    ctx.lineTo(-10, 16);
    ctx.closePath();
    ctx.fillStyle = '#8d6e4f';
    ctx.fill();
    ctx.strokeStyle = O;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.fillStyle = '#5c4033';
    ctx.fillRect(-11, 14, 38, 5);
    line(ctx, -2, -12, 4, -12, '#e9ecef', 2);
    line(ctx, -2, -5, 4, -5, '#e9ecef', 2);
    ell(ctx, 14, 9, 4, 3, '#3a2a1f');
  } else if (kind === 'can') {
    fillRR(ctx, -13, -18, 26, 36, 4, '#ced4da', O, 2);
    ctx.fillStyle = '#fa5252';
    ctx.fillRect(-12, -8, 24, 16);
    ell(ctx, 0, -18, 13, 4, '#e9ecef', O, 2);
    text(ctx, '🐟', 0, 0, 12);
  } else {
    ctx.beginPath();
    ctx.moveTo(-8, -24);
    ctx.lineTo(8, -24);
    ctx.lineTo(8, 2);
    ctx.quadraticCurveTo(24, 6, 22, 16);
    ctx.quadraticCurveTo(4, 22, -8, 12);
    ctx.closePath();
    ctx.fillStyle = '#74c0fc';
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = '#fff';
    for (let yy = -20; yy < 20; yy += 9) ctx.fillRect(-12, yy, 40, 4);
    ctx.restore();
    ctx.strokeStyle = O;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
  ctx.restore();
}

export default {
  id: 'fishing',
  title: 'Рыбалка',
  icon: '🎣',
  howTo:
    'Смотри на поплавок. Когда он <b>нырнёт</b> и появится <b>«!»</b> — скорее жми «Подсекай!» (или пробел). Если поплавок только чуть дрогнул — это рыбка пробует, не торопись! У тебя 5 забросов.',

  start(host) {
    const cv = host.canvas();
    const { ctx } = cv;
    const sfx = host.sfx;
    const spot = (host.info && host.info.spot) === 'pond' ? 'pond' : 'pier';
    const winter = host.season === 'winter';
    const ice = spot === 'pond' && winter;
    const kinds = spot === 'pond' ? FISH : SEA_FISH;
    const biteWin = Math.max(0.6, 1.0 - (host.level || 0) * 0.08);
    let raf = 0,
      stopped = false,
      endTimer = 0;

    let castNo = 0,
      caught = 0,
      junkSeen = false;
    let state = 'idle',
      st = 0; // cast → wait → bite → (catch | miss | early) → …
    let biteAt = 0,
      fakes = [],
      fakeT = 9;
    let prize = null,
      msg = '',
      time = 0;
    const log = []; // что поймано за игру (для значков вверху)
    const flakes = Array.from({ length: winter ? 40 : 0 }, () => ({
      x: Math.random(),
      y: Math.random(),
      v: 0.04 + Math.random() * 0.06,
      r: 1.5 + Math.random() * 2,
    }));
    const shadows = Array.from({ length: 4 }, (_, i) => ({
      a: Math.random() * 6,
      sp: 0.3 + Math.random() * 0.4,
      d: 0.5 + i * 0.35,
      dep: 0.25 + Math.random() * 0.5,
    }));
    const drops = [];

    const setState = (s) => {
      state = s;
      st = 0;
      host.root.dataset.state = s;
    };

    // ---------- кнопка ----------
    const bar = el('div');
    bar.style.cssText =
      'position:absolute;left:0;right:0;bottom:0;display:flex;justify-content:center;padding:8px 12px calc(10px + env(safe-area-inset-bottom));z-index:2;pointer-events:none';
    const btn = el('button', 'btn big yellow', '🎣 Подсекай!');
    btn.style.cssText = 'pointer-events:auto;touch-action:none;width:min(100%,360px)';
    bar.appendChild(btn);
    host.root.appendChild(bar);

    function newCast() {
      castNo++;
      prize = null;
      biteAt = 0.7 + 1.5 + Math.random() * 2.5;
      fakes = [];
      const nf = Math.random() < 0.3 ? 0 : Math.random() < 0.7 ? 1 : 2;
      for (let i = 0; i < nf; i++) {
        const t = 1 + Math.random() * (biteAt - 1.8);
        if (t > 0.9) fakes.push(t);
      }
      fakeT = 9;
      msg = 'Ждём поклёвку…';
      setState('cast');
      sfx('pop');
    }

    function hook() {
      if (state === 'bite') {
        const junkOk = !junkSeen && castNo > 1 && Math.random() < 0.14;
        prize = junkOk ? pick(JUNK) : pick(kinds);
        if (prize.junk) {
          junkSeen = true;
          msg = `Ой! ${prize.name}… Это не рыба!`;
          sfx('bad');
        } else {
          caught++;
          msg = `Есть! ${prize.name}!`;
          sfx('ok');
        }
        log.push(prize);
        for (let i = 0; i < 10; i++) drops.push({ a: -Math.PI * Math.random(), v: 80 + Math.random() * 120, t: 0 });
        sfx('splash');
        setState('catch');
      } else if (state === 'wait' && st > 0.45) {
        msg = 'Рано! Рыбка испугалась и уплыла.';
        log.push(null);
        sfx('bad');
        setState('early');
      }
    }
    const onBtn = (e) => {
      e.preventDefault();
      e.stopPropagation();
      hook();
    };
    btn.addEventListener('pointerdown', onBtn);
    const onCanvas = () => hook();
    cv.canvas.addEventListener('pointerdown', onCanvas);
    const onKey = (e) => {
      if (e.repeat) return;
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        hook();
      }
    };
    window.addEventListener('keydown', onKey);

    function nextOrEnd() {
      if (castNo >= CASTS) {
        setState('done');
        bar.style.display = 'none';
        const stars = caught >= 4 ? 3 : caught >= 2 ? 2 : 1;
        const t =
          caught === 0
            ? 'Сегодня рыбки оказались хитрее. Ничего, в следующий раз точно клюнет!'
            : `Улов: ${caught} ${plural(caught, 'рыбка', 'рыбки', 'рыбок')}! ${stars === 3 ? 'Настоящая рыбачка!' : 'Отличная рыбалка!'}`;
        endTimer = setTimeout(() => host.finish({ stars, text: t, extra: { fish: caught } }), 500);
      } else newCast();
    }

    function update(dt) {
      time += dt;
      st += dt;
      for (const f of flakes) {
        f.y += f.v * dt;
        f.x += Math.sin(time + f.y * 20) * 0.0006;
        if (f.y > 1) {
          f.y = -0.02;
          f.x = Math.random();
        }
      }
      for (const d of drops) d.t += dt;
      while (drops.length && drops[0].t > 0.7) drops.shift();
      fakeT += dt;
      if (state === 'idle') {
        if (st > 0.5) newCast();
      } else if (state === 'cast') {
        if (st > 0.7) {
          setState('wait');
          sfx('bubble');
        }
      } else if (state === 'wait') {
        if (fakes.length && st + 0.7 >= fakes[0]) {
          fakes.shift();
          fakeT = 0;
          sfx('bubble');
        }
        if (st + 0.7 >= biteAt) {
          setState('bite');
          msg = 'Клюёт! Подсекай!';
          sfx('mail');
        }
      } else if (state === 'bite') {
        if (st > biteWin) {
          msg = 'Эх, сорвалась! Надо быстрее.';
          log.push(null);
          sfx('bad');
          setState('miss');
        }
      } else if (state === 'catch') {
        if (st > 2.1) nextOrEnd();
      } else if (state === 'miss' || state === 'early') {
        if (st > 1.5) nextOrEnd();
      }
    }

    // ---------- рисование ----------
    function draw() {
      const w = cv.w,
        h = cv.h;
      const s = clamp(Math.min(w, h * 1.25) / 430, 0.7, 1.7);
      const botH = bar.style.display === 'none' ? 0 : bar.offsetHeight || 80;
      const waterY = Math.round(clamp(h * 0.56, 150 * s + 70, h - botH - 60 * s));
      const deckY = waterY - (spot === 'pier' ? 26 * s : 10 * s);
      const hx = clamp(w * 0.2, 60 * s, 240 * s);
      const bankW = hx + 46 * s;
      const bx = clamp(hx + Math.min(w * 0.48, 330 * s), bankW + 60 * s, w - 40 * s); // поплавок

      // --- небо
      const sky = ctx.createLinearGradient(0, 0, 0, waterY);
      if (winter) {
        sky.addColorStop(0, '#b9d6ee');
        sky.addColorStop(1, '#eef6fc');
      } else {
        sky.addColorStop(0, '#74c9ff');
        sky.addColorStop(1, '#d9f3ff');
      }
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, waterY);
      ell(ctx, w * 0.82, 70 * s + 30, 30 * s, 30 * s, winter ? '#fff9db' : '#ffe066');
      ctx.fillStyle = 'rgba(255,255,255,.9)';
      for (const [cx, cy, k] of [
        [0.3, 0.16, 1],
        [0.62, 0.3, 0.75],
        [0.95, 0.42, 0.6],
      ]) {
        const x = ((cx * w + time * 6 * k) % (w + 200)) - 100,
          y = 44 + cy * waterY * 0.5;
        for (const [dx, r] of [
          [-22, 14],
          [0, 20],
          [24, 15],
        ]) {
          ctx.beginPath();
          ctx.arc(x + dx * s * k, y, r * s * k, 0, TAU);
          ctx.fill();
        }
      }
      // дальний берег
      if (spot === 'pond') {
        ctx.fillStyle = winter ? '#dfeaf2' : '#8fd694';
        ctx.beginPath();
        ctx.moveTo(0, waterY);
        for (let x = 0; x <= w; x += 40) ctx.lineTo(x, waterY - 26 * s - Math.sin(x * 0.012) * 12 * s);
        ctx.lineTo(w, waterY);
        ctx.fill();
        for (let i = 0; i < 6; i++) {
          // ёлочки / кусты
          const tx = ((i * 0.19 + 0.36) % 1) * w,
            ty = waterY - 22 * s;
          poly(ctx, [tx, ty - 46 * s, tx - 16 * s, ty, tx + 16 * s, ty], winter ? '#9fc5b0' : '#51b56a');
          if (winter) poly(ctx, [tx, ty - 46 * s, tx - 7 * s, ty - 26 * s, tx + 7 * s, ty - 26 * s], '#fff');
        }
      } else {
        ctx.fillStyle = '#c5ecff';
        ctx.fillRect(0, waterY - 5 * s, w, 5 * s);
        // парусник на горизонте
        const sx = (w - bx > 150 * s ? bx + (w - bx) * 0.62 : bx - 150 * s) + Math.sin(time * 0.2) * 12,
          sy = waterY - 5 * s;
        poly(ctx, [sx - 14 * s, sy, sx + 14 * s, sy, sx + 9 * s, sy + 7 * s, sx - 9 * s, sy + 7 * s], '#e03131');
        poly(ctx, [sx, sy - 26 * s, sx, sy - 2 * s, sx + 14 * s, sy - 2 * s], '#fff');
      }

      // --- вода или лёд
      const wg = ctx.createLinearGradient(0, waterY, 0, h);
      if (spot === 'pier') {
        wg.addColorStop(0, '#3bb6e8');
        wg.addColorStop(1, '#1971c2');
      } else {
        wg.addColorStop(0, '#4fc3c8');
        wg.addColorStop(1, '#1f8a8f');
      }
      ctx.fillStyle = wg;
      ctx.fillRect(0, waterY, w, h - waterY);
      if (ice) {
        ctx.fillStyle = '#eaf6ff';
        ctx.fillRect(0, waterY, w, h - waterY);
        ctx.strokeStyle = 'rgba(120,170,210,.5)';
        ctx.lineWidth = 2;
        for (let i = 0; i < 7; i++) {
          const x = ((i * 0.17 + 0.05) % 1) * w,
            y = waterY + 20 + (((i * 53) % 100) / 100) * (h - waterY - 40);
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + 26, y + 5);
          ctx.lineTo(x + 40, y - 3);
          ctx.stroke();
        }
        // лунка
        ell(ctx, bx, waterY + 16 * s, 46 * s, 14 * s, '#cfe6f5');
        ell(ctx, bx, waterY + 18 * s, 38 * s, 11 * s, '#1f6f8f', '#9cc9e3', 3);
      } else {
        // рыбьи тени
        for (const f of shadows) {
          const near = state === 'bite' ? 0.15 : 1;
          const fxx = bx + Math.cos(time * f.sp + f.a) * 110 * s * f.d * near;
          const fyy =
            waterY +
            (h - waterY - botH) * f.dep * (state === 'bite' ? 0.5 : 1) +
            24 * s +
            Math.sin(time * f.sp * 2 + f.a) * 8;
          const dir = -Math.sin(time * f.sp + f.a) > 0 ? 1 : -1;
          ctx.fillStyle = 'rgba(0,40,70,.22)';
          ctx.beginPath();
          ctx.ellipse(fxx, fyy, 20 * s, 7 * s, 0, 0, TAU);
          ctx.fill();
          poly(
            ctx,
            [fxx - dir * 16 * s, fyy, fxx - dir * 30 * s, fyy - 7 * s, fxx - dir * 30 * s, fyy + 7 * s],
            'rgba(0,40,70,.22)',
          );
        }
        // волны
        ctx.strokeStyle = 'rgba(255,255,255,.5)';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        for (let r = 0; r < 5; r++) {
          const yy = waterY + 12 + r * ((h - waterY) / 5.5);
          for (let x = -40 + ((time * (12 + r * 5) + r * 70) % 120); x < w; x += 120) {
            ctx.beginPath();
            ctx.moveTo(x, yy);
            ctx.quadraticCurveTo(x + 13, yy - 6, x + 26, yy);
            ctx.stroke();
          }
        }
        ctx.fillStyle = 'rgba(255,255,255,.55)';
        ctx.fillRect(0, waterY - 1, w, 3);
      }

      // --- берег / пирс
      if (spot === 'pier') {
        for (const px of [bankW - 22 * s, bankW * 0.42])
          fillRR(ctx, px - 8 * s, deckY, 16 * s, h - deckY, 4, '#8a5a36', '#4a3728', 2);
        fillRR(ctx, -20, deckY - 2 * s, bankW + 20, 18 * s, 5, '#c98b5a', '#4a3728', 2);
        ctx.strokeStyle = 'rgba(74,55,40,.35)';
        ctx.lineWidth = 1.5;
        for (let x = 18 * s; x < bankW - 6; x += 30 * s) {
          ctx.beginPath();
          ctx.moveTo(x, deckY);
          ctx.lineTo(x, deckY + 14 * s);
          ctx.stroke();
        }
        // ведёрко
        fillRR(ctx, hx - 58 * s, deckY - 26 * s, 26 * s, 25 * s, 4, '#ff6b6b', '#4a3728', 2);
        ctx.beginPath();
        ctx.arc(hx - 45 * s, deckY - 26 * s, 12 * s, Math.PI, 0);
        ctx.strokeStyle = '#4a3728';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(-10, deckY - 6 * s);
        ctx.lineTo(bankW - 30 * s, deckY - 6 * s);
        ctx.quadraticCurveTo(bankW + 8 * s, deckY - 4 * s, bankW + 16 * s, waterY + 22 * s);
        ctx.quadraticCurveTo(bankW * 0.6, h * 0.86, -10, h);
        ctx.closePath();
        ctx.fillStyle = winter ? '#f4f9fc' : '#7bcf6d';
        ctx.fill();
        ctx.strokeStyle = winter ? '#c5d9e6' : '#4d9e45';
        ctx.lineWidth = 3;
        ctx.stroke();
        if (!winter) {
          for (let i = 0; i < 4; i++) {
            // камыши
            const rx = bankW + (8 + i * 13) * s,
              top = waterY - (48 + (i % 2) * 18) * s + Math.sin(time * 1.5 + i) * 2;
            line(ctx, rx, waterY + 8 * s, rx + Math.sin(time * 1.5 + i) * 3, top, '#2f9e44', 3);
            fillRR(ctx, rx - 4 * s + Math.sin(time * 1.5 + i) * 3, top - 4, 8 * s, 20 * s, 4 * s, '#8a5a36');
          }
          for (const [lx, ly] of [
            [0.7, 0.3],
            [0.86, 0.55],
          ]) {
            // кувшинки
            const x = w * lx,
              y = waterY + (h - waterY - botH) * ly;
            if (Math.abs(x - bx) < 70 * s) continue;
            ell(ctx, x, y, 22 * s, 8 * s, '#51cf66', '#2f9e44', 2);
            ell(ctx, x + 4 * s, y - 4 * s, 6 * s, 5 * s, '#ffc9de', '#f783ac', 1.5);
          }
        }
        fillRR(ctx, hx - 58 * s, deckY - 32 * s, 26 * s, 25 * s, 4, '#ff6b6b', '#4a3728', 2);
      }

      // --- удочка, леска, поплавок
      const feetY = deckY - (spot === 'pier' ? 2 : 6) * s;
      const hs = s * 1.05;
      const handX = hx + 24 * hs,
        handY = feetY - 28 * hs;
      const lift = state === 'catch' ? Math.min(1, st / 0.25) : 0;
      const bend = state === 'bite' ? 1 : fakeT < 0.4 ? 0.3 : 0;
      const tipX = handX + (92 - lift * 40) * hs,
        tipY = handY - (86 + lift * 34 - bend * 16) * hs;
      // положение поплавка
      let fx = bx,
        fy = waterY + (ice ? 16 * s : 0),
        showFloat = true;
      const bob = Math.sin(time * 2.6) * 2.2 * s;
      if (state === 'idle' || state === 'done') showFloat = false;
      else if (state === 'cast') {
        const k = clamp(st / 0.7, 0, 1);
        fx = tipX + (bx - tipX) * k;
        fy = tipY + (fy - tipY) * k - Math.sin(k * Math.PI) * 90 * s;
      } else if (state === 'wait') fy += bob + (fakeT < 0.4 ? Math.sin(fakeT * 30) * 3.5 * s + 3 * s : 0);
      else if (state === 'bite') fy += 15 * s + Math.sin(st * 26) * 2 * s;
      else if (state === 'early' || state === 'miss') fy += bob;
      else if (state === 'catch') showFloat = false;

      // пойманное: летит дугой к хомячку
      let px = 0,
        py = 0;
      if (state === 'catch') {
        const k = clamp(st / 0.65, 0, 1),
          e = 1 - (1 - k) * (1 - k);
        const tx = hx + 96 * s,
          ty = feetY - 118 * s;
        px = bx + (tx - bx) * e;
        py = waterY + (ty - waterY) * e - Math.sin(k * Math.PI) * 70 * s;
      }
      // удилище
      ctx.strokeStyle = '#8a5a36';
      ctx.lineWidth = 4.5 * s;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(handX - 8 * hs, handY + 8 * hs);
      ctx.quadraticCurveTo(handX + 40 * hs, handY - 60 * hs, tipX, tipY);
      ctx.stroke();
      // леска
      ctx.strokeStyle = 'rgba(60,60,60,.7)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      if (state === 'catch') ctx.lineTo(px, py - 14 * s);
      else if (showFloat)
        ctx.quadraticCurveTo(
          (tipX + fx) / 2,
          Math.max(tipY, fy - 20 * s) + (state === 'bite' ? 0 : 24 * s),
          fx,
          fy - 12 * s,
        );
      else ctx.lineTo(tipX, tipY + 40 * s);
      ctx.stroke();

      if (showFloat) {
        // круги на воде
        if (state !== 'cast' && !ice) {
          const rk = state === 'bite' ? (st * 2.2) % 1 : fakeT < 0.6 ? fakeT / 0.6 : (time * 0.5) % 1;
          ctx.strokeStyle = `rgba(255,255,255,${0.7 * (1 - rk)})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.ellipse(bx, waterY + 2, (10 + rk * 34) * s, (3 + rk * 9) * s, 0, 0, TAU);
          ctx.stroke();
        }
        ctx.save();
        if (state !== 'cast') {
          ctx.beginPath();
          ctx.rect(fx - 30 * s, 0, 60 * s, waterY + (ice ? 18 * s : 2));
          ctx.clip();
        }
        line(ctx, fx, fy - 22 * s, fx, fy - 10 * s, '#4a3728', 2);
        ell(ctx, fx, fy, 8 * s, 11 * s, '#fff', '#4a3728', 2);
        ctx.save();
        ctx.beginPath();
        ctx.rect(fx - 12 * s, fy - 14 * s, 24 * s, 14 * s);
        ctx.clip();
        ell(ctx, fx, fy, 8 * s, 11 * s, '#fa5252', '#4a3728', 2);
        ctx.restore();
        ctx.restore();
      }
      // «!»
      if (state === 'bite') {
        const k = 1 + Math.sin(st * 22) * 0.12,
          r = 26 * s * k;
        ell(ctx, bx, waterY - 58 * s, r, r, '#ffd43b', '#4a3728', 3);
        text(ctx, '!', bx, waterY - 57 * s, 38 * s * k, '#e03131', 'center', 900);
      }
      // брызги
      for (const d of drops) {
        const k = d.t / 0.7;
        ctx.fillStyle = `rgba(255,255,255,${1 - k})`;
        ctx.beginPath();
        ctx.arc(
          bx + Math.cos(d.a) * d.v * d.t * s,
          waterY + Math.sin(d.a) * d.v * d.t * s + 260 * d.t * d.t * s,
          4 * s * (1 - k * 0.5),
          0,
          TAU,
        );
        ctx.fill();
      }

      // --- хомячок
      const happy = state === 'catch' && prize && !prize.junk;
      host.drawHamster(ctx, hx, feetY, hs, host.look, { dir: 1, time, happy, blink: time % 3.4 < 0.12 });
      ell(ctx, handX - 2 * hs, handY + 4 * hs, 6 * hs, 6 * hs, host.look.fur || '#fff', '#4a3728', 1.6); // лапка на удочке

      // --- улов
      if (state === 'catch' && prize) {
        const rot = st < 0.65 ? -0.9 + st * 1.2 : Math.sin(time * 9) * 0.18;
        const ps = s * 1.5;
        if (prize.junk) drawJunk(ctx, px, py + 8 * s, ps, prize.junk, rot * 0.5);
        else drawFish(ctx, px, py + 8 * s, ps, prize, Math.PI / 2 + rot * 0.4);
      }

      // --- снег
      ctx.fillStyle = 'rgba(255,255,255,.9)';
      for (const f of flakes) {
        ctx.beginPath();
        ctx.arc(f.x * w, f.y * h, f.r, 0, TAU);
        ctx.fill();
      }

      // --- панель сверху
      const pad = 8,
        ph = 40;
      fillRR(ctx, pad, pad, 148, ph, 20, 'rgba(255,250,240,.95)');
      text(
        ctx,
        `Заброс ${Math.min(Math.max(castNo, 1), CASTS)} из ${CASTS}`,
        pad + 74,
        pad + ph / 2 + 1,
        15,
        '#4a3728',
      );
      const lw = CASTS * 30 + 16;
      fillRR(ctx, w - pad - lw, pad, lw, ph, 20, 'rgba(255,250,240,.95)');
      for (let i = 0; i < CASTS; i++) {
        const cx = w - pad - lw + 23 + i * 30,
          cy = pad + ph / 2;
        const it = log[i];
        if (i >= log.length) ell(ctx, cx, cy, 9, 9, null, '#d9c9ae', 2);
        else if (!it) {
          line(ctx, cx - 6, cy - 6, cx + 6, cy + 6, '#ced4da', 3);
          line(ctx, cx + 6, cy - 6, cx - 6, cy + 6, '#ced4da', 3);
        } else if (it.junk) drawJunk(ctx, cx, cy, 0.42, it.junk);
        else drawFish(ctx, cx + 2, cy, 0.42 / it.k, it);
      }
      // сообщение
      if (msg && state !== 'idle' && state !== 'done') {
        const fz = clamp(w / 24, 15, 22);
        ctx.font = `800 ${fz}px sans-serif`;
        const tw = Math.min(w - 16, ctx.measureText(msg).width + 34);
        const col = state === 'bite' ? '#e03131' : state === 'catch' && happy ? '#2f9e44' : '#4a3728';
        const my = pad + ph + 10;
        fillRR(ctx, w / 2 - tw / 2, my, tw, fz * 2, fz, col);
        ctx.save();
        ctx.beginPath();
        ctx.rect(w / 2 - tw / 2 + 6, my, tw - 12, fz * 2);
        ctx.clip();
        text(ctx, msg, w / 2, my + fz + 1, fz, '#fff');
        ctx.restore();
      }
      // полоска времени на подсечку
      if (state === 'bite') {
        const k = clamp(1 - st / biteWin, 0, 1),
          bw = Math.min(220, w * 0.5);
        fillRR(ctx, bx - bw / 2, waterY - 102 * s, bw, 10, 5, 'rgba(255,255,255,.8)');
        fillRR(ctx, bx - bw / 2, waterY - 102 * s, Math.max(10, bw * k), 10, 5, '#fa5252');
      }
    }

    let prev = performance.now();
    function loop(now) {
      if (stopped) return;
      const dt = Math.min(0.05, (now - prev) / 1000);
      prev = now;
      update(dt);
      draw();
      raf = requestAnimationFrame(loop);
    }
    setState('idle');
    raf = requestAnimationFrame(loop);

    return {
      stop() {
        stopped = true;
        cancelAnimationFrame(raf);
        clearTimeout(endTimer);
        window.removeEventListener('keydown', onKey);
        cv.canvas.removeEventListener('pointerdown', onCanvas);
        btn.removeEventListener('pointerdown', onBtn);
        bar.remove();
        delete host.root.dataset.state;
        cv.destroy();
      },
    };
  },
};
