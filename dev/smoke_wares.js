// Шаги автотеста про «витрину дня» (Э1, вторая половина): сезонная одежда, мебель и украшения, «привоз» обычных
// вещей, вещицы на рынке, задания и подарки, свой бутик. Подключается из dev/smoke.js.
// Только эти шаги:  node dev/smoke.js <url> "step:витрина дня"
const fs = require('fs');
const path = require('path');
const SAVE_V3 = fs.readFileSync(path.join(__dirname, 'saves', 'v3.json'), 'utf8');

// первый день месяца: январь (зима), апрель (весна), июль (лето), октябрь (осень); в месяце 3 дня
const DAY = { winter: 0, spring: 9, summer: 18, autumn: 27 };
const BEACH = { do: 'clothes-shop', vendor: 'beach', shops: ['beach'], title: 'Пляжный магазинчик' };

module.exports = async function wares({ page, step, ev, wait, closeAll }) {
  const state = () => ev(() => JSON.parse(JSON.stringify(window.__dev.G.state)));
  const norm = (t) => t.replace(/[\u00a0\u202f\u2009]/g, ' ');
  const text = async (sel) => norm(await page.locator(sel).first().innerText());
  const expect = (ok, msg, data) => {
    if (!ok) throw new Error(msg + (data === undefined ? '' : ': ' + JSON.stringify(data)));
  };
  /** Новая игра с чистого листа (шаг не зависит от того, что было до него). */
  const fresh = async () => {
    await ev(() => {
      window.__dev.G.state = null;
      localStorage.clear();
    });
    await page.reload();
    await wait(400);
    await page.click('text=Играть!');
    await wait(400);
    await page.click('text=Поехали!');
    await wait(500);
    await ev(() => window.__dev.go('world'));
    await wait(400);
  };
  /** Перенестись в день day (утро, отметки дня чистые) и положить монет. */
  const setDay = (day, money = 20000) =>
    ev(
      ([day, money]) =>
        window.__dev.actions.mutate((s) => {
          s.day = day;
          s.dayFlags = {};
          s.minutes = 10 * 60;
          s.money = money;
        }),
      [day, money],
    );
  /** Витрины всех магазинов на сегодня: вещь → [есть ли, цена, сезон, «привезли сегодня»]; и вещицы рынка. */
  const snapshot = () =>
    ev(async () => {
      const d = window.__dev,
        D = await import('./js/data/index.js');
      const shelf = {};
      for (const shop of ['mall', 'boutique', 'beach', 'home', 'market'])
        for (const { def } of D.shopWares(shop)) {
          const w = d.F.wareToday(def);
          shelf[shop + ':' + def.id] = [w.here, w.price, w.season, w.fresh];
        }
      return { shelf, trinkets: d.F.trinketsToday().map((q) => q.def.id) };
    });
  /** Карточка товара в открытом окне — по названию. */
  const card = (name) =>
    page
      .locator('.overlay')
      .last()
      .locator('.card', { has: page.locator('.nm', { hasText: new RegExp('^' + name + '$') }) });
  const cardInfo = async (name) => {
    const c = card(name);
    expect((await c.count()) === 1, `нет карточки «${name}»`);
    return {
      away: await c.evaluate((e) => e.classList.contains('away')),
      text: norm(await c.innerText()),
      badge: norm(await c.evaluate((e) => [...e.querySelectorAll('.badge')].map((b) => b.textContent).join('|'))),
      btn: await c.locator('.btn').count(),
    };
  };
  const enter = async (id) => {
    await ev((id) => {
      window.__dev.enterBuilding(id);
    }, id);
    await wait(450);
  };
  const run = async (act) => {
    await ev((act) => {
      window.__dev.run(act);
    }, act);
    await wait(450);
  };
  const tab = async (name) => {
    await page.click(`.overlay .tab >> text=${name}`);
    await wait(300);
  };
  /** Дождаться, пока закроются все окна «Задание выполнено» и сюрпризы (они встают в очередь и всплывают по одному). */
  const settle = async () => {
    for (let quiet = 0, i = 0; quiet < 2 && i < 12; i++) {
      await wait(500);
      const open = await ev(() => document.querySelectorAll('.overlay, .dialog').length);
      quiet = open ? 0 : quiet + 1;
      if (open) await closeAll();
    }
  };
  const reload = async () => {
    await ev(() => window.dispatchEvent(new Event('pagehide')));
    await page.reload();
    await wait(500);
    await page.click('text=Продолжить');
    await wait(900);
    await closeAll();
  };

  await step(
    'витрина дня: одежда — в сезон есть всегда, не в сезон редко и серой карточкой; скидка, новинка, перезагрузка',
    async () => {
      await fresh();
      // расчёт на год: сезонная вещь в сезон есть каждый день, не в сезон — ровно один день в месяце (из трёх)
      const year = await ev(async () => {
        const D = await import('./js/data/index.js');
        const out = { n: 0, missing: [], off: [], phases: {}, sandals: {} };
        const sand = D.CLOTHES_BY_ID.sand_yellow;
        for (const c of D.CLOTHES.filter((q) => q.season && ['mall', 'beach'].includes(q.shop))) {
          out.n++;
          let off = 0,
            offOn = 0;
          for (let day = 0; day < 36; day++) {
            const phase = D.wareSeason(c, D.monthOfDay(day)),
              on = D.wareOn(c, day);
            if (phase !== 'off' && !on) out.missing.push([c.id, day]);
            if (phase === 'off') {
              off++;
              if (on) offOn++;
            }
          }
          if (!(off >= 18 && offOn * 3 === off)) out.off.push([c.id, offOn, off]);
        }
        for (const id of ['jw_red', 'swim_blue', 'rain_red', 'js_mint', 'ja_wine'])
          out.phases[id] = D.MONTHS.map((_, m) => D.wareSeason(D.CLOTHES_BY_ID[id], m)[0]).join('');
        // январь: в какие дни жёлтых сандалий нет и в какой день их привозят
        out.sandals = { away: [0, 1, 2].filter((d) => !D.wareOn(sand, d)), here: [0, 1, 2].filter((d) => D.wareOn(sand, d)) };
        return out;
      });
      expect(year.n >= 30 && !year.missing.length, 'сезонной одежды в сезон нет на витрине', year.missing.slice(0, 5));
      expect(!year.off.length, 'не в сезон вещь должна бывать ровно один день из трёх', year.off);
      expect(
        year.phases.jw_red === 'iloooooonii' + 'i' &&
          year.phases.swim_blue === 'oonii' + 'iiloooo' &&
          year.phases.rain_red === 'oonilooonilo' &&
          year.phases.js_mint === 'oonilooooooo' &&
          year.phases.ja_wine === 'oooooooonilo',
        'сезоны одежды по месяцам',
        year.phases,
      );
      expect(year.sandals.away.length === 2 && year.sandals.here.length === 1, 'сандалии в январе', year.sandals);

      // январь, день без сандалий: тёплое — «Сезон!», сандалии — серая карточка «привезут…, сезон — весной и летом»
      await setDay(year.sandals.away[0]);
      await enter('mall_fashion');
      await tab('Обувь');
      let c = await cardInfo('Угги');
      expect(!c.away && c.badge === 'Сезон!' && c.btn === 1 && c.text.includes('600'), 'угги зимой', c);
      c = await cardInfo('Жёлтые сандалии');
      expect(
        c.away &&
          c.btn === 0 &&
          /Сегодня нет — привезут (завтра|послезавтра|через \d дн\S+)\. Сезон — весной \S+ и летом/.test(c.text),
        'серая карточка сандалий зимой',
        c,
      );
      // серую карточку не примерить и не купить; все десять пар обуви видны — ничего не спрятано
      await card('Жёлтые сандалии').click();
      await wait(250);
      expect((await page.locator('.overlay .card.sel').count()) === 0, 'вещь, которой нет, примерилась');
      expect((await page.locator('.overlay .card').count()) === 10, 'в отделе обуви видны не все вещи');
      c = await cardInfo('Белые кроссовки');
      expect(!c.away && !c.badge && c.btn === 1, 'базовая вещь — без значков и всегда на месте', c);
      await closeAll();

      // перезагрузка страницы в тот же день: витрины всех магазинов и вещицы рынка — те же
      const before = await snapshot();
      await reload();
      const after = await snapshot();
      expect(JSON.stringify(after) === JSON.stringify(before), 'после перезагрузки витрина дня изменилась', {
        diff: Object.keys(before.shelf).filter((k) => String(after.shelf[k]) !== String(before.shelf[k])),
        trinkets: [before.trinkets, after.trinkets],
      });
      // наутро витрина другая
      await ev(() => {
        window.__dev.actions.nextDay();
        window.__dev.F.newDayMail();
      });
      await wait(300);
      await closeAll();
      const next = await snapshot();
      expect(JSON.stringify(next.shelf) !== JSON.stringify(before.shelf), 'наутро витрина та же самая');
      expect(next.shelf['mall:ugg_beige'][0] && next.shelf['mall:sn_white'][0], 'сезонное и базовое есть и назавтра');

      // день, когда сандалии привезли: «Не сезон», цена обычная; купленное остаётся на витрине со значком «Есть ✓»
      await ev(() => window.__dev.go('world'));
      await wait(300);
      await setDay(year.sandals.here[0]);
      await enter('mall_fashion');
      await tab('Обувь');
      c = await cardInfo('Жёлтые сандалии');
      expect(!c.away && c.badge === 'Не сезон' && c.btn === 1 && c.text.includes('250'), 'сандалии «не сезон»', c);
      let s0 = await state();
      await card('Жёлтые сандалии').locator('.btn').click();
      await wait(300);
      let s1 = await state();
      expect(
        s1.clothes.includes('sand_yellow') && s0.money - s1.money === 250 && s1.look.outfit.feet === 'sand_yellow',
        'сандалии не куплены по обычной цене',
        s0.money - s1.money,
      );
      expect(!s1.dayFlags.bought, 'покупка вещи не должна писать «сколько осталось»', s1.dayFlags);
      await closeAll();
      // в день, когда их не привозят, своя вещь с витрины не пропадает: её можно надеть прямо в магазине
      await setDay(year.sandals.away[0]);
      await enter('mall_fashion');
      await tab('Обувь');
      c = await cardInfo('Жёлтые сандалии');
      expect(!c.away && c.badge === 'Есть ✓', 'купленная вещь стала серой', c);
      await closeAll();

      // февраль — последний месяц тёплых вещей: скидка 30 %, монет уходит меньше
      await setDay(4);
      await enter('mall_fashion');
      await tab('Обувь');
      c = await cardInfo('Угги');
      expect(c.badge === 'Скидка −30 %' && c.text.includes('420') && c.text.includes('600'), 'угги на распродаже', c);
      s0 = await state();
      await card('Угги').locator('.btn').click();
      await wait(300);
      s1 = await state();
      expect(s1.clothes.includes('ugg_beige') && s0.money - s1.money === 420, 'цена на распродаже', s0.money - s1.money);
      await closeAll();
      // сентябрь — первый месяц: «Новинка!» по обычной цене
      await setDay(24);
      await enter('mall_fashion');
      await tab('Обувь');
      c = await cardInfo('Розовые угги');
      expect(c.badge === 'Новинка!' && c.text.includes('650') && c.btn === 1, 'новинка в сентябре', c);
      await closeAll();

      // лето: купленные зимой угги лежат в шкафу и надеваются — сезон касается только прилавка
      await setDay(DAY.summer + 1);
      await ev(() => window.__dev.F.openWardrobe());
      await wait(400);
      await tab('Обувь');
      await card('Жёлтые сандалии').click();
      await wait(250);
      await card('Угги').click();
      await wait(250);
      s1 = await state();
      expect(s1.look.outfit.feet === 'ugg_beige', 'зимняя вещь летом не надевается', s1.look.outfit);
      await closeAll();
      // пляжный магазинчик летом: купальник и шляпа — «Сезон!»; зимой часть вещей серая, но выбор есть
      await run(BEACH);
      await tab('Верх');
      c = await cardInfo('Звёздный купальник');
      expect(!c.away && c.badge === 'Сезон!', 'купальник летом', c);
      await closeAll();
    },
  );

  await step('витрина дня: мебель — камин и гирлянда по сезону, привоз, строка «Сегодня привезли»', async () => {
    await fresh();
    // расчёт на два года: базовое — всегда; «привоз» — два дня из трёх; особенное — через день; сезонное — в сезон
    const year = await ev(async () => {
      const D = await import('./js/data/index.js');
      const out = { base: [], delivery: [], special: [], season: [], n: {} };
      for (const { def } of [...D.shopWares('home'), ...D.shopWares('mall'), ...D.shopWares('boutique'), ...D.shopWares('beach')]) {
        const on = [];
        for (let day = 0; day < 72; day++) on.push(D.wareOn(def, day) ? 1 : 0);
        const sum = (from, n) => on.slice(from, from + n).reduce((a, b) => a + b, 0);
        const kind = def.season ? 'season' : def.stock || 'base';
        out.n[kind] = (out.n[kind] || 0) + 1;
        if (kind === 'base' && sum(0, 72) !== 72) out.base.push(def.id);
        if (kind === 'delivery') for (let b = 0; b < 72; b += 3) if (sum(b, 3) !== 2) out.delivery.push([def.id, b]);
        if (kind === 'special') for (let b = 0; b < 72; b += 2) if (sum(b, 2) !== 1) out.special.push([def.id, b]);
        if (kind === 'season')
          for (let day = 0; day < 72; day++)
            if (D.wareSeason(def, D.monthOfDay(day)) !== 'off' && !on[day]) out.season.push([def.id, day]);
      }
      const F = D.FURN_BY_ID;
      out.phases = Object.fromEntries(
        ['fireplace', 'hammock', 'garland', 'seedling_shelf'].map((id) => [
          id,
          D.MONTHS.map((_, m) => D.wareSeason(F[id], m)[0]).join(''),
        ]),
      );
      out.fireJuly = [18, 19, 20].map((d) => D.wareOn(F.fireplace, d));
      return out;
    });
    expect(!year.base.length, 'базовая вещь бывает не каждый день', year.base);
    expect(!year.delivery.length, '«привоз» — два дня из трёх', year.delivery.slice(0, 5));
    expect(!year.special.length, 'особенное — через день', year.special.slice(0, 5));
    expect(!year.season.length, 'сезонной вещи в сезон нет', year.season.slice(0, 5));
    expect(year.n.base >= 80 && year.n.delivery >= 35 && year.n.special >= 8 && year.n.season >= 35, 'разметка', year.n);
    expect(
      year.phases.fireplace === 'iloooooonii' + 'i' &&
        year.phases.hammock === 'oonii' + 'iiloooo' &&
        year.phases.garland === 'looooooooo' + 'ni' &&
        year.phases.seedling_shelf === 'oonilooooooo',
      'сезоны мебели по месяцам',
      year.phases,
    );

    // январь: камин — «Сезон!»; гирлянда после Нового года — со скидкой; гамак — серый или «Не сезон»
    await setDay(DAY.winter);
    await enter('mall_home');
    await tab('Мебель');
    let c = await cardInfo('Камин');
    expect(!c.away && c.badge === 'Сезон!' && c.text.includes('3 000'), 'камин зимой', c);
    await tab('На стену');
    c = await cardInfo('Гирлянда-огоньки');
    expect(!c.away && c.badge === 'Скидка −30 %' && c.text.includes('180') && c.text.includes('250'), 'гирлянда', c);
    const s0 = await state();
    await card('Гирлянда-огоньки').locator('.btn').click();
    await wait(300);
    const s1 = await state();
    expect(
      (s1.storage.garland || 0) === (s0.storage.garland || 0) + 1 && s0.money - s1.money === 180,
      'гирлянда со скидкой',
      s0.money - s1.money,
    );
    // строка над витриной называет то, что привезли сегодня, а у этих вещей — значок «Сегодня!»
    const today = await ev(async () => {
      const d = window.__dev,
        D = await import('./js/data/index.js');
      const out = {};
      for (const cat of D.FURN_CATS) {
        const list = D.FURNITURE.filter((f) => f.shop === 'home' && f.cat === cat.id);
        out[cat.name] = {
          fresh: list.filter((f) => !f.season && d.F.wareToday(f).fresh).map((f) => f.name),
          freshAll: list.filter((f) => d.F.wareToday(f).fresh).map((f) => f.name),
          gone: list.filter((f) => !f.season && !d.F.wareToday(f).here).map((f) => f.name),
          all: list.length,
        };
      }
      return out;
    });
    const [catName, cat] = Object.entries(today).find(([, q]) => q.fresh.length && q.gone.length) || [];
    expect(catName, 'в январе нет отдела, где что-то привезли, а чего-то нет', today);
    await tab(catName);
    const note = await text('.overlay .ware-note');
    expect(note.includes('Сегодня привезли:') && cat.freshAll.some((n) => note.includes(n)), 'строка про привоз', [
      note,
      cat.freshAll,
    ]);
    c = await cardInfo(cat.fresh[0]);
    expect(!c.away && c.badge.includes('Сегодня!') && c.btn === 1, 'вещь из привоза', c);
    c = await cardInfo(cat.gone[0]);
    expect(
      c.away && c.btn === 0 && /Сегодня нет — привезут (завтра|послезавтра)\./.test(c.text) && !c.text.includes('Сезон'),
      'обычная вещь, которую сегодня не привезли',
      c,
    );
    expect((await page.locator('.overlay .card').count()) === cat.all, 'в отделе видны не все вещи', cat.all);
    await closeAll();

    // июль: камин — не сезон (один день из трёх), подпись говорит, когда сезон; гирлянду привозят к Новому году
    const day = DAY.summer + year.fireJuly.indexOf(false);
    await setDay(day);
    await enter('mall_home');
    await tab('Мебель');
    c = await cardInfo('Камин');
    expect(c.away && c.text.includes('Сезон — осенью 🍂 и зимой ❄️'), 'камин летом', c);
    await closeAll();
    await setDay(DAY.summer + year.fireJuly.indexOf(true));
    await enter('mall_home');
    await tab('Мебель');
    c = await cardInfo('Камин');
    expect(!c.away && c.badge === 'Не сезон' && c.text.includes('3 000'), 'камин летом в день привоза', c);
    await tab('На стену');
    c = await cardInfo('Гирлянда-огоньки');
    expect(c.away ? c.text.includes('Сезон — к Новому году') : c.badge === 'Не сезон', 'гирлянда летом', c);
    await tab('Диваны');
    c = await cardInfo('Гамак');
    expect(!c.away && c.badge === 'Сезон!', 'гамак летом', c);
    await closeAll();
  });

  await step('витрина дня: в каждом магазине в любой день года есть выбор, ни одна вещь не спрятана', async () => {
    await fresh();
    // расчёт: каждый день двух лет в каждом магазине не меньше WARES.minChoice вещей и ни одного пустого отдела
    const year = await ev(async () => {
      const D = await import('./js/data/index.js');
      const out = { min: {}, low: [], empty: [] };
      for (const shop of ['mall', 'boutique', 'beach', 'home']) {
        const list = D.shopWares(shop).map((q) => q.def),
          tabs = [...new Set(list.map((d) => d.slot || d.cat))];
        out.min[shop] = Infinity;
        for (let day = 0; day < 72; day++) {
          const on = list.filter((d) => D.wareOn(d, day));
          out.min[shop] = Math.min(out.min[shop], on.length);
          if (on.length < D.WARES.minChoice[shop]) out.low.push([shop, day, on.length]);
          for (const t of tabs) if (!on.some((d) => (d.slot || d.cat) === t)) out.empty.push([shop, day, t]);
        }
      }
      return out;
    });
    expect(!year.low.length && !year.empty.length, 'мало выбора или пустой отдел', year);
    expect(year.min.mall >= 40 && year.min.home >= 45 && year.min.boutique >= 12 && year.min.beach >= 4, 'мало', year.min);
    // окна магазинов зимой и летом: в каждом отделе есть что купить, а всего карточек — сколько вещей в таблице
    for (const sea of ['winter', 'summer']) {
      await setDay(DAY[sea] + 1, 1000);
      for (const [shop, open, min] of [
        ['mall', 'mall_fashion', 40],
        ['boutique', 'boutique', 12],
        ['beach', BEACH, 4],
        ['home', 'mall_home', 45],
      ]) {
        if (typeof open === 'string') await enter(open);
        else await run(open);
        const want = await ev(async (shop) => {
          const d = window.__dev,
            D = await import('./js/data/index.js');
          const list = D.shopWares(shop).map((q) => q.def);
          return { all: list.length, here: list.filter((q) => d.F.wareToday(q).here).length };
        }, shop);
        const tabs = await page.locator('.overlay .tab').allInnerTexts();
        let all = 0,
          here = 0;
        for (let i = 0; i < tabs.length; i++) {
          if (tabs[i].includes('Семена')) continue;
          await page.locator('.overlay .tab').nth(i).click();
          await wait(200);
          const n = await ev(() => ({
            all: document.querySelectorAll('.overlay .card').length,
            buy: document.querySelectorAll('.overlay .card:not(.away) .btn').length,
            away: document.querySelectorAll('.overlay .card.away').length,
            // у серой карточки всегда есть подпись, почему вещи нет
            mute: [...document.querySelectorAll('.overlay .card.away')].filter(
              (c) => !c.textContent.includes('Сегодня нет'),
            ).length,
          }));
          // (в пляжном магазинчике отдела «Низ» нет совсем — он пустой в любой день)
          expect(
            (n.buy >= 1 || (shop === 'beach' && n.all === 0)) && n.mute === 0 && n.buy + n.away === n.all,
            `${sea}, ${shop}: отдел «${tabs[i]}»`,
            n,
          );
          all += n.all;
          here += n.buy;
        }
        expect(all === want.all && here === want.here && here >= min, `${sea}: витрина магазина ${shop}`, {
          all,
          here,
          want,
        });
        await closeAll();
      }
    }
  });

  await step('витрина дня: рынок — три вещицы в день, сезонные со значком, после перезагрузки те же', async () => {
    await fresh();
    const year = await ev(async () => {
      const D = await import('./js/data/index.js');
      const days = [];
      for (let day = 0; day < 72; day++) days.push(D.trinketsOn(day).map((q) => q.def.id));
      const all = D.shopWares('market').map((q) => q.def.id);
      // зима: какой день января с летней вещицей («Не сезон») и какой с вязаным шарфом («Сезон!»)
      const summer = ['sunhat_daisy', 'beanbag_melon'];
      return {
        counts: [...new Set(days.map((d) => d.length))],
        sets: new Set(days.map((d) => [...d].sort().join())).size,
        seen: all.filter((id) => days.some((d) => d.includes(id))).length,
        all: all.length,
        offDay: [0, 1, 2, 3, 4, 5].find((d) => days[d].some((id) => summer.includes(id))),
        scarfDay: [0, 1, 2, 3, 4, 5].find((d) => days[d].includes('scarf_knit')),
        // не в сезон вещица приезжает не чаще одного дня из трёх
        offRate: days.slice(0, 6).filter((d) => d.includes('sunhat_daisy')).length,
      };
    });
    expect(year.counts.length === 1 && year.counts[0] === 3, 'вещиц должно быть три в день', year.counts);
    expect(year.sets >= 8 && year.seen === year.all && year.all === 7, 'вещицы должны меняться', year);
    expect(year.offDay !== undefined && year.scarfDay !== undefined && year.offRate <= 2, 'сезонные вещицы', year);

    await setDay(year.offDay);
    const snap = await snapshot();
    await run('market:buy');
    const names = await ev(async (ids) => {
      const D = await import('./js/data/index.js');
      return ids.map((id) => (D.CLOTHES_BY_ID[id] || D.FURN_BY_ID[id]).name);
    }, snap.trinkets);
    const shown = await page.locator('.overlay .grid').first().locator('.card .nm').allInnerTexts();
    expect(JSON.stringify(shown.map(norm)) === JSON.stringify(names.map(norm)), 'на рынке не те вещицы', [shown, names]);
    const off = await ev(async (ids) => {
      const D = await import('./js/data/index.js');
      const id = ids.find((q) => ['sunhat_daisy', 'beanbag_melon'].includes(q));
      return (D.CLOTHES_BY_ID[id] || D.FURN_BY_ID[id]).name;
    }, snap.trinkets);
    let c = await cardInfo(off);
    expect(c.badge === 'Не сезон' && c.btn === 1, 'летняя вещица зимой', c);
    await closeAll();
    // перезагрузка: вещицы те же; наутро — другие или в другом порядке
    await reload();
    const again = await snapshot();
    expect(JSON.stringify(again.trinkets) === JSON.stringify(snap.trinkets), 'после перезагрузки вещицы другие', [
      snap.trinkets,
      again.trinkets,
    ]);
    await ev(() => window.__dev.go('world'));
    await wait(300);
    // вязаный шарф зимой — «Сезон!»; покупка: вещь в шкафу, на карточке «Есть ✓»
    await setDay(year.scarfDay);
    await run('market:buy');
    c = await cardInfo('Вязаный шарф ручной работы');
    expect(c.badge === 'Сезон!' && c.text.includes('700'), 'вязаный шарф зимой', c);
    const s0 = await state();
    await card('Вязаный шарф ручной работы').locator('.btn').click();
    await wait(300);
    const s1 = await state();
    expect(s1.clothes.includes('scarf_knit') && s0.money - s1.money === 700, 'шарф с рынка не куплен', s1.money);
    c = await cardInfo('Вязаный шарф ручной работы');
    expect(c.badge === 'Есть ✓' && c.btn === 0, 'купленная вещица', c);
    expect((await text('.overlay .panel-body')).includes('Не по сезону'), 'на рынке нет раздела «Не по сезону»');
    await closeAll();
  });

  await step('витрина дня: задания выполнимы в четырёх сезонах, письма называют вещи с витрины; подарки', async () => {
    await fresh();
    for (const [sea, day0] of Object.entries(DAY)) {
      const day = day0 + 36 + 1; // второй год: первые дни игры письма идут по списку
      await setDay(day);
      // «Обновка»: письмо называет вещи, которые сегодня точно есть в ТЦ «Модный»; покупка выполняет задание
      const tip = await ev(async () => {
        const d = window.__dev,
          D = await import('./js/data/index.js'),
          G = await import('./js/core/state.js');
        d.actions.setMail('buy_clothes');
        d.actions.readMail();
        d.F.showLetter();
        const here = d.F.waresHere('mall').map((q) => q.def);
        return {
          season: G.cal().season,
          here: here.filter((c) => !d.G.state.clothes.includes(c.id)).map((c) => c.name.toLowerCase()),
          furn: d.F.waresHere('home').map((q) => q.def.name.toLowerCase()),
        };
      });
      await wait(350);
      let letter = await text('.overlay .panel-body');
      await closeAll();
      expect(tip.season === sea, 'не тот сезон', [sea, tip.season]);
      let named = (letter.match(/точно есть: (.*?) — и ещё/) || [])[1];
      expect(
        named && named.split(', ').length === 3 && named.split(', ').every((n) => tip.here.includes(n)),
        `${sea}: письмо «Обновка» называет не то`,
        [letter, named],
      );
      await enter('mall_fashion');
      const first = norm(await page.locator('.overlay .card:not(.away) .nm').first().innerText());
      await page.click('.overlay .card:not(.away) .btn.green');
      await wait(300);
      await closeAll();
      let s = await state();
      expect(s.mail.done && s.clothes.length > 12, `${sea}: «Обновка» не выполнена покупкой (${first})`, s.mail);
      await settle();
      // «Уют на вилле»: письмо называет мебель с витрины; купленное ставится дома — задание выполнено
      await ev(() => {
        const d = window.__dev;
        d.actions.setMail('buy_furn');
        d.actions.readMail();
        d.F.showLetter();
      });
      await wait(350);
      letter = await text('.overlay .panel-body');
      await closeAll();
      named = (letter.match(/точно есть: (.*?) — и ещё/) || [])[1];
      expect(
        named && named.split(', ').length === 3 && named.split(', ').every((n) => tip.furn.includes(n)),
        `${sea}: письмо «Уют на вилле» называет не то`,
        [letter, named],
      );
      await enter('mall_home');
      const before = await state();
      await page.click('.overlay .card:not(.away) .btn.green');
      await wait(300);
      await closeAll();
      s = await state();
      const got = Object.keys(s.storage).find((id) => (s.storage[id] || 0) > (before.storage[id] || 0));
      expect(got && s.money < before.money, `${sea}: мебель не куплена`, s.storage);
      await ev((id) => window.__dev.actions.placeFurn('villa', id, 0, 400, 0), got);
      await wait(300);
      s = await state();
      expect(s.mail.done, `${sea}: «Уют на вилле» не выполнено`, s.mail);
      await settle();
    }
    // купальник для «Купания в море» есть с первого дня и надевается в любой сезон
    const swim = await ev(() => {
      const d = window.__dev;
      d.actions.wear('body', 'swim_pink');
      return d.G.state.look.outfit.body;
    });
    expect(swim === 'swim_pink', 'стартовый купальник не надевается', swim);
    // когда на витринах не осталось ничего нового, письмо «Обновка» не приходит
    const mail = await ev(async () => {
      const d = window.__dev,
        D = await import('./js/data/index.js');
      const draw = () => {
        const got = new Set();
        for (let i = 0; i < 120; i++) {
          d.F.newDayMail();
          got.add(d.G.state.mail.task);
        }
        return got.has('buy_clothes');
      };
      d.actions.mutate((s) => (s.lastTasks = []));
      const usual = draw();
      for (const c of D.CLOTHES) if (['mall', 'boutique', 'beach'].includes(c.shop)) d.actions.addClothes(c.id);
      d.actions.mutate((s) => (s.lastTasks = []));
      return { usual, full: draw() };
    });
    expect(mail.usual && !mail.full, 'письмо «Обновка» и витрина дня', mail);
    await closeAll();
    // праздничные подарки — только около своего праздника: колпак к Новому году, шляпа волшебницы к Хэллоуину
    const gifts = await ev(async () => {
      const d = window.__dev,
        has = (id) => d.G.state.clothes.includes(id);
      const out = {};
      // (зимой сюрприз за задание мог подарить колпак по-честному — проверяем с чистого листа)
      d.actions.mutate((s) => (s.clothes = s.clothes.filter((id) => !['hat_santa', 'hat_witch'].includes(id))));
      for (const [name, day] of [['july', 18], ['october', 27], ['december', 33]]) {
        d.actions.mutate((s) => (s.day = day));
        for (let i = 0; i < 60 && !(has('hat_santa') && has('hat_witch')); i++) d.F.grantSurprise();
        out[name] = [has('hat_santa'), has('hat_witch')];
      }
      return out;
    });
    expect(
      String(gifts.july) === 'false,false' && String(gifts.october) === 'false,true' && String(gifts.december) === 'true,true',
      'праздничные подарки не по сезону',
      gifts,
    );
    await wait(300);
    await closeAll();
  });

  await step('витрина дня: свой бутик — та же витрина, выручка идёт; сохранение v3 — версия та же', async () => {
    await fresh();
    await setDay(DAY.spring, 5000);
    await ev(() => window.__dev.actions.addBiz('boutique'));
    await enter('boutique');
    await tab('Верх');
    const foot = await text('.overlay .panel-foot');
    expect(foot.includes('Оформить витрину') || foot.includes('Моё заведение'), 'в своём бутике нет кнопок хозяйки', foot);
    const view = await ev(async () => {
      const d = window.__dev,
        D = await import('./js/data/index.js');
      const body = D.shopWares('boutique')
        .map((q) => q.def)
        .filter((c) => c.slot === 'body');
      return {
        all: body.length,
        gone: body.filter((c) => !d.F.wareToday(c).here).map((c) => c.name),
        here: body.filter((c) => d.F.wareToday(c).here).map((c) => c.name),
      };
    });
    expect(
      (await page.locator('.overlay .card').count()) === view.all &&
        (await page.locator('.overlay .card.away').count()) === view.gone.length &&
        view.here.length >= 4,
      'витрина своего бутика',
      view,
    );
    // покупка в своём бутике — по обычной цене, как у всех
    const s0 = await state();
    await card('Пушистый халат').locator('.btn').click();
    await wait(300);
    let s = await state();
    expect(s.clothes.includes('robe') && s0.money - s.money === 2500, 'покупка в своём бутике', s0.money - s.money);
    await closeAll();
    // выручка заведения от витрины дня не зависит
    const till = await ev(async () => {
      const d = window.__dev,
        D = await import('./js/data/index.js');
      d.actions.nextDay();
      d.F.newDayMail();
      return [d.G.state.biz.boutique.till, D.BIZ.boutique.income];
    });
    await wait(300);
    await closeAll();
    expect(till[0] === till[1], 'выручка бутика за день', till);

    // сохранение-образец v3: новых полей нет — версия та же, вещи на месте; купленное носится и не в сезон
    const old = JSON.parse(SAVE_V3);
    await ev((raw) => {
      window.__dev.G.state = null;
      localStorage.removeItem('rhr-save-backup');
      localStorage.setItem('rhr-save-v1', raw);
    }, SAVE_V3);
    await page.reload();
    await wait(500);
    await page.click('text=Продолжить');
    await wait(900);
    await closeAll();
    s = await state();
    expect(
      s.v === old.v &&
        s.money === old.money &&
        JSON.stringify([...s.clothes].sort()) === JSON.stringify([...old.clothes].sort()) &&
        s.villa.length === old.villa.length,
      'сохранение v3: версия или вещи изменились',
      [s.v, old.v, s.clothes.length, old.clothes.length],
    );
    const worn = await ev(() => {
      const d = window.__dev;
      d.actions.mutate((q) => (q.day = 19)); // июль
      d.actions.wear('body', 'jw_blue');
      d.actions.wear('head', 'beanie_red');
      return d.G.state.look.outfit;
    });
    expect(worn.body === 'jw_blue' && worn.head === 'beanie_red', 'зимние вещи летом не надеваются', worn);
    await ev(() => window.__dev.go('villa'));
    await wait(400);
  });
};
