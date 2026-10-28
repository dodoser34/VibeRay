import { Icon } from '@/shared/ui/icons/Icon';
import about from '@/texts/ru/about.json';
import { useRef } from 'react';
import { useBoxSize } from '../../hooks/useBoxSize';
import { isDaylight } from '../../lib/chapters';
import { topViewBox } from '../../lib/topView';
import styles from './PhoneStage.module.css';

const IDEAS = ['shop', 'habits', 'game', 'studyNetwork', 'finance'];

// Экран телефона до 3D-города: экран блокировки (время, дата, уведомление «Заметок»), затем
// «Заметки» — список идей, которые зачёркиваются, и новая заметка, где печатается вопрос; в конце
// экран занимает карта Костаная — в той же рамке, что первый кадр 3D-города (lib/topView.js), поэтому
// город проявляется на месте. Сюжет общий с монитором на ПК (data-screen); слои — data-phone.
export function PhoneScreen({ outline }) {
  const { phone, screen } = about;
  const time = isDaylight() ? phone.timeDaylight : phone.time;
  const flatRef = useRef(null);
  const box = useBoxSize(flatRef);
  return (
    <div ref={flatRef} className={styles.flat} data-phone="flat" aria-hidden="true">
      <div className={styles.app} data-phone="app">
        <p className={styles.appTitle}>{screen.appName}</p>
        <ul className={styles.ideas} data-screen="ideas">
          {IDEAS.map((key) => (
            <li key={key} className={styles.idea} data-screen="idea">
              <span className={styles.check} />
              <span className={styles.ideaText}>
                {screen.ideas[key]}
                <span className={styles.strike} data-screen="strike" />
              </span>
            </li>
          ))}
        </ul>
        <div className={styles.note} data-screen="note">
          <p className={styles.noteName}>{screen.fileName}</p>
          <p className={styles.typing}>
            <span data-screen="typed" />
            <span className={styles.caret} />
          </p>
        </div>
      </div>

      <div className={styles.lock} data-phone="lock">
        <p className={styles.lockDate}>{phone.date}</p>
        <p className={styles.lockTime}>{time}</p>
        <div className={styles.notice}>
          <span className={styles.noticeIcon}>
            <Icon name="note" size={18} color="var(--color-bg-deep)" />
          </span>
          <div>
            <p className={styles.noticeApp}>{screen.appName}</p>
            <p className={styles.noticeText}>
              {screen.fileName} · {phone.notice}
            </p>
          </div>
        </div>
      </div>

      {outline && box && (
        <svg
          className={styles.map}
          data-screen="map"
          viewBox={topViewBox(box.width, box.height).join(' ')}
          preserveAspectRatio="none"
        >
          {outline.districts.map((district) => (
            <path
              key={district.slug}
              d={district.d}
              className={styles.district}
              style={{ '--fill': `var(--district-${district.palette})` }}
            />
          ))}
        </svg>
      )}
    </div>
  );
}
