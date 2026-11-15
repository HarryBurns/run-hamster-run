// Шаги автотеста про сезонность продуктов (Э1): цены и ассортимент дня в ТЦ «Вкусный», на рынке и в кафе,
// огород по сезонам, подсказки в окне готовки и в письмах. Подключается из dev/smoke.js.
// Только эти шаги:  node dev/smoke.js <url> step:сезонность
const fs = require('fs');
const path = require('path');
const SAVE_V3 = fs.readFileSync(path.join(__dirname, 'saves', 'v3.json'), 'utf8');

// первый день месяца: январь (зима), апрель (весна), июль (лето), октябрь (осень); в месяце 3 дня
const DAY = { winter: 0, spring: 9, summer: 18, autumn: 27 };

module.exports = async function seasons({ page, step, ev, wait, closeAll }) {
  const state = () => ev(() => JSON.parse(JSON.stringify(window.__dev.G.state)));
  const norm = (t) => t.replace(/[  ]/g, ' ');
  const text = async (sel) => norm(await page.locator(sel).first().innerText());
  const toasts = async () =>
    norm(await ev(() => (document.querySelector('#toasts') || { textContent: '' }).textContent));
  const clearToasts = () =>
    ev(() => {
      const t = document.querySelector('#toasts');
      if (t) t.innerHTML = '';
    });
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
  /** Снимок прилавков на сегодня: продукт → [сезон, цена, ТЦ: что и сколько осталось, рынок: что и сколько]. */
  const snapshot = () =>
    ev(async () => {
      const d = window.__dev,
        D = await import('./js/data/index.js');
      const left = (st) => (st.limited ? st.left : -1);
      return Object.fromEntries(
        D.INGREDIENTS.filter((i) => i.price).map((i) => {
          const f = d.F.foodToday(i);
          return [i.id, [f.season, f.price, f.mall.state, left(f.mall), f.market.state, left(f.market)]];
        }),
      );
    });
  const table = () =>
    ev(async () => {
      const D = await import('./js/data/index.js');
      return Object.fromEntries(
        D.INGREDIENTS.map((i) => [
          i.id,
          { name: i.name, price: i.price, priceIn: i.priceIn, priceOff: i.priceOff, sell: i.sell, sellOff: i.sellOff },
        ]),
      );
    });
  /** Карточка товара в открытом окне — по названию. */
  const card = (name) =>
    page
      .locator('.overlay')
      .last()
      .locator('.card', { has: page.locator('.nm', { hasText: new RegExp('^' + name + '$') }) });
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

  await step(
    'сезонность: ТЦ «Вкусный» — в сезон есть и дешевле, не в сезон мало и кончается, перезагрузка',
    async () => {
      await fresh();
      await setDay(DAY.summer);
      const T = await table();
      const snap = await snapshot();
      const ids = Object.keys(snap);
      // в сезон: есть всегда, сколько угодно и дешевле обычного; круглый год — как обычно (кроме лакомств дня)
      const inS = ids.filter((id) => snap[id][0] === 'in'),
        off = ids.filter((id) => snap[id][0] === 'off'),
        plain = ids.filter((id) => !snap[id][0]);
      expect(inS.includes('mango') && inS.includes('carrot') && inS.includes('tomato'), 'летом сезон не у тех', inS);
      for (const id of inS)
        expect(
          snap[id][2] === 'ok' && snap[id][3] === -1 && snap[id][1] === T[id].priceIn && snap[id][1] < T[id].price,
          'в сезон продукт должен быть всегда и дешевле',
          [id, snap[id], T[id]],
        );
      for (const id of plain.filter((q) => q !== 'honey'))
        expect(snap[id][2] === 'ok' && snap[id][3] === -1 && snap[id][1] === T[id].price, 'круглогодичный продукт', [
          id,
          snap[id],
        ]);
      // не в сезон: дороже; если привезли — 1–3 штуки; что-то сегодня есть, чего-то нет
      for (const id of off) {
        expect(snap[id][1] === T[id].priceOff && snap[id][1] > T[id].price, 'не в сезон должно быть дороже', [
          id,
          snap[id],
        ]);
        if (snap[id][2] === 'ok') expect(snap[id][3] >= 1 && snap[id][3] <= 3, 'не в сезон запас 1–3', [id, snap[id]]);
        if (snap[id][4] === 'ok')
          expect(
            snap[id][2] === 'none' && snap[id][5] >= 1 && snap[id][5] <= 2,
            'рынок: только когда в ТЦ нет, 1–2 шт.',
            [id, snap[id]],
          );
      }
      const there = off.filter((id) => snap[id][2] === 'ok'),
        away = off.filter((id) => snap[id][2] === 'none');
      expect(there.length >= 2 && away.length >= 2, 'не в сезон: что-то должно быть, чего-то — нет', { there, away });

      // окно ТЦ: значок «Сезон!», покупка пачкой; запись о покупках за день для такого товара не ведётся
      await enter('mall_food');
      const s0 = await state();
      const mango = card('Манго');
      expect((await mango.locator('.badge.season').count()) === 1, 'у манго летом нет значка «Сезон!»');
      expect(norm(await mango.innerText()).includes(String(T.mango.priceIn)), 'цена манго в сезон');
      await mango.locator('.btn.blue').click(); // +5
      await wait(250);
      let s = await state();
      expect(
        (s.ing.mango || 0) === (s0.ing.mango || 0) + 5 &&
          s.money === s0.money - 5 * T.mango.priceIn &&
          !s.dayFlags.bought,
        'покупка в сезон',
        [s.ing.mango, s0.money - s.money, s.dayFlags],
      );
      // не в сезон: «Не сезон», «Осталось N шт.», одна кнопка; раскупили — карточка серая, купить больше нельзя
      const x = there[0],
        n = snap[x][3];
      let c = card(T[x].name);
      let ct = norm(await c.innerText());
      expect(
        ct.includes('Не сезон') && ct.includes(`Осталось ${n} шт.`) && ct.includes(String(T[x].priceOff)),
        'карточка не в сезон',
        ct,
      );
      expect((await c.locator('.btn').count()) === 1, 'у товара с малым запасом должна быть одна кнопка «+1»');
      const m1 = (await state()).money;
      for (let i = 0; i < n; i++) {
        await card(T[x].name).locator('.btn').click();
        await wait(220);
      }
      s = await state();
      expect(
        (s.ing[x] || 0) === (s0.ing[x] || 0) + n &&
          s.money === m1 - n * T[x].priceOff &&
          s.dayFlags.bought['food:' + x] === n,
        'покупка не в сезон',
        [x, n, s.ing[x], m1 - s.money, s.dayFlags.bought],
      );
      c = card(T[x].name);
      ct = norm(await c.innerText());
      expect(
        (await c.evaluate((e) => e.classList.contains('away'))) && ct.includes('Раскупили') && ct.includes('Сезон'),
        'раскупленный товар должен остаться серой карточкой с подписью',
        ct,
      );
      expect((await c.locator('.btn').count()) === 0, 'у раскупленного товара осталась кнопка');
      const more = await ev(async (x) => {
        const d = window.__dev,
          D = await import('./js/data/index.js'),
          m = d.G.state.money;
        return { ok: d.F.buyFood(D.ING_BY_ID[x], 1, 'food'), same: d.G.state.money === m };
      }, x);
      expect(more.ok === false && more.same, 'раскупленное купилось ещё раз', more);
      // чего сегодня не привезли: серая карточка, понятно почему и когда будет
      const y = away[0];
      c = card(T[y].name);
      ct = norm(await c.innerText());
      expect(
        (await c.evaluate((e) => e.classList.contains('away'))) &&
          ct.includes('Сегодня нет') &&
          /привезут (завтра|послезавтра)|спроси на рынке/.test(ct) &&
          ct.includes('Сезон —'),
        'карточка товара, которого сегодня нет',
        ct,
      );
      // все товары видны: ни один не спрятан
      expect((await page.locator('.overlay .card').count()) === ids.length, 'в ТЦ видны не все продукты', ids.length);
      await closeAll();

      // перезагрузка страницы в тот же день: ассортимент и купленное — те же
      const before = await snapshot();
      expect(before[x][2] === 'sold', 'раскупленное не помечено', before[x]);
      await ev(() => window.dispatchEvent(new Event('pagehide')));
      await page.reload();
      await wait(500);
      await page.click('text=Продолжить');
      await wait(900);
      await closeAll();
      const after = await snapshot();
      expect(JSON.stringify(after) === JSON.stringify(before), 'после перезагрузки ассортимент дня изменился', {
        diff: ids.filter((id) => String(after[id]) !== String(before[id])).map((id) => [id, before[id], after[id]]),
      });
      // наутро: вчерашние покупки забыты, прилавок другой
      await ev(() => {
        window.__dev.actions.nextDay();
        window.__dev.F.newDayMail();
      });
      await wait(300);
      await closeAll();
      const next = await snapshot();
      s = await state();
      expect(!s.dayFlags.bought, 'покупки за вчера не забыты', s.dayFlags);
      expect(JSON.stringify(next) !== JSON.stringify(before), 'ассортимент на следующий день тот же самый');
      expect(next.mango[2] === 'ok' && next.mango[3] === -1, 'манго в сезон есть и назавтра', next.mango);
    },
  );

  await step('сезонность: рынок — перепродажа не даёт прибыли, не в сезон платят больше, редкости', async () => {
    await fresh();
    const T = await table();
    // расчётом: ни для одного продукта ни в одном месяце рынок не платит больше половины цены покупки;
    // и даже купленное в сезон и придержанное до «не сезона» продаётся дешевле, чем куплено
    const arb = await ev(async () => {
      const D = await import('./js/data/index.js'),
        bad = [];
      for (const i of D.INGREDIENTS.filter((q) => q.price)) {
        const buy = D.MONTHS.map((_, m) => D.buyPrice(i, m)),
          sell = D.MONTHS.map((_, m) => D.sellPrice(i, m));
        if (sell.some((v, m) => v * 2 > buy[m]) || Math.max(...sell) >= Math.min(...buy)) bad.push(i.id);
      }
      for (const q of D.DISHES) if (q.cafe && q.sell >= q.price) bad.push(q.id);
      return bad;
    });
    expect(!arb.length, 'перепродажа с прибылью', arb);
    // на деле: купить манго летом (в сезон, дёшево) и тут же продать — в минусе
    await setDay(DAY.summer);
    const deal = await ev(async () => {
      const d = window.__dev,
        D = await import('./js/data/index.js'),
        ing = D.ING_BY_ID.mango;
      const m0 = d.G.state.money;
      const bought = d.F.buyFood(ing, 5, 'food');
      const paid = m0 - d.G.state.money;
      const g = () => d.F.sellable().find((q) => q.id === 'mango');
      const now = { price: g().sell, season: g().season, group: g().group };
      d.F.sellGoods(g(), 2);
      const got = d.G.state.money - (m0 - paid);
      return { bought, paid, now, got };
    });
    expect(deal.bought && deal.paid === 5 * T.mango.priceIn, 'покупка манго', deal);
    expect(
      deal.now.price === T.mango.sell &&
        deal.now.season === 'in' &&
        deal.now.group === 'own' &&
        deal.got === 2 * T.mango.sell,
      'продажа в сезон',
      deal,
    );
    expect(deal.got < 2 * T.mango.priceIn * 0.5 + 1, 'продать сразу после покупки — выгодно', deal);
    // окно рынка летом: у манго и морковки пометка «сезон: дешевле»
    await ev(() => window.__dev.actions.addItem('ing', 'carrot', 4));
    await run('market');
    let ct = norm(await card('Морковка').innerText());
    expect(ct.includes(`${T.carrot.sell} за штуку`) && ct.includes('сезон: дешевле'), 'морковка летом на рынке', ct);
    await closeAll();
    // придержали до зимы: платят в полтора раза больше, но всё равно меньше, чем манго стоило летом
    await setDay(DAY.winter + 36);
    const later = await ev(() => {
      const d = window.__dev,
        g = d.F.sellable().find((q) => q.id === 'mango'),
        m0 = d.G.state.money;
      const n = d.F.sellGoods(g, 3);
      return { price: g.sell, season: g.season, n, got: d.G.state.money - m0 };
    });
    expect(
      later.price === T.mango.sellOff &&
        later.price > T.mango.sell &&
        later.season === 'off' &&
        later.got === 3 * later.price,
      'продажа не в сезон',
      later,
    );
    expect(later.price < T.mango.priceIn, 'купить в сезон, придержать и продать — выгодно', [later, T.mango]);
    await run('market');
    ct = norm(await card('Морковка').innerText());
    expect(
      ct.includes(`${T.carrot.sellOff} за штуку`) && ct.includes('не сезон: дороже'),
      'морковка зимой на рынке',
      ct,
    );
    await closeAll();

    // редкости не по сезону: день, когда торговец что-то привёз (чего сегодня нет в ТЦ)
    let found = null;
    for (let day = DAY.winter + 36; day < DAY.winter + 48 && !found; day++) {
      await setDay(day);
      found = await ev(() => {
        const q = window.__dev.F.rareFood().find((r) => r.f.market.state === 'ok');
        return q
          ? { id: q.ing.id, name: q.ing.name, left: q.f.market.left, price: q.f.price, mall: q.f.mall.state }
          : null;
      });
    }
    expect(found, 'за 12 дней на рынке ни разу не было ничего не по сезону');
    expect(
      found.mall === 'none' && found.price === T[found.id].priceOff && found.left >= 1 && found.left <= 2,
      'редкость',
      found,
    );
    // в ТЦ про этот продукт сказано: спроси на рынке
    await enter('mall_food');
    ct = norm(await card(found.name).innerText());
    expect(ct.includes('Сегодня нет') && ct.includes('спроси на рынке'), 'ТЦ не подсказывает про рынок', ct);
    await closeAll();
    await run('market:buy');
    const s0 = await state();
    ct = norm(await card(found.name).innerText());
    expect(ct.includes(`Осталось ${found.left} шт.`) && ct.includes(String(found.price)), 'карточка редкости', ct);
    for (let i = 0; i < found.left; i++) {
      await card(found.name).locator('.btn').click();
      await wait(220);
    }
    const s = await state();
    expect(
      (s.ing[found.id] || 0) === (s0.ing[found.id] || 0) + found.left &&
        s.money === s0.money - found.left * found.price &&
        s.dayFlags.bought['market:' + found.id] === found.left,
      'покупка редкости',
      [s.ing[found.id], s0.money - s.money, s.dayFlags.bought],
    );
    const c = card(found.name);
    ct = norm(await c.innerText());
    expect(
      (await c.evaluate((e) => e.classList.contains('away'))) &&
        ct.includes('Раскупили') &&
        (await c.locator('.btn').count()) === 0,
      'раскупленная редкость',
      ct,
    );
    await closeAll();
    // то, что в сезоне, на рынке не продают: это есть в ТЦ, и дешевле
    const wrong = await ev(async () => {
      const D = await import('./js/data/index.js'),
        m = D.monthOfDay(window.__dev.G.state.day);
      return window.__dev.F.rareFood()
        .filter((r) => !D.isSeasonal(r.ing) || D.inSeason(r.ing, m))
        .map((r) => r.ing.id);
    });
    expect(!wrong.length, 'на рынке «не по сезону» лежит сезонное', wrong);
  });

  await step('сезонность: огород — не в сезон культуру не посадить, посаженное дорастает; семена', async () => {
    await fresh();
    await setDay(DAY.summer);
    const sow = await ev(async () => {
      const D = await import('./js/data/index.js');
      return {
        byMonth: D.MONTHS.map((_, m) => D.SEEDS.filter((s) => D.canSow(s, m)).map((s) => s.id)),
        start: Object.keys(window.__dev.G.state.seeds),
      };
    });
    expect(
      sow.byMonth.every((l) => l.length >= 1),
      'есть месяц, когда нечего посадить',
      sow.byMonth,
    );
    expect(
      sow.byMonth[0].join() === 'seed_lettuce' && sow.byMonth[9].includes('seed_pumpkin'),
      'сезоны посадки',
      sow.byMonth,
    );
    expect(sow.start.join() === 'seed_lettuce', 'новая игра (январь) должна начинаться с семян салата', sow.start);
    await ev(() => {
      const a = window.__dev.actions;
      a.addItem('seeds', 'seed_pumpkin', 1);
      a.addItem('seeds', 'seed_carrot', 1);
    });
    // летом тыкву не посадить: грядка пустая, семена целы, подсказка — когда можно
    await clearToasts();
    const r = await ev(() => {
      const d = window.__dev;
      return {
        can: [d.F.canPlantNow('seed_pumpkin'), d.F.canPlantNow('seed_lettuce'), d.F.canPlantNow('seed_carrot')],
        planted: d.F.plantOn(0, 'seed_pumpkin'),
        bed: d.G.state.garden[0].seed,
        seeds: d.G.state.seeds.seed_pumpkin,
      };
    });
    expect(r.can.join() === 'false,false,true' && r.planted === false && !r.bed && r.seeds === 1, 'тыква летом', r);
    let t = await toasts();
    expect(t.includes('Тыкву сажают осенью') && t.includes('морковку'), 'нет доброй подсказки, когда сажать', t);
    // окно «Что посадим?»: несезонные семена серые; нажали — ничего не посажено; морковка — сажается
    await run('garden:0');
    const pumpkin = card('Семена тыквы');
    expect(
      (await pumpkin.evaluate((e) => e.classList.contains('away'))) &&
        norm(await pumpkin.innerText()).includes('Не сезон'),
      'семена не в сезон не отмечены в окне грядки',
    );
    await clearToasts();
    await pumpkin.click();
    await wait(250);
    let s = await state();
    expect(
      !s.garden[0].seed && s.seeds.seed_pumpkin === 1 && (await page.locator('.overlay').count()) === 1,
      'тыква посадилась',
    );
    expect((await toasts()).includes('Тыкву сажают осенью'), 'нет подсказки в окне грядки');
    await card('Семена морковки').click();
    await wait(300);
    s = await state();
    expect(
      s.garden[0].seed === 'seed_carrot' && !s.seeds.seed_carrot && (await page.locator('.overlay').count()) === 0,
      'морковка не посадилась',
      s.garden[0],
    );
    // наступила зима: морковку больше не посадить, но посаженная дорастает и даёт урожай
    await setDay(DAY.winter + 36);
    const w = await ev(() => {
      const d = window.__dev;
      d.actions.addItem('seeds', 'seed_carrot', 1);
      const res = { carrot: d.F.plantOn(1, 'seed_carrot'), lettuce: d.F.plantOn(2, 'seed_lettuce') };
      d.actions.nextDay();
      d.F.newDayMail();
      const before = d.G.state.ing.carrot || 0;
      d.F.gardenBed(0);
      return {
        ...res,
        age: 1,
        got: (d.G.state.ing.carrot || 0) - before,
        bed0: d.G.state.garden[0].seed,
        bed2: d.G.state.garden[2],
      };
    });
    await wait(300);
    await closeAll();
    expect(
      w.carrot === false && w.lettuce === true && w.bed2.seed === 'seed_lettuce' && w.bed2.age === 1,
      'зимой: салат — да, морковка — нет',
      w,
    );
    expect(w.got === 5 && !w.bed0, 'посаженное летом зимой не доросло', w);
    // семена в ТЦ «Уютный дом»: видно, что пора сажать, а что — в другой сезон; купить впрок можно
    await enter('mall_home');
    await page.click('.overlay .tabs >> text=Семена');
    await wait(300);
    expect(
      (await card('Семена салата').locator('.badge.season').count()) === 1,
      'у семян салата зимой нет «Пора сажать!»',
    );
    const ct = norm(await card('Семена тыквы').innerText());
    expect(ct.includes('Сажают осенью') && ct.includes('Купить впрок'), 'семена не в сезон в магазине', ct);
    expect((await page.locator('.overlay .card').count()) === 6, 'в магазине видны не все семена');
    await closeAll();
    // рюкзак: у семян написано, пора ли сажать
    await ev(() => window.__dev.F.openBackpack());
    await wait(300);
    await page.click('.overlay .tabs >> text=Семена');
    await wait(250);
    t = await text('.overlay .panel-body');
    expect(t.includes('тыкву сажают осенью') && t.includes('в свой сезон'), 'рюкзак: семена', t);
    await closeAll();
  });

  await step('сезонность: лакомства дня в кафе, окно готовки, задания во всех четырёх сезонах', async () => {
    await fresh();
    // торт в кафе «Семечка» бывает не каждый день и понемногу; остальное есть всегда
    const cake = [];
    for (let day = 36; day < 45; day++) {
      await setDay(day);
      cake.push(
        await ev(async () => {
          const D = await import('./js/data/index.js'),
            st = window.__dev.F.stockToday('cafe', 'choco_cake', D.dishRule(D.DISH_BY_ID.choco_cake));
          return { state: st.state, left: st.left };
        }),
      );
    }
    const has = cake.findIndex((q) => q.state === 'ok'),
      none = cake.findIndex((q) => q.state === 'none');
    expect(has >= 0 && none >= 0, 'торт должен быть не каждый день', cake);
    expect(
      cake.filter((q) => q.state === 'ok').every((q) => q.left >= 2 && q.left <= 4),
      'торта 2–4 штуки',
      cake,
    );
    expect(cake.filter((q) => q.state === 'ok').length === 6, 'лакомство бывает два дня из трёх', cake);
    await setDay(36 + none);
    await enter('cafe');
    let c = card('Шоколадный торт');
    let ct = norm(await c.innerText());
    expect(
      (await c.evaluate((e) => e.classList.contains('away'))) && /Сегодня нет — загляни (завтра|послезавтра)/.test(ct),
      'торта нет',
      ct,
    );
    expect(
      (await page.locator('.overlay .card:not(.away) .btn.green').count()) >= 4,
      'в кафе без торта мало что купить',
    );
    await closeAll();
    await setDay(36 + has);
    await enter('cafe');
    const s0 = await state();
    ct = norm(await card('Шоколадный торт').innerText());
    expect(ct.includes('Сегодня!') && ct.includes(`Осталось ${cake[has].left} шт.`), 'торт дня', ct);
    for (let i = 0; i < cake[has].left; i++) {
      await card('Шоколадный торт').locator('.btn.green').click();
      await wait(220);
    }
    const s1 = await state();
    c = card('Шоколадный торт');
    ct = norm(await c.innerText());
    expect((s1.dishes.choco_cake || 0) === (s0.dishes.choco_cake || 0) + cake[has].left, 'торт не куплен', s1.dishes);
    expect(
      (await c.evaluate((e) => e.classList.contains('away'))) && ct.includes('Раскупили'),
      'торт не раскупили',
      ct,
    );
    await closeAll();

    // окно готовки: видно, чего не хватает и где это взять; про несезонное — когда сезон
    await setDay(DAY.summer);
    await ev(() => {
      const a = window.__dev.actions,
        s = window.__dev.G.state;
      for (const id of Object.keys(s.ing)) a.addItem('ing', id, -s.ing[id]);
      a.addItem('ing', 'mango', 1);
      window.__dev.F.openCooking();
    });
    await wait(350);
    const item = (name) => page.locator('.overlay .list-item', { has: page.locator('.ttl', { hasText: name }) });
    ct = norm(await item('Тарелка «Тропики»').innerText());
    expect(
      ct.includes('Киви — не сезон (сезон — осенью') && ct.includes('Ананас — сейчас сезон') && !ct.includes('Манго —'),
      'подсказки под рецептом с несезонным продуктом',
      ct,
    );
    expect(
      /Киви — не сезон[^\n]*(сегодня есть|сегодня нет в продаже)/.test(ct),
      'не сказано, есть ли киви сегодня',
      ct,
    );
    ct = norm(await item('Блинчики').innerText());
    expect(ct.includes('Мука — есть в ТЦ «Вкусный»'), 'подсказка про муку', ct);
    ct = norm(await item('Уха').innerText());
    expect(ct.includes('Рыбка — поймай на рыбалке'), 'подсказка про рыбку', ct);
    await closeAll();

    // задания: в любом сезоне есть что посадить, из чего готовить и что купить в кафе; письма это подсказывают
    for (const [sea, day0] of Object.entries(DAY)) {
      const day = day0 + 36; // второй год: первые дни игры письма идут по списку
      await setDay(day);
      const r = await ev(async () => {
        const d = window.__dev,
          D = await import('./js/data/index.js'),
          G = await import('./js/core/state.js'),
          a = d.actions,
          m = D.monthOfDay(d.G.state.day);
        // «Кулинарный день»: всё для блинчиков есть на полке
        const bought = ['flour', 'egg', 'milk'].map((id) => d.F.buyFood(D.ING_BY_ID[id], 1, 'food'));
        const cook = G.canCook(D.DISH_BY_ID.pancakes);
        // «Садовница»: есть семена, которые можно посадить сегодня
        const seed = D.SEEDS.find((s) => D.canSow(s, m));
        a.addItem('seeds', seed.id, 1);
        const bed = d.G.state.garden.findIndex((b) => !b.seed);
        const planted = d.F.plantOn(bed, seed.id);
        // «Сладкий день» и «Гости на пороге»: в каждом кафе есть что купить
        const cafes = {};
        for (const q of D.DISHES.filter((x) => x.cafe))
          if (d.F.stockToday('cafe', q.id, D.dishRule(q)).state === 'ok') cafes[q.cafe] = (cafes[q.cafe] || 0) + 1;
        // «Базарный день»: продать можно хотя бы купленную муку
        const sold = d.F.sellGoods(d.F.sellable()[0], 1);
        // какие письма приходят в этом сезоне
        const tasks = new Set();
        for (let i = 0; i < 80; i++) {
          d.F.newDayMail();
          tasks.add(d.G.state.mail.task);
        }
        const wrong = [...tasks].filter(
          (id) => D.TASK_BY_ID[id].seasons && !D.TASK_BY_ID[id].seasons.includes(G.cal().season),
        );
        a.setMail('plant');
        a.readMail();
        d.F.showLetter();
        return {
          bought,
          cook,
          seed: seed.name,
          planted,
          cafes,
          sold,
          coconut: tasks.has('coconut'),
          wrong,
          season: G.cal().season,
        };
      });
      await wait(350);
      const letter = await text('.overlay .panel-body');
      await closeAll();
      expect(r.season === sea, 'не тот сезон', [sea, r.season, day]);
      expect(r.bought.every(Boolean) && r.cook, `${sea}: не из чего приготовить блинчики`, r);
      expect(r.planted, `${sea}: нечего посадить`, r);
      expect(
        letter.includes('на грядках сажают') && letter.includes(r.seed.toLowerCase()),
        `${sea}: письмо «Садовница» без подсказки`,
        letter,
      );
      expect(
        Object.values(r.cafes).length === 3 && Object.values(r.cafes).every((n) => n >= 2),
        `${sea}: в кафе пусто`,
        r.cafes,
      );
      expect(r.sold === 1, `${sea}: нечего продать на рынке`, r);
      expect(r.coconut === (sea === 'winter') && !r.wrong.length, `${sea}: письмо не по сезону`, r);
      await ev(() => {
        const a = window.__dev.actions;
        a.setMail('cook');
        a.readMail();
        window.__dev.F.showLetter();
      });
      await wait(350);
      const cookLetter = await text('.overlay .panel-body');
      await closeAll();
      expect(
        cookLetter.includes('точно есть всё') && cookLetter.includes('блинчики'),
        `${sea}: письмо «Кулинарный день»`,
        cookLetter,
      );
    }
  });

  await step('сезонность: сохранение v3 — посаженное не в сезон дорастает, семена и продукты на месте', async () => {
    const old = JSON.parse(SAVE_V3);
    old.garden[0] = { seed: 'seed_pumpkin', age: 1 }; // январь: тыква и морковка не в сезон
    old.garden[1] = { seed: 'seed_carrot', age: 4 };
    await ev((raw) => {
      window.__dev.G.state = null;
      localStorage.removeItem('rhr-save-backup');
      localStorage.setItem('rhr-save-v1', raw);
    }, JSON.stringify(old));
    await page.reload();
    await wait(500);
    await page.click('text=Продолжить');
    await wait(900);
    await closeAll();
    let s = await state();
    // Э1 версию не меняла; с Ф1 (болезнь) сохранение v3 переносится в v4 — остальное то же
    expect(s.v === 4 && s.day === old.day && s.money === old.money, 'версия или деньги после загрузки', [
      s.v,
      s.money,
    ]);
    expect(
      JSON.stringify(s.garden.slice(0, 2)) === JSON.stringify(old.garden.slice(0, 2)) &&
        JSON.stringify(s.seeds) === JSON.stringify(old.seeds) &&
        JSON.stringify(s.ing) === JSON.stringify(old.ing),
      'грядки, семена или продукты из сохранения изменились',
      [s.garden.slice(0, 2), s.seeds, s.ing],
    );
    const r = await ev(() => {
      const d = window.__dev,
        ing = () => ({ ...d.G.state.ing });
      const a = ing();
      d.F.gardenBed(1); // морковка уже выросла
      d.F.gardenBed(0); // тыкве ещё две ночи
      const b = ing(),
        still = d.G.state.garden[0].seed;
      d.actions.nextDay();
      d.actions.nextDay();
      d.F.newDayMail();
      d.F.gardenBed(0);
      const c = ing();
      return {
        carrot: (b.carrot || 0) - (a.carrot || 0),
        still,
        pumpkin: (c.pumpkin || 0) - (b.pumpkin || 0),
        bed: d.G.state.garden[0].seed,
      };
    });
    await wait(400);
    await closeAll();
    expect(
      r.carrot === 5 && r.still === 'seed_pumpkin' && r.pumpkin === 4 && !r.bed,
      'посаженное до сезонов не доросло',
      r,
    );
    s = await state();
    expect(s.seeds.seed_carrot === old.seeds.seed_carrot, 'семена из старого сохранения пропали', s.seeds);
    await ev(() => window.__dev.go('villa'));
    await wait(400);
  });
};
