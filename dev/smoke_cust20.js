// Шаги автотеста «баги заказчика 20 ноября»: гости уходят (сами пришедшие — вместе с хомячком на улицу, по телефону —
// не сидят в пустом доме, перед сном расходятся), житель не пропадает посреди разговора, пауза, когда ребёнок
// отвлёкся, Esc — меню, без солнышка на лежаке, «Горка» без колошматинья, мягкий шелест кустов, звезда «Садовника».
// Подключается из dev/smoke.js. Только эти шаги:  node dev/smoke.js <url> "step:заказчик 20:"
const lib = require('./lib.js');

module.exports = async function cust20(ctx) {
  const L = lib(ctx);
  const { step, ev, expect } = L;

  await step('заказчик 20: на лежаке нет солнышка над загорающей', async () => {
    const n = await ev(async () => {
      const A = await import('/js/features/relax_art.js');
      let calls = 0;
      const c = document.createElement('canvas').getContext('2d');
      const rec = new Proxy(c, {
        get(t, k) {
          const v = t[k];
          if (typeof v !== 'function') return v;
          return (...a) => {
            if (/^(fill|stroke|draw)/.test(String(k))) calls++;
            return v.apply(t, a);
          };
        },
        set(t, k, v) {
          t[k] = v;
          return true;
        },
      });
      // лежит на лежаке первую секунду, без реплики (прежний вызов: …, t, ct, sunny = true — рисовал солнышко)
      A.drawRestExtras(rec, 'lie', 100, 100, 1, 0, true);
      return calls;
    });
    expect(n === 0, 'над загорающей на лежаке что-то рисуется (солнышко)', n);
  });
};
