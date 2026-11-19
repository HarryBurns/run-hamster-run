// Игра как приложение на экране «Домой» (iPhone, iPad, Android, компьютер). Зачем: значок для ребёнка, игра во
// весь экран, а на iPhone и iPad — сохранность игр: Safari стирает данные сайта, если в него не заходили неделю, а у
// приложения с экрана «Домой» своя память, которую Safari не чистит.
//
// Что здесь:
//   • где мы: installPlatform() — 'ios-safari' | 'ios-other' (Chrome и др. на iPhone/iPad) | 'android' | 'mac-safari' |
//     'desktop'; isStandalone() — игра уже открыта как приложение (тогда ничего не предлагаем);
//   • окно «Игра как приложение» — openInstall(): Android и компьютер — своя кнопка «Установить» (событие
//     beforeinstallprompt — системное окно браузера), iPhone и iPad — картинки шагов («Поделиться» → «На экран
//     „Домой“» → «Добавить») и перенос игр файлом (у приложения на iOS своя память);
//   • кнопка для заставки и меню — installButton(); подсказка взрослым через время игры — startInstallHint();
//   • заставка в приложении на iOS без игр — needMoveHint(): «Перенести игру из Safari? → Загрузить из файла»;
//   • service worker (sw.js в корне) — registerOffline(): только «сеть сначала, кэш — запасной путь»
//     (docs/ARCHITECTURE.md, «Игра как приложение»).
// Отметки этого устройства (не сохранение игры) — в localStorage 'rhr-install': { never, installed, shown, times }.
import { G } from '../core/state.js';
import { el, esc } from '../core/util.js';
import { sfx } from '../core/audio.js';
import { listGames, exportGame } from '../core/games.js';
import { BUILD } from '../data/index.js';
import { openPanel, message } from '../ui/panel.js';
import { downloadText } from '../ui/files.js';

const KEY = 'rhr-install';
const HINT_AFTER = 12 * 60; // с: подсказка — не раньше, чем через 12 минут игры за раз
const HINT_EVERY = 4 * 864e5; // мс: и не чаще раза в 4 дня
const HINT_TIMES = 4; // всего раз (потом сама больше не появляется)
const HINT_SHOW = 40; // с: сколько подсказка висит, если её не трогать

function prefs() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}') || {};
  } catch (e) {
    return {};
  }
}
function remember(patch) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...prefs(), ...patch }));
  } catch (e) {
    /* без памяти — подсказка просто покажется ещё раз */
  }
}

// ---------- системное окно установки (Chrome, Edge, Samsung Internet; Android и компьютер) ----------
let deferred = null; // событие beforeinstallprompt: из него показывают системное окно «Установить приложение?»
const listeners = new Set();
const changed = () => listeners.forEach((fn) => fn());
/** Позвать fn, когда изменилось, можно ли предлагать установку (пришло событие браузера, игру поставили). */
export function onInstallChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // своя кнопка вместо всплывающей полоски браузера поверх игры
    deferred = e;
    changed();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    remember({ installed: true });
    hideHint();
    changed();
    message({
      title: 'Готово!',
      icon: '🎉',
      html: `<p class="center big-emoji">🐹📲</p><p class="center">Игра стоит как приложение. Открывайте её значком <b>«Хомячок»</b> — на экране «Домой» или в списке приложений.</p>
        <p class="center muted">Игры там те же, что здесь, — переносить ничего не нужно.</p>`,
      buttons: [{ text: 'Ура!' }],
    });
  });
}

// ---------- где мы ----------
/** Платформа для советов: 'ios-safari' | 'ios-other' | 'android' | 'mac-safari' | 'desktop'. */
export function installPlatform() {
  const ua = navigator.userAgent || '';
  // iPadOS притворяется компьютером Mac — выдаёт его экран касаний
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const other = /CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|YaBrowser|GSA\/|DuckDuckGo|FBAN|FBAV|Instagram|Telegram|Line\//;
  if (ios) return /Safari\//.test(ua) && !other.test(ua) ? 'ios-safari' : 'ios-other';
  if (/Android/.test(ua)) return 'android';
  if (/Macintosh/.test(ua) && /Version\/\d+.*Safari\//.test(ua) && !/Chrome|Chromium|Edg\/|Firefox/.test(ua))
    return 'mac-safari';
  return 'desktop';
}
/** Игра открыта как приложение (с экрана «Домой», из Dock или как установленное приложение Chrome). */
export function isStandalone() {
  try {
    if (navigator.standalone === true) return true; // iPhone, iPad
    return ['standalone', 'fullscreen', 'minimal-ui', 'window-controls-overlay'].some(
      (m) => matchMedia(`(display-mode: ${m})`).matches,
    );
  } catch (e) {
    return false;
  }
}
/** У приложения своя память, отдельно от браузера: игры переносят файлом (iPhone, iPad, Safari на Mac). */
const ownStorage = (p) => p === 'ios-safari' || p === 'ios-other' || p === 'mac-safari';
/** Предлагать ли установку: не в приложении, ещё не ставили, и мы знаем, как здесь поставить. */
export function canOfferInstall() {
  if (isStandalone() || prefs().installed) return false;
  return !!deferred || installPlatform() !== 'desktop';
}
/** Заставка в приложении на iPhone и iPad, игр ещё нет: подсказать перенести игру из Safari файлом. */
export function needMoveHint() {
  return isStandalone() && ownStorage(installPlatform());
}

// ---------- окно «Игра как приложение» ----------
// простые значки шагов (как на кнопках iOS): «Поделиться» и «На экран „Домой“»
const ICON_SHARE =
  '<svg class="inst-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 9H6.5A1.5 1.5 0 0 0 5 10.5v9A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5v-9A1.5 1.5 0 0 0 17.5 9H16M12 15V3M8.5 6.5 12 3l3.5 3.5"/></svg>';
const ICON_ADD =
  '<svg class="inst-ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M12 8v8M8 12h8"/></svg>';
const ICON_MENU =
  '<svg class="inst-ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/></svg>';

const step = (n, ico, html) =>
  `<li class="inst-step"><span class="inst-n">${n}</span><span class="inst-pic">${ico}</span><span class="inst-txt">${html}</span></li>`;

/** Кнопки «💾 имя» — сохранить каждую игру в файл (перед переносом в приложение со своей памятью). */
function saveButtons() {
  const box = el('div', 'inst-saves');
  for (const g of listGames()) {
    const b = el('button', 'btn blue small', `💾 ${esc(g.name || 'Хомка')}`);
    b.dataset.act = 'inst-save';
    b.onclick = async () => {
      sfx('tap');
      const f = await exportGame(g.id);
      if (f && downloadText(f.name, f.text)) {
        b.innerHTML = `✅ ${esc(g.name || 'Хомка')}`;
        b.classList.replace('blue', 'green');
      } else b.innerHTML = `😿 не вышло — ещё раз`;
    };
    box.appendChild(b);
  }
  return box;
}

/** Окно «Игра как приложение» — своё для каждой платформы. Ребёнок может открыть и закрыть его без вреда. */
export function openInstall() {
  sfx('tap');
  const p = installPlatform();
  const games = listGames().length;
  openPanel({
    title: 'Игра как приложение',
    icon: '📲',
    cls: 'narrow inst-panel',
    render(body, tab, panel) {
      body.dataset.platform = p; // для автотеста
      const intro =
        '<p><b>Для взрослых.</b> Игру можно поставить на экран «Домой»: она будет открываться значком 🐹 «Хомячок» — во весь экран, как обычное приложение.</p>';
      if (isStandalone()) {
        body.innerHTML = '<p class="center big-emoji">🐹📲</p><p class="center">Игра уже открыта как приложение.</p>';
        return;
      }
      if (deferred) {
        // Chrome, Edge, Samsung Internet: системное окно установки
        body.innerHTML =
          intro +
          `<p>Нажмите <b>«Установить»</b> — браузер спросит ещё раз, там тоже «Установить».</p>
          <p class="inst-note">✅ Игры переносить не нужно: приложение хранит их вместе с этим браузером.</p>`;
        return;
      }
      if (p === 'ios-safari' || p === 'ios-other' || p === 'mac-safari') {
        const ios = p !== 'mac-safari';
        const steps = [];
        let n = 1;
        if (games)
          steps.push(
            step(
              n++,
              '💾',
              '<b>Сначала сохраните игру в файл.</b> У приложения своя память: игры отсюда сами туда не перейдут. Кнопки ниже (или «Мои игры» → ⋯ → «Сохранить в файл»).',
            ),
          );
        if (ios) {
          steps.push(
            step(
              n++,
              ICON_SHARE,
              p === 'ios-safari'
                ? 'Нажмите <b>«Поделиться»</b>: на iPad — вверху справа, на iPhone — внизу экрана (в iOS 26 — сначала «⋯»).'
                : 'Нажмите <b>«Поделиться»</b> — в адресной строке браузера (в Chrome — справа вверху).',
            ),
          );
          steps.push(
            step(
              n++,
              ICON_ADD,
              'Выберите <b>«На экран „Домой“»</b>. Не видно — пролистайте список вниз или нажмите «Ещё».',
            ),
          );
          steps.push(step(n++, '<b class="inst-btn">Добавить</b>', 'Нажмите <b>«Добавить»</b> вверху справа.'));
        } else {
          steps.push(
            step(n++, '🗂️', 'В меню Safari <b>«Файл»</b> выберите <b>«Добавить в Dock…»</b> (macOS 14 и новее).'),
          );
          steps.push(step(n++, '<b class="inst-btn">Добавить</b>', 'Нажмите <b>«Добавить»</b>.'));
        }
        if (games)
          steps.push(
            step(
              n++,
              '📂',
              'Откройте игру значком 🐹 и на заставке нажмите <b>«Загрузить из файла»</b>' +
                (ios ? ' → «Файлы» → «Загрузки» → файл «Пушистая жизнь…».' : ' и выберите файл из «Загрузок».'),
            ),
          );
        body.innerHTML =
          intro +
          (ios
            ? '<p class="inst-note">🛡️ Так игры надёжнее: Safari сам стирает данные сайта, если в него неделю не заходили, а память приложения на экране «Домой» он не трогает.</p>'
            : '') +
          (p === 'ios-other'
            ? '<p class="inst-warn">Игра открыта не в Safari. В Chrome на iOS 16.4 и новее тоже можно — шаги ниже. Если пункта «На экран „Домой“» нет, откройте эту страницу в Safari.</p>'
            : '') +
          `<ol class="inst-steps">${steps.join('')}</ol>`;
        if (games) body.querySelector('.inst-steps li').appendChild(saveButtons());
        if (games)
          body.appendChild(
            el(
              'p',
              'muted inst-small',
              'Игра здесь тоже останется. Дальше играйте в приложении: то, что сыграно в нём, сюда не попадает.',
            ),
          );
        if (p === 'ios-other') {
          const copy = el('button', 'btn ghost small', '📋 Скопировать адрес игры');
          copy.onclick = () => {
            sfx('tap');
            const ok = () => (copy.innerHTML = '✅ Адрес скопирован — вставьте его в Safari');
            try {
              navigator.clipboard.writeText(location.href).then(ok, () => (copy.innerHTML = esc(location.href)));
            } catch (e) {
              copy.innerHTML = esc(location.href);
            }
          };
          body.appendChild(copy);
        }
        return;
      }
      if (p === 'android') {
        // события браузера нет: уже установлено, другой браузер или Chrome ещё не решил — объясняем меню
        body.innerHTML =
          intro +
          `<ol class="inst-steps">${step(1, ICON_MENU, 'В Chrome откройте меню <b>⋮</b> (вверху справа).')}${step(
            2,
            ICON_ADD,
            'Выберите <b>«Добавить на гл. экран»</b> или <b>«Установить приложение»</b>, потом <b>«Установить»</b>.',
          )}</ol>
          <p class="inst-note">✅ Игры переносить не нужно: на Android приложение хранит их вместе с браузером, из которого его поставили.</p>
          <p class="muted inst-small">Если в меню написано «Открыть приложение» — игра уже установлена.</p>`;
        return;
      }
      body.innerHTML =
        intro +
        '<p>В этом браузере так не получится. Поставить игру можно из Chrome или Edge (компьютер, Android) или из Safari (iPhone, iPad).</p>';
    },
    foot: () =>
      deferred && !isStandalone()
        ? [
            { text: '📲 Установить', cls: 'green', act: 'inst-go', fn: (panel) => askBrowser(panel) },
            { text: 'Потом', cls: 'ghost', act: 'no', fn: (panel) => panel.close() },
          ]
        : [{ text: 'Понятно', cls: 'green', act: 'ok', fn: (panel) => panel.close() }],
  });
}
/** Системное окно браузера «Установить приложение?». */
async function askBrowser(panel) {
  const e = deferred;
  if (!e) return panel.refresh();
  deferred = null; // одно событие — одно окно; если откажутся, браузер пришлёт новое позже
  panel.close();
  try {
    await e.prompt();
    const r = await e.userChoice;
    if (r && r.outcome === 'accepted') remember({ installed: true });
  } catch (err) {
    /* браузер передумал показывать окно — ничего страшного */
  }
  changed();
}

/** Кнопка «📲 …» для заставки и меню; null — здесь предлагать нечего (уже приложение, уже поставили). */
export function installButton(text, cls = 'btn ghost small') {
  if (!canOfferInstall()) return null;
  const b = el('button', cls + ' inst-open', text);
  b.dataset.act = 'install';
  b.onclick = () => openInstall();
  return b;
}

// ---------- подсказка взрослым через время игры ----------
let hintEl = null,
  hintTimer = 0;
function hideHint() {
  clearTimeout(hintTimer);
  if (hintEl) hintEl.remove();
  hintEl = null;
}
/** Небольшая плашка внизу экрана, не окно: игру не останавливает, сама уходит через HINT_SHOW секунд. */
export function showInstallHint() {
  hideHint();
  const pr = prefs();
  remember({ shown: Date.now(), times: (pr.times || 0) + 1 });
  hintEl = el(
    'div',
    'inst-hint',
    '<span class="inst-hint-txt">📲 <b>Для взрослых:</b> игру можно поставить на экран «Домой», как приложение, — так она надёжнее сохранится.</span>',
  );
  const row = el('div', 'inst-hint-row');
  const how = el('button', 'btn blue small', 'Как?');
  how.dataset.act = 'inst-how';
  how.onclick = () => {
    hideHint();
    openInstall();
  };
  const later = el('button', 'btn ghost small', 'Потом');
  later.dataset.act = 'inst-later';
  later.onclick = () => {
    sfx('tap');
    hideHint();
  };
  const never = el('button', 'btn ghost small', 'Больше не показывать');
  never.dataset.act = 'inst-never';
  never.onclick = () => {
    sfx('tap');
    remember({ never: true });
    hideHint();
  };
  row.append(how, later, never);
  hintEl.appendChild(row);
  document.body.appendChild(hintEl);
  hintTimer = setTimeout(hideHint, HINT_SHOW * 1000);
  return hintEl;
}
/** Пора ли показать подсказку (после HINT_AFTER секунд игры). */
function hintDue() {
  const pr = prefs();
  return (
    canOfferInstall() &&
    !pr.never &&
    (pr.times || 0) < HINT_TIMES &&
    Date.now() - (pr.shown || 0) > HINT_EVERY &&
    (installPlatform() !== 'android' || !!deferred) // на Android без события браузера, скорее всего, уже стоит
  );
}
let played = 0,
  hintLoop = 0;
/** Считать время игры и один раз за сеанс, в спокойную минуту (нет окон и мини-игр), показать подсказку. */
export function startInstallHint() {
  if (hintLoop) return;
  hintLoop = setInterval(() => {
    if (document.visibilityState !== 'visible' || !G.state) return;
    if (++played < HINT_AFTER || G.modal > 0) return;
    clearInterval(hintLoop);
    if (hintDue()) showInstallHint();
  }, 1000);
}

// ---------- service worker: игра открывается и без сети ----------
/**
 * Поставить sw.js (в корне игры): сеть всегда первая, кэш — только если сети нет. Адрес с номером сборки
 * (sw.js?v=BUILD): новая сборка — новый адрес, браузер сразу ставит новый service worker, тот кладёт в кэш
 * «rhr-BUILD» файлы этой сборки и удаляет старые кэши. Под автотестом (navigator.webdriver) не ставится, чтобы
 * шаги с подменой ответов сервера видели сеть как есть; включить там — ?sw в адресе.
 */
export function registerOffline() {
  try {
    if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
    if (navigator.webdriver && !new URLSearchParams(location.search).has('sw')) return;
    navigator.serviceWorker.register('sw.js?v=' + BUILD).catch(() => {});
  } catch (e) {
    /* без service worker игра работает как раньше — только без сети не откроется */
  }
}

/** Для автотеста: что видит этот модуль. */
export const installDebug = () => ({
  platform: installPlatform(),
  standalone: isStandalone(),
  prompt: !!deferred,
  offer: canOfferInstall(),
  due: hintDue(),
  prefs: prefs(),
});
