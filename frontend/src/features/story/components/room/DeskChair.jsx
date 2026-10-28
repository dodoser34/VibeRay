import { iso } from '../../lib/isometric';
import { IsoBox } from './IsoBox';
import { IsoCylinder } from './IsoCylinder';
import { IsoPlane } from './IsoPlane';
import styles from './IsometricRoom.module.css';

const CENTER = [11.6, 13.5];
const BASE_Z = 0.6;
// Пять лучей крестовины с колёсиками, отсортированы по глубине: дальние (к стене) рисуются первыми.
const LEGS = [18, 90, 162, 234, 306]
  .map((degrees) => (degrees * Math.PI) / 180)
  .sort((a, b) => Math.cos(a) + Math.sin(a) - (Math.cos(b) + Math.sin(b)));
const REACH = 2.3;

// Офисное кресло спинкой к зрителю, развёрнутое к монитору: крестовина на колёсиках, газлифт,
// сиденье, подлокотники и спинка с мягкой вставкой.
export function DeskChair() {
  const [cx, cy] = CENTER;
  const [shadowX, shadowY] = iso(cx, cy, 0);
  return (
    <g>
      <ellipse className={styles.floorShadow} cx={shadowX} cy={shadowY} rx="66" ry="30" />
      {LEGS.map((angle) => {
        const end = [cx + Math.cos(angle) * REACH, cy + Math.sin(angle) * REACH];
        const [tx, ty] = iso(end[0], end[1], 0.6);
        const [wx, wy] = iso(end[0], end[1], 0.2);
        // Ролик висит под концом луча: сначала колесо, над ним ножка, поверх — сам луч.
        return (
          <g key={angle}>
            <ellipse className={styles.caster} cx={wx} cy={wy} rx="4.6" ry="3.4" />
            <ellipse className={styles.casterHub} cx={wx} cy={wy - 0.6} rx="1.6" ry="1.1" />
            <path className={styles.casterStem} d={`M${tx} ${ty}V${wy - 1.5}`} />
            <path
              className={styles.chairLeg}
              d={`M${iso(cx, cy, BASE_Z + 0.1).join(' ')}L${tx} ${ty}`}
            />
          </g>
        );
      })}
      <IsoCylinder at={[cx, cy, BASE_Z - 0.15]} radius={0.5} height={0.3} tone="--story-metal" />
      <IsoCylinder at={[cx, cy, BASE_Z]} radius={0.22} height={3.6} tone="--story-metal" />

      <IsoBox at={[11.5, 11.25, 4.6]} size={[0.25, 0.25, 1.5]} tone="--story-metal" />
      <IsoBox at={[10.3, 11.1, 6.1]} size={[2.6, 0.55, 0.28]} tone="--story-fabric" />
      <IsoBox at={[9.6, 11.5, 4]} size={[4, 4, 0.6]} tone="--story-fabric" />
      <IsoBox at={[9.8, 11.7, 4.6]} size={[3.6, 3.6, 0.25]} tone="--story-fabric" />
      <IsoBox at={[13.15, 13.3, 4.6]} size={[0.3, 0.4, 0.9]} tone="--story-metal" />
      <IsoBox at={[13.1, 11.9, 5.4]} size={[0.45, 3.2, 5]} tone="--story-fabric" />
      <IsoPlane facing="x" at={[13.55, 14.95, 10.2]}>
        <rect className={styles.chairPanel} x="0.35" y="0.4" width="2.5" height="4.1" rx="0.8" />
        <path className={styles.stitch} d="M1.6 0.8V4.1" />
      </IsoPlane>
      <IsoBox at={[11.5, 15.5, 4.6]} size={[0.25, 0.25, 1.5]} tone="--story-metal" />
      <IsoBox at={[10.3, 15.35, 6.1]} size={[2.6, 0.55, 0.28]} tone="--story-fabric" />
    </g>
  );
}
