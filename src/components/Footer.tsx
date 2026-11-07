import { Link } from 'react-router-dom';
import { Mail, Rss } from 'lucide-react';
import { Facebook, Instagram, XIcon, Youtube } from './BrandIcons';
import { useSite } from '../hooks/contexts';
import { NewsletterForm } from './Newsletter';

const SOCIAL = [
  { key: 'facebook', label: 'Facebook', Icon: Facebook },
  { key: 'instagram', label: 'Instagram', Icon: Instagram },
  { key: 'x', label: 'X', Icon: XIcon },
  { key: 'youtube', label: 'YouTube', Icon: Youtube },
] as const;

export function Footer() {
  const { site } = useSite();
  if (!site) return null;
  const year = new Date().getFullYear();
  const socials = SOCIAL.filter((s) => site.social[s.key]);

  return (
    <footer className="mt-16 border-t border-line bg-soft pb-[env(safe-area-inset-bottom)]">
      <div className="container-page grid gap-10 py-10 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <p className="font-serif text-2xl font-extrabold tracking-wide">{site.site_name}</p>
          <p className="mt-1 text-sm font-semibold text-accent">{site.tagline}</p>
          <p className="mt-3 max-w-md text-sm text-muted">{site.footer.about}</p>
          {site.newsletter_enabled && (
            <div className="mt-6 max-w-md">
              <p className="mb-2 text-sm font-bold">Dapatkan tulisan terbaik di email Anda</p>
              <NewsletterForm compact />
            </div>
          )}
        </div>

        <nav aria-label="Tautan redaksi">
          <p className="mb-2 text-sm font-bold uppercase tracking-widest">Redaksi</p>
          <ul>
            {site.footer.links.map((l) => (
              <li key={l.href}>
                <Link to={l.href} className="flex min-h-11 items-center text-sm text-muted hover:text-ink hover:underline">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <p className="mb-2 text-sm font-bold uppercase tracking-widest">Ikuti kami</p>
          <ul className="flex flex-wrap gap-1">
            {socials.map(({ key, label, Icon }) => (
              <li key={key}>
                <a href={site.social[key]} target="_blank" rel="noopener noreferrer" className="icon-btn border border-line" aria-label={`${label} (tab baru)`}>
                  <Icon className="size-5" aria-hidden="true" />
                </a>
              </li>
            ))}
            <li>
              <a href="/rss.xml" className="icon-btn border border-line" aria-label="RSS Feed">
                <Rss className="size-5" aria-hidden="true" />
              </a>
            </li>
            {site.email_redaksi && (
              <li>
                <a href={`mailto:${site.email_redaksi}`} className="icon-btn border border-line" aria-label="Email redaksi">
                  <Mail className="size-5" aria-hidden="true" />
                </a>
              </li>
            )}
          </ul>
          {site.email_redaksi && <p className="mt-3 break-all text-sm text-muted">{site.email_redaksi}</p>}
        </div>
      </div>
      <div className="border-t border-line">
        <p className="container-page py-4 text-xs text-muted">
          © {year} {site.footer.copyright}
        </p>
      </div>
    </footer>
  );
}
