# Backend Google Apps Script + Google Sheets

Backend untuk Jurnal Digital Sekolah. Backend menyimpan data terpusat di Google Sheets dan menyediakan login berbasis username, password hash SHA-256, session token, role, audit log, bootstrap data, sinkronisasi, dan ganti password.

## Struktur Sheet
Users, Settings, Teachers, Students, Classes, Journals, Attendance, Plans, Schedules, AuditLog.

## Instalasi
1. Buat Google Spreadsheet baru.
2. Buka Extensions → Apps Script.
3. Salin `Code.gs` dan `appsscript.json` dari folder ini.
4. Isi `CONFIG.SPREADSHEET_ID` dengan ID spreadsheet.
5. Jalankan `setupDatabase()` sekali dan berikan izin.
6. Deploy → New deployment → Web app.
7. Execute as: Me / User deploying.
8. Who has access: Anyone.
9. Salin URL `/exec`.
10. Buka `assets/js/backend.js` di repository dan isi `API_URL`.
11. Commit perubahan, lalu buka kembali GitHub Pages.

## Akun awal
- Username: `admin`
- Password awal: `Admin123!`

Segera ganti password setelah login.

## Catatan keamanan
Backend tidak menyimpan password plaintext. Session token disimpan sementara di Apps Script CacheService. Untuk produksi sekolah, gunakan HTTPS, batasi akses deployment bila semua pengguna berada dalam Google Workspace yang sama, lakukan backup spreadsheet, dan jangan menaruh data siswa sensitif di repository GitHub.

Google Apps Script mendukung Web App dengan `doGet/doPost` dan deployment melalui menu Deploy. Konfigurasi eksekusi dan akses web app tersedia melalui manifest. Lihat dokumentasi resmi Google sebelum deployment produksi.
