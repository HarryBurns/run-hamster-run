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
};
