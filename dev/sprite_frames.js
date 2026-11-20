// Рисунки ART (engine/topdown/kinds.js) не выходят за свою рамку спрайта (П20-9). Рисунок кладётся в кэш спрайтов
// холстом размером с объявленную рамку [x0, y0, x1, y1] — всё, что нарисовано за ней, обрезается (край столика,
// тень, хвост белки пропадают). Проверка рисует каждый рисунок со всеми параметрами a, b (сезоны, варианты,
// кадры — списки A, B ниже; у рисунков с особыми параметрами — PARAMS) на холсте с запасом вокруг рамки и ищет
// закрашенные точки за рамкой.
//
// Запуск (нужен сервер из корня игры):  node dev/sprite_frames.js http://localhost:8765 [имя,имя…]
// Выход 1 — есть рисунки за рамкой: имя, рамка, настоящая граница рисунка и параметры, при которых он вылез.
// Тот же обход — шаг автотеста «20н: рисунки ART — в своей рамке» (dev/smoke_p20.js: require('./sprite_frames.js').sweep).
//
// Новый рисунок с параметрами не из списков A, B (направление ±1, номер кадра −2…2 и т. п.) — допиши его в PARAMS,
// иначе проверка нарисует его с параметрами, которых в игре не бывает.

/** Параметры по умолчанию: a — сезон, вариант, номер (кафе: вариант + 10·занятые стулья), b — сезон, вариант, «снег». */
const A = [
  undefined,
  0,
  1,
  2,
  3,
  4,
  5,
  6,
  7,
  10,
  11,
  12,
  13,
  14,
  20,
  21,
  22,
  23,
  24,
  'spring',
  'summer',
  'autumn',
  'winter',
];
const B = [undefined, 0, 1, 2, 3, 'summer', 'winter', true];
/** Рисунки с особыми параметрами: [значения a, значения b] — какие бывают в игре. */
const PARAMS = {
  cow: [
    [-1, 1],
    [0, 1],
  ], // направление, шаг (locations/mountain.js)
  squirrel: [[-2, -1, 0, 1, 2], [1]], // кадр хвоста (forest_art.js)
  squirrelKit: [[-2, -1, 0, 1, 2], [-1]], // кадр хвоста бельчонка (forest.js)
  mitten: [[-2, -1, 0, 1, 2], [undefined]], // кадр варежки (mountain.js)
  cliffFace: [
    [0, 1, 2],
    [0, 1, 2, 3],
  ], // вариант камня, концы стены (cove.js)
};

/**
 * Обход в странице игры: async (opts) => { n, out: [{ name, box, ext, ps }] } — ext — настоящая граница рисунка за
 * рамкой (по всем параметрам), ps — несколько параметров «a/b», при которых он вылезает. opts: { only, A, B, PARAMS }.
 */
async function sweep({ only, A, B, PARAMS }) {
  const K = await import('/js/engine/topdown/kinds.js');
  const k = 1.5, // точек холста на единицу рисунка
    P = 80; // запас вокруг рамки, единиц (дальше рисунки не вылезают)
  const c = document.createElement('canvas'),
    x = c.getContext('2d', { willReadFrequently: true });
  // сколько параметров читает рисунок (ctx, a, b): лишние не перебираем — рисунок от них не меняется
  const argc = (fn) => {
    const m = /^[^(]*\(([^)]*)\)/.exec(String(fn)) || /^\s*([\w$]+)\s*=>/.exec(String(fn));
    return m ? m[1].split(',').filter((s) => s.trim()).length - 1 : 2;
  };
  const out = [];
  let n = 0;
  for (const [name, art] of Object.entries(K.ART)) {
    if (only && !only.includes(name)) continue;
    n++;
    const box = art[0],
      ox = box[0] - P,
      oy = box[1] - P,
      W = Math.ceil((box[2] - box[0] + 2 * P) * k),
      H = Math.ceil((box[3] - box[1] + 2 * P) * k);
    if (c.width !== W || c.height !== H) {
      c.width = W;
      c.height = H;
    }
    // внутренняя часть холста — рамка (с округлением в её пользу)
    const L = Math.floor((box[0] - ox) * k),
      R = Math.ceil((box[2] - ox) * k),
      T = Math.floor((box[1] - oy) * k),
      Bt = Math.ceil((box[3] - oy) * k);
    const nArgs = argc(art[1]),
      own = PARAMS[name],
      as = own ? own[0] : nArgs >= 1 ? A : [undefined],
      bs = own ? own[1] : nArgs >= 2 ? B : [undefined];
    let worst = null;
    for (const a of as)
      for (const b of bs) {
        x.setTransform(1, 0, 0, 1, 0, 0);
        x.clearRect(0, 0, W, H);
        x.setTransform(k, 0, 0, k, -ox * k, -oy * k);
        x.lineJoin = 'round';
        x.lineCap = 'round';
        try {
          art[1](x, a, b);
        } catch (e) {
          continue;
        }
        x.setTransform(1, 0, 0, 1, 0, 0);
        // точки за рамкой: полосы сверху, снизу, слева, справа
        let x0 = 1e9,
          y0 = 1e9,
          x1 = -1e9,
          y1 = -1e9;
        const scan = (sx, sy, sw, sh) => {
          if (sw <= 0 || sh <= 0) return;
          const d = new Uint32Array(x.getImageData(sx, sy, sw, sh).data.buffer);
          for (let yy = 0; yy < sh; yy++)
            for (let xx = 0; xx < sw; xx++)
              if (d[yy * sw + xx] >>> 24 > 8) {
                x0 = Math.min(x0, sx + xx);
                x1 = Math.max(x1, sx + xx + 1);
                y0 = Math.min(y0, sy + yy);
                y1 = Math.max(y1, sy + yy + 1);
              }
        };
        scan(0, 0, W, T);
        scan(0, Bt, W, H - Bt);
        scan(0, T, L, Bt - T);
        scan(R, T, W - R, Bt - T);
        if (x1 < 0) continue;
        const ext = [
          Math.min(box[0], x0 / k + ox),
          Math.min(box[1], y0 / k + oy),
          Math.max(box[2], x1 / k + ox),
          Math.max(box[3], y1 / k + oy),
        ].map((v) => Math.round(v * 10) / 10);
        worst = worst || { name, box, ext, ps: [] };
        worst.ext = worst.ext.map((v, i) => (i < 2 ? Math.min(v, ext[i]) : Math.max(v, ext[i])));
        if (worst.ps.length < 6) worst.ps.push(a + '/' + b);
      }
    if (worst) out.push(worst);
  }
  return { n, out };
}

module.exports = { sweep, A, B, PARAMS };

if (require.main === module) {
  const { chromium } = require('playwright');
  (async () => {
    const base = process.argv[2] || 'http://localhost:8765';
    const only = process.argv[3] ? process.argv[3].split(',') : null;
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await page.goto(base);
    await page.waitForFunction(() => window.__dev, null, { timeout: 15000 });
    const t0 = Date.now();
    const r = await page.evaluate(sweep, { only, A, B, PARAMS });
    await browser.close();
    for (const o of r.out)
      console.log(`за рамкой: ${o.name} — рамка [${o.box}], рисунок [${o.ext}], параметры ${o.ps.join(' ')}`);
    console.log(
      `${r.out.length ? 'ЕСТЬ ВЫХОД ЗА РАМКУ' : 'ВСЁ ХОРОШО'}: рисунков ${r.n}, за рамкой ${r.out.length} (${((Date.now() - t0) / 1000).toFixed(1)} с)`,
    );
    process.exit(r.out.length ? 1 : 0);
  })();
}
