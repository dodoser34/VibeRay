import { C, iso, UNIT } from '../../lib/isometric';
import styles from './IsometricRoom.module.css';

// Вертикальный цилиндр (кружка, горшок, корзина, ножка лампы): окружность на полу в изометрии —
// эллипс с полуосями r·√2·C и в √3 раз меньше, поэтому цилиндр — бок с полукруглым низом и эллипс
// сверху. open — сверху видно нутро (кружка, корзина).
export function IsoCylinder({ at: [x, y, z], radius, height, tone, open = false, className }) {
  const [cx, bottom] = iso(x, y, z);
  const top = bottom - height * UNIT;
  const rx = radius * Math.SQRT2 * C;
  const ry = rx / Math.sqrt(3);
  const side = `M${cx - rx} ${top}V${bottom}A${rx} ${ry} 0 0 0 ${cx + rx} ${bottom}V${top}Z`;
  return (
    <g
      className={className ? `${styles.box} ${className}` : styles.box}
      style={{ '--tone': `var(${tone})` }}
    >
      <path className={styles.faceLeft} d={side} />
      <ellipse
        className={open ? styles.faceInner : styles.faceTop}
        cx={cx}
        cy={top}
        rx={rx}
        ry={ry}
      />
    </g>
  );
}
