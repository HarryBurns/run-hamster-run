// Шаги автотеста мелких исправлений «Замечено в третьем обновлении» (BACKLOG, Т-пункты) и ревью, где меняется поведение:
//   Т7 — звёздочка писем «Беги, хомячок» и «Маленький концерт» ведёт в дом, где стоит колесо / пианино;
//   Т2 — холл Хомяк-Тауэра вечером темнеет (свет ламп), к празднику украшен;
//   repair (ревью Б4) — имя хомячка, питомца и название заведения обрезаются до длины поля ввода на любом пути;
//   подсказки не ложатся на окно «Игра открыта дважды» (оно важнее);
//   Т8 — на iPad лёжа вилла видна целиком, отель — все этажи по высоте (а не масштаб 1,05, как на телефоне).
// Подключается из dev/smoke.js. Только эти шаги:  node dev/smoke.js <url> "step:исправления"
const lib = require('./lib.js');

module.exports = async function tfix(ctx) {
  const { page, step, ev, wait, closeAll, expect, fresh: newGame, frames, go, until } = lib(ctx);
  const fresh = () => newGame({ day: 18, minutes: 12 * 60, weather: 'sun', dayFlags: true }); // июль, полдень

  await step('исправления Т7: колесо и пианино в квартире — письмо и звёздочка ведут в квартиру, а не к вилле', async () => {
    await fresh();
    await go('world');
    await closeAll();
    for (const [task, thing] of [
      ['wheel', 'wheel'],
      ['piano', 'piano'],
    ]) {
      const r = await ev(
        ([task, thing]) => {
          const d = window.__dev;
          d.actions.mutate((s) => {
            if (!s.homesOwned.includes('flat')) s.homesOwned.push('flat');
            s.villa = s.villa.filter((i) => i.id !== thing);
            s.homes.flat = [...(s.homes.flat || []).filter((i) => i.id !== thing), { uid: 90000 + thing.length, id: thing, floor: 0, x: 300, y: 0 }];
          });
          d.actions.setMail(task);
          d.actions.readMail();
          const W = d.World,
            t = W.target(),
            flat = W.doorOf('home_apartment'),
            villa = W.doorOf('villa');
          return { t, flat, villa };
        },
        [task, thing],
      );
      expect(!!r.t, `«${task}»: звёздочки нет`, r);
      const dist = (a, b) => Math.hypot(a.x - b.x, a.y - (b.y - 48));
      expect(dist(r.t, r.flat) < 10, `«${task}»: звёздочка не у двери квартиры`, r);
      expect(dist(r.t, r.villa) > 100, `«${task}»: звёздочка всё ещё у виллы`, r);
    }
    // в письме — «Куда идти: Квартира в городе»
    await ev(() => window.__dev.run('mailbox'));
    await frames(2);
    const txt = await ev(() => (document.querySelector('.letter') || {}).textContent || '');
    expect(/Квартира/.test(txt) && !/Куда идти: Вилла/.test(txt), 'в письме «Куда идти» — не квартира', txt);
    await closeAll();
  });

  await step('исправления Т8: на iPad лёжа вилла видна целиком, в отеле — все этажи, камера видит хомячка', async () => {
    const size = page.viewportSize();
    await fresh();
    try {
      for (const [w, h] of [
        [1024, 768],
        [1180, 820],
      ]) {
        await page.setViewportSize({ width: w, height: h });
        await wait(300);
        for (const id of ['villa', 'hotel']) {
          await ev((id) => {
            const d = window.__dev,
              W = d.scenes[id].geo.W;
            d.go(id, { pos: { scene: id, floor: 2, x: W - 60 } });
          }, id);
          await wait(900);
          const r = await ev(() => {
            const s = window.__dev.scene,
              v = s.cam.visible(0),
              p = s.p,
              q = s.cam.toScreen(p.x, s.geo.fy(p.f) - 60),
              top = s.cam.toScreen(0, s.geo.fy(s.geo.floors - 1) - s.geo.FH),
              bot = s.cam.toScreen(0, s.geo.fy(0)),
              vw = window.__dev.G.view;
            return {
              name: s.name,
              z: +s.cam.zoom.toFixed(3),
              x0: Math.round(v.x0),
              x1: Math.round(v.x1),
              W: s.geo.WTOT,
              hx: Math.round(q.x),
              hy: Math.round(q.y),
              top: Math.round(top.y),
              bot: Math.round(bot.y),
              w: vw.w,
              h: vw.h,
            };
          });
          const tag = `${w}×${h} ${id}`;
          expect(r.name === id, `${tag}: не та сцена (проверка не годится)`, r);
          expect(r.hx > 60 && r.hx < r.w - 60 && r.hy > 60 && r.hy < r.h - 60, `${tag}: хомячок не на экране`, r);
          expect(r.top >= -4 && r.bot <= r.h + 4, `${tag}: видны не все этажи`, r);
          if (id === 'villa') expect(r.x0 <= 0 && r.x1 >= r.W, `${tag}: вилла видна не целиком`, r);
          else expect(r.z < 0.85 && r.x1 - r.x0 > r.W * 0.6, `${tag}: отель крупный, как на телефоне`, r);
        }
      }
      // компьютер 16:9 — как было: отель крупно (1,05), камера следит
      await page.setViewportSize({ width: 1280, height: 720 });
      await wait(300);
      await ev(() => window.__dev.go('hotel', { pos: { scene: 'hotel', floor: 1, x: 600 } }));
      await wait(600);
      const z = await ev(() => +window.__dev.scene.cam.zoom.toFixed(2));
      expect(z === 1.05, 'на компьютере масштаб отеля изменился', z);
    } finally {
      await page.setViewportSize(size);
      await wait(300);
    }
  });

  await step('исправления Т2: холл Хомяк-Тауэра ночью темнее, чем днём, а в канун Рождества украшен', async () => {
    await fresh();
    // яркость стены холла (средняя по полосе над диваном и стойкой) в полдень и в 23:00
    const wall = async (minutes) => {
      await ev((m) => {
        const d = window.__dev;
        d.actions.mutate((s) => (s.minutes = m));
        if (d.sceneName !== 'world') d.go('world');
      }, minutes);
      await frames(2);
      await ev(() => window.__dev.enterBuilding('tower'));
      await until(() => window.__dev.sceneName === 'tower');
      await closeAll();
      await ev(() => window.__dev.Tower.debugAt(560));
      await frames(3);
      return ev(() => {
        const T = window.__dev.Tower.debugState(),
          c = document.getElementById('game'),
          x = c.getContext('2d'),
          y = Math.round(c.height * 0.45),
          px = x.getImageData(0, y, c.width, 1).data;
        let sum = 0;
        for (let i = 0; i < px.length; i += 4) sum += px[i] + px[i + 1] + px[i + 2];
        return { light: Math.round(sum / (px.length / 4) / 3), level: T.level, decor: T.hallDecor };
      });
    };
    const day = await wall(12 * 60),
      night = await wall(23 * 60);
    expect(day.level === 'lobby' && night.level === 'lobby', 'не в холле (проверка не годится)', [day, night]);
    expect(night.light < day.light - 25, 'ночью в холле так же светло, как днём', [day, night]);
    await ev(() => window.__dev.holiday.to('xmas', 'eve'));
    await closeAll();
    const xmas = await wall(20 * 60);
    expect(['newyear', 'xmas'].includes(xmas.decor), 'в канун Рождества холл не украшен', xmas); // ёлка Нового года стоит и в Рождество
  });

  await step('исправления repair: длинные имя хомячка, питомца и название заведения обрезаются, пустые — по умолчанию', async () => {
    await fresh();
    const r = await ev(async () => {
      const st = await import('/js/core/state.js'),
        D = await import('/js/data/index.js');
      const s = JSON.parse(JSON.stringify(window.__dev.G.state));
      s.name = '  Очень-очень-длинное имя хомячка  ';
      s.pet = { kind: D.PETS[0].id, name: 'Пушистик-Разбойник-Второй', love: 0, food: 0 };
      s.biz = { cafe: { day: 0, till: 0, total: 0, last: 0, title: 'Самое лучшее кафе на всём белом свете' } };
      st.repair(s);
      const e = JSON.parse(JSON.stringify(window.__dev.G.state));
      e.name = '   ';
      e.pet = { kind: D.PETS[0].id, name: 42 };
      e.biz = { cafe: { day: 0, till: 0, total: 0, last: 0, title: '  ' } };
      st.repair(e);
      return {
        name: s.name,
        pet: s.pet.name,
        biz: s.biz.cafe.title,
        max: [D.NAME_MAX, D.PET.nameMax, D.BIZ_TITLE_MAX],
        empty: [e.name, e.pet.name, 'title' in e.biz.cafe],
      };
    });
    expect(r.name === 'Очень-очень-дл' && r.name.length === r.max[0], 'имя хомячка', r);
    expect(r.pet.length === r.max[1], 'имя питомца', r);
    expect(r.biz.length === r.max[2], 'название заведения', r);
    expect(r.empty[0] === 'Хомка' && r.empty[1] && !r.empty[2], 'пустые имена', r);
  });

  await step('исправления: подсказки не ложатся на окно «Игра открыта дважды», после обычного окна — снова видны', async () => {
    await fresh();
    const seen = () =>
      ev(() => {
        const b = document.getElementById('toasts');
        return !!b && getComputedStyle(b).visibility !== 'hidden' && !!b.querySelector('.toast');
      });
    await ev(() => window.__dev.emit('saveLost', { why: 'tab' }));
    await until(() => [...document.querySelectorAll('.panel-head')].some((h) => h.textContent.includes('дважды')));
    await ev(() => window.__dev.ui.toast('🎹 Подсказка поверх окна'));
    expect(!(await seen()), 'подсказка видна поверх окна «Игра открыта дважды»');
    // окно закрыли («Играть здесь» перезагружает страницу): подсказки снова видны поверх обычных окон
    await page.click('[data-act="ok"]');
    await page.waitForSelector('[data-act="continue"], [data-act="play"]', { timeout: 8000 });
    await fresh();
    await ev(() => {
      window.__dev.ui.message({ title: 'Обычное окно', html: '<p>Текст</p>' });
      window.__dev.ui.toast('Подсказка');
    });
    expect(await seen(), 'над обычным окном подсказок не видно');
    await closeAll();
  });
};
