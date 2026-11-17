// Фотоальбом (этап 17в): снимки фото-режима хранятся НЕ в сохранении игры, а рядом — в своём ключе localStorage
// на каждую игру: rhr-photos-<gid> (gid — id игры в списке игр, core/games.js). Так сохранение, которое пишется
// после каждого действия, остаётся маленьким и быстрым, а снимки читаются только когда открыт альбом.
//
//   [{ id, day, place, caption, src }]   src — маленький JPEG (data:image/jpeg;base64,…), длинная сторона PHOTO.size
//
// Снимков не больше PHOTO.max (старые можно удалить в альбоме). Игру удалили нарочно — её снимки тоже (games.js).
// Хранилище недоступно или переполнено — addPhoto вернёт false, игра дальше работает как ни в чём не бывало.
import { G } from './state.js';

export const PHOTO = {
  max: 12, // снимков в альбоме одной игры
  size: 480, // длинная сторона снимка, пикселей
  quality: 0.72, // качество JPEG
};
const PREFIX = 'rhr-photos-';
const keyOf = (gid) => PREFIX + (gid || 'main');
const gidNow = () => (G.state && G.state.gid) || 'main';

/** Снимки игры gid (по умолчанию — текущей), новые — в конце. */
export function loadPhotos(gid = gidNow()) {
  try {
    const raw = localStorage.getItem(keyOf(gid));
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((p) => p && typeof p.src === 'string' && p.src.startsWith('data:image/')) : [];
  } catch (e) {
    return [];
  }
}
function write(list, gid) {
  try {
    if (list.length) localStorage.setItem(keyOf(gid), JSON.stringify(list));
    else localStorage.removeItem(keyOf(gid));
    return true;
  } catch (e) {
    return false; // переполнено или недоступно
  }
}
/**
 * Положить снимок в альбом. replaceOldest — альбом полон: убрать самый старый. Вернёт 'ok' | 'full' | 'fail'
 * (не хватило места в хранилище браузера).
 */
export function addPhoto(photo, { replaceOldest = false } = {}) {
  const gid = gidNow();
  const list = loadPhotos(gid);
  if (list.length >= PHOTO.max) {
    if (!replaceOldest) return 'full';
    list.splice(0, list.length - PHOTO.max + 1);
  }
  list.push({ ...photo, id: photo.id || Date.now().toString(36) + Math.random().toString(36).slice(2, 6) });
  return write(list, gid) ? 'ok' : 'fail';
}
/** Удалить снимок по id. */
export function removePhoto(id) {
  const gid = gidNow();
  const list = loadPhotos(gid).filter((p) => p.id !== id);
  return write(list, gid);
}
/** Убрать все снимки игры (её удалили нарочно). */
export function dropPhotos(gid) {
  try {
    localStorage.removeItem(keyOf(gid));
  } catch (e) {
    /* хранилище недоступно */
  }
}
/** Сколько места занимают снимки игры (символов в хранилище) — для автотеста и замеров. */
export function photosSize(gid = gidNow()) {
  try {
    return (localStorage.getItem(keyOf(gid)) || '').length;
  } catch (e) {
    return 0;
  }
}
