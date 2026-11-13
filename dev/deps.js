// Проверка зависимостей между модулями js/: нет ли круговых импортов и соблюдаются ли слои.
// Запуск:  node dev/deps.js [--tree]      (браузер и сервер не нужны; код возврата 1 — есть нарушения)
//
// Слои (модуль может импортировать только то, что ниже, и соседей по своей папке):
//   main.js, devhooks.js
//   features/                 занятия и окна
//   locations/, interiors/    сцены и описания мест и домов
//   engine/, minigames/       движки сцен; мини-игры
//   ui/                       окна, диалоги, HUD
//   art/                      рисование хомячка и мебели
//   core/                     цикл, состояние, действия, события, ввод, камера, звук
//   data/                     таблицы — не импортируют ничего, кроме друг друга
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LAYERS = [
  ['js/data/', 0],
  ['js/core/', 1],
  ['js/art/', 2],
  ['js/ui/', 3],
  ['js/engine/', 4],
  ['js/minigames/', 4],
  ['js/locations/', 5],
  ['js/interiors/', 5],
  ['js/features/', 6],
  ['js/', 7], // main.js, devhooks.js
];
const layerOf = (f) => LAYERS.find(([p]) => f.startsWith(p));

const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const p = dir + '/' + e.name;
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.js')) files.push(p);
  }
})('js');

// статические импорты и import('…') — по тексту (кода без сборки немного, разбор по регулярке надёжен)
const RE = /(?:import|export)\s+(?:[^;'"]*?\s+from\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;
const graph = {};
const problems = [];
for (const f of files) {
  const src = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/^\s*\/\/.*$/gm, '');
  graph[f] = [];
  for (const m of src.matchAll(RE)) {
    const spec = m[1] || m[2];
    if (!spec.startsWith('.')) continue;
    const to = path.posix.normalize(path.posix.join(path.posix.dirname(f), spec));
    if (!files.includes(to)) {
      problems.push(`${f}: импорт несуществующего файла ${spec}`);
      continue;
    }
    graph[f].push(to);
  }
}

// слои
for (const [f, deps] of Object.entries(graph)) {
  const [fp, fl] = layerOf(f);
  for (const d of deps) {
    const [dp, dl] = layerOf(d);
    if (dl > fl || (dl === fl && dp !== fp)) problems.push(`слои: ${f} → ${d}`);
  }
}

// циклы (поиск в глубину)
const state = {},
  stack = [],
  cycles = [];
(function visitAll() {
  const visit = (f) => {
    state[f] = 1;
    stack.push(f);
    for (const d of graph[f]) {
      if (state[d] === 1) cycles.push([...stack.slice(stack.indexOf(d)), d].join(' → '));
      else if (!state[d]) visit(d);
    }
    stack.pop();
    state[f] = 2;
  };
  for (const f of files) if (!state[f]) visit(f);
})();
for (const c of cycles) problems.push('цикл: ' + c);

const edges = Object.values(graph).reduce((n, d) => n + d.length, 0);
console.log(`модулей: ${files.length}, импортов: ${edges}`);
if (process.argv.includes('--tree')) {
  for (const f of files.sort()) console.log(`${f}\n${graph[f].map((d) => '    → ' + d).join('\n')}`);
}
if (problems.length) {
  console.log('\nНАРУШЕНИЯ:\n' + problems.join('\n'));
  process.exit(1);
}
console.log('круговых импортов нет, слои соблюдены');
