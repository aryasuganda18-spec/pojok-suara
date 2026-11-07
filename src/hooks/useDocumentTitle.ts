import { useEffect } from 'react';

/** Mengatur judul tab saat berpindah halaman di dalam aplikasi (judul awal untuk mesin pencari disisipkan server). */
export function useDocumentTitle(title: string | null | undefined, suffix = 'POJOK SUARA') {
  useEffect(() => {
    if (title) document.title = `${title} — ${suffix}`;
  }, [title, suffix]);
}
