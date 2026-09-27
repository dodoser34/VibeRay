// Подставляет {placeholders} в текст из src/texts: format('Привет, {name}', { name: 'Аня' }).
export function format(template, values = {}) {
  return template.replace(/\{(\w+)\}/g, (match, key) =>
    key in values ? String(values[key]) : match,
  );
}
