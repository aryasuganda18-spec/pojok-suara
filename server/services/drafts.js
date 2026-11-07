import { SingleFile, deleteSingle, listSingleKeys } from './store.js';
import { HttpError } from '../utils/http.js';
import { sanitizeArticleHtml } from '../utils/sanitize.js';
import { cleanText, isoNow } from '../utils/text.js';

const KEY_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_DRAFT_BYTES = 800_000;

function draftKey(user, key) {
  if (!KEY_PATTERN.test(key)) throw new HttpError(400, 'Kunci draft tidak valid');
  return `drafts/${user.id}__${key}`;
}

function draftFile(user, key) {
  return new SingleFile(draftKey(user, key), null);
}

/**
 * Draft otomatis dari editor, disimpan di server per pengguna. Berguna bila halaman tidak sengaja
 * ditutup atau direfresh sebelum tombol simpan ditekan.
 */
export async function saveDraft(user, key, payload) {
  const content = sanitizeArticleHtml(payload?.content ?? '');
  const draft = {
    key,
    user_id: user.id,
    saved_at: isoNow(),
    base_revision: Number.isInteger(payload?.base_revision) ? payload.base_revision : null,
    fields: {
      type: ['berita', 'opini', 'kritik', 'artikel'].includes(payload?.type) ? payload.type : 'artikel',
      title: cleanText(payload?.title, 200),
      subtitle: cleanText(payload?.subtitle, 300),
      excerpt: cleanText(payload?.excerpt, 400),
      content,
      category_id: typeof payload?.category_id === 'string' ? payload.category_id.slice(0, 64) : null,
      tags: Array.isArray(payload?.tags) ? payload.tags.slice(0, 12).map((t) => cleanText(t, 40)).filter(Boolean) : [],
    },
  };
  if (Buffer.byteLength(JSON.stringify(draft)) > MAX_DRAFT_BYTES) throw new HttpError(413, 'Draft terlalu besar');
  await draftFile(user, key).write(draft);
  return { saved_at: draft.saved_at };
}

export async function getDraft(user, key) {
  return (await draftFile(user, key).read()) ?? null;
}

export async function deleteDraft(user, key) {
  await deleteSingle(draftKey(user, key));
}

export async function listDrafts(user) {
  const prefix = `drafts/${user.id}__`;
  const keys = await listSingleKeys(prefix);
  const out = [];
  for (const key of keys) {
    const draft = await new SingleFile(key, null).read();
    if (draft) out.push({ key: draft.key, title: draft.fields?.title ?? '', saved_at: draft.saved_at });
  }
  return out.sort((a, b) => b.saved_at.localeCompare(a.saved_at));
}
