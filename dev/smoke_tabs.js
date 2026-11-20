// Шаг автотеста про вкладки окон (ui/panel.js, css .tabs): во всех окнах с вкладками — ТЦ «Уютный дом» (с полкой
// «К празднику» — больше всего вкладок), «Модный», шкаф, рюкзак с кладовкой, альбом, агентство, рынок,
// холодильник — вкладки не уходят за край окна и видны: переносятся на новые строки, каждая не меньше 44 px, слова
// не обрезаны, прокрутки вбок нет. Переключение вкладки не меняет ни высоту окна, ни место вкладок.
// Проверяется на размере прогона и при повороте экрана: компьютер — ещё 1920×1080 и iPad стоя и лёжа, телефон — лёжа.
// Подключается из dev/smoke.js. Только этот шаг:  node dev/smoke.js <url> step:вкладки
const lib = require('./lib.js');

const WINDOWS = [
  ['ТЦ «Уютный дом»', (d) => d.run('home-mall')],
  [
    'ТЦ «Модный»',
    (d) => d.run({ do: 'clothes-shop', vendor: 'mall', shops: ['mall'] }, { building: { name: 'ТЦ «Модный»' } }),
  ],
  ['шкаф', (d) => d.run('wardrobe')],
  ['рюкзак', (d) => d.F.openBackpack()],
  ['альбом', (d) => d.F.openAlbum()],
  ['агентство', (d) => d.run('realtor')],
  ['рынок', (d) => d.run('market')],
  ['холодильник', (d) => d.run('fridge')],
];

module.exports = async function tabsSteps(ctx) {
  const { page, step, ev, expect, fresh, closeAll, until, untilPanel, frames } = lib(ctx);

  /** Что не так с вкладками открытого окна (пустой список — всё хорошо). */
  const problems = () =>
    ev(() => {
      const bad = [];
      const panel = document.querySelector('.overlay .panel');
      const bar = panel.querySelector('.tabs');
      const P = panel.getBoundingClientRect();
      if (bar.scrollWidth > bar.clientWidth + 1) bad.push('вкладки листаются вбок');
      if (bar.getBoundingClientRect().height > P.height * 0.45) bad.push('вкладки занимают почти всё окно');
      for (const t of bar.querySelectorAll('.tab')) {
        const r = t.getBoundingClientRect(),
          name = t.textContent.trim();
        if (r.left < P.left - 0.5 || r.right > P.right + 0.5 || r.top < P.top - 0.5 || r.bottom > P.bottom + 0.5)
          bad.push(name + ': за краем окна');
        else if (r.right > innerWidth + 0.5 || r.bottom > innerHeight + 0.5) bad.push(name + ': за краем экрана');
        else {
          const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          if (!at || !t.contains(at)) bad.push(name + ': не видна (закрыта)');
        }
        if (r.height < 44 || r.width < 44) bad.push(`${name}: мелкая ${Math.round(r.width)}×${Math.round(r.height)}`);
        if (t.scrollWidth > t.clientWidth + 1) bad.push(name + ': слова обрезаны');
      }
      return bad;
    });
  /** Где окно и вкладки: при переключении вкладок не должно меняться. */
  const place = () =>
    ev(() => {
      const r = (e) => e.getBoundingClientRect();
      const p = r(document.querySelector('.overlay .panel')),
        b = r(document.querySelector('.overlay .tabs'));
      return [p.top, p.height, b.top, b.height].map(Math.round).join(',');
    });

  await step('вкладки: во всех окнах с вкладками все вкладки внутри окна и видны, окно не прыгает', async () => {
    await fresh({ money: 50000 });
    await ev(() => window.__dev.holiday.to('newyear', 'eve', 1, 600)); // полка «К празднику» — ещё одна вкладка
    await closeAll();
    const own = page.viewportSize();
    const sizes =
      own.width >= 700
        ? [
            [own.width, own.height],
            [1920, 1080],
            [820, 1180],
            [1180, 820],
          ]
        : [
            [own.width, own.height],
            [own.height, own.width],
          ];
    try {
      for (const [title, open] of WINDOWS) {
        await ev((src) => new Function('d', `(${src})(d)`)(window.__dev), open.toString());
        await untilPanel();
        // окно появляется с увеличением (pop-in) — мерить, когда оно встало на место
        await until(
          () =>
            !document
              .querySelector('.overlay .panel')
              .getAnimations()
              .some((a) => a.playState === 'running'),
        );
        const n = await ev(() => document.querySelectorAll('.overlay .tab').length);
        expect(n >= 2, title + ': нет вкладок', n);
        for (const [w, h] of sizes) {
          await page.setViewportSize({ width: w, height: h });
          await frames(3);
          const where = `${title}, ${w}×${h}`;
          expect(!(await ev(() => document.querySelector('.overlay .tabs').scrollLeft)), where + ': вкладки сдвинуты');
          const bad = await problems();
          expect(!bad.length, where, bad);
          // по всем вкладкам: окно той же высоты на том же месте, вкладки не сдвинулись
          const was = await place();
          for (let i = 0; i < n; i++) {
            await ev((i) => document.querySelectorAll('.overlay .tab')[i].click(), i);
            await frames(2);
            const now = await place();
            expect(now === was, `${where}: на вкладке ${i + 1} окно или вкладки сдвинулись`, { was, now });
          }
          await ev(() => document.querySelector('.overlay .tab').click());
          await frames(1);
        }
        await page.setViewportSize(own);
        await closeAll();
      }
    } finally {
      await page.setViewportSize(own);
      await closeAll();
    }
  });
};
