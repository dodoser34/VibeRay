import { Button } from '@/shared/ui/controls/Button';
import { LogoMark } from '@/shared/ui/icons/LogoMark';
import { useLanguage } from '@/shared/hooks/useLanguage';
import about from '@/texts/en/about.json';
import { CHAPTERS, story } from '../lib/chapters';
import { BUILD, FINAL, LIVING, MOOD, PRODUCT } from '../lib/storyTimeline';
import { StoryPlan } from './StoryPlan';
import { StoryInterface } from './StoryInterface';
import { StoryMoodCard } from './StoryMoodCard';
import styles from './StoryOverlay.module.css';

// Главы, где подпись и карточки собраны в колонку справа: на ПК город вписывается в место слева от
// неё (StoryScene.setFreeArea), на телефоне колонки нет — подпись остаётся уведомлением.
const COLUMN_CHAPTERS = new Set([MOOD, BUILD, PRODUCT]);

// Всё, что идёт поверх сцены истории: подписи глав, карточка настроения, крупные фразы, план
// проекта, панели интерфейса, финал. Анимирует addOverlayTimeline по data-story. variant: 'room' — поверх
// изометрической комнаты на весь экран (ПК), 'phone' — внутри экрана телефона: подписи — сообщения,
// панели и карточки — по ширине экрана; orientation — как держат телефон.
export function StoryOverlay({ variant, orientation, onOpenMap }) {
  const language = useLanguage();
  const living = CHAPTERS[LIVING];
  const final = CHAPTERS[FINAL];
  const caption = (index) => {
    const chapter = CHAPTERS[index];
    return (
      chapter.text && (
        <p
          key={chapter.id}
          className={styles.caption}
          data-story="caption"
          data-index={index}
          data-later={index > 0 || undefined}
        >
          {variant === 'phone' && (
            <span className={styles.appIcon}>
              <LogoMark />
            </span>
          )}
          <span>{chapter.text}</span>
        </p>
      )
    );
  };
  return (
    <div className={styles.overlay} data-variant={variant} data-orientation={orientation}>
      <p className={styles.stamp} data-story="stamp">
        {story.stamp}
      </p>
      {CHAPTERS.map((_, index) => !COLUMN_CHAPTERS.has(index) && caption(index))}
      <div className={styles.center}>
        <p key={language} className={styles.phrase} data-story="phrase-living" data-later>
          {living.phrase}
        </p>
      </div>
      <div className={styles.column} data-story-column>
        {caption(MOOD)}
        <div className={styles.moodSlot}>
          <StoryMoodCard />
        </div>
      </div>
      <div className={styles.column} data-story-column>
        {caption(BUILD)}
        <div className={styles.center}>
          <StoryPlan />
        </div>
      </div>
      <div className={styles.column} data-story-column>
        {caption(PRODUCT)}
        <StoryInterface />
      </div>
      <div className={`${styles.center} ${styles.finale}`}>
        <p key={language} className={styles.phrase} data-story="final-phrase" data-later>
          {final.phrase}
        </p>
        <p className={styles.question} data-story="final-question" data-later>
          {final.question}
        </p>
        <div className={styles.cta} data-story="cta" data-later>
          <Button size={variant === 'phone' ? 'md' : 'lg'} onClick={onOpenMap}>
            {about.story.openMap}
          </Button>
        </div>
      </div>
      <p className={styles.hint} data-story="hint">
        {about.story.hint}
      </p>
    </div>
  );
}
