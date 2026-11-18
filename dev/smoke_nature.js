// Шаги автотеста этапа 16 «Природа, море и оживление мест»: настоящие скалы у буйка-ракушки и плотик «Далеко на юг»
// (кораблик их обходит), дельфины рядом с корабликом и за бухтой, тёплая лагуна у острова, «доброе извержение»,
// лодочка-пирога по реке в джунглях — и дальше по группам этапа (гора, пустыня, пляж, остров, отель).
// Подключается из dev/smoke.js. Только эти шаги:  node dev/smoke.js <url> step:природа
const { MG_START } = require('./selectors.js'); // кнопка «Начать!» мини-игры — по метке, а не по тексту
module.exports = async function nature({ page, step, ev, wait, closeAll }) {
  const T = 48;
  const norm = (t) => t.replace(/[  ]/g, ' ');
  const expect = (ok, msg, data) => {
    if (!ok) throw new Error(msg + (data === undefined ? '' : ': ' + JSON.stringify(data)));
  };
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
    await page.evaluate(() => window.__dev.actions.setFlag('intro', 0)); // вводная цепочка заданий — в своих шагах (dev/smoke_start.js)
    await wait(400);
    await page.click('text=Поехали!');
    await wait(500);
    await closeAll();
  };
  const watch = () =>
    ev(() => {
      window.__stopWatchNature = window.__dev.watchState();
    });
  const unwatch = async () => {
    const bad = await ev(() => window.__stopWatchNature());
    expect(!bad.length, `запись в состояние мимо действий (${bad.length})`, [...new Set(bad)].slice(0, 4));
  };
  /** Открыть места и встать в локации (полдень, лето, отметки дня чистые). */
  const toLand = async (scene, tx, ty, minutes = 12 * 60, day = 18) => {
    await closeAll();
    await ev(
      ([scene, tx, ty, minutes, day]) => {
        const d = window.__dev;
        for (const id of ['forest', 'mountain', 'caves', 'desert', 'jungle', 'cove', 'island']) if (!d.QuestState.landOpen(id)) d.actions.openLand(id);
        d.actions.mutate((s) => {
          s.day = day;
          s.minutes = minutes;
          s.weather = 'sun';
          s.dayFlags = {};
          for (const f of ['jungleHint', 'islandHint', 'coveHint', 'desertHint', 'cavesHint']) s.flags[f] = 1;
        });
        d.go(scene);
        d.locations[scene].debugTeleport(tx, ty);
      },
      [scene, tx, ty, minutes, day],
    );
    await wait(300);
  };

  await step('природа: море — скалы у буйка-ракушки и плотик «Далеко на юг» настоящие, кораблик их обходит; дельфины рядом с корабликом', async () => {
    await fresh();
    await ev(() => window.__dev.go('world'));
    await wait(200);
    // скалы и плотик занимают свои клетки
    const r = await ev(() => {
      const d = window.__dev,
        m = d.World.map,
        objs = m.objs.filter((o) => o.type === 'seaCrag' || o.type === 'farRaft');
      return { objs: objs.map((o) => [o.type, o.tx, o.ty, m.solid[o.ty][o.tx]]), g: d.World.grottoAt(), f: d.World.farAt() };
    });
    expect(r.objs.filter((o) => o[0] === 'seaCrag').length === 3 && r.objs.some((o) => o[0] === 'farRaft'), 'нет скал или плотика', r.objs);
    expect(r.objs.every((o) => o[3]), 'скалы и плотик не занимают клетку', r.objs);
    // кораблик у плотика: плывём на другую сторону — путь не проходит через занятые клетки
    await watch();
    const sail = async (x0, y0, x1, y1) =>
      ev(
        async ([x0, y0, x1, y1]) => {
          const d = window.__dev,
            W = d.World;
          d.actions.patchState('boat', { x: x0, y: y0, on: true });
          d.go('world', { pos: { scene: 'world', x: x0, y: y0 } });
          await new Promise((q) => setTimeout(q, 200));
          const ok = W.walkTo(x1, y1, true),
            cells = d.locations.world.p.path.map((q) => [Math.floor(q.x / 48), Math.floor(q.y / 48)]);
          // каждый отрезок пути — по клеткам: ни одна не занята
          const p = d.locations.world.p;
          let px = p.x,
            py = p.y,
            hit = null;
          for (const q of p.path) {
            for (let k = 0; k <= 20; k++) {
              const x = Math.floor((px + ((q.x - px) * k) / 20) / 48),
                y = Math.floor((py + ((q.y - py) * k) / 20) / 48);
              if (W.map.solid[y][x]) hit = [x, y];
            }
            px = q.x;
            py = q.y;
          }
          return { ok, boating: W.isBoating(), cells, hit };
        },
        [x0, y0, x1, y1],
      );
    let s = await sail(r.f.x - 3 * T, r.f.y, r.f.x + 3 * T, r.f.y);
    expect(s.ok && s.boating && !s.hit, 'кораблик плывёт сквозь плотик', s);
    s = await sail(r.g.x + 4 * T, r.g.y - 2 * T, r.g.x - 4 * T, r.g.y - 1 * T);
    expect(s.ok && s.boating && !s.hit, 'кораблик плывёт сквозь скалы у буйка', s);
    // вплавь — тоже не пройти
    const foot = await ev(() => {
      const d = window.__dev,
        m = d.World.map;
      return m.objs.filter((o) => o.type === 'seaCrag').map((o) => m.foot(o.tx, o.ty));
    });
    expect(foot.every((f) => !f), 'сквозь скалу можно проплыть', foot);
    // дельфины: выпрыгивают перед корабликом, подсказка раз в день
    await clearToasts();
    const dol = await ev(() => window.__dev.World.debugDolphins());
    expect(dol && dol.x > 0 && dol.x < 1280 * 2, 'дельфины не выпрыгнули', dol);
    await wait(300);
    expect(/Дельфины/.test(await toasts()), 'нет подсказки про дельфинов', await toasts());
    expect(await ev(() => !!window.__dev.G.state.dayFlags.dolphins), 'нет отметки дня про дельфинов');
    // дельфины сами: плывём по открытому морю — рано или поздно выпрыгивают
    const auto = await ev(async () => {
      const d = window.__dev,
        W = d.World,
        f = W.farAt();
      d.actions.patchState('boat', { x: f.x - 20 * 48, y: f.y - 8 * 48, on: true });
      d.go('world', { pos: { scene: 'world', x: f.x - 20 * 48, y: f.y - 8 * 48 } });
      await new Promise((q) => setTimeout(q, 150));
      for (let i = 0; i < 30 && !W.dolphinJump(); i++) {
        const p = d.locations.world.p;
        if (!p.path.length) W.walkTo(p.x + (i % 2 ? -14 : 14) * 48, p.y, true);
        await new Promise((q) => setTimeout(q, 1000));
      }
      return W.dolphinJump();
    });
    expect(auto, 'на кораблике в открытом море дельфины так и не выпрыгнули');
    await ev(() => window.__dev.World.leaveBoat());
    await unwatch();
  });

  await step('природа: остров — тёплая лагуна с рыбками (плавать можно), «доброе извержение» раз в неделю вечером', async () => {
    await toLand('island', 9, 29);
    await watch();
    const lag = await ev(async () => {
      const d = window.__dev,
        sc = d.locations.island;
      const ok = sc.walkTo(8.5 * 48, 31.5 * 48, true);
      await new Promise((q) => setTimeout(q, 1800));
      return { ok, tile: sc.map.at(Math.floor(sc.p.x / 48), Math.floor(sc.p.y / 48)), flag: d.G.state.flags.lagoonHint };
    });
    expect(lag.ok && lag.tile === 'clag' && lag.flag, 'в лагуну не зайти', lag);
    expect(/лагуна/i.test(await toasts()), 'нет подсказки про лагуну', await toasts());
    // извержение: только в свой день недели и вечером
    const er = await ev(async () => {
      const d = window.__dev,
        m = await import('/js/locations/island.js'),
        out = [];
      for (const [day, min] of [
        [18, 12 * 60],
        [18, 18 * 60],
        [19, 18 * 60],
        [25, 18 * 60],
        [18, 22 * 60],
      ]) {
        d.actions.mutate((s) => {
          s.day = day;
          s.minutes = min;
        });
        out.push(m.debugErupt().on);
      }
      return { out, inDays: m.eruptIn(19) };
    });
    expect(er.out.join() === 'false,true,false,true,false' && er.inDays === 6, 'извержение не раз в неделю вечером', er);
    await clearToasts();
    await ev(() => {
      window.__dev.actions.mutate((s) => {
        s.day = 18;
        s.minutes = 18 * 60;
        s.dayFlags = {};
      });
    });
    await wait(400);
    expect(/извержение/.test(await toasts()), 'нет подсказки про доброе извержение', await toasts());
    expect(await ev(() => !!(window.__dev.G.state.dayFlags.island || {}).erupt), 'нет отметки дня про извержение');
    await unwatch();
  });

  await step('природа: джунгли — лодочка-пирога у мостков, по реке к водопаду, под мост нельзя, сойти на берег', async () => {
    await toLand('jungle', 25, 16);
    await watch();
    const r = await ev(async () => {
      const d = window.__dev,
        sc = d.locations.jungle,
        m = await import('/js/locations/jungle.js'),
        c0 = m.debugCanoe(sc);
      const s0 = sc.debugScreen(c0.x, c0.y);
      return { c0, s0 };
    });
    expect(r.c0 && !r.c0.on, 'лодочки нет у мостков', r);
    await page.mouse.click(r.s0.x, r.s0.y - 4);
    await wait(1500);
    let c = await ev(async () => (await import('/js/locations/jungle.js')).debugCanoe(window.__dev.locations.jungle));
    expect(c.on, 'нажала на лодочку — не села', c);
    expect(await ev(() => !!document.querySelector('#hud') && /Сойти/.test(document.body.textContent)), 'нет кнопки «Сойти»');
    // под мост — нельзя, к водопаду — можно
    const sail = await ev(async () => {
      const d = window.__dev,
        sc = d.locations.jungle,
        m = await import('/js/locations/jungle.js');
      const under = sc.walkTo(15 * 48, 14.5 * 48, true);
      const up = sc.walkTo(36 * 48, 8.6 * 48, true);
      for (let i = 0; i < 40 && !m.debugCanoe(sc).fall; i++) await new Promise((q) => setTimeout(q, 200));
      return { under, up, c: m.debugCanoe(sc) };
    });
    expect(!sail.under && sail.up && sail.c.fall, 'лодочка не доплыла до водопада или прошла под мостом', sail);
    // сойти: на берег рядом, лодочка осталась там, где сошла
    c = await ev(async () => {
      const sc = window.__dev.locations.jungle,
        m = await import('/js/locations/jungle.js');
      m.endCanoe(sc);
      return { ...m.debugCanoe(sc), foot: sc.map.foot(Math.floor(sc.p.x / 48), Math.floor(sc.p.y / 48)) };
    });
    expect(!c.on && c.foot && c.x > 30 * T, 'не сошла на берег у водопада', c);
    await unwatch();
    // ушла и вернулась — лодочка снова у мостков
    await ev(() => window.__dev.go('world'));
    await toLand('jungle', 25, 16);
    c = await ev(async () => (await import('/js/locations/jungle.js')).debugCanoe(window.__dev.locations.jungle));
    expect(Math.abs(c.x - r.c0.x) < 1 && Math.abs(c.y - r.c0.y) < 1, 'лодочка не вернулась к мосткам', c);
  });

  await step('природа: гора и пещеры — свой горный ручей, облака в дождь и ночью, снеговик стоит зимой несколько дней, летучие мыши улетают ночью', async () => {
    await toLand('mountain', 30, 20);
    const brook = await ev(() => {
      const m = window.__dev.locations.mountain.map;
      let mt = 0,
        old = 0;
      for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) (m.at(x, y) === 'mtBrook' ? mt++ : m.at(x, y) === 'brook' ? old++ : 0);
      return { mt, old };
    });
    expect(brook.mt > 20 && !brook.old, 'на горе не свой ручей', brook);
    // облака ниже вершины: слой неба есть и в дождь, и ночью
    for (const [weather, minutes] of [
      ['rain', 12 * 60],
      ['snow', 12 * 60],
      ['sun', 23 * 60],
    ]) {
      await ev(
        ([weather, minutes]) =>
          window.__dev.actions.mutate((s) => {
            s.weather = weather;
            s.minutes = minutes;
          }),
        [weather, minutes],
      );
      await wait(250);
      const on = await ev(() => {
        const e = document.querySelector('#sky');
        return !!e && e.style.display === 'block';
      });
      expect(on, 'нет слоя неба с облаками: ' + weather + ' ' + minutes);
    }
    // снеговик: зимой, слепленный до конца, стоит MOUNTAIN.snowmanDays дней; весной тает
    await toLand('mountain', 8, 11, 12 * 60, 33);
    await watch();
    await ev(() => {
      const d = window.__dev;
      d.actions.mutate((s) => {
        s.dayFlags = { mountain: { snowman: 4 } };
        s.ing.carrot = 1;
      });
      d.run('mountain:snowman');
    });
    await wait(400);
    await page.click('.overlay .snow-step');
    await wait(300);
    await closeAll();
    const sm = await ev(async () => {
      const d = window.__dev,
        m = await import('/js/locations/mountain.js'),
        out = [];
      for (const day of [33, 34, 35, 36, 37]) {
        d.actions.mutate((s) => {
          s.day = day;
          s.dayFlags = {};
        });
        out.push(m.snowmanNow().stage);
      }
      d.actions.mutate((s) => {
        s.day = 35;
      });
      return { out, flag: d.G.state.flags.snowmanDay };
    });
    // 33 — декабрь, 36 — снова январь (новый год игры), с дня 37 — уже растаял (4 дня)
    expect(sm.flag === 33 && sm.out.join() === '5,5,5,5,0', 'снеговик не стоит несколько дней зимой', sm);
    await unwatch();
    // летучие мыши: днём висят, ночью их нет (подсказка), утром вернулись
    await toLand('caves', 24, 6, 12 * 60);
    const bats = await ev(async () => {
      const m = await import('/js/locations/caves.js');
      return [12 * 60, 20.75 * 60, 23 * 60, 3 * 60, 5.25 * 60, 6 * 60].map((t) => m.batsAway(t));
    });
    expect(bats[0] === 0 && bats[1] > 0 && bats[1] < 1 && bats[2] === 1 && bats[3] === 1 && bats[4] > 0 && bats[4] < 1 && bats[5] === 0, 'летучие мыши не улетают ночью', bats);
    await clearToasts();
    await ev(() =>
      window.__dev.actions.mutate((s) => {
        s.minutes = 23 * 60;
      }),
    );
    await ev(() => {
      const sc = window.__dev.locations.caves,
        m = sc.map,
        o = m.objs.find((q) => q.type === 'caveFace' && q.ty <= 4 && q.tx >= 17 && q.tx <= 31);
      sc.debugTeleport(o.tx, o.ty + 2);
    });
    await wait(400);
    expect(/Летучих мышей нет/.test(await toasts()), 'нет подсказки, куда улетели мыши', await toasts());
  });

  await step('природа: пустыня — жара без штрафов (обмахивается, в тени прохладно), мираж раз в день, Финик везёт куда скажешь, звёзды ночью', async () => {
    await toLand('desert', 30, 26);
    await watch();
    // жара: на солнце без шляпы стоит и обмахивается лапкой; в тени пальмы — нет, и подсказка про тень
    const pose = await ev(() => {
      const d = window.__dev,
        sc = d.locations.desert;
      d.actions.mutate((s) => (s.look.outfit.head = null));
      const sun = sc.first('heroPose', sc, sc.p, 1);
      const palm = sc.map.objs.find((o) => o.type === 'palm');
      sc.debugTeleport(palm.tx, palm.ty + 1);
      const shade = sc.first('heroPose', sc, sc.p, 1);
      return { sun, shade, money: d.G.state.money };
    });
    expect(pose.sun && typeof pose.sun.fan === 'number' && !pose.shade, 'хомячок не обмахивается на солнце (или обмахивается в тени)', pose);
    await wait(600);
    expect(/тени пальм/.test(await toasts()), 'нет подсказки про тень пальм', await toasts());
    // мираж: «Это мираж!» — один раз за день
    await clearToasts();
    await ev(() => window.__dev.emit('desert', { what: 'mirage' }));
    await wait(200);
    expect(/мираж/.test(await toasts()), 'нет подсказки про мираж', await toasts());
    await clearToasts();
    await ev(() => window.__dev.emit('desert', { what: 'mirage' }));
    await wait(200);
    expect(!/мираж/.test(await toasts()), 'мираж второй раз за день', await toasts());
    // Финик: сначала спрашивает, куда ехать; к пирамиде — довёз и сам ушёл домой
    await ev(() => {
      window.__dev.run('desert:camel'); // не ждать: окно «Куда поедем?» ждёт ответа
    });
    await wait(500);
    const opts = await ev(() => [...document.querySelectorAll('.dialog .btn')].map((b) => b.textContent));
    expect(opts.some((t) => /По кругу/.test(t)) && opts.some((t) => /пирамид/.test(t)) && opts.some((t) => /раскопк/.test(t)), 'нет выбора, куда ехать', opts);
    await page.click('.dialog .btn >> text=пирамиде');
    await wait(300);
    const ride = await ev(async () => {
      const sc = window.__dev.locations.desert,
        camel = sc.map.objs.find((o) => o.type === 'camel'),
        on = !!(sc.p.ride && sc.p.ride.camel),
        away = camel.away();
      for (let i = 0; i < 60 && sc.p.ride; i++) await new Promise((q) => setTimeout(q, 200));
      return { on, away, after: !!sc.p.ride, home: !camel.away(), at: [sc.p.x / 48, sc.p.y / 48] };
    });
    expect(ride.on && ride.away && !ride.after && ride.home && Math.hypot(ride.at[0] - 8.5, ride.at[1] - 10.6) < 1.5, 'Финик не довёз до пирамиды', ride);
    await unwatch();
    // ночью — звёзды (крюк overlay рисует их, когда темно)
    await ev(() => window.__dev.actions.mutate((s) => (s.minutes = 23 * 60)));
    await wait(300);
    expect(await ev(() => window.__dev.locations.desert.darkness() > 0.5), 'ночью не темно');
  });

  await step('природа: джунгли — хомячок висит на лапках (поза grip), картинка переезда туда и обратно разная', async () => {
    const r = await ev(async () => {
      const { drawHamster } = await import('/js/art/hamster.js'),
        { playerLook } = await import('/js/core/state.js'),
        j = await import('/js/features/jungle.js'),
        look = playerLook();
      const pic = (fn) => {
        const c = document.createElement('canvas');
        c.width = 280;
        c.height = 160;
        fn(c.getContext('2d'));
        return c.getContext('2d').getImageData(0, 0, 280, 160).data;
      };
      // поза «висит на лапках»: ладошки над макушкой — сверху нарисовано больше, чем у обычной позы
      const top = (d) => {
        let n = 0;
        for (let i = 3; i < 280 * 66 * 4; i += 4) if (d[i] > 0) n++;
        return n;
      };
      const grip = pic((c) => drawHamster(c, 140, 150, 1, look, { grip: true })),
        plain = pic((c) => drawHamster(c, 140, 150, 1, look, {}));
      // переезд: туда и обратно — разные картинки (слева — город или остров)
      const there = pic((c) => j.paintVoyage(c, 280, 160, 0.5, true, look, 2)),
        back = pic((c) => j.paintVoyage(c, 280, 160, 0.5, false, look, 2));
      let diff = 0;
      for (let i = 0; i < there.length; i += 16) if (Math.abs(there[i] - back[i]) > 30) diff++;
      return { gripTop: top(grip), plainTop: top(plain), diff: diff / (there.length / 16) };
    });
    expect(r.gripTop > r.plainTop + 100, 'лапки не поднялись над головой', r);
    expect(r.diff > 0.3, 'картинка «домой» — та же, что «туда»', r);
  });

  await step('природа: пляж — Жемчужинка плавает и возвращается, черепашата обходят пальмы, свой замок стоит до завтра, свечение воды ночью', async () => {
    await toLand('cove', 13, 16);
    await watch();
    // русалочка плавает: на камне её нет, в воде — есть; подошла к камню — вернулась
    const pearl = await ev(async () => {
      const d = window.__dev,
        sc = d.locations.cove,
        m = await import('/js/locations/cove.js');
      m.debugPearl(true);
      await new Promise((q) => setTimeout(q, 400));
      const swim = { ...m.debugPearl(), hidden: sc.debugNpc('pearl').hidden };
      sc.debugTeleport(19, 16);
      await new Promise((q) => setTimeout(q, 400));
      return { swim, back: m.debugPearl().on, hidden: sc.debugNpc('pearl').hidden };
    });
    expect(pearl.swim.on && pearl.swim.at && pearl.swim.hidden, 'Жемчужинка не плавает', pearl);
    expect(!pearl.back && !pearl.hidden, 'Жемчужинка не вернулась на камень, когда подошла', pearl);
    // черепашата: хомячок уходит за пальму — цепочка обходит ствол, а не ползёт сквозь
    const turtles = await ev(async () => {
      const d = window.__dev,
        sc = d.locations.cove,
        m = await import('/js/locations/cove.js');
      d.actions.mutate((s) => (s.minutes = 18 * 60 + 30));
      sc.debugTeleport(9, 12);
      m.startHatch();
      sc.walkTo(4.5 * 48, 9.5 * 48, true); // мимо пальмы у (3, 11) и (4, 7)
      let bad = 0,
        n = 0;
      for (let i = 0; i < 40; i++) {
        await new Promise((q) => setTimeout(q, 100));
        for (const q of m.debugTurtles().list) {
          if (q.sea) continue;
          n++;
          const tx = Math.floor(q.x / 48),
            ty = Math.floor(q.y / 48),
            k = sc.map.at(tx, ty);
          if (!sc.map.foot(tx, ty) && k !== 'clag' && k !== 'cdeep') bad++;
        }
      }
      return { bad, n };
    });
    expect(turtles.n > 20 && turtles.bad === 0, 'черепашата ползут сквозь пальмы и камни', turtles);
    // свой замок: стоит сегодня и завтра, послезавтра его смыло
    const castle = await ev(async () => {
      const d = window.__dev,
        m = await import('/js/locations/cove.js'),
        out = [];
      d.actions.mutate((s) => (s.flags.coveCastle = { day: s.day, cells: ['tower', 'wall', 'gate', 'wall', 'tower', 'star', null, null, null, 'star'] }));
      const day = d.G.state.day;
      for (const k of [0, 1, 2]) {
        d.actions.mutate((s) => (s.day = day + k));
        out.push(!!m.ownCastle());
      }
      d.actions.mutate((s) => (s.day = day));
      return out;
    });
    expect(castle.join() === 'true,true,false', 'свой замок не стоит до завтра', castle);
    // ночью — светится вода и пена у кромки (кадр рисуется без ошибок)
    await ev(() => window.__dev.actions.mutate((s) => (s.minutes = 23 * 60)));
    await wait(500);
    await unwatch();
    const clipped = await ev(() => window.__dev.locations.cove.debugSprites().clipped);
    expect(!clipped.length, 'спрайты не поместились в рамку', clipped);
  });

  await step('природа: остров — хоровод обходит хомячка и жителей у костра, гирлянда буквой «П» (спереди открыта)', async () => {
    await toLand('island', 20, 19, 20 * 60);
    const r = await ev(async () => {
      const sc = window.__dev.locations.island,
        m = await import('/js/locations/island.js');
      // хомячок стоит прямо на пути хоровода — у костра
      sc.p.x = 20.5 * 48;
      sc.p.y = 17.75 * 48;
      let min = 1e9;
      for (let i = 0; i < 40; i++) {
        await new Promise((q) => setTimeout(q, 100));
        for (const p of m.debugFest(sc).dancers) min = Math.min(min, Math.hypot(p.x - sc.p.x, p.y - sc.p.y));
      }
      const f = m.debugFest(sc);
      return { min, fest: f.fest, garland: f.garland, bulbs: f.bulbs };
    });
    expect(r.fest && r.garland && r.min > 60, 'хоровод проходит сквозь хомячка', r);
    expect(r.bulbs === 24, 'в гирлянде не три стороны по 8 огоньков', r);
  });

  await step('природа: отель — живой швейцар машет и здоровается, друзья у бассейна в разное время, спа даёт бодрость к следующей смене', async () => {
    await fresh();
    await watch();
    await ev(() => {
      const d = window.__dev;
      d.go('world');
      d.actions.mutate((s) => (s.minutes = 12 * 60));
    });
    await wait(200);
    // швейцар: подошла — машет; нажала — разговор, «Здравствуйте!» — событие
    const dm = await ev(async () => {
      const d = window.__dev,
        { doorman } = await import('/js/locations/town.js'),
        p = doorman.debugDoorman();
      d.World.debugTeleport(Math.floor(p.x / 48) + 3, Math.floor(p.y / 48) + 4);
      await new Promise((q) => setTimeout(q, 200));
      const far = doorman.debugDoorman().waving;
      d.World.walkTo(p.x + 60, p.y + 40, true);
      await new Promise((q) => setTimeout(q, 1500));
      return { far, near: doorman.debugDoorman().waving || doorman.debugDoorman().greetT > 0 };
    });
    expect(!dm.far && dm.near, 'швейцар не здоровается, когда подходишь', dm);
    let said = false;
    await ev(() => {
      window.__dev.events.on('hotel', ({ what }) => what === 'doorman' && (window.__doormanSaid = true));
      window.__dev.run('hotel:doorman');
    });
    await wait(400);
    expect(/Швейцар/.test(await ev(() => (document.querySelector('.dialog') || { textContent: '' }).textContent)), 'нет разговора со швейцаром');
    await page.click('.dialog .btn >> text=Здравствуйте');
    await wait(400);
    said = await ev(() => !!window.__doormanSaid);
    await closeAll();
    expect(said, 'поздоровалась — нет события');
    // друзья у бассейна: в разное время дня — разные, иногда двое сразу
    const pool = await ev(async () => {
      const D = await import('/js/data/index.js'),
        seen = new Set(),
        slots = new Set();
      let two = 0;
      for (let d = 0; d < 36; d++)
        for (const m of [11 * 60, 15 * 60, 18 * 60]) {
          const g = D.poolGuestsOn(d, m);
          g.forEach((id) => seen.add(id));
          if (g.length) slots.add(m);
          if (g.length > 1) two++;
        }
      return { seen: seen.size, slots: slots.size, two, night: D.poolGuestsOn(3, 22 * 60).length };
    });
    expect(pool.seen >= 6 && pool.slots === 3 && pool.two > 0 && !pool.night, 'у бассейна всё ещё один житель и в одно время', pool);
    // спа: бодрость — значок у даты и +10 % к следующей смене (только одной)
    await ev(() => window.__dev.actions.mutate((s) => (s.money += 1000)));
    await ev(() => {
      window.__dev.run('hotel:spa'); // не ждать: окно Мастера Пенки ждёт ответа
    });
    await wait(400);
    await page.click('.dialog .btn >> text=Массаж');
    await wait(4600);
    await closeAll();
    const boost = await ev(() => ({ flag: window.__dev.G.state.flags.spaBoost, day: window.__dev.G.state.day, chip: !document.querySelector('.chip.boost').hidden }));
    expect(boost.flag === boost.day && boost.chip, 'после спа нет бодрости или значка', boost);
    await ev(async () => {
      const mod = (await import('/js/minigames/teacher.js')).default;
      window.__teacherStart2 = mod.start;
      mod.start = (host) => {
        const t = setTimeout(() => host.finish({ stars: 2, text: 'проверка' }), 60);
        return { stop: () => clearTimeout(t) };
      };
    });
    const shift = async () => {
      const m0 = await ev(() => window.__dev.G.state.money);
      await ev(() => {
        window.__dev.run('minigame:teacher');
      });
      await wait(500);
      await page.click(MG_START);
      await wait(500);
      await page.click('#mg >> text=Ура!');
      await wait(500);
      return (await ev(() => window.__dev.G.state.money)) - m0;
    };
    const pay = await ev(async () => (await import('/js/data/index.js')).JOBS.teacher.pay[1]);
    const first = await shift(),
      second = await shift();
    await ev(async () => {
      (await import('/js/minigames/teacher.js')).default.start = window.__teacherStart2;
    });
    expect(first === pay + Math.round(pay * 0.1) && second === pay, 'бодрость не дала +10 % к одной следующей смене', { first, second, pay });
    expect(await ev(() => document.querySelector('.chip.boost').hidden), 'значок бодрости остался после смены');
    await unwatch();
  });
};
