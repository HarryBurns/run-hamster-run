// Реестр действий: «что происходит, когда…». Сцены и описания (здания, предметы, встроенная мебель) не знают
// про окна магазинов, мини-игры и прочие занятия. Они называют действие, а выполняет его тот, кто
// зарегистрировался под этим именем (обычно файл из features/).
//
//   register('shop', (p, ctx) => …, 'что делает и какие поля читает');   // в features/shops.js
//   run('bank');                                    // просто имя
//   run('minigame:chef');                           // имя и короткий аргумент → p = { arg: 'chef' }
//   run({ do: 'shop', kind: 'cafe', title: '…' });  // имя и параметры → p — сам объект
//   run(building.act, { building, back });          // ctx — кто и откуда вызвал (что угодно)
//
// Действие записывают в данных: у здания — поле act, у встроенного предмета дома — act, у кнопки диалога — do.
// Как добавить своё — см. docs/ARCHITECTURE.md.

const handlers = new Map(); // имя → { fn, doc }

/** Зарегистрировать действие. fn(p, ctx): p — параметры из описания, ctx — что передал вызвавший. */
export function register(name, fn, doc = '') {
  if (handlers.has(name)) console.warn(`Действие «${name}» зарегистрировано дважды`);
  handlers.set(name, { fn, doc });
}

/** Разобрать запись действия: строка 'имя' / 'имя:аргумент' или объект { do: 'имя', … }. */
function parse(spec) {
  if (typeof spec === 'string') {
    const i = spec.indexOf(':');
    return i < 0 ? { do: spec } : { do: spec.slice(0, i), arg: spec.slice(i + 1) };
  }
  return spec && typeof spec === 'object' && typeof spec.do === 'string' ? spec : null;
}

export function has(spec) {
  const p = parse(spec);
  return !!p && handlers.has(p.do);
}

/** Выполнить действие. Возвращает то, что вернул обработчик (у окон и диалогов это часто Promise). */
export function run(spec, ctx = {}) {
  const p = parse(spec);
  const h = p && handlers.get(p.do);
  if (!h) {
    console.error(`Неизвестное действие: ${JSON.stringify(spec)}`);
    return undefined;
  }
  return h.fn(p, ctx);
}

/** Список действий с описаниями (для документации и отладки). */
export const listActions = () => [...handlers.entries()].map(([name, h]) => ({ name, doc: h.doc }));
