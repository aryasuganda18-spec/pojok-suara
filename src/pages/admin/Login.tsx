import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { Logo } from '../../components/Logo';
import { useAuth } from '../../hooks/contexts';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { errorMessage } from '../../lib/api';

export default function Login() {
  useDocumentTitle('Masuk');
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password) {
      setError('Isi username/email dan kata sandi.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await login(identifier.trim(), password);
    } catch (err) {
      setError(errorMessage(err));
      setPassword('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-dvh place-items-center bg-soft p-4">
      <div className="w-full max-w-sm rounded border border-line bg-card p-6 shadow-sm sm:p-8">
        <div className="mb-6 flex justify-center"><Logo height={52} /></div>
        <h1 className="text-center font-serif text-2xl font-extrabold">Masuk ke ruang redaksi</h1>
        <form onSubmit={submit} noValidate className="mt-6 space-y-4">
          <div>
            <label className="label" htmlFor="identifier">Username atau email</label>
            <input id="identifier" className="field" autoComplete="username" autoCapitalize="none" spellCheck={false} value={identifier} onChange={(e) => setIdentifier(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="label" htmlFor="password">Kata sandi</label>
            <div className="relative">
              <input id="password" className="field pr-12" type={show ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
              <button type="button" className="icon-btn absolute right-0 top-0" onClick={() => setShow((v) => !v)} aria-label={show ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'} aria-pressed={show}>
                {show ? <EyeOff className="size-5" aria-hidden="true" /> : <Eye className="size-5" aria-hidden="true" />}
              </button>
            </div>
          </div>
          {error && <p role="alert" className="rounded border border-[#c0392b] bg-[#c0392b]/10 px-3 py-2 text-sm text-[#c0392b] dark:text-[#ff8a7a]">{error}</p>}
          <button type="submit" className="btn w-full" disabled={busy}>{busy ? 'Memeriksa…' : 'Masuk'}</button>
        </form>
        <p className="mt-6 text-center text-sm"><Link to="/" className="text-muted underline hover:text-ink">← Kembali ke situs</Link></p>
      </div>
    </div>
  );
}
