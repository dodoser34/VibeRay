import { useId } from 'react';
import styles from './LogoMark.module.css';

// Буква V знака: толстые плечи, сходящиеся книзу (viewBox 40×40).
const V_SHAPE = '6,8 13.5,8 20,23 26.5,8 34,8 23.5,33 16.5,33';
// Многоэтажки внутри V: левый край, ширина, верх, оттенок. Видны только сквозь букву.
const BUILDINGS = [
  [3, 6, 12, 'a'],
  [9, 4.5, 15.5, 'b'],
  [13.5, 4, 20, 'a'],
  [17.5, 5, 25, 'b'],
  [22.5, 4, 18, 'a'],
  [26.5, 4.5, 14, 'b'],
  [31, 6, 10.5, 'a'],
];
const WINDOW = { width: 1.2, height: 1.3, stepX: 2.2, stepY: 2.6, inset: 1.1 };

function windowsOf([left, width, top]) {
  const cols = Math.max(1, Math.floor((width - WINDOW.inset) / WINDOW.stepX));
  const rows = Math.floor((33 - top - WINDOW.inset) / WINDOW.stepY);
  return Array.from({ length: rows * cols }, (_, i) => ({
    x: left + WINDOW.inset + (i % cols) * WINDOW.stepX,
    y: top + WINDOW.inset + Math.floor(i / cols) * WINDOW.stepY,
  }));
}

// Знак VibeRay: буква V как окно в город — внутри многоэтажки с окнами на зелёном небе, в развилке —
// точка настроения. Цвета — токены темы. framed — знак на круглой подложке (шапка сайта).
export function LogoMark({ framed = false }) {
  const clip = `${useId()}-v`;
  return (
    <svg viewBox="0 0 40 40" width="30" height="30" aria-hidden="true" className={styles.mark}>
      {framed && <circle cx="20" cy="20" r="19.5" className={styles.frame} />}
      <defs>
        <clipPath id={clip}>
          <polygon points={V_SHAPE} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <rect width="40" height="40" className={styles.sky} />
        {BUILDINGS.map((building) => {
          const [left, width, top, tone] = building;
          return (
            <g key={left}>
              <rect
                x={left}
                y={top}
                width={width}
                height={40 - top}
                className={styles[`tower-${tone}`]}
              />
              {windowsOf(building).map(({ x, y }) => (
                <rect
                  key={`${x}-${y}`}
                  x={x}
                  y={y}
                  width={WINDOW.width}
                  height={WINDOW.height}
                  className={styles.window}
                />
              ))}
            </g>
          );
        })}
      </g>
      <polygon points={V_SHAPE} className={styles.outline} />
      <circle cx="20" cy="11.5" r="2.7" className={styles.dot} />
    </svg>
  );
}
