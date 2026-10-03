import { useMemo } from 'react';
import { STATUS_BY_CODE } from '@/shared/config/problemStatuses';
import { createProjection } from '@/shared/lib/geoProjection';

const PADDING_KM = 0.6;

// Костанай в 2D для SVG: контуры районов (те же районы OSM, что на 3D-карте), рамка viewBox (км) и
// метки проблем (первые `pinLimit`). Общая основа плоских карт: гид и лёгкая история «О проекте»,
// лёгкая версия героя главной.
export function useCityOutline(city, problems, pinLimit = 36) {
  return useMemo(() => {
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
    const pins = (problems ?? []).slice(0, pinLimit).map((problem, i) => {
      const [x, y] = toSvg(problem.location);
      return { id: problem.id ?? i, x, y, colorVar: STATUS_BY_CODE[problem.status].colorVar };
    });
    return { districts, viewBox, pins };
  }, [city, problems, pinLimit]);
}
