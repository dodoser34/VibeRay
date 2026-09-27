import { request } from '../client';

export function register({ email, password, nickname, avatarUrl, homeDistrict }) {
  return request('POST', '/auth/register', {
    body: { email, password, nickname, avatar_url: avatarUrl, home_district: homeDistrict },
  });
}

export function login({ email, password }) {
  return request('POST', '/auth/login', { body: { email, password } });
}

export function logout() {
  return request('POST', '/auth/logout');
}
