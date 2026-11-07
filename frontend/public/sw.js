// Сервис-воркер VibeRay: кэш плиток карты (maps/<город>/…: картинки и векторные куски дорог).
// Плитки не меняются, пока их не пересобрали (backend/scripts/build_map_tiles.py), поэтому
// берутся с диска (cache-first). Манифест города tiles.json — сначала из сети: в нём version, и кэш
// города называется по ней — после пересборки плиток старый кэш удаляется целиком.

const PREFIX = 'viberay-maps-';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const match = new URL(request.url).pathname.match(/\/maps\/([\w-]+)\/(.+)$/);
  if (!match) return;
  const [, city, file] = match;
  event.respondWith(file === 'tiles.json' ? manifest(request, city) : tile(request, city));
});

async function manifest(request, city) {
  try {
    const response = await fetch(request);
    if (!response.ok) return response;
    const { version } = await response.clone().json();
    const name = `${PREFIX}${city}-${version}`;
    const names = await caches.keys();
    await Promise.all(
      names
        .filter((key) => key.startsWith(`${PREFIX}${city}-`) && key !== name)
        .map((key) => caches.delete(key)),
    );
    await (await caches.open(name)).put(request, response.clone());
    return response;
  } catch {
    return (await caches.match(request)) ?? Response.error();
  }
}

async function tile(request, city) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const name = (await caches.keys()).find((key) => key.startsWith(`${PREFIX}${city}-`));
    if (name) await (await caches.open(name)).put(request, response.clone());
  }
  return response;
}
