import apiClient from './client';
import type { AuthResponse } from '@/types/auth';
import type { LoginRequest, RefreshTokenRequest } from '@/types/auth';
import type { UserSummaryResponse } from '@/types/auth';

export async function login(data: LoginRequest): Promise<AuthResponse> {
  const response = await apiClient.post<AuthResponse>('/auth/login', data);
  return response.data;
}

export async function loginGoogle(idToken: string): Promise<AuthResponse> {
  const response = await apiClient.post<AuthResponse>('/auth/google', { idToken });
  return response.data;
}

export async function refresh(data: RefreshTokenRequest): Promise<AuthResponse> {
  const response = await apiClient.post<AuthResponse>('/auth/refresh', data);
  return response.data;
}

/**
 * Cierra la sesion en el servidor, que revoca el token.
 *
 * Va sin cuerpo: el backend identifica la sesion por el Bearer de la cabecera. Antes esta
 * funcion declaraba un parametro refreshToken que no existia --el login de backoffice devuelve
 * {token, usuario}, sin refresh token-- y que el servidor tampoco usa.
 */
export async function logout(): Promise<void> {
  await apiClient.post('/auth/logout');
}

export async function getCurrentUser(): Promise<UserSummaryResponse> {
  const response = await apiClient.get<UserSummaryResponse>('/auth/me');
  return response.data;
}