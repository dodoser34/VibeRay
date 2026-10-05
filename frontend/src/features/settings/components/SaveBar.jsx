import { Button } from '@/shared/ui/Button';
import texts from '@/texts/ru/settings.json';
import styles from './SaveBar.module.css';
import { Icon } from '@/shared/ui/icons/Icon';

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
            <Icon name="check" size={14} />
            {savedLabel}
          </>
        )}
        {error}
      </p>
    </div>
  );
}
