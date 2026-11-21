// Проверка порядка квестов без браузера: одна функция goalRank (js/data/goals.js) решает, в каком порядке квесты
// стоят в журнале и какой становится активным, когда прежний закончен. Здесь — таблица случаев.
// Запуск:  node dev/test_goals.js      (доли секунды; код возврата 1 — есть ошибки)
// Заодно — сторож по коду: активный квест меняет только действие setGoal, а зовёт его только features/goals.js.
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = require('./root.js');
const JS = path.join(ROOT, 'js');

let failed = 0,
  total = 0;
function check(name, got, want) {
  total++;
  const a = JSON.stringify(got),
    b = JSON.stringify(want);
  if (a === b) console.log('  ✓ ' + name);
  else {
    failed++;
    console.log(`  ✗ ${name}\n      получилось: ${a}\n      ожидалось:  ${b}`);
  }
}

// квесты для таблицы: задание жителя (взято в день day / ещё не взято), праздник, письмо
const quest = (id, day) => ({ id: 'quest:' + id, group: 'story', started: day !== undefined, since: day || 0 });
const holiday = (started = false) => ({ id: 'holiday', group: 'holiday', started });
const mail = (started = false) => ({ id: 'mail', group: 'routine', started });

(async () => {
  const { sortGoals, nextGoal, goalRank } = await import(pathToFileURL(path.join(JS, 'data', 'goals.js')).href);
  const order = (list) => sortGoals(list).map((g) => g.id);

  console.log('порядок квестов');
  check('пусто — пусто', order([]), []);
  check(
    'письмо — в самом конце, праздник — перед ним, задания жителей — раньше',
    order([mail(), holiday(), quest('a')]),
    ['quest:a', 'holiday', 'mail'],
  );
  check(
    'начатые — в начале: взятое задание раньше не взятого',
    order([quest('new'), quest('taken', 5)]),
    ['quest:taken', 'quest:new'],
  );
  check(
    'начатое письмо (собрано 2 из 5) — раньше задания, которое ещё не взято, и не начатого праздника',
    order([quest('new'), holiday(), mail(true)]),
    ['mail', 'quest:new', 'holiday'],
  );
  check(
    'среди начатых: задание жителя → праздник → письмо',
    order([mail(true), holiday(true), quest('taken', 3)]),
    ['quest:taken', 'holiday', 'mail'],
  );
  check(
    'взятые задания — по дню: раньше взято — раньше в списке',
    order([quest('late', 9), quest('early', 2), quest('mid', 5)]),
    ['quest:early', 'quest:mid', 'quest:late'],
  );
  check(
    'в один день и не взятые — как стоят в описаниях (порядок устойчивый)',
    order([quest('b'), quest('a'), quest('x', 4), quest('y', 4)]),
    ['quest:x', 'quest:y', 'quest:b', 'quest:a'],
  );
  check(
    'после открытия леса: пять жителей с «!», праздник и письмо',
    order([mail(), quest('q1'), quest('q2'), holiday(), quest('q3'), quest('q4'), quest('q5'), quest('herb', 3)]),
    ['quest:herb', 'quest:q1', 'quest:q2', 'quest:q3', 'quest:q4', 'quest:q5', 'holiday', 'mail'],
  );
  check('место в порядке: начатое всегда меньше не начатого', goalRank(mail(true)) < goalRank(quest('a')), true);
  check('неизвестный вид квеста не ломает порядок', order([{ id: 'x', group: 'other' }, mail()]).length, 2);

  console.log('какой квест активен дальше');
  check('квестов нет — активного нет', nextGoal(null, []), null);
  check('активного не было — первый по порядку', nextGoal(null, [mail(), quest('a')]), 'quest:a');
  check(
    'активный ещё есть — остаётся он, даже если появилось что-то интереснее',
    nextGoal('mail', [mail(), quest('a'), quest('b', 1), holiday(true)]),
    'mail',
  );
  check(
    'активный закончен — следующий по порядку (начатое задание, а не письмо)',
    nextGoal('quest:done', [mail(), quest('new'), quest('taken', 2)]),
    'quest:taken',
  );
  check('активный закончен, осталось только письмо — письмо', nextGoal('quest:done', [mail()]), 'mail');
  check('праздник кончился вместе с днём — дальше задание', nextGoal('holiday', [mail(), quest('a')]), 'quest:a');
  check('последний квест закончен — активного нет', nextGoal('mail', []), null);

  console.log('сторож по коду');
  const files = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.js')) files.push(p);
    }
  })(JS);
  const rel = (f) => path.relative(ROOT, f).split(path.sep).join('/');
  const read = (f) => fs.readFileSync(f, 'utf8');
  check(
    'действие setGoal зовёт только features/goals.js',
    files.filter((f) => /\bsetGoal\(/.test(read(f)) && !/core\/actions\.js$/.test(rel(f))).map(rel),
    ['js/features/goals.js'],
  );
  check(
    'поле goal сохранения пишут только действие и починка',
    files.filter((f) => /\b(s|state|S\(\))\.goal\s*=[^=]/.test(read(f))).map(rel).sort(),
    ['js/core/actions.js', 'js/core/repair.js'],
  );
  check(
    'chooseGoal (выбор игрока) зовут только кнопки: журнал («⭐ Веди меня») и «⭐ Покажи дорогу!» в goals.js',
    files.filter((f) => /\bchooseGoal\(/.test(read(f))).map(rel).sort(),
    ['js/features/goals.js', 'js/features/journal.js'],
  );
  check(
    'старых правил старшинства звёздочки в коде нет',
    files
      .filter((f) => /trackQuest|trackHoliday|setTargetHook|setExtraTarget|starScene|compassGoal|thingTarget/.test(read(f)))
      .map(rel),
    [],
  );

  console.log(failed ? `\nОШИБОК: ${failed} из ${total}` : `\nВСЁ ХОРОШО (${total} проверок порядка квестов)`);
  process.exit(failed ? 1 : 0);
})();
