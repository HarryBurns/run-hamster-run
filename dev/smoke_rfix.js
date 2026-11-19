// Шаги автотеста быстрых правок по ревью игровой логики (scratchpad review/features.md, «Быстрые исправления»):
//   п. 1 — ночь в отеле и на острове засчитывается, если уснула (сколько бы ни думала над окном), и не засчитывается,
//          если передумала;
//   п. 2 — очки дружбы со скамейки / волейбола / рассказа тоже выдают награды за сердечки (рецепт на 2 ❤);
//   п. 4 — «Позвать в гости» в разговоре засчитывает шаг вводного задания «Позови друга в гости».
// Подключается из dev/smoke.js. Только эти шаги:  node dev/smoke.js <url> "step:правки ревью"
const lib = require('./lib.js');

module.exports = async function rfix(ctx) {
  const {
    page,
    step,
    ev,
    wait,
    closeAll,
    norm,
    expect,
    state,
    mutate,
    panelText,
    fresh: newGame,
    act,
    until,
    untilPanel,
    untilScene,
    untilDialog,
    frames,
    go,
  } = lib(ctx);
  // июль, 21:00 (можно спать), солнце; подсказки отеля, хижины и острова уже были
  const fresh = () =>
    newGame({
      day: 18,
      minutes: 21 * 60,
      weather: 'sun',
      dayFlags: true,
      flags: { hotelHint: 1, hutHint: 1, islandHint: 1 },
    });
  /** Окно «Пора спать?» открыто; подождать ms и ответить: «Спать» (yes) или «Ещё погуляю». */
  const answerSleep = async (yes, ms = 0) => {
    await untilPanel('Пора спать').catch(() => {});
    expect(/Пора спать/.test(await panelText()), 'нет окна «Пора спать?»', await panelText());
    if (ms) await wait(ms); // думает над окном — так и задумано
    const day0 = await ev(() => window.__dev.G.state.day);
    await act(yes ? 'ok' : 'no', '.overlay .panel-foot');
    if (yes)
      await until((d) => window.__dev.G.state.day === d + 1 && !document.querySelector('.fade'), day0, {
        timeout: 8000,
        msg: 'утро',
      });
    else await frames(3);
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
    await frames(3);
  };

  await step(
    'правки ревью п. 1: отель — думала над «Пора спать?» 7 секунд и уснула — ночь в отеле засчитана',
    async () => {
      await fresh();
      await toHotelRoom();
      const day0 = (await state()).day;
      await ev(() => {
        window.__dev.run('hotel:bed');
      });
      await answerSleep(true, 7000);
      const s = await state();
      expect(
        s.day === day0 + 1 && s.stickers.includes('x_hotel_night') && s.dayFlags.hotel && s.dayFlags.hotel.slept === 1,
        'ночь в отеле не засчитана',
        [s.day - day0, s.stickers.slice(-3), s.dayFlags.hotel],
      );
    },
  );

  await step(
    'правки ревью п. 1: отель — передумала спать, потом уснула иначе — ночь в отеле не засчитана',
    async () => {
      await fresh();
      await toHotelRoom();
      await ev(() => {
        window.__dev.run('hotel:bed');
      });
      await answerSleep(false);
      await ev(() => {
        window.__dev.run('sleep'); // обычный сон, не из кровати номера
      });
      await answerSleep(true);
      const s = await state();
      expect(
        !s.stickers.includes('x_hotel_night') && !(s.dayFlags.hotel && s.dayFlags.hotel.slept),
        'ночь засчитана, хотя передумала',
        [s.stickers.slice(-3), s.dayFlags.hotel],
      );
    },
  );

  await step(
    'правки ревью п. 1: остров — думала 7 секунд и уснула в хижине — «Ночь на острове»; передумала — нет',
    async () => {
      await fresh();
      const toHut = async () => {
        await ev(() => {
          const d = window.__dev;
          for (const id of ['forest', 'mountain', 'island']) if (!d.QuestState.landOpen(id)) d.actions.openLand(id);
          d.go('island');
          const sc = d.locations.island;
          sc.enterBuilding(sc.map.bById.guest);
        });
        await untilScene('hut_guest').catch(() => {});
        expect(
          (await ev(() => window.__dev.sceneName)) === 'hut_guest',
          'не в хижине для гостей',
          await ev(() => window.__dev.sceneName),
        );
      };
      await toHut();
      await ev(() => {
        window.__dev.run('island:sleep');
      });
      await answerSleep(false);
      await ev(() => {
        window.__dev.run('sleep');
      });
      await answerSleep(true);
      expect(!(await state()).stickers.includes('x_island_night'), 'передумала, а «Ночь на острове» дали');
      await mutate('s.minutes = 21 * 60;');
      await toHut();
      await ev(() => {
        window.__dev.run('island:sleep');
      });
      await answerSleep(true, 7000);
      expect((await state()).stickers.includes('x_island_night'), 'думала 7 секунд — «Ночь на острове» не засчитана');
    },
  );

  await step(
    'правки ревью п. 2: очки дружбы мимо разговора (скамейка, волейбол, рассказ) — рецепт на 2 ❤ и подарок на 5 ❤',
    async () => {
      await fresh();
      await go('world');
      await mutate('s.friends.myata.met = true; s.friends.myata.pts = 7;');
      const r0 = (await state()).recipes.length;
      // так прибавляют очки скамейка и волейбол (features/relax.js) и рассказ жителю (features/tales.js)
      await ev(() => window.__dev.actions.addFriendPts('myata', 1));
      await untilPanel('Секретный рецепт').catch(() => {});
      expect(/Секретный рецепт/.test(await panelText()), 'нет окна «Секретный рецепт!»', await panelText());
      await closeAll();
      let s = await state();
      expect(s.recipes.length === r0 + 1, 'рецепт за 2 ❤ не выдан', [r0, s.recipes.length]);
      await mutate('s.friends.myata.pts = 19;');
      await ev(() => window.__dev.actions.addFriendPts('myata', 1));
      await until(
        () => window.__dev.G.state.stickers.includes('x_friend') && document.querySelector('.overlay'),
        undefined,
        { timeout: 4000 },
      ).catch(() => {});
      await wait(300); // окна наград встают одно за другим
      await closeAll();
      s = await state();
      expect(s.stickers.includes('x_friend'), 'наклейка «Лучший друг» за 5 ❤ не выдана', s.stickers.slice(-3));
      // повтор без нового сердечка — наград нет
      const r1 = s.recipes.length;
      await ev(() => window.__dev.actions.addFriendPts('myata', 1));
      await wait(700);
      expect(
        !(await ev(() => document.querySelectorAll('.overlay').length)) && (await state()).recipes.length === r1,
        'награда без нового сердечка',
      );
    },
  );

  await step(
    'правки ревью п. 4: «Позвать в гости» в разговоре на улице — событие invite (шаг вводного задания), гость дома',
    async () => {
      await fresh();
      await mutate('s.minutes = 12 * 60;');
      await ev(() => {
        const d = window.__dev;
        d.__ev = [];
        d.events.on('invite', (e) => d.__ev.push(e.id));
        d.actions.meetFriend('senya');
        d.go('world');
      });
      await untilScene('world');
      await ev(() => {
        window.__dev.run('npc:senya');
      });
      await untilDialog();
      await page.click('.dialog .btn:has-text("Позвать в гости")');
      await until(() => /Уже бегу/.test((document.querySelector('.dialog .say') || {}).textContent || ''), undefined, {
        timeout: 3000,
      }).catch(() => {});
      const said = norm(await ev(() => (document.querySelector('.dialog .say') || {}).textContent || ''));
      expect(/Уже бегу к тебе/.test(said), 'ответ на приглашение', said);
      await closeAll();
      const r = await ev(() => ({ ev: window.__dev.__ev.join(), guests: window.__dev.G.state.guests.join() }));
      expect(r.ev === 'senya' && r.guests === 'senya', 'приглашение в разговоре не засчитано событием invite', r);
    },
  );
};
