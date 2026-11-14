import axios, {
  AxiosError,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";
import controllerName from "@/shared/helper/controllerName";
import Cookies from "js-cookie";

/**
 * ============================================================
 *  AXIOS CONFIG AUGMENTATION
 * ============================================================
 */
declare module "axios" {
  export interface AxiosRequestConfig {
    /** Đánh dấu request cần Bearer token */
    requiresAuth?: boolean;
    /** Cho phép tự động điều hướng khi gặp 401 / 403 */
    isRedirect?: boolean;
    /** Cờ nội bộ, đánh dấu request đã được retry sau refresh token */
    _retry?: boolean;
  }
}

const getBaseUrl = (): string => {
  const envUrl = (import.meta.env.VITE_BASE_URL as string) || "";
  const isCapacitor =
    typeof window !== "undefined" &&
    (window.location.protocol === "capacitor:" ||
      (window as any).Capacitor?.isNativePlatform?.() ||
      (window.location.hostname === "localhost" && window.location.port === ""));

  if (isCapacitor || (envUrl.startsWith("/") && import.meta.env.PROD)) {
    const cleanPath = envUrl.startsWith("/") ? envUrl : "/" + envUrl;
    return `https://find-and-bind-be.onrender.com${cleanPath.endsWith("/") ? cleanPath : cleanPath + "/"}`;
  }
  return envUrl || "https://find-and-bind-be.onrender.com/api/";
};

const BASE_URL = getBaseUrl();
const REFRESH_URL = `${BASE_URL.endsWith("/") ? BASE_URL : BASE_URL + "/"}${controllerName.Authentication}/refresh-token`;

/**
 * ============================================================
 *  KIỂU DỮ LIỆU KHỚP VỚI BACKEND (ApiResponse<T> / PageResult<T>)
 * ============================================================
 */
interface RawApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

interface RawPageEnvelope<T> {
  success: boolean;
  message: string;
  data: T[];
  totalCount: number;
  pageIndex: number;
  pageSize: number;
  totalPages: number;
}

export interface ApiResult<T> {
  data: T;
  success: boolean;
  message: string;
  statusCode: number;
}

export interface ApiPageResult<T> {
  data: T[];
  totalCount: number;
  pageIndex: number;
  pageSize: number;
  totalPages: number;
  success: boolean;
  message: string;
  statusCode: number;
}

export interface ApiError {
  success: false;
  message: string;
  status?: number;
  statusCode?: number;
  [key: string]: unknown;
}

/**
 * ============================================================
 *  QUERY PARAM SERIALIZER
 * ============================================================
 */
export const convertParams = (params: Record<string, unknown> = {}) => {
  const searchParams = new URLSearchParams();
  for (const key in params) {
    const value = params[key];
    if (Array.isArray(value)) {
      value.forEach((val) => searchParams.append(key, String(val)));
    } else if (value !== null && value !== undefined) {
      searchParams.append(key, String(value));
    }
  }
  return searchParams.toString();
};

const api = axios.create({
  baseURL: BASE_URL,
  headers: {},
  timeout: 30000,
  paramsSerializer: (params) => convertParams(params),
});

/**
 * ============================================================
 *  ĐIỀU HƯỚNG
 *  Gọi setNavigator(navigate) một lần ở App.tsx.
 * ============================================================
 */
type NavigateFn = (path: string, options?: { replace?: boolean; state?: unknown }) => void;
let navigateFn: NavigateFn | null = null;

export function setNavigator(fn: NavigateFn) {
  navigateFn = fn;
}

function goTo(path: string, options?: { replace?: boolean; state?: unknown }) {
  if (navigateFn) {
    navigateFn(path, options);
  } else {
    window.location.href = path;
  }
}

/** Chặn open-redirect: chỉ cho phép đường dẫn nội bộ dạng "/abc" */
function getSafeRedirectPath(path: string): string | null {
  if (!path) return null;
  if (!path.startsWith("/") || path.startsWith("//")) return null;
  if (path.includes("\\")) return null;
  return path;
}

/**
 * ============================================================
 *  TOKEN STORAGE
 *  - accessToken: lưu ở localStorage
 *  - refreshToken: lưu ở Cookie (js-cookie)
 * ============================================================
 */
const ACCESS_KEY = "accessToken";
const REFRESH_KEY = "refreshToken";

const REFRESH_COOKIE_OPTIONS: Cookies.CookieAttributes = {
  expires: 7, // 7 ngày
  path: "/",
  sameSite: "Lax",
  secure: typeof window !== "undefined" && window.location.protocol === "https:",
};

export function getAccessToken(): string | undefined {
  return localStorage.getItem(ACCESS_KEY) ?? undefined;
}

export function getRefreshToken(): string | null {
  return Cookies.get(REFRESH_KEY) ?? null;
}

function setTokens(accessToken?: string, refreshToken?: string) {
  if (accessToken) localStorage.setItem(ACCESS_KEY, accessToken);
  if (refreshToken) {
    const expMs = getTokenExpMs(refreshToken);
    Cookies.set(REFRESH_KEY, refreshToken, {
      ...REFRESH_COOKIE_OPTIONS,
      expires: expMs ? new Date(expMs) : REFRESH_COOKIE_OPTIONS.expires,
    });
  }
}

function clearTokens() {
  localStorage.removeItem(ACCESS_KEY);
  Cookies.remove(REFRESH_KEY, { path: "/" });
}

/** Hết phiên: dọn token và báo cho app (AppContext lắng nghe để xoá user_session). */
function forceLogout() {
  clearTokens();
  window.dispatchEvent(new CustomEvent("auth:expired"));
}

function getTokenExpMs(token: string): number | null {
  try {
    const part = token.split(".")[1];
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const { exp } = JSON.parse(atob(padded));
    return typeof exp === "number" ? exp * 1000 : null;
  } catch {
    return null;
  }
}

/** Token hết hạn (hoặc không đọc được) tính theo claim `exp`, trừ một khoảng lệch giờ. */
export function isTokenExpired(token: string, skewMs = 10_000): boolean {
  const exp = getTokenExpMs(token);
  return exp === null || exp - skewMs <= Date.now();
}

/** Gọi ở service layer ngay sau khi login/register thành công. */
export function setTokensAfterLogin(accessToken: string, refreshToken: string) {
  setTokens(accessToken, refreshToken);
}

/** Gọi khi logout thủ công. */
export function clearAuthTokens() {
  clearTokens();
}

/**
 * Còn refresh token thì phiên vẫn sống (access token sẽ được làm mới tự động).
 * Không có refresh token thì chỉ coi là đăng nhập khi access token còn hạn.
 */
export function isAuthenticated(): boolean {
  if (getRefreshToken()) return true;
  const at = getAccessToken();
  return !!at && !isTokenExpired(at);
}

/**
 * ============================================================
 *  REFRESH TOKEN (single-flight + khoá giữa các tab)
 *  BE xoay vòng refresh token (token cũ bị thu hồi ngay), nên 2 request/2 tab
 *  refresh đồng thời sẽ làm một bên thất bại. Do đó:
 *   - Trong 1 tab: mọi request dùng chung 1 promise.
 *   - Giữa các tab: dùng Web Locks, tab sau thấy token mới thì dùng luôn.
 *
 *  Trả về: token mới | null (BE từ chối => hết phiên).
 *  Ném lỗi khi lỗi mạng / 5xx (giữ nguyên phiên, không đăng xuất).
 * ============================================================
 */
let refreshPromise: Promise<string | null> | null = null;

export function refreshAccessToken(staleToken?: string): Promise<string | null> {
  if (!refreshPromise) {
    const run = () => doRefresh(staleToken);
    const locks = (navigator as any).locks as
      | { request: <T>(name: string, cb: () => Promise<T>) => Promise<T> }
      | undefined;
    const p: Promise<string | null> = locks ? locks.request("find-bind-refresh", run) : run();
    refreshPromise = p.finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function doRefresh(staleToken?: string): Promise<string | null> {
  // Tab khác có thể đã refresh xong trong lúc mình chờ khoá.
  const current = getAccessToken();
  if (current && current !== staleToken && !isTokenExpired(current)) return current;

  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  try {
    // Dùng axios gốc (không phải instance "api") để tránh lặp interceptor.
    const res = await axios.post<RawApiEnvelope<{ accessToken: string; refreshToken: string }>>(
      REFRESH_URL,
      { refreshToken },
    );
    const payload = res.data?.data;
    if (!res.data?.success || !payload?.accessToken) return null;
    setTokens(payload.accessToken, payload.refreshToken);
    return payload.accessToken;
  } catch (err) {
    // BE từ chối (4xx) => hết phiên. Lỗi mạng / 5xx => ném lại để giữ phiên.
    if (axios.isAxiosError(err) && err.response && err.response.status < 500) return null;
    throw err;
  }
}

/**
 * ============================================================
 *  REQUEST INTERCEPTOR
 * ============================================================
 */
api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const isFormData = Object.prototype.toString.call(config.data) === "[object FormData]";

  if (isFormData) {
    delete config.headers["Content-Type"]; // để axios tự set boundary
  } else if (!config.headers["Content-Type"]) {
    config.headers["Content-Type"] = "application/json";
  }

  if (config.requiresAuth) {
    let token = getAccessToken();

    // Access token đã hết hạn mà còn refresh token: làm mới trước khi gửi.
    if (token && isTokenExpired(token) && getRefreshToken()) {
      try {
        token = (await refreshAccessToken(token)) ?? undefined;
      } catch {
        // Lỗi mạng: cứ gửi token cũ, nếu 401 sẽ xử lý ở response interceptor.
      }
    }

    if (token) config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

/**
 * ============================================================
 *  RESPONSE INTERCEPTOR
 *  - Chuẩn hoá ApiResponse<T> / phân trang từ BaseResponse.cs
 *  - Tự refresh token khi 401 và gửi lại request đúng 1 lần
 * ============================================================
 */
api.interceptors.response.use(
  (res: AxiosResponse): any => {
    const d = res?.data;

    if (d && typeof d === "object" && ("success" in d || "message" in d)) {
      if ("totalCount" in d) {
        const paged = d as RawPageEnvelope<unknown>;
        const result: ApiPageResult<unknown> = {
          data: paged.data ?? [],
          totalCount: paged.totalCount ?? 0,
          pageIndex: paged.pageIndex ?? 0,
          pageSize: paged.pageSize ?? 0,
          totalPages: paged.totalPages ?? 0,
          success: paged.success,
          message: paged.message,
          statusCode: res.status,
        };
        return result;
      }

      const normal = d as RawApiEnvelope<unknown>;
      const result: ApiResult<unknown> = {
        data: normal.data,
        success: normal.success,
        message: normal.message,
        statusCode: res.status,
      };
      return result;
    }

    // Không theo chuẩn ApiResponse (file, blob, ...) -> trả nguyên res
    return { ...res, statusCode: res.status };
  },
  async (err: AxiosError) => {
    // Request bị huỷ: từ chối để caller tự xử lý, không để UI treo.
    if (axios.isCancel(err)) return Promise.reject(err);

    const original = err.config as (AxiosRequestConfig & { _retry?: boolean }) | undefined;

    if (err.response?.status === 401 && original?.requiresAuth && !original._retry) {
      original._retry = true;
      const stale = getAccessToken();

      let newToken: string | null;
      try {
        newToken = await refreshAccessToken(stale);
      } catch {
        // Lỗi mạng / 5xx khi refresh: giữ phiên, báo lỗi gốc cho caller.
        return Promise.reject(err);
      }

      if (!newToken) {
        forceLogout();
        if (original.isRedirect === true && !window.location.pathname.startsWith("/auth")) {
          const candidate = window.location.pathname + (window.location.search || "");
          const safe = getSafeRedirectPath(candidate);
          goTo(safe ? `/auth/login?redirect=${encodeURIComponent(safe)}` : "/auth/login");
        }
        return Promise.reject(err);
      }

      original.headers = { ...(original.headers ?? {}), Authorization: `Bearer ${newToken}` };
      return api(original);
    }

    if (err.response?.status === 403 && original?.isRedirect === true) {
      goTo("/403");
    }

    return Promise.reject(err);
  },
);

/**
 * ============================================================
 *  API WRAPPERS (typed)
 *  requiresAuth: có gắn Bearer token hay không
 *  isRedirect:   có tự động điều hướng khi 401 (hết phiên) / 403 hay không
 * ============================================================
 */
export interface CallApiOptions extends AxiosRequestConfig {
  data?: unknown;
  params?: Record<string, unknown>;
}

export const getApi = <T = unknown>(
  url: string,
  opts: CallApiOptions = {},
): Promise<ApiResult<T> | ApiPageResult<T>> =>
  api.get(url, { isRedirect: true, ...opts }) as unknown as Promise<
    ApiResult<T> | ApiPageResult<T>
  >;

export const postApi = <T = unknown>(
  url: string,
  opts: CallApiOptions = {},
): Promise<ApiResult<T>> =>
  api.post(url, opts.data ?? {}, { isRedirect: true, ...opts }) as unknown as Promise<
    ApiResult<T>
  >;

export const putApi = <T = unknown>(
  url: string,
  opts: CallApiOptions = {},
): Promise<ApiResult<T>> =>
  api.put(url, opts.data ?? {}, { isRedirect: true, ...opts }) as unknown as Promise<
    ApiResult<T>
  >;

export const patchApi = <T = unknown>(
  url: string,
  opts: CallApiOptions = {},
): Promise<ApiResult<T>> =>
  api.patch(url, opts.data ?? {}, { isRedirect: true, ...opts }) as unknown as Promise<
    ApiResult<T>
  >;

export const deleteApi = <T = unknown>(
  url: string,
  opts: CallApiOptions = {},
): Promise<ApiResult<T>> =>
  api.delete(url, { isRedirect: true, ...opts }) as unknown as Promise<ApiResult<T>>;

/**
 * ============================================================
 *  XỬ LÝ LỖI CHUẨN HOÁ
 * ============================================================
 */
export function throwErr(error: AxiosError<any>, context = ""): ApiError {
  const res = error.response;
  const status = res?.status;

  let msg: string | null = null;

  if (res?.data?.message) {
    msg = res.data.message;
  } else if (res?.data?.errors) {
    msg = extractValidationMessage(res.data.errors);
  } else if (res?.data?.title) {
    msg = res.data.title;
  } else {
    msg = error.message || "Lỗi không xác định từ máy chủ";
  }

  console.error(
    `%c[API ERROR] ${context ? context + " → " : ""}${status || "??"}: ${msg}`,
    "color: red; font-weight: bold;",
  );

  return {
    ...(res?.data || {}),
    success: false,
    status,
    statusCode: status,
    message: msg ?? "Lỗi không xác định",
  };
}

function extractValidationMessage(errors: Record<string, unknown>): string | null {
  if (!errors || typeof errors !== "object") return null;
  const firstKey = Object.keys(errors)[0];
  const firstVal = errors[firstKey];
  return Array.isArray(firstVal) ? String(firstVal[0]) : String(firstVal);
}

export default api;