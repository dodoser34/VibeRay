import { MoodFace } from '@/features/mood';
import { MOODS } from '@/shared/config/moods';
import { Avatar } from '@/shared/ui/Avatar';
import about from '@/texts/ru/about.json';
import styles from './StoryMoodCard.module.css';

const texts = about.story.moodCard;

const PICKED = 'good';

// Сцена 4: точка одного жителя становится человеком с выбором настроения.
export function StoryMoodCard() {
  return (
    <div className={styles.card} data-story="mood-card" data-later>
      <div className={styles.person}>
        <Avatar src="preset:1" size={40} />
        <div>
          <p className={styles.nick}>{texts.nickname}</p>
          <p className={styles.place}>{texts.place}</p>
        </div>
      </div>
      <p className={styles.question}>{texts.question}</p>
      <ul className={styles.moods}>
        {MOODS.slice(0, 5).map((mood) => (
          <li key={mood.code} className={styles.mood}>
            <MoodFace mood={mood.code} size={34} label="" />
            <span>{mood.label}</span>
            {mood.code === PICKED && (
              <span className={styles.picked} data-story="mood-pick" data-later />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
