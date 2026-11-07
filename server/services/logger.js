import { createHash } from 'node:crypto';
import { supabase, assertNoError } from '../db/supabase.js';

export const hashIp = (ip) => createHash('sha256').update(String(ip ?? '')).digest('hex').slice(0, 16);

/** Mencatat aktivitas sebagai satu baris di tabel activity_log. Kegagalan mencatat tidak boleh menggagalkan permintaan. */
export async function logActivity({ user = null, action, target = '', detail = '', ip = '' }) {
  try {
    const { error } = await supabase().from('activity_log').insert({
      user_id: user?.id ?? null,
      username: user?.username ?? 'anonim',
      action,
      target,
      detail: String(detail).slice(0, 300),
      ip_hash: ip ? hashIp(ip) : '',
    });
    assertNoError(error, 'activity_log.insert');
  } catch (err) {
    console.error('[log] gagal menulis log aktivitas:', err.message);
  }
}

export async function readLogs({ limit = 100, action = '' } = {}) {
  let query = supabase().from('activity_log').select('*').order('at', { ascending: false }).limit(limit);
  if (action) query = query.like('action', `${action}%`);
  const { data, error } = await query;
  assertNoError(error, 'activity_log.read');
  return (data ?? []).map((row) => ({
    at: row.at,
    user_id: row.user_id,
    user: row.username,
    action: row.action,
    target: row.target,
    detail: row.detail,
    ip_hash: row.ip_hash,
  }));
}

export async function recentActivity(limit = 8) {
  return readLogs({ limit });
}
