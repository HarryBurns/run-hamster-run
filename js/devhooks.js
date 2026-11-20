// Отладочные хуки для автотестов (dev/smoke.js, dev/bench.js) и ручной отладки в консоли браузера.
// Всё собрано в одном объекте window.__dev; игра сама им не пользуется.
import {
  G,
  houseItems,
  questNow,
  questBadge,
  findsWanted,
  landOpen,
  npcLookNow,
  OLD_START_VILLA,
} from './core/state.js';
import * as actions from './core/actions.js';
import * as events from './core/events.js';
import * as registry from './core/registry.js';
import * as loop from './core/loop.js';
import * as audio from './core/audio.js';
import * as modals from './ui/modals.js';
import * as games from './core/games.js';
import { titleDebug } from './features/title.js';
import { titleArtPixels } from './features/title_art.js';
import { message, openPanel } from './ui/panel.js';
import { dialog } from './ui/dialog.js';
import { toast } from './ui/toast.js';
import { createSideScene } from './engine/side/scene.js';
import { OWN as demoOwn } from './interiors/demo_house.js';
import town, { sea, BUILDINGS } from './locations/town.js';
import * as topdown from './engine/topdown/index.js';
import { pixStats } from './core/pixcache.js';
import { devGames } from './core/dev.js';
import { PLANTS, hasFruit, plantInSeason, gather } from './locations/common/plants.js';
import * as Tower from './interiors/tower.js';
import { debugDecor, debugFireworks } from './locations/holidays.js';
import { debugLandDecor } from './locations/holidays_lands.js';
import { debugRoomDecor } from './interiors/holidays_rooms.js';
import { viewFireworks } from './interiors/tower_view.js';
import { HOLIDAY_BY_ID, holidayDoy, YEAR_DAYS, SEASON_OF_MONTH, SLEEP_FROM, VILLA_UP_OLD } from './data/index.js';

/**
 * Следить, что состояние меняют только действия из core/actions.js: подменяет G.state «прозрачной обёрткой»,
 * которая записывает каждую запись, сделанную мимо действий. Возвращает функцию: вызови её — получишь
 * список нарушений (и слежка выключится). Только для тестов: с обёрткой игра работает медленнее.
 */
function watchState() {
  const raw = G.state,
    bad = [],
    seen = new WeakMap();
  const wrap = (obj, path) => {
    if (!obj || typeof obj !== 'object') return obj;
    let p = seen.get(obj);
    if (p) return p;
    const note = (key) => {
      if (actions.inAction()) return;
      const where = (new Error().stack || '').split('\n').slice(2, 5).join(' | ');
      bad.push(`${path}.${String(key)} — ${where}`);
    };
    p = new Proxy(obj, {
      get: (t, k) => wrap(t[k], `${path}.${String(k)}`),
      set: (t, k, v) => {
        if (t[k] !== v) note(k);
        t[k] = v;
        return true;
      },
      deleteProperty: (t, k) => {
        note(k);
        delete t[k];
        return true;
      },
    });
    seen.set(obj, p);
    return p;
  };
  G.state = wrap(raw, 'state');
  return () => {
    G.state = raw;
    return bad;
  };
}

// Город и его море одним объектом — так к ним обращаются тесты (dev/*.js).
const World = Object.assign(Object.create(town), {
  BUILDINGS,
  isBoating: sea.isBoating,
  leaveBoat: sea.leaveBoat,
  dive: sea.dive,
  canDive: sea.canDive,
  debugSea: sea.debugSea,
  debugSeaShow: sea.debugSeaShow,
  portAt: sea.portAt, // причал джунглей за буйками: куда подплыть кораблику
  grottoAt: sea.grottoAt, // буёк-ракушка над подводным гротом секретного пляжа
  farAt: sea.farAt, // отметка «Далеко на юг»: отсюда кораблик плывёт на удалённый остров
  debugDolphins: sea.debugDolphins, // дельфины выпрыгивают перед хомячком (С5)
  dolphinJump: sea.dolphinJump,
});

export function installDevHooks({ F }) {
  window.__dev = {
    /** Состояние времени выполнения: G.state — сохранение, G.time, G.view, G.modal. */
    G,
    /** Несколько игр (core/games.js): список, активная, создать, открыть, удалить. */
    games,
    /** Сцена заставки, пока она открыта (features/title_scene.js): title.debug() — где что стоит и что потрогали. */
    get title() {
      const t = titleDebug();
      return t ? t.scene : null;
    },
    get state() {
      return G.state;
    },
    get sceneName() {
      return loop.sceneName();
    },
    get scene() {
      return loop.scene();
    },
    scenes: loop.scenes,
    /** Перейти в сцену: go('villa'), go('world', { pos: { x, y } }). */
    go: (name, params) => loop.go(name, params && typeof params === 'object' ? params : {}),
    /** Выйти из «внутренней» сцены (башня, под водой) туда, откуда в неё пришли. */
    back: () => {
      const pos = loop.scene().savePos();
      loop.go(pos.scene, { pos });
    },
    registerScene: loop.registerScene,
    /** «Движок домов»: собрать сцену из описания дома; demoOwn — пробное «своё жильё» для тестов. */
    createSideScene,
    demoOwn,
    /** Выполнить действие из реестра: run('bank'), run('minigame:swim'). */
    run: registry.run,
    listActions: registry.listActions,
    emit: events.emit,
    events,
    actions,
    houseItems,
    watchState,
    /** Окна: очередь (enqueue, queued), слои и сами окна — для тестов. */
    ui: { ...modals, message, openPanel, dialog, toast },
    /** Занятия (features): F.openWardrobe(), F.playMinigame('swim') … */
    F,
    /** Город (сцена-локация) вместе с функциями его моря: World.debugTeleport(x, y), World.leaveBoat()… */
    World,
    /** «Движок локаций»: locations — все локации по имени сцены, getLocation(name), currentLocation(). */
    topdown,
    locations: topdown.locations,
    /** Плодовые растения: Plants.PLANTS (что на чём растёт), hasFruit(o), plantInSeason(o), gather(сцена, o). */
    Plants: { PLANTS, hasFruit, plantInSeason, gather },
    /**
     * Память кэшей картинок (core/pixcache.js), пикселей: всего, предел, спрайты локаций, земля, кадры заставки
     * (title — после выхода в игру 0), остальное — дома.
     */
    pix() {
      const st = pixStats(),
        sprites = topdown.SP.pixels,
        ground = topdown.getLocation('world').debugGround().pixels,
        title = titleArtPixels();
      return { ...st, sprites, ground, title, layers: st.total - sprites - ground - title };
    },
    pixClock: () => pixStats().clock,
    Tower,
    /** Журнал заданий (только чтение): questNow('herbarium'), questBadge('myata'), findsWanted('herb'), landOpen('forest'). */
    QuestState: { questNow, questBadge, findsWanted, landOpen },
    get Villa() {
      return loop.scenes.villa;
    },
    Audio: audio,
    /**
     * Для автотеста: начало игры, как до этапа 10, — 1 января (день 0), зима и снег, тёплый наряд, салат в семенах,
     * без вводной цепочки заданий. Шаги, написанные для такой игры (что есть на прилавках в первый день, кто где
     * гуляет, холод), зовут это сразу после «Новой игры»; шаги про само начало игры (dev/smoke_start.js) — нет.
     */
    oldStart() {
      actions.mutate((s) => {
        s.day = 0;
        s.startDay = 0;
        s.immuneUntil = 3;
        s.weather = 'snow';
        s.look.outfit = {
          head: 'beanie_red',
          body: 'jw_blue',
          legs: 'pants_jeans',
          feet: 'boots_brown',
          acc: 'scarf_yellow',
        };
        s.seeds = { seed_lettuce: 2 };
        s.flags.intro = 0;
      });
      events.emit('look');
      events.emit('hud');
    },
    /**
     * «Вилла растёт», для автотеста: вилла целиком, как до этого обновления, — три этажа, пруд, бассейн, 8 грядок и
     * прежняя стартовая мебель (спальня на втором этаже, колесо, диван…). Шаги, написанные для такой виллы, зовут это
     * после «Новой игры» (dev/lib.js: fresh() делает это сам, кроме villa: 'small'). Хомячок — у кровати.
     */
    villaFull() {
      actions.mutate((s) => {
        s.villaUp = { ...VILLA_UP_OLD };
        s.villa = OLD_START_VILLA.filter((r) => r[4] !== 'table').map(([id, floor, x, y]) => ({
          uid: s.uid++,
          id,
          floor,
          x,
          y: y || 0,
        }));
      });
      events.emit('villaUp', { what: 'set' });
      if (loop.sceneName() === 'villa') loop.go('villa', { wake: true });
    },
    /** «Вилла растёт»: построить ступень сразу (без ночи): villaUp('house1'), villaUp('pond'). Возвращает id или null. */
    villaUp(id) {
      actions.orderVillaUp(id);
      return actions.finishVillaUp(true);
    },
    /**
     * Вечер: часы не раньше m (по умолчанию SLEEP_FROM — 19:00, с этого часа можно лечь спать; этап 18).
     * Шаги автотеста, которые спят через окно «Пора спать?», зовут это перед сном. Возвращает минуты.
     */
    evening(m = SLEEP_FROM) {
      actions.mutate((s) => {
        if (s.minutes < m) s.minutes = m;
      });
      events.emit('hud');
      return G.state.minutes;
    },
    /**
     * Для автотеста (Т3): мини-игры по времени идут быстрее — fastGames(true) в 4 раза, fastGames(8) — в 8, false —
     * как обычно. Игра та же самая (minigames/kit.js: шаги обычной длины, только несколько за кадр), короче лишь
     * настоящее время ожидания. Перезагрузка страницы возвращает обычную скорость. Возвращает скорость.
     */
    fastGames(on = true) {
      devGames.speed = on === true ? 4 : Math.max(1, Math.round(+on || 1));
      return devGames.speed;
    },
    /** Войти в здание города по его id — так же, как если бы хомячок дошёл до двери. */
    enterBuilding: (id) => town.enterBuilding(BUILDINGS.find((b) => b.id === id)),
    /** Поставить хомячка на вилле: этаж и x. */
    villaAt: (floor, x) => loop.go('villa', { pos: { scene: 'villa', floor, x } }),
    openPiano: () => registry.run('piano'),
    /**
     * Праздники (П.13): перескочить к празднику и посмотреть, что с ним.
     *   holiday.to('newyear')               — утро самого праздника (год 1; отметки дня чистые, погода — снег зимой,
     *                                         солнце в другие сезоны); «Год в городе» (id birthday) — через год после начала игры:
     *                                         to('birthday', 'day', 2)
     *   holiday.to('xmas', 'eve', 2)        — канун ('eve'), праздник ('day'), следующий день ('after'); год 2
     *   holiday.dayOf('cny', 'day', 1)      — номер дня без перехода
     *   holiday.state()                     — где праздник сейчас (шаги, подарок года, украшения)
     *   holiday.decor()                     — что стоит в городе (украшения, фейерверк, закрытые клетки, конверты)
     */
    holiday: {
      dayOf(id, when = 'day', year = 1) {
        const h = HOLIDAY_BY_ID[id];
        return (year - 1) * YEAR_DAYS + holidayDoy(h) + (when === 'eve' ? -1 : when === 'after' ? 1 : 0);
      },
      to(id, when = 'day', year = 1, minutes = 10 * 60) {
        const day = this.dayOf(id, when, year);
        actions.mutate((s) => {
          s.day = Math.max(0, day);
          s.startDay = Math.min(s.startDay || 0, s.day); // игра началась не позже этого дня (новая — 1 июня)
          s.minutes = minutes;
          s.dayFlags = {};
          s.weather = SEASON_OF_MONTH[Math.floor((s.day % YEAR_DAYS) / 3)] === 'winter' ? 'snow' : 'sun';
        });
        events.emit('hud');
        return G.state.day;
      },
      state: () => F.debugHoliday(),
      decor: () => debugDecor(topdown.getLocation('world')),
      /** Залпы новогоднего салюта: где раскрываются (доли экрана). */
      fireworks: () => debugFireworks(topdown.getLocation('world')),
      /** Этап 15: во что одет житель сейчас ({ слот: id вещи }) — в праздник праздничный наряд. */
      dress: (id) => Object.fromEntries(Object.entries(npcLookNow(id).outfit).map(([k, v]) => [k, v ? v.id : null])),
      /** Этап 15: украшения праздника в другой локации (рисунки) и в домах (праздник, сколько комнат нарисовано). */
      lands: (name) => debugLandDecor(topdown.getLocation(name)),
      rooms: () => debugRoomDecor(),
      /** Этап 15: виден ли салют с башни и в подзорную трубу. */
      towerFireworks: () => viewFireworks(),
    },
  };
}
