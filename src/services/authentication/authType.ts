export interface LoginDto {
  email: string;
  password: string;
}

export interface RegisterRequestDto {
  email: string;
  password: string;
}

export interface TokenResponseDto {
  accessToken: string;
  refreshToken: string;
  userId?: string;
}

export interface RefreshTokenRequestDto {
  refreshToken: string;
}