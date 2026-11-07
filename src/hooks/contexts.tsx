import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { get, onSessionExpired, post, setCsrf } from '../lib/api';
import type { SessionUser, SiteInfo } from '../lib/types';

/* ---------- Toast ---------- */

type ToastKind = 'success' | 'error' | 'info';
interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}
interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: number) => setItems((list) => list.filter((t) => t.id !== id)), []);
  const push = useCallback(
    (kind: ToastKind, message: string) => {
      const id = ++counter.current;
      setItems((list) => [...list.slice(-3), { id, kind, message }]);
      window.setTimeout(() => dismiss(id), kind === 'error' ? 7000 : 4000);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({ success: (m) => push('success', m), error: (m) => push('error', m), info: (m) => push('info', m) }),
    [push],
  );

  const Icon = { success: CheckCircle2, error: XCircle, info: Info };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] pointer-events-none" aria-live="polite" aria-atomic="false">
        {items.map((t) => {
          const I = Icon[t.kind];
          return (
            <div
              key={t.id}
              role={t.kind === 'error' ? 'alert' : 'status'}
              className="animate-slide-in pointer-events-auto flex w-full max-w-md items-start gap-3 rounded border border-line bg-ink px-4 py-3 text-sm text-bg shadow-lg"
            >
              <I className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <p className="flex-1">{t.message}</p>
              <button type="button" onClick={() => dismiss(t.id)} aria-label="Tutup pemberitahuan" className="-m-2 grid size-9 place-items-center opacity-70 hover:opacity-100">
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast harus dipakai di dalam ToastProvider');
  return ctx;
}

/* ---------- Tema ---------- */

type Mode = 'light' | 'dark';
interface ThemeApi {
  mode: Mode;
  toggle: () => void;
}
const ThemeContext = createContext<ThemeApi | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>(() => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'));

  const toggle = useCallback(() => {
    setMode((current) => {
      const next: Mode = current === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      try {
        localStorage.setItem('ps-theme', next);
      } catch {
        /* penyimpanan browser tidak tersedia: tema tetap berlaku untuk sesi ini */
      }
      return next;
    });
  }, []);

  const value = useMemo(() => ({ mode, toggle }), [mode, toggle]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeApi {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme harus dipakai di dalam ThemeProvider');
  return ctx;
}

/* ---------- Informasi situs ---------- */

interface SiteApi {
  site: SiteInfo | null;
  loading: boolean;
  error: boolean;
  reload: () => void;
}
const SiteContext = createContext<SiteApi | null>(null);

export function SiteProvider({ children }: { children: ReactNode }) {
  const [site, setSite] = useState<SiteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    get<SiteInfo>('/site')
      .then((data) => {
        setSite(data);
        setError(false);
        const root = document.documentElement.style;
        if (/^#[0-9a-f]{6}$/i.test(data.theme.accent)) root.setProperty('--accent', data.theme.accent);
        try {
          if (!localStorage.getItem('ps-theme') && data.theme.default_mode !== 'system') {
            document.documentElement.dataset.theme = data.theme.default_mode;
          }
        } catch {
          /* abaikan */
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);
  const value = useMemo(() => ({ site, loading, error, reload: load }), [site, loading, error, load]);
  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
}

export function useSite(): SiteApi {
  const ctx = useContext(SiteContext);
  if (!ctx) throw new Error('useSite harus dipakai di dalam SiteProvider');
  return ctx;
}

/* ---------- Sesi pengguna (admin) ---------- */

interface AuthApi {
  user: SessionUser | null;
  ready: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  can: (permission: string) => boolean;
}
const AuthContext = createContext<AuthApi | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await get<{ user: SessionUser | null; csrf: string }>('/auth/session');
      setCsrf(res.csrf);
      setUser(res.user);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
    return onSessionExpired(() => setUser(null));
  }, [refresh]);

  const login = useCallback(async (identifier: string, password: string) => {
    const res = await post<{ user: SessionUser; csrf: string }>('/auth/login', { identifier, password });
    setCsrf(res.csrf);
    setUser(res.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await post('/auth/logout');
    } finally {
      setUser(null);
      await refresh();
    }
  }, [refresh]);

  const can = useCallback((permission: string) => Boolean(user?.permissions.includes(permission)), [user]);
  const value = useMemo(() => ({ user, ready, login, logout, refresh, can }), [user, ready, login, logout, refresh, can]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthApi {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth harus dipakai di dalam AuthProvider');
  return ctx;
}
