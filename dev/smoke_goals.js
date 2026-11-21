// Шаги автотеста «квесты и звёздочка» (js/features/goals.js): активный квест один и только у него указатель;
// звёздочка сама не перепрыгивает — её ведёт игрок («⭐ Веди меня», «⭐ Покажи дорогу!» / «Потом»); квест закончен —
// активным становится следующий по общему порядку (js/data/goals.js); выбор лежит в сохранении; одна плашка HUD.
// Подключается из dev/smoke.js. Только эти шаги:  node dev/smoke.js <url> "step:квесты:"
// Порядок квестов без браузера — node dev/test_goals.js.
const lib = require('./lib.js');

module.exports = async function goals(ctx) {
  const L = lib(ctx);
  const { page, step, ev, wait, expect, closeAll, untilPanel, untilScene, panelText, toasts, clearToasts, frames } = L;
  const goal = () => ev(() => window.__dev.goal.now());
  const list = () => ev(() => window.__dev.goal.list());
  /** Плашка активного квеста и кружок «+N»: { text, more, moreShown, task — осталась ли старая плашка письма }. */
  const hud = () =>
    ev(() => {
      window.__dev.emit('hud');
      const q = document.querySelector('.chip.quest'),
        m = document.querySelector('.chip.more'),
        r = q.getBoundingClientRect(),
        mr = m.getBoundingClientRect();
      return {
        text: q.hidden ? '' : q.querySelector(innerWidth < 520 ? '.short' : '.long').textContent,
        more: m.hidden ? '' : m.textContent,
        right: Math.max(r.right, m.hidden ? 0 : mr.right),
        vw: innerWidth,
        chips: document.querySelectorAll('.chip.quest, .chip.task').length,
      };
    });
  /** Полдень ясного дня в городе. */
  const noon = async () => {
    await ev(() => {
      const d = window.__dev;
      d.actions.mutate((s) => {
        s.minutes = 12 * 60;
        s.weather = 'sun';
        s.wxStrong = '';
      });
      d.go('world');
    });
    await untilScene('world');
    await frames(2);
  };
  /** Письмо дня — «Базарный день» (ведёт к рынку), прочитано. */
  const marketMail = async () => {
    await ev(() => {
      const d = window.__dev;
      d.actions.setMail('market');
      d.F.openMailbox();
    });
    await untilPanel();
  };
  /** Звёздочка в городе: рядом ли она с дверью здания b / с жителем id. */
  const starAt = (what) =>
    ev((what) => {
      const W = window.__dev.World,
        t = W.target();
      if (!t) return { t: null };
      if (what.startsWith('npc:')) {
        const n = W.npcs.find((q) => q.id === what.slice(4));
        return { t, d: Math.hypot(t.x - n.x, t.y + 62 - n.y) };
      }
      const door = W.doorOf(what);
      return { t, d: Math.hypot(t.x - door.x, t.y + 48 - door.y) };
    }, what);
  /** Карточки журнала: [{ id, lead — «звёздочка ведёт сюда», btn — есть «⭐ Веди меня» }]. */
  const cards = () =>
    ev(() =>
      [...document.querySelectorAll('.overlay .quest[data-goal]')].map((c) => ({
        id: c.dataset.goal,
        lead: !!c.querySelector('.q-lead'),
        btn: !!c.querySelector('.q-lead-btn'),
      })),
    );
  const openJournal = async () => {
    await closeAll();
    await ev(() => {
      window.__dev.F.openAlbum('quests');
    });
    await untilPanel();
  };

  await step(
    'квесты: активный квест один — письмо; у ворот леса звёздочка не уходит; «⭐ Веди меня» в журнале; одна плашка; выбор в сохранении',
    async () => {
      await L.fresh({ start: 'june' });
      await ev(() => window.__dev.actions.nextDay());
      await noon();
      // письмо не прочитано — единственный квест, он и активен; звёздочка — у почтового ящика
      expect((await goal()) === 'mail' && (await list()).join() === 'mail', 'в начале квест — не одно письмо', [
        await goal(),
        await list(),
      ]);
      let h = await hud();
      expect(/письмо/i.test(h.text) && h.more === '' && h.chips === 1, 'плашка: одно письмо, без счётчика', h);
      expect((await ev(() => window.__dev.World.target().icon)) === '✉️', 'звёздочка не у почтового ящика');
      // письмо прочитано: звёздочка свободна от других квестов — кнопка одна, «Вперёд!»
      await marketMail();
      expect(
        /Вперёд/.test(await panelText()) && !/Покажи дорогу/.test(await panelText()),
        'письмо: кнопки',
        await panelText(),
      );
      await closeAll();
      let s = await starAt('market');
      expect(s.t && s.d < 10 && s.t.of === '🧺', 'звёздочка письма не у рынка', s);
      // подошла к воротам леса: задание Мяты появилось в списке, подсказка есть — а звёздочка осталась у письма
      await clearToasts();
      await ev(() => window.__dev.World.debugTeleport(3, 4));
      await L.until(() => window.__dev.QuestState.questNow('herbarium').status === 'ready', undefined, {
        timeout: 3000,
      });
      await wait(400);
      expect(/поговори с ней/.test(await toasts()), 'у ворот нет подсказки', await toasts());
      expect((await goal()) === 'mail', 'звёздочка ушла от письма сама', await goal());
      // задание жителя интереснее письма — в общем порядке оно раньше; но активный квест от этого не меняется
      expect((await list()).join() === 'quest:herbarium,mail', 'порядок квестов', await list());
      s = await starAt('market');
      expect(s.t && s.d < 10, 'звёздочка у ворот больше не ведёт к рынку', s);
      h = await hud();
      expect(/Базарный|🧺/.test(h.text) && h.more === '+1' && h.right <= h.vw + 1, 'плашка: письмо и «+1»', h);
      // журнал: один список — активный квест сверху с пометкой, у другого — «⭐ Веди меня»
      await openJournal();
      let c = await cards();
      expect(
        c.length === 2 && c[0].id === 'mail' && c[0].lead && !c[0].btn && c[1].id === 'quest:herbarium' && c[1].btn,
        'журнал: список квестов',
        c,
      );
      await page.click('.overlay .quest[data-goal="quest:herbarium"] .q-lead-btn');
      await untilPanel('Ореховая Гавань', 3000).catch(() => {}); // окно карты
      await closeAll();
      await noon();
      expect((await goal()) === 'quest:herbarium', 'после «⭐ Веди меня» активный квест', await goal());
      s = await starAt('npc:myata');
      expect(s.t && s.d < 60, 'звёздочка не у Мяты', s);
      h = await hud();
      expect(/Мята/.test(h.text) && h.more === '+1' && h.right <= h.vw + 1, 'плашка: Мята и «+1»', h);
      await openJournal();
      c = await cards();
      expect(c[0].id === 'quest:herbarium' && c[0].lead && c[1].id === 'mail' && c[1].btn, 'журнал после выбора', c);
      await closeAll();
      // выбор лежит в сохранении: после перезагрузки звёздочка там же
      const raw = await ev(() => {
        window.__dev.actions.touchState();
        return JSON.stringify(window.__dev.G.state);
      });
      expect(JSON.parse(raw).goal === 'quest:herbarium', 'в сохранении нет активного квеста', JSON.parse(raw).goal);
      await L.putSave(raw);
      await L.cont();
      await closeAll();
      expect((await goal()) === 'quest:herbarium', 'после перезагрузки активный квест', await goal());
      const log = await ev(() => window.__dev.goal.log());
      expect(!log.length, 'после перезагрузки квест «сменился»', log);
    },
  );

  await step(
    'квесты: новый квест спрашивает «⭐ Покажи дорогу!» / «Потом»; закончен — следующий по порядку; звёздочка свободна — не спрашивает',
    async () => {
      await L.fresh({ start: 'june', flags: { 'door:forest': 1 } });
      await ev(() => window.__dev.actions.nextDay());
      await noon();
      await marketMail();
      await closeAll();
      expect((await goal()) === 'mail', 'активный квест — не письмо', await goal());
      // Мята даёт задание: звёздочка занята письмом — спрашивает; «Потом» — звёздочка остаётся у письма
      await ev(() => {
        window.__dev.run('npc:myata');
      });
      await L.untilDialog();
      await page.click('.dialog .btn.green'); // «Помогу!»
      await L.untilDialog(1500).catch(() => {});
      const btns = await ev(() => [...document.querySelectorAll('.dialog .btn')].map((b) => b.textContent));
      expect(btns.join('|') === '⭐ Покажи дорогу!|Потом', 'кнопки нового квеста', btns);
      await page.click('.dialog .btn:not(.lead)'); // «Потом»
      await L.until(() => !document.querySelector('.dialog'), undefined, { timeout: 2000 }).catch(() => {});
      expect((await goal()) === 'mail', 'после «Потом» звёздочка ушла от письма', await goal());
      let s = await starAt('market');
      expect(s.t && s.d < 10, 'после «Потом» звёздочка не у рынка', s);
      // начатое задание — в начале списка; письмо дня — в конце
      expect((await list()).join() === 'quest:herbarium,mail', 'порядок: начатое задание, письмо', await list());
      // письмо сделано — активным сам становится следующий по порядку: гербарий
      await ev(() => {
        const d = window.__dev;
        d.actions.finishTask();
        d.emit('hud');
      });
      await wait(100);
      expect((await goal()) === 'quest:herbarium', 'письмо сделано — следующий квест', await goal());
      let log = await ev(() => window.__dev.goal.log());
      expect(log[log.length - 1].why === 'next' && log[log.length - 1].from === 'mail', 'запись о смене', log);
      // гербарий сдан, лес открыт — пять жителей с «!»: активным становится первый, остальные ждут в журнале
      await clearToasts();
      await ev(() => {
        const d = window.__dev;
        d.actions.finishQuest('herbarium');
        d.actions.openLand('forest');
        d.emit('hud');
      });
      await wait(100);
      const all = await list();
      expect(all.length >= 5 && all.every((id) => id.startsWith('quest:')), 'после леса — новые квесты', all);
      expect((await goal()) === all[0], 'активный — не первый по порядку', [await goal(), all]);
      const h = await hud();
      expect(h.more === '+' + (all.length - 1) && h.right <= h.vw + 1, 'счётчик остальных квестов', h);
      // утром о новых просьбах — одна подсказка, а не пять подряд
      await ev(() => window.__dev.emit('wake'));
      await L.drain(); // подсказка — из очереди окон
      await wait(200);
      const t = await toasts();
      expect(
        /новые просьбы \(\d\)/.test(t) && (t.match(/❗/g) || []).length === 1,
        'утром не одна подсказка о новых просьбах',
        t,
      );
      // звёздочка уже ведёт к Шишкину («!») — он даёт задание и НЕ спрашивает: квест тот же, кнопка «Хорошо!»
      await ev(() => window.__dev.goal.set('squirrel_kit'));
      await ev(() => {
        const d = window.__dev;
        d.actions.mutate((s) => {
          s.minutes = 12 * 60;
        });
        d.go('forest');
      });
      await untilScene('forest');
      await closeAll();
      const far = await ev(() => {
        const sc = window.__dev.locations.forest,
          t = sc.target(),
          n = sc.npcs.find((q) => q.id === 'shishkin');
        return t && n ? Math.hypot(t.x - n.x, t.y + 62 - n.y) : -1;
      });
      expect(far >= 0 && far < 80, 'звёздочка в лесу не у Шишкина', far);
      await ev(() => {
        window.__dev.run('forester');
      });
      await L.untilDialog();
      await page.click('.dialog .btn.green');
      await L.untilDialog(1500).catch(() => {});
      const b2 = await ev(() => [...document.querySelectorAll('.dialog .btn')].map((b) => b.textContent));
      expect(b2[0] === 'Хорошо!' && !b2.some((x) => /Покажи дорогу/.test(x)), 'звёздочка свободна, а спросили', b2);
      await page.click('.dialog .btn.green');
      await L.until(() => !document.querySelector('.dialog'), undefined, { timeout: 2000 }).catch(() => {});
      expect((await goal()) === 'quest:squirrel_kit', 'взятое задание — не активный квест', await goal());
      log = await ev(() => window.__dev.goal.log());
      expect(
        log.every((x) => x.why !== 'next' || x.from === null || ['mail', 'quest:herbarium'].includes(x.from)),
        'квест менялся сам, хотя прежний не закончен',
        log,
      );
    },
  );

  await step(
    'квесты: утро праздника спрашивает «⭐ Покажи дорогу!»; вводное задание от соседа — тоже; сторож ловит самовольную смену',
    async () => {
      await L.fresh({ start: 'june' });
      await marketMail();
      await closeAll();
      // утро праздника: письмо — активный квест, окно праздника спрашивает; «⭐ Покажи дорогу!» — звёздочка к празднику
      await ev(() => {
        const d = window.__dev;
        d.holiday.to('newyear', 'day', 1, 600);
        d.go('world');
        d.F.announceHoliday();
      });
      await untilPanel('Новый год', 4000);
      expect(/Покажи дорогу/.test(await panelText()) && /Потом/.test(await panelText()), 'окно праздника: кнопки', await panelText());
      expect((await goal()) === 'mail', 'праздник забрал звёздочку сам', await goal());
      expect((await list()).join() === 'holiday,mail', 'порядок: праздник раньше письма', await list());
      await page.click('.overlay .btn.lead');
      await wait(300);
      await closeAll();
      expect((await goal()) === 'holiday', 'после «⭐ Покажи дорогу!» активный квест', await goal());
      expect(/Звёздочка ведёт/.test(await toasts()), 'нет подсказки «Звёздочка ведёт»', await toasts());
      expect(await ev(() => !!window.__dev.World.target()), 'звёздочки праздника нет');
      // сторож: смена «сама» при живом квесте и запись мимо действия — нарушения (их ловит каждый шаг автотеста)
      await ev(() => window.__dev.goal.jumps());
      await ev(() => window.__dev.actions.setGoal('mail', 'next'));
      let j = await ev(() => window.__dev.goal.jumps());
      expect(j.length === 1 && /сам/.test(j[0]), 'сторож не заметил самовольную смену', j);
      await ev(() => {
        window.__dev.actions.mutate((s) => {
          s.goal = 'holiday';
        });
        window.__dev.goal.now();
      });
      j = await ev(() => window.__dev.goal.jumps());
      expect(j.length === 1 && /мимо действия/.test(j[0]), 'сторож не заметил запись мимо действия', j);
      // честные смены — не нарушения
      await ev(() => window.__dev.goal.set('mail'));
      expect(!(await ev(() => window.__dev.goal.jumps())).length, 'сторож ругается на выбор игрока');
      // вводная цепочка: первый сосед приходит, когда звёздочка у письма, — и спрашивает
      await L.fresh({ start: 'intro', villa: 'small' });
      expect((await goal()) === 'mail', 'новая игра: активный квест — не письмо', await goal());
      await L.until(() => !!window.__dev.F.debugWelcome().visit, undefined, { timeout: 8000 });
      await L.untilDialog(40000);
      await page.click('.dialog .btn.green'); // «Спасибо!»
      let asked = false;
      for (let i = 0; i < 6 && !asked; i++) {
        await L.untilDialog(2500).catch(() => {});
        const b = await ev(() => [...document.querySelectorAll('.dialog .btn')].map((q) => q.textContent));
        if (b.some((x) => /Покажи дорогу/.test(x))) asked = true;
        else if (b.length) await page.click('.dialog .btn.green');
        else break;
      }
      expect(asked, 'сосед не спросил «⭐ Покажи дорогу!»');
      expect((await goal()) === 'mail', 'вводное задание забрало звёздочку само', await goal());
      await page.click('.dialog .btn.lead');
      await L.until(() => !document.querySelector('.dialog'), undefined, { timeout: 2000 }).catch(() => {});
      expect((await goal()) === 'quest:intro_home', 'после «⭐ Покажи дорогу!» — не вводное задание', await goal());
    },
  );
};
