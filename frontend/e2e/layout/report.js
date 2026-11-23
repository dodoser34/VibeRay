import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const OUTPUT = new URL('../output/', import.meta.url);

// Сводка после прогона — e2e/output/layout-report.md: одно нарушение — одна строка со списком мест,
// где оно встретилось (окно / язык / состояние). Ошибки — первыми, самые частые — выше.
export default function report() {
  const folder = new URL('issues/', OUTPUT);
  if (!existsSync(folder)) return;
  const issues = readdirSync(folder)
    .filter((file) => file.endsWith('.json'))
    .flatMap((file) => JSON.parse(readFileSync(new URL(file, folder), 'utf8')));

  const groups = new Map();
  for (const issue of issues) {
    const key = `${issue.severity}|${issue.type}|${issue.target}|${issue.text}`;
    if (!groups.has(key)) groups.set(key, { ...issue, places: [] });
    groups.get(key).places.push(`${issue.viewport}/${issue.language}/${issue.state}`);
  }
  const rows = [...groups.values()].sort(
    (a, b) =>
      (a.severity === 'error' ? 0 : 1) - (b.severity === 'error' ? 0 : 1) ||
      b.places.length - a.places.length,
  );

  const escape = (value) => String(value).replaceAll('|', '\\|');
  const lines = [
    '# Аудит вёрстки',
    '',
    `Ошибок: ${rows.filter((row) => row.severity === 'error').length}, ` +
      `предупреждений: ${rows.filter((row) => row.severity === 'warning').length} ` +
      `(уникальных; всего записей — ${issues.length}).`,
    '',
    '| Тип | Элемент | Текст | Мест | Где (первые) | Деталь |',
    '|---|---|---|---|---|---|',
    ...rows.map(
      (row) =>
        `| ${row.severity === 'error' ? '❌' : '⚠️'} ${row.type} | ${escape(row.target)} | ` +
        `${escape(row.text)} | ${row.places.length} | ${row.places.slice(0, 4).join(', ')} | ` +
        `${escape(row.detail)} |`,
    ),
    '',
  ];
  const target = new URL('layout-report.md', OUTPUT);
  writeFileSync(target, lines.join('\n'));
  console.log(`\nСводка аудита вёрстки: ${fileURLToPath(target)}`);
}
