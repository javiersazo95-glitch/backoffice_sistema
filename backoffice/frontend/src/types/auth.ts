export enum Role {
  ADMIN = 'ADMIN',
  OPERATOR = 'OPERATOR',
}

export interface UserSummaryResponse {
  id: number;
  username: string;
  fullName: string;
  initials: string;
  role: Role;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  user: UserSummaryResponse;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}