import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Footer } from '../components/Footer';
import { BreakingBanner, Header } from '../components/Header';
import { ErrorState } from '../components/ui';
import { useSite } from '../hooks/contexts';
import { post } from '../lib/api';

export function PublicLayout() {
  const { site, loading, error, reload } = useSite();
  const location = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
    post('/hit').catch(() => undefined);
  }, [location.pathname]);

  if (error && !site) {
    return (
      <div className="container-page py-20">
        <ErrorState message="Situs tidak dapat dimuat. Periksa koneksi internet Anda." onRetry={reload} />
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <BreakingBanner />
      <Header />
      <main id="konten" tabIndex={-1} className="flex-1 outline-none" aria-busy={loading}>
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
