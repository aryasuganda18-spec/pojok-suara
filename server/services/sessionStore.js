import session from 'express-session';
import { supabase, assertNoError } from '../db/supabase.js';

/**
 * Penyimpanan sesi berbasis tabel `sessions` di Supabase. ID sesi dari cookie dipakai sebagai
 * primary key `sid` — express-session sendiri sudah menandatangani cookie itu (HMAC dengan
 * SESSION_SECRET), jadi nilainya tidak bisa ditebak atau dipalsukan oleh klien.
 */
export class SupabaseSessionStore extends session.Store {
  constructor() {
    super();
    this.sweeper = setInterval(() => this.sweep().catch((err) => console.error('[sesi] gagal membersihkan:', err.message)), 60 * 60 * 1000);
    this.sweeper.unref();
  }

  get(sid, callback) {
    this.read(sid).then((sess) => callback(null, sess), (err) => callback(err));
  }

  async read(sid) {
    const { data, error } = await supabase().from('sessions').select('data, expires_at').eq('sid', sid).maybeSingle();
    assertNoError(error, 'sessions.read');
    if (!data) return null;
    if (data.expires_at && Date.parse(data.expires_at) <= Date.now()) {
      await this.destroyAsync(sid);
      return null;
    }
    return data.data;
  }

  set(sid, sess, callback) {
    const expiresAt = sess?.cookie?.expires ? new Date(sess.cookie.expires).toISOString() : null;
    supabase()
      .from('sessions')
      .upsert({ sid, data: sess, expires_at: expiresAt }, { onConflict: 'sid' })
      .then(({ error }) => {
        if (error) return callback?.(new Error(`Supabase (sessions.set): ${error.message}`));
        callback?.(null);
      }, (err) => callback?.(err));
  }

  async destroyAsync(sid) {
    const { error } = await supabase().from('sessions').delete().eq('sid', sid);
    assertNoError(error, 'sessions.destroy');
  }

  destroy(sid, callback) {
    this.destroyAsync(sid).then(() => callback?.(null), (err) => callback?.(err));
  }

  async sweep() {
    const { error } = await supabase().from('sessions').delete().lt('expires_at', new Date().toISOString());
    assertNoError(error, 'sessions.sweep');
  }
}
