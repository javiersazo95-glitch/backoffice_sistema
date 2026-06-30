import axios from 'axios';
import type { AxiosInstance } from 'axios';

export const normalizeApiBaseUrl = (baseUrl?: string) => {
  const trimmedBaseUrl = baseUrl?.replace(/\/+$/, '');

  if (!trimmedBaseUrl) {
    return '/api/v1';
  }

  return trimmedBaseUrl.endsWith('/api/v1')
    ? trimmedBaseUrl
    : `${trimmedBaseUrl}/api/v1`;
};

export const API_BASE_URL = normalizeApiBaseUrl(import.meta.env.VITE_API_URL);

const getApiOrigin = () => {
  const configuredBase = import.meta.env.VITE_API_URL?.trim().replace(/\/+$/, '') ?? '';
  return configuredBase.replace(/\/api\/v1$/i, '').replace(/\/api$/i, '');
};

export const resolveProfileImageUrl = (...candidates: Array<string | null | undefined>): string | null => {
  const rawUrl = candidates.find((candidate) => typeof candidate === 'string' && candidate.trim().length > 0)?.trim();
  if (!rawUrl) return null;
  if (/^https?:\/\//i.test(rawUrl)) return rawUrl;
  if (/^(data|blob):/i.test(rawUrl)) return rawUrl;
  if (rawUrl.startsWith('//')) return `https:${rawUrl}`;

  const apiOrigin = getApiOrigin();
  if (!apiOrigin) return rawUrl;

  if (rawUrl.startsWith('/')) return `${apiOrigin}${rawUrl}`;
  if (rawUrl.startsWith('api/')) return `${apiOrigin}/${rawUrl}`;
  if (rawUrl.startsWith('uploads/')) return `${apiOrigin}/api/v1/${rawUrl}`;

  return `${apiOrigin}/api/v1/uploads/r2/${rawUrl.replace(/^\/+/, '')}`;
};

const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default apiClient;
