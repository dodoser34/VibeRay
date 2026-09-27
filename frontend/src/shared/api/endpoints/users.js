import { request } from '../client';

// Любое поле можно не передавать: меняется только то, что пришло. avatarUrl — только пресет
// («preset:N»); своё фото загружается через uploadAvatar.
export function updateProfile({ nickname, avatarUrl, homeDistrict }) {
  return request('PATCH', '/users/me', {
    body: { nickname, avatar_url: avatarUrl, home_district: homeDistrict },
  });
}

// Фото уже перекодировано на клиенте без EXIF (shared/lib/imageTools.js).
export function uploadAvatar(photo) {
  const form = new FormData();
  form.append('avatar', photo, 'avatar.jpg');
  return request('PUT', '/users/me/avatar', { body: form });
}

export function changePassword({ currentPassword, newPassword }) {
  return request('POST', '/users/me/password', {
    body: { current_password: currentPassword, new_password: newPassword },
  });
}

export function deleteAccount({ password }) {
  return request('DELETE', '/users/me', { body: { password } });
}
