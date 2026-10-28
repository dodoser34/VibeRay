import { iso } from '../../lib/isometric';
import { leafTuft } from '../../lib/roomShapes';
import { IsoCylinder } from './IsoCylinder';
import styles from './IsometricRoom.module.css';

const PLANT_ANGLES = [-75, -50, -28, -8, 14, 36, 58, 80];

// Мелочи на полу перед столом: кресло-мешок с книгой, спящий кот на ковре и большое растение в углу. Порядок — от стены к зрителю.
export function FloorDecor() {
  const [catX, catY] = iso(17.5, 18.5, 0.05);
  const [bagX, bagY] = iso(26, 21, 0);
  return (
    <g>
      {/* кресло-мешок: мягкий купол с вмятиной сиденья и швами, на нём раскрытая книга */}
      <g transform={`translate(${bagX} ${bagY})`}>
        <ellipse className={styles.floorShadow} cx="4" cy="6" rx="84" ry="34" />
        <path
          className={styles.beanbag}
          d="M-72 0c-6-30 10-62 40-76 30-14 64-6 84 14 20 20 26 44 18 62-10 18-46 30-74 28-34-2-62-10-68-28z"
        />
        <path
          className={styles.beanbagSide}
          d="M-72 0c6 18 34 26 68 28 28 2 64-10 74-28 2 8 0 16-6 22-14 14-42 22-70 20-32-2-60-12-66-26z"
        />
        <ellipse className={styles.beanbagSeat} cx="-2" cy="-34" rx="40" ry="18" />
        <path
          className={styles.beanbagFold}
          d="M-50 -40q14-26 44-34M18 -70q22 10 30 34M-34 2q30 10 62 0"
        />
        <path className={styles.openBook} d="M-22 -40l20-6 20 8-20 8z" />
        <path className={styles.bookSpine} d="M-2 -46v16" />
      </g>

      {/* кот спит клубком: тело, голова, уши, хвост; дышит (CSS) */}
      <g transform={`translate(${catX} ${catY})`}>
        <ellipse className={styles.floorShadow} cx="2" cy="4" rx="40" ry="14" />
        <g className={styles.catBody}>
          <ellipse className={styles.catFur} cx="0" cy="-8" rx="32" ry="17" />
          <path className={styles.catTail} d="M26 -6c14 4 15 16 2 19-10 2.4-24 1-34-2" />
          <circle className={styles.catFur} cx="-24" cy="-12" r="11" />
          <path className={styles.catFur} d="M-33 -18l-2 -10 8 5zM-21 -21l4 -9 3 9z" />
          <path className={styles.catStripe} d="M-2 -22q4 6 0 12M8 -21q4 6 0 12M18 -17q3 5 0 10" />
          <path className={styles.catEye} d="M-30 -11q2 1.6 4 0M-22 -11q2 1.6 4 0" />
        </g>
      </g>

      {/* монстера в углу у стола */}
      <IsoCylinder at={[3, 25.6, 0]} radius={1.3} height={2.6} tone="--story-pot" />
      <path
        className={styles.leafDark}
        d={leafTuft([3, 25.6, 2.6], 5.2, PLANT_ANGLES.slice(0, 4))}
      />
      <path className={styles.leaf} d={leafTuft([3, 25.6, 2.6], 4.6, PLANT_ANGLES.slice(3))} />
    </g>
  );
}
