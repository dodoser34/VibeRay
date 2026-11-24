// Псевдоязык для проверки вёрстки (только dev и тестовая сборка VITE_LAYOUT_TEST, e2e/layout):
// адрес с ?pseudo=long удлиняет каждую строку текущего языка примерно на 40 % длинными словами — до 24
// букв, как самые длинные немецкие составные слова в интерфейсе. Так видно, где вёрстка не выдержит
// будущий перевод. Подстановки {name} не трогаются: удлинение дописывается в конец строки.
const FILLER = 'Überschreitungsgrenzwert Benachrichtigungen Einstellungsmöglichkeit ';
const SHARE = 0.4;
const MIN_EXTRA = 4;

function stretch(value) {
  if (!value.trim()) return value;
  const extra = Math.max(MIN_EXTRA, Math.round(value.length * SHARE));
  const words = FILLER.repeat(Math.ceil(extra / FILLER.length))
    .slice(0, extra)
    .trim();
  return `${value} ${words}`;
}

function stretchIn(target) {
  Object.keys(target).forEach((key) => {
    const value = target[key];
    if (typeof value === 'string') target[key] = stretch(value);
    else if (value !== null && typeof value === 'object') stretchIn(value);
  });
}

// Тексты меняются на месте — как при смене языка (language.js), ссылки на объекты те же.
export function stretchTexts(texts) {
  Object.values(texts).forEach(stretchIn);
}
