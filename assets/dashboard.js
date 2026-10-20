(function () {
  'use strict';
  var S = window.GloufStore, esc = S.esc;
  var me = S.current();
  if (!me) { location.replace('login.html'); return; }

  var INDUSTRIES = ['Pharmaceuticals', 'Food & beverage', 'Dairy', 'Cosmetics & skincare', 'Wines & spirits', 'Auto parts', 'Electronics', 'Agro-chemicals', 'Fashion', 'Other'];
  var STATES = ['Abia', 'Abuja (FCT)', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara'];
  var COLORS = ['#1f4fd8', '#0a2240', '#169c55', '#d9434a', '#ffcb47', '#7c3aed', '#c97a2b'];
  var TITLES = { overview: 'Overview', products: 'Products', codes: 'QR codes', stores: 'Stores', analytics: 'Scans & analytics', golive: 'Go live', settings: 'Settings' };
  var ui = { lastBatch: null, product: 'all', loc: null };

  /* ---------- small helpers ---------- */
  function $(sel, el) { return (el || document).querySelector(sel); }
  function opts(list, sel) { return list.map(function (v) { return '<option' + (v === sel ? ' selected' : '') + '>' + esc(v) + '</option>'; }).join(''); }
  function toast(msg) { var t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t); setTimeout(function () { t.remove(); }, 2800); }
  function modal(html, wide) {
    closeModal();
    var bg = document.createElement('div'); bg.className = 'modal-bg'; bg.id = 'modal';
    bg.innerHTML = '<div class="modal' + (wide ? ' wide' : '') + '" role="dialog" aria-modal="true">' + html + '</div>';
    bg.addEventListener('click', function (e) { if (e.target === bg) closeModal(); });
    document.body.appendChild(bg);
    var f = bg.querySelector('input,select,textarea'); if (f) f.focus();
  }
  function closeModal() { var m = $('#modal'); if (m) m.remove(); }
  function head(title) { return '<div class="modal-head"><h2>' + title + '</h2><button class="x" data-close aria-label="Close">×</button></div>'; }
  function prod(id) { return me.products.filter(function (p) { return p.id === id; })[0]; }
  function pill(result) {
    if (result === 'verified') return '<span class="pill t-green">Verified</span>';
    if (result === 'flagged') return '<span class="pill t-red">Flagged</span>';
    return '<span class="pill t-amber">Test scan</span>';
  }
  function statusPill() { var s = S.STATUS[me.status]; return '<span class="pill t-' + s.tone + '">' + s.label + '</span>'; }
  function totalCodes() { return me.batches.reduce(function (a, b) { return a + b.qty; }, 0); }
  function mapSrc(q, z) { return 'https://maps.google.com/maps?q=' + encodeURIComponent(q) + '&z=' + (z || 14) + '&output=embed'; }
  function days(n, scans) {
    var out = [];
    for (var i = n - 1; i >= 0; i--) {
      var d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
      var e = new Date(d); e.setDate(e.getDate() + 1);
      var day = scans.filter(function (s) { var t = new Date(s.at); return t >= d && t < e; });
      out.push({ label: d.toLocaleDateString('en-GB', { weekday: n > 7 ? undefined : 'short', day: n > 7 ? 'numeric' : undefined }), ok: day.filter(function (s) { return s.result !== 'flagged'; }).length, bad: day.filter(function (s) { return s.result === 'flagged'; }).length });
    }
    return out;
  }
  function chart(data) {
    var max = Math.max.apply(null, data.map(function (d) { return d.ok + d.bad; }).concat([1]));
    return '<div class="chart">' + data.map(function (d) {
      var h = Math.round((d.ok + d.bad) / max * 100);
      return '<div class="col" title="' + (d.ok + d.bad) + ' scans"><div class="stack" style="height:' + Math.max(h, 3) + '%">' +
        '<i style="flex:' + d.ok + ';background:var(--blue)"></i><i style="flex:' + d.bad + ';background:var(--red)"></i></div><small>' + d.label + '</small></div>';
    }).join('') + '</div><div class="legend"><span style="--c:var(--blue)">Verified / test</span><span style="--c:var(--red)">Flagged</span></div>';
  }
  function locations(scans) {
    var map = {};
    scans.forEach(function (s) { (map[s.city] = map[s.city] || { city: s.city, lat: s.lat, lng: s.lng, n: 0, bad: 0 }).n++; if (s.result === 'flagged') map[s.city].bad++; });
    return Object.keys(map).map(function (k) { return map[k]; }).sort(function (a, b) { return b.n - a.n; });
  }

  /* ---------- views ---------- */
  var V = {};

  V.overview = function () {
    var steps = [
      ['Create your merchant account', 'Done. Welcome to Glouf.', true, ''],
      ['Complete your business profile', 'Add your business address.', !!me.profile.address, '<a class="btn btn-soft btn-sm" href="#settings">Add details</a>'],
      ['Add your first product', 'Name, size, price and look.', me.products.length > 0, '<button class="btn btn-soft btn-sm" data-act="add-product">Add product</button>'],
      ['Add a store (optional)', 'Where customers can find you.', me.stores.length > 0, '<button class="btn btn-soft btn-sm" data-act="add-store">Add store</button>'],
      ['Generate test QR codes', 'Try your codes before going live.', me.batches.length > 0, '<a class="btn btn-soft btn-sm" href="#codes">Generate</a>'],
      ['Click "Go live" and submit documents', 'We review them for you.', me.status === 'review' || me.status === 'live', '<a class="btn btn-blue btn-sm" href="#golive">Go live</a>'],
      ['Account live', 'Your codes become active.', me.status === 'live', '']
    ];
    var done = steps.filter(function (s) { return s[2]; }).length;
    var sc = me.scans, ver = sc.filter(function (s) { return s.result === 'verified'; }).length, fl = sc.filter(function (s) { return s.result === 'flagged'; }).length;
    var locs = locations(sc).slice(0, 5), top = locs[0] ? locs[0].n : 1;
    return banner() +
      '<div class="kpis">' +
      kpi('Products', me.products.length) + kpi('QR codes generated', totalCodes().toLocaleString()) +
      kpi('Scans (clicks)', sc.length) + kpi('Verified', ver, 'k-green') + kpi('Flagged', fl, 'k-red') +
      '</div>' +
      '<div class="grid g-21 mb">' +
      '<div class="card"><div class="card-head"><div><h3>Scans this week</h3><p class="sub">Every time a shopper scans one of your codes.</p></div><a class="btn btn-soft btn-sm" href="#analytics">View analytics</a></div>' + chart(days(7, sc)) + '</div>' +
      '<div class="card"><h3>Get set up</h3><p class="sub">' + done + ' of ' + steps.length + ' complete</p><div class="progress"><i style="width:' + Math.round(done / steps.length * 100) + '%"></i></div>' +
      '<ul class="steps">' + steps.map(function (s, i) {
        return '<li class="' + (s[2] ? 'done' : '') + '"><span class="tick">' + (s[2] ? '✓' : i + 1) + '</span><span class="t"><b>' + s[0] + '</b><span>' + s[1] + '</span></span>' + (s[2] ? '' : s[3]) + '</li>';
      }).join('') + '</ul></div>' +
      '</div>' +
      '<div class="grid g2">' +
      '<div class="card"><div class="card-head"><h3>Recent scans</h3></div>' + (sc.length ? scanTable(sc.slice(0, 6)) : '<p class="empty">No scans yet. Generate codes, then test a scan.</p>') + '</div>' +
      '<div class="card"><div class="card-head"><h3>Top locations</h3></div>' + (locs.length ? '<ul class="loc-list">' + locs.map(function (l) {
        return '<li data-act="goto-loc" data-city="' + esc(l.city) + '"><b>' + esc(l.city) + '</b><span class="bar"><i style="width:' + Math.round(l.n / top * 100) + '%"></i></span><em>' + l.n + '</em></li>';
      }).join('') + '</ul>' : '<p class="empty">Locations appear once your codes are scanned.</p>') + '</div>' +
      '</div>';
  };
  function kpi(label, val, cls, em) { return '<div class="kpi ' + (cls || '') + '"><small>' + label + '</small><b>' + val + '</b>' + (em ? '<em>' + em + '</em>' : '') + '</div>'; }
  function banner() {
    var s = me.status;
    if (s === 'setup') return '<div class="banner b-amber"><span class="ic">!</span><div class="txt"><h3>You\'re in test mode</h3><p>Set up your products and try your codes. When you\'re ready, click "Go live" and submit your documents.</p></div><a class="btn btn-blue" href="#golive">Go live</a></div>';
    if (s === 'review') return '<div class="banner b-blue"><span class="ic">⏳</span><div class="txt"><h3>Your documents are under review</h3><p>We\'re checking your submission. We\'ll alert you here as soon as your account is live.</p></div><a class="btn btn-line" href="#golive">View submission</a></div>';
    if (s === 'changes') return '<div class="banner b-red"><span class="ic">✎</span><div class="txt"><h3>Changes requested</h3><p>' + esc(me.reviewNote) + '</p></div><a class="btn btn-blue" href="#golive">Update and resubmit</a></div>';
    return '<div class="banner b-green"><span class="ic">✓</span><div class="txt"><h3>Your account is live</h3><p>Your QR codes are active. Shoppers who scan them will see your verified products.</p></div><a class="btn btn-blue" href="#codes">Generate codes</a></div>';
  }
  function scanTable(list) {
    return '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Product</th><th>Location</th><th>Result</th><th>When</th></tr></thead><tbody>' +
      list.map(function (s) { var p = prod(s.productId); return '<tr><td>' + esc(p ? p.name : '—') + '<br><span class="mono muted">' + esc(s.code) + '</span></td><td>' + esc(s.city) + '</td><td>' + pill(s.result) + (s.reason ? '<br><small class="muted">' + esc(s.reason) + '</small>' : '') + '</td><td class="muted">' + S.when(s.at) + '</td></tr>'; }).join('') +
      '</tbody></table></div>';
  }

  V.products = function () {
    var head = '<div class="card-head"><p class="muted">Add each product you want to protect. You\'ll generate unique QR codes for it next.</p><button class="btn btn-blue" data-act="add-product">+ Add product</button></div>';
    if (!me.products.length) return head + '<div class="card empty">' + S.bottle('drink', '#1f4fd8', 90) + '<h3>No products yet</h3><p>Add your first product to start generating QR codes.</p><button class="btn btn-blue" data-act="add-product">Add your first product</button></div>';
    return head + '<div class="prods">' + me.products.map(function (p) {
      var scans = me.scans.filter(function (s) { return s.productId === p.id; }).length;
      return '<div class="prod"><div class="prod-top"><div class="prod-thumb">' + S.bottle(p.kind, p.color, 64) + '</div><div><h3>' + esc(p.name) + '</h3><span class="muted" style="font-size:.84rem">' + esc(p.category) + '</span></div></div>' +
        '<div class="meta"><span>Size</span><b>' + esc(p.size || '—') + '</b><span>Price</span><b>' + S.money(p.price) + '</b><span>SKU</span><b>' + esc(p.sku || '—') + '</b><span>Codes · scans</span><b>' + (p.codes || 0).toLocaleString() + ' · ' + scans + '</b></div>' +
        '<div class="acts"><button class="btn btn-blue btn-sm" data-act="gen-for" data-id="' + p.id + '">Generate codes</button><button class="btn btn-soft btn-sm" data-act="edit-product" data-id="' + p.id + '">Edit</button><button class="btn btn-red btn-sm" data-act="del-product" data-id="' + p.id + '">Delete</button></div></div>';
    }).join('') + '</div>';
  };

  V.codes = function () {
    if (!me.products.length) return '<div class="card empty">' + S.bottle('drink', '#ffcb47', 90) + '<h3>Add a product first</h3><p>QR codes are linked to a product, so start by adding one.</p><button class="btn btn-blue" data-act="add-product">Add product</button></div>';
    var test = me.status !== 'live';
    var last = ui.lastBatch && me.batches.filter(function (b) { return b.id === ui.lastBatch; })[0];
    return (test ? '<div class="banner b-amber"><span class="ic">!</span><div class="txt"><h3>Test codes</h3><p>Codes work for testing now. They become active for shoppers once your account is live.</p></div><a class="btn btn-line btn-sm" href="#golive">Go live</a></div>' : '') +
      '<div class="card mb"><h3>Generate QR codes</h3><p class="sub" style="margin-bottom:16px">Each unit gets its own unique code, so copied codes are easy to spot.</p>' +
      '<form data-form="generate" class="row2" style="align-items:end"><div class="field"><label for="g-prod">Product</label><select id="g-prod" name="product">' +
      me.products.map(function (p) { return '<option value="' + p.id + '"' + (ui.genFor === p.id ? ' selected' : '') + '>' + esc(p.name) + '</option>'; }).join('') +
      '</select></div><div class="field"><label for="g-qty">How many codes? <small>(1 to 500)</small></label><input id="g-qty" name="qty" type="number" min="1" max="500" value="50" required></div>' +
      '<div><button class="btn btn-blue" type="submit">Generate codes</button></div></form></div>' +
      (last ? batchPreview(last) : '') +
      '<div class="card"><div class="card-head"><h3>Your batches</h3></div>' + (me.batches.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Created</th><th>Product</th><th>Codes</th><th>Range</th><th>Status</th><th></th></tr></thead><tbody>' +
        me.batches.map(function (b) {
          var p = prod(b.productId), c = S.batchCodes(me, b);
          return '<tr><td class="muted">' + S.when(b.createdAt) + '</td><td>' + esc(p ? p.name : '—') + '</td><td>' + b.qty + '</td><td class="mono">…' + esc(c[0].slice(-6)) + ' – …' + esc(c[c.length - 1].slice(-6)) + '</td><td>' + (me.status === 'live' ? '<span class="pill t-green">Active</span>' : '<span class="pill t-amber">Test</span>') + '</td>' +
            '<td style="white-space:nowrap"><button class="btn btn-soft btn-sm" data-act="view-batch" data-id="' + b.id + '">View</button> <button class="btn btn-soft btn-sm" data-act="print-batch" data-id="' + b.id + '">Print</button> <button class="btn btn-line btn-sm" data-act="test-scan" data-id="' + b.id + '">Test a scan</button></td></tr>';
        }).join('') + '</tbody></table></div>' : '<p class="empty">No codes yet. Generate your first batch above.</p>') + '</div>';
  };
  function batchPreview(b) {
    var p = prod(b.productId), codes = S.batchCodes(me, b, 12), test = me.status !== 'live';
    return '<div class="card mb"><div class="card-head"><div><h3>' + b.qty + ' codes for ' + esc(p ? p.name : '') + '</h3><p class="sub">Showing the first ' + codes.length + '.</p></div><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-blue btn-sm" data-act="print-batch" data-id="' + b.id + '">Print all ' + b.qty + ' labels</button><button class="btn btn-soft btn-sm" data-act="dl-svg" data-code="' + codes[0] + '">Download first as SVG</button></div></div>' +
      '<div class="qr-grid">' + codes.map(function (c) { return '<div class="qr-item">' + (test ? '<span class="test">TEST</span>' : '') + S.qrSvg(S.verifyUrl(c), 3) + '<code>' + c + '</code></div>'; }).join('') + '</div></div>';
  }

  V.stores = function () {
    var head = '<div class="card-head"><p class="muted">Add the shops and outlets where your products are sold.</p><button class="btn btn-blue" data-act="add-store">+ Add store</button></div>';
    if (!me.stores.length) return head + '<div class="card empty"><svg width="70" height="70" viewBox="0 0 24 24" fill="none" stroke="#1f4fd8" stroke-width="1.6"><path d="M3 9l1.5-5h15L21 9M3 9h18v11H3zM9 20v-6h6v6"/></svg><h3>No stores yet</h3><p>Add your shops so you can manage locations and in-store codes.</p><button class="btn btn-blue" data-act="add-store">Add your first store</button></div>';
    return head + '<div class="stores">' + me.stores.map(function (s) {
      var q = [s.address, s.city, s.state, 'Nigeria'].filter(Boolean).join(', ');
      return '<div class="store"><iframe loading="lazy" title="Map of ' + esc(s.name) + '" src="' + mapSrc(q, 15) + '"></iframe><div class="body"><h3>' + esc(s.name) + '</h3><span class="muted">' + esc(q) + '</span>' + (s.phone ? '<span class="muted">' + esc(s.phone) + '</span>' : '') +
        '<div class="acts"><a class="btn btn-soft btn-sm" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q) + '">Open in Google Maps</a><button class="btn btn-soft btn-sm" data-act="store-qr" data-id="' + s.id + '">Store QR</button><button class="btn btn-red btn-sm" data-act="del-store" data-id="' + s.id + '">Delete</button></div></div></div>';
    }).join('') + '</div>';
  };

  V.analytics = function () {
    var all = me.scans, sc = ui.product === 'all' ? all : all.filter(function (s) { return s.productId === ui.product; });
    var filter = '<div class="card-head"><div class="field" style="margin:0;min-width:240px"><select data-act="filter-product" aria-label="Filter by product"><option value="all">All products</option>' +
      me.products.map(function (p) { return '<option value="' + p.id + '"' + (ui.product === p.id ? ' selected' : '') + '>' + esc(p.name) + '</option>'; }).join('') + '</select></div>' +
      (me.batches.length ? '<button class="btn btn-soft btn-sm" data-act="sample-scans">+ Add 40 sample scans</button>' : '') + '</div>';
    if (!all.length) {
      return '<div class="card empty"><svg width="70" height="70" viewBox="0 0 24 24" fill="none" stroke="#1f4fd8" stroke-width="1.6"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg><h3>No scans yet</h3><p>' + (me.batches.length ? 'Test-scan your codes, or load sample scans to see how analytics look.' : 'Generate QR codes first. Scans appear here when shoppers scan them.') + '</p>' +
        (me.batches.length ? '<button class="btn btn-blue" data-act="sample-scans">Load 40 sample scans</button>' : '<a class="btn btn-blue" href="#codes">Generate codes</a>') + '</div>';
    }
    var ver = sc.filter(function (s) { return s.result === 'verified'; }).length, fl = sc.filter(function (s) { return s.result === 'flagged'; }).length;
    var uniq = {}; sc.forEach(function (s) { uniq[s.code] = 1; });
    var locs = locations(sc), top = locs[0] ? locs[0].n : 1;
    if (!ui.loc || !locs.some(function (l) { return l.city === ui.loc; })) ui.loc = locs[0] ? locs[0].city : null;
    var sel = locs.filter(function (l) { return l.city === ui.loc; })[0];
    var byProd = me.products.map(function (p) {
      var ps = all.filter(function (s) { return s.productId === p.id; });
      return { p: p, n: ps.length, v: ps.filter(function (s) { return s.result === 'verified'; }).length, f: ps.filter(function (s) { return s.result === 'flagged'; }).length };
    }).filter(function (x) { return x.n; }).sort(function (a, b) { return b.n - a.n; });
    var flagged = sc.filter(function (s) { return s.result === 'flagged'; });
    return filter +
      '<div class="kpis">' + kpi('Scans (clicks)', sc.length) + kpi('Unique codes scanned', Object.keys(uniq).length) +
      kpi('Verified rate', sc.length ? Math.round(ver / sc.length * 100) + '%' : '—', 'k-green', me.status === 'live' ? '' : 'Test scans until live') + kpi('Flagged', fl, 'k-red') + '</div>' +
      '<div class="card mb"><h3>Scans over the last 14 days</h3>' + chart(days(14, sc)) + '</div>' +
      '<div class="grid g-21 mb"><div class="card"><div class="card-head"><div><h3>Where your products are scanned</h3><p class="sub">Tap a location to see it on the map.</p></div></div>' +
      (sel ? '<iframe class="map" loading="lazy" title="Map of ' + esc(sel.city) + '" src="' + mapSrc(sel.lat + ',' + sel.lng, 11) + '"></iframe>' : '') + '</div>' +
      '<div class="card"><h3>Locations</h3><ul class="loc-list" style="margin-top:10px">' + locs.map(function (l) {
        return '<li data-act="pick-loc" data-city="' + esc(l.city) + '" class="' + (l.city === ui.loc ? 'on' : '') + '"><b>' + esc(l.city) + (l.bad ? ' <span class="pill t-red" style="padding:1px 7px">' + l.bad + '</span>' : '') + '</b><span class="bar"><i style="width:' + Math.round(l.n / top * 100) + '%"></i></span><em>' + l.n + '</em></li>';
      }).join('') + '</ul></div></div>' +
      '<div class="grid g2"><div class="card"><h3>By product</h3><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Product</th><th>Scans</th><th>Verified</th><th>Flagged</th></tr></thead><tbody>' +
      byProd.map(function (x) { return '<tr><td>' + esc(x.p.name) + '</td><td>' + x.n + '</td><td>' + x.v + '</td><td>' + x.f + '</td></tr>'; }).join('') + '</tbody></table></div></div>' +
      '<div class="card"><h3>Flagged scans</h3><p class="sub">Possible counterfeits to look into.</p>' + (flagged.length ? scanTable(flagged.slice(0, 8)) : '<p class="empty">Nothing flagged. </p>') + '</div></div>';
  };

  V.golive = function () {
    var s = me.status, has = me.products.length > 0;
    var tracker = '<div class="tracker">' +
      tk('1. Set up', 'Products and codes', has ? 'done' : 'now') +
      tk('2. Submit documents', 'Click "Go live"', s === 'review' || s === 'live' ? 'done' : (has ? 'now' : '')) +
      tk('3. Review', 'We check your details', s === 'live' ? 'done' : (s === 'review' ? 'now' : '')) +
      tk('4. Live', 'Codes are active', s === 'live' ? 'done' : '') + '</div>';
    if (s === 'live') return tracker + '<div class="banner b-green"><span class="ic">✓</span><div class="txt"><h3>You\'re live</h3><p>Approved ' + (me.liveAt ? S.when(me.liveAt) : '') + '. Your codes are active and shoppers can verify your products.</p></div><a class="btn btn-blue" href="#codes">Print codes</a></div>' + submission();
    if (s === 'review') return tracker + '<div class="banner b-blue"><span class="ic">⏳</span><div class="txt"><h3>Under review</h3><p>Submitted ' + S.when(me.golive.submittedAt) + '. We\'ll alert you here, and by email, once your account is live.</p></div></div>' + submission();
    var g = me.golive || {};
    return tracker + (s === 'changes' ? '<div class="banner b-red"><span class="ic">✎</span><div class="txt"><h3>Changes requested</h3><p>' + esc(me.reviewNote) + '</p></div></div>' : '') +
      (!has ? '<div class="banner b-amber"><span class="ic">!</span><div class="txt"><h3>Add a product first</h3><p>You need at least one product before you can go live.</p></div><button class="btn btn-blue" data-act="add-product">Add product</button></div>' : '') +
      '<form class="card" data-form="golive"><h3>Ready to go live?</h3><p class="sub" style="margin-bottom:18px">Submit your business details and documents. Once approved, your account and codes go live.</p>' +
      '<div class="row2"><div class="field"><label>Registered business name</label><input name="legal" required value="' + esc(g.legal || me.business) + '"></div><div class="field"><label>CAC RC number</label><input name="rc" required placeholder="e.g. RC 1234567" value="' + esc(g.rc || '') + '"></div></div>' +
      '<div class="row2"><div class="field"><label>Tax ID (TIN) <small>(optional)</small></label><input name="tin" value="' + esc(g.tin || '') + '"></div><div class="field"><label>Director\'s full name</label><input name="director" required value="' + esc(g.director || me.name) + '"></div></div>' +
      '<div class="row2"><div class="field"><label>Business address</label><input name="address" required value="' + esc(g.address || me.profile.address || '') + '"></div><div class="field"><label>State</label><select name="state" required><option value="">Select state</option>' + opts(STATES, g.state || me.profile.state) + '</select></div></div>' +
      '<h3 style="margin:10px 0 12px;font-size:1rem">Documents</h3><div class="grid g2" style="gap:10px;margin-bottom:16px">' +
      fileBox('cac', 'CAC certificate', 'Certificate of incorporation or business name', true, g) +
      fileBox('id', 'Director\'s valid ID', 'NIN slip, passport or driver\'s licence', true, g) +
      fileBox('addr', 'Proof of business address', 'Recent utility bill or tenancy agreement', true, g) +
      fileBox('reg', 'Product approval', 'NAFDAC or SON certificate, if your products need one', false, g) +
      fileBox('tm', 'Trademark certificate', 'Optional, helps protect your brand', false, g) +
      '</div><label class="check"><input type="checkbox" required> I confirm these details are correct and I\'m authorised to register these products for my business.</label>' +
      '<p class="err" id="gl-err"></p><button class="btn btn-blue" type="submit"' + (has ? '' : ' disabled') + '>Submit for review</button></form>';
  };
  function tk(t, s, st) { return '<div class="' + st + '"><b>' + t + '</b><span>' + s + '</span></div>'; }
  function fileBox(name, title, hint, req, g) {
    var docs = g.docs || {}, f = docs[name];
    return '<label class="file' + (f ? ' has' : '') + '"><input type="file" name="' + name + '" accept=".pdf,.jpg,.jpeg,.png"' + (req ? ' data-req="1"' : '') + '><span class="fi">' + (f ? '✓' : '↑') + '</span><span><b>' + title + (req ? '' : ' <small class="muted">(optional)</small>') + '</b><span data-fname>' + (f ? esc(f) : hint) + '</span></span></label>';
  }
  function submission() {
    var g = me.golive; if (!g) return '';
    var names = { cac: 'CAC certificate', id: 'Director\'s ID', addr: 'Proof of address', reg: 'Product approval', tm: 'Trademark certificate' };
    return '<div class="card"><h3>Your submission</h3><div class="tbl-wrap"><table class="tbl" style="min-width:0"><tbody>' +
      [['Business name', g.legal], ['RC number', g.rc], ['TIN', g.tin || '—'], ['Director', g.director], ['Address', g.address + ', ' + g.state]].map(function (r) { return '<tr><td class="muted">' + r[0] + '</td><td>' + esc(r[1]) + '</td></tr>'; }).join('') +
      Object.keys(g.docs || {}).map(function (k) { return '<tr><td class="muted">' + names[k] + '</td><td>📎 ' + esc(g.docs[k]) + '</td></tr>'; }).join('') +
      '</tbody></table></div></div>';
  }

  V.settings = function () {
    return '<div class="grid g-21"><form class="card" data-form="profile"><h3>Business profile</h3><p class="sub" style="margin-bottom:16px">Shown to shoppers when they verify your products.</p>' +
      '<div class="row2"><div class="field"><label>Business name</label><input name="business" required value="' + esc(me.business) + '"></div><div class="field"><label>Industry</label><select name="industry">' + opts(INDUSTRIES, me.industry) + '</select></div></div>' +
      '<div class="row2"><div class="field"><label>Contact name</label><input name="name" required value="' + esc(me.name) + '"></div><div class="field"><label>Phone</label><input name="phone" value="' + esc(me.phone) + '"></div></div>' +
      '<div class="field"><label>Business address</label><input name="address" value="' + esc(me.profile.address) + '"></div>' +
      '<div class="row2"><div class="field"><label>City / area</label><input name="city" value="' + esc(me.profile.city) + '"></div><div class="field"><label>State</label><select name="state"><option value="">Select state</option>' + opts(STATES, me.profile.state) + '</select></div></div>' +
      '<button class="btn btn-blue" type="submit">Save changes</button></form>' +
      '<div><div class="card mb"><h3>Account</h3><table class="tbl" style="min-width:0;margin-top:8px"><tbody><tr><td class="muted">Email</td><td>' + esc(me.email) + '</td></tr><tr><td class="muted">Merchant code</td><td class="mono">' + esc(me.short) + '</td></tr><tr><td class="muted">Status</td><td>' + statusPill() + '</td></tr><tr><td class="muted">Joined</td><td>' + new Date(me.createdAt).toLocaleDateString('en-GB') + '</td></tr></tbody></table>' +
      '<div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap"><button class="btn btn-line btn-sm" data-act="logout">Sign out</button></div></div>' +
      '<div class="card"><h3>Prototype data</h3><p class="sub">This preview saves everything in this browser only.</p><button class="btn btn-red btn-sm" style="margin-top:12px" data-act="reset">Delete all prototype data</button></div></div></div>';
  };

  /* ---------- modals ---------- */
  function productForm(p) {
    p = p || { kind: 'drink', color: COLORS[0], category: me.industry || INDUSTRIES[0] };
    return head(p.id ? 'Edit product' : 'Add a product') + '<form data-form="product" data-id="' + (p.id || '') + '">' +
      '<div class="field"><label>Product name</label><input name="name" required placeholder="e.g. Pure Dairy Full-Cream Milk" value="' + esc(p.name || '') + '"></div>' +
      '<div class="row2"><div class="field"><label>Category</label><select name="category">' + opts(INDUSTRIES, p.category) + '</select></div><div class="field"><label>Size / weight</label><input name="size" placeholder="e.g. 500 ml or 250 g" value="' + esc(p.size || '') + '"></div></div>' +
      '<div class="row2"><div class="field"><label>Price (₦) <small>(optional)</small></label><input name="price" type="number" min="0" step="1" value="' + esc(p.price || '') + '"></div><div class="field"><label>SKU / barcode <small>(optional)</small></label><input name="sku" value="' + esc(p.sku || '') + '"></div></div>' +
      '<div class="field"><label>NAFDAC / SON number <small>(if applicable)</small></label><input name="reg" value="' + esc(p.reg || '') + '"></div>' +
      '<div class="row2"><div class="field"><label>Container</label><div class="kinds">' + ['drink', 'pharma', 'pump'].map(function (k) {
        return '<label><input type="radio" name="kind" value="' + k + '"' + (p.kind === k ? ' checked' : '') + '><span>' + S.bottle(k, p.color, 56) + '</span></label>';
      }).join('') + '</div></div><div class="field"><label>Label colour</label><div class="swatches">' + COLORS.map(function (c) {
        return '<label><input type="radio" name="color" value="' + c + '"' + (p.color === c ? ' checked' : '') + '><span style="background:' + c + '"></span></label>';
      }).join('') + '</div></div></div>' +
      '<div class="modal-foot"><button type="button" class="btn btn-line" data-close>Cancel</button><button class="btn btn-blue" type="submit">' + (p.id ? 'Save product' : 'Add product') + '</button></div></form>';
  }
  function storeForm() {
    return head('Add a store') + '<form data-form="store"><div class="field"><label>Store name</label><input name="name" required placeholder="e.g. Pure Dairy Outlet, Ikeja"></div>' +
      '<div class="field"><label>Street address</label><input name="address" required placeholder="e.g. 12 Allen Avenue"></div>' +
      '<div class="row2"><div class="field"><label>City / area</label><input name="city" required placeholder="e.g. Ikeja"></div><div class="field"><label>State</label><select name="state" required><option value="">Select state</option>' + opts(STATES, 'Lagos') + '</select></div></div>' +
      '<div class="field"><label>Phone <small>(optional)</small></label><input name="phone" type="tel"></div>' +
      '<div class="modal-foot"><button type="button" class="btn btn-line" data-close>Cancel</button><button class="btn btn-blue" type="submit">Add store</button></div></form>';
  }

  /* ---------- printing / downloads ---------- */
  function printCodes(b) {
    var p = prod(b.productId), codes = S.batchCodes(me, b), test = me.status !== 'live';
    $('#printArea').innerHTML = codes.map(function (c) { return '<div class="lbl">' + S.qrSvg(S.verifyUrl(c), 3) + '<code>' + c + '</code><small>' + (test ? 'TEST · ' : '') + esc(p ? p.name : '') + ' · Scan with Glouf to verify</small></div>'; }).join('');
    setTimeout(function () { window.print(); }, 50);
  }
  function download(name, text, type) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: type || 'image/svg+xml' }));
    a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  /* ---------- render ---------- */
  function render() {
    me = S.current();
    if (!me) { location.replace('login.html'); return; }
    var v = location.hash.slice(1) || 'overview';
    if (!V[v]) v = 'overview';
    document.querySelectorAll('.side nav a').forEach(function (a) { a.classList.toggle('on', a.getAttribute('href') === '#' + v); });
    $('#title').textContent = TITLES[v];
    document.title = TITLES[v] + ' · Glouf merchant';
    $('#st').innerHTML = statusPill();
    $('#uname').textContent = me.business; $('#uemail').textContent = me.email;
    $('#avatar').textContent = (me.business || '?').trim()[0].toUpperCase();
    renderBell();
    $('#view').innerHTML = V[v]();
    $('.app').classList.remove('open');
  }
  function renderBell() {
    var unread = me.notifications.filter(function (n) { return !n.read; }).length;
    $('#bellCount').textContent = unread; $('#bellCount').style.display = unread ? '' : 'none';
    $('#bellMenu').innerHTML = me.notifications.length ? me.notifications.slice(0, 20).map(function (n) { return '<p class="' + (n.read ? '' : 'unread') + '">' + esc(n.text) + '<small>' + S.when(n.at) + '</small></p>'; }).join('') : '<p>No notifications yet.</p>';
  }
  function save(fn) { S.updateMerchant(me.id, fn); me = S.current(); }

  /* ---------- events ---------- */
  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-close]')) { closeModal(); return; }
    var bell = e.target.closest('.bell>button');
    if (bell) {
      var wrap = bell.parentNode, open = !wrap.classList.contains('open');
      wrap.classList.toggle('open', open);
      if (open) save(function (m) { m.notifications.forEach(function (n) { n.read = true; }); });
      else renderBell();
      return;
    }
    if (!e.target.closest('.bell')) { var b = $('.bell.open'); if (b) { b.classList.remove('open'); renderBell(); } }
    var el = e.target.closest('[data-act]'); if (!el) return;
    var act = el.getAttribute('data-act'), id = el.getAttribute('data-id');
    if (el.tagName === 'SELECT') return;
    switch (act) {
      case 'menu': $('.app').classList.toggle('open'); break;
      case 'add-product': modal(productForm()); break;
      case 'edit-product': modal(productForm(prod(id))); break;
      case 'del-product':
        if (confirm('Delete this product? Its codes will stop working.')) { save(function (m) { m.products = m.products.filter(function (p) { return p.id !== id; }); m.batches = m.batches.filter(function (b) { return b.productId !== id; }); }); render(); toast('Product deleted'); }
        break;
      case 'gen-for': ui.genFor = id; location.hash = 'codes'; break;
      case 'view-batch':
        var bt = me.batches.filter(function (b) { return b.id === id; })[0];
        modal(head('Batch preview') + batchPreview(bt).replace('class="card mb"', 'class=""'), true); break;
      case 'print-batch': printCodes(me.batches.filter(function (b) { return b.id === id; })[0]); break;
      case 'dl-svg': download(el.getAttribute('data-code') + '.svg', S.qrSvg(S.verifyUrl(el.getAttribute('data-code')), 8)); break;
      case 'test-scan':
        var b2 = me.batches.filter(function (b) { return b.id === id; })[0], codes = S.batchCodes(me, b2, 50);
        var r = S.recordScan(codes[Math.floor(Math.random() * codes.length)]);
        me = S.current(); render();
        toast(r.result === 'verified' ? 'Scan recorded in ' + r.city + ': verified ✓' : r.result === 'flagged' ? 'Scan flagged in ' + r.city : 'Test scan recorded in ' + r.city);
        break;
      case 'add-store': modal(storeForm()); break;
      case 'del-store': if (confirm('Delete this store?')) { save(function (m) { m.stores = m.stores.filter(function (s) { return s.id !== id; }); }); render(); } break;
      case 'store-qr':
        var st = me.stores.filter(function (s) { return s.id === id; })[0], data = 'GLOUF-STORE:' + me.short + ':' + st.id;
        modal(head(esc(st.name)) + '<div class="qr-one">' + S.qrSvg(data, 6) + '<div><h3>Store code</h3><p class="muted" style="margin:6px 0 14px">Display this at the till. Once your Glouf payments account is connected, customers scan it to pay in store.</p><button class="btn btn-blue btn-sm" data-act="dl-store" data-id="' + st.id + '">Download SVG</button></div></div>');
        break;
      case 'dl-store': download('store-' + id + '.svg', S.qrSvg('GLOUF-STORE:' + me.short + ':' + id, 8)); break;
      case 'sample-scans':
        try { S.simulateScans(me.id, 40); me = S.current(); render(); toast('40 sample scans added'); } catch (err) { toast(err.message); }
        break;
      case 'pick-loc': ui.loc = el.getAttribute('data-city'); render(); break;
      case 'goto-loc': ui.loc = el.getAttribute('data-city'); location.hash = 'analytics'; break;
      case 'logout': S.logout(); location.href = 'login.html'; break;
      case 'reset': if (confirm('Delete all prototype data saved in this browser?')) { try { localStorage.removeItem('glouf_demo_v1'); } catch (er) {} location.href = 'signup.html'; } break;
    }
  });
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (t.matches('[data-act="filter-product"]')) { ui.product = t.value; render(); return; }
    if (t.type === 'file') {
      var box = t.closest('.file'), f = t.files[0];
      box.classList.toggle('has', !!f); box.querySelector('.fi').textContent = f ? '✓' : '↑';
      if (f) box.querySelector('[data-fname]').textContent = f.name;
    }
    if (t.name === 'color' || t.name === 'kind') {
      var form = t.form, color = form.querySelector('[name=color]:checked').value;
      form.querySelectorAll('.kinds span').forEach(function (sp, i) { sp.innerHTML = S.bottle(['drink', 'pharma', 'pump'][i], color, 56); });
    }
  });
  document.addEventListener('submit', function (e) {
    var f = e.target, kind = f.getAttribute('data-form'); if (!kind) return;
    e.preventDefault();
    var d = {}; new FormData(f).forEach(function (v, k) { if (typeof v === 'string') d[k] = v.trim(); });
    if (kind === 'product') {
      var pid = f.getAttribute('data-id');
      save(function (m) {
        if (pid) { var p = m.products.filter(function (x) { return x.id === pid; })[0]; ['name', 'category', 'size', 'price', 'sku', 'reg', 'kind', 'color'].forEach(function (k) { p[k] = d[k]; }); }
        else m.products.push({ id: S.newId('p_'), short: S.productShort(m, d.name), name: d.name, category: d.category, size: d.size, price: d.price, sku: d.sku, reg: d.reg, kind: d.kind, color: d.color, codes: 0, nextSeq: 1, createdAt: new Date().toISOString() });
      });
      closeModal(); render(); toast(pid ? 'Product saved' : 'Product added. Next: generate its QR codes.');
    } else if (kind === 'store') {
      save(function (m) { m.stores.push({ id: S.newId('st_'), name: d.name, address: d.address, city: d.city, state: d.state, phone: d.phone }); });
      closeModal(); render(); toast('Store added');
    } else if (kind === 'generate') {
      var q = Math.max(1, Math.min(500, parseInt(d.qty, 10) || 0));
      S.generateBatch(me.id, d.product, q); me = S.current(); ui.lastBatch = me.batches[0].id; ui.genFor = d.product;
      render(); toast(q + ' unique codes generated');
    } else if (kind === 'golive') {
      var docs = {}, missing = [];
      f.querySelectorAll('input[type=file]').forEach(function (inp) {
        var prev = me.golive && me.golive.docs && me.golive.docs[inp.name];
        var name = inp.files[0] ? inp.files[0].name : prev;
        if (name) docs[inp.name] = name; else if (inp.getAttribute('data-req')) missing.push(inp.closest('.file').querySelector('b').textContent);
      });
      if (missing.length) { $('#gl-err').textContent = 'Please upload: ' + missing.join(', ') + '.'; return; }
      S.submitGoLive(me.id, { legal: d.legal, rc: d.rc, tin: d.tin, director: d.director, address: d.address, state: d.state, docs: docs });
      me = S.current(); render(); window.scrollTo(0, 0); toast('Submitted. We\'ll alert you when you\'re live.');
    } else if (kind === 'profile') {
      save(function (m) { m.business = d.business; m.industry = d.industry; m.name = d.name; m.phone = d.phone; m.profile.address = d.address; m.profile.city = d.city; m.profile.state = d.state; });
      render(); toast('Profile saved');
    }
  });
  window.addEventListener('hashchange', function () { render(); window.scrollTo(0, 0); });
  window.addEventListener('storage', function () { render(); });
  render();
  if (/[?&]welcome=1/.test(location.search)) { toast('Account created. Welcome to your dashboard!'); history.replaceState(null, '', location.pathname + location.hash); }
})();
