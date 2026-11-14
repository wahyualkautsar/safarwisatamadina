/**
 * ============================================================
 * SAFAR WISATA MADINA — Frontend publik (js/app.js) — versi GitHub Pages
 * Prinsip:
 *  1. SPA: semua halaman sudah ada di DOM → navigasi 0 ms; URL hash (#/paket/ID) bisa dibagikan
 *  2. Data: cache localStorage tampil instan, lalu diperbarui dari GAS di latar belakang
 *  3. Filter/cari/urut 100% di client (tanpa panggil server)
 *  4. Optimistic UI: lead & CRUD admin langsung tampil, sinkron server di latar belakang
 * ============================================================
 */

// ════════════════════════════════════════════════════════
// BAGIAN 1: UTILITAS INTI
// ════════════════════════════════════════════════════════
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const esc = v => String(v === undefined || v === null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ja = v => esc(JSON.stringify(v));  // aman untuk argumen onclick="fn(...)"
const debounce = (fn, ms = 220) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

/**
 * Penyimpanan aman: beberapa browser (incognito, Safari, Brave, blokir cookie pihak ketiga)
 * MELARANG iframe Apps Script memakai localStorage/sessionStorage. Jika diblokir,
 * otomatis pindah ke memori agar aplikasi tetap berjalan normal.
 */
const store = (name) => {
  let area = null; const mem = {};
  try { area = window[name]; area.setItem('__swm_t', '1'); area.removeItem('__swm_t'); } catch (e) { area = null; }
  return {
    available: !!area,
    get(k, d) { try { const v = area ? area.getItem(k) : mem[k]; return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { const str = JSON.stringify(v); try { if (area) area.setItem(k, str); else mem[k] = str; } catch (e) { mem[k] = str; } },
    del(k) { try { if (area) area.removeItem(k); } catch (e) {} delete mem[k]; }
  };
};
const LS = store('localStorage');
const SSn = store('sessionStorage');

// Tampilkan error JavaScript di layar (bukan diam-diam di console) agar mudah dilacak
window.addEventListener('error', e => {
  try { toast('Terjadi kesalahan', (e.message || 'Error') + (e.lineno ? ' (baris ' + e.lineno + ')' : ''), 'danger', 8000); } catch (x) {}
});
window.addEventListener('unhandledrejection', e => {
  try { const m = e.reason && (e.reason.message || e.reason); toast('Terjadi kesalahan', String(m || 'Error'), 'danger', 8000); } catch (x) {}
});

const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

function parseDate(v) {
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) { const [y, m, d] = v.split('-').map(Number); return new Date(y, m - 1, d); }
  const d = new Date(v); return isNaN(d) ? null : d;
}
function todayISO() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function fmtDate(v, style = 'long') {
  const d = parseDate(v); if (!d) return '-';
  if (style === 'short') return `${d.getDate()} ${BLN[d.getMonth()]} ${d.getFullYear()}`;
  return `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
}
function fmtDateTime(v) {
  const d = parseDate(v); if (!d) return '-';
  return `${d.getDate()} ${BLN[d.getMonth()]} ${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function relTime(v) {
  const d = parseDate(v); if (!d) return '';
  const s = (Date.now() - d.getTime()) / 1000;
  if (s < 60) return 'baru saja';
  if (s < 3600) return Math.floor(s / 60) + ' menit lalu';
  if (s < 86400) return Math.floor(s / 3600) + ' jam lalu';
  if (s < 86400 * 30) return Math.floor(s / 86400) + ' hari lalu';
  return fmtDate(v, 'short');
}
const monthKey = v => { const d = parseDate(v); return d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` : ''; };
const monthLabel = k => { if (!k) return '-'; const [y, m] = k.split('-'); return `${BULAN[Number(m) - 1]} ${y}`; };
function fmtMoney(n, cur) {
  n = Number(n); if (!n) return '-';
  return (cur === 'USD' ? 'USD ' : 'Rp ') + n.toLocaleString('id-ID');
}
const minPrice = p => Math.min(...[p.Harga_Quad, p.Harga_Triple, p.Harga_Double].map(Number).filter(x => x > 0)) || 0;
const isHaji = p => /haji/i.test(p.Jenis || '');
const groupOf = p => isHaji(p) ? 'Haji' : 'Umrah';
function seatStatus(p) {
  const n = Number(p.Sisa_Kuota);
  if (p.Status === 'Penuh' || n <= 0) return { k: 'penuh', label: 'Kuota Penuh', cls: 'pill-danger', solid: 'pill-danger-solid' };
  if (n <= 5) return { k: 'terbatas', label: `Sisa ${n} Kursi`, cls: 'pill-warn', solid: 'pill-danger-solid' };
  return { k: 'tersedia', label: `Tersedia (${n} Kursi)`, cls: 'pill-emerald', solid: 'pill-ok' };
}
function imgHtml(url, alt, icon = 'bi-moon-stars') {
  return `<span class="ph-ic"><i class="bi ${icon}"></i></span>` +
    (url ? `<img src="${esc(url)}" alt="${esc(alt)}" loading="lazy" decoding="async" onerror="this.remove()">` : '');
}
const initials = n => String(n || '?').replace(/^(h\.|hj\.|drs\.|dr\.|ir\.|ust\.)\s*/i, '').split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
const stars = r => '★★★★★'.slice(0, Math.max(0, Math.min(5, Number(r) || 5))) + '<span style="opacity:.25">' + '★★★★★'.slice(Math.max(0, Math.min(5, Number(r) || 5))) + '</span>';

function normWa(v) {
  let d = String(v || '').replace(/\D/g, '');
  if (d.startsWith('0')) d = '62' + d.slice(1);
  else if (d.startsWith('8')) d = '62' + d;
  return d;
}
function waNumber() { return normWa(S.pub.config.Nomor_WA_CS || '6281288889912'); }
// ── Helper video (YouTube / mp4) ──
function ytId(url) { const m = String(url || '').match(/(?:youtu\.be\/|v=|shorts\/|embed\/|live\/)([\w-]{11})/); return m ? m[1] : null; }
const ytWatch = url => { const id = ytId(url); return id ? `https:\/\/www.youtube.com\/watch?v=${id}` : url; };
function videoThumb(v) {
  if (v.Thumbnail_URL) return v.Thumbnail_URL;
  const id = ytId(v.Video_URL);
  return id ? `https:\/\/i.ytimg.com\/vi\/${id}\/hqdefault.jpg` : '';
}
const videoCmp = (a, b) => ((b.Unggulan === 'Ya') - (a.Unggulan === 'Ya')) ||
  ((Number(a.Urutan_Tampil) || 999) - (Number(b.Urutan_Tampil) || 999)) || String(b.Tanggal).localeCompare(String(a.Tanggal));
const sortVideos = arr => [...arr].sort(videoCmp);
function waUrl(text, num) { return `https:\/\/wa.me/${num || waNumber()}?text=${encodeURIComponent(text || '')}`; }

/** Buka tautan eksternal di tab baru (tidak pernah mengubah URL iframe). */
function openExternal(url) {
  const w = window.open(url, '_blank', 'noopener');
  if (!w) toast('Buka WhatsApp', `<a href="${esc(url)}" target="_blank" rel="noopener">Ketuk di sini untuk membuka WhatsApp</a>`, 'info', 9000, true);
}

// ── Toast & modal ──
function toast(title, msg = '', type = 'info', ms = 3800, html = false) {
  const icon = { success: 'bi-check-circle-fill', danger: 'bi-x-octagon-fill', warning: 'bi-exclamation-triangle-fill', info: 'bi-info-circle-fill' }[type] || 'bi-info-circle-fill';
  const el = document.createElement('div');
  el.className = `toast-x ${type}`;
  el.setAttribute('role', type === 'danger' ? 'alert' : 'status');
  el.innerHTML = `<i class="bi ${icon}"></i><div class="flex-grow-1"><b>${esc(title)}</b>${msg ? `<div class="small text-muted">${html ? msg : esc(msg)}</div>` : ''}</div><button class="btn-close btn-sm" aria-label="Tutup"></button>`;
  el.querySelector('.btn-close').onclick = () => el.remove();
  $('#toastStack').appendChild(el);
  setTimeout(() => el.remove(), ms);
}
const modal = id => bootstrap.Modal.getOrCreateInstance(document.getElementById(id));
function confirmDialog(title, text, okLabel = 'Ya, Lanjutkan') {
  return new Promise(res => {
    $('#confirmTitle').textContent = title; $('#confirmText').textContent = text; $('#confirmOk').textContent = okLabel;
    const m = modal('confirmModal'); let ok = false;
    $('#confirmOk').onclick = () => { ok = true; m.hide(); };
    $('#confirmModal').addEventListener('hidden.bs.modal', () => res(ok), { once: true });
    m.show();
  });
}
function previewVideo(url, title) {
  const id = ytId(url);
  $('#previewTitle').textContent = title || 'Pratinjau Video';
  $('#previewBody').innerHTML = id
    ? `<div class="ratio ratio-16x9"><iframe src="https:\/\/www.youtube-nocookie.com\/embed\/${id}?autoplay=1&mute=1&playsinline=1&rel=0" allow="autoplay; encrypted-media; fullscreen" allowfullscreen title="${esc(title)}"></iframe></div>`
    : `<video src="${esc(url)}" controls autoplay muted playsinline class="w-100 rounded"></video>`;
  $('#previewDownload').href = ytWatch(url);
  $('#previewModal').addEventListener('hidden.bs.modal', () => { $('#previewBody').innerHTML = ''; }, { once: true });
  modal('previewModal').show();
}
/** Bagikan halaman saat ini (link #/paket/... bisa langsung dibuka penerima). */
function sharePage(title) {
  const url = location.href;
  if (navigator.share) return navigator.share({ title, text: title, url }).catch(() => {});
  openExternal('https://wa.me/?text=' + encodeURIComponent(title + ' — ' + url));
}
function previewImage(url, title) {
  if (!url) return;
  $('#previewTitle').textContent = title || 'Pratinjau';
  $('#previewBody').innerHTML = `<img src="${esc(url)}" class="img-fluid rounded" alt="${esc(title)}">`;
  $('#previewDownload').href = url;
  modal('previewModal').show();
}

// ════════════════════════════════════════════════════════
// BAGIAN 2: STATE APLIKASI
// ════════════════════════════════════════════════════════
const FILTER_DEFAULT = { q: '', jenis: '', bulan: '', maskapai: '', kota: '', sort: 'date', jenisGroup: '' };
const S = {
  pub: { config: {}, paket: [], testimoni: [], artikel: [], faq: [], video: [], socialProof: [] },
  vidCat: '',
  page: 'home', hist: [], rendered: {},
  filter: { ...FILTER_DEFAULT }, searchTab: 'Umrah',
  jSort: { k: 'Tanggal_Berangkat', dir: 1 }, blogCat: '',
  admin: { token: null, me: null, data: null, page: 'dashboard', leadStatus: '', leadQ: '', paketQ: '', paketStatus: '', listQ: {}, selected: new Set(), pending: new Set(), charts: {} }
};

/** Tampilkan cache dulu (instan), data segar menyusul dari server. */
function loadBoot() {
  const cached = LS.get('swm_boot', null);
  if (cached && Array.isArray(cached.paket)) { setPublicData(cached); S.booted = true; }
  else S.pubLoading = true;
}
function bootFromServer() {
  if (!HAS_API) {
    // Mode demo: GAS_URL belum diisi → pakai data contoh agar tampilan bisa dicek
    const s = document.createElement('script'); s.src = 'js/demo-data.js?v=20261114a';
    s.onload = () => { applyFreshPublic(window.DEMO_DATA || {}); showDemoRibbon(); };
    s.onerror = () => { S.pubLoading = false; applyFreshPublic({}); showDemoRibbon(); };
    document.head.appendChild(s);
    return;
  }
  Promise.resolve(window.__BOOT_PROMISE__ || api('getPublicData')).then(r => {
    if (!r || !r.success) throw new Error(r && r.message ? r.message : 'Tidak ada respons dari server');
    applyFreshPublic(r.data);
  }).catch(err => {
    S.pubLoading = false;
    if (!S.booted) { S.rendered = {}; renderHome(); if (S.page !== 'home') renderPage(S.page, true); }
    toast('Gagal memuat data terbaru', (err.message || String(err)) + (S.booted ? ' — menampilkan data tersimpan.' : ''), 'warning', 8000);
  });
}
function applyFreshPublic(d) {
  if (HAS_API) LS.set('swm_boot', d);
  S.pubLoading = false; S.booted = true;
  setPublicData(d); S.rendered = {};
  applyConfig(); renderHome();
  if (S.page === 'detail') renderDetail(S.lastOpts && S.lastOpts.id);
  else if (S.page === 'artikel') renderArtikel(S.lastOpts && S.lastOpts.id);
  else if (S.page !== 'home') renderPage(S.page, true);
}
function showDemoRibbon() {
  if (document.querySelector('.demo-ribbon')) return;
  const el = document.createElement('div'); el.className = 'demo-ribbon';
  el.textContent = 'MODE DEMO — isi GAS_URL di js/config.js untuk memakai data asli';
  document.body.appendChild(el);
}
function setPublicData(d) {
  const today = todayISO();
  S.pub = {
    config: d.config || {},
    // Publik: paket aktif/penuh yang belum berangkat
    paket: (d.paket || []).filter(p => p.Status !== 'Nonaktif' && (!p.Tanggal_Berangkat || p.Tanggal_Berangkat >= today))
      .sort((a, b) => String(a.Tanggal_Berangkat).localeCompare(String(b.Tanggal_Berangkat))),
    testimoni: d.testimoni || [], artikel: d.artikel || [], faq: d.faq || [],
    video: sortVideos((d.video || []).filter(v => v.Status_Tampil === 'Tampil' && v.Video_URL)),
    socialProof: d.socialProof || []
  };
}

// ════════════════════════════════════════════════════════
// BAGIAN 3: INISIALISASI
// ════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  applyTheme(LS.get('swm_theme', window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  loadBoot();
  applyConfig();
  renderHome();
  $('#year').textContent = new Date().getFullYear();

  const nav = $('#siteNav');
  window.addEventListener('scroll', () => nav.classList.toggle('scrolled', window.scrollY > 8), { passive: true });
  window.addEventListener('online', flushLeadQueue);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { toggleMobileMenu(false); toggleWaPanel(false); } });

  window.addEventListener('popstate', handleRoute);
  handleRoute();           // buka halaman sesuai URL (#/paket/ID, #/jadwal, #/admin, ...)
  bootFromServer();        // ambil data terbaru dari GAS
  setTimeout(flushLeadQueue, 2500);
  setTimeout(startSocialProof, 8000);
});

function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  $$('[onclick="toggleTheme()"] i').forEach(i => i.className = t === 'dark' ? 'bi bi-sun' : 'bi bi-moon');
}
function toggleTheme() {
  const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  applyTheme(next); LS.set('swm_theme', next);
  if (S.admin.data && S.admin.page === 'dashboard') renderCharts();
}

/** Isi semua elemen [data-cfg] dari Sheet_Konfigurasi. */
function applyConfig() {
  const c = S.pub.config;
  $$('[data-cfg]').forEach(el => { const v = c[el.dataset.cfg]; if (v !== undefined && v !== '') el.textContent = v; });
  if (c.Tagline) {
    const t = String(c.Tagline); const i = t.lastIndexOf(' ke ');
    $('#heroTitle').innerHTML = i > 0 ? `${esc(t.slice(0, i + 4))}<span>${esc(t.slice(i + 4))}</span>` : esc(t);
  }
  if (c.Hero_Gambar_URL) {
    const img = new Image(); img.onload = () => { $('#heroBg').style.backgroundImage = `url("${c.Hero_Gambar_URL}")`; }; img.src = c.Hero_Gambar_URL;
  }
  if (c.Link_Logo) ['#brandMark', '#brandMarkFooter'].forEach(s => { $(s).innerHTML = `<img src="${esc(c.Link_Logo)}" alt="Logo" onerror="this.remove()">`; });
  setupTicker(c);
  setupHeroVideo(c.Hero_Video_URL);
  const maps = $('#mapsBtn');
  maps.href = c.Maps_URL || `https:\/\/www.google.com/maps/search/${encodeURIComponent(c.Alamat || 'Safar Wisata Madina')}`;
  const soc = [['Instagram', 'bi-instagram'], ['Facebook', 'bi-facebook'], ['TikTok', 'bi-tiktok'], ['YouTube', 'bi-youtube']]
    .filter(([k]) => c[k]).map(([k, ic]) => `<a href="${esc(c[k])}" target="_blank" rel="noopener" aria-label="${k}"><i class="bi ${ic}"></i></a>`).join('');
  $('#socials').innerHTML = soc;

  const cs = [{ n: 'Customer Service 1', no: c.Nomor_WA_CS }, { n: 'Customer Service 2', no: c.Nomor_WA_CS2 }].filter(x => x.no);
  const msg = c.Pesan_WA_Default || 'Assalamualaikum, mohon informasi paket umrah & haji.';
  $('#waPanelBody').innerHTML = cs.map(x => `<a class="wa-contact" href="${esc(waUrl(msg, normWa(x.no)))}" target="_blank" rel="noopener">
      <span class="avatar" style="background:rgba(37,211,102,.14);color:var(--wa-strong)"><i class="bi bi-headset"></i></span>
      <div class="flex-grow-1"><b class="d-block small">${esc(x.n)}</b><small class="text-muted tnum">+${esc(normWa(x.no))}</small></div><i class="bi bi-chevron-right text-muted"></i></a>`).join('') +
    `<button class="btn btn-wa w-100 mt-1" onclick="toggleWaPanel(false);openLead('', 'Widget WA')"><i class="bi bi-ui-checks"></i> Isi Form Konsultasi</button>`;
  $('#csCards').innerHTML = cs.map(x => `<div class="col-sm-6"><div class="cs-card"><span class="ic"><i class="bi bi-whatsapp"></i></span>
      <div class="flex-grow-1"><span class="pill pill-emerald mb-1"><span class="dot"></span> Online</span><b class="d-block">${esc(x.n)}</b><small class="text-muted tnum">+${esc(normWa(x.no))}</small></div>
      <a class="btn btn-wa btn-sm" href="${esc(waUrl(msg, normWa(x.no)))}" target="_blank" rel="noopener">Chat</a></div></div>`).join('') +
    `<div class="col-12"><div class="cs-card"><span class="ic" style="background:var(--brand-50);color:var(--brand-strong)"><i class="bi bi-telephone"></i></span>
      <div class="flex-grow-1"><b class="d-block">Telepon Kantor</b><small class="text-muted tnum">${esc(c.Telepon || '-')} • ${esc(c.Jam_Operasional || '')}</small></div></div></div>`;
}

/** Teks berjalan: isi dari Teks_Berjalan (pisahkan dengan |), atau otomatis dari data legalitas. */
function setupTicker(c) {
  const items = String(c.Teks_Berjalan || '').split('|').map(x => x.trim()).filter(Boolean);
  if (!items.length) items.push('Terakreditasi Kemenag RI', 'PPIU No. ' + (c.Nomor_PPIU || '-'), 'Terverifikasi SISKOPATUH', '100% Kepastian Berangkat', 'Hotel Dekat Masjidil Haram & Nabawi', 'Bimbingan Sesuai Sunnah');
  const html = items.map(t => `<span>${esc(t)}</span>`).join('');
  $('#tickerTrack').innerHTML = html + html; // digandakan agar putaran mulus tanpa jeda
}

/**
 * Video latar hero. Mendukung:
 *  - Link YouTube (watch, youtu.be, shorts, embed) → disarankan, ringan & gratis
 *  - Link file .mp4 langsung
 * Video dimuat SETELAH halaman tampil (tidak memperlambat), dilewati jika
 * pengunjung mengaktifkan hemat data / kurangi animasi.
 */
let heroVideoUrl = null;
function setupHeroVideo(url) {
  url = String(url || '').trim();
  if (url === heroVideoUrl) return;
  heroVideoUrl = url;
  const box = $('#heroVideo'), hero = $('#hero');
  box.classList.remove('ready'); box.innerHTML = ''; hero.classList.remove('has-video');
  if (!url) return;
  const saveData = navigator.connection && navigator.connection.saveData;
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (saveData || reduce) return;

  const yt = ytId(url) ? [url, ytId(url)] : null;
  const load = () => {
    hero.classList.add('has-video');
    if (yt) {
      const id = yt[1];
      const q = 'autoplay=1&mute=1&loop=1&playlist=' + id + '&controls=0&playsinline=1&modestbranding=1&rel=0&disablekb=1&iv_load_policy=3&fs=0';
      box.innerHTML = `<iframe src="https:\/\/www.youtube-nocookie.com\/embed\/${id}?${q}" title="Video profil" allow="autoplay; encrypted-media; picture-in-picture" tabindex="-1" loading="eager"></iframe>`;
      setTimeout(() => box.classList.add('ready'), 1200); // beri waktu player siap agar tidak berkedip
    } else {
      const v = document.createElement('video');
      Object.assign(v, { src: url, muted: true, autoplay: true, loop: true, playsInline: true, preload: 'auto' });
      v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
      if (S.pub.config.Hero_Gambar_URL) v.poster = S.pub.config.Hero_Gambar_URL;
      v.addEventListener('playing', () => box.classList.add('ready'), { once: true });
      v.addEventListener('error', () => { box.innerHTML = ''; hero.classList.remove('has-video'); });
      box.appendChild(v);
      const p = v.play(); if (p && p.catch) p.catch(() => {});
    }
  };
  // Tunda sampai halaman selesai tampil → kesan "instan" tetap terjaga
  (window.requestIdleCallback || (fn => setTimeout(fn, 600)))(load);
}

// ════════════════════════════════════════════════════════
// BAGIAN 4: ROUTER SPA (0 ms, tanpa URL, tanpa server)
// ════════════════════════════════════════════════════════
const TITLES = { home: 'Beranda', katalog: 'Katalog Paket', detail: 'Detail Paket', jadwal: 'Jadwal Keberangkatan', testimoni: 'Testimoni', faq: 'FAQ', blog: 'Artikel', artikel: 'Artikel', dokumentasi: 'Dokumentasi Video' };

// ── URL hash: setiap halaman punya alamat sendiri (bisa dibagikan & tombol Back berfungsi) ──
function routeToHash(page, opts) {
  if (page === 'home') return '#/';
  if (page === 'katalog') return opts && opts.jenisGroup === 'Haji' ? '#/haji' : opts && opts.jenisGroup === 'Umrah' ? '#/umrah' : '#/katalog';
  if (page === 'detail') return '#/paket/' + encodeURIComponent((opts && opts.id) || '');
  if (page === 'artikel') {
    const a = S.pub.artikel.find(x => x.ID === (opts && opts.id) || x.Slug === (opts && opts.id));
    return '#/artikel/' + encodeURIComponent(a ? (a.Slug || a.ID) : ((opts && opts.id) || ''));
  }
  return '#/' + page;
}
function parseHash() {
  const raw = (location.hash || '').replace(/^#\/?/, '');
  const parts = raw.split('/'), p = parts[0] || '', arg = decodeURIComponent(parts.slice(1).join('/'));
  if (!p) return ['home'];
  if (p === 'umrah') return ['katalog', { jenisGroup: 'Umrah' }];
  if (p === 'haji') return ['katalog', { jenisGroup: 'Haji' }];
  if (p === 'katalog') return ['katalog', {}];
  if (p === 'paket') return ['detail', { id: arg }];
  if (p === 'artikel') return ['artikel', { id: arg }];
  if (p === 'admin') return ['admin'];
  return [TITLES[p] ? p : 'home'];
}
function handleRoute() {
  const [page, opts] = parseHash();
  if (page === 'admin') return openAdmin(true);
  if (!$('#adminApp').hidden) closeAdmin(true);
  go(page, opts, true);
}
function pushHash(hash) {
  if (location.hash !== hash && !(hash === '#/' && !location.hash)) history.pushState(null, '', hash);
}

function go(page, opts, noHistory) {
  toggleMobileMenu(false);
  if (!noHistory && S.page) S.hist.push({ page: S.page, opts: S.lastOpts });
  if (S.hist.length > 30) S.hist.shift();
  S.lastOpts = opts;
  if (!noHistory) pushHash(routeToHash(page, opts));

  if (page === 'katalog' && opts && typeof opts === 'object') S.filter = { ...FILTER_DEFAULT, ...opts };
  if (page === 'detail') renderDetail(opts && opts.id);
  if (page === 'artikel') renderArtikel(opts && opts.id);

  $$('.page').forEach(p => p.classList.toggle('active', p.id === 'page-' + page));
  const navKey = page === 'katalog' && S.filter.jenisGroup === 'Haji' ? 'haji' : page === 'detail' ? 'katalog' : page === 'artikel' ? 'blog' : page;
  $$('[data-nav]').forEach(a => { const on = a.dataset.nav === navKey; a.classList.toggle('active', on); on ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'); });
  S.page = page;
  renderPage(page);
  document.body.classList.toggle('has-mobile-book', page === 'detail');
  document.title = `${TITLES[page] || ''} — ${S.pub.config.Nama_Perusahaan || 'Safar Wisata Madina'}`;

  if (typeof opts === 'string') { const el = document.getElementById(opts); if (el) return el.scrollIntoView({ behavior: 'smooth' }); }
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
}
function goBack(fallback = 'home') {
  if (S.hist.length) { S.hist.pop(); history.back(); }
  else go(fallback, fallback === 'katalog' ? {} : undefined);
}
function renderPage(page, force) {
  if (page === 'katalog') return renderKatalog();
  if (page === 'jadwal') { if (force || !S.rendered.jadwal) { fillJadwalFilters(); S.rendered.jadwal = 1; } return renderJadwalTable(); }
  if (page === 'testimoni' && (force || !S.rendered.testimoni)) { renderTestiPage(); S.rendered.testimoni = 1; }
  if (page === 'faq' && (force || !S.rendered.faq)) { renderFaqPage(); S.rendered.faq = 1; }
  if (page === 'blog') renderBlog();
  if (page === 'dokumentasi') renderDokumentasi();
}
function toggleMobileMenu(show) {
  $('#mobileDrawer').classList.toggle('show', !!show);
  $('#drawerBackdrop').classList.toggle('show', !!show);
}
function toggleWaPanel(show) {
  const p = $('#waPanel'); p.classList.toggle('show', show === undefined ? !p.classList.contains('show') : show);
}

// ════════════════════════════════════════════════════════
// BAGIAN 5: KOMPONEN PUBLIK
// ════════════════════════════════════════════════════════
function pkgCard(p, col = 'col-md-6 col-lg-4') {
  const st = seatStatus(p), full = st.k === 'penuh';
  const id = ja(p.ID_Paket);
  return `<div class="${col}"><article class="pkg-card">
    <div class="pkg-media ${full ? 'full' : ''}" onclick="go('detail',{id:${id}})" role="link" aria-label="Detail ${esc(p.Nama_Paket)}">
      ${imgHtml(p.Gambar_URL, p.Nama_Paket, isHaji(p) ? 'bi-stars' : 'bi-moon-stars')}
      <div class="pkg-badges"><span class="pill ${p.Unggulan === 'Ya' ? 'pill-blue-solid' : ''}">${p.Unggulan === 'Ya' ? '<i class="bi bi-star-fill"></i> Favorit' : esc(p.Durasi_Hari ? p.Durasi_Hari + ' Hari' : p.Jenis)}</span><span class="pill"><i class="bi bi-airplane"></i> ${esc(p.Maskapai || '-')}</span></div>
      <div class="pkg-badges-bottom"><span class="pill ${st.solid}">${esc(st.label)}</span>${p.Unggulan === 'Ya' && p.Durasi_Hari ? `<span class="pill">${esc(p.Durasi_Hari)} Hari</span>` : ''}</div>
    </div>
    <div class="pkg-body">
      <span class="pkg-type">${esc(p.Jenis)} • ${esc(monthLabel(monthKey(p.Tanggal_Berangkat)))}</span>
      <h3 class="pkg-title" onclick="go('detail',{id:${id}})">${esc(p.Nama_Paket)}</h3>
      <ul class="pkg-meta">
        <li><i class="bi bi-building"></i><span>Makkah: ${esc(p.Hotel_Makkah || '-')}</span></li>
        <li><i class="bi bi-buildings"></i><span>Madinah: ${esc(p.Hotel_Madinah || '-')}</span></li>
        <li><i class="bi bi-calendar-event"></i><span class="tnum">${fmtDate(p.Tanggal_Berangkat)} • ${esc(p.Kota_Keberangkatan || '')}</span></li>
      </ul>
      <div class="pkg-foot">
        <div class="price-label">${full ? 'Biaya Paket' : 'Mulai dari (Quad)'}</div>
        <div class="price ${full ? 'price-strike' : ''}">${fmtMoney(minPrice(p), p.Mata_Uang)}</div>
        <div class="pkg-actions">
          <button class="btn btn-ghost btn-sm" onclick="go('detail',{id:${id}})">Detail Paket</button>
          <button class="btn btn-wa btn-sm" onclick="openLead(${ja(p.Nama_Paket)}, 'Katalog')"><i class="bi bi-whatsapp"></i> ${full ? 'Waiting List' : 'Daftar WA'}</button>
        </div>
      </div>
    </div></article></div>`;
}
const emptyState = (icon, text, extra = '') => S.pubLoading
  ? [1, 2, 3].map(() => '<div class="col-md-6 col-lg-4"><div class="skel skel-card"></div></div>').join('')
  : `<div class="col-12"><div class="empty"><i class="bi ${icon}"></i>${esc(text)}${extra}</div></div>`;

function scheduleRows(list, withMonthRow = true) {
  if (!list.length && S.pubLoading) return `<tbody>${'<tr><td colspan="8"><div class="skel" style="height:48px"></div></td></tr>'.repeat(4)}</tbody>`;
  if (!list.length) return `<tbody><tr><td colspan="8"><div class="empty"><i class="bi bi-calendar-x"></i>Belum ada jadwal yang sesuai.</div></td></tr></tbody>`;
  let html = '<tbody>', lastM = '';
  list.forEach(p => {
    const mk = monthKey(p.Tanggal_Berangkat);
    if (withMonthRow && mk !== lastM) { html += `<tr class="month-row"><td colspan="8"><i class="bi bi-calendar3"></i> ${monthLabel(mk)}</td></tr>`; lastM = mk; }
    const d = parseDate(p.Tanggal_Berangkat), st = seatStatus(p), id = ja(p.ID_Paket);
    html += `<tr>
      <td><div class="date-box"><span class="d tnum">${d ? d.getDate() : '-'}<small>${d ? BLN[d.getMonth()] : ''}</small></span><span class="cell-sub tnum">${d ? d.getFullYear() : ''}</span></div></td>
      <td><a href="javascript:void(0)" class="cell-title" onclick="go('detail',{id:${id}})">${esc(p.Nama_Paket)}</a><div class="cell-sub">${esc(p.Jenis)} • ${esc(p.Kota_Keberangkatan || '')}</div></td>
      <td><span class="cell-title" style="font-weight:600"><i class="bi bi-airplane text-primary"></i> ${esc(p.Maskapai || '-')}</span></td>
      <td><span class="pill pill-blue tnum">${esc(p.Durasi_Hari || '-')} Hari</span></td>
      <td><div class="cell-sub" style="color:var(--text)">${esc(p.Hotel_Makkah || '-')}</div><div class="cell-sub">${esc(p.Hotel_Madinah || '')}</div></td>
      <td><span class="price" style="font-size:1.05rem">${fmtMoney(p.Harga_Quad || minPrice(p), p.Mata_Uang)}</span></td>
      <td><span class="pill ${st.cls}">${esc(st.label)}</span></td>
      <td class="text-end"><button class="btn btn-${st.k === 'penuh' ? 'ghost' : 'wa'} btn-sm" onclick="openLead(${ja(p.Nama_Paket)}, 'Jadwal')">${st.k === 'penuh' ? 'Waiting List' : 'Lihat Seat'}</button></td>
    </tr>`;
  });
  return html + '</tbody>';
}
const SCHEDULE_HEAD = (sortable) => {
  const th = (k, l) => sortable && k ? `<th class="sortable" onclick="sortJadwal('${k}')" aria-sort="${S.jSort.k === k ? (S.jSort.dir > 0 ? 'ascending' : 'descending') : 'none'}">${l} ${S.jSort.k === k ? `<i class="bi bi-caret-${S.jSort.dir > 0 ? 'up' : 'down'}-fill"></i>` : ''}</th>` : `<th>${l}</th>`;
  return `<thead><tr>${th('Tanggal_Berangkat', 'Tanggal')}${th('Nama_Paket', 'Program & Rute')}${th('Maskapai', 'Maskapai')}${th('Durasi_Hari', 'Durasi')}<th>Hotel</th>${th('Harga', 'Harga Quad')}${th('Sisa_Kuota', 'Status Kuota')}<th class="text-end">Aksi</th></tr></thead>`;
};

function testiCard(t, col = 'col-md-6 col-lg-4') {
  return `<div class="${col}"><div class="testi">
    <div class="stars" aria-label="Rating ${esc(t.Rating || 5)} dari 5">${stars(t.Rating)}</div>
    <blockquote>“${esc(t.Isi_Testimoni)}”</blockquote>
    <div class="who"><span class="avatar">${t.Foto_URL ? `<img src="${esc(t.Foto_URL)}" alt="" loading="lazy" onerror="this.remove()">` : ''}${t.Foto_URL ? '' : esc(initials(t.Nama_Jamaah))}</span>
      <div><b>${esc(t.Nama_Jamaah)}</b><small>${esc(t.Paket_Diikuti || 'Jamaah')}${t.Tanggal ? ' • ' + fmtDate(t.Tanggal, 'short') : ''}</small></div></div>
  </div></div>`;
}
const faqItem = f => `<details class="faq-item"><summary>${esc(f.Pertanyaan)}</summary><div class="ans">${esc(f.Jawaban)}</div></details>`;
function postCard(a, col = 'col-md-6 col-lg-4') {
  const ex = String(a.Isi_Konten || '').replace(/\s+/g, ' ').slice(0, 130);
  return `<div class="${col}"><article class="post-card" onclick="go('artikel',{id:${ja(a.ID)}})" role="link" tabindex="0" onkeydown="if(event.key==='Enter')this.click()">
    <div class="post-media">${imgHtml(a.Gambar_Cover_URL, a.Judul, 'bi-journal-text')}<span class="pill">${esc(a.Kategori || 'Artikel')}</span></div>
    <div class="post-body"><small class="text-muted tnum"><i class="bi bi-calendar3"></i> ${fmtDate(a.Tanggal_Publish, 'short')}</small>
      <h3>${esc(a.Judul)}</h3><p>${esc(ex)}${ex.length >= 130 ? '…' : ''}</p>
      <span class="fw-bold small" style="color:var(--brand-strong)">Baca Selengkapnya <i class="bi bi-arrow-right"></i></span></div>
  </article></div>`;
}

// ════════════════════════════════════════════════════════
// BAGIAN 6: HALAMAN BERANDA
// ════════════════════════════════════════════════════════
function renderHome() {
  const P = S.pub.paket;
  $('#homeScheduleTable').innerHTML = SCHEDULE_HEAD(false) + scheduleRows(P.slice(0, 8));

  const fav = g => P.filter(p => groupOf(p) === g).sort((a, b) => (b.Unggulan === 'Ya') - (a.Unggulan === 'Ya') || (seatStatus(a).k === 'penuh') - (seatStatus(b).k === 'penuh')).slice(0, 3);
  const fu = fav('Umrah'), fh = fav('Haji');
  $('#favUmrah').innerHTML = fu.length ? fu.map(p => pkgCard(p)).join('') : emptyState('bi-airplane', 'Paket umrah segera hadir.');
  $('#favHaji').innerHTML = fh.length ? fh.map(p => pkgCard(p)).join('') : emptyState('bi-stars', 'Paket haji segera hadir. Hubungi CS untuk informasi kuota.');

  setSearchTab(S.searchTab);
  fillLeadSelects($('#hlPaket'), $('#hlRencana'));
  const prof = LS.get('swm_lead_profile', null);
  if (prof) { $('#hlNama').value = prof.Nama || ''; $('#hlWa').value = prof.No_WA || ''; }

  const T = S.pub.testimoni.slice(0, 3);
  $('#homeTesti').innerHTML = T.length ? T.map(t => testiCard(t)).join('') : emptyState('bi-chat-quote', 'Belum ada testimoni.');
  $('#homeFaq').innerHTML = S.pub.faq.slice(0, 5).map(faqItem).join('') || '<div class="empty"><i class="bi bi-question-circle"></i>Belum ada FAQ.</div>';
  renderHomeVideos();
  const A = S.pub.artikel.slice(0, 3);
  $('#homeBlog').innerHTML = A.length ? A.map(a => postCard(a)).join('') : emptyState('bi-journal-text', 'Belum ada artikel.');
}

function uniq(arr) { return [...new Set(arr.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b))); }
function fillSelect(el, items, allLabel, sel = '', labelFn = x => x) {
  el.innerHTML = `<option value="">${esc(allLabel)}</option>` + items.map(v => `<option value="${esc(v)}" ${v === sel ? 'selected' : ''}>${esc(labelFn(v))}</option>`).join('');
}
function setSearchTab(tab) {
  S.searchTab = tab;
  $$('[data-stab]').forEach(b => { b.classList.toggle('active', b.dataset.stab === tab); b.setAttribute('aria-selected', b.dataset.stab === tab); });
  $('#searchTitle').textContent = `Cari Paket ${tab} Terbaik`;
  const P = S.pub.paket.filter(p => groupOf(p) === tab);
  fillSelect($('#hsBulan'), uniq(P.map(p => monthKey(p.Tanggal_Berangkat))), 'Semua Bulan', '', monthLabel);
  fillSelect($('#hsJenis'), uniq(P.map(p => p.Jenis)), 'Semua Jenis');
  fillSelect($('#hsMaskapai'), uniq(P.map(p => p.Maskapai)), 'Semua Maskapai');
  fillSelect($('#hsKota'), uniq(P.map(p => p.Kota_Keberangkatan)), 'Semua Kota');
}
function runHomeSearch() {
  go('katalog', { jenisGroup: S.searchTab, bulan: $('#hsBulan').value, jenis: $('#hsJenis').value, maskapai: $('#hsMaskapai').value, kota: $('#hsKota').value });
}

// ════════════════════════════════════════════════════════
// BAGIAN 7: KATALOG (filter 100% client-side)
// ════════════════════════════════════════════════════════
function filteredPaket() {
  const f = S.filter, q = f.q.trim().toLowerCase();
  let list = S.pub.paket.filter(p =>
    (!f.jenisGroup || groupOf(p) === f.jenisGroup) && (!f.jenis || p.Jenis === f.jenis) &&
    (!f.bulan || monthKey(p.Tanggal_Berangkat) === f.bulan) && (!f.maskapai || p.Maskapai === f.maskapai) &&
    (!f.kota || p.Kota_Keberangkatan === f.kota) &&
    (!q || [p.Nama_Paket, p.Jenis, p.Maskapai, p.Hotel_Makkah, p.Hotel_Madinah, p.Kota_Keberangkatan, p.Fasilitas].join(' ').toLowerCase().includes(q)));
  const full = p => seatStatus(p).k === 'penuh' ? 1 : 0;
  const sorter = {
    date: (a, b) => full(a) - full(b) || String(a.Tanggal_Berangkat).localeCompare(String(b.Tanggal_Berangkat)),
    price: (a, b) => full(a) - full(b) || (a.Mata_Uang === b.Mata_Uang ? minPrice(a) - minPrice(b) : a.Mata_Uang === 'IDR' ? -1 : 1),
    seat: (a, b) => (Number(b.Sisa_Kuota) || 0) - (Number(a.Sisa_Kuota) || 0)
  }[f.sort] || (() => 0);
  return list.sort(sorter);
}
function renderKatalog() {
  const f = S.filter;
  const base = S.pub.paket.filter(p => !f.jenisGroup || groupOf(p) === f.jenisGroup);
  fillSelect($('#fJenis'), uniq(base.map(p => p.Jenis)), 'Semua Jenis', f.jenis);
  fillSelect($('#fBulan'), uniq(base.map(p => monthKey(p.Tanggal_Berangkat))), 'Semua Bulan', f.bulan, monthLabel);
  fillSelect($('#fMaskapai'), uniq(base.map(p => p.Maskapai)), 'Semua Maskapai', f.maskapai);
  fillSelect($('#fKota'), uniq(base.map(p => p.Kota_Keberangkatan)), 'Semua Kota', f.kota);
  $('#fQ').value = f.q; $('#fSort').value = f.sort;
  const title = f.jenisGroup === 'Haji' ? 'Paket Haji Khusus & Furoda' : f.jenisGroup === 'Umrah' ? 'Katalog Paket Umrah' : 'Katalog Lengkap Paket Umrah & Haji';
  $('#katalogTitle').textContent = title; $('#katalogCrumb').textContent = title;
  renderKatalogGrid();
}
function renderKatalogGrid() {
  const f = S.filter, list = filteredPaket();
  const chips = [];
  if (f.jenisGroup) chips.push(['jenisGroup', 'Kelompok: ' + f.jenisGroup]);
  if (f.jenis) chips.push(['jenis', f.jenis]);
  if (f.bulan) chips.push(['bulan', monthLabel(f.bulan)]);
  if (f.maskapai) chips.push(['maskapai', f.maskapai]);
  if (f.kota) chips.push(['kota', f.kota]);
  if (f.q) chips.push(['q', `"${f.q}"`]);
  $('#activeChips').innerHTML = chips.length ? `<span class="small fw-bold text-muted me-1">FILTER AKTIF:</span>` +
    chips.map(([k, l]) => `<button class="chip" onclick="clearFilter('${k}')" aria-label="Hapus filter ${esc(l)}">${esc(l)} <i class="bi bi-x-lg"></i></button>`).join('') +
    `<button class="btn btn-link btn-sm ms-auto" onclick="clearFilter()"><i class="bi bi-arrow-counterclockwise"></i> Reset Semua</button>` : '';
  $('#katalogCount').innerHTML = `Menampilkan <span style="color:var(--brand-strong)" class="tnum">${list.length}</span> paket perjalanan`;
  $('#katalogGrid').innerHTML = list.length ? list.map(p => pkgCard(p)).join('')
    : emptyState('bi-search', 'Tidak ada paket yang cocok dengan filter Anda.', `<div class="mt-3 d-flex flex-wrap gap-2 justify-content-center"><button class="btn btn-ghost" onclick="clearFilter()">Reset Filter</button><button class="btn btn-wa" onclick="openLead('', 'Katalog Kosong')"><i class="bi bi-whatsapp"></i> Minta Rekomendasi CS</button></div>`);
}
const debouncedGrid = debounce(renderKatalogGrid, 160);
function onFilterChange() {
  Object.assign(S.filter, { q: $('#fQ').value, jenis: $('#fJenis').value, bulan: $('#fBulan').value, maskapai: $('#fMaskapai').value, kota: $('#fKota').value, sort: $('#fSort').value });
  debouncedGrid();
}
function clearFilter(k) {
  if (!k) S.filter = { ...FILTER_DEFAULT, sort: S.filter.sort };
  else S.filter[k] = '';
  renderKatalog();
}

// ════════════════════════════════════════════════════════
// BAGIAN 8: DETAIL PAKET
// ════════════════════════════════════════════════════════
function renderDetail(id) {
  const p = S.pub.paket.find(x => x.ID_Paket === id) || (S.admin.data && S.admin.data.paket.find(x => x.ID_Paket === id));
  const wrap = $('#detailWrap');
  if (!p && S.pubLoading) { wrap.innerHTML = `<div class="container-xl py-5"><div class="skel" style="height:420px"></div></div>`; return; }
  if (!p) { wrap.innerHTML = `<div class="container-xl py-5">${emptyState('bi-exclamation-circle', 'Paket tidak ditemukan atau sudah tidak tersedia.', `<div class="mt-3"><button class="btn btn-brand" onclick="go('katalog',{})">Lihat Katalog</button></div>`)}</div>`; return; }
  const st = seatStatus(p), full = st.k === 'penuh', cur = p.Mata_Uang;
  const fas = String(p.Fasilitas || '').split(/\n|,(?![^(]*\))/).map(s => s.trim()).filter(Boolean);
  const related = S.pub.paket.filter(x => x.ID_Paket !== p.ID_Paket && groupOf(x) === groupOf(p)).slice(0, 3);
  const directMsg = `Assalamualaikum, saya ingin bertanya tentang paket "${p.Nama_Paket}" keberangkatan ${fmtDate(p.Tanggal_Berangkat)}.`;
  const room = [['Quad', 'Sekamar ber-4', p.Harga_Quad], ['Triple', 'Sekamar ber-3', p.Harga_Triple], ['Double', 'Sekamar ber-2', p.Harga_Double]].filter(r => Number(r[2]) > 0);

  wrap.innerHTML = `
  <div class="page-hero" style="padding-bottom:3rem"><div class="container-xl">
    <div class="crumb"><a href="javascript:void(0)" onclick="go('home')"><i class="bi bi-house"></i> Beranda</a> / <a href="javascript:void(0)" onclick="go('katalog',{jenisGroup:${ja(groupOf(p))}})">Paket ${esc(groupOf(p))}</a> / ${esc(p.Nama_Paket)}</div>
    <div class="d-flex flex-wrap gap-2 mt-2"><span class="pill pill-glass">${esc(p.Jenis)}</span><span class="pill ${st.cls}" style="background:#fff">${esc(st.label)}</span>${p.Unggulan === 'Ya' ? '<span class="pill pill-gold" style="background:#FFF6D6">★ Favorit Jamaah</span>' : ''}</div>
    <h1>${esc(p.Nama_Paket)}</h1>
    <p class="tnum"><i class="bi bi-calendar-event"></i> ${fmtDate(p.Tanggal_Berangkat)} • <i class="bi bi-airplane"></i> ${esc(p.Maskapai || '-')} • <i class="bi bi-geo-alt"></i> ${esc(p.Kota_Keberangkatan || '-')}</p>
  </div></div>
  <div class="container-xl py-4">
    <button class="btn btn-ghost btn-sm mb-3" onclick="goBack('katalog')"><i class="bi bi-arrow-left"></i> Kembali</button>
    <div class="row g-4">
      <div class="col-lg-8">
        <div class="detail-hero" ${full ? 'style="filter:grayscale(.7)"' : ''}>${imgHtml(p.Gambar_URL, p.Nama_Paket)}</div>
        ${p.Gambar_URL ? `<button class="btn btn-link btn-sm px-0" onclick="previewImage(${ja(p.Gambar_URL)}, ${ja(p.Nama_Paket)})"><i class="bi bi-arrows-fullscreen"></i> Perbesar foto</button>` : ''}
        <div class="info-grid mt-3">
          <div class="info-tile"><small><i class="bi bi-calendar-event"></i> Berangkat</small><b class="tnum">${fmtDate(p.Tanggal_Berangkat)}</b></div>
          <div class="info-tile"><small><i class="bi bi-hourglass-split"></i> Durasi</small><b class="tnum">${esc(p.Durasi_Hari || '-')} Hari</b></div>
          <div class="info-tile"><small><i class="bi bi-airplane"></i> Maskapai</small><b>${esc(p.Maskapai || '-')}</b></div>
          <div class="info-tile"><small><i class="bi bi-geo-alt"></i> Berangkat dari</small><b>${esc(p.Kota_Keberangkatan || '-')}</b></div>
          <div class="info-tile"><small><i class="bi bi-building"></i> Hotel Makkah</small><b>${esc(p.Hotel_Makkah || '-')}</b></div>
          <div class="info-tile"><small><i class="bi bi-buildings"></i> Hotel Madinah</small><b>${esc(p.Hotel_Madinah || '-')}</b></div>
        </div>
        <div class="card-x mt-4"><h2 class="h5">Tentang Paket</h2><p class="mb-0 text-muted" style="white-space:pre-line">${esc(p.Deskripsi || 'Hubungi CS kami untuk informasi lengkap paket ini.')}</p></div>
        ${fas.length ? `<div class="card-x mt-3"><h2 class="h5 mb-3">Fasilitas Termasuk</h2><ul class="fac-list">${fas.map(f => `<li><i class="bi bi-check-circle-fill"></i>${esc(f)}</li>`).join('')}</ul></div>` : ''}
        <div class="card-x mt-3"><h2 class="h5 mb-2">Syarat & Pendaftaran</h2><p class="small text-muted mb-2">Lihat dokumen persyaratan, ketentuan DP, dan pembatalan pada halaman FAQ.</p><button class="btn btn-outline-brand btn-sm" onclick="go('faq')">Baca FAQ <i class="bi bi-arrow-right"></i></button></div>
      </div>
      <div class="col-lg-4">
        <div class="card-x sticky-book">
          <span class="pill ${st.cls} mb-2">${esc(st.label)}</span>
          <div class="price-label">${full ? 'Biaya paket (kuota penuh)' : 'Mulai dari'}</div>
          <div class="price ${full ? 'price-strike' : ''}" style="font-size:1.7rem">${fmtMoney(minPrice(p), cur)}</div>
          <table class="room-table mt-2 mb-3">${room.map(r => `<tr><td><b>${r[0]}</b><div class="cell-sub">${r[1]}</div></td><td class="text-end price" style="font-size:1rem">${fmtMoney(r[2], cur)}</td></tr>`).join('')}</table>
          <button class="btn btn-wa btn-lg w-100 mb-2" onclick="openLead(${ja(p.Nama_Paket)}, 'Detail Paket')"><i class="bi bi-whatsapp"></i> ${full ? 'Daftar Waiting List' : 'Konsultasi Paket Ini'}</button>
          <a class="btn btn-ghost w-100" href="${esc(waUrl(directMsg))}" target="_blank" rel="noopener"><i class="bi bi-chat-dots"></i> Tanya Langsung via WA</a>
          <button class="btn btn-link btn-sm w-100 mt-1" onclick="sharePage(${ja(p.Nama_Paket)})"><i class="bi bi-share"></i> Bagikan Paket Ini</button>
          <p class="small text-muted mt-3 mb-0"><i class="bi bi-shield-check text-success"></i> Pembayaran hanya ke rekening resmi a.n. perusahaan. Harga dapat berubah mengikuti kurs & ketersediaan.</p>
        </div>
      </div>
    </div>
    ${related.length ? `<div class="section-head section-head-row mt-5"><div><span class="eyebrow">Pilihan Lain</span><h2>Paket ${esc(groupOf(p))} Lainnya</h2></div></div><div class="row g-3 g-lg-4">${related.map(x => pkgCard(x)).join('')}</div>` : ''}
  </div>
  <div class="mobile-book"><div class="flex-grow-1"><div class="price-label">Mulai dari</div><div class="price" style="font-size:1.1rem">${fmtMoney(minPrice(p), cur)}</div></div>
    <button class="btn btn-wa" onclick="openLead(${ja(p.Nama_Paket)}, 'Detail Paket')"><i class="bi bi-whatsapp"></i> ${full ? 'Waiting List' : 'Konsultasi'}</button></div>`;
}

// ════════════════════════════════════════════════════════
// BAGIAN 9: JADWAL, TESTIMONI, FAQ, BLOG
// ════════════════════════════════════════════════════════
function fillJadwalFilters() { fillSelect($('#jJenis'), uniq(S.pub.paket.map(p => p.Jenis)), 'Semua Jenis Paket', $('#jJenis').value); }
function sortJadwal(k) { S.jSort = { k, dir: S.jSort.k === k ? -S.jSort.dir : 1 }; renderJadwalTable(); }
function renderJadwalTable() {
  const q = $('#jQ').value.trim().toLowerCase(), j = $('#jJenis').value, s = $('#jStatus').value, { k, dir } = S.jSort;
  const val = p => k === 'Harga' ? minPrice(p) : ['Durasi_Hari', 'Sisa_Kuota'].includes(k) ? Number(p[k]) || 0 : String(p[k] || '');
  const list = S.pub.paket.filter(p => (!j || p.Jenis === j) && (!s || seatStatus(p).k === s) &&
    (!q || [p.Nama_Paket, p.Maskapai, p.Hotel_Makkah, p.Hotel_Madinah, p.Jenis, p.Kota_Keberangkatan].join(' ').toLowerCase().includes(q)))
    .sort((a, b) => { const x = val(a), y = val(b); return (typeof x === 'number' ? x - y : x.localeCompare(y)) * dir; });
  $('#jadwalTable').innerHTML = SCHEDULE_HEAD(true) + scheduleRows(list, k === 'Tanggal_Berangkat');
}
function renderTestiPage() {
  const T = S.pub.testimoni;
  $('#testiGrid').innerHTML = T.length ? T.map(t => testiCard(t)).join('') : emptyState('bi-chat-quote', 'Belum ada testimoni.');
}
function renderFaqPage() {
  const q = ($('#faqQ').value || '').trim().toLowerCase();
  const list = S.pub.faq.filter(f => !q || (f.Pertanyaan + ' ' + f.Jawaban).toLowerCase().includes(q));
  const groups = {};
  list.forEach(f => (groups[f.Kategori || 'Umum'] = groups[f.Kategori || 'Umum'] || []).push(f));
  $('#faqPage').innerHTML = Object.keys(groups).map(g => `<div class="faq-group-title">${esc(g)}</div>${groups[g].map(faqItem).join('')}`).join('')
    || `<div class="empty"><i class="bi bi-search"></i>Pertanyaan tidak ditemukan.<div class="mt-3"><button class="btn btn-wa" onclick="openLead('', 'FAQ')"><i class="bi bi-whatsapp"></i> Tanya CS</button></div></div>`;
}
function renderBlog() {
  const A = S.pub.artikel, cats = uniq(A.map(a => a.Kategori));
  $('#blogCats').innerHTML = ['', ...cats].map(c => `<button class="chip chip-btn ${S.blogCat === c ? 'active' : ''}" onclick="S.blogCat=${ja(c)};renderBlog()">${esc(c || 'Semua')}</button>`).join('');
  const list = A.filter(a => !S.blogCat || a.Kategori === S.blogCat);
  $('#blogGrid').innerHTML = list.length ? list.map(a => postCard(a)).join('') : emptyState('bi-journal-text', 'Belum ada artikel.');
}
function renderArtikel(id) {
  const a = S.pub.artikel.find(x => x.ID === id || x.Slug === id);
  const wrap = $('#artikelWrap');
  if (!a && S.pubLoading) { wrap.innerHTML = `<div class="container-xl py-5"><div class="skel" style="height:420px"></div></div>`; return; }
  if (!a) { wrap.innerHTML = `<div class="container-xl py-5">${emptyState('bi-journal-x', 'Artikel tidak ditemukan.')}</div>`; return; }
  const more = S.pub.artikel.filter(x => x.ID !== a.ID).slice(0, 3);
  const shareText = `${a.Judul} — ${S.pub.config.Nama_Perusahaan || ''}`;
  wrap.innerHTML = `<div class="container-xl"><article class="article">
    <button class="btn btn-ghost btn-sm mb-3" onclick="goBack('blog')"><i class="bi bi-arrow-left"></i> Kembali</button>
    <span class="eyebrow">${esc(a.Kategori || 'Artikel')}</span>
    <h1 class="mt-2" style="font-size:clamp(1.6rem,4vw,2.4rem)">${esc(a.Judul)}</h1>
    <p class="text-muted small tnum mb-0"><i class="bi bi-calendar3"></i> ${fmtDate(a.Tanggal_Publish)} • <i class="bi bi-person"></i> ${esc(a.Penulis || 'Tim Redaksi')}</p>
    <div class="article-cover">${a.Gambar_Cover_URL ? `<img src="${esc(a.Gambar_Cover_URL)}" alt="${esc(a.Judul)}" onerror="this.remove()">` : ''}</div>
    <div class="article-body">${esc(a.Isi_Konten)}</div>
    <div class="card-x mt-4 d-flex flex-wrap align-items-center gap-3 justify-content-between">
      <div><b>Ingin berangkat ke Tanah Suci?</b><div class="small text-muted">Konsultasikan jadwal & biaya dengan CS kami.</div></div>
      <div class="d-flex gap-2"><button class="btn btn-ghost btn-sm" onclick="sharePage(${ja(shareText)})"><i class="bi bi-share"></i> Bagikan</button>
      <button class="btn btn-wa btn-sm" onclick="openLead('', 'Artikel')"><i class="bi bi-whatsapp"></i> Konsultasi Gratis</button></div>
    </div>
  </article>
  ${more.length ? `<div class="pb-5"><h2 class="h4 mb-3">Artikel Lainnya</h2><div class="row g-3">${more.map(x => postCard(x)).join('')}</div></div>` : ''}</div>`;
}

// ════════════════════════════════════════════════════════
// BAGIAN 9B: VIDEO DOKUMENTASI — AUTOPLAY SAAT TERLIHAT
// Hanya 1 pemutar per area; dimuat saat tampil di layar, dijeda saat di-scroll lewat.
// ════════════════════════════════════════════════════════
const VP = {};
let vpObserver = null;
const canAutoplay = () => !(navigator.connection && navigator.connection.saveData) &&
  !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
function ytCmd(ifr, func, args = []) {
  try { ifr.contentWindow.postMessage(JSON.stringify({ event: 'command', func, args }), '*'); } catch (e) {}
}

function mountPlayer(cid, v) {
  const box = document.getElementById(cid); if (!box || !v) return;
  VP[cid] = { v, loaded: false, muted: true, el: null, isYt: false };
  const thumb = videoThumb(v), auto = canAutoplay();
  box.innerHTML = `<div class="vplayer-media" ${thumb ? `style="background-image:url('${esc(thumb)}')"` : ''}>
      ${auto ? '<div class="vp-spin"><div class="spinner-border spinner-border-sm" role="status" aria-label="Memuat video"></div></div>'
        : `<button class="vp-cover" onclick="loadPlayer('${cid}')" aria-label="Putar video"><span><i class="bi bi-play-fill"></i></span></button>`}
    </div>
    <div class="vplayer-info">
      <div style="min-width:0"><small>${esc(v.Kategori || 'Dokumentasi')}${v.Tanggal ? ' • ' + fmtDate(v.Tanggal, 'short') : ''}</small><h3>${esc(v.Judul)}</h3></div>
      <div class="d-flex gap-2">
        <button class="btn btn-sound btn-sm" id="${cid}_snd" onclick="toggleSound('${cid}')"><i class="bi bi-volume-mute"></i> Nyalakan Suara</button>
        ${ytId(v.Video_URL) ? `<a class="btn btn-sound btn-sm" href="${esc(ytWatch(v.Video_URL))}" target="_blank" rel="noopener" aria-label="Buka di YouTube"><i class="bi bi-youtube"></i></a>` : ''}
      </div>
    </div>`;
  if (!vpObserver && 'IntersectionObserver' in window) vpObserver = new IntersectionObserver(onPlayerVisibility, { threshold: 0.35 });
  if (vpObserver) { vpObserver.unobserve(box); vpObserver.observe(box); } // observe ulang → langsung dicek
  else if (auto) loadPlayer(cid);
}
function onPlayerVisibility(entries) {
  entries.forEach(e => {
    const cid = e.target.id, st = VP[cid]; if (!st) return;
    if (e.isIntersecting) { if (!st.loaded) { if (canAutoplay()) loadPlayer(cid); } else playerCmd(cid, 'play'); }
    else playerCmd(cid, 'pause');
  });
}
function loadPlayer(cid) {
  const st = VP[cid], media = document.querySelector('#' + cid + ' .vplayer-media');
  if (!st || !media || st.loaded) return;
  st.loaded = true;
  const url = st.v.Video_URL, id = ytId(url);
  let el;
  if (id) {
    el = document.createElement('iframe');
    el.src = `https:\/\/www.youtube-nocookie.com\/embed\/${id}?autoplay=1&mute=1&loop=1&playlist=${id}&controls=1&playsinline=1&modestbranding=1&rel=0&enablejsapi=1`;
    el.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    el.allowFullscreen = true; el.title = st.v.Judul || 'Video dokumentasi';
    el.addEventListener('load', () => setTimeout(() => media.classList.add('ready'), 500));
    st.isYt = true;
  } else if (/\.(mp4|webm|mov)(\?|#|$)/i.test(url)) {
    el = document.createElement('video');
    Object.assign(el, { src: url, muted: true, autoplay: true, loop: true, playsInline: true, controls: true, preload: 'auto' });
    el.setAttribute('muted', ''); el.setAttribute('playsinline', '');
    el.addEventListener('playing', () => media.classList.add('ready'), { once: true });
  } else {
    // Link lain (Instagram/TikTok) tidak bisa diputar otomatis → tombol buka di tab baru
    media.innerHTML = `<a class="vp-cover" href="${esc(url)}" target="_blank" rel="noopener" aria-label="Buka video"><span><i class="bi bi-box-arrow-up-right"></i></span></a>`;
    return;
  }
  const cover = media.querySelector('.vp-cover'); if (cover) cover.remove();
  media.appendChild(el); st.el = el;
  if (!st.isYt) { const p = el.play(); if (p && p.catch) p.catch(() => {}); }
}
function playerCmd(cid, action) {
  const st = VP[cid]; if (!st || !st.el) return;
  if (st.isYt) ytCmd(st.el, action === 'play' ? 'playVideo' : 'pauseVideo');
  else if (action === 'play') { const p = st.el.play(); if (p && p.catch) p.catch(() => {}); } else st.el.pause();
}
function toggleSound(cid) {
  const st = VP[cid]; if (!st) return;
  if (!st.loaded) loadPlayer(cid);
  st.muted = !st.muted;
  const apply = () => {
    if (!st.el) return;
    if (st.isYt) { ytCmd(st.el, st.muted ? 'mute' : 'unMute'); if (!st.muted) ytCmd(st.el, 'setVolume', [85]); ytCmd(st.el, 'playVideo'); }
    else { st.el.muted = st.muted; const p = st.el.play(); if (p && p.catch) p.catch(() => {}); }
  };
  st.el ? apply() : setTimeout(apply, 1500);
  const b = document.getElementById(cid + '_snd');
  if (b) { b.classList.toggle('on', !st.muted); b.innerHTML = st.muted ? '<i class="bi bi-volume-mute"></i> Nyalakan Suara' : '<i class="bi bi-volume-up"></i> Matikan Suara'; }
}
function videoThumbBtn(v, pid, withTitle = true) {
  const active = VP[pid] && VP[pid].v.ID === v.ID, th = videoThumb(v);
  return `<button class="vthumb ${active ? 'active' : ''}" onclick="playVideoIn(${ja(v.ID)}, '${pid}')" aria-label="Putar ${esc(v.Judul)}">
    ${th ? `<img src="${esc(th)}" alt="" loading="lazy" onerror="this.remove()">` : ''}
    <span class="vt-play"><i class="bi ${active ? 'bi-soundwave' : 'bi-play-fill'}"></i></span>
    ${withTitle ? `<span class="vt-title">${esc(v.Judul)}</span>` : ''}</button>`;
}
function playVideoIn(id, pid) {
  const v = S.pub.video.find(x => x.ID === id); if (!v) return;
  mountPlayer(pid, v);
  if (pid === 'vp_home') renderHomeVideoThumbs(); else renderVideoGrid();
  const box = document.getElementById(pid), r = box.getBoundingClientRect();
  if (r.top < 70 || r.bottom > window.innerHeight) box.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
function renderHomeVideos() {
  const V = S.pub.video, sec = $('#homeVideoSection');
  sec.hidden = !V.length; if (!V.length) return;
  $('#videoCount').textContent = V.length;
  const cur = VP.vp_home && V.find(x => x.ID === VP.vp_home.v.ID && x.Video_URL === VP.vp_home.v.Video_URL);
  if (!cur) mountPlayer('vp_home', V[0]);
  renderHomeVideoThumbs();
}
function renderHomeVideoThumbs() {
  const V = S.pub.video;
  $('#homeVideoThumbs').innerHTML = V.length > 1 ? V.slice(0, 4).map(v => `<div class="col-6 col-md-3">${videoThumbBtn(v, 'vp_home')}</div>`).join('') : '';
}
function renderDokumentasi() {
  const V = S.pub.video;
  const cats = uniq(V.map(v => v.Kategori));
  $('#videoCats').innerHTML = cats.length > 1 ? ['', ...cats].map(c => `<button class="chip chip-btn ${S.vidCat === c ? 'active' : ''}" onclick="S.vidCat=${ja(c)};renderVideoGrid();renderDokumentasiCats()">${esc(c || 'Semua')}</button>`).join('') : '';
  if (!V.length) { $('#vp_page').hidden = true; $('#videoGrid').innerHTML = emptyState('bi-camera-reels', 'Video dokumentasi segera hadir.'); return; }
  $('#vp_page').hidden = false;
  const cur = VP.vp_page && V.find(x => x.ID === VP.vp_page.v.ID && x.Video_URL === VP.vp_page.v.Video_URL);
  if (!cur) mountPlayer('vp_page', V[0]);
  renderVideoGrid();
}
function renderDokumentasiCats() {
  $$('#videoCats .chip').forEach(b => b.classList.toggle('active', b.textContent === (S.vidCat || 'Semua')));
}
function renderVideoGrid() {
  const list = S.pub.video.filter(v => !S.vidCat || v.Kategori === S.vidCat);
  $('#videoGrid').innerHTML = list.length ? list.map(v => `<div class="col-sm-6 col-lg-4"><div class="vcard">${videoThumbBtn(v, 'vp_page', false)}
      <div class="vc-body"><span class="pill pill-blue">${esc(v.Kategori || 'Dokumentasi')}</span><h3>${esc(v.Judul)}</h3>
      ${v.Deskripsi ? `<p class="small text-muted mb-1">${esc(String(v.Deskripsi).slice(0, 110))}</p>` : ''}<small class="text-muted tnum">${v.Tanggal ? fmtDate(v.Tanggal) : ''}</small></div></div></div>`).join('')
    : emptyState('bi-camera-reels', 'Belum ada video di kategori ini.');
}

// ════════════════════════════════════════════════════════
// BAGIAN 10: LEAD → WHATSAPP (Optimistic + antrean offline)
// ════════════════════════════════════════════════════════
function fillLeadSelects(selPaket, selRencana, chosen = '') {
  const names = uniq(S.pub.paket.map(p => p.Nama_Paket));
  if (chosen && !names.includes(chosen)) names.unshift(chosen);
  selPaket.innerHTML = `<option value="">Belum tahu / minta rekomendasi</option>` + names.map(n => `<option ${n === chosen ? 'selected' : ''}>${esc(n)}</option>`).join('');
  const d = new Date(); const opts = [];
  for (let i = 0; i < 15; i++) { const m = new Date(d.getFullYear(), d.getMonth() + i, 1); opts.push(`${BULAN[m.getMonth()]} ${m.getFullYear()}`); }
  selRencana.innerHTML = `<option value="">Belum ditentukan</option>` + opts.map(o => `<option>${o}</option>`).join('');
}
function openLead(paketName, source) {
  const f = $('#leadModalForm');
  f.classList.remove('was-validated'); $$('.is-invalid', f).forEach(x => x.classList.remove('is-invalid'));
  fillLeadSelects($('#lmPaket'), $('#lmRencana'), paketName || '');
  const p = S.pub.paket.find(x => x.Nama_Paket === paketName);
  if (p) { const mk = monthKey(p.Tanggal_Berangkat); if (mk) $('#lmRencana').value = monthLabel(mk); }
  $('#lmSumber').value = source || 'Landing';
  $('#leadModalTitle').textContent = paketName ? `Konsultasi: ${paketName}` : 'Konsultasi dengan CS Resmi';
  const prof = LS.get('swm_lead_profile', null);
  if (prof) { $('#lmNama').value = prof.Nama || ''; $('#lmWa').value = prof.No_WA || ''; }
  modal('leadModal').show();
  setTimeout(() => (prof ? $('#leadModalForm button[type=submit]') : $('#lmNama')).focus(), 350);
}
function submitLeadForm(e, form, source) {
  e.preventDefault();
  const fd = Object.fromEntries(new FormData(form).entries());
  const nama = (fd.Nama || '').trim(), wa = normWa(fd.No_WA);
  const nEl = form.querySelector('[name=Nama]'), wEl = form.querySelector('[name=No_WA]');
  nEl.classList.toggle('is-invalid', nama.length < 2);
  wEl.classList.toggle('is-invalid', wa.length < 10 || wa.length > 15 || !wa.startsWith('62'));
  if (nama.length < 2) return nEl.focus();
  if (wa.length < 10 || wa.length > 15 || !wa.startsWith('62')) return wEl.focus();

  const lead = { Nama: nama, No_WA: wa, Paket_Diminati: fd.Paket_Diminati || '', Rencana_Keberangkatan: fd.Rencana_Keberangkatan || '', Sumber_Halaman: source || fd.Sumber_Halaman || 'Landing', website: fd.website || '', _at: Date.now() };
  const text = `Assalamualaikum, halo ${S.pub.config.Nama_Perusahaan || 'Safar Wisata Madina'}. Saya ${nama}, tertarik dengan paket ${lead.Paket_Diminati || '(mohon rekomendasi)'}, rencana berangkat ${lead.Rencana_Keberangkatan || '(belum ditentukan)'}. Mohon informasinya.`;

  // 1) Buka WA SEKARANG (masih dalam gesture klik → tidak diblokir popup)
  openExternal(waUrl(text));
  // 2) UI instan
  LS.set('swm_lead_profile', { Nama: nama, No_WA: fd.No_WA });
  if (form.id === 'leadModalForm') modal('leadModal').hide();
  toast('Terima kasih!', 'Anda diarahkan ke WhatsApp CS resmi kami.', 'success');
  // 3) Simpan ke Sheet di latar belakang (antrean bertahan jika offline)
  const q = LS.get('swm_lead_queue', []); q.push(lead); LS.set('swm_lead_queue', q);
  flushLeadQueue();
}
let flushing = false;
function flushLeadQueue() {
  const q = LS.get('swm_lead_queue', []);
  if (flushing || !q.length) return;
  flushing = true;
  const item = q[0];
  api('submitLead', item).then(r => {
    // Berhasil, atau ditolak validasi server → keluarkan dari antrean
    LS.set('swm_lead_queue', LS.get('swm_lead_queue', []).slice(1));
    flushing = false;
    if (r && r.success === false) console.warn('Lead ditolak server:', r.message);
    flushLeadQueue();
  }).catch(err => { flushing = false; console.warn('Lead tertunda, akan dicoba lagi:', err); });
}

// ── Social proof (hanya dari lead nyata; nonaktif secara default) ──
function startSocialProof() {
  const list = S.pub.socialProof || [];
  if (!list.length) return;
  let i = 0;
  const show = () => {
    const x = list[i++ % list.length], el = $('#proofToast');
    el.innerHTML = `<span class="avatar" style="background:rgba(37,211,102,.14);color:var(--wa-strong)"><i class="bi bi-whatsapp"></i></span><div><b>${esc(x.nama)}</b> baru saja konsultasi<div class="text-muted">${esc(x.paket)} • ${esc(relTime(x.waktu))}</div></div>`;
    el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 6000);
  };
  show(); setInterval(show, 25000);
}
