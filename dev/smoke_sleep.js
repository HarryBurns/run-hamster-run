// Шаги автотеста «Сон только вечером» (этап 18): лечь спать можно с 19:00 (SLEEP_FROM в data/calendar.js).
// Днём кровать виллы, номер в отеле и хижина на острове показывают доброе окно «Ещё рано спать» — день не меняется,
// монеты не тратятся; номер, снятый днём, ждёт до вечера, и ночь в нём засчитывается; в 19:00 — подсказка
// «Вот и вечер», если днём пробовала лечь. Подключается из dev/smoke.js. Только эти шаги:
//   node dev/smoke.js <url> "step:сон вечером"
module.exports = async function sleepSteps({ page, step, ev, wait, closeAll }) {
  const norm = (t) => t.replace(/[  ]/g, ' ');
  const expect = (ok, msg, data) => {
    if (!ok) throw new Error(msg + (data === undefined ? '' : ': ' + JSON.stringify(data)));
  };
  const mutate = (fn) => ev((src) => window.__dev.actions.mutate(new Function('s', src)), fn);
  const state = () => ev(() => JSON.parse(JSON.stringify(window.__dev.G.state)));
  const panelText = async () =>
    norm(await ev(() => [...document.querySelectorAll('.overlay .panel')].map((p) => p.textContent).join(' | ')));
  const toasts = async () => norm(await ev(() => (document.querySelector('#toasts') || { textContent: '' }).textContent));
  const clearToasts = () =>
    ev(() => {
      const t = document.querySelector('#toasts');
      if (t) t.innerHTML = '';
    });
  const fresh = async () => {
    await ev(() => {
      window.__dev.G.state = null;
      localStorage.clear();
    });
    await page.reload();
    await wait(400);
    await page.click('text=Играть!');
    await page.click('text=Пропустить'); // вступительная сценка новой игры (этап 10)
    await page.evaluate(() => window.__dev.actions.setFlag('intro', 0)); // вводная цепочка — в dev/smoke_start.js
    await wait(400);
    await page.click('text=Поехали!');
    await wait(500);
    await closeAll();
    await mutate('s.minutes = 12 * 60; s.weather = "sun"; s.dayFlags = {}; s.flags.hotelHint = 1; s.flags.hutHint = 1; s.flags.islandHint = 1;');
  };
  /** Действие из реестра (не ждём: окно сна ждёт ответа), подождать окно. */
  const tryBed = async (act) => {
    await ev((act) => {
      window.__sleepRes = 'ждём';
      Promise.resolve(window.__dev.run(act)).then((r) => (window.__sleepRes = r));
    }, act);
    for (let i = 0; i < 20 && !/Ещё рано спать|Пора спать/.test(await panelText()); i++) await wait(100);
  };
  /** Днём: окно «Ещё рано спать» (с 19:00 в тексте), кнопка «Хорошо», сон не наступил. */
  const expectEarly = async (where) => {
    const pt = await panelText();
    expect(/Ещё рано спать/.test(pt) && /19:00/.test(pt) && !/Пора спать/.test(pt), `${where}: днём нет окна «Ещё рано спать»`, pt);
    await page.click('.overlay .panel-foot .btn >> nth=0');
    await wait(400);
    // askSleep (действие sleep) отвечает «не уснула»; кровать номера и циновка отвечают «нажатие принято» (true)
    if (where.startsWith('кровать'))
      expect((await ev(() => window.__sleepRes)) === false, `${where}: сон днём не вернул «не уснула»`, await ev(() => window.__sleepRes));
    expect((await ev(() => window.__dev.G.modal)) === 0, `${where}: после окна игра на паузе`, await ev(() => window.__dev.G.modal));
  };
  const toHotelRoom = async () => {
    await closeAll();
    await ev(() => {
      const d = window.__dev;
      if (d.sceneName !== 'world') d.go('world');
      d.enterBuilding('hotel');
      const sc = d.scene;
      sc.p.f = 1;
      sc.p.x = 1640;
      sc.p.path = [];
      sc.standUp();
    });
    await wait(350);
  };

  await step('сон вечером: днём кровать виллы — «Ещё рано спать», день не сменился; с 19:00 — «Пора спать?» и новый день', async () => {
    await fresh();
    await ev(() => window.__dev.villaAt(1, 270)); // у кровати
    await wait(300);
    const s0 = await state();
    // клавиша E у кровати — как играют на компьютере
    await ev(() => (window.__sleepRes = 'ждём'));
    await page.keyboard.press('KeyE');
    await wait(500);
    const pt = await panelText();
    expect(/Ещё рано спать/.test(pt) && /солнышко высоко/.test(pt), 'днём E у кровати — нет доброго окна', pt);
    await closeAll();
    // через askSleep (так спят «Домой» → кровать, свой дом, вилла): днём не уснуть
    await tryBed('sleep');
    await expectEarly('кровать');
    let s = await state();
    expect(s.day === s0.day && s.money === s0.money && s.minutes >= s0.minutes && s.minutes < 19 * 60, 'днём день сменился или деньги изменились', [s0.day, s.day, s0.money, s.money, s.minutes]);
    expect(s.dayFlags.early === 1, 'не отмечено, что пробовала лечь днём', s.dayFlags);
    // 18:59 — ещё рано
    await mutate('s.minutes = 19 * 60 - 1;');
    await tryBed('sleep');
    await expectEarly('кровать в 18:59');
    // в 19:00 — подсказка «Вот и вечер» (один раз за день, т.к. днём пробовала лечь)
    await clearToasts();
    await mutate('s.minutes = 19 * 60 - 0.2;');
    for (let i = 0; i < 20 && !/Вот и вечер/.test(await toasts()); i++) await wait(100);
    expect(/Вот и вечер/.test(await toasts()), 'в 19:00 нет подсказки «теперь можно спать»', await toasts());
    // с 19:00 — обычный вопрос и новый день
    await tryBed('sleep');
    expect(/Пора спать/.test(await panelText()), 'с 19:00 кровать не спрашивает про сон', await panelText());
    await page.click('.panel-foot .btn >> text=Спать');
    await wait(3700);
    await closeAll();
    s = await state();
    expect(s.day === s0.day + 1 && s.minutes < 9 * 60 && (await ev(() => window.__sleepRes)) === true, 'вечером не уснула', [s0.day, s.day, s.minutes]);
    expect(!s.dayFlags.early && !s.dayFlags.eve, 'отметки «рано» перешли в новый день', s.dayFlags);
  });

  await step('сон вечером: номер в отеле снят днём — уснуть нельзя, монеты целы, номер ждёт; вечером — ночь в отеле', async () => {
    await fresh();
    await mutate('s.dayFlags = { hotel: { room: 1 } };'); // ключ от 207 («Стандарт») взяли на ресепшене днём
    await toHotelRoom();
    const s0 = await state();
    await tryBed('hotel:bed');
    await expectEarly('номер в отеле');
    let s = await state();
    expect(s.day === s0.day && s.money === s0.money && s.dayFlags.hotel.room === 1 && !s.dayFlags.hotel.slept, 'днём в номере: день, монеты или ключ изменились', [s0.money, s.money, s.dayFlags.hotel]);
    expect(!s.stickers.includes('x_hotel_night'), 'днём засчитана ночь в отеле');
    // вечером — тот же номер, без новой оплаты
    await ev(() => window.__dev.evening());
    await tryBed('hotel:bed');
    expect(/Пора спать/.test(await panelText()), 'вечером номер не предлагает поспать', await panelText());
    await page.click('.panel-foot .btn >> text=Спать');
    await wait(3700);
    await closeAll();
    s = await state();
    expect(s.day === s0.day + 1 && s.money >= s0.money && s.stickers.includes('x_hotel_night') && s.dayFlags.hotel && s.dayFlags.hotel.slept === 1, 'вечером ночь в отеле не засчитана', [
      s.day - s0.day,
      s0.money,
      s.money,
      s.dayFlags.hotel,
    ]);
    expect((await ev(() => window.__dev.sceneName)) === 'hotel', 'утро не в отеле', await ev(() => window.__dev.sceneName));
  });

  await step('сон вечером: хижина на острове днём — «Ещё рано», ночёвка не засчитана; вечером — «Ночь на острове»', async () => {
    await fresh();
    const toHut = async () => {
      await ev(() => {
        const d = window.__dev;
        for (const id of ['forest', 'mountain', 'island']) if (!d.QuestState.landOpen(id)) d.actions.openLand(id);
        d.go('island');
        const sc = d.locations.island;
        sc.enterBuilding(sc.map.bById.guest);
      });
      await wait(900);
      expect((await ev(() => window.__dev.sceneName)) === 'hut_guest', 'не в хижине для гостей', await ev(() => window.__dev.sceneName));
    };
    await toHut();
    const day0 = (await state()).day;
    await tryBed('island:sleep');
    await expectEarly('хижина');
    expect((await state()).day === day0, 'днём на острове наступил новый день');
    // днём передумала — а вечером уснула в обычной кровати: «Ночь на острове» не дают
    await ev(() => window.__dev.evening());
    await tryBed('sleep');
    await page.click('.panel-foot .btn >> text=Спать');
    await wait(3700);
    await closeAll();
    expect(!(await state()).stickers.includes('x_island_night'), 'днём не уснула в хижине, а «Ночь на острове» дали');
    await ev(() => window.__dev.evening());
    await toHut();
    await tryBed('island:sleep');
    expect(/Пора спать/.test(await panelText()), 'вечером циновка не предлагает поспать', await panelText());
    await page.click('.panel-foot .btn >> text=Спать');
    await wait(3700);
    await closeAll();
    expect((await state()).stickers.includes('x_island_night'), 'вечером «Ночь на острове» не засчитана');
  });

  await step('сон вечером: простыла днём — в окне «Ещё рано» подсказка про доктора', async () => {
    await fresh();
    await ev(() => window.__dev.actions.fallSick('cold'));
    await ev(() => window.__dev.go('villa'));
    await wait(300);
    await tryBed('sleep');
    const pt = await panelText();
    expect(/Ещё рано спать/.test(pt) && /Доктор/.test(pt), 'больной днём — нет подсказки про доктора', pt);
    await closeAll();
    await ev(() => window.__dev.actions.recoverSick('self'));
  });
};
