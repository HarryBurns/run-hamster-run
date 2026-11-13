// Попиксельное сравнение двух папок со снимками (их делает dev/shots.js):
//   node dev/compare.js <папка-до> <папка-после> [папка для картинок различий]
// В картинках различий отличающиеся пиксели закрашены розовым. Код возврата всегда 0: смотреть надо глазами.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const [A, B, DIFF] = process.argv.slice(2);

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const files = fs
    .readdirSync(A)
    .filter((f) => f.endsWith('.png'))
    .sort();
  let same = 0;
  const diff = [],
    missing = [];
  if (DIFF) fs.mkdirSync(DIFF, { recursive: true });
  for (const f of files) {
    if (!fs.existsSync(path.join(B, f))) {
      missing.push(f);
      continue;
    }
    const a = fs.readFileSync(path.join(A, f)),
      b = fs.readFileSync(path.join(B, f));
    if (a.equals(b)) {
      same++;
      continue;
    }
    const r = await page.evaluate(
      async ([a, b, want]) => {
        const load = (s) =>
          new Promise((res) => {
            const i = new Image();
            i.onload = () => res(i);
            i.src = 'data:image/png;base64,' + s;
          });
        const [ia, ib] = await Promise.all([load(a), load(b)]);
        if (ia.width !== ib.width || ia.height !== ib.height) return { n: -1 };
        const mk = (i) => {
          const c = document.createElement('canvas');
          c.width = i.width;
          c.height = i.height;
          const x = c.getContext('2d');
          x.drawImage(i, 0, 0);
          return x;
        };
        const ca = mk(ia),
          cb = mk(ib),
          da = ca.getImageData(0, 0, ia.width, ia.height),
          db = cb.getImageData(0, 0, ia.width, ia.height);
        let n = 0,
          max = 0,
          x0 = 1e9,
          y0 = 1e9,
          x1 = -1,
          y1 = -1;
        for (let i = 0; i < da.data.length; i += 4) {
          const d = Math.max(
            Math.abs(da.data[i] - db.data[i]),
            Math.abs(da.data[i + 1] - db.data[i + 1]),
            Math.abs(da.data[i + 2] - db.data[i + 2]),
          );
          if (d > 0) {
            n++;
            if (d > max) max = d;
            const p = i / 4,
              x = p % ia.width,
              y = (p / ia.width) | 0;
            if (x < x0) x0 = x;
            if (x > x1) x1 = x;
            if (y < y0) y0 = y;
            if (y > y1) y1 = y;
            if (want) {
              db.data[i] = 255;
              db.data[i + 1] = 0;
              db.data[i + 2] = 255;
            }
          }
        }
        let png = null;
        if (want && n) {
          cb.putImageData(db, 0, 0);
          png = cb.canvas.toDataURL('image/png').split(',')[1];
        }
        return { n, max, box: [x0, y0, x1, y1], png };
      },
      [a.toString('base64'), b.toString('base64'), !!DIFF],
    );
    if (r.n === 0) {
      same++;
      continue;
    }
    diff.push({ f, n: r.n, max: r.max, box: r.box });
    if (DIFF && r.png) fs.writeFileSync(path.join(DIFF, f), Buffer.from(r.png, 'base64'));
  }
  await browser.close();
  console.log(
    `одинаковых: ${same} из ${files.length}; различаются: ${diff.length}; нет во второй папке: ${missing.length}`,
  );
  for (const d of diff)
    console.log(
      `  ${d.f.padEnd(44)} пикселей: ${String(d.n).padStart(7)}  макс. разница: ${String(d.max).padStart(3)}  область: ${d.box}`,
    );
  for (const m of missing) console.log(`  нет: ${m}`);
  const extra = fs.readdirSync(B).filter((f) => f.endsWith('.png') && !files.includes(f));
  for (const m of extra) console.log(`  лишний: ${m}`);
})();
