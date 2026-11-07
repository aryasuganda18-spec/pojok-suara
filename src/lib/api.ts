export class ApiError extends Error {
  status: number;
  details?: { field: string; message: string }[];
  constructor(status: number, message: string, details?: { field: string; message: string }[]) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

let csrfToken = '';
export const setCsrf = (token: string) => {
  csrfToken = token;
};

const sessionExpiredListeners = new Set<() => void>();
export const onSessionExpired = (fn: () => void) => {
  sessionExpiredListeners.add(fn);
  return () => {
    sessionExpiredListeners.delete(fn);
  };
};

interface Options {
  method?: string;
  body?: unknown;
  form?: FormData;
  signal?: AbortSignal;
}

export async function api<T = unknown>(path: string, { method = 'GET', body, form, signal }: Options = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (method !== 'GET' && csrfToken) headers['x-csrf-token'] = csrfToken;
  let payload: BodyInit | undefined;
  if (form) payload = form;
  else if (body !== undefined) {
    headers['content-type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  let res: Response;
  try {
    res = await fetch(`/api${path}`, { method, headers, body: payload, signal, credentials: 'same-origin' });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new ApiError(0, 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda.');
  }

  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    const info = (data ?? {}) as { error?: string; details?: ApiError['details'] };
    if (res.status === 401 && path !== '/auth/login' && path !== '/auth/session') sessionExpiredListeners.forEach((fn) => fn());
    const fallback = res.status === 413 ? 'Ukuran file terlalu besar untuk dikirim. Perkecil file lalu coba lagi.' : `Permintaan gagal (${res.status})`;
    throw new ApiError(res.status, info.error ?? fallback, info.details);
  }
  return data as T;
}

export const get = <T,>(path: string, signal?: AbortSignal) => api<T>(path, { signal });
export const post = <T,>(path: string, body?: unknown) => api<T>(path, { method: 'POST', body: body ?? {} });
export const put = <T,>(path: string, body?: unknown) => api<T>(path, { method: 'PUT', body: body ?? {} });
export const patch = <T,>(path: string, body?: unknown) => api<T>(path, { method: 'PATCH', body: body ?? {} });
export const del = <T,>(path: string) => api<T>(path, { method: 'DELETE' });
export const upload = <T,>(path: string, form: FormData) => api<T>(path, { method: 'POST', form });

export function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') sp.set(k, String(v));
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export const errorMessage = (err: unknown) => (err instanceof Error ? err.message : 'Terjadi kesalahan');
