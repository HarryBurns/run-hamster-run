// Значки игры для экрана «Домой»: рисует dev/icons.html (кодом, из рисунков игры) и пишет PNG в assets/icons/.
// Запуск (нужен сервер из корня игры):  node dev/icons.js http://localhost:8765
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const ROOT = require('./root.js');

const FILES = {
  'any-512': 'icon-512.png',
  'any-192': 'icon-192.png',
  'maskable-512': 'icon-maskable-512.png',
  'apple-180': 'apple-touch-icon.png',
  'any-32': 'favicon-32.png',
};

(async () => {
  const base = process.argv[2] || 'http://localhost:8765';
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(base + '/dev/icons.html');
  await page.waitForFunction(() => window.iconsReady);
  const out = path.join(ROOT, 'assets', 'icons');
  fs.mkdirSync(out, { recursive: true });
  const shots = await page.evaluate(() =>
    [...document.querySelectorAll('canvas')].map((c) => [c.dataset.name, c.toDataURL('image/png')]),
  );
  for (const [name, url] of shots) {
    const file = FILES[name];
    if (!file) continue;
    fs.writeFileSync(path.join(out, file), Buffer.from(url.split(',')[1], 'base64'));
    console.log('assets/icons/' + file);
  }
  await browser.close();
})();
