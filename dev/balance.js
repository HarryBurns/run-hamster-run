// Проверка баланса экономики расчётом: сколько можно заработать за игровой день, сколько что стоит,
// и нет ли «вечного двигателя» (купить → продать дороже). Браузер и сервер не нужны.
// Запуск:  node dev/balance.js          (код возврата 1 — баланс нарушен; таблица печатается всегда)
// Все числа берутся из js/data/economy.js; итоговая таблица переписана в docs/DESIGN.md, раздел 1.
const path = require('path');
const { pathToFileURL } = require('url');

(async () => {
  const D = await import(pathToFileURL(path.join(__dirname, '..', 'js', 'data', 'index.js')).href);
  const { JOBS, PAID_SHIFTS, MARKET, PRICES, TASK_COINS, TASK_COINS_DEFAULT, START_MONEY } = D;
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
    if (i.src === 'shop' && !(i.price > 0)) bad(`продукт без цены: ${i.id}`);
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

  // ---------- 2. нет «вечного двигателя» ----------
  // (а) всё, что можно купить, на рынке стоит не больше доли MARKET.shopShare от самой низкой цены покупки
  for (const i of D.INGREDIENTS) {
    if (i.src !== 'shop') continue;
    if (i.sell > i.price * MARKET.shopShare + 1e-9)
      bad(`${i.id}: купить за ${i.price}, продать за ${i.sell} — больше ${MARKET.shopShare * 100}%`);
    if (i.seasons && !(i.rare > i.price)) bad(`${i.id}: не в сезон на рынке должен стоить дороже, чем в ТЦ`);
  }
  // (б) блюдо: даже шедевр (3 порции) из целиком купленных продуктов не окупает продукты
  const cook = [];
  for (const d of D.DISHES) {
    if (!d.needs) {
      if (d.sell) bad(`${d.id}: блюдо только из кафе не должно продаваться на рынке`);
      continue;
    }
    const needs = Object.entries(d.needs);
    const buyable = needs.every(([id]) => ING[id].src === 'shop');
    const cost = needs.reduce((s, [id, n]) => s + ING[id].price * n, 0);
    const raw = needs.reduce((s, [id, n]) => s + ING[id].sell * n, 0);
    cook.push({ d, cost, raw, buyable });
    if (buyable && d.sell * 3 >= cost) bad(`${d.id}: продукты ${cost}, шедевр (3 порции) продаётся за ${d.sell * 3}`);
    if (d.sell > raw * MARKET.dishShare + 1e-9)
      bad(`${d.id}: порция ${d.sell} дороже, чем положено по продуктам (${raw})`);
    // (в) блюдо из кафе нельзя выгодно перепродать
    if (d.cafe && d.sell >= d.price) bad(`${d.id}: в кафе ${d.price}, на рынке ${d.sell}`);
  }
  // (г) семена окупаются, но грядка не «печатает» монеты быстрее работы
  const beds = D.SEEDS.map((s) => ({
    s,
    perDay: (ING[s.crop].sell * s.n - s.price) / s.days,
  }));
  for (const b of beds) if (b.perDay <= 0) bad(`${b.s.id}: урожай не окупает семена`);
  // (д) вещи и мебель продать нельзя совсем — проверять нечего; рынок ограничен кошельком торговца
  if (!(MARKET.purse > 0)) bad('у торговца нет кошелька (MARKET.purse)');

  // ---------- 3. сколько можно заработать за день ----------
  const jobs = Object.entries(JOBS);
  const payAt = (stars) => jobs.reduce((s, [, j]) => s + j.pay[stars - 1], 0);
  const avg2 = payAt(2) / jobs.length;
  const taskAll = D.TASKS.map((t) => TASK_COINS[t.id] || TASK_COINS_DEFAULT);
  const taskAvg = taskAll.reduce((a, b) => a + b, 0) / taskAll.length;
  const bestBed = Math.max(...beds.map((b) => b.perDay));
  const avgBed = beds.reduce((s, b) => s + b.perDay, 0) / beds.length;
  const fish = ING.fish.sell;

  // «увлечённая игра»: 6 оплачиваемых смен на две звезды, задание дня; в начале ещё одна рыбалка и пяток кокосов
  const startWork = 6 * avg2;
  const startMarket = 3 * fish + 5 * ING.coconut.sell;
  const start = startWork + taskAvg + startMarket;
  // через неделю: те же смены, но уже получается лучше (половина на три звезды), 8 грядок, две рыбалки,
  // улов и урожай частью приготовлены (блюдо дороже сырых продуктов), рынок упирается в кошелёк торговца
  const weekWork = 3 * avg2 + 3 * (payAt(3) / jobs.length);
  const weekMarketRaw = 8 * avgBed + 7 * fish + 8 * ING.coconut.sell;
  const weekMarket = Math.min(MARKET.purse, weekMarketRaw * 1.25);
  const week = weekWork + taskAvg + weekMarket;
  const maxDay = PAID_SHIFTS * payAt(3) + Math.max(...taskAll) + MARKET.purse;

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
  for (const id of Object.keys(MARKET.sell)) line(id === 'pearl' ? 'жемчужина' : ING[id].name, fmt(MARKET.sell[id]));
  line('покупные продукты', `${MARKET.shopShare * 100}% от цены в ТЦ`);
  for (const b of beds)
    line(
      `грядка: ${b.s.name} (${b.s.n} шт. за ${b.s.days} дн., семена ${b.s.price})`,
      `${fmt(b.perDay)} в день с грядки`,
    );
  line('8 грядок, в среднем / лучшая культура', `${fmt(8 * avgBed)} / ${fmt(8 * bestBed)} в день`);
  console.log('\nГотовка: продукты → порция на рынке (1 / 2 / 3 порции за одну готовку)');
  for (const { d, cost, raw, buyable } of cook.sort((a, b) => b.d.sell - a.d.sell).slice(0, 8))
    line(
      `${d.name}${buyable ? ' (всё из ТЦ: ' + cost + ')' : ''}`,
      `сырьём ${raw} → ${d.sell} / ${d.sell * 2} / ${d.sell * 3}`,
    );
  console.log('\nЦены');
  line('продукты в ТЦ', range(D.INGREDIENTS.filter((i) => i.src === 'shop').map((i) => i.price)));
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
  line('набор продуктов на блюдо (всё из ТЦ)', range(dishCosts));
  for (const [k, v] of Object.entries(outfits)) line('одеться: ' + k, fmt(v));
  for (const [k, v] of Object.entries(rooms)) line('обставить: ' + k, fmt(v));
  console.log('\nИгровой день увлечённой игры');
  line(
    'в начале: 6 смен на 2★ + задание + рыбалка и кокосы',
    `${fmt(startWork)} + ${fmt(taskAvg)} + ${fmt(startMarket)} = ${fmt(start)}`,
  );
  line(
    'через неделю: смены получше + задание + рынок',
    `${fmt(weekWork)} + ${fmt(taskAvg)} + ${fmt(weekMarket)} = ${fmt(week)}`,
  );
  line('потолок дня (все смены на 3★, лучшее задание, весь кошелёк)', fmt(maxDay));
  line(
    'квартира за 25 000: дней в начале / через неделю',
    `${(25000 / start).toFixed(1)} / ${(25000 / week).toFixed(1)} (если ничего не тратить)`,
  );
  line(
    '…если тратить треть заработка',
    `${(25000 / (start * 0.67)).toFixed(1)} / ${(25000 / (week * 0.67)).toFixed(1)}`,
  );

  // первое жильё должно быть достижимо за 10–15 дней увлечённой игры, но не за пару дней
  const days = 25000 / (((start + week) / 2) * 0.67);
  if (days < 6 || days > 16) bad(`квартира за 25 000 достигается за ${days.toFixed(1)} дн. — вне задуманных 10–15 (±)`);
  if (maxDay > 25000 / 2) bad('потолок дня слишком высок: квартира за два дня');

  if (problems.length) {
    console.log('\nБАЛАНС НАРУШЕН:\n' + problems.map((p) => '  - ' + p).join('\n'));
    process.exit(1);
  }
  console.log('\nбаланс в порядке: «вечных двигателей» нет, у всего есть цена');
})();
