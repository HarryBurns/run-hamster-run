// Шаги автотеста по багам от заказчика (после третьего обновления):
//   показ мод — после показа (крестик, итог, перезагрузка посреди показа) на хомячке её собственный наряд;
//   звёздочка задания «покажись жителю» — там, где житель на самом деле (в гостях, дома, в отеле, в городе).
// Подключается из dev/smoke.js. Только эти шаги:  node dev/smoke.js <url> "step:заказчик:"
const lib = require('./lib.js');

module.exports = async function zfix(ctx) {
  const { page, step, ev, until, expect, fresh, frames, mgGo, mgDone, mgClose, reload, closeAll, untilPanel } =
    lib(ctx);

  // ---------- показ мод: наряд игрока не меняется ----------
  const outfit = () => ev(() => JSON.stringify(window.__dev.G.state.look.outfit));
  /** Показ мод: начать, открыть шкаф и надеть соломенную шляпу (её до показа не было на голове). */
  const showAndDress = async () => {
    await ev(() => {
      window.__dev.F.playMinigame('fashion');
    });
    await mgGo();
    await page.click('#mg button:has-text("Переодеться")');
    await untilPanel('Тема');
    await page.click('.overlay .card:has-text("Соломенная шляпа")');
    await frames(2);
    expect(
      await ev(
        () =>
          !!document.querySelector('.overlay .card.sel') &&
          /Соломенная/.test(document.querySelector('.overlay .card.sel').textContent),
      ),
      'в шкафу показа шляпа не надета (проверка не годится)',
    );
  };
  const freshShow = async () => {
    await fresh({ day: 18, minutes: 12 * 60, weather: 'sun', dayFlags: true });
    await ev(() => {
      const a = window.__dev.actions;
      a.addClothes('sunhat');
      a.wear('head', null);
    });
    return outfit();
  };

  await step('заказчик: показ мод — после итога на хомячке тот наряд, что был до показа', async () => {
    const before = await freshShow();
    await showAndDress();
    expect((await outfit()) === before, 'шкаф показа переодел саму хомячку', await outfit());
    await page.click('.overlay .btn:has-text("Готово")');
    await until(() => !document.querySelector('.overlay'), undefined, { timeout: 3000 });
    await page.click('#mg button:has-text("На подиум")');
    await page.waitForSelector('#mg button:has-text("Дальше")', { timeout: 15000 });
    await page.click('#mg button:has-text("Дальше")');
    await mgDone();
    await closeAll();
    expect((await outfit()) === before, 'после показа мод на хомячке остался наряд показа', await outfit());
    expect(await ev(() => (window.__dev.G.state.plays.fashion || 0) >= 1), 'показ не засчитался (проверка не годится)');
  });

  await step('заказчик: показ мод — закрыла крестиком посреди показа: наряд свой', async () => {
    const before = await freshShow();
    await showAndDress();
    await page.click('.overlay .btn:has-text("Готово")'); // шкаф
    await until(() => !document.querySelector('.overlay'), undefined, { timeout: 3000 });
    await mgClose();
    await closeAll();
    expect((await outfit()) === before, 'после крестика на хомячке наряд показа', await outfit());
  });

  await step('заказчик: показ мод — перезагрузка посреди показа: наряд не потерялся', async () => {
    const before = await freshShow();
    await showAndDress();
    await reload();
    await closeAll();
    expect((await outfit()) === before, 'после перезагрузки посреди показа наряд хомячки потерялся', await outfit());
  });
};
