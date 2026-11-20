// Шаги автотеста «решения заказчика 20 ноября»: героиня — «хомяшка» (не «хомячка»); стартовая майка — белая у обоих;
// показ мод открывается, когда в шкафу хватает нарядов; звёздочка к жителю ведёт туда, где он на самом деле (отель).
// Подключается из dev/smoke.js. Только эти шаги:  node dev/smoke.js <url> "step:хом:"
const lib = require('./lib.js');

module.exports = async function hom(ctx) {
  const L = lib(ctx);
  const { step, ev, expect } = L;

  await step('хом: героиня — «хомяшка»: кнопка на экране новой игры, справка и тексты в женском роде', async () => {
    await L.blank();
    const who = await ev(() => [...document.querySelectorAll('#title .t-who-btn')].map((b) => b.textContent));
    expect(who.join('|') === 'Я — хомячок|Я — хомяшка', 'кнопки выбора пола', who);
    await L.fresh({ gender: 'f' });
    await ev(() => void window.__dev.F.showHelp());
    await L.untilPanel();
    const help = await L.panelText();
    await L.closeAll();
    expect(/хомяшка сама туда дойдёт/.test(help) && !/хомячка/.test(help), 'справка за хомяшку', help.slice(0, 300));
    const t = await ev(async () => (await import('/js/core/gender.js')).gx('Беги, {хомячок|хомяшка}, беги!'));
    expect(t === 'Беги, хомяшка, беги!', 'разметка в женском роде', t);
  });
};
