// Шаги автотеста по багам от заказчика (после третьего обновления):
//   показ мод — после показа (крестик, итог, перезагрузка посреди показа) на хомячке её собственный наряд;
//   звёздочка задания «покажись жителю» — там, где житель на самом деле (в гостях, дома, в отеле, в городе);
//   тексты «где житель» (журнал, «Всё готово!», «Новое задание!», дверь домика) — там, где он на самом деле.
// Подключается из dev/smoke.js. Только эти шаги:  node dev/smoke.js <url> "step:заказчик:"
const lib = require('./lib.js');

module.exports = async function zfix(ctx) {
  const {
    page,
    step,
    ev,
    until,
    expect,
    fresh,
    frames,
    mgGo,
    mgDone,
    mgClose,
    reload,
    closeAll,
    untilPanel,
    toasts,
    clearToasts,
    enter,
  } = lib(ctx);

  // ---------- показ мод: наряд игрока не меняется ----------
  const outfit = () => ev(() => JSON.stringify(window.__dev.G.state.look.outfit));
  /** Показ мод: начать, открыть шкаф и надеть соломенную шляпу (её до показа не было на голове). */
  const showAndDress = async () => {
    await ev(() => {
      window.__dev.F.playMinigame('fashion');
    });
    await mgGo();
    await page.click('#mg button:has-text("Переодеться")');
    await untilPanel('Тема');
    await page.click('.overlay .card:has-text("Соломенная шляпа")');
    await frames(2);
    expect(
      await ev(
        () =>
          !!document.querySelector('.overlay .card.sel') &&
          /Соломенная/.test(document.querySelector('.overlay .card.sel').textContent),
      ),
      'в шкафу показа шляпа не надета (проверка не годится)',
    );
  };
  const freshShow = async () => {
    await fresh({ day: 18, minutes: 12 * 60, weather: 'sun', dayFlags: true });
    await ev(() => {
      const a = window.__dev.actions;
      a.addClothes('sunhat');
      a.wear('head', null);
    });
    return outfit();
  };

  await step('заказчик: показ мод — после итога на хомячке тот наряд, что был до показа', async () => {
    const before = await freshShow();
    await showAndDress();
    expect((await outfit()) === before, 'шкаф показа переодел саму хомячку', await outfit());
    await page.click('.overlay .btn:has-text("Готово")');
    await until(() => !document.querySelector('.overlay'), undefined, { timeout: 3000 });
    await page.click('#mg button:has-text("На подиум")');
    await page.waitForSelector('#mg button:has-text("Дальше")', { timeout: 15000 });
    await page.click('#mg button:has-text("Дальше")');
    await mgDone();
    await closeAll();
    expect((await outfit()) === before, 'после показа мод на хомячке остался наряд показа', await outfit());
    expect(await ev(() => (window.__dev.G.state.plays.fashion || 0) >= 1), 'показ не засчитался (проверка не годится)');
  });

  await step('заказчик: показ мод — закрыла крестиком посреди показа: наряд свой', async () => {
    const before = await freshShow();
    await showAndDress();
    await page.click('.overlay .btn:has-text("Готово")'); // шкаф
    await until(() => !document.querySelector('.overlay'), undefined, { timeout: 3000 });
    await mgClose();
    await closeAll();
    expect((await outfit()) === before, 'после крестика на хомячке наряд показа', await outfit());
  });

  await step('заказчик: показ мод — перезагрузка посреди показа: наряд не потерялся', async () => {
    const before = await freshShow();
    await showAndDress();
    await reload();
    await closeAll();
    expect((await outfit()) === before, 'после перезагрузки посреди показа наряд хомячки потерялся', await outfit());
  });

  // ---------- звёздочка к жителю — там, где он сейчас ----------
  /** Задание qid взято, все шаги до «поговори с …» сделаны, звёздочка показывает его; часы — min. */
  const talkStep = (qid, min, set) =>
    ev(
      ([qid, min, set]) => {
        const d = window.__dev,
          a = d.actions;
        a.mutate((s) => {
          s.minutes = min;
          s.dayFlags = {};
          s.guests = [];
          s.guestsAt = 'villa';
          if (set) new Function('s', set)(s);
        });
        a.takeQuest(qid);
        const w = d.QuestState.questNow(qid);
        w.q.steps.forEach((st, i) => {
          if (!st.talk && i < w.q.steps.length - 1) a.questCount(qid, i);
        });
        d.F.trackQuest(qid);
        return d.QuestState.questNow(qid).i;
      },
      [qid, min, set || ''],
    );
  /** Звёздочка в локации scene (город по умолчанию) и где житель id: { t, npc, door: дверь здания b }. */
  const star = async (id, b, scene = 'world') => {
    await ev((sc) => window.__dev.go(sc), scene);
    await until((sc) => window.__dev.sceneName === sc, scene);
    await frames(3);
    return ev(
      ([id, b, scene]) => {
        const sc = window.__dev.locations[scene],
          n = sc.npcs.find((q) => q.id === id);
        return {
          t: sc.target(),
          npc: n ? { x: n.x, y: n.y, hidden: n.hidden } : null,
          door: b ? sc.doorOf(b) : null,
        };
      },
      [id, b, scene],
    );
  };
  const atDoor = (r) => !!r.t && !!r.door && Math.abs(r.t.x - r.door.x) < 30 && Math.abs(r.t.y - r.door.y) < 100;
  const atNpc = (r) =>
    !!r.t && !!r.npc && !r.npc.hidden && Math.abs(r.t.x - r.npc.x) < 4 && Math.abs(r.t.y + 62 - r.npc.y) < 4;

  await step(
    'заказчик: звёздочка «покажись Плюше» — Плюша в гостях на вилле: звёздочка у виллы, а не у её дома',
    async () => {
      await fresh({ day: 18, minutes: 12 * 60, weather: 'sun', dayFlags: true });
      const i = await talkStep('intro_home', 12 * 60);
      expect(i === 3, 'задание не на шаге «покажись Плюше» (проверка не годится)', i);
      await ev(() => window.__dev.actions.inviteGuest('plusha', 'villa'));
      const r = await star('plusha', 'villa');
      expect(atDoor(r), 'Плюша в гостях на вилле, а звёздочка не у виллы', r);
      const own = await ev(() => window.__dev.World.doorOf('house0'));
      expect(Math.hypot(r.t.x - own.x, r.t.y - own.y) > 200, 'звёздочка у домика Плюши, хотя она у нас в гостях', [
        r.t,
        own,
      ]);
      // журнал говорит, где она сейчас
      await ev(() => window.__dev.F.openAlbum('quests'));
      await untilPanel();
      const j = await ev(() => document.querySelector('.overlay').textContent);
      expect(/Плюша у тебя в гостях/.test(j), 'журнал не говорит, что Плюша в гостях', j.slice(0, 400));
      await closeAll();
    },
  );

  await step(
    'заказчик: звёздочка к жителю — проводили домой днём и вечером, ночью спит: туда, где он сейчас',
    async () => {
      await fresh({ day: 18, minutes: 12 * 60, weather: 'sun', dayFlags: true });
      await talkStep('intro_home', 12 * 60);
      await ev(() => window.__dev.actions.inviteGuest('plusha', 'villa'));
      await star('plusha', 'villa');
      // проводили домой днём — Плюша снова на улице: звёздочка над ней
      await ev(() => window.__dev.actions.removeGuest('plusha'));
      await frames(3);
      let r = await star('plusha', 'house0');
      expect(atNpc(r), 'проводили Плюшу днём — звёздочка не над ней', r);
      // вечером — идёт к своему домику: звёздочка над ней
      await ev(() => {
        const a = window.__dev.actions;
        a.mutate((s) => (s.minutes = 20 * 60));
        a.inviteGuest('plusha', 'villa');
      });
      await frames(2);
      await ev(() => window.__dev.actions.removeGuest('plusha'));
      await frames(3);
      r = await star('plusha', 'house0');
      expect(atNpc(r), 'вечером проводили Плюшу — звёздочка не над ней', r);
      // ночью спит дома — звёздочка у её домика
      await ev(() => window.__dev.actions.mutate((s) => (s.minutes = 23 * 60)));
      await frames(3);
      r = await star('plusha', 'house0');
      expect(r.npc.hidden && atDoor(r), 'ночью звёздочка не у домика Плюши', r);
    },
  );

  await step(
    'заказчик: звёздочка к жителю — гостит в квартире, в лесном домике; Мята в гостях — тоже к вилле',
    async () => {
      await fresh({ day: 18, minutes: 12 * 60, weather: 'sun', dayFlags: true });
      await talkStep('intro_home', 12 * 60);
      await ev(() => {
        const a = window.__dev.actions;
        a.addHome('flat');
        a.addHome('cabin');
        a.openLand('forest');
        a.inviteGuest('plusha', 'flat');
      });
      let r = await star('plusha', 'home_apartment');
      expect(atDoor(r), 'Плюша гостит в квартире, а звёздочка не у её подъезда', r);
      // гостит в лесном домике: в городе — к дороге в лес, в лесу — у домика
      await ev(() => {
        const a = window.__dev.actions;
        a.removeGuest('plusha');
        a.inviteGuest('plusha', 'cabin');
      });
      r = await star('plusha', null);
      expect(r.t && r.t.next === 'forest', 'Плюша в лесном домике, а звёздочка в городе ведёт не в лес', r);
      r = await star('plusha', 'cabin', 'forest');
      expect(atDoor(r), 'в лесу звёздочка не у лесного домика', r);
      // другое задание, другой житель: «расскажи Мяте», Мята в гостях на вилле
      await talkStep('intro_garden', 12 * 60, 's.quests.intro_home = { day: s.day, n: {}, got: {}, done: s.day };');
      await ev(() => window.__dev.actions.inviteGuest('myata', 'villa'));
      r = await star('myata', 'villa');
      expect(atDoor(r), 'Мята в гостях на вилле, а звёздочка не у виллы', r);
    },
  );

  // ---------- тексты «где житель» — там, где он на самом деле ----------
  const journal = async () => {
    await ev(() => window.__dev.F.openAlbum('quests'));
    await untilPanel();
    const j = await ev(() => document.querySelector('.overlay').textContent);
    await closeAll();
    return j;
  };

  await step(
    'заказчик: где житель — «Новоселье»: Плюша у детской площадки, а не у пруда; в гостях — так и сказано',
    async () => {
      // в описаниях вводной цепочки и журнала нет жёстких «гуляет у пруда» у Плюши, у шагов «поговори» с жителями
      // города нет своих подсказок (журнал говорит сам)
      const bad = await ev(async () => {
        const D = await import('/js/data/index.js');
        return D.QUESTS.flatMap((q) => [
          ...(q.npc === 'plusha' && /пруд/.test(JSON.stringify(q.lines || {})) ? [q.id + ': реплика'] : []),
          ...q.steps.filter((st) => st.talk && D.NPC_HOME[st.talk] && st.hint).map((st) => q.id + ': ' + st.hint),
        ]);
      });
      expect(!bad.length, 'в заданиях остались жёсткие «где гуляет» у жителей города', bad);
      await fresh({ day: 18, minutes: 12 * 60, weather: 'sun', dayFlags: true });
      await talkStep('intro_home', 12 * 60);
      let j = await journal();
      expect(
        /Плюша гуляет в парке у детской площадки/.test(j),
        'днём журнал не говорит, что Плюша у детской площадки',
        j.slice(0, 500),
      );
      expect(!/пруд/.test(j), 'журнал говорит про пруд', j.slice(0, 500));
      // в гостях на вилле
      await ev(() => window.__dev.actions.inviteGuest('plusha', 'villa'));
      j = await journal();
      expect(
        /Сейчас Плюша у тебя в гостях, на вилле/.test(j),
        'журнал не говорит, что Плюша в гостях на вилле',
        j.slice(0, 500),
      );
      // вечером — у домика, ночью спит
      await ev(() => {
        const a = window.__dev.actions;
        a.removeGuest('plusha');
        a.mutate((s) => (s.minutes = 20 * 60));
      });
      j = await journal();
      expect(/Сейчас Плюша у своего домика/.test(j), 'вечером журнал не говорит, что Плюша у домика', j.slice(0, 500));
      await ev(() => window.__dev.actions.mutate((s) => (s.minutes = 23 * 60)));
      j = await journal();
      expect(/Плюша уже спит/.test(j), 'ночью журнал не говорит, что Плюша спит', j.slice(0, 500));
    },
  );
};
