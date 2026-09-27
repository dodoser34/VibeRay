import { request } from '../client';

// Multipart: тема, email для связи, сообщение и до 3 файлов (изображения уже перекодированы на
// клиенте без EXIF). Работает без аккаунта — пишут и те, кто не может войти.
export function createSupportRequest({ topic, email, message, files = [] }) {
  const form = new FormData();
  form.append('topic', topic);
  form.append('email', email);
  form.append('message', message);
  files.forEach((file) => form.append('files', file, file.name));
  return request('POST', '/support/requests', { body: form });
}

export function getServiceStatus() {
  return request('GET', '/status');
}
