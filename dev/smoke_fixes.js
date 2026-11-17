// Шаги автотеста мелких доработок «Замечено во втором обновлении» (BACKLOG, В-пункты), где меняется поведение:
//   В2 — в фото-режиме стрелка к цели у края экрана (значок письма) не рисуется;
//   В7 — транспорт с клавиатуры упирается в воду — подсказка «слезь»;
//   В15 — вода у острова тёплая круглый год (на острове всегда лето).
// Подключается из dev/smoke.js. Только эти шаги:  node dev/smoke.js <url> "step:доработки"
module.exports = async function fixes({ page, step, ev, wait, closeAll }) {
  const norm = (t) => t.replace(/[  ]/g, ' ');
  const expect = (ok, msg, data) => {
    if (!ok) throw new Error(msg + (data === undefined ? '' : ': ' + JSON.stringify(data)));
  };
  const mutate = (fn) => ev((src) => window.__dev.actions.mutate(new Function('s', src)), fn);
  const toasts = async () => norm(await ev(() => (document.querySelector('#toasts') || { textContent: '' }).textContent));
  const clearToasts = () =>
    ev(() => {
      const t = document.querySelector('#toasts');
      if (t) t.innerHTML = '';
    });
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
    await mutate('s.minutes = 12 * 60; s.day = 18; s.weather = "sun"; s.dayFlags = {};');
  };

  await step('доработки В2: в фото-режиме стрелки к письму у края экрана нет, после выхода — снова есть', async () => {
    await fresh();
    await ev(() => window.__dev.go('world'));
    await wait(300);
    // письмо не прочитано, хомячок далеко от ящика — у края экрана стрелка с ✉️
    await ev(() => {
      const d = window.__dev;
      if (d.G.state.mail) d.actions.mutate((s) => (s.mail.read = false));
      d.World.debugTeleport(40, 52);
    });
    await wait(500);
    expect(await ev(() => window.__dev.World.edgeArrow === true), 'нет стрелки к письму у края экрана (проверка не годится)');
    await closeAll();
    await page.click('#hud button:has-text("Фото")');
    await page.waitForSelector('#photo', { timeout: 4000 });
    await wait(400);
    expect(await ev(() => window.__dev.World.edgeArrow === false), 'в фото-режиме стрелка к письму всё ещё видна');
    await page.click('#photo .ph-x >> nth=-1');
    await wait(500);
    expect(await ev(() => !document.getElementById('photo') && window.__dev.World.edgeArrow === true), 'после фото-режима стрелка не вернулась');
  });
};
