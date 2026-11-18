// Шаги автотеста этапа 17а «Отдых в городе»: присесть на скамейку, прилечь на лежак, покачаться на качелях — и встать
// (ещё нажатием, шагом стрелкой, нажатием в другое место); житель присаживается рядом и говорит реплику; наклейка
// «Отдыхаю красиво»; «Пляжный волейбол» у сетки на пляже открывается и играется до итога через dev-хук
// (canvas.__volleyBot), приз и наклейка; друг с сердечками закрывает у сетки зону шире.
// Подключается из dev/smoke.js. Только эти шаги:  node dev/smoke.js <url> "step:отдых 17а:"
const lib = require('./lib.js');

module.exports = async function relax(ctx) {
  const { page, step, ev, wait, closeAll, expect, state, mutate, fresh: newGame, teleport, until, go, mgStart, sel } = lib(ctx);
  const now = () => ev(() => window.__dev.F.relaxNow());
  // лето, полдень, солнце (день 20 — июль, без праздника), хомячок в городе
  const fresh = async () => {
    await newGame({ day: 20, minutes: 12 * 60, weather: 'sun', scene: 'world' });
    await closeAll();
  };
  /** Нажать на точку мира города (клетка tx, ty + сдвиг в единицах мира). */
  const tapWorld = async (tx, ty, ox = 0, oy = 0) => {
    const p = await ev(([tx, ty, ox, oy]) => window.__dev.World.debugScreen((tx + 0.5) * 48 + ox, (ty + 0.5) * 48 + oy), [tx, ty, ox, oy]);
    await page.mouse.click(p.x, p.y);
  };
  const near = (tx, ty) => teleport(tx, ty); // и пара кадров — камера встала
  /** Встала: отдыха больше нет (ждать до 2 с). */
  const untilUp = () => until(() => window.__dev.F.relaxNow() === null, undefined, { timeout: 2000 }).catch(() => {});
  const waitRelax = async (type, ms = 6000) => {
    const t0 = Date.now();
    let r = null;
    while (Date.now() - t0 < ms) {
      r = await now();
      if (r && r.type === type && r.t > 0.2) return r;
      await wait(150);
    }
    return r;
  };

  await step('отдых 17а: скамейка, лежак, качели — сесть, лечь, покачаться и встать; наклейка «Отдыхаю красиво»', async () => {
    await fresh();
    expect(!(await state()).stickers.includes('x_relax'), 'наклейка отдыха уже есть в новой игре');
    // скамейка на северной улице: подойти и сесть, ещё нажатие — встать
    await near(41, 14);
    await tapWorld(41, 12, 0, -6);
    let r = await waitRelax('bench');
    expect(r && r.how === 'sit' && r.tx === 41 && r.ty === 12, 'не села на скамейку', r);
    expect((await state()).stickers.includes('x_relax'), 'нет наклейки «Отдыхаю красиво»');
    const pos = await ev(() => window.__dev.World.playerPos());
    expect(Math.abs(pos.y - (12.5 * 48 + 31)) < 2, 'хомячок «стоит» не у скамейки', pos);
    await tapWorld(41, 12, 0, -6);
    await untilUp();
    expect((await now()) === null, 'второе нажатие на скамейку — не встала', await now());
    // лежак у бассейна: лечь, через несколько секунд — дремлет; шаг стрелкой — встать
    await near(73, 38);
    await tapWorld(73, 36);
    r = await waitRelax('lounger');
    expect(r && r.how === 'lie', 'не легла на лежак', r);
    await page.keyboard.down('ArrowDown');
    await wait(350);
    await page.keyboard.up('ArrowDown');
    expect((await now()) === null, 'шаг стрелкой — не встала с лежака', await now());
    // качели на детской площадке в парке: качаться (сиденье прячется у качелей), нажатие в другое место — встать
    await near(45, 32);
    await tapWorld(45, 30, -12, -24);
    r = await waitRelax('swing');
    expect(r && r.how === 'swing', 'не села на качели', r);
    const busy = await ev(() => window.__dev.World.map.objs.find((o) => o.type === 'swing' && o.tx === 45 && o.ty === 30).busy);
    expect(busy === r.spot + 1, 'занятое сиденье качелей не спрятано', { busy, r });
    await tapWorld(42, 34);
    await untilUp();
    expect((await now()) === null, 'нажатие в другое место — не встала с качелей', await now());
    const busy2 = await ev(() => window.__dev.World.map.objs.find((o) => o.type === 'swing' && o.tx === 45 && o.ty === 30).busy);
    expect(!busy2, 'сиденье качелей осталось «занятым»', busy2);
    // в доме отдыхать не на чем: ушла в виллу — отдых закончился
    await near(37, 35);
    await tapWorld(37, 33, 0, -6);
    r = await waitRelax('bench');
    expect(r && r.how === 'sit', 'не села на скамейку в парке', r);
    await go('villa');
    expect((await now()) === null, 'ушла в дом — отдых не закончился', await now());
    const pr = await ev(() => window.__dev.World.p.ride);
    expect(!pr, 'у хомячка остался «способ передвижения» отдыха', pr);
  });

  await step('отдых 17а: рядом присаживается житель и говорит реплику; дружба +1 раз в день', async () => {
    await fresh();
    // лежак у бассейна — Сеня гуляет у бассейна днём
    let joined = null;
    for (const [tx, ty, ox, oy] of [
      [73, 36, 0, 0],
      [77, 36, 0, 0],
      [37, 33, 0, -6],
      [44, 33, 0, -6],
    ]) {
      await near(tx, ty + 2);
      await tapWorld(tx, ty, ox, oy);
      const r = await waitRelax(ty === 36 ? 'lounger' : 'bench');
      if (!r) continue;
      if (!(await ev(() => window.__dev.F.relaxJoinNow()))) {
        await tapWorld(tx, ty, ox, oy); // встать
        await wait(300);
        continue;
      }
      const t0 = Date.now();
      while (Date.now() - t0 < 15000) {
        const q = await now();
        if (q && q.mate && q.mate.seated) {
          joined = q;
          break;
        }
        await wait(250);
      }
      if (joined) break;
    }
    expect(joined && joined.mate.line, 'никто из жителей не присел рядом', joined);
    const s = await state();
    expect(s.dayFlags.relaxWith && s.dayFlags.relaxWith[joined.mate.id] === 1, 'дружба за «посидели рядом» не отмечена', s.dayFlags);
    // встала — житель снова гуляет
    await page.keyboard.down('ArrowDown');
    await wait(300);
    await page.keyboard.up('ArrowDown');
    const hold = await ev((id) => !!window.__dev.World.npcs.find((n) => n.id === id).hold, joined.mate.id);
    expect(!hold, 'житель остался сидеть, когда хомячок ушла');
  });

  await step('отдых 17а: «Пляжный волейбол» у сетки — правила с напарником, матч до 7 через dev-хук, приз и наклейка', async () => {
    await fresh();
    const sk = await ev(async () => {
      const m = await import('/js/minigames/volley.js');
      return { h0: m.mateSkill(0), h5: m.mateSkill(5), s: [m.volleyStars(7, 2), m.volleyStars(7, 6), m.volleyStars(5, 7), m.volleyStars(1, 7)] };
    });
    expect(sk.h5.zone > sk.h0.zone && sk.h5.over > sk.h0.over, 'друг с сердечками не играет лучше', sk);
    expect(sk.s.join() === '3,2,2,1', 'звёзды по счёту', sk.s);
    await mutate('s.friends.myata.pts = 12;'); // три сердечка у Мяты — она и будет в паре
    const money0 = (await state()).money;
    await near(30, 57);
    await tapWorld(29.5, 54, 0, -20);
    await page.waitForSelector('#mg .mg-card', { timeout: 10000 });
    const intro = await ev(() => document.querySelector('#mg .mg-card').textContent);
    expect(intro.includes('Пляжный волейбол') && intro.includes('Твоя пара') && intro.includes('Мята') && intro.includes('Приз пляжа'), 'правила волейбола', intro);
    await mgStart();
    await until(() => document.querySelector('#mg canvas') && document.querySelector('#mg canvas').__volley);
    const st0 = await ev(() => document.querySelector('#mg canvas').__volley());
    expect(st0.zone > 110 + 3 * 18 - 1, 'зона друга с тремя сердечками не шире', st0);
    await ev(() => document.querySelector('#mg canvas').__volleyBot(true));
    await page.waitForSelector(sel('done', '#mg'), { timeout: 150000 });
    const res = await ev(() => document.querySelector('#mg').textContent);
    const st = await ev(() => document.querySelector('#mg canvas') && document.querySelector('#mg canvas').__volley());
    expect(res.includes('Счёт') && /\+(30|60|90)/.test(res), 'итог волейбола', res);
    expect(!st || st.us === 7 || st.them === 7, 'матч не до 7 очков', st);
    await page.click(sel('done', '#mg'));
    await until(() => !document.querySelector('#mg') && window.__dev.G.state.stickers.includes('x_volley'), undefined, { timeout: 4000 }).catch(() => {});
    await wait(300); // окна приза и наклейки встают в очередь
    await closeAll();
    const s = await state();
    expect(s.stickers.includes('x_volley'), 'нет наклейки «Пляжный волейбол»');
    expect(s.dayFlags.relax && s.dayFlags.relax.volleys === 1, 'игра с призом не записана', s.dayFlags.relax);
    expect(s.money - money0 >= 30 && s.money - money0 <= 90, 'приз волейбола', s.money - money0);
    expect(s.plays.volley === 1, 'игра не записана в альбом', s.plays);
  });
};
