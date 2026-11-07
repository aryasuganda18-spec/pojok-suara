import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { SingleFile } from './store.js';
import { HttpError, parse } from '../utils/http.js';
import { isoNow } from '../utils/text.js';

const file = new SingleFile('newsletter/subscribers.json', { items: [] });
const emailSchema = z.email('format email tidak valid').max(200);

export async function subscribe(rawEmail, { ipHash = '' } = {}) {
  const email = parse(z.object({ email: emailSchema }), { email: String(rawEmail ?? '').trim().toLowerCase() }).email;
  let alreadySubscribed = false;
  await file.mutate((data) => {
    data.items ??= [];
    if (data.items.some((s) => s.email === email)) {
      alreadySubscribed = true;
      return;
    }
    data.items.push({ id: randomUUID(), email, ip_hash: ipHash, created_at: isoNow() });
  });
  return { alreadySubscribed };
}

export async function listSubscribers() {
  const { items } = await file.read();
  return [...items].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function removeSubscriber(id) {
  let found = false;
  await file.mutate((data) => {
    const before = data.items.length;
    data.items = data.items.filter((s) => s.id !== id);
    found = data.items.length !== before;
  });
  if (!found) throw new HttpError(404, 'Pelanggan tidak ditemukan');
}

/** CSV aman dari injeksi rumus: sel yang diawali = + - @ diberi tanda kutip. */
export async function exportCsv() {
  const items = await listSubscribers();
  const cell = (value) => {
    const text = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
    return `"${text.replace(/"/g, '""')}"`;
  };
  return ['email,tanggal_berlangganan', ...items.map((s) => `${cell(s.email)},${cell(s.created_at)}`)].join('\n');
}
