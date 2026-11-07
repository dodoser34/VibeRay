import { buildCityGeometry, plateBuffers } from './cityGeometry';

// Фоновый поток подготовки районов (prepareCity.js): сглаживание, плиты, точки подписей.
self.onmessage = ({ data }) => {
  const result = buildCityGeometry(data);
  self.postMessage(result, plateBuffers(result.plates));
};
