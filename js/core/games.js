// Несколько игр (профилей) в одном браузере. Подробно — docs/ARCHITECTURE.md, раздел 3 «Несколько игр».
//
//   rhr-save-v1      «живое» сохранение: игра, в которую играют сейчас (её пишет автосохранение, core/state.js).
//                    В самом сохранении лежит поле gid — чья это игра.
//   rhr-games        список игр: { v, active, seq, games: [{ id, name, day, minutes, money, weather, look, at }] }
//   rhr-game-<id>    «полка»: сохранение игры, в которую сейчас не играют (строка как есть, без разбора)
//   rhr-game-trash   последняя удалённая игра — про запас; её можно вернуть (restoreTrash)
//   rhr-owner        какая вкладка сейчас играет (core/state.js: защита от второй вкладки)
//   снимки фотоальбома — в IndexedDB, по ключу на игру (core/photos.js)
//
// Игру можно выгрузить в файл и загрузить из файла (exportGame, importGame) — на случай, если браузер сотрёт
// данные сайта. Проверяется без браузера: node dev/test_saves.js.
//
// Правила надёжности: каждую запись проверяем чтением; сначала кладём старую игру на полку и только потом трогаем
// живое сохранение; с полки ничего не убираем, пока игру не удалили нарочно. Если список и живое сохранение
// разошлись (вкладку закрыли посреди переключения, игру записала старая версия страницы) — верим полю gid
// в живом сохранении, а без него считаем, что это активная игра (так единственное старое сохранение
// становится первой игрой).
import {
  G,
  KEY,
  BACKUP_KEY,
  OWNER_KEY,
  START_MINUTES,
  newGame,
  load,
  unload,
  loadProblem,
  checkSave,
  claimSave,
} from './state.js';
import { dropPhotos, movePhotos, loadPhotos, savePhotos, cleanPhotos } from './photos.js';
import { BUILD, NAME_MAX, START_DAY, START_MONEY } from '../data/index.js';

export const MAX_GAMES = 6;
export const LOST_MAX = 3; // сколько нечитаемых сохранений лежит про запас; самое старое сверх этого убирается
const INDEX_KEY = 'rhr-games';
const TRASH_KEY = 'rhr-game-trash';
const SLOT = 'rhr-game-';
const slot = (id) => SLOT + id;
const ID_RE = /^[\w-]{1,24}$/;
const okId = (id) => typeof id === 'string' && ID_RE.test(id) && id !== 'trash';
const FILE_APP = 'rhr-game'; // отметка файла выгрузки
const FILE_MAX = 12e6; // файл больше этого (символов) — точно не наша игра

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
  const out = { v: 1, active: null, seq: 0, games: [], lost: [] };
  if (!o) return out;
  if (Array.isArray(o.games))
    for (const g of o.games) if (g && okId(g.id) && !out.games.some((x) => x.id === g.id)) out.games.push(g);
  // lost — нечитаемые сохранения, отложенные про запас: лежат на полке, но не в списке игр
  if (Array.isArray(o.lost))
    for (const l of o.lost)
      if (l && okId(l.id) && !out.games.some((x) => x.id === l.id) && !out.lost.some((x) => x.id === l.id))
        out.lost.push({ id: l.id, name: typeof l.name === 'string' ? l.name.slice(0, 20) : 'Хомка', at: +l.at || 0 });
  out.seq = Number.isFinite(o.seq) ? o.seq : 0;
  out.active = typeof o.active === 'string' && out.games.some((g) => g.id === o.active) ? o.active : null;
  return out;
}
const writeIndex = () => put(INDEX_KEY, JSON.stringify(idx));
const find = (id) => idx.games.find((g) => g.id === id);
const findLost = (id) => idx.lost.find((l) => l.id === id);
/** id всех игр, у которых что-то лежит на полке (в списке они или нет). */
function shelfIds() {
  const out = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(SLOT) && okId(k.slice(SLOT.length))) out.push(k.slice(SLOT.length));
    }
  } catch (e) {
    /* хранилище недоступно */
  }
  return out;
}
/** Отметить, что сохранение игры id не читается и отложено на её полке (вне списка игр). Лишние старые — убрать. */
function setAside(id, name, at = Date.now()) {
  idx.lost = idx.lost.filter((l) => l.id !== id);
  idx.lost.push({ id, name: name || 'Хомка', at });
  idx.lost.sort((a, b) => a.at - b.at);
  while (idx.lost.length > LOST_MAX) {
    const old = idx.lost.shift();
    del(slot(old.id));
    dropPhotos(old.id);
  }
}
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
  if (typeof s.wxStrong === 'string') m.wxStrong = s.wxStrong;
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
    const gid = s && okId(s.gid) ? s.gid : null;
    if (gid) idx.lost = idx.lost.filter((l) => l.id !== gid); // игра снова живая
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
  // На полке лежит то, чего нет ни в списке игр, ни среди отложенных (список игр пропал или его записала старая
  // страница): похоже на сохранение — возвращаем в список игр, нет — записываем в отложенные. Ничего не стираем.
  idx.lost = idx.lost.filter((l) => !find(l.id) && get(slot(l.id)));
  for (const id of shelfIds()) {
    if (find(id) || findLost(id)) continue;
    const s = parse(get(slot(id)));
    if (s && Number.isInteger(s.v)) idx.games.push(fillMeta({ ...blankMeta(id), at: 0 }, s));
    else setAside(id, 'Хомка', 0);
  }
  if (JSON.stringify(idx) !== before) writeIndex();
  return listGames();
}
/**
 * «Пустая» игра: её записали, но до самой игры она так и не дошла (нажали «Играть!» и закрыли страницу во время
 * вступительной сценки; или её записала прежняя версия страницы ещё на заставке). s — разобранная строка из
 * хранилища как есть (без починки). Признак строгий — всё сразу: имя по умолчанию «Хомка»; в отметках только intro
 * (нет begun — main.js ставит её, когда игра началась, — и нет подарков начала игры pianoGift, flipflopsGift: их
 * получает каждая игра, дошедшая до виллы, с 13–15 ноября; build в сохранении есть только с 18 ноября); первый день,
 * 7:30 утра, стартовые монеты, ничего не заработано и не потрачено, ни заданий, ни наклеек, ни гостей, хомячок на
 * вилле. Хоть что-то не так — это настоящая игра, её не трогаем.
 */
export function blankGame(s) {
  if (!s || typeof s !== 'object' || Array.isArray(s) || !Number.isInteger(s.v) || !Number.isFinite(s.build))
    return false;
  const f = s.flags;
  if (!f || typeof f !== 'object' || Array.isArray(f) || Object.keys(f).some((k) => k !== 'intro')) return false;
  const empty = (a) => Array.isArray(a) && !a.length;
  return (
    s.name === 'Хомка' &&
    s.day === START_DAY &&
    s.startDay === START_DAY &&
    s.minutes === START_MINUTES &&
    s.money === START_MONEY &&
    s.earned === 0 &&
    s.spent === 0 &&
    s.tasksDone === 0 &&
    empty(s.stickers) &&
    empty(s.guests) &&
    !!s.pos &&
    s.pos.scene === 'villa'
  );
}
/**
 * Убрать из списка «пустые» игры (blankGame) — и живую, и с полок: в них нечего терять, а заставка из-за них
 * говорит «С возвращением!» тому, кто ещё не играл. Зовётся один раз — когда открывается заставка, до openActive().
 * Игра убирается, только если и живое сохранение, и её копия на полке (если есть) — пустые. Возвращает,
 * сколько игр убрано.
 */
export function dropBlankGames() {
  syncGames();
  let n = 0;
  for (const g of [...idx.games]) {
    const live = g.id === idx.active,
      raws = [live ? get(KEY) : null, get(slot(g.id))].filter(Boolean);
    if (!raws.length || !raws.every((raw) => blankGame(parse(raw)))) continue;
    if (live) {
      del(KEY);
      idx.active = null;
    }
    del(slot(g.id));
    idx.games = idx.games.filter((x) => x !== g);
    n++;
  }
  if (!n) return 0;
  if (!idx.games.length) del(OWNER_KEY); // играть больше не во что — и «чья вкладка играет» ни к чему
  if (!idx.games.length && !idx.lost.length && idx.seq <= n) del(INDEX_KEY);
  else writeIndex();
  syncGames(); // живой становится последняя из оставшихся
  return n;
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
 * Открыть активную игру (ту, что в живом сохранении). Если сохранение не читается (load() уже отложил его копию
 * в rhr-save-backup), пробуем копию этой игры с полки (она с последнего переключения игр — постарше, но может быть
 * целой). Не открылась и она — нечитаемую строку оставляем на полке этой игры (rhr-game-<id>, вне списка игр, в списке
 * «отложенных» lost: её можно сохранить в файл или попробовать открыть ещё раз — lostGames, retryLost; таких хранится
 * не больше LOST_MAX), игру убираем из списка и пробуем следующую.
 * Возвращает { ok: G.state готово, problem: null | 'broken' | 'newer', lost: [имена игр, которые не открылись],
 * restored: имя игры, открытой из копии с полки, или null }.
 */
export function openActive() {
  let problem = null,
    restored = null,
    brokenRaw = null; // самое новое нечитаемое сохранение игры, для которой пробуем копию с полки
  const lost = [];
  const done = (ok, why = problem) => ({ ok, problem: why, lost, restored });
  for (let i = 0; i <= 2 * MAX_GAMES; i++) {
    syncGames();
    if (!idx.active) return done(false);
    const id = idx.active;
    if (load()) {
      if (G.state.gid !== id) G.state.gid = id; // запишется с первым же сохранением
      fillMeta(find(id), G.state);
      writeIndex();
      if (brokenRaw) {
        restored = find(id).name || 'Хомка';
        put(BACKUP_KEY, brokenRaw); // в запасе — самое новое, нечитаемое (копия с полки так и лежит на полке)
      }
      return done(true);
    }
    if (loadProblem !== 'broken') return done(false, loadProblem);
    problem = 'broken';
    const raw = get(KEY),
      shelf = get(slot(id));
    if (!brokenRaw) {
      if (raw && get(BACKUP_KEY) !== raw) return done(false); // копии нет (хранилище переполнено) — ничего не трогаем
      if (shelf && shelf !== raw && put(KEY, stamp(shelf, id))) {
        brokenRaw = raw; // пробуем открыть копию с полки
        continue;
      }
    }
    // не открылась ни живая игра, ни её копия: самое новое откладываем на полку этой игры (вне списка)
    const keep = brokenRaw || raw;
    if (keep) {
      put(slot(id), keep);
      put(BACKUP_KEY, keep);
    }
    const name = find(id).name || 'Хомка';
    lost.push(name);
    brokenRaw = null;
    del(KEY);
    idx.games = idx.games.filter((g) => g.id !== id);
    idx.active = null;
    if (keep && get(slot(id)) === keep) setAside(id, name);
    writeIndex();
  }
  return done(false);
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
  claimSave(); // живое сохранение теперь пишет эта вкладка (другая, если игра открыта и там, перестанет)
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
  claimSave();
  dropPhotos(id); // у новой игры альбом пуст (если список игр пропадал, под этим id могли остаться чужие снимки)
  return null;
}

/**
 * Удалить игру (только по явной просьбе игрока). Последняя удалённая лежит про запас в rhr-game-trash вместе со
 * своими снимками (ключ снимков trash) — её можно вернуть: trashInfo(), restoreTrash().
 */
export function deleteGame(id) {
  syncGames();
  const m = find(id);
  if (!m) return false;
  const live = id === idx.active;
  const raw = live ? get(KEY) : get(slot(id));
  // в корзину — с проверкой: не записалось (нет места) — прежняя корзина цела, а игру всё равно удаляем (так просили)
  const trashed = !!raw && put(TRASH_KEY, JSON.stringify({ meta: m, at: Date.now(), raw }));
  del(slot(id));
  if (trashed)
    movePhotos(id, 'trash'); // снимки фотоальбома этой игры (core/photos.js) — следом за ней
  else dropPhotos(id);
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

// ---------- корзина и отложенные ----------
const readTrash = () => {
  const t = parse(get(TRASH_KEY) || '');
  return t && typeof t.raw === 'string' && t.raw ? t : null;
};
/** Что лежит в корзине: { name, day, minutes, money, look, at } последней удалённой игры или null. */
export function trashInfo() {
  const t = readTrash();
  if (!t) return null;
  const m = fillMeta(blankMeta('trash'), parse(t.raw));
  if (t.meta && typeof t.meta.name === 'string') m.name = t.meta.name.slice(0, 20);
  return { name: m.name, day: m.day, minutes: m.minutes, money: m.money, look: m.look, at: +t.at || 0 };
}
/**
 * Вернуть последнюю удалённую игру в список (новой игрой, остальные не трогаются). Возвращает { ok, id, name }
 * или { why: 'none' | 'full' | 'store' }.
 */
export async function restoreTrash() {
  syncGames();
  const t = readTrash();
  if (!t) return { why: 'none' };
  if (idx.games.length >= MAX_GAMES) return { why: 'full' };
  const id = newId();
  if (!put(slot(id), stamp(t.raw, id))) {
    del(slot(id));
    return { why: 'store' };
  }
  const m = fillMeta(blankMeta(id), parse(t.raw));
  idx.games.push(m);
  if (!writeIndex()) {
    del(slot(id));
    syncGames();
    return { why: 'store' };
  }
  del(TRASH_KEY);
  await movePhotos('trash', id);
  syncGames();
  return { ok: true, id, name: m.name };
}
/** Отложенные нечитаемые сохранения: [{ id, name, at }], новые — первыми. */
export function lostGames() {
  if (!idx) syncGames();
  return [...idx.lost].sort((a, b) => b.at - a.at);
}
/**
 * Попробовать ещё раз открыть отложенное сохранение (после обновления игры оно может прочитаться). Читается —
 * игра возвращается в список (true); нет — всё остаётся как было (false).
 */
export function retryLost(id) {
  syncGames();
  const l = findLost(id);
  if (!l) return false;
  const raw = get(slot(id));
  if (checkSave(parse(raw || ''))) return false;
  if (idx.games.length >= MAX_GAMES) return false;
  idx.lost = idx.lost.filter((x) => x !== l);
  idx.games.push(fillMeta(blankMeta(id), parse(raw)));
  writeIndex();
  return true;
}

// ---------- выгрузка в файл и загрузка из файла ----------
// Файл — JSON: { app: 'rhr-game', format: 1, build, at, name, save: {…сохранение…}, photos: [снимки альбома] }.
// Снимки едут в том же файле: их не больше 12 маленьких JPEG (до ~0,7 МБ) — один файл проще не потерять.
// У отложенного нечитаемого сохранения вместо save — raw (строка как есть).
/** Имя файла: «Пушистая жизнь - Ириска - 2026-11-18.json». */
export function fileName(name, when = new Date()) {
  const safe =
    String(name || '')
      .replace(/[^\p{L}\p{N} _-]/gu, '')
      .trim()
      .slice(0, 20) || 'Хомка';
  const p = (n) => String(n).padStart(2, '0');
  return `Пушистая жизнь - ${safe} - ${when.getFullYear()}-${p(when.getMonth() + 1)}-${p(when.getDate())}.json`;
}
/** Игра id (из списка или из отложенных) файлом: { name: имя файла, text } или null, если выгружать нечего. */
export async function exportGame(id) {
  syncGames();
  const m = find(id) || findLost(id);
  if (!m) return null;
  const raw = id === idx.active ? get(KEY) : get(slot(id));
  if (!raw) return null;
  const s = parse(raw);
  const name = (s && typeof s.name === 'string' && s.name) || m.name || 'Хомка';
  const file = { app: FILE_APP, format: 1, build: BUILD, at: new Date().toISOString(), name };
  if (s && Number.isInteger(s.v)) file.save = s;
  else file.raw = raw;
  file.photos = await loadPhotos(id);
  return { name: fileName(name), text: JSON.stringify(file) };
}
/**
 * Загрузить игру из текста файла: она добавляется НОВОЙ игрой на полку, существующие игры не трогаются.
 * Сохранение проверяется и чинится так же, как при открытии (миграции, repair). Возвращает
 * { ok: true, id, name, photos: сколько снимков пришло } или { why }: 'bad' — это не файл игры или он испорчен,
 * 'newer' — файл от более новой игры (нужно обновить страницу), 'full' — мест нет, 'store' — не удалось записать.
 */
export async function importGame(text) {
  syncGames();
  if (typeof text !== 'string' || text.length > FILE_MAX) return { why: 'bad' };
  const f = parse(text.replace(/^﻿/, ''));
  if (!f) return { why: 'bad' };
  // наш файл выгрузки или «голое» сохранение (строка из хранилища, образцы dev/saves)
  const wrapped = f.app === FILE_APP;
  const s = wrapped
    ? f.save && typeof f.save === 'object'
      ? f.save
      : parse(typeof f.raw === 'string' ? f.raw : '')
    : f;
  if (!s) return { why: 'bad' };
  if (wrapped && Number.isFinite(f.build) && f.build > BUILD) return { why: 'newer' };
  const why = checkSave(s);
  if (why) return { why: why === 'newer' ? 'newer' : 'bad' };
  if (idx.games.length >= MAX_GAMES) return { why: 'full' };
  s.name = (typeof s.name === 'string' && s.name.trim().slice(0, NAME_MAX)) || 'Хомка';
  const id = newId();
  s.gid = id;
  if (!put(slot(id), JSON.stringify(s))) {
    del(slot(id));
    return { why: 'store' };
  }
  idx.games.push(fillMeta(blankMeta(id), s));
  if (!writeIndex()) {
    del(slot(id));
    syncGames();
    return { why: 'store' };
  }
  const photos = wrapped ? cleanPhotos(f.photos) : [];
  const photosOk = !photos.length || (await savePhotos(id, photos));
  syncGames(); // игр не было совсем — загруженная становится живой
  return { ok: true, id, name: s.name, photos: photosOk ? photos.length : 0 };
}
