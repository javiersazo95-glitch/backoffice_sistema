import apiClient from './client';
import type { AuthResponse } from '@/types/auth';
import type { LoginRequest, RefreshTokenRequest } from '@/types/auth';
import type { UserSummaryResponse } from '@/types/auth';

export async function login(data: LoginRequest): Promise<AuthResponse> {
  const response = await apiClient.post<AuthResponse>('/auth/login', data);
  return response.data;
}

export async function refresh(data: RefreshTokenRequest): Promise<AuthResponse> {
  const response = await apiClient.post<AuthResponse>('/auth/refresh', data);
  return response.data;
}

export async function logout(refreshToken: string): Promise<void> {
  await apiClient.post('/auth/logout', { refreshToken });
}

export async function getCurrentUser(): Promise<UserSummaryResponse> {
  const response = await apiClient.get<UserSummaryResponse>('/auth/me');
  return response.data;
}