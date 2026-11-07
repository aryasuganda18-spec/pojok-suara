import fs from 'node:fs/promises';
import path from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { config } from '../server/config.js';
import { bootServices, flushServices } from '../server/services/boot.js';
import { createUser, listUsers } from '../server/services/users.js';
import { createAuthor, listAuthors, updateAuthor } from '../server/services/authors.js';
import { importArticle, demoIds } from '../server/services/articles.js';
import { listCategories } from '../server/services/categories.js';
import { saveUpload } from '../server/services/media.js';
import { ensureDir } from '../server/utils/fs-safe.js';
import { DEMO_ARTICLES, DEMO_AUTHORS, DEMO_IMAGES } from './demo-data.js';

const args = new Set(process.argv.slice(2));
const wantDemo = args.has('--demo');

const W = 1600;
const H = 900;

function shapeSvg(shape, [a, b, c]) {
  const bg = `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="${W}" height="${H}" fill="url(#g)"/>`;
  const op = 'opacity="0.85"';
  const shapes = {
    sun: `<circle cx="1050" cy="380" r="260" fill="${c}" ${op}/><rect x="0" y="640" width="${W}" height="260" fill="${c}" opacity="0.9"/>`,
    blocks: `<rect x="220" y="260" width="300" height="440" fill="${c}" ${op}/><rect x="580" y="140" width="300" height="560" fill="${c}" opacity="0.6"/><rect x="940" y="340" width="300" height="360" fill="${c}" opacity="0.8"/>`,
    stripes: Array.from({ length: 9 }, (_, i) => `<rect x="${i * 190}" y="${i % 2 ? 260 : 120}" width="110" height="${i % 2 ? 520 : 660}" fill="${c}" opacity="${0.55 + (i % 3) * 0.12}"/>`).join(''),
    hills: `<path d="M0 640 Q 400 360 800 600 T 1600 520 V900 H0Z" fill="${c}" opacity="0.7"/><path d="M0 760 Q 500 560 1000 740 T 1600 700 V900 H0Z" fill="${a}" opacity="0.8"/><circle cx="1180" cy="240" r="110" fill="${c}" ${op}/>`,
    nodes: `<g stroke="${c}" stroke-width="4" opacity="0.7"><path d="M300 300 L700 500 L1100 260 L1300 560 M700 500 L520 720 M1100 260 L900 120"/></g>${[[300, 300], [700, 500], [1100, 260], [1300, 560], [520, 720], [900, 120]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="38" fill="${c}" ${op}/>`).join('')}`,
    arches: Array.from({ length: 4 }, (_, i) => `<path d="M${180 + i * 360} 760 V420 A130 130 0 0 1 ${440 + i * 360} 420 V760Z" fill="${c}" opacity="${0.55 + i * 0.1}"/>`).join(''),
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${bg}${shapes[shape] ?? ''}</svg>`;
}

function avatarSvg([a, b]) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="${b}"/><circle cx="200" cy="155" r="72" fill="${a}"/><path d="M60 400 C60 290 140 240 200 240 C260 240 340 290 340 400Z" fill="${a}"/></svg>`;
}

async function uploadSvg(svg, name, { demo }) {
  await ensureDir(config.uploadTmpDir);
  const tmp = path.join(config.uploadTmpDir, randomUUID());
  await sharp(Buffer.from(svg)).png().toFile(tmp);
  try {
    return await saveUpload({ tmpPath: tmp, originalName: `${name}.png`, demo, alt: name });
  } finally {
    await fs.rm(tmp, { force: true });
  }
}

async function ensureAdmin() {
  const users = await listUsers();
  if (users.some((u) => u.role === 'super_admin')) return null;
  const username = (process.env.INIT_ADMIN_USERNAME || 'admin').toLowerCase();
  const email = process.env.INIT_ADMIN_EMAIL || 'admin@pojoksuara.local';
  const generated = !process.env.INIT_ADMIN_PASSWORD;
  const password = process.env.INIT_ADMIN_PASSWORD || `${randomBytes(9).toString('base64url')}7a`;
  await createUser({ username, email, name: 'Administrator', role: 'super_admin', password }, { mustChangePassword: generated });
  return { username, email, password, generated };
}

async function seedDemo() {
  if (demoIds().length > 0) {
    console.log('Data contoh sudah ada, dilewati.');
    return;
  }
  const categories = new Map(listCategories().map((c) => [c.name, c.id]));

  const images = new Map();
  for (const image of DEMO_IMAGES) {
    const media = await uploadSvg(shapeSvg(image.shape, image.colors), `contoh-${image.key}`, { demo: true });
    images.set(image.key, media.id);
  }

  const authors = new Map();
  for (const spec of DEMO_AUTHORS) {
    const avatar = await uploadSvg(avatarSvg(spec.palette), `avatar-${spec.username}`, { demo: true });
    const author = await createAuthor({ name: spec.name, username: spec.username, bio: spec.bio, fields: spec.fields, demo: true, avatarId: avatar.id });
    authors.set(spec.key, author.id);
  }

  const day = 86_400_000;
  for (const spec of DEMO_ARTICLES) {
    await importArticle({
      type: spec.type,
      title: spec.title,
      subtitle: spec.subtitle,
      content: spec.content,
      category_id: categories.get(spec.category) ?? null,
      author_id: authors.get(spec.author) ?? null,
      featured_image_id: images.get(spec.image) ?? null,
      featured_alt: spec.title,
      featured_caption: 'Ilustrasi contoh',
      tags: spec.tags,
      status: 'published',
      published_at: new Date(Date.now() - spec.days * day - 3_600_000).toISOString(),
      demo: true,
    });
  }
  console.log(`Data contoh dibuat: ${DEMO_ARTICLES.length} tulisan, ${DEMO_AUTHORS.length} penulis, ${DEMO_IMAGES.length} gambar.`);
}

async function main() {
  await bootServices();
  const admin = await ensureAdmin();
  if (wantDemo) await seedDemo();
  await flushServices();

  console.log('\nData disimpan di proyek Supabase: ' + (config.supabase.url || '(SUPABASE_URL belum diisi)'));
  if (admin) {
    console.log('\nAkun Super Admin dibuat:');
    console.log(`  Username : ${admin.username}`);
    console.log(`  Email    : ${admin.email}`);
    if (admin.generated) {
      console.log(`  Password : ${admin.password}`);
      console.log('  Simpan password ini sekarang. Password hanya ditampilkan sekali dan wajib diganti saat login pertama.');
    } else {
      console.log('  Password : sesuai INIT_ADMIN_PASSWORD');
    }
  } else {
    console.log('Akun Super Admin sudah ada, tidak dibuat ulang.');
  }
  if (!wantDemo && listAuthors().length === 0) console.log('Tip: jalankan "npm run init:demo" untuk mengisi data contoh.');
  setTimeout(() => process.exit(0), 100);
}

main().catch((err) => {
  console.error('Inisialisasi gagal:', err);
  process.exit(1);
});
