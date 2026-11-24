import { request } from '../client';

// homeCity обязателен, homeDistrict — район этого города или null.
export function register({ email, password, nickname, avatarUrl, homeCity, homeDistrict }) {
  return request('POST', '/auth/register', {
    body: {
      email,
      password,
      nickname,
      avatar_url: avatarUrl,
      home_city: homeCity,
      home_district: homeDistrict,
    },
  });
}

export function login({ email, password }) {
  return request('POST', '/auth/login', { body: { email, password } });
}

export function logout() {
  return request('POST', '/auth/logout');
}
