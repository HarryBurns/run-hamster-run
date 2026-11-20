// Шаги автотеста «Замечено в пачке 20 ноября» (П20-3…П20-9): аниматор отеля в дождь — в холле; столик для пикника
// во дворе; окно телевизора не прыгает и подсказки не закрывают окна; подсказка-указатель на заставке; поза «спиной»
// без переда одежды; все рисунки ART — в своей рамке спрайта.
// Подключается из dev/smoke.js. Только эти шаги:  node dev/smoke.js <url> "step:20н:"
const lib = require('./lib.js');

module.exports = async function p20(ctx) {
  const L = lib(ctx);
  const { step, ev, expect, frames, untilScene } = L;

  await step('20н: аниматор Хлопушка в дождь — зарядка и дискотека в холле, в ясную погоду — у бассейна', async () => {
    await L.fresh({ day: 18, minutes: 8.5 * 60, weather: 'sun', flags: { hotelHint: 1 } });
    /** В отеле: сколько Хлопушек видно на этаже f (0 — холл, 2 — терраса). */
    const here = (f) =>
      ev(
        (f) =>
          window.__dev.scenes.hotel.actors.filter((a) => a.id === 'hlopushka' && a.f === f && (!a.when || a.when()))
            .length,
        f,
      );
    const toHotel = async (wx) => {
      await L.closeAll();
      await ev((wx) => {
        const d = window.__dev;
        d.weather(wx, 1);
        if (d.sceneName !== 'world') d.go('world');
        d.enterBuilding('hotel');
      }, wx);
      await untilScene('hotel');
      await frames(2);
    };
    for (const min of [8.5 * 60, 19.5 * 60]) {
      await L.mutate(`s.minutes = ${min};`);
      await toHotel('sun');
      expect((await here(2)) === 1 && (await here(0)) === 0, 'в ясную погоду аниматор у бассейна', min);
      await toHotel('rain');
      expect((await here(2)) === 0 && (await here(0)) === 1, 'в дождь аниматор в холле', min);
      await L.run('hotel:animator');
      const t = await L.dialogText();
      expect(/в холле/.test(t) && /дождик/.test(t), 'Хлопушка говорит, что сегодня в холле', t);
      await L.reply('Потом');
      await L.clearToasts();
      await L.run('hotel:schedule');
      expect(/в холле/.test(await L.toasts()), 'доска: сегодня в холле', await L.toasts());
    }
    // ливень и метель — тоже в холле
    await toHotel('snow');
    expect((await here(2)) === 1, 'в лёгкий снежок аниматор у бассейна');
    await ev(() => window.__dev.weather('snow', 2));
    await frames(2);
    expect((await here(0)) === 1 && (await here(2)) === 0, 'в метель аниматор в холле');
    await L.closeAll();
    await ev(() => window.__dev.weather());
  });

  await step('20н: стол для пикника под рост хомячка — шире двоих сидящих, вокруг можно пройти', async () => {
    await L.fresh({ day: 200, minutes: 12 * 60, weather: 'sun', scene: 'world' });
    const r = await ev(async () => {
      const K = await import('/js/engine/topdown/kinds.js'),
        A = await import('/js/engine/topdown/actors.js'),
        m = window.__dev.World.map,
        T = 48,
        box = K.ART.picnicTable[0],
        o = m.objs.find((q) => q.type === 'picnicTable');
      // свободные клетки вокруг стола (кроме забора справа): слева, снизу и сверху — туда встают сидящие
      const around = [
        [-1, 0],
        [0, 1],
        [0, -1],
      ].map(([dx, dy]) => A.canStand(m.dry, o.x + dx * T, o.y + dy * T));
      return { w: box[2] - box[0], around };
    });
    expect(r.w >= 80, 'стол для пикника узкий — хомячок закрывает его целиком', r);
    expect(r.around.every(Boolean), 'вокруг стола для пикника не пройти', r);
  });
};
