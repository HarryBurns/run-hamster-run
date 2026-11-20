// Запуск игры: собирает вместе сцены, HUD и заставку. Имён сцен здесь нет нигде, кроме их регистрации.
import { G, repair } from './core/state.js';
import { mutate, award, addItem, addClothes, setFlag } from './core/actions.js';
import {
  startLoop,
  registerScene,
  scenes,
  go,
  scene,
  every,
  persist,
  dropScene,
  resetFailures,
  safely,
} from './core/loop.js';
import { esc, fmtMoney } from './core/util.js';
import { FLIPFLOPS_GIFT } from './data/index.js';
import { unlockAudio } from './core/audio.js';
import { on } from './core/events.js';
import { installGenderNet } from './core/gender.js';
import { migrateAllPhotos } from './core/photos.js';
import { message } from './ui/panel.js';
import { enqueue } from './ui/modals.js';
import { toast } from './ui/toast.js';
import { initHud, buildHud, updateHud } from './ui/hud.js';
import { installItemIcons } from './ui/itemicons.js';
import town from './locations/town.js';
import demoMeadow from './locations/demo_meadow.js';
import forest from './locations/forest.js';
import mountain from './locations/mountain.js';
import caves from './locations/caves.js';
import deep from './locations/deep.js'; // нижний ярус пещер — подземная река (этап 17в)
import desert from './locations/desert.js';
import jungle from './locations/jungle.js';
import cove from './locations/cove.js';
import island from './locations/island.js';
import { createSideScene } from './engine/side/scene.js';
import villa from './interiors/villa.js';
import demoHouse from './interiors/demo_house.js';
import { HOUSES } from './interiors/houses.js';
import TowerScene from './interiors/tower.js';
import DiveScene from './interiors/dive.js';
import * as F from './features/index.js';
import { preloadMinigames } from './minigames/host.js';
import { openTitle } from './features/title.js';
import { installDevHooks } from './devhooks.js';
import { DEV } from './core/dev.js';

const canvas = document.getElementById('game');
const hud = document.getElementById('hud');

// Сцены игры. Локации — описания (locations/*.js) для «движка локаций», дома — описания (interiors/*.js)
// для «движка домов».
for (const loc of [town, forest, mountain, caves, deep, desert, jungle, cove, island]) registerScene(loc.name, loc);
if (DEV) registerScene(demoMeadow.name, demoMeadow); // demo_meadow — пробная, входа в игре нет (только отладка)
registerScene('tower', TowerScene);
registerScene('dive', DiveScene);
// HOUSES — вилла, покупное жильё и дома жителей (interiors/houses.js); demo_house — пробный, входа в игре нет
for (const house of [...HOUSES, ...(DEV ? [demoHouse] : [])]) registerScene(house.id, createSideScene(house));
const HOME = villa.id; // сцена-дом: там начинается новая игра, туда возвращает окно «Что-то сломалось»

// ---------- HUD ----------
// Кнопка «Домой» ведёт в основной дом (его выбирают в окне «Мои дома») — см. features/homes.js.
const goHome = () => F.askGoHome();
installGenderNet(); // «{он|она}» в текстах — под пол героя: ничего сырого на экран не попадает (core/gender.js)
installItemIcons(); // рисованные значки вещей в окнах и подсказках (ui/itemicons.js)
initHud(hud, {
  right: [
    { icon: '🎒', label: 'Рюкзак', fn: F.openBackpack },
    { icon: '📖', label: 'Альбом', fn: F.openAlbum },
    { icon: '📷', label: 'Фото', fn: F.openPhotoMode }, // фото-режим (этап 17в, features/photo.js)
    { icon: '📱', label: 'Гости', fn: F.openPhone },
    { icon: '⚙️', label: 'Меню', fn: F.openSettings },
  ],
  // плашка письма: по нажатию — письмо, и звёздочка снова ведёт к заданию из письма (а не из журнала)
  task: {
    info: F.taskChip,
    fn: () => {
      F.trackQuest(null);
      F.trackHoliday(false);
      F.showLetter();
    },
  },
  // плашка журнала: задание из журнала, а если его нет — ход праздника сегодня (П.13)
  quest: {
    info: () => {
      const q = F.questChip();
      return q || F.holidayChip(q);
    },
    fn: () => F.openAlbum('quests'),
  },
  // плашка даты: значок праздника сегодня и завтра; по нажатию — праздничный календарь (П.13)
  date: { badge: F.holidayBadge, fn: F.openHolidays },
  map: { icon: '🗺️', label: 'Карта', fn: F.openMap },
  home: { icon: '🏡', label: 'Домой', fn: goHome },
  sick: { fn: F.showSickHelp },
  boost: { fn: F.showBoostHelp }, // 💆 бодрость после спа (От7)
});

/** Игра спотыкается в каждом кадре (или ошибки сыплются вне кадра): честно сказать об этом и предложить выход. */
let brokenOpen = false;
function showBroken() {
  if (brokenOpen) return; // окно уже на экране
  brokenOpen = true;
  message({
    title: 'Ой! Что-то сломалось',
    icon: '🛠️',
    sticky: true,
    quiet: true, // подсказки не ложатся на это окно
    html: '<p class="center big-emoji">🙈</p><p class="center">Игра споткнулась. Давай вернёмся домой — там всё починится. Твои вещи и друзья на месте!</p>',
    buttons: [{ text: 'Домой 🏡' }, { text: 'Перезапустить игру', cls: 'ghost' }],
  }).then((i) => {
    brokenOpen = false;
    if (i === 1) {
      location.reload();
      return;
    }
    resetFailures(); // если не помогло — окно появится снова
    safely(() => {
      const sc = scene();
      if (sc && sc.leave) sc.leave();
    });
    dropScene(); // чтобы go() не звал leave() сломанной сцены второй раз
    safely(() => {
      mutate((s) => repair(s));
      if (!G.state.mail) F.newDayMail();
      go(HOME, { pos: { scene: HOME, floor: 0, x: 290 } });
    });
  });
}

// Ошибки вне кадра (кнопки окон, занятия в async-функциях, таймеры) цикл игры не видит. Считаем их здесь: несколько
// подряд за короткое время — то же окно «Что-то сломалось». Только ошибки из наших файлов (js/): расширения браузера
// и чужие скрипты сыплют своими, ребёнку о них знать незачем.
const OUR_JS = new URL('./', import.meta.url).href;
const ERR_LIMIT = 3,
  ERR_WINDOW = 20000; // мс
let errTimes = [];
function countError(where) {
  if (!where || !String(where).includes(OUR_JS)) return;
  const now = performance.now();
  errTimes = errTimes.filter((t) => now - t < ERR_WINDOW);
  errTimes.push(now);
  if (errTimes.length >= ERR_LIMIT && G.state) {
    errTimes = [];
    showBroken();
  }
}
window.addEventListener('error', (e) => countError(e.filename || (e.error && e.error.stack)));
window.addEventListener('unhandledrejection', (e) => countError(e.reason && e.reason.stack));

// Попросить браузер не стирать сохранения сам (Safari чистит данные сайта, где давно не были), — после первого
// нажатия: так браузер охотнее соглашается. Тихо: не умеет или отказал — играем как раньше.
const askKeep = () => {
  document.removeEventListener('pointerdown', askKeep, true);
  document.removeEventListener('keydown', askKeep, true);
  try {
    const st = navigator.storage;
    if (st && st.persist) Promise.resolve(st.persist()).catch(() => {});
  } catch (e) {
    /* не поддерживается */
  }
};
document.addEventListener('pointerdown', askKeep, true);
document.addEventListener('keydown', askKeep, true);

// Сохранение не записалось (core/state.js, save): игра идёт дальше и повторяет запись сама, а взрослому один раз
// за сеанс объясняем, что делать. Окно — из очереди, чтобы не лечь поверх диалога или мини-игры.
let saveWarned = false;
on('saveFail', ({ quota }) => {
  if (saveWarned) return;
  saveWarned = true;
  const why = quota
    ? 'Места для сохранений мало: удалите старые фото в альбоме 📖 или ненужные игры на заставке («Мои игры»).'
    : 'Браузер не даёт игре хранить сохранения: может быть, открыт режим «инкогнито» или запрещено хранить данные сайтов.';
  enqueue(() =>
    message({
      title: 'Игра не может сохраниться',
      icon: '💾',
      html: `<p class="center big-emoji">💾</p><p><b>Для взрослых.</b> ${why}</p><p>Пока страница открыта, играть можно — игра сама попробует сохраниться ещё раз.</p>`,
      buttons: [{ text: 'Понятно' }],
    }),
  );
});

// Игру открыли в другой вкладке (или её открыла страница с более новым кодом): эта вкладка больше не сохраняется
// (core/state.js, «чьё живое сохранение») — говорим об этом сразу, и дальше можно только перезагрузить страницу.
on('saveLost', ({ why }) => {
  const newer = why === 'newer';
  enqueue(() =>
    message({
      title: newer ? 'Игра обновилась' : 'Игра открыта дважды',
      icon: newer ? '🔄' : '🪟',
      sticky: true,
      quiet: true, // окно важнее подсказок: они его не закрывают
      html: newer
        ? '<p class="center big-emoji">🔄</p><p class="center">Игра обновилась — перезагрузи страницу, чтобы играть дальше.</p><p class="center muted">Здесь осталась старая страница: она больше не сохраняет игру, чтобы ничего не испортить.</p>'
        : '<p class="center big-emoji">🪟🪟</p><p class="center">Эту игру открыли ещё в одной вкладке или окне — теперь она сохраняется <b>там</b>, а здесь больше не сохраняется.</p><p class="center muted">Закрой эту вкладку и играй в другой. Или нажми «Играть здесь» — тогда закрой другую.</p>',
      buttons: [{ text: newer ? 'Обновить 🔄' : 'Играть здесь 🔄' }],
    }).then(() => location.reload()),
  );
});

// ---------- начало игры (заставка — features/title.js) ----------
function startGame(fresh) {
  buildHud();
  F.initEvents();
  const s = G.state;
  // отметка «игра началась» (до первой записи в go): без неё нетронутая игра считается пустой (core/games.js: blankGame)
  if (!s.flags.begun) setFlag('begun');
  if (!s.mail) F.newDayMail();
  // новая игра — просыпаемся дома; продолжение — там, где остановились (если такой сцены нет — дома)
  if (fresh) go(HOME, { wake: true });
  else go(s.pos && scenes[s.pos.scene] ? s.pos.scene : HOME, { pos: s.pos });
  updateHud();
  setTimeout(preloadMinigames, 5000); // в простое, не мешая началу игры
  F.startInstallHint(); // через время игры — подсказка взрослым «поставить на экран „Домой“» (features/install.js)
  // пианино в подарок (один раз), чтобы было на чём играть
  if (!s.flags.pianoGift) {
    setFlag('pianoGift');
    if (!s.villa.some((i) => i.id === 'piano') && !s.storage.piano) {
      addItem('storage', 'piano', 1);
      setTimeout(
        () => toast('🎹 В кладовке появилось пианино! Дома нажми 🔨 и поставь его.', 'good'),
        fresh ? 9000 : 1500,
      );
    }
  }
  // шлёпанцы в подарок (У2, один раз) — старым сохранениям; в новой игре шкаф пустой, шлёпанцы покупают
  if (!s.flags.flipflopsGift) {
    setFlag('flipflopsGift');
    const text = '🩴 Подарок к лету: в шкафу появились розовые шлёпанцы! На пляже ты будешь ходить в них сам{|а}.';
    if (!fresh && addClothes(FLIPFLOPS_GIFT)) setTimeout(() => toast(text, 'good'), 3500);
  }
  if (!fresh) F.showBankLetter(); // после переноса старого сохранения — письмо банка (один раз)
  if (fresh) {
    award('x_first', { quiet: true });
    // продолжение вступления (features/intro.js): на сбережения куплен домик, на счету осталось столько-то монет.
    // («купила», «копила» — в женском роде: при выборе героя — две формы)
    message({
      title: 'Добро пожаловать в Ореховую Гавань!',
      icon: '🏡',
      cls: 'narrow wrap-title', // заголовок не обрезается, а переносится (css/style.css)
      sticky: true,
      html: `<p class="center big-emoji">🏡</p><p>Привет, <b>${esc(s.name)}</b>! На монетки, которые ты так долго копил{|а}, ты купил{|а} маленький домик на холме в Ореховой Гавани. Теперь он твой!</p>
        <p>А на счету ещё осталось <b>🪙 ${fmtMoney(s.money)} монет</b> — на первое время.</p>
        <p>За окном <b>июнь</b> ☀️, впереди тёплое море и целое лето. Какой будет новая жизнь — решать тебе!</p>`,
      buttons: [
        { text: 'Поехали!', act: 'go' },
        { text: '❓ Как играть', cls: 'yellow', act: 'help' },
      ],
    }).then((i) => {
      if (i === 1) F.showHelp();
    });
  }
}
every(0.25, F.updateSound, { needScene: false });
every(1, updateHud);
every(20, persist);
// Отладочные хуки window.__dev (dev/smoke.js, dev/bench.js, консоль) — только на своём компьютере (localhost) или
// с ?dev в адресе (core/dev.js); в выложенной игре их нет. F — все функции занятий (features/index.js: devAll).
if (DEV) installDevHooks({ F: F.devAll() });
F.registerOffline(); // service worker: сеть сначала, кэш — если сети нет (sw.js, features/install.js)
migrateAllPhotos(); // снимки альбома, оставшиеся в localStorage, — в IndexedDB (один раз; освобождает место под игры)
// новая игра: сначала вступительная сценка — переезд в Ореховую Гавань (features/intro.js), потом сама игра; записывается
// она только теперь — begin() (features/title.js, З23)
openTitle({
  start: (fresh, begin) =>
    fresh
      ? F.playIntro({ name: G.state.name }).then(() => {
          begin();
          startGame(true);
        })
      : startGame(false),
});
startLoop(canvas, { onBroken: showBroken, onGesture: unlockAudio });
