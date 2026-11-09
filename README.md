# Website PT. Safar Wisata Madina — Frontend (GitHub Pages)

Frontend statis (HTML/CSS/JS) yang mengambil data dari backend **Google Apps Script** (REST API).

## Struktur
```
index.html          ← halaman utama (WAJIB di root repository)
css/style.css       ← tampilan
js/config.js        ← ⚙️ ISI GAS_URL DI SINI (satu-satunya file yang perlu diedit)
js/api.js           ← koneksi ke GAS (fetch)
js/app.js           ← website publik
js/admin.js         ← panel admin (#/admin)
js/demo-data.js     ← data contoh untuk mode demo
.nojekyll           ← agar GitHub Pages tidak memproses file (jangan dihapus)
```

## Alamat halaman
- Beranda: `/#/` · Jadwal: `/#/jadwal` · Umrah: `/#/umrah` · Haji: `/#/haji`
- Detail paket: `/#/paket/ID_PAKET` (bisa dibagikan ke WhatsApp)
- Panel admin: `/#/admin`

## Update website
```bash
git add .
git commit -m "Deskripsi perubahan"
git push
```
Perubahan **data** (paket, harga, video, testimoni) cukup lewat Panel Admin — tidak perlu push.
