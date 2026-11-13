// Мини-игра «Показ мод»: оденься по теме и пройди по подиуму.
import { clothesPanel, scoreOutfit, FASHION_THEMES } from '../features.js';
import { playerLook } from '../core/state.js';
import { pick, el, clamp, TAU } from '../core/util.js';
import { ell, fillRR, poly, star, text } from '../core/draw.js';
import { drawPortrait } from '../art/hamster.js';

export default {
  id: 'fashion',
  title: 'Показ мод',
  icon: '👠',
  howTo: 'Жюри объявит тему показа. Подбери в шкафу наряд по теме — чем больше подходящих вещей, тем выше оценки!',
  start(host) {
    const theme = host.info.theme || pick(FASHION_THEMES);
    const cv = host.canvas(),
      ctx = cv.ctx;
    const judges = host.friends.slice(0, 3);
    let raf = 0,
      t = 0,
      last = performance.now(),
      phase = 'theme',
      walk = 0,
      scores = null,
      shown = 0,
      stopped = false,
      panel = null;
    const flashes = [];
    const ui = el('div');
    ui.style.cssText =
      'position:absolute;left:0;right:0;bottom:16px;display:flex;justify-content:center;gap:10px;padding:0 12px;flex-wrap:wrap';
    host.root.appendChild(ui);
    const banner = el('div');
    banner.style.cssText =
      'position:absolute;left:50%;top:12px;transform:translateX(-50%);background:#fffaf0;border-radius:18px;padding:8px 16px;text-align:center;box-shadow:0 4px 0 rgba(74,55,40,.2);width:min(92%,460px)';
    banner.innerHTML = `<div style="font-size:13px;opacity:.7">Тема показа</div><div style="font-size:21px;font-weight:900;color:#d9487a">«${theme.name}»</div><div style="font-size:13px">${theme.hint}</div>`;
    host.root.appendChild(banner);

    const setButtons = (list) => {
      ui.innerHTML = '';
      for (const [label, cls, fn] of list) {
        const b = el('button', 'btn big ' + cls, label);
        b.onclick = () => {
          host.sfx('tap');
          fn();
        };
        ui.appendChild(b);
      }
    };
    const dress = () => {
      panel = clothesPanel('wardrobe', {
        title: `Тема: «${theme.name}»`,
        icon: '👠',
        sticky: true,
        hint: theme.hint,
        foot: [{ text: 'Готово! ✨', cls: 'green', fn: (p) => p.close() }],
        onClose: () => {
          panel = null;
        },
      });
    };
    const go = () => {
      phase = 'walk';
      walk = 0;
      setButtons([]);
      host.sfx('magic');
    };
    setButtons([
      ['👗 Переодеться', 'blue', dress],
      ['На подиум! ✨', 'green', go],
    ]);

    const loop = (now) => {
      if (stopped) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt;
      const w = cv.w,
        h = cv.h;
      // сцена
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#3b1d5e');
      g.addColorStop(1, '#7b2d8b');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 3; i++) {
        const a = Math.sin(t * 0.8 + i * 2) * 0.35;
        ctx.save();
        ctx.translate(w * (0.2 + i * 0.3), 0);
        ctx.rotate(a);
        ctx.globalAlpha = 0.16;
        poly(ctx, [-12, 0, 12, 0, 120, h, -120, h], ['#ffd43b', '#ff6b9d', '#74c0fc'][i]);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      // занавес
      for (const sx of [0, 1]) {
        ctx.fillStyle = '#c2255c';
        ctx.beginPath();
        const x0 = sx ? w : 0,
          d = sx ? -1 : 1;
        ctx.moveTo(x0, 0);
        ctx.lineTo(x0 + d * w * 0.2, 0);
        ctx.quadraticCurveTo(x0 + d * w * 0.16, h * 0.3, x0 + d * w * 0.06, h * 0.55);
        ctx.lineTo(x0, h * 0.55);
        ctx.closePath();
        ctx.fill();
      }
      // подиум (трапеция)
      const topY = h * 0.34,
        botY = h * 0.9;
      poly(ctx, [w * 0.42, topY, w * 0.58, topY, w * 0.86, botY, w * 0.14, botY], '#fff0f6', '#4a3728', 3);
      poly(ctx, [w * 0.14, botY, w * 0.86, botY, w * 0.86, botY + 18, w * 0.14, botY + 18], '#f783ac', '#4a3728', 3);
      for (let i = 0; i < 6; i++) {
        const k = i / 5,
          y = topY + (botY - topY) * k,
          xw = w * (0.08 + 0.28 * k);
        for (const sx of [-1, 1])
          ell(ctx, w / 2 + sx * xw, y, 4 + k * 4, 4 + k * 4, Math.floor(t * 3 + i) % 2 ? '#ffd43b' : '#fff');
      }
      // хомячок
      if (phase === 'walk') {
        walk += dt / 4.2;
        if (walk >= 1) {
          walk = 1;
          phase = 'pose';
          host.sfx('win');
          const sc = scoreOutfit(theme);
          scores = {
            total: sc,
            list: judges.map(() => clamp(Math.round(5 + sc / 2 + (Math.random() - 0.5) * 1.2), 5, 10)),
          };
          setTimeout(() => {
            if (!stopped) phase = 'judge';
          }, 1400);
        }
        if (Math.random() < dt * 5) flashes.push({ x: Math.random() * w, y: h * (0.5 + Math.random() * 0.4), t: 0 });
      }
      const k = phase === 'theme' ? 0 : walk;
      const hy = topY + 14 + (botY - topY - 30) * k,
        hs = (Math.min(w, h) / 420) * (0.75 + 1.25 * k);
      host.drawHamster(ctx, w / 2 + (phase === 'walk' ? Math.sin(t * 5) * 6 * k : 0), hy, hs, playerLook(), {
        time: t,
        walk: phase === 'walk' ? t * 1.6 : null,
        happy: phase !== 'theme',
        armsUp: phase === 'pose' || (phase === 'judge' && Math.sin(t * 8) > 0),
      });
      for (const f of flashes) {
        f.t += dt;
        ctx.globalAlpha = Math.max(0, 1 - f.t * 4);
        star(ctx, f.x, f.y, 22, '#fff');
      }
      ctx.globalAlpha = 1;
      // жюри
      if (phase === 'judge' && scores) {
        shown = Math.min(judges.length, shown + dt * 1.4);
        const jw = Math.min(110, w / 3.4),
          y = h * 0.24;
        judges.forEach((j, i) => {
          if (i >= Math.ceil(shown)) return;
          const x = w / 2 + (i - 1) * (jw + 8);
          fillRR(ctx, x - jw / 2, y - jw / 2, jw, jw + 34, 14, '#fffaf0', '#4a3728', 3);
          drawPortrait(ctx, x, y - 4, jw - 22, j.look, { happy: true, time: t });
          fillRR(ctx, x - 24, y + jw / 2 - 12, 48, 40, 10, '#ffd43b', '#4a3728', 3);
          text(ctx, String(scores.list[i]), x, y + jw / 2 + 9, 26, '#4a3728');
        });
        if (shown >= judges.length && !ui.children.length) {
          host.sfx('ok');
          setButtons([
            [
              'Дальше ▶',
              'green',
              () => {
                const sc = scores.total,
                  stars = sc >= 7 ? 3 : sc >= 4 ? 2 : 1;
                host.finish({
                  stars,
                  text:
                    stars === 3
                      ? `Жюри в восторге! Идеальный наряд для темы «${theme.name}».`
                      : stars === 2
                        ? `Красиво! Ещё пара вещей по теме «${theme.name}» — и будет высший балл.`
                        : `Смелый образ! В следующий раз подбери побольше вещей по теме «${theme.name}».`,
                  extra: { theme: theme.id, score: sc },
                });
              },
            ],
          ]);
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return {
      stop() {
        stopped = true;
        cancelAnimationFrame(raf);
        cv.destroy();
        if (panel) panel.close();
      },
    };
  },
};
