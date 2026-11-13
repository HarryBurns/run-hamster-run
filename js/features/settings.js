// Меню: музыка и звуки, «Как играть», «Начать заново».
import { G, cal, wipe } from '../core/state.js';
import { el, esc } from '../core/util.js';
import { sfx, isMuted, setMuted, isMusicOn, setMusicOn, getMusicVolume, setMusicVolume } from '../core/audio.js';
import { openPanel, message, confirmBox } from '../ui/panel.js';

export function openSettings() {
  openPanel({
    title: 'Меню',
    icon: '⚙️',
    cls: 'narrow',
    render(body, tab, panel) {
      const c = cal();
      body.appendChild(
        el(
          'p',
          'center',
          `<b>${esc(G.state.name)}</b> · ${c.year}-й год на вилле<br><span class="muted">Игра сохраняется сама.</span>`,
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
      const help = el('button', 'btn yellow', '❓ Как играть');
      help.onclick = () => showHelp();
      const reset = el('button', 'btn ghost', '🗑️ Начать заново');
      reset.onclick = async () => {
        if (
          await confirmBox(
            'Начать заново?',
            '<p class="center">Вся игра сотрётся: наряды, мебель, друзья и наклейки. Точно?</p>',
            'Да, стереть',
            'Нет-нет!',
          )
        ) {
          wipe();
          location.reload();
        }
      };
      const col = el('div');
      col.style.cssText = 'display:flex;flex-direction:column;gap:12px;align-items:stretch';
      col.append(mus, vol, snd, help, reset);
      body.appendChild(col);
    },
  });
}
export function showHelp() {
  return message({
    title: 'Как играть',
    icon: '❓',
    cls: '',
    html: `<ul class="help">
      <li>👆 <b>Нажми</b> на любое место — хомячок пойдёт туда. На компьютере можно стрелками или WASD, а <b>E</b> — «потрогать» то, что рядом.</li>
      <li>✉️ Каждое утро в <b>почтовом ящике</b> у двери виллы лежит письмо с заданием. За него дают наклейку и иногда подарок.</li>
      <li>⭐ Звёздочка и стрелка показывают, куда идти по заданию. А на <b>🗺️ карте</b> можно нажать на любое место — и хомячок сама туда дойдёт.</li>
      <li>🏡 На вилле нажимай на всё подряд: шкаф, плиту, холодильник, ванну, сауну, джакузи, бассейн, телевизор… Лифт справа возит между этажами.</li>
      <li>🎹 Нажми на <b>пианино</b> — оно откроется во весь экран, и можно играть самой или учить песенки по зелёным клавишам.</li>
      <li>🔨 Кнопка <b>«Обустроить»</b> — перетаскивай мебель, доставай новую из кладовки.</li>
      <li>🛍️ В городе — магазины одежды и мебели, продукты, салон красоты, кафе и мини-игры: бассейн, школа, больница, ресторан, Дом моды.</li>
      <li>⛵ У конца пирса стоит <b>кораблик</b>: нажми на него, чтобы сесть. На нём можно плавать быстро и заплывать <b>за буйки</b> — к дальним островам. Нажми на берег рядом, чтобы сойти.</li>
      <li>🌊 В море можно заплывать далеко, а на глубине — <b>🤿 нырнуть</b>: под водой рыбы, кораллы, жемчужины и затонувший корабль.</li>
      <li>🛏️ Чтобы наступил следующий день, ложись спать в кровать. В месяце 3 дня, сезоны меняются.</li>
      <li>📱 Друзей можно звать в гости и угощать. Подружишься — узнаешь секретные рецепты!</li></ul>`,
    buttons: [{ text: 'Понятно!' }],
  });
}
