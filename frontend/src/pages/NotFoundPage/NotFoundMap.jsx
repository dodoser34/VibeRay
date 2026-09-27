import { useId } from 'react';
import styles from './NotFoundPage.module.css';

// Четыре панели карты, сложенной гармошкой: верхние углы чередуются, как у настоящего сгиба.
const PANELS = [
  '40,52 160,40 160,340 40,328',
  '160,40 280,52 280,328 160,340',
  '280,52 400,40 400,340 280,328',
  '400,40 520,52 520,328 400,340',
];

const DISTRICTS = [
  { d: 'M58 80 L150 66 L168 150 L96 176 L60 150 Z', tone: 5 },
  { d: 'M168 150 L150 66 L250 60 L270 132 Z', tone: 1 },
  { d: 'M60 150 L96 176 L168 150 L182 250 L70 262 Z', tone: 9 },
  { d: 'M168 150 L270 132 L300 214 L182 250 Z', tone: 2 },
  { d: 'M70 262 L182 250 L196 318 L64 316 Z', tone: 6 },
  { d: 'M182 250 L300 214 L338 300 L196 318 Z', tone: 8 },
  { d: 'M270 132 L250 60 L352 58 L372 150 L300 214 Z', tone: 10 },
];

const STREETS = [
  'M52 118 C120 110 210 98 380 92',
  'M56 206 C140 196 250 186 360 176',
  'M120 60 C126 140 136 230 140 330',
  'M226 58 C236 150 250 240 262 326',
  'M300 60 C314 120 326 200 340 320',
];

// Иллюстрация 404: карта обрывается у правого края — там район без разметки и метка с вопросом.
// Части помечены data-* для анимации в NotFoundPage.
export function NotFoundMap({ label }) {
  const clipId = useId();
  const hatchId = useId();
  return (
    <svg className={styles.art} viewBox="0 0 560 380" role="img" aria-label={label}>
      <defs>
        <clipPath id={clipId}>
          {PANELS.map((points) => (
            <polygon key={points} points={points} />
          ))}
        </clipPath>
        <pattern id={hatchId} width="10" height="10" patternUnits="userSpaceOnUse">
          <path d="M-2 2l4-4M0 10L10 0M8 12l4-4" className={styles.hatch} />
        </pattern>
      </defs>

      <ellipse cx="280" cy="352" rx="230" ry="10" className={styles.shadow} />

      <g data-paper>
        {PANELS.map((points, i) => (
          <polygon
            key={points}
            points={points}
            className={styles.panel}
            data-shade={i % 2 || undefined}
            data-panel
          />
        ))}
      </g>

      <g clipPath={`url(#${clipId})`}>
        {DISTRICTS.map(({ d, tone }) => (
          <path
            key={d}
            d={d}
            className={styles.district}
            style={{ '--tone': `var(--district-${tone})` }}
            data-district
          />
        ))}
        <path
          d="M40 300 C110 270 150 290 210 250 S320 230 372 262"
          className={styles.river}
          pathLength="1"
          data-line
        />
        {STREETS.map((d) => (
          <path key={d} d={d} className={styles.street} pathLength="1" data-line />
        ))}
        <path
          d="M380 70 L500 84 L508 300 L392 316 L372 150 Z"
          fill={`url(#${hatchId})`}
          className={styles.blank}
          data-blank
        />
        <path d="M380 70 L500 84 L508 300 L392 316 L372 150 Z" className={styles.edge} data-blank />
      </g>

      <g className={styles.folds}>
        {[160, 280, 400].map((x) => (
          <line key={x} x1={x} y1={40} x2={x} y2={340} />
        ))}
      </g>

      <g data-pin>
        <ellipse cx="444" cy="226" rx="16" ry="5" className={styles.pinShadow} data-pin-shadow />
        <g className={styles.pinBody} data-pin-body>
          <path
            d="M444 222s-26-24-26-46a26 26 0 0 1 52 0c0 22-26 46-26 46z"
            className={styles.pinHead}
          />
          <text x="444" y="186" className={styles.pinMark} textAnchor="middle">
            ?
          </text>
        </g>
      </g>
    </svg>
  );
}
