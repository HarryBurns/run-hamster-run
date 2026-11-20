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

  await step(
    '20н: телевизор — окно не прыгает по высоте, «редкая» только у редких наклеек, подсказки не на шапке и экране',
    async () => {
      await L.fresh({ day: 18, minutes: 12 * 60, weather: 'sun' });
      await ev(() => {
        const a = window.__dev.actions;
        for (const id of ['x_first', 'x_whale']) a.award(id);
      });
      await L.drain();
      await ev(() => window.__dev.run('tv'));
      await L.untilPanel();
      const hs = [];
      for (const ch of ['weather', 'cook', 'animals', 'news', 'toons', 'news']) {
        await L.act('tv-ch-' + ch);
        await frames(2);
        hs.push(await ev(() => Math.round(document.querySelector('.overlay > .panel').getBoundingClientRect().height)));
      }
      const wide = await ev(() => innerWidth > 640 && innerWidth > innerHeight);
      if (wide) expect(Math.max(...hs) - Math.min(...hs) <= 1, 'окно телевизора меняет высоту при смене канала', hs);
      const news = L.norm(await ev(() => document.querySelector('.overlay .tv-cap').textContent));
      expect(
        /наклейку «Новоселье»/.test(news) && !/редкую наклейку «Новоселье»/.test(news),
        'новость о «Новоселье»',
        news,
      );
      expect(/редкую наклейку «Встреча с китом»/.test(news), 'новость о редкой наклейке', news);
      await L.closeAll();
      // подсказки при открытом окне: не на шапке (заголовок, ✕), не на первых строках и не на экране телевизора
      await ev(() => window.__dev.fastToasts(false));
      try {
        for (const [name, open] of [
          ['телевизор', () => window.__dev.run('tv')],
          ['рюкзак', () => window.__dev.F.openBackpack()],
          ['почта', () => window.__dev.F.openMailbox()],
          ['альбом', () => window.__dev.F.openAlbum()],
          ['гардероб', () => window.__dev.F.openWardrobe()],
          ['настройки', () => window.__dev.F.openSettings()],
          ['карта', () => window.__dev.F.openMap()],
        ]) {
          await L.closeAll();
          await ev(() => document.querySelectorAll('#toasts .toast').forEach((t) => t.remove()));
          await ev(open);
          await L.untilPanel();
          await ev(() => {
            window.__dev.ui.toast('🍳 Новый рецепт — в книге рецептов! Приготовь блюдо дома на кухне.', 'good');
            window.__dev.ui.toast('Вторая подсказка: загляни в альбом наклеек.');
          });
          await L.wait(450);
          const r = await ev(() => {
            const ts = [...document.querySelectorAll('#toasts .toast')]
              .filter((t) => getComputedStyle(t).display !== 'none')
              .map((t) => t.getBoundingClientRect());
            const p = document.querySelector('.overlay > .panel').getBoundingClientRect(),
              h = document.querySelector('.overlay .panel-head').getBoundingClientRect(),
              scr = document.querySelector('.overlay .tv-screen');
            const zones = [h, { left: p.left, right: p.right, top: h.bottom, bottom: h.bottom + 40 }];
            if (scr) zones.push(scr.getBoundingClientRect());
            const hit = ts.some((b) =>
              zones.some((a) => b.left < a.right && b.right > a.left && b.top < a.bottom && b.bottom > a.top),
            );
            return { n: ts.length, hit, inScreen: ts.every((b) => b.top >= 0 && b.bottom <= innerHeight) };
          });
          expect(r.n >= 1 && !r.hit && r.inScreen, 'подсказка закрывает шапку или начало окна: ' + name, r);
        }
      } finally {
        await ev(() => {
          window.__dev.fastToasts(true);
          document.querySelectorAll('#toasts .toast').forEach((t) => t.remove());
        });
        await L.closeAll();
      }
    },
  );
};
