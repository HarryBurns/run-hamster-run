// Шаги автотеста «Свой дом» — хвосты «Вилла растёт» и правки дома и двора (20 ноября):
//   снаружи дом по ступени (домик → вилла с мансардой), подписи и справка по построенному;
//   «Мой двор» — предметы на «дикие» цветы (В6); «Обустроить» — у окна с зазором, настенное не налезает на настенное
//   и на шкафчики кухни, напольное из кладовки — не за мебелью (З16, З21); новая игра записывается после
//   вступительной сценки (З23).
// Подключается из dev/smoke.js. Только эти шаги:  node dev/smoke.js <url> "step:свой дом"
const lib = require('./lib.js');

module.exports = async function home(ctx) {
  const L = lib(ctx);
  const { page, step, ev, expect, fresh, go, closeAll, frames, panelText, drain, until, toasts, clearToasts } = L;
  const { act, sel, untilScene } = L;

  /** Дом на карте города: подпись, ключи его спрайтов в кэше, не обрезан ли рисунок. */
  const outside = () =>
    ev(() => {
      const d = window.__dev,
        SP = d.topdown.SP,
        keys = [...SP.map.keys()].filter((k) => k.startsWith('b:world:villa:'));
      return {
        name: d.World.BUILDINGS.find((b) => b.id === 'villa').name,
        keys,
        clipped: SP.stats().clipped.filter((k) => k.startsWith('b:world:villa:')),
      };
    });
  const helpText = async () => {
    await ev(() => void window.__dev.F.showHelp());
    const t = await panelText();
    await closeAll();
    return (t.split('\n').find((l) => l.includes('🏡')) || '').trim(); // строчка про свой дом
  };

  await step(
    'свой дом: снаружи — по ступени (домик, пристройка, два этажа, вилла, мансарда с террасой); «Мой домик» → «Моя вилла»; справка — по построенному',
    async () => {
      await fresh({ villa: 'small' });
      const names = ['Мой домик', 'Мой дом', 'Мой дом', 'Моя вилла', 'Моя вилла'];
      for (let st = 0; st <= 4; st++) {
        if (st) await ev((id) => window.__dev.villaUp(id), 'house' + st);
        await drain();
        await go('world');
        await ev(() => window.__dev.World.debugTeleport(16, 10));
        await frames(3);
        const o = await outside();
        // ступень — в ключе спрайта здания: после стройки дом снаружи перерисовывается сам
        expect(
          o.keys.some((k) => k.endsWith(':' + st)),
          `ступень ${st}: дом снаружи не по ступени`,
          o.keys,
        );
        expect(!o.clipped.length, `ступень ${st}: рисунок дома не помещается в рамку спрайта`, o.clipped);
        expect(o.name === names[st], `ступень ${st}: подпись дома`, o.name);
        const help = await helpText();
        if (st === 0)
          expect(
            help.includes('В домике нажимай') &&
              help.includes('плитку') &&
              !help.includes('сауну') &&
              !help.includes('Лифт'),
            'справка в домике',
            help.slice(0, 600),
          );
        if (st === 4)
          expect(
            help.includes('На вилле нажимай') && help.includes('сауну') && help.includes('Лифт'),
            'справка на вилле',
            help.slice(0, 600),
          );
        await go('villa');
      }
    },
  );

  await step(
    'свой дом: «Мой двор» — предмет встаёт на «дикие» цветы, цветы под ним прячутся, унесли или переставили — вырастают снова',
    async () => {
      await fresh({ villa: 'small', scene: 'world' });
      const r = await ev(() => {
        const d = window.__dev,
          m = d.World.map,
          A = d.actions;
        const at = (x, y) => m.objs.filter((o) => o.tx === x && o.ty === y).map((o) => o.type + (o.yard ? '*' : ''));
        // клетки двора с «дикими» цветами, куда можно поставить
        const cells = m.objs
          .filter((o) => o.type === 'flowers' && o.tx >= 5 && o.tx <= 26 && o.ty >= 4 && o.ty <= 23)
          .filter((o) => d.F.yardCanPlace('villa', o.tx, o.ty))
          .map((o) => [o.tx, o.ty, o.v]);
        if (cells.length < 2) return { cells };
        const [a, b] = cells;
        A.addYardItem('y_bush', 1);
        const it = A.placeYard('villa', 'y_bush', a[0], a[1]);
        const placed = at(a[0], a[1]);
        A.moveYard('villa', it, b[0], b[1]);
        const movedA = at(a[0], a[1]),
          movedB = at(b[0], b[1]);
        A.stashYard('villa', it);
        const back = m.objs.filter((o) => o.tx === b[0] && o.ty === b[1] && o.type === 'flowers').map((o) => o.v);
        return { cells: cells.length, placed, movedA, movedB, afterB: at(b[0], b[1]), back, v: b[2] };
      });
      expect(r.cells >= 2, 'во дворе нет клеток с цветами, куда можно поставить', r);
      expect(r.placed.join() === 'yardBush*', 'предмет встал не на цветы или цветы под ним остались', r);
      expect(r.movedA.join() === 'flowers' && r.movedB.join() === 'yardBush*', 'переставили — цветы не вернулись', r);
      expect(r.afterB.join() === 'flowers' && r.back.join() === String(r.v), 'унесли — цветы не выросли те же', r);
    },
  );

  // ---------- «Обустроить» (З16, З21) ----------
  /** Включить «Обустроить», в кладовке — только эти вещи; камера — на точку (x, этаж, высота над полом). */
  const decorAt = async (store, x, f, up) => {
    await ev((st) => window.__dev.actions.mutate((s) => (s.storage = st)), store);
    await ev(() => window.__dev.scene.setDecor(true));
    await until(() => document.querySelector('.decor-tray .tray-item'), undefined, { msg: 'кладовка' });
    await frames(2);
    await ev(
      ([x, f, up]) => {
        const sc = window.__dev.scene;
        sc.cam.x = x;
        sc.cam.y = sc.geo.fy(f) - up;
        sc.cam.clamp();
      },
      [x, f, up],
    );
    await frames(2);
  };
  /** Предмет дома (последний с таким id) и его рамка: x0, x1 и высоты низа и верха над полом (для настенного). */
  const item = (id) =>
    ev(async (id) => {
      const { FURN_BY_ID } = await import('/js/data/index.js');
      const sc = window.__dev.scene,
        it = sc
          .items()
          .filter((i) => i.id === id)
          .pop(),
        d = it && FURN_BY_ID[id];
      return (
        it && {
          uid: it.uid,
          x: it.x,
          f: it.floor,
          y: it.y,
          x0: it.x - d.w / 2,
          x1: it.x + d.w / 2,
          lo: it.y - d.h / 2,
          hi: it.y + d.h / 2,
        }
      );
    }, id);
  /** Перетащить предмет пальцем (мышью) в точку мира (x, высота над полом этажа f); вернуть drag.bad над ней. */
  const dragTo = async (it, x, f, up) => {
    const pt = await ev(
      ([it, x, f, up]) => {
        const sc = window.__dev.scene;
        sc.cam.x = (it.x + x) / 2;
        sc.cam.y = sc.geo.fy(f) - 150;
        sc.cam.clamp();
        return { a: sc.debugScreen(it.x, sc.geo.fy(it.f) - it.y), b: sc.debugScreen(x, sc.geo.fy(f) - up) };
      },
      [it, x, f, up],
    );
    await frames(2);
    await page.mouse.move(pt.a.x, pt.a.y);
    await page.mouse.down();
    await page.mouse.move(pt.b.x, pt.b.y, { steps: 6 });
    const bad = await ev(() => {
      const g = window.__dev.scene.decor.drag;
      return g ? g.bad : 'нет';
    });
    await page.mouse.up();
    await frames(2);
    return bad;
  };
  const cross = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.lo < b.hi && b.lo < a.hi;

  await step(
    'свой дом: «Обустроить» — у окна с зазором, настенное не на настенном и не на шкафчиках кухни пентхауса; напольное из кладовки — не за мебелью',
    async () => {
      await fresh({ minutes: 12 * 60 });
      await go('villa');
      // окно гостиной виллы (x 640): часы, отпущенные над ним, встают рядом — не вплотную к раме. Перетаскивание —
      // на широком экране (на узком телефоне окно и картина не помещаются в кадр вместе с часами; там — только кладовка)
      const wide = await ev(() => innerWidth >= 900);
      if (wide) await dragChecks();
      async function dragChecks() {
        await decorAt({ clock: 1 }, 640, 0, 150);
        await page.click('.decor-tray .tray-item');
        let c = await item('clock');
        expect(c, 'часы не встали из кладовки');
        let bad = await dragTo(c, 640, 0, 156);
        expect(bad === 'window', 'над окном рамка не «нельзя»', bad);
        c = await item('clock');
        const frame = 88 / 2 + 8; // половина рамы окна
        expect(Math.abs(c.x - 640) >= 28 + frame + 10, 'часы встали вплотную к раме окна', c);
        expect((await toasts()).includes('окно'), 'нет подсказки про окно');
        // картина рядом: часы над ней — «нельзя», отпущенные — рядом, не налезая
        await clearToasts();
        await ev(([x]) => window.__dev.actions.placeFurn('villa', 'pic_sun', 0, x, 150), [c.x > 640 ? 820 : 460]);
        await frames(2);
        const pic = await item('pic_sun');
        c = await item('clock');
        bad = await dragTo(c, pic.x, 0, 150);
        expect(bad === 'wall', 'над картиной рамка не «нельзя»', bad);
        c = await item('clock');
        expect(!cross(c, pic), 'часы остались на картине', { c, pic });
        expect((await toasts()).includes('висит'), 'нет подсказки «здесь уже что-то висит»', await toasts());
        await ev(() => window.__dev.scene.setDecor(false));
      }
      // напольное из кладовки — не за кроватью и тумбочкой в спальне (камера — на кровати; на этаже есть место)
      const bed = await item('bed_pink');
      await decorAt({ plant_ficus: 1 }, bed.x, bed.f, 120);
      const was = await ev(() => window.__dev.scene.items().map((i) => i.uid));
      await page.click('.decor-tray .tray-item');
      const fic = await ev(async (was) => {
        const { FURN_BY_ID } = await import('/js/data/index.js');
        const sc = window.__dev.scene,
          it = sc.items().find((i) => !was.includes(i.uid)),
          d = FURN_BY_ID[it.id];
        const under = sc
          .items()
          .filter((q) => q !== it && q.floor === it.floor && !FURN_BY_ID[q.id].wall && FURN_BY_ID[q.id].layer !== 0)
          .filter((q) => Math.abs(q.x - it.x) < (FURN_BY_ID[q.id].w + d.w) / 2)
          .map((q) => q.id);
        return { x: it.x, f: it.floor, under };
      }, was);
      expect(fic.f === bed.f && !fic.under.length, 'фикус из кладовки встал за другой мебелью', fic);
      await ev(() => window.__dev.scene.setDecor(false));
      // пентхаус: часы из кладовки — не на нарисованных шкафчиках кухни (кухня x 1075: шкафчики 898–1232)
      await ev(() => window.__dev.actions.addHome('penthouse'));
      await go('penthouse');
      await decorAt({ clock: 1 }, 1075, 0, 160);
      await page.click('.decor-tray .tray-item');
      const c = await item('clock');
      const cab = { x0: 1075 - 177, x1: 1075 + 157, lo: 164, hi: 238 };
      expect(c && (c.f === 0 || !wide), 'часы в пентхаусе не встали на первый этаж', c);
      expect(!(c.f === 0 && cross(c, cab)), 'часы из кладовки зашли на кухонные шкафчики', c);
      await ev(() => window.__dev.scene.setDecor(false));
    },
  );

  // ---------- новая игра записывается после вступительной сценки (З23) ----------
  await step(
    'свой дом: «Новая игра» рядом с настоящей — во время сценки не записана (закрыли страницу — осталась прежняя); после сценки — две игры',
    async () => {
      await fresh({ name: 'Аня' });
      await ev(() => window.dispatchEvent(new Event('pagehide')));
      const games = () =>
        ev(() => ({
          n: window.__dev.games.listGames().length,
          names: window.__dev.games.listGames().map((g) => g.name),
          live: JSON.parse(localStorage.getItem('rhr-save-v1') || 'null'),
          text: (document.querySelector('#title .t-menu') || {}).textContent || '',
        }));
      const toTitle = async () => {
        await page.reload();
        await page.waitForSelector(sel('new'));
      };
      // «Новая игра» → «Играть!» → закрыли страницу посреди сценки
      await toTitle();
      await act('new');
      await page.fill('#title input', 'Боря');
      await act('play');
      await until(() => !!document.getElementById('intro'), undefined, 'сценка');
      let g = await games();
      expect(g.n === 1 && g.live && g.live.name === 'Аня', 'во время сценки новая игра уже записана', g);
      await ev(() => window.dispatchEvent(new Event('pagehide')));
      await toTitle();
      g = await games();
      expect(
        g.n === 1 && g.names.join() === 'Аня' && g.text.includes('С возвращением, Аня'),
        'после закрытия во время сценки — не прежняя игра',
        g,
      );
      // ещё раз — и досмотрели сценку: теперь игр две, живая — новая
      await act('new');
      await page.fill('#title input', 'Боря');
      await act('play');
      await act('skip');
      await act('go');
      await untilScene('villa');
      g = await games();
      expect(g.n === 2 && g.live.name === 'Боря' && g.names.includes('Аня'), 'после сценки нет новой игры', g);
    },
  );
};
