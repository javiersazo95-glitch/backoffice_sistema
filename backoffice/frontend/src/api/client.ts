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

/**
 * Resuelve una URL de imagen de perfil que puede ser relativa (/api/v1/...) o absoluta (https://...).
 * Las URLs relativas se preprenden con el host del backend configurado en VITE_API_URL.
 */
export const resolveProfileImageUrl = (url?: string | null): string | null => {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  // URL relativa: anteponer el origen del backend
  const apiBase = import.meta.env.VITE_API_URL?.replace(/\/+$/, '') ?? '';
  return apiBase ? `${apiBase}${url}` : url;
};

const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default apiClient;
