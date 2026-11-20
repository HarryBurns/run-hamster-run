// Поиск текстов, которые обращаются к герою в одном роде (без разметки «{он|она}» — core/gender.js).
//
//   node dev/gender_lint.js            — список подозрительных мест; код возврата 1, если они есть
//   node dev/gender_lint.js --write    — записать всё найденное в список «проверено» (dev/gender_ok.json)
//   node dev/gender_lint.js --all      — показать и то, что уже отмечено как проверенное
//   node dev/gender_lint.js --pron     — показать местоимения «она, её, ей…» (их слишком много про жителей и вещи,
//                                        поэтому в обычную проверку они не входят — просмотреть глазами)
//
// Что ищет в строках кода (комментарии не смотрит; то, что уже в разметке {…|…}, — тоже):
//   — глаголы прошедшего времени женского рода: «нашла», «купила», «справилась»;
//   — краткие прилагательные и причастия: «готова», «рада», «должна», «сама», «одна», «уверена»…;
//   — обращения и слова о герое: «дорогая», «соседка», «хозяйка», «помощница», «именинница»…;
//   — слово «хомячок / хомячка» в любом падеже.
// Тексты о жителях (Плюша — она, Профессор — он) скрипт отличить не умеет — такие места человек проверяет один раз
// и заносит в dev/gender_ok.json («файл»: [«два слова до + слово + слово после»]). Изменился текст рядом — место
// покажется снова: это нарочно, новый текст надо перечитать.
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const OK_FILE = path.join(__dirname, 'gender_ok.json');

const CYR = 'а-яёА-ЯЁ';
// существительные и прочие слова на «-ла», которые не глаголы
const NOT_VERBS = new Set(
  `вилла виллла скала школа сила дела числа пола зала мала кола канала осла вола масла ангела мгла вёсла пчела стола
   стекла тепла села весла зеркала одеяла кресла крыла угла узла котла дупла гнезда метла смола игла пила юла зола
   стрела скула акула свёкла пиала гондола кока-кола тёпла светла мила кругла тела числа начала сначала мыла сала
   жерла седла сопла ремесла посла козла орла щегла дятла бокала вокзала журнала сигнала финала материала карнавала
   металла кристалла коралла зала бала вала шквала причала привала подвала обвала перевала квартала портала идеала
   овала пенала кинозала пьедестала ритуала мускула стула мула гула аула угла футбола волейбола баскетбола гола
   шоколада стола ствола чехла стебла набела добела подола дала-ла ла тра-ла-ла ла-ла-ла круассана`.split(/\s+/),
);
// краткие формы и слова женского рода, которыми говорят о герое
const WORDS = new Set(
  `готова рада должна сама одна уверена занята одета обута сыта здорова больна довольна знакома голодна согласна
   похожа способна достойна свободна права нужна приглашена удивлена счастлива весела грустна бодра сильна хороша
   красива умна смела ловка быстра щедра добра внимательна осторожна аккуратна молода мокра грязна чиста обязана
   намерена
   дорогая милая уставшая новенькая любимая маленькая первая настоящая лучшая знаменитая храбрая смелая умная
   добрая заботливая внимательная самая такая какая сонная голодная сытая чистая грязная больная здоровая
   довольная весёлая грустная готовая единственная новая отважная трудолюбивая талантливая родная юная
   соседка соседки соседке соседку соседкой гостья гостью гостьей гостьи хозяйка хозяйки хозяйке хозяйку хозяйкой
   хозяюшка помощница помощницу помощницей победительница победительницу чемпионка чемпионку путешественница
   красавица мастерица именинница именинницу имениннице именинницы подруга подругу подруге подруги подружка подружку
   подружке подружки девочка девочку девочке девочки новосёлка жительница покупательница покупательницу посетительница
   художница певица повариха учительница ученица садовница рыбачка модница спортсменка исследовательница
   искательница спасительница спасительницу героиня героиню волшебница путница странница незнакомка
   малышка малышку королева королеву принцесса принцессу шахтёрка слаломистка островитянка пианистка бариста
   главная любопытная пятнистая пушистая нарядная красивая меткая сильная быстрая ловкая бодрая храбрая`.split(/\s+/),
);
// слова на «-ница», которые не про человека
const NOT_NITSA = new Set(
  `больница больницу больнице больницы больницей страница страницу странице страницы граница границу границе границы
   пшеница пшеницу пшеницы теплица теплицу теплице теплицы синица синицу синицы гостиница гостиницу гостинице гостиницы
   лестница лестницу лестнице лестницы мельница мельницу мельнице мельницы единица единицу единицы пятница пятницу
   пятницы пятнице ресница ресницы разница разницу разницы конница сахарница сахарницу перечница солонка ножницы
   вафельница вафельницу мыльница песочница песочницу песочнице песочницы кормушка звонница колесница зарница
   гусеница гусеницу гусеницы гусенице черепица черепицу черепицы черепице пуговица пуговицу пуговицы таблица
   таблицу таблицы таблице столица столицу столицы столице улица улицу улицы улице птица птицу птицы птице
   темница водица землица салфетница конфетница конфетницу чайница супница супницу хлебница хлебницу
   яичница яичницу яичницы масленица масленицу масленицы масленице`.split(/\s+/),
);

function listFiles() {
  const out = [];
  const walk = (dir) => {
    for (const f of fs.readdirSync(dir).sort()) {
      const p = path.join(dir, f);
      if (fs.statSync(p).isDirectory()) walk(p);
      else if (f.endsWith('.js')) out.push(p);
    }
  };
  walk(path.join(ROOT, 'js'));
  out.push(path.join(ROOT, 'index.html'), path.join(ROOT, 'manifest.webmanifest'));
  return out.filter((p) => fs.existsSync(p));
}

/** Убрать комментарии JS (строки и шаблоны не трогаем). Длина и переводы строк сохраняются. */
function stripComments(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  const stack = []; // вложенность шаблонных строк: '`' — внутри текста шаблона, '{' — внутри ${…}
  let prev = ''; // последний значимый символ кода — чтобы отличить деление от /регулярки/
  const blank = (s) => s.replace(/[^\n]/g, ' ');
  while (i < n) {
    const c = src[i];
    const top = stack[stack.length - 1];
    if (top === '`') {
      if (c === '\\') {
        out += src.substr(i, 2);
        i += 2;
      } else if (c === '`') {
        stack.pop();
        out += c;
        i++;
        prev = '`';
      } else if (c === '$' && src[i + 1] === '{') {
        stack.push('{');
        out += '${';
        i += 2;
        prev = '{';
      } else {
        out += c;
        i++;
      }
      continue;
    }
    if (c === '/' && src[i + 1] === '/') {
      let j = src.indexOf('\n', i);
      if (j < 0) j = n;
      out += blank(src.slice(i, j));
      i = j;
    } else if (c === '/' && src[i + 1] === '*') {
      let j = src.indexOf('*/', i + 2);
      j = j < 0 ? n : j + 2;
      out += blank(src.slice(i, j));
      i = j;
    } else if (c === "'" || c === '"') {
      let j = i + 1;
      while (j < n && src[j] !== c && src[j] !== '\n') j += src[j] === '\\' ? 2 : 1;
      out += src.slice(i, j + 1);
      i = j + 1;
      prev = c;
    } else if (c === '`') {
      stack.push('`');
      out += c;
      i++;
    } else if (c === '/' && (prev === '' || '(,=:[!&|?{};+-*%<>~^'.includes(prev) || /\breturn$|\btypeof$/.test(out.slice(-8).trimEnd()))) {
      // регулярное выражение
      let j = i + 1;
      let cls = false;
      while (j < n && src[j] !== '\n' && (cls || src[j] !== '/')) {
        if (src[j] === '\\') j++;
        else if (src[j] === '[') cls = true;
        else if (src[j] === ']') cls = false;
        j++;
      }
      out += blank(src.slice(i, j + 1));
      i = j + 1;
      prev = '/';
    } else {
      if (c === '{' && stack.length) stack.push('{{');
      else if (c === '}' && stack.length) {
        stack.pop();
      }
      out += c;
      i++;
      if (!/\s/.test(c)) prev = c;
    }
  }
  return out;
}

const WORD_RE = new RegExp(`[${CYR}]+(?:-[${CYR}]+)*`, 'g');

// --pron: вместо обычной проверки показать местоимения «она, её, ей…» — просмотреть глазами (в список не заносятся)
const PRON = process.argv.includes('--pron');
const PRONOUNS = new Set('она её ей неё ней нею ею'.split(' '));
function suspicious(word) {
  const w = word.toLowerCase();
  if (PRON) return PRONOUNS.has(w);
  if (/^хомяч/.test(w)) return !/^хомяк/.test(w);
  if (WORDS.has(w)) return true;
  if (/(ла|лась)$/.test(w) && w.length > 3 && !NOT_VERBS.has(w)) return true;
  if (/ниц(а|у|е|ы|ей)$/.test(w) && !NOT_NITSA.has(w)) return true;
  return false;
}

function scan(file) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  let src = fs.readFileSync(file, 'utf8');
  if (file.endsWith('.js')) src = stripComments(src);
  else src = src.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '));
  // то, что уже размечено, не смотрим (и слова, приклеенные к разметке: «наш{ёл|ла}», «{|по}смотрела» — тоже)
  src = src.replace(new RegExp(`[${CYR}-]*\\{[^{}|\\n]*\\|[^{}\\n]*\\}[${CYR}-]*`, 'g'), (m) => '_'.repeat(m.length));
  const found = [];
  const lines = src.split('\n');
  lines.forEach((line, li) => {
    const words = [];
    let m;
    WORD_RE.lastIndex = 0;
    while ((m = WORD_RE.exec(line))) words.push(m[0]);
    words.forEach((w, wi) => {
      // «ты смелая», «ты такая красивая»: прилагательное женского рода сразу после «ты» (или через слово)
      const afterYou =
        /(ая|яя)$/.test(w) && w.length > 4 && [words[wi - 1], words[wi - 2]].some((x) => x && /^ты$/i.test(x));
      if (!suspicious(w) && !afterYou) return;
      const key = [words[wi - 2], words[wi - 1], w, words[wi + 1]].filter(Boolean).join(' ');
      found.push({ rel, line: li + 1, word: w, key, text: line.trim().slice(0, 150) });
    });
  });
  return found;
}

function main() {
  const args = process.argv.slice(2);
  const ok = fs.existsSync(OK_FILE) ? JSON.parse(fs.readFileSync(OK_FILE, 'utf8')) : {};
  const all = listFiles().flatMap(scan);
  if (args.includes('--write')) {
    const next = {};
    for (const f of all) (next[f.rel] = next[f.rel] || new Set()).add(f.key);
    const obj = {};
    for (const k of Object.keys(next).sort()) obj[k] = [...next[k]].sort();
    fs.writeFileSync(OK_FILE, JSON.stringify(obj, null, 1) + '\n');
    console.log(`Записано в dev/gender_ok.json: ${all.length} мест в ${Object.keys(obj).length} файлах.`);
    return;
  }
  const showAll = args.includes('--all');
  const only = args.filter((a) => !a.startsWith('--'));
  const left = all.filter((f) => showAll || !(ok[f.rel] || []).includes(f.key)).filter((f) => !only.length || only.some((o) => f.rel.includes(o)));
  for (const f of left) console.log(`${f.rel}:${f.line}: «${f.word}» — ${f.text}`);
  const stale = Object.keys(ok).reduce((s, rel) => s + ok[rel].filter((k) => !all.some((f) => f.rel === rel && f.key === k)).length, 0);
  console.log(
    left.length
      ? `\nРод героя: ${left.length} подозрительных мест без разметки {он|она}. Поставь разметку или, если текст не про героя, занеси в dev/gender_ok.json (node dev/gender_lint.js --write — занести всё разом).`
      : `Род героя: всё размечено (проверенных мест — ${all.length}${stale ? `, устаревших записей в списке — ${stale}` : ''}).`,
  );
  if (left.length && !showAll) process.exit(1);
}
main();
