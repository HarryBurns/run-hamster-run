// Замер скорости города: время кадра при ходьбе стрелкой и число команд рисования за кадр.
// Нужен, чтобы сравнивать «до/после» любых правок рисования (способ — как в docs/REVIEW.md, приложение).
//
// Запуск:  python3 -m http.server 8765 &   затем   node dev/bench.js [http://localhost:8765] [ключи]
//   --cpu=4                 замедление процессора (1 — без замедления)
//   --sizes=desktop,phone   desktop — 1280×720 (dpr 1), phone — 390×844 (dpr 3), big — 1920×1080 (dpr 1)
//   --spots=palms,forest,square,sea,beach,park
//   --seasons=winter,summer зима со снегом и лето без осадков
//   --sec=4                 сколько секунд идёт один замер
//   --json=файл             сохранить цифры (чтобы потом сравнить)
//   --max-forest=40         порог: код возврата 1, если средний кадр в лесу (настольный размер) дольше, мс
//
// Оговорка: в headless-Chromium нет видеокарты, канва растеризуется программно. Время кадра при замедлении —
// модель слабого устройства, а не точное предсказание; число команд и время JS от стенда не зависят.
const { chromium } = require('playwright');
const fs = require('fs');

const args = process.argv.slice(2);
const BASE = args.find((a) => !a.startsWith('--')) || 'http://localhost:8765';
const opt = (name, def) => {
  const a = args.find((q) => q.startsWith(`--${name}=`));
  return a ? a.split('=')[1] : def;
};
const CPU = +opt('cpu', 4),
  SEC = +opt('sec', 4);
const SIZES = { desktop: [1280, 720, 1], phone: [390, 844, 3], big: [1920, 1080, 1] };
const SPOTS = { palms: [15, 39], forest: [36, 5], square: [50, 21], sea: [40, 65], beach: [40, 53], park: [40, 34] };
const SPOT_NAMES = {
  palms: 'Дворики (15,39)',
  forest: 'Лес (36,5)',
  square: 'Площадь (50,21)',
  sea: 'Море (40,65)',
  beach: 'Пляж (40,53)',
  park: 'Парк (40,34)',
};
const sizes = opt('sizes', 'desktop,phone').split(','),
  spots = opt('spots', 'palms,forest,square,sea').split(',');
const seasons = opt('seasons', 'winter,summer').split(',');
const SEASON = { winter: { day: 0, weather: 'snow' }, summer: { day: 18, weather: 'sun' } };

(async () => {
  const browser = await chromium.launch();
  const rows = [];
  for (const size of sizes) {
    const [w, h, dsf] = SIZES[size];
    const ctx = await browser.newContext({
      viewport: { width: w, height: h },
      deviceScaleFactor: dsf,
      hasTouch: size === 'phone',
    });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.log(`[${size}] exception: ${e.message}`));
    const cdp = await ctx.newCDPSession(page);
    const wait = (ms) => page.waitForTimeout(ms);
    await page.goto(BASE + '/index.html');
    await wait(300);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await wait(400);
    await page.click('text=Играть!');
    await wait(400);
    await page.click('text=Поехали!');
    await wait(400);
    await page.evaluate(() => {
      window.__dev.go('world');
    });
    await wait(400);
    // счётчики: время draw/update города, интервалы между кадрами, число команд канвы внутри draw
    await page.evaluate(() => {
      const B = (window.__bench = { on: false, frames: [], draw: [], cmd: null, cmdFrames: 0 });
      const sc = window.__dev.scenes.world,
        d0 = sc.draw;
      sc.draw = function (c) {
        if (B.cmd) B.inDraw = true;
        const t = performance.now();
        d0.call(this, c);
        if (B.on) B.draw.push(performance.now() - t);
        if (B.cmd) {
          B.inDraw = false;
          B.cmdFrames++;
        }
      };
      const P = CanvasRenderingContext2D.prototype;
      for (const m of [
        'fill',
        'stroke',
        'fillRect',
        'strokeRect',
        'fillText',
        'drawImage',
        'clip',
        'save',
        'restore',
      ]) {
        const f = P[m];
        P[m] = function (...a) {
          if (B.cmd && B.inDraw) B.cmd[m] = (B.cmd[m] || 0) + 1;
          return f.apply(this, a);
        };
      }
      let last = 0;
      const loop = (now) => {
        if (B.on && last) B.frames.push(now - last);
        last = now;
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    });
    const walk = async (ms) => {
      // ходьба стрелкой влево-вправо
      for (let t = 0; t < ms; t += 1000) {
        const k = (t / 1000) % 2 ? 'ArrowRight' : 'ArrowLeft';
        await page.keyboard.down(k);
        await wait(Math.min(1000, ms - t));
        await page.keyboard.up(k);
      }
    };
    for (const sea of seasons)
      for (const spot of spots) {
        const [tx, ty] = SPOTS[spot];
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
        await page.evaluate(
          ([s, tx, ty]) => {
            const st = window.__dev.G.state;
            st.day = s.day;
            st.weather = s.weather;
            st.minutes = 12 * 60;
            window.__dev.World.debugTeleport(tx, ty);
          },
          [SEASON[sea], tx, ty],
        );
        await walk(1000); // прогрев: кэши, шрифты
        // 1) число команд (без замедления: счётчик сам тормозит)
        await page.evaluate(() => {
          const B = window.__bench;
          B.cmd = {};
          B.cmdFrames = 0;
        });
        await walk(1000);
        const cmd = await page.evaluate(() => {
          const B = window.__bench,
            r = { ...B.cmd, n: B.cmdFrames };
          B.cmd = null;
          return r;
        });
        // 2) время кадра
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
        await walk(1000);
        await page.evaluate(() => {
          const B = window.__bench;
          B.frames = [];
          B.draw = [];
          B.on = true;
        });
        await walk(SEC * 1000);
        const r = await page.evaluate(() => {
          const B = window.__bench;
          B.on = false;
          return { frames: B.frames, draw: B.draw };
        });
        const fr = r.frames.slice().sort((a, b) => a - b),
          avg = (a) => a.reduce((s, v) => s + v, 0) / Math.max(1, a.length);
        const per = (k) => Math.round((cmd[k] || 0) / Math.max(1, cmd.n));
        rows.push({
          size,
          spot,
          season: sea,
          cpu: CPU,
          frame: +avg(fr).toFixed(1),
          p95: +(fr[Math.floor(fr.length * 0.95)] || 0).toFixed(0),
          fps: +(1000 / avg(fr)).toFixed(0),
          draw: +avg(r.draw).toFixed(2),
          cmds: per('fill') + per('stroke') + per('fillRect') + per('strokeRect') + per('fillText') + per('drawImage'),
          images: per('drawImage'),
          clip: per('clip'),
          save: per('save'),
        });
        const q = rows[rows.length - 1];
        console.log(
          `${size.padEnd(8)}${SPOT_NAMES[spot].padEnd(17)}${sea.padEnd(7)} ×${CPU}  кадр ${String(q.frame).padStart(5)} / ${String(q.p95).padStart(3)} мс  ${String(q.fps).padStart(2)} к/с  draw ${String(q.draw).padStart(5)} мс  команд ${String(q.cmds).padStart(4)} (из них drawImage ${q.images}, clip ${q.clip}, save ${q.save})`,
        );
      }
    await ctx.close();
  }
  await browser.close();
  const json = opt('json', '');
  if (json) fs.writeFileSync(json, JSON.stringify(rows, null, 1));
  const lim = +opt('max-forest', 0);
  if (lim) {
    const f = rows.filter((r) => r.spot === 'forest' && r.size === 'desktop');
    const worst = Math.max(...f.map((r) => r.frame));
    if (!f.length || worst > lim) {
      console.log(`\nМЕДЛЕННО: кадр в лесу ${worst} мс при пороге ${lim} мс`);
      process.exit(1);
    }
    console.log(`\nВ пределах порога: кадр в лесу ${worst} мс ≤ ${lim} мс`);
  }
})();
