// Шаги автотеста этапа 19 «Надёжность сохранений»: снимки альбома лежат в IndexedDB (перенос из localStorage,
// перезагрузка, корзина), игра выгружается в файл и загружается из файла, вторая вкладка и страница со старой
// сборкой не затирают сохранение. Логика без браузера (repair, профили, нечитаемые игры) — node dev/test_saves.js.
// Подключается из dev/smoke.js. Только эти шаги:  node dev/smoke.js <url> "step:надёжность:"
const fs = require('fs');

const lib = require('./lib.js');

module.exports = async function saves(ctx) {
  const { page, step, ev, wait, closeAll, expect, fresh: newGame, act, sel, until, cont } = lib(ctx);
  const panelTitles = (p = page) => p.evaluate(() => [...document.querySelectorAll('.overlay .panel-head .title')].map((e) => e.textContent).join('|'));
  const sub = () => ev(() => [...document.querySelectorAll('#title .sub')].map((e) => e.textContent).join(' | '));
  /** Стереть всё, что игра хранит в браузере: localStorage и базу снимков. */
  const wipe = async () => {
    await ev(async () => {
      window.__dev.G.state = null;
      localStorage.clear();
      const P = await import('/js/core/photos.js');
      for (const id of ['main', 'trash', 'g1', 'g2', 'g3', 'g4']) await P.dropPhotos(id);
    });
  };
  const fresh = async (name) => {
    await wipe();
    await newGame({ name });
  };
  /** Окон стало не больше n (закрылось верхнее). */
  const untilWindows = (n) => until((n) => document.querySelectorAll('.overlay').length <= n, n, { timeout: 3000 }).catch(() => {});
  /** Выйти на заставку: сохраниться и перезагрузить страницу. */
  const toTitle = async () => {
    await ev(() => window.dispatchEvent(new Event('pagehide')));
    await page.reload();
    await page.waitForSelector('#title .t-menu button', { timeout: 8000 });
  };
  const photos = (gid) =>
    ev(async (gid) => {
      const P = await import('/js/core/photos.js');
      const list = await (gid ? P.loadPhotos(gid) : P.loadPhotos());
      return { store: await P.photoStore(), caps: list.map((p) => p.caption), ls: Object.keys(localStorage).filter((k) => k.startsWith('rhr-photos-')) };
    }, gid);
  /**
   * «Вторая вкладка»: та же игра в рамке на всю страницу — свой экземпляр кода, то же хранилище, события storage
   * приходят как между вкладками (у автотеста одна страница на браузер, вторую вкладку открыть нельзя).
   */
  const openTab = async () => {
    const h = await page.evaluateHandle((src) => {
      const f = document.createElement('iframe');
      f.id = 'tab2';
      f.src = src;
      f.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;border:0;z-index:9999;background:#fff';
      document.body.appendChild(f);
      return f;
    }, page.url());
    const frame = await h.asElement().contentFrame();
    await frame.waitForLoadState('load');
    return frame;
  };
  const closeTab = async (frame) => {
    await frame.evaluate(() => (window.__dev.G.state = null)); // уходя, ничего не записывает
    await ev(() => document.getElementById('tab2').remove());
  };
  /** Маленький настоящий снимок (JPEG) с подписью. */
  const snap = (caption) =>
    ev((caption) => {
      const c = document.createElement('canvas');
      c.width = c.height = 48;
      const x = c.getContext('2d');
      x.fillStyle = '#ffb3c1';
      x.fillRect(0, 0, 48, 48);
      x.fillStyle = '#333';
      x.fillText(caption.slice(0, 4), 4, 24);
      return { day: 1, place: 'Вилла', date: 'Июнь', caption, src: c.toDataURL('image/jpeg', 0.7) };
    }, caption);

  await step('надёжность: снимки альбома — в IndexedDB: старые из localStorage переносятся сами, новые переживают перезагрузку, удалённая игра уносит снимки в корзину и возвращает', async () => {
    await fresh('Ириска');
    const gid = await ev(() => window.__dev.G.state.gid);
    // «старый» снимок — как его хранила прежняя версия игры, в localStorage
    const old = await snap('Старый снимок');
    await ev(([gid, old]) => localStorage.setItem('rhr-photos-' + gid, JSON.stringify([{ ...old, id: 'old1' }])), [gid, old]);
    await toTitle(); // при запуске игра сама переносит снимки в базу
    await page.waitForFunction(() => !Object.keys(localStorage).some((k) => k.startsWith('rhr-photos-')), null, { timeout: 5000 });
    await cont();
    await closeAll();
    let ph = await photos();
    expect(ph.store === 'idb', 'IndexedDB не работает — снимки идут запасным путём', ph);
    expect(ph.caps.join() === 'Старый снимок' && !ph.ls.length, 'старый снимок не перенёсся из localStorage', ph);
    // новый снимок — сразу в базу; в localStorage и в сохранении его нет
    const shot = await snap('Новый снимок');
    const r = await ev(async (shot) => (await import('/js/core/photos.js')).addPhoto(shot), shot);
    expect(r === 'ok', 'снимок не записался', r);
    ph = await photos();
    expect(ph.caps.join() === 'Старый снимок,Новый снимок' && !ph.ls.length, 'снимки после записи', ph);
    expect(!/data:image/.test(await ev(() => JSON.stringify(Object.entries(localStorage)))), 'снимок лежит в localStorage');
    await toTitle();
    await cont();
    await closeAll();
    // альбом после перезагрузки показывает оба снимка
    await ev(() => window.__dev.F.openAlbum('ph'));
    await page.waitForSelector('.ph-card', { timeout: 4000 });
    const cards = await ev(() => [...document.querySelectorAll('.ph-card')].map((c) => c.textContent));
    expect(cards.length === 2 && /Новый снимок/.test(cards[0]) && /Старый снимок/.test(cards[1]), 'альбом после перезагрузки', cards);
    await closeAll();
    // удалили игру — снимки ушли за ней в корзину; вернули — снимки снова при ней
    await toTitle();
    const back = await ev(async (gid) => {
      const g = window.__dev.games,
        P = await import('/js/core/photos.js');
      g.deleteGame(gid);
      const gone = (await P.loadPhotos(gid)).length,
        trash = (await P.loadPhotos('trash')).length;
      const r = await g.restoreTrash();
      return { gone, trash, r, now: (await P.loadPhotos(r.id)).length, list: g.listGames().map((x) => x.name) };
    }, gid);
    expect(back.gone === 0 && back.trash === 2 && back.r.ok && back.now === 2 && back.list.join() === 'Ириска', 'корзина и снимки', back);
    await wipe();
  });

  await step('надёжность: игра файлом — «⋯ → Сохранить в файл» в «Моих играх», подсказка для взрослых, после стирания данных «Загрузить игру из файла» возвращает игру и снимки; плохой файл — понятное окно, игры целы', async () => {
    await fresh('Ириска');
    await ev(() => window.__dev.actions.mutate((s) => (s.money = 4321)));
    const shot = await snap('Море');
    await ev(async (shot) => (await import('/js/core/photos.js')).addPhoto(shot), shot);
    await toTitle();
    await act('games');
    await page.waitForSelector('.g-card', { timeout: 4000 });
    const hint = await page.locator('.g-hint').innerText();
    expect(/Для взрослых/.test(hint) && /Safari/.test(hint) && /Сохранить в файл/.test(hint), 'нет подсказки для взрослых', hint);
    await page.click('.g-card .g-more');
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 8000 }), page.click('.g-card .g-save')]);
    // имя файла — из окна (Chromium без экрана заменяет русское имя загрузки на «download», настоящие браузеры — нет)
    await page.waitForSelector('.overlay:has-text("Игра сохранена в файл")', { timeout: 4000 });
    const fname = await ev(() => ([...document.querySelectorAll('.overlay')].pop().textContent.match(/«([^»]+\.json)»/) || [])[1]);
    expect(/^Пушистая жизнь - Ириска - \d{4}-\d\d-\d\d\.json$/.test(fname), 'имя файла', fname);
    expect([fname, 'download'].includes(dl.suggestedFilename()), 'имя загрузки', dl.suggestedFilename());
    const file = await dl.path();
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    expect(data.app === 'rhr-game' && data.save.money === 4321 && data.save.name === 'Ириска' && data.photos.length === 1, 'что в файле', { app: data.app, money: data.save && data.save.money, photos: data.photos && data.photos.length });
    await page.click('.overlay button:has-text("Понятно") >> nth=-1');
    // браузер стёр данные сайта: игр нет, на заставке — «Загрузить игру из файла»
    await wipe();
    await page.reload();
    await page.waitForSelector('#title .t-import', { timeout: 8000 });
    const pick = async (selector, payload) => {
      const [fc] = await Promise.all([page.waitForEvent('filechooser', { timeout: 8000 }), page.click(selector)]);
      const n = await ev(() => document.querySelectorAll('.overlay').length);
      await fc.setFiles(payload);
      await until((n) => document.querySelectorAll('.overlay').length > n, n, { timeout: 4000 }).catch(() => {}); // окно «загружена» или «не получилось»
    };
    await pick('#title .t-import', { name: fname, mimeType: 'application/json', buffer: fs.readFileSync(file) });
    expect(/Игра загружена/.test(await panelTitles()), 'нет окна «Игра загружена!»', await panelTitles());
    const okText = await ev(() => document.querySelector('.overlay .panel-body').textContent);
    expect(/Ириска/.test(okText) && /снимки/.test(okText), 'окно не говорит, чья игра и про снимки', okText);
    await page.click('.overlay button:has-text("Ура!")');
    await until(() => /С возвращением/.test(document.querySelector('#title').textContent), undefined, { timeout: 3000 }).catch(() => {});
    expect(/С возвращением, Ириска/.test(await sub()), 'загруженная игра не стала последней', await sub());
    const st = await ev(() => ({ n: window.__dev.games.listGames().length, money: window.__dev.G.state.money, gid: window.__dev.G.state.gid }));
    expect(st.n === 1 && st.money === 4321, 'загруженная игра', st);
    expect((await photos(st.gid)).caps.join() === 'Море', 'снимки из файла не вернулись', await photos(st.gid));
    // второй раз тот же файл — добавляется ещё одна игра, первая не тронута; плохой файл — окно, ничего не меняется
    await act('games');
    await page.waitForSelector('.g-card', { timeout: 4000 });
    await pick('.panel-foot button:has-text("Загрузить из файла")', { name: fname, mimeType: 'application/json', buffer: fs.readFileSync(file) });
    await page.click('.overlay button:has-text("Ура!")');
    await until(() => document.querySelectorAll('.g-card').length === 2, undefined, { timeout: 3000 }).catch(() => {});
    expect((await page.locator('.g-card').count()) === 2, 'вторая загрузка не добавила игру', await page.locator('.g-card').count());
    const before = await ev(() => JSON.stringify(Object.entries(localStorage).sort()));
    for (const bad of ['это не игра', '{"app":"rhr-game","save":{"v":"x"}}']) {
      await pick('.panel-foot button:has-text("Загрузить из файла")', { name: 'кот.json', mimeType: 'application/json', buffer: Buffer.from(bad) });
      const t = await ev(() => [...document.querySelectorAll('.overlay')].pop().textContent);
      expect(/Не получилось загрузить/.test(t) && /кот\.json/.test(t) && /Твои игры целы/.test(t), 'плохой файл: нет понятного окна', t);
      await page.click('.overlay button:has-text("Понятно") >> nth=-1');
      await untilWindows(1); // осталось окно «Мои игры»
    }
    const newer = JSON.stringify({ ...data, build: 99999 });
    await pick('.panel-foot button:has-text("Загрузить из файла")', { name: fname, mimeType: 'application/json', buffer: Buffer.from(newer) });
    const t = await ev(() => [...document.querySelectorAll('.overlay')].pop().textContent);
    expect(/более новой игре/.test(t) && /Обнови/.test(t), 'файл новее игры: нет понятного окна', t);
    await page.click('.overlay button:has-text("Потом")');
    await untilWindows(1);
    expect((await ev(() => JSON.stringify(Object.entries(localStorage).sort()))) === before, 'плохой файл изменил хранилище');
    await closeAll();
    await wipe();
  });

  await step('надёжность: вторая вкладка — первая перестаёт сохранять и показывает окно «Игра открыта дважды»; «Играть здесь» возвращает игру этой вкладке', async () => {
    await fresh('Ириска');
    await ev(() => window.__dev.actions.mutate((s) => (s.money = 1000)));
    await ev(() => window.dispatchEvent(new Event('pagehide'))); // записать
    const live = () => ev(() => JSON.parse(localStorage.getItem('rhr-save-v1')).money);
    expect((await live()) === 1000, 'первая вкладка не сохранила', await live());
    // вторая вкладка: та же игра, «Продолжить»
    const tab2 = await openTab();
    await tab2.waitForSelector('#title .t-menu button', { timeout: 8000 });
    expect((await ev(() => document.querySelectorAll('.overlay').length)) === 0, 'окно появилось, хотя во второй вкладке ещё не играют');
    await tab2.click(sel('continue'));
    await page.waitForSelector('.overlay:has-text("Игра открыта дважды")', { timeout: 6000 });
    // первая вкладка больше ничего не пишет
    await tab2.evaluate(() => window.__dev.actions.mutate((s) => (s.money = 2000)));
    await tab2.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    await ev(() => window.__dev.actions.mutate((s) => (s.money = 5)));
    await ev(() => window.dispatchEvent(new Event('pagehide')));
    await wait(300);
    expect((await live()) === 2000, 'первая вкладка затёрла сохранение второй', await live());
    // вторая вкладка закрыта; «Играть здесь»: страница перезагружается, «Продолжить» — последняя запись, игра снова её
    await closeTab(tab2);
    await page.click('.overlay button:has-text("Играть здесь")');
    await page.waitForSelector('#title .t-menu button', { timeout: 8000 });
    await cont();
    expect((await ev(() => window.__dev.G.state.money)) === 2000, 'после «Играть здесь» открылась не последняя запись', await ev(() => window.__dev.G.state.money));
    // и наоборот: теперь, если игру продолжат в другой вкладке, окно получит та, что играла раньше, — проверено выше
    await closeAll();
    await ev(() => window.__dev.actions.mutate((s) => (s.money = 3000)));
    await ev(() => window.dispatchEvent(new Event('pagehide')));
    expect((await live()) === 3000, 'вкладка, которой вернули игру, не сохраняет', await live());
  });

  await step('надёжность: старая сборка — сохранение от более новой игры не открывается и не перезаписывается (заставка просит обновить), а во время игры появляется окно «Игра обновилась»', async () => {
    await fresh('Ириска');
    await ev(() => window.dispatchEvent(new Event('pagehide')));
    const build = await ev(() => JSON.parse(localStorage.getItem('rhr-save-v1')).build);
    expect(Number.isInteger(build) && build > 0, 'в сохранении нет номера сборки', build);
    // во время игры: страница с более новым кодом (другая вкладка) записала себя и своё сохранение
    const tab2 = await openTab();
    await tab2.waitForSelector('#title', { timeout: 8000 });
    const newer = await tab2.evaluate((build) => {
      const s = JSON.parse(localStorage.getItem('rhr-save-v1'));
      s.build = build + 1;
      s.money = 7777;
      const raw = JSON.stringify(s);
      localStorage.setItem('rhr-owner', `новая:${build + 1}:${Date.now()}`);
      localStorage.setItem('rhr-save-v1', raw);
      return raw;
    }, build);
    await closeTab(tab2);
    await page.waitForSelector('.overlay:has-text("Игра обновилась")', { timeout: 6000 });
    const t = await ev(() => [...document.querySelectorAll('.overlay')].pop().textContent);
    expect(/перезагрузи страницу/.test(t), 'окно не просит перезагрузить страницу', t);
    await ev(() => window.__dev.actions.mutate((s) => (s.money = 1)));
    await ev(() => window.dispatchEvent(new Event('pagehide')));
    await wait(300);
    expect((await ev(() => localStorage.getItem('rhr-save-v1'))) === newer, 'старая страница перезаписала сохранение более новой игры');
    // «Обновить»: страница та же (код «старый») — заставка не открывает игру и просит обновить, сохранение цело
    await page.click('.overlay button:has-text("Обновить")');
    await page.waitForSelector('#title .t-menu button', { timeout: 8000 });
    expect(/Игра обновилась/.test(await sub()) && (await page.locator('#title button:has-text("Обновить")').count()) === 1, 'заставка не просит обновить страницу', await sub());
    expect((await page.locator('#title button:has-text("Продолжить")').count()) === 0, 'игру более новой сборки можно «Продолжить»');
    expect((await ev(() => localStorage.getItem('rhr-save-v1'))) === newer, 'заставка изменила сохранение более новой игры');
    await wipe();
  });
};
