// Шаги автотеста быстрых правок по ревью игровой логики (scratchpad review/features.md, «Быстрые исправления»):
//   п. 1 — ночь в отеле и на острове засчитывается, если уснула (сколько бы ни думала над окном), и не засчитывается,
//          если передумала;
//   п. 2 — очки дружбы со скамейки / волейбола / рассказа тоже выдают награды за сердечки (рецепт на 2 ❤);
//   п. 4 — «Позвать в гости» в разговоре засчитывает шаг вводного задания «Позови друга в гости».
// Подключается из dev/smoke.js. Только эти шаги:  node dev/smoke.js <url> "step:правки ревью"
module.exports = async function rfix({ page, step, ev, wait, closeAll }) {
  const norm = (t) => t.replace(/[  ]/g, ' ');
  const expect = (ok, msg, data) => {
    if (!ok) throw new Error(msg + (data === undefined ? '' : ': ' + JSON.stringify(data)));
  };
  const mutate = (fn) => ev((src) => window.__dev.actions.mutate(new Function('s', src)), fn);
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
    await page.evaluate(() => window.__dev.oldStart()); // 1 января, без вводной цепочки
    await wait(400);
    await page.click('text=Поехали!');
    await wait(500);
    await closeAll();
    await mutate('s.minutes = 21 * 60; s.day = 18; s.weather = "sun"; s.dayFlags = {}; s.flags.hotelHint = 1; s.flags.hutHint = 1; s.flags.islandHint = 1;');
  };
  /** Окно «Пора спать?» открыто; подождать ms и ответить кнопкой. */
  const answerSleep = async (btn, ms = 0) => {
    for (let i = 0; i < 20 && !/Пора спать/.test(await panelText()); i++) await wait(100);
    expect(/Пора спать/.test(await panelText()), 'нет окна «Пора спать?»', await panelText());
    if (ms) await wait(ms);
    await page.click(`.panel-foot .btn >> text=${btn}`);
    await wait(btn === 'Спать' ? 3700 : 400);
    await closeAll();
  };
  const toHotelRoom = async () => {
    await ev(() => {
      const d = window.__dev;
      d.actions.setDayFlag('room', 'std', 'hotel');
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

  await step('правки ревью п. 1: отель — думала над «Пора спать?» 7 секунд и уснула — ночь в отеле засчитана', async () => {
    await fresh();
    await toHotelRoom();
    const day0 = (await state()).day;
    await ev(() => {
      window.__dev.run('hotel:bed');
    });
    await answerSleep('Спать', 7000);
    const s = await state();
    expect(s.day === day0 + 1 && s.stickers.includes('x_hotel_night') && s.dayFlags.hotel && s.dayFlags.hotel.slept === 1, 'ночь в отеле не засчитана', [
      s.day - day0,
      s.stickers.slice(-3),
      s.dayFlags.hotel,
    ]);
  });

  await step('правки ревью п. 1: отель — передумала спать, потом уснула иначе — ночь в отеле не засчитана', async () => {
    await fresh();
    await toHotelRoom();
    await ev(() => {
      window.__dev.run('hotel:bed');
    });
    await answerSleep('Ещё погуляю');
    await ev(() => {
      window.__dev.run('sleep'); // обычный сон, не из кровати номера
    });
    await answerSleep('Спать');
    const s = await state();
    expect(!s.stickers.includes('x_hotel_night') && !(s.dayFlags.hotel && s.dayFlags.hotel.slept), 'ночь засчитана, хотя передумала', [s.stickers.slice(-3), s.dayFlags.hotel]);
  });

  await step('правки ревью п. 1: остров — думала 7 секунд и уснула в хижине — «Ночь на острове»; передумала — нет', async () => {
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
    await ev(() => {
      window.__dev.run('island:sleep');
    });
    await answerSleep('Ещё погуляю');
    await ev(() => {
      window.__dev.run('sleep');
    });
    await answerSleep('Спать');
    expect(!(await state()).stickers.includes('x_island_night'), 'передумала, а «Ночь на острове» дали');
    await mutate('s.minutes = 21 * 60;');
    await toHut();
    await ev(() => {
      window.__dev.run('island:sleep');
    });
    await answerSleep('Спать', 7000);
    expect((await state()).stickers.includes('x_island_night'), 'думала 7 секунд — «Ночь на острове» не засчитана');
  });
};
