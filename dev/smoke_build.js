// Шаг автотеста этапа 25: метки версий модулей. index.html читает номер сборки (js/data/build.js) и список модулей
// (js/modules.json) и строит карту импортов — каждый файл игры грузится как «файл.js?v=BUILD», без дублей.
// Подключается из dev/smoke.js. Только этот шаг:  node dev/smoke.js <url> "step:сборка"
const fs = require('fs');
const path = require('path');
const lib = require('./lib.js');

module.exports = async function build(ctx) {
  const { page, step, ev, expect } = lib(ctx);

  await step(
    'сборка: все модули и стили грузятся с меткой версии ?v=BUILD, ни один файл не загружен дважды',
    async () => {
      const urls = [];
      const onReq = (r) => urls.push(new URL(r.url()).pathname + new URL(r.url()).search);
      page.on('request', onReq);
      try {
        await ev(() => (window.__dev.G.state = null)); // уходящая страница ничего не записывает
        await page.reload();
        await page.waitForFunction(() => window.__dev && document.querySelector('#title .t-menu button'));
      } finally {
        page.off('request', onReq);
      }
      const BUILD = Number(
        /BUILD\s*=\s*(\d+)/.exec(fs.readFileSync(path.join(__dirname, '..', 'js/data/build.js'), 'utf8'))[1],
      );
      const js = urls.filter((u) => /\/js\/.*\.js(\?|$)/.test(u));
      const plain = js.filter((u) => !u.endsWith('?v=' + BUILD) && !u.endsWith('/js/data/build.js')); // build.js читает запуск
      expect(js.length > 150, 'мало модулей (проверка не годится)', js.length);
      expect(!plain.length, 'модули без метки версии', plain.slice(0, 5));
      const mods = js.filter((u) => u.includes('?v='));
      expect(new Set(mods).size === mods.length, 'модуль загружен дважды');
      expect(
        mods.some((u) => u.includes('/js/data/build.js?v=')),
        'build.js как модуль — без метки',
      );
      expect(
        urls.some((u) => u.endsWith('/css/style.css?v=' + BUILD)),
        'стили без метки версии',
      );
      // мини-игры подгружаются позже — они тоже есть в карте импортов
      const map = await ev(() =>
        Object.keys(JSON.parse(document.querySelector('script[type=importmap]').textContent).imports),
      );
      const files = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'js/modules.json'), 'utf8'));
      expect(
        map.length === files.length && files.every((f) => map.some((u) => u.endsWith('/' + f))),
        'карта импортов не совпадает с js/modules.json',
      );
    },
  );
};
