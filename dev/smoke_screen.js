// Шаги автотеста этапа 20 «Проблемы на экране» (BACKLOG, В-пункты), где меняется поведение:
//   В12 — на планшете стоя дом движка домов виден целиком, а большой дом (вилла, отель) — камера видит хомячка;
//   В14 — кнопка места с морским путём на карте ведёт хомячка к кораблику на пирсе;
//   В21, П7 — правила «Носильщицы» и «Кристаллов» на телефоне без прокрутки, карточки в ряд;
//   Н3 — дом из кэша (engine/side/cache.js) без полосы пикселей у пола, которой нет при рисовании линиями.
// Подключается из dev/smoke.js. Только эти шаги:  node dev/smoke.js <url> "step:экран"
const lib = require('./lib.js');

module.exports = async function screen(ctx) {
  const { page, step, ev, wait, closeAll, expect, fresh: newGame, until, frames, go, teleport } = lib(ctx);
  const fresh = () => newGame({ day: 18, minutes: 12 * 60, weather: 'sun', dayFlags: true }); // июль, полдень

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
        await frames(3);
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

  await step('экран В14: кнопка места с морским путём на карте ведёт к кораблику, сажает в него и везёт к причалу, буйку или отметке', async () => {
    await fresh();
    await ev(() => {
      const d = window.__dev;
      for (const id of ['jungle', 'cove', 'island']) if (!d.QuestState.landOpen(id)) d.actions.openLand(id);
      d.go('world');
    });
    await frames(3);
    await closeAll();
    // нажать кнопку места в «карте мира» под картой города
    const press = async (name) => {
      await page.click('#hud button:has-text("Карта")');
      await page.waitForSelector('.overlay .lands-row button', { timeout: 4000 });
      const ok = await ev((name) => {
        const b = [...document.querySelectorAll('.overlay .lands-row button')].find((q) => q.textContent.includes(name));
        if (b) b.click();
        return !!b;
      }, name);
      expect(ok, `нет кнопки «${name}» на карте`);
      await wait(150);
    };
    const pos = () =>
      ev(() => {
        const d = window.__dev,
          W = d.World,
          p = W.p;
        return { scene: d.sceneName, x: p.x, y: p.y, path: p.path.length, boat: W.isBoating(), panel: !!document.querySelector('.overlay') };
      });
    // джунгли: хомячок у пирса пешком — идёт к кораблику, садится и плывёт к причалу, а там — в джунгли
    await teleport(63, 55);
    await press('Джунгли');
    let r = await pos();
    expect(!r.panel && r.path > 0 && !r.boat, 'хомячок не пошёл к кораблику (было только словами?)', r);
    let ok = false;
    for (let i = 0; i < 60 && !ok; i++) {
      await wait(250);
      r = await pos();
      ok = r.scene === 'jungle';
    }
    expect(ok, 'кнопка «Джунгли» не довезла до джунглей', r);
    // секретный пляж: уже на кораблике — сразу к буйку над гротом (быстрый переход: у кораблика уже была)
    await ev(() => {
      const d = window.__dev;
      d.actions.patchState('boat', { x: 66 * 48, y: 64 * 48, on: true });
      d.go('world', { pos: { scene: 'world', x: 66 * 48, y: 64 * 48 } });
    });
    await frames(3);
    await closeAll();
    expect(await ev(() => window.__dev.World.isBoating()), 'хомячок не на кораблике (проверка не годится)');
    await press('Секретный пляж');
    ok = false;
    for (let i = 0; i < 40 && !ok; i++) {
      await wait(250);
      r = await pos();
      ok = r.scene === 'cove';
    }
    expect(ok, 'кнопка «Секретный пляж» не довезла через грот', r);
    // удалённый остров: с пирса — к кораблику и на юг к отметке
    await ev(() => {
      const d = window.__dev;
      d.actions.patchState('boat', { x: 65.5 * 48, y: 61.5 * 48, on: false });
      d.go('world');
      d.World.debugTeleport(64, 58);
    });
    await frames(3);
    await closeAll();
    await press('Удалённый остров');
    ok = false;
    for (let i = 0; i < 80 && !ok; i++) {
      await wait(250);
      r = await pos();
      ok = r.scene === 'island';
      if (!ok && r.panel) await closeAll(); // окно «долгое плавание» — подтверждение, если есть
    }
    expect(ok, 'кнопка «Удалённый остров» не довезла до острова', r);
  });

  await step('экран Н3: дом из кэша совпадает с рисунком линиями — без полосы пикселей у пола', async () => {
    await fresh();
    const bad = [];
    for (const [id, f, x] of [
      ['hotel', 0, 300],
      ['villa', 0, 300],
      ['home_plusha', 0, 300],
      ['tent_barkhan', 0, 300],
    ]) {
      await ev(([id, f, x]) => window.__dev.go(id, { pos: { scene: id, floor: f, x } }), [id, f, x]);
      await wait(400);
      // один и тот же кадр (то же время) — с кэшем и линиями; сколько пикселей различается в каждой строке
      const r = await ev(() => {
        const d = window.__dev,
          sc = d.scene,
          v = d.G.view,
          dpr = v.dpr || 1;
        const mk = () => {
          const c = document.createElement('canvas');
          c.width = Math.round(v.w * dpr);
          c.height = Math.round(v.h * dpr);
          const x = c.getContext('2d', { willReadFrequently: true });
          x.setTransform(dpr, 0, 0, dpr, 0, 0);
          return [c, x];
        };
        const [c1, x1] = mk();
        sc.debugCache(false);
        sc.draw(x1);
        const [, x2] = mk();
        sc.debugCache(true);
        sc.draw(x2);
        sc.debugCache(false);
        const W = c1.width,
          H = c1.height,
          a = x1.getImageData(0, 0, W, H).data,
          b = x2.getImageData(0, 0, W, H).data;
        let row = 0,
          at = -1;
        for (let y = 0; y < H; y++) {
          let n = 0;
          for (let x = 0; x < W; x++) {
            const i = (y * W + x) * 4;
            if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 6) n++;
          }
          if (n > row) [row, at] = [n, y];
        }
        return { share: row / W, at, floorY: Math.round(sc.debugScreen(0, sc.geo.SLAB).y * dpr) };
      });
      if (r.share > 0.2) bad.push({ id, ...r });
    }
    expect(!bad.length, 'строка пикселей дома из кэша не как линиями', bad);
  });

  await step('экран В21, П7: правила «Носильщицы» и «Кристаллов» на телефоне стоя и лёжа — без прокрутки, «Начать!» на экране', async () => {
    const size = page.viewportSize();
    await fresh();
    const bad = [];
    try {
      for (const [w, h] of [
        [390, 844],
        [844, 390],
      ]) {
        await page.setViewportSize({ width: w, height: h });
        await frames(2);
        for (const id of ['porter', 'crystals']) {
          await ev((id) => {
            window.__dev.F.playMinigame(id);
          }, id);
          await page.waitForSelector('.mg-card [data-act=start]', { timeout: 5000 });
          await frames(2);
          const r = await ev(() => {
            const t = document.querySelector('.mg-card .mg-text'),
              b = document.querySelector('.mg-card [data-act=start]').getBoundingClientRect(),
              cols = [...document.querySelectorAll('.mg-card .pt-col, .mg-card .cr-col')].map((c) => Math.round(c.getBoundingClientRect().top));
            return { scroll: t.scrollHeight - t.clientHeight, btn: Math.round(b.bottom), vh: innerHeight, row: new Set(cols).size === 1 };
          });
          if (r.scroll > 4 || r.btn > r.vh || !r.row) bad.push({ id, w, h, ...r });
          await ev(() => document.querySelector('#mg .xbtn, #mg .mg-head button').click());
          await until(() => !document.querySelector('#mg'), undefined, { timeout: 3000 }).catch(() => {});
        }
      }
    } finally {
      await page.setViewportSize(size);
      await wait(300);
    }
    expect(!bad.length, 'правила мини-игры на телефоне не помещаются (или карточки не в ряд)', bad);
  });
};
