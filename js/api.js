/**
 * ============================================================
 * KONEKSI KE BACKEND GAS (js/api.js)
 * GET  ?action=getPublicData            → data publik
 * POST {"action": "...", "args": [...]} → semua aksi lain (lead, admin)
 * POST WAJIB Content-Type text/plain agar tidak terkena CORS preflight.
 * ============================================================
 */
const HAS_API = typeof GAS_URL === 'string' && /^https:\/\/script\.google\.com\/macros\/s\/.+\/exec/.test(GAS_URL.trim());

async function api(action, ...args) {
  if (!HAS_API) return DemoServer.call(action, args);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30000);
  try {
    const res = await fetch(GAS_URL.trim(), {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, args }),
      signal: ctrl.signal
    });
    if (!res.ok) throw new Error('Server merespons kode ' + res.status);
    const text = await res.text();
    try { return JSON.parse(text); }
    catch (e) {
      throw new Error(text.trim().startsWith('<')
        ? 'Server mengirim halaman HTML, bukan data. Cek: Kode.gs versi API sudah di-Deploy (New version) dan akses "Anyone".'
        : 'Respons server tidak valid.');
    }
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Koneksi ke server terlalu lama. Periksa internet lalu coba lagi.');
    if (err instanceof TypeError) throw new Error('Tidak bisa terhubung ke server. Periksa internet atau GAS_URL di js/config.js.');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
