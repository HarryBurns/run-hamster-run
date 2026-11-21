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

  await step('хом: звёздочка к жителю в отеле — у отеля, внутри над ним на крыше и над дверью номера 203', async () => {
    await L.fresh({ weather: 'sun', dayFlags: true });
    // Сеня отдыхает у бассейна отеля, а его задание «На вершину» на шаге «оденься тепло» — звёздочка ведёт к нему
    // (на этом шаге над ним нет «?», поэтому из отеля он не уходит — npcPlace в core/queries.js)
    const g = await ev(async () => {
      const St = await import('/js/core/state.js'),
        Q = await import('/js/features/quests.js'),
        d = window.__dev;
      d.actions.mutate((s) => {
        s.guests = [];
        s.flags.hotelHint = 1;
        s.flags.metZvezdochka = 1;
        for (const slot of ['head', 'body', 'acc']) s.look.outfit[slot] = null; // не в тёплом: шаг не сделан
        s.look.outfit.body = 'tee_white';
      });
      for (let day = 20; day < 400; day++) {
        d.actions.mutate((s) => {
          s.day = day;
          s.minutes = 15 * 60 + 10;
          s.weather = 'sun';
          s.wxStrong = false;
          s.quests.summit = { day, n: { 0: 1 }, got: {}, done: null };
        });
        if (St.hotelPoolGuests().includes('senya')) {
          d.goal.set('summit');
          const w = St.questNow('summit');
          return { day, at: St.npcPlace('senya').at, i: w.i, where: w.q.steps[w.i].where };
        }
      }
      return null;
    });
    expect(g && g.at === 'pool' && g.where === 'npc:senya', 'Сеня у бассейна отеля с заданием (проверка не годится)', g);
    // в городе: звёздочка — у двери отеля, а не на улице и не у домика Сени
    await L.go('world');
    const town = await ev(() => {
      const sc = window.__dev.scene;
      return { t: sc.target(), h: sc.whereIs('hotel') };
    });
    expect(town.t && town.h && town.t.x === town.h.x && town.t.y === town.h.y, 'в городе звёздочка не у отеля', town);
    // в отеле: над Сеней у бассейна на крыше
    await ev(() => window.__dev.enterBuilding('hotel'));
    await L.untilScene('hotel');
    await L.frames(3);
    const roof = await ev(async () => {
      const Q = await import('/js/features/quests.js'),
        sc = window.__dev.scene,
        a = sc.actors.find((q) => q.id === 'senya' && (!q.when || q.when()));
      return { p: Q.sideStar(sc), x: a && a.x, f: a && a.f, top: a && sc.geo.fy(a.f) };
    });
    expect(roof.p && roof.p.x === roof.x && roof.f === 2 && roof.p.y < roof.top - 150, 'в отеле звёздочка не над Сеней', roof);
    // житель в номере 203 (с ним только что говорили — он остаётся там, G.talkPin): звёздочка — над дверью 203
    const door = await ev(async () => {
      const D = await import('/js/data/index.js'),
        St = await import('/js/core/state.js'),
        Q = await import('/js/features/quests.js'),
        H = await import('/js/interiors/hotel.js'),
        d = window.__dev,
        s = d.G.state,
        min = D.HOTEL.roomGuest.from * 60 + 30;
      for (let day = s.day; day < s.day + 400; day++) {
        d.actions.mutate((q) => {
          q.day = day;
          q.minutes = min;
        });
        if (St.hotelRoomGuest() === 'prof') break;
      }
      if (St.hotelRoomGuest() !== 'prof') return null;
      d.G.talkPin = { id: 'prof', place: St.npcPlace('prof'), day: s.day, until: s.minutes + 30 };
      d.actions.mutate((q) => (q.quests.cave_light = { day: q.day, n: { 0: 1, 1: 1 }, got: {}, done: null }));
      d.goal.set('cave_light');
      const sc = d.scene;
      return { at: St.npcPlace('prof').at, p: Q.sideStar(sc), door: H.HX.doors[2], floor: sc.geo.fy(1) };
    });
    expect(door && door.at === 'room', 'Профессор в номере 203 (проверка не годится)', door);
    expect(door.p && door.p.x === door.door && door.p.y < door.floor - 186, 'в отеле звёздочка не над дверью 203', door);
  });
};
