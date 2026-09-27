import { Button } from '@/shared/ui/Button';
import texts from '@/texts/settings.json';
import styles from './SaveBar.module.css';

// Кнопки формы раздела и итог сохранения. Пока ничего не изменено, сохранять нечего.
// error — ошибка, которую раздел не показал у конкретного поля.
export function SaveBar({ status, error, dirty, saveLabel, savedLabel = texts.saved, onReset }) {
  return (
    <div className={styles.bar} data-ui="settings-savebar">
      <Button type="submit" loading={status === 'saving'} disabled={!dirty}>
        {saveLabel}
      </Button>
      {onReset && dirty && (
        <Button variant="ghost" onClick={onReset}>
          {texts.profile.reset}
        </Button>
      )}
      <p className={styles.status} role="status" data-state={error ? 'error' : status}>
        {status === 'saved' && (
          <>
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
              <path d="M3 8.5l3 3 7-7" />
            </svg>
            {savedLabel}
          </>
        )}
        {error}
      </p>
    </div>
  );
}
