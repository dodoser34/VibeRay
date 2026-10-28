import { boxFaces } from '../../lib/isometric';
import styles from './IsometricRoom.module.css';

// Коробка в изометрии: верх светлее, грани темнее (тон смешивается с --story-shade в CSS). tone —
// токен цвета, например '--story-desk'.
export function IsoBox({ at, size, tone, className, ...rest }) {
  const faces = boxFaces(at, size);
  return (
    <g
      className={className ? `${styles.box} ${className}` : styles.box}
      style={{ '--tone': `var(${tone})` }}
      {...rest}
    >
      <polygon className={styles.faceLeft} points={faces.left} />
      <polygon className={styles.faceRight} points={faces.right} />
      <polygon className={styles.faceTop} points={faces.top} />
    </g>
  );
}
