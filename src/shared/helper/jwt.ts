export type AppRole = 'user' | 'merchant' | 'admin' | 'moderator';

const ROLE_CLAIM_LONG = 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role';

export function decodeJwtPayload(token?: string | null): Record<string, unknown> | null {
  if (!token) return null;
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const json = decodeURIComponent(
      atob(padded)
        .split('')
        .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join(''),
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function getRolesFromToken(token?: string | null): string[] {
  const payload = decodeJwtPayload(token);
  if (!payload) return [];
  const raw = payload[ROLE_CLAIM_LONG] ?? payload['role'] ?? payload['roles'];
  if (Array.isArray(raw)) return raw.map(String);
  return raw ? [String(raw)] : [];
}

/**
 * Role chỉ để ẩn/hiện UI. Quyền thật PHẢI do BE kiểm tra ([Authorize(Roles = ...)]).
 */
export function getAppRole(token?: string | null): AppRole {
  const roles = getRolesFromToken(token).map((r) => r.toLowerCase());
  if (roles.includes('admin')) return 'admin';
  if (roles.includes('moderator')) return 'moderator';
  if (roles.includes('merchant')) return 'merchant';
  return 'user';
}