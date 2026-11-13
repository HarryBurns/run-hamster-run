// Отладочные хуки для автотестов (dev/smoke.js, dev/bench.js) и ручной отладки в консоли браузера.
// Всё собрано в одном объекте window.__dev; игра сама им не пользуется.
import { G, houseItems } from './core/state.js';
import * as actions from './core/actions.js';
import * as events from './core/events.js';
import * as registry from './core/registry.js';
import * as loop from './core/loop.js';
import * as audio from './core/audio.js';
import * as modals from './ui/modals.js';
import { message, openPanel } from './ui/panel.js';
import { dialog } from './ui/dialog.js';
import { toast } from './ui/toast.js';
import { createSideScene } from './engine/side/scene.js';
import { OWN as demoOwn } from './interiors/demo_house.js';
import * as World from './locations/town.js';
import * as Tower from './interiors/tower.js';

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

export function installDevHooks({ F }) {
  window.__dev = {
    /** Состояние времени выполнения: G.state — сохранение, G.time, G.view, G.modal. */
    G,
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
    World,
    Tower,
    get Villa() {
      return loop.scenes.villa;
    },
    Audio: audio,
    /** Войти в здание города по его id — так же, как если бы хомячок дошёл до двери. */
    enterBuilding: (id) => World.enterBuilding(World.BUILDINGS.find((b) => b.id === id)),
    /** Поставить хомячка на вилле: этаж и x. */
    villaAt: (floor, x) => loop.go('villa', { pos: { scene: 'villa', floor, x } }),
    openPiano: () => registry.run('piano'),
  };
}
