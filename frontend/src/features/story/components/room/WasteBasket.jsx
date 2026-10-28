import { iso } from '../../lib/isometric';
import { IsoCylinder } from './IsoCylinder';
import styles from './IsometricRoom.module.css';

// Скомканные листы, которые не долетели до корзины (x, y, радиус в пикселях рисунка). Все лежат
// перед корзиной или сбоку от неё — ни один не заходит за неё.
const PAPERS = [
  [7.4, 4, 6.5],
  [10.6, 5.8, 6],
  [11.2, 3.6, 5.5],
];

// Корзина у стола, полная скомканных листов, и листы рядом: так выглядят идеи, от которых
// отказались.
export function WasteBasket() {
  const [topX, topY] = iso(9.1, 3.5, 2.5);
  return (
    <g>
      <IsoCylinder at={[9.2, 3.6, 0]} radius={1} height={2.6} tone="--story-metal" open />
      <circle className={styles.paperBall} cx={topX} cy={topY} r="7" />
      <circle className={styles.paperBall} cx={topX + 9} cy={topY + 3} r="6" />
      {PAPERS.map(([x, y, r]) => {
        const [px, py] = iso(x, y, 0.25);
        return (
          <g key={`${x}-${y}`}>
            <circle className={styles.paperBall} cx={px} cy={py} r={r} />
            <path
              className={styles.crease}
              d={`M${px - r * 0.6} ${py - r * 0.15}q${r * 0.35} ${r * 0.45} ${r * 0.8} ${r * 0.1}M${px - r * 0.1} ${py - r * 0.6}q${r * 0.1} ${r * 0.4} ${r * 0.55} ${r * 0.55}`}
            />
          </g>
        );
      })}
    </g>
  );
}
