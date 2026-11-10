import { buildCityGeometry, plateBuffers } from './cityGeometry';

// Фоновый поток подготовки районов (prepareCity.js): плиты и точки подписей.
self.onmessage = ({ data }) => {
  const plates = buildCityGeometry(data);
  self.postMessage(plates, plateBuffers(plates));
};
