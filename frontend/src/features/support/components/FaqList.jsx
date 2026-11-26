import { ChipGroup } from '@/shared/ui/controls/ChipGroup';
import texts from '@/texts/en/support.json';
import { FAQ, HELP_CATEGORIES } from '../lib/helpContent';
import styles from './FaqList.module.css';

// Аккордеон ответов. `category` фильтрует список; `openId` управляется снаружи, чтобы результаты
// поиска и карточки тем могли открыть конкретный ответ.
export function FaqList({ category, onCategoryChange, openId, onToggle }) {
  const items = category ? FAQ.filter((item) => item.category === category) : FAQ;

  return (
    <div className={styles.faq}>
      <ChipGroup
        label={texts.faqSection.filterLabel}
        options={[{ code: null, title: texts.faqSection.all }, ...HELP_CATEGORIES].map((item) => ({
          code: item.code,
          label: item.title,
        }))}
        value={category}
        onChange={onCategoryChange}
        size="md"
      />

      <ul className={styles.list}>
        {items.map((item) => {
          const open = openId === item.id;
          const answerId = `faq-${item.id}`;
          return (
            <li
              key={item.id}
              id={`q-${item.id}`}
              className={styles.item}
              data-open={open || undefined}
            >
              <h3 className={styles.heading}>
                <button
                  type="button"
                  className={styles.question}
                  data-ui="faq-question"
                  aria-expanded={open}
                  aria-controls={answerId}
                  onClick={() => onToggle(open ? null : item.id)}
                >
                  <span>{item.question}</span>
                  <span className={styles.plus} aria-hidden="true" />
                </button>
              </h3>
              {open && (
                <p id={answerId} className={styles.answer} data-ui="faq-answer">
                  {item.answer}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
