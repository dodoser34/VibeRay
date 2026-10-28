import { useId } from 'react';
import { iso, points } from '../../lib/isometric';
import { WINDOW } from '../../lib/roomLayout';
import { leafTuft } from '../../lib/roomShapes';
import { IsoBox } from './IsoBox';
import { IsoCylinder } from './IsoCylinder';
import { IsoPlane } from './IsoPlane';
import { StreetView } from './StreetView';
import styles from './IsometricRoom.module.css';

const { x0, x1, z0, z1 } = WINDOW;
// Рама и стёкла окна (в единицах мира от левого верхнего угла проёма): створки делит крест.
const FRAME =
  'M0 0h12v10.5H0z M0.3 0.3v4h5.5v-4z M6.2 0.3v4h5.5v-4z M0.3 4.7v5.5h5.5V4.7z M6.2 4.7v5.5h5.5V4.7z';
const GLASS = [
  [0.3, 0.3],
  [6.2, 0.3],
  [0.3, 4.7],
  [6.2, 4.7],
];

// Правая стена: окно с улицей (проём с откосами, рама, подоконник с цветами), батарея, шторы на
// карнизе, постер и часы.
export function WindowWall({ daylight }) {
  const clip = `${useId()}-opening`;
  // Часы показывают время истории: 22:00 ночью, 14:00 днём.
  const hour = daylight ? 60 : -60;
  return (
    <g>
      <defs>
        <clipPath id={clip}>
          <polygon points={points([x0, 0, z0], [x1, 0, z0], [x1, 0, z1], [x0, 0, z1])} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <IsoPlane facing="y" at={[x0 - 1.4, -1, z1 - 0.6]} scale={0.1}>
          <StreetView />
        </IsoPlane>
        <polygon
          className={styles.reveal}
          points={points([x0, 0, z0], [x0, -1, z0], [x0, -1, z1], [x0, 0, z1])}
        />
        <polygon
          className={styles.revealSill}
          points={points([x0, 0, z0], [x1, 0, z0], [x1, -1, z0], [x0, -1, z0])}
        />
        <IsoPlane facing="y" at={[x0, -0.5, z1]}>
          {GLASS.map(([u, w]) => (
            <g key={`${u}-${w}`}>
              <rect className={styles.glass} x={u} y={w} width="5.5" height={w < 1 ? 4 : 5.5} />
            </g>
          ))}
          <path className={styles.frame} fillRule="evenodd" d={FRAME} />
          <rect className={styles.handle} x="5.65" y="5.6" width="0.25" height="1.2" rx="0.1" />
        </IsoPlane>
      </g>

      <IsoBox at={[x0 - 0.6, 0, z0 - 0.4]} size={[x1 - x0 + 1.2, 1.3, 0.4]} tone="--story-paper" />
      <IsoCylinder at={[15, 0.65, z0]} radius={0.45} height={0.7} tone="--story-pot" />
      <path className={styles.leaf} d={leafTuft([15, 0.65, z0 + 0.7], 1.1)} />
      <IsoCylinder at={[23.2, 0.65, z0]} radius={0.35} height={0.55} tone="--story-pot" />
      <IsoCylinder at={[23.2, 0.65, z0 + 0.55]} radius={0.22} height={1.3} tone="--story-plant" />

      {/* батарея под окном: секции — вертикальные рёбра */}
      <IsoBox at={[14, 0.15, 1.4]} size={[10, 0.75, 4.8]} tone="--story-paper" />
      <IsoPlane facing="y" at={[14, 0.9, 6.2]}>
        {Array.from({ length: 16 }, (_, k) => (
          <path key={k} className={styles.fin} d={`M${0.6 + k * 0.6} 0.3V4.5`} />
        ))}
      </IsoPlane>

      {/* постер с горами и часы */}
      <IsoPlane facing="y" at={[1.2, 0.02, 17.5]}>
        <rect className={styles.posterFrame} width="5" height="6.2" />
        <rect className={styles.posterArt} x="0.35" y="0.35" width="4.3" height="5.5" />
        <circle className={styles.posterSun} cx="3.3" cy="1.8" r="0.7" />
        <path
          className={styles.posterHill}
          d="M0.35 4.6l1.2-1.9 0.9 1.1 1.1-1.8 1.1 2.3v1.55H0.35z"
        />
        <path className={styles.posterHillNear} d="M0.35 5.3q2.1-1.2 4.3-0.2v0.75H0.35z" />
      </IsoPlane>
      <IsoPlane facing="y" at={[6.6, 0.02, 17.2]}>
        <circle className={styles.clockRim} cx="1.2" cy="1.2" r="1.2" />
        <circle className={styles.clockFace} cx="1.2" cy="1.2" r="1" />
        {Array.from({ length: 12 }, (_, k) => (
          <path
            key={k}
            className={styles.clockTick}
            d="M1.2 0.3v0.18"
            transform={`rotate(${k * 30} 1.2 1.2)`}
          />
        ))}
        <path
          className={styles.clockHand}
          d="M1.2 1.2V0.65"
          transform={`rotate(${hour} 1.2 1.2)`}
        />
        <path className={styles.clockHand} d="M1.2 1.2V0.4" />
      </IsoPlane>

      {/* шторы на карнизе: складки — полосы тени */}
      <IsoBox at={[10.5, 0.9, 20.5]} size={[17, 0.2, 0.2]} tone="--story-metal" />
      {[10.4, 27.6].map((x) => {
        const [fx, fy] = iso(x, 1, 20.6);
        return <circle key={x} className={styles.finial} cx={fx} cy={fy} r="3.4" />;
      })}
      {[10.4, 24.6].map((x) => (
        <IsoPlane key={x} facing="y" at={[x, 1.1, 20.4]}>
          <path className={styles.curtain} d="M0 0h3v17.6q-0.75 0.5-1.5 0t-1.5 0z" />
          {[0.5, 1.2, 1.9, 2.5].map((u) => (
            <path key={u} className={styles.fold} d={`M${u} 0.2V17.4`} />
          ))}
        </IsoPlane>
      ))}
    </g>
  );
}
