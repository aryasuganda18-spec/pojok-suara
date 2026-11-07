import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { ArrowUpRight, Menu, Moon, Search, Sun, X } from 'lucide-react';
import { useSite, useTheme } from '../hooks/contexts';
import { get, qs } from '../lib/api';
import type { Suggestion } from '../lib/types';
import { Logo } from './Logo';

function SearchPanel({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [items, setItems] = useState<Suggestion[]>([]);
  const [active, setActive] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => inputRef.current?.focus(), []);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setItems([]);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      get<{ items: Suggestion[] }>(`/search/suggest${qs({ q: term })}`, controller.signal)
        .then((r) => {
          setItems(r.items);
          setActive(-1);
        })
        .catch(() => undefined);
    }, 220);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [q]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (active >= 0 && items[active]) navigate(items[active].url);
    else if (q.trim()) navigate(`/cari${qs({ q: q.trim() })}`);
    onClose();
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(items.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(-1, i - 1));
    }
  };

  return (
    <div className="absolute inset-x-0 top-full z-40 border-b border-line bg-bg shadow-lg" role="dialog" aria-label="Pencarian">
      <div className="container-page py-4">
        <form onSubmit={submit} role="search" className="flex gap-2">
          <input
            ref={inputRef}
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder="Cari tulisan, penulis, atau topik"
            aria-label="Kata kunci pencarian"
            aria-autocomplete="list"
            aria-controls="search-suggestions"
            aria-activedescendant={active >= 0 ? `sug-${active}` : undefined}
            className="field flex-1"
            autoComplete="off"
            enterKeyHint="search"
          />
          <button type="submit" className="btn">
            Cari
          </button>
        </form>
        {items.length > 0 && (
          <ul id="search-suggestions" role="listbox" className="mt-2 max-h-[60dvh] overflow-y-auto">
            {items.map((s, i) => (
              <li key={`${s.kind}-${s.url}`} id={`sug-${i}`} role="option" aria-selected={i === active}>
                <Link
                  to={s.url}
                  onClick={onClose}
                  className={`flex min-h-11 items-center justify-between gap-3 rounded px-2 py-2 text-sm hover:bg-soft ${i === active ? 'bg-soft' : ''}`}
                >
                  <span className="min-w-0 truncate font-medium">{s.title}</span>
                  <span className="meta shrink-0 uppercase tracking-wide">{s.hint}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {q.trim().length >= 2 && items.length === 0 && <p className="meta mt-3">Tekan Enter untuk mencari “{q.trim()}”.</p>}
      </div>
    </div>
  );
}

export function Header() {
  const { site } = useSite();
  const { mode, toggle } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const location = useLocation();
  const menuButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMenuOpen(false);
    setSearchOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        setSearchOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  const nav = site?.nav ?? [];
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `inline-flex min-h-11 items-center border-b-2 px-1 text-sm font-semibold transition-colors ${isActive ? 'border-accent text-ink' : 'border-transparent text-muted hover:text-ink'}`;

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/95 backdrop-blur supports-[backdrop-filter]:bg-bg/85">
      <a href="#konten" className="sr-only-focusable absolute left-2 top-2 z-50 rounded bg-ink px-3 py-2 text-bg">
        Lewati ke konten
      </a>
      <div className="container-page relative flex h-16 items-center gap-1 pt-[env(safe-area-inset-top)] md:h-[4.5rem]">
        <button ref={menuButton} type="button" className="icon-btn -ml-2 lg:hidden" aria-label="Buka menu" aria-expanded={menuOpen} aria-controls="menu-mobile" onClick={() => setMenuOpen(true)}>
          <Menu className="size-6" aria-hidden="true" />
        </button>

        <Link to="/" className="mx-auto flex items-center lg:mx-0 lg:mr-6" aria-label={`${site?.site_name ?? 'POJOK SUARA'} — beranda`}>
          <span className="md:hidden"><Logo height={36} /></span>
          <span className="hidden md:inline"><Logo height={46} /></span>
        </Link>

        <nav aria-label="Navigasi utama" className="hidden flex-1 items-center gap-5 lg:flex">
          {nav.map((l) => (
            <NavLink key={l.href} to={l.href} end={l.href === '/'} className={linkClass}>
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center lg:ml-auto">
          <button type="button" className="icon-btn" aria-label={searchOpen ? 'Tutup pencarian' : 'Buka pencarian'} aria-expanded={searchOpen} onClick={() => setSearchOpen((v) => !v)}>
            {searchOpen ? <X className="size-5" aria-hidden="true" /> : <Search className="size-5" aria-hidden="true" />}
          </button>
          <button type="button" className="icon-btn -mr-2 lg:mr-0" onClick={toggle} aria-label={mode === 'dark' ? 'Aktifkan mode terang' : 'Aktifkan mode gelap'} aria-pressed={mode === 'dark'}>
            {mode === 'dark' ? <Sun className="size-5" aria-hidden="true" /> : <Moon className="size-5" aria-hidden="true" />}
          </button>
        </div>

        {searchOpen && <SearchPanel onClose={() => setSearchOpen(false)} />}
      </div>

      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" className="absolute inset-0 bg-black/50" aria-label="Tutup menu" onClick={() => setMenuOpen(false)} tabIndex={-1} />
          <div id="menu-mobile" className="animate-slide-in absolute inset-y-0 left-0 flex w-[min(20rem,88vw)] flex-col bg-bg p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <Logo height={34} />
              <button type="button" className="icon-btn" aria-label="Tutup menu" onClick={() => { setMenuOpen(false); menuButton.current?.focus(); }}>
                <X className="size-6" aria-hidden="true" />
              </button>
            </div>
            <nav aria-label="Navigasi seluler" className="flex-1 overflow-y-auto">
              <ul>
                {nav.map((l) => (
                  <li key={l.href} className="border-b border-line">
                    <NavLink to={l.href} end={l.href === '/'} className={({ isActive }) => `flex min-h-12 items-center font-serif text-lg font-bold ${isActive ? 'text-accent' : ''}`}>
                      {l.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
              {site?.categories && (
                <>
                  <p className="meta mt-5 mb-1 font-bold uppercase tracking-widest">Kategori</p>
                  <ul className="grid grid-cols-2 gap-x-3">
                    {site.categories.map((c) => (
                      <li key={c.id}>
                        <Link to={`/kategori/${c.slug}`} className="flex min-h-11 items-center text-sm text-muted hover:text-ink">
                          {c.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </nav>
            {site?.submissions_enabled && (
              <Link to="/kirim-tulisan" className="btn btn-accent mt-4">
                Kirim Tulisan <ArrowUpRight className="size-4" aria-hidden="true" />
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

export function BreakingBanner() {
  const { site } = useSite();
  const [hidden, setHidden] = useState(false);
  const b = site?.breaking;
  if (!b || hidden) return null;
  const body = (
    <>
      <span className="mr-2 shrink-0 rounded-sm bg-accent-ink px-1.5 py-0.5 text-[0.65rem] font-extrabold uppercase tracking-widest text-accent">Terkini</span>
      <span className="min-w-0 truncate">{b.text}</span>
    </>
  );
  return (
    <div className="bg-accent text-accent-ink" role="region" aria-label="Berita terkini">
      <div className="container-page flex min-h-11 items-center gap-2 text-sm font-semibold">
        {b.url ? (
          b.url.startsWith('/') ? (
            <Link to={b.url} className="flex min-w-0 flex-1 items-center hover:underline">{body}</Link>
          ) : (
            <a href={b.url} rel="noopener noreferrer" className="flex min-w-0 flex-1 items-center hover:underline">{body}</a>
          )
        ) : (
          <p className="flex min-w-0 flex-1 items-center">{body}</p>
        )}
        <button type="button" className="icon-btn -mr-2 !size-11" aria-label="Sembunyikan banner" onClick={() => setHidden(true)}>
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
