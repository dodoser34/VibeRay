import { Avatar } from '@/shared/ui/avatar/Avatar';
import { Icon } from '@/shared/ui/icons/Icon';
import auth from '@/texts/en/auth.json';
import styles from './RegisterPreview.module.css';

// Живой предпросмотр публичного профиля: ровно то, что увидят другие (аватар, ник, район).
export function RegisterPreview({ avatar, nickname, districtName }) {
  const texts = auth.register;
  return (
    <div className={styles.preview}>
      <Avatar src={avatar} size={52} />
      <div className={styles.previewText}>
        <span className={styles.previewName}>{nickname || texts.previewNicknamePlaceholder}</span>
        <span className={styles.previewMeta}>
          {texts.previewResident}
          {districtName ? ` · ${districtName}` : ''}
        </span>
      </div>
      <span className={styles.lock} title={texts.previewPrivacyTitle}>
        <Icon name="lock" size={12} />
        {texts.previewPrivacy}
      </span>
    </div>
  );
}
