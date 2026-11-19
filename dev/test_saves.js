// Проверка сохранений без браузера: починка (repair), перенос старых версий, несколько игр (профили), нечитаемые
// сохранения, корзина, выгрузка в файл и загрузка из файла, защита от второй вкладки и от старой страницы.
// Запуск:  node dev/test_saves.js      (секунды; код возврата 1 — есть ошибки)
//
// localStorage подменяется простым объектом в памяти (с пределом места — чтобы проверить «хранилище переполнено»).
// IndexedDB в node нет, поэтому снимки альбома идут запасным путём, через localStorage, — сама база и перенос
// снимков в неё проверяются в браузере: node dev/smoke.js <url> "step:надёжность".
// «Вторая вкладка» — второй экземпляр модуля core/state.js (импорт с другим адресом) над тем же хранилищем.
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const JS = path.join(require('./root.js'), 'js');
const url = (f) => pathToFileURL(path.join(JS, f)).href;
const sample = (v) => fs.readFileSync(path.join(__dirname, 'saves', `v${v}.json`), 'utf8');

// ---------- подставное хранилище ----------
const store = {
  data: new Map(),
  limit: Infinity, // сколько символов помещается (ключи + значения)
  off: false, // хранилище выключено: любое обращение бросает исключение
  used(skip) {
    let n = 0;
    for (const [k, v] of this.data) if (k !== skip) n += k.length + v.length;
    return n;
  },
};
globalThis.localStorage = {
  getItem(k) {
    if (store.off) throw new Error('SecurityError');
    return store.data.has(k) ? store.data.get(k) : null;
  },
  setItem(k, v) {
    if (store.off) throw new Error('SecurityError');
    v = String(v);
    if (store.used(k) + k.length + v.length > store.limit) {
      const e = new Error('quota');
      e.name = 'QuotaExceededError';
      throw e;
    }
    store.data.set(k, v);
  },
  removeItem(k) {
    if (store.off) throw new Error('SecurityError');
    store.data.delete(k);
  },
  key: (i) => [...store.data.keys()][i] ?? null,
  get length() {
    return store.data.size;
  },
  clear: () => store.data.clear(),
};
const ls = globalThis.localStorage;
const KEY = 'rhr-save-v1',
  INDEX = 'rhr-games',
  TRASH = 'rhr-game-trash',
  BACKUP = 'rhr-save-backup',
  OWNER = 'rhr-owner';
const snapshot = () => JSON.stringify([...store.data].sort());
const live = () => JSON.parse(ls.getItem(KEY));
const index = () => JSON.parse(ls.getItem(INDEX));

// ---------- мини-тестер ----------
let failed = 0,
  total = 0;
const warn = console.warn;
async function test(name, fn) {
  total++;
  ls.clear();
  store.limit = Infinity;
  store.off = false;
  console.warn = () => {}; // «Сохранение не прочитано» — здесь это часть проверки, не шум
  try {
    await fn();
    console.log('  ✓ ' + name);
  } catch (e) {
    failed++;
    console.log('  ✗ ' + name + '\n      ' + String((e && e.stack) || e).split('\n').slice(0, 4).join('\n      '));
  }
  console.warn = warn;
}
function ok(cond, msg, extra) {
  if (!cond) throw new Error(msg + (extra !== undefined ? ' — ' + JSON.stringify(extra).slice(0, 400) : ''));
}
const eq = (a, b, msg) => ok(JSON.stringify(a) === JSON.stringify(b), msg, { got: a, want: b });

(async () => {
  const S = await import(url('core/state.js'));
  const Gm = await import(url('core/games.js'));
  const P = await import(url('core/photos.js'));
  const E = await import(url('core/events.js'));
  const A = await import(url('core/actions.js'));
  const { BUILD } = await import(url('data/index.js'));
  const { G } = S;
  const VER = S.saveVersion();
  const pic = (n) => ({ id: 'p' + n, day: n, place: 'Город', date: 'Июнь', caption: 'Снимок ' + n, src: 'data:image/jpeg;base64,AAAA' + n });
  /** Начать игру с именем и «поиграть»: монеты отличают игры друг от друга. */
  const play = (name, money) => {
    eq(Gm.createGame(name), null, 'игра не создалась');
    A.mutate((s) => (s.money = money));
    ok(S.save(), 'не сохранилось');
    return G.state.gid;
  };

  console.log('Сохранения: починка и перенос');
  for (const v of [1, 2, 3, 4, 5])
    await test(`образец v${v} открывается, становится версией ${VER} со сборкой ${BUILD}, имя и вещи на месте`, () => {
      const raw = sample(v),
        was = JSON.parse(raw);
      ls.setItem(KEY, raw);
      const r = Gm.openActive();
      ok(r.ok && !r.problem && !r.lost.length, 'не открылось', r);
      const s = G.state;
      eq([s.v, s.build, s.name], [VER, BUILD, was.name], 'версия, сборка, имя');
      ok(was.clothes.every((c) => s.clothes.includes(c)), 'пропала одежда');
      if (v < VER) eq(ls.getItem(BACKUP), raw, 'перед переносом нет копии');
      ok(typeof s.gid === 'string' && index().active === s.gid && index().games.length === 1, 'старое сохранение не стало первой игрой', index());
      // второй раз — то же самое: починка ничего не портит
      ok(S.save(), 'не сохранилось');
      const once = ls.getItem(KEY);
      ok(Gm.openActive().ok && S.save() && ls.getItem(KEY) === once, 'повторное открытие изменило сохранение');
    });
  await test('repair: мусор в полях чинится, неизвестные id уходят, игра открывается', () => {
    const s = JSON.parse(sample(5));
    Object.assign(s, { money: 'много', clothes: ['tee_heart', 'нет_такой', 42], villa: 'дом', friends: null, pos: { scene: 5 }, gid: 'плохой id!', day: NaN, stickers: 7 });
    s.storage = { нет_такой_мебели: 3 };
    ls.setItem(KEY, JSON.stringify(s));
    ok(Gm.openActive().ok, 'не открылось');
    const g = G.state;
    ok(Number.isFinite(g.money) && Number.isFinite(g.day), 'числа не починены', [g.money, g.day]);
    ok(Array.isArray(g.villa) && Array.isArray(g.stickers) && g.friends && typeof g.friends === 'object', 'поля не починены');
    ok(g.clothes.includes('tee_heart') && !g.clothes.includes('нет_такой') && !g.clothes.includes(42), 'одежда не почищена', g.clothes);
    ok(!('нет_такой_мебели' in g.storage), 'неизвестная мебель осталась');
    ok(g.pos && typeof g.pos.scene === 'string', 'позиция не починена', g.pos);
    ok(/^[\w-]{1,24}$/.test(g.gid), 'gid не починен', g.gid);
  });
  await test('checkSave: не сохранение — broken; версия или сборка новее кода — newer, и оно не меняется', () => {
    for (const bad of [null, 5, 'строка', [], {}, { v: 0 }, { v: 'пять' }, { v: 1.5 }]) eq(S.checkSave(bad), 'broken', 'ожидался broken');
    const a = { ...JSON.parse(sample(5)), v: VER + 1 },
      b = { ...JSON.parse(sample(5)), build: BUILD + 1 };
    const was = JSON.stringify(b);
    eq([S.checkSave(a), S.checkSave(b)], ['newer', 'newer'], 'ожидался newer');
    eq(JSON.stringify(b), was, 'сохранение более новой игры изменилось');
    eq(S.checkSave(JSON.parse(sample(1))), null, 'образец v1 не прошёл проверку');
  });
  await test('сохранение от более новой сборки не открывается и не перезаписывается (старая страница из кэша)', () => {
    const raw = JSON.stringify({ ...JSON.parse(sample(5)), build: BUILD + 1, gid: 'g1' });
    ls.setItem(KEY, raw);
    const r = Gm.openActive();
    eq([r.ok, r.problem], [false, 'newer'], 'ожидался отказ newer');
    ok(!G.state || G.state.build !== BUILD + 1, 'игра открылась');
    eq(ls.getItem(KEY), raw, 'сохранение изменилось');
    // «Новая игра» кладёт его на полку как есть
    eq(Gm.createGame('Новая'), null, 'новая игра не началась');
    ok([...store.data.values()].includes(raw), 'сохранение более новой игры пропало');
  });

  console.log('Несколько игр');
  await test('создать три игры, переключаться — у каждой свои монеты, ничего не теряется', () => {
    const a = play('Ириска', 111),
      b = play('Кнопка', 222),
      c = play('Плюша', 333);
    eq([Gm.listGames().length, Gm.listGames()[0].name], [3, 'Плюша'], 'игр три, последняя — первая в списке');
    for (const [id, money] of [[a, 111], [b, 222], [c, 333], [a, 111]]) {
      ok(Gm.switchGame(id), 'не переключилось');
      eq([G.state.gid, G.state.money, Gm.activeGame(), live().gid], [id, money, id, id], 'открылась не та игра');
    }
    A.mutate((s) => (s.money = 999));
    S.save();
    ok(Gm.switchGame(b) && Gm.switchGame(a), 'не переключилось');
    eq(G.state.money, 999, 'прогресс потерялся при переключении');
    eq(Gm.listGames().find((g) => g.id === a).money, 999, 'карточка игры не обновилась');
  });
  await test(`больше ${Gm.MAX_GAMES} игр не завести; список и живое сохранение разошлись — верим полю gid`, () => {
    for (let i = 0; i < Gm.MAX_GAMES; i++) play('Игра' + i, i);
    eq(Gm.createGame('Лишняя'), 'full', 'лишняя игра создалась');
    eq(Gm.listGames().length, Gm.MAX_GAMES, 'число игр');
    // вкладку закрыли посреди переключения: в списке активна одна игра, а в живом сохранении — другая
    const other = Gm.listGames()[3].id;
    ok(Gm.switchGame(Gm.listGames()[1].id), 'не переключилось'); // теперь на полке лежат все игры
    ls.setItem(KEY, ls.getItem('rhr-game-' + other));
    Gm.syncGames();
    eq(Gm.activeGame(), other, 'активная игра не по gid');
    // список игр пропал совсем — игры с полок возвращаются в список
    ls.removeItem(INDEX);
    eq(Gm.syncGames().length, Gm.MAX_GAMES, 'игры с полок не вернулись в список');
  });
  await test('хранилище переполнено: новая игра и переключение говорят «не вышло», всё остаётся как было; save() не теряет изменения', () => {
    const a = play('Ириска', 111);
    play('Кнопка', 222);
    ok(Gm.switchGame(a), 'не переключилось');
    store.limit = store.used() - 10; // всё, что лежит, лежит, но ни одна новая запись уже не помещается
    const before = snapshot();
    eq(Gm.createGame('Плюша'), 'store', 'ожидалось «нет места»');
    eq(snapshot(), before, 'хранилище изменилось');
    eq([G.state.gid, G.state.money], [a, 111], 'игра в памяти подменилась');
    let fails = 0;
    const off = E.on('saveFail', (e) => (fails += e.quota ? 1 : 0));
    A.mutate((s) => (s.name = 'И'.repeat(14) + 'x'.repeat(400)));
    eq([S.save(), S.save(), fails], [false, false, 1], 'переполнение: save и событие saveFail (одно)');
    eq(snapshot(), before, 'хранилище изменилось при неудачной записи');
    store.limit = Infinity;
    ok(S.save() && live().name.length > 400, 'после освобождения места не записалось');
    off();
  });
  await test('хранилище выключено совсем: играть можно, ничего не падает', async () => {
    store.off = true;
    eq(Gm.syncGames(), [], 'список не пуст');
    eq(Gm.openActive().ok, false, 'что-то открылось');
    eq(Gm.createGame('Хомка'), null, 'новая игра не началась');
    eq(S.save(), false, 'save() сказал «записалось»');
    eq(await P.addPhoto(pic(1)), 'fail', 'снимок «записался»');
    eq(await P.loadPhotos(), [], 'снимки');
    eq((await Gm.importGame(sample(5))).why, 'store', 'загрузка из файла');
  });

  console.log('Удаление, корзина, снимки');
  await test('удалённая игра лежит в корзине вместе со снимками и возвращается новой игрой; остальные не тронуты', async () => {
    const a = play('Ириска', 111);
    await P.addPhoto(pic(1));
    await P.addPhoto(pic(2));
    const b = play('Кнопка', 222);
    await P.addPhoto(pic(3));
    eq(Gm.trashInfo(), null, 'корзина не пуста');
    ok(Gm.deleteGame(a), 'не удалилось');
    eq(Gm.listGames().map((g) => g.id), [b], 'список после удаления');
    eq([Gm.trashInfo().name, Gm.trashInfo().money], ['Ириска', 111], 'корзина');
    eq((await P.loadPhotos(a)).length, 0, 'снимки удалённой игры остались под её id');
    eq((await P.loadPhotos('trash')).length, 2, 'снимки не ушли в корзину');
    const r = await Gm.restoreTrash();
    ok(r.ok && r.id !== a && r.id !== b && r.name === 'Ириска', 'не вернулась', r);
    eq([Gm.trashInfo(), Gm.listGames().length, Gm.activeGame()], [null, 2, b], 'после возврата');
    eq((await P.loadPhotos(r.id)).map((p) => p.id), ['p1', 'p2'], 'снимки не вернулись');
    eq((await P.loadPhotos(b)).map((p) => p.id), ['p3'], 'снимки другой игры');
    ok(Gm.switchGame(r.id) && G.state.money === 111 && G.state.gid === r.id, 'возвращённая игра не открылась');
    eq((await Gm.restoreTrash()).why, 'none', 'корзина вернулась дважды');
  });
  await test('удалили активную игру — живой становится последняя из оставшихся; удалили единственную — пусто, она в корзине', () => {
    const a = play('Ириска', 111),
      b = play('Кнопка', 222);
    ok(Gm.deleteGame(b), 'не удалилось');
    eq([Gm.activeGame(), live().gid, live().money], [a, a, 111], 'живая игра после удаления активной');
    ok(Gm.deleteGame(a), 'не удалилось');
    eq([Gm.listGames().length, ls.getItem(KEY), Gm.trashInfo().name], [0, null, 'Ириска'], 'после удаления единственной');
  });
  await test(`снимки: не больше ${P.PHOTO.max}, «заменить самый старый», удаление, мусор не читается`, async () => {
    play('Ириска', 1);
    for (let i = 0; i < P.PHOTO.max; i++) eq(await P.addPhoto(pic(i)), 'ok', 'снимок не записался');
    eq(await P.addPhoto(pic(99)), 'full', 'альбом не полон');
    eq(await P.addPhoto(pic(99), { replaceOldest: true }), 'ok', 'замена самого старого');
    let list = await P.loadPhotos();
    eq([list.length, list[0].id, list[list.length - 1].id], [P.PHOTO.max, 'p1', 'p99'], 'список снимков');
    await P.removePhoto('p99');
    eq((await P.loadPhotos()).length, P.PHOTO.max - 1, 'снимок не удалился');
    eq(P.cleanPhotos([null, 5, { src: 'http://чужое' }, { src: 'data:image/png;base64,AA', caption: 7 }, 'x']).length, 1, 'мусор в снимках');
    eq(P.cleanPhotos('не json'), [], 'мусор вместо списка');
    ok(!/data:image/.test(ls.getItem(KEY)), 'снимок попал в сохранение');
  });

  console.log('Нечитаемое сохранение');
  await test('живое сохранение испорчено, копия на полке цела — игра открывается из копии, испорченное лежит про запас', () => {
    const a = play('Ириска', 111);
    const b = play('Кнопка', 222);
    ok(Gm.switchGame(a), 'не переключилось'); // теперь у «Ириски» есть копия на полке
    A.mutate((s) => (s.money = 555));
    S.save();
    ls.setItem(KEY, '{"v":5,"name":"Ириска","оборвано');
    const broken = ls.getItem(KEY);
    const r = Gm.openActive();
    ok(r.ok && r.restored === 'Ириска' && !r.lost.length, 'не открылась из копии', r);
    eq([G.state.gid, G.state.money], [a, 111], 'открылась не копия с полки');
    eq(ls.getItem(BACKUP), broken, 'испорченное сохранение не отложено');
    eq(Gm.listGames().map((g) => g.id).sort(), [a, b].sort(), 'список игр');
  });
  await test('не читается ни игра, ни её копия — ничего не стирается: строка на полке, игра среди «отложенных», открывается следующая', async () => {
    const a = play('Ириска', 111);
    const b = play('Кнопка', 222);
    await P.addPhoto(pic(1));
    const junk = 'совсем не сохранение';
    ls.setItem(KEY, junk);
    const r = Gm.openActive();
    ok(r.ok && r.lost.length === 1 && r.lost[0] === 'Кнопка' && !r.restored, 'итог открытия', r);
    eq([G.state.gid, G.state.money], [a, 111], 'не открылась следующая игра');
    eq(ls.getItem('rhr-game-' + b), junk, 'нечитаемая строка не осталась на полке');
    eq(Gm.listGames().map((g) => g.id), [a], 'список игр');
    eq(Gm.lostGames().map((l) => [l.id, l.name]), [[b, 'Кнопка']], 'отложенные');
    eq((await P.loadPhotos(b)).length, 1, 'снимки отложенной игры пропали');
    // её можно выгрузить в файл (как есть) и попробовать открыть снова — пока не читается, остаётся отложенной
    const f = await Gm.exportGame(b);
    ok(f && JSON.parse(f.text).raw === junk && JSON.parse(f.text).photos.length === 1, 'отложенная игра не выгрузилась');
    eq(Gm.retryLost(b), false, 'нечитаемая «открылась»');
    eq(Gm.lostGames().length, 1, 'отложенная пропала');
    // новая игра не занимает id отложенной
    const c = play('Плюша', 333);
    ok(c !== b && ls.getItem('rhr-game-' + b) === junk, 'новая игра затёрла отложенную');
  });
  await test('ошибка в нашем коде (упал repair) — игра отложена целой и после исправления открывается кнопкой «ещё раз»', () => {
    const a = play('Ириска', 111);
    play('Кнопка', 222);
    ok(Gm.switchGame(a), 'не переключилось');
    A.mutate((s) => (s.money = 777));
    S.save();
    const bad = JSON.stringify({ v: 3, name: 'Ириска', gid: a, day: 1, look: 5, flags: 5, quests: 5 });
    // «ошибка в коде»: подменяем миграцию, чтобы она падала на сохранении старой версии
    const m3 = S.MIGRATIONS[3];
    S.MIGRATIONS[3] = () => {
      throw new Error('ошибка в коде');
    };
    ls.setItem(KEY, bad);
    ls.setItem('rhr-game-' + a, bad);
    const r = Gm.openActive();
    S.MIGRATIONS[3] = m3;
    ok(r.ok && r.lost[0] === 'Ириска', 'итог открытия', r);
    eq(ls.getItem('rhr-game-' + a), bad, 'сохранение не отложено как есть');
    eq(Gm.lostGames().map((l) => l.id), [a], 'отложенные');
    // «ошибку исправили»: то же сохранение теперь читается
    ok(Gm.retryLost(a), 'после исправления не вернулась в список');
    eq([Gm.lostGames().length, Gm.listGames().length], [0, 2], 'списки после возврата');
    ok(Gm.switchGame(a) && G.state.gid === a && G.state.v === VER, 'возвращённая игра не открылась');
  });
  await test(`отложенных не больше ${Gm.LOST_MAX}: самое старое убирается, игры из списка не страдают`, () => {
    const keep = play('Главная', 1);
    const ids = [];
    for (let i = 0; i < Gm.LOST_MAX + 2; i++) {
      const id = play('Сломанная' + i, 100 + i);
      ids.push(id);
      ls.setItem(KEY, 'мусор ' + i);
      const r = Gm.openActive();
      ok(r.ok && G.state.gid === keep, 'главная игра не открылась', r);
      const idxNow = index();
      idxNow.lost.forEach((l, k) => (l.at = k + 1)); // «время» — по порядку, а не по часам теста
      ls.setItem(INDEX, JSON.stringify(idxNow));
    }
    eq(Gm.lostGames().map((l) => l.id), ids.slice(-Gm.LOST_MAX).reverse(), 'какие сохранения отложены');
    for (const id of ids.slice(0, 2)) eq(ls.getItem('rhr-game-' + id), null, 'самое старое отложенное не убрано');
    eq([Gm.listGames().map((g) => g.id), G.state.money], [[keep], 1], 'главная игра');
    const shelves = [...store.data.keys()].filter((k) => k.startsWith('rhr-game-') && k !== TRASH);
    ok(shelves.length <= Gm.LOST_MAX + 1, 'полки копятся', shelves);
  });
  await test('все игры не читаются — список пуст, но каждая строка лежит на своей полке', () => {
    const ids = [play('А', 1), play('Б', 2), play('В', 3)];
    for (const id of ids) ls.setItem('rhr-game-' + id, 'мусор ' + id);
    ls.setItem(KEY, 'мусор ' + ids[2]);
    const r = Gm.openActive();
    eq([r.ok, r.problem, r.lost.length], [false, 'broken', 3], 'итог открытия');
    for (const id of ids) eq(ls.getItem('rhr-game-' + id), 'мусор ' + id, 'строка пропала');
    eq(Gm.lostGames().length, 3, 'отложенные');
  });

  console.log('Выгрузка в файл и загрузка из файла');
  await test('выгрузка и загрузка: та же игра со снимками появляется новой, старые игры и живое сохранение не тронуты', async () => {
    const a = play('Ириска', 4321);
    await P.addPhoto(pic(1));
    await P.addPhoto(pic(2));
    const b = play('Кнопка', 222);
    const f = await Gm.exportGame(a);
    ok(/^Пушистая жизнь - Ириска - \d{4}-\d\d-\d\d\.json$/.test(f.name), 'имя файла', f.name);
    const file = JSON.parse(f.text);
    eq([file.app, file.format, file.build, file.name, file.save.money, file.photos.length], ['rhr-game', 1, BUILD, 'Ириска', 4321, 2], 'что в файле');
    const before = snapshot();
    const r = await Gm.importGame(f.text);
    ok(r.ok && r.name === 'Ириска' && r.photos === 2 && r.id !== a && r.id !== b, 'не загрузилась', r);
    for (const k of [KEY, 'rhr-game-' + a, 'rhr-photos-' + a, 'rhr-photos-' + b])
      eq(ls.getItem(k), JSON.parse(before).find((e) => e[0] === k)?.[1] ?? null, 'загрузка тронула ' + k);
    eq([Gm.listGames().length, Gm.activeGame(), G.state.gid], [3, b, b], 'список и активная игра');
    eq((await P.loadPhotos(r.id)).map((p) => p.caption), ['Снимок 1', 'Снимок 2'], 'снимки из файла');
    ok(Gm.switchGame(r.id), 'загруженная игра не открылась');
    const mine = { ...G.state },
      orig = { ...file.save };
    eq(S.checkSave(orig), null, 'выгруженное сохранение не проходит проверку'); // загрузка чинит его так же
    delete mine.gid;
    delete orig.gid;
    eq(mine, orig, 'загруженная игра отличается от выгруженной');
    // активная игра выгружается из живого сохранения
    A.mutate((s) => (s.money = 5));
    S.save();
    eq(JSON.parse((await Gm.exportGame(r.id)).text).save.money, 5, 'активная игра выгрузилась не из живого сохранения');
  });
  await test('загрузка в пустой браузер (данные сайта стёрты): игра из файла становится живой; годится и «голое» сохранение старой версии', async () => {
    play('Ириска', 4321);
    const f = await Gm.exportGame(Gm.activeGame());
    ls.clear();
    eq(Gm.syncGames(), [], 'после очистки что-то осталось');
    const r = await Gm.importGame(f.text);
    ok(r.ok, 'не загрузилась', r);
    const o = Gm.openActive();
    ok(o.ok && G.state.money === 4321 && G.state.gid === r.id, 'не открылась', o);
    const old = await Gm.importGame(sample(1)); // строка из хранилища версии 1, без обёртки
    ok(old.ok && Gm.switchGame(old.id) && G.state.v === VER && G.state.name === JSON.parse(sample(1)).name, 'старое сохранение файлом', old);
    eq(Gm.listGames().length, 2, 'игр не две');
  });
  await test('плохие файлы: понятная причина, хранилище не меняется', async () => {
    play('Ириска', 1);
    const good = (await Gm.exportGame(Gm.activeGame())).text;
    const before = snapshot();
    const tries = {
      '': 'bad',
      'привет': 'bad',
      '[1,2,3]': 'bad',
      '{"фото":"кота"}': 'bad',
      [good.slice(0, good.length / 2)]: 'bad',
      '{"app":"rhr-game","format":1}': 'bad',
      '{"app":"rhr-game","save":{"v":"пять"}}': 'bad',
      '{"app":"rhr-game","raw":"мусор"}': 'bad',
      [JSON.stringify({ ...JSON.parse(good), build: BUILD + 1 })]: 'newer',
      [JSON.stringify({ ...JSON.parse(sample(5)), v: VER + 3 })]: 'newer',
    };
    for (const [text, why] of Object.entries(tries)) eq((await Gm.importGame(text)).why, why, 'файл: ' + text.slice(0, 40));
    eq((await Gm.importGame(null)).why, 'bad', 'не строка');
    eq(snapshot(), before, 'плохой файл изменил хранилище');
    // места нет
    for (let i = 1; i < Gm.MAX_GAMES; i++) play('Игра' + i, i);
    eq((await Gm.importGame(good)).why, 'full', 'мест нет');
    ok(Gm.deleteGame(Gm.activeGame()), 'не удалилось');
    store.limit = store.used() + 100;
    const b2 = snapshot();
    eq((await Gm.importGame(good)).why, 'store', 'хранилище переполнено');
    eq(snapshot(), b2, 'неудачная загрузка изменила хранилище');
  });
  await test('файл с подвохом: длинное имя, чужие поля, мусор в снимках — чинится, как любое сохранение', async () => {
    const s = { ...JSON.parse(sample(5)), name: 'Я'.repeat(500), money: -1e99, clothes: ['нет_такой'], gid: 'чужой id' };
    const file = { app: 'rhr-game', format: 1, build: 1, save: s, photos: [{ src: 'javascript:alert(1)' }, pic(1), { src: 'data:image/png;base64,' + 'A'.repeat(7e5) }] };
    const r = await Gm.importGame(JSON.stringify(file));
    ok(r.ok && r.name.length === 14 && r.photos === 1, 'итог', r);
    ok(Gm.switchGame(r.id) && G.state.gid === r.id && !G.state.clothes.includes('нет_такой'), 'не починилось');
    eq((await P.loadPhotos(r.id)).length, 1, 'снимки');
  });

  console.log('Вторая вкладка и старая страница');
  await test('игру открыли во второй вкладке: первая перестаёт сохранять и говорит об этом, вторая пишет дальше', async () => {
    play('Ириска', 100);
    const tab2 = await import(url('core/save.js') + '?tab2'); // вторая вкладка: свой модуль, то же хранилище
    ok(tab2.load() && tab2.G.state.money === 100, 'вторая вкладка не открыла игру');
    let lost = [];
    const off = E.on('saveLost', (e) => lost.push(e.why));
    A.mutate((s) => (s.money = 150));
    ok(S.save() && live().money === 150, 'первая вкладка не сохранила до того, как игру начали во второй');
    tab2.claimSave(); // «Продолжить» во второй вкладке
    tab2.G.state.money = 200;
    ok(tab2.save() && live().money === 200, 'вторая вкладка не сохранила');
    A.mutate((s) => (s.money = 999));
    eq([S.save(), live().money, lost, S.saveLost()], [false, 200, ['tab'], 'tab'], 'первая вкладка затёрла вторую');
    A.mutate((s) => (s.money = 998));
    S.flush();
    eq([S.save(), live().money, lost.length], [false, 200, 1], 'первая вкладка пишет снова или шлёт событие дважды');
    tab2.G.state.money = 300;
    ok(tab2.save() && live().money === 300 && !tab2.saveLost(), 'вторая вкладка перестала сохранять');
    off();
  });
  await test('игру открыла страница с более новым кодом: старая не перезаписывает и просит обновиться', async () => {
    const tab3 = await import(url('core/save.js') + '?tab3');
    ls.setItem(KEY, sample(5));
    ok(tab3.load(), 'не открылось');
    tab3.claimSave();
    tab3.G.state.money = 10;
    ok(tab3.save() && live().money === 10, 'не сохранила');
    let lost = [];
    const off = E.on('saveLost', (e) => lost.push(e.why));
    // другая вкладка с новой сборкой записала себя и своё сохранение
    ls.setItem(OWNER, `новая:${BUILD + 1}:${Date.now()}`);
    ls.setItem(KEY, JSON.stringify({ ...JSON.parse(sample(5)), build: BUILD + 1, money: 77 }));
    tab3.G.state.money = 20;
    eq([tab3.save(), live().money, live().build, lost, tab3.saveLost()], [false, 77, BUILD + 1, ['newer'], 'newer'], 'старая страница перезаписала новое сохранение');
    eq(tab3.claimSave(), false, 'потерявшая игру вкладка снова объявила себя хозяйкой');
    off();
  });
  await test('ключ хозяина стёрли (очистили хранилище) — игра сохраняется дальше', async () => {
    const tab4 = await import(url('core/save.js') + '?tab4');
    ls.setItem(KEY, sample(5));
    ok(tab4.load() && tab4.claimSave(), 'не открылось');
    ls.clear();
    tab4.G.state.money = 31;
    ok(tab4.save() && live().money === 31 && ls.getItem(OWNER) && !tab4.saveLost(), 'не сохранилось после очистки');
  });

  console.log(failed ? `\nОШИБКИ: ${failed} из ${total}` : `\nВСЁ ХОРОШО (${total} проверок сохранений)`);
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
