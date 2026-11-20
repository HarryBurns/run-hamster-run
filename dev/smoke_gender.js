// Шаги автотеста «пол героя»: экран новой игры (имя и выбор «Я — хомячок / Я — хомяшка»), род в текстах
// (core/gender.js — разметка «{он|она}»), старое сохранение — хомяшка, смена имени и пола в меню ⚙️.
// Подключается из dev/smoke.js. Только эти шаги:  node dev/smoke.js <url> "step:пол героя"
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const lib = require('./lib.js');

module.exports = async function gender(ctx) {
  const L = lib(ctx);
  const { page, step, ev, wait, closeAll, until, untilPanel, untilScene, act, sel, expect, state, panelText, blank } = L;
  /** Сырая разметка «{…|…}» на странице (её быть не должно нигде). */
  const raw = () => ev(() => (document.body.textContent.match(/\{[^{}|<>]*\|[^{}|<>]*\}/g) || []).slice(0, 5));
  const noRaw = async (where) => {
    const r = await raw();
    expect(!r.length, `сырая разметка на экране (${where})`, r);
  };
  const introText = async () => L.norm(await ev(() => document.querySelector('#intro .i-text').textContent));
  /** Новая игра как у игрока: имя, пол, вступление — возвращает подписи первых двух кадров и текст приветствия. */
  const begin = async (name, g) => {
    await blank();
    await page.fill('#title input', name);
    await act('gender-' + g);
    await act('play');
    await until(() => !!window.__dev.F.introDebug(), undefined, 'сценка');
    const cap1 = await introText();
    await page.click('#intro .i-next');
    await until(() => (window.__dev.F.introDebug() || { i: -1 }).i === 1, undefined, { timeout: 3000 }).catch(() => {});
    const cap2 = await introText();
    await act('skip');
    await untilPanel('Добро пожаловать');
    const hello = await panelText();
    await noRaw('приветствие');
    await act('go');
    await untilScene('villa');
    return { cap1, cap2, hello };
  };
  /** Тексты из разных мест игры одним разом: письмо, справка, подсказка, альбом, канва. */
  const sample = async () => {
    await closeAll();
    await ev(() => window.__dev.actions.setFlag('intro', 0)); // соседи не стучатся посреди проверки
    await ev(() => void window.__dev.F.openMailbox());
    await untilPanel();
    const letter = await panelText();
    await noRaw('письмо');
    await closeAll();
    await ev(() => void window.__dev.F.showHelp());
    await untilPanel();
    const help = await panelText();
    await noRaw('справка');
    await closeAll();
    await ev(() => void window.__dev.F.openAlbum());
    await untilPanel();
    await noRaw('альбом');
    await closeAll();
    const r = await ev(async () => {
      const T = await import('./js/ui/toast.js');
      const D = await import('./js/data/index.js');
      const GX = await import('./js/core/gender.js');
      T.toast('Проверка: ты наш{ёл|ла} ракушку, {хомячок|хомяшка}!');
      const cx = document.createElement('canvas').getContext('2d');
      const el = document.createElement('div');
      document.body.appendChild(el);
      el.textContent = 'Готов{|а}?';
      el.title = '{Он|Она}';
      await new Promise((ok) => setTimeout(ok, 30)); // «страховочная сетка» раскрывает текст до показа
      const net = [el.textContent, el.title];
      el.remove();
      return {
        toast: [...document.querySelectorAll('#toasts .toast')].map((t) => t.textContent).join(' | '),
        canvas: cx.measureText('{он|она}').width === cx.measureText(GX.gg('он', 'она')).width,
        net,
        sticker: GX.gx(D.EXTRA_STICKERS.find((s) => s.id === 'x_biz_all').title),
        gender: GX.gender(),
      };
    });
    await noRaw('подсказка');
    return { letter, help, ...r };
  };

  await step('пол героя: правила имени — только буквы, пробел и дефис, слова с заглавной, не больше трёх', async () => {
    await blank();
    const rules = await ev(async () => {
      const D = await import('./js/data/index.js');
      return {
        type: [
          'анна-мария',
          '  петя',
          'а1б2 в!!',
          'аня   маша',
          'a b c d e',
          'жан--поль',
          'мак-  кой',
          'ёжик',
          'x'.repeat(40),
          'аня ',
          'Аня-',
        ].map(D.typeName),
        clean: ['аня ', 'анна-мария-', '   ', '123', 'mary jane watson parker', 'мак - кой'].map(D.cleanName),
        why: ['аня', 'аня1', 'а б в г', 'я'.repeat(30), 'а б в '].map(D.nameProblem),
        max: D.NAME_MAX,
      };
    });
    expect(
      JSON.stringify(rules.type) ===
        JSON.stringify([
          'Анна-Мария',
          'Петя',
          'Аб В',
          'Аня Маша',
          'A B C',
          'Жан-Поль',
          'Мак- Кой',
          'Ёжик',
          'X' + 'x'.repeat(rules.max - 1),
          'Аня ',
          'Аня-',
        ]),
      'имя, пока его набирают',
      rules.type,
    );
    expect(JSON.stringify(rules.clean) === JSON.stringify(['Аня', 'Анна-Мария', '', '', 'Mary Jane Watson', 'Мак Кой']), 'готовое имя', rules.clean);
    expect(JSON.stringify(rules.why) === JSON.stringify([null, 'chars', 'words', 'long', 'words']), 'что не так с именем', rules.why);

    // поле на экране: печатаем как ребёнок — лишнее не вводится, подсказка мягкая
    const inp = '#title input';
    const val = () => page.inputValue(inp);
    expect((await ev(() => document.querySelector('#title .t-menu').textContent)).includes('Как тебя зовут?'), 'вопрос про имя');
    await page.click(inp);
    await page.keyboard.type('анна-мария  7ivanova!');
    expect((await val()) === 'Анна-Мария Ivanova', 'имя набрано по правилам', await val());
    const hint = await ev(() => {
      const h = document.querySelector('#title .name-hint');
      return h.hidden ? '' : h.textContent;
    });
    expect(/только буквы/.test(hint) && !/ошибк|нельзя|неправильн/i.test(hint), 'мягкая подсказка про буквы', hint);
    // правка в середине: курсор остаётся на месте (стираем «Мария», пишем «лиза»)
    await ev(() => document.querySelector('#title input').setSelectionRange(10, 10));
    for (let i = 0; i < 5; i++) await page.keyboard.press('Backspace');
    await page.keyboard.type('лиза');
    const mid = await ev(() => {
      const i = document.querySelector('#title input');
      return [i.value, i.selectionStart];
    });
    expect(mid[0] === 'Анна-Лиза Ivanova' && mid[1] === 9, 'правка в середине имени: курсор на месте', mid);
    // вставка целиком (как из буфера): чинится сразу
    await page.fill(inp, 'пЁТР  первый   великий царь');
    expect((await val()) === 'ПЁТР Первый Великий', 'вставка: три слова, пробелы схлопнуты', await val());
    await page.fill(inp, '');
    // без выбора «хомячок / хомяшка» игра не начинается — мягкая просьба выбрать
    await page.click(sel('play'));
    await wait(200);
    const ask = await ev(() => ({
      hint: document.querySelector('#title .name-hint').textContent,
      title: !!document.getElementById('title'),
      intro: !!document.getElementById('intro'),
      who: [...document.querySelectorAll('#title .t-who-btn')].map((b) => b.textContent),
    }));
    expect(ask.title && !ask.intro && /Выбери, кто ты/.test(ask.hint), 'без выбора пола игра не начинается', ask);
    expect(ask.who.join('|') === 'Я — хомячок|Я — хомяшка', 'две кнопки выбора', ask.who);
    // кнопки и поле целиком на экране
    const fit = await ev(() => {
      const m = document.querySelector('#title .t-menu').getBoundingClientRect();
      return m.left >= 0 && m.top >= 0 && m.right <= innerWidth + 1 && m.bottom <= innerHeight + 1;
    });
    expect(fit, 'форма новой игры не помещается на экран');
  });

  await step('пол героя: новая игра за хомячка — мужской род в сценке, приветствии, письме и подсказках', async () => {
    const t = await begin('тимоша', 'm');
    expect(/Жил-был хомячок Тимоша/.test(t.cap1) && /Он копил монетки и мечтал/.test(t.cap1), 'первый кадр сценки', t.cap1);
    expect(/он решился: собрал чемодан и сел на поезд/.test(t.cap2), 'второй кадр сценки', t.cap2);
    expect(/Привет, Тимоша/.test(t.hello) && /ты так долго копил, ты купил /.test(t.hello), 'приветствие', t.hello.slice(0, 200));
    const s = await state();
    expect(s.gender === 'm' && s.name === 'Тимоша', 'пол и имя в сохранении', [s.gender, s.name]);
    expect(!s.look.beauty.lashes && !s.look.beauty.bow, 'у хомячка нет ресничек и бантика', s.look.beauty);
    expect(
      s.look.outfit.body === 'tee_heart' && s.look.outfit.legs === 'pants_jeans' && s.look.outfit.feet === 'sn_white',
      'стартовая одежда: майка, джинсы, кроссовки',
      s.look.outfit,
    );
    const x = await sample();
    expect(/Дорогой Тимоша/.test(x.letter) && /рад новому соседу/.test(x.letter), 'письмо', x.letter.slice(0, 160));
    expect(/хомячок сам туда дойдёт/.test(x.help) && !/хомяшка/.test(x.help), 'справка', x.help.slice(0, 300));
    expect(/ты нашёл ракушку, хомячок!/.test(x.toast), 'подсказка', x.toast);
    expect(x.canvas && x.net.join() === 'Готов?,Он' && x.sticker === 'Хозяин города', 'канва, страница, наклейка', x);
    // первый диалог: Плюша пришла с заданием — в журнале и в репликах нет сырой разметки
    await ev(() => window.__dev.actions.setFlag('intro', 1));
    await ev(async () => {
      const D = await import('./js/ui/dialog.js');
      D.dialog({ name: 'Плюша', text: 'Выбрал{|а}? Какой ты нарядн{ый|ая}!', look: window.__dev.G.state.look }); // ответа не ждём
    });
    await until(() => !!document.querySelector('.dialog .say'));
    const say = L.norm(await ev(() => document.querySelector('.dialog .say').textContent));
    expect(say === 'Выбрал? Какой ты нарядный!', 'реплика в диалоге', say);
    await closeAll();
  });

  await step('пол героя: новая игра за хомяшку — женский род; у неё реснички и бантик, одежда та же', async () => {
    const t = await begin('анна-мария', 'f');
    expect(/Жила-была хомяшка Анна-Мария/.test(t.cap1) && /Она копила монетки и мечтала/.test(t.cap1), 'первый кадр', t.cap1);
    expect(/она решилась: собрала чемодан и села на поезд/.test(t.cap2), 'второй кадр сценки', t.cap2);
    expect(/ты так долго копила, ты купила /.test(t.hello), 'приветствие', t.hello.slice(0, 200));
    const s = await state();
    expect(s.gender === 'f' && s.name === 'Анна-Мария', 'пол и имя в сохранении', [s.gender, s.name]);
    expect(s.look.beauty.lashes === true && !!s.look.beauty.bow, 'у хомяшки реснички и бантик', s.look.beauty);
    expect(s.look.outfit.legs === 'pants_jeans' && s.look.outfit.feet === 'sn_white', 'одежда та же', s.look.outfit);
    const x = await sample();
    expect(/Дорогая Анна-Мария/.test(x.letter) && /рад новой соседке/.test(x.letter), 'письмо', x.letter.slice(0, 160));
    expect(/хомяшка сама туда дойдёт/.test(x.help), 'справка', x.help.slice(0, 300));
    expect(/ты нашла ракушку, хомяшка!/.test(x.toast), 'подсказка', x.toast);
    expect(x.canvas && x.net.join() === 'Готова?,Она' && x.sticker === 'Хозяйка города', 'канва, страница, наклейка', x);
    // шорты и красные кеды, с которых игра начиналась раньше, теперь продаются в ТЦ
    const shop = await ev(async () => {
      const D = await import('./js/data/index.js');
      return ['shorts_jeans', 'sn_red'].map((id) => [D.CLOTHES_BY_ID[id].shop, D.CLOTHES_BY_ID[id].price > 0]);
    });
    expect(shop.every(([sh, pr]) => sh === 'mall' && pr), 'шорты и кеды продаются в ТЦ', shop);
  });

  await step('пол героя: старое сохранение открывается как хомяшка; имя и пол меняются в меню ⚙️', async () => {
    const old = fs.readFileSync(path.join(__dirname, 'saves', 'v4.json'), 'utf8');
    expect(!/"gender"/.test(old), 'в образце старого сохранения уже есть пол');
    await ev((raw) => {
      window.__dev.G.state = null;
      localStorage.clear();
      localStorage.setItem('rhr-save-v1', raw);
    }, old);
    await page.reload();
    await page.waitForSelector(sel('continue'));
    await act('continue');
    await until(() => !!window.__dev.sceneName && !document.getElementById('title'), undefined, 'игра');
    await wait(300);
    await closeAll();
    let s = await state();
    const was = JSON.parse(old);
    expect(s.gender === 'f' && s.name === was.name, 'старая игра — хомяшка, имя прежнее', [s.gender, s.name]);
    expect(JSON.stringify(s.look.beauty) === JSON.stringify({ ...s.look.beauty, ...was.look.beauty }), 'внешность не тронута', s.look.beauty);
    const games = await ev(() => JSON.parse(localStorage.getItem('rhr-games')).games.map((g) => g.gender));
    expect(games.join() === 'f', 'в списке игр — хомяшка', games);
    let x = await sample();
    expect(/Дорогая /.test(x.letter) && /ты нашла ракушку, хомяшка!/.test(x.toast), 'старая игра: женский род', [x.letter.slice(0, 80), x.toast]);

    // меню: сменить пол
    await ev(() => void window.__dev.F.openSettings());
    await untilPanel('Меню');
    const on = () => ev(() => [...document.querySelectorAll('.set-who .btn')].map((b) => b.getAttribute('aria-pressed')).join());
    expect((await on()) === 'false,true', 'в меню отмечена хомяшка', await on());
    await page.click('.overlay ' + sel('gender-m'));
    await until(() => window.__dev.G.state.gender === 'm');
    expect((await on()) === 'true,false', 'в меню отмечен хомячок', await on());
    // меню: сменить имя — правила те же, что на экране новой игры
    const inp = '.overlay .set-name input';
    expect((await page.inputValue(inp)) === was.name, 'в поле — прежнее имя', await page.inputValue(inp));
    await page.fill(inp, 'боря-2  смелый');
    expect((await page.inputValue(inp)) === 'Боря- Смелый' || (await page.inputValue(inp)) === 'Боря Смелый', 'имя в меню чинится на лету', await page.inputValue(inp));
    await page.fill(inp, 'боря смелый');
    await page.keyboard.press('Enter');
    await until(() => window.__dev.G.state.name === 'Боря Смелый');
    const top = await ev(() => document.querySelector('.overlay .set-me b').textContent);
    expect(top === 'Боря Смелый', 'имя в шапке меню', top);
    // пустое имя не ставится
    await page.fill(inp, '   ');
    await page.keyboard.press('Enter');
    await wait(100);
    expect((await state()).name === 'Боря Смелый' && (await page.inputValue(inp)) === 'Боря Смелый', 'пустое имя не ставится');
    await noRaw('меню');
    await closeAll();
    x = await sample();
    expect(/Дорогой Боря Смелый/.test(x.letter) && /ты нашёл ракушку, хомячок!/.test(x.toast), 'после смены — мужской род', [x.letter.slice(0, 80), x.toast]);
    // переживает перезагрузку
    await ev(async () => (await import('./js/core/loop.js')).persist());
    await page.reload();
    await page.waitForSelector(sel('continue'));
    const back = await ev(() => document.querySelector('#title .t-menu').textContent);
    expect(back.includes('Боря Смелый'), 'заставка: новое имя', back.slice(0, 80));
    await act('continue');
    await until(() => !!window.__dev.sceneName && !document.getElementById('title'), undefined, 'игра');
    s = await state();
    expect(s.gender === 'm' && s.name === 'Боря Смелый', 'пол и имя сохранились', [s.gender, s.name]);
    await closeAll();
  });

  await step('пол героя: в текстах игры не осталось женского рода без разметки (dev/gender_lint.js)', async () => {
    let out = '';
    try {
      out = execFileSync(process.execPath, [path.join(__dirname, 'gender_lint.js')], { encoding: 'utf8' });
    } catch (e) {
      out = String(e.stdout || e.message);
      expect(false, 'gender_lint нашёл тексты без разметки', out.split('\n').slice(0, 12));
    }
    expect(/всё размечено/.test(out), 'gender_lint', out.slice(-200));
    // и ни в одной таблице data/ разметка не сломана: все «{…|…}» раскрываются без остатка
    const bad = await ev(async () => {
      const D = await import('./js/data/index.js');
      const GX = await import('./js/core/gender.js');
      const out = [];
      const seen = new Set();
      const walk = (v, where) => {
        if (typeof v === 'string') {
          for (const g of ['m', 'f']) if (/[{}|]/.test(GX.gx(v, g).replace(/\{name\}|\{а\}|\{[a-zа-яё]+\}/gi, ''))) out.push(where + ': ' + v.slice(0, 80));
        } else if (v && typeof v === 'object' && !seen.has(v)) {
          seen.add(v);
          for (const k of Object.keys(v)) walk(v[k], where + '.' + k);
        }
      };
      for (const k of Object.keys(D)) walk(D[k], k);
      return out.slice(0, 8);
    });
    expect(!bad.length, 'сломанная разметка в таблицах', bad);
  });
};
