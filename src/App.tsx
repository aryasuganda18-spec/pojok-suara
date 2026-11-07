import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Spinner } from './components/ui';
import { AuthProvider } from './hooks/contexts';
import { PublicLayout } from './layouts/PublicLayout';
import Article from './pages/Article';
import Home from './pages/Home';
import Listing from './pages/Listing';
import NotFound from './pages/NotFound';
import StaticPage from './pages/StaticPage';
import Submit from './pages/Submit';

// Dashboard admin dimuat terpisah: pengunjung biasa tidak mengunduh editor dan grafik.
const AdminApp = lazy(() => import('./pages/admin/AdminApp'));

const ARTICLE_TYPES = ['berita', 'opini', 'kritik', 'artikel'] as const;

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<Home />} />
        {ARTICLE_TYPES.map((t) => (
          <Route key={t} path={t} element={<Listing mode="type" type={t} />} />
        ))}
        {ARTICLE_TYPES.map((t) => (
          <Route key={`${t}-detail`} path={`${t}/:slug`} element={<Article type={t} />} />
        ))}
        <Route path="kategori/:slug" element={<Listing mode="category" />} />
        <Route path="tag/:tag" element={<Listing mode="tag" />} />
        <Route path="penulis/:username" element={<Listing mode="author" />} />
        <Route path="cari" element={<Listing mode="search" />} />
        <Route path="halaman/:slug" element={<StaticPage />} />
        <Route path="kirim-tulisan" element={<Submit />} />
        <Route path="tentang-kami" element={<Navigate to="/halaman/tentang-kami" replace />} />
        <Route path="*" element={<NotFound />} />
      </Route>
      <Route
        path="admin/*"
        element={
          <AuthProvider>
            <Suspense fallback={<div className="grid min-h-dvh place-items-center"><Spinner label="Memuat dashboard" /></div>}>
              <AdminApp />
            </Suspense>
          </AuthProvider>
        }
      />
    </Routes>
  );
}
