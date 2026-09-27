import { useRef, useState } from 'react';
import { rootScale } from '@/adaptations/core';
import { gsap, useGSAP } from '@/shared/animations/gsapSetup';
import { useElementWidth } from '@/shared/hooks/useElementWidth';
import { curve, runs } from './curve';
import styles from './CompareChart.module.css';

const PAD = { top: 10, right: 6, bottom: 22, left: 30 };
const EDGE_TICK = 24;

// Несколько линий на одной шкале (например, настроение двух районов). series: [{ key, values,
// colorVar }] одинаковой длины; null разрывает линию. При смене данных линии прорисовываются
// заново; наведение, фокус и стрелки показывают подсказку для точки — со значениями всех линий.
export function CompareChart({
  series,
  domain = [-2, 2],
  yTicks = [],
  formatTick,
  renderTooltip,
  label,
  height: baseHeight = 200,
}) {
  const rootRef = useRef(null);
  const width = useElementWidth(rootRef);
  const k = rootScale();
  const height = Math.round(baseHeight * k);
  const [active, setActive] = useState(null);
  const count = series[0]?.values.length ?? 0;
  const dataKey = JSON.stringify(series.map((line) => [line.key, line.values]));

  const geometry = width
    ? (() => {
        const plotLeft = PAD.left * k;
        const plotRight = width - PAD.right * k;
        const top = PAD.top * k;
        const bottom = height - PAD.bottom * k;
        const band = (plotRight - plotLeft) / Math.max(1, count);
        const [min, max] = domain;
        return {
          plotLeft,
          plotRight,
          top,
          bottom,
          band,
          x: (i) => plotLeft + band * (i + 0.5),
          y: (value) => top + ((max - value) / (max - min)) * (bottom - top),
        };
      })()
    : null;

  useGSAP(
    () => {
      if (!geometry) return;
      gsap.fromTo(
        '[data-line]',
        { strokeDashoffset: 1 },
        { strokeDashoffset: 0, duration: 1.2, stagger: 0.15, ease: 'power2.out' },
      );
    },
    { dependencies: [dataKey, Boolean(geometry)], scope: rootRef },
  );

  const pickAt = (clientX) => {
    const box = rootRef.current.getBoundingClientRect();
    const i = Math.floor((clientX - box.left - geometry.plotLeft) / geometry.band);
    setActive(Math.min(count - 1, Math.max(0, i)));
  };

  const handleKey = (event) => {
    const moves = { ArrowLeft: -1, ArrowRight: 1 };
    if (event.key === 'Escape') return setActive(null);
    if (!moves[event.key]) return undefined;
    event.preventDefault();
    return setActive(Math.min(count - 1, Math.max(0, (active ?? count - 1) + moves[event.key])));
  };

  const shown = active !== null && active < count ? active : null;
  const activeX = shown !== null && geometry ? geometry.x(shown) : 0;

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
          onFocus={(event) => event.currentTarget.matches(':focus-visible') && setActive(count - 1)}
          onBlur={() => setActive(null)}
          onKeyDown={handleKey}
        >
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
                className={styles.tick}
                textAnchor="end"
                dominantBaseline="middle"
              >
                {tick.label}
              </text>
            </g>
          ))}

          {series.map((line) => (
            <path
              key={line.key}
              d={runs(line.values, geometry.x, geometry.y).map(curve).join('')}
              className={styles.line}
              style={{ '--line': `var(${line.colorVar})` }}
              pathLength="1"
              strokeDasharray="1"
              data-line
            />
          ))}

          {Array.from({ length: count }, (_, i) => {
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
              <text key={i} x={x} y={height - 6 * k} className={styles.tick} textAnchor={anchor}>
                {text}
              </text>
            );
          })}

          {shown !== null && (
            <g>
              <line
                x1={activeX}
                x2={activeX}
                y1={geometry.top}
                y2={geometry.bottom}
                className={styles.guide}
              />
              {series.map((line) =>
                line.values[shown] === null ? null : (
                  <circle
                    key={line.key}
                    cx={activeX}
                    cy={geometry.y(line.values[shown])}
                    r={4.5 * k}
                    className={styles.dot}
                    style={{ '--line': `var(${line.colorVar})` }}
                  />
                ),
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
