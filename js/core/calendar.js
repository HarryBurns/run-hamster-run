// Календарь по состоянию игры: месяц, сезон, время суток (cal), темнота вечером. Только чтение.
import { G } from './save.js';
import { MONTHS, SEASON_OF_MONTH, SEASONS, DAYS_PER_MONTH } from '../data/index.js';

// ---------- календарь ----------
export function cal(s = G.state) {
  const month = Math.floor(s.day / DAYS_PER_MONTH) % 12;
  const season = SEASON_OF_MONTH[month];
  const m = s.minutes;
  const phase = m < 11 * 60 ? 'Утро' : m < 17 * 60 ? 'День' : m < 21 * 60 ? 'Вечер' : 'Ночь';
  const phaseIcon = m < 11 * 60 ? '🌅' : m < 17 * 60 ? '☀️' : m < 21 * 60 ? '🌇' : '🌙';
  return {
    month,
    monthName: MONTHS[month],
    dom: (s.day % DAYS_PER_MONTH) + 1,
    year: Math.floor(s.day / (DAYS_PER_MONTH * 12)) + 1,
    season,
    seasonName: SEASONS[season].name,
    seasonIcon: SEASONS[season].icon,
    phase,
    phaseIcon,
    time: `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(Math.floor(m % 60)).padStart(2, '0')}`,
  };
}
export const season = () => cal().season;
/** 0 — день, 1 — глубокая ночь */
export function darkness() {
  const m = G.state.minutes;
  if (m < 18 * 60) return 0;
  return Math.min(1, (m - 18 * 60) / (3.5 * 60));
}
