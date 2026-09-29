// Подпись кода читается из текстов при каждом обращении, а не копируется при загрузке: язык можно
// сменить на лету, и тексты меняются на месте (shared/lib/language.js).
export function withLabels(entries, labels) {
  entries.forEach((entry) =>
    Object.defineProperty(entry, 'label', { enumerable: true, get: () => labels[entry.code] }),
  );
  return entries;
}
