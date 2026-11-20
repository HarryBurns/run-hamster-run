// Шаги автотеста этапа 25 (метки версий, общий кэш картинок, фото-режим на башне). Метки версий модулей: index.html читает номер сборки (js/data/build.js) и список модулей
// (js/modules.json) и строит карту импортов — каждый файл игры грузится как «файл.js?v=BUILD», без дублей.
// Подключается из dev/smoke.js. Только этот шаг:  node dev/smoke.js <url> "step:сборка"
const fs = require('fs');
const path = require('path');
const lib = require('./lib.js');
const ROOT = require('./root.js'); // папка над dev/ или текущая — шаг работает и из копии dev/

module.exports = async function build(ctx) {
  const { page, step, ev, expect, fresh, go, closeAll, frames, wait } = lib(ctx);

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
      const BUILD = Number(/BUILD\s*=\s*(\d+)/.exec(fs.readFileSync(path.join(ROOT, 'js/data/build.js'), 'utf8'))[1]);
      const js = urls.filter((u) => /\/js\/.*\.js(\?|$)/.test(u));
      const plain = js.filter((u) => !u.endsWith('?v=' + BUILD) && !u.includes('/js/data/build.js?t=')); // build.js читает запуск
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
      const files = JSON.parse(fs.readFileSync(path.join(ROOT, 'js/modules.json'), 'utf8'));
      expect(
        map.length === files.length && files.every((f) => map.some((u) => u.endsWith('/' + f))),
        'карта импортов не совпадает с js/modules.json',
      );
    },
  );

  await step(
    'память: земля (Т1) — в кэше только куски на экране и у самого его края, по ходу их готовят заранее',
    async () => {
      await fresh();
      await go('world');
      await ev(() => window.__dev.World.debugTeleport(40, 14));
      await frames(30);
      const g = () => ev(() => window.__dev.World.debugGround());
      const a = await g();
      expect(a.view > 0 && a.count === a.view + a.edge, 'в кэше земли лишние куски (не на экране и не у края)', a);
      // идём вправо, вниз, влево: куски, что показываются, построены заранее — ни одного «на ходу»
      for (const key of ['ArrowRight', 'ArrowDown', 'ArrowLeft']) {
        await page.keyboard.down(key);
        await wait(1500);
        await page.keyboard.up(key);
      }
      await frames(10);
      const b = await g();
      expect(b.late === a.late, 'кусок земли строился уже на экране (не успели заранее)', [a, b]);
      expect(b.count === b.view + b.edge && b.built > a.built, 'кэш земли после ходьбы', b);
    },
  );

  await step(
    'память: у всех кэшей картинок один учёт и один предел — спрайты, земля и дом в сумме дают «всего», дом отпускает свои картинки',
    async () => {
      await fresh();
      await go('world');
      await frames(4);
      const a = await ev(() => window.__dev.pix());
      expect(a.sprites > 0 && a.ground > 0, 'в городе нет спрайтов или земли в кэше', a);
      expect(a.title === 0, 'заставка закрыта, а её кадры (самолётик, корабли…) остались в кэше', a);
      expect(a.total === a.sprites + a.ground + a.title + a.layers && a.layers === 0, 'учёт не сходится', a);
      await go('villa');
      await frames(4);
      const b = await ev(() => window.__dev.pix());
      expect(b.layers > 0 && b.total === b.sprites + b.ground + b.layers, 'картинки дома не учтены', b);
      expect(b.title === 0, 'в доме в кэше кадры заставки', b);
      expect(b.budget >= 16e6 && b.budget <= 24e6, 'предел памяти вне 64–96 МБ', b.budget);
      await go('world');
      await frames(4);
      const c = await ev(() => window.__dev.pix());
      expect(c.layers === 0 && c.total <= c.budget, 'дом не отпустил картинки или память выше предела', c);
      expect(c.title === 0 && c.total === c.sprites + c.ground + c.title + c.layers, 'учёт не сходится', c);
    },
  );

  await step(
    'башня: фото-режим двигает кадр по площадке (камера сцены), по вертикали кадр стоит; снимок подписан местом',
    async () => {
      await fresh();
      await go('tower');
      await ev(() => window.__dev.Tower.debugDeck());
      await frames(150); // камера догнала хомячка
      await closeAll();
      const cam = () => ev(() => ({ x: window.__dev.scene.cam.x, y: window.__dev.scene.cam.y }));
      await ev(() => window.__dev.F.openPhotoMode());
      await page.waitForSelector('#photo', { timeout: 4000 });
      const c0 = await cam();
      const [w, h] = await ev(() => [innerWidth, innerHeight]);
      await page.mouse.move(w / 2, h / 3);
      await page.mouse.down();
      await page.mouse.move(w / 2 - 160, h / 3 + 90, { steps: 4 });
      await page.mouse.up();
      const c1 = await cam();
      expect(c1.x > c0.x + 50, 'кадр на башне не сдвинулся', [c0, c1]);
      expect(c1.y === c0.y, 'кадр уехал по вертикали', [c0, c1]);
      expect(
        await ev(() => window.__dev.scene.desc.title.includes('Хомяк-Тауэр')),
        'у башни нет названия для подписи снимка',
      );
      await page.click('#photo .ph-x:not(.tg)');
      await frames(150); // камера сама возвращается к хомячку
      const c2 = await cam();
      expect(Math.abs(c2.x - c0.x) < 5, 'после фото-режима камера не вернулась', [c0, c2]);
    },
  );
};
