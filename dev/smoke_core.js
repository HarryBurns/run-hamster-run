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
    await page.keyboard.press('KeyE');
    await wait(600);
    const r = await ev(() => {
      window.__nearOn = false;
      return window.__nearTest.join();
    });
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
};
