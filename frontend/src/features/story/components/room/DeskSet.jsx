import { iso, points } from '../../lib/isometric';
import { SCREEN } from '../../lib/roomLayout';
import { leafTuft } from '../../lib/roomShapes';
import { IsoBox } from './IsoBox';
import { IsoCylinder } from './IsoCylinder';
import { IsoPlane } from './IsoPlane';
import { MonitorScreen } from './MonitorScreen';
import styles from './IsometricRoom.module.css';

const TOP = 7.6;
// Ножки стола: задние (у тумбы) рисуются до тумбы и системного блока, передние — после, чтобы
// закрывать то, что стоит за ними.
const BACK_LEGS = [
  [0.3, 5.3],
  [6.2, 5.3],
];
const FRONT_LEGS = [
  [0.3, 20.2],
  [6.2, 20.2],
];
const PC_TOP = 4.75;
const PC_FEET = [
  [1.1, 15.6],
  [4.9, 15.6],
  [1.1, 17],
  [4.9, 17],
];
// Настольная лампа: основание, колено и плафон (точки мира).
const LAMP_BASE = [1.4, 19.6, 7.9];
const LAMP_ELBOW = [1.2, 20.3, 11.6];
const LAMP_HEAD = [3.3, 19.6, 12.9];
const KEY_ROWS = 4;
const KEYS_IN_ROW = 14;

// Ломаная из точек мира — для тонких деталей (ручка лампы, провод).
const line = (...corners) =>
  corners.map((corner, i) => `${i ? 'L' : 'M'}${iso(...corner).join(' ')}`).join('');

// Рабочее место у левой стены: стол с тумбой, системный блок со стеклом, монитор с живым экраном,
// клавиатура, мышь на коврике, лампа (ночью горит), стопка книг, кружка с паром, блокнот, телефон,
// суккулент, провод. Порядок отрисовки — от стены к зрителю.
export function DeskSet({ outline, mapBox }) {
  const [headX, headY] = iso(...LAMP_HEAD);
  const [elbowX, elbowY] = iso(...LAMP_ELBOW);
  return (
    <g>
      <polygon
        className={styles.floorShadow}
        points={points([0, 5, 0], [7.6, 5, 0], [7.6, 21.2, 0], [0, 21.2, 0])}
      />
      {BACK_LEGS.map(([x, y]) => (
        <IsoBox key={`${x}-${y}`} at={[x, y, 0]} size={[0.5, 0.5, 7.2]} tone="--story-metal" />
      ))}

      {/* тумба с ящиками */}
      <IsoBox at={[0.4, 5.6, 0]} size={[6, 4.2, 7.2]} tone="--story-desk" />
      <IsoPlane facing="x" at={[6.4, 9.8, 7]}>
        {[0.3, 2.6, 4.9].map((w) => (
          <g key={w}>
            <rect className={styles.drawer} x="0.3" y={w} width="3.6" height="2" rx="0.15" />
            <rect
              className={styles.drawerHandle}
              x="1.5"
              y={w + 0.4}
              width="1.2"
              height="0.22"
              rx="0.1"
            />
          </g>
        ))}
      </IsoPlane>

      {/* системный блок на полу под столом, за передними ножками: решётка сверху, сетчатая передняя
          панель с кнопкой и портами, за стеклом — плата, башня кулера, память, видеокарта, кожух
          блока питания и три вентилятора на вдув */}
      <path className={styles.cable} d={line([1.3, 16, PC_TOP], [1, 15, 6.4], [1.4, 14.6, TOP])} />
      {PC_FEET.map(([x, y]) => (
        <IsoBox key={`${x}-${y}`} at={[x, y, 0]} size={[0.4, 0.4, 0.15]} tone="--story-monitor" />
      ))}
      <IsoBox at={[0.9, 15.4, 0.15]} size={[4.6, 2.2, PC_TOP - 0.15]} tone="--story-pc-case" />
      <IsoPlane facing="z" at={[0.9, 15.4, PC_TOP]}>
        {[0.5, 0.8, 1.1, 1.4, 1.7].map((w) => (
          <path key={w} className={styles.vent} d={`M0.6 ${w}h3.4`} />
        ))}
      </IsoPlane>
      <IsoPlane facing="x" at={[5.5, 17.6, PC_TOP]}>
        <rect className={styles.pcPanel} x="0.15" y="0.15" width="1.9" height="4.3" rx="0.15" />
        {[0.45, 0.75, 1.05, 1.35, 1.65].map((u) => (
          <path key={u} className={styles.vent} d={`M${u} 1.3V4.2`} />
        ))}
        <circle className={styles.pcRing} cx="1.1" cy="0.5" r="0.24" />
        <circle className={styles.pcButton} cx="1.1" cy="0.5" r="0.12" />
        <rect className={styles.pcPort} x="0.4" y="0.85" width="0.32" height="0.14" rx="0.03" />
        <rect className={styles.pcPort} x="0.85" y="0.85" width="0.32" height="0.14" rx="0.03" />
        <circle className={styles.pcPort} cx="1.5" cy="0.92" r="0.08" />
      </IsoPlane>
      <IsoPlane facing="y" at={[0.9, 17.6, PC_TOP]}>
        <rect className={styles.pcGlass} x="0.2" y="0.2" width="4.2" height="4.2" rx="0.15" />
        <rect className={styles.pcBoard} x="0.45" y="0.4" width="2.6" height="2.7" rx="0.05" />
        <circle className={styles.fan} cx="1.4" cy="1.2" r="0.55" />
        <path className={styles.fanBlade} d="M1.4 0.75v0.9M0.95 1.2h0.9" />
        {[2.25, 2.4, 2.55, 2.7].map((u) => (
          <rect key={u} className={styles.pcRam} x={u} y="0.65" width="0.09" height="1.2" />
        ))}
        <rect className={styles.pcGpu} x="0.45" y="2.25" width="3" height="0.45" rx="0.06" />
        <rect className={styles.pcAccent} x="0.6" y="2.6" width="2.6" height="0.06" />
        <rect className={styles.pcShroud} x="0.3" y="3.3" width="4" height="0.95" rx="0.06" />
        <path className={styles.pcCable} d="M2.8 3.3q0.3-0.4 0.1-0.6M1 3.3q-0.2-0.5 0.2-0.6" />
        {[0.85, 1.85, 2.8].map((w) => (
          <g key={w}>
            <circle className={styles.fan} cx="3.85" cy={w} r="0.38" />
            <path className={styles.fanBlade} d={`M3.85 ${w - 0.3}v0.6M3.55 ${w}h0.6`} />
          </g>
        ))}
      </IsoPlane>
      {FRONT_LEGS.map(([x, y]) => (
        <IsoBox key={`${x}-${y}`} at={[x, y, 0]} size={[0.5, 0.5, 7.2]} tone="--story-metal" />
      ))}

      {/* столешница с текстурой дерева */}
      <IsoBox at={[0, 5, 7.2]} size={[7, 16, 0.4]} tone="--story-desk" />
      <IsoPlane facing="z" at={[0, 5, TOP]}>
        {[1.1, 2.6, 3.9, 5.5, 6.4].map((u) => (
          <path key={u} className={styles.grain} d={`M${u} 0.4q0.2 4 -0.1 8t0.15 7.2`} />
        ))}
      </IsoPlane>

      {/* стопка книг и суккулент у стены */}
      <IsoBox at={[0.6, 5.5, TOP]} size={[2.4, 2.1, 0.35]} tone="--story-book-a" />
      <IsoBox at={[0.7, 5.6, TOP + 0.35]} size={[2.2, 1.9, 0.3]} tone="--story-spine-titan" />
      <IsoBox at={[0.55, 5.55, TOP + 0.65]} size={[2.3, 2, 0.4]} tone="--story-book-b" />
      <IsoCylinder at={[1.3, 9.7, TOP]} radius={0.45} height={0.55} tone="--story-pot" />
      <path
        className={styles.leaf}
        d={leafTuft([1.3, 9.7, TOP + 0.55], 0.55, [-60, -30, 0, 30, 60])}
      />

      {/* монитор: подставка, стойка, корпус, экран */}
      <IsoBox at={[0.9, 13.1, TOP]} size={[1.8, 1.8, 0.15]} tone="--story-monitor" />
      <IsoBox at={[1.1, 13.75, TOP + 0.15]} size={[0.4, 0.5, 2.6]} tone="--story-monitor" />
      <IsoBox at={[1.4, 10.8, 9.6]} size={[0.6, 6.4, 3.8]} tone="--story-monitor" />
      <IsoPlane facing="x" at={SCREEN.corner} scale={SCREEN.scale} data-room="screen">
        <MonitorScreen outline={outline} mapBox={mapBox} />
      </IsoPlane>

      {/* лампа: основание, колено, плафон; ночью — пятно света на столе */}
      <IsoPlane facing="z" at={[2, 17.8, TOP + 0.01]}>
        <ellipse className={styles.lampPool} cx="1.7" cy="1.6" rx="1.7" ry="1.5" />
      </IsoPlane>
      <IsoCylinder at={[1.4, 19.6, TOP]} radius={0.7} height={0.3} tone="--story-metal" />
      <path className={styles.lampArm} d={line(LAMP_BASE, LAMP_ELBOW, LAMP_HEAD)} />
      <circle className={styles.lampJoint} cx={elbowX} cy={elbowY} r="3.2" />
      <g transform={`translate(${headX} ${headY}) rotate(-12)`}>
        <path className={styles.lampShade} d="M-5 -10h10l10 18h-30z" />
        <ellipse className={styles.lampRim} cx="0" cy="8" rx="15" ry="4.2" />
        <ellipse className={styles.lampBulb} cx="0" cy="7.4" rx="5" ry="2.2" />
        <circle className={styles.lampJoint} cx="0" cy="-10" r="3" />
      </g>

      {/* клавиатура с рядами клавиш, коврик и мышь */}
      <IsoBox at={[3.6, 11.8, TOP]} size={[1.5, 4.4, 0.2]} tone="--story-monitor" />
      <IsoPlane facing="z" at={[3.6, 11.8, TOP + 0.2]}>
        {Array.from({ length: KEY_ROWS }, (_, row) =>
          Array.from({ length: KEYS_IN_ROW }, (_, k) => (
            <rect
              key={`${row}-${k}`}
              className={styles.key}
              x={0.14 + row * 0.33}
              y={0.12 + k * 0.295}
              width="0.24"
              height="0.22"
              rx="0.04"
            />
          )),
        )}
      </IsoPlane>
      <IsoPlane facing="z" at={[3.3, 8.4, TOP + 0.01]}>
        <rect className={styles.mousePad} width="2.4" height="2.6" rx="0.3" />
      </IsoPlane>
      <IsoBox at={[4.1, 9.3, TOP]} size={[0.9, 0.55, 0.3]} tone="--story-monitor" />

      {/* блокнот на пружине под лампой, рядом — карандаш: заточенный грифель, жёлтый корпус,
          металлический ободок и ластик; телефон экраном вверх у края стола */}
      <IsoPlane facing="z" at={[3, 17.5, TOP + 0.02]}>
        <g transform="rotate(-6 0.9 1.25)">
          <rect
            className={styles.notebookShadow}
            x="0.08"
            y="0.1"
            width="1.8"
            height="2.5"
            rx="0.1"
          />
          <rect className={styles.notebook} width="1.8" height="2.5" rx="0.1" />
          {[0.6, 0.9, 1.2, 1.5, 1.8, 2.1].map((w) => (
            <path key={w} className={styles.ruled} d={`M0.25 ${w}h1.3`} />
          ))}
          {[0.25, 0.5, 0.75, 1.0, 1.25, 1.5].map((u) => (
            <circle key={u} className={styles.spiral} cx={u} cy="0.18" r="0.07" />
          ))}
        </g>
        <g transform="translate(2.25 0.2) rotate(-6)">
          <path className={styles.pencilWood} d="M0 0.5L0.09 0l0.09 0.5z" />
          <path className={styles.pencilLead} d="M0.055 0.18L0.09 0l0.035 0.18z" />
          <rect className={styles.pencilBody} y="0.5" width="0.18" height="1.7" />
          <path className={styles.pencilFacet} d="M0.09 0.5v1.7" />
          <rect className={styles.pencilFerrule} y="2.2" width="0.18" height="0.16" />
          <rect className={styles.pencilEraser} y="2.36" width="0.18" height="0.16" rx="0.05" />
        </g>
      </IsoPlane>
      <IsoBox at={[5.4, 14.6, TOP]} size={[1.3, 0.7, 0.08]} tone="--story-monitor" />
      <IsoPlane facing="z" at={[5.45, 14.65, TOP + 0.09]}>
        <rect className={styles.phoneScreen} width="1.2" height="0.6" rx="0.08" />
      </IsoPlane>

      {/* кружка с ручкой и паром */}
      <IsoCylinder at={[5.6, 7.3, TOP]} radius={0.38} height={0.9} tone="--story-paper" open />
      <path
        className={styles.mugHandle}
        d={line([5.75, 7.75, TOP + 0.75], [5.95, 8.05, TOP + 0.55], [5.75, 7.8, TOP + 0.25])}
      />
      <g className={styles.steam}>
        {[0, 1].map((k) => {
          const [x, y] = iso(5.6 - k * 0.15, 7.3 + k * 0.2, TOP + 1);
          return (
            <path
              key={k}
              d={`M${x} ${y}q-4 -8 0 -14t0 -14`}
              style={{ animationDelay: `${k * -1.6}s` }}
            />
          );
        })}
      </g>
    </g>
  );
}
