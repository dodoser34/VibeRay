import { Avatar } from '@/shared/ui/avatar/Avatar';
import { format } from '@/shared/lib/i18n/format';
import { Icon } from '@/shared/ui/icons/Icon';
import auth from '@/texts/en/auth.json';
import styles from './RegisterPreview.module.css';

// Живой предпросмотр профиля жителя. Другим видны только аватар и ник — об этом напоминает
// подпись с замком; город и район видит сам житель.
export function RegisterPreview({ avatar, nickname, cityName, districtName }) {
  const texts = auth.register;
  return (
    <div className={styles.preview}>
      <Avatar src={avatar} size={52} />
      <div className={styles.previewText}>
        <span className={styles.previewName}>{nickname || texts.previewNicknamePlaceholder}</span>
        <span className={styles.previewMeta}>
          {cityName ? format(texts.previewResident, { city: cityName }) : texts.previewNewResident}
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
