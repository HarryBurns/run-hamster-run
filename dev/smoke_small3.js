// Шаги автотеста «правки заказчика вдогонку 20 ноября»: шляпка из каталога (подарок Плюши — не шляпа от солнца).
// Подключается из dev/smoke.js. Только эти шаги:  node dev/smoke.js <url> "step:заказчик 20б:"
const lib = require('./lib.js');

module.exports = async function small3(ctx) {
  const L = lib(ctx);
  const { step, ev, expect } = L;

  await step('заказчик 20б: подарок Плюши — шляпка из каталога за 0, не от солнца; соломенная с бантиком — в ТЦ', async () => {
    const r = await ev(async () => {
      const D = await import('/js/data/index.js');
      const hat = D.CLOTHES_BY_ID.hat_catalog,
        bow = D.CLOTHES_BY_ID.sunhat_bow,
        intro = D.QUEST_BY_ID.intro_home,
        busya = D.QUESTS.find((q) => q.steps.some((st) => st.if && st.if.sun)),
        sunStep = busya.steps.find((st) => st.if && st.if.sun);
      // новая игра после задания Плюши: в шкафу стартовые вещи и шляпка из каталога
      const s = { clothes: [...D.START_CLOTHES, 'hat_catalog'] };
      return {
        hat: hat && { price: hat.price, shop: hat.shop, slot: hat.slot, sun: D.isSunHat(hat) },
        reward: intro.reward.clothes,
        doneSays: intro.lines.done.includes('шляпка из каталога'),
        already: sunStep.already(s),
        bow: bow && { shop: bow.shop, price: bow.price, sun: D.isSunHat(bow) },
      };
    });
    expect(r.hat && r.hat.price === 0 && r.hat.shop === 'quest' && r.hat.slot === 'head', 'шляпка из каталога', r);
    expect(!r.hat.sun, 'шляпка из каталога считается шляпой от солнца', r);
    expect(r.reward === 'hat_catalog' && r.doneSays, 'Плюша дарит не шляпку из каталога', r);
    expect(!r.already, 'шаг Буси «купи шляпу от солнца» засчитан подарком Плюши', r);
    expect(r.bow && r.bow.shop === 'mall' && r.bow.price > 0 && r.bow.sun, 'соломенная шляпка с бантиком — не в ТЦ', r);
  });
};
