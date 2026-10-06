import { request } from '../client';

export function getProblems({ city, district, category, status } = {}) {
  return request('GET', '/problems', { query: { city, district, category, status } });
}

// Полная карточка: история статусов, а для вошедшего — is_mine и confirmed_by_me.
export function getProblem(problemId) {
  return request('GET', `/problems/${problemId}`);
}

export function confirmProblem(problemId) {
  return request('POST', `/problems/${problemId}/confirm`);
}

// Multipart: поля + до 3 фото (уже перекодированы на клиенте без EXIF). isAnonymous — не показывать
// жителям ник и аватар автора (модератор его видит).
export function createProblem({
  category,
  location,
  description,
  photos = [],
  isAnonymous = false,
}) {
  const form = new FormData();
  form.append('category', category);
  form.append('is_anonymous', String(isAnonymous));
  form.append('lon', String(location[0]));
  form.append('lat', String(location[1]));
  form.append('description', description);
  photos.forEach((photo, i) => form.append('photos', photo, `photo-${i + 1}.jpg`));
  return request('POST', '/problems', { body: form });
}
