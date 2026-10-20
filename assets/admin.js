(function () {
  'use strict';
  var S = window.GloufStore, esc = S.esc;
  var sess = S.session();
  if (!sess || sess.role !== 'admin') { location.replace('login.html#admin'); return; }
  var TITLES = { overview: 'Admin overview', reviews: 'Go-live reviews', merchants: 'Merchants', scans: 'Scans & flags' };
  var ui = { loc: null };
  var DOCS = { cac: 'CAC certificate', id: 'Director\'s ID', addr: 'Proof of address', reg: 'Product approval', tm: 'Trademark certificate' };

  function $(s) { return document.querySelector(s); }
  function toast(msg) { var t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t); setTimeout(function () { t.remove(); }, 2800); }
  function modal(html) {
    closeModal(); var bg = document.createElement('div'); bg.className = 'modal-bg'; bg.id = 'modal';
    bg.innerHTML = '<div class="modal wide" role="dialog" aria-modal="true">' + html + '</div>';
    bg.addEventListener('click', function (e) { if (e.target === bg) closeModal(); }); document.body.appendChild(bg);
  }
  function closeModal() { var m = $('#modal'); if (m) m.remove(); }
  function pill(st) { var s = S.STATUS[st]; return '<span class="pill t-' + s.tone + '">' + s.label + '</span>'; }
  function kpi(l, v, c) { return '<div class="kpi ' + (c || '') + '"><small>' + l + '</small><b>' + v + '</b></div>'; }
  function all() { return S.data().merchants; }
  function scans() {
    var out = [];
    all().forEach(function (m) { m.scans.forEach(function (s) { var p = m.products.filter(function (x) { return x.id === s.productId; })[0]; out.push(Object.assign({ merchant: m.business, product: p ? p.name : '—' }, s)); }); });
    return out.sort(function (a, b) { return a.at < b.at ? 1 : -1; });
  }
  function mapSrc(q, z) { return 'https://maps.google.com/maps?q=' + encodeURIComponent(q) + '&z=' + (z || 6) + '&output=embed'; }

  var V = {};
  V.overview = function () {
    var ms = all(), sc = scans(), pending = ms.filter(function (m) { return m.status === 'review'; });
    var prods = ms.reduce(function (a, m) { return a + m.products.length; }, 0);
    var codes = ms.reduce(function (a, m) { return a + m.batches.reduce(function (x, b) { return x + b.qty; }, 0); }, 0);
    return '<div class="kpis">' + kpi('Merchants', ms.length) + kpi('Live', ms.filter(function (m) { return m.status === 'live'; }).length, 'k-green') +
      kpi('Awaiting review', pending.length) + kpi('Products', prods) + kpi('QR codes', codes.toLocaleString()) + kpi('Scans (clicks)', sc.length) +
      kpi('Flagged', sc.filter(function (s) { return s.result === 'flagged'; }).length, 'k-red') + '</div>' +
      '<div class="grid g2"><div class="card"><div class="card-head"><h3>Awaiting review</h3><a class="btn btn-soft btn-sm" href="#reviews">Open queue</a></div>' +
      (pending.length ? '<div class="tbl-wrap"><table class="tbl"><tbody>' + pending.map(function (m) { return '<tr class="click" data-act="open" data-id="' + m.id + '"><td><b>' + esc(m.business) + '</b><br><span class="muted">' + esc(m.industry) + '</span></td><td class="muted">' + S.when(m.golive.submittedAt) + '</td><td>' + pill(m.status) + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<p class="empty">Nothing waiting. You\'re all caught up.</p>') + '</div>' +
      '<div class="card"><div class="card-head"><h3>Newest merchants</h3><a class="btn btn-soft btn-sm" href="#merchants">All merchants</a></div>' +
      (ms.length ? '<div class="tbl-wrap"><table class="tbl"><tbody>' + ms.slice().reverse().slice(0, 6).map(function (m) { return '<tr class="click" data-act="open" data-id="' + m.id + '"><td><b>' + esc(m.business) + '</b><br><span class="muted">' + esc(m.email) + '</span></td><td class="muted">' + S.when(m.createdAt) + '</td><td>' + pill(m.status) + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<p class="empty">No merchants have signed up on this device yet.</p>') + '</div></div>';
  };
  V.reviews = function () {
    var pending = all().filter(function (m) { return m.status === 'review'; });
    if (!pending.length) return '<div class="card empty"><h3>No submissions waiting</h3><p>When a merchant clicks "Go live" and submits documents, it appears here.</p></div>';
    return pending.map(function (m) {
      var g = m.golive;
      return '<div class="card mb"><div class="card-head"><div><h3>' + esc(m.business) + '</h3><p class="sub">' + esc(m.industry) + ' · submitted ' + S.when(g.submittedAt) + ' · ' + m.products.length + ' products</p></div>' + pill(m.status) + '</div>' +
        '<div class="grid g2"><div><table class="tbl" style="min-width:0"><tbody>' +
        [['Registered name', g.legal], ['RC number', g.rc], ['TIN', g.tin || '—'], ['Director', g.director], ['Address', g.address + ', ' + g.state], ['Contact', m.name + ' · ' + m.email + (m.phone ? ' · ' + m.phone : '')]].map(function (r) { return '<tr><td class="muted">' + r[0] + '</td><td>' + esc(r[1]) + '</td></tr>'; }).join('') +
        '</tbody></table></div><div><h4 style="margin-bottom:8px">Documents</h4>' + Object.keys(DOCS).map(function (k) {
          return '<div class="file' + (g.docs[k] ? ' has' : '') + '" style="margin-bottom:8px;cursor:default"><span class="fi">' + (g.docs[k] ? '✓' : '–') + '</span><span><b>' + DOCS[k] + '</b><span>' + esc(g.docs[k] || 'Not provided') + '</span></span></div>';
        }).join('') + '</div></div>' +
        '<div class="field" style="margin-top:14px"><label for="note-' + m.id + '">Note to merchant <small>(needed if you request changes)</small></label><textarea id="note-' + m.id + '" placeholder="e.g. The CAC certificate is unclear. Please upload a clearer copy."></textarea></div>' +
        '<div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn btn-green" data-act="approve" data-id="' + m.id + '">Approve and go live</button><button class="btn btn-red" data-act="changes" data-id="' + m.id + '">Request changes</button></div></div>';
    }).join('');
  };
  V.merchants = function () {
    var ms = all();
    if (!ms.length) return '<div class="card empty"><h3>No merchants yet</h3><p>Merchants who sign up on this device appear here.</p></div>';
    return '<div class="card"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Business</th><th>Industry</th><th>Status</th><th>Products</th><th>Codes</th><th>Scans</th><th>Joined</th></tr></thead><tbody>' +
      ms.map(function (m) {
        return '<tr class="click" data-act="open" data-id="' + m.id + '"><td><b>' + esc(m.business) + '</b><br><span class="muted">' + esc(m.email) + '</span></td><td>' + esc(m.industry) + '</td><td>' + pill(m.status) + '</td><td>' + m.products.length + '</td><td>' + m.batches.reduce(function (a, b) { return a + b.qty; }, 0) + '</td><td>' + m.scans.length + '</td><td class="muted">' + new Date(m.createdAt).toLocaleDateString('en-GB') + '</td></tr>';
      }).join('') + '</tbody></table></div></div>';
  };
  V.scans = function () {
    var sc = scans();
    if (!sc.length) return '<div class="card empty"><h3>No scans yet</h3><p>Scans from every merchant appear here.</p></div>';
    var map = {}; sc.forEach(function (s) { (map[s.city] = map[s.city] || { city: s.city, lat: s.lat, lng: s.lng, n: 0, bad: 0 }).n++; if (s.result === 'flagged') map[s.city].bad++; });
    var locs = Object.keys(map).map(function (k) { return map[k]; }).sort(function (a, b) { return b.bad - a.bad || b.n - a.n; });
    if (!ui.loc) ui.loc = locs[0].city;
    var sel = map[ui.loc] || locs[0], top = Math.max.apply(null, locs.map(function (l) { return l.n; }));
    var flagged = sc.filter(function (s) { return s.result === 'flagged'; });
    return '<div class="kpis">' + kpi('Scans (clicks)', sc.length) + kpi('Verified', sc.filter(function (s) { return s.result === 'verified'; }).length, 'k-green') + kpi('Flagged', flagged.length, 'k-red') + kpi('Locations', locs.length) + '</div>' +
      '<div class="grid g-21 mb"><div class="card"><h3>' + esc(sel.city) + '</h3><p class="sub" style="margin-bottom:10px">' + sel.n + ' scans · ' + sel.bad + ' flagged</p><iframe class="map" loading="lazy" title="Map" src="' + mapSrc(sel.lat + ',' + sel.lng, 11) + '"></iframe></div>' +
      '<div class="card"><h3>Hotspots</h3><ul class="loc-list" style="margin-top:10px">' + locs.map(function (l) { return '<li data-act="loc" data-city="' + esc(l.city) + '" class="' + (l.city === sel.city ? 'on' : '') + '"><b>' + esc(l.city) + (l.bad ? ' <span class="pill t-red" style="padding:1px 7px">' + l.bad + '</span>' : '') + '</b><span class="bar"><i style="width:' + Math.round(l.n / top * 100) + '%"></i></span><em>' + l.n + '</em></li>'; }).join('') + '</ul></div></div>' +
      '<div class="card"><h3>Flagged scans</h3><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Merchant</th><th>Product</th><th>Location</th><th>Reason</th><th>When</th></tr></thead><tbody>' +
      (flagged.length ? flagged.slice(0, 30).map(function (s) { return '<tr><td>' + esc(s.merchant) + '</td><td>' + esc(s.product) + '<br><span class="mono muted">' + esc(s.code) + '</span></td><td>' + esc(s.city) + '</td><td>' + esc(s.reason) + '</td><td class="muted">' + S.when(s.at) + '</td></tr>'; }).join('') : '<tr><td colspan="5" class="muted">Nothing flagged.</td></tr>') +
      '</tbody></table></div></div>';
  };
  function detail(m) {
    var ver = m.scans.filter(function (s) { return s.result === 'verified'; }).length, fl = m.scans.filter(function (s) { return s.result === 'flagged'; }).length;
    return '<div class="modal-head"><h2>' + esc(m.business) + '</h2><button class="x" data-close aria-label="Close">×</button></div>' +
      '<p style="margin-bottom:14px">' + pill(m.status) + ' <span class="muted">· ' + esc(m.industry) + ' · merchant code <span class="mono">' + esc(m.short) + '</span></span></p>' +
      '<div class="kpis">' + kpi('Products', m.products.length) + kpi('Stores', m.stores.length) + kpi('Scans', m.scans.length) + kpi('Verified', ver, 'k-green') + kpi('Flagged', fl, 'k-red') + '</div>' +
      '<div class="grid g2"><div><h4 style="margin-bottom:8px">Contact</h4><table class="tbl" style="min-width:0"><tbody><tr><td class="muted">Name</td><td>' + esc(m.name) + '</td></tr><tr><td class="muted">Email</td><td>' + esc(m.email) + '</td></tr><tr><td class="muted">Phone</td><td>' + esc(m.phone || '—') + '</td></tr><tr><td class="muted">Address</td><td>' + esc([m.profile.address, m.profile.city, m.profile.state].filter(Boolean).join(', ') || '—') + '</td></tr></tbody></table></div>' +
      '<div><h4 style="margin-bottom:8px">Products</h4>' + (m.products.length ? '<table class="tbl" style="min-width:0"><tbody>' + m.products.map(function (p) { return '<tr><td>' + S.bottle(p.kind, p.color, 34) + '</td><td>' + esc(p.name) + '<br><span class="muted">' + esc(p.size || '') + '</span></td><td>' + (p.codes || 0) + ' codes</td></tr>'; }).join('') + '</tbody></table>' : '<p class="muted">No products yet.</p>') + '</div></div>' +
      '<div class="modal-foot">' + (m.status === 'review' ? '<a class="btn btn-blue" href="#reviews" data-close>Review submission</a>' : '') +
      (m.status === 'live' ? '<button class="btn btn-red" data-act="suspend" data-id="' + m.id + '">Move back to test mode</button>' : '') + '<button class="btn btn-line" data-close>Close</button></div>';
  }

  function render() {
    var s = S.session(); if (!s || s.role !== 'admin') { location.replace('login.html#admin'); return; }
    var v = location.hash.slice(1) || 'overview'; if (!V[v]) v = 'overview';
    document.querySelectorAll('.side nav a').forEach(function (a) { a.classList.toggle('on', a.getAttribute('href') === '#' + v); });
    $('#title').textContent = TITLES[v]; document.title = TITLES[v] + ' · Glouf admin';
    var n = all().filter(function (m) { return m.status === 'review'; }).length;
    $('#revCount').textContent = n; $('#revCount').style.display = n ? '' : 'none';
    $('#view').innerHTML = V[v]();
    $('.app').classList.remove('open');
  }
  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-close]')) { closeModal(); }
    var el = e.target.closest('[data-act]'); if (!el) return;
    var act = el.getAttribute('data-act'), id = el.getAttribute('data-id');
    var m = id && all().filter(function (x) { return x.id === id; })[0];
    if (act === 'menu') $('.app').classList.toggle('open');
    if (act === 'open') modal(detail(m));
    if (act === 'loc') { ui.loc = el.getAttribute('data-city'); render(); }
    if (act === 'approve') { S.adminDecision(id, true); render(); toast(m.business + ' is now live. The merchant has been alerted.'); }
    if (act === 'changes') {
      var note = (document.getElementById('note-' + id) || {}).value || '';
      if (!note.trim()) { toast('Add a note so the merchant knows what to fix.'); document.getElementById('note-' + id).focus(); return; }
      S.adminDecision(id, false, note.trim()); render(); toast('Changes requested. The merchant has been alerted.');
    }
    if (act === 'suspend' && confirm('Move ' + m.business + ' back to test mode?')) { S.updateMerchant(id, function (x) { x.status = 'setup'; S.notify(x, 'Your account has been moved back to test mode. Please contact support.'); }); closeModal(); render(); }
    if (act === 'logout') { S.logout(); location.href = 'login.html'; }
  });
  window.addEventListener('hashchange', function () { render(); window.scrollTo(0, 0); });
  window.addEventListener('storage', render);
  render();
})();
