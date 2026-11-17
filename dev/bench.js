// Замер скорости города, леса, горы, пещер, пустыни, джунглей, секретного пляжа, удалённого острова и курортного отеля: время кадра при ходьбе стрелкой и число команд рисования за кадр.
// Нужен, чтобы сравнивать «до/после» любых правок рисования (способ — как в docs/REVIEW.md, приложение).
//
// Запуск:  python3 -m http.server 8765 &   затем   node dev/bench.js [http://localhost:8765] [ключи]
//   --cpu=4                 замедление процессора (1 — без замедления)
//   --sizes=desktop,phone   desktop — 1280×720 (dpr 1), phone — 390×844 (dpr 3), big — 1920×1080 (dpr 1)
//   --spots=palms,forest,square,sea,beach,park,woods,glade,peak,slope,meadow   (forest — лес на севере города; woods
//                           и glade — локация «Лес» (П.9): густой лес у тропы и поляна с костром; peak, slope, meadow —
//                           «Гора»: вершина в снегу, ельник с облаками и шале, луга с коровами; hall, grotto, mine —
//                           «Пещеры»: большой зал с колоннами, грот светящихся грибов, шахта Камушкина у озера света;
//                           oasis, dunes, digsite — «Пустыня»: оазис с шатром и верблюдом, барханы у остановки
//                           с автобусом, раскопки у пирамиды; jcamp, jbridge, jfall — «Джунгли»: лагерь Лианы в густых
//                           зарослях, подвесной мост над рекой, водопад с попугаем; cbeach, clagoon, cgrotto — «Секретный
//                           пляж»: песок у гнезда и куличиков, мелководье с камнем Жемчужинки, грот в скалах; ivillage,
//                           ivolcano, ibeach — «Удалённый остров»: площадь деревни с костром, хижинами и тотемами, смотровая
//                           у кратера вулкана, причал и пляж с пальмами; embank — набережная у курортного отеля (город);
//                           hlobby, hrooms, hroof — курортный отель (П.17, сцена движка домов): холл с ресепшеном,
//                           коридор номеров, бассейн с горкой на крыше — для них x — точка на этаже, y — этаж;
//                           villa — первый этаж виллы, для сравнения с отелем)
//   --seasons=winter,summer зима со снегом и лето без осадков
//   --sec=4                 сколько секунд идёт один замер
//   --minutes=1320          время суток в минутах (720 — полдень; 1320 — ночь со светом фонарей и окон)
//   --day=35                день игры вместо дня сезона (праздники, П.13: 35 — Новый год с ёлкой и фейерверком ночью,
//                           1 — Рождество, 3 — Китайский Новый год с драконом, 5 — Масленица с каруселью; часть 2:
//                           12 — 1 Мая, 18 — Иван Купала с костром на пляже, 29 — Хеллоуин с тыквами, 36 — день рождения)
//   --json=файл             сохранить цифры (чтобы потом сравнить)
//   --quest                 взять задание «Гербарий для Мяты»: над местами для гербария — кружки со значками
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
  SEC = +opt('sec', 4),
  MINUTES = +opt('minutes', 12 * 60),
  DAY = opt('day', null);
const SIZES = { desktop: [1280, 720, 1], phone: [390, 844, 3], big: [1920, 1080, 1] };
// место: [x, y] в городе или [x, y, сцена] — в другой локации
const SPOTS = {
  palms: [15, 39],
  forest: [36, 5],
  square: [50, 21],
  sea: [40, 65],
  beach: [40, 53],
  park: [40, 34],
  woods: [17, 29, 'forest'],
  glade: [24, 23, 'forest'],
  peak: [20, 7, 'mountain'],
  slope: [24, 20, 'mountain'],
  meadow: [24, 33, 'mountain'],
  hall: [17, 17, 'caves'],
  grotto: [8, 7, 'caves'],
  mine: [28, 18, 'caves'],
  oasis: [22, 21, 'desert'],
  dunes: [21, 30, 'desert'],
  digsite: [33, 12, 'desert'],
  jcamp: [24, 26, 'jungle'],
  jbridge: [21, 18, 'jungle'],
  jfall: [30, 9, 'jungle'],
  cbeach: [12, 12, 'cove'],
  clagoon: [17, 16, 'cove'],
  cgrotto: [8, 7, 'cove'],
  ivillage: [20, 19, 'island'],
  ivolcano: [24, 4, 'island'],
  ibeach: [17, 27, 'island'],
  embank: [88, 51],
  hlobby: [300, 0, 'hotel'],
  hrooms: [900, 1, 'hotel'],
  hroof: [1000, 2, 'hotel'],
  villa: [800, 0, 'villa'],
  villadoor: [16, 11],
};
const SPOT_NAMES = {
  palms: 'Дворики (15,39)',
  forest: 'Лес (36,5)',
  square: 'Площадь (50,21)',
  sea: 'Море (40,65)',
  beach: 'Пляж (40,53)',
  park: 'Парк (40,34)',
  woods: 'Лес-сцена (17,29)',
  glade: 'Лес: костёр',
  peak: 'Гора: вершина',
  slope: 'Гора: ельник',
  meadow: 'Гора: луга',
  hall: 'Пещеры: зал',
  grotto: 'Пещеры: грибы',
  mine: 'Пещеры: шахта',
  oasis: 'Пустыня: оазис',
  dunes: 'Пустыня: барханы',
  digsite: 'Пустыня: раскопки',
  jcamp: 'Джунгли: лагерь',
  jbridge: 'Джунгли: мост',
  jfall: 'Джунгли: водопад',
  cbeach: 'Пляж: песок',
  clagoon: 'Пляж: у воды',
  cgrotto: 'Пляж: грот',
  ivillage: 'Остров: деревня',
  ivolcano: 'Остров: вулкан',
  ibeach: 'Остров: причал',
  embank: 'Набережная, отель',
  hlobby: 'Отель: холл',
  hrooms: 'Отель: номера',
  hroof: 'Отель: крыша',
  villa: 'Вилла (для сравнения)',
  villadoor: 'Двор виллы, у двери',
};
const sizes = opt('sizes', 'desktop,phone').split(','),
  spots = opt('spots', 'palms,forest,square,sea,embank,woods,peak,slope,hall,mine,oasis,dunes,jcamp,jbridge,cbeach,clagoon,ivillage,ivolcano,hlobby,hroof').split(',');
const seasons = opt('seasons', 'winter,summer').split(',');
// лето — 3 июля (день 20): 1 июля (день 18) — Иван Купала с костром на пляже, его меряют отдельно (--day=18)
const SEASON = { winter: { day: 0, weather: 'snow' }, summer: { day: 20, weather: 'sun' } };

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
    await page.click('text=Пропустить'); // вступительная сценка новой игры (этап 10)
    await wait(400);
    await page.click('text=Поехали!');
    await wait(400);
    await page.evaluate((quest) => {
      window.__dev.go('world');
      if (quest) window.__dev.actions.takeQuest('herbarium');
      window.__dev.actions.addItem('finds', 'flashlight', 1); // в пещерах — с фонариком
    }, args.includes('--quest'));
    await wait(400);
    // счётчики: время draw/update города, интервалы между кадрами, число команд канвы внутри draw
    await page.evaluate(() => {
      const B = (window.__bench = { on: false, frames: [], draw: [], cmd: null, cmdFrames: 0 });
      const S = window.__dev.scenes;
      for (const sc of [S.world, S.forest, S.mountain, S.caves, S.desert, S.jungle, S.cove, S.island, S.hotel, S.villa].filter(Boolean)) {
        const d0 = sc.draw;
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
      }
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
        const [tx, ty, where = 'world'] = SPOTS[spot];
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
        await page.evaluate(
          ([s, tx, ty, minutes, where, day]) => {
            const d = window.__dev,
              st = d.G.state;
            st.day = day !== null ? +day : s.day;
            st.dayFlags = {};
            st.weather = s.weather;
            st.minutes = minutes;
            if (d.locations[where]) {
              if (d.sceneName !== where) d.go(where);
              d.locations[where].debugTeleport(tx, ty);
            } else d.go(where, { pos: { scene: where, floor: ty, x: tx } }); // сцена движка домов (отель): этаж и x
          },
          [SEASON[sea], tx, ty, MINUTES, where, DAY],
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
  // лес-сцена и гора против города (тот же размер и сезон): средний кадр
  const mean = (f) => {
    const l = rows.filter(f);
    return l.length ? +(l.reduce((a, r) => a + r.frame, 0) / l.length).toFixed(1) : null;
  };
  for (const size of sizes) {
    const town = mean((r) => r.size === size && !SPOTS[r.spot][2]),
      wood = mean((r) => r.size === size && SPOTS[r.spot][2] === 'forest'),
      hill = mean((r) => r.size === size && SPOTS[r.spot][2] === 'mountain'),
      cave = mean((r) => r.size === size && SPOTS[r.spot][2] === 'caves'),
      sand = mean((r) => r.size === size && SPOTS[r.spot][2] === 'desert'),
      jung = mean((r) => r.size === size && SPOTS[r.spot][2] === 'jungle'),
      cove = mean((r) => r.size === size && SPOTS[r.spot][2] === 'cove'),
      isle = mean((r) => r.size === size && SPOTS[r.spot][2] === 'island'),
      hotel = mean((r) => r.size === size && SPOTS[r.spot][2] === 'hotel');
    if (town && (wood || hill || cave || sand || jung || cove || isle || hotel))
      console.log(
        `${size}: средний кадр — город ${town} мс, лес-сцена ${wood} мс, гора ${hill} мс, пещеры ${cave} мс, пустыня ${sand} мс, джунгли ${jung} мс, секретный пляж ${cove} мс, удалённый остров ${isle} мс, отель ${hotel} мс`,
      );
  }
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
