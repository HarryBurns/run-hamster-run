// «Поведение мини-игр не изменилось»: снимки и итоги мини-игр до и после переделки (общий ход, вынос рисунков…).
// Часы подменены (performance.now, Date.now, setTimeout, requestAnimationFrame — время идёт только по команде бота),
// Math.random — с зерном, CSS-анимации выключены, бот в странице играет одинаково (мышь, касание, стрелки, ошибки
// нарочно). Два прогона одного кода дают одинаковые снимки байт в байт и одинаковые итоги.
//
// Как пользоваться (источник — адрес сервера, папка с игрой или коммит/ветка git):
//   node dev/mgcompare.js origin/dev .                    # «до» — коммит, «после» — эта папка; снять оба и сравнить
//   node dev/mgcompare.js HEAD~1 HEAD sled,chef            # только эти игры (id из списка GAMES ниже или игры)
//   node dev/mgcompare.js http://localhost:8765 .          # «до» — с запущенного сервера
// По шагам:
//   node dev/mgcompare.js shoot <источник> <папка> [игры]  # снимки *.png и results.json в папку
//   node dev/mgcompare.js diff <папка-до> <папка-после>    # сравнить уже снятое (годится и для папок dev/shots.js)
// Ключи: --out=<папка> (для «снять оба»; по умолчанию <tmp>/mgcompare/{before,after}),
//        --diff=<папка> — картинки различий (отличающиеся пиксели розовые).
// Коммит достаётся `git archive` во временную папку, папка и коммит раздаются своим сервером на свободном порту.
// Код возврата: 0 — всё совпало, 1 — есть различия (подробности в выводе). Около 2,5 мин на все игры (оба снимка сразу).
// Боты знают разметку игр (классы кнопок, dev-хуки канвы); игра сменила разметку — поправь бота здесь.
const { chromium } = require('playwright');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const zlib = require('zlib');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const ROOT = require('./root.js'); // репозиторий игры — для git archive

const SIZES = { desktop: [1280, 720], ipad: [820, 1180], ipadl: [1180, 820], phone: [390, 844] };

// ---------- что снимаем: игра (id для dev/minigame.html), бот, размеры, уровень ----------
const GAMES = {
  sled: { bot: 'runner', args: ['__sled', '.sl-pick button[data-ride="sled"]'], sizes: ['desktop', 'ipad', 'phone'] },
  ski: {
    g: 'sled',
    bot: 'runner',
    args: ['__sled', '.sl-pick button[data-ride="ski"]'],
    sizes: ['desktop', 'phone'],
    level: 2,
  },
  slide_kid: { g: 'slide', bot: 'runner', args: ['__slide', '.sd-pick button[data-track="kid"]'], sizes: ['desktop'] },
  slide_snake: {
    g: 'slide',
    bot: 'runner',
    args: ['__slide', '.sd-pick button[data-track="snake"]'],
    sizes: ['desktop', 'ipad', 'phone'],
  },
  slide_zigzag: {
    g: 'slide',
    bot: 'runner',
    args: ['__slide', '.sd-pick button[data-track="zigzag"]'],
    sizes: ['ipadl'],
    level: 3,
  },
  slide_typhoon: {
    g: 'slide',
    bot: 'runner',
    args: ['__slide', '.sd-pick button[data-track="typhoon"]'],
    sizes: ['desktop'],
  },
  chef: { bot: 'chef', sizes: ['desktop', 'ipad', 'phone'] },
  chef_l2: { g: 'chef', bot: 'chef', sizes: ['ipadl'], level: 2 },
  doctor: { bot: 'doctor', sizes: ['desktop', 'ipad', 'phone'] },
  doctor_l2: { g: 'doctor', bot: 'doctor', sizes: ['ipadl'], level: 2 },
  teacher: { bot: 'teacher', sizes: ['desktop', 'ipad', 'phone'] },
  teacher_l2: { g: 'teacher', bot: 'teacher', sizes: ['ipadl'], level: 2 },
  hairdresser: { bot: 'hair', sizes: ['desktop', 'ipad', 'phone'] },
  hairdresser_l1: { g: 'hairdresser', bot: 'hair', sizes: ['ipadl'], level: 1 },
  barista: { bot: 'orders', sizes: ['desktop', 'ipad', 'phone'] },
  stylist: { bot: 'orders', sizes: ['desktop', 'phone'], level: 1 },
  window: { bot: 'orders', sizes: ['desktop', 'ipad'] },
};

// ---------- в странице до загрузки: подмена часов и случайных чисел (включается при «Начать!») ----------
const INIT = () => {
  window.__fake = (seed) => {
    let s = seed >>> 0;
    Math.random = () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    let vt = 100000,
      seq = 1e7,
      rafs = [];
    const timers = new Map();
    performance.now = () => vt;
    Date.now = () => 1.7e12 + vt;
    window.setTimeout = (f, ms = 0, ...a) => {
      const id = ++seq;
      timers.set(id, { f, due: vt + (+ms || 0), a });
      return id;
    };
    window.clearTimeout = (id) => timers.delete(id);
    window.requestAnimationFrame = (f) => {
      const id = ++seq;
      rafs.push([id, f]);
      return id;
    };
    window.cancelAnimationFrame = (id) => {
      rafs = rafs.filter((r) => r[0] !== id);
    };
    // n кадров по step мс: сначала созревшие таймеры по порядку, потом кадры
    window.__tick = (n = 1, step = 20) => {
      for (let i = 0; i < n; i++) {
        vt += step;
        for (;;) {
          let best = null;
          for (const [id, t] of timers)
            if (t.due <= vt && (!best || t.due < best[1].due || (t.due === best[1].due && id < best[0])))
              best = [id, t];
          if (!best) break;
          timers.delete(best[0]);
          if (typeof best[1].f === 'function') best[1].f(...best[1].a);
        }
        const r = rafs;
        rafs = [];
        for (const [, f] of r) f(vt);
      }
    };
    window.__T = (ms) => window.__tick(Math.round(ms / 20));
  };
  window.__q = (s) => document.querySelector('#mg ' + s);
  window.__qa = (s) => [...document.querySelectorAll('#mg ' + s)];
  window.__hook = (n) => {
    const c = __qa('canvas').find((q) => q[n]);
    return c && c[n];
  };
  window.__txt = () => (document.querySelector('#mg .mg-root') || {}).innerText || '';
  window.__over = () => !!__q('[data-act=done]');
};

// ---------- боты: выполняются в странице; n — номер отрезка игры; true — игра кончилась ----------
// <бот>B (если есть) — вторая половина отрезка, после снимка
const BOTS = {
  runner: (hookName, pickSel, n) => {
    if (__over()) return true;
    const hook = __hook(hookName);
    const cv = __qa('canvas').find((q) => q[hookName]);
    if (n === 0) {
      __tick(5);
      return false;
    }
    if (n === 1) {
      __q(pickSel).click();
      __tick(1);
    }
    const r = cv.getBoundingClientRect();
    for (let f = 0; f < 250; f++) {
      if (__over()) return true;
      const st = hook();
      const fr = n * 250 + f;
      if (fr % 400 >= 100 && fr % 400 < 140) {
        // кусок игры — стрелками
        if (fr % 400 === 100)
          window.dispatchEvent(
            new KeyboardEvent('keydown', { code: st.x > 0.5 ? 'ArrowLeft' : 'ArrowRight', bubbles: true }),
          );
        if (fr % 400 === 139)
          for (const code of ['ArrowLeft', 'ArrowRight'])
            window.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true }));
      } else {
        let tx = st.tube != null ? st.tube : 0.5;
        const ahead = (st.items || []).filter((q) => q.y < st.y && q.y > st.y - 320);
        const good = ahead.filter((q) => q.good !== false).sort((a, b) => b.y - a.y)[0];
        if (st.gates && st.gates.length) tx = st.gates.sort((a, b) => b.y - a.y)[0].x;
        else if (good && fr % 900 < 700) tx = good.x;
        const bad = ahead.filter((q) => q.good === false && Math.abs(q.x - tx) < 0.1 && q.y > st.y - 160)[0];
        if (bad && fr % 1000 > 150) tx += bad.x > tx ? -0.16 : 0.16;
        if (fr % 1100 > 1040) tx = 0.95; // нарочно в бортик / в ёлки
        const cx = r.left + ((st.x0 + tx * st.lw) / st.w) * r.width;
        const type = fr % 500 < 250 ? 'mouse' : 'touch';
        if (type === 'touch' && fr % 500 === 250)
          cv.dispatchEvent(
            new PointerEvent('pointerdown', { clientX: cx, clientY: r.top + 300, pointerType: type, bubbles: true }),
          );
        cv.dispatchEvent(
          new PointerEvent('pointermove', { clientX: cx, clientY: r.top + 300, pointerType: type, bubbles: true }),
        );
        if (type === 'touch' && fr % 500 === 420)
          window.dispatchEvent(new PointerEvent('pointerup', { pointerType: type, bubbles: true }));
      }
      __tick(1);
    }
    return __over();
  },
  chef: (n) => {
    if (__over()) return true;
    __T(300);
    const seq = __qa('.chf-ing').map((q) => q.dataset.k);
    if (n % 2 === 0) __q('.chf-skip').click();
    else __T(5000);
    __T(200);
    window.__seq = seq;
    if (n === 1 || n === 3) {
      __qa('.chf-b')
        .find((b) => b.dataset.k !== seq[0])
        .click();
      __T(n === 1 ? 900 : 2300);
      if (n === 1) return false; // снимок во время «посмотри ещё раз»
    }
    window.__seq = seq;
    return false;
  },
  chefB: (n) => {
    if (__over()) return true;
    __T(n === 1 ? 1500 : 0);
    const seq = window.__seq || __qa('.chf-ing').map((q) => q.dataset.k);
    for (let i = __qa('.chf-ing.done').length; i < seq.length; i++) {
      __qa('.chf-b')
        .find((b) => b.dataset.k === seq[i])
        .click();
      __T(160);
    }
    window.__seq = null;
    __T(1700);
    return __over();
  },
  doctor: (n) => {
    if (__over()) return true;
    __T(700);
    const bs = __qa('.doc-b');
    for (let i = 0; i < bs.length; i++) {
      const b = bs[(i + n) % bs.length];
      b.click();
      if (/Спасибо/.test(__q('.doc-bubble .tx').textContent)) break;
      __T(i % 2 ? 300 : 800);
    }
    __T(600);
    return false;
  },
  doctorB: () => {
    __T(1400);
    return __over();
  },
  teacher: (n) => {
    if (__over()) return true;
    __T(500);
    const m = __q('.tch-ex').textContent.match(/(\d+) (.) (\d+) = (\d+)/);
    const a = +m[1],
      b = +m[3],
      v = m[2] === '+' ? a + b : m[2] === '×' ? a * b : a - b;
    let ok = v === +m[4];
    if (n % 4 === 2) ok = !ok; // нарочно неверно
    if (n % 3 === 0) window.dispatchEvent(new KeyboardEvent('keydown', { key: ok ? 'ArrowLeft' : 'x', bubbles: true }));
    else __q(ok ? '.tch-yes' : '.tch-no').click();
    __T(700);
    return false;
  },
  teacherB: () => {
    __T(2200);
    return __over();
  },
  hair: (n) => {
    if (__over()) return true;
    __T(900);
    const st = __hook('__hair')();
    if (n % 2 === 0) {
      // руками: на каждой полке — нужная кнопка
      for (const k of st.shelves) {
        const all = __qa('.hd-b').filter((q) => q.dataset.v === String(st.want[k]));
        all.forEach((q) => q.click());
        __T(120);
      }
      __T(200);
      __q('.hd-done').click();
    } else {
      __hook('__hairSolve')(true);
      __T(300);
      __T(600);
      __q('.hd-done').click(); // ещё раз не так — прямая подсказка
      __T(300);
    }
    __T(500);
    return false;
  },
  hairB: (n) => {
    if (n % 2) {
      __T(600);
      __hook('__hairSolve')(false);
    }
    __T(2400);
    return __over();
  },
  orders: (n) => {
    if (__over()) return true;
    __T(600);
    if (n === 2) __T(20000); // гость заждался
    const bs = __qa('.brs-b');
    const fin = () => /восторге|доволен/.test(__q('.brs-msg').textContent);
    for (let i = 0; i < 3 && !fin(); i++) {
      bs[(i * 5 + n * 3) % bs.length].click();
      __T(150);
    }
    return false;
  },
  ordersB: () => {
    const bs = __qa('.brs-b');
    const fin = () => /восторге|доволен/.test(__q('.brs-msg').textContent);
    for (const b of bs) {
      if (fin()) break;
      b.click();
      __T(60);
    }
    __T(1500);
    return __over();
  },
};

// ---------- источник: адрес, папка или коммит → адрес ----------
const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.json': 'application/json',
  '.css': 'text/css',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
};
function serve(dir) {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const p = path.join(dir, decodeURIComponent(new URL(req.url, 'http://x').pathname));
      if (!p.startsWith(dir) || !fs.existsSync(p) || !fs.statSync(p).isFile()) {
        res.writeHead(404);
        return res.end();
      }
      res.writeHead(200, {
        'content-type': MIME[path.extname(p)] || 'application/octet-stream',
        'cache-control': 'no-store',
      });
      fs.createReadStream(p).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () =>
      resolve({ url: `http://127.0.0.1:${srv.address().port}`, close: () => srv.close() }),
    );
  });
}
async function open(src) {
  if (/^https?:\/\//.test(src)) return { url: src.replace(/\/$/, ''), close() {}, name: src };
  if (fs.existsSync(src) && fs.statSync(src).isDirectory())
    return { ...(await serve(path.resolve(src))), name: path.resolve(src) };
  // коммит, ветка, тег — в свою временную папку
  const sha = execFileSync('git', ['rev-parse', '--short', src + '^{commit}'], { encoding: 'utf8', cwd: ROOT }).trim();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `mgcompare-${sha}-`));
  execFileSync('sh', ['-c', `git archive ${sha} | tar -x -C "${dir}"`], { cwd: ROOT });
  const s = await serve(dir);
  return { ...s, name: `${src} (${sha})`, close: () => (s.close(), fs.rmSync(dir, { recursive: true, force: true })) };
}

// ---------- снимки ----------
async function shoot(src, OUT, only = []) {
  const S = await open(src);
  fs.mkdirSync(OUT, { recursive: true });
  for (const f of fs.readdirSync(OUT)) if (f.endsWith('.png')) fs.rmSync(path.join(OUT, f));
  console.log(`снимаю ${S.name} → ${OUT}`);
  // без «частичной перерисовки»: иначе Chromium дорисовывает в плитку из прошлого кадра только изменённый кусок,
  // и края кругов (крестик в шапке, углы подносов) сглаживаются на 1–2 px по-разному от снимка к снимку
  const b = await chromium.launch({ args: ['--disable-partial-raster'] });
  const res = {};
  for (const [name, G] of Object.entries(GAMES)) {
    if (only.length && !only.includes(name) && !only.includes(G.g || name)) continue;
    for (const size of G.sizes) {
      const [w, h] = SIZES[size];
      const page = await b.newPage({ viewport: { width: w, height: h } });
      const errs = [];
      page.on('pageerror', (e) => errs.push(String(e)));
      page.on('console', (m) => m.type() === 'error' && !/404/.test(m.text()) && errs.push(m.text().slice(0, 200)));
      await page.addInitScript(INIT);
      await page.goto(`${S.url}/dev/minigame.html?g=${G.g || name}&level=${G.level || 0}`);
      await page.waitForSelector('#mg [data-act=start]');
      await page.addStyleTag({
        content: '*{animation:none!important;transition:none!important;caret-color:transparent!important}',
      });
      await page.waitForTimeout(250);
      const key = `${name}_${size}`;
      const hashes = [];
      let k = 0;
      const shot = async (tag) => {
        const buf = await page.screenshot();
        fs.writeFileSync(path.join(OUT, `${key}_${String(k++).padStart(2, '0')}_${tag}.png`), buf);
        hashes.push(tag + ':' + crypto.createHash('sha1').update(buf).digest('hex').slice(0, 12));
      };
      const run = (bot, n) =>
        page.evaluate(`(${BOTS[bot].toString()})(${[...(G.args || []).map((a) => JSON.stringify(a)), n].join(',')})`);
      await shot('rules');
      await page.evaluate(() => {
        window.__fake(12345);
        document.querySelector('#mg [data-act=start]').click();
      });
      await page.waitForTimeout(200);
      await page.evaluate(() => window.__tick(2));
      let done = false;
      const texts = [];
      for (let n = 0; n < 60 && !done; n++) {
        done = (await run(G.bot, n)) === true;
        if (!done && (n < 5 || n % 3 === 0)) await shot('s' + n);
        texts.push(await page.evaluate(() => __txt().replace(/\s+/g, ' ').slice(0, 500)));
        if (!done && BOTS[G.bot + 'B']) {
          done = (await run(G.bot + 'B', n)) === true;
          if (!done && n < 3) await shot('s' + n + 'b');
        }
      }
      await page.waitForTimeout(100);
      await shot('result');
      const final = await page.evaluate(() => {
        const t = __txt();
        const d = document.querySelector('#mg [data-act=done]');
        if (d) d.click();
        return t;
      });
      await page.waitForTimeout(50);
      const result = await page.evaluate(() => window.__result);
      res[key] = { result, final, hashes, texts, errs, done };
      console.log(
        ' ',
        key,
        JSON.stringify(result),
        errs.length ? 'ОШИБКИ ' + errs.join(' | ') : '',
        done ? '' : 'НЕ ДОИГРАЛ',
      );
      await page.close();
    }
  }
  fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(res, null, 1));
  await b.close();
  S.close();
}

// ---------- сравнение: PNG читаем сами (zlib), без браузера и сторонних пакетов ----------
function readPng(buf) {
  let p = 8,
    w,
    h,
    ct;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p),
      type = buf.toString('ascii', p + 4, p + 8),
      d = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') {
      w = d.readUInt32BE(0);
      h = d.readUInt32BE(4);
      ct = d[9];
      if (d[8] !== 8 || d[12] !== 0 || (ct !== 2 && ct !== 6))
        throw new Error('PNG: нужен 8 бит RGB/RGBA без чересстрочности');
    } else if (type === 'IDAT') idat.push(d);
    else if (type === 'IEND') break;
    p += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat)),
    bpp = ct === 6 ? 4 : 3,
    st = w * bpp,
    out = Buffer.alloc(w * h * 4);
  let prev = Buffer.alloc(st);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (st + 1)],
      line = Buffer.from(raw.subarray(y * (st + 1) + 1, (y + 1) * (st + 1)));
    for (let i = 0; i < st; i++) {
      const a = i >= bpp ? line[i - bpp] : 0,
        b = prev[i],
        c = i >= bpp ? prev[i - bpp] : 0;
      let v = 0;
      if (f === 1) v = a;
      else if (f === 2) v = b;
      else if (f === 3) v = (a + b) >> 1;
      else if (f === 4) {
        const q = a + b - c,
          pa = Math.abs(q - a),
          pb = Math.abs(q - b),
          pc = Math.abs(q - c);
        v = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      line[i] = (line[i] + v) & 255;
    }
    for (let x = 0; x < w; x++)
      for (let k = 0; k < 4; k++) out[(y * w + x) * 4 + k] = k < bpp ? line[x * bpp + k] : 255;
    prev = line;
  }
  return { w, h, data: out };
}
function writePng(file, { w, h, data }) {
  const crcT = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crcT[n] = c >>> 0;
  }
  const crc = (b) => {
    let c = 0xffffffff;
    for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, d) => {
    const l = Buffer.alloc(4),
      c = Buffer.alloc(4),
      td = Buffer.concat([Buffer.from(type, 'ascii'), d]);
    l.writeUInt32BE(d.length);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([l, td, c]);
  };
  const hdr = Buffer.alloc(13);
  hdr.writeUInt32BE(w, 0);
  hdr.writeUInt32BE(h, 4);
  hdr[8] = 8;
  hdr[9] = 6;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) data.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  fs.writeFileSync(
    file,
    Buffer.concat([sig, chunk('IHDR', hdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]),
  );
}
function pixDiff(fa, fb, diffFile) {
  const A = readPng(fs.readFileSync(fa)),
    B = readPng(fs.readFileSync(fb));
  if (A.w !== B.w || A.h !== B.h) return { size: true };
  let n = 0,
    max = 0,
    x0 = 1e9,
    y0 = 1e9,
    x1 = -1,
    y1 = -1;
  const D = diffFile && { w: A.w, h: A.h, data: Buffer.from(B.data) };
  for (let i = 0; i < A.data.length; i += 4) {
    const d = Math.max(
      Math.abs(A.data[i] - B.data[i]),
      Math.abs(A.data[i + 1] - B.data[i + 1]),
      Math.abs(A.data[i + 2] - B.data[i + 2]),
    );
    if (!d) continue;
    n++;
    max = Math.max(max, d);
    const x = (i / 4) % A.w,
      y = Math.floor(i / 4 / A.w);
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
    if (D) D.data.set([255, 0, 200, 255], i);
  }
  if (D && n) writePng(diffFile, D);
  return { n, max, box: [x0, y0, x1, y1] };
}

function diff(A, B, DIFF) {
  // итоги — если есть (папки dev/shots.js сравниваются только по снимкам)
  const load = (d) =>
    fs.existsSync(path.join(d, 'results.json')) ? JSON.parse(fs.readFileSync(path.join(d, 'results.json'))) : {};
  const ra = load(A),
    rb = load(B);
  if (DIFF) fs.mkdirSync(DIFF, { recursive: true });
  let runs = 0,
    bad = 0,
    same = 0,
    pix = 0;
  const say = (...a) => (bad++, console.log('  РАЗНИЦА', ...a));
  for (const k of Object.keys(ra)) {
    if (!rb[k]) {
      say(k, '— нет во «после»');
      continue;
    }
    runs++;
    const a = ra[k],
      b = rb[k];
    if (JSON.stringify(a.result) !== JSON.stringify(b.result))
      say(k, 'итог', JSON.stringify(a.result), '→', JSON.stringify(b.result));
    if (a.final !== b.final) say(k, 'текст итога');
    const t = a.texts.findIndex((x, i) => x !== b.texts[i]);
    if (t >= 0 || a.texts.length !== b.texts.length) say(k, `текст на экране, отрезок ${t >= 0 ? t : a.texts.length}`);
    if (b.errs.length) say(k, 'ошибки', b.errs.join(' | '));
    if (a.hashes.length !== b.hashes.length) say(k, `снимков ${a.hashes.length} → ${b.hashes.length}`);
  }
  for (const f of fs
    .readdirSync(A)
    .filter((f) => f.endsWith('.png'))
    .sort()) {
    pix++;
    const fb = path.join(B, f);
    if (!fs.existsSync(fb)) {
      say(f, '— нет снимка');
      continue;
    }
    const ba = fs.readFileSync(path.join(A, f));
    if (ba.equals(fs.readFileSync(fb))) {
      same++;
      continue;
    }
    const r = pixDiff(path.join(A, f), fb, DIFF && path.join(DIFF, f));
    if (r.size) say(f, 'другой размер');
    else if (r.n === 0)
      same++; // разное сжатие, пиксели те же
    else say(f, `x ${r.box[0]}–${r.box[2]}, y ${r.box[1]}–${r.box[3]}: ${r.n} px, до ${r.max}/255`);
  }
  console.log(
    `${runs ? `игр×размеров ${runs} (итоги, тексты, ошибки), ` : ''}снимков ${pix}: совпали ${same}; различий ${bad}`,
  );
  return bad;
}

// ---------- команды ----------
(async () => {
  const argv = process.argv.slice(2);
  const opt = (n) => (argv.find((a) => a.startsWith(`--${n}=`)) || '').slice(n.length + 3) || null;
  const [cmd, ...rest] = argv.filter((a) => !a.startsWith('--'));
  const list = (s) => (s || '').split(',').filter(Boolean);
  if (!cmd) {
    console.log(
      fs
        .readFileSync(__filename, 'utf8')
        .split('\n')
        .filter((l) => l.startsWith('//'))
        .slice(0, 17)
        .join('\n'),
    );
    process.exit(2);
  }
  if (cmd === 'shoot') return shoot(rest[0], rest[1], list(rest[2]));
  if (cmd === 'diff') process.exit(diff(rest[0], rest[1], opt('diff')) ? 1 : 0);
  const out = opt('out') || path.join(os.tmpdir(), 'mgcompare');
  const [before, after] = [path.join(out, 'before'), path.join(out, 'after')];
  await Promise.all([shoot(cmd, before, list(rest[1])), shoot(rest[0], after, list(rest[1]))]);
  process.exit(diff(before, after, opt('diff')) ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(2);
});
