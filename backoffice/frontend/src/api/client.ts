import axios from 'axios';
import type { AxiosInstance } from 'axios';

const normalizeApiBaseUrl = (baseUrl?: string) => {
  const trimmedBaseUrl = baseUrl?.replace(/\/+$/, '');

  if (!trimmedBaseUrl) {
    return '/api/v1';
  }

  return trimmedBaseUrl.endsWith('/api/v1')
    ? trimmedBaseUrl
    : `${trimmedBaseUrl}/api/v1`;
};

const API_BASE_URL = normalizeApiBaseUrl(import.meta.env.VITE_API_URL);

const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default apiClient;
