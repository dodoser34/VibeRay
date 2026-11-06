import { smoothBoundaries } from '@/shared/lib/geo/smoothBoundaries';
import { request } from '../client';

// Контуры районов приходят обведёнными с растра; здесь они один раз сглаживаются для всех видов
// (кроме берегов — они совпадают с водой).
export function getCity(slug) {
  return request('GET', `/cities/${slug}`).then((city) => ({
    ...city,
    districts: smoothBoundaries(city.districts, { water: city.water }),
  }));
}

// PNG-плитки дорог и воды (карта города и история «О проекте») — статика сайта (frontend/public/maps,
// backend/scripts/build_map_tiles.py), одна и та же и в демо-режиме, и с бэкендом.
const MAPS_URL = `${import.meta.env.BASE_URL}maps`;

export async function getMapTiles(slug) {
  const response = await fetch(`${MAPS_URL}/${slug}/tiles.json`);
  if (!response.ok) throw new Error(`map tiles: ${response.status}`);
  return response.json();
}

export const mapTileUrl = (slug, level, x, y) => `${MAPS_URL}/${slug}/${level}/${x}_${y}.png`;

export function getCities() {
  return request('GET', '/cities');
}

export function getCityMoods(slug, period) {
  return request('GET', `/cities/${slug}/moods`, { query: { period } });
}

export function getCityStats(slug, period) {
  return request('GET', `/cities/${slug}/stats`, { query: { period } });
}
