import { randomUUID } from 'node:crypto';
import { SingleFile, deleteSingle, listSingleKeys } from './store.js';
import { HttpError } from '../utils/http.js';
import { cleanMultiline, cleanText, isoNow } from '../utils/text.js';

const STATUSES = ['pending', 'approved', 'spam'];
const PREFIX = 'comments/';
const approvedCounts = new Map();
let pendingTotal = 0;
const pendingByArticle = new Map();

const isSafeId = (id) => typeof id === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_-]{1,80}$/.test(id);

const fileFor = (articleId) => {
  if (!isSafeId(articleId)) throw new HttpError(400, 'ID artikel tidak valid');
  return new SingleFile(`${PREFIX}${articleId}`, { article_id: articleId, items: [] });
};

function recount(articleId, items) {
  approvedCounts.set(articleId, items.filter((c) => c.status === 'approved').length);
  pendingByArticle.set(articleId, items.filter((c) => c.status === 'pending').length);
  pendingTotal = [...pendingByArticle.values()].reduce((a, b) => a + b, 0);
}

export async function initComments() {
  approvedCounts.clear();
  pendingByArticle.clear();
  const keys = await listSingleKeys(PREFIX);
  for (const key of keys) {
    const articleId = key.slice(PREFIX.length);
    if (!isSafeId(articleId)) continue;
    const data = await new SingleFile(key, { items: [] }).read();
    recount(articleId, data.items ?? []);
  }
}

export const approvedCount = (articleId) => approvedCounts.get(articleId) ?? 0;
export const pendingCount = () => pendingTotal;

export async function listApproved(articleId) {
  const { items } = await fileFor(articleId).read();
  const approved = items.filter((c) => c.status === 'approved').sort((a, b) => a.created_at.localeCompare(b.created_at));
  const byId = new Map(approved.map((c) => [c.id, c]));
  const rootOf = (comment) => {
    let current = comment;
    for (let guard = 0; current.parent_id && byId.has(current.parent_id) && guard < 20; guard += 1) current = byId.get(current.parent_id);
    return current;
  };
  const shape = (c) => ({ id: c.id, name: c.name, body: c.body, created_at: c.created_at, replies: [] });
  const roots = new Map();
  for (const comment of approved) {
    if (!comment.parent_id || !byId.has(comment.parent_id)) roots.set(comment.id, shape(comment));
  }
  for (const comment of approved) {
    if (roots.has(comment.id)) continue;
    roots.get(rootOf(comment).id)?.replies.push(shape(comment));
  }
  return [...roots.values()];
}

const LINK_PATTERN = /(https?:\/\/|www\.)/gi;

export async function createComment({ articleId, parentId = null, name, email = '', body, ipHash, moderation }) {
  const cleanName = cleanText(name, 60);
  const cleanBody = cleanMultiline(body, 2000);
  if (cleanName.length < 2) throw new HttpError(400, 'Nama minimal 2 karakter');
  if (cleanBody.length < 2) throw new HttpError(400, 'Komentar terlalu pendek');
  const cleanEmail = cleanText(email, 200).toLowerCase();
  if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) throw new HttpError(400, 'Format email tidak valid');

  const store = fileFor(articleId);
  let created = null;
  await store.mutate((data) => {
    data.items ??= [];
    if (parentId) {
      const parent = data.items.find((c) => c.id === parentId && c.status === 'approved');
      if (!parent) throw new HttpError(400, 'Komentar yang dibalas tidak ditemukan');
    }
    const links = (cleanBody.match(LINK_PATTERN) ?? []).length;
    const duplicate = data.items.some(
      (c) => c.ip_hash === ipHash && c.body === cleanBody && Date.now() - Date.parse(c.created_at) < 10 * 60 * 1000,
    );
    const status = links > 2 || duplicate ? 'spam' : moderation === 'auto' ? 'approved' : 'pending';
    created = { id: randomUUID(), parent_id: parentId, name: cleanName, email: cleanEmail, body: cleanBody, status, created_at: isoNow(), updated_at: isoNow(), ip_hash: ipHash };
    data.items.push(created);
    data.items = data.items.slice(-2000);
    recount(articleId, data.items);
  });
  return { id: created.id, status: created.status };
}

export async function listAllComments({ status = '', q = '' } = {}) {
  const keys = await listSingleKeys(PREFIX);
  const all = [];
  for (const key of keys) {
    const articleId = key.slice(PREFIX.length);
    if (!isSafeId(articleId)) continue;
    const { items } = await new SingleFile(key, { items: [] }).read();
    for (const c of items ?? []) all.push({ ...c, article_id: articleId });
  }
  const needle = q.trim().toLowerCase();
  return all
    .filter((c) => (!status || c.status === status) && (!needle || `${c.name} ${c.body} ${c.email}`.toLowerCase().includes(needle)))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function setCommentStatus(articleId, commentId, status) {
  if (!STATUSES.includes(status)) throw new HttpError(400, 'Status komentar tidak valid');
  let found = false;
  await fileFor(articleId).mutate((data) => {
    const comment = data.items?.find((c) => c.id === commentId);
    if (!comment) return;
    comment.status = status;
    comment.updated_at = isoNow();
    found = true;
    recount(articleId, data.items);
  });
  if (!found) throw new HttpError(404, 'Komentar tidak ditemukan');
}

export async function deleteComment(articleId, commentId) {
  let found = false;
  await fileFor(articleId).mutate((data) => {
    const doomed = new Set([commentId]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const c of data.items ?? []) {
        if (c.parent_id && doomed.has(c.parent_id) && !doomed.has(c.id)) {
          doomed.add(c.id);
          grew = true;
        }
      }
    }
    const before = data.items?.length ?? 0;
    data.items = (data.items ?? []).filter((c) => !doomed.has(c.id));
    found = data.items.length !== before;
    recount(articleId, data.items);
  });
  if (!found) throw new HttpError(404, 'Komentar tidak ditemukan');
}

export async function removeCommentsForArticle(articleId) {
  if (!isSafeId(articleId)) return;
  await deleteSingle(`${PREFIX}${articleId}`);
  approvedCounts.delete(articleId);
  pendingByArticle.delete(articleId);
  pendingTotal = [...pendingByArticle.values()].reduce((a, b) => a + b, 0);
}
