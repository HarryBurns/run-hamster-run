// Шаги автотеста правок рисунка по замечаниям заказчика (второе обновление):
//   - настенные предметы (часы, картины, зеркала…) в начале игры и в домах жителей не налезают на окна; в старой игре
//     часы виллы со старого места на окне гостиной переезжают (core/repair.js); в «Обустроить» настенное на окно не
//     вешается — рамка красная, знак «нельзя», отпущенное возвращается на стену рядом (engine/side/decor.js);
//   - земля города: под прудом не лежит плитка у бассейна, под грядкой — пруд (слой лежит только под тем, что на нём
//     стоит: engine/topdown/ground.js, layerMask), а под пирсом песок пляжа остаётся;
//   - хомячок на лежаке загорает поверх полотенца, а не укрыт им; у сахара — рисованный значок «мешочек».
// Подключается из dev/smoke.js. Только эти шаги:  node dev/smoke.js <url> "step:рисунок:"
const fs = require('fs');
const path = require('path');
const lib = require('./lib.js');

const SAVE_V5 = fs.readFileSync(path.join(__dirname, 'saves', 'v5.json'), 'utf8');
/** Свои дома с «Обустроить» (interiors/*.js: furniture.editable). */
const EDITABLE = ['villa', 'flat', 'bungalow', 'suite', 'penthouse', 'cabin'];

/**
 * В странице: настенные предметы, которые налезают на окно, во всех домах «движка домов» (своя мебель — как в начале
 * игры, мебель жителей — из описания). Окно — рама: x ± (половина стекла + 8), от 104 до 208 над полом
 * (engine/side/rooms.js, windowAt); предмет — прямоугольник w × h с центром на высоте y над полом.
 */
async function wallOverWindows() {
  const d = window.__dev;
  const { FURN_BY_ID } = await import('/js/data/index.js');
  const bad = [];
  let checked = 0;
  for (const sc of Object.values(d.scenes)) {
    const desc = sc && sc.desc;
    if (!desc || !desc.rooms) continue;
    const furn = desc.furniture || {};
    const list =
      furn.key === 'villa'
        ? d.G.state.villa
        : (furn.fixed || furn.start || []).map(([id, floor, x, y]) => ({ id, floor, x, y: y || 0 }));
    for (const it of list) {
      const def = FURN_BY_ID[it.id];
      if (!def || !def.wall) continue;
      checked++;
      const x0 = it.x - def.w / 2,
        x1 = it.x + def.w / 2,
        y0 = it.y - def.h / 2,
        y1 = it.y + def.h / 2;
      for (const r of desc.rooms) {
        if (r.f !== it.floor || !r.win) continue;
        const hw = (r.winW || 88) / 2;
        for (const wx of [].concat(r.win))
          if (x1 > wx - hw - 8 && x0 < wx + hw + 8 && y1 > 104 && y0 < 208)
            bad.push(`${desc.id}: ${it.id} (этаж ${it.floor}, x ${it.x}) на окне x ${wx}`);
      }
    }
  }
  return { bad, checked };
}

module.exports = async function draw(ctx) {
  const {
    page,
    step,
    ev,
    wait,
    expect,
    fresh: newGame,
    sel,
    cont,
    closeAll,
    go,
    frames,
    until,
    toasts,
    clearToasts,
  } = lib(ctx);

  await step('рисунок: настенные предметы не налезают на окна — вилла в начале игры и дома жителей', async () => {
    await newGame({ minutes: 12 * 60, weather: 'sun' });
    const r = await ev(wallOverWindows);
    expect(r.checked > 10, 'настенных предметов почти нет — проверка не годится', r);
    expect(!r.bad.length, 'настенный предмет на окне', r.bad);
  });

  await step('рисунок: старая игра — часы виллы уходят с окна гостиной над телевизор', async () => {
    expect(SAVE_V5.includes('"clock","floor":0,"x":660,"y":185'), 'в образце часы не на старом месте — не годится');
    await ev((raw) => {
      window.__dev.G.state = null;
      localStorage.clear();
      localStorage.setItem('rhr-save-v1', raw);
    }, SAVE_V5);
    await page.reload();
    await page.waitForSelector(sel('continue'));
    await cont();
    await closeAll();
    const c = await ev(() => window.__dev.G.state.villa.find((i) => i.id === 'clock'));
    expect(c && c.floor === 0 && c.x === 800 && c.y === 190, 'часы остались на старом месте', c);
    const r = await ev(wallOverWindows);
    expect(!r.bad.length, 'настенный предмет на окне', r.bad);
  });

  await step('рисунок: «Обустроить» — настенное на окно не вешается, во всех своих домах', async () => {
    await newGame({ minutes: 12 * 60, weather: 'sun' });
    await ev((ids) => ids.forEach((id) => id !== 'villa' && window.__dev.actions.addHome(id)), EDITABLE);
    for (const id of EDITABLE) {
      await go(id);
      await ev(() => window.__dev.actions.mutate((s) => (s.storage = { clock: 1 })));
      await ev(() => window.__dev.scene.setDecor(true));
      await until(() => document.querySelector('.decor-tray .tray-item'), undefined, { msg: id + ': кладовка' });
      // камера — на окне первого попавшегося этажа с окном; часы из кладовки встают посередине экрана
      const win = await ev(() => {
        const sc = window.__dev.scene,
          r = sc.desc.rooms.find((q) => q.win),
          wx = [].concat(r.win)[0];
        sc.cam.x = wx;
        sc.cam.y = sc.geo.fy(r.f) - 150;
        sc.cam.clamp();
        return { f: r.f, wx, hw: (r.winW || 88) / 2 + 8 };
      });
      await frames(2);
      await page.click('.decor-tray .tray-item');
      const onWin = (c) =>
        c.floor === win.f && Math.abs(c.x - win.wx) < 28 + win.hw && c.y + 28 > 104 && c.y - 28 < 208;
      const clock = () => ev((id) => window.__dev.houseItems(id).find((i) => i.id === 'clock'), id);
      let c = await clock();
      expect(c, id + ': часы не встали из кладовки');
      expect(!onWin(c), id + ': часы из кладовки встали на окно', { c, win });
      // перетащить часы пальцем (мышью) на середину окна: рамка красная, отпустить — часы на стене рядом
      await clearToasts();
      const pt = await ev(
        ([c, win]) => {
          const sc = window.__dev.scene,
            y = sc.geo.fy(c.floor);
          sc.cam.x = (c.x + win.wx) / 2; // на экране и часы, и окно
          sc.cam.clamp();
          return { a: sc.debugScreen(c.x, y - c.y), b: sc.debugScreen(win.wx, sc.geo.fy(win.f) - 156) };
        },
        [c, win],
      );
      await page.mouse.move(pt.a.x, pt.a.y);
      await page.mouse.down();
      await page.mouse.move(pt.b.x, pt.b.y, { steps: 6 });
      const drag = await ev(() => {
        const g = window.__dev.scene.decor.drag;
        return g && { bad: g.bad };
      });
      const over = await clock();
      expect(onWin(over), id + ': часы не дотащились до окна — проверка не годится', { over, win });
      expect(drag && drag.bad, id + ': над окном рамка не «нельзя»', drag);
      await page.mouse.up();
      await wait(100);
      c = await clock();
      expect(!onWin(c), id + ': отпущенные часы остались на окне', { c, win });
      expect((await toasts()).includes('окно'), id + ': нет подсказки про окно', await toasts());
      await ev(() => window.__dev.scene.setDecor(false));
    }
  });

  await step('рисунок: под прудом двора нет плитки, под грядкой нет воды; песок под пирсом остаётся', async () => {
    await newGame({ minutes: 12 * 60, weather: 'sun', scene: 'world' });
    const r = await ev(() => {
      const W = window.__dev.World;
      return {
        pond: W.debugLayers(22, 18), // середина пруда во дворе виллы
        pondEdge: W.debugLayers(19, 19),
        bed: W.debugLayers(23, 12), // нижняя грядка (рядом в запасе куска — пруд)
        pier: W.debugLayers(63, 56), // пирс над морем
      };
    });
    for (const k of ['pond', 'pondEdge']) {
      expect(r[k].includes(10), `${k}: нет слоя воды — проверка не годится`, r);
      expect(!r[k].includes(8) && !r[k].includes(5), `${k}: под прудом лежит плитка или тропинка`, r);
    }
    expect(r.bed.includes(12) && !r.bed.includes(10), 'под грядкой лежит вода пруда', r);
    expect(r.pier.includes(2), 'под пирсом пропал песок пляжа', r);
  });

  await step('рисунок: у сахара рисованный значок «мешочек»', async () => {
    const r = await ev(async () => {
      const { ING_BY_ID } = await import('/js/data/index.js');
      const { iconName } = await import('/js/data/icons.js');
      return iconName(ING_BY_ID.sugar.e) || ING_BY_ID.sugar.e;
    });
    expect(r === 'sugar', 'у сахара не рисованный значок', r);
  });
};
