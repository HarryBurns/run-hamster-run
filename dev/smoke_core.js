// Шаги автотеста быстрых исправлений «основы» (ревью основы, второе обновление): клавиша E в обустройстве и
// у нескольких частей локации, окна и сон не замораживают игру при ошибке, сохранение при переполненном
// хранилище, ловля ошибок вне кадра, нечитаемое сохранение.
// Подключается из dev/smoke.js. Только эти шаги:  node dev/smoke.js <url> "step:основа:"
const lib = require('./lib.js');

module.exports = async function core(ctx) {
  const { page, step, ev, wait, closeAll, expect, panelTitles, fresh: newGame, blank, act, sel, until, untilPanel, untilDialog, frames, go } = lib(ctx);
  const fresh = () => newGame({ minutes: 12 * 60, weather: 'sun', dayFlags: true }); // 1 июня, полдень
  const paused = () => ev(() => window.__dev.G.modal);

  await step('основа: клавиша E в режиме «Обустроить» мебелью не пользуется, без него — пользуется', async () => {
    await fresh();
    await ev(() => window.__dev.evening()); // спать можно только вечером (этап 18)
    await ev(() => window.__dev.villaAt(1, 270)); // у кровати
    await frames(3);
    await ev(() => window.__dev.Villa.setDecor(true));
    await frames(2);
    await page.keyboard.press('KeyE');
    await wait(500); // окна быть не должно — ждём, не появится ли
    expect(!/Пора спать/.test(await panelTitles()), 'в обустройстве E открыла окно кровати', await panelTitles());
    await ev(() => window.__dev.Villa.setDecor(false));
    await frames(2);
    await page.keyboard.press('KeyE');
    await untilPanel('Пора спать').catch(() => {});
    expect(/Пора спать/.test(await panelTitles()), 'без обустройства E у кровати не спросила про сон', await panelTitles());
    await closeAll();
  });

  await step('основа: клавиша E в локации выбирает ближайшую из частей, а не последнюю в списке', async () => {
    await fresh();
    await go('world');
    await ev(() => window.__dev.World.debugTeleport(40, 52)); // на тропинке, вдали от дверей и мест
    await frames(3);
    // две пробные общие части: ближняя добавлена раньше, дальняя — позже (раньше побеждала последняя)
    const got = await ev(() => {
      const d = window.__dev;
      window.__nearTest = [];
      if (!window.__nearParts) {
        window.__nearParts = true;
        d.topdown.addWorldPart({ near: () => (window.__nearOn ? { d: 0.01, pending: { fn: () => window.__nearTest.push('ближняя') } } : null) });
        d.topdown.addWorldPart({ near: () => (window.__nearOn ? { d: 0.02, pending: { fn: () => window.__nearTest.push('дальняя') } } : null) });
      }
      window.__nearOn = true;
      return true;
    });
    expect(got, 'не получилось добавить пробные части');
    // окно из очереди (письмо, сосед) может появиться в любой момент и перехватить E — тогда закрыть и ещё раз
    let r = '';
    for (let i = 0; i < 4 && !r; i++) {
      await closeAll();
      await page.keyboard.press('KeyE');
      await until(() => window.__nearTest.length, undefined, { timeout: 1500 }).catch(() => {});
      r = await ev(() => window.__nearTest.join());
    }
    await ev(() => (window.__nearOn = false));
    expect(r === 'ближняя', 'E выбрала не ближайшую часть', r);
    await closeAll();
  });

  await step(
    'основа: окно и диалог с ошибкой при рисовании не оставляют игру на паузе',
    async () => {
      await fresh();
      // диалог с испорченной внешностью: портрет по умолчанию, окно на экране, закрывается — пауза снимается
      await ev(() => {
        const look = {
          get outfit() {
            throw new Error('проба: внешность испорчена');
          },
        };
        window.__dev.ui.dialog({ look, name: 'Проба', text: 'Привет!' });
      });
      await untilDialog().catch(() => {});
      expect(await ev(() => !!document.querySelector('.dialog')), 'диалог с испорченной внешностью не появился');
      await page.click('.dialog .btn');
      await until(() => !document.querySelector('.dialog'), undefined, { timeout: 2000 }).catch(() => {});
      expect((await paused()) === 0, 'после диалога игра на паузе', await paused());
      // окно, у которого render бросает исключение: текст «не получилось показать», ✕ закрывает, счётчики в нуле
      await ev(() => {
        window.__dev.ui.openPanel({
          title: 'Проба',
          render: () => {
            throw new Error('проба: окно не рисуется');
          },
        });
      });
      await untilPanel('Проба').catch(() => {});
      const t = await ev(() => (document.querySelector('.overlay .panel-body') || { textContent: '' }).textContent);
      expect(/не получилось показать/.test(t), 'в окне с ошибкой нет пояснения', t);
      await page.click('.overlay .xbtn');
      await until(() => !document.querySelector('.overlay'), undefined, { timeout: 2000 }).catch(() => {});
      const r = await ev(() => ({ modal: window.__dev.G.modal, win: document.body.classList.contains('win-open') }));
      expect(r.modal === 0 && !r.win, 'после окна с ошибкой остались пауза или отметка «окно открыто»', r);
      // окно с испорченным портретом в шапке — открывается
      await ev(() => {
        const portrait = {
          get outfit() {
            throw new Error('проба: портрет испорчен');
          },
        };
        window.__dev.ui.openPanel({ title: 'Портрет', portrait, render: (b) => (b.textContent = 'ок') });
      });
      await untilPanel('Портрет').catch(() => {});
      expect(/Портрет/.test(await panelTitles()), 'окно с испорченным портретом не открылось');
      await closeAll();
      expect((await paused()) === 0, 'после окон игра на паузе', await paused());
    },
    { expectErrors: 'проба' },
  );

  await step(
    'основа: ошибка в новом дне не оставляет чёрный экран сна',
    async () => {
      await fresh();
      await ev(() => window.__dev.evening()); // спать можно только вечером (этап 18)
      const day = await ev(() => window.__dev.G.state.day);
      await ev(() => {
        window.__sleepDone = 'ждём';
        Promise.resolve(window.__dev.run('sleep')).then(
          () => (window.__sleepDone = 'ок'),
          (e) => (window.__sleepDone = 'ошибка: ' + e.message),
        );
      });
      await untilPanel('Пора спать');
      await act('ok', '.overlay .panel-foot'); // «Спать 😴»
      // пока экран темнеет — подкладываем поломку: первое же чтение отметки дня бросит исключение (и уберёт себя)
      await ev(() =>
        Object.defineProperty(window.__dev.G.state.dayFlags, 'careless', {
          configurable: true,
          get() {
            delete this.careless;
            throw new Error('проба: новый день не наступил');
          },
        }),
      );
      await until(() => window.__sleepDone !== 'ждём' && !document.querySelector('.fade') && !window.__dev.G.modal, undefined, { timeout: 6000 }).catch(() => {});
      const r = await ev(() => ({
        done: window.__sleepDone,
        modal: window.__dev.G.modal,
        cover: window.__dev.G.cover,
        fade: !!document.querySelector('.fade'),
      }));
      expect(/проба/.test(r.done), 'сон с ошибкой не сообщил об ошибке (проверка не годится)', r);
      expect(r.modal === 0 && r.cover === 0 && !r.fade, 'после ошибки в новом дне остался чёрный экран или пауза', r);
      // игра живёт: можно снова лечь спать, и день сменится
      await ev(() => {
        window.__dev.evening();
        window.__dev.run('sleep'); // не ждём: askSleep ждёт ответа в окне
      });
      await untilPanel('Пора спать');
      await act('ok', '.overlay .panel-foot');
      await until((d) => window.__dev.G.state.day > d && !document.querySelector('.fade'), day, { timeout: 8000 }).catch(() => {});
      await closeAll();
      const d2 = await ev(() => window.__dev.G.state.day);
      expect(d2 > day, 'после неудачной ночи следующая не сменила день', { day, d2 });
    },
    { expectErrors: 'проба' },
  );

  await step('основа: хранилище переполнено — окно для взрослых один раз, изменения не теряются и записываются потом', async () => {
    await fresh();
    // забиваем хранилище до отказа (как снимками в альбоме)
    const n = await ev(() => {
      let n = 0;
      for (let size = 1 << 20; size >= 1; size >>= 1) {
        const chunk = 'ж'.repeat(size);
        for (;;)
          try {
            localStorage.setItem('__fill' + n, chunk);
            n++;
          } catch (e) {
            break;
          }
      }
      return n;
    });
    expect(n > 0, 'не получилось забить хранилище');
    const saved = () => ev(() => JSON.parse(localStorage.getItem('rhr-save-v1')).money);
    const before = await saved();
    await ev(() => window.__dev.actions.mutate((s) => (s.money += 1000000)));
    await untilPanel('не может сохраниться', 4000).catch(() => {});
    expect((await saved()) === before, 'сохранение записалось в переполненное хранилище (проверка не годится)');
    const t = await panelTitles();
    expect(/не может сохраниться/.test(t), 'нет окна «Игра не может сохраниться»', t);
    const body = await ev(() => document.querySelector('.overlay .panel-body').textContent);
    expect(/фото/.test(body) && /игры/.test(body), 'в окне не сказано, что удалить', body);
    await closeAll();
    // ещё изменение — второго окна за сеанс нет (+1 к 1 003 000 — длина та же, но запись и так в отказе)
    await ev(() => window.__dev.actions.mutate((s) => (s.money += 1)));
    await wait(1200);
    expect(!/не может сохраниться/.test(await panelTitles()), 'окно о сохранении показалось второй раз');
    // место освободили — игра сама дописывает сохранение (повтор не чаще раза в 5 с)
    await ev(() => {
      for (const k of Object.keys(localStorage)) if (k.startsWith('__fill')) localStorage.removeItem(k);
    });
    // повтор записи — раз в 5 с
    await until(() => JSON.parse(localStorage.getItem('rhr-save-v1')).money === window.__dev.G.state.money, undefined, { timeout: 9000 }).catch(() => {});
    const r = { mem: await ev(() => window.__dev.G.state.money), saved: await saved() };
    expect(r.mem === r.saved && r.saved === before + 1000001, 'после освобождения места сохранение не записалось', r);
  });

  await step('основа: первый жест просит браузер не стирать сохранения — тихо, и там, где этого не умеют', async () => {
    for (const mode of ['есть', 'нет']) {
      await ev(() => {
        window.__dev.G.state = null;
        localStorage.clear();
      });
      await page.reload();
      await page.waitForSelector(sel('play'));
      await ev((mode) => {
        window.__persistAsked = 0;
        if (mode === 'есть')
          navigator.storage.persist = () => {
            window.__persistAsked++;
            return Promise.resolve(true);
          };
        else Object.defineProperty(navigator, 'storage', { value: undefined, configurable: true });
      }, mode);
      await act('play');
      await act('skip');
      if (mode === 'есть') await until(() => window.__persistAsked > 0, undefined, { timeout: 2000 }).catch(() => {});
      await wait(150); // второго вызова быть не должно
      const asked = await ev(() => window.__persistAsked);
      if (mode === 'есть') expect(asked === 1, 'persist() не позвали ровно один раз', asked);
    }
    await page.reload(); // вернуть настоящий navigator.storage
    await page.waitForSelector('#title');
  });

  await step(
    'основа: ошибки вне кадра из наших файлов — окно «Что-то сломалось», чужие ошибки — нет',
    async () => {
      await fresh();
      const err = () => ev(() => /Что-то сломалось/.test([...document.querySelectorAll('.overlay .title')].map((e) => e.textContent).join()));
      // три чужие ошибки (как от расширения браузера) — окна нет
      await ev(() => {
        for (let i = 0; i < 3; i++)
          setTimeout(() => {
            throw new Error('Нет сцены «чужая»');
          }, i * 20);
      });
      await wait(500);
      expect(!(await err()), 'окно «Что-то сломалось» от чужих ошибок');
      // две ошибки в нашем коде (go в несуществующую сцену из таймера) — ещё не повод
      await ev(() => {
        setTimeout(() => window.__dev.go('нет-такой'), 0);
        setTimeout(() => window.__dev.go('нет-такой'), 30);
      });
      await wait(400);
      expect(!(await err()), 'окно «Что-то сломалось» после двух ошибок');
      // третья — необработанный отказ промиса с ошибкой из нашего кода
      await ev(() => {
        Promise.resolve().then(() => window.__dev.go('нет-такой'));
      });
      await untilPanel('Что-то сломалось', 3000).catch(() => {});
      expect(await err(), 'после трёх ошибок в нашем коде нет окна «Что-то сломалось»');
      await act('ok', '.overlay .panel-foot'); // «Домой»
      await until(() => window.__dev.G.modal === 0 && window.__dev.sceneName === 'villa', undefined, { timeout: 3000 }).catch(() => {});
      const r = await ev(() => ({ modal: window.__dev.G.modal, scene: window.__dev.sceneName }));
      expect(r.modal === 0 && r.scene === 'villa', 'после «Домой» игра не дома или на паузе', r);
    },
    { expectErrors: 'Нет сцены' },
  );

  await step('основа: нечитаемая игра — открывается копия с полки; нет копии — открывается другая, и заставка говорит о пропаже', async () => {
    const sub = () => ev(() => [...document.querySelectorAll('.sub')].map((e) => e.textContent).join(' | '));
    // две игры: «Аня» (последняя) и «Боря»; у «Ани» на полке целая копия с последнего переключения
    const ids = await ev(() => {
      const g = window.__dev.games;
      window.__dev.G.state = null;
      localStorage.clear();
      g.syncGames();
      g.createGame('Аня');
      const a = g.activeGame();
      g.createGame('Боря');
      const b = g.activeGame();
      g.switchGame(a);
      window.__dev.G.state = null; // уходящая страница не перезапишет сохранение
      localStorage.setItem('rhr-save-v1', '{"v":5,"name":"Аня",');
      return { a, b };
    });
    await page.reload();
    await page.waitForSelector(sel('continue'));
    let t = await sub();
    expect(/С возвращением, Аня/.test(t) && /запасной копии/.test(t), 'игра не открылась из копии с полки', t);
    let st = await ev((a) => ({ shelf: !!localStorage.getItem('rhr-game-' + a), backup: localStorage.getItem('rhr-save-backup') }), ids.a);
    expect(st.shelf && st.backup === '{"v":5,"name":"Аня",', 'копия с полки пропала или в запасе не то', st);
    // копии нет: открывается «Боря», а заставка говорит, что «Аню» открыть не получилось; её строка — на полке
    await ev((a) => {
      window.__dev.G.state = null;
      localStorage.removeItem('rhr-game-' + a);
      localStorage.setItem('rhr-save-v1', '{"v":5,"name":"Аня",');
    }, ids.a);
    await page.reload();
    await page.waitForSelector(sel('continue'));
    t = await sub();
    expect(/С возвращением, Боря/.test(t) && /Аня.*не получилось открыть/.test(t), 'заставка молчит о нечитаемой игре', t);
    st = await ev((a) => ({ shelf: localStorage.getItem('rhr-game-' + a), list: window.__dev.games.listGames().map((g) => g.name) }), ids.a);
    expect(st.shelf === '{"v":5,"name":"Аня",' && st.list.join() === 'Боря', 'нечитаемая игра не отложена на полку', st);
    await ev(() => {
      window.__dev.G.state = null;
      localStorage.clear();
    });
  });
};
