// Шаги автотеста по багу от заказчика «пустая игра»: на телефоне при самом первом открытии заставка говорила
// «С возвращением, Хомка!», а в «Моих играх» уже была игра. Теперь до конца вступительной сценки новой игры (З23; или
// «Загрузить из файла», или «Открыть» в «Моих играх») в хранилище не пишется ни живое сохранение, ни список игр
// (core/save.js: holdSave; core/games.js: prepareGame / commitGame), а
// игра, которую записали, но которая так и не дошла до виллы (core/games.js: blankGame), при открытии заставки
// убирается. Проверяется на обоих размерах (компьютер и телефон с касанием).
// Подключается из dev/smoke.js. Только эти шаги:  node dev/smoke.js <url> "step:первое открытие"
const lib = require('./lib.js');

module.exports = async function phantom(ctx) {
  const L = lib(ctx);
  const { page, step, ev, wait, expect, act, sel, until, untilScene, closeAll } = L;
  /** Что лежит в хранилище про игры: ключи сохранений, списка и полок; число игр в списке; текст заставки. */
  const look = () =>
    ev(() => {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (/^rhr-(save-v1|games|game-|owner)/.test(k)) keys.push(k);
      }
      const menu = document.querySelector('#title .t-menu');
      return {
        keys: keys.sort(),
        games: window.__dev.games.listGames().length,
        text: menu ? menu.textContent : '',
        play: !!document.querySelector('#title [data-act="play"]'),
        input: !!document.querySelector('#title input'),
      };
    });
  /** Заставка без игр: «Как зовут…», поле имени, «Играть!», игр нет, хранилище без игр. */
  const noGames = async (when) => {
    const r = await look();
    expect(
      r.play && r.input && r.text.includes('Как тебя зовут') && !r.text.includes('С возвращением'),
      `${when}: заставка не спрашивает имя`,
      r.text,
    );
    expect(r.games === 0 && !r.keys.length, `${when}: в хранилище появилась игра`, r);
  };
  const reload = async () => {
    await page.reload();
    await page.waitForSelector('#title .t-menu button');
  };
  /** Свернуть вкладку и развернуть снова (как переключиться в другое приложение на телефоне). */
  const hideShow = () =>
    ev(() => {
      const set = (v) => Object.defineProperty(document, 'hidden', { value: v, configurable: true });
      const vis = (v) => Object.defineProperty(document, 'visibilityState', { value: v, configurable: true });
      set(true);
      vis('hidden');
      document.dispatchEvent(new Event('visibilitychange'));
      window.dispatchEvent(new Event('pagehide'));
      set(false);
      vis('visible');
      document.dispatchEvent(new Event('visibilitychange'));
      window.dispatchEvent(new Event('pageshow'));
      delete document.hidden;
      delete document.visibilityState;
    });
  const tapScene = async () => {
    const v = page.viewportSize();
    const touch = await ev(() => navigator.maxTouchPoints > 0 || 'ontouchstart' in window);
    // по сцене за кнопками (хомячок, море, облака) — не по меню
    for (const [x, y] of [
      [0.2, 0.3],
      [0.5, 0.45],
      [0.8, 0.25],
    ]) {
      if (touch) await page.touchscreen.tap(v.width * x, v.height * y);
      else await page.mouse.click(v.width * x, v.height * y);
      await wait(120);
    }
  };

  await step(
    'первое открытие: чистое хранилище — заставка спрашивает имя; ожидание, нажатия, свернуть, поворот, перезагрузка ничего не пишут; во время сценки — тоже, после неё — одна игра',
    async () => {
      await L.blank();
      await noGames('сразу');
      await wait(1500);
      await tapScene();
      await noGames('после нажатий по заставке');
      await hideShow();
      await noGames('свернули и развернули');
      const v = page.viewportSize();
      await page.setViewportSize({ width: v.height, height: v.width }); // повернули экран
      await wait(400);
      await page.setViewportSize(v);
      await wait(300);
      await noGames('повернули экран');
      await reload(); // уходящая заставка (pagehide) ничего не записывает
      await noGames('перезагрузили');
      await hideShow();
      await reload();
      await noGames('свернули, перезагрузили');
      // «Играть!» — идёт вступительная сценка: игра ещё не записана (З23); пропустили сценку — теперь игра одна
      await act('play');
      await until(() => !!document.getElementById('intro'), undefined, 'сценка');
      await hideShow(); // уход со страницы во время сценки тоже ничего не пишет
      let r = await look();
      expect(!r.keys.length && r.games === 0, 'во время вступительной сценки игра уже записана', r);
      await act('skip');
      r = await look();
      expect(r.keys.includes('rhr-save-v1') && r.games === 1, 'после сценки игры нет', r);
      await act('go');
      await untilScene('villa');
      await closeAll();
      await ev(() => window.dispatchEvent(new Event('pagehide')));
      await reload();
      r = await look();
      expect(
        r.games === 1 && r.text.includes('С возвращением, Хомка') && (await L.hasAct('continue')),
        'начатая игра не открывается «Продолжить»',
        r,
      );
    },
  );

  await step(
    'первое открытие: «Играть!» и закрыли во время сценки, пустую игру записала прежняя страница — снова «Как зовут…», настоящая игра рядом цела',
    async () => {
      // нажали «Играть!» и перезагрузили посреди вступительной сценки: игра так и не началась
      await L.blank();
      await act('play');
      await until(() => !!document.getElementById('intro'), undefined, 'сценка');
      await reload();
      await noGames('перезагрузили во время сценки');
      // пустая «Хомка», записанная как живое сохранение (так её могла записать прежняя версия страницы)
      await ev(() => {
        const d = window.__dev;
        d.games.createGame('Хомка');
        d.G.state = null;
      });
      await reload();
      await noGames('пустая игра в хранилище');
      // настоящая игра «Аня» и рядом пустая «Хомка» (живая): пустая убирается, «Продолжить» — «Аня»
      await L.fresh({ name: 'Аня' });
      const ann = await ev(() => {
        const d = window.__dev;
        d.actions.earn(55, 'gift');
        window.dispatchEvent(new Event('pagehide')); // записать сейчас (как при уходе со страницы)
        const id = d.G.state.gid;
        d.games.createGame('Хомка');
        d.G.state = null;
        return id;
      });
      await reload();
      const r = await look();
      expect(
        r.games === 1 && r.text.includes('С возвращением, Аня') && r.keys.includes('rhr-save-v1'),
        'настоящая игра пропала или пустая осталась',
        r,
      );
      const s = await ev(() => JSON.parse(localStorage.getItem('rhr-save-v1')));
      expect(s.gid === ann && s.name === 'Аня' && s.money === 3055, 'живое сохранение — не «Аня»', s);
    },
  );
};
