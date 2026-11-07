import { useCallback, useEffect, useRef, useState } from 'react';
import { get, errorMessage } from '../lib/api';

interface State<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  status: number | null;
}

/**
 * Mengambil data dari API. Padanan HTML-nya: seperti memanggil fetch() lalu mengisi elemen di halaman,
 * hanya saja di sini hasilnya otomatis memicu tampilan ulang. Permintaan lama dibatalkan saat alamat berubah.
 */
export function useApi<T>(path: string | null) {
  const [state, setState] = useState<State<T>>({ data: null, loading: Boolean(path), error: null, status: null });
  const [tick, setTick] = useState(0);
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    if (!path) {
      setState({ data: null, loading: false, error: null, status: null });
      return;
    }
    const controller = new AbortController();
    const samePath = lastPath.current === path;
    lastPath.current = path;
    setState((s) => ({ data: samePath ? s.data : null, loading: true, error: null, status: null }));
    get<T>(path, controller.signal)
      .then((data) => setState({ data, loading: false, error: null, status: 200 }))
      .catch((err) => {
        if ((err as Error).name === 'AbortError') return;
        setState({ data: null, loading: false, error: errorMessage(err), status: (err as { status?: number }).status ?? 0 });
      });
    return () => controller.abort();
  }, [path, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}
