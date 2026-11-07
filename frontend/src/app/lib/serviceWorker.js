// Сервис-воркер (public/sw.js) кэширует плитки карты: повторное открытие города берёт их с диска.
// Только в собранном сайте: в разработке кэш мешал бы видеть свежие плитки.
export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  const base = import.meta.env.BASE_URL;
  navigator.serviceWorker.register(`${base}sw.js`, { scope: base }).catch((error) => {
    console.warn('Service worker is not registered', error);
  });
}
