import { useMemo } from 'react';
import { colorForAggregate } from '@/features/map';
import { MOOD_PERIODS } from '@/shared/config/periods';
import { STATUS_BY_CODE } from '@/shared/config/problemStatuses';
import { createProjection } from '@/shared/lib/geoProjection';
import styles from './StoryGuide.module.css';

const PADDING_KM = 0.6;
const PINS = 36;
const FOCUS = 'center';
// Декоративная линия тренда для шага «статистика» (не настоящие данные). viewBox близок к реальным
// пропорциям графика, поэтому штрих не растянут, а появление пунктиром рисует одну непрерывную
// линию (non-scaling stroke разбил бы pathLength на куски).
const TREND = 'M4 60 C 36 54, 54 68, 90 50 S 144 32, 180 40 S 240 14, 296 11';

// Костанай в 2D (те же районы OSM, что на 3D-карте). `step` переключает, что показывает карта: 0 —
// районы, один выбран; 1 — цвета настроения; 2 — метки проблем; 3 — тренд поверх.
export function GuideMap({ city, moods, problems, step }) {
  const map = useMemo(() => {
    if (!city) return null;
    const project = createProjection(city.center);
    const toSvg = (lonlat) => {
      const [x, y] = project(lonlat);
      return [x, -y];
    };
    const xs = [];
    const ys = [];
    const districts = city.districts.features.map(({ properties, geometry }) => {
      const d = geometry.coordinates
        .flatMap((polygon) =>
          polygon.map((ring) => {
            const points = ring.map((c) => {
              const [x, y] = toSvg(c);
              xs.push(x);
              ys.push(y);
              return `${x.toFixed(3)} ${y.toFixed(3)}`;
            });
            return `M${points.join('L')}Z`;
          }),
        )
        .join('');
      return { slug: properties.slug, name: properties.name, palette: properties.palette, d };
    });
    const minX = Math.min(...xs) - PADDING_KM;
    const minY = Math.min(...ys) - PADDING_KM;
    const viewBox = [
      minX,
      minY,
      Math.max(...xs) - minX + PADDING_KM,
      Math.max(...ys) - minY + PADDING_KM,
    ];
    const pins = (problems ?? []).slice(0, PINS).map((problem, i) => {
      const [x, y] = toSvg(problem.location);
      return { id: problem.id ?? i, x, y, colorVar: STATUS_BY_CODE[problem.status].colorVar };
    });
    return { districts, viewBox, pins };
  }, [city, problems]);

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
              '--fill-mood': colorForAggregate(moods?.districts[district.slug]).getStyle(),
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
