// Во сколько раз интерфейс крупнее базовых 16 px: 2K и 4K увеличивают корневой шрифт
// (adaptations/desktop/*), и всё в rem растёт вместе с ним. Код, который рисует в пикселях
// (SVG-графики, canvas), умножает размеры на этот множитель, чтобы сохранить пропорции.
export function rootScale() {
  return parseFloat(getComputedStyle(document.documentElement).fontSize) / 16 || 1;
}
