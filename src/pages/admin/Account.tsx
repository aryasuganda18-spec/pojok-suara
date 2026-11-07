import { useState, type FormEvent } from 'react';
import { Card, PageHeader } from '../../components/admin/kit';
import { Field } from '../../components/ui';
import { useAuth, useToast } from '../../hooks/contexts';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { errorMessage, post } from '../../lib/api';

export default function Account() {
  useDocumentTitle('Akun saya');
  const { user, refresh } = useAuth();
  const toast = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (next.length < 10) return setError('Kata sandi baru minimal 10 karakter.');
    if (!/[A-Za-z]/.test(next) || !/\d/.test(next)) return setError('Kata sandi baru harus mengandung huruf dan angka.');
    if (next !== confirm) return setError('Konfirmasi kata sandi tidak sama.');
    setBusy(true);
    try {
      await post('/auth/change-password', { current, next });
      toast.success('Kata sandi diperbarui.');
      setCurrent('');
      setNext('');
      setConfirm('');
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="Akun saya" description={`${user?.name} · ${user?.role_label} · ${user?.email}`} />
      {user?.must_change_password && (
        <p role="alert" className="mb-4 rounded border border-accent bg-accent/10 p-4 text-sm font-semibold">Demi keamanan, ganti kata sandi sementara Anda sebelum melanjutkan.</p>
      )}
      <Card className="max-w-lg">
        <h2 className="mb-4 font-serif text-xl font-bold">Ganti kata sandi</h2>
        <form onSubmit={submit} noValidate className="space-y-4">
          <Field label="Kata sandi saat ini">{(id) => <input id={id} type="password" className="field" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />}</Field>
          <Field label="Kata sandi baru" hint="Minimal 10 karakter, mengandung huruf dan angka.">{(id, d) => <input id={id} aria-describedby={d} type="password" className="field" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />}</Field>
          <Field label="Ulangi kata sandi baru">{(id) => <input id={id} type="password" className="field" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />}</Field>
          {error && <p role="alert" className="error-text">{error}</p>}
          <button type="submit" className="btn" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan kata sandi'}</button>
        </form>
      </Card>
    </>
  );
}
