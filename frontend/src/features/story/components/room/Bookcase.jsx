import { leafTuft } from '../../lib/roomShapes';
import { IsoBox } from './IsoBox';
import { IsoCylinder } from './IsoCylinder';
import { IsoPlane } from './IsoPlane';
import styles from './IsometricRoom.module.css';

const SHELVES = [0.4, 4.2, 8, 11.8, 15.6];
const SHELF_HEIGHT = 3.4;
const BOOK_TONES = [
  '--story-book-a',
  '--story-spine-titan',
  '--story-book-b',
  '--story-book-c',
  '--story-spine-king',
];

// Корешки на полке: псевдослучайные толщина и высота, местами пустое место или коробка.
function shelfBooks(shelf) {
  const books = [];
  let u = 0.35;
  for (let k = 0; u < 4.6; k += 1) {
    const seed = (shelf * 13 + k * 7) % 11;
    const width = 0.24 + (seed % 4) * 0.07;
    if (seed === 5) {
      books.push({ u, width: 1.1, height: 1.4, tone: '--story-pot', box: true });
      u += 1.25;
    } else {
      books.push({ u, width, height: 2.2 + (seed % 5) * 0.22, tone: BOOK_TONES[seed % 5] });
      u += width + 0.03;
    }
  }
  return books.filter((book) => book.u + book.width < 5.05);
}

// Книжный шкаф в дальнем углу: полки с корешками, коробка и цветок наверху.
export function Bookcase() {
  return (
    <g>
      <IsoBox at={[28.6, 0.1, 0]} size={[5.4, 3.1, 19.5]} tone="--story-desk" />
      <IsoPlane facing="y" at={[28.6, 3.2, 19.5]}>
        {SHELVES.map((top, shelf) => (
          <g key={top}>
            <rect
              className={styles.shelfInside}
              x="0.3"
              y={top}
              width="4.8"
              height={SHELF_HEIGHT}
            />
            <rect className={styles.shelfShade} x="0.3" y={top} width="4.8" height="0.5" />
            {shelfBooks(shelf).map(({ u, width, height, tone, box }) => (
              <rect
                key={u}
                className={box ? styles.storageBox : styles.spine}
                x={u}
                y={top + SHELF_HEIGHT - height}
                width={width}
                height={height}
                style={{ '--tone': `var(${tone})` }}
              />
            ))}
          </g>
        ))}
      </IsoPlane>
      <IsoBox at={[29.2, 0.5, 19.5]} size={[1.8, 1.8, 1.2]} tone="--story-paper" />
      <IsoCylinder at={[32.4, 1.6, 19.5]} radius={0.55} height={0.8} tone="--story-pot" />
      <path
        className={styles.leaf}
        d={leafTuft([32.4, 1.6, 20.3], 1.3, [-70, -40, -10, 25, 60, 95])}
      />
    </g>
  );
}
