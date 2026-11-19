// Фото-режим (этап 17в). Кнопка 📷 «Фото» справа: интерфейс прячется, мир замирает (как под окном), кадр можно
// двигать пальцем или мышью (камера сцены), выбрать рамку, наклейки-украшения (их можно таскать; нажала на
// наклейку дважды — убрала) и подпись. «📸 Снять» — вспышка, снимок: показать, положить в фотоальбом (вкладка
// «📷 Фото» альбома), скачать файлом (если браузер умеет, ссылкой a[download]).
//
// Снимок собирается из того, что на экране: канва игры (#game) и слой темноты/ночи (#sky, engine/topdown/render.js)
// поверх, потом рамка, наклейки и подпись — тем же рисунком, что и в предпросмотре (drawFrame). Хранение — core/photos.js
// (свой ключ localStorage на игру, не в сохранении: сохранение остаётся маленьким). Первый снимок — наклейка x_photo.
import { award } from '../core/actions.js';
import { sfx } from '../core/audio.js';
import { register } from '../core/registry.js';
import { scene, sceneName } from '../core/loop.js';
import { G, cal } from '../core/state.js';
import { el, esc, clamp } from '../core/util.js';
import { PHOTO, addPhoto, loadPhotos, removePhoto } from '../core/photos.js';
import { landOf, PHOTO_FRAMES as FRAMES, PHOTO_DECOR as DECOR } from '../data/index.js';
import { openLayer } from '../ui/modals.js';
import { message } from '../ui/panel.js';
import { toast } from '../ui/toast.js';
import { drawFrame, drawDecor } from './photo_art.js'; // рамка, наклейки, подпись — один рисунок для предпросмотра и снимка

const CAPTION_MAX = 40;

const CSS = `
#photo{position:fixed;inset:0;z-index:25;touch-action:none;user-select:none;-webkit-user-select:none}
#photo .ph-frame{position:absolute;inset:0;pointer-events:none}
#photo .ph-top{position:absolute;top:8px;left:8px;right:8px;display:flex;gap:8px;align-items:center;justify-content:space-between;pointer-events:none}
#photo .ph-top > *{pointer-events:auto}
#photo .ph-hint{background:rgba(255,255,255,.88);border-radius:12px;padding:4px 10px;font-weight:900;font-size:14px;box-shadow:0 2px 0 rgba(74,55,40,.15);pointer-events:none!important}
#photo .ph-x{width:44px;height:44px;border-radius:50%;border:0;background:#fff;font-size:20px;font-weight:900;box-shadow:0 3px 0 rgba(74,55,40,.2)}
#photo .ph-bar{position:absolute;left:50%;bottom:calc(8px + env(safe-area-inset-bottom));transform:translateX(-50%);width:min(760px,calc(100% - 16px));
  background:rgba(255,255,255,.94);border-radius:20px;padding:8px;box-shadow:0 4px 0 rgba(74,55,40,.18);display:flex;flex-direction:column;gap:6px}
#photo .ph-row{display:flex;gap:6px;overflow-x:auto;align-items:center;scrollbar-width:none}
#photo .ph-row::-webkit-scrollbar{display:none}
#photo .ph-row .lb{font-weight:900;font-size:13px;opacity:.7;flex:none;min-width:62px}
#photo .ph-b{flex:none;width:42px;height:42px;border-radius:12px;border:0;background:#fff3bf;font-size:22px;box-shadow:0 2px 0 rgba(74,55,40,.18);touch-action:manipulation}
#photo .ph-b.on{background:#ffd43b;box-shadow:0 0 0 3px #f59f00}
#photo .ph-cap{flex:1;min-width:0;height:42px;border-radius:12px;border:2px solid #ffd8a8;padding:0 10px;font:inherit;font-weight:800;font-size:15px}
#photo .ph-shot{flex:none;height:46px;padding:0 18px;font-size:18px}
#photo .ph-st{position:absolute;font-size:44px;line-height:1;transform:translate(-50%,-50%);cursor:grab;filter:drop-shadow(0 2px 2px rgba(0,0,0,.25));touch-action:none}
#photo .ph-flash{position:absolute;inset:0;background:#fff;opacity:0;pointer-events:none;transition:opacity .45s}
#photo .ph-flash.on{opacity:1;transition:none}
#photo.hidebar .ph-bar,#photo.hidebar .ph-top{display:none}
#photo.mini .ph-row.ph-opt{display:none}
#photo .ph-top .tg{margin-left:auto}
.ph-pic{display:block;max-width:100%;max-height:52vh;margin:0 auto;border-radius:10px;box-shadow:0 3px 10px rgba(0,0,0,.18)}
.ph-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px}
.ph-card{background:#fff;border-radius:12px;padding:6px;box-shadow:0 2px 0 rgba(74,55,40,.15);cursor:pointer;text-align:center;font-size:12px;font-weight:800;border:0;font-family:inherit;color:inherit}
.ph-card img{display:block;width:100%;height:96px;object-fit:cover;border-radius:8px;margin-bottom:4px}
.ph-card .sub{opacity:.6;font-weight:700}
@media (max-height:520px){#photo .ph-b{width:36px;height:36px;font-size:18px}#photo .ph-cap{height:36px}#photo .ph-shot{height:40px}#photo .ph-st{font-size:36px}}
`;
let styled = false;
const addStyle = () => {
  if (styled) return;
  styled = true;
  document.head.appendChild(el('style', '', CSS));
};

/** Где сейчас хомячок — название для подписи снимка в альбоме. */
function placeName() {
  const land = landOf(sceneName());
  if (land) return `${land.icon} ${land.name}`;
  const sc = scene(),
    d = (sc && sc.desc) || {};
  return d.title || d.name || '';
}

// ---------- сам снимок ----------
/** Собрать снимок: игра + темнота + рамка + наклейки + подпись → JPEG data URL (длинная сторона PHOTO.size). */
export function composePhoto({ frame = 'none', caption = '', decor = [] } = {}) {
  const game = document.getElementById('game'),
    sky = document.getElementById('sky');
  const vw = G.view.w || window.innerWidth,
    vh = G.view.h || window.innerHeight;
  const k = PHOTO.size / Math.max(vw, vh);
  const w = Math.round(vw * k),
    h = Math.round(vh * k);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.imageSmoothingQuality = 'high';
  if (game) ctx.drawImage(game, 0, 0, w, h);
  if (sky && sky.style.display !== 'none' && sky.width) ctx.drawImage(sky, 0, 0, w, h);
  drawDecor(ctx, w, h, decor, 44 * k);
  drawFrame(ctx, w, h, frame, caption, k);
  return { src: c.toDataURL('image/jpeg', PHOTO.quality), w, h };
}

/** Скачать снимок файлом (если браузер не умеет — ничего страшного: снимок остаётся в альбоме). */
export function downloadPhoto(src, name = 'pushistaya-zhizn') {
  try {
    const a = document.createElement('a');
    a.href = src;
    a.download = `${name}.jpg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    return true;
  } catch (e) {
    return false;
  }
}

// ---------- окно фото-режима ----------
let open = null; // открытый фото-режим: { close }

/** Открыть фото-режим. Возвращает объект для тестов: { root, shoot(), close() }. */
export function openPhotoMode() {
  if (open || !G.state || !scene()) return open;
  addStyle();
  const sc = scene();
  const closeLayer = openLayer({ pause: true }); // мир замирает: удобно снимать
  const hud = document.getElementById('hud');
  if (hud) hud.style.visibility = 'hidden';
  const toasts = document.getElementById('toasts');
  if (toasts) toasts.style.visibility = 'hidden';
  G.photo = true; // стрелку к цели и звёздочку на канве не рисуем
  const cam = sc.cam || null;
  const cam0 = cam ? { x: cam.x, y: cam.y } : null;
  let frame = 'none',
    caption = '';
  const decor = []; // { e, fx, fy, node }

  const root = el('div');
  root.id = 'photo';
  const fcv = document.createElement('canvas');
  fcv.className = 'ph-frame';
  const flash = el('div', 'ph-flash');
  const top = el('div', 'ph-top');
  const hint = el('div', 'ph-hint', '📷 Двигай кадр пальцем · наклейки можно таскать');
  const x = el('button', 'ph-x', '✕');
  x.title = 'Выйти из фото-режима';
  // свернуть рамки и наклейки (на телефоне лёжа панель закрывает полкадра) — остаются подпись и «Снять»
  const tg = el('button', 'ph-x tg', '🔽');
  tg.title = 'Свернуть панель';
  tg.onclick = () => {
    sfx('tap');
    const mini = root.classList.toggle('mini');
    tg.textContent = mini ? '🔼' : '🔽';
  };
  top.append(hint, tg, x);
  const bar = el('div', 'ph-bar');
  const rowF = el('div', 'ph-row ph-opt', '<span class="lb">Рамка</span>');
  const rowD = el('div', 'ph-row ph-opt', '<span class="lb">Наклейки</span>');
  const rowC = el('div', 'ph-row');
  const cap = document.createElement('input');
  cap.className = 'ph-cap';
  cap.maxLength = CAPTION_MAX;
  cap.placeholder = '✏️ Подпись (можно без неё)';
  cap.oninput = () => {
    caption = cap.value.slice(0, CAPTION_MAX);
    paint();
  };
  const shot = el('button', 'btn green ph-shot', '📸 Снять');
  rowC.append(cap, shot);
  for (const f of FRAMES) {
    const b = el('button', 'ph-b' + (f.id === frame ? ' on' : ''), f.icon);
    b.title = f.name;
    b.dataset.frame = f.id;
    b.onclick = () => {
      sfx('tap');
      frame = f.id;
      rowF.querySelectorAll('.ph-b').forEach((q) => q.classList.toggle('on', q.dataset.frame === frame));
      paint();
    };
    rowF.appendChild(b);
  }
  for (const e of DECOR) {
    const b = el('button', 'ph-b', e);
    b.onclick = () => {
      sfx('pop');
      addDecor(e, 0.5 + (Math.random() - 0.5) * 0.3, 0.42 + (Math.random() - 0.5) * 0.2);
    };
    rowD.appendChild(b);
  }
  bar.append(rowF, rowD, rowC);
  root.append(fcv, flash, top, bar);
  document.body.appendChild(root);

  // рамка поверх — в CSS-пикселях экрана
  function paint() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2),
      w = window.innerWidth,
      h = window.innerHeight;
    if (fcv.width !== Math.round(w * dpr) || fcv.height !== Math.round(h * dpr)) {
      fcv.width = Math.round(w * dpr);
      fcv.height = Math.round(h * dpr);
    }
    const ctx = fcv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    drawFrame(ctx, w, h, frame, caption, 1);
  }
  paint();
  const onResize = () => {
    paint();
    for (const d of decor) place(d);
  };
  window.addEventListener('resize', onResize);

  // наклейки: тащить пальцем; два нажатия подряд — убрать
  function place(d) {
    d.node.style.left = d.fx * 100 + '%';
    d.node.style.top = d.fy * 100 + '%';
  }
  function addDecor(e, fx, fy) {
    const d = { e, fx, fy, node: el('div', 'ph-st', e), last: 0 };
    d.node.title = 'Тащи наклейку; нажми дважды — убрать';
    place(d);
    d.node.addEventListener('pointerdown', (ev) => {
      ev.stopPropagation();
      ev.preventDefault();
      const now = performance.now();
      if (now - d.last < 350) {
        d.node.remove();
        decor.splice(decor.indexOf(d), 1);
        sfx('pop');
        return;
      }
      d.last = now;
      drag = { d, x: ev.clientX, y: ev.clientY };
    });
    root.insertBefore(d.node, top);
    decor.push(d);
    return d;
  }

  // двигать кадр — камера сцены (мир на паузе: сцена её не трогает)
  let drag = null;
  const down = (ev) => {
    if (ev.target !== root && ev.target !== fcv) return;
    drag = { x: ev.clientX, y: ev.clientY };
  };
  const move = (ev) => {
    if (!drag) return;
    const dx = ev.clientX - drag.x,
      dy = ev.clientY - drag.y;
    drag.x = ev.clientX;
    drag.y = ev.clientY;
    if (drag.d) {
      drag.d.fx = clamp(drag.d.fx + dx / window.innerWidth, 0.02, 0.98);
      drag.d.fy = clamp(drag.d.fy + dy / window.innerHeight, 0.02, 0.98);
      place(drag.d);
    } else if (cam) {
      cam.x -= dx / cam.zoom;
      cam.y -= dy / cam.zoom;
      if (cam0) {
        // не дальше полутора экранов от хомячка
        const rx = (window.innerWidth * 0.75) / cam.zoom,
          ry = (window.innerHeight * 0.75) / cam.zoom;
        cam.x = clamp(cam.x, cam0.x - rx, cam0.x + rx);
        cam.y = clamp(cam.y, cam0.y - ry, cam0.y + ry);
      }
      cam.clamp();
    }
  };
  const up = () => (drag = null);
  root.addEventListener('pointerdown', down);
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);

  function close() {
    if (!open) return;
    open = null;
    window.removeEventListener('resize', onResize);
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', up);
    root.remove();
    if (hud) hud.style.visibility = '';
    if (toasts) toasts.style.visibility = '';
    G.photo = false;
    closeLayer(); // камера сама вернётся к хомячку
  }
  x.onclick = () => {
    sfx('tap');
    close();
  };

  /** Снять: вспышка, снимок, окно «что с ним сделать». */
  async function shoot() {
    sfx('magic');
    const res = composePhoto({ frame, caption, decor: decor.map(({ e, fx, fy }) => ({ e, fx, fy })) });
    flash.classList.add('on');
    requestAnimationFrame(() => requestAnimationFrame(() => flash.classList.remove('on')));
    root.classList.add('hidebar');
    const c = cal();
    const photo = { day: G.state.day, date: `${c.monthName}, день ${c.dom}`, place: placeName(), caption: caption.trim(), src: res.src };
    await afterShot(photo);
    if (open) root.classList.remove('hidebar');
    return photo;
  }
  shot.onclick = () => shoot();

  open = { root, shoot, close, addDecor: (e, fx = 0.5, fy = 0.5) => addDecor(e, fx, fy), setFrame: (f) => rowF.querySelector(`[data-frame="${f}"]`).click(), setCaption: (t) => ((cap.value = t), cap.oninput()) };
  return open;
}

/** Окно после снимка: в альбом, скачать или снять ещё. */
async function afterShot(photo) {
  const html = `<img class="ph-pic" src="${photo.src}" alt="Снимок"><p class="center muted">${esc(photo.place)} · ${esc(photo.date)}</p>`;
  for (;;) {
    const i = await message({
      title: 'Снимок готов!',
      icon: '📸',
      cls: 'wide',
      html,
      buttons: [{ text: '💾 В фотоальбом', cls: 'green' }, { text: '⬇️ Скачать файлом', cls: 'blue' }, { text: '📷 Снять ещё', cls: 'ghost' }],
    });
    if (i === 1) {
      downloadPhoto(photo.src, `foto-${photo.day}`);
      continue;
    }
    if (i !== 0) return;
    let r = await addPhoto(photo);
    if (r === 'full') {
      const q = await message({
        title: 'Альбом полон',
        icon: '📖',
        html: `<p class="center">В фотоальбоме уже ${PHOTO.max} снимков. Заменить самый старый новым?</p><p class="center muted">Можно и удалить ненужные снимки в альбоме: 📖 Альбом → 📷 Фото.</p>`,
        buttons: [{ text: 'Да, заменить', cls: 'green' }, { text: 'Нет', cls: 'ghost' }],
      });
      if (q !== 0) continue;
      r = await addPhoto(photo, { replaceOldest: true });
    }
    if (r === 'fail') {
      toast('Ой, в браузере не хватило места для снимка. Удали старые снимки в альбоме или скачай этот файлом.');
      continue;
    }
    sfx('ok');
    toast('📖 Снимок — в фотоальбоме!', 'good');
    award('x_photo', { delay: 800 });
    return;
  }
}

/** Вкладка «📷 Фото» в альбоме (features/album.js). */
let photosAsk = 0; // номер последнего запроса снимков: ответ на устаревший (окно уже перерисовали) не показываем
export async function renderPhotos(body, panel) {
  addStyle();
  const ask = ++photosAsk;
  const list = await loadPhotos(); // снимки лежат в IndexedDB (core/photos.js) — читаются не сразу
  if (ask !== photosAsk || !body.isConnected || (panel && panel.tab !== 'ph')) return; // окно закрыли или сменили вкладку
  body.appendChild(
    el(
      'p',
      'center',
      list.length
        ? `Снимков: <b>${list.length}</b> из ${PHOTO.max}. Нажми на снимок — посмотреть, скачать или удалить.`
        : 'Здесь будут твои снимки! Нажми <b>📷 Фото</b> на экране, выбери рамку и наклейки — и «📸 Снять».',
    ),
  );
  const grid = el('div', 'ph-grid');
  for (const p of list.slice().reverse()) {
    const card = el('button', 'ph-card', `<img src="${p.src}" alt=""><div>${esc(p.caption || p.place || 'Снимок')}</div><div class="sub">${esc(p.date || '')}</div>`);
    card.onclick = async () => {
      sfx('tap');
      const i = await message({
        title: p.caption || 'Снимок',
        icon: '📷',
        cls: 'wide',
        html: `<img class="ph-pic" src="${p.src}" alt="Снимок"><p class="center muted">${esc(p.place || '')}${p.date ? ' · ' + esc(p.date) : ''}</p>`,
        buttons: [{ text: '⬇️ Скачать', cls: 'blue' }, { text: '🗑️ Удалить', cls: 'ghost' }, { text: 'Закрыть', cls: 'ghost' }],
      });
      if (i === 0) downloadPhoto(p.src, `foto-${p.day || ''}`);
      if (i === 1) {
        const ok = await message({
          title: 'Удалить снимок?',
          icon: '🗑️',
          html: '<p class="center">Снимок пропадёт из альбома насовсем.</p>',
          buttons: [{ text: 'Удалить', cls: 'yellow' }, { text: 'Оставить', cls: 'ghost' }],
        });
        if (ok === 0) {
          await removePhoto(p.id);
          sfx('pop');
          panel.refresh();
        }
      }
    };
    grid.appendChild(card);
  }
  body.appendChild(grid);
}

register('photo', () => openPhotoMode(), 'фото-режим: спрятать интерфейс, рамка, наклейки, подпись, снимок в фотоальбом');
/** Для тестов: открытый фото-режим или null. */
export const photoMode = () => open;
