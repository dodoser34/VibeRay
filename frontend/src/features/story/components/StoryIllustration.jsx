import { useId, useLayoutEffect, useRef } from 'react';
import { moodFill } from '@/features/map';
import about from '@/texts/ru/about.json';
import { useCityOutline } from '@/shared/hooks/useCityOutline';
import { useLanguage } from '@/shared/hooks/useLanguage';
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
// Иконки дока на мониторе — те же цвета, что у дока в 3D-комнате (ScreenTexture).
const DOCK = [
  '--color-accent',
  '--color-river',
  '--mood-normal',
  '--mood-bad',
  '--district-8',
  '--district-9',
];
// Ширина строки вопроса в окне редактора на мониторе (окно — 240, по 10 с краёв).
const QUESTION_WIDTH = 220;
const SPINES = ['titan', 'titan', 'titan', 'titan', 'titan', 'titan', 'king', 'king', 'king'];

// Лёгкая версия истории «О проекте» (слабое устройство, медленная сеть): плоская иллюстрация той же
// комнаты и 2D-карта Костаная вместо WebGL. Цвета — токены --story-* темы, поэтому день и ночь
// меняются вместе с темой без перерисовки. Анимирует LiteStage (scene/LiteStage.js) по data-lite.
export function StoryIllustration({ ref, city, moods, problems }) {
  const language = useLanguage();
  const questionRef = useRef(null);

  // Вопрос на экране не шире окна редактора на любом языке: шрифт уменьшается под ширину. Меряем
  // после загрузки шрифта и заново при смене языка.
  useLayoutEffect(() => {
    const text = questionRef.current;
    if (!text) return undefined;
    let alive = true;
    const fit = () => {
      if (!alive) return;
      text.style.fontSize = '';
      const width = text.getComputedTextLength();
      if (width > QUESTION_WIDTH) {
        const size = parseFloat(getComputedStyle(text).fontSize);
        text.style.fontSize = `${(size * QUESTION_WIDTH) / width}px`;
      }
    };
    fit();
    document.fonts?.ready.then(fit);
    return () => {
      alive = false;
    };
  }, [language]);

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
          {/* Шторы подхвачены у подоконника: не свисают за монитор и стол */}
          {[800, 1410].map((x) => (
            <g key={x}>
              <path className={styles.curtain} d={`M${x} 120h70v300l-14 72h-42l-14-72z`} />
              <rect className={styles.tieback} x={x - 2} y="404" width="74" height="9" rx="4" />
            </g>
          ))}
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
          {/* Рабочий стол, как на мониторе 3D-комнаты: папки, окно редактора, док */}
          {[0, 1, 2, 3].map((k) => (
            <g key={k} transform={`translate(626 ${372 + k * 34})`}>
              <rect className={styles.folder} y="3" width="24" height="17" rx="2" />
              <rect className={styles.folder} width="10" height="5" rx="1.5" />
            </g>
          ))}
          <rect className={styles.editor} x="660" y="374" width="240" height="114" rx="6" />
          <rect className={styles.editorBar} x="660" y="374" width="240" height="14" rx="6" />
          {['--mood-angry', '--mood-normal', '--mood-excellent'].map((token, k) => (
            <circle
              key={token}
              cx={671 + k * 10}
              cy="381"
              r="3"
              style={{ fill: `var(${token})` }}
            />
          ))}
          <g data-lite="question">
            <text ref={questionRef} className={styles.question} x="780" y="438" textAnchor="middle">
              {about.screen.question}
            </text>
          </g>
          <rect className={styles.editor} x="702" y="504" width="156" height="20" rx="8" />
          {DOCK.map((token, k) => (
            <rect
              key={token}
              x={708 + k * 25}
              y="506"
              width="16"
              height="16"
              rx="4"
              style={{ fill: `var(${token})` }}
            />
          ))}
          <rect className={styles.monitor} x="768" y="545" width="24" height="17" />
          <rect className={styles.monitor} x="730" y="562" width="100" height="8" rx="3" />
          <rect className={styles.keyboard} x="560" y="562" width="150" height="8" rx="3" />
          <rect className={styles.keyboard} x="846" y="562" width="22" height="8" rx="4" />

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

          {/* Офисное кресло спинкой к зрителю, перед левой частью стола: стойка кресла стоит ровно
              перед левой ножкой стола и закрывает её. */}
          <g transform="translate(28 0)">
            <path className={styles.chairLeg} d="M250 800h160l-12 12h-136z" />
            {[258, 296, 364, 402].map((x) => (
              <circle key={x} className={styles.wheel} cx={x} cy="816" r="9" />
            ))}
            <rect className={styles.chairLeg} x="322" y="680" width="16" height="122" rx="4" />
            <rect className={styles.chairLeg} x="318" y="640" width="24" height="40" rx="4" />
            <rect className={styles.chair} x="238" y="662" width="184" height="34" rx="14" />
            <rect className={styles.chairLeg} x="236" y="616" width="12" height="52" rx="4" />
            <rect className={styles.chairLeg} x="412" y="616" width="12" height="52" rx="4" />
            <rect className={styles.chairArm} x="226" y="608" width="36" height="12" rx="6" />
            <rect className={styles.chairArm} x="398" y="608" width="36" height="12" rx="6" />
            <rect className={styles.chair} x="254" y="468" width="152" height="182" rx="28" />
            <rect className={styles.chairPanel} x="274" y="490" width="112" height="134" rx="18" />
          </g>
        </g>
      </svg>

      {outline && (
        <svg
          className={styles.layer}
          data-lite="map"
          data-ui="story-lite-map"
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
