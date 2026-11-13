// Мини-игра «Соревнования по плаванию»: заплыв на 4 дорожках, грести левой-правой по очереди.
import { clamp, shuffle, el, esc, ell, fillRR, text, emoji, TAU } from '../util.js';

const POOL_LEN = 2300;   // длина дорожки в «мировых» пикселях
const START_X = 250;     // где стартовая линия
const DECAY = 1.6;       // как быстро гаснет скорость
const BOOST = 0.02;      // толчок от правильного гребка (доля дистанции в секунду)
const V_MAX = 0.08;

export default {
  id: 'swim',
  title: 'Соревнования по плаванию',
  icon: '🏊',
  howTo: 'Греби лапками <b>по очереди</b>: левая, правая, левая, правая! Нажимай кнопки внизу (или стрелки ← → на клавиатуре). Чем быстрее чередуешь — тем быстрее плывёшь.',

  start(host) {
    const cv = host.canvas();
    const { ctx } = cv;
    const sfx = host.sfx;
    let raf = 0, stopped = false, endTimer = 0;

    // ---------- участники ----------
    const rivals = shuffle(host.friends || []).slice(0, 3);
    while (rivals.length < 3) rivals.push({ name: ['Пушок', 'Шустрик', 'Кнопка'][rivals.length], look: { fur: ['#f2b34c', '#b9bcc6', '#a8703f'][rivals.length], spots: null, outfit: {}, beauty: {} } });
    const lvl = Math.min(host.level || 0, 6) * 0.0025;
    const swimmers = rivals.map((r) => ({
      name: r.name, look: r.look, me: false, p: 0, fin: null,
      vb: 0.036 + Math.random() * 0.006 + lvl, f: 0.6 + Math.random() * 0.8, ph: Math.random() * 6,
    }));
    const me = { name: host.name, look: host.look, me: true, p: 0, v: 0, fin: null, last: null, stroke: 0 };
    swimmers.splice(1 + Math.floor(Math.random() * 2), 0, me); // игрок на 2-й или 3-й дорожке
    const laneCols = ['#ff6b9d', '#ffd43b', '#69db7c', '#b197fc'];

    let phase = 'count'; // count → race → done
    let time = 0, raceT = 0, lastCount = 4, hintT = 0, allDoneT = 0;
    const splashes = []; // {wx, lane, t, big}
    const confetti = [];

    // ---------- кнопки ----------
    const bar = el('div');
    bar.style.cssText = 'position:absolute;left:0;right:0;bottom:0;display:flex;gap:10px;padding:8px 10px calc(8px + env(safe-area-inset-bottom));z-index:2;pointer-events:none';
    const bL = el('button', 'btn big blue', '◀ Левая');
    const bR = el('button', 'btn big ghost', 'Правая ▶');
    for (const b of [bL, bR]) { b.style.cssText = 'flex:1;pointer-events:auto;touch-action:none;white-space:nowrap'; bar.appendChild(b); }
    host.root.appendChild(bar);
    const fitButtons = () => {
      const small = cv.h < 430;
      for (const b of [bL, bR]) { b.style.padding = small ? '9px 10px' : '20px 10px'; b.style.fontSize = small ? '19px' : '24px'; }
    };
    const markNext = () => {
      const nextLeft = me.last !== 'L';
      bL.className = 'btn big ' + (nextLeft ? 'blue' : 'ghost');
      bR.className = 'btn big ' + (nextLeft ? 'ghost' : 'blue');
    };

    function paddle(side) {
      if (phase !== 'race' || me.fin != null) return;
      if (me.last === side) { hintT = 1.2; sfx('bad'); return; }
      me.last = side;
      me.v = Math.min(V_MAX, me.v + BOOST);
      me.stroke++;
      splashes.push({ wx: START_X + me.p * POOL_LEN + 26, lane: swimmers.indexOf(me), t: 0, big: true, side });
      sfx('splash');
      markNext();
    }
    const onL = (e) => { e.preventDefault(); paddle('L'); };
    const onR = (e) => { e.preventDefault(); paddle('R'); };
    bL.addEventListener('pointerdown', onL);
    bR.addEventListener('pointerdown', onR);
    const onCanvas = (e) => {
      const r = cv.canvas.getBoundingClientRect();
      paddle(e.clientX - r.left < r.width / 2 ? 'L' : 'R');
    };
    cv.canvas.addEventListener('pointerdown', onCanvas);
    const onKey = (e) => {
      if (e.repeat) return;
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') { e.preventDefault(); paddle('L'); }
      else if (e.code === 'ArrowRight' || e.code === 'KeyD') { e.preventDefault(); paddle('R'); }
    };
    window.addEventListener('keydown', onKey);

    // ---------- логика ----------
    function placeOf() { // текущее место игрока
      let pl = 1;
      for (const s of swimmers) {
        if (s === me) continue;
        if (me.fin != null) { if (s.fin != null && s.fin < me.fin) pl++; }
        else if (s.fin != null || s.p > me.p) pl++;
      }
      return pl;
    }

    function finishRace() {
      if (phase === 'done') return;
      phase = 'done';
      if (me.fin == null) me.fin = Infinity;
      const place = placeOf();
      bar.style.display = 'none';
      if (place === 1) { sfx('win'); for (let i = 0; i < 70; i++) confetti.push({ x: Math.random(), y: -Math.random() * 0.4, vy: 0.25 + Math.random() * 0.35, c: laneCols[i % 4], r: Math.random() * 6, w: 0.5 + Math.random() }); }
      else sfx('ok');
      const winner = swimmers.filter((s) => s !== me && s.fin != null).sort((a, b) => a.fin - b.fin)[0];
      const wn = winner ? winner.name : '';
      const texts = {
        1: `${esc(host.name)} приплыла первой! Золотая медаль твоя! 🥇`,
        2: `Серебро! 🥈 Первое место — ${wn}. Ещё чуть-чуть, и ты победишь!`,
        3: `Бронза! 🥉 Первое место — ${wn}. Отличный заплыв!`,
        4: `Ты доплыла до финиша — молодец! Первое место — ${wn}. В следующий раз греби быстрее: левая-правая, левая-правая!`,
      };
      if (me.fin === Infinity) texts[4] = `Соперники уже на финише! Первое место — ${wn}. Попробуй ещё раз и греби быстрее: левая-правая, левая-правая!`;
      endTimer = setTimeout(() => {
        host.finish({ stars: place === 1 ? 3 : place === 2 ? 2 : 1, text: texts[place], extra: { place } });
      }, 1700);
    }

    function update(dt) {
      time += dt;
      if (hintT > 0) hintT -= dt;
      if (phase === 'count') {
        const n = 3 - Math.floor(time / 0.9); // 3, 2, 1, 0
        if (n !== lastCount) {
          lastCount = n;
          if (n > 0) sfx('tick');
          else { sfx('whistle'); phase = 'race'; raceT = 0; }
        }
      } else if (phase === 'race') {
        raceT += dt;
        for (const s of swimmers) {
          if (s.fin != null) continue;
          if (s.me) {
            s.v *= Math.exp(-DECAY * dt);
            s.p += s.v * dt;
          } else {
            const ramp = clamp(raceT / 1.5, 0.2, 1);
            s.p += s.vb * ramp * (1 + 0.15 * Math.sin(raceT * s.f + s.ph)) * dt;
            if (Math.random() < dt * 3) splashes.push({ wx: START_X + s.p * POOL_LEN + 24, lane: swimmers.indexOf(s), t: 0, big: false, side: Math.random() < 0.5 ? 'L' : 'R' });
          }
          if (s.p >= 1) { s.p = 1; s.fin = raceT; if (!s.me) sfx('pop'); }
        }
        if (me.fin != null) finishRace();
        else if (swimmers.every((s) => s === me || s.fin != null)) {
          allDoneT += dt;
          if (allDoneT > 5) finishRace(); // все уже приплыли — не заставляем ждать
        }
      }
      for (const sp of splashes) sp.t += dt;
      while (splashes.length && splashes[0].t > 0.6) splashes.shift();
      for (const c of confetti) { c.y += c.vy * dt; c.r += dt * 4; }
    }

    // ---------- рисование ----------
    function draw() {
      const w = cv.w, h = cv.h;
      fitButtons();
      const topH = 54, botH = bar.style.display === 'none' ? 12 : (bar.offsetHeight || 80);
      const laneH = clamp((h - topH - botH - 14) / 4, 30, 160);
      const poolH = laneH * 4;
      const y0 = topH + Math.max(6, (h - topH - botH - poolH) / 2);
      const s = clamp(laneH / 78, 0.42, 1.6);
      const worldW = START_X + POOL_LEN + 170;
      const meX = START_X + me.p * POOL_LEN;
      const camX = clamp(meX - w * 0.32, 0, Math.max(0, worldW - w));

      // бортик-плитка
      ctx.fillStyle = '#fdf3dc'; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#f0e0bd'; ctx.lineWidth = 1;
      for (let x = -(camX % 40); x < w; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      for (let y = y0 % 40; y < h; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }

      // вода
      const px0 = 40 - camX, px1 = worldW - 40 - camX;
      fillRR(ctx, px0 - 8, y0 - 8, px1 - px0 + 16, poolH + 16, 14, '#e9f7ff', '#b8dff5', 3);
      ctx.save();
      ctx.beginPath(); ctx.rect(px0, y0, px1 - px0, poolH); ctx.clip();
      const g = ctx.createLinearGradient(0, y0, 0, y0 + poolH);
      g.addColorStop(0, '#5fd0f5'); g.addColorStop(1, '#3db5ec');
      ctx.fillStyle = g; ctx.fillRect(0, y0, w, poolH);
      // блики-волны
      ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
      const step = 130;
      for (let i = Math.floor(camX / step) - 1; i * step < camX + w + step; i++) {
        for (let r = 0; r < 8; r++) {
          const wx = i * step + ((r * 53 + i * 37) % 90) + Math.sin(time * 1.4 + i + r) * 6;
          const wy = y0 + (r + 0.5) * (poolH / 8) + Math.sin(time * 2 + i * 1.7 + r) * 2;
          ctx.beginPath(); ctx.moveTo(wx - camX, wy); ctx.quadraticCurveTo(wx - camX + 11, wy - 5, wx - camX + 22, wy); ctx.stroke();
        }
      }
      // отметки дистанции на дне
      for (let k = 1; k <= 3; k++) {
        const mx = START_X + (POOL_LEN * k) / 4 - camX;
        if (mx < -80 || mx > w + 80) continue;
        ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fillRect(mx - 3, y0, 6, poolH);
        text(ctx, `${k * 25} м`, mx + 8, y0 + 13, 13, 'rgba(255,255,255,.75)', 'left');
      }
      // старт и финиш
      const sx = START_X - camX;
      ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.fillRect(sx - 42, y0, 5, poolH);
      const fx = START_X + POOL_LEN + 30 - camX;
      if (fx < w + 40) {
        const q = Math.max(8, laneH / 6);
        for (let yy = 0, r = 0; yy < poolH; yy += q, r++) for (let c = 0; c < 3; c++) {
          ctx.fillStyle = (r + c) % 2 ? '#2b2d42' : '#fff'; ctx.fillRect(fx + c * q, y0 + yy, q, Math.min(q, poolH - yy));
        }
      }
      // разделители дорожек
      for (let i = 1; i < 4; i++) {
        const ry = y0 + i * laneH;
        ctx.strokeStyle = 'rgba(0,0,0,.12)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(px0, ry); ctx.lineTo(px1, ry); ctx.stroke();
        const fs = 18;
        for (let k = Math.floor((camX + px0 - px0) / fs) - 1; ; k++) {
          const bx = 40 + k * fs - camX;
          if (bx > Math.min(w + fs, px1)) break;
          if (bx < px0 - 2) continue;
          ell(ctx, bx + fs / 2, ry + Math.sin(time * 3 + k) * 0.8, 6, 4.2, k % 2 ? '#ff6b6b' : '#fff');
        }
      }

      // пловцы
      swimmers.forEach((sw, i) => {
        const yc = y0 + (i + 0.5) * laneH;
        const x = START_X + sw.p * POOL_LEN - camX;
        if (x < -120 || x > w + 120) return;
        const moving = phase === 'race' && sw.fin == null;
        const bobT = time * (sw.me ? 5 : 4) + i;
        const fy = yc + 52 * s + (moving ? Math.sin(bobT) * 2 * s : Math.sin(time * 2 + i) * 1.2 * s);
        const wl = fy - 31 * s; // линия воды
        // след на воде
        if (moving) {
          ctx.fillStyle = 'rgba(255,255,255,.35)';
          for (let k = 1; k <= 4; k++) { ctx.beginPath(); ctx.ellipse(x - 26 * s - k * 17 * s, wl + 2 * s + Math.sin(time * 6 + k) * 2, (11 - k * 1.8) * s, (5 - k * 0.8) * s, 0, 0, TAU); ctx.fill(); }
        }
        // подсветка дорожки игрока
        if (sw.me) { ctx.fillStyle = 'rgba(255,255,255,.13)'; ctx.fillRect(px0, y0 + i * laneH + 2, px1 - px0, laneH - 4); }
        const won = sw.fin != null;
        host.drawHamster(ctx, x, fy, s, sw.look, { dir: 1, time: time + i, clipBelow: -31, happy: won, armsUp: won, shadow: false });
        // лапки-гребки
        const fur = sw.look.fur || '#fff';
        const ph = sw.me ? (sw.last === 'L' ? 0 : Math.PI) : bobT;
        if (!won) {
          for (const sd of [0, 1]) {
            const a = ph + sd * Math.PI;
            const k = moving || sw.me ? Math.sin(a) : 0.2;
            ell(ctx, x + (sd ? 24 : -24) * s + 6 * s, wl + 1 * s - Math.max(0, k) * 7 * s, 6 * s, 4.5 * s, fur, '#4a3728', 1.4);
          }
        }
        // рябь у шеи
        ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 2.2 * s;
        ctx.beginPath(); ctx.ellipse(x, wl + 1.5 * s, 27 * s, 5 * s, 0, 0.05 * Math.PI, 0.95 * Math.PI); ctx.stroke();
        // имя: слева от пловца, а если не помещается — справа
        const fsz = clamp(laneH * 0.2, 11, 16);
        ctx.font = `800 ${fsz}px sans-serif`;
        const label = sw.me ? `${sw.name} (ты)` : sw.name;
        const tw = ctx.measureText(label).width + 14;
        let lx = x - 36 * s - tw;
        if (lx < 6) lx = x + 40 * s;
        const ly = yc - fsz * 0.8;
        fillRR(ctx, lx, ly, tw, fsz * 1.6, fsz * 0.8, sw.me ? '#ffd43b' : 'rgba(255,255,255,.88)');
        text(ctx, label, lx + tw / 2, ly + fsz * 0.82, fsz, '#4a3728');
      });
      // кто уплыл за край экрана — стрелочка с именем
      swimmers.forEach((sw, i) => {
        const x = START_X + sw.p * POOL_LEN - camX;
        const off = x < -34 * s ? -1 : x > w + 34 * s ? 1 : 0;
        if (!off) return;
        const yc = y0 + (i + 0.5) * laneH, fsz = clamp(laneH * 0.2, 11, 15);
        const label = off < 0 ? `◀ ${sw.name}` : `${sw.name} ▶`;
        ctx.font = `800 ${fsz}px sans-serif`;
        const tw = ctx.measureText(label).width + 14;
        const lx = off < 0 ? 6 : w - 6 - tw;
        ctx.globalAlpha = 0.85;
        fillRR(ctx, lx, yc - fsz * 0.8, tw, fsz * 1.6, fsz * 0.8, '#fff');
        text(ctx, label, lx + tw / 2, yc + 0.5, fsz, '#4a3728');
        ctx.globalAlpha = 1;
      });

      // брызги
      for (const sp of splashes) {
        const yc = y0 + (sp.lane + 0.5) * laneH + 22 * s;
        const k = sp.t / 0.6;
        ctx.fillStyle = `rgba(255,255,255,${0.9 * (1 - k)})`;
        const n = sp.big ? 6 : 3;
        for (let j = 0; j < n; j++) {
          const a = -Math.PI * (0.15 + (0.7 * j) / (n - 1 || 1));
          const d = (sp.big ? 30 : 18) * s * k;
          ctx.beginPath(); ctx.arc(sp.wx - camX + Math.cos(a) * d * 1.2 + (sp.side === 'L' ? -8 : 8) * s, yc + Math.sin(a) * d + 26 * s * k * k, (sp.big ? 4 : 2.6) * s * (1 - k * 0.5), 0, TAU); ctx.fill();
        }
      }
      ctx.restore();

      // тумбы на старте
      for (let i = 0; i < 4; i++) {
        const bx = 48 - camX;
        if (bx > -60) {
          fillRR(ctx, bx, y0 + i * laneH + laneH * 0.2, 44, laneH * 0.6, 8, laneCols[i], '#4a3728', 2);
          text(ctx, String(i + 1), bx + 22, y0 + (i + 0.5) * laneH, clamp(laneH * 0.34, 14, 28), '#fff');
        }
      }

      // --- верхняя панель: место и полоска прогресса
      fillRR(ctx, 8, 6, w - 16, 42, 21, 'rgba(255,250,240,.95)');
      const pl = placeOf();
      fillRR(ctx, 13, 11, 88, 32, 16, phase !== 'count' && pl === 1 ? '#ffd43b' : '#ffe8cc');
      text(ctx, phase === 'count' ? 'На старт!' : `${pl} место`, 57, 28, phase === 'count' ? 14 : 16, '#4a3728');
      const bx0 = 122, bx1 = w - 48, by = 27;
      fillRR(ctx, bx0, by - 4, bx1 - bx0, 8, 4, '#a5d8ff');
      emoji(ctx, '🏁', w - 28, by, 20);
      const order = swimmers.slice().sort((a, b) => (a.me ? 1 : 0) - (b.me ? 1 : 0));
      for (const sw of order) {
        const mx = bx0 + (bx1 - bx0) * sw.p;
        if (sw.me) ell(ctx, mx, by, 15, 15, '#ffd43b', '#4a3728', 2);
        else ell(ctx, mx, by, 11, 11, '#fff', laneCols[swimmers.indexOf(sw)], 3);
        ctx.save(); ctx.beginPath(); ctx.arc(mx, by, sw.me ? 13 : 10, 0, TAU); ctx.clip();
        const ps = sw.me ? 0.3 : 0.23;
        host.drawHamster(ctx, mx, by + 54 * ps, ps, sw.look, { shadow: false });
        ctx.restore();
      }
      // подсказка
      if (hintT > 0 && phase === 'race') {
        ctx.globalAlpha = clamp(hintT * 2, 0, 1);
        fillRR(ctx, w / 2 - 120, y0 + poolH / 2 - 22, 240, 44, 22, '#4a3728');
        text(ctx, 'По очереди: левая — правая!', w / 2, y0 + poolH / 2, 15, '#fff');
        ctx.globalAlpha = 1;
      }
      // отсчёт
      if (phase === 'count' || (phase === 'race' && raceT < 0.8)) {
        const n = phase === 'count' ? 3 - Math.floor(time / 0.9) : 0;
        const k = phase === 'count' ? (time / 0.9) % 1 : raceT / 0.8;
        const sz = clamp(Math.min(w, h) * 0.3, 60, 170) * (1.15 - k * 0.25);
        ctx.globalAlpha = clamp(1.2 - k, 0, 1);
        const str = n > 0 ? String(n) : 'Старт!';
        const fz = n > 0 ? sz : sz * 0.55;
        ctx.font = `900 ${fz}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = fz * 0.14; ctx.strokeStyle = '#d9487a'; ctx.lineJoin = 'round';
        ctx.strokeText(str, w / 2, y0 + poolH / 2); ctx.fillStyle = '#fff'; ctx.fillText(str, w / 2, y0 + poolH / 2);
        ctx.globalAlpha = 1;
      }
      // конфетти
      for (const c of confetti) {
        ctx.save(); ctx.translate(c.x * w, c.y * h); ctx.rotate(c.r);
        ctx.fillStyle = c.c; ctx.fillRect(-5 * c.w, -3, 10 * c.w, 6); ctx.restore();
      }
    }

    let prev = performance.now();
    function loop(now) {
      if (stopped) return;
      const dt = Math.min(0.05, (now - prev) / 1000); prev = now;
      update(dt); draw();
      raf = requestAnimationFrame(loop);
    }
    markNext();
    raf = requestAnimationFrame(loop);

    return {
      stop() {
        stopped = true;
        cancelAnimationFrame(raf);
        clearTimeout(endTimer);
        window.removeEventListener('keydown', onKey);
        cv.canvas.removeEventListener('pointerdown', onCanvas);
        bL.removeEventListener('pointerdown', onL);
        bR.removeEventListener('pointerdown', onR);
        bar.remove();
        cv.destroy();
      },
    };
  },
};
