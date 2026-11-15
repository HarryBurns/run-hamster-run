// Проверка баланса экономики расчётом: сколько можно заработать за игровой день, сколько что стоит,
// и нет ли «вечного двигателя» (купить → продать дороже). Браузер и сервер не нужны.
// Запуск:  node dev/balance.js          (код возврата 1 — баланс нарушен; таблица печатается всегда)
// Все числа берутся из js/data/economy.js; итоговая таблица переписана в docs/DESIGN.md, раздел 1.
const path = require('path');
const { pathToFileURL } = require('url');

(async () => {
  const D = await import(pathToFileURL(path.join(__dirname, '..', 'js', 'data', 'index.js')).href);
  const { JOBS, PAID_SHIFTS, MARKET, PRICES, TASK_COINS, TASK_COINS_DEFAULT, START_MONEY } = D;
  const { HOMES, BUSINESSES, BIZ_RULES, HOME_PRICES, BIZ } = D;
  const { GATHER, HARVEST_MONTHS, SEASONS, SEASON_OF_MONTH, MONTHS, SEASONAL, STOCK, TREATS, DAYS_PER_MONTH } = D;
  const problems = [];
  const bad = (msg) => problems.push(msg);
  const fmt = (n) => Math.round(n).toLocaleString('ru-RU');
  const range = (list) => `${fmt(Math.min(...list))}–${fmt(Math.max(...list))}`;
  const ING = D.ING_BY_ID;

  // ---------- 1. у всего, что продаётся, есть цена ----------
  for (const c of D.CLOTHES)
    if (['mall', 'boutique', 'beach', 'market'].includes(c.shop) && !(c.price > 0)) bad(`одежда без цены: ${c.id}`);
  for (const f of D.FURNITURE)
    if (['home', 'market'].includes(f.shop) && !(f.price > 0)) bad(`мебель без цены: ${f.id}`);
  for (const i of D.INGREDIENTS) {
    if (i.src !== 'fish' && !(i.price > 0)) bad(`продукт без цены: ${i.id}`);
    if (!(i.sell > 0)) bad(`продукт без цены на рынке: ${i.id}`);
  }
  for (const s of D.SEEDS) if (!(s.price > 0)) bad(`семена без цены: ${s.id}`);
  for (const d of D.DISHES) if (d.cafe && !(d.price > 0)) bad(`блюдо в кафе без цены: ${d.id}`);
  for (const [k, b] of Object.entries(D.BEAUTY)) if (!(b.price > 0)) bad(`салон без цены: ${k}`);
  // лишние строки в таблице цен (опечатка в id)
  const known = {
    clothes: D.CLOTHES_BY_ID,
    furn: D.FURN_BY_ID,
    ing: D.ING_BY_ID,
    seeds: D.SEED_BY_ID,
    cafe: D.DISH_BY_ID,
    beauty: D.BEAUTY,
  };
  for (const [table, ids] of Object.entries(PRICES))
    for (const id of Object.keys(ids))
      if (!known[table] || !known[table][id]) bad(`цена для неизвестного id: ${table}.${id}`);
  for (const id of Object.keys(MARKET.sell))
    if (id !== 'pearl' && !ING[id]) bad(`цена рынка для неизвестного id: ${id}`);
  for (const id of Object.keys(TASK_COINS)) if (!D.TASK_BY_ID[id]) bad(`награда для неизвестного задания: ${id}`);
  // жильё и заведения: у всего есть цена, у заведений — выручка; в таблицах цен нет лишних строк
  for (const h of HOMES) if (h.id !== 'villa' && !(h.price > 0)) bad(`жильё без цены: ${h.id}`);
  for (const b of BUSINESSES) if (!(b.price > 0) || !(b.income > 0)) bad(`заведение без цены или выручки: ${b.id}`);
  for (const id of Object.keys(HOME_PRICES)) if (!D.HOME_BY_ID[id]) bad(`цена для неизвестного жилья: ${id}`);
  for (const id of Object.keys(BIZ)) if (!D.BIZ_BY_ID[id]) bad(`цена для неизвестного заведения: ${id}`);
  for (const f of D.FURNITURE)
    if (f.act === 'spin' || f.act === 'look' || f.act === 'sport') if (!f.say) bad(`мебель без подписи (say): ${f.id}`);

  // ---------- 2. нет «вечного двигателя» ----------
  // (а) перепродажа никогда не выгодна. Для каждого продукта, который можно купить, и для каждого месяца:
  //     рынок платит игроку не больше половины того, что продукт стоит сейчас; и даже купленное в сезон (дёшево)
  //     и придержанное до «не сезона» (продукты не портятся) продаётся дешевле, чем куплено
  const ALL_MONTHS = MONTHS.map((_, m) => m);
  const seasonal = D.INGREDIENTS.filter((i) => D.isSeasonal(i));
  for (const i of D.INGREDIENTS) {
    if (!(i.price > 0)) continue;
    for (const m of ALL_MONTHS) {
      const buy = D.buyPrice(i, m),
        sell = D.sellPrice(i, m);
      if (!(buy > 0)) bad(`${i.id}: ${MONTHS[m]} — нет цены покупки`);
      if (sell > buy * 0.5 + 1e-9) bad(`${i.id}: ${MONTHS[m]} — купить за ${buy}, продать за ${sell}: больше половины`);
    }
    const minBuy = Math.min(...ALL_MONTHS.map((m) => D.buyPrice(i, m))),
      maxSell = Math.max(...ALL_MONTHS.map((m) => D.sellPrice(i, m)));
    if (maxSell >= minBuy * 0.75)
      bad(`${i.id}: купить в сезон за ${minBuy}, придержать и продать за ${maxSell} — слишком близко`);
    if (D.isSeasonal(i)) {
      if (!(i.priceIn < i.price && i.price < i.priceOff))
        bad(`${i.id}: в сезон должно быть дешевле обычного, вне сезона — дороже`);
      if (!(i.sell < i.sellOff)) bad(`${i.id}: вне сезона рынок должен платить больше, чем в сезон`);
    }
  }
  // всё, что растёт (огород, сбор), — сезонное; рыба и круглогодичные продукты — нет
  for (const i of D.INGREDIENTS)
    if ((i.src === 'garden' || i.src === 'wild') && !D.isSeasonal(i)) bad(`${i.id}: растёт, но не сезонный продукт`);
  for (const id of Object.keys(GATHER)) if (ING[id] && !D.isSeasonal(ING[id])) bad(`${id}: собирается, но не сезонный`);
  if (!(SEASONAL.inPrice < 1 && SEASONAL.offPrice > 1 && SEASONAL.offSell > 1))
    bad('SEASONAL: в сезон дешевле, вне сезона дороже');
  if (MARKET.shopShare * SEASONAL.offSell >= 1) bad('SEASONAL.offSell: купленное в сезон выгодно продать вне сезона');
  // (а2) общая таблица сезонов: только известные продукты и месяцы 0–11
  for (const [id, ms] of Object.entries(HARVEST_MONTHS)) {
    if (!ING[id]) bad(`таблица сезонов: неизвестный продукт ${id}`);
    if (!ms.length || ms.some((q) => !(q >= 0 && q <= 11) || q !== Math.floor(q)))
      bad(`таблица сезонов: ${id} — месяцы должны быть числами 0–11`);
  }
  // (б) блюдо: даже шедевр (3 порции) из целиком купленных продуктов не окупает продукты
  const cook = [];
  for (const d of D.DISHES) {
    if (!d.needs) {
      if (d.sell) bad(`${d.id}: блюдо только из кафе не должно продаваться на рынке`);
      continue;
    }
    const needs = Object.entries(d.needs);
    const buyable = needs.every(([id]) => ING[id].price > 0);
    const cost = needs.reduce((s, [id, n]) => s + ING[id].priceIn * n, 0); // по самым низким ценам (в сезон)
    const raw = needs.reduce((s, [id, n]) => s + ING[id].sell * n, 0);
    cook.push({ d, cost, raw, buyable });
    if (buyable && d.sell * 3 >= cost) bad(`${d.id}: продукты ${cost}, шедевр (3 порции) продаётся за ${d.sell * 3}`);
    if (d.sell > raw * MARKET.dishShare + 1e-9)
      bad(`${d.id}: порция ${d.sell} дороже, чем положено по продуктам (${raw})`);
    // (в) блюдо из кафе нельзя выгодно перепродать
    if (d.cafe && d.sell >= d.price) bad(`${d.id}: в кафе ${d.price}, на рынке ${d.sell}`);
  }
  // (г) семена окупаются (даже если продать урожай в сезон, дёшево), но грядка не «печатает» монеты быстрее работы;
  //     у каждой культуры есть сезон посадки, и в каждом месяце есть что посадить
  const beds = D.SEEDS.map((s) => ({
    s,
    perDay: (ING[s.crop].sell * s.n - s.price) / s.days, // урожай продан в сезон
    perDayOff: (ING[s.crop].sellOff * s.n - s.price) / s.days, // урожай придержан и продан не в сезон
  }));
  for (const b of beds) {
    if (b.perDay <= 0) bad(`${b.s.id}: урожай не окупает семена`);
    if (!ING[b.s.crop].months) bad(`${b.s.id}: у культуры нет сезона посадки в таблице сезонов`);
    if (!b.s.sow) bad(`${b.s.id}: нет слова для подсказки «… сажают осенью» (sow)`);
  }
  const bedsIn = (month) => beds.filter((b) => D.canSow(b.s, month));
  for (const m of ALL_MONTHS) if (!bedsIn(m).length) bad(`огород: в месяце «${MONTHS[m]}» нечего посадить`);
  // (д) вещи и мебель продать нельзя совсем — проверять нечего; рынок ограничен кошельком торговца
  if (!(MARKET.purse > 0)) bad('у торговца нет кошелька (MARKET.purse)');

  // ---------- 3. сколько можно заработать за день ----------
  const jobs = Object.entries(JOBS);
  const payAt = (stars) => jobs.reduce((s, [, j]) => s + j.pay[stars - 1], 0);
  const avg2 = payAt(2) / jobs.length;
  const taskAll = D.TASKS.map((t) => TASK_COINS[t.id] || TASK_COINS_DEFAULT);
  const taskAvg = taskAll.reduce((a, b) => a + b, 0) / taskAll.length;
  // огород по сезонам: средняя и лучшая культура из тех, что можно сажать в этом месяце; за год — в среднем
  const avgOf = (list) => list.reduce((a, b) => a + b, 0) / list.length;
  const bedAvgIn = (m) => avgOf(bedsIn(m).map((b) => b.perDay)),
    bedBestIn = (m) => Math.max(...bedsIn(m).map((b) => b.perDay)),
    bedBestOffIn = (m) => Math.max(...bedsIn(m).map((b) => b.perDayOff));
  const avgBed = avgOf(ALL_MONTHS.map(bedAvgIn));
  const bestBed = Math.max(...ALL_MONTHS.map(bedBestIn));
  const fish = ING.fish.sell;

  const avg3 = payAt(3) / jobs.length;
  // (е) сбор в городе: с растения — раз в день и только в сезон. Сколько это даёт за день в каждом месяце,
  // если собрать всё и всё продать: должно быть что собрать в любом сезоне, но меньше одной смены на 2★
  const gatherIn = (month) =>
    Object.entries(GATHER)
      .filter(([id]) => D.ripeIn(id, month))
      .map(([id, q]) => ({ id, n: q.n * q.max, sum: q.n * q.max * ING[id].sell }));
  const gatherSum = (month) => gatherIn(month).reduce((s, q) => s + q.sum, 0);
  for (const [id, q] of Object.entries(GATHER)) {
    if (!ING[id]) bad(`сбор: неизвестный продукт ${id}`);
    else if (!ING[id].seasons) bad(`сбор: у ${id} нет сезона в таблице сезонов — плод был бы на дереве круглый год`);
    if (!(q.n > 0 && q.max > 0)) bad(`сбор: ${id} — нужны n и max`);
  }
  if (GATHER.coconut.max > 4) bad('кокосовых пальм должно быть не больше четырёх на всю карту');
  const gatherOffSum = (month) => gatherIn(month).reduce((s, q) => s + q.n * ING[q.id].sellOff, 0);
  for (let month = 0; month < 12; month++) {
    if (!gatherIn(month).length) bad(`сбор: в месяце «${MONTHS[month]}» в городе нечего собрать`);
    if (gatherSum(month) >= avg2)
      bad(`сбор: ${MONTHS[month]} — ${gatherSum(month)} монет в день, это не меньше смены на 2★ (${fmt(avg2)})`);
    // сбор + все 8 грядок под лучшей культурой сезона: продано сразу — меньше трёх смен на 2★;
    // придержано и продано не в сезон — всё равно не больше кошелька торговца
    const now = gatherSum(month) + 8 * bedBestIn(month),
      later = gatherOffSum(month) + 8 * bedBestOffIn(month);
    if (now >= 3 * avg2)
      bad(`сбор и огород: ${MONTHS[month]} — ${fmt(now)} монет в день, это не меньше трёх смен на 2★`);
    if (later > MARKET.purse)
      bad(`сбор и огород: ${MONTHS[month]} — если продать не в сезон, ${fmt(later)} в день: больше кошелька торговца`);
  }
  // (ж) ассортимент дня: в любой день двух игровых лет на прилавках хватает всего, чтобы готовить, сажать и угощать.
  // «Точно есть» — круглогодичное не из лакомств и сезонное в сезон; несезонное и лакомства — как повезёт.
  for (const [k, r] of Object.entries(STOCK))
    if (!(r.days >= 1 && r.days < r.of && r.min >= 1 && r.max >= r.min && r.max <= 5))
      bad(`STOCK.${k}: странное правило`);
  const treats = [...TREATS.ing, ...TREATS.dish];
  if (treats.length < 4 || treats.length > 6) bad(`лакомств дня должно быть 4–6, а их ${treats.length}`);
  for (const id of TREATS.ing)
    if (!ING[id] || D.isSeasonal(ING[id])) bad(`лакомство дня: ${id} — нет такого продукта или он сезонный`);
  for (const id of TREATS.dish)
    if (!D.DISH_BY_ID[id] || !D.DISH_BY_ID[id].cafe) bad(`лакомство дня: ${id} — нет такого блюда в кафе`);
  const sure = (ing, month) => ing.price > 0 && D.foodRule(ing, month) === null;
  const startDishes = D.DISHES.filter((d) => d.needs && d.start);
  const cookableIn = (month) => startDishes.filter((d) => Object.keys(d.needs).every((id) => sure(ING[id], month)));
  for (const m of ALL_MONTHS)
    if (cookableIn(m).length < 4)
      bad(`${MONTHS[m]}: из того, что точно есть в ТЦ, готовится только ${cookableIn(m).length} блюд(а) — мало`);
  for (const kind of new Set(D.DISHES.filter((d) => d.cafe).map((d) => d.cafe)))
    if (D.DISHES.filter((d) => d.cafe === kind && !d.treat).length < 2)
      bad(`кафе ${kind}: меньше двух блюд, которые есть всегда`);
  // несезонное: в ТЦ бывает, но не каждый день и понемногу; за месяц (DAYS_PER_MONTH дней) хоть раз появляется
  const YEAR2 = 2 * 12 * DAYS_PER_MONTH;
  const offStats = { days: 0, mall: 0, market: 0, none: 0 };
  for (const i of seasonal) {
    let gap = 0;
    for (let day = 0; day < YEAR2; day++) {
      const month = D.monthOfDay(day);
      if (D.inSeason(i, month)) {
        gap = 0;
        continue;
      }
      const mall = D.stockOn(day, 'food:' + i.id, D.foodRule(i, month)),
        market = mall ? 0 : D.stockOn(day, 'market:' + i.id, STOCK.offMarket);
      offStats.days++;
      if (mall) offStats.mall++;
      else if (market) offStats.market++;
      else offStats.none++;
      if (mall > STOCK.offMall.max || market > STOCK.offMarket.max)
        bad(`${i.id}: день ${day} — не в сезон привезли слишком много`);
      gap = mall ? 0 : gap + 1;
      if (gap > DAYS_PER_MONTH) bad(`${i.id}: не в сезон нет в ТЦ дольше месяца подряд (день ${day})`);
    }
  }
  if (!(offStats.mall > 0 && offStats.market > 0 && offStats.none > 0))
    bad('ассортимент дня: несезонное должно быть то в ТЦ, то на рынке, то нигде');
  const coco = ING.coconut.sell,
    cocoMax = GATHER.coconut.n * GATHER.coconut.max; // игра начинается зимой: первые дни собирают кокосы
  const taskMax = Math.max(...taskAll);
  // Три игрока. «В начале» — первые дни: грядки ещё пустые, мини-игры получаются на две звезды.
  // «Через неделю» — грядки работают, есть рыбалка и готовка, часть смен уже на три звезды.
  // Рынок в любом случае не даёт больше, чем лежит в кошельке торговца.
  const PROFILES = [
    {
      id: 'calm',
      name: 'спокойная игра (3 смены в день)',
      start: {
        work: 3 * avg2,
        task: taskAvg,
        market: cocoMax * coco,
        how: `3 смены на 2★, задание, ${cocoMax} кокоса`,
      },
      week: {
        work: 2 * avg2 + avg3,
        task: taskAvg,
        market: 4 * avgBed + 3 * fish,
        how: '3 смены (одна на 3★), задание, 4 грядки, рыбалка',
      },
    },
    {
      id: 'keen',
      name: 'увлечённая игра (5 смен в день)',
      start: {
        work: 5 * avg2,
        task: taskAvg,
        market: 3 * fish + cocoMax * coco,
        how: `5 смен на 2★, задание, рыбалка, ${cocoMax} кокоса`,
      },
      week: {
        work: 3 * avg2 + 2 * avg3,
        task: taskAvg,
        market: (8 * avgBed + 7 * fish) * 1.15, // часть улова и урожая приготовлена: блюдо дороже сырых продуктов
        how: '5 смен (две на 3★), задание, 8 грядок, 2 рыбалки, готовка',
      },
    },
    {
      id: 'max',
      name: `потолок (все ${PAID_SHIFTS * jobs.length} смен на 3★, весь кошелёк торговца)`,
      start: { work: PAID_SHIFTS * payAt(3), task: taskMax, market: MARKET.purse, how: 'всё, что можно' },
      week: { work: PAID_SHIFTS * payAt(3), task: taskMax, market: MARKET.purse, how: 'всё, что можно' },
    },
  ];
  const GOAL = 25000; // первое жильё — квартира в городе (docs/DESIGN.md, раздел 3)
  const SPEND = 1 / 3; // какая доля заработка уходит на наряды, мебель, еду и салон
  const total = (d) => d.work + d.task + Math.min(MARKET.purse, d.market);
  /** За сколько дней накопится GOAL: первые два дня — «в начале», к седьмому доход дорастает до «через неделю». */
  const daysTo = (p, spend) => {
    let money = START_MONEY,
      d = 0;
    while (money < GOAL && d < 999) {
      d++;
      const t = Math.min(1, Math.max(0, (d - 2) / 5));
      money += (total(p.start) + (total(p.week) - total(p.start)) * t) * (1 - spend);
    }
    return d;
  };
  for (const p of PROFILES) {
    p.days = daysTo(p, SPEND);
    p.daysNoSpend = daysTo(p, 0);
  }

  // ---------- 4. сколько стоит ----------
  const C = D.CLOTHES_BY_ID,
    F = D.FURN_BY_ID;
  const set = (ids, by) => ids.reduce((s, id) => s + by[id].price, 0);
  const outfits = {
    'весна (куртка, юбка, сапожки, берет)': set(['js_mint', 'skirt_check', 'rain_red', 'beret_red'], C),
    'лето (майка, шорты, сандалии, панамка, очки)': set(
      ['tee_sun', 'shorts_red', 'sand_yellow', 'panama_white', 'sung_yellow'],
      C,
    ),
    'осень (дождевик, брючки, сапожки, рюкзачок)': set(['ja_yellow', 'pants_black', 'rain_yellow', 'backpack'], C),
    'зима, вторая (куртка, шапка, угги, шарф)': set(['jw_red', 'beanie_blue', 'ugg_beige', 'scarf_blue'], C),
  };
  const rooms = {
    'спальня (кровать, шкаф, тумбочка, коврик, торшер, картина)': set(
      ['bed_blue', 'wardrobe', 'nightstand', 'rug_blue', 'lamp', 'pic_sun'],
      F,
    ),
    'гостиная (диван, столик, телевизор, коврик, фикус, часы)': set(
      ['sofa_red', 'coffee_table', 'tv', 'rug_pink', 'plant_ficus', 'clock'],
      F,
    ),
  };
  const shopCl = (shops) => D.CLOTHES.filter((c) => shops.includes(c.shop)).map((c) => c.price);
  const jackets = D.CLOTHES.filter((c) => c.kind.startsWith('jacket') && c.price).map((c) => c.price);
  const simple = D.CLOTHES.filter((c) => ['mall', 'beach'].includes(c.shop) && !c.kind.startsWith('jacket')).map(
    (c) => c.price,
  );

  const line = (a, b) => console.log(`  ${a.padEnd(58)} ${b}`);
  console.log('\nЭКОНОМИКА (числа из js/data/economy.js)\n');
  console.log('Старт и заработок');
  line('стартовый капитал', fmt(START_MONEY));
  for (const [id, j] of jobs) line(`работа: ${id} (1★/2★/3★)`, j.pay.join(' / '));
  line(`оплачиваемых смен в день на каждом месте`, String(PAID_SHIFTS));
  line('все смены за день на 2★ / на 3★', `${fmt(PAID_SHIFTS * payAt(2))} / ${fmt(PAID_SHIFTS * payAt(3))}`);
  line('задание из конверта', `${range(taskAll)} (в среднем ${fmt(taskAvg)})`);
  line('кошелёк торговца на рынке (предел продаж в день)', fmt(MARKET.purse));
  console.log('\nРынок: что почём');
  for (const id of Object.keys(MARKET.sell))
    line(id === 'pearl' ? 'жемчужина' : ING[id].name.toLowerCase(), fmt(MARKET.sell[id]));
  line(
    'всё, что продаётся в ТЦ',
    `${MARKET.shopShare * 100}% от самой низкой цены в ТЦ; сезонное не в сезон — × ${SEASONAL.offSell}`,
  );
  console.log('\nСезонные продукты: купить в сезон / не в сезон · продать в сезон / не в сезон');
  for (const i of seasonal)
    line(
      `${i.name} (${i.seasons.map((q) => SEASONS[q].name.toLowerCase()).join(', ')})`,
      `${i.priceIn} / ${i.priceOff} · ${i.sell} / ${i.sellOff}`,
    );
  line(
    'не в сезон: дней, когда продукт есть в ТЦ / только на рынке / нигде',
    `${Math.round((offStats.mall / offStats.days) * 100)}% / ${Math.round((offStats.market / offStats.days) * 100)}% / ${Math.round((offStats.none / offStats.days) * 100)}%`,
  );
  console.log('\nОгород: урожай продан в сезон (и если придержать до «не сезона»)');
  for (const b of beds)
    line(
      `грядка: ${b.s.name} (${b.s.n} шт. за ${b.s.days} дн., семена ${b.s.price}; ${ING[b.s.crop].seasons.map((q) => SEASONS[q].name.toLowerCase()).join(', ')})`,
      `${fmt(b.perDay)} в день с грядки (${fmt(b.perDayOff)})`,
    );
  for (const s of Object.keys(SEASONS)) {
    const month = SEASON_OF_MONTH.indexOf(s);
    line(
      `${SEASONS[s].name.toLowerCase()}: сажают ${bedsIn(month)
        .map((b) => ING[b.s.crop].name.toLowerCase())
        .join(', ')}`,
      `8 грядок: в среднем ${fmt(8 * bedAvgIn(month))}, лучшая культура ${fmt(8 * bedBestIn(month))} в день`,
    );
  }
  line('8 грядок за год, в среднем / лучшая культура', `${fmt(8 * avgBed)} / ${fmt(8 * bestBed)} в день`);
  console.log(
    '\nЧто точно есть в ТЦ «Вкусный» (без несезонного и лакомств дня): сколько стартовых блюд из этого готовится',
  );
  for (const s of Object.keys(SEASONS)) {
    const month = SEASON_OF_MONTH.indexOf(s);
    line(
      SEASONS[s].name.toLowerCase(),
      `${cookableIn(month).length} из ${startDishes.length}: ${cookableIn(month)
        .map((d) => d.name.toLowerCase())
        .join(', ')}`,
    );
  }
  console.log('\nСбор в городе: раз в день с растения, только в сезон (если собрать всё и всё продать)');
  for (const s of Object.keys(SEASONS)) {
    const month = SEASON_OF_MONTH.indexOf(s);
    line(
      `${SEASONS[s].name.toLowerCase()}: ${gatherIn(month)
        .map((q) => `${ING[q.id].name.toLowerCase()} ×${q.n}`)
        .join(', ')}`,
      `${fmt(gatherSum(month))} в день`,
    );
  }
  console.log('\nГотовка: продукты → порция на рынке (1 / 2 / 3 порции за одну готовку)');
  for (const { d, cost, raw, buyable } of cook.sort((a, b) => b.d.sell - a.d.sell).slice(0, 8))
    line(
      `${d.name}${buyable ? ' (всё из ТЦ: ' + cost + ')' : ''}`,
      `сырьём ${raw} → ${d.sell} / ${d.sell * 2} / ${d.sell * 3}`,
    );
  console.log('\nЦены');
  line(
    'продукты в ТЦ (сезонные — от цены в сезон до цены не в сезон)',
    range(D.INGREDIENTS.filter((i) => i.price).flatMap((i) => [i.priceIn, i.priceOff])),
  );
  line('семена', range(D.SEEDS.map((s) => s.price)));
  line('блюда в кафе', range(D.DISHES.filter((d) => d.cafe).map((d) => d.price)));
  line('салон красоты', range(Object.values(D.BEAUTY).map((b) => b.price)));
  line('простая одежда (ТЦ, пляж)', range(simple));
  line('куртки', range(jackets));
  line('бутик', range(shopCl(['boutique'])));
  line('мебель', range(D.FURNITURE.filter((f) => f.price).map((f) => f.price)));
  line(
    'редкости на рынке (вещицы)',
    range([...shopCl(['market']), ...D.FURNITURE.filter((f) => f.shop === 'market').map((f) => f.price)]),
  );
  const dishCosts = cook.filter((c) => c.buyable).map((c) => c.cost);
  line('набор продуктов на блюдо (всё из ТЦ, сезонное — в сезон)', range(dishCosts));
  for (const [k, v] of Object.entries(outfits)) line('одеться: ' + k, fmt(v));
  for (const [k, v] of Object.entries(rooms)) line('обставить: ' + k, fmt(v));
  console.log('\nИгровой день: работа + задание + рынок');
  const sumLine = (d) =>
    `${fmt(d.work)} + ${fmt(d.task)} + ${fmt(Math.min(MARKET.purse, d.market))} = ${fmt(total(d))}   (${d.how})`;
  for (const p of PROFILES) {
    console.log('  ' + p.name);
    line('    в начале', sumLine(p.start));
    if (p.id !== 'max') line('    через неделю', sumLine(p.week));
    line(
      `    квартира за ${fmt(GOAL)}`,
      `${p.days} дн., если тратить треть заработка; ${p.daysNoSpend} дн., если не тратить ничего`,
    );
  }

  // первое жильё: примерно 10–15 игровых дней — между увлечённой и спокойной игрой; и не «за пару дней» даже на потолке
  const by = Object.fromEntries(PROFILES.map((p) => [p.id, p]));
  if (by.keen.days < 7 || by.keen.days > 15) bad(`увлечённая игра: квартира за ${by.keen.days} дн. — вне 7–15`);
  if (by.calm.days < 10 || by.calm.days > 20) bad(`спокойная игра: квартира за ${by.calm.days} дн. — вне 10–20`);
  if (by.max.daysNoSpend < 3) bad(`потолок слишком высок: квартира за ${by.max.daysNoSpend} дн.`);

  // ---------- 5. жильё и свой бизнес ----------
  // Заведение приносит выручку раз в день; хозяйка может поработать сама (прибавка по звёздам) и получает за смену
  // в ownerPay раз больше. В кассе помещается выручка за tillDays дней — дальше она не растёт.
  const bizBy = Object.fromEntries(BUSINESSES.map((b) => [b.id, b]));
  const hasGame = (b) => !!b.game && !!JOBS[b.game]; // работа хозяйки есть (и это оплачиваемая мини-игра)
  const bonus3 = BIZ_RULES.workBonus[2],
    bonus2 = BIZ_RULES.workBonus[1];
  /** Сколько заведения приносят в день: profile — как играет хозяйка. */
  const passive = (owned, profile) => {
    let sum = 0,
      best = 0;
    for (const id of owned) {
      const b = bizBy[id];
      sum += b.income;
      if (profile === 'max') {
        if (b.game) sum += b.income * bonus3;
        if (b.id === 'rest') sum += b.income * BIZ_RULES.specialSecret;
      } else if (profile === 'keen') {
        if (b.game) best = Math.max(best, b.income * bonus2); // работает сама в одном заведении в день, на 2★
        if (b.id === 'rest') sum += b.income * BIZ_RULES.special;
      }
    }
    return sum + best;
  };
  /** Купить всё по порядку: в какой день что куплено (доход растёт, как в daysTo, плюс выручка заведений). */
  const PLAN = ['flat', 'cafe', 'beachcafe', 'bungalow', 'salon', 'boutique', 'rest', 'penthouse'];
  const costOf = (id) => (bizBy[id] ? bizBy[id].price : HOME_PRICES[id]);
  const timeline = (p, spend, plan = PLAN) => {
    let money = START_MONEY,
      d = 0,
      i = 0;
    const owned = [],
      days = {};
    while (i < plan.length && d < 2000) {
      d++;
      const t = Math.min(1, Math.max(0, (d - 2) / 5));
      money += (total(p.start) + (total(p.week) - total(p.start)) * t + passive(owned, p.id)) * (1 - spend);
      while (i < plan.length && money >= costOf(plan[i])) {
        money -= costOf(plan[i]);
        days[plan[i]] = d;
        if (bizBy[plan[i]]) owned.push(plan[i]);
        i++;
      }
    }
    return days;
  };
  console.log('\nЖильё и свой бизнес');
  for (const h of HOMES) if (h.id !== 'villa') line(`жильё: ${h.name}${h.soon ? ' (скоро)' : ''}`, fmt(h.price));
  for (const b of BUSINESSES) {
    const pay = Math.ceil(b.price / b.income),
      payWork = Math.ceil(b.price / (b.income * (1 + (b.game ? bonus3 : 0))));
    line(
      `заведение: ${b.name}`,
      `${fmt(b.price)} · ${fmt(b.income)} в день · окупается за ${pay} дн.${b.game ? ` (с работой хозяйки на 3★ — за ${payWork})` : ''}`,
    );
    if (pay < 20 || pay > 35) bad(`${b.id}: окупается за ${pay} дн. — вне 20–35`);
    if (payWork < 12) bad(`${b.id}: с работой хозяйки окупается слишком быстро (${payWork} дн.)`);
    if (b.game && !D.BIZ_BY_ID[b.id].work) bad(`${b.id}: нет подписи кнопки «работа хозяйки»`);
  }
  line('касса заведения', `выручка за ${BIZ_RULES.tillDays} дн., дальше не растёт`);
  line(
    'хозяйке за смену в своём заведении',
    `× ${BIZ_RULES.ownerPay} (шеф-повар на 3★: ${fmt(JOBS.chef.pay[2] * BIZ_RULES.ownerPay)})`,
  );
  const allBiz = BUSINESSES.map((b) => b.id);
  line(
    'все 5 заведений: выручка в день',
    `${fmt(passive(allBiz, 'calm'))} сами по себе · до ${fmt(passive(allBiz, 'max'))} с работой хозяйки и блюдом дня`,
  );
  console.log(
    '  на какой день что куплено (квартира → кафе → пляжное кафе → бунгало → салон → бутик → ресторан → пентхаус)',
  );
  const names = {
    flat: 'квартира',
    cafe: 'кафе',
    beachcafe: 'пляжное кафе',
    bungalow: 'бунгало',
    salon: 'салон',
    boutique: 'бутик',
    rest: 'ресторан',
    penthouse: 'пентхаус',
  };
  const tl = {};
  for (const p of PROFILES) {
    tl[p.id] = timeline(p, p.id === 'max' ? 0 : SPEND);
    line(
      `    ${p.id === 'max' ? 'потолок, ничего не тратя' : p.name.split(' (')[0] + ', треть заработка — на траты'}`,
      PLAN.map((id) => `${names[id]} ${tl[p.id][id]}`).join(' · '),
    );
  }
  const cafeFirst = { keen: timeline(by.keen, SPEND, ['cafe']).cafe, max: timeline(by.max, 0, ['cafe']).cafe };
  line(
    '    если сразу копить на кафе (без квартиры)',
    `увлечённая игра — день ${cafeFirst.keen}, потолок — день ${cafeFirst.max}`,
  );
  // «купила кафе на второй день» быть не должно; всё купить — долго, но достижимо; выручка — не «бесконечные деньги»
  if (cafeFirst.max < 4) bad(`потолок: кафе на ${cafeFirst.max}-й день — слишком рано`);
  if (cafeFirst.keen < 10) bad(`увлечённая игра: кафе на ${cafeFirst.keen}-й день — слишком рано`);
  if (tl.keen.penthouse < 60) bad(`увлечённая игра: всё куплено за ${tl.keen.penthouse} дн. — слишком быстро`);
  if (tl.keen.penthouse > 250) bad(`увлечённая игра: всё куплено за ${tl.keen.penthouse} дн. — слишком долго`);
  if (passive(allBiz, 'max') > 2 * total(by.max.week))
    bad('выручка всех заведений больше двух «потолков» дневного заработка');
  if (!(BIZ_RULES.tillDays >= 1 && BIZ_RULES.tillDays <= 5)) bad('в кассе должна помещаться выручка за 1–5 дней');
  if (BIZ_RULES.ownerPay > 2) bad('хозяйке платят больше чем вдвое');
  for (const b of BUSINESSES) if (hasGame(b) && !JOBS[b.game]) bad(`${b.id}: работа хозяйки без зарплаты`);

  if (problems.length) {
    console.log('\nБАЛАНС НАРУШЕН:\n' + problems.map((p) => '  - ' + p).join('\n'));
    process.exit(1);
  }
  console.log('\nбаланс в порядке: «вечных двигателей» нет, у всего есть цена');
})();
