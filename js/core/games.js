// Несколько игр (профилей) в одном браузере. Подробно — docs/ARCHITECTURE.md, раздел 3 «Несколько игр».
//
//   rhr-save-v1      «живое» сохранение: игра, в которую играют сейчас (её пишет автосохранение, core/state.js).
//                    В самом сохранении лежит поле gid — чья это игра.
//   rhr-games        список игр: { v, active, seq, games: [{ id, name, day, minutes, money, weather, look, at }] }
//   rhr-game-<id>    «полка»: сохранение игры, в которую сейчас не играют (строка как есть, без разбора)
//   rhr-game-trash   последняя удалённая игра — про запас
//
// Правила надёжности: каждую запись проверяем чтением; сначала кладём старую игру на полку и только потом трогаем
// живое сохранение; с полки ничего не убираем, пока игру не удалили нарочно. Если список и живое сохранение
// разошлись (вкладку закрыли посреди переключения, игру записала старая версия страницы) — верим полю gid
// в живом сохранении, а без него считаем, что это активная игра (так единственное старое сохранение
// становится первой игрой).
import { G, KEY, BACKUP_KEY, newGame, load, unload, loadProblem } from './state.js';
import { dropPhotos } from './photos.js';

export const MAX_GAMES = 6;
const INDEX_KEY = 'rhr-games';
const TRASH_KEY = 'rhr-game-trash';
const slot = (id) => 'rhr-game-' + id;
const ID_RE = /^[\w-]{1,24}$/;

const get = (k) => {
  try {
    return localStorage.getItem(k);
  } catch (e) {
    return null;
  }
};
/** Записать и проверить чтением. false — не записалось (нет места, хранилище выключено). */
const put = (k, v) => {
  try {
    localStorage.setItem(k, v);
    return localStorage.getItem(k) === v;
  } catch (e) {
    return false;
  }
};
const del = (k) => {
  try {
    localStorage.removeItem(k);
  } catch (e) {
    /* хранилище недоступно */
  }
};
const parse = (raw) => {
  try {
    const s = JSON.parse(raw);
    return s && typeof s === 'object' && !Array.isArray(s) ? s : null;
  } catch (e) {
    return null;
  }
};

let idx = null; // список игр в памяти; читается заново в syncGames()

function readIndex() {
  const o = parse(get(INDEX_KEY) || '');
  const out = { v: 1, active: null, seq: 0, games: [] };
  if (!o) return out;
  if (Array.isArray(o.games))
    for (const g of o.games)
      if (g && typeof g.id === 'string' && ID_RE.test(g.id) && !out.games.some((x) => x.id === g.id)) out.games.push(g);
  out.seq = Number.isFinite(o.seq) ? o.seq : 0;
  out.active = typeof o.active === 'string' && out.games.some((g) => g.id === o.active) ? o.active : null;
  return out;
}
const writeIndex = () => put(INDEX_KEY, JSON.stringify(idx));
const find = (id) => idx.games.find((g) => g.id === id);
function newId() {
  let id;
  do id = 'g' + ++idx.seq;
  while (find(id) || get(slot(id)));
  return id;
}
/** Что показать в списке игр: берётся из сохранения (разобранного s) — имя, день, монеты, погода, наряд. */
function fillMeta(m, s) {
  if (!s) return m;
  if (typeof s.name === 'string') m.name = s.name.slice(0, 20);
  for (const k of ['day', 'minutes', 'money']) if (Number.isFinite(s[k])) m[k] = s[k];
  if (typeof s.weather === 'string') m.weather = s.weather;
  if (s.look && typeof s.look === 'object') m.look = s.look;
  return m;
}
const blankMeta = (id) => ({
  id,
  name: 'Хомка',
  day: 0,
  minutes: 450,
  money: 0,
  weather: 'sun',
  look: null,
  at: Date.now(),
});
/** Дописать в строку сохранения, чья это игра (если строку можно разобрать). */
function stamp(raw, id) {
  const s = parse(raw);
  if (!s || s.gid === id) return raw;
  s.gid = id;
  return JSON.stringify(s);
}

/**
 * Сверить список игр с тем, что лежит в хранилище, и вернуть его. Зовётся на заставке при запуске и после
 * каждого изменения. Ничего не стирает: только дописывает список и, если живого сохранения нет, достаёт с полки.
 */
export function syncGames() {
  idx = readIndex();
  const before = JSON.stringify(idx);
  const raw = get(KEY);
  if (raw) {
    const s = parse(raw);
    const gid = s && typeof s.gid === 'string' && ID_RE.test(s.gid) ? s.gid : null;
    if (gid && find(gid)) idx.active = gid;
    else if (gid || !idx.active) {
      // игры нет в списке: первое включение после обновления (единственное старое сохранение) или список пропал
      const m = blankMeta(gid || newId());
      idx.games.push(m);
      idx.active = m.id;
    }
    fillMeta(find(idx.active), s);
  } else {
    // живого сохранения нет: достаём с полки активную игру, а если её нет — ту, в которую играли последней
    idx.games = idx.games.filter((g) => get(slot(g.id)));
    const next = find(idx.active) || [...idx.games].sort((a, b) => (b.at || 0) - (a.at || 0))[0];
    idx.active = null;
    if (next && put(KEY, stamp(get(slot(next.id)), next.id))) idx.active = next.id;
  }
  // игру, которой нет ни на полке, ни в живом сохранении, показать нечем
  idx.games = idx.games.filter((g) => g.id === idx.active || get(slot(g.id)));
  if (JSON.stringify(idx) !== before) writeIndex();
  return listGames();
}
/** Список игр: первая — та, в которую играли последней (активная), дальше — по времени. */
export function listGames() {
  if (!idx) return syncGames();
  return [...idx.games].sort((a, b) => (b.id === idx.active) - (a.id === idx.active) || (b.at || 0) - (a.at || 0));
}
export function activeGame() {
  if (!idx) syncGames();
  return idx.active;
}
export const gamesFull = () => listGames().length >= MAX_GAMES;

/** Положить игру, в которую играли, на полку (перед тем как открыть или начать другую). */
function park() {
  const raw = get(KEY);
  if (!raw) return true;
  if (!idx.active) {
    const m = blankMeta(newId());
    idx.games.push(m);
    idx.active = m.id;
  }
  if (!put(slot(idx.active), raw)) return false;
  fillMeta(find(idx.active), parse(raw));
  return true;
}

/**
 * Открыть активную игру (ту, что в живом сохранении). Если сохранение не читается, load() уже отложил его копию
 * в rhr-save-backup: такую игру убираем из списка и пробуем следующую.
 * Возвращает { ok: G.state готово, problem: null | 'broken' | 'newer' }.
 */
export function openActive() {
  let problem = null;
  for (let i = 0; i <= MAX_GAMES; i++) {
    syncGames();
    if (!idx.active) return { ok: false, problem };
    if (load()) {
      if (G.state.gid !== idx.active) G.state.gid = idx.active; // запишется с первым же сохранением
      fillMeta(find(idx.active), G.state);
      writeIndex();
      return { ok: true, problem };
    }
    if (loadProblem !== 'broken') return { ok: false, problem: loadProblem };
    problem = 'broken';
    const raw = get(KEY);
    if (raw && get(BACKUP_KEY) !== raw) return { ok: false, problem }; // копии нет — ничего не трогаем
    del(KEY);
    del(slot(idx.active));
    idx.games = idx.games.filter((g) => g.id !== idx.active);
    idx.active = null;
    writeIndex();
  }
  return { ok: false, problem };
}

/** Открыть другую игру из списка. true — G.state готово. Игра, в которую играли, остаётся на полке. */
export function switchGame(id) {
  syncGames();
  if (!find(id)) return false;
  if (id !== idx.active) {
    const mine = get(KEY),
      other = get(slot(id));
    if (!other || !park()) return false;
    if (!put(KEY, stamp(other, id))) {
      if (mine) put(KEY, mine);
      return false;
    }
    idx.active = id;
  }
  find(id).at = Date.now();
  writeIndex();
  unload();
  if (!load()) return false;
  if (G.state.gid !== id) G.state.gid = id;
  return true;
}

/**
 * Начать новую игру рядом с остальными. Возвращает null (получилось, G.state — новая игра) или причину:
 * 'full' — мест нет, 'store' — не удалось записать (хранилище переполнено); тогда всё остаётся как было.
 */
export function createGame(name) {
  syncGames();
  if (idx.games.length >= MAX_GAMES) return 'full';
  const mine = get(KEY);
  if (!park()) return 'store';
  const keep = G.state;
  const id = newId();
  newGame(name);
  G.state.gid = id;
  if (!put(KEY, JSON.stringify(G.state))) {
    if (mine) put(KEY, mine);
    else del(KEY);
    // хранилища нет совсем (строгий частный режим): играть можно, просто игра не сохранится — как и раньше
    if (!mine && !idx.games.length) return null;
    G.state = keep;
    return 'store';
  }
  idx.games.push(fillMeta(blankMeta(id), G.state));
  idx.active = id;
  writeIndex();
  return null;
}

/** Удалить игру (только по явной просьбе игрока). Последняя удалённая лежит про запас в rhr-game-trash. */
export function deleteGame(id) {
  syncGames();
  const m = find(id);
  if (!m) return false;
  const live = id === idx.active;
  const raw = live ? get(KEY) : get(slot(id));
  if (raw) put(TRASH_KEY, JSON.stringify({ meta: m, at: Date.now(), raw }));
  del(slot(id));
  dropPhotos(id); // снимки фотоальбома этой игры (core/photos.js)
  if (live) {
    del(KEY);
    unload();
    idx.active = null;
  }
  idx.games = idx.games.filter((g) => g !== m);
  writeIndex();
  syncGames(); // если удалили активную — живой станет последняя из оставшихся
  return true;
}
