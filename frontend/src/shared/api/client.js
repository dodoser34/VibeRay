import { getLanguage } from '@/shared/lib/language';
import common from '@/texts/ru/common.json';

// Демо-режим (по умолчанию, в том числе на GitHub Pages): запросы обслуживает фейковый API из
// src/demo-data/api — бэкенд не нужен. С бэкендом: VITE_USE_MOCKS=false в frontend/.env, запросы идут на
// /api/v1.
export const USE_MOCKS = import.meta.env.VITE_USE_MOCKS !== 'false';
const API_PREFIX = '/api/v1';

let accessToken = null;

export function setAccessToken(token) {
  accessToken = token;
}

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function request(method, path, { body, query } = {}) {
  if (USE_MOCKS) {
    const { handleMock } = await import('@/demo-data/api/handler.js');
    return handleMock(method, path, { body, query, token: accessToken, language: getLanguage() });
  }

  const url = new URL(API_PREFIX + path, window.location.origin);
  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null) url.searchParams.set(key, value);
  });

  const isForm = body instanceof FormData;
  const response = await fetch(url, {
    method,
    credentials: 'include',
    headers: {
      'Accept-Language': getLanguage(),
      ...(body && !isForm ? { 'Content-Type': 'application/json' } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new ApiError(
      response.status,
      data.detail?.code ?? 'unknown',
      data.detail?.message ?? common.serverUnavailable,
    );
  }
  return response.status === 204 ? null : response.json();
}
