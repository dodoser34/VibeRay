import { story } from '../../lib/chapters';
import { IsoBox } from './IsoBox';
import { IsoCylinder } from './IsoCylinder';
import { IsoPlane } from './IsoPlane';
import styles from './IsometricRoom.module.css';

// Книги на полке над столом: толщина, высота, токен цвета.
const SHELF_BOOKS = [
  [0.45, 2.4, '--story-book-a'],
  [0.35, 2.1, '--story-spine-titan'],
  [0.5, 2.6, '--story-book-b'],
  [0.3, 1.9, '--story-book-c'],
  [0.45, 2.3, '--story-spine-king'],
  [0.4, 2.5, '--story-book-a'],
  [0.35, 2.0, '--story-book-b'],
];
// Книги стоят вплотную слева направо (вдоль стены, от 6,3).
const BOOKS = SHELF_BOOKS.reduce((books, [width, height, tone]) => {
  const last = books.at(-1);
  const y = last ? last.y + last.width + 0.04 : 6.3;
  return [...books, { y, width, height, tone }];
}, []);
const STICKERS = [
  [0, 0, -4],
  [1.3, 0.3, 5],
  [0.5, 1.4, -2],
];

// Левая стена над столом: полка с книгами, горшком и фигуркой, бумажная карта Костаная с булавками
// (те же районы OSM, что в 3D-городе), июльский календарь и стикеры с заметками.
export function DeskWall({ outline }) {
  return (
    <g>
      {/* полка на двух кронштейнах */}
      <IsoBox at={[0, 6.6, 15.2]} size={[1.6, 0.25, 0.8]} tone="--story-metal" />
      <IsoBox at={[0, 13.2, 15.2]} size={[1.6, 0.25, 0.8]} tone="--story-metal" />
      <IsoBox at={[0, 6, 16]} size={[2.2, 8.5, 0.35]} tone="--story-desk" />
      {BOOKS.map(({ y: at, width, height, tone }) => (
        <IsoBox key={at} at={[0.25, at, 16.35]} size={[1.7, width, height]} tone={tone} />
      ))}
      <IsoBox at={[0.3, 9.6, 16.35]} size={[1.6, 2.2, 0.35]} tone="--story-book-c" />
      <IsoBox at={[0.35, 9.75, 16.7]} size={[1.4, 1.9, 0.3]} tone="--story-book-b" />
      <IsoCylinder at={[1.1, 12.6, 16.35]} radius={0.5} height={0.8} tone="--story-pot" />
      <IsoCylinder at={[1.1, 12.6, 17.15]} radius={0.38} height={0.5} tone="--story-plant" />
      <IsoBox at={[0.7, 13.6, 16.35]} size={[0.6, 0.5, 0.25]} tone="--story-metal" />
      <IsoCylinder at={[1, 13.85, 16.6]} radius={0.16} height={0.9} tone="--color-accent" />

      {/* карта города на стене: бумага, районы, булавки */}
      <IsoPlane facing="x" at={[0.03, 24, 19.8]}>
        <rect className={styles.paperShadow} x="0.15" y="0.15" width="8" height="6" />
        <rect className={styles.paper} width="8" height="6" />
        {outline && (
          <svg
            x="0.35"
            y="0.35"
            width="7.3"
            height="5.3"
            viewBox={outline.viewBox.join(' ')}
            preserveAspectRatio="xMidYMid meet"
          >
            {outline.districts.map((district) => (
              <path
                key={district.slug}
                d={district.d}
                className={styles.mapDistrict}
                style={{ '--fill': `var(--district-${district.palette})` }}
              />
            ))}
            {outline.pins.slice(0, 8).map((pin) => (
              <circle
                key={pin.id}
                className={styles.mapPin}
                cx={pin.x}
                cy={pin.y}
                r={outline.viewBox[2] * 0.012}
              />
            ))}
          </svg>
        )}
        {[0.4, 7.6].map((u) => (
          <circle key={u} className={styles.pushPin} cx={u} cy="0.35" r="0.16" />
        ))}
      </IsoPlane>

      {/* календарь: месяц, сетка дней, обведённый день */}
      <IsoPlane facing="x" at={[0.03, 27.6, 15.6]}>
        <rect className={styles.paper} width="3.2" height="4.2" />
        <rect className={styles.calendarHead} width="3.2" height="1" />
        <text className={styles.calendarMonth} x="1.6" y="0.68" textAnchor="middle">
          {story.month}
        </text>
        {Array.from({ length: 35 }, (_, k) => (
          <rect
            key={k}
            className={styles.calendarDay}
            x={0.22 + (k % 7) * 0.4}
            y={1.25 + Math.floor(k / 7) * 0.56}
            width="0.3"
            height="0.36"
          />
        ))}
        <circle className={styles.calendarMark} cx={0.37 + 4 * 0.4} cy={1.43 + 2 * 0.56} r="0.28" />
      </IsoPlane>

      {/* стикеры рядом с монитором */}
      <IsoPlane facing="x" at={[0.03, 20.2, 13.6]}>
        {STICKERS.map(([u, w, angle]) => (
          <g key={`${u}-${w}`} transform={`translate(${u} ${w}) rotate(${angle} 0.55 0.55)`}>
            <rect className={styles.sticker} width="1.1" height="1.1" />
            <path className={styles.scribble} d="M0.18 0.35h0.7M0.18 0.58h0.55M0.18 0.8h0.62" />
          </g>
        ))}
      </IsoPlane>
    </g>
  );
}
