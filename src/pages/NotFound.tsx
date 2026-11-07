import { Link } from 'react-router-dom';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

export default function NotFound() {
  useDocumentTitle('Halaman tidak ditemukan');
  return (
    <div className="container-page grid place-items-center gap-4 py-24 text-center">
      <p className="font-serif text-7xl font-extrabold text-accent">404</p>
      <h1 className="font-serif text-2xl font-bold">Halaman tidak ditemukan</h1>
      <p className="max-w-md text-muted">Tulisan atau halaman yang Anda cari mungkin sudah dipindahkan, dihapus, atau alamatnya salah ketik.</p>
      <div className="flex flex-wrap justify-center gap-2">
        <Link to="/" className="btn">Ke beranda</Link>
        <Link to="/cari" className="btn btn-ghost">Cari tulisan</Link>
      </div>
    </div>
  );
}
