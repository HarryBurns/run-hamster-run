// Шаги автотеста этапа 20 «Проблемы на экране» (BACKLOG, В-пункты), где меняется поведение:
//   В12 — на планшете стоя дом движка домов виден целиком, а большой дом (вилла, отель) — камера видит хомячка;
//   В14 — кнопка места с морским путём на карте ведёт хомячка к кораблику на пирсе.
// Подключается из dev/smoke.js. Только эти шаги:  node dev/smoke.js <url> "step:экран"
module.exports = async function screen({ page, step, ev, wait, closeAll }) {
  const expect = (ok, msg, data) => {
    if (!ok) throw new Error(msg + (data === undefined ? '' : ': ' + JSON.stringify(data)));
  };
  const mutate = (fn) => ev((src) => window.__dev.actions.mutate(new Function('s', src)), fn);
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

  await step('экран В12: на iPad стоя одноэтажный дом виден целиком, в вилле и отеле камера видит хомячка', async () => {
    const size = page.viewportSize();
    await fresh();
    await page.setViewportSize({ width: 810, height: 1080 });
    await wait(300);
    try {
      // все одноэтажные дома (своё жильё, дома жителей, дома тайных мест): коробка дома целиком на экране
      const ids = await ev(() =>
        Object.keys(window.__dev.scenes).filter((n) => {
          const s = window.__dev.scenes[n];
          return s.geo && s.geo.floors === 1 && s.geo.WTOT <= 1530;
        }),
      );
      expect(ids.length >= 20, 'мало одноэтажных домов (проверка не годится)', ids);
      const cut = [];
      for (const id of ids) {
        await ev((id) => window.__dev.go(id), id);
        await wait(120);
        const r = await ev(() => {
          const s = window.__dev.scene,
            v = s.cam.visible(0);
          return { z: +s.cam.zoom.toFixed(3), x0: Math.round(v.x0), x1: Math.round(v.x1), W: s.geo.WTOT };
        });
        if (!(r.x0 <= -18 && r.x1 >= r.W + 18 && r.z >= 0.5)) cut.push({ id, ...r });
      }
      expect(!cut.length, 'дом на iPad стоя виден не целиком', cut);
      // вилла (3 этажа) и отель шире экрана: хомячок в дальнем углу верхнего этажа — на экране, не под кнопками
      for (const [id, f] of [
        ['villa', 2],
        ['hotel', 2],
      ]) {
        await ev(([id, f]) => {
          const d = window.__dev,
            W = d.scenes[id].geo.W;
          d.go(id, { pos: { scene: id, floor: f, x: W - 60 } });
        }, [id, f]);
        await wait(900);
        const r = await ev(() => {
          const s = window.__dev.scene,
            p = s.p,
            q = s.cam.toScreen(p.x, s.geo.fy(p.f) - 60),
            { w, h } = window.__dev.G.view;
          return { name: s.name, f: p.f, x: Math.round(q.x), y: Math.round(q.y), w, h, z: +s.cam.zoom.toFixed(3) };
        });
        expect(r.name === id && r.f === f, 'хомячок не там (проверка не годится)', r);
        expect(r.x > 60 && r.x < r.w - 60 && r.y > 100 && r.y < r.h - 100, `${id}: хомячок не на экране`, r);
        expect(r.z < 0.8, `${id}: на iPad стоя дом крупный, как на телефоне — видно мало`, r);
      }
    } finally {
      await page.setViewportSize(size);
      await wait(300);
    }
  });
};
