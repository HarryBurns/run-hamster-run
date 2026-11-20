// Шаги автотеста «Вилла растёт» (docs/DESIGN.md): новая игра начинается в маленьком домике, дом и двор достраивают
// за монеты в агентстве «Свой домик» (вкладка «Стройка»); у старых игр всё, что было на вилле, уже построено.
//   домик — комнаты, мебель, душ, плитка, сон, гость, «Обустроить»; двор — 6 грядок, без пруда и бассейна;
//   стройка — покупка в агентстве, сценка, утром готово, мебель с места сантехники — в кладовке;
//   ступени дома — этажи, лифт, терраса, камера; ступени двора — пруд, бассейн, грядки, теплица (любой сезон),
//   проходимость двора; старая игра — вилла целиком.
// Подключается из dev/smoke.js. Только эти шаги:  node dev/smoke.js <url> "step:вилла растёт"
const fs = require('fs');
const path = require('path');
const lib = require('./lib.js');
const SAVE_V5 = fs.readFileSync(path.join(__dirname, 'saves', 'v5.json'), 'utf8');

module.exports = async function villa(ctx) {
  const {
    page,
    step,
    ev,
    wait,
    expect,
    fresh,
    go,
    until,
    frames,
    closeAll,
    mutate,
    sel,
    act,
    toasts,
    panelText,
    reload,
    cont,
  } = lib(ctx);

  /** Дом сейчас: этажи, ширина, лифт, комнаты, встроенные предметы, мебель, помещается ли на экран. */
  const house = () =>
    ev(() => {
      const d = window.__dev,
        sc = d.scenes.villa,
        g = sc.geo,
        a = sc.debugScreen(0, g.top),
        b = sc.debugScreen(g.WTOT, 0);
      return {
        scene: d.sceneName,
        name: sc.desc.name,
        floors: g.floors,
        W: g.W,
        lift: g.lift,
        rooms: sc.desc.rooms.map((r) => r.id),
        built: sc.fixtures.map((f) => f.id),
        items: d.state.villa.map((i) => i.id).sort(),
        p: { f: sc.p.f, x: Math.round(sc.p.x), state: sc.p.state },
        fits: a.x >= 0 && a.y >= 0 && b.x <= innerWidth && b.y <= innerHeight,
        zoom: sc.cam.zoom,
        up: d.state.villaUp,
        storage: d.state.storage,
      };
    });
  /** Нажать на точку дома: x, этаж, высота над полом. */
  const tap = (x, f = 0, up = 60) =>
    ev(
      ([x, f, up]) => {
        const sc = window.__dev.scene,
          s = sc.debugScreen(x, sc.geo.fy(f) - up);
        sc.pointerDown(s.x, s.y);
        sc.pointerUp(s.x, s.y);
      },
      [x, f, up],
    );
  /** Двор на карте города: виды клеток, грядки-места, предметы, можно ли дойти от двери до ворот и до грядок. */
  const yard = () =>
    ev(() => {
      const d = window.__dev,
        W = d.World,
        m = W.map,
        n = {},
        T = 48;
      for (let y = 4; y <= 23; y++) for (let x = 5; x <= 26; x++) n[m.at(x, y)] = (n[m.at(x, y)] || 0) + 1;
      const door = m.doorPx(m.bById.villa),
        from = [Math.floor(door.x / T), Math.floor(door.y / T)];
      const reach = (tx, ty) => !!m.path(m.foot, from[0], from[1], tx, ty);
      const beds = W.places.filter((p) => /^bed\d+$/.test(p.id) && (!p.when || p.when()));
      return {
        tiles: n,
        beds: beds.map((p) => p.id),
        bedsReach: beds.every((p) => reach(Math.floor(p.stand[0]), Math.floor(p.stand[1]))),
        gate: reach(28, 14) && reach(15, 25),
        loungers: m.objs.filter((o) => o.type === 'lounger' && o.ty === 14 && o.tx < 14).length,
        reeds: m.objs.filter((o) => o.type === 'reeds' && o.tx < 28 && o.ty < 24).length,
        green: m.objs.filter((o) => o.type === 'villaGreenhouse').length,
        yardItems: m.objs.filter((o) => o.yard).length,
      };
    });
  const build = (id) => ev((id) => window.__dev.villaUp(id), id);

  await step(
    'вилла растёт: новая игра — маленький домик (душ, шкаф, кровать, стул, стол, раковина, плитка), всё работает; во дворе 6 грядок, без пруда и бассейна',
    async () => {
      await fresh({ villa: 'small', minutes: 10 * 60 });
      const h = await house();
      expect(h.floors === 1 && h.W === 1000 && !h.lift, 'домик: один этаж без лифта', h);
      expect(
        h.rooms.join() === 'wc,living' && h.built.join() === 'door,sink_wc,stove',
        'домик: комнаты и сантехника',
        h,
      );
      expect(h.items.join() === 'bed_pink,chair,shower,table,wardrobe', 'домик: мебель', h.items);
      // на компьютере дом виден целиком; на телефоне камера следит за хомячком
      const wide = await ev(() => innerWidth >= innerHeight * 1.5 && innerHeight >= 600);
      if (wide) expect(h.fits, 'домик не помещается на экран', h);
      expect(h.up.house === 0 && !h.up.pond && !h.up.pool && !h.up.green && h.up.beds === 0, 'ступени', h.up);
      // душ: хомячок встаёт под воду — это считается за «спа»
      const spa = await ev(() => {
        window.__spa = [];
        window.__dev.events.on('spa', (e) => window.__spa.push(e.what));
      });
      void spa;
      await tap(66, 0, 90);
      await until(() => window.__spa.includes('shower'), null, { timeout: 6000, msg: 'душ не включился' });
      expect((await toasts()).includes('душ'), 'нет подсказки про душ');
      // плитка: готовка
      await tap(934, 0, 60);
      await until(() => document.querySelector('.overlay .panel'), null, {
        timeout: 6000,
        msg: 'плитка не открыла готовку',
      });
      await closeAll();
      // шкаф и кровать на месте, гость приходит в комнату
      await ev(() => {
        const d = window.__dev;
        d.actions.meetFriend('plusha');
        d.actions.inviteGuest('plusha', 'villa');
      });
      await frames(4);
      const g = await ev(() =>
        window.__dev.scene.actors.filter((a) => a.guest).map((a) => [a.id, a.f, Math.round(a.x)]),
      );
      expect(g.length === 1 && g[0][1] === 0 && g[0][2] > 220 && g[0][2] < 1000, 'гость не в комнате', g);
      // «Обустроить»: режим включается, кладовка открыта (там подарок — пианино)
      await ev(() => window.__dev.scene.setDecor(true));
      await frames(3);
      expect(await ev(() => window.__dev.scene.isDecor()), '«Обустроить» не включилось');
      await ev(() => window.__dev.scene.setDecor(false));
      // сон: просыпаемся у кровати на первом этаже
      await ev(() => {
        const d = window.__dev;
        d.actions.nextDay();
        d.emit('wake');
      });
      await frames(3);
      const w = await house();
      expect(w.p.f === 0 && Math.abs(w.p.x - 608) < 5, 'проснулась не у кровати', w.p);
      // двор
      await go('world');
      const y = await yard();
      expect(y.beds.join() === 'bed0,bed1,bed2,bed4,bed5,bed6', 'грядок не шесть', y.beds);
      expect((y.tiles.b || 0) === 6 && !y.tiles.o && !y.tiles.d && !y.tiles.p && !y.tiles.bg, 'двор: клетки', y.tiles);
      expect(!y.loungers && !y.reeds && !y.green, 'двор: лежаки, камыши или теплица есть без покупки', y);
      expect(y.gate && y.bedsReach, 'двор: не пройти к воротам или к грядкам', y);
      // письма «Спа-день» и «Каток» в маленький домик не приходят
      const mails = await ev(() => {
        const d = window.__dev,
          got = new Set();
        d.actions.mutate((s) => {
          s.day = 5; // зима старого календаря: 1 января + 5
          s.startDay = 0;
        });
        for (let i = 0; i < 300; i++) {
          d.actions.mutate((s) => {
            s.lastTasks = [];
          });
          d.F.newDayMail();
          got.add(d.state.mail.task);
        }
        return [...got];
      });
      expect(!mails.includes('spa') && !mails.includes('skate'), 'пришло письмо, которое в домике не выполнить', mails);
      expect(mails.includes('cook') && mails.includes('plant'), 'обычные письма не приходят', mails);
    },
  );

  await step(
    'вилла растёт: стройка в агентстве — купить пристройку, сценка, заказ один; утром дом вдвое больше, душ — в кладовке; ступени по порядку',
    async () => {
      await fresh({ villa: 'small', minutes: 12 * 60, money: 9000 });
      await ev(() => window.__dev.run('villa-up'));
      await until(() => document.querySelector('.overlay .home-card'), null, {
        timeout: 6000,
        msg: 'нет окна стройки',
      });
      const txt = await panelText();
      expect(/Пристройка/.test(txt) && /Теплица/.test(txt) && /Пруд/.test(txt), 'вкладка «Стройка»: нет ступеней', txt);
      // второй этаж раньше пристройки не купить (кнопки нет), пристройку — можно
      const btns = await ev(() =>
        [...document.querySelectorAll('.overlay .home-card')].map((c) => [
          c.querySelector('.ttl').textContent.trim(),
          !!c.querySelector('.btn'),
        ]),
      );
      const has = (name) => (btns.find((b) => b[0].includes(name)) || [])[1];
      expect(has('Пристройка') && !has('Второй этаж') && has('Пруд') && has('Теплица'), 'что можно заказать', btns);
      await ev(() => {
        const c = [...document.querySelectorAll('.overlay .home-card')].find((q) =>
          q.textContent.includes('Пристройка'),
        );
        c.querySelector('.btn').click();
      });
      await page.waitForSelector(sel('ok'));
      await wait(400);
      await act('ok');
      await until(() => window.__dev.state.villaUp.build, null, { timeout: 6000, msg: 'заказ не записан' });
      const s1 = await ev(() => ({ ...window.__dev.state.villaUp, money: window.__dev.state.money }));
      expect(s1.build.id === 'house1' && s1.house === 0 && s1.money === 3000, 'заказ и деньги', s1);
      await until(() => document.querySelector('.fade.cable-ride canvas'), null, { timeout: 4000, msg: 'нет сценки' });
      await until(() => /Стройка началась/.test(document.body.textContent), null, { timeout: 9000, msg: 'нет окна' });
      await closeAll();
      // второй заказ, пока строят, не принимается
      expect(!(await ev(() => window.__dev.actions.orderVillaUp('pond'))), 'приняли второй заказ');
      // дом пока прежний; вечером — спать, утром — готово
      await go('villa');
      expect((await house()).W === 1000, 'дом вырос раньше утра');
      await ev(() => {
        const d = window.__dev;
        d.actions.nextDay();
        d.emit('wake');
      });
      await until(() => /Строители закончили/.test(document.body.textContent), null, {
        timeout: 9000,
        msg: 'нет «Готово»',
      });
      expect(/кладовк/.test(await panelText()), 'нет подсказки, что душ в кладовке');
      await closeAll();
      const h = await house();
      expect(h.W === 1600 && h.floors === 1 && !h.lift && h.up.house === 1 && !h.up.build, 'пристройка', h);
      expect(
        h.rooms.join() === 'wc,living,kitchen' && h.built.includes('kitchen') && h.built.includes('toilet'),
        'комнаты',
        h,
      );
      expect(!h.items.includes('shower') && h.storage.shower === 1, 'душ не в кладовке', h);
      expect(h.items.join() === 'bed_pink,chair,table,wardrobe', 'остальная мебель на месте', h.items);
      expect(h.p.f === 0 && Math.abs(h.p.x - 608) < 5, 'проснулась не у кровати', h.p);
      if (await ev(() => innerWidth >= innerHeight * 1.5 && innerHeight >= 600))
        expect(h.fits, 'дом с пристройкой не помещается', h);
    },
  );

  await step(
    'вилла растёт: ступени дома — второй этаж с лифтом, третий, мансарда с террасой; камера, «Обустроить» и лифт на каждой',
    async () => {
      await fresh({ villa: 'small', minutes: 12 * 60 });
      const want = [
        ['house1', 1, 1600, false, 'kitchen'],
        ['house2', 2, 1600, true, 'bath'],
        ['house3', 3, 1600, true, 'pool'],
        ['house4', 4, 1600, true, 'terrace'],
      ];
      const wide = await ev(() => innerWidth >= innerHeight * 1.5 && innerHeight >= 600);
      for (const [id, floors, W, lift, room] of want) {
        expect((await build(id)) === id, 'не построилось: ' + id);
        await wait(2300);
        await closeAll();
        const h = await house();
        expect(h.floors === floors && h.W === W && h.lift === lift && h.rooms.includes(room), id, h);
        if (wide) expect(h.fits, id + ': дом не помещается на экран компьютера', h);
        // «Обустроить» работает, мебель не потерялась
        await ev(() => window.__dev.scene.setDecor(true));
        await frames(2);
        expect(await ev(() => window.__dev.scene.isDecor()), id + ': «Обустроить» не включилось');
        await ev(() => window.__dev.scene.setDecor(false));
        expect(h.items.includes('bed_pink') && h.items.includes('wardrobe'), id + ': мебель', h.items);
        if (lift) {
          // на верхний этаж — на лифте
          await tap(400, floors - 1, 40);
          await until((f) => window.__dev.scene.p.f === f && !window.__dev.scene.p.lift, floors - 1, {
            timeout: 12000,
            msg: id + ': лифт не довёз до верхнего этажа',
          });
          await tap(400, 0, 40);
          await until(() => window.__dev.scene.p.f === 0 && !window.__dev.scene.p.lift, null, { timeout: 12000 });
        }
      }
      // всё построено — в агентстве про дом сказано, что он достроен
      await ev(() => window.__dev.run('villa-up'));
      await until(() => document.querySelector('.overlay .home-card'), null, { timeout: 6000 });
      expect(/Дом достроен целиком/.test(await panelText()), 'нет «дом достроен»');
      await closeAll();
      // сохранение и перезагрузка: дом тот же
      await reload();
      await until(() => window.__dev.sceneName === 'villa', null, { timeout: 8000 });
      await closeAll();
      const h = await house();
      expect(h.floors === 4 && h.up.house === 4, 'после перезагрузки дом другой', h);
    },
  );

  await step(
    'вилла растёт: двор — пруд, бассейн с лежаками, грядки 6 → 8 → 10, теплица (любые семена в любой сезон); двор проходим; что стояло на месте бассейна — в сарайчике',
    async () => {
      await fresh({ villa: 'small', minutes: 12 * 60 });
      await go('world');
      // предмет двора на траве, где потом будет бассейн
      await ev(() => {
        const d = window.__dev;
        d.actions.addYardItem('y_gnome');
        d.actions.placeYard('villa', 'y_gnome', 9, 18);
      });
      await frames(3);
      expect((await yard()).yardItems === 1, 'гномик не встал на траву');
      const steps = [
        ['pond', (y) => y.tiles.d > 10 && y.reeds === 2],
        ['pool', (y) => y.tiles.o === 56 && y.tiles.p > 20 && y.loungers === 3],
        ['beds1', (y) => y.tiles.b === 8 && y.beds.length === 8],
        ['beds2', (y) => y.tiles.b === 10 && y.beds.length === 10],
        ['green', (y) => y.tiles.bg === 4 && y.green === 1 && y.beds.length === 14],
      ];
      for (const [id, ok] of steps) {
        expect((await build(id)) === id, 'не построилось: ' + id);
        await wait(2300);
        await closeAll();
        const y = await yard();
        expect(ok(y), 'двор после «' + id + '»', y);
        expect(y.gate && y.bedsReach, 'двор после «' + id + '»: не пройти к воротам или грядкам', y);
      }
      const st = await ev(() => window.__dev.state.yard);
      expect(st.store.y_gnome === 1 && !(st.at.villa || []).length, 'гномик из бассейна не вернулся в сарайчик', st);
      // рыбалка в своём пруду: место «пруд» есть на клетке двора
      expect(await ev(() => window.__dev.World.map.at(22, 19) === 'd'), 'пруд не на месте');
      // теплица: зимой на обычной грядке помидоры не посадить, в теплице — можно; дорастают и собираются
      await mutate((s) => {
        s.day = 2;
        s.startDay = 0;
        s.seeds = { seed_tomato: 3 };
      });
      const plant = await ev(() => {
        const d = window.__dev;
        return [d.F.plantOn(0, 'seed_tomato'), d.F.plantOn(10, 'seed_tomato'), d.state.garden[10].seed];
      });
      expect(!plant[0] && plant[1] && plant[2] === 'seed_tomato', 'теплица: посадка не в сезон', plant);
      await ev(() => {
        const d = window.__dev;
        d.actions.nextDay();
        d.actions.nextDay();
        d.F.gardenBed(10);
      });
      const ing = await ev(() => window.__dev.state.ing.tomato || 0);
      expect(ing >= 6, 'теплица: урожай не собран', ing);
      // место в теплице открывает окно «Что посадим в теплице?»
      await closeAll();
      await ev(() => window.__dev.F.gardenBed(11));
      await until(() => /в теплице/.test(document.body.textContent), null, { timeout: 5000, msg: 'нет окна теплицы' });
      await closeAll();
    },
  );

  await step(
    'вилла растёт: старая игра — вилла целиком (три этажа, пруд, бассейн, 8 грядок), мебель на месте; террасу и теплицу можно достроить',
    async () => {
      const was = JSON.parse(SAVE_V5);
      expect(was.villaUp === undefined, 'образец v5 уже с villaUp');
      await ev((raw) => {
        window.__dev.G.state = null;
        localStorage.clear();
        localStorage.setItem('rhr-save-v1', raw);
      }, SAVE_V5);
      await page.reload();
      await page.waitForSelector(sel('continue'));
      await cont();
      await closeAll();
      await go('villa');
      const h = await house();
      expect(h.floors === 3 && h.lift && h.rooms.includes('pool') && h.name === 'Моя вилла', 'вилла старой игры', h);
      expect(h.items.length === was.villa.length, 'мебель старой игры', [h.items.length, was.villa.length]);
      await go('world');
      const y = await yard();
      expect(
        y.tiles.o === 56 && y.tiles.d > 10 && y.tiles.b === 8 && y.loungers === 3 && !y.green,
        'двор старой игры',
        y,
      );
      const states = await ev(() => window.__dev.F.debugVillaUp().states);
      expect(
        states.house3 === 'done' && states.house4 === 'ok' && states.green === 'ok' && states.pool === 'done',
        'ступени',
        states,
      );
    },
  );
};
