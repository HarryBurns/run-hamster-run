// Шаги автотеста «решения заказчика 20 ноября»: героиня — «хомяшка» (не «хомячка»); стартовая майка — белая у обоих;
// показ мод открывается, когда в шкафу хватает нарядов; звёздочка к жителю ведёт туда, где он на самом деле (отель).
// Подключается из dev/smoke.js. Только эти шаги:  node dev/smoke.js <url> "step:хом:"
const fs = require('fs');
const path = require('path');
const lib = require('./lib.js');
const SAVE_V5 = fs.readFileSync(path.join(__dirname, 'saves', 'v5.json'), 'utf8'); // старая игра: в шкафу майка с сердечком

module.exports = async function hom(ctx) {
  const L = lib(ctx);
  const { page, step, ev, expect } = L;

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

  await step('хом: стартовая майка — белая у обоих; с сердечком — в ТЦ «Модный»; у старой игры она в шкафу', async () => {
    // заставка и экран выбора пола рисуют героя в стартовом виде — startLook (data/looks.js)
    const starts = await ev(async () => {
      const D = await import('/js/data/looks.js');
      return ['m', 'f'].map((g) => D.startLook(g).outfit.body);
    });
    expect(starts.join() === 'tee_white,tee_white', 'стартовый вид: белая майка у обоих', starts);
    for (const g of ['m', 'f']) {
      await L.fresh({ gender: g });
      const s = await L.state();
      expect(
        s.look.outfit.body === 'tee_white' && s.clothes.includes('tee_white') && !s.clothes.includes('tee_heart'),
        `новая игра (${g}): белая майка, сердечка в шкафу нет`,
        [s.look.outfit, s.clothes],
      );
    }
    const sale = await ev(async () => {
      const D = await import('/js/data/index.js');
      const W = await import('/js/data/wares.js');
      const tee = (id) => D.CLOTHES_BY_ID[id];
      return {
        heart: [tee('tee_heart').shop, tee('tee_heart').price],
        white: [tee('tee_white').shop, tee('tee_white').price, tee('tee_white').c],
        mall: W.shopWares('mall').some((w) => w.def.id === 'tee_heart'),
        dots: tee('tee_dots').price,
      };
    });
    expect(sale.heart[0] === 'mall' && sale.mall && sale.heart[1] === sale.dots, 'майка с сердечком — в «Модном» по цене соседних', sale);
    expect(sale.white[0] === 'start' && sale.white[1] === 0, 'белая майка — стартовая', sale);
    // старая игра: майка с сердечком остаётся в шкафу и на герое
    const was = JSON.parse(SAVE_V5);
    await ev((raw) => {
      window.__dev.G.state = null;
      localStorage.clear();
      localStorage.setItem('rhr-save-v1', raw);
    }, SAVE_V5);
    await page.reload();
    await page.waitForSelector('[data-act="continue"]');
    await L.cont();
    const s = await L.state();
    expect(s.clothes.includes('tee_heart') && !s.clothes.includes('tee_white'), 'старая игра: шкаф прежний', s.clothes);
    expect(s.look.outfit.body === was.look.outfit.body, 'старая игра: наряд прежний', [s.look.outfit, was.look.outfit]);
  });

  await step('хом: показ мод — только когда в шкафу хватает нарядов; иначе Пуговка советует ТЦ «Модный»', async () => {
    await L.fresh({ day: 18, minutes: 12 * 60, weather: 'sun', dayFlags: true, villa: 'small' });
    const FEW = 'У тебя пока мало нарядов — загляни в ТЦ «Модный», а потом приходи на показ!';
    /** Войти в Дом моды: что сказала Пуговка и какие кнопки. */
    const ask = async () => {
      await L.closeAll();
      await L.go('world');
      await L.enter('fashion');
      await L.untilDialog();
      const r = {
        say: await L.dialogText(),
        btns: await ev(() => [...document.querySelectorAll('.dialog .btn')].map((b) => b.textContent)),
      };
      return r;
    };
    const ready = () => ev(async () => (await import('/js/data/fashion.js')).fashionReady(window.__dev.G.state.clothes));
    expect(!(await ready()), 'новая игра: нарядов для показа хватает (проверка не годится)');
    const a = await ask();
    expect(a.say.includes(FEW) && !a.btns.some((b) => /подиум/.test(b)), 'с пустым шкафом — мягкий совет, подиума нет', a);
    await L.closeAll();
    // другой путь к показу (письмо, повтор) — тот же мягкий отказ, мини-игра не открывается
    await ev(() => void window.__dev.F.playMinigame('fashion'));
    await L.untilPanel();
    const msg = await L.panelText();
    expect(msg.includes(FEW) && !(await ev(() => !!document.querySelector('#mg'))), 'показ мод без нарядов: отказ', msg);
    await L.closeAll();
    // письмо дня на показ мод не зовёт, пока нарядов мало
    const mails = () =>
      ev(() => {
        const d = window.__dev,
          seen = {};
        for (let i = 0; i < 300; i++) {
          d.actions.mutate((s) => {
            s.lastTasks = [];
            s.sick = null;
            s.day = (s.startDay || 0) + 20; // не первые письма новой игры (они по порядку)
          });
          d.F.newDayMail();
          seen[d.G.state.mail.task] = 1;
        }
        return seen;
      });
    const m0 = await mails();
    expect(!m0.fashion && Object.keys(m0).length > 5, 'письмо зовёт на показ мод с пустым шкафом', Object.keys(m0));
    // купили платье и туфли — по две вещи на верх, низ и обувь: показ открыт, письмо может позвать
    await ev(() => ['dress_red', 'sn_red'].forEach((id) => window.__dev.actions.addClothes(id)));
    expect(await ready(), 'платье и кроссовки — нарядов хватает');
    const b = await ask();
    expect(b.btns.some((x) => /подиум/.test(x)) && !b.say.includes(FEW), 'нарядов хватает — Пуговка зовёт на подиум', b);
    await L.closeAll();
    const m1 = await mails();
    expect(m1.fashion, 'с нарядами письмо на показ мод тоже бывает', Object.keys(m1));
  });
};
