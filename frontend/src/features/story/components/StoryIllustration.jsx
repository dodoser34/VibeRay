import { useId } from 'react';
import { moodFill } from '@/features/map';
import about from '@/texts/ru/about.json';
import { useCityOutline } from '@/shared/hooks/useCityOutline';
import styles from './StoryIllustration.module.css';

// Дома за окном: x, ширина, высота (в координатах окна), оттенок фасада.
const HOUSES = [
  [0, 120, 150, 'a'],
  [130, 90, 205, 'b'],
  [232, 140, 130, 'c'],
  [384, 110, 180, 'a'],
  [500, 70, 140, 'b'],
];
const TREES = [40, 150, 270, 360, 470, 540];
const SPINES = ['titan', 'titan', 'titan', 'titan', 'titan', 'titan', 'king', 'king', 'king'];

// Лёгкая версия истории «О проекте» (слабое устройство, медленная сеть): плоская иллюстрация той же
// комнаты и 2D-карта Костаная вместо WebGL. Цвета — токены --story-* темы, поэтому день и ночь
// меняются вместе с темой без перерисовки. Анимирует LiteStage (scene/LiteStage.js) по data-lite.
export function StoryIllustration({ ref, city, moods, problems }) {
  const id = useId();
  const outline = useCityOutline(city, problems);
  const sky = `${id}-sky`;
  const glass = `${id}-glass`;

  return (
    <div ref={ref} className={styles.root} data-story="canvas" aria-hidden="true">
      <svg
        className={styles.layer}
        data-lite="room"
        viewBox="0 0 1600 900"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <linearGradient id={sky} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" className={styles.skyTop} />
            <stop offset="1" className={styles.skyLow} />
          </linearGradient>
          <clipPath id={glass}>
            <rect x="880" y="160" width="520" height="290" />
          </clipPath>
        </defs>
        <g data-lite="zoom">
          <rect className={styles.wall} width="1600" height="900" />
          <rect className={styles.floor} y="720" width="1600" height="180" />
          <rect className={styles.baseboard} y="712" width="1600" height="10" />

          {/* окно с улицей */}
          <g clipPath={`url(#${glass})`}>
            <rect x="880" y="160" width="520" height="290" fill={`url(#${sky})`} />
            <circle className={styles.celestial} cx="1320" cy="215" r="22" />
            {[0, 1, 2, 3, 4, 5, 6, 7].map((k) => (
              <circle
                key={k}
                className={styles.star}
                cx={900 + k * 61}
                cy={180 + ((k * 37) % 70)}
                r="1.6"
              />
            ))}
            <rect className={styles.skyline} x="880" y="300" width="520" height="150" />
            {HOUSES.map(([x, w, h, tone]) => (
              <g key={x} transform={`translate(${880 + x} ${450 - h})`}>
                <rect className={styles[`house-${tone}`]} width={w} height={h} />
                {Array.from({ length: Math.floor((h - 20) / 26) }, (_, row) =>
                  Array.from({ length: Math.floor((w - 12) / 22) }, (_, col) => (
                    <rect
                      key={`${row}-${col}`}
                      className={(row * 3 + col * 5 + x) % 4 === 0 ? styles.lit : styles.pane}
                      x={10 + col * 22}
                      y={12 + row * 26}
                      width="10"
                      height="13"
                    />
                  )),
                )}
              </g>
            ))}
            {TREES.map((x) => (
              <g key={x}>
                <rect className={styles.trunk} x={880 + x - 2} y="415" width="5" height="35" />
                <circle className={styles.crown} cx={880 + x} cy="410" r="20" />
              </g>
            ))}
          </g>
          <path
            className={styles.frame}
            fillRule="evenodd"
            d="M866 146h548v318H866zM880 160v290h253V160zm267 0v290h253V160z"
          />
          <rect className={styles.frame} x="880" y="296" width="520" height="12" />
          <rect className={styles.sill} x="850" y="464" width="580" height="16" />
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((k) => (
            <rect
              key={k}
              className={styles.radiator}
              x={960 + k * 30}
              y="540"
              width="20"
              height="130"
              rx="6"
            />
          ))}
          <rect className={styles.curtain} x="800" y="120" width="70" height="590" />
          <rect className={styles.curtain} x="1410" y="120" width="70" height="590" />
          <rect className={styles.rod} x="780" y="112" width="720" height="8" rx="4" />

          {/* полка с книгами и карта на стене */}
          <rect className={styles.shelf} x="150" y="250" width="330" height="12" />
          {SPINES.map((kind, k) => (
            <rect
              key={k}
              className={styles[`spine-${kind}`]}
              x={165 + k * 22 + (kind === 'king' ? 8 : 0)}
              y={kind === 'king' ? 172 : 180}
              width="18"
              height={kind === 'king' ? 78 : 70}
            />
          ))}
          <rect className={styles.paper} x="190" y="320" width="230" height="160" />
          <path
            className={styles.mapLines}
            d="M205 340l200 120M205 400l120 70M260 330l150 90M215 455l90-110M300 470l100-140"
          />

          {/* стол, монитор, лампа, вещи */}
          <rect className={styles.desk} x="330" y="570" width="900" height="26" rx="4" />
          <rect className={styles.deskLeg} x="350" y="596" width="16" height="190" />
          <rect className={styles.deskLeg} x="1196" y="596" width="16" height="190" />
          <rect className={styles.pedestal} x="380" y="596" width="190" height="170" />
          <rect className={styles.drawer} x="395" y="616" width="160" height="60" rx="4" />
          <rect className={styles.drawer} x="395" y="690" width="160" height="60" rx="4" />

          <rect className={styles.monitor} x="600" y="330" width="360" height="215" rx="10" />
          <rect className={styles.screen} x="614" y="344" width="332" height="187" rx="4" />
          <rect className={styles.screenBar} x="614" y="344" width="332" height="16" />
          <g data-lite="question">
            <text className={styles.question} x="780" y="445" textAnchor="middle">
              {about.screen.question}
            </text>
          </g>
          <rect className={styles.monitor} x="765" y="545" width="30" height="20" />
          <rect className={styles.monitor} x="720" y="562" width="120" height="8" rx="3" />
          <rect className={styles.keyboard} x="650" y="548" width="160" height="16" rx="4" />
          <rect className={styles.keyboard} x="840" y="552" width="26" height="12" rx="6" />

          <path className={styles.lampLight} d="M470 330 L390 570 L600 570 Z" />
          <path className={styles.lampArm} d="M455 565 L430 420 L480 330" />
          <path className={styles.lampShade} d="M455 312 l60 18 -24 32 -48 -16z" />
          <rect className={styles.lampArm} x="425" y="560" width="60" height="10" rx="4" />

          <rect className={styles.mug} x="520" y="532" width="34" height="38" rx="6" />
          <rect className={styles.phone} x="1010" y="560" width="70" height="10" rx="3" />
          <path className={styles.pot} d="M1100 520h70l-10 50h-50z" />
          <path
            className={styles.leaf}
            d="M1135 520c-30-60-10-110 0-140 10 30 30 80 0 140zm0 0c40-40 70-60 90-60-20 30-50 60-90 60zm0 0c-40-30-70-40-90-40 20 25 50 40 90 40z"
          />

          {/* системный блок под столом */}
          <rect className={styles.pc} x="1010" y="610" width="150" height="160" rx="6" />
          <rect className={styles.pcGlass} x="1022" y="624" width="96" height="132" rx="3" />
          <rect className={styles.pcAccent} x="1140" y="625" width="5" height="130" />
          <circle className={styles.pcAccent} cx="1060" cy="660" r="12" />
          <rect className={styles.pcAccent} x="1030" y="700" width="80" height="6" />

          {/* кресло */}
          <path className={styles.chair} d="M205 500h105l-10 130h-85z" />
          <rect className={styles.chair} x="180" y="610" width="170" height="40" rx="12" />
          <rect className={styles.chairLeg} x="258" y="650" width="14" height="90" />
          <path className={styles.chairLeg} d="M190 760h150l-10 14h-130z" />
        </g>
      </svg>

      {outline && (
        <svg
          className={styles.layer}
          data-lite="map"
          viewBox={outline.viewBox.join(' ')}
          preserveAspectRatio="xMidYMid meet"
        >
          {outline.districts.map((district) => (
            <path
              key={district.slug}
              d={district.d}
              className={styles.district}
              data-lite="district"
              style={{
                '--fill-district': `var(--district-${district.palette})`,
                '--fill-mood': moodFill(moods?.districts[district.slug]),
              }}
            />
          ))}
          {outline.pins.map((pin) => (
            <g key={pin.id} transform={`translate(${pin.x} ${pin.y})`}>
              <circle
                className={styles.pin}
                data-lite="pin"
                r={outline.viewBox[2] * 0.009}
                style={{ '--pin': `var(${pin.colorVar})` }}
              />
            </g>
          ))}
        </svg>
      )}
    </div>
  );
}
