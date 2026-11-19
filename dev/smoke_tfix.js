// Шаги автотеста мелких исправлений «Замечено в третьем обновлении» (BACKLOG, Т-пункты) и ревью, где меняется поведение:
//   Т7 — звёздочка писем «Беги, хомячок» и «Маленький концерт» ведёт в дом, где стоит колесо / пианино (и в лесу —
//   к двери лесного домика);
//   Т2 — холл Хомяк-Тауэра вечером темнеет (свет ламп), к празднику украшен;
//   repair (ревью Б4) — имя хомячка, питомца и название заведения обрезаются до длины поля ввода на любом пути;
//   подсказки не ложатся на окно «Игра открыта дважды» (оно важнее);
//   кораблик, который плывёт сам (кнопка места на карте), не подсказывает «Нажимай на воду»;
//   «Мой двор»: точки свободных клеток — из запомненного списка, он обновляется, когда предмет поставили;
//   вагонетка в пещерах стоит на полу, рельсы начинаются рядом с ней;
//   Т8 — на iPad лёжа вилла видна целиком, отель — все этажи по высоте (а не масштаб 1,05, как на телефоне);
//   на компьютере отель — тоже все этажи по высоте (Т8б), остальные дома как были.
// Подключается из dev/smoke.js. Только эти шаги:  node dev/smoke.js <url> "step:исправления"
const lib = require('./lib.js');

module.exports = async function tfix(ctx) {
  const {
    page,
    step,
    ev,
    wait,
    closeAll,
    expect,
    fresh: newGame,
    frames,
    go,
    until,
    teleport,
    toasts,
    toPlace,
    putSave,
    cont,
  } = lib(ctx);
  const fresh = () => newGame({ day: 18, minutes: 12 * 60, weather: 'sun', dayFlags: true }); // июль, полдень

  await step(
    'исправления Т7: колесо и пианино в квартире — письмо и звёздочка ведут в квартиру, а не к вилле',
    async () => {
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
              s.homes.flat = [
                ...(s.homes.flat || []).filter((i) => i.id !== thing),
                { uid: 90000 + thing.length, id: thing, floor: 0, x: 300, y: 0 },
              ];
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
    },
  );

  await step(
    'исправления: колесо и пианино в лесном домике — в лесу звёздочка у двери домика, в городе — к дороге в лес',
    async () => {
      await fresh();
      await toPlace('forest');
      await closeAll();
      for (const [task, thing] of [
        ['wheel', 'wheel'],
        ['piano', 'piano'],
      ]) {
        const r = await ev(
          ([task, thing]) => {
            const d = window.__dev;
            d.actions.mutate((s) => {
              if (!s.homesOwned.includes('cabin')) s.homesOwned.push('cabin');
              s.villa = s.villa.filter((i) => i.id !== thing);
              for (const h of Object.keys(s.homes)) s.homes[h] = s.homes[h].filter((i) => i.id !== thing);
              s.homes.cabin = [
                ...(s.homes.cabin || []),
                { uid: 91000 + thing.length, id: thing, floor: 0, x: 200, y: 0 },
              ];
            });
            d.actions.setMail(task);
            d.actions.readMail();
            const f = d.locations.forest,
              door = f.map.doorPx(f.map.bById.cabin);
            return { scene: d.sceneName, t: f.target(), door, town: d.World.target() };
          },
          [task, thing],
        );
        expect(r.scene === 'forest', 'не в лесу (проверка не годится)', r);
        expect(
          !!r.t && Math.hypot(r.t.x - r.door.x, r.t.y - (r.door.y - 48)) < 10,
          `«${task}»: в лесу звёздочка не у двери домика`,
          r,
        );
        expect(!!r.town && r.town.next === 'forest', `«${task}»: в городе звёздочка не к дороге в лес`, r);
      }
      // колесо только на вилле: в лесу звёздочка ведёт к дороге в город
      const r = await ev(() => {
        const d = window.__dev;
        d.actions.mutate((s) => {
          s.homes.cabin = s.homes.cabin.filter((i) => i.id !== 'wheel');
          s.villa = [...s.villa, { uid: 91100, id: 'wheel', floor: 0, x: 300, y: 0 }];
        });
        d.actions.setMail('wheel');
        d.actions.readMail();
        return d.locations.forest.target();
      });
      expect(!!r && r.next === 'world', 'колесо на вилле: в лесу звёздочка не к дороге в город', r);
    },
  );

  await step(
    'исправления Т8: на iPad лёжа вилла видна целиком, в отеле (и на компьютере) — все этажи, камера видит хомячка',
    async () => {
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
        // компьютер 16:9 и 16:10 (Т8б): отель — все этажи по высоте, видно больше 3/4 ширины (было 1,05 и 57 %), хомячок
        // на экране; вилла — как была (целиком); телефон лёжа — как был (0,83)
        for (const [w, h, id, want] of [
          [1280, 720, 'hotel', 'floors'],
          [1366, 768, 'hotel', 'floors'],
          [1280, 800, 'hotel', 'floors'],
          [1280, 720, 'villa', 0.68],
          [1920, 1080, 'villa', 1.02],
          [844, 390, 'hotel', 0.83],
        ]) {
          await page.setViewportSize({ width: w, height: h });
          await wait(300);
          await ev((id) => window.__dev.go(id, { pos: { scene: id, floor: 1, x: 600 } }), id);
          await wait(700);
          const r = await ev(() => {
            const s = window.__dev.scene,
              v = s.cam.visible(0),
              q = s.cam.toScreen(s.p.x, s.geo.fy(s.p.f) - 60),
              top = s.cam.toScreen(0, s.geo.fy(s.geo.floors - 1) - s.geo.FH),
              bot = s.cam.toScreen(0, s.geo.fy(0));
            return {
              name: s.name,
              z: +s.cam.zoom.toFixed(2),
              part: (v.x1 - v.x0) / s.geo.WTOT,
              hx: q.x,
              top: top.y,
              bot: bot.y,
              w: innerWidth,
              h: innerHeight,
            };
          });
          const tag = `${w}×${h} ${id}`;
          expect(r.name === id, `${tag}: не та сцена (проверка не годится)`, r);
          if (want === 'floors') {
            expect(r.z < 0.8 && r.part > 0.75 && r.part < 1, `${tag}: отель на компьютере не «все этажи по высоте»`, r);
            expect(r.top >= -4 && r.bot <= r.h + 4, `${tag}: видны не все этажи`, r);
            expect(r.hx > 60 && r.hx < r.w - 60, `${tag}: хомячок не на экране`, r);
          } else expect(r.z === want, `${tag}: масштаб изменился`, r);
        }
      } finally {
        await page.setViewportSize(size);
        await wait(300);
      }
    },
  );

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

  await step(
    'исправления repair: длинные имя хомячка, питомца и название заведения обрезаются, пустые — по умолчанию',
    async () => {
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
    },
  );

  await step(
    'исправления: подсказки не ложатся на окно «Игра открыта дважды», после обычного окна — снова видны',
    async () => {
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
    },
  );

  await step('исправления: кнопка «Джунгли» на карте сажает в кораблик без подсказки «Нажимай на воду»', async () => {
    await fresh();
    await ev(() => {
      const d = window.__dev;
      if (!d.QuestState.landOpen('jungle')) d.actions.openLand('jungle');
    });
    await go('world');
    await closeAll();
    await teleport(63, 55);
    await page.click('#hud button:has-text("Карта")');
    await page.waitForSelector('.overlay .lands-row button', { timeout: 4000 });
    await ev(() =>
      [...document.querySelectorAll('.overlay .lands-row button')]
        .find((q) => q.textContent.includes('Джунгли'))
        .click(),
    );
    await until(() => window.__dev.World.isBoating(), undefined, { timeout: 15000, msg: 'не села в кораблик' });
    await wait(300);
    const r = await ev(() => ({ flag: !!window.__dev.G.state.flags.boatHint }));
    const t = await toasts();
    expect(!/Нажимай на воду/.test(t) && !r.flag, 'кораблик плывёт сам, а подсказка «Нажимай на воду» есть', { t, r });
  });

  await step(
    'исправления: «Мой двор» — свободные клетки запомнены и верны до и после того, как поставили предмет',
    async () => {
      await fresh();
      await ev(() => {
        const d = window.__dev;
        d.actions.addYardItem('y_bench');
      });
      await go('world');
      await closeAll();
      await teleport(18, 12);
      await page.click('#hud button:has-text("Мой двор")');
      await until(() => window.__dev.F.yardDebug().mode === 'villa' && document.querySelector('.yard-tray .tray-item'));
      await frames(2);
      const a = await ev(() => window.__dev.F.yardDebug());
      expect(a.free > 10 && a.freeFresh, 'свободные клетки двора до', a);
      await page.click('.yard-tray .tray-item.yard-y_bench');
      await until(() => (window.__dev.state.yard.at.villa || []).length === 1);
      await frames(2);
      const b = await ev(() => window.__dev.F.yardDebug());
      expect(
        b.free < a.free && b.freeFresh,
        'после того, как поставили скамейку, список свободных клеток не обновился',
        { a, b },
      );
    },
  );

  await step('исправления: вагонетка в пещерах — на полу, рельсы от неё вправо', async () => {
    await fresh();
    await toPlace('caves');
    const r = await ev(() => {
      const m = window.__dev.locations.caves.map,
        cart = m.objs.find((o) => o.type === 'minecart'),
        rails = m.objs.filter((o) => o.type === 'rails' && o.ty === cart.ty).map((o) => o.tx);
      return { x: cart.tx, y: cart.ty, under: m.at(cart.tx, cart.ty), rails };
    });
    expect(r.under === 'caveFloor', 'вагонетка стоит не на полу', r);
    expect(r.rails.length >= 3 && r.rails.includes(r.x + 1), 'рельсы не начинаются у вагонетки', r);
  });

  await step(
    'исправления: старое сохранение, где хомячок стоит на клетке вагонетки, — встаёт рядом и ходит',
    async () => {
      await fresh();
      await toPlace('caves');
      await closeAll();
      await ev(() => window.dispatchEvent(new Event('pagehide')));
      const raw = await ev(() => {
        const m = window.__dev.locations.caves.map,
          cart = m.objs.find((o) => o.type === 'minecart'),
          s = JSON.parse(localStorage.getItem('rhr-save-v1'));
        s.pos = { scene: 'caves', x: (cart.tx + 0.5) * 48, y: (cart.ty + 0.5) * 48 }; // как в старом сохранении: там, где теперь вагонетка
        return JSON.stringify(s);
      });
      await putSave(raw);
      await cont();
      await closeAll();
      const a = await ev(() => {
        const d = window.__dev,
          c = d.locations.caves,
          cart = c.map.objs.find((o) => o.type === 'minecart'),
          p = c.p,
          tx = Math.floor(p.x / 48),
          ty = Math.floor(p.y / 48);
        return {
          scene: d.sceneName,
          tx,
          ty,
          cart: [cart.tx, cart.ty],
          ok: c.pass()(tx, ty),
          solid: !c.pass()(cart.tx, cart.ty),
        };
      });
      expect(
        a.scene === 'caves' && a.solid,
        'загрузилась не в пещерах или вагонетка проходима (проверка не годится)',
        a,
      );
      expect(
        a.ok &&
          (a.tx !== a.cart[0] || a.ty !== a.cart[1]) &&
          Math.abs(a.tx - a.cart[0]) + Math.abs(a.ty - a.cart[1]) <= 3,
        'хомячок не встал рядом с вагонеткой',
        a,
      );
      // и уходит оттуда: к входу в пещеры есть дорога
      const ok = await ev(() => {
        const c = window.__dev.locations.caves,
          p = c.p;
        window.__libFrom = { x: p.x, y: p.y };
        return c.walkTo(p.x, p.y + 4 * 48) || c.walkTo(p.x - 4 * 48, p.y) || c.walkTo(p.x + 4 * 48, p.y);
      });
      expect(ok, 'от вагонетки хомячку некуда идти');
      await until(
        () => {
          const p = window.__dev.locations.caves.p;
          return Math.hypot(p.x - window.__libFrom.x, p.y - window.__libFrom.y) > 60;
        },
        undefined,
        'хомячок не сдвинулся с места у вагонетки',
      );
    },
  );
};
