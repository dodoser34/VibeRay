import { moodFill } from '@/features/map';
import { MOOD_PERIODS } from '@/shared/config/periods';
import { useCityOutline } from '@/shared/hooks/useCityOutline';
import styles from './StoryGuide.module.css';

const PINS = 36;
const FOCUS = 'center';
// Декоративная линия тренда для шага «статистика» (не настоящие данные). viewBox близок к реальным
// пропорциям графика, поэтому штрих не растянут, а появление пунктиром рисует одну непрерывную
// линию (non-scaling stroke разбил бы pathLength на куски).
const TREND = 'M4 60 C 36 54, 54 68, 90 50 S 144 32, 180 40 S 240 14, 296 11';

// Костанай в 2D (те же районы OSM, что на 3D-карте). `step` переключает, что показывает карта: 0 —
// районы, один выбран; 1 — цвета настроения; 2 — метки проблем; 3 — тренд поверх.
export function GuideMap({ city, moods, problems, step }) {
  const map = useCityOutline(city, problems, PINS);

  if (!map) return <div className={styles.mapFrame} aria-hidden="true" />;
  const [, , width] = map.viewBox;
  const pinR = width * 0.011;

  return (
    <div className={styles.mapFrame} data-step={step} aria-hidden="true">
      <svg className={styles.map} viewBox={map.viewBox.join(' ')}>
        {map.districts.map((district) => (
          <path
            key={district.slug}
            d={district.d}
            className={styles.district}
            data-focus={district.slug === FOCUS || undefined}
            style={{
              '--fill-district': `var(--district-${district.palette})`,
              '--fill-mood': moodFill(moods?.districts[district.slug]),
            }}
          />
        ))}
        {map.pins.map((pin, i) => (
          <g
            key={pin.id}
            className={styles.pin}
            transform={`translate(${pin.x} ${pin.y})`}
            style={{ '--pin': `var(${pin.colorVar})`, '--delay': `${i * 25}ms` }}
          >
            <g className={styles.pinBody}>
              <circle r={pinR * 2.6} className={styles.pinRing} />
              <line y1={0} y2={-pinR * 3} className={styles.pinStem} />
              <circle cy={-pinR * 3} r={pinR} className={styles.pinHead} />
            </g>
          </g>
        ))}
      </svg>

      <p className={styles.mapLabel}>
        <span className={styles.mapDot} />
        {map.districts.find((d) => d.slug === FOCUS)?.name}
      </p>

      <div className={styles.trend}>
        <div className={styles.trendTabs}>
          {MOOD_PERIODS.map((period, i) => (
            <span key={period.code} className={styles.trendTab} data-active={i === 1 || undefined}>
              {period.label}
            </span>
          ))}
        </div>
        <svg className={styles.trendChart} viewBox="0 0 300 72" preserveAspectRatio="none">
          <path d={TREND} className={styles.trendLine} pathLength="1" />
        </svg>
      </div>
    </div>
  );
}
