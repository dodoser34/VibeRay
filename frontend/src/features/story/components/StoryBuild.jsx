import { Icon } from '@/shared/ui/icons/Icon';
import about from '@/texts/ru/about.json';
import styles from './StoryBuild.module.css';

// Сцена 7: идея превращается в работу — между парами пункты плана отмечаются один за другим.
export function StoryBuild() {
  const texts = about.story.build;
  return (
    <div className={styles.card} data-story="build-card" data-ui="story-build" data-later>
      <p className={styles.kicker} data-ui="story-build-kicker">
        {texts.kicker}
      </p>
      <p className={styles.title}>{texts.title}</p>
      <ul className={styles.items}>
        {texts.items.map((item) => (
          <li key={item} className={styles.item}>
            <span className={styles.box}>
              <span className={styles.check} data-story="build-check" data-later>
                <Icon name="check" />
              </span>
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
      <span className={styles.track}>
        <span className={styles.bar} data-story="build-bar" />
      </span>
    </div>
  );
}
