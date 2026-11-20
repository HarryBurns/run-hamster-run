// Шаги автотеста про подсказки вверху (ui/toast.js) — как у игрока, не в быстром режиме автотеста: висят по длине
// текста (успеть прочитать ребёнку 8–10 лет), мышь над подсказкой придерживает её, короткое нажатие — убирает,
// одинаковая не повторяется, много сразу — не больше трёх и новая видна дольше всех; при открытом окне сквозь
// подсказку нажимается то, что под ней.
// Подключается из dev/smoke.js. Только эти шаги:  node dev/smoke.js <url> step:подсказки
const lib = require('./lib.js');

module.exports = async function toastsSteps(ctx) {
  const { page, step, ev, wait, expect, fresh, go, closeAll, untilPanel } = lib(ctx);
  const info = () => ev(() => window.__dev.ui.toastsInfo());
  const LONG =
    'Роспись: хомяк-фараон в полосатом платке и солнце. Говорят, он очень любил семечки, а ещё — сладкие финики.';

  await step('подсказки: висят по длине текста, мышь придерживает, нажатие убирает, не копятся', async () => {
    await fresh();
    await go('world');
    await ev(() => {
      window.__dev.fastToasts(false);
      document.querySelector('#toasts') && (document.querySelector('#toasts').innerHTML = '');
    });
    try {
      // время по длине: короткая — 3,5 с, две строки — около 12 с
      await ev((t) => {
        window.__dev.ui.toast('Привет!');
        window.__dev.ui.toast(t);
      }, LONG);
      let q = await info();
      expect(q.length === 2, 'подсказок не две', q);
      expect(Math.abs(q[0].left - 3500) < 300, 'короткая — не 3,5 с', q);
      expect(q[1].left > 10500 && q[1].left <= 12000, 'длинная — не по длине текста', q);
      // мышь над длинной — не тает; ушла — снова идёт время
      const box = await page.locator('#toasts .toast').nth(1).boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await wait(250);
      const a = (await info())[1];
      await wait(600);
      const b = (await info())[1];
      expect(a.held && b.held && a.left === b.left, 'мышь над подсказкой не придержала её', [a, b]);
      await page.mouse.move(box.x + box.width / 2, box.y + box.height + 200);
      await wait(50);
      expect(!(await info())[1].held, 'мышь ушла, а подсказка всё держится', await info());
      // короткое нажатие убирает подсказку
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await wait(500);
      q = await info();
      expect(q.length === 1 && q[0].text === 'Привет!', 'нажатие не убрало подсказку', q);
      // та же подсказка ещё раз — не повторяется
      await ev(() => window.__dev.ui.toast('Привет!'));
      expect((await info()).length === 1, 'одинаковая подсказка повторилась', await info());
      // много сразу — на экране не больше трёх, последняя видна, старшая из оставшихся уходит скоро
      await ev((t) => {
        for (let i = 1; i <= 6; i++) window.__dev.ui.toast(i + '. ' + t);
      }, LONG);
      await wait(450);
      q = await info();
      const els = await ev(() => document.querySelectorAll('#toasts .toast').length);
      expect(q.length === 3 && els <= 3, 'подсказки копятся', { q, els });
      expect(q[2].text.startsWith('6.') && q[2].left > 10000, 'новая подсказка не видна полностью', q);
      expect(q[0].left <= 2000, 'старая подсказка не уходит раньше', q);
      // при открытом окне сквозь подсказку нажимается то, что под ней (вкладки, ✕)
      await ev(() => window.__dev.F.openBackpack());
      await untilPanel();
      await ev((t) => window.__dev.ui.toast(t), LONG);
      await wait(350);
      const through = await ev(() => {
        const t = [...document.querySelectorAll('#toasts .toast')].pop().getBoundingClientRect();
        const at = document.elementFromPoint(t.left + t.width / 2, t.top + t.height / 2);
        return !at.closest('#toasts');
      });
      expect(through, 'при открытом окне подсказка перехватывает нажатия');
      await closeAll();
    } finally {
      await ev(() => {
        window.__dev.fastToasts(true);
        const t = document.querySelector('#toasts');
        if (t) t.innerHTML = '';
      });
    }
  });
};
