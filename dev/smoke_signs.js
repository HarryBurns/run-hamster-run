// Шаги автотеста про указатели (signpost, js/locations/common/props.js) во всех местах: на досках нет букв-стрелок
// (← → ↑ ↓ …) — направление показывает сама доска; «влево/вправо» — доска-стрелка со срезом, «вверх/вниз» и простая
// доска — прямоугольные; таблички «здесь» (here — название места, где стоишь) — без среза и без стрелок; каждая
// доска-стрелка показывает туда, где её место (сверка с картой), надписи помещаются, рисунки — из кэша спрайтов.
// Подключается из dev/smoke.js. Только эти шаги:  node dev/smoke.js <url> step:указатели
const lib = require('./lib.js');

// Куда ведёт каждая доска со стрелкой: [место, x, y указателя, слово с доски, цель — id места
// для whereIs или клетка [x, y]]. Новый указатель — добавь сюда его доски (шаг проверяет, что ни одна не забыта).
const WAYS = [
  ['world', 3, 4, 'В лес', 'exit:forest'],
  ['world', 92, 25, 'В пустыню', [94, 26]], // шлагбаум дороги в пустыню
  ['world', 31, 16, 'Площадь', [47, 20]], // площадь с рынком
  ['world', 31, 16, 'Домой', 'villa'],
  ['world', 62, 25, 'Пирс', 'pier'],
  ['world', 62, 25, 'Рынок', 'market'],
  ['world', 28, 35, 'Садовая', [15, 36]], // Садовая улочка
  ['world', 65, 36, 'Бассейн', 'pool'],
  ['world', 81, 47, 'Отель', 'hotel'],
  ['world', 81, 47, 'Горки', [93, 46]], // горки у отеля
  ['world', 65, 28, 'Отель', 'hotel'],
  ['world', 65, 47, 'Пирс', 'pier'],
  ['world', 65, 47, 'Пляж', 'beach'],
  ['forest', 12, 36, 'Костёр', 'campfire'],
  ['forest', 12, 36, 'Город', 'exit:town'],
  ['mountain', 23, 40, 'Вершина', 'lookout'],
  ['mountain', 23, 40, 'Источник', 'spring'],
  ['mountain', 22, 13, 'Пещеры', 'caves'],
  ['mountain', 22, 13, 'Поляна', 'snowman'],
  ['caves', 20, 24, 'Шахта', 'vein'],
  ['caves', 20, 24, 'Озеро', 'lake'],
  ['caves', 15, 13, 'Рисунки', 'paint'],
  ['caves', 15, 13, 'Грибы', 'grotto'],
  ['desert', 23, 29, 'Оазис', 'oasis'],
  ['desert', 23, 29, 'Колодец', 'well'],
  ['desert', 20, 13, 'Бархан', 'stars'],
  ['desert', 20, 13, 'Пирамида', 'pyramid'],
  ['desert', 30, 12, 'Раскопки', 'dig'],
  ['jungle', 21, 31, 'Лагерь', 'camp'],
  ['jungle', 21, 31, 'Роща', 'grove'],
  ['jungle', 23, 18, 'Мост', [22, 14]], // подвесной мост
  ['jungle', 23, 18, 'Река', 'canoe'],
  ['jungle', 23, 10, 'Водопад', 'fall'],
  ['jungle', 23, 10, 'Храм', 'temple'],
  ['cove', 10, 7, 'Грот', 'grotto'],
  ['cove', 10, 7, 'В город', 'grotto'], // грот и есть дорога в город
  ['island', 21, 24, 'Деревня', 'plaza'],
  ['island', 21, 24, 'Вулкан', 'volcano'],
  ['island', 32, 21, 'Хижина', 'guest'],
  ['island', 32, 21, 'Боулинг', 'bowling'],
];
const SCENES = ['world', 'forest', 'mountain', 'caves', 'desert', 'jungle', 'cove', 'island'];

module.exports = async function signs(ctx) {
  const { step, ev, expect, fresh } = lib(ctx);

  await step('указатели: без букв-стрелок, «здесь» без среза, направления по карте, надписи влезают, кэш', async () => {
    await fresh();
    const r = await ev(
      async ([SCENES, WAYS]) => {
        const d = window.__dev,
          P = await import('/js/locations/common/props.js'),
          ctx = document.createElement('canvas').getContext('2d'),
          bad = [],
          ways = new Map(WAYS.map((w) => [w.slice(0, 4).join(','), w[4]])),
          used = new Set();
        for (const id of SCENES.slice(1)) if (!d.QuestState.landOpen(id)) d.actions.openLand(id);
        // Табличка «здесь» рисуется без единой прямой линии-среза: только скруглённые доска и столбики (arcTo)
        const rec = new Proxy(ctx, {
          get(t, k) {
            if (k === 'lineTo') return () => t.__lines++;
            const v = t[k];
            return typeof v === 'function' ? v.bind(t) : v;
          },
          set(t, k, v) {
            t[k] = v;
            return true;
          },
        });
        let signsSeen = 0,
          heres = 0;
        for (const sc of SCENES) {
          const loc = d.locations[sc];
          d.go(sc);
          const m = loc.map;
          for (const o of m.objs) {
            if (o.type !== 'signpost') continue;
            signsSeen++;
            const v = (x) => (typeof x === 'function' ? x() : x) || '',
              boards = [
                [v(o.text), o.dir ?? 'r'],
                [v(o.text2), o.dir2 ?? 'l'],
              ],
              at = `${sc} ${o.tx},${o.ty}`;
            for (const [t] of boards) if (P.TEXT_ARROWS.test(t)) bad.push(`${at}: буква-стрелка в «${t}»`);
            if (o.here) {
              heres++;
              if (o.dir !== undefined || o.dir2 !== undefined) bad.push(`${at}: у таблички «здесь» есть направление`);
              ctx.__lines = 0;
              P.paintNameplate(rec, v(o.text), v(o.text2));
              if (ctx.__lines) bad.push(`${at}: у таблички «здесь» срез (${ctx.__lines} прямых)`);
              const fit = P.nameplateLayout(ctx, v(o.text), v(o.text2)).fit;
              if (fit < 0.8) bad.push(`${at}: надпись ужата до ${Math.round(fit * 100)} %`);
              continue;
            }
            boards.forEach(([t, dir]) => {
              if (!t) return;
              if (!['l', 'r', 'u', 'd', ''].includes(dir)) bad.push(`${at}: непонятное направление «${dir}»`);
              const L = P.signBoardLayout(ctx, `${dir}|${t}`),
                pts = P.signOutline(dir, L.x0, L.w, 0).length / 2;
              if (pts !== (dir === 'l' || dir === 'r' ? 5 : 4)) bad.push(`${at}: доска «${t}» (${dir}) — ${pts} углов`);
              if (L.fit < 0.8) bad.push(`${at}: «${t}» ужата до ${Math.round(L.fit * 100)} %`);
              if (!dir) return; // простая доска — пояснение, не направление
              const way = WAYS.find((w) => w[0] === sc && w[1] === o.tx && w[2] === o.ty && t.includes(w[3])),
                key = way && way.slice(0, 4).join(','),
                to = way && way[4];
              if (!way) return bad.push(`${at}: доски «${t}» нет в таблице WAYS (dev/smoke_signs.js)`);
              used.add(key);
              let tx, ty;
              if (Array.isArray(to)) [tx, ty] = to;
              else {
                const w = loc.whereIs(to);
                if (!w) return bad.push(`${at}: нет места ${to}`);
                tx = Math.floor(w.x / 48);
                ty = Math.floor(w.y / 48);
              }
              const dx = tx - o.tx,
                dy = ty - o.ty,
                ok = { l: dx < 0, r: dx > 0, u: dy < 0, d: dy > 0 }[dir];
              if (!ok) bad.push(`${at}: «${t}» показывает ${dir}, а место — dx ${dx}, dy ${dy}`);
            });
          }
        }
        for (const k of ways.keys()) if (!used.has(k)) bad.push(`в WAYS лишняя доска ${k}`);
        // рисунки указателей — из кэша спрайтов: постоим у таблички «Парк» и у указателя к пирсу
        d.go('world');
        const SP = d.topdown.SP;
        d.locations.world.debugTeleport(41, 31);
        await new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)));
        const park = !!SP.find('signHere:🌳 Парк:');
        d.locations.world.debugTeleport(62, 27);
        await new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)));
        const pier = !!SP.find('signpost:d|🎣 Пирс:l|🧺 Рынок');
        return { bad, signsSeen, heres, park, pier };
      },
      [SCENES, WAYS],
    );
    expect(!r.bad.length, 'указатели', r.bad);
    expect(r.signsSeen >= 25 && r.heres >= 3, 'указателей и табличек «здесь» меньше, чем ждали', r);
    expect(r.park && r.pier, 'рисунки указателей не в кэше спрайтов', r);
  });
};
