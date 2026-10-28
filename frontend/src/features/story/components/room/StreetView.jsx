import { useId } from 'react';
import styles from './IsometricRoom.module.css';

// Дома за окном: x, ширина, верх (в сантиметрах рисунка), этажей, окон в ряд, оттенок фасада.
const HOUSES = [
  [4, 48, 20, 9, 4, 'a'],
  [64, 58, 50, 5, 5, 'c'],
];
const SKYLINE = 'M0 64h10v-14h12v8h14v-20h10v16h18v-10h16v18h12v-6h14v12h24V115H0z';
const STARS = [
  [12, 10],
  [30, 6],
  [46, 14],
  [70, 8],
  [84, 20],
  [118, 9],
  [58, 26],
  [24, 22],
];
const TREES = [
  [8, 'crown'],
  [30, 'birch'],
  [56, 'crown'],
  [96, 'birch'],
  [118, 'crown'],
];

// Окно горит, если так выпало в псевдослучайном узоре (одинаковом при каждой отрисовке).
const isLit = (house, floor, column) => (house * 7 + floor * 3 + column * 5) % 4 === 0;

// Вечерний (днём — летний) двор Костаная за окном: панельные девятиэтажка и пятиэтажка, деревья,
// фонарь и дорога. Рисунок в сантиметрах (130 × 115), кладётся на плоскость за стеклом.
export function StreetView() {
  const sky = `${useId()}-sky`;
  return (
    <g>
      <defs>
        <linearGradient id={sky} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" className={styles.skyTop} />
          <stop offset="1" className={styles.skyLow} />
        </linearGradient>
      </defs>
      <rect width="130" height="115" fill={`url(#${sky})`} />
      {STARS.map(([x, y]) => (
        <circle key={`${x}-${y}`} className={styles.star} cx={x} cy={y} r="0.7" />
      ))}
      <circle className={styles.celestial} cx="104" cy="16" r="6.5" />
      <g className={styles.cloud}>
        <ellipse cx="34" cy="14" rx="12" ry="3.5" />
        <ellipse cx="42" cy="11" rx="7" ry="3.5" />
        <ellipse cx="86" cy="26" rx="10" ry="2.8" />
      </g>
      <path className={styles.skyline} d={SKYLINE} />

      {HOUSES.map(([x, width, top, floors, columns, tone], house) => {
        const floorHeight = (92 - top - 4) / floors;
        const step = width / columns;
        return (
          <g key={x}>
            <rect
              className={styles[`house-${tone}`]}
              x={x}
              y={top}
              width={width}
              height={92 - top}
            />
            <rect className={styles.roof} x={x - 1} y={top - 2} width={width + 2} height="2.5" />
            {Array.from({ length: floors }, (_, floor) =>
              Array.from({ length: columns }, (_, column) => (
                <rect
                  key={`${floor}-${column}`}
                  className={isLit(house, floor, column) ? styles.lit : styles.pane}
                  x={x + column * step + step * 0.28}
                  y={top + 3 + floor * floorHeight}
                  width={step * 0.44}
                  height={floorHeight * 0.55}
                />
              )),
            )}
            {/* подъезд с козырьком */}
            <rect className={styles.roof} x={x + width / 2 - 5} y="84" width="10" height="1.5" />
            <rect className={styles.door} x={x + width / 2 - 3} y="85.5" width="6" height="6.5" />
          </g>
        );
      })}

      <rect className={styles.paving} y="92" width="130" height="8" />
      <rect className={styles.road} y="100" width="130" height="15" />
      {[4, 30, 56, 82, 108].map((x) => (
        <rect key={x} className={styles.roadMark} x={x} y="107" width="12" height="1" />
      ))}

      {TREES.map(([x, kind]) => (
        <g key={x}>
          <rect
            className={kind === 'birch' ? styles.birch : styles.trunk}
            x={x - 0.8}
            y="80"
            width="1.6"
            height="14"
          />
          <ellipse className={styles.crown} cx={x} cy={kind === 'birch' ? 74 : 76} rx="7" ry="9" />
          <ellipse className={styles.crownLight} cx={x - 2} cy="72" rx="3.5" ry="4.5" />
        </g>
      ))}

      {/* фонарь и пятно его света на дороге (ночью) */}
      <ellipse className={styles.streetGlow} cx="66" cy="103" rx="13" ry="3.5" />
      <rect className={styles.lampPole} x="61.4" y="58" width="1.2" height="42" />
      <path className={styles.lampPole} d="M62 59q0-3 6-3h3v1.6h-3q-4.4 0-4.4 2z" />
      <rect className={styles.lampHead} x="69" y="56" width="5" height="2.2" rx="1" />
    </g>
  );
}
