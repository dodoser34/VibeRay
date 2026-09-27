import { request } from '../client';

export function getDistrictStats(districtId, period) {
  return request('GET', `/districts/${districtId}/stats`, { query: { period } });
}

export function postMood(districtId, mood) {
  return request('POST', `/districts/${districtId}/mood`, { body: { mood } });
}
