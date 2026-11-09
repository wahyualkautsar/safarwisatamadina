/**
 * ============================================================
 * SAFAR WISATA MADINA — Panel Admin (js/admin.js)
 * Login Email + PIN → token sesi (sessionStorage) dikirim di setiap request ke GAS.
 * CRUD optimistic: tampil instan, sinkron ke Google Sheets di latar belakang.
 * ============================================================
 */
// ════════════════════════════════════════════════════════
// BAGIAN 11: PANEL ADMIN — AUTENTIKASI
// ════════════════════════════════════════════════════════
function openAdmin(fromRoute) {
  try { toggleMobileMenu(false); toggleWaPanel(false); } catch (e) {}
  if (fromRoute !== true) pushHash('#/admin');
  $('#publicApp').hidden = true; $('#adminApp').hidden = false;
  window.scrollTo(0, 0);
  const token = SSn.get('swm_token', null);
  if (token) {
    S.admin.token = token; S.admin.me = SSn.get('swm_me', null);
    const cached = SSn.get('swm_admin_data', null);
    showAdminLayout();
    if (cached) { S.admin.data = cached; renderAdminPage(S.admin.page); }
    refreshAdmin();
  } else showLogin();
}
function closeAdmin(fromRoute) {
  $('#adminApp').hidden = true; $('#publicApp').hidden = false;
  if (fromRoute !== true) pushHash(routeToHash(S.page, S.lastOpts));
  toggleAdminSide(false);
  renderHome(); if (S.page !== 'home') renderPage(S.page, true);
  window.scrollTo(0, 0);
}
function showLogin() {
  $('#adminLogin').hidden = false; $('#adminLayout').hidden = true;
  setTimeout(() => $('#lgEmail').focus(), 50);
}
function showAdminLayout() {
  $('#adminLogin').hidden = true; $('#adminLayout').hidden = false;
  const me = S.admin.me || {};
  $('#meName').textContent = me.nama || 'Admin'; $('#meEmail').textContent = me.email || '-';
  $('#meAvatar').textContent = initials(me.nama || 'A');
  adminGo(S.admin.page || 'dashboard');
  if (!S._clock) { const tick = () => { const d = new Date(); $('#clock').textContent = `WIB ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; }; tick(); S._clock = setInterval(tick, 20000); }
}
function setBtnLoading(btn, on, label) {
  if (!btn) return;
  if (on) { btn.dataset.html = btn.innerHTML; btn.disabled = true; btn.innerHTML = `<span class="spinner-border spinner-border-sm"></span> ${label || 'Memproses…'}`; }
  else { btn.disabled = false; if (btn.dataset.html) btn.innerHTML = btn.dataset.html; }
}
function onLoginResult(r, btn) {
  setBtnLoading(btn, false);
  if (!r || !r.success) return toast('Gagal masuk', r ? r.message : 'Tidak ada respons server.', 'danger');
  S.admin.token = r.data.token; S.admin.me = { nama: r.data.nama, email: r.data.email, role: r.data.role };
  SSn.set('swm_token', r.data.token); SSn.set('swm_me', S.admin.me);
  $('#lgPin').value = '';
  toast('Selamat datang', `Assalamualaikum, ${r.data.nama}`, 'success');
  showAdminLayout(); refreshAdmin();
}
function handleLogin(e) {
  e.preventDefault();
  const email = $('#lgEmail').value.trim(), pin = $('#lgPin').value.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { $('#lgEmail').classList.add('is-invalid'); return $('#lgEmail').focus(); }
  if (pin.length < 6) { $('#lgPin').classList.add('is-invalid'); return $('#lgPin').focus(); }
  $$('#loginForm .is-invalid').forEach(x => x.classList.remove('is-invalid'));
  const btn = e.target.querySelector('button[type=submit]');
  setBtnLoading(btn, true, 'Memverifikasi…');
  api('adminLoginPin', email, pin).then(r => onLoginResult(r, btn)).catch(err => { setBtnLoading(btn, false); toast('Error', err.message || String(err), 'danger'); });
}
function handleLogout() {
  const t = S.admin.token;
  api('adminLogout', t).catch(() => {});
  S.admin.token = null; S.admin.me = null; S.admin.data = null;
  ['swm_token', 'swm_me', 'swm_admin_data'].forEach(k => SSn.del(k));
  showLogin(); toast('Anda telah keluar', '', 'info');
}
function handleAuthError(msg) {
  if (/SESI_TIDAK_VALID|AKSES_DITOLAK/.test(msg || '')) {
    ['swm_token', 'swm_me', 'swm_admin_data'].forEach(k => SSn.del(k));
    S.admin.token = null; S.admin.data = null;
    showLogin();
    toast(/AKSES/.test(msg) ? 'Akses ditolak' : 'Sesi berakhir', 'Silakan masuk kembali.', 'warning');
    return true;
  }
  return false;
}

// ════════════════════════════════════════════════════════
// BAGIAN 12: DATA ADMIN (1 panggilan, cache sessionStorage)
// ════════════════════════════════════════════════════════
function refreshAdmin(manual) {
  if (!S.admin.token) return;
  const btnIcon = $('[onclick="refreshAdmin(true)"] i'); if (btnIcon) btnIcon.className = 'spinner-border spinner-border-sm';
  if (!S.admin.data) $$('.apage').forEach(p => { if (p.classList.contains('active')) p.innerHTML = skeletonAdmin(); });
  setSync('syncing');
  api('getAdminData', S.admin.token).then(r => {
    if (btnIcon) btnIcon.className = 'bi bi-arrow-clockwise';
    if (!r.success) { setSync('error'); if (!handleAuthError(r.message)) toast('Gagal memuat data', r.message, 'danger'); return; }
    r.data.video = r.data.video || [];
    S.admin.data = r.data; S.admin.me = r.data.me; SSn.set('swm_admin_data', r.data);
    setSync('ok'); syncPublicFromAdmin(); renderAdminPage(S.admin.page);
    if (manual) toast('Data diperbarui', 'Sinkron dengan Google Sheets.', 'success', 2200);
  }).catch(err => { if (btnIcon) btnIcon.className = 'bi bi-arrow-clockwise'; setSync('error'); toast('Koneksi bermasalah', err.message || String(err), 'danger'); });
}
function setSync(state) {
  const p = $('#syncPill'); if (!p) return;
  const m = { ok: ['pill-emerald', 'Tersinkron Google Sheets'], syncing: ['pill-blue', 'Menyinkronkan…'], error: ['pill-danger', 'Gagal sinkron'] }[state];
  p.className = `pill ${m[0]} d-none d-md-inline-flex`; p.innerHTML = `<span class="dot"></span> ${m[1]}`;
}
const skeletonAdmin = () => `<div class="row g-3">${'<div class="col-6 col-xl-3"><div class="skel" style="height:120px"></div></div>'.repeat(4)}<div class="col-12"><div class="skel" style="height:320px"></div></div></div>`;

/** Turunkan data publik dari data admin → website langsung mencerminkan perubahan (tanpa reload). */
function syncPublicFromAdmin() {
  const d = S.admin.data; if (!d) return;
  setPublicData({
    config: d.config,
    paket: d.paket,
    testimoni: d.testimoni.filter(t => t.Status_Tampil === 'Tampil').sort((a, b) => String(b.Tanggal).localeCompare(String(a.Tanggal))),
    artikel: d.artikel.filter(a => a.Status_Publish === 'Terbit').sort((a, b) => String(b.Tanggal_Publish).localeCompare(String(a.Tanggal_Publish))),
    faq: [...d.faq].sort((a, b) => (Number(a.Urutan_Tampil) || 0) - (Number(b.Urutan_Tampil) || 0)),
    video: d.video || [],
    socialProof: S.pub.socialProof
  });
  S.rendered = {}; applyConfig();
  SSn.set('swm_admin_data', d);
  const nb = d.lead.filter(l => l.Status_Followup === 'Baru').length;
  $('#newLeadBadge').hidden = !nb; $('#newLeadBadge').textContent = nb;
}

// ════════════════════════════════════════════════════════
// BAGIAN 13: ROUTER ADMIN
// ════════════════════════════════════════════════════════
const ATITLES = { dashboard: 'Ringkasan Dashboard PPIU', lead: 'Lead & Konsultasi', paket: 'Paket & Jadwal', testimoni: 'Testimoni', artikel: 'Artikel / Blog', faq: 'FAQ', video: 'Video Dokumentasi', pengaturan: 'Pengaturan' };
function adminGo(page) {
  S.admin.page = page;
  $$('.apage').forEach(p => p.classList.toggle('active', p.id === 'apage-' + page));
  $$('[data-anav]').forEach(a => a.classList.toggle('active', a.dataset.anav === page));
  $('#adminTitle').textContent = ATITLES[page] || page;
  toggleAdminSide(false);
  renderAdminPage(page);
  window.scrollTo(0, 0);
}
function toggleAdminSide(show) { $('#adminSide').classList.toggle('show', !!show); $('#adminBackdrop').classList.toggle('show', !!show); }
function renderAdminPage(page) {
  const el = $('#apage-' + page);
  if (!S.admin.data) { el.innerHTML = skeletonAdmin(); return; }
  ({ dashboard: renderDashboard, lead: renderLeadPage, paket: renderPaketPage, testimoni: () => renderListPage('testimoni'), artikel: () => renderListPage('artikel'), faq: () => renderListPage('faq'), video: () => renderListPage('video'), pengaturan: renderSettings }[page] || (() => {}))();
}

// ════════════════════════════════════════════════════════
// BAGIAN 14: DASHBOARD + INSIGHT OTOMATIS + CHART (lazy)
// ════════════════════════════════════════════════════════
function renderDashboard() {
  const d = S.admin.data, L = d.lead, P = d.paket, now = Date.now(), DAY = 864e5;
  const inRange = (l, a, b) => { const t = parseDate(l.Timestamp); return t && now - t.getTime() >= a * DAY && now - t.getTime() < b * DAY; };
  const last30 = L.filter(l => inRange(l, 0, 30)).length, prev30 = L.filter(l => inRange(l, 30, 60)).length;
  const delta = prev30 ? Math.round((last30 - prev30) / prev30 * 100) : (last30 ? 100 : 0);
  const today = todayISO(), mk = today.slice(0, 7);
  const aktif = P.filter(p => p.Status === 'Aktif' && p.Tanggal_Berangkat >= today);
  const penuh = P.filter(p => (p.Status === 'Penuh' || Number(p.Sisa_Kuota) <= 0) && p.Status !== 'Nonaktif' && p.Tanggal_Berangkat >= today);
  const bulanIni = P.filter(p => p.Status !== 'Nonaktif' && monthKey(p.Tanggal_Berangkat) === mk);
  const baru = L.filter(l => l.Status_Followup === 'Baru');
  const kritis = P.filter(p => p.Status === 'Aktif' && p.Tanggal_Berangkat >= today && Number(p.Sisa_Kuota) > 0 && Number(p.Sisa_Kuota) <= 5)
    .sort((a, b) => Number(a.Sisa_Kuota) - Number(b.Sisa_Kuota));

  $('#apage-dashboard').innerHTML = `
  <div class="row g-3 mb-3">
    <div class="col-6 col-xl-3"><div class="kpi"><span class="kpi-ic"><i class="bi bi-person-lines-fill"></i></span><div class="kpi-label">Total Lead Masuk</div><div class="kpi-value">${L.length}</div><small class="${delta >= 0 ? 'text-success' : 'text-danger'} fw-bold"><i class="bi bi-graph-${delta >= 0 ? 'up' : 'down'}-arrow"></i> ${delta >= 0 ? '+' : ''}${delta}%</small> <small class="text-muted">30 hari vs sebelumnya</small></div></div>
    <div class="col-6 col-xl-3"><div class="kpi"><span class="kpi-ic"><i class="bi bi-airplane"></i></span><div class="kpi-label">Paket Aktif Tayang</div><div class="kpi-value">${aktif.length}</div>${penuh.length ? `<span class="pill pill-danger">${penuh.length} Kuota Penuh</span>` : '<small class="text-muted">Semua kuota tersedia</small>'}</div></div>
    <div class="col-6 col-xl-3"><div class="kpi"><span class="kpi-ic" style="background:var(--gold-bg);color:var(--gold-ink)"><i class="bi bi-people"></i></span><div class="kpi-label">Berangkat Bulan Ini</div><div class="kpi-value">${bulanIni.length} <small style="font-size:1rem">Grup</small></div><small class="text-muted">${monthLabel(mk)}</small></div></div>
    <div class="col-6 col-xl-3"><div class="kpi ${baru.length ? 'alert-kpi' : ''}"><span class="kpi-ic"><i class="bi bi-bell"></i></span><div class="kpi-label">Perlu Follow-up</div><div class="kpi-value">${baru.length} <small style="font-size:1rem">Lead</small></div><a href="javascript:void(0)" class="small fw-bold" onclick="S.admin.leadStatus='Baru';adminGo('lead')">Proses sekarang <i class="bi bi-arrow-right"></i></a></div></div>
  </div>
  <div class="row g-3">
    <div class="col-xl-8">
      <div class="panel mb-3">
        <div class="panel-head"><div><h2><i class="bi bi-chat-square-text text-primary"></i> Lead & Konsultasi Terbaru</h2><p>Data otomatis dari form website</p></div><button class="btn btn-brand btn-sm" onclick="adminGo('lead')">Semua Lead <i class="bi bi-arrow-right"></i></button></div>
        <div class="table-wrap"><table class="table-x">${leadTableHead(false)}<tbody>${L.slice(0, 6).map(l => leadRow(l, false)).join('') || `<tr><td colspan="7"><div class="empty"><i class="bi bi-inbox"></i>Belum ada lead.</div></td></tr>`}</tbody></table></div>
      </div>
      <div class="row g-3">
        <div class="col-md-7"><div class="panel h-100"><div class="panel-head"><h2>Tren Lead 14 Hari</h2></div><div class="panel-body"><div class="chart-box"><canvas id="chLeadTrend" aria-label="Grafik tren lead"></canvas></div></div></div></div>
        <div class="col-md-5"><div class="panel h-100"><div class="panel-head"><h2>Status Follow-up</h2></div><div class="panel-body"><div class="chart-box"><canvas id="chLeadStatus" aria-label="Grafik status lead"></canvas></div></div></div></div>
      </div>
    </div>
    <div class="col-xl-4">
      <div class="insight mb-3"><h3><i class="bi bi-stars"></i> Analisis Otomatis</h3><ul class="mb-0 ps-3">${buildInsights().map(i => `<li>${i}</li>`).join('')}</ul></div>
      <div class="panel mb-3"><div class="panel-head"><h2 class="text-danger"><i class="bi bi-exclamation-triangle"></i> Kuota Menipis</h2>${kritis.length ? `<span class="pill pill-danger">${kritis.length} Paket Kritis</span>` : ''}</div>
        <div class="panel-body">${kritis.slice(0, 4).map(p => `<div class="quota-item"><div class="d-flex justify-content-between gap-2"><b class="small">${esc(p.Nama_Paket)}</b><span class="pill pill-danger">Sisa ${esc(p.Sisa_Kuota)}</span></div>
          <div class="cell-sub">${fmtDate(p.Tanggal_Berangkat, 'short')} • ${esc(p.Maskapai || '')}</div><div class="bar"><span style="width:${Math.max(10, 100 - Number(p.Sisa_Kuota) * 15)}%;background:${Number(p.Sisa_Kuota) <= 2 ? 'var(--danger)' : 'var(--brand-strong)'}"></span></div></div>`).join('') || '<p class="small text-muted mb-0">Tidak ada paket dengan sisa kursi ≤ 5.</p>'}
          <button class="btn btn-brand w-100 mt-2" onclick="adminGo('paket')"><i class="bi bi-plus-square"></i> Kelola Kuota / Jadwal</button></div></div>
      <div class="panel"><div class="panel-head"><h2>Pintasan</h2></div><div class="panel-body d-grid gap-2">
        <button class="btn btn-brand" onclick="openForm('paket')"><i class="bi bi-plus-circle"></i> Tambah Paket Baru</button>
        <button class="btn btn-ghost" onclick="exportLeadsCsv()"><i class="bi bi-filetype-csv"></i> Export Lead (CSV)</button>
        <a class="btn btn-ghost" href="${esc(d.spreadsheetUrl || '#')}" target="_blank" rel="noopener"><i class="bi bi-table"></i> Buka Google Sheets</a>
        <button class="btn btn-ghost" onclick="clearCache(this)"><i class="bi bi-lightning-charge"></i> Perbarui Cache Website</button>
      </div></div>
    </div>
  </div>`;
  renderCharts();
}
function buildInsights() {
  const d = S.admin.data, L = d.lead, out = [];
  if (!L.length) return ['Belum ada lead. Bagikan link website di WhatsApp Story & Instagram untuk memancing konsultasi pertama.'];
  const deal = L.filter(l => l.Status_Followup === 'Deal').length;
  out.push(`Konversi lead → <b>Deal</b>: <b>${(deal / L.length * 100).toFixed(1)}%</b> (${deal} dari ${L.length} lead).`);
  const cnt = k => Object.entries(L.reduce((a, l) => { const v = l[k] || 'Tidak diisi'; a[v] = (a[v] || 0) + 1; return a; }, {})).sort((a, b) => b[1] - a[1]);
  const tp = cnt('Paket_Diminati')[0]; if (tp) out.push(`Paket paling diminati: <b>${esc(tp[0])}</b> (${tp[1]} lead).`);
  const ts = cnt('Sumber_Halaman')[0]; if (ts) out.push(`Sumber lead terbanyak: halaman <b>${esc(ts[0])}</b>.`);
  const stale = L.filter(l => l.Status_Followup === 'Baru' && Date.now() - (parseDate(l.Timestamp) || new Date()).getTime() > 864e5).length;
  if (stale) out.push(`<b>${stale} lead</b> berstatus "Baru" lebih dari 24 jam — segera hubungi agar tidak dingin.`);
  const last7 = L.filter(l => Date.now() - (parseDate(l.Timestamp) || 0) < 7 * 864e5).length;
  out.push(`Rata-rata <b>${(last7 / 7).toFixed(1)}</b> lead/hari dalam 7 hari terakhir.`);
  return out;
}
function loadChartJs() {
  if (window.Chart) return Promise.resolve();
  if (!S._chartP) S._chartP = new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https:\/\/cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  return S._chartP;
}
function renderCharts() {
  if (!$('#chLeadTrend')) return;
  loadChartJs().then(() => {
    const L = S.admin.data.lead, dark = document.documentElement.getAttribute('data-theme') === 'dark';
    const tc = dark ? '#A3B1C6' : '#475569', gc = dark ? 'rgba(255,255,255,.06)' : 'rgba(15,23,42,.06)';
    Object.values(S.admin.charts).forEach(c => c.destroy());
    const days = [...Array(14)].map((_, i) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - 13 + i); return d; });
    const counts = days.map(d => L.filter(l => { const t = parseDate(l.Timestamp); return t && t.toDateString() === d.toDateString(); }).length);
    S.admin.charts.trend = new Chart($('#chLeadTrend'), {
      type: 'bar', data: { labels: days.map(d => `${d.getDate()} ${BLN[d.getMonth()]}`), datasets: [{ label: 'Lead', data: counts, backgroundColor: '#1E93F3', borderRadius: 6, maxBarThickness: 26 }] },
      options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: tc, maxRotation: 0, autoSkip: true }, grid: { display: false } }, y: { beginAtZero: true, ticks: { color: tc, precision: 0 }, grid: { color: gc } } } }
    });
    const st = ['Baru', 'Dihubungi', 'Deal', 'Batal'];
    S.admin.charts.status = new Chart($('#chLeadStatus'), {
      type: 'doughnut', data: { labels: st, datasets: [{ data: st.map(s => L.filter(l => l.Status_Followup === s).length), backgroundColor: ['#F59E0B', '#1E93F3', '#10B981', '#94A3B8'], borderWidth: 0 }] },
      options: { maintainAspectRatio: false, cutout: '62%', plugins: { legend: { position: 'bottom', labels: { color: tc, boxWidth: 12, padding: 12 } } } }
    });
  }).catch(() => { $$('.chart-box').forEach(b => b.innerHTML = '<p class="small text-muted">Grafik tidak dapat dimuat (offline).</p>'); });
}

// ════════════════════════════════════════════════════════
// BAGIAN 15: LEAD (status optimistic, bulk, export CSV)
// ════════════════════════════════════════════════════════
const LEAD_STATUS = ['Baru', 'Dihubungi', 'Deal', 'Batal'];
const leadTableHead = (full) => `<thead><tr>${full ? '<th style="width:36px"><input type="checkbox" class="form-check-input" onchange="toggleAllLeads(this.checked)" aria-label="Pilih semua"></th>' : ''}<th>Tanggal</th><th>Calon Jamaah</th><th>No. WhatsApp</th><th>Paket Diminati</th>${full ? '<th>Sumber</th>' : ''}<th>Status</th>${full ? '<th>Catatan</th>' : ''}<th class="text-end">Aksi</th></tr></thead>`;
function leadRow(l, full) {
  const id = ja(l.ID_Lead), pend = S.admin.pending.has(l.ID_Lead) ? 'pending' : '';
  const greet = `Assalamualaikum Bapak/Ibu ${l.Nama}, kami dari ${S.pub.config.Nama_Perusahaan || 'Safar Wisata Madina'} menindaklanjuti konsultasi Anda mengenai ${l.Paket_Diminati || 'paket umrah/haji'}.`;
  return `<tr class="${pend}">
    ${full ? `<td><input type="checkbox" class="form-check-input" ${S.admin.selected.has(l.ID_Lead) ? 'checked' : ''} onchange="toggleLeadSel(${id}, this.checked)" aria-label="Pilih ${esc(l.Nama)}"></td>` : ''}
    <td class="tnum small"><b>${esc(relTime(l.Timestamp))}</b><div class="cell-sub">${fmtDateTime(l.Timestamp)}</div></td>
    <td><span class="cell-title">${esc(l.Nama)}</span><div class="cell-sub">${esc(l.Rencana_Keberangkatan || 'Rencana belum ditentukan')}</div></td>
    <td class="tnum small">+${esc(l.No_WA)}</td>
    <td class="small"><span style="color:var(--brand-strong);font-weight:700">${esc(l.Paket_Diminati || '—')}</span></td>
    ${full ? `<td class="small">${esc(l.Sumber_Halaman || '-')}</td>` : ''}
    <td><select class="form-select status-select s-${esc(l.Status_Followup || 'Baru')}" onchange="setLeadStatus(${id}, this.value)" aria-label="Status lead">${LEAD_STATUS.map(s => `<option ${s === l.Status_Followup ? 'selected' : ''}>${s}</option>`).join('')}</select></td>
    ${full ? `<td class="small text-muted" style="max-width:200px">${esc(l.Catatan_Admin || '')}</td>` : ''}
    <td><div class="row-actions">
      <a class="icon-btn" style="color:var(--wa-strong)" href="${esc(waUrl(greet, normWa(l.No_WA)))}" target="_blank" rel="noopener" title="Chat jamaah" aria-label="Chat WhatsApp ${esc(l.Nama)}" onclick="autoContacted(${id})"><i class="bi bi-whatsapp"></i></a>
      ${full ? `<button class="icon-btn" onclick="openForm('lead', ${id})" title="Edit & catatan" aria-label="Edit lead"><i class="bi bi-pencil"></i></button>
      <button class="icon-btn" onclick="removeRecord('lead', ${id})" title="Hapus" aria-label="Hapus lead"><i class="bi bi-trash text-danger"></i></button>` : ''}
    </div></td></tr>`;
}
function renderLeadPage() {
  const L = S.admin.data.lead, st = S.admin.leadStatus, q = S.admin.leadQ.toLowerCase();
  const counts = LEAD_STATUS.reduce((a, s) => (a[s] = L.filter(l => l.Status_Followup === s).length, a), {});
  const list = L.filter(l => (!st || l.Status_Followup === st) && (!q || (l.Nama + ' ' + l.No_WA + ' ' + l.Paket_Diminati).toLowerCase().includes(q)));
  $('#apage-lead').innerHTML = `<div class="panel">
    <div class="panel-head"><div><h2>Lead & Permintaan Konsultasi</h2><p>${L.length} total lead • perubahan status tersimpan otomatis</p></div>
      <div class="d-flex gap-2"><button class="btn btn-ghost btn-sm" onclick="exportLeadsCsv(true)"><i class="bi bi-download"></i> CSV</button></div></div>
    <div class="panel-body pb-2">
      <div class="d-flex flex-wrap gap-2 mb-3">${['', ...LEAD_STATUS].map(s => `<button class="chip chip-btn ${st === s ? 'active' : ''}" onclick="S.admin.leadStatus=${ja(s)};S.admin.selected.clear();renderLeadPage()">${s || 'Semua'} <span class="tnum">(${s ? counts[s] : L.length})</span></button>`).join('')}</div>
      <div class="search-input"><i class="bi bi-search"></i><input type="search" class="form-control" placeholder="Cari nama, nomor WA, atau paket…" value="${esc(S.admin.leadQ)}" oninput="S.admin.leadQ=this.value;debLead()" aria-label="Cari lead" id="leadSearch"></div>
      <div class="d-flex flex-wrap align-items-center gap-2 mt-3" id="bulkBar" ${S.admin.selected.size ? '' : 'hidden'}>
        <b class="small"><span class="tnum">${S.admin.selected.size}</span> dipilih →</b>
        ${LEAD_STATUS.map(s => `<button class="btn btn-ghost btn-sm" onclick="bulkLeadStatus('${s}')">Tandai ${s}</button>`).join('')}
      </div>
    </div>
    <div class="table-wrap"><table class="table-x">${leadTableHead(true)}<tbody>${list.map(l => leadRow(l, true)).join('') || `<tr><td colspan="9"><div class="empty"><i class="bi bi-inbox"></i>Tidak ada lead.</div></td></tr>`}</tbody></table></div>
  </div>`;
}
const debLead = debounce(() => { renderLeadPage(); const s = $('#leadSearch'); s.focus(); s.setSelectionRange(s.value.length, s.value.length); }, 200);
function toggleLeadSel(id, on) { on ? S.admin.selected.add(id) : S.admin.selected.delete(id); renderLeadPage(); }
function toggleAllLeads(on) {
  const st = S.admin.leadStatus;
  S.admin.data.lead.filter(l => !st || l.Status_Followup === st).forEach(l => on ? S.admin.selected.add(l.ID_Lead) : S.admin.selected.delete(l.ID_Lead));
  renderLeadPage();
}
/** Optimistic: UI berubah instan, server menyusul. Rollback jika gagal. */
function setLeadStatus(id, status) {
  const l = S.admin.data.lead.find(x => x.ID_Lead === id); if (!l || l.Status_Followup === status) return;
  const old = l.Status_Followup; l.Status_Followup = status;
  afterLocalChange();
  saveRemote('lead', { ID_Lead: id, Status_Followup: status }, () => { l.Status_Followup = old; afterLocalChange(); });
}
function autoContacted(id) { const l = S.admin.data.lead.find(x => x.ID_Lead === id); if (l && l.Status_Followup === 'Baru') setTimeout(() => setLeadStatus(id, 'Dihubungi'), 300); }
function bulkLeadStatus(status) {
  const ids = [...S.admin.selected]; if (!ids.length) return;
  const snap = ids.map(id => { const l = S.admin.data.lead.find(x => x.ID_Lead === id); return [l, l.Status_Followup]; });
  snap.forEach(([l]) => l.Status_Followup = status);
  S.admin.selected.clear(); afterLocalChange();
  toast(`${ids.length} lead → ${status}`, 'Menyimpan di latar belakang…', 'success', 2200);
  api('saveRecordsBatch', S.admin.token, 'lead', ids.map(id => ({ ID_Lead: id, Status_Followup: status }))).then(r => {
    if (!r.success) { snap.forEach(([l, o]) => l.Status_Followup = o); afterLocalChange(); if (!handleAuthError(r.message)) toast('Gagal menyimpan', r.message, 'danger'); }
  }).catch(err => { snap.forEach(([l, o]) => l.Status_Followup = o); afterLocalChange(); toast('Gagal menyimpan', err.message || String(err), 'danger'); });
}
function exportLeadsCsv(filtered) {
  const st = S.admin.leadStatus, q = (S.admin.leadQ || '').toLowerCase();
  const L = S.admin.data.lead.filter(l => !filtered || ((!st || l.Status_Followup === st) && (!q || (l.Nama + ' ' + l.No_WA + ' ' + l.Paket_Diminati).toLowerCase().includes(q))));
  const H = ['ID_Lead', 'Timestamp', 'Nama', 'No_WA', 'Paket_Diminati', 'Rencana_Keberangkatan', 'Sumber_Halaman', 'Status_Followup', 'Catatan_Admin'];
  const csv = '\ufeff' + [H.join(','), ...L.map(l => H.map(h => `"${String(l[h] === undefined ? '' : l[h]).replace(/"/g, '""')}"`).join(','))].join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `lead_safar_wisata_${todayISO()}.csv`; document.body.appendChild(a); a.click(); a.remove();
  toast('Export berhasil', `${L.length} lead diunduh.`, 'success');
}

// ════════════════════════════════════════════════════════
// BAGIAN 16: SKEMA FORM & TABEL GENERIK
// ════════════════════════════════════════════════════════
const KEYS = { paket: 'ID_Paket', lead: 'ID_Lead', testimoni: 'ID', artikel: 'ID', faq: 'ID', video: 'ID', admin: 'Email' };
const FORMS = {
  paket: { title: 'Paket', fields: [
    { k: 'Nama_Paket', l: 'Nama Paket', req: 1, col: 8, ph: 'Umrah Barakah 9 Hari' },
    { k: 'Jenis', l: 'Jenis Paket', t: 'select', opts: ['Umrah Reguler', 'Umrah Plus', 'Haji Reguler', 'Haji Plus', 'Badal Umrah'], req: 1, col: 4 },
    { k: 'Tanggal_Berangkat', l: 'Tanggal Berangkat', t: 'date', req: 1, col: 4 },
    { k: 'Durasi_Hari', l: 'Durasi (hari)', t: 'number', min: 1, col: 4 },
    { k: 'Sisa_Kuota', l: 'Sisa Kuota (seat)', t: 'number', min: 0, col: 4, hint: '0 = otomatis tampil "Kuota Penuh"' },
    { k: 'Maskapai', l: 'Maskapai', list: 'Maskapai', col: 6 },
    { k: 'Kota_Keberangkatan', l: 'Kota Keberangkatan', list: 'Kota_Keberangkatan', col: 6, ph: 'Jakarta (CGK)' },
    { k: 'Mata_Uang', l: 'Mata Uang', t: 'select', opts: ['IDR', 'USD'], col: 3 },
    { k: 'Harga_Quad', l: 'Harga Quad', t: 'number', min: 0, req: 1, col: 3 },
    { k: 'Harga_Triple', l: 'Harga Triple', t: 'number', min: 0, col: 3 },
    { k: 'Harga_Double', l: 'Harga Double', t: 'number', min: 0, col: 3 },
    { k: 'Hotel_Makkah', l: 'Hotel Makkah', list: 'Hotel_Makkah', col: 6 },
    { k: 'Hotel_Madinah', l: 'Hotel Madinah', list: 'Hotel_Madinah', col: 6 },
    { k: 'Fasilitas', l: 'Fasilitas', t: 'textarea', col: 12, hint: 'Satu fasilitas per baris.' },
    { k: 'Deskripsi', l: 'Deskripsi', t: 'textarea', col: 12 },
    { k: 'Gambar_URL', l: 'URL Gambar', t: 'url', col: 12, hint: 'Upload ke folder Drive "Gambar_Paket_Artikel" → Bagikan "Siapa saja yang memiliki link" → tempel link-nya di sini.' },
    { k: 'Unggulan', l: 'Tampil di Favorit', t: 'select', opts: ['Ya', 'Tidak'], col: 6 },
    { k: 'Status', l: 'Status', t: 'select', opts: ['Aktif', 'Penuh', 'Nonaktif'], col: 6 }
  ] },
  lead: { title: 'Lead', fields: [
    { k: 'Nama', l: 'Nama', req: 1, col: 6 }, { k: 'No_WA', l: 'No. WhatsApp', req: 1, col: 6 },
    { k: 'Paket_Diminati', l: 'Paket Diminati', list: 'Nama_Paket', col: 6 }, { k: 'Rencana_Keberangkatan', l: 'Rencana Berangkat', col: 6 },
    { k: 'Sumber_Halaman', l: 'Sumber', col: 6 }, { k: 'Status_Followup', l: 'Status Follow-up', t: 'select', opts: LEAD_STATUS, col: 6 },
    { k: 'Catatan_Admin', l: 'Catatan Admin', t: 'textarea', col: 12 }
  ] },
  testimoni: { title: 'Testimoni', fields: [
    { k: 'Nama_Jamaah', l: 'Nama Jamaah', req: 1, col: 6 }, { k: 'Paket_Diikuti', l: 'Paket Diikuti', list: 'Nama_Paket', col: 6 },
    { k: 'Isi_Testimoni', l: 'Isi Testimoni', t: 'textarea', req: 1, col: 12 },
    { k: 'Rating', l: 'Rating (1–5)', t: 'number', min: 1, max: 5, col: 4 }, { k: 'Tanggal', l: 'Tanggal', t: 'date', col: 4 },
    { k: 'Status_Tampil', l: 'Status', t: 'select', opts: ['Tampil', 'Disembunyikan'], col: 4 },
    { k: 'Foto_URL', l: 'URL Foto (opsional)', t: 'url', col: 12 }
  ] },
  artikel: { title: 'Artikel', fields: [
    { k: 'Judul', l: 'Judul', req: 1, col: 8 }, { k: 'Kategori', l: 'Kategori', list: 'Kategori', col: 4 },
    { k: 'Isi_Konten', l: 'Isi Konten', t: 'textarea', rows: 10, req: 1, col: 12, hint: 'Pisahkan paragraf dengan baris kosong.' },
    { k: 'Gambar_Cover_URL', l: 'URL Gambar Cover', t: 'url', col: 12 },
    { k: 'Status_Publish', l: 'Status', t: 'select', opts: ['Draft', 'Terbit'], col: 4 }, { k: 'Tanggal_Publish', l: 'Tanggal Publish', t: 'date', col: 4 },
    { k: 'Penulis', l: 'Penulis', col: 4 }
  ] },
  video: { title: 'Video Dokumentasi', fields: [
    { k: 'Judul', l: 'Judul Video', req: 1, col: 8, ph: 'Keberangkatan Umrah Barakah — Desember 2026' },
    { k: 'Kategori', l: 'Kategori', list: 'Kategori', col: 4, ph: 'Keberangkatan / Manasik / Kajian' },
    { k: 'Video_URL', l: 'Link Video', t: 'url', req: 1, col: 12, hint: 'Link YouTube (watch, youtu.be, atau shorts) — disarankan, otomatis berputar. Bisa juga link file .mp4.' },
    { k: 'Deskripsi', l: 'Deskripsi Singkat', t: 'textarea', rows: 3, col: 12 },
    { k: 'Tanggal', l: 'Tanggal', t: 'date', col: 4 }, { k: 'Urutan_Tampil', l: 'Urutan', t: 'number', min: 0, col: 4 },
    { k: 'Unggulan', l: 'Jadikan Video Utama', t: 'select', opts: ['Tidak', 'Ya'], col: 4 },
    { k: 'Status_Tampil', l: 'Status', t: 'select', opts: ['Tampil', 'Disembunyikan'], col: 6 },
    { k: 'Thumbnail_URL', l: 'URL Thumbnail (opsional)', t: 'url', col: 6, hint: 'Kosongkan untuk YouTube (otomatis).' }
  ] },
  faq: { title: 'FAQ', fields: [
    { k: 'Kategori', l: 'Kategori', list: 'Kategori', col: 8, ph: 'Persyaratan / Pembayaran / Pembatalan' }, { k: 'Urutan_Tampil', l: 'Urutan', t: 'number', min: 0, col: 4 },
    { k: 'Pertanyaan', l: 'Pertanyaan', req: 1, col: 12 }, { k: 'Jawaban', l: 'Jawaban', t: 'textarea', req: 1, col: 12 }
  ] },
  admin: { title: 'Admin', fields: [
    { k: 'Email', l: 'Email', t: 'email', req: 1, col: 6, lockOnEdit: 1 }, { k: 'Nama', l: 'Nama', req: 1, col: 6 },
    { k: 'Role', l: 'Peran', t: 'select', opts: ['Admin', 'Staff'], col: 4 }, { k: 'Status_Aktif', l: 'Status', t: 'select', opts: ['true', 'false'], optLabels: ['Aktif', 'Nonaktif'], col: 4 },
    { k: 'PIN', l: 'PIN (6–10 digit)', t: 'password', col: 4, hint: 'Wajib untuk admin baru. Kosongkan jika tidak ingin mengganti.' }
  ] }
};
const LISTS = {
  testimoni: { add: 'Tambah Testimoni', search: ['Nama_Jamaah', 'Isi_Testimoni', 'Paket_Diikuti'], cols: [
    { h: 'Jamaah', r: t => `<span class="cell-title">${esc(t.Nama_Jamaah)}</span><div class="cell-sub">${esc(t.Paket_Diikuti || '')}</div>` },
    { h: 'Testimoni', r: t => `<span class="small text-muted">${esc(String(t.Isi_Testimoni || '').slice(0, 110))}…</span>` },
    { h: 'Rating', r: t => `<span class="stars">${stars(t.Rating)}</span>` },
    { h: 'Status', r: t => `<button class="pill ${t.Status_Tampil === 'Tampil' ? 'pill-emerald' : 'pill-muted'} border-0" onclick="quickToggle('testimoni', ${ja(t.ID)}, 'Status_Tampil', ['Tampil','Disembunyikan'])" title="Klik untuk ubah">${esc(t.Status_Tampil)}</button>` }
  ] },
  artikel: { add: 'Tulis Artikel', search: ['Judul', 'Kategori', 'Isi_Konten'], cols: [
    { h: 'Cover', r: a => a.Gambar_Cover_URL ? `<img class="thumb" src="${esc(a.Gambar_Cover_URL)}" alt="" loading="lazy" onclick="previewImage(${ja(a.Gambar_Cover_URL)}, ${ja(a.Judul)})" style="cursor:zoom-in">` : '<span class="thumb d-inline-block"></span>' },
    { h: 'Judul', r: a => `<span class="cell-title">${esc(a.Judul)}</span><div class="cell-sub">${esc(a.Kategori || '')} • ${esc(a.Penulis || '')}</div>` },
    { h: 'Tanggal', r: a => `<span class="small tnum">${fmtDate(a.Tanggal_Publish, 'short')}</span>` },
    { h: 'Status', r: a => `<button class="pill ${a.Status_Publish === 'Terbit' ? 'pill-emerald' : 'pill-warn'} border-0" onclick="quickToggle('artikel', ${ja(a.ID)}, 'Status_Publish', ['Terbit','Draft'])" title="Klik untuk ubah">${esc(a.Status_Publish)}</button>` }
  ] },
  video: { add: 'Tambah Video', search: ['Judul', 'Kategori', 'Deskripsi'], sort: videoCmp, cols: [
    { h: 'Video', r: v => { const t = videoThumb(v); return t ? `<img class="thumb" src="${esc(t)}" alt="" loading="lazy" style="width:96px;height:54px;cursor:pointer" onclick="previewVideo(${ja(v.Video_URL)}, ${ja(v.Judul)})">` : '<span class="pill pill-warn">Belum ada link</span>'; } },
    { h: 'Judul', r: v => `<span class="cell-title">${v.Unggulan === 'Ya' ? '<i class="bi bi-star-fill" style="color:var(--gold)" title="Video utama"></i> ' : ''}${esc(v.Judul)}</span><div class="cell-sub">${esc(v.Kategori || '-')}</div>` },
    { h: 'Tanggal', r: v => `<span class="small tnum">${fmtDate(v.Tanggal, 'short')}</span>` },
    { h: 'Status', r: v => `<button class="pill ${v.Status_Tampil === 'Tampil' ? 'pill-emerald' : 'pill-muted'} border-0" onclick="quickToggle('video', ${ja(v.ID)}, 'Status_Tampil', ['Tampil','Disembunyikan'])" title="Klik untuk ubah">${esc(v.Status_Tampil)}</button>` }
  ] },
  faq: { add: 'Tambah FAQ', search: ['Pertanyaan', 'Jawaban', 'Kategori'], sort: (a, b) => (Number(a.Urutan_Tampil) || 0) - (Number(b.Urutan_Tampil) || 0), cols: [
    { h: '#', r: f => `<span class="pill pill-blue tnum">${esc(f.Urutan_Tampil || '-')}</span>` },
    { h: 'Pertanyaan', r: f => `<span class="cell-title">${esc(f.Pertanyaan)}</span><div class="cell-sub">${esc(String(f.Jawaban || '').slice(0, 100))}…</div>` },
    { h: 'Kategori', r: f => `<span class="pill pill-muted">${esc(f.Kategori || 'Umum')}</span>` }
  ] }
};

function openForm(entity, id, duplicate) {
  const sc = FORMS[entity], key = KEYS[entity];
  const rec = id ? { ...(S.admin.data[entity].find(x => String(x[key]) === String(id)) || {}) } : {};
  if (duplicate) { delete rec[key]; rec.Nama_Paket = (rec.Nama_Paket || '') + ' (Salinan)'; rec.Status = 'Aktif'; }
  const isEdit = !!id && !duplicate;
  if (!isEdit) { // nilai default
    if (entity === 'paket') Object.assign(rec, { Mata_Uang: rec.Mata_Uang || 'IDR', Status: 'Aktif', Unggulan: rec.Unggulan || 'Tidak', Kota_Keberangkatan: rec.Kota_Keberangkatan || 'Jakarta (CGK)' });
    if (entity === 'testimoni') Object.assign(rec, { Rating: 5, Status_Tampil: 'Tampil', Tanggal: todayISO() });
    if (entity === 'artikel') Object.assign(rec, { Status_Publish: 'Draft', Tanggal_Publish: todayISO(), Penulis: (S.admin.me || {}).nama || '' });
    if (entity === 'faq') rec.Urutan_Tampil = S.admin.data.faq.length + 1;
    if (entity === 'video') Object.assign(rec, { Status_Tampil: 'Tampil', Unggulan: 'Tidak', Kategori: 'Keberangkatan', Tanggal: todayISO(), Urutan_Tampil: (S.admin.data.video || []).length + 1 });
    if (entity === 'admin') Object.assign(rec, { Role: 'Admin', Status_Aktif: true });
  }
  S.admin.form = { entity, id: isEdit ? id : null };
  $('#formModalTitle').textContent = `${isEdit ? 'Ubah' : 'Tambah'} ${sc.title}`;
  const dl = new Set();
  $('#formModalBody').innerHTML = sc.fields.map(f => {
    let v = rec[f.k]; if (v === undefined || v === null) v = '';
    if (f.k === 'Status_Aktif') v = String(v === true || String(v) === 'true');
    const fid = 'ff_' + f.k, req = f.req ? 'required' : '', lab = `<label class="form-label" for="${fid}">${esc(f.l)}${f.req ? ' *' : ''}</label>`;
    const hint = f.hint ? `<div class="form-hint">${esc(f.hint)}</div>` : '';
    let input;
    if (f.t === 'select') input = `<select class="form-select" id="${fid}" name="${f.k}" ${req}>${f.opts.map((o, i) => `<option value="${esc(o)}" ${String(o) === String(v) ? 'selected' : ''}>${esc(f.optLabels ? f.optLabels[i] : o)}</option>`).join('')}</select>`;
    else if (f.t === 'textarea') input = `<textarea class="form-control" id="${fid}" name="${f.k}" rows="${f.rows || 4}" ${req}>${esc(v)}</textarea>`;
    else {
      if (f.list) dl.add(f.list);
      input = `<input class="form-control ${f.t === 'number' ? 'tnum' : ''}" id="${fid}" name="${f.k}" type="${f.t || 'text'}" value="${esc(v)}" ${req} ${f.min !== undefined ? `min="${f.min}"` : ''} ${f.max !== undefined ? `max="${f.max}"` : ''} ${f.ph ? `placeholder="${esc(f.ph)}"` : ''} ${f.list ? `list="dl_${f.list}"` : ''} ${f.lockOnEdit && isEdit ? 'readonly' : ''} ${f.t === 'password' ? 'inputmode="numeric" autocomplete="new-password"' : ''}>`;
    }
    const prev = (f.k === 'Gambar_URL' || f.k === 'Gambar_Cover_URL') && v ? `<img src="${esc(v)}" class="thumb mt-2" style="width:120px;height:72px" alt="Pratinjau" onerror="this.remove()">` : '';
    return `<div class="col-md-${f.col || 12}">${lab}${input}<div class="invalid-feedback">Wajib diisi dengan benar.</div>${hint}${prev}</div>`;
  }).join('') + [...dl].map(k => `<datalist id="dl_${k}">${uniq([...S.admin.data.paket, ...S.admin.data.artikel, ...S.admin.data.faq].map(x => x[k])).map(o => `<option value="${esc(o)}">`).join('')}</datalist>`).join('');
  $('#formModalForm').classList.remove('was-validated');
  modal('formModal').show();
}

function submitAdminForm(e) {
  e.preventDefault();
  const form = e.target, { entity, id } = S.admin.form, key = KEYS[entity];
  if (entity === 'admin' && !id && !form.PIN.value) { form.PIN.setCustomValidity('PIN wajib untuk admin baru'); } else if (form.PIN) form.PIN.setCustomValidity('');
  if (entity === 'admin' && form.PIN && form.PIN.value && !/^\d{6,10}$/.test(form.PIN.value)) form.PIN.setCustomValidity('PIN 6–10 digit angka');
  if (!form.checkValidity()) { form.classList.add('was-validated'); const bad = form.querySelector(':invalid'); if (bad) bad.focus(); return; }

  const rec = {};
  FORMS[entity].fields.forEach(f => { const el = form.elements[f.k]; if (el) rec[f.k] = f.t === 'number' && el.value !== '' ? Number(el.value) : el.value; });
  if (entity === 'admin') { rec.Status_Aktif = rec.Status_Aktif === 'true'; if (!rec.PIN) delete rec.PIN; }
  if (entity === 'paket' && Number(rec.Sisa_Kuota) <= 0 && rec.Status === 'Aktif') rec.Status = 'Penuh';
  rec[key] = id || ('tmp_' + Date.now());

  // ── OPTIMISTIC: update lokal → render → tutup modal (0 ms) ──
  const arr = S.admin.data[entity];
  const idx = arr.findIndex(x => String(x[key]) === String(rec[key]));
  const before = idx > -1 ? { ...arr[idx] } : null;
  const local = { ...rec }; delete local.PIN;
  if (idx > -1) arr[idx] = { ...arr[idx], ...local }; else arr.unshift(local);
  S.admin.pending.add(rec[key]);
  modal('formModal').hide();
  afterLocalChange();
  toast('Tersimpan', `${FORMS[entity].title} diperbarui. Sinkronisasi berjalan…`, 'success', 2200);

  saveRemote(entity, rec, () => { // rollback
    const i = arr.findIndex(x => String(x[key]) === String(rec[key]));
    if (before) arr[i] = before; else if (i > -1) arr.splice(i, 1);
    afterLocalChange();
  });
}
/** Kirim ke server di latar belakang; ganti ID sementara dengan ID asli. */
function saveRemote(entity, rec, rollback) {
  const key = KEYS[entity], tmp = rec[key];
  S.admin.pending.add(tmp);
  api('saveRecord', S.admin.token, entity, rec).then(r => {
    S.admin.pending.delete(tmp);
    if (!r.success) { rollback(); if (!handleAuthError(r.message)) toast('Gagal menyimpan', r.message, 'danger', 6000); return; }
    const arr = S.admin.data[entity], i = arr.findIndex(x => String(x[key]) === String(tmp));
    if (i > -1) arr[i] = { ...arr[i], ...r.data };
    afterLocalChange(true);
  }).catch(err => { S.admin.pending.delete(tmp); rollback(); toast('Gagal menyimpan', err.message || String(err), 'danger', 6000); });
}
function quickToggle(entity, id, field, vals) {
  const key = KEYS[entity], r = S.admin.data[entity].find(x => x[key] === id); if (!r) return;
  const old = r[field]; r[field] = r[field] === vals[0] ? vals[1] : vals[0];
  afterLocalChange();
  saveRemote(entity, { [key]: id, [field]: r[field] }, () => { r[field] = old; afterLocalChange(); });
}
async function removeRecord(entity, id) {
  const soft = entity === 'paket';
  const ok = await confirmDialog(soft ? 'Nonaktifkan paket?' : 'Hapus data?', soft ? 'Paket disembunyikan dari website (data tetap tersimpan & bisa diaktifkan lagi).' : 'Data akan dihapus permanen dari Google Sheets.', soft ? 'Nonaktifkan' : 'Hapus');
  if (!ok) return;
  const key = KEYS[entity], arr = S.admin.data[entity], i = arr.findIndex(x => String(x[key]) === String(id));
  if (i < 0) return;
  const before = { ...arr[i] };
  if (soft) arr[i].Status = 'Nonaktif'; else arr.splice(i, 1);
  afterLocalChange();
  toast(soft ? 'Paket dinonaktifkan' : 'Data dihapus', '', 'success', 2000);
  api('deleteRecord', S.admin.token, entity, id).then(r => {
    if (!r.success) { if (soft) arr[i] = before; else arr.splice(i, 0, before); afterLocalChange(); if (!handleAuthError(r.message)) toast('Gagal menghapus', r.message, 'danger'); }
  }).catch(err => { if (soft) arr[i] = before; else arr.splice(i, 0, before); afterLocalChange(); toast('Gagal menghapus', err.message || String(err), 'danger'); });
}
function afterLocalChange(silent) {
  syncPublicFromAdmin();
  renderAdminPage(S.admin.page);
}

// ════════════════════════════════════════════════════════
// BAGIAN 17: HALAMAN PAKET & LIST GENERIK
// ════════════════════════════════════════════════════════
function renderPaketPage() {
  const q = S.admin.paketQ.toLowerCase(), st = S.admin.paketStatus;
  const P = [...S.admin.data.paket].sort((a, b) => String(a.Tanggal_Berangkat).localeCompare(String(b.Tanggal_Berangkat)));
  const list = P.filter(p => (!st || p.Status === st) && (!q || [p.Nama_Paket, p.Jenis, p.Maskapai, p.Hotel_Makkah].join(' ').toLowerCase().includes(q)));
  const today = todayISO();
  $('#apage-paket').innerHTML = `<div class="panel">
    <div class="panel-head"><div><h2>Manajemen Paket & Jadwal</h2><p>Satu data untuk katalog, detail paket, dan tabel jadwal di website</p></div>
      <button class="btn btn-brand btn-sm" onclick="openForm('paket')"><i class="bi bi-plus-lg"></i> Tambah Paket</button></div>
    <div class="panel-body pb-2"><div class="row g-2">
      <div class="col-md-8"><div class="search-input"><i class="bi bi-search"></i><input type="search" class="form-control" id="paketSearch" placeholder="Cari nama paket, maskapai, hotel…" value="${esc(S.admin.paketQ)}" oninput="S.admin.paketQ=this.value;debPaket()" aria-label="Cari paket"></div></div>
      <div class="col-md-4"><select class="form-select" onchange="S.admin.paketStatus=this.value;renderPaketPage()" aria-label="Filter status"><option value="">Semua Status (${P.length})</option>${['Aktif', 'Penuh', 'Nonaktif'].map(s => `<option ${st === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
    </div></div>
    <div class="table-wrap"><table class="table-x"><thead><tr><th></th><th>Paket</th><th>Berangkat</th><th>Maskapai</th><th>Harga Quad</th><th>Sisa</th><th>Status</th><th class="text-end">Aksi</th></tr></thead><tbody>
    ${list.map(p => { const id = ja(p.ID_Paket), past = p.Tanggal_Berangkat && p.Tanggal_Berangkat < today; return `<tr class="${S.admin.pending.has(p.ID_Paket) ? 'pending' : ''}">
      <td>${p.Gambar_URL ? `<img class="thumb" src="${esc(p.Gambar_URL)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">` : '<span class="thumb d-inline-block"></span>'}</td>
      <td><span class="cell-title">${p.Unggulan === 'Ya' ? '<i class="bi bi-star-fill" style="color:var(--gold)" title="Favorit"></i> ' : ''}${esc(p.Nama_Paket)}</span><div class="cell-sub">${esc(p.Jenis)} • ${esc(p.Kota_Keberangkatan || '')}</div></td>
      <td class="small tnum">${fmtDate(p.Tanggal_Berangkat, 'short')}${past ? '<div><span class="pill pill-muted">Sudah lewat</span></div>' : ''}</td>
      <td class="small">${esc(p.Maskapai || '-')}</td>
      <td class="tnum fw-bold" style="color:var(--brand-strong)">${fmtMoney(p.Harga_Quad, p.Mata_Uang)}</td>
      <td><div class="d-flex align-items-center gap-1"><button class="icon-btn" style="width:30px;height:30px" onclick="bumpSeat(${id},-1)" aria-label="Kurangi kursi">−</button><b class="tnum" style="min-width:24px;text-align:center">${esc(p.Sisa_Kuota)}</b><button class="icon-btn" style="width:30px;height:30px" onclick="bumpSeat(${id},1)" aria-label="Tambah kursi">+</button></div></td>
      <td><span class="pill ${p.Status === 'Aktif' ? 'pill-emerald' : p.Status === 'Penuh' ? 'pill-danger' : 'pill-muted'}">${esc(p.Status)}</span></td>
      <td><div class="row-actions">
        <button class="icon-btn" onclick="S.admin._preview=1;closeAdmin();go('detail',{id:${id}})" title="Lihat di website" aria-label="Lihat"><i class="bi bi-eye"></i></button>
        <button class="icon-btn" onclick="openForm('paket', ${id})" title="Edit" aria-label="Edit"><i class="bi bi-pencil"></i></button>
        <button class="icon-btn" onclick="openForm('paket', ${id}, true)" title="Duplikat (jadwal baru)" aria-label="Duplikat"><i class="bi bi-copy"></i></button>
        ${p.Status !== 'Nonaktif' ? `<button class="icon-btn" onclick="removeRecord('paket', ${id})" title="Nonaktifkan" aria-label="Nonaktifkan"><i class="bi bi-eye-slash text-danger"></i></button>`
          : `<button class="icon-btn" onclick="reactivate(${id})" title="Aktifkan lagi" aria-label="Aktifkan"><i class="bi bi-arrow-counterclockwise text-success"></i></button>`}
      </div></td></tr>`; }).join('') || `<tr><td colspan="8"><div class="empty"><i class="bi bi-airplane"></i>Belum ada paket.</div></td></tr>`}
    </tbody></table></div></div>`;
}
const debPaket = debounce(() => { renderPaketPage(); const s = $('#paketSearch'); s.focus(); s.setSelectionRange(s.value.length, s.value.length); }, 200);
/** Ubah sisa kursi instan; klik beruntun digabung jadi 1 panggilan server (debounce). */
const seatTimers = {};
function bumpSeat(id, n) {
  const p = S.admin.data.paket.find(x => x.ID_Paket === id); if (!p) return;
  const old = Number(p.Sisa_Kuota) || 0; p.Sisa_Kuota = Math.max(0, old + n);
  if (p.Sisa_Kuota === 0 && p.Status === 'Aktif') p.Status = 'Penuh';
  if (p.Sisa_Kuota > 0 && p.Status === 'Penuh') p.Status = 'Aktif';
  afterLocalChange();
  clearTimeout(seatTimers[id]);
  seatTimers[id] = setTimeout(() => saveRemote('paket', { ID_Paket: id, Sisa_Kuota: p.Sisa_Kuota, Status: p.Status }, () => refreshAdmin()), 700);
}
function reactivate(id) {
  const p = S.admin.data.paket.find(x => x.ID_Paket === id); if (!p) return;
  p.Status = Number(p.Sisa_Kuota) > 0 ? 'Aktif' : 'Penuh'; afterLocalChange();
  saveRemote('paket', { ID_Paket: id, Status: p.Status }, () => { p.Status = 'Nonaktif'; afterLocalChange(); });
}
function renderListPage(entity) {
  const cfg = LISTS[entity], key = KEYS[entity], q = (S.admin.listQ[entity] || '').toLowerCase();
  let list = S.admin.data[entity].filter(r => !q || cfg.search.map(k => r[k]).join(' ').toLowerCase().includes(q));
  if (cfg.sort) list = [...list].sort(cfg.sort);
  $('#apage-' + entity).innerHTML = `<div class="panel">
    <div class="panel-head"><div><h2>${esc(ATITLES[entity])}</h2><p>${S.admin.data[entity].length} data</p></div><button class="btn btn-brand btn-sm" onclick="openForm('${entity}')"><i class="bi bi-plus-lg"></i> ${esc(cfg.add)}</button></div>
    <div class="panel-body pb-2"><div class="search-input"><i class="bi bi-search"></i><input type="search" class="form-control" id="listSearch_${entity}" placeholder="Cari…" value="${esc(S.admin.listQ[entity] || '')}" oninput="S.admin.listQ['${entity}']=this.value;debList('${entity}')" aria-label="Cari"></div></div>
    <div class="table-wrap"><table class="table-x" style="min-width:640px"><thead><tr>${cfg.cols.map(c => `<th>${c.h}</th>`).join('')}<th class="text-end">Aksi</th></tr></thead><tbody>
    ${list.map(r => `<tr class="${S.admin.pending.has(r[key]) ? 'pending' : ''}">${cfg.cols.map(c => `<td>${c.r(r)}</td>`).join('')}
      <td><div class="row-actions"><button class="icon-btn" onclick="openForm('${entity}', ${ja(r[key])})" aria-label="Edit"><i class="bi bi-pencil"></i></button><button class="icon-btn" onclick="removeRecord('${entity}', ${ja(r[key])})" aria-label="Hapus"><i class="bi bi-trash text-danger"></i></button></div></td></tr>`).join('')
      || `<tr><td colspan="${cfg.cols.length + 1}"><div class="empty"><i class="bi bi-inbox"></i>Belum ada data.</div></td></tr>`}
    </tbody></table></div></div>`;
}
const debList = debounce(entity => { renderListPage(entity); const s = $('#listSearch_' + entity); s.focus(); s.setSelectionRange(s.value.length, s.value.length); }, 200);

// ════════════════════════════════════════════════════════
// BAGIAN 18: PENGATURAN (konfigurasi, admin, PIN, cache)
// ════════════════════════════════════════════════════════
const CFG_GROUPS = [
  ['Identitas Perusahaan', ['Nama_Perusahaan', 'Nama_Singkat', 'Sub_Nama', 'Nomor_PPIU', 'Link_Logo']],
  ['Kontak & WhatsApp', ['Nomor_WA_CS', 'Nomor_WA_CS2', 'Telepon', 'Email_Kontak', 'Alamat', 'Maps_URL', 'Jam_Operasional', 'Pesan_WA_Default']],
  ['Hero & Statistik', ['Tagline', 'Deskripsi_Hero', 'Hero_Video_URL', 'Teks_Berjalan', 'Hero_Gambar_URL', 'Statistik_Tahun_Beroperasi', 'Statistik_Jumlah_Jamaah', 'Statistik_Visa', 'Statistik_Kepuasan']],
  ['Media Sosial & Fitur', ['Instagram', 'Facebook', 'TikTok', 'YouTube', 'Social_Proof_Aktif']]
];
function renderSettings() {
  const d = S.admin.data, c = d.config;
  const known = CFG_GROUPS.flatMap(g => g[1]);
  const extra = Object.keys(c).filter(k => !known.includes(k));
  const field = k => {
    const v = c[k] === undefined ? '' : c[k], lbl = k.replace(/_/g, ' ');
    if (k === 'Social_Proof_Aktif') return `<div class="col-md-6"><label class="form-label" for="cfg_${k}">Notifikasi konsultasi terbaru</label><select class="form-select" id="cfg_${k}" name="${k}">${['Tidak', 'Ya'].map(o => `<option ${o === v ? 'selected' : ''}>${o}</option>`).join('')}</select><div class="form-hint">Menampilkan nama depan pemohon konsultasi nyata. Aktifkan hanya jika sudah ada izin/kebijakan privasi.</div></div>`;
    if (k === 'Hero_Video_URL') return `<div class="col-12"><label class="form-label" for="cfg_${k}">Video Latar Hero</label><input class="form-control" id="cfg_${k}" name="${k}" value="${esc(v)}" placeholder="Link YouTube (disarankan) atau link file .mp4"><div class="form-hint">Kosongkan untuk memakai gambar. Video otomatis tanpa suara & berulang.</div></div>`;
    if (k === 'Teks_Berjalan') return `<div class="col-12"><label class="form-label" for="cfg_${k}">Teks Berjalan</label><input class="form-control" id="cfg_${k}" name="${k}" value="${esc(v)}" placeholder="Akreditasi A | PPIU No. 0703... | Terverifikasi SISKOPATUH"><div class="form-hint">Pisahkan setiap kalimat dengan tanda | . Kosongkan untuk teks otomatis.</div></div>`;
    const long = ['Deskripsi_Hero', 'Alamat', 'Pesan_WA_Default'].includes(k);
    return `<div class="col-md-${long ? 12 : 6}"><label class="form-label" for="cfg_${k}">${esc(lbl)}</label>${long ? `<textarea class="form-control" id="cfg_${k}" name="${k}" rows="2">${esc(v)}</textarea>` : `<input class="form-control" id="cfg_${k}" name="${k}" value="${esc(v)}" ${/WA|PPIU/.test(k) ? 'inputmode="numeric"' : ''}>`}</div>`;
  };
  $('#apage-pengaturan').innerHTML = `<div class="row g-3">
    <div class="col-xl-8"><form class="panel" onsubmit="saveSettings(event)">
      <div class="panel-head"><div><h2>Konfigurasi Website</h2><p>Perubahan langsung tampil di website</p></div><button class="btn btn-brand btn-sm" type="submit"><i class="bi bi-check2"></i> Simpan Konfigurasi</button></div>
      <div class="panel-body">${CFG_GROUPS.map(([t, ks]) => `<h3 class="h6 fw-bold mt-2 mb-3" style="color:var(--brand-strong)">${t}</h3><div class="row g-3 mb-3">${ks.map(field).join('')}</div>`).join('')}
        ${extra.length ? `<h3 class="h6 fw-bold mb-3">Lainnya</h3><div class="row g-3">${extra.map(field).join('')}</div>` : ''}</div>
    </form></div>
    <div class="col-xl-4">
      <div class="panel mb-3"><div class="panel-head"><h2><i class="bi bi-patch-check text-success"></i> Legalitas PPIU</h2></div><div class="panel-body small">
        <div class="d-flex justify-content-between mb-2"><span class="text-muted">No. SK PPIU</span><b class="tnum">${esc(c.Nomor_PPIU || '-')}</b></div>
        <div class="d-flex justify-content-between mb-2"><span class="text-muted">Database</span><a href="${esc(d.spreadsheetUrl || '#')}" target="_blank" rel="noopener" class="fw-bold">Buka Sheets <i class="bi bi-box-arrow-up-right"></i></a></div>
        <div class="d-flex justify-content-between"><span class="text-muted">Versi Aplikasi</span><b>${esc(S.pub.version || '1.0.0')}</b></div>
        <button class="btn btn-ghost btn-sm w-100 mt-3" onclick="clearCache(this)"><i class="bi bi-lightning-charge"></i> Perbarui Cache Website</button></div></div>
      <form class="panel mb-3" onsubmit="submitChangePin(event)"><div class="panel-head"><h2><i class="bi bi-key"></i> Ganti PIN Saya</h2></div><div class="panel-body">
        <div class="mb-2"><label class="form-label" for="pinOld">PIN Lama</label><input class="form-control tnum" type="password" id="pinOld" required inputmode="numeric" autocomplete="current-password"></div>
        <div class="mb-3"><label class="form-label" for="pinNew">PIN Baru (6–10 digit)</label><input class="form-control tnum" type="password" id="pinNew" required pattern="\\d{6,10}" inputmode="numeric" autocomplete="new-password"></div>
        <button class="btn btn-brand w-100" type="submit">Simpan PIN</button></div></form>
      <div class="panel"><div class="panel-head"><h2><i class="bi bi-people"></i> Pengguna Admin</h2><button class="btn btn-ghost btn-sm" onclick="openForm('admin')"><i class="bi bi-plus-lg"></i></button></div>
        <div class="panel-body">${d.admin.map(a => `<div class="d-flex align-items-center gap-2 mb-2"><span class="avatar">${esc(initials(a.Nama))}</span><div class="flex-grow-1 min-w-0"><b class="small d-block">${esc(a.Nama)} <span class="pill ${a.Status_Aktif ? 'pill-emerald' : 'pill-muted'}">${a.Status_Aktif ? 'Aktif' : 'Nonaktif'}</span></b><small class="text-muted text-truncate d-block">${esc(a.Email)} • ${esc(a.Role)}</small></div>
          <button class="icon-btn" style="width:34px;height:34px" onclick="openForm('admin', ${ja(a.Email)})" aria-label="Edit admin"><i class="bi bi-pencil"></i></button>
          ${a.Email !== (S.admin.me || {}).email ? `<button class="icon-btn" style="width:34px;height:34px" onclick="removeRecord('admin', ${ja(a.Email)})" aria-label="Hapus admin"><i class="bi bi-trash text-danger"></i></button>` : ''}</div>`).join('')}</div></div>
    </div></div>`;
}
function saveSettings(e) {
  e.preventDefault();
  const cfg = Object.fromEntries(new FormData(e.target).entries());
  if (cfg.Nomor_WA_CS) cfg.Nomor_WA_CS = normWa(cfg.Nomor_WA_CS);
  if (cfg.Nomor_WA_CS2) cfg.Nomor_WA_CS2 = normWa(cfg.Nomor_WA_CS2);
  const before = { ...S.admin.data.config };
  Object.assign(S.admin.data.config, cfg); syncPublicFromAdmin();
  toast('Konfigurasi disimpan', 'Website sudah memakai data terbaru.', 'success', 2200);
  api('saveConfig', S.admin.token, cfg).then(r => {
    if (!r.success) { S.admin.data.config = before; syncPublicFromAdmin(); renderSettings(); if (!handleAuthError(r.message)) toast('Gagal menyimpan', r.message, 'danger'); }
  }).catch(err => { S.admin.data.config = before; syncPublicFromAdmin(); renderSettings(); toast('Gagal menyimpan', err.message || String(err), 'danger'); });
}
function submitChangePin(e) {
  e.preventDefault();
  if (!e.target.checkValidity()) return e.target.reportValidity();
  const btn = e.target.querySelector('button'); setBtnLoading(btn, true, 'Menyimpan…');
  api('changePin', S.admin.token, $('#pinOld').value, $('#pinNew').value).then(r => {
    setBtnLoading(btn, false);
    if (r.success) { e.target.reset(); toast('PIN diganti', 'Gunakan PIN baru saat login berikutnya.', 'success'); }
    else if (!handleAuthError(r.message)) toast('Gagal', r.message, 'danger');
  }).catch(err => { setBtnLoading(btn, false); toast('Error', err.message || String(err), 'danger'); });
}
function clearCache(btn) {
  setBtnLoading(btn, true, 'Memperbarui…');
  api('clearPublicCache', S.admin.token).then(r => { setBtnLoading(btn, false); r.success ? toast('Cache diperbarui', 'Pengunjung langsung melihat data terbaru.', 'success') : (!handleAuthError(r.message) && toast('Gagal', r.message, 'danger')); })
    .catch(err => { setBtnLoading(btn, false); toast('Error', err.message || String(err), 'danger'); });
}

// ════════════════════════════════════════════════════════
// BAGIAN 19: DEMO SERVER (hanya aktif saat GAS_URL di js/config.js belum diisi)
// ════════════════════════════════════════════════════════
const DemoServer = {
  db: null,
  init() {
    if (this.db) return;
    const b = JSON.parse(JSON.stringify(window.DEMO_DATA || {}));
    const now = Date.now(), H = 36e5;
    const names = ['Hendrawan Sulistyo', 'Nurul Hidayati', 'Bambang Irawan', 'Syarifuddin', 'Aisyah Rahma', 'Fajar Ramadhan', 'Siti Maryam', 'Ahmad Fauzi'];
    const st = ['Baru', 'Baru', 'Dihubungi', 'Deal', 'Dihubungi', 'Baru', 'Batal', 'Deal'];
    const lead = names.map((n, i) => ({ ID_Lead: 'LD-DEMO-' + i, Timestamp: new Date(now - i * 19 * H).toISOString(), Nama: n, No_WA: '62812' + (10000000 + i * 7311), Paket_Diminati: (b.paket[i % (b.paket.length || 1)] || {}).Nama_Paket || 'Umrah', Rencana_Keberangkatan: 'Desember 2026', Sumber_Halaman: ['Landing', 'Detail Paket', 'Katalog', 'Jadwal'][i % 4], Status_Followup: st[i], Catatan_Admin: '' }));
    this.db = { paket: b.paket || [], lead, testimoni: (b.testimoni || []).map(t => ({ ...t })), artikel: b.artikel || [], faq: b.faq || [], video: (b.video || []).map(v => ({ ...v })), admin: [{ Email: 'admin@demo.id', Nama: 'Administrator Utama', Role: 'Admin', Status_Aktif: true }], config: b.config || {} };
  },
  call(fn, args) {
    if (!window.DEMO_DATA) return new Promise(r => setTimeout(r, 400)).then(() => this.call(fn, args));
    this.init();
    const ok = (data, message = 'OK') => new Promise(r => setTimeout(() => r({ success: true, data, message }), 350));
    const db = this.db, keyOf = e => KEYS[e];
    switch (fn) {
      case 'getPublicData': return ok(window.DEMO_DATA || {});
      case 'submitLead': db.lead.unshift({ ...args[0], ID_Lead: 'LD-' + Date.now(), Timestamp: new Date().toISOString(), Status_Followup: 'Baru' }); return ok({});
      case 'adminLoginPin': return args[1] === '123456' ? ok({ token: 'demo', nama: 'Administrator Utama', email: args[0], role: 'Admin' }) : Promise.resolve({ success: false, message: 'Mode demo: gunakan PIN 123456.' });
      case 'getAdminData': return ok({ ...JSON.parse(JSON.stringify(db)), me: { nama: 'Administrator Utama', email: 'admin@demo.id', role: 'Admin' }, spreadsheetUrl: '#' });
      case 'saveRecord': { const [, e, rec] = args, k = keyOf(e); const r = { ...rec }; if (String(r[k] || '').startsWith('tmp_')) r[k] = 'DEMO-' + Date.now(); delete r.PIN; const i = db[e].findIndex(x => x[k] === r[k]); i > -1 ? Object.assign(db[e][i], r) : db[e].unshift(r); return ok(r); }
      default: return ok({});
    }
  }
};
