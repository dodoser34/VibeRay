import { useRef } from 'react';
import { useTheme } from '@/shared/hooks/useTheme';
import { useFitText } from '../../hooks/useFitText';
import { isDaylight } from '../../lib/chapters';
import { VIEW } from '../../lib/isometric';
import { Bookcase } from './Bookcase';
import { DeskChair } from './DeskChair';
import { DeskSet } from './DeskSet';
import { DeskWall } from './DeskWall';
import { FloorDecor } from './FloorDecor';
import { RoomShell } from './RoomShell';
import { WasteBasket } from './WasteBasket';
import { WindowWall } from './WindowWall';
import styles from './IsometricRoom.module.css';

// Начало истории на ПК: комната автора в изометрии — диорама «полу-3D» из SVG-граней. Июльская ночь
// в тёмной теме (горят лампа и окна домов, луна и звёзды), тот же день в светлой; цвета —
// токены --story-* темы. Камеру (наезд и разворот к монитору) ведёт RoomCamera по data-room,
// сюжет на экране монитора — screenTimeline по data-screen. Порядок частей — от стен к зрителю.
// mapBox — рамка карты на мониторе (км), совпадающая с первым кадром 3D-города.
export function IsometricRoom({ ref, outline, mapBox }) {
  useTheme();
  const svgRef = useRef(null);
  useFitText(svgRef);
  return (
    <div ref={ref} className={styles.root} data-room="root" aria-hidden="true">
      <div className={styles.tilt} data-room="tilt">
        <svg
          ref={svgRef}
          className={styles.svg}
          viewBox={`0 0 ${VIEW.width} ${VIEW.height}`}
          preserveAspectRatio="xMidYMid meet"
          data-room="svg"
        >
          <g data-room="camera">
            <RoomShell />
            <DeskWall outline={outline} />
            <WindowWall daylight={isDaylight()} />
            <Bookcase />
            <WasteBasket />
            <DeskSet outline={outline} mapBox={mapBox} />
            <DeskChair />
            <FloorDecor />
          </g>
        </svg>
      </div>
    </div>
  );
}
