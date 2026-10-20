/* Glouf prototype data layer.
   Everything is saved in this browser only (localStorage). Replace these
   functions with real API calls when the backend is connected. */
(function () {
  'use strict';
  var KEY = 'glouf_demo_v1';
  var CITIES = [
    ['Ikeja, Lagos', 6.6018, 3.3515], ['Lekki, Lagos', 6.4698, 3.5852], ['Alimosho, Lagos', 6.6194, 3.2711],
    ['Surulere, Lagos', 6.4999, 3.3486], ['Abuja', 9.0765, 7.3986], ['Ibadan', 7.3775, 3.947],
    ['Port Harcourt', 4.8156, 7.0498], ['Kano', 12.0022, 8.592], ['Onitsha', 6.1413, 6.8022],
    ['Aba', 5.1066, 7.3667], ['Benin City', 6.335, 5.6037], ['Enugu', 6.4584, 7.5464]
  ];
  var FLAG_REASONS = [
    'Same code scanned in two cities on the same day',
    'Code scanned more times than expected',
    'Label reported as suspicious by a shopper'
  ];
  var STATUS = {
    setup: { label: 'Test mode', tone: 'amber' },
    review: { label: 'Under review', tone: 'blue' },
    changes: { label: 'Changes requested', tone: 'red' },
    live: { label: 'Live', tone: 'green' }
  };

  function memEmpty() { return { merchants: [], session: null }; }
  var memory = null;
  function read() {
    try {
      var d = JSON.parse(window.localStorage.getItem(KEY));
      if (d && Array.isArray(d.merchants)) return d;
    } catch (e) {}
    return memory || memEmpty();
  }
  function write(d) {
    memory = d;
    try { window.localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {}
  }
  function uid(p) { return p + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4); }
  function now() { return new Date().toISOString(); }
  function hash(s) { var h = 5381; for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return h.toString(36); }
  function short(str, n) {
    var letters = String(str || '').toUpperCase().replace(/[^A-Z0-9 ]/g, '').split(/\s+/).filter(Boolean);
    var out = letters.length > 1 ? letters.map(function (w) { return w[0]; }).join('') : (letters[0] || 'GLF');
    if (out.length < 3) out = (letters.join('') + 'XXX');
    return out.slice(0, n || 4);
  }
  function pad(n, w) { n = String(n); while (n.length < w) n = '0' + n; return n; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var S = {
    STATUS: STATUS, CITIES: CITIES, esc: esc,
    data: function () { return read(); },
    save: function (d) { write(d); },
    mutate: function (fn) { var d = read(); var r = fn(d); write(d); return r; },

    /* ---------- accounts ---------- */
    createMerchant: function (f) {
      return S.mutate(function (d) {
        var email = String(f.email || '').trim().toLowerCase();
        var ex = d.merchants.filter(function (m) { return m.email === email; })[0];
        if (ex) { d.session = { role: 'merchant', id: ex.id }; return ex; }
        var m = {
          id: uid('m_'), short: short(f.business, 4), business: f.business.trim(), name: f.name.trim(), email: email,
          phone: f.phone || '', industry: f.industry || '', pass: hash(f.password || ''), createdAt: now(),
          status: 'setup', profile: { address: '', city: '', state: '' }, golive: null, reviewNote: '',
          products: [], stores: [], batches: [], scans: [], notifications: []
        };
        m.notifications.push({ id: uid('n_'), at: now(), read: false, text: 'Welcome to Glouf! Your account is in test mode. Add your products, then click "Go live" when you\'re ready.' });
        d.merchants.push(m);
        d.session = { role: 'merchant', id: m.id };
        return m;
      });
    },
    login: function (email, password) {
      /* OPEN ACCESS until the backend is connected: any email and any password
         logs in. If no account exists for the email on this device, one is created. */
      email = String(email || '').trim().toLowerCase();
      if (!email) throw new Error('Enter your email to log in.');
      var d = read();
      var m = d.merchants.filter(function (x) { return x.email === email; })[0];
      if (!m) {
        var dom = (email.split('@')[1] || '').split('.')[0] || email.split('@')[0];
        var biz = dom.charAt(0).toUpperCase() + dom.slice(1);
        return S.createMerchant({ business: biz || 'My business', name: email.split('@')[0], email: email, phone: '', industry: '', password: password || '' });
      }
      return S.mutate(function (dd) { dd.session = { role: 'merchant', id: m.id }; return m; });
    },
    loginAdmin: function () { S.mutate(function (d) { d.session = { role: 'admin' }; }); },
    logout: function () { S.mutate(function (d) { d.session = null; }); },
    session: function () { return read().session; },
    current: function () {
      var d = read();
      if (!d.session || d.session.role !== 'merchant') return null;
      return d.merchants.filter(function (m) { return m.id === d.session.id; })[0] || null;
    },
    updateMerchant: function (id, fn) {
      return S.mutate(function (d) {
        var m = d.merchants.filter(function (x) { return x.id === id; })[0];
        if (m) fn(m, d);
        return m;
      });
    },
    notify: function (m, text) { m.notifications.unshift({ id: uid('n_'), at: now(), read: false, text: text }); },

    /* ---------- products, stores ---------- */
    newId: uid,
    productShort: function (m, name) {
      var base = short(name, 3), code = base, i = 2;
      while (m.products.some(function (p) { return p.short === code; })) { code = base.slice(0, 2) + i; i++; }
      return code;
    },

    /* ---------- codes ---------- */
    batchCodes: function (m, b, limit) {
      var p = m.products.filter(function (x) { return x.id === b.productId; })[0];
      var out = [], n = Math.min(b.qty, limit || b.qty);
      for (var i = 0; i < n; i++) out.push('GLF-' + m.short + '-' + (p ? p.short : 'X') + '-' + pad(b.start + i, 6));
      return out;
    },
    generateBatch: function (merchantId, productId, qty) {
      return S.updateMerchant(merchantId, function (m) {
        var p = m.products.filter(function (x) { return x.id === productId; })[0];
        if (!p) throw new Error('Choose a product first.');
        var start = (p.nextSeq || 1);
        p.nextSeq = start + qty;
        p.codes = (p.codes || 0) + qty;
        m.batches.unshift({ id: uid('b_'), productId: productId, qty: qty, start: start, createdAt: now(), live: m.status === 'live' });
      });
    },
    findCode: function (code) {
      var mt = /^GLF-([A-Z0-9]+)-([A-Z0-9]+)-(\d{6})$/.exec(String(code || '').trim().toUpperCase());
      if (!mt) return null;
      var d = read(), seq = parseInt(mt[3], 10);
      for (var i = 0; i < d.merchants.length; i++) {
        var m = d.merchants[i];
        if (m.short !== mt[1]) continue;
        var p = m.products.filter(function (x) { return x.short === mt[2]; })[0];
        if (!p) continue;
        var b = m.batches.filter(function (x) { return x.productId === p.id && seq >= x.start && seq < x.start + x.qty; })[0];
        if (b) return { merchant: m, product: p, batch: b, code: mt[0] };
      }
      return null;
    },
    verifyUrl: function (code) {
      var base = location.href.split('#')[0].split('?')[0].replace(/[^/]*$/, '');
      return base + 'verify.html?code=' + encodeURIComponent(code);
    },
    recordScan: function (code, city, forceFlag) {
      var hit = S.findCode(code);
      if (!hit) return { result: 'unknown' };
      var c = city || CITIES[Math.floor(Math.random() * CITIES.length)];
      var out;
      S.updateMerchant(hit.merchant.id, function (m) {
        var prior = m.scans.filter(function (s) { return s.code === hit.code; });
        var result = m.status === 'live' ? 'verified' : 'test', reason = '';
        if (m.status === 'live' && (forceFlag || prior.length >= 3)) {
          result = 'flagged';
          reason = forceFlag ? FLAG_REASONS[Math.floor(Math.random() * FLAG_REASONS.length)] : 'Code scanned more times than expected';
        }
        out = { id: uid('s_'), code: hit.code, productId: hit.product.id, city: c[0], lat: c[1], lng: c[2], result: result, reason: reason, at: now() };
        m.scans.unshift(out);
        if (result === 'flagged') S.notify(m, 'Suspicious scan: ' + hit.product.name + ' in ' + c[0] + '. ' + reason + '.');
      });
      out.merchant = hit.merchant; out.product = hit.product;
      return out;
    },
    simulateScans: function (merchantId, n) {
      var m = S.updateMerchant(merchantId, function () {});
      if (!m.batches.length) throw new Error('Generate QR codes first.');
      for (var i = 0; i < n; i++) {
        var b = m.batches[Math.floor(Math.random() * m.batches.length)];
        var codes = S.batchCodes(m, b, 50);
        var code = codes[Math.floor(Math.random() * codes.length)];
        var city = CITIES[Math.random() < 0.5 ? Math.floor(Math.random() * 4) : Math.floor(Math.random() * CITIES.length)];
        var past = new Date(Date.now() - Math.floor(Math.random() * 13 * 864e5));
        var r = S.recordScan(code, city, Math.random() < 0.12);
        S.updateMerchant(merchantId, function (mm) { var s = mm.scans.filter(function (x) { return x.id === r.id; })[0]; if (s) s.at = past.toISOString(); });
      }
      S.updateMerchant(merchantId, function (mm) { mm.scans.sort(function (a, b) { return a.at < b.at ? 1 : -1; }); });
    },

    /* ---------- go live / review ---------- */
    submitGoLive: function (merchantId, details) {
      return S.updateMerchant(merchantId, function (m) {
        m.golive = details; m.golive.submittedAt = now();
        m.status = 'review'; m.reviewNote = '';
        if (details.address) { m.profile.address = details.address; m.profile.state = details.state || m.profile.state; }
        S.notify(m, 'We\'ve received your documents. We\'ll review them and alert you here as soon as your account is live.');
      });
    },
    adminDecision: function (merchantId, approve, note) {
      return S.updateMerchant(merchantId, function (m) {
        if (approve) {
          m.status = 'live'; m.liveAt = now(); m.reviewNote = '';
          m.batches.forEach(function (b) { b.live = true; });
          S.notify(m, 'Your account is live! Your QR codes are now active. Print them and apply them to your products.');
        } else {
          m.status = 'changes'; m.reviewNote = note || 'Please review your documents and resubmit.';
          S.notify(m, 'Changes requested on your go-live submission: ' + m.reviewNote);
        }
      });
    },

    /* ---------- helpers ---------- */
    qrSvg: function (text, cell) {
      if (typeof qrcode !== 'function') return '';
      var q = qrcode(0, 'M'); q.addData(text); q.make();
      return q.createSvgTag({ cellSize: cell || 4, margin: 2, scalable: true });
    },
    money: function (v) { var n = Number(v); return isFinite(n) && v !== '' ? '₦' + n.toLocaleString('en-NG') : '—'; },
    when: function (iso) {
      var d = new Date(iso), diff = (Date.now() - d) / 1000;
      if (diff < 60) return 'just now';
      if (diff < 3600) return Math.floor(diff / 60) + ' min ago';
      if (diff < 86400) return Math.floor(diff / 3600) + ' h ago';
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    },
    bottle: function (kind, color, size) {
      size = size || 64; color = color || '#1f4fd8';
      var navy = '#0a2240', body = '#fff';
      var inner;
      if (kind === 'pharma') inner = '<rect x="20" y="0" width="60" height="26" rx="5" fill="' + navy + '"/><rect x="28" y="24" width="44" height="12" fill="#c97a2b"/><rect x="12" y="34" width="76" height="136" rx="14" fill="#c97a2b"/><rect x="12" y="72" width="76" height="66" fill="#fff"/><rect x="36" y="84" width="28" height="28" fill="' + color + '"/>';
      else if (kind === 'pump') inner = '<rect x="50" y="0" width="34" height="9" rx="4" fill="' + navy + '"/><rect x="44" y="6" width="12" height="26" fill="' + navy + '"/><rect x="34" y="30" width="32" height="16" rx="4" fill="' + navy + '"/><rect x="18" y="44" width="64" height="166" rx="18" fill="#f6eadf" stroke="' + navy + '" stroke-width="4"/><rect x="18" y="96" width="64" height="70" fill="' + color + '"/>';
      else inner = '<rect x="38" y="0" width="24" height="15" rx="3" fill="' + navy + '"/><path d="M40 14h20v22c0 10 26 18 26 40v120a14 14 0 0 1-14 14H28a14 14 0 0 1-14-14V76c0-22 26-30 26-40z" fill="' + body + '" stroke="' + navy + '" stroke-width="4"/><rect x="14" y="100" width="72" height="66" fill="' + color + '"/>';
      return '<svg viewBox="-6 -6 112 232" width="' + Math.round(size * 0.48) + '" height="' + size + '" aria-hidden="true">' + inner + '</svg>';
    }
  };
  window.GloufStore = S;
})();
