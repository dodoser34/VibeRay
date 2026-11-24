import { useState } from 'react';
import { MoodFace } from '@/features/mood';
import { MOODS } from '@/shared/config/moods';
import { Avatar } from '@/shared/ui/avatar/Avatar';
import { Icon } from '@/shared/ui/icons/Icon';
import about from '@/texts/en/about.json';
import styles from './StoryMoodCard.module.css';

const SCALE = MOODS.slice(0, 5);
// Что жилец выбирает сам по ходу истории; дальше посетитель может выбрать своё.
const STORY_PICK = 'good';

// Сцена 4: точка одного жителя становится человеком с выбором настроения. Рамку выбора показывает
// шкала истории (data-story="mood-pick"); посетитель может нажать любое лицо — рамка переедет к нему.
export function StoryMoodCard() {
  const texts = about.story.moodCard;
  const [picked, setPicked] = useState(STORY_PICK);
  const index = SCALE.findIndex((mood) => mood.code === picked);
  return (
    <div className={styles.card} data-story="mood-card" data-later>
      <div className={styles.person} data-story="mood-person">
        <Avatar src="preset:1" size={40} />
        <div>
          <p className={styles.nick}>{texts.nickname}</p>
          <p className={styles.place}>{texts.place}</p>
        </div>
      </div>
      <p className={styles.question}>{texts.question}</p>
      <div className={styles.moods} role="radiogroup" aria-label={texts.question}>
        <span
          className={styles.picked}
          style={{ '--pick': index }}
          data-story="mood-pick"
          data-later
          aria-hidden="true"
        />
        {SCALE.map((mood) => (
          <button
            key={mood.code}
            type="button"
            role="radio"
            aria-checked={picked === mood.code}
            className={styles.mood}
            onClick={() => setPicked(mood.code)}
          >
            <span className={styles.face}>
              <MoodFace mood={mood.code} size={34} label="" />
            </span>
            <span>{mood.label}</span>
          </button>
        ))}
      </div>
      <p className={styles.note}>
        <Icon name="lock" size={12} />
        {texts.note}
      </p>
    </div>
  );
}
