// Шаги автотеста быстрых исправлений «основы» (ревью основы, второе обновление): клавиша E в обустройстве и
// у нескольких частей локации, окна и сон не замораживают игру при ошибке, сохранение при переполненном
// хранилище, ловля ошибок вне кадра, нечитаемое сохранение.
// Подключается из dev/smoke.js. Только эти шаги:  node dev/smoke.js <url> "step:основа:"
module.exports = async function core({ page, step, ev, wait, closeAll }) {
  const expect = (ok, msg, data) => {
    if (!ok) throw new Error(msg + (data === undefined ? '' : ': ' + JSON.stringify(data)));
  };
  const panelTitles = () => ev(() => [...document.querySelectorAll('.overlay .panel-head .title')].map((e) => e.textContent).join('|'));
  const fresh = async () => {
    await ev(() => {
      window.__dev.G.state = null;
      localStorage.clear();
    });
    await page.reload();
    await wait(400);
    await page.click('text=Играть!');
    await page.click('text=Пропустить'); // вступительная сценка новой игры (этап 10)
    await page.evaluate(() => window.__dev.actions.setFlag('intro', 0));
    await wait(400);
    await page.click('text=Поехали!');
    await wait(500);
    await closeAll();
    await ev(() => window.__dev.actions.mutate((s) => ((s.minutes = 12 * 60), (s.weather = 'sun'), (s.dayFlags = {}))));
  };
  const paused = () => ev(() => window.__dev.G.modal);

  await step('основа: клавиша E в режиме «Обустроить» мебелью не пользуется, без него — пользуется', async () => {
    await fresh();
    await ev(() => window.__dev.villaAt(1, 270)); // у кровати
    await wait(300);
    await ev(() => window.__dev.Villa.setDecor(true));
    await wait(300);
    await page.keyboard.press('KeyE');
    await wait(500);
    expect(!/Пора спать/.test(await panelTitles()), 'в обустройстве E открыла окно кровати', await panelTitles());
    await ev(() => window.__dev.Villa.setDecor(false));
    await wait(300);
    await page.keyboard.press('KeyE');
    await wait(500);
    expect(/Пора спать/.test(await panelTitles()), 'без обустройства E у кровати не спросила про сон', await panelTitles());
    await closeAll();
  });

  await step('основа: клавиша E в локации выбирает ближайшую из частей, а не последнюю в списке', async () => {
    await fresh();
    await ev(() => window.__dev.go('world'));
    await wait(500);
    await ev(() => window.__dev.World.debugTeleport(40, 52)); // на тропинке, вдали от дверей и мест
    await wait(300);
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
      await wait(600);
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
      await wait(500);
      expect(await ev(() => !!document.querySelector('.dialog')), 'диалог с испорченной внешностью не появился');
      await page.click('.dialog .btn');
      await wait(300);
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
      await wait(400);
      const t = await ev(() => (document.querySelector('.overlay .panel-body') || { textContent: '' }).textContent);
      expect(/не получилось показать/.test(t), 'в окне с ошибкой нет пояснения', t);
      await page.click('.overlay .xbtn');
      await wait(300);
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
      await wait(300);
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
      const day = await ev(() => window.__dev.G.state.day);
      await ev(() => {
        window.__sleepDone = 'ждём';
        Promise.resolve(window.__dev.run('sleep')).then(
          () => (window.__sleepDone = 'ок'),
          (e) => (window.__sleepDone = 'ошибка: ' + e.message),
        );
      });
      await wait(500);
      await page.click('.overlay .panel-foot .btn >> nth=0'); // «Спать 😴»
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
      await wait(2600);
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
        window.__dev.run('sleep'); // не ждём: askSleep ждёт ответа в окне
      });
      await wait(500);
      await page.click('.overlay .panel-foot .btn >> nth=0');
      await wait(2800);
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
    await wait(1200);
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
    await wait(5800);
    const r = { mem: await ev(() => window.__dev.G.state.money), saved: await saved() };
    expect(r.mem === r.saved && r.saved === before + 1000001, 'после освобождения места сохранение не записалось', r);
  });
};
