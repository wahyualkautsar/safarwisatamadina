# 📋 Panduan Migrasi — Backend GAS + Frontend GitHub Pages
**PT. Safar Wisata Madina · Arsitektur GAS-PRO-API (v2.0)**

```
[ GitHub Pages ]  ──fetch()──▶  [ Google Apps Script /exec ]  ──▶  [ Google Sheets ]
 index.html, css, js             Kode.gs (JSON API)                 data lama tetap utuh
```

---

## BAGIAN A — Backend (Google Apps Script)

Pakai **project Apps Script yang sama** dengan sebelumnya → Spreadsheet, paket, lead, dan PIN admin tetap utuh.

1. Buka project Apps Script **Safar Wisata Madina**.
2. Buka `Kode.gs` → hapus semua isinya → tempel isi **Kode.gs versi API** → **Ctrl+S**.
3. (Opsional, disarankan) Hapus file `Index.html`, `Stylesheet.html`, `JavaScript.html` — sudah tidak dipakai.
   Klik ⋮ di samping nama file → **Delete**.
4. Pilih fungsi **`setupAppEnvironment`** → ▶ **Run**.
   Aman dijalankan ulang: data lama tidak ditimpa, hanya menambah sheet **AppConfig** & mencatat ID ke Script Properties.
5. Pilih fungsi **`testApi`** → ▶ **Run** → log harus menampilkan `✅ API OK — paket: ...`.
6. **Deploy → Manage deployments → ✏️ → Version: New version → Deploy.**
   Salin URL yang berakhiran **`/exec`**.
7. Tes di browser: buka `URL_EXEC?action=ping` → harus tampil teks JSON `{"success":true, ... "API aktif"}`.

> ⚠️ Setelah langkah 6, alamat `/exec` **tidak lagi menampilkan website** — ia menjadi "mesin data" (API). Website-nya pindah ke GitHub Pages.
> Pengaturan deploy wajib: **Execute as: Me** · **Who has access: Anyone**.

---

## BAGIAN B — Isi alamat API di frontend

1. Ekstrak **safar-wisata-madina-web.zip** (klik kanan → *Extract All*).
2. Buka folder hasil ekstrak → `js` → `config.js` dengan Notepad.
3. Ubah baris:
   ```js
   const GAS_URL = '';
   ```
   menjadi (pakai URL /exec milik Anda, di antara tanda petik):
   ```js
   const GAS_URL = 'https://script.google.com/macros/s/AKfycb.../exec';
   ```
4. Simpan.

> Tanpa langkah ini website tetap bisa dibuka, tapi dalam **MODE DEMO** (pita kuning di bawah layar, data contoh).

---

## BAGIAN C — Upload ke GitHub Pages (lewat terminal)

> 📁 **Folder kerja = folder hasil ekstrak `safar-wisata-madina-web`** — yang isinya langsung `index.html`, `css`, `js`.
> Semua perintah `git` dijalankan **di folder ini**, bukan di folder induknya.
> ❌ Jangan pakai menu "Upload files" di web GitHub — struktur folder `css/` & `js/` akan rusak.

| Tahap | Perintah / aksi |
|---|---|
| 1. Install Git | https://git-scm.com/download/win (Next sampai selesai) → cek: `git --version` |
| 2. Akun GitHub | Daftar di https://github.com (username jadi bagian alamat website) |
| 3. Identitas (sekali saja) | `git config --global user.name "Nama Anda"` · `git config --global user.email "email@github"` |
| 4. Buat repository | github.com → **+ → New repository** → nama: `safar-wisata-madina` → **Public** → JANGAN centang README → Create |
| 5. Buka terminal di folder | Buka folder `safar-wisata-madina-web` di File Explorer → klik address bar → ketik `powershell` → Enter → `dir` (harus terlihat `index.html`) |
| 6. Push pertama | `git init` → `git add .` → `git commit -m "Upload pertama"` → `git branch -M main` → `git remote add origin https://github.com/USERNAME/safar-wisata-madina.git` → `git push -u origin main` |
| 7. Password | Isi **Personal Access Token** (bukan password akun) — buat di https://github.com/settings/tokens → *Generate new token (classic)* → centang **repo**. Saat di-paste layar tetap kosong: **normal**. |
| 8. Aktifkan Pages | Repo → **Settings → Pages** → Source: *Deploy from a branch* → Branch: **main** / **(root)** → Save → tunggu 1–2 menit |

Website online di: **`https://USERNAME.github.io/safar-wisata-madina/`**

---

## BAGIAN D — Uji setelah online

- [ ] Tidak ada pita kuning "MODE DEMO" → sudah tersambung ke GAS
- [ ] PPIU, paket, jadwal tampil sesuai Google Sheets
- [ ] Isi form konsultasi → WhatsApp terbuka → lead muncul di `Sheet_Lead`
- [ ] Buka `.../#/admin` → login Email + PIN → ubah paket → tampil di website
- [ ] Buka link `.../#/paket/ID_PAKET` dari HP lain → langsung ke detail paket
- [ ] F12 → Console: tidak ada tulisan merah

## Update ke depannya
| Jenis perubahan | Caranya |
|---|---|
| Data (paket, harga, kuota, video, testimoni, artikel, FAQ, nomor WA) | **Panel Admin** (`/#/admin`) — langsung tampil, tanpa push |
| Tampilan / fitur (file di folder ini) | Edit file → `git add .` → `git commit -m "..."` → `git push` |
| Logika server (Kode.gs) | Edit di Apps Script → **Deploy → Manage deployments → ✏️ → New version** |

## Troubleshooting
| Gejala | Solusi |
|---|---|
| Pita kuning MODE DEMO | `GAS_URL` di `js/config.js` masih kosong/salah → isi lalu push |
| "Server mengirim halaman HTML, bukan data" | Kode.gs versi API belum di-Deploy *New version*, atau akses bukan *Anyone* |
| Kotak merah "js/... gagal dimuat (404)" | Folder `js/` tidak ter-upload utuh — push ulang dari folder yang benar |
| Halaman 404 GitHub | `index.html` tidak di root repo, atau Pages belum diaktifkan (main / root) |
| Tampil versi lama | **Ctrl+Shift+R** atau buka di jendela Incognito |
