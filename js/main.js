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
import { START_MONEY, FLIPFLOPS_GIFT } from './data/index.js';
import { unlockAudio } from './core/audio.js';
import { message } from './ui/panel.js';
import { toast } from './ui/toast.js';
import { initHud, buildHud, updateHud } from './ui/hud.js';
import { installItemIcons } from './ui/itemicons.js';
import town from './locations/town.js';
import demoMeadow from './locations/demo_meadow.js';
import forest from './locations/forest.js';
import mountain from './locations/mountain.js';
import caves from './locations/caves.js';
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

const canvas = document.getElementById('game');
const hud = document.getElementById('hud');

// Сцены игры. Локации — описания (locations/*.js) для «движка локаций», дома — описания (interiors/*.js)
// для «движка домов».
for (const loc of [town, forest, mountain, caves, desert, jungle, cove, island, demoMeadow]) registerScene(loc.name, loc); // demo_meadow — пробная, входа в игре нет
registerScene('tower', TowerScene);
registerScene('dive', DiveScene);
// HOUSES — вилла, покупное жильё и дома жителей (interiors/houses.js); demo_house — пробный, входа в игре нет
for (const house of [...HOUSES, demoHouse]) registerScene(house.id, createSideScene(house));
const HOME = villa.id; // сцена-дом: там начинается новая игра, туда возвращает окно «Что-то сломалось»

// ---------- HUD ----------
// Кнопка «Домой» ведёт в основной дом (его выбирают в окне «Мои дома») — см. features/homes.js.
const goHome = () => F.askGoHome();
installItemIcons(); // рисованные значки вещей в окнах и подсказках (ui/itemicons.js)
initHud(hud, {
  right: [
    { icon: '🎒', label: 'Рюкзак', fn: F.openBackpack },
    { icon: '📖', label: 'Альбом', fn: F.openAlbum },
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
});

/** Игра спотыкается в каждом кадре: честно сказать об этом и предложить выход. */
function showBroken() {
  message({
    title: 'Ой! Что-то сломалось',
    icon: '🛠️',
    sticky: true,
    html: '<p class="center big-emoji">🙈</p><p class="center">Игра споткнулась. Давай вернёмся домой — там всё починится. Твои вещи и друзья на месте!</p>',
    buttons: [{ text: 'Домой 🏡' }, { text: 'Перезапустить игру', cls: 'ghost' }],
  }).then((i) => {
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

// ---------- начало игры (заставка — features/title.js) ----------
function startGame(fresh) {
  buildHud();
  F.initEvents();
  const s = G.state;
  if (!s.mail) F.newDayMail();
  // новая игра — просыпаемся дома; продолжение — там, где остановились (если такой сцены нет — дома)
  if (fresh) go(HOME, { wake: true });
  else go(s.pos && scenes[s.pos.scene] ? s.pos.scene : HOME, { pos: s.pos });
  updateHud();
  setTimeout(preloadMinigames, 5000); // в простое, не мешая началу игры
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
  // шлёпанцы в подарок (У2, один раз): в новой игре они уже лежат в шкафу, в старом сохранении — появляются
  if (!s.flags.flipflopsGift) {
    setFlag('flipflopsGift');
    const text = '🩴 Подарок к лету: в шкафу появились розовые шлёпанцы! На пляже ты будешь ходить в них сама.';
    if (addClothes(FLIPFLOPS_GIFT)) setTimeout(() => toast(text, 'good'), 3500);
  }
  if (!fresh) F.showBankLetter(); // после переноса старого сохранения — письмо банка (один раз)
  if (fresh) {
    award('x_first', { quiet: true });
    message({
      title: 'Добро пожаловать в Ореховую Гавань!',
      icon: '🏡',
      sticky: true,
      html: `<p class="center big-emoji">🐹</p><p>Привет, <b>${esc(s.name)}</b>! Это твоя вилла: три этажа, сауна, джакузи и бассейн. А в Хомяк-Банке у тебя <b>🪙 ${fmtMoney(START_MONEY)} монет</b> на первое время.</p>
        <p>На дворе <b>июнь</b> и лето ☀️. Рядом — городок <b>Ореховая Гавань</b>: море, магазины, друзья и приключения.</p>
        <p>🪙 Монеты можно <b>заработать</b>: поработай в школе, больнице или ресторане, выполняй задания из писем, продавай на рынке урожай и рыбу.</p>
        <p>✉️ У входной двери висит <b>почтовый ящик</b> — в нём уже лежит первое письмо. Выходи через дверь на первом этаже!</p>
        <p>🚪 А скоро заглянут <b>соседи</b> — они всё покажут и расскажут.</p>`,
      buttons: [{ text: 'Поехали!' }, { text: '❓ Как играть', cls: 'yellow' }],
    }).then((i) => {
      if (i === 1) F.showHelp();
    });
  }
}
every(0.25, F.updateSound, { needScene: false });
every(1, updateHud);
every(20, persist);
installDevHooks({ F });
// новая игра: сначала вступительная сценка — переезд в Ореховую Гавань (features/intro.js), потом сама игра
openTitle({ start: (fresh) => (fresh ? F.playIntro({ name: G.state.name }).then(() => startGame(true)) : startGame(false)) });
startLoop(canvas, { onBroken: showBroken, onGesture: unlockAudio });
