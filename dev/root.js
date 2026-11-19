// Корень игры для проверок без браузера (баланс, сборка, слои, сохранения): папка над dev/, если там игра,
// иначе текущая папка. Так шаги работают и из копии dev/, запущенной от корня репозитория
// (cd <репозиторий> && node /где-то/dev/smoke.js …).
const fs = require('fs');
const path = require('path');

const isGame = (d) => fs.existsSync(path.join(d, 'js', 'modules.json')) && fs.existsSync(path.join(d, 'index.html'));
const ROOT = [path.join(__dirname, '..'), process.cwd()].find(isGame) || path.join(__dirname, '..');

module.exports = ROOT;
