import { useMemo } from 'react';
import { STATUS_BY_CODE } from '@/shared/config/problemStatuses';
import { createProjection } from '@/shared/lib/geo/geoProjection';

const PADDING_KM = 0.6;

// Город в 2D для SVG: контуры районов (те же районы OSM, что на 3D-карте), рамка viewBox (км) и
// метки проблем (первые `pinLimit`). Общая основа плоских карт: гид «Как это работает», карта на
// стене и на экранах в истории «О проекте». extent — привести размах районов к этому числу единиц
// (scale — во сколько раз; история приводит к нему и 3D-город): города разного размера
// рисуются одинаково крупно, толщины и радиусы в единицах viewBox подходят всем.
export function useCityOutline(city, problems, { pinLimit = 36, extent = null } = {}) {
  return useMemo(() => {
    if (!city) return null;
    const project = createProjection(city.center);
    const scale = extent ? extent / cityExtent(city, project) : 1;
    const toSvg = (lonlat) => {
      const [x, y] = project(lonlat);
      return [x * scale, -y * scale];
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
    return { districts, viewBox, pins, scale };
  }, [city, problems, pinLimit, extent]);
}

// Размах районов (км): большая из сторон их рамки.
function cityExtent(city, project) {
  const points = city.districts.features.flatMap(({ geometry }) =>
    geometry.coordinates.flatMap(([outer]) => outer.map(project)),
  );
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  return Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
}
