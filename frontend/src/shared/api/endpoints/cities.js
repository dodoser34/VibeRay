import { prepareCity } from '@/shared/lib/geo/prepareCity';
import { request } from '../client';

// Контуры районов приходят обведёнными с растра; здесь они один раз сглаживаются для всех видов
// (кроме берегов — они совпадают с водой), а плиты районов и точки подписей готовятся заранее
// (plates, по slug) — всё в фоновом потоке.
export async function getCity(slug) {
  const city = await request('GET', `/cities/${slug}`);
  const { districts, plates } = await prepareCity(city);
  return { ...city, districts, plates };
}

// Плитки дорог и воды (карта города и история «О проекте») и векторные куски дорог (карта вблизи) —
// статика сайта (frontend/public/maps, backend/scripts/build_map_tiles.py), одна и та же и в
// демо-режиме, и с бэкендом.
const MAPS_URL = `${import.meta.env.BASE_URL}maps`;
const manifests = new Map(); // манифест города читают и плитки, и векторный слой — запрос один

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`map data: ${response.status} ${url}`);
  return response.json();
}

export function getMapTiles(slug) {
  if (!manifests.has(slug)) {
    const loading = getJson(`${MAPS_URL}/${slug}/tiles.json`);
    loading.catch(() => manifests.delete(slug));
    manifests.set(slug, loading);
  }
  return manifests.get(slug);
}

export const mapTileUrl = (slug, level, x, y, format) =>
  `${MAPS_URL}/${slug}/${level}/${x}_${y}.${format}`;

export const getMapVector = (slug, x, y) => getJson(`${MAPS_URL}/${slug}/vector/${x}_${y}.json`);

export function getCities() {
  return request('GET', '/cities');
}

export function getCityMoods(slug, period) {
  return request('GET', `/cities/${slug}/moods`, { query: { period } });
}

export function getCityStats(slug, period) {
  return request('GET', `/cities/${slug}/stats`, { query: { period } });
}
