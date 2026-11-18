// Шаги автотеста быстрых правок по ревью мест и мини-игр (scratchpad review/places.md, «Быстрые исправления»):
//   п. 1 — «Домой» с кораблика: выйдя из своей квартиры / пентхауса / бунгало, хомячок у своей двери, а не у виллы;
//          кораблик ждёт там, где его оставили;
//   п. 2 — сохранились посреди поездки по подземной реке: хомячок и лодочка после загрузки на одном берегу;
//   п. 5 — во дворе нельзя поставить предмет, который перекрывает путь от двери дома к выходу со двора.
// Подключается из dev/smoke.js. Только эти шаги:  node dev/smoke.js <url> "step:места ревью"
module.exports = async function rplaces({ page, step, ev, wait, closeAll }) {
  const T = 48;
  const expect = (ok, msg, data) => {
    if (!ok) throw new Error(msg + (data === undefined ? '' : ': ' + JSON.stringify(data)));
  };
  const fresh = async () => {
    await ev(() => {
      window.__dev.G.state = null;
      localStorage.clear();
    });
    await page.reload();
    await wait(400);
    await page.click('text=Играть!');
    await page.click('text=Пропустить');
    await page.evaluate(() => window.__dev.oldStart()); // 1 января, без вводной цепочки
    await wait(400);
    await page.click('text=Поехали!');
    await wait(500);
    await closeAll();
  };

  await step('места ревью п. 1: «Домой» с кораблика — из квартиры, пентхауса и бунгало выходишь у своей двери', async () => {
    await fresh();
    for (const home of ['flat', 'penthouse', 'bungalow']) {
      const r = await ev(async (home) => {
        const d = window.__dev;
        const H = await import('/js/features/homes.js');
        const { sea } = await import('/js/locations/town.js');
        d.actions.mutate((s) => {
          if (!s.homesOwned.includes(home)) s.homesOwned.push(home);
          s.homeMain = home;
          if (!s.homes[home]) s.homes[home] = [];
        });
        if (d.sceneName !== 'world') d.go('world');
        const W = d.World;
        // сесть в кораблик и отплыть от пирса на 3 клетки к югу
        const bt = sea.boatState();
        W.p.x = bt.x;
        W.p.y = bt.y - 40;
        const n = sea.near(W);
        if (n && n.pending) n.pending.fn();
        if (!W.isBoating()) return { err: 'не сели в кораблик' };
        W.p.y += 3 * 48;
        sea.boatState(); // положение кораблика — в сохранении
        d.actions.patchState('boat', { x: W.p.x, y: W.p.y });
        const left = { x: W.p.x, y: W.p.y };
        if (!H.goToHome(home)) return { err: 'goToHome не сработал' };
        const sc = d.scene;
        const back = sc.back;
        d.go(back.scene, { pos: back }); // вышли в дверь своего дома
        const p = d.scene.p,
          b = d.G.state.boat;
        return {
          scene: d.sceneName,
          back,
          at: { x: p.x, y: p.y },
          boating: !!(p.ride && p.ride.id === 'boat'),
          on: b.on,
          boat: { x: b.x, y: b.y },
          left,
        };
      }, home);
      expect(!r.err, home + ': ' + r.err);
      const off = Math.hypot(r.at.x - r.back.x, r.at.y - r.back.y) / T;
      expect(r.scene === r.back.scene && off < 1.5, home + ': вышли не у своей двери', r);
      expect(!r.boating && !r.on, home + ': хомячок остался «в кораблике»', r);
      expect(Math.hypot(r.boat.x - r.left.x, r.boat.y - r.left.y) < 2, home + ': кораблик переехал', r);
    }
  });

  await step('места ревью п. 2: подземная река — сохранились посреди поездки, хомячок и лодочка на одном берегу', async () => {
    await fresh();
    const r = await ev(async () => {
      const d = window.__dev;
      const deep = await import('/js/locations/deep.js');
      const out = [];
      for (const [x, y] of [
        [8.5, 12.7],
        [16, 12.4],
        [18.5, 13.4],
        [19.8, 13.8],
        [21, 14.1],
        [26, 13.4],
      ]) {
        d.go('deep', { pos: { scene: 'deep', x: x * 48, y: y * 48 } });
        const p = d.scene.p;
        const side = p.x > 20 * 48 ? 'east' : 'west';
        out.push({ x, hero: [+(p.x / 48).toFixed(1), +(p.y / 48).toFixed(1)], side, boat: deep.boatWhere() });
      }
      d.go('world');
      return out;
    });
    for (const o of r) expect(o.side === o.boat, 'хомячок и лодочка на разных берегах', o);
  });

  await step('места ревью п. 5: двор — предметы не перекрывают путь от двери, мест и хомячка к выходу со двора', async () => {
    await fresh();
    const r = await ev(() => {
      const d = window.__dev,
        W = d.World,
        m = W.map,
        out = [];
      d.actions.mutate((s) => {
        if (!s.homesOwned.includes('bungalow')) s.homesOwned.push('bungalow');
      });
      if (d.sceneName !== 'world') d.go('world');
      d.actions.addYardItem('y_bed_pink', 60);
      // хомячок в углу двора; ставим предметы как можно плотнее — сначала ближе к двери и к хомячку
      for (const [yard, area, hero, exit, max] of [
        ['villa', [5, 4, 26, 23], [5, 4], [30, 14], 40],
        ['bungalow', [3, 53, 14, 56], [9, 55], [8, 58], 20],
      ]) {
        W.p.x = (hero[0] + 0.5) * 48;
        W.p.y = (hero[1] + 0.5) * 48;
        const door = m.buildings
          .map((b) => m.doorPx(b))
          .map((q) => [Math.floor(q.x / 48), Math.floor(q.y / 48)])
          .find(([x, y]) => x >= area[0] && x <= area[2] && y >= area[1] && y <= area[3]);
        const cells = [];
        for (let y = area[1]; y <= area[3]; y++) for (let x = area[0]; x <= area[2]; x++) cells.push([x, y]);
        const near = (c) => Math.min(Math.hypot(c[0] - door[0], c[1] - door[1]), Math.hypot(c[0] - hero[0], c[1] - hero[1]));
        cells.sort((a, b) => near(a) - near(b));
        let n = 0;
        for (const [x, y] of cells)
          if (n < max && d.F.yardCanPlace(yard, x, y) && d.actions.placeYard(yard, 'y_bed_pink', x, y)) n++;
        const stands = W.places
          .filter((pl) => pl.stand)
          .map((pl) => [Math.floor(pl.stand[0]), Math.floor(pl.stand[1])])
          .filter(([x, y]) => x >= area[0] && x <= area[2] && y >= area[1] && y <= area[3] && m.foot(x, y));
        const lost = [door, hero, ...stands].filter(([x, y]) => !m.path(m.foot, x, y, exit[0], exit[1]));
        out.push({ yard, n, door, lost, locked: !d.F.yardCanPlace(yard, hero[0] + 1, hero[1]) });
      }
      return out;
    });
    for (const o of r) {
      expect(o.n >= 15, o.yard + ': поставилось слишком мало предметов', o);
      expect(!o.lost.length, o.yard + ': путь к выходу со двора перекрыт', o);
    }
  });
};
