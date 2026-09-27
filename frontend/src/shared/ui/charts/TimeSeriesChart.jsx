import { useId, useRef, useState } from 'react';
import { rootScale } from '@/adaptations/core';
import { gsap, useGSAP } from '@/shared/animations/gsapSetup';
import { useElementWidth } from '@/shared/hooks/useElementWidth';
import { curve, runs } from './curve';
import styles from './TimeSeriesChart.module.css';

const PAD = { top: 10, right: 4, bottom: 22, left: 30 };
const BAR_BAND = 30; // высота столбиков под линией
const BAR_GAP = 10;
const EDGE_TICK = 24; // подписи X у самого края прижимаются к нему, а не центрируются

// k: масштаб интерфейса (2K / 4K увеличивают корневой шрифт) — отступы растут вместе с текстом.
function layout(count, width, height, [min, max], k) {
  const plotLeft = PAD.left * k;
  const plotRight = width - PAD.right * k;
  const top = PAD.top * k;
  const band = (plotRight - plotLeft) / Math.max(1, count);
  const barBottom = height - PAD.bottom * k;
  const barBand = BAR_BAND * k;
  const lineBottom = barBottom - barBand - BAR_GAP * k;
  return {
    k,
    top,
    plotLeft,
    plotRight,
    band,
    barBand,
    lineBottom,
    barBottom,
    barWidth: Math.max(2, Math.min(12 * k, band * 0.56)),
    x: (i) => plotLeft + band * (i + 0.5),
    y: (value) => top + ((max - value) / (max - min)) * (lineBottom - top),
  };
}

function paths(values, geometry) {
  const segments = runs(values, geometry.x, geometry.y);
  return {
    line: segments.map(curve).join(''),
    area: segments
      .map(
        (points) =>
          `${curve(points)}L${points.at(-1)[0].toFixed(1)} ${geometry.lineBottom}` +
          `L${points[0][0].toFixed(1)} ${geometry.lineBottom}Z`,
      )
      .join(''),
  };
}

// Линия (например, настроение −2…+2) во времени с необязательными столбиками под ней (например,
// новые проблемы). Рисуется в реальном пиксельном размере блока (без растянутого viewBox),
// анимируется GSAP: линия прорисовывается, когда меняется набор точек, и перетекает, когда меняются
// только значения. Наведение, фокус и стрелки показывают подсказку для точки.
export function TimeSeriesChart({
  points,
  domain = [-2, 2],
  yTicks = [],
  formatTick,
  renderTooltip,
  label,
  height: baseHeight = 180,
}) {
  const rootRef = useRef(null);
  const lineRef = useRef(null);
  const areaRef = useRef(null);
  const barsRef = useRef(null);
  const drawnRef = useRef(null); // { count, values, key }, которые сейчас на экране
  const morphRef = useRef({ t: 0 });
  const gradientId = useId();
  const width = useElementWidth(rootRef);
  const k = rootScale();
  const height = Math.round(baseHeight * k);
  const [active, setActive] = useState(null);

  const values = points.map((point) => point.value);
  const bars = points.map((point) => point.bar ?? 0);
  const maxBar = Math.max(1, ...bars);
  const geometry = width ? layout(points.length, width, height, domain, k) : null;
  const dataKey = JSON.stringify([values, bars]);

  useGSAP(
    () => {
      if (!geometry) return;
      const line = lineRef.current;
      const area = areaRef.current;
      const rects = [...barsRef.current.children];
      const barTarget = (i) => {
        const h = (bars[i] / maxBar) * geometry.barBand;
        return { y: geometry.barBottom - h, height: h };
      };
      const setPaths = (next) => {
        const d = paths(next, geometry);
        line.setAttribute('d', d.line);
        area.setAttribute('d', d.area);
      };
      gsap.killTweensOf([line, area, morphRef.current, ...rects]);

      const drawn = drawnRef.current;
      drawnRef.current = { count: points.length, values, key: dataKey };
      if (drawn?.key === dataKey) {
        // Изменился только размер: перерисовываем на месте.
        setPaths(values);
        rects.forEach((rect, i) => gsap.set(rect, { attr: barTarget(i) }));
        return;
      }
      if (drawn?.count === points.length) {
        const proxy = { t: 0 };
        morphRef.current = proxy;
        gsap.to(proxy, {
          t: 1,
          duration: 0.8,
          ease: 'power3.inOut',
          onUpdate: () =>
            setPaths(
              values.map((to, i) => {
                const from = drawn.values[i];
                return from === null || to === null ? to : from + (to - from) * proxy.t;
              }),
            ),
        });
        rects.forEach((rect, i) =>
          gsap.to(rect, { attr: barTarget(i), duration: 0.8, ease: 'power3.inOut' }),
        );
        return;
      }
      setPaths(values);
      gsap.fromTo(line, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.2 });
      gsap.fromTo(area, { opacity: 0 }, { opacity: 1, duration: 0.9, delay: 0.25 });
      rects.forEach((rect, i) =>
        gsap.fromTo(
          rect,
          { attr: { y: geometry.barBottom, height: 0 } },
          {
            attr: barTarget(i),
            duration: 0.6,
            delay: 0.2 + (i / rects.length) * 0.5,
            ease: 'power3.out',
          },
        ),
      );
    },
    { dependencies: [dataKey, width, height], scope: rootRef },
  );

  const pickAt = (clientX) => {
    const box = rootRef.current.getBoundingClientRect();
    const i = Math.floor((clientX - box.left - geometry.plotLeft) / geometry.band);
    setActive(Math.min(points.length - 1, Math.max(0, i)));
  };

  const handleKey = (event) => {
    const moves = {
      ArrowLeft: (i) => i - 1,
      ArrowRight: (i) => i + 1,
      Home: () => 0,
      End: () => points.length - 1,
    };
    if (event.key === 'Escape') return setActive(null);
    if (!moves[event.key]) return undefined;
    event.preventDefault();
    const next = moves[event.key](active ?? points.length - 1);
    return setActive(Math.min(points.length - 1, Math.max(0, next)));
  };

  const shown = active !== null && active < points.length ? active : null;
  const activeX = shown !== null && geometry ? geometry.x(shown) : 0;
  const activeValue = shown !== null ? values[shown] : null;

  return (
    <div ref={rootRef} className={styles.root} style={{ height }}>
      {geometry && (
        <svg
          width={width}
          height={height}
          className={styles.svg}
          role="img"
          aria-label={label}
          tabIndex={0}
          onPointerMove={(event) => pickAt(event.clientX)}
          onPointerDown={(event) => pickAt(event.clientX)}
          onPointerLeave={() => setActive(null)}
          onFocus={(event) =>
            event.currentTarget.matches(':focus-visible') && setActive(points.length - 1)
          }
          onBlur={() => setActive(null)}
          onKeyDown={handleKey}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" className={styles.areaTop} />
              <stop offset="1" className={styles.areaBottom} />
            </linearGradient>
          </defs>

          {yTicks.map((tick) => (
            <g key={tick.value}>
              <line
                x1={geometry.plotLeft}
                x2={geometry.plotRight}
                y1={geometry.y(tick.value)}
                y2={geometry.y(tick.value)}
                className={tick.value === 0 ? styles.zero : styles.grid}
              />
              <text
                x={geometry.plotLeft - 8 * k}
                y={geometry.y(tick.value)}
                className={styles.yTick}
                textAnchor="end"
                dominantBaseline="middle"
              >
                {tick.label}
              </text>
            </g>
          ))}
          <line
            x1={geometry.plotLeft}
            x2={geometry.plotRight}
            y1={geometry.barBottom + 0.5}
            y2={geometry.barBottom + 0.5}
            className={styles.baseline}
          />

          <path ref={areaRef} fill={`url(#${gradientId})`} />
          <path ref={lineRef} className={styles.line} pathLength="1" strokeDasharray="1" />
          <g ref={barsRef}>
            {points.map((point, i) => (
              <rect
                key={i}
                x={geometry.x(i) - geometry.barWidth / 2}
                width={geometry.barWidth}
                rx={Math.min(2, geometry.barWidth / 2)}
                className={styles.bar}
                data-active={shown === i || undefined}
              />
            ))}
          </g>

          {points.map((point, i) => {
            const text = formatTick?.(i);
            if (!text) return null;
            const x = geometry.x(i);
            const anchor =
              x - geometry.plotLeft < EDGE_TICK * k
                ? 'start'
                : geometry.plotRight - x < EDGE_TICK * k
                  ? 'end'
                  : 'middle';
            return (
              <text
                key={i}
                x={anchor === 'start' ? x - 4 * k : anchor === 'end' ? x + 4 * k : x}
                y={height - 6 * k}
                className={styles.xTick}
                textAnchor={anchor}
              >
                {text}
              </text>
            );
          })}

          {shown !== null && (
            <g className={styles.cursor} style={{ transform: `translateX(${activeX}px)` }}>
              <line y1={geometry.top} y2={geometry.barBottom} className={styles.guide} />
              {activeValue !== null && (
                <circle
                  r={4.5 * k}
                  className={styles.dot}
                  style={{ transform: `translateY(${geometry.y(activeValue)}px)` }}
                />
              )}
            </g>
          )}
        </svg>
      )}

      {shown !== null && geometry && renderTooltip && (
        <div
          className={styles.tooltip}
          data-side={activeX < width / 2 ? 'right' : 'left'}
          style={{ '--x': `${activeX}px` }}
          role="status"
        >
          {renderTooltip(shown)}
        </div>
      )}
    </div>
  );
}
