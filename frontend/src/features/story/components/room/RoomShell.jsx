import { points, ROOM } from '../../lib/isometric';
import { WINDOW } from '../../lib/roomLayout';
import { IsoBox } from './IsoBox';
import { IsoPlane } from './IsoPlane';
import styles from './IsometricRoom.module.css';

// Куда падает свет из окна: в комнату (+y), вниз и чуть к столу.
const LIGHT = { dx: -0.35, dz: 0.75 };
const PLANK = 2.2;
// Орнамент каймы ковра: ромбики по периметру (в единицах рисунка ковра 15 × 13).
const RUG_BORDER = [
  ...Array.from({ length: 11 }, (_, k) => [1.75 + k * 1.15, 0.65]),
  ...Array.from({ length: 11 }, (_, k) => [1.75 + k * 1.15, 12.35]),
  ...Array.from({ length: 9 }, (_, k) => [0.65, 1.8 + k * 1.18]),
  ...Array.from({ length: 9 }, (_, k) => [14.35, 1.8 + k * 1.18]),
];

// Ромб с центром (u, w) и полуосями a, b.
const rhombus = (u, w, a, b) => `M${u} ${w - b}L${u + a} ${w}L${u} ${w + b}L${u - a} ${w}Z`;

// Точка окна (x, 0, z) вдоль луча света до пола.
function onFloor(x, z) {
  const t = z / LIGHT.dz;
  return [x + LIGHT.dx * t, t, 0];
}

// Четыре стекла окна (рама делит его крестом) — четыре пятна света на полу.
const PANES = [
  [WINDOW.x0 + 0.3, 18.8, WINDOW.z0 + 6.2, WINDOW.z1 - 0.3],
  [19.2, WINDOW.x1 - 0.3, WINDOW.z0 + 6.2, WINDOW.z1 - 0.3],
  [WINDOW.x0 + 0.3, 18.8, WINDOW.z0 + 0.3, WINDOW.z0 + 5.8],
  [19.2, WINDOW.x1 - 0.3, WINDOW.z0 + 0.3, WINDOW.z0 + 5.8],
];

// Коробка комнаты-диорамы: две стены с толщиной (видны срезы), пол-плита с паркетом, плинтусы,
// пятно света из окна и ковёр.
export function RoomShell() {
  const { x: X, y: Y, z: Z } = ROOM;
  return (
    <g>
      <IsoBox at={[-1, -1, -1.5]} size={[X + 1, 1, Z + 1.5]} tone="--story-wall" />
      <IsoBox at={[-1, 0, -1.5]} size={[1, Y, Z + 1.5]} tone="--story-wall" />
      <IsoBox at={[0, 0, -1.5]} size={[X, Y, 1.5]} tone="--story-floor" />

      <IsoPlane facing="z" at={[0, 0, 0]}>
        {Array.from({ length: Math.floor(Y / PLANK) }, (_, row) => {
          const w = (row + 1) * PLANK;
          const shift = (row % 3) * 3.4;
          return (
            <g key={row} className={styles.plank}>
              <path d={`M0 ${w}H${X}`} />
              {[0, 1, 2, 3].map((k) => {
                const u = shift + 2 + k * 8.5;
                return u < X && <path key={k} d={`M${u} ${w - PLANK}V${w}`} />;
              })}
            </g>
          );
        })}
      </IsoPlane>

      <IsoBox at={[0, 0, 0]} size={[X, 0.25, 0.8]} tone="--story-paper" />
      <IsoBox at={[0, 0.25, 0]} size={[0.25, Y - 0.25, 0.8]} tone="--story-paper" />

      <g className={styles.windowLight}>
        {PANES.map(([x0, x1, z0, z1]) => (
          <polygon
            key={`${x0}-${z0}`}
            points={points(onFloor(x0, z0), onFloor(x1, z0), onFloor(x1, z1), onFloor(x0, z1))}
          />
        ))}
      </g>

      {/* Ковёр: кайма с мелким орнаментом, поле, медальон в центре, бахрома по коротким краям */}
      <IsoPlane facing="z" at={[9.5, 9, 0.05]}>
        <rect className={styles.rug} width="15" height="13" rx="0.6" />
        <rect className={styles.rugField} x="1.3" y="1.3" width="12.4" height="10.4" rx="0.3" />
        {RUG_BORDER.map(([u, w]) => (
          <path key={`${u}-${w}`} className={styles.rugOrnament} d={rhombus(u, w, 0.28, 0.28)} />
        ))}
        <path className={styles.rugMedallion} d={rhombus(7.5, 6.5, 3.6, 3)} />
        <path className={styles.rugField} d={rhombus(7.5, 6.5, 2.4, 2)} />
        <path className={styles.rugMedallion} d={rhombus(7.5, 6.5, 1, 0.85)} />
        {[2.2, 12.8].map((u) => (
          <path key={u} className={styles.rugOrnament} d={rhombus(u, 6.5, 0.5, 1.4)} />
        ))}
        {Array.from({ length: 13 }, (_, k) => (
          <path
            key={k}
            className={styles.rugFringe}
            d={`M${1.1 + k * 1.07} 13v0.5M${1.1 + k * 1.07} 0v-0.5`}
          />
        ))}
      </IsoPlane>
    </g>
  );
}
