import { formatSigned } from '@/shared/lib/formatNumber';

// Что дашборд выводит на 3D-карту для метрики: цветовую оценку района (−2…+2 на шкале настроения,
// null — мало данных) и значение для подписи. Сообщения используют ту же шкалу, перевёрнутую и
// относительно других районов: меньше всех сообщений в городе — «лучший» цвет, больше всех —
// «худший».
export function mapOverlay(stats, metric) {
  if (!stats) return null;
  const rows = stats.districts;
  if (metric === 'mood') {
    return {
      scores: Object.fromEntries(
        rows.map((row) => [row.district, row.mood.insufficient_data ? null : row.mood.score]),
      ),
      values: Object.fromEntries(
        rows.map((row) => [
          row.district,
          row.mood.insufficient_data ? null : formatSigned(row.mood.score),
        ]),
      ),
    };
  }
  const { min, max } = reportedRange(stats);
  const share = (count) => (max > min ? (count - min) / (max - min) : 0.5);
  return {
    scores: Object.fromEntries(
      rows.map((row) => [row.district, 2 - 4 * share(row.problems.reported)]),
    ),
    values: Object.fromEntries(rows.map((row) => [row.district, String(row.problems.reported)])),
  };
}

export function reportedRange(stats) {
  const counts = stats.districts.map((row) => row.problems.reported);
  return { min: Math.min(...counts), max: Math.max(...counts) };
}

// Агрегаты настроения в том виде, который ждёт карта (цвет и высота плиты — по настроению).
export function statsMoods(stats) {
  if (!stats) return null;
  return {
    period: stats.period,
    updated_at: stats.updated_at,
    districts: Object.fromEntries(stats.districts.map((row) => [row.district, row.mood])),
  };
}
