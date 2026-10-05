import { GLYPHS } from './glyphs';

// Иконка по имени из реестра (glyphs.jsx): <Icon name="close" size={14} />.
// Параметры перекрывают значения по умолчанию: size — число в пикселях базового интерфейса (переводится
// в rem, поэтому на 2K/4K иконка растёт вместе с интерфейсом) или любая CSS-длина; color — цвет
// обводки (по умолчанию currentColor — цвет текста кнопки; передавайте токен: 'var(--color-accent)');
// strokeWidth — толщина в единицах сетки иконки. Остальные пропсы (className, style, ref, data-*)
// уходят на <svg>, а правила CSS модуля, где задан stroke или размер, по-прежнему важнее атрибутов.
// title — подпись для экранных чтецов; без неё иконка декоративная (aria-hidden).
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
