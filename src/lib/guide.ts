import type { UiLang } from './store';

// In-app "How to use" guide. Plain data so it's easy to edit; rendered by pages/Guide.tsx.
// **text** renders bold.

export interface GuideSection {
  id: string;
  icon: string;
  title: string;
  intro?: string;
  steps: string[];
  tip?: string;
}

const en: GuideSection[] = [
  {
    id: 'what',
    icon: '🌙',
    title: 'What is Hafalan?',
    intro:
      'Hafalan keeps the ayat you have memorized fresh. Save the passages your teacher gave you, then read or listen to them, like a playlist, whenever they start to fade.',
    steps: [
      '**My Hafalan**: your saved passages.',
      '**Quran**: read or listen to any surah.',
      '**Settings**: reciter, translations, offline files, backup.',
    ],
  },
  {
    id: 'install',
    icon: '📲',
    title: 'Install it on your phone',
    intro: 'Installing makes Hafalan open like a normal app and keeps your offline files safe.',
    steps: [
      '**iPhone (Safari)**: tap the **Share** button (square with an arrow) → **Add to Home Screen** → **Add**.',
      '**Android (Chrome)**: tap **Install app** on the banner, or menu **⋮** → **Install app**.',
      '**Computer (Chrome/Edge)**: click the install icon at the right end of the address bar.',
      'From now on, always open Hafalan from its **icon**, not from the browser.',
    ],
    tip: 'On iPhone, files saved in Safari can be deleted after 7 days without a visit. The Home Screen app does not have this limit.',
  },
  {
    id: 'add',
    icon: '➕',
    title: 'Add a passage',
    intro: 'Example: your teacher gave you An-Naml ayat 89–93.',
    steps: [
      'On **My Hafalan**, tap **+ Add**.',
      'Search the surah by name or number (e.g. "naml" or "27") and tap it.',
      'Fill in **From ayah** (89) and **To ayah** (93).',
      'Optionally add a note, e.g. "From Ustadz, September".',
      'Tap **Save**. The audio and text download automatically, so it works offline.',
    ],
    tip: 'Another way: open the **Quran** tab → a surah → **Select ayat to add** → tap the first and last ayah → **Add … to hafalan**.',
  },
  {
    id: 'listen',
    icon: '🎧',
    title: 'Listen like a playlist',
    steps: [
      'Tap the **▶** button on a passage card, or open the passage and tap **Play**.',
      'The ayah being recited is **highlighted** and scrolls into view.',
      'Tap any ayah to start from there.',
      'You can lock your phone. Playback continues, and you can control it from the lock screen or with your **headset buttons**.',
      'The lock-screen **⟲10 / ⟳10** buttons jump to the previous / next ayah.',
      '**Play all** plays every passage in a row. **Play review** plays only the ones you haven\'t listened to for a while.',
    ],
    tip: 'Known iPhone issue: tapping the lock-screen player may open a different app. Open Hafalan from its icon instead; playback is not affected.',
  },
  {
    id: 'options',
    icon: '🔁',
    title: 'Player options for memorizing',
    intro: 'Tap the **⌃** arrow on the player bar at the bottom to open the options.',
    steps: [
      '**Repeat each ayah** (1×–10×): hear every ayah several times before moving on. Great for new or weak passages.',
      '**Pause after ayah**: silence after each ayah so **you** can recite it back. "Same as ayah" gives you exactly as long as the ayah took.',
      '**Speed**: slow down to 0.75× to follow tajwid, or speed up for quick review.',
      '**Reciter**: Syaikh Yasser Al-Dossari by default, 11 others available.',
      '**Loop**: when on, the passage starts again after the last ayah.',
    ],
    tip: 'A good routine: Repeat 3× + Pause "Same as ayah". Listen, then recite each ayah yourself right after.',
  },
  {
    id: 'test',
    icon: '🙈',
    title: 'Test yourself',
    steps: [
      'Open a passage and turn on **Test me**. The Arabic text gets blurred.',
      'Recite the ayah from memory, then **tap it to peek** and check.',
      'Turn **Translation** on or off with the button next to it.',
    ],
  },
  {
    id: 'review',
    icon: '⏰',
    title: "Muraja'ah reminders",
    steps: [
      'Each card shows when you last listened, e.g. "Listened 12 days ago".',
      'After 14 days (change it in Settings) a passage gets a **Needs review** tag.',
      'A banner on My Hafalan shows how many need review. Tap **Play review** to go through them.',
    ],
  },
  {
    id: 'offline',
    icon: '✈️',
    title: 'Use it without internet',
    steps: [
      'New passages are saved offline automatically. Cards show **✓ Offline** when ready.',
      'Settings → **Offline** shows "X of Y passages available offline" and has **Download all hafalan**.',
      'Check that it says **✓ Protected**. If not, tap **Protect offline files** so the phone doesn\'t delete them when storage is low.',
      'Changing the reciter downloads your hafalan again in the new voice (needs internet once).',
      'Deleting a passage frees its audio.',
    ],
  },
  {
    id: 'backup',
    icon: '💾',
    title: 'Backup and new phone',
    intro: 'Your hafalan list is stored only on this device; it is never uploaded.',
    steps: [
      'Settings → **Backup** → **Export backup** saves a small file. Keep it in Files, Drive or chat it to yourself.',
      'On a new phone, install Hafalan, then **Import backup** and pick that file.',
      'Make an export now and then, so you never lose your list.',
      'Hafalan sends **anonymous usage stats** (how often it is used, device type, country) to improve the app. Turn it off anytime in Settings → **Privacy**.',
    ],
  },
  {
    id: 'help',
    icon: '🛠️',
    title: 'Something not working?',
    steps: [
      '**No sound**: check the silent switch and volume; on iPhone, make sure you opened Hafalan from its icon.',
      '**Text or audio won\'t load**: you are probably offline and that passage wasn\'t saved yet. Connect once and tap **Save offline**.',
      '**App looks old**: close it fully and reopen. The version is shown at the bottom of Settings.',
      '**An error message appears**: tap **Reload**. If it keeps happening, send a screenshot of the message to the developer.',
    ],
  },
];

const id: GuideSection[] = [
  {
    id: 'what',
    icon: '🌙',
    title: 'Apa itu Hafalan?',
    intro:
      'Hafalan membantu menjaga ayat yang sudah kamu hafal agar tidak lupa. Simpan ayat dari gurumu, lalu baca atau dengarkan seperti playlist kapan pun hafalan mulai pudar.',
    steps: [
      '**Hafalanku**: daftar hafalan yang kamu simpan.',
      '**Al-Quran**: baca atau dengarkan surat mana pun.',
      '**Pengaturan**: qari, terjemahan, file offline, cadangan.',
    ],
  },
  {
    id: 'install',
    icon: '📲',
    title: 'Pasang di HP',
    intro: 'Dengan dipasang, Hafalan terbuka seperti aplikasi biasa dan file offline lebih aman.',
    steps: [
      '**iPhone (Safari)**: ketuk tombol **Bagikan** (kotak dengan panah) → **Tambah ke Layar Utama** → **Tambah**.',
      '**Android (Chrome)**: ketuk **Pasang aplikasi** di banner, atau menu **⋮** → **Instal aplikasi**.',
      '**Komputer (Chrome/Edge)**: klik ikon instal di ujung kanan kolom alamat.',
      'Setelah itu, selalu buka Hafalan dari **ikonnya**, bukan dari browser.',
    ],
    tip: 'Di iPhone, file yang tersimpan lewat Safari bisa terhapus setelah 7 hari tidak dibuka. Aplikasi di Layar Utama tidak punya batas ini.',
  },
  {
    id: 'add',
    icon: '➕',
    title: 'Menambah hafalan',
    intro: 'Contoh: gurumu memberi An-Naml ayat 89–93.',
    steps: [
      'Di **Hafalanku**, ketuk **+ Tambah**.',
      'Cari suratnya dengan nama atau nomor (mis. "naml" atau "27") lalu ketuk.',
      'Isi **Dari ayat** (89) dan **Sampai ayat** (93).',
      'Boleh tambahkan catatan, mis. "Dari Ustadz, September".',
      'Ketuk **Simpan**. Audio dan teks otomatis diunduh, jadi bisa dipakai offline.',
    ],
    tip: 'Cara lain: buka tab **Al-Quran** → pilih surat → **Pilih ayat untuk ditambah** → ketuk ayat pertama dan terakhir → **Tambah … ke hafalan**.',
  },
  {
    id: 'listen',
    icon: '🎧',
    title: 'Dengarkan seperti playlist',
    steps: [
      'Ketuk tombol **▶** di kartu hafalan, atau buka hafalan lalu ketuk **Putar**.',
      'Ayat yang sedang dibaca akan **disorot** dan otomatis terlihat.',
      'Ketuk ayat mana pun untuk mulai dari situ.',
      'HP boleh dikunci. Audio tetap jalan dan bisa dikontrol dari layar kunci atau **tombol headset**.',
      'Tombol **⟲10 / ⟳10** di layar kunci pindah ke ayat sebelumnya / berikutnya.',
      '**Putar semua** memutar semua hafalan berurutan. **Putar muraja\'ah** hanya memutar yang sudah lama tidak didengarkan.',
    ],
    tip: 'Masalah iPhone yang diketahui: mengetuk pemutar di layar kunci bisa membuka aplikasi lain. Buka Hafalan dari ikonnya saja; audio tidak terganggu.',
  },
  {
    id: 'options',
    icon: '🔁',
    title: 'Pengaturan pemutar untuk menghafal',
    intro: 'Ketuk panah **⌃** di bar pemutar bawah untuk membuka pengaturan.',
    steps: [
      '**Ulangi tiap ayat** (1×–10×): dengarkan tiap ayat beberapa kali sebelum lanjut. Cocok untuk hafalan baru atau yang masih lemah.',
      '**Jeda setelah ayat**: hening setelah tiap ayat agar **kamu** bisa melafalkannya. "Sepanjang ayat" memberi waktu sama dengan panjang ayatnya.',
      '**Kecepatan**: pelankan ke 0.75× untuk memperhatikan tajwid, atau percepat untuk muraja\'ah cepat.',
      '**Qari**: Syaikh Yasser Al-Dossari secara bawaan, ada 11 qari lain.',
      '**Ulang**: jika aktif, hafalan diputar lagi dari awal setelah ayat terakhir.',
    ],
    tip: 'Rutinitas yang bagus: Ulangi 3× + Jeda "Sepanjang ayat". Dengarkan, lalu langsung lafalkan sendiri tiap ayatnya.',
  },
  {
    id: 'test',
    icon: '🙈',
    title: 'Uji hafalanmu',
    steps: [
      'Buka hafalan dan aktifkan **Uji hafalan**. Teks Arab akan diburamkan.',
      'Lafalkan ayatnya dari ingatan, lalu **ketuk untuk mengintip** dan cek.',
      'Nyalakan atau matikan **Terjemahan** dengan tombol di sebelahnya.',
    ],
  },
  {
    id: 'review',
    icon: '⏰',
    title: "Pengingat muraja'ah",
    steps: [
      'Tiap kartu menunjukkan kapan terakhir didengarkan, mis. "Didengarkan 12 hari lalu".',
      'Setelah 14 hari (bisa diubah di Pengaturan) hafalan diberi tanda **Perlu muraja\'ah**.',
      'Banner di Hafalanku menunjukkan berapa yang perlu muraja\'ah. Ketuk **Putar muraja\'ah** untuk mengulanginya.',
    ],
  },
  {
    id: 'offline',
    icon: '✈️',
    title: 'Pakai tanpa internet',
    steps: [
      'Hafalan baru otomatis disimpan offline. Kartu menampilkan **✓ Offline** jika sudah siap.',
      'Pengaturan → **Offline** menampilkan "X dari Y hafalan tersedia offline" dan tombol **Unduh semua hafalan**.',
      'Pastikan tertulis **✓ Terlindungi**. Jika belum, ketuk **Lindungi file offline** agar HP tidak menghapusnya saat memori penuh.',
      'Mengganti qari akan mengunduh ulang hafalanmu dengan suara qari baru (perlu internet sekali).',
      'Menghapus hafalan juga menghapus audionya.',
    ],
  },
  {
    id: 'backup',
    icon: '💾',
    title: 'Cadangan dan HP baru',
    intro: 'Daftar hafalanmu hanya tersimpan di perangkat ini dan tidak pernah diunggah.',
    steps: [
      'Pengaturan → **Cadangan** → **Ekspor cadangan** menyimpan file kecil. Simpan di Files, Drive, atau kirim ke chat sendiri.',
      'Di HP baru, pasang Hafalan, lalu **Impor cadangan** dan pilih file tersebut.',
      'Ekspor sesekali agar daftar hafalanmu tidak hilang.',
      'Hafalan mengirim **statistik penggunaan anonim** (seberapa sering dipakai, jenis perangkat, negara) untuk pengembangan aplikasi. Bisa dimatikan kapan saja di Pengaturan → **Privasi**.',
    ],
  },
  {
    id: 'help',
    icon: '🛠️',
    title: 'Ada yang tidak berfungsi?',
    steps: [
      '**Tidak ada suara**: cek tombol senyap dan volume; di iPhone pastikan Hafalan dibuka dari ikonnya.',
      '**Teks atau audio tidak muncul**: kemungkinan kamu offline dan hafalan itu belum tersimpan. Sambungkan internet sekali lalu ketuk **Simpan offline**.',
      '**Tampilan aplikasi lama**: tutup aplikasi sepenuhnya lalu buka lagi. Versi tertera di bagian bawah Pengaturan.',
      '**Muncul pesan error**: ketuk **Reload**. Jika terus terjadi, kirim screenshot pesannya ke pengembang.',
    ],
  },
];

export const GUIDE: Record<UiLang, GuideSection[]> = { en, id };
