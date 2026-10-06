import { CATEGORY_BY_CODE } from '@/shared/config/problemCategories';
import { PROBLEM_STATUSES, REJECTED_STATUS } from '@/shared/config/problemStatuses';
import { format } from '@/shared/lib/format';
import { formatNumber, formatSigned } from '@/shared/lib/formatNumber';
import { plural } from '@/shared/lib/plural';
import { BarList } from '@/shared/ui/charts/BarList';
import texts from '@/texts/ru/moderation.json';
import styles from './CityOverview.module.css';

// Открытая проблема без движения дольше этого — повод разобраться с районом.
const OLD_DAYS = 14;
const COLUMNS = ['name', 'open', 'waiting', 'newWeek', 'oldest', 'mood'];

// Город глазами модератора: где копятся открытые проблемы, какие категории и статусы. Строка района
// открывает очередь этого района.
export function CityOverview({ summary, onOpenDistrict }) {
  if (!summary) return <p className={styles.loading}>{texts.city.loading}</p>;
  const days = (count) =>
    count === null
      ? texts.city.none
      : format(texts.city.days, {
          count: formatNumber(count),
          forms: plural(count, texts.city.dayForms),
        });

  return (
    <div className={styles.overview} data-ui="moderation-city">
      <section className={styles.card}>
        <h2 className={styles.title}>{texts.city.districtsTitle}</h2>
        <p className={styles.hint}>{texts.city.districtsHint}</p>
        <div className={styles.tableWrap} data-ui="moderation-table">
          <table className={styles.table}>
            <caption className="visually-hidden">{texts.city.tableCaption}</caption>
            <thead>
              <tr>
                {COLUMNS.map((key) => (
                  <th key={key} scope="col">
                    {texts.city.columns[key]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {summary.districts.map((row) => (
                <tr key={row.slug} data-empty={row.open === 0 || undefined}>
                  <th scope="row">
                    <button
                      type="button"
                      className={styles.district}
                      onClick={() => onOpenDistrict(row.slug)}
                    >
                      {row.name}
                    </button>
                  </th>
                  <td className={styles.number}>{formatNumber(row.open)}</td>
                  <td className={styles.number}>{formatNumber(row.waiting)}</td>
                  <td className={styles.number}>{formatNumber(row.new_week)}</td>
                  <td
                    className={styles.number}
                    data-old={row.oldest_open_days >= OLD_DAYS || undefined}
                  >
                    {days(row.oldest_open_days)}
                  </td>
                  <td className={styles.number}>
                    {row.mood_score === null ? texts.city.none : formatSigned(row.mood_score)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className={styles.side} data-ui="moderation-city-side">
        <section className={styles.card}>
          <h2 className={styles.title}>{texts.city.categoriesTitle}</h2>
          <BarList
            items={summary.categories.map(({ code, open }) => ({
              key: code,
              label: CATEGORY_BY_CODE[code].label,
              value: open,
              note: formatNumber(open),
            }))}
          />
        </section>
        <section className={styles.card}>
          <h2 className={styles.title}>{texts.city.statusesTitle}</h2>
          <BarList
            items={[...PROBLEM_STATUSES, REJECTED_STATUS].map(({ code, label }) => ({
              key: code,
              label,
              value: summary.counts[code],
              note: formatNumber(summary.counts[code]),
            }))}
          />
        </section>
      </div>
    </div>
  );
}
