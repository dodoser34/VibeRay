import { useId, useState } from 'react';
import { MoodFace } from '@/features/mood';
import { MOOD_BY_CODE, moodCodeForScore } from '@/shared/config/moods';
import { format } from '@/shared/lib/i18n/format';
import { formatWeekday } from '@/shared/lib/i18n/formatDate';
import { plural } from '@/shared/lib/i18n/plural';
import { Avatar, AVATAR_PRESETS } from '@/shared/ui/avatar/Avatar';
import { Button } from '@/shared/ui/controls/Button';
import { Icon } from '@/shared/ui/icons/Icon';
import about from '@/texts/en/about.json';
import problemTexts from '@/texts/en/problems.json';
import statsTexts from '@/texts/en/stats.json';
import styles from './StoryInterface.module.css';

// Доли настроений района (сумма 100) и настроение недели 0…1 (по шкале −2…+2).
const DISTRIBUTION = [
  ['excellent', 46],
  ['good', 28],
  ['normal', 16],
  ['bad', 10],
];
const WEEK = [0.2, 0.5, 0.35, 0.7, 0.6, 0.9, 0.8];
const LAST_DAY = WEEK.length - 1;
const CONFIRMATIONS = 12;
// График недели в единицах viewBox; пропорции те же, что у блока графика в CSS (aspect-ratio).
const CHART = { width: 300, height: 54, padding: 6 };
const POINTS = WEEK.map((value, i) => [
  CHART.padding + (i / LAST_DAY) * (CHART.width - 2 * CHART.padding),
  CHART.padding + (1 - value) * (CHART.height - 2 * CHART.padding),
]);
const LINE = `M${POINTS.map(([x, y]) => `${x} ${y}`).join('L')}`;
const AREA = `${LINE}L${POINTS[LAST_DAY][0]} ${CHART.height}L${POINTS[0][0]} ${CHART.height}Z`;

const clampDay = (day) => Math.max(0, Math.min(LAST_DAY, day));
// Подпись дня недели на языке интерфейса: 1 января 2024 — понедельник.
const weekday = (day) => formatWeekday(new Date(2024, 0, 1 + day));

// Сцена 8: простая идея собирается в настоящий продукт — кусочки реального интерфейса. Их можно
// потрогать: полоса настроений района подсказывает доли, аватар меняется, проблему можно
// подтвердить, по графику недели — пройтись по дням (мышью, пальцем или стрелками).
export function StoryInterface() {
  const texts = about.story.interface;
  const clipId = useId();
  const [segment, setSegment] = useState(null);
  const [avatar, setAvatar] = useState(1);
  const [confirmed, setConfirmed] = useState(false);
  const [day, setDay] = useState(LAST_DAY);

  const [shownCode, shownShare] =
    DISTRIBUTION.find(([code]) => code === segment) ?? DISTRIBUTION[0];
  const confirmations = CONFIRMATIONS + (confirmed ? 1 : 0);
  const dayMood = MOOD_BY_CODE[moodCodeForScore(WEEK[day] * 4 - 2)];
  const [dayX, dayY] = POINTS[day];

  const pickDay = (event) => {
    const box = event.currentTarget.getBoundingClientRect();
    setDay(clampDay(Math.round(((event.clientX - box.left) / box.width) * LAST_DAY)));
  };
  const stepDay = (event) => {
    const step = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
    if (!step) return;
    event.preventDefault();
    setDay((current) => clampDay(current + step));
  };

  return (
    <div className={styles.layout} data-ui="story-ui">
      <section className={styles.panel} data-ui="story-ui-district" data-story="panel" data-later>
        <p className={styles.kicker} data-ui="story-ui-kicker">
          {texts.districtKicker}
        </p>
        <h3 className={styles.title}>{texts.districtName}</h3>
        <div className={styles.row}>
          <MoodFace mood="good" size={36} label="" />
          <span className={styles.big}>{texts.districtMood}</span>
          <span className={styles.muted} data-ui="story-ui-score">
            +1.0
          </span>
        </div>
        <div className={styles.bar} onPointerLeave={() => setSegment(null)}>
          {DISTRIBUTION.map(([code, share]) => (
            <button
              key={code}
              type="button"
              className={styles.segment}
              style={{ '--share': share, '--color': `var(${MOOD_BY_CODE[code].colorVar})` }}
              data-active={code === shownCode || undefined}
              aria-label={`${MOOD_BY_CODE[code].label}: ${format(statsTexts.share, { percent: share })}`}
              onPointerEnter={() => setSegment(code)}
              onFocus={() => setSegment(code)}
              onBlur={() => setSegment(null)}
            />
          ))}
        </div>
        <p className={styles.hint} data-ui="story-ui-hint" aria-hidden="true">
          <span
            className={styles.swatch}
            style={{ '--color': `var(${MOOD_BY_CODE[shownCode].colorVar})` }}
          />
          {MOOD_BY_CODE[shownCode].label} · {format(statsTexts.share, { percent: shownShare })}
        </p>
      </section>

      <section
        className={`${styles.panel} ${styles.profile}`}
        data-ui="story-ui-profile"
        data-story="panel"
        data-later
      >
        <button
          type="button"
          className={styles.avatarButton}
          aria-label={texts.profileAvatar}
          title={texts.profileAvatar}
          onClick={() => setAvatar((current) => (current + 1) % AVATAR_PRESETS.length)}
        >
          <span key={avatar} className={styles.avatar}>
            <Avatar src={`preset:${avatar}`} size={36} />
          </span>
        </button>
        <div>
          <p className={styles.strong}>{texts.profileName}</p>
          <p className={styles.muted}>{texts.profilePrivacy}</p>
        </div>
      </section>

      <section className={styles.panel} data-ui="story-ui-problem" data-story="panel" data-later>
        <p className={styles.kicker} data-ui="story-ui-kicker">
          {texts.problemKicker}
        </p>
        <p className={styles.strong}>{texts.problemTitle}</p>
        <div className={styles.row}>
          <span className={styles.status}>{texts.problemStatus}</span>
          <span className={styles.muted} aria-live="polite">
            {format(problemTexts.card.confirmations, {
              count: confirmations,
              people: plural(confirmations, problemTexts.card.confirmationsForms),
            })}
          </span>
        </div>
        <Button
          variant={confirmed ? 'primary' : 'ghost'}
          size="sm"
          className={styles.confirm}
          aria-pressed={confirmed}
          onClick={() => setConfirmed((current) => !current)}
        >
          <Icon
            name={confirmed ? 'check' : 'users-check'}
            size={16}
            className={styles.confirmIcon}
          />
          {confirmed ? problemTexts.card.confirmedByMe : problemTexts.card.confirm}
        </Button>
      </section>

      <section className={styles.panel} data-ui="story-ui-stats" data-story="panel" data-later>
        <p className={styles.kicker} data-ui="story-ui-kicker">
          {texts.statsKicker}
        </p>
        <div
          className={styles.chartBox}
          role="slider"
          tabIndex={0}
          aria-label={texts.statsKicker}
          aria-valuemin={0}
          aria-valuemax={LAST_DAY}
          aria-valuenow={day}
          aria-valuetext={`${weekday(day)}: ${dayMood.label}`}
          onPointerMove={pickDay}
          onPointerDown={pickDay}
          onKeyDown={stepDay}
        >
          <svg
            viewBox={`0 0 ${CHART.width} ${CHART.height}`}
            className={styles.chart}
            aria-hidden="true"
          >
            <defs>
              <clipPath id={clipId}>
                <rect width={CHART.width} height={CHART.height} data-story="stats-reveal" />
              </clipPath>
            </defs>
            <g clipPath={`url(#${clipId})`}>
              <line
                className={styles.cursor}
                y2={CHART.height}
                style={{ transform: `translateX(${dayX}px)` }}
              />
              <path className={styles.area} d={AREA} />
              <path className={styles.line} d={LINE} />
              {POINTS.map(([x, y]) => (
                <circle key={x} className={styles.point} cx={x} cy={y} r={2.5} />
              ))}
              <circle
                className={styles.marker}
                r={5}
                style={{ transform: `translate(${dayX}px, ${dayY}px)` }}
              />
            </g>
          </svg>
        </div>
        <p className={styles.hint} aria-hidden="true">
          <MoodFace mood={dayMood.code} size={18} label="" />
          {weekday(day)} · {dayMood.label}
        </p>
      </section>
    </div>
  );
}
