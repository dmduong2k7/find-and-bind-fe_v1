import * as api from "@/shared/helper/callApi";
import * as contentType from "@/shared/helper/base-header-content-type";
import controllerName from "@/shared/helper/controllerName";
import * as DTO from "@/services/authentication/authType";

export const authService = {
  /** POST /api/Authetication/login */
  login: async (data: DTO.LoginDto) => {
    const res = await api.postApi<DTO.TokenResponseDto>(`${controllerName.Authentication}/login`, { data });
    api.setTokensAfterLogin(res.data.accessToken, res.data.refreshToken);
    return res;
  },

  /** POST /api/Authetication/register */
  register: async (data: DTO.RegisterRequestDto) => {
    const res = await api.postApi<DTO.TokenResponseDto>(`${controllerName.Authentication}/register`, { data });
    api.setTokensAfterLogin(res.data.accessToken, res.data.refreshToken);
    return res;
  },

  /** POST /api/Authetication/refresh-token (interceptor đã tự gọi khi 401; dùng tay khi cần) */
  refreshToken: async (refreshToken: string) => {
    const body: DTO.RefreshTokenRequestDto = { refreshToken };
    const res = await api.postApi<DTO.TokenResponseDto>(`${controllerName.Authentication}/refresh-token`, {
      data: body,
    });
    api.setTokensAfterLogin(res.data.accessToken, res.data.refreshToken);
    return res;
  },

  /** POST /api/Authetication/logout — luôn xoá token local dù API lỗi */
  logout: async () => {
    try {
      return await api.postApi<boolean>(`${controllerName.Authentication}/logout`, { requiresAuth: true });
    } finally {
      api.clearAuthTokens();
    }
  },

  /** POST /api/Authetication/forgot-password */
  forgotPassword: (email: string) =>
    api.postApi<boolean>(`${controllerName.Authentication}/forgot-password`, { data: { email } }),
};