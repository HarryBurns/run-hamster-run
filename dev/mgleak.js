// Утечки мини-игр (этап 23): node dev/mgleak.js <url> [id,id,…]   (без списка — все игры из LOADERS в host.js)
// Для каждой игры: «Начать!» → закрыть через 150 мс; «Начать!» → случайные нажатия → закрыть; «Начать!» → вкладка
// скрыта понарошку → кадров игры нет, вернулась — идут. После закрытия: слушатели window/document, <style>, дети body,
// кадры и таймеры, заказанные кодом из js/minigames/, ошибки в консоли. Код выхода 1 — есть замечания.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const URL = (process.argv[2] || 'http://localhost:8765').replace(/\/(index\.html)?$/, '');
const ids = (process.argv[3] || '').split(',').filter(Boolean);
if (!ids.length) {
  const host = fs.readFileSync(path.join(require('./root.js'), 'js/minigames/host.js'), 'utf8');
  const loaders = host.slice(host.indexOf('const LOADERS'), host.indexOf('};', host.indexOf('const LOADERS')));
  for (const m of loaders.matchAll(/^\s+(\w+): \(\) => import/gm)) ids.push(m[1]);
}
const VW = { width: 1024, height: 768 };

async function openGame(b) {
  const page = await b.newPage({ viewport: VW });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 300));
  });
  await page.addInitScript(() => {
    window.__L = { add: {}, raf: 0 };
    for (const tgt of [window, document]) {
      const a = tgt.addEventListener.bind(tgt),
        r = tgt.removeEventListener.bind(tgt);
      const nm = tgt === window ? 'win' : 'doc';
      tgt.addEventListener = function (t, f, o) {
        window.__L.add[nm + ':' + t] = (window.__L.add[nm + ':' + t] || 0) + 1;
        return a(t, f, o);
      };
      tgt.removeEventListener = function (t, f, o) {
        window.__L.add[nm + ':' + t] = (window.__L.add[nm + ':' + t] || 0) - 1;
        return r(t, f, o);
      };
    }
    const R = window.requestAnimationFrame.bind(window);
    window.__L.mg = 0;
    window.requestAnimationFrame = function (f) {
      window.__L.raf++;
      if (/minigames\//.test(new Error().stack)) window.__L.mg++;
      return R(f);
    };
    const ST = window.setTimeout.bind(window);
    window.__pend = new Set();
    window.__mgpend = new Set();
    window.setTimeout = function (f, ms, ...a) {
      const mine = /minigames\//.test(new Error().stack);
      const id = ST(() => {
        window.__pend.delete(id);
        window.__mgpend.delete(id);
        typeof f === 'function' && f(...a);
      }, ms);
      window.__pend.add(id);
      if (mine) window.__mgpend.add(id);
      return id;
    };
    const CT = window.clearTimeout.bind(window);
    window.clearTimeout = function (id) {
      window.__pend.delete(id);
      window.__mgpend.delete(id);
      return CT(id);
    };
    // скрытая вкладка понарошку
    let fakeHidden = false;
    Object.defineProperty(document, 'hidden', { get: () => fakeHidden, configurable: true });
    window.__hide = (h) => {
      fakeHidden = h;
      document.dispatchEvent(new Event('visibilitychange'));
    };
  });
  await page.goto(`${URL}/index.html`);
  await page.waitForFunction(() => window.__dev && window.__dev.locations, { timeout: 15000 });
  await page.waitForTimeout(500);
  await page.click('[data-act="gender-f"]'); // новая игра ждёт выбора «хомячок / хомячка»
  await page.click('text=Играть!');
  await page.click('text=Пропустить');
  await page.waitForTimeout(1500);
  for (let i = 0; i < 6; i++) {
    const x = await page.$('.overlay .xbtn, .overlay .btn');
    if (!x) break;
    await x.click().catch(() => {});
    await page.waitForTimeout(300);
  }
  await page.evaluate(() => window.__dev.ui.toast('проверка'));
  await page.waitForTimeout(300);
  return { page, errs };
}
const snap = (page) =>
  page.evaluate(() => ({
    add: { ...window.__L.add },
    raf: window.__L.raf,
    mg: window.__L.mg,
    mgpend: window.__mgpend.size,
    styles: document.querySelectorAll('style').length,
    body: [...document.body.children].filter((e) => !/dialog/.test(e.className)).length,
    bodyList: [...document.body.children].map((e) => e.tagName + '.' + e.className + '#' + e.id).join(' '),
    pend: window.__pend.size,
  }));
const rafRate = async (page, ms = 1000, k = 'raf') => {
  const a = (await snap(page))[k];
  await page.waitForTimeout(ms);
  return (await snap(page))[k] - a;
};
async function launch(page, id) {
  await page.evaluate((id) => {
    window.__r = undefined;
    window.__dev.actions.mutate((s) => {
      s.sick = null;
    });
    window.__dev.F.playMinigame(id)
      .then((r) => (window.__r = r === null ? 'null' : r))
      .catch((e) => (window.__r = 'ERR ' + e));
  }, id);
  await page.waitForSelector('#mg .mg-card .btn', { timeout: 6000 });
  await page.waitForTimeout(900);
}
async function closeMg(page) {
  if (await page.$('#mg')) await page.click('#mg .mg-head .xbtn').catch(() => {});
  await page.waitForTimeout(400);
  if (await page.$('#mg')) {
    await page.click('#mg .mg-head .xbtn').catch(() => {});
    await page.waitForTimeout(300);
  }
  for (let i = 0; i < 4; i++) {
    const x = await page.$('.overlay .xbtn, .overlay .btn');
    if (!x) break;
    await x.click().catch(() => {});
    await page.waitForTimeout(250);
  }
}
(async () => {
  const b = await chromium.launch();
  const { page, errs } = await openGame(b);
  const base = await rafRate(page);
  console.log('фон: кадров в секунду', base);
  let bad = 0;
  for (const id of ids) {
    const out = [];
    for (const mode of ['early', 'late', 'hidden']) {
      const before = await snap(page);
      const e0 = errs.length;
      try {
        await launch(page, id);
      } catch (e) {
        out.push(mode + ': НЕТ КАРТОЧКИ');
        bad++;
        continue;
      }
      await page.click('#mg .mg-card .btn');
      await page.waitForTimeout(mode === 'early' ? 150 : 1200);
      let extra = '';
      if (mode === 'late')
        for (let i = 0; i < 25; i++) {
          await page.mouse.move(100 + Math.random() * 800, 150 + Math.random() * 550);
          await page.mouse.down();
          await page.mouse.move(100 + Math.random() * 800, 150 + Math.random() * 550, { steps: 3 });
          await page.mouse.up();
          await page.keyboard.press(['ArrowLeft', 'ArrowRight', 'Space', 'ArrowUp', 'ArrowDown', 'Enter'][i % 6]);
          await page.waitForTimeout(60);
        }
      if (mode === 'hidden') {
        const vis = await rafRate(page, 600, 'mg');
        await page.evaluate(() => window.__hide(true));
        const hid = await rafRate(page, 600, 'mg');
        await page.evaluate(() => window.__hide(false));
        const back = await rafRate(page, 600, 'mg');
        extra = ` кадры игры: видно ${vis}, скрыто ${hid}, снова ${back}`;
        if (vis > 5 && (hid > 1 || back < vis * 0.5)) extra += ' ПАУЗА НЕ РАБОТАЕТ';
      }
      await closeMg(page);
      await page.waitForTimeout(2200);
      const after = await snap(page);
      const rate = await rafRate(page, 1000, 'mg');
      const diff = [];
      for (const k of new Set([...Object.keys(before.add), ...Object.keys(after.add)])) {
        const d = (after.add[k] || 0) - (before.add[k] || 0);
        if (d) diff.push(k + ':' + d);
      }
      const flags = [];
      if (diff.length) flags.push('СЛУШАТЕЛИ ' + diff.join(' '));
      if (after.styles !== before.styles) flags.push('STYLE ' + (after.styles - before.styles));
      if (after.body !== before.body)
        flags.push('BODY ' + (after.body - before.body) + ' [' + after.bodyList + ' | было ' + before.bodyList + ']');
      if (rate > 0) flags.push('КАДРЫ ИГРЫ ПОСЛЕ ЗАКРЫТИЯ ' + rate);
      if (after.mgpend > before.mgpend) flags.push('ТАЙМЕРЫ ИГРЫ +' + (after.mgpend - before.mgpend));
      if (errs.length > e0) flags.push('ОШИБКИ ' + errs.slice(e0).join(' | '));
      if (flags.length || extra.includes('НЕ')) bad++;
      out.push(`${mode}: ${flags.length ? flags.join(' ; ') : 'чисто'}${extra}`);
    }
    console.log(id + ' — ' + out.join(' · '));
  }
  await b.close();
  console.log(bad ? 'ЕСТЬ ЗАМЕЧАНИЯ: ' + bad : 'всё чисто');
  process.exitCode = bad ? 1 : 0;
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
