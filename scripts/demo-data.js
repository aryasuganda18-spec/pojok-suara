const note = '<p><em>Catatan: tulisan ini adalah contoh untuk demonstrasi. Hapus semua data contoh lewat Pengaturan → Data Contoh.</em></p>';
const p = (...items) => items.map((t) => `<p>${t}</p>`).join('');

export const DEMO_AUTHORS = [
  { key: 'sari', name: 'Sari Wulandari', username: 'sariw', bio: 'Jurnalis lepas yang menulis tentang pendidikan dan kebijakan publik.', fields: ['Pendidikan', 'Kebijakan'], palette: ['#D94A35', '#F2C6B8'] },
  { key: 'bima', name: 'Bima Prakoso', username: 'bimap', bio: 'Peneliti ekonomi yang gemar membaca data harga dan upah.', fields: ['Ekonomi', 'Analisis'], palette: ['#1F3A5F', '#B7C9E2'] },
  { key: 'laras', name: 'Laras Anindya', username: 'larasa', bio: 'Penulis esai tentang budaya, bahasa, dan kehidupan sehari-hari.', fields: ['Budaya', 'Esai'], palette: ['#4F6F52', '#D5E3D0'] },
  { key: 'raka', name: 'Raka Mahendra', username: 'rakam', bio: 'Pegiat teknologi sipil dan keamanan digital warga.', fields: ['Teknologi', 'Opini'], palette: ['#6B4C9A', '#DCD0EE'] },
];

export const DEMO_IMAGES = [
  { key: 'balai', colors: ['#D94A35', '#F2A65A', '#151515'], shape: 'sun' },
  { key: 'sekolah', colors: ['#1F3A5F', '#7FA1C9', '#F5F5F5'], shape: 'blocks' },
  { key: 'pasar', colors: ['#B5651D', '#F0D9A8', '#151515'], shape: 'stripes' },
  { key: 'hutan', colors: ['#2F5D3A', '#A7C7A0', '#F5F5F5'], shape: 'hills' },
  { key: 'jaringan', colors: ['#2B2B3C', '#D94A35', '#F5F5F5'], shape: 'nodes' },
  { key: 'budaya', colors: ['#7A2E4D', '#F0B6C8', '#151515'], shape: 'arches' },
];

/** Daftar tulisan contoh. `image` merujuk DEMO_IMAGES, `author` merujuk DEMO_AUTHORS, `days` = berapa hari lalu terbit. */
export const DEMO_ARTICLES = [
  {
    type: 'berita', category: 'Pendidikan', author: 'sari', image: 'sekolah', days: 0, tags: ['sekolah', 'kebijakan'],
    title: 'Sekolah-sekolah Uji Coba Jam Belajar Lebih Pendek, Orang Tua Terbelah',
    subtitle: 'Uji coba tiga bulan di beberapa kota menimbulkan dukungan sekaligus kekhawatiran soal pengasuhan.',
    content: p(
      'Sejumlah sekolah dasar dan menengah menjalankan uji coba jam belajar yang dipangkas satu jam setiap hari. Tujuannya memberi ruang bagi kegiatan di luar kelas dan mengurangi kelelahan siswa.',
      'Para guru yang terlibat menyebut siswa tampak lebih segar pada jam-jam akhir. Sebagian orang tua, terutama yang bekerja hingga sore, mengaku kesulitan menyesuaikan jadwal penjemputan.',
      'Hasil uji coba akan dievaluasi bersama komite sekolah sebelum diputuskan apakah kebijakan diperluas. Evaluasi dijanjikan terbuka dan memuat suara siswa.',
    ) + note,
  },
  {
    type: 'berita', category: 'Ekonomi', author: 'bima', image: 'pasar', days: 1, tags: ['harga', 'pasar'],
    title: 'Harga Bahan Pokok di Pasar Tradisional Bergerak Tak Seragam Pekan Ini',
    subtitle: 'Pedagang menyebut pasokan dan cuaca menjadi faktor utama, sementara pembeli menyiasati dengan mengurangi porsi.',
    content: p(
      'Pantauan di beberapa pasar tradisional menunjukkan harga bahan pokok tidak bergerak searah. Sebagian komoditas naik tipis, yang lain justru turun karena pasokan melimpah.',
      'Pedagang menyebut ongkos angkut dan cuaca sebagai penyebab utama fluktuasi. Pembeli mengaku menyiasati kenaikan dengan mengganti jenis lauk atau membeli dalam jumlah lebih kecil.',
      'Pengamat menilai pemantauan harga yang terbuka dan mudah diakses warga akan membantu pembeli membandingkan sebelum berbelanja.',
    ) + note,
  },
  {
    type: 'berita', category: 'Lingkungan', author: 'sari', image: 'hutan', days: 2, tags: ['lingkungan', 'ruang-hijau'],
    title: 'Warga Menanam Ratusan Pohon di Lahan Kosong Bekas Pasar',
    subtitle: 'Gerakan swadaya ini diharapkan menjadi ruang teduh sekaligus tempat bermain anak-anak.',
    content: p(
      'Ratusan warga bergotong royong menanam pohon peneduh di lahan kosong bekas pasar yang selama bertahun-tahun terbengkalai.',
      'Penggagas gerakan mengatakan pemilihan jenis pohon dilakukan bersama warga agar mudah dirawat dan tidak mengganggu saluran air.',
      'Perawatan dijadwalkan bergilir oleh warga sekitar. Mereka berharap pemerintah daerah ikut memastikan status lahan agar tetap menjadi ruang publik.',
    ) + note,
  },
  {
    type: 'berita', category: 'Teknologi', author: 'raka', image: 'jaringan', days: 3, tags: ['internet', 'privasi'],
    title: 'Layanan Publik Digital Diminta Terbuka soal Penggunaan Data Warga',
    subtitle: 'Pegiat privasi mendorong penjelasan yang mudah dipahami tentang data apa yang dikumpulkan dan untuk apa.',
    content: p(
      'Seiring makin banyaknya layanan publik berpindah ke aplikasi, pegiat privasi meminta penyelenggara menjelaskan penggunaan data warga dengan bahasa yang sederhana.',
      'Mereka menekankan tiga hal: data yang dikumpulkan seperlunya, lama penyimpanan yang jelas, dan jalur bagi warga untuk meminta penghapusan.',
      'Penyelenggara layanan diharapkan menerbitkan ringkasan kebijakan privasi satu halaman di samping dokumen lengkapnya.',
    ) + note,
  },
  {
    type: 'opini', category: 'Opini', author: 'raka', image: 'jaringan', days: 1, tags: ['teknologi', 'warga'],
    title: 'Kita Butuh Literasi Digital yang Mengajarkan Curiga dengan Sehat',
    subtitle: 'Bukan sekadar bisa memakai aplikasi, melainkan tahu kapan sebuah informasi layak dipercaya.',
    content: p(
      'Literasi digital sering dipahami sebagai kemampuan memakai gawai. Padahal inti persoalan hari ini adalah kemampuan menimbang: dari mana kabar ini datang, siapa yang diuntungkan, dan apa buktinya.',
      'Curiga yang sehat berbeda dari sinis. Orang yang sinis menolak semua; orang yang curiga secara sehat memeriksa lalu memutuskan. Sekolah, keluarga, dan media punya andil melatih kebiasaan memeriksa itu.',
      'Latihan sederhana bisa dimulai dari hal kecil: membaca sampai habis sebelum membagikan, mencari sumber pertama, dan berani berkata “saya belum yakin”.',
    ) + note,
  },
  {
    type: 'opini', category: 'Opini', author: 'sari', image: 'sekolah', days: 4, tags: ['pendidikan', 'guru'],
    title: 'Guru Tidak Perlu Dipuji Setahun Sekali, Cukup Diberi Waktu untuk Mengajar',
    subtitle: 'Beban administrasi menggerus waktu yang seharusnya dipakai untuk mengenal murid satu per satu.',
    content: p(
      'Setiap perayaan hari guru, pujian mengalir. Sehari kemudian, tumpukan laporan kembali menanti. Banyak guru bercerita bahwa waktu terbesar mereka habis untuk mengisi format, bukan menyiapkan pelajaran.',
      'Menyederhanakan administrasi adalah bentuk penghargaan paling nyata. Satu laporan yang bisa dipakai untuk beberapa keperluan jauh lebih menolong daripada lima laporan dengan format berbeda.',
      'Jika kita ingin kualitas belajar naik, kembalikan waktu guru kepada ruang kelas.',
    ) + note,
  },
  {
    type: 'kritik', category: 'Kritik Sosial', author: 'bima', image: 'balai', days: 2, tags: ['kebijakan', 'transparansi'],
    title: 'Rapat yang Panjang, Keputusan yang Tak Pernah Sampai ke Warga',
    subtitle: 'Kritik terhadap kebiasaan musyawarah yang berhenti di notulen.',
    content: p(
      'Musyawarah adalah tradisi baik. Namun ia kehilangan makna ketika hasilnya hanya tersimpan sebagai notulen yang tidak pernah dibaca warga.',
      'Warga berhak tahu apa yang diputuskan, siapa penanggung jawabnya, dan kapan tenggatnya. Tanpa tiga hal itu, rapat hanyalah ritual.',
      'Usulan sederhana: setiap rapat diakhiri ringkasan keputusan satu halaman yang ditempel di papan pengumuman dan dibagikan lewat kanal warga.',
    ) + note,
  },
  {
    type: 'kritik', category: 'Kritik Sosial', author: 'laras', image: 'pasar', days: 6, tags: ['kota', 'trotoar'],
    title: 'Trotoar untuk Siapa? Catatan dari Pejalan Kaki yang Selalu Turun ke Jalan',
    subtitle: 'Trotoar yang dipakai berjualan, parkir, dan tiang membuat pejalan kaki tersingkir.',
    content: p(
      'Berjalan kaki seharusnya hal paling mudah di kota. Kenyataannya, banyak trotoar penuh hambatan sehingga pejalan kaki, termasuk penyandang disabilitas dan orang tua, terpaksa turun ke badan jalan.',
      'Mengkritik bukan berarti memusuhi pedagang atau pengendara. Persoalannya adalah penataan: ruang yang jelas untuk tiap kebutuhan, ditegakkan secara konsisten.',
      'Kota yang ramah pejalan kaki biasanya juga ramah anak, ramah lansia, dan ramah usaha kecil.',
    ) + note,
  },
  {
    type: 'artikel', category: 'Analisis', author: 'bima', image: 'pasar', days: 5, tags: ['ekonomi', 'data'],
    title: 'Membaca Angka Inflasi dengan Kacamata Rumah Tangga',
    subtitle: 'Mengapa angka rata-rata sering terasa berbeda dari pengalaman di dapur sendiri.',
    content: p(
      'Angka inflasi nasional adalah rata-rata dari keranjang barang dan jasa tertentu. Keluarga dengan pola belanja berbeda akan merasakan hal yang berbeda.',
      '<strong>Pertama</strong>, proporsi pengeluaran untuk makanan lebih besar pada rumah tangga berpenghasilan rendah, sehingga kenaikan harga pangan terasa lebih berat.',
      '<strong>Kedua</strong>, harga yang naik pelan tetapi terus-menerus sering lebih terasa daripada lonjakan sesaat.',
      'Karena itu, selain angka agregat, penting bagi pembuat kebijakan memantau harga komoditas yang paling sering dibeli rumah tangga kecil.',
    ) + note,
  },
  {
    type: 'artikel', category: 'Analisis', author: 'sari', image: 'balai', days: 8, tags: ['anggaran', 'warga'],
    title: 'Bagaimana Membaca Anggaran Desa Tanpa Jadi Akuntan',
    subtitle: 'Tiga pertanyaan sederhana yang membantu warga memahami dokumen anggaran.',
    content: p(
      'Dokumen anggaran sering terlihat menakutkan. Padahal warga bisa mulai dengan tiga pertanyaan: berapa uang yang masuk, ke mana saja uang itu dibelanjakan, dan apa hasil yang bisa dilihat.',
      'Bandingkan rencana dengan realisasi. Selisih besar bukan otomatis salah, tetapi layak dipertanyakan secara baik-baik di forum warga.',
      'Mintalah dokumen dalam bentuk ringkas dan angka yang bisa dibandingkan dari tahun ke tahun.',
    ) + note,
  },
  {
    type: 'artikel', category: 'Esai', author: 'laras', image: 'budaya', days: 7, tags: ['bahasa', 'budaya'],
    title: 'Bahasa yang Pelan-pelan Berubah di Meja Makan',
    subtitle: 'Sebuah esai tentang kata-kata keluarga yang tak tercatat di kamus.',
    content: p(
      'Di setiap keluarga ada kata yang hanya dimengerti anggotanya. Sebuah panggilan untuk piring tertentu, sebutan untuk lauk favorit, atau cara khas memanggil seseorang untuk makan.',
      'Kata-kata itu tidak masuk kamus, tetapi menyimpan ingatan. Ketika generasi berganti dan rumah-rumah menjadi lebih sunyi, kosakata kecil itu ikut menghilang tanpa upacara.',
      'Menuliskannya, barangkali, adalah cara paling sederhana untuk merawat sesuatu yang tampak remeh namun membentuk siapa kita.',
    ) + note,
  },
  {
    type: 'artikel', category: 'Budaya', author: 'laras', image: 'budaya', days: 9, tags: ['seni', 'komunitas'],
    title: 'Panggung Kecil di Gang Sempit: Seni yang Hidup dari Gotong Royong',
    subtitle: 'Kelompok seni warga bertahan dengan iuran kecil dan panggung seadanya.',
    content: p(
      'Di sebuah gang sempit, kelompok seni warga menggelar pertunjukan sebulan sekali. Panggungnya terbuat dari papan pinjaman, lampunya dari kabel sambungan tetangga.',
      'Mereka tidak menunggu dana besar. Iuran kecil, bantuan konsumsi dari ibu-ibu sekitar, dan tenaga sukarela membuat acara tetap berjalan.',
      'Pertunjukan mereka mungkin tidak sempurna, namun ruang berkumpul seperti ini membuat kampung terasa hidup.',
    ) + note,
  },
  {
    type: 'artikel', category: 'Lingkungan', author: 'sari', image: 'hutan', days: 10, tags: ['air', 'lingkungan'],
    title: 'Sungai Kota dan Kebiasaan Kecil yang Menentukan Nasibnya',
    subtitle: 'Dari sampah rumah tangga hingga saluran yang tak terawat: mengurai persoalan hulu ke hilir.',
    content: p(
      'Kondisi sungai kota mencerminkan kebiasaan kita sehari-hari. Sampah plastik, limbah cuci, dan saluran tersumbat berpadu menjadi masalah besar di hilir.',
      'Perbaikan tidak cukup lewat pengerukan. Pengelolaan sampah dari rumah, saluran yang rutin dibersihkan, dan penegakan aturan perlu berjalan bersamaan.',
      'Gerakan warga yang konsisten sering lebih efektif daripada kampanye besar yang sekali jadi.',
    ) + note,
  },
  {
    type: 'opini', category: 'Politik', author: 'bima', image: 'balai', days: 11, tags: ['politik', 'partisipasi'],
    title: 'Partisipasi Warga Tidak Berhenti di Bilik Suara',
    subtitle: 'Menagih janji dan mengawasi kebijakan adalah bagian dari demokrasi sehari-hari.',
    content: p(
      'Demokrasi sering diringkas menjadi lima menit di bilik suara. Padahal pengawasan terhadap kebijakan berlangsung setiap hari, dan di sanalah warga paling dibutuhkan.',
      'Bentuknya bisa sederhana: hadir di forum warga, membaca dokumen publik, atau mengirim pertanyaan tertulis kepada wakil rakyat.',
      'Semakin banyak warga yang terlibat dengan cara damai dan berbasis data, semakin sulit kebijakan dibuat tanpa mendengar mereka.',
    ) + note,
  },
];
