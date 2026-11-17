// Шаги автотеста этапа 12 «Вещи, рецепты, сбор»: рисованные значки вещей (везде, где был эмодзи: рюкзак, рынок,
// подсказка, канва), маракуйя (продукт, сезон, лиана в джунглях, рецепты), рецепты из леса, венок и гирлянда из цветов
// острова у Вождя Кокоса, карта сокровищ в рюкзаке. (Масленичные блины и ярмарочная печка — в шаге «праздники:
// Масленица», dev/smoke_holidays.js; сбор маракуйи по сезону — в шаге «джунгли: всё важное…», dev/smoke_jungle.js.)
// Подключается из dev/smoke.js. Только эти шаги:  node dev/smoke.js <url> step:вещи
module.exports = async function items({ page, step, ev, wait, closeAll }) {
  const norm = (t) => t.replace(/[  ]/g, ' ');
  const expect = (ok, msg, data) => {
    if (!ok) throw new Error(msg + (data === undefined ? '' : ': ' + JSON.stringify(data)));
  };
  const state = () => ev(() => JSON.parse(JSON.stringify(window.__dev.G.state)));
  const panelText = async () =>
    norm(await ev(() => [...document.querySelectorAll('.overlay .panel')].map((p) => p.textContent).join(' | ')));
  const fresh = async () => {
    await ev(() => {
      window.__dev.G.state = null;
      localStorage.clear();
    });
    await page.reload();
    await wait(400);
    await page.click('text=Играть!');
    await page.click('text=Пропустить'); // вступительная сценка новой игры (этап 10)
    await page.evaluate(() => window.__dev.actions.setFlag('intro', 0)); // вводная цепочка заданий — в своих шагах (dev/smoke_start.js)
    await wait(400);
    await page.click('text=Поехали!');
    await wait(500);
    await closeAll();
  };
  const watch = () =>
    ev(() => {
      window.__stopWatchItems = window.__dev.watchState();
    });
  const unwatch = async () => {
    const bad = await ev(() => window.__stopWatchItems());
    expect(!bad.length, `запись в состояние мимо действий (${bad.length})`, [...new Set(bad)].slice(0, 4));
  };
  const tab = async (name) => {
    await ev((name) => [...document.querySelectorAll('.overlay .tabs button, .overlay .tab')].find((b) => b.textContent.includes(name)).click(), name);
    await wait(350);
  };

  await step('вещи: рисованные значки — у каждого свой рисунок, в рюкзаке, на рынке, в подсказке и на канве; без рисунка — эмодзи', async () => {
    await fresh();
    // у каждого значка из таблицы есть рисунок, все рисунки разные и не пустые; буква-значок на канве рисуется картинкой
    const art = await ev(async () => {
      const D = await import('/js/data/index.js'),
        I = await import('/js/art/items.js'),
        Dr = await import('/js/core/draw.js');
      const names = Object.keys(D.ICON),
        noArt = names.filter((n) => !I.hasItemArt(n)),
        urls = names.map((n) => I.itemIconURL(n));
      const cv = document.createElement('canvas');
      cv.width = cv.height = 64;
      const c = cv.getContext('2d');
      const empty = [];
      let texts = 0;
      const ft = c.fillText.bind(c);
      c.fillText = (...a) => (texts++, ft(...a));
      for (const n of names) {
        c.clearRect(0, 0, 64, 64);
        Dr.emoji(c, D.ICON[n], 32, 32, 40);
        const px = c.getImageData(0, 0, 64, 64).data;
        let filled = 0;
        for (let i = 3; i < px.length; i += 4) if (px[i] > 40) filled++;
        if (filled < 250) empty.push([n, filled]);
      }
      // строка со значком на канве: ширина больше, чем у текста без значка
      c.font = '900 13px sans-serif';
      const wide = Dr.iconTextWidth(c, 'Сорвать ' + D.ICON.passionfruit, 13) > c.measureText('Сорвать ').width + 10;
      // у кого значок рисованный
      const drawn = (list) => list.filter((q) => D.iconName(q.e)).map((q) => q.id);
      return {
        n: names.length,
        noArt,
        same: urls.length - new Set(urls).size,
        empty,
        texts,
        wide,
        finds: drawn(D.FINDS),
        ings: drawn(D.INGREDIENTS),
        dishes: drawn(D.DISHES),
        plain: D.plainIcons(`+1 ${D.FIND_BY_ID.cone.e} Шишка`),
        emojiFinds: D.FINDS.filter((f) => !D.iconName(f.e) && /[\uE000-\uF8FF]/.test(f.e)).map((f) => f.id),
      };
    });
    expect(art.n >= 25 && !art.noArt.length, 'значок без рисунка', art.noArt);
    expect(!art.same, 'одинаковые рисунки значков', art.same);
    expect(!art.empty.length && art.texts === 0, 'значок на канве не нарисован картинкой', [art.empty, art.texts]);
    expect(art.wide, 'строка со значком на канве');
    for (const id of ['cone', 'herb_cone', 'edelweiss', 'glow_shroom', 'gem_crystal', 'gem_topaz', 'gem_sapphire', 'gem_ruby', 'fossil_shell', 'fossil_leaf', 'fossil_tooth', 'fossil_bone', 'feather_red', 'feather_blue', 'feather_yellow', 'shell_pink', 'shell_spiral', 'shell_sun', 'obsidian', 'flower_plumeria', 'flower_hibiscus', 'flower_orchid'])
      expect(art.finds.includes(id), 'находка без рисованного значка: ' + id, art.finds);
    for (const id of ['porcini', 'cactus_fruit', 'passionfruit']) expect(art.ings.includes(id), 'продукт без рисованного значка: ' + id, art.ings);
    for (const id of ['blini_jam', 'blini_honey', 'berry_jam']) expect(art.dishes.includes(id), 'блюдо без рисованного значка: ' + id, art.dishes);
    expect(art.plain === '+1 🌰 Шишка' && !art.emojiFinds.length, 'запасной эмодзи', [art.plain, art.emojiFinds]);
    // рюкзак: у шишки и перьев — картинки (три пера — три разные), у фонарика — обычный эмодзи
    await watch();
    await ev(() => {
      const a = window.__dev.actions;
      for (const id of ['cone', 'feather_red', 'feather_blue', 'feather_yellow', 'flashlight', 'gem_ruby']) a.addItem('finds', id, 1);
      a.addItem('ing', 'porcini', 2);
      window.__dev.F.openBackpack();
    });
    await wait(400);
    await tab('Находки');
    const cards = await ev(() =>
      [...document.querySelectorAll('.overlay .card')].map((c) => {
        const img = c.querySelector('.e img.ico');
        return { name: c.children[1].textContent, ico: img ? img.dataset.ico : null, w: img ? img.getBoundingClientRect().width : 0, loaded: img ? img.complete && img.naturalWidth > 0 : false, text: c.querySelector('.e').textContent };
      }),
    );
    const by = Object.fromEntries(cards.map((c) => [c.name, c]));
    expect(by['Шишка'] && by['Шишка'].ico === 'cone' && by['Шишка'].loaded && by['Шишка'].w >= 36, 'шишка в рюкзаке — рисованный значок', by['Шишка']);
    expect(by['Красное перо ары'].ico === 'feather_red' && by['Синее перо'].ico === 'feather_blue' && by['Жёлтое перо'].ico === 'feather_yellow', 'перья в рюкзаке — три разных значка', cards);
    expect(by['Фонарик'] && !by['Фонарик'].ico && by['Фонарик'].text === '🔦', 'у фонарика остался эмодзи', by['Фонарик']);
    expect(!cards.some((c) => /[\uE000-\uF8FF]/.test(c.text)), 'в карточке осталась буква-значок', cards);
    await tab('Продукты');
    expect(await ev(() => !![...document.querySelectorAll('.overlay .card')].find((c) => /Белый гриб/.test(c.textContent) && c.querySelector('img.ico[data-ico="porcini"]'))), 'белый гриб в продуктах — рисованный значок');
    await closeAll();
    // рынок и подсказка
    await ev(() => window.__dev.run('market'));
    await wait(500);
    expect(await ev(() => !![...document.querySelectorAll('.overlay .card')].find((c) => /Рубин/.test(c.textContent) && c.querySelector('img.ico[data-ico="gem_ruby"]'))), 'рубин на рынке — рисованный значок');
    await ev(async () => {
      const D = await import('/js/data/index.js');
      window.__dev.ui.toast(`+1 ${D.FIND_BY_ID.shell_sun.e} Ракушка-солнышко`, 'good');
    });
    await wait(200);
    const toast = await ev(() => {
      const t = [...document.querySelectorAll('#toasts .toast')].pop(),
        img = t && t.querySelector('img.ico');
      return t ? { text: t.textContent, ico: img && img.dataset.ico, h: img ? img.getBoundingClientRect().height : 0, alt: img && img.alt } : null;
    });
    expect(toast && toast.ico === 'shell_sun' && toast.h >= 14 && toast.h <= 30 && toast.alt === '🐚' && /Ракушка-солнышко/.test(toast.text), 'подсказка со значком', toast);
    await closeAll();
    await unwatch();
  });

  await step('вещи: маракуйя и рецепты из леса — продукт, сезон, цены, рецепты с начала игры и в старой игре, готовка', async () => {
    await fresh();
    const d = await ev(async () => {
      const D = await import('/js/data/index.js');
      const p = D.ING_BY_ID.passionfruit;
      return {
        p: p && { months: p.months, price: p.price, priceIn: p.priceIn, priceOff: p.priceOff, sell: p.sell, sellOff: p.sellOff, raw: p.raw, seasonal: D.isSeasonal(p) },
        gather: D.JUNGLE_GATHER.passionfruit,
        autumnJungle: [8, 9, 10].every((m) => Object.keys(D.JUNGLE_GATHER).some((id) => D.pickIn(id, m))),
        everyMonth: [...Array(12).keys()].filter((m) => !Object.keys(D.JUNGLE_GATHER).some((id) => D.pickIn(id, m))),
        start: ['passion_drink', 'berry_jam', 'honey_nuts', 'strawberry_cream'].filter((id) => D.START_RECIPES.includes(id)),
        secret: ['passion_mousse', 'porcini_roast'].filter((id) => D.SECRET_RECIPES.includes(id)),
        blini: D.BLINI.filter((id) => D.SECRET_RECIPES.includes(id) || D.START_RECIPES.includes(id)),
        sell: Object.fromEntries(['passion_drink', 'passion_mousse', 'berry_jam', 'honey_nuts', 'strawberry_cream', 'porcini_roast', 'blini_jam', 'blini_honey'].map((id) => [id, D.DISH_BY_ID[id].sell])),
      };
    });
    expect(d.p && d.p.seasonal && d.p.raw && d.p.months.join() === '8,9,10', 'маракуйя — осенний сезонный фрукт', d.p);
    expect(d.p.priceIn < d.p.price && d.p.priceOff > d.p.price && d.p.sellOff > d.p.sell && d.p.sellOff < d.p.priceIn, 'цены маракуйи по сезону', d.p);
    expect(d.gather && d.gather.n * d.gather.max === 2 && d.autumnJungle && !d.everyMonth.length, 'осенью в джунглях есть что собрать', d);
    expect(d.start.length === 4 && d.secret.length === 2, 'рецепты: четыре с начала, два секретных', d);
    expect(d.blini.join() === 'pancakes', 'масленичные блины — не стартовые и не секретные', d.blini);
    expect(Object.values(d.sell).every((v) => v > 0), 'у новых блюд есть цена на рынке', d.sell);
    let s = await state();
    expect(['passion_drink', 'berry_jam', 'honey_nuts', 'strawberry_cream'].every((id) => s.recipes.includes(id)), 'новая игра знает новые рецепты', s.recipes);
    // старая игра: рецептов этапа 12 в сохранении нет — после загрузки стартовые появляются сами
    await ev(() => {
      const st = JSON.parse(localStorage.getItem('rhr-save-v1') || 'null') || JSON.parse(JSON.stringify(window.__dev.G.state));
      st.recipes = st.recipes.filter((id) => !['passion_drink', 'berry_jam', 'honey_nuts', 'strawberry_cream'].includes(id));
      window.__dev.G.state = null;
      localStorage.setItem('rhr-save-v1', JSON.stringify(st));
    });
    await page.reload();
    await wait(500);
    const cont = page.locator('text=Продолжить').first();
    if (await cont.count()) await cont.click();
    await wait(500);
    await closeAll();
    s = await state();
    expect(s && ['passion_drink', 'berry_jam', 'honey_nuts', 'strawberry_cream'].every((id) => s.recipes.includes(id)) && !s.recipes.includes('passion_mousse'), 'старая игра получила стартовые рецепты', s && s.recipes);
    // готовка: орешки в меду и морс из маракуйи
    await watch();
    await ev(() => {
      const a = window.__dev.actions;
      a.addItem('ing', 'nuts', 2);
      a.addItem('ing', 'honey', 1);
      a.addItem('ing', 'passionfruit', 2);
      a.addItem('ing', 'sugar', 1);
      window.__dev.F.openCooking();
    });
    await wait(400);
    const row = await ev(() => {
      const li = [...document.querySelectorAll('.overlay .list-item')].find((q) => /Морс из маракуйи/.test(q.textContent));
      return li ? { icons: [...li.querySelectorAll('img.ico')].map((i) => i.dataset.ico), ok: !li.querySelector('.btn').disabled } : null;
    });
    expect(row && row.ok && row.icons.includes('passion_drink') && row.icons.includes('passionfruit'), 'морс в списке плиты: значки блюда и маракуйи', row);
    for (const name of ['Орешки в меду', 'Морс из маракуйи']) {
      await page.click(`.overlay .list-item:has-text("${name}") .btn`);
      await wait(300);
      await page.click('.panel-foot .btn:has-text("Снять с плиты")');
      await wait(400);
      await page.click('.overlay .panel-foot .btn');
      await wait(300);
    }
    await closeAll();
    s = await state();
    expect(s.dishes.honey_nuts >= 1 && s.dishes.passion_drink >= 1 && !s.ing.nuts && !s.ing.passionfruit, 'новые блюда приготовлены', [s.dishes, s.ing]);
    await unwatch();
  });

  await step('вещи: венок и гирлянда из цветов острова у Вождя Кокоса — после леи, из трёх разных цветов', async () => {
    await fresh();
    await ev(() => {
      const d = window.__dev;
      for (const id of ['forest', 'jungle', 'island']) if (!d.QuestState.landOpen(id)) d.actions.openLand(id);
      d.actions.mutate((s) => {
        s.day = 18;
        s.minutes = 12 * 60;
        s.weather = 'sun';
        s.dayFlags = {};
        s.flags.islandHint = 1;
        s.flags.metKokos = 1;
      });
      d.go('island');
      d.locations.island.debugTeleport(18, 19);
    });
    await wait(400);
    await closeAll();
    await watch();
    const talk = async () => {
      await ev(() => {
        window.__dev.run('chief');
      });
      await wait(500);
      if (await ev(() => !!document.querySelector('.dialog') && /Помогу/.test(document.querySelector('.dialog').textContent))) {
        await page.click('.dialog .btn >> text=Потом');
        await wait(450);
      }
    };
    const opts = () => ev(() => [...document.querySelectorAll('.dialog .btn')].map((b) => b.textContent));
    const give = (n) =>
      ev((n) => {
        for (const id of ['flower_plumeria', 'flower_hibiscus', 'flower_orchid']) window.__dev.actions.addItem('finds', id, n);
      }, n);
    // без леи венок и гирлянду не предлагают
    await give(1);
    await talk();
    let o = await opts();
    expect(o.some((t) => /Сплети лею/.test(t)) && !o.some((t) => /венок|гирлянд/.test(t)), 'до леи — только лея', o);
    await page.click('.dialog .btn >> text=Сплети лею');
    await wait(500);
    await closeAll();
    // лея есть: венок (один раз) и гирлянда (сколько угодно)
    await give(2);
    await talk();
    o = await opts();
    expect(o.some((t) => /Сплети венок \(3 из 3\)/.test(t)) && o.some((t) => /Сплети гирлянду для дома \(3 из 3\)/.test(t)), 'венок и гирлянда у Вождя', o);
    await page.click('.dialog .btn >> text=Сплети венок');
    await wait(500);
    o = await opts();
    expect(!o.some((t) => /венок/.test(t)) && o.some((t) => /гирлянд/.test(t)), 'венок — один раз', o);
    await page.click('.dialog .btn >> text=Сплети гирлянду');
    await wait(500);
    await closeAll();
    let s = await state();
    expect(s.clothes.includes('wreath_lei') && s.storage.flower_garland === 1 && !s.finds.flower_orchid, 'венок в шкафу, гирлянда в кладовке, цветы потрачены', [s.clothes.includes('wreath_lei'), s.storage, s.finds]);
    await ev(() => window.__dev.actions.wear('head', 'wreath_lei'));
    expect((await state()).look.outfit.head === 'wreath_lei', 'венок не надевается');
    // не хватает цветов — добрая подсказка, ничего не тратится
    await ev(() => window.__dev.actions.addItem('finds', 'flower_orchid', 1));
    await talk();
    await page.click('.dialog .btn >> text=Сплети гирлянду');
    await wait(500);
    const say = norm(await ev(() => (document.querySelector('.dialog .say') || {}).textContent || ''));
    expect(/три разных цветка/.test(say), 'подсказка про три разных цветка', say);
    await closeAll();
    s = await state();
    expect(s.storage.flower_garland === 1 && s.finds.flower_orchid === 1, 'гирлянда без цветов не плетётся', [s.storage, s.finds]);
    // значки мебели и одежды рисуются (кладовка, каталог)
    const drawn = await ev(async () => {
      const I = await import('/js/ui/icons.js'),
        D = await import('/js/data/index.js');
      const filled = (cv) => {
        const px = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
        let n = 0;
        for (let i = 3; i < px.length; i += 4) if (px[i] > 40) n++;
        return n;
      };
      return [filled(I.furnIcon(D.FURN_BY_ID.flower_garland, 84)), filled(I.clothesIcon(D.CLOTHES_BY_ID.wreath_lei, 84))];
    });
    expect(drawn[0] > 300 && drawn[1] > 1500, 'гирлянда и венок нарисованы', drawn);
    await unwatch();
  });

  await step('вещи: карта сокровищ в рюкзаке — кусочки видны, карту можно посмотреть; после задания — вся', async () => {
    await fresh();
    await watch();
    const findsTab = async () => {
      await ev(() => window.__dev.F.openBackpack());
      await wait(400);
      await tab('Находки');
      return ev(() => {
        const c = document.querySelector('.overlay .card.map-card');
        return c ? { text: c.textContent, ico: !!c.querySelector('img.ico[data-ico="map_piece"]') } : null;
      });
    };
    expect((await findsTab()) === null && /Находок пока нет/.test(await panelText()), 'без задания карты в рюкзаке нет', await panelText());
    await closeAll();
    // задание взято, найден первый кусочек
    await ev(() => {
      window.__dev.actions.takeQuest('treasure_map');
      window.__dev.emit('cove', { what: 'piece', id: 'tower' });
    });
    await wait(300);
    await closeAll();
    let card = await findsTab();
    expect(card && card.ico && /Карта сокровищ/.test(card.text) && /1 из 3/.test(card.text), 'карта в рюкзаке: 1 из 3', card);
    await page.click('.overlay .card.map-card');
    await wait(400);
    let t = await panelText();
    const img = await ev(() => {
      const i = document.querySelector('.overlay img.treasure-map');
      return i ? { ok: i.complete && i.naturalWidth > 300, w: i.getBoundingClientRect().width } : null;
    });
    expect(/Кусочков: 1 из 3/.test(t) && img && img.ok && img.w > 200, 'окно с картой: картинка и сколько кусочков', [t.slice(-120), img]);
    await closeAll();
    // все три кусочка
    await ev(() => {
      window.__dev.emit('cove', { what: 'piece', id: 'ship' });
      window.__dev.emit('cove', { what: 'piece', id: 'isle' });
    });
    await wait(300);
    await closeAll();
    card = await findsTab();
    expect(card && /вся/.test(card.text), 'карта в рюкзаке: вся', card);
    await page.click('.overlay .card.map-card');
    await wait(400);
    t = await panelText();
    expect(/Все три кусочка/.test(t), 'окно с целой картой', t.slice(-160));
    await closeAll();
    await unwatch();
  });
};
