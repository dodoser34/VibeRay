// Подготовка районов города (cityGeometry.js) — в фоновом потоке, чтобы открытие карты не замирало;
// без поддержки воркеров (или если он упал) — тот же расчёт на месте. Возвращает плиты по slug.
export function prepareCity({ districts, center }) {
  const input = { districts, center };
  if (typeof Worker === 'undefined') return prepareHere(input);
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./cityGeometry.worker.js', import.meta.url), {
      type: 'module',
    });
    const finish = () => worker.terminate();
    worker.onmessage = ({ data }) => {
      finish();
      resolve(data);
    };
    worker.onerror = (event) => {
      event.preventDefault();
      finish();
      prepareHere(input).then(resolve, reject);
    };
    worker.postMessage(input);
  });
}

async function prepareHere(input) {
  const { buildCityGeometry } = await import('./cityGeometry');
  return buildCityGeometry(input);
}
