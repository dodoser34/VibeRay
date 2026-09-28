import { useRef, useState } from 'react';
import { useViewport } from '@/adaptations/core';
import { useCityData } from '@/features/map';
import { gsap, ScrollTrigger, SplitText, useGSAP } from '@/shared/animations/gsapSetup';
import { MOODS } from '@/shared/config/moods';
import { PROBLEM_CATEGORIES } from '@/shared/config/problemCategories';
import { PROBLEM_STATUSES } from '@/shared/config/problemStatuses';
import { useReducedMotion } from '@/shared/hooks/useReducedMotion';
import { Button } from '@/shared/ui/Button';
import { FULL_STORY } from '../content';
import { GuideMap } from './GuideMap';
import about from '@/texts/ru/about.json';
import styles from './StoryGuide.module.css';

const CITY = 'kostanay';

const texts = about.guide;
const STEPS = texts.steps;
// Ключ иконки → texts.privacy[key] (заголовок и текст).
const PRIVACY = ['mask', 'crowd', 'photo'].map((icon) => ({ icon, ...texts.privacy[icon] }));

const ICONS = {
  mask: 'M4 12c0-4 3.6-7 8-7s8 3 8 7-3.6 7-8 7-8-3-8-7Zm4.5-1.5h2M13.5 10.5h2M9 15c1.8 1.2 4.2 1.2 6 0',
  crowd:
    'M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2 20c0-3 2.7-5 6-5s6 2 6 5M14 15.3c.6-.2 1.3-.3 2-.3 3.3 0 6 2 6 5',
  photo: 'M4 8h3l2-3h6l2 3h3v11H4V8Zm8 8.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM3 3l18 18',
};

// «Как это работает» после истории: живой 2D-Костанай, который следует за шагами при прокрутке,
// цифры продукта, обещания приватности и финальный призыв открыть карту.
export function StoryGuide({ onOpenMap }) {
  const rootRef = useRef(null);
  const flowRef = useRef(null);
  const [step, setStep] = useState(0);
  const reduced = useReducedMotion();
  const { compact } = useViewport();
  const { city, moods, problems } = useCityData(CITY, 'week');

  const stats = [
    { value: city.data?.districts.features.length ?? 18, label: texts.stats.districts },
    { value: MOODS.length, label: texts.stats.moods },
    { value: PROBLEM_CATEGORIES.length, label: texts.stats.categories },
    { value: PROBLEM_STATUSES.length, label: texts.stats.statuses },
  ];

  useGSAP(
    () => {
      const q = gsap.utils.selector(rootRef);
      if (compact) {
        // Один закреплённый кадр (карта сверху, активная карточка снизу): шаг зависит от того,
        // насколько прокручена высокая секция, сами карточки не двигаются.
        const pick = (self) =>
          setStep(Math.min(STEPS.length - 1, Math.floor(self.progress * STEPS.length)));
        ScrollTrigger.create({
          trigger: flowRef.current,
          start: 'top top',
          end: 'bottom bottom',
          refreshPriority: -1,
          onUpdate: pick,
          onRefresh: pick,
        });
      } else {
        q('[data-step-card]').forEach((card, i) => {
          ScrollTrigger.create({
            trigger: card,
            start: 'top center',
            end: 'bottom center',
            refreshPriority: -1,
            onToggle: (self) => self.isActive && setStep(i),
          });
        });
      }
      if (reduced) return;

      q('[data-split]').forEach((heading) => {
        const split = SplitText.create(heading, { type: 'words', mask: 'words' });
        gsap.from(split.words, {
          yPercent: 110,
          duration: 0.9,
          stagger: 0.06,
          ease: 'power3.out',
          scrollTrigger: { trigger: heading, start: 'clamp(top 85%)', refreshPriority: -1 },
        });
      });
      q('[data-rise]').forEach((element) => {
        gsap.from(element, {
          y: 36,
          autoAlpha: 0,
          duration: 0.8,
          ease: 'power3.out',
          scrollTrigger: { trigger: element, start: 'clamp(top 88%)', refreshPriority: -1 },
        });
      });
      q('[data-count]').forEach((number) => {
        const counter = { value: 0 };
        gsap.to(counter, {
          value: Number(number.dataset.count),
          duration: 1.4,
          ease: 'power2.out',
          snap: { value: 1 },
          onUpdate: () => (number.textContent = counter.value),
          scrollTrigger: { trigger: number, start: 'clamp(top 90%)', refreshPriority: -1 },
        });
      });
    },
    { scope: rootRef, dependencies: [reduced, compact, city.data], revertOnUpdate: true },
  );

  return (
    <div ref={rootRef} className={styles.guide}>
      <header className={styles.intro}>
        <p className={styles.kicker}>{texts.kicker}</p>
        <h2 className={styles.title} data-split>
          {texts.titleStart} <em className={styles.accent}>{texts.titleAccent}</em>
        </h2>
        <p className={styles.lead} data-rise>
          {texts.lead}
        </p>
        <dl className={styles.stats} data-ui="guide-stats">
          {stats.map((stat) => (
            <div key={stat.label} className={styles.stat} data-rise data-ui="guide-stat">
              <dt className={styles.statLabel}>{stat.label}</dt>
              <dd className={styles.statValue} data-count={stat.value}>
                {stat.value}
              </dd>
            </div>
          ))}
        </dl>
      </header>

      <section
        ref={flowRef}
        className={styles.flow}
        style={{ '--steps': STEPS.length }}
        aria-label={texts.stepsLabel}
        data-ui="guide-flow"
      >
        <div className={styles.stage} data-ui="guide-stage">
          <div className={styles.mapColumn} data-ui="guide-map-column">
            <GuideMap city={city.data} moods={moods.data} problems={problems.data} step={step} />
            <ol className={styles.progress} aria-hidden="true">
              {STEPS.map((item, i) => (
                <li
                  key={item.title}
                  className={styles.progressItem}
                  data-done={i <= step || undefined}
                />
              ))}
            </ol>
          </div>
          <ol className={styles.steps} data-ui="guide-steps">
            {STEPS.map((item, i) => (
              <li
                key={item.title}
                className={styles.step}
                data-ui="guide-step"
                data-step-card
                data-active={i === step || undefined}
              >
                <span className={styles.stepNumber}>{String(i + 1).padStart(2, '0')}</span>
                <h3 className={styles.stepTitle}>{item.title}</h3>
                <p className={styles.stepText}>{item.text}</p>
                {i === 1 && (
                  <ul className={styles.chips}>
                    {MOODS.map((mood) => (
                      <li
                        key={mood.code}
                        className={styles.chip}
                        style={{ '--chip': `var(${mood.colorVar})` }}
                      >
                        {mood.label}
                      </li>
                    ))}
                  </ul>
                )}
                {i === 2 && (
                  <ul className={styles.statuses}>
                    {PROBLEM_STATUSES.map((status) => (
                      <li
                        key={status.code}
                        className={styles.status}
                        style={{ '--chip': `var(${status.colorVar})` }}
                      >
                        {status.label}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className={styles.privacy} aria-labelledby="privacy-title">
        <h2 id="privacy-title" className={styles.sectionTitle} data-split>
          {texts.privacyTitle}
        </h2>
        <ul className={styles.privacyGrid} data-ui="guide-privacy-grid">
          {PRIVACY.map((item) => (
            <li key={item.title} className={styles.privacyCard} data-rise>
              <svg className={styles.privacyIcon} viewBox="0 0 24 24" aria-hidden="true">
                <path d={ICONS[item.icon]} />
              </svg>
              <h3 className={styles.privacyTitle}>{item.title}</h3>
              <p className={styles.privacyText}>{item.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.cta} data-rise>
        <p className={styles.ctaKicker}>{texts.ctaKicker}</p>
        <h2 className={styles.ctaTitle}>{texts.ctaTitle}</h2>
        <Button size="lg" onClick={onOpenMap}>
          {texts.openMap}
        </Button>
        <details className={styles.story}>
          <summary className={styles.storySummary}>{texts.fullStorySummary}</summary>
          <div className={styles.storyText}>
            {FULL_STORY.map((paragraph) => (
              <p key={paragraph.slice(0, 32)}>{paragraph}</p>
            ))}
          </div>
        </details>
      </section>
    </div>
  );
}
