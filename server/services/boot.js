import { initArticles, flushIndex } from './articles.js';
import { initAuthors } from './authors.js';
import { initCategories } from './categories.js';
import { initComments } from './comments.js';
import { initMedia } from './media.js';
import { initSettings } from './settings.js';
import { flush as flushStats, initStats } from './stats.js';
import { initUsers } from './users.js';
import { initVersions, registerReloader } from './sync.js';

/** Menyiapkan seluruh layanan dari data di Supabase. Aman dipanggil ulang (dipakai setelah restore). */
export async function bootServices() {
  await initVersions();
  await initSettings();
  await initCategories();
  await initMedia();
  await initAuthors();
  await initUsers();
  await initComments();
  await initStats();
  await initArticles();
  registerReloader('core', reloadCore);
  registerReloader('comments', initComments);
}

/** Memuat ulang cache yang dibagi antar-instance (tanpa statistik, yang punya mekanisme sendiri). */
async function reloadCore() {
  await initSettings();
  await initCategories();
  await initMedia();
  await initAuthors();
  await initArticles();
}

export async function flushServices() {
  await Promise.allSettled([flushStats(), flushIndex()]);
}
