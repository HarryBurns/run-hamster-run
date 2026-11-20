// Заставка: название, «Продолжить», «Мои игры», «Новая игра». Сцена за кнопками — features/title_scene.js,
// хранение нескольких игр — core/games.js. Игру запускает main.js: сюда приходит start(fresh, begin) — у новой игры
// begin() записывает её после вступительной сценки (З23: закрыли страницу во время сценки — игры нет).
import { G, cal, claimSave, holdSave, weatherNow } from '../core/state.js';
import {
  MAX_GAMES,
  syncGames,
  listGames,
  activeGame,
  openActive,
  switchGame,
  prepareGame,
  commitGame,
  deleteGame,
  exportGame,
  importGame,
  trashInfo,
  restoreTrash,
  lostGames,
  retryLost,
  dropBlankGames,
} from '../core/games.js';
import { emit } from '../core/events.js';
import { el, esc, fmtMoney } from '../core/util.js';
import { makeCanvas } from '../core/draw.js';
import { drawPortrait } from '../art/hamster.js';
import {
  resolveLook,
  defaultLook,
  startLook,
  monthOfDay,
  SEASON_OF_MONTH,
} from '../data/index.js';
import { sfx, unlockAudio } from '../core/audio.js';
import { openPanel, message } from '../ui/panel.js';
import { downloadText, pickTextFile } from '../ui/files.js';
import { nameInput } from '../ui/nameinput.js';
import { createTitleScene } from './title_scene.js';
import { installButton, onInstallChange, needMoveHint } from './install.js';

export const GAME_NAME = 'Пушистая жизнь';
const HOLD_MS = 1300; // сколько держать «Да, удалить»

/** Наряд для портрета и заставки; если в записи что-то не так — хомячок по умолчанию. */
function lookOf(look) {
  try {
    if (look) return resolveLook(look);
  } catch (e) {
    /* вещи из сохранения игра не знает — покажем обычного хомячка */
  }
  // игр ещё нет: летний наряд к летнему дню на заставке
  const d = defaultLook();
  return resolveLook({
    ...d,
    outfit: { ...d.outfit, head: 'sunhat', body: 'dress_sea' },
    beauty: { ...d.beauty, bow: '#ff5c8a' },
  });
}
function portrait(look, size) {
  const { canvas, ctx } = makeCanvas(size, size);
  canvas.className = 'g-face';
  try {
    drawPortrait(ctx, size / 2, size / 2, size, lookOf(look));
  } catch (e) {
    /* портрет не главное */
  }
  return canvas;
}
/** «Июнь, 2-й день · 1-й год» */
function dateOf(g) {
  const c = cal({ day: g.day || 0, minutes: g.minutes || 0 });
  return `${c.monthName}, ${c.dom}-й день · ${c.year}-й год`;
}

let current = null; // открытая заставка: { scene } — для автотеста (window.__dev.title)
export const titleDebug = () => current;

/**
 * Новая игра дошла до конца вступительной сценки (или её пропустили): записать её и разрешить сохранение (З23).
 * Не записалась (хранилище переполнилось, пока шла сценка) — играть можно, но сохранение остаётся выключенным, чтобы
 * не затереть прежнюю игру, а взрослым — окно «Игра не может сохраниться» (событие saveFail, main.js).
 */
function beginNewGame() {
  const why = commitGame();
  if (why) return void emit('saveFail', { quota: true });
  holdSave(false);
  claimSave();
}

/** Показать заставку. start(fresh, begin) — запустить игру, которая уже лежит в G.state (begin — см. beginNewGame). */
export function openTitle({ start }) {
  const t = el('div');
  t.id = 'title';
  const cv = el('canvas', 't-scene');
  const head = el('div', 't-head');
  head.appendChild(el('h1', '', GAME_NAME));
  head.appendChild(el('div', 'sub', 'Большая жизнь маленького хомячка'));
  head.appendChild(el('div', 't-town', '🌰 Ореховая Гавань')); // табличка: где живёт хомячок (В13)
  const menu = el('div', 't-menu');
  t.append(cv, head, menu);
  document.body.appendChild(t);
  t.addEventListener('pointerdown', unlockAudio, { passive: true });

  // Пока открыта заставка, игра не началась: живое сохранение не пишется (core/save.js: holdSave), а «пустые» игры —
  // записанные, но так и не дошедшие до самой игры (core/games.js: blankGame), — убираются: без настоящих игр
  // заставка спрашивает имя, а не говорит «С возвращением!».
  holdSave(true);
  dropBlankGames();
  let res = openActive(); // { ok, problem, lost, restored }: G.state — последняя игра (если она есть и читается)
  let scene = null,
    sceneKey = '';
  /** Свободное место для сцены: всё, что не под заголовком и не под кнопками. open — выше этой линии свободна вся
   * ширина экрана (кнопки сбоку начинаются ниже: там может пролететь самолётик). */
  const free = () => {
    const r = t.getBoundingClientRect(),
      h = head.getBoundingClientRect(),
      mn = menu.getBoundingClientRect();
    const side = mn.height > r.height * 0.6 || mn.left > r.width * 0.5; // кнопки сбоку (экран лежит)
    const top = Math.min(h.bottom - r.top, r.height * 0.4);
    // надписи заголовка (название, подзаголовок, табличка): кроны пальм под них не заходят (П20-7). У h1 — рамка букв
    const keep = [...head.children].map((c) => {
      let b = c.getBoundingClientRect();
      if (c.tagName === 'H1') {
        const rg = document.createRange();
        rg.selectNodeContents(c);
        b = rg.getBoundingClientRect();
      }
      return { x0: b.left - r.left, x1: b.right - r.left, y1: b.bottom - r.top };
    });
    return side
      ? { x: 0, y: top, w: Math.max(160, mn.left - r.left - 8), h: r.height - top, open: mn.top - r.top - 8, keep }
      : { x: 0, y: top, w: r.width, h: Math.max(160, mn.top - r.top - top - 6), keep };
  };
  /** Сцена показывает время суток и погоду последней игры; игр нет — солнечный летний день. */
  function showScene() {
    const s = res.ok ? G.state : null;
    const env = s
      ? {
          minutes: s.minutes,
          weather: s.weather,
          force: weatherNow(s).force, // 2 — ливень или метель, 3 — гроза
          season: SEASON_OF_MONTH[monthOfDay(s.day)],
          look: lookOf(s.look),
        }
      : { minutes: 12 * 60, weather: 'sun', force: 0, season: 'summer', look: lookOf(null) };
    if (formLook) env.look = formLook; // в форме новой игры выбрали «хомячок» или «хомячка»
    const key = JSON.stringify([env.minutes, env.weather, env.force, env.season, formLook ? formLook.beauty : s && s.look]);
    if (scene && key === sceneKey) return scene.relayout();
    if (scene) scene.destroy();
    sceneKey = key;
    scene = createTitleScene(cv, { ...env, free });
    current = { scene };
  }

  function close(fresh) {
    if (!fresh) {
      // пока заставка была открыта, игру могли сохранить в другой вкладке — берём из хранилища самое свежее
      const r = openActive();
      if (!r.ok) {
        res = r;
        return render('main');
      }
    }
    // игра началась: теперь её можно сохранять, и живое сохранение пишет эта вкладка (core/state.js); новую игру —
    // только после вступительной сценки (beginNewGame)
    if (!fresh) {
      holdSave(false);
      claimSave();
    }
    offInstall();
    if (offKb) offKb();
    scene.destroy();
    current = null;
    t.remove();
    unlockAudio();
    sfx('win');
    start(fresh, fresh ? beginNewGame : null);
  }

  // ---------- кнопки ----------
  // «📲 Как приложение» (features/install.js): маленькая, под остальными; браузер может разрешить установку не сразу —
  // тогда кнопка появляется, когда он пришлёт событие
  const appSlot = el('div', 't-app');
  const fillApp = () => {
    appSlot.innerHTML = '';
    const b = installButton('📲 Как приложение');
    if (b) appSlot.appendChild(b);
    appSlot.hidden = !b;
  };
  const offInstall = onInstallChange(() => {
    fillApp();
    if (scene) scene.relayout();
  });
  /** Поле имени (ui/nameinput.js) и выбор «Я — хомячок / Я — хомяшка» для новой игры. */
  function nameForm() {
    const { inp, hint, say, clean } = nameInput({ onLayout: () => scene && scene.relayout() });
    inp.dataset.act = 'name';
    // две большие кнопки-картинки: герой нарисован таким, каким начнёт игру (хомячка — с ресничками)
    const who = el('div', 't-who');
    who.setAttribute('role', 'radiogroup');
    who.setAttribute('aria-label', 'Кто ты?');
    let gender = null;
    const btns = {};
    for (const [g, label] of [
      ['m', 'Я — хомячок'],
      ['f', 'Я — хомяшка'],
    ]) {
      const bt = el('button', 't-who-btn t-who-' + g);
      bt.type = 'button';
      bt.dataset.act = 'gender-' + g;
      bt.setAttribute('role', 'radio');
      bt.setAttribute('aria-checked', 'false');
      const { canvas, ctx } = makeCanvas(84, 84);
      const look = resolveLook(startLook(g));
      try {
        drawPortrait(ctx, 42, 42, 84, look);
      } catch (e) {
        console.error(e); // картинка не вышла — останется подпись
      }
      bt.append(canvas, el('span', '', label));
      bt.onclick = () => {
        gender = g;
        for (const k in btns) {
          btns[k].classList.toggle('on', k === g);
          btns[k].setAttribute('aria-checked', k === g ? 'true' : 'false');
        }
        who.classList.remove('ask');
        if (hint.textContent === ASK) say('');
        sfx('tap');
        formLook = look; // и на берегу заставки — тот, кого выбрали
        showScene();
      };
      btns[g] = bt;
      who.appendChild(bt);
    }
    const ASK = 'Выбери, кто ты: хомячок или хомяшка 👆';
    const api = {
      name: inp,
      hint,
      who,
      onEnter: null,
      /** Всё ли выбрано: { name, gender } или null (и мягкая подсказка, чего не хватает). Пустое имя — «Хомка». */
      check() {
        clean();
        if (!gender) {
          say(ASK);
          who.classList.remove('ask');
          void who.offsetWidth; // чтобы покачивание началось заново
          who.classList.add('ask');
          return null;
        }
        return { name: inp.value || 'Хомка', gender };
      },
    };
    inp.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' || e.isComposing) return;
      inp.blur(); // убрать клавиатуру телефона: под ней — выбор и «Играть!»
      if (gender && api.onEnter) api.onEnter();
      else api.check();
    });
    // экранная клавиатура (iPhone, iPad): она закрывает низ страницы, а страница об этом не знает — поднимаем форму
    // над ней, чтобы имя, выбор и «Играть!» были видны все сразу
    const vv = window.visualViewport;
    const lift = () => {
      const hid = vv && document.activeElement === inp ? Math.round(window.innerHeight - vv.height - vv.offsetTop) : 0;
      const on = hid > 80;
      if (on) menu.style.setProperty('--kb', hid + 'px');
      if (menu.classList.contains('kb') !== on) {
        menu.classList.toggle('kb', on);
        if (scene) scene.relayout();
      }
    };
    if (vv) {
      vv.addEventListener('resize', lift);
      vv.addEventListener('scroll', lift);
      inp.addEventListener('focus', lift);
      inp.addEventListener('blur', () => setTimeout(lift, 50));
      offKb = () => {
        vv.removeEventListener('resize', lift);
        vv.removeEventListener('scroll', lift);
        menu.classList.remove('kb');
      };
    }
    return api;
  }
  let formLook = null; // герой, выбранный в форме новой игры (его и показывает сцена)
  let offKb = null; // снять слежение за экранной клавиатурой (форма новой игры)
  function render(mode) {
    if (offKb) offKb();
    offKb = null;
    if (formLook) {
      formLook = null;
      showScene();
    }
    menu.innerHTML = '';
    const games = listGames();
    if (mode === 'form' || (!games.length && !res.ok)) {
      menu.dataset.mode = 'form';
      if (res.problem === 'broken' && !games.length)
        menu.appendChild(
          el(
            'div',
            'sub',
            '<small>Старую игру не получилось открыть 😿<br>Мы её не выбросили, а отложили про запас.</small>',
          ),
        );
      menu.appendChild(el('div', 'sub', 'Как тебя зовут?'));
      const form = nameForm();
      const b = el('button', 'btn big green', 'Играть! ▶');
      b.dataset.act = 'play'; // метки data-act — для автотеста (dev/lib.js)
      b.onclick = () => {
        const who = form.check(); // { name, gender } или null — тогда форма сама мягко подсказала, чего не хватает
        if (!who) return sfx('tap');
        const why = prepareGame(who.name, who.gender); // запишется после сценки (beginNewGame)
        if (why) return noRoom(why);
        close(true);
      };
      form.onEnter = () => b.click();
      menu.append(form.name, form.hint, form.who, b);
      if (!games.length) {
        // браузер стёр данные сайта, а игра была сохранена в файл — вернуть её можно прямо отсюда
        const move = needMoveHint(); // приложение на iPhone и iPad: игры из Safari сюда сами не переходят
        const imp = el(
          'button',
          move ? 'btn blue t-import' : 'btn ghost small t-import',
          move ? '📂 Загрузить из файла' : '📂 Загрузить игру из файла',
        );
        imp.dataset.act = 'import';
        imp.onclick = () => {
          sfx('tap');
          askImport();
        };
        if (move)
          menu.appendChild(
            el(
              'div',
              'sub t-move',
              '<small><b>Перенести игру из Safari?</b> У приложения своя память — игры оттуда сами не приходят. В Safari: «Мои игры» → ⋯ → «Сохранить в файл», а здесь:</small>',
            ),
          );
        menu.appendChild(imp);
      }
      if (games.length) {
        const back = el('button', 'btn ghost', '← Назад');
        back.onclick = () => {
          sfx('tap');
          render('main');
        };
        menu.appendChild(back);
      }
    } else {
      menu.dataset.mode = 'main';
      if (res.ok) {
        menu.appendChild(el('div', 'sub', `С возвращением, ${esc(G.state.name)}!`));
        // открылась другая игра или копия — всё равно честно сказать, что с последней что-то не так
        const lost = res.lost || [];
        if (lost.length)
          menu.appendChild(
            el(
              'div',
              'sub',
              `<small>${lost.length > 1 ? 'Игры' : 'Игру'} «${lost.map(esc).join('», «')}» не получилось открыть 😿<br>Мы ${lost.length > 1 ? 'их' : 'её'} не выбросили, а отложили про запас.</small>`,
            ),
          );
        if (res.restored)
          menu.appendChild(
            el(
              'div',
              'sub',
              '<small>Игра открылась из запасной копии 💾 — что-то из последнего могло не сохраниться.</small>',
            ),
          );
        const b1 = el('button', 'btn big green', 'Продолжить ▶');
        b1.dataset.act = 'continue';
        b1.onclick = () => close(false);
        menu.appendChild(b1);
      } else if (res.problem === 'newer') {
        // сохранение от более новой версии игры: не трогаем, предлагаем обновить страницу
        menu.appendChild(
          el('div', 'sub', 'Игра обновилась, а страница — ещё нет.<br>Нажми «Обновить», чтобы продолжить свою игру.'),
        );
        const b1 = el('button', 'btn big green', 'Обновить 🔄');
        b1.dataset.act = 'reload';
        b1.onclick = () => location.reload();
        menu.appendChild(b1);
      } else if (res.problem === 'broken')
        menu.appendChild(el('div', 'sub', 'Последнюю игру не получилось открыть 😿'));
      const row = el('div', 't-row');
      const b2 = el('button', 'btn blue', '📒 Мои игры');
      b2.dataset.act = 'games';
      b2.onclick = () => {
        sfx('tap');
        openGames();
      };
      const b3 = el('button', 'btn ghost', '✨ Новая игра');
      b3.dataset.act = 'new';
      b3.onclick = () => {
        sfx('tap');
        askNew();
      };
      row.append(b2, b3);
      menu.appendChild(row);
    }
    fillApp();
    menu.appendChild(appSlot);
    showScene();
  }
  /** После удаления или неудачи: заново открыть последнюю игру и перерисовать кнопки. */
  function reopen() {
    res = openActive();
    render('main');
  }
  function noRoom(why) {
    if (why === 'full')
      return message({
        title: 'Все места заняты',
        icon: '🏠',
        html: `<p class="center big-emoji">🐹🐹🐹</p><p class="center">У тебя уже <b>${MAX_GAMES} игр</b> — больше не помещается.</p>
          <p class="center">Чтобы начать новую, сначала удали одну из старых: открой <b>«Мои игры»</b>, нажми <b>⋯</b> на карточке и выбери «Удалить игру».</p>`,
        buttons: [{ text: '📒 Мои игры' }, { text: 'Понятно', cls: 'ghost' }],
      }).then((i) => {
        if (i === 0) openGames();
      });
    return message({
      title: 'Не получилось',
      icon: '😿',
      html: '<p class="center">Новую игру не удалось записать — в памяти браузера нет места. Старые игры целы.</p><p class="center">Можно удалить одну из игр в «Моих играх» и попробовать ещё раз.</p>',
    });
  }
  function askNew() {
    syncGames();
    if (listGames().length >= MAX_GAMES) return noRoom('full');
    render('form');
  }

  // ---------- «Мои игры» ----------
  function openGames() {
    const opened = {}; // у каких карточек открыто «⋯»
    openPanel({
      title: 'Мои игры',
      icon: '📒',
      cls: 'narrow',
      render(body, tab, panel) {
        const games = listGames();
        const list = el('div', 'g-list');
        for (const g of games) {
          const card = el('div', 'g-card');
          card.dataset.id = g.id;
          const info = el(
            'div',
            'g-info',
            `<b>${esc(g.name || 'Хомка')}</b>${g.id === activeGame() ? ' <span class="g-last">последняя</span>' : ''}
             <span>📅 ${dateOf(g)}</span><span>🪙 ${fmtMoney(g.money || 0)}</span>`,
          );
          const play = el('button', 'btn green small g-play', 'Открыть ▶');
          play.onclick = () => {
            if (!switchGame(g.id)) {
              panel.close();
              reopen();
              return message({
                title: 'Не получилось',
                icon: '😿',
                html: `<p class="center">Игру «${esc(g.name)}» не удалось открыть. Остальные игры целы.</p>`,
              });
            }
            res = { ok: true, problem: null };
            panel.close();
            close(false);
          };
          const more = el('button', 'btn ghost small g-more', '⋯');
          more.setAttribute('aria-label', 'Ещё');
          more.onclick = () => {
            sfx('tap');
            opened[g.id] = !opened[g.id];
            panel.refresh();
          };
          card.append(portrait(g.look, 64), info, play, more);
          if (opened[g.id]) {
            const extra = el('div', 'g-extra');
            const save = el('button', 'btn blue small g-save', '💾 Сохранить в файл');
            save.onclick = () => {
              sfx('tap');
              saveToFile(g.id);
            };
            extra.appendChild(save);
            const rm = el('button', 'btn ghost small g-del', '🗑️ Удалить игру…');
            rm.onclick = () => {
              sfx('tap');
              askDelete(g, panel);
            };
            extra.appendChild(rm);
            card.appendChild(extra);
          }
          list.appendChild(card);
        }
        body.appendChild(list);
        body.appendChild(el('p', 'center muted', `Игр: ${games.length} из ${MAX_GAMES}. Каждая сохраняется сама.`));
        // про запас: отложенные нечитаемые сохранения и последняя удалённая игра (core/games.js)
        const spare = el('div', 'g-spare');
        for (const l of lostGames()) {
          const row = el(
            'div',
            'g-row g-lost',
            `<span>😿 <b>${esc(l.name)}</b> — не открывается, лежит про запас</span>`,
          );
          row.dataset.id = l.id;
          const again = el('button', 'btn ghost small', '🔁 Ещё раз');
          again.onclick = () => {
            sfx('tap');
            if (retryLost(l.id)) {
              panel.refresh();
              reopen();
            } else
              message({
                title: 'Пока не открывается',
                icon: '😿',
                html: `<p class="center">Игру «${esc(l.name)}» всё ещё не получается открыть. Она по-прежнему лежит про запас.</p><p class="center muted">Для взрослых: сохраните её в файл (💾) — так она точно не пропадёт.</p>`,
              });
          };
          const file = el('button', 'btn ghost small', '💾');
          file.setAttribute('aria-label', 'Сохранить в файл');
          file.onclick = () => {
            sfx('tap');
            saveToFile(l.id);
          };
          row.append(again, file);
          spare.appendChild(row);
        }
        const tr = trashInfo();
        if (tr) {
          const row = el('div', 'g-row g-trash', `<span>🗑️ Недавно удалена: <b>${esc(tr.name)}</b></span>`);
          const back = el('button', 'btn ghost small', '↩️ Вернуть');
          back.onclick = async () => {
            sfx('tap');
            const r = await restoreTrash();
            if (r.ok) {
              panel.refresh();
              return reopen();
            }
            if (r.why === 'full') return noRoom('full');
            message({
              title: 'Не получилось',
              icon: '😿',
              html: '<p class="center">Игру не удалось вернуть — в памяти браузера нет места. Она по-прежнему лежит про запас.</p>',
            });
          };
          row.appendChild(back);
          spare.appendChild(row);
        }
        if (spare.children.length) body.appendChild(spare);
        body.appendChild(
          el(
            'p',
            'g-hint muted',
            '<b>Для взрослых.</b> Игры хранятся в браузере. Safari на iPad может сам стереть данные сайта, если в игру не заходили около недели. Чтобы игра не пропала, сохраните её в файл: <b>⋯ → «Сохранить в файл»</b>. Вернуть — кнопкой «Загрузить из файла».',
          ),
        );
      },
      foot: [
        {
          text: '📂 Загрузить из файла',
          cls: 'blue',
          fn: (p) => askImport(p),
        },
        {
          text: '✨ Новая игра',
          cls: 'yellow',
          fn: (p) => {
            p.close();
            askNew();
          },
        },
      ],
    });
  }
  // ---------- игра файлом: защита от того, что браузер сотрёт данные сайта ----------
  /** Сохранить игру id в файл (вместе со снимками альбома). */
  async function saveToFile(id) {
    const f = await exportGame(id);
    if (!f || !downloadText(f.name, f.text))
      return message({
        title: 'Не получилось',
        icon: '😿',
        html: '<p class="center">Игру не удалось сохранить в файл. Сама игра цела.</p>',
      });
    message({
      title: 'Игра сохранена в файл',
      icon: '💾',
      html: `<p class="center big-emoji">💾</p><p class="center">Файл <b>«${esc(f.name)}»</b> — в папке загрузок (на iPad: «Файлы» → «Загрузки»).</p>
        <p class="center muted">Для взрослых: положите файл туда, где он не потеряется. Если игра пропадёт из браузера — «Мои игры» → «Загрузить из файла».</p>`,
      buttons: [{ text: 'Понятно' }],
    });
  }
  /** Загрузить игру из файла: она добавится новой игрой, остальные не трогаются. panel — открытые «Мои игры». */
  async function askImport(panel) {
    const f = await pickTextFile();
    if (!f) return;
    const r = f.error ? { why: 'bad' } : await importGame(f.text);
    if (r.ok) {
      if (panel) panel.refresh();
      reopen();
      return message({
        title: 'Игра загружена!',
        icon: '📂',
        html: `<p class="center big-emoji">🐹</p><p class="center">Игра, где живёт <b>${esc(r.name)}</b>, снова с тобой${r.photos ? ` — и снимки из альбома тоже (${r.photos})` : ''}.</p>
          <p class="center muted">Она появилась в «Моих играх». Остальные игры на месте.</p>`,
        buttons: [{ text: 'Ура!' }],
      });
    }
    if (r.why === 'full') return noRoom('full');
    const text = {
      bad: `Файл <b>«${esc(f.name)}»</b> не похож на сохранённую игру или он испорчен.</p><p class="center muted">Нужен файл, который игра сохранила сама: «Пушистая жизнь - имя - дата.json».`,
      newer:
        'Этот файл сохранён в более новой игре, а страница ещё старая.</p><p class="center">Обнови страницу и попробуй ещё раз.',
      store:
        'Игру не удалось записать — в памяти браузера нет места.</p><p class="center">Можно удалить одну из игр и попробовать ещё раз.',
    }[r.why];
    const i = await message({
      title: 'Не получилось загрузить',
      icon: '😿',
      html: `<p class="center">${text}</p><p class="center muted">Твои игры целы — ничего не изменилось.</p>`,
      buttons: r.why === 'newer' ? [{ text: 'Обновить 🔄' }, { text: 'Потом', cls: 'ghost' }] : [{ text: 'Понятно' }],
    });
    if (r.why === 'newer' && i === 0) location.reload();
  }
  /** Удаление — только нарочно: отдельное окно с именем, а кнопку «Да, удалить» нужно подержать. */
  function askDelete(g, listPanel) {
    let timer = 0;
    const p = openPanel({
      title: 'Удалить игру?',
      icon: '🗑️',
      cls: 'narrow',
      sticky: true,
      render(body) {
        const top = el('div', 'g-ask');
        top.append(
          portrait(g.look, 96),
          el(
            'p',
            'center',
            `Удалить игру, где живёт <b>${esc(g.name || 'Хомка')}</b>?<br><span class="muted">${dateOf(g)} · 🪙 ${fmtMoney(g.money || 0)}</span>`,
          ),
          el('p', 'center', 'Пропадёт всё: наряды, мебель, друзья и наклейки. Вернуть будет нельзя.'),
        );
        const keep = el('button', 'btn big green', 'Нет, оставить 💛');
        keep.onclick = () => p.close();
        const del = el('button', 'btn ghost g-hold', '<i></i><span>Да, удалить (нажми и держи)</span>');
        const stop = () => {
          clearTimeout(timer);
          del.classList.remove('on');
        };
        del.style.setProperty('--hold', HOLD_MS + 'ms');
        del.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          stop();
          del.classList.add('on');
          timer = setTimeout(() => {
            stop();
            deleteGame(g.id);
            sfx('paper');
            p.close();
            if (!listGames().length) listPanel.close();
            else listPanel.refresh();
            reopen();
          }, HOLD_MS);
        });
        for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) del.addEventListener(ev, stop);
        del.addEventListener('contextmenu', (e) => e.preventDefault());
        top.append(keep, del);
        body.appendChild(top);
      },
      onClose: () => clearTimeout(timer),
    });
  }

  render('main');
  // шрифты и размеры кнопок могли доехать позже — расставить сцену ещё раз
  requestAnimationFrame(() => current && current.scene === scene && scene.relayout());
}
