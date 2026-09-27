import { request } from '../client';

export function getProblems({ city, district, category, status } = {}) {
  return request('GET', '/problems', { query: { city, district, category, status } });
}

export function confirmProblem(problemId) {
  return request('POST', `/problems/${problemId}/confirm`);
}

// Multipart: поля + до 3 фото (уже перекодированы на клиенте без EXIF).
export function createProblem({ category, location, description, photos = [] }) {
  const form = new FormData();
  form.append('category', category);
  form.append('lon', String(location[0]));
  form.append('lat', String(location[1]));
  form.append('description', description);
  photos.forEach((photo, i) => form.append('photos', photo, `photo-${i + 1}.jpg`));
  return request('POST', '/problems', { body: form });
}
