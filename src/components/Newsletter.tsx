import { useRef, useState, type FormEvent } from 'react';
import { Mail } from 'lucide-react';
import { useToast } from '../hooks/contexts';
import { errorMessage, post } from '../lib/api';

export function NewsletterForm({ compact = false }: { compact?: boolean }) {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState('');
  const started = useRef(Date.now());

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const value = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
      setError('Masukkan alamat email yang valid, misalnya nama@contoh.com');
      return;
    }
    setBusy(true);
    try {
      const res = await post<{ message: string }>('/newsletter', { email: value, website });
      setDone(res.message);
      setEmail('');
      toast.success(res.message);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <p role="status" className="rounded border border-line bg-soft p-4 text-sm font-medium">
        {done}
      </p>
    );
  }

  return (
    <form onSubmit={submit} noValidate aria-label="Berlangganan newsletter">
      <div className={`flex gap-2 ${compact ? 'flex-col sm:flex-row' : 'flex-col sm:flex-row'}`}>
        <div className="relative flex-1">
          <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <label htmlFor="nl-email" className="sr-only">Alamat email</label>
          <input
            id="nl-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            className="field pl-9"
            placeholder="Alamat email Anda"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'nl-error' : undefined}
          />
        </div>
        <div aria-hidden="true" className="absolute -left-[9999px]">
          <label>
            Situs web
            <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} data-started={started.current} />
          </label>
        </div>
        <button type="submit" className="btn btn-accent" disabled={busy}>
          {busy ? 'Mengirim…' : 'Berlangganan'}
        </button>
      </div>
      {error && (
        <p id="nl-error" role="alert" className="error-text">
          {error}
        </p>
      )}
    </form>
  );
}
