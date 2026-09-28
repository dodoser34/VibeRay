import { MoodFace } from '@/features/mood';
import { Avatar } from '@/shared/ui/Avatar';
import about from '@/texts/ru/about.json';
import styles from './StoryInterface.module.css';

const texts = about.story.interface;

const WEEK = [0.2, 0.5, 0.35, 0.7, 0.6, 0.9, 0.8];

// Сцена 8: простая идея собирается в настоящий продукт — кусочки реального интерфейса.
export function StoryInterface() {
  const points = WEEK.map((v, i) => `${(i / (WEEK.length - 1)) * 100},${40 - v * 36}`).join(' ');
  return (
    <div className={styles.layout}>
      <section
        className={`${styles.panel} ${styles.district}`}
        data-ui="story-ui-district"
        data-story="panel"
        data-from="left"
        data-later
      >
        <p className={styles.kicker}>{texts.districtKicker}</p>
        <h3 className={styles.title}>{texts.districtName}</h3>
        <div className={styles.row}>
          <MoodFace mood="good" size={36} label="" />
          <span className={styles.big}>{texts.districtMood}</span>
          <span className={styles.muted}>+1.0</span>
        </div>
        <div className={styles.bar}>
          <span style={{ '--w': '46%', '--c': 'var(--mood-excellent)' }} />
          <span style={{ '--w': '28%', '--c': 'var(--mood-good)' }} />
          <span style={{ '--w': '16%', '--c': 'var(--mood-normal)' }} />
          <span style={{ '--w': '10%', '--c': 'var(--mood-bad)' }} />
        </div>
      </section>

      <section
        className={`${styles.panel} ${styles.profile}`}
        data-ui="story-ui-profile"
        data-story="panel"
        data-from="top"
        data-later
      >
        <Avatar src="preset:1" size={36} />
        <div>
          <p className={styles.strong}>{texts.profileName}</p>
          <p className={styles.muted}>{texts.profilePrivacy}</p>
        </div>
      </section>

      <section
        className={`${styles.panel} ${styles.problem}`}
        data-ui="story-ui-problem"
        data-story="panel"
        data-from="right"
        data-later
      >
        <p className={styles.kicker}>{texts.problemKicker}</p>
        <p className={styles.strong}>{texts.problemTitle}</p>
        <div className={styles.row}>
          <span className={styles.status}>{texts.problemStatus}</span>
          <span className={styles.muted}>{texts.problemConfirmations}</span>
        </div>
      </section>

      <section
        className={`${styles.panel} ${styles.stats}`}
        data-ui="story-ui-stats"
        data-story="panel"
        data-from="bottom"
        data-later
      >
        <p className={styles.kicker}>{texts.statsKicker}</p>
        <svg viewBox="0 0 100 44" className={styles.chart} aria-hidden="true">
          <polyline points={points} />
        </svg>
      </section>
    </div>
  );
}
