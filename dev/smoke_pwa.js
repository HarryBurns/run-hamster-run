// Шаги автотеста «Игра как приложение» (features/install.js, sw.js, manifest.webmanifest): манифест и значки,
// в приложении (display-mode: standalone) ничего не предлагается, кнопка на заставке и пункт меню открывают окно
// для «iPhone» (user agent Safari iOS) и «Android» (событие beforeinstallprompt — подделка), подсказка взрослым,
// service worker: без сети игра открывается из кэша, звуки в ней — записи из кэша, музыка — сочинённая. Каждый шаг —
// в своём контексте браузера (свой user agent, своё хранилище), основная страница автотеста не трогается.
// Подключается из dev/smoke.js. Только эти шаги:  node dev/smoke.js <url> step:приложение
const fs = require('fs');
const path = require('path');
const lib = require('./lib.js');
const ROOT = require('./root.js');

const IOS_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';
const ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36';

module.exports = async function pwa(ctx) {
  const { page, step, expect } = lib(ctx);
  const base = () => new URL('./', page.url()).href;

  /** Новый контекст: свой user agent, «приложение» (standalone), безопасные зоны; страница открыта на заставке. */
  async function open({ ua, w = 390, h = 844, standalone = false, games = 1, query = '' } = {}) {
    const c = await page
      .context()
      .browser()
      .newContext({
        userAgent: ua,
        viewport: { width: w, height: h },
        hasTouch: !!ua,
        isMobile: !!ua && w < 600,
      });
    const p = await c.newPage();
    if (standalone) {
      await p.addInitScript(() => Object.defineProperty(Navigator.prototype, 'standalone', { get: () => true }));
      const cdp = await c.newCDPSession(p);
      await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'display-mode', value: 'standalone' }] });
    }
    const ready = () => p.waitForFunction(() => window.__dev && document.querySelector('#title .t-menu button'));
    await p.goto(base() + query);
    await ready();
    if (games) {
      await p.evaluate(() => window.__dev.games.createGame('Ириска'));
      await p.reload();
      await ready();
    }
    return { c, p };
  }
  const info = (p) => p.evaluate(() => window.__dev.F.installDebug());

  await step('приложение: манифест без ошибок, значки на месте, установке ничто не мешает', async () => {
    const cdp = await page.context().newCDPSession(page);
    const m = await cdp.send('Page.getAppManifest');
    expect(m.url.endsWith('/manifest.webmanifest') && !m.errors.length, 'манифест с ошибками', m.errors);
    const man = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.webmanifest'), 'utf8'));
    expect(man.start_url === './' && man.scope === './' && man.display === 'standalone', 'адреса манифеста', man);
    // в обычном (не «инкогнито») окне Chrome других препятствий нет
    const { installabilityErrors: e } = await cdp.send('Page.getInstallabilityErrors');
    const bad = e.filter((x) => x.errorId !== 'in-incognito');
    expect(!bad.length, 'Chrome не даст установить', bad);
    await cdp.detach();
    const need = man.icons
      .map((i) => [i.src, +i.sizes.split('x')[0]])
      .concat([['assets/icons/apple-touch-icon.png', 180]]);
    const sizes = await page.evaluate(
      (list) =>
        Promise.all(
          list.map(
            ([src]) =>
              new Promise((ok) => {
                const im = new Image();
                im.onload = () => ok(im.naturalWidth + 'x' + im.naturalHeight);
                im.onerror = () => ok('нет');
                im.src = src;
              }),
          ),
        ),
      need,
    );
    need.forEach(([src, n], i) => expect(sizes[i] === n + 'x' + n, 'значок ' + src, sizes[i]));
    expect(
      man.icons.some((i) => i.purpose === 'maskable'),
      'нет значка maskable',
    );
    const head = await page.evaluate(() => ({
      apple: !!document.querySelector('link[rel=apple-touch-icon]'),
      title: (document.querySelector('meta[name=apple-mobile-web-app-title]') || {}).content,
      fit: document.querySelector('meta[name=viewport]').content.includes('viewport-fit=cover'),
    }));
    expect(head.apple && head.title && head.fit, 'метки для iOS', head);
  });

  await step('приложение: в приложении (standalone) ничего не предлагается — ни на заставке, ни в меню', async () => {
    const { c, p } = await open({ ua: IOS_UA, standalone: true });
    try {
      const d = await info(p);
      expect(d.standalone && !d.offer && !d.due, 'в приложении предлагают установку', d);
      expect(!(await p.$('[data-act=install]')), 'на заставке кнопка «Как приложение»');
      await p.click('[data-act=continue]');
      await p.waitForFunction(() => window.__dev.sceneName);
      await p.evaluate(() => window.__dev.F.openSettings());
      await p.waitForSelector('.set-panel');
      expect(!(await p.$('.set-panel [data-act=install]')), 'в меню пункт «Поставить на экран „Домой“»');
    } finally {
      await c.close();
    }
  });

  await step(
    'приложение: на «iPhone» кнопка на заставке и пункт меню открывают инструкцию с переносом игры файлом',
    async () => {
      const { c, p } = await open({ ua: IOS_UA });
      try {
        const d = await info(p);
        expect(d.platform === 'ios-safari' && d.offer, 'iPhone не узнан', d);
        await p.click('#title [data-act=install]');
        await p.waitForSelector('.inst-panel .inst-steps');
        const t = await p.evaluate(() => ({
          pl: document.querySelector('.inst-panel .panel-body').dataset.platform,
          text: document.querySelector('.inst-panel').innerText,
          save: document.querySelectorAll('.inst-panel [data-act=inst-save]').length,
        }));
        expect(t.pl === 'ios-safari', 'окно не для iPhone', t.pl);
        for (const s of ['Поделиться', 'На экран „Домой“', 'Добавить', 'Загрузить из файла'])
          expect(t.text.includes(s), 'в инструкции нет шага «' + s + '»');
        expect(t.save === 1, 'нет кнопки «сохранить игру в файл»', t.save);
        // кнопка сохраняет игру файлом
        const [dl] = await Promise.all([p.waitForEvent('download'), p.click('[data-act=inst-save]')]);
        // Chromium без экрана заменяет русское имя загрузки на «download» (как в dev/smoke_saves.js) — смотрим сам файл
        const file = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
        expect(file.app === 'rhr-game' && file.name === 'Ириска', 'в файле не та игра', file.name);
        await p.click('.inst-panel [data-act=ok]');
        // пункт ⚙️ меню — то же окно
        await p.click('[data-act=continue]');
        await p.waitForFunction(() => window.__dev.sceneName);
        await p.evaluate(() => window.__dev.F.openSettings());
        await p.click('.set-panel [data-act=install]');
        await p.waitForSelector('.inst-panel .inst-steps');
        // приложение на iPhone без игр: на заставке — «Перенести игру из Safari?»
      } finally {
        await c.close();
      }
      const a = await open({ ua: IOS_UA, standalone: true, games: 0 });
      try {
        const t = await a.p.evaluate(() => (document.querySelector('#title .t-move') || {}).textContent || '');
        expect(t.includes('Перенести игру из Safari'), 'нет подсказки о переносе игры', t);
        expect(!!(await a.p.$('#title [data-act=import]')), 'нет кнопки «Загрузить из файла»');
      } finally {
        await a.c.close();
      }
    },
  );

  await step(
    'приложение: на «Android» — своя кнопка «Установить» вызывает окно браузера, после установки — спасибо',
    async () => {
      const { c, p } = await open({ ua: ANDROID_UA });
      try {
        // без события браузера — объяснение про меню ⋮
        await p.click('#title [data-act=install]');
        await p.waitForSelector('.inst-panel .inst-steps');
        expect((await p.innerText('.inst-panel')).includes('Добавить на гл. экран'), 'нет совета про меню Chrome');
        await p.click('.inst-panel [data-act=ok]');
        // подделка события beforeinstallprompt: prompt() отмечает вызов, пользователь «согласился»
        await p.evaluate(() => {
          const e = new Event('beforeinstallprompt', { cancelable: true });
          e.prompt = () => ((window.__prompted = true), Promise.resolve());
          e.userChoice = Promise.resolve({ outcome: 'accepted' });
          window.dispatchEvent(e);
        });
        expect((await info(p)).prompt, 'событие beforeinstallprompt не принято');
        await p.click('#title [data-act=install]');
        await p.click('.inst-panel [data-act=inst-go]');
        await p.waitForFunction(() => window.__prompted);
        await p.evaluate(() => window.dispatchEvent(new Event('appinstalled')));
        await p.waitForFunction(() =>
          [...document.querySelectorAll('.panel')].some((x) => x.innerText.includes('Готово')),
        );
        const d = await info(p);
        expect(!d.offer && d.prefs.installed, 'после установки всё ещё предлагают', d);
        expect(!(await p.$('#title [data-act=install]')), 'кнопка на заставке после установки');
      } finally {
        await c.close();
      }
    },
  );

  await step('приложение: подсказка взрослым — не в окне, «Больше не показывать» запоминается', async () => {
    const { c, p } = await open({ ua: IOS_UA });
    try {
      await p.click('[data-act=continue]');
      await p.waitForFunction(() => window.__dev.sceneName);
      expect((await info(p)).due, 'подсказка не положена');
      const m0 = await p.evaluate(() => window.__dev.G.modal);
      await p.evaluate(() => window.__dev.F.showInstallHint());
      expect((await p.evaluate(() => window.__dev.G.modal)) === m0, 'подсказка остановила игру');
      await p.click('.inst-hint [data-act=inst-never]');
      const d = await info(p);
      expect(!(await p.$('.inst-hint')) && d.prefs.never && !d.due, 'подсказка не ушла навсегда', d);
      expect(d.offer, 'кнопку в меню тоже убрали — а она должна остаться');
    } finally {
      await c.close();
    }
  });

  await step('приложение: service worker — сеть сначала; без сети игра открывается из кэша и звучит', async () => {
    const { c, p } = await open({ games: 1, query: '?sw', w: 1024, h: 768 });
    const errs = [];
    p.on('console', (m) => m.type() === 'error' && errs.push(m.text() + ' ' + m.location().url));
    p.on('pageerror', (e) => errs.push(e.message));
    try {
      await p.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout: 20000 });
      const BUILD = /BUILD\s*=\s*(\d+)/.exec(fs.readFileSync(path.join(ROOT, 'js/data/build.js'), 'utf8'))[1];
      const keys = await p.evaluate(() => caches.keys());
      expect(keys.length === 1 && keys[0] === 'rhr-' + BUILD, 'кэш не той сборки', keys);
      const n = await p.evaluate(async (k) => (await (await caches.open(k)).keys()).length, keys[0]);
      const files = JSON.parse(fs.readFileSync(path.join(ROOT, 'js/modules.json'), 'utf8')).length;
      expect(n > files, 'в кэше не все файлы сборки', [n, files]);
      // все звуки — в кэше сразу при установке (список пишет node dev/deps.js --write); музыки в кэше нет
      const sfx = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/audio/sfx/list.json'), 'utf8'));
      const cached = await p.evaluate(async (k) => (await (await caches.open(k)).keys()).map((r) => r.url), keys[0]);
      const noSfx = sfx.filter((f) => !cached.includes(base() + 'assets/audio/sfx/' + f));
      expect(!noSfx.length, 'звуков нет в кэше', noSfx);
      expect(!cached.some((u) => u.includes('/assets/audio/music/')), 'музыка попала в кэш');
      const named = await p.evaluate(() => window.__dev.Audio.debugAudio().files.sfx);
      const unlisted = named.filter((u) => !sfx.includes(u.replace('assets/audio/sfx/', '')));
      expect(!unlisted.length, 'игра знает звуки, которых нет в списке для кэша', unlisted);
      // сеть есть — ответ с сервера, не из кэша
      const fromNet = await p.evaluate(async () => {
        const r = await fetch('js/data/build.js?t=' + Date.now());
        return r.ok && (await r.text()).includes('BUILD');
      });
      expect(fromNet, 'build.js не пришёл');
      await c.setOffline(true);
      await p.reload();
      await p.waitForFunction(() => window.__dev && document.querySelector('#title [data-act=continue]'), null, {
        timeout: 15000,
      });
      await p.click('[data-act=continue]');
      await p.waitForFunction(() => window.__dev.sceneName, null, { timeout: 15000 });
      // без сети: нажатие разрешает звук — записи звуков из кэша, музыка (её в кэше нет) — сочинённая мелодия
      await p.evaluate(() => window.__dev.Audio.setMusicOn(true));
      const box = await p.evaluate(() => {
        const r = document.querySelector('canvas').getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      });
      await p.mouse.click(box.x, box.y);
      const ok = await p
        .waitForFunction(
          () => {
            const a = window.__dev.Audio,
              d = a.debugAudio(),
              l = a.debugLevel();
            return d.sfxLoaded >= d.sfxNames - 1 && l && l.synth && !l.file;
          },
          null,
          { timeout: 15000 },
        )
        .then(
          () => true,
          () => false,
        );
      const a = await p.evaluate(() => ({ d: window.__dev.Audio.debugAudio(), l: window.__dev.Audio.debugLevel() }));
      expect(ok && !a.d.sfxFailed.length, 'без сети звуки не из записей', { ...a.d, files: undefined });
      expect(a.l.synth && !a.l.file && !a.d.musicFailed.length, 'без сети музыка не сочинённая', a);
      expect(!errs.length, 'ошибки в консоли без сети', errs);
      // сеть вернулась — трек снова из файла
      await c.setOffline(false);
      await p.waitForFunction(() => window.__dev.Audio.debugLevel().file, null, { timeout: 10000 });
    } finally {
      await c.setOffline(false);
      await c.close();
    }
  });
};
