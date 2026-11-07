import { useEffect, useState, type ComponentType } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Archive, BookOpen, ExternalLink, FileText, Image, LayoutDashboard, LogOut, Mail, Menu, MessageSquare, Moon, Newspaper, PenLine,
  ScrollText, Settings, Sun, Tags, UserCog, Users, X, Quote,
} from 'lucide-react';
import { useAuth, useTheme, useToast } from '../hooks/contexts';

interface Item {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  need?: string;
  end?: boolean;
}

const ITEMS: Item[] = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/artikel', label: 'Artikel', icon: FileText },
  { to: '/admin/berita', label: 'Berita', icon: Newspaper },
  { to: '/admin/opini', label: 'Opini', icon: PenLine },
  { to: '/admin/kritik', label: 'Kritik', icon: Quote },
  { to: '/admin/kategori', label: 'Kategori', icon: Tags },
  { to: '/admin/penulis', label: 'Penulis', icon: Users },
  { to: '/admin/media', label: 'Media Library', icon: Image },
  { to: '/admin/komentar', label: 'Komentar', icon: MessageSquare, need: 'comments:moderate' },
  { to: '/admin/newsletter', label: 'Newsletter', icon: Mail, need: 'newsletter:manage' },
  { to: '/admin/halaman', label: 'Halaman', icon: BookOpen, need: 'pages:manage' },
  { to: '/admin/pengguna', label: 'Pengguna', icon: UserCog, need: 'users:manage' },
  { to: '/admin/pengaturan', label: 'Pengaturan', icon: Settings, need: 'settings:manage' },
  { to: '/admin/backup', label: 'Backup', icon: Archive, need: 'backup:manage' },
  { to: '/admin/logs', label: 'Logs', icon: ScrollText, need: 'logs:view' },
];

export function AdminLayout() {
  const { user, logout, can } = useAuth();
  const { mode, toggle } = useTheme();
  const toast = useToast();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [location.pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const items = ITEMS.filter((i) => !i.need || can(i.need));

  const doLogout = async () => {
    try {
      await logout();
      toast.info('Anda sudah keluar.');
    } catch {
      toast.error('Gagal keluar. Coba lagi.');
    }
  };

  const nav = (
    <nav aria-label="Menu dashboard" className="flex-1 overflow-y-auto px-2 py-2">
      <ul className="space-y-0.5">
        {items.map(({ to, label, icon: Icon, end }) => (
          <li key={to}>
            <NavLink to={to} end={end} className={({ isActive }) => `flex min-h-11 items-center gap-3 rounded px-3 text-sm font-semibold ${isActive ? 'bg-ink text-bg' : 'text-muted hover:bg-soft hover:text-ink'}`}>
              <Icon className="size-[18px] shrink-0" aria-hidden />
              {label}
            </NavLink>
          </li>
        ))}
        <li>
          <button type="button" onClick={doLogout} className="flex min-h-11 w-full items-center gap-3 rounded px-3 text-sm font-semibold text-muted hover:bg-soft hover:text-ink">
            <LogOut className="size-[18px] shrink-0" aria-hidden /> Logout
          </button>
        </li>
      </ul>
    </nav>
  );

  return (
    <div className="min-h-dvh bg-soft lg:grid lg:grid-cols-[15rem_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-bg lg:flex">
        <div className="border-b border-line px-4 py-4">
          <p className="font-serif text-lg font-extrabold tracking-wide">POJOK SUARA</p>
          <p className="meta">Ruang redaksi</p>
        </div>
        {nav}
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-bg px-3 pt-[env(safe-area-inset-top)]">
          <button type="button" className="icon-btn lg:hidden" aria-label="Buka menu dashboard" aria-expanded={open} onClick={() => setOpen(true)}><Menu className="size-6" aria-hidden /></button>
          <p className="font-serif text-base font-extrabold lg:hidden">POJOK SUARA</p>
          <div className="ml-auto flex items-center gap-1">
            <Link to="/" target="_blank" className="btn btn-ghost btn-sm hidden sm:inline-flex"><ExternalLink className="size-4" aria-hidden /> Lihat situs</Link>
            <button type="button" className="icon-btn" onClick={toggle} aria-label={mode === 'dark' ? 'Mode terang' : 'Mode gelap'}>{mode === 'dark' ? <Sun className="size-5" aria-hidden /> : <Moon className="size-5" aria-hidden />}</button>
            <Link to="/admin/akun" className="flex min-h-11 items-center gap-2 rounded px-2 text-sm hover:bg-soft" aria-label="Akun saya">
              <span className="grid size-8 place-items-center rounded-full bg-ink text-xs font-bold text-bg" aria-hidden>{user?.name.slice(0, 1).toUpperCase()}</span>
              <span className="hidden text-left leading-tight sm:block"><span className="block font-semibold">{user?.name}</span><span className="meta">{user?.role_label}</span></span>
            </Link>
          </div>
        </header>

        <main id="konten" tabIndex={-1} className="mx-auto w-full max-w-6xl p-4 pb-16 outline-none sm:p-6">
          <Outlet />
        </main>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu dashboard">
          <button type="button" className="absolute inset-0 bg-black/50" tabIndex={-1} aria-label="Tutup menu" onClick={() => setOpen(false)} />
          <div className="animate-slide-in absolute inset-y-0 left-0 flex w-[min(18rem,86vw)] flex-col bg-bg pb-[env(safe-area-inset-bottom)] shadow-xl">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <p className="font-serif text-lg font-extrabold">POJOK SUARA</p>
              <button type="button" className="icon-btn -mr-2" aria-label="Tutup menu" onClick={() => setOpen(false)}><X className="size-6" aria-hidden /></button>
            </div>
            {nav}
          </div>
        </div>
      )}
    </div>
  );
}
