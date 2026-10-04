import { useId, useState } from 'react';
import { useViewport } from '@/adaptations/core';
import { POPULAR_QUERIES } from '../content';
import texts from '@/texts/ru/support.json';
import styles from './HelpSearch.module.css';
import { Icon } from '@/shared/ui/Icon';

// Большое поле поиска с мгновенными ответами из FAQ (combobox: работают стрелки и Enter).
export function HelpSearch({ query, onQueryChange, results, onPick, onWrite }) {
  const listId = useId();
  // В поле на телефоне помещается около 20 символов: длинный пример обрезался бы посреди слова.
  const { isMobile } = useViewport();
  const [active, setActive] = useState(0);
  const open = query.trim().length > 0;

  const onKeyDown = (event) => {
    if (!open || !results.length) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive((i) => (i + step + results.length) % results.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      onPick(results[Math.min(active, results.length - 1)]);
    } else if (event.key === 'Escape') {
      onQueryChange('');
    }
  };

  return (
    <div className={styles.search}>
      <div className={styles.field} data-open={open || undefined} data-ui="help-field">
        <Icon name="search" className={styles.icon} />
        <input
          className={styles.input}
          data-ui="help-input"
          type="search"
          value={query}
          onChange={(event) => {
            setActive(0);
            onQueryChange(event.target.value);
          }}
          onKeyDown={onKeyDown}
          placeholder={isMobile ? texts.search.placeholderShort : texts.search.placeholder}
          aria-label={texts.search.label}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && results.length ? `${listId}-${active}` : undefined}
          autoComplete="off"
        />
        {query && (
          <button
            type="button"
            className={styles.clear}
            onClick={() => onQueryChange('')}
            aria-label={texts.search.clear}
          >
            <Icon name="close" />
          </button>
        )}
      </div>

      {open && (
        <div className={styles.results} data-ui="help-results">
          {results.length ? (
            <ul
              id={listId}
              role="listbox"
              className={styles.list}
              aria-label={texts.search.resultsLabel}
            >
              {results.map((item, i) => (
                <li
                  key={item.id}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  className={styles.option}
                  onPointerEnter={() => setActive(i)}
                  onClick={() => onPick(item)}
                >
                  <span className={styles.optionTitle}>{item.question}</span>
                  <span className={styles.optionText}>{item.answer}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div id={listId} className={styles.empty}>
              <p>{texts.search.empty}</p>
              <button type="button" className={styles.emptyAction} onClick={onWrite}>
                {texts.search.askSupport}
              </button>
            </div>
          )}
        </div>
      )}

      <div className={styles.popular}>
        <span className={styles.popularLabel}>{texts.search.popularLabel}</span>
        {POPULAR_QUERIES.map((text) => (
          <button
            key={text}
            type="button"
            className={styles.chip}
            data-ui="help-chip"
            data-active={query === text || undefined}
            onClick={() => {
              setActive(0);
              onQueryChange(text);
            }}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}
