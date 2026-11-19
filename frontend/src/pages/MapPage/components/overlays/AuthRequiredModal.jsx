import { Button } from '@/shared/ui/controls/Button';
import { Modal } from '@/shared/ui/windows/Modal';
import texts from '@/texts/en/map.json';
import styles from './AuthRequiredModal.module.css';

// Гость нажал действие, для которого нужен аккаунт: объясняем зачем (reason) и ведём ко входу или
// регистрации.
export function AuthRequiredModal({ reason, onClose, onNavigate }) {
  return (
    <Modal title={texts.authModal.title} onClose={onClose} width={420}>
      <p className={styles.text}>{reason}</p>
      <div className={styles.actions}>
        <Button block onClick={() => onNavigate('/register')}>
          {texts.authModal.register}
        </Button>
        <Button block variant="ghost" onClick={() => onNavigate('/login')}>
          {texts.authModal.login}
        </Button>
      </div>
    </Modal>
  );
}
