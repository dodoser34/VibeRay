import { useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { DeleteAccountDialog } from './DeleteAccountDialog';
import { SettingsSection } from './SettingsSection';
import texts from '@/texts/settings.json';
import styles from './AccountSection.module.css';

// onLogout и onDeleted решает страница: сначала уводит с настроек, потом закрывает сессию.
export function AccountSection({ id, onLogout, onDeleted }) {
  const [confirming, setConfirming] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const logout = async () => {
    setLeaving(true);
    await onLogout();
  };

  return (
    <SettingsSection id={id} title={texts.sections.account} lead={texts.account.lead}>
      <div className={styles.rows} data-ui="settings-account">
        <div className={styles.row}>
          <div className={styles.text}>
            <h3 className={styles.rowTitle}>{texts.account.logoutTitle}</h3>
            <p className={styles.rowText}>{texts.account.logoutText}</p>
          </div>
          <Button variant="ghost" onClick={logout} loading={leaving}>
            {texts.account.logout}
          </Button>
        </div>
        <div className={styles.row} data-danger>
          <div className={styles.text}>
            <h3 className={styles.rowTitle}>{texts.account.deleteTitle}</h3>
            <p className={styles.rowText}>{texts.account.deleteText}</p>
          </div>
          <Button variant="danger" onClick={() => setConfirming(true)}>
            {texts.account.delete}
          </Button>
        </div>
      </div>
      {confirming && (
        <DeleteAccountDialog onClose={() => setConfirming(false)} onDeleted={onDeleted} />
      )}
    </SettingsSection>
  );
}
