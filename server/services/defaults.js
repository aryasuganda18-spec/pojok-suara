export const DEFAULT_CATEGORIES = [
  ['Berita', 'Kabar terbaru dari berbagai peristiwa dan kebijakan.'],
  ['Politik', 'Pemerintahan, kebijakan publik, dan dinamika kekuasaan.'],
  ['Pendidikan', 'Sekolah, kampus, guru, dan masa depan belajar.'],
  ['Sosial', 'Kehidupan masyarakat, kesenjangan, dan solidaritas.'],
  ['Teknologi', 'Teknologi, internet, dan dampaknya bagi warga.'],
  ['Lingkungan', 'Alam, iklim, dan tata kelola ruang hidup.'],
  ['Ekonomi', 'Harga, pekerjaan, usaha kecil, dan kebijakan ekonomi.'],
  ['Budaya', 'Seni, tradisi, bahasa, dan budaya populer.'],
  ['Opini', 'Pandangan penulis tentang isu yang sedang dibicarakan.'],
  ['Kritik Sosial', 'Kritik terhadap kebijakan, praktik, dan ketimpangan.'],
  ['Analisis', 'Pembacaan mendalam atas data dan peristiwa.'],
  ['Esai', 'Tulisan reflektif dan naratif yang lebih panjang.'],
];

export const DEFAULT_SETTINGS = {
  site_name: 'POJOK SUARA',
  tagline: 'Suara yang Berani, Pikiran yang Merdeka.',
  description:
    'Media publikasi independen untuk berita, opini, kritik sosial, analisis, dan esai dari penulis dan masyarakat.',
  logo_id: null,
  favicon_id: null,
  theme: { accent: '#D94A35', default_mode: 'light' },
  nav: [
    { label: 'Beranda', href: '/' },
    { label: 'Berita', href: '/berita' },
    { label: 'Opini', href: '/opini' },
    { label: 'Kritik', href: '/kritik' },
    { label: 'Analisis', href: '/kategori/analisis' },
    { label: 'Esai', href: '/kategori/esai' },
    { label: 'Tentang Kami', href: '/halaman/tentang-kami' },
  ],
  footer: {
    about:
      'POJOK SUARA adalah ruang publikasi independen. Kami memuat berita, opini, kritik, dan analisis dengan membuka ruang bagi berbagai perspektif.',
    copyright: 'POJOK SUARA. Seluruh hak cipta dilindungi.',
    links: [
      { label: 'Kontak Redaksi', href: '/halaman/kontak' },
      { label: 'Pedoman Media Siber', href: '/halaman/pedoman-media-siber' },
      { label: 'Kebijakan Privasi', href: '/halaman/kebijakan-privasi' },
      { label: 'Syarat dan Ketentuan', href: '/halaman/syarat-dan-ketentuan' },
      { label: 'Kirim Tulisan', href: '/kirim-tulisan' },
    ],
  },
  social: { facebook: '', instagram: '', x: '', youtube: '', tiktok: '' },
  email_redaksi: '',
  seo: { title_suffix: 'POJOK SUARA', description: '', og_image_id: null },
  home: { hero_article_id: null, editors_pick_ids: [], per_page: 12 },
  breaking: { enabled: false, text: '', url: '' },
  comments: { enabled: true, moderation: 'manual' },
  newsletter_enabled: true,
  submissions_enabled: true,
};

const p = (...paragraphs) => paragraphs.map((t) => `<p>${t}</p>`).join('');

/** Isi awal halaman statis. Ini kerangka yang wajib ditinjau dan disesuaikan oleh redaksi sebelum dipublikasikan. */
export const DEFAULT_PAGES = {
  'tentang-kami': {
    title: 'Tentang Kami',
    content:
      p(
        'POJOK SUARA adalah media publikasi independen. Kami percaya bahwa warga berhak mendapat informasi yang jernih dan berhak menyuarakan pikirannya.',
        'Di sini penulis, jurnalis, kontributor, dan masyarakat menerbitkan berita, opini, kritik, analisis, dan esai. Kami membuka ruang bagi berbagai perspektif, selama disampaikan dengan data, argumen, dan itikad baik.',
      ) +
      '<h2>Nilai yang kami pegang</h2><ul><li>Independen dari kepentingan politik dan bisnis tertentu.</li><li>Kritis terhadap kekuasaan, terbuka terhadap koreksi.</li><li>Memisahkan fakta dari opini secara jelas.</li><li>Memberi hak jawab dan melakukan koreksi bila keliru.</li></ul>',
  },
  kontak: {
    title: 'Kontak Redaksi',
    content: p(
      'Kirim siaran pers, koreksi, hak jawab, atau pertanyaan lain kepada redaksi melalui email yang tercantum di bagian bawah situs.',
      'Untuk mengirim tulisan, gunakan halaman Kirim Tulisan. Setiap kiriman ditinjau redaksi sebelum diterbitkan.',
    ),
  },
  'tim-redaksi': {
    title: 'Tim Redaksi',
    content: p(
      'Halaman ini berisi susunan redaksi. Ubah dari menu Halaman di dashboard admin dengan menuliskan nama dan peran masing-masing anggota tim.',
    ),
  },
  'pedoman-penulisan': {
    title: 'Pedoman Penulisan',
    content:
      '<h2>Sebelum menulis</h2><ul><li>Tulis hal yang bisa dipertanggungjawabkan: sertakan sumber, data, dan tautan.</li><li>Bedakan jelas antara fakta, kutipan, dan pendapat pribadi.</li><li>Tulis dengan bahasa Indonesia yang jernih. Hindari ujaran kebencian, fitnah, dan pelanggaran privasi.</li></ul><h2>Format</h2><ul><li>Judul singkat dan informatif.</li><li>Ringkasan satu sampai dua kalimat.</li><li>Gambar milik sendiri atau berlisensi, lengkap dengan keterangan.</li></ul><h2>Proses penyuntingan</h2>' +
      p('Redaksi dapat menyunting untuk ketepatan, kejelasan, dan kepatuhan hukum. Perubahan substansial akan dikonfirmasi kepada penulis.'),
  },
  'pedoman-media-siber': {
    title: 'Pedoman Media Siber',
    content: p(
      'POJOK SUARA mengacu pada Kode Etik Jurnalistik dan Pedoman Pemberitaan Media Siber yang ditetapkan Dewan Pers.',
      'Verifikasi dan keberimbangan: informasi diuji sebelum dimuat, dan pihak yang disebut dalam tuduhan diupayakan dimintai tanggapan.',
      'Hak jawab dan koreksi: pihak yang merasa dirugikan dapat mengajukan hak jawab atau koreksi kepada redaksi. Koreksi dimuat dengan jelas pada tulisan yang bersangkutan.',
      'Komentar pembaca dimoderasi. Komentar yang berisi kebencian, fitnah, spam, atau pelanggaran privasi dapat dihapus.',
    ),
  },
  'kebijakan-privasi': {
    title: 'Kebijakan Privasi',
    content: p(
      'Kami mengumpulkan data seminimal mungkin. Alamat email yang Anda kirimkan melalui formulir newsletter, komentar, atau kiriman tulisan hanya dipakai untuk keperluan redaksi.',
      'Kami menghitung kunjungan secara agregat. Alamat IP tidak disimpan utuh; hanya dipakai dalam bentuk sidik acak (hash) untuk mencegah spam.',
      'Anda dapat meminta penghapusan komentar atau langganan newsletter dengan menghubungi redaksi.',
    ),
  },
  disclaimer: {
    title: 'Disclaimer',
    content: p(
      'Opini dalam tulisan bertanda Opini, Kritik, dan Esai merupakan pandangan penulisnya dan tidak selalu mencerminkan sikap redaksi.',
      'Redaksi berupaya menjaga ketepatan informasi, namun tidak menjamin kelengkapannya setiap saat. Laporkan kekeliruan kepada kami agar dapat dikoreksi.',
    ),
  },
  'syarat-dan-ketentuan': {
    title: 'Syarat dan Ketentuan',
    content: p(
      'Dengan menggunakan situs ini, Anda setuju untuk tidak menyalahgunakannya, termasuk mengirim spam, konten melanggar hukum, atau mencoba mengakses area yang tidak diizinkan.',
      'Penulis tetap memegang hak cipta atas tulisannya dan memberi POJOK SUARA izin untuk menerbitkan, menyunting, dan mengarsipkannya.',
      'Redaksi berhak menolak, menyunting, atau menurunkan tulisan yang melanggar pedoman.',
    ),
  },
  'kirim-tulisan': {
    title: 'Kirim Tulisan',
    content: p(
      'Punya pikiran yang ingin disuarakan? Kirimkan tulisan Anda kepada redaksi. Semua kiriman masuk antrean peninjauan dan tidak langsung terbit.',
      'Baca Pedoman Penulisan sebelum mengirim.',
    ),
  },
};
