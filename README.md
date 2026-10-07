# Jurnal Digital Sekolah

Aplikasi web prototipe untuk jurnal digital guru dan administrasi akademik sekolah. Dibangun dengan HTML, CSS, dan JavaScript murni agar mudah dijalankan di GitHub Pages tanpa proses build.

## Fitur yang tersedia
- Dashboard ringkasan data sekolah dan aktivitas jurnal.
- CRUD (tambah, edit, hapus) jurnal mengajar.
- Rekap absensi kelas.
- Jadwal pelajaran mingguan.
- Perangkat ajar / perencanaan pembelajaran.
- Data guru, siswa, dan rombongan belajar.
- Rekap sederhana dan ekspor CSV.
- Pengaturan identitas sekolah.
- Unduh cadangan data JSON.
- Layout responsif untuk HP, tablet, dan desktop.
- Penyimpanan prototipe di `localStorage` browser.

## Menjalankan lokal
1. Unduh atau clone repositori.
2. Buka `index.html` menggunakan browser, atau gunakan ekstensi Live Server.
3. Data demo dapat diubah langsung melalui antarmuka.

## Deploy ke GitHub Pages
1. Buat repositori publik di akun GitHub.
2. Unggah seluruh isi folder ini ke root repositori.
3. Buka **Settings → Pages**.
4. Pilih **Deploy from a branch**, branch `main`, folder `/ (root)`, lalu simpan.
5. Tunggu proses deployment selesai dan buka URL GitHub Pages yang diberikan GitHub.

## Catatan penting sebelum digunakan secara nyata
Versi ini adalah **prototipe front-end**, bukan sistem produksi multi-pengguna. Data tersimpan di browser yang sedang digunakan, tidak otomatis tersinkron antarperangkat, dan belum memiliki autentikasi maupun otorisasi server. Jangan masukkan data pribadi siswa yang sensitif ke versi demo.

Untuk penggunaan operasional sekolah, tahap berikutnya adalah menambahkan backend (misalnya Google Apps Script + Google Sheets atau API/server database), login yang aman dan pembagian peran Admin/Kepala Sekolah/Guru/Wali Kelas, validasi server, audit log, kebijakan backup, serta pengujian integrasi. Hindari menyimpan password sebagai teks biasa atau menganggap login sisi-klien sebagai keamanan.

## Struktur
```text
.
├── index.html
├── README.md
└── assets/
    ├── css/style.css
    └── js/app.js
```

## Lisensi
Silakan sesuaikan lisensi dan identitas sekolah sebelum publikasi.
