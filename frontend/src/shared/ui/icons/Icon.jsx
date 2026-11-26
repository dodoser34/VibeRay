import { GLYPHS } from './glyphs';

// Иконка по имени из реестра (glyphs.jsx): <Icon name="close" size={14} />.
// size — пиксели базового интерфейса (переводятся в rem, на 2K/4K иконка растёт вместе
// с интерфейсом) или любая CSS-длина; color — цвет обводки, токеном: 'var(--color-accent)';
// strokeWidth — толщина в единицах сетки иконки; title — подпись для экранных чтецов, без неё
// иконка декоративная. Остальные пропсы уходят на <svg>; stroke и размер из CSS модуля важнее
// атрибутов.
export function Icon({ name, size, color = 'currentColor', strokeWidth, title, ...rest }) {
  const glyph = GLYPHS[name];
  if (!glyph) {
    if (import.meta.env.DEV) console.warn(`[Icon] нет иконки «${name}»`);
    return null;
  }
  const length = typeof size === 'number' ? `${size / 16}rem` : size;
  return (
    <svg
      viewBox={glyph.viewBox}
      width={length}
      height={length}
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth ?? glyph.strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      {...rest}
    >
      {glyph.body}
    </svg>
  );
}
