// Шаги автотеста «движка домов» (engine/side) — баги от заказчика:
//   лифт — нажатие во время поездки не выводит хомячка из кабины между этажами: лифт поворачивает к этажу новой
//   цели и там хомячок выходит (вилла, отель, пентхаус, дом Профессора); стрелки и E во время поездки, «Обустроить»
//   посреди поездки, сохранение посреди поездки;
//   порядок рисования — кто просто ходит мимо ванны, джакузи, бассейна (хомячок и житель), рисуется перед ними,
//   а в ванне — за передней стенкой.
// Подключается из dev/smoke.js. Только эти шаги:  node dev/smoke.js <url> "step:движок домов"
const lib = require('./lib.js');

module.exports = async function side(ctx) {
  const { page, step, ev, expect, fresh, go, until, frames, closeAll, mutate } = lib(ctx);

  /** Что с лифтом и хомячком сейчас. */
  const lift = () =>
    ev(() => {
      const sc = window.__dev.scene,
        p = sc.p;
      return {
        scene: sc.name,
        f: p.f,
        x: p.x,
        lift: p.lift,
        liftY: sc.liftY,
        floorY: sc.geo.fy(p.f),
        path: p.path.map((q) => q.t),
        EX: sc.geo.EX,
        W: sc.geo.W,
        bad: window.__liftBad || [],
      };
    });
  /**
   * Нажать на точку дома (x, этаж, высота над полом) — так же, как пальцем: pointerDown / pointerUp сцены в экранных
   * координатах (точка может быть и за краем экрана — камера на телефоне следит за хомячком).
   */
  const tap = (x, f, up = 60) =>
    ev(
      ([x, f, up]) => {
        const sc = window.__dev.scene,
          s = sc.debugScreen(x, sc.geo.fy(f) - up);
        sc.pointerDown(s.x, s.y);
        sc.pointerUp(s.x, s.y);
      },
      [x, f, up],
    );
  /** Каждый кадр страница сама проверяет: хомячок в кабине, но путь — «идти по этажу» (он шагает по воздуху). */
  const watchLift = () =>
    ev(() => {
      window.__liftBad = [];
      const sc = window.__dev.scene,
        tick = () => {
          if (window.__dev.scene !== sc) return;
          const p = sc.p;
          if (p.lift && (!p.path.length || p.path[0].t !== 'lift') && window.__liftBad.length < 5)
            window.__liftBad.push({ x: Math.round(p.x), y: Math.round(sc.liftY), path: p.path.map((q) => q.t) });
          requestAnimationFrame(tick);
        };
      requestAnimationFrame(tick);
    });
  /** Ждать, пока лифт отъедет от этажа f хотя бы на d единиц (едет, но ещё далеко до другого этажа). */
  const untilMid = (f, d = 40, what = '') =>
    until(
      ([f, d]) => {
        const sc = window.__dev.scene;
        return !!sc.p.lift && Math.abs(sc.liftY - sc.geo.fy(f)) >= d;
      },
      [f, d],
      { timeout: 8000, msg: 'лифт не поехал ' + what },
    );
  /** Ждать, пока хомячок доедет и дойдёт: не в лифте, путь пуст. */
  const untilStill = (msg) =>
    until(() => !window.__dev.scene.p.lift && !window.__dev.scene.p.path.length, undefined, { timeout: 9000, msg });
  /** Хомячок стоит на полу этажа, кабина у его этажа, ни одного кадра «из кабины по воздуху». */
  const onFloor = (r, what) => {
    expect(!r.lift && Math.abs(r.liftY - r.floorY) < 0.5, `${what}: лифт застрял между этажами`, r);
    expect(!r.bad.length, `${what}: хомячок вышел из кабины между этажами`, r);
  };

  await step('движок домов: лифт — нажатие во время поездки не выводит хомячка из кабины между этажами', async () => {
    await fresh({ day: 18, minutes: 12 * 60, weather: 'sun', dayFlags: true });
    // случай заказчика: вилла, 2-й этаж → нажать на 1-й → лифт тронулся → нажать на пианино на 2-м
    await mutate((s) => {
      s.villa = s.villa.filter((i) => i.id !== 'piano');
      s.villa.push({ uid: 99001, id: 'piano', floor: 1, x: 1200, y: 0 });
    });
    await ev(() => window.__dev.villaAt(1, 600));
    await until(() => window.__dev.sceneName === 'villa' && window.__dev.scene.p.f === 1);
    await frames(2);
    await watchLift();
    await tap(600, 0);
    await untilMid(1);
    await tap(1200, 1); // пианино
    await untilStill('хомячок не дошёл до пианино');
    let r = await lift();
    onFloor(r, 'вилла, пианино');
    expect(r.f === 1 && Math.abs(r.x - 1200) < 2, 'вилла: хомячок не у пианино на втором этаже', r);
    await until(() => !!document.getElementById('piano'), undefined, { timeout: 3000, msg: 'пианино не открылось' });
    await page.keyboard.press('Escape');
    await until(() => !document.getElementById('piano'), undefined, { timeout: 3000, msg: 'пианино не закрылось' });
    await closeAll();

    // в других домах с лифтом: едем на другой этаж, посреди поездки нажимаем на пол этажа, откуда поехали
    // (лифт поворачивает обратно) — и на третий этаж (лифт едет дальше)
    await mutate((s) => {
      for (const h of ['penthouse']) if (!s.homesOwned.includes(h)) s.homesOwned.push(h);
    });
    for (const [name, from, to, back, x, x0] of [
      ['villa', 0, 1, 0, 700, 1300],
      ['villa', 0, 1, 2, 700, 1300],
      ['hotel', 0, 2, 0, 700, 1800],
      ['hotel', 2, 1, 0, 1200, 1800],
      ['penthouse', 0, 1, 0, 500, 1000],
      ['home_prof', 1, 0, 1, 300, 800],
    ]) {
      await ev(([n, f, x]) => window.__dev.go(n, { pos: { scene: n, floor: f, x } }), [name, from, x0]);
      await until((n) => window.__dev.sceneName === n, name);
      await frames(2);
      await watchLift();
      await tap(x, to);
      await untilMid(from, 40, name + ' ' + from + '→' + to);
      await tap(x, back);
      await untilStill(`${name}: хомячок не дошёл`);
      r = await lift();
      onFloor(r, `${name} ${from}→${to}, потом ${back}`);
      // куда именно пришла — неважно (точка может попасть в жителя или мебель): важно, что на этаже новой цели
      expect(r.f === back, `${name}: хомячок не на этаже новой цели`, r);
      await closeAll(); // дошла до жителя или двери — закрыть его окно
    }

    // клавиатура: стрелки и E во время поездки ничего не ломают, лифт доезжает
    await ev(() => window.__dev.villaAt(0, 1200));
    await until(() => window.__dev.sceneName === 'villa');
    await frames(2);
    await watchLift();
    await page.keyboard.down('ArrowUp');
    await until(() => !!window.__dev.scene.p.path.length || !!window.__dev.scene.p.lift);
    await page.keyboard.up('ArrowUp');
    await untilMid(0, 30);
    for (const k of ['ArrowLeft', 'ArrowDown', 'ArrowRight']) {
      await page.keyboard.down(k);
      await frames(3);
      await page.keyboard.up(k);
    }
    await page.keyboard.press('KeyE');
    r = await lift();
    expect(r.lift && Math.abs(r.x - r.EX) < 1, 'стрелки во время поездки увели хомячка из кабины', r);
    await untilStill('лифт не доехал после стрелок');
    r = await lift();
    onFloor(r, 'стрелки во время поездки');
    expect(r.f === 1, 'лифт по стрелке вверх не привёз на второй этаж', r);

    // «Обустроить» посреди поездки: путь сброшен, но кабина доезжает до этажа
    await watchLift();
    await tap(500, 2);
    await untilMid(1, 30);
    await ev(() => window.__dev.scene.setDecor(true));
    await until(() => !window.__dev.scene.p.lift, undefined, {
      timeout: 6000,
      msg: 'лифт завис в режиме «Обустроить»',
    });
    r = await lift();
    expect(Math.abs(r.liftY - r.floorY) < 0.5 && r.f === 2, '«Обустроить» посреди поездки: лифт не доехал', r);
    await ev(() => window.__dev.scene.setDecor(false));

    // сохранение посреди поездки: после загрузки хомячок на полу этажа, куда ехал, у лифта
    await tap(500, 0);
    await untilMid(2, 30);
    const pos = await ev(() => window.__dev.scene.savePos());
    expect(pos.floor === 0 && Number.isInteger(pos.floor), 'сохранение посреди поездки: не тот этаж', pos);
    await ev((pos) => window.__dev.go('villa', { pos }), pos);
    await until(() => window.__dev.sceneName === 'villa');
    await frames(2);
    r = await lift();
    onFloor({ ...r, bad: [] }, 'загрузка после поездки');
    expect(r.f === 0, 'после загрузки — не тот этаж', r);
  });

  await step(
    'движок домов: порядок рисования — хомячок и житель у ванны, джакузи и бассейна — перед ними',
    async () => {
      await fresh({ day: 18, minutes: 12 * 60, weather: 'sun', dayFlags: true });
      await go('villa');
      /**
       * Нарисовать кадр дважды (камера на месте): кто-то стоит у предмета — и ушёл; сравнить кусочек экрана у его ног.
       * Совпали — значит, его закрыла передняя стенка предмета.
       */
      const differs = (id, who) =>
        ev(
          ([id, who]) => {
            const sc = window.__dev.scene,
              b = sc.fixtures.find((q) => q.id === id),
              p = sc.p,
              y = sc.geo.fy(b.f),
              canvas = document.getElementById('game'),
              c = canvas.getContext('2d'),
              dpr = window.__dev.G.view.dpr || 1;
            sc.standUp();
            p.path = [];
            p.f = b.f;
            p.x = b.x - 300;
            p.dir = 1;
            sc.liftY = y;
            const g = { id: 'plusha', act: 'npc:plusha', ph: 1, x: b.x, f: b.f, tx: b.x, wait: 99, dir: 1, walkT: 0 };
            g.happy = 0;
            g.roam = null;
            sc.cam.snap(b.x, y - 110);
            const shot = (here) => {
              if (who === 'player') p.x = here ? b.x : b.x - 300;
              sc.actors = sc.actors.filter((q) => q !== g);
              if (who === 'actor' && here) sc.actors.push(g);
              c.setTransform(dpr, 0, 0, dpr, 0, 0);
              sc.draw(c);
              const a = sc.debugScreen(b.x - 14, y - 58),
                z = sc.debugScreen(b.x + 14, y - 22);
              return c.getImageData(
                Math.round(a.x * dpr),
                Math.round(a.y * dpr),
                Math.max(1, Math.round((z.x - a.x) * dpr)),
                Math.max(1, Math.round((z.y - a.y) * dpr)),
              ).data;
            };
            const A = shot(true),
              B = shot(false);
            sc.actors = sc.actors.filter((q) => q !== g);
            let n = 0;
            for (let i = 0; i < A.length; i += 4)
              if (Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]) > 30) n++;
            return n / (A.length / 4);
          },
          [id, who],
        );
      for (const id of ['bathtub', 'jacuzzi', 'pool'])
        for (const who of ['player', 'actor']) {
          const k = await differs(id, who);
          expect(k > 0.3, `${id}: ${who === 'player' ? 'хомячок' : 'житель'} рисуется за передней стенкой`, k);
        }
      // в ванне — за передней стенкой, как и задумано: пена и борт поверх
      const inside = await ev(() => {
        const sc = window.__dev.scene,
          b = sc.fixtures.find((q) => q.id === 'bathtub');
        sc.p.f = b.f;
        b.def.use(sc, b);
        return sc.using(b);
      });
      expect(inside, 'хомячок не сел в ванну');
      await frames(3);
      await ev(() => window.__dev.scene.standUp());
    },
  );
};
