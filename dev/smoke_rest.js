// Шаги автотеста «Отдых и питомец» (пачка 20 ноября): хомячок лежит В гамаке (ткань пустого гамака спрятана, её
// с хомячком рисует кадр отдыха); поза «сидит спиной» — отдых за столиками кафе и пикника, житель подсаживается
// напротив; отдых в тайных местах (пустыня, джунгли, секретный пляж, остров); питомец едет в корзинке транспорта.
// Подключается из dev/smoke.js. Только эти шаги:  node dev/smoke.js <url> "step:отдых 20н:"
const lib = require('./lib.js');

module.exports = async function rest(ctx) {
  const L = lib(ctx);
  const { step, ev, wait, closeAll, expect, until } = L;
  const now = () => ev(() => window.__dev.F.relaxNow());
  /** Сесть на предмет type у клетки tx, ty текущей сцены (как нажатием: хомячок подходит и садится). */
  const sitOn = async (type, tx, ty) => {
    const ok = await ev(
      ([type, tx, ty]) => {
        const sc = window.__dev.scene;
        const o = sc.map.objs.find((q) => q.type === type && q.tx === tx && q.ty === ty);
        return !!o && window.__dev.run('relax', { scene: sc, obj: o }) !== false;
      },
      [type, tx, ty],
    );
    expect(ok, `нет предмета ${type} у ${tx},${ty}`);
    await until(
      (type) => {
        const r = window.__dev.F.relaxNow();
        return r && r.type === type && r.t > 0.2;
      },
      type,
      { timeout: 8000, msg: `не села: ${type}` },
    );
    return now();
  };
  const standUp = async () => {
    await ev(() => window.__dev.F.standUp());
    expect((await now()) === null, 'не встала');
  };
  const fresh = async () => {
    await L.fresh({ day: 200, minutes: 12 * 60, weather: 'sun', scene: 'world' });
    await closeAll();
  };

  await step(
    'отдых 20н: в гамаке хомячок лежит внутри — ткань пустого гамака спрятана, встала — вернулась',
    async () => {
      await fresh();
      await L.teleport(13, 53);
      const r = await sitOn('hammock', 13, 51);
      expect(r.how === 'hammock', 'не легла в гамак', r);
      const busy = () =>
        ev(() => window.__dev.World.map.objs.find((o) => o.type === 'hammock' && o.tx === 13 && o.ty === 51).busy);
      expect((await busy()) === 1, 'гамак не отмечен занятым — его ткань рисуется поверх хомячка', await busy());
      await standUp();
      expect(!(await busy()), 'гамак остался «занятым»', await busy());
    },
  );

  await step(
    'отдых 20н: за столиком кафе и для пикника — сидит спиной к нам, житель подсаживается напротив',
    async () => {
      await fresh();
      await L.teleport(55, 25);
      let r = await sitOn('cafeTable', 55, 23);
      expect(r.how === 'table' && r.spot === 0, 'не села за столик кафе (спиной к нам — место 0)', r);
      // кадр «спиной» нарисовался в кэш спрайтов без ошибок
      const back = await ev(() => [...window.__dev.topdown.SP.map.keys()].some((k) => k.includes(':back:1:')));
      expect(back, 'нет кадра «сидит спиной» за столиком кафе');
      expect(await ev(() => window.__dev.F.relaxJoinNow()), 'никто не идёт подсесть за столик');
      await until(() => window.__dev.F.relaxNow().mate && window.__dev.F.relaxNow().mate.seated, undefined, {
        timeout: 15000,
        msg: 'житель не сел напротив',
      });
      const mate = await ev(() => {
        const n = window.__dev.World.npcs.find((q) => q.id === window.__dev.F.relaxNow().mate.id);
        return { y: n.y, ty: Math.floor(n.y / 48) };
      });
      expect(mate.ty === 22, 'житель сидит не напротив (за столиком, выше по карте)', mate);
      await standUp();
      await L.teleport(80, 46);
      r = await sitOn('picnicTable', 80, 44);
      expect(r.how === 'table' && r.spot === 0, 'не села за стол для пикника', r);
      await standUp();
    },
  );

  await step(
    'отдых 20н: в тайных местах — подушки у шатра, гамак в джунглях, лежак и полотенце на пляже, циновка',
    async () => {
      await fresh();
      for (const [land, type, tx, ty, how] of [
        ['desert', 'cushions', 23, 19, 'sit'],
        ['jungle', 'hammock', 24, 26, 'hammock'],
        ['cove', 'lounger', 12, 10, 'lie'],
        ['cove', 'towel', 18, 11, 'lie'],
        ['island', 'palmMat', 9, 27, 'lie'],
      ]) {
        await L.toPlace(land);
        await closeAll();
        await L.teleport(tx, ty + 3);
        const r = await sitOn(type, tx, ty);
        expect(r.how === how, `${land}: ${type} — не та поза`, r);
        await standUp();
      }
      // в джунглях всегда лето: зимой гамак на месте и на него можно нажать
      await L.mutate('s.day = 0;');
      await L.toPlace('jungle');
      await closeAll();
      await L.teleport(24, 29);
      const at = await ev(() => window.__dev.scene.debugScreen(24.5 * 48 + 24, 26.5 * 48 - 22));
      await L.page.mouse.click(at.x, at.y);
      const tap = await until(() => window.__dev.F.relaxNow(), undefined, { timeout: 8000 }).catch(() => null);
      expect(tap && tap.how === 'hammock', 'зимой в джунглях на гамак не нажать', tap);
    },
  );
};
