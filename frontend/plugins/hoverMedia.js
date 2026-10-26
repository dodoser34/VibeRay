// Эффекты наведения — только там, где наведение есть (мышь, тачпад). На сенсорном экране браузер
// эмулирует :hover касанием, и он «залипает»: карточка остаётся приподнятой, смайлик — подпрыгнувшим,
// пока палец не коснётся чего-то другого. Плагин PostCSS (встроен в Vite) переносит селекторы с
// :hover в @media (hover: hover); остальные селекторы того же правила (например, :focus-visible)
// остаются как были. Модули компонентов пишут :hover как обычно.
const HOVER_MEDIA = '(hover: hover)';

function insideHoverMedia(node) {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (parent.type === 'atrule' && parent.name === 'media' && parent.params.includes('hover:'))
      return true;
  }
  return false;
}

export function hoverMedia() {
  return {
    postcssPlugin: 'viberay-hover-media',
    Rule(rule, { AtRule }) {
      if (!rule.selector.includes(':hover') || insideHoverMedia(rule)) return;
      // Ключевые кадры (@keyframes) селекторов не содержат — проверка выше их уже отсекла.
      const hover = rule.selectors.filter((selector) => selector.includes(':hover'));
      const rest = rule.selectors.filter((selector) => !selector.includes(':hover'));
      const media = new AtRule({ name: 'media', params: HOVER_MEDIA });
      media.append(rule.clone({ selectors: hover }));
      rule.after(media);
      if (rest.length) rule.selectors = rest;
      else rule.remove();
    },
  };
}
hoverMedia.postcss = true;
