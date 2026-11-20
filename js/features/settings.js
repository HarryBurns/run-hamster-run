// Меню: музыка и звуки, «Как играть», «Авторы» (кто сочинил музыку и звуки), «Поставить на экран „Домой“»,
// «Выйти на заставку».
import { G, cal, villaWords } from '../core/state.js';
import { persist } from '../core/loop.js';
import { el, esc } from '../core/util.js';
import { sfx, isMuted, setMuted, isMusicOn, setMusicOn, getMusicVolume, setMusicVolume } from '../core/audio.js';
import { run } from '../core/registry.js';
import { gender } from '../core/gender.js';
import { setGender } from '../core/actions.js';
import { toast } from '../ui/toast.js';
import { MUSIC_CREDITS, SFX_CREDITS, SYNTH_NOTE } from '../data/credits.js';
import { openPanel, message } from '../ui/panel.js';
import { showHelp } from './help.js';
import { installButton } from './install.js';

export function openSettings() {
  openPanel({
    title: 'Меню',
    icon: '⚙️',
    cls: 'narrow set-panel',
    render(body, tab, panel) {
      const c = cal();
      body.appendChild(
        el(
          'p',
          'center',
          `<b>${esc(G.state.name)}</b> · ${c.year}-й год ${villaWords().at}<br><span class="muted">Игра сохраняется сама.</span>`,
        ),
      );
      const mus = el(
        'button',
        'btn ' + (isMusicOn() ? 'green' : 'ghost'),
        isMusicOn() ? '🎵 Музыка включена' : '🎵 Музыка выключена',
      );
      mus.onclick = () => {
        setMusicOn(!isMusicOn());
        sfx('tap');
        panel.refresh();
      };
      const vol = el(
        'label',
        'vol',
        '<span>🔈</span><input type="range" min="0" max="100" step="5" aria-label="Громкость музыки"><span>🔊</span>',
      );
      const rng = vol.querySelector('input');
      rng.value = Math.round(getMusicVolume() * 100);
      rng.disabled = !isMusicOn();
      rng.oninput = () => setMusicVolume(rng.value / 100);
      const snd = el(
        'button',
        'btn ' + (isMuted() ? 'ghost' : 'blue'),
        isMuted() ? '🔇 Звуки выключены' : '🔊 Звуки включены',
      );
      snd.onclick = () => {
        setMuted(!isMuted());
        sfx('ok');
        panel.refresh();
      };
      // свои дома (список и выбор основного; покупают — в агентстве, входят — через двери) и заведения
      const homes = el('button', 'btn green', '🔑 Мои дома');
      homes.onclick = () => {
        panel.close();
        run('realtor:mine');
      };
      const biz = el('button', 'btn green', '🏪 Мои заведения');
      biz.onclick = () => {
        panel.close();
        run('my-biz');
      };
      const own = el('div', 'set-own');
      own.append(homes, biz);
      // кто герой: от этого — «нашёл» или «нашла» во всех текстах игры (core/gender.js); выбирают при старте, сменить — тут
      const who = el('div', 'set-who');
      for (const [g, label] of [
        ['m', 'Я — хомячок'],
        ['f', 'Я — хомячка'],
      ]) {
        const on = gender() === g;
        const bt = el('button', 'btn ' + (on ? 'green' : 'ghost'), (on ? '✓ ' : '') + label);
        bt.dataset.act = 'gender-' + g;
        bt.setAttribute('aria-pressed', on ? 'true' : 'false');
        bt.onclick = () => {
          sfx('tap');
          if (!setGender(g)) return;
          persist();
          panel.refresh();
          toast('Хорошо! Теперь ты — {хомячок|хомячка} 🐹', 'good');
        };
        who.appendChild(bt);
      }
      const help = el('button', 'btn yellow', '❓ Как играть');
      help.onclick = () => showHelp();
      const authors = el('button', 'btn ghost', '🎼 Авторы музыки и звуков');
      authors.onclick = () => {
        sfx('tap');
        showCredits();
      };
      // Новую игру начинают на заставке («Новая игра» — рядом со старыми); стереть игру отсюда нельзя.
      const exit = el('button', 'btn ghost', '🚪 Выйти на заставку');
      exit.onclick = () => {
        persist();
        location.reload();
      };
      const col = el('div', 'set-col'); // лёжа на телефоне — в два столбца (css/style.css)
      col.append(own, mus, vol, snd, who, help, authors);
      // игра как приложение на экране «Домой» (features/install.js); уже приложение — пункта нет
      const app = installButton('📲 Поставить на экран «Домой»', 'btn ghost');
      if (app) col.appendChild(app);
      col.appendChild(exit);
      body.appendChild(col);
    },
  });
}
/** «Авторы»: вся музыка и все звуки игры — название, автор, лицензия, ссылка (текстом). */
export function showCredits() {
  const lic = (l) => `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.name)}</a>`;
  const short = (u) => u.replace(/^https?:\/\//, '');
  // ссылка текстом; если она уже есть в имени автора («… (incompetech.com)») — не повторять
  const link = (c) => (c.by.includes(short(c.url)) ? '' : ` · <span class="credit-url">${esc(short(c.url))}</span>`);
  const music = MUSIC_CREDITS.map(
    (c) =>
      `<li><b>«${esc(c.title)}»</b> — ${esc(c.by)}<br><span class="muted">${esc(c.where)} · ${lic(c.lic)}${link(c)}</span></li>`,
  ).join('');
  const sfxs = SFX_CREDITS.map(
    (c) =>
      `<li><b>${esc(c.title)}</b> — ${esc(c.by)}<br><span class="muted">${esc(c.what)} · ${lic(c.lic)}${link(c)}</span></li>`,
  ).join('');
  return message({
    title: 'Авторы',
    icon: '🎼',
    cls: 'credits',
    html: `<p class="center">Спасибо всем, кто делится музыкой и звуками бесплатно!</p>
      <h3>🎵 Музыка</h3><ul class="help credits-list">${music}</ul>
      <p class="muted">Музыка Kevin MacLeod (incompetech.com) — по лицензии Creative Commons: By Attribution 4.0
      (creativecommons.org/licenses/by/4.0). Записи пережаты потише и полегче, сама музыка не менялась.</p>
      <h3>🔔 Звуки</h3><ul class="help credits-list">${sfxs}</ul>
      <p class="muted">${esc(SYNTH_NOTE)}</p>
      <p class="muted">Игру придумали и нарисовали кодом — без картинок. Полный список — в файле CREDITS.md.</p>`,
    buttons: [{ text: 'Понятно!' }],
  });
}
