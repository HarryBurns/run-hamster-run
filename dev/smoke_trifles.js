// Шаги автотеста «Мелочи» (пачка 20 ноября): полезный компас (О5) — стрелка к цели задания журнала, к дороге
// в другое место, на кораблике без цели — на юг, к острову, без цели — на север; салют с башни и в подзорную
// трубу с тихими хлопками (В4); ледяная горка у катка на Новый год (В4).
// Подключается из dev/smoke.js. Только эти шаги:  node dev/smoke.js <url> step:мелочи
const lib = require('./lib.js');

module.exports = async function trifles(ctx) {
  const L = lib(ctx);
  const { step, ev, wait, closeAll, norm, expect, untilPanel, frames } = L;
  const ALL = ['forest', 'mountain', 'caves', 'desert', 'jungle', 'cove', 'island'];
  /** Полдень тёплого дня, места открыты, компас в рюкзаке. */
  const setup = () =>
    ev((ids) => {
      const d = window.__dev;
      for (const id of ids) if (!d.QuestState.landOpen(id)) d.actions.openLand(id);
      d.actions.mutate((s) => {
        s.day = 18;
        s.minutes = 12 * 60;
        s.weather = 'sun';
        s.dayFlags = {};
        if (s.mail) s.mail.read = s.mail.done = true; // письмо дня сделано — звёздочка ему не нужна
      });
      d.actions.addItem('finds', 'compass', 1);
    }, ALL);
  /** Нажать на компас в рюкзаке: что сказал компас, и куда должна смотреть стрелка (сторона света от хомячка к звёздочке). */
  const compass = async () => {
    await closeAll();
    await ev(() => {
      window.__dev.F.openBackpack();
    });
    await untilPanel();
    await ev(() =>
      [...document.querySelectorAll('.overlay .tabs button')].find((b) => /Находки/.test(b.textContent)).click(),
    );
    await frames(2);
    expect(await ev(() => !!document.querySelector('.overlay .compass-card')), 'компас в рюкзаке не нажимается');
    await ev(() => document.querySelector('.overlay .compass-card').click());
    await L.until(() => !!document.querySelector('.overlay .compass-text'));
    const r = await ev(() => {
      const d = window.__dev,
        loc = d.locations[d.sceneName] || d.locations.world,
        tg = loc.target(),
        p = loc.p;
      const sides = [
        'севере',
        'северо-востоке',
        'востоке',
        'юго-востоке',
        'юге',
        'юго-западе',
        'западе',
        'северо-западе',
      ];
      const side = tg ? sides[(Math.round(Math.atan2(tg.x - p.x, -(tg.y - p.y)) / (Math.PI / 4)) + 8) % 8] : null;
      return { text: document.querySelector('.overlay .compass-text').textContent, side };
    });
    r.text = norm(r.text);
    await closeAll();
    return r;
  };

  await step(
    'мелочи: компас в рюкзаке — к цели задания, к дороге в другое место, на кораблике — на юг, без цели — на север',
    async () => {
      await L.fresh();
      await setup();
      await L.go('world');
      // заданий нет — компас смотрит на север
      let r = await compass();
      expect(/смотрит на север/.test(r.text), 'без задания — не «на север»', r);
      // задание на горе: из города — к тропе в лес («сначала»), сторона — та, где звёздочка
      await ev(() => {
        window.__dev.actions.takeQuest('lost_mitten');
      });
      r = await compass();
      expect(
        /Цель — в горах/.test(r.text) &&
          /сначала по тропе в лес/.test(r.text) &&
          r.side &&
          r.text.includes('на ' + r.side),
        'задание на горе из города',
        r,
      );
      expect((await ev(() => window.__dev.F.starScene())) === 'mountain', 'компас не показал задание звёздочкой');
      // на горе: к самой варежке; хомячок к западу от неё — «на востоке», к востоку — «на западе»
      await L.go('mountain');
      const at = await ev(() => {
        const sc = window.__dev.locations.mountain,
          tg = sc.target();
        return { tx: Math.floor(tg.x / 48), ty: Math.floor(tg.y / 48), w: sc.map ? sc.map.w : 0 };
      });
      let ok = false;
      for (const dx of [-6, -7, -8, -5, -9, -4]) {
        const moved = await ev(
          ([x, y]) => {
            const sc = window.__dev.locations.mountain;
            sc.debugTeleport(x, y);
            return Math.floor(sc.p.x / 48) === x && Math.floor(sc.p.y / 48) === y;
          },
          [at.tx + dx, at.ty],
        );
        if (!moved) continue;
        await wait(60);
        r = await compass();
        expect(/в горах/.test(r.text) && r.text.includes('на ' + r.side), 'на горе — сторона к варежке', r);
        ok = true;
        break;
      }
      expect(ok, 'на горе не нашлось клетки западнее варежки', at);
      // на кораблике без задания — на юг, к острову
      await L.fresh();
      await setup();
      await L.go('world');
      await ev(() => {
        const d = window.__dev;
        d.actions.patchState('boat', { x: 66 * 48, y: 95 * 48, on: true });
        d.go('world', { pos: { scene: 'world', x: 66 * 48, y: 95 * 48 } });
      });
      await wait(200);
      expect(await ev(() => window.__dev.World.isBoating()), 'хомячок не на кораблике');
      r = await compass();
      expect(/на юг — к острову/.test(r.text), 'на кораблике без цели — не «на юг»', r);
    },
  );

  /** Праздник id: день его, minutes, перейти в scene. */
  const toHoliday = async (id, minutes, scene) => {
    await closeAll();
    await ev(
      ([id, minutes, scene]) => {
        const d = window.__dev;
        d.holiday.to(id, 'day', 1, minutes);
        d.go(scene);
      },
      [id, minutes, scene],
    );
    await wait(500);
    await closeAll();
  };
  const booms = () => ev(() => window.__dev.Audio.debugHeard().filter((n) => n === 'boomFar').length);

  await step(
    'мелочи: салют с площадки Хомяк-Тауэра и в подзорную трубу — с тихими хлопками, днём — тишина',
    async () => {
      await L.fresh();
      await toHoliday('newyear', 21 * 60 + 30, 'tower');
      await ev(() => window.__dev.Tower.debugDeck());
      let b0 = await booms();
      await wait(3500); // залпы — по 0,42 в секунду у каждого из четырёх
      expect((await booms()) > b0, 'на площадке салют без хлопков');
      // подзорная труба «город»: картинка живая, хлопки идут и при открытом окне (мир на паузе)
      await ev(() => {
        window.__dev.run('panorama');
      });
      await untilPanel();
      b0 = await booms();
      await wait(3500);
      expect((await booms()) > b0, 'в подзорной трубе салют без хлопков');
      await closeAll();
      // днём салюта нет — и хлопков нет
      await toHoliday('newyear', 12 * 60, 'tower');
      await ev(() => window.__dev.Tower.debugDeck());
      b0 = await booms();
      await wait(2500);
      expect((await booms()) === b0, 'днём на площадке хлопает салют');
    },
  );

  await step('мелочи: ледяная горка у катка на Новый год — хомячок съезжает и встаёт внизу', async () => {
    await L.fresh();
    await toHoliday('newyear', 12 * 60, 'world');
    const W = await ev(() => {
      const d = window.__dev,
        m = d.World.map;
      return { free: m.foot(52, 34), blocked: !m.foot(51, 33) };
    });
    expect(W.free && W.blocked, 'горка: клетки под ней и место внизу', W);
    await ev(() => window.__dev.locations.world.debugTeleport(52, 36));
    await frames(3);
    // нажать на горку на экране
    const p = await ev(() => window.__dev.World.debugScreen(51.5 * 48, 33.5 * 48 - 30));
    await L.page.mouse.click(p.x, p.y);
    let r = null;
    const t0 = Date.now();
    while (Date.now() - t0 < 6000) {
      r = await ev(() => window.__dev.F.relaxNow());
      if (r && r.type === 'iceSlide') break;
      await wait(120);
    }
    expect(r && r.type === 'iceSlide' && r.how === 'slide', 'с ледяной горки не съехала', r);
    await L.until(() => window.__dev.F.relaxNow() === null, undefined, { timeout: 4000 });
    const s = await L.state();
    const at = await ev(() => {
      const q = window.__dev.World.p;
      return { tx: Math.floor(q.x / 48), ty: Math.floor(q.y / 48), ride: !!q.ride };
    });
    expect(at.tx === 52 && at.ty === 34 && !at.ride, 'внизу горки хомячок стоит не там', at);
    expect((s.dayFlags.holiday || {}).iceSlide === 1, 'первая горка за день не отмечена', s.dayFlags);
    // в обычный день горки нет
    await toHoliday('mayday', 12 * 60, 'world');
    expect(await ev(() => window.__dev.World.map.foot(51, 33)), 'горка осталась после Нового года');
  });

  await step('мелочи: садовник зимой — в оранжерее; спасатель и волейбол на телефоне стоя — крупнее', async () => {
    const play = async (id, set) => {
      await L.fresh(set ? { set } : {});
      await ev((id) => {
        window.__dev.run('minigame:' + id); // не ждём: обещание игры исполнится, только когда её закроют
      }, id);
      await L.mgGo();
      await wait(300);
    };
    const phone = await ev(() => innerWidth < 560 && innerHeight > innerWidth * 1.25);
    // садовник: зимой (январь) — оранжерея, летом — парк
    await play('gardener', 's.day = 1;');
    expect(await ev(() => document.querySelector('#mg .gd-canvas').__garden().winter), 'зимой садовник не в оранжерее');
    await L.mgClose();
    await play('gardener');
    expect(!(await ev(() => document.querySelector('#mg .gd-canvas').__garden().winter)), 'летом садовник в оранжерее');
    await L.mgClose();
    // спасатель: на телефоне стоя мир уже и выше — всё крупнее
    await play('lifeguard');
    const g = await ev(() => document.querySelector('#mg .lg-canvas').__guard().view);
    expect(phone ? g.W === 280 && g.k > 1.25 : g.W === 400, 'спасатель: размер мира', g);
    await L.mgClose();
    // волейбол: на телефоне стоя — половина корта во всю ширину, камера у нашей стороны
    await play('volley');
    const v = await ev(() => document.querySelector('#mg .vb-canvas').__volley());
    expect(phone ? v.k > 0.8 && v.cam === 0 : v.cam === null, 'волейбол: масштаб и камера', v);
    await L.mgClose();
    await closeAll();
  });

  await step(
    'мелочи: у блюд и вещей нет одинаковых значков; еловая веточка и новые блюда — рисованные (В10)',
    async () => {
      const r = await ev(async () => {
        const D = await import('/js/data/index.js'),
          A = await import('/js/art/items.js');
        const by = {};
        for (const x of [...D.DISHES, ...D.INGREDIENTS, ...D.FINDS])
          if (x.id !== 'herb_cone') (by[x.e] = by[x.e] || []).push(x.id); // еловая шишка гербария — та же шишка
        const ids = ['pineapple_pizza', 'gingerbread', 'pumpkin_pie', 'forest_pie', 'grape_jelly', 'coco_candy'];
        const all = [...D.DISHES, ...D.INGREDIENTS, ...D.FINDS];
        return {
          dups: Object.values(by).filter((l) => l.length > 1),
          drawn: [...ids, 'cheese_plate', 'flour', 'seeds', 'fir_twig'].filter((id) => {
            const x = all.find((q) => q.id === id);
            return !(x && D.ICON_RE.test(x.e) && A.hasItemArt(Object.keys(D.ICON).find((k) => D.ICON[k] === x.e)));
          }),
        };
      });
      expect(!r.dups.length, 'одинаковые значки у разных вещей', r.dups);
      expect(!r.drawn.length, 'без рисованного значка', r.drawn);
    },
  );

  await step('мелочи: простуженную через грот везёт дельфин — он на картинке заплыва (В20)', async () => {
    const back = async (sick) => {
      await L.fresh();
      await ev((sick) => {
        const d = window.__dev;
        for (const id of ['forest', 'jungle', 'cove']) if (!d.QuestState.landOpen(id)) d.actions.openLand(id);
        d.actions.mutate((s) => {
          s.day = 18;
          s.minutes = 12 * 60;
          s.weather = 'sun';
          s.sick = sick ? { cause: 'cold', since: s.day } : null;
        });
        d.go('cove');
      }, sick);
      await wait(300);
      await closeAll();
      await L.run('grotto:back', 1200);
      expect(await ev(() => !!document.querySelector('.grotto-ride canvas')), 'нет картинки заплыва в город');
      const r = await ev(() => window.__dev.F.debugGrottoRide());
      await L.untilArrive('world').catch(() => {});
      return r.dolphin;
    };
    expect(await back(true), 'простуженную в гроте не везёт дельфин');
    expect(!(await back(false)), 'здоровая плывёт сама — без дельфина');
  });
};
