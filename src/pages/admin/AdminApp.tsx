import { lazy, Suspense, type ReactElement } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Spinner } from '../../components/ui';
import { useAuth } from '../../hooks/contexts';
import { AdminLayout } from '../../layouts/AdminLayout';
import Account from './Account';
import ArticleList from './ArticleList';
import Authors from './Authors';
import Backup from './Backup';
import Categories from './Categories';
import Comments from './Comments';
import Dashboard from './Dashboard';
import Login from './Login';
import MediaLibrary from './MediaLibrary';
import Newsletter from './Newsletter';
import Pages from './Pages';
import Settings from './Settings';
import Users from './Users';
import Logs from './Logs';

// Editor memuat TipTap (berat), jadi dimuat hanya saat membuka halaman tulis.
const ArticleEditor = lazy(() => import('./ArticleEditor'));

function Guard({ need, children }: { need?: string; children: ReactElement }) {
  const { can } = useAuth();
  if (need && !can(need)) {
    return (
      <div className="rounded border border-line bg-card p-8 text-center" role="alert">
        <h1 className="font-serif text-2xl font-extrabold">Akses ditolak</h1>
        <p className="mt-2 text-muted">Peran Anda tidak memiliki izin untuk membuka halaman ini.</p>
      </div>
    );
  }
  return children;
}

export default function AdminApp() {
  const { user, ready } = useAuth();
  const location = useLocation();

  if (!ready) return <div className="grid min-h-dvh place-items-center"><Spinner label="Memeriksa sesi" /></div>;

  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  if (user.must_change_password && !location.pathname.endsWith('/akun')) return <Navigate to="/admin/akun" replace />;

  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="artikel" element={<ArticleList />} />
        <Route path="berita" element={<ArticleList type="berita" />} />
        <Route path="opini" element={<ArticleList type="opini" />} />
        <Route path="kritik" element={<ArticleList type="kritik" />} />
        <Route
          path="tulis/:id?"
          element={
            <Suspense fallback={<Spinner label="Memuat editor" />}>
              <ArticleEditor />
            </Suspense>
          }
        />
        <Route path="kategori" element={<Categories />} />
        <Route path="penulis" element={<Authors />} />
        <Route path="media" element={<MediaLibrary />} />
        <Route path="komentar" element={<Guard need="comments:moderate"><Comments /></Guard>} />
        <Route path="newsletter" element={<Guard need="newsletter:manage"><Newsletter /></Guard>} />
        <Route path="halaman" element={<Guard need="pages:manage"><Pages /></Guard>} />
        <Route path="pengguna" element={<Guard need="users:manage"><Users /></Guard>} />
        <Route path="pengaturan" element={<Guard need="settings:manage"><Settings /></Guard>} />
        <Route path="backup" element={<Guard need="backup:manage"><Backup /></Guard>} />
        <Route path="logs" element={<Guard need="logs:view"><Logs /></Guard>} />
        <Route path="akun" element={<Account />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Route>
    </Routes>
  );
}
