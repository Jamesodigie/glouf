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
      var made = S.mutate(function (d) {
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
      if (made && !made.seeded) S.seedSample(made.id);
      return S.current() || made;
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
        if (false) {
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

    /* ---------- sample data so a new dashboard isn't empty ---------- */
    SAMPLE: [
      ['Sunny Orange Drink 50cl', 'drink', '#f0a51a', 'Food & beverage', '50 cl', 350, 300],
      ['Zesty Cola Can 33cl', 'can', '#d9434a', 'Food & beverage', '33 cl', 400, 220],
      ['Creamy Milk Sachet', 'pouch', '#1f4fd8', 'Dairy', '400 g', 1800, 410],
      ['Golden Spaghetti 500g', 'box', '#ea580c', 'Food & beverage', '500 g', 1100, 150],
      ['Royal Rice 50kg', 'bag', '#169c55', 'Food & beverage', '50 kg', 78000, 90],
      ['Glow Body Lotion', 'pump', '#db2777', 'Cosmetics & skincare', '400 ml', 6800, 120],
      ['Paracare Tablets', 'pharma', '#7c3aed', 'Pharmaceuticals', '24 tablets', 1500, 200],
      ['Nature Honey Jar', 'jar', '#c9850a', 'Food & beverage', '500 g', 4500, 80],
      ['Fresh Smile Toothpaste', 'tube', '#0ea5a4', 'Cosmetics & skincare', '140 g', 1200, 160],
      ['Ada Leather Tote', 'tote', '#0a2240', 'Fashion', 'One size', 25000, 60]
    ],
    seedSample: function (merchantId) {
      return S.updateMerchant(merchantId, function (m) {
        if (m.seeded) return;
        m.seeded = true; m.sample = true;
        var now = Date.now(), day = 864e5;
        S.SAMPLE.forEach(function (x, i) {
          var p = { id: uid('p_'), short: S.productShort(m, x[0]), name: x[0], kind: x[1], color: x[2], category: x[3], size: x[4], price: String(x[5]), sku: 'GL' + (1001 + i), reg: '', codes: x[6], nextSeq: x[6] + 1, createdAt: new Date(now - (14 - i) * day).toISOString(), sample: true };
          m.products.push(p);
          m.batches.push({ id: uid('b_'), productId: p.id, qty: x[6], start: 1, createdAt: p.createdAt, live: false, sample: true });
        });
        var reasons = ['Same code scanned in two cities on the same day', 'Code scanned more times than expected', 'Label reported as suspicious by a shopper'];
        for (var k = 0; k < 140; k++) {
          var pi = Math.floor(Math.pow(Math.random(), 1.4) * m.products.length), p = m.products[pi];
          var c = CITIES[Math.random() < 0.55 ? Math.floor(Math.random() * 4) : Math.floor(Math.random() * CITIES.length)];
          var flagged = false;
          m.scans.push({ id: uid('s_'), code: 'GLF-' + m.short + '-' + p.short + '-' + pad(1 + Math.floor(Math.random() * p.codes), 6), productId: p.id, city: c[0], lat: c[1], lng: c[2],
            result: flagged ? 'flagged' : 'verified', reason: flagged ? reasons[k % 3] : '', at: new Date(now - Math.floor(Math.random() * 13.5 * day)).toISOString(), sample: true });
        }
        m.scans.sort(function (a, b) { return a.at < b.at ? 1 : -1; });
        m.stores.push({ id: uid('st_'), name: m.business + ' Outlet, Ikeja', address: '12 Allen Avenue', city: 'Ikeja', state: 'Lagos', phone: '', sample: true });
        m.stores.push({ id: uid('st_'), name: m.business + ' Store, Lekki', address: 'Admiralty Way', city: 'Lekki', state: 'Lagos', phone: '', sample: true });
        var h = 0; for (var j = 0; j < m.id.length; j++) h = (h * 31 + m.id.charCodeAt(j)) >>> 0;
        m.wallet = m.wallet || { acct: '90' + String(h).padStart(8, '0').slice(-8), balance: 0, tx: [] };
        [['Payment from customer', 'Scan to pay', 4800, 0], ['Supermarket order #2231', 'Bank transfer', 125000, 1], ['Withdrawal to GTBank', 'Withdrawal', -60000, 2], ['Voucher top-up', 'Voucher', 10000, 3],
         ['Payment from customer', 'Scan to pay', 3200, 3], ['Online order #1042', 'Payment API', 18500, 4], ['Payment from customer', 'Mobile number', 7500, 5], ['Distributor payment', 'Bank transfer', 86000, 6],
         ['Withdrawal to Access Bank', 'Withdrawal', -40000, 8], ['Online order #1038', 'Payment API', 22400, 9]].forEach(function (t) {
          m.wallet.balance += t[2];
          m.wallet.tx.push({ id: uid('t_'), desc: t[0], ch: t[1], amt: t[2], at: new Date(now - t[3] * day - 3600e3 * (1 + t[3] % 5)).toISOString(), sample: true });
        });
        m.wallet.tx.sort(function (a, b) { return a.at < b.at ? 1 : -1; });
        S.notify(m, 'Your dashboard is filled with sample products, codes, scans and payments so you can explore. Remove them any time in Settings.');
      });
    },
    clearSample: function (merchantId) {
      return S.updateMerchant(merchantId, function (m) {
        var keep = function (x) { return !x.sample; };
        var ids = m.products.filter(function (p) { return p.sample; }).map(function (p) { return p.id; });
        m.products = m.products.filter(keep);
        m.batches = m.batches.filter(function (b) { return !b.sample && ids.indexOf(b.productId) < 0; });
        m.scans = m.scans.filter(function (s) { return !s.sample && ids.indexOf(s.productId) < 0; });
        m.stores = m.stores.filter(keep);
        if (m.wallet) { m.wallet.tx = m.wallet.tx.filter(keep); m.wallet.balance = m.wallet.tx.reduce(function (a, t) { return a + t.amt; }, 0); }
        m.sample = false;
      });
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
    KINDS: [['drink', 'Drink bottle'], ['can', 'Can'], ['pharma', 'Medicine'], ['pump', 'Cosmetics'], ['jar', 'Jar'], ['tube', 'Tube'], ['box', 'Box / carton'], ['pouch', 'Pouch / sachet'], ['bag', 'Bag / sack'], ['tote', 'Fashion bag']],
    shade: function (hex, amt) {
      var n = parseInt(String(hex).slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
      function f(c) { return Math.max(0, Math.min(255, Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt))); }
      return '#' + ((1 << 24) + (f(r) << 16) + (f(g) << 8) + f(b)).toString(16).slice(1);
    },
    art: function (kind, color, size) {
      size = size || 64; color = color || '#1f4fd8';
      var N = '#0a2240', W = '#fff', dk = S.shade(color, -0.3), lt = S.shade(color, 0.35), o = ' stroke="' + N + '" stroke-width="4" stroke-linejoin="round"';
      var lbl = function (x, y, w, h) { return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="3" fill="#fff" opacity=".92"/><rect x="' + (x + w / 2 - 9) + '" y="' + (y + h / 2 - 9) + '" width="18" height="18" fill="' + N + '"/><rect x="' + (x + w / 2 - 5) + '" y="' + (y + h / 2 - 5) + '" width="10" height="10" fill="#fff"/><rect class="pscan" x="' + (x + 2) + '" y="' + y + '" width="' + (w - 4) + '" height="3" rx="1.5" fill="#22c58b" style="--d:' + (h - 3) + 'px"/>'; };
      var g = {
        drink: '<rect x="38" y="0" width="24" height="15" rx="3" fill="' + N + '"/><path d="M40 14h20v22c0 10 26 18 26 40v120a14 14 0 0 1-14 14H28a14 14 0 0 1-14-14V76c0-22 26-30 26-40z" fill="' + W + '"' + o + '/><rect x="16" y="100" width="68" height="66" fill="' + color + '"/>' + lbl(34, 116, 32, 34),
        can: '<rect x="22" y="40" width="56" height="170" rx="12" fill="' + color + '"' + o + '/><rect x="26" y="32" width="48" height="12" rx="5" fill="#c9d2e0"' + o + '/><rect x="22" y="58" width="56" height="8" fill="' + dk + '"/><rect x="22" y="184" width="56" height="8" fill="' + dk + '"/>' + lbl(30, 96, 40, 52),
        pharma: '<rect x="20" y="40" width="60" height="26" rx="5" fill="' + N + '"/><rect x="28" y="64" width="44" height="12" fill="#c97a2b"/><rect x="12" y="74" width="76" height="136" rx="14" fill="#c97a2b"' + o + '/><rect x="12" y="110" width="76" height="66" fill="#fff"/><rect x="12" y="110" width="76" height="12" fill="' + color + '"/>' + lbl(32, 128, 36, 40),
        pump: '<rect x="50" y="0" width="34" height="9" rx="4" fill="' + N + '"/><rect x="44" y="6" width="12" height="26" fill="' + N + '"/><rect x="34" y="30" width="32" height="16" rx="4" fill="' + N + '"/><rect x="18" y="44" width="64" height="166" rx="18" fill="' + lt + '"' + o + '/><rect x="18" y="96" width="64" height="70" fill="' + color + '"/>' + lbl(34, 112, 32, 38),
        jar: '<rect x="20" y="70" width="60" height="24" rx="6" fill="' + color + '"' + o + '/><rect x="14" y="92" width="72" height="118" rx="20" fill="#fff"' + o + '/><rect x="14" y="120" width="72" height="60" fill="' + lt + '"/>' + lbl(34, 128, 32, 44),
        tube: '<rect x="20" y="30" width="60" height="12" rx="3" fill="#c9d2e0"' + o + '/><path d="M22 40h56l-10 142H32z" fill="' + color + '"' + o + '/><rect x="38" y="180" width="24" height="30" rx="5" fill="' + N + '"/>' + lbl(34, 86, 32, 46),
        box: '<path d="M14 72l16-14h66l-16 14z" fill="' + lt + '"' + o + '/><path d="M80 72l16-14v138l-16 14z" fill="' + dk + '"' + o + '/><rect x="14" y="72" width="66" height="138" fill="' + color + '"' + o + '/>' + lbl(25, 110, 44, 54),
        pouch: '<path d="M20 40h60l8 160a10 10 0 0 1-10 10H22a10 10 0 0 1-10-10z" fill="' + color + '"' + o + '/><path d="M22 56h56" stroke="' + dk + '" stroke-width="4" stroke-dasharray="6 4"/><ellipse cx="50" cy="168" rx="20" ry="14" fill="#fff" opacity=".35"/>' + lbl(31, 88, 38, 48),
        bag: '<rect x="38" y="36" width="24" height="18" rx="4" fill="' + N + '"/><path d="M30 54h40c18 14 22 40 22 70v70a16 16 0 0 1-16 16H24a16 16 0 0 1-16-16v-70c0-30 4-56 22-70z" fill="' + color + '"' + o + '/><path d="M18 98h64" stroke="' + dk + '" stroke-width="4"/>' + lbl(28, 116, 44, 54),
        tote: '<path d="M30 96c0-46 40-46 40 0" fill="none" stroke="' + N + '" stroke-width="7" stroke-linecap="round"/><path d="M10 96h80l-8 114H18z" fill="' + color + '"' + o + '/><rect x="10" y="96" width="80" height="14" fill="' + dk + '"/>' + lbl(32, 128, 36, 46)
      };
      return '<svg viewBox="-6 -6 112 232" width="' + Math.round(size * 0.48) + '" height="' + size + '" aria-hidden="true">' + (g[kind] || g.drink) + '</svg>';
    }
  };
  S.bottle = S.art;
  S.theme = function (t) {
    if (t) { try { localStorage.setItem('glouf_theme', t); } catch (e) {} }
    else { try { t = localStorage.getItem('glouf_theme'); } catch (e) {} }
    document.documentElement.setAttribute('data-theme', t === 'dark' ? 'dark' : 'light');
    return t === 'dark' ? 'dark' : 'light';
  };
  S.theme();
  window.GloufStore = S;
})();
