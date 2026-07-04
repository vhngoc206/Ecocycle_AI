/* EcoCycle.AI — Storage Manager
 * - Loads seed catalog + seed ledger from /data/products_init.json and /data/transaction_init.json
 * - Wraps localStorage for cross-page state: auth, cart, listings (products đăng bán), transactions
 * - Provides helpers to export the *current* merged data back out as the two JSON files,
 *   because a static front-end (no backend/database) cannot write to disk by itself —
 *   the browser can only ever persist to localStorage. "Xuất JSON" lets you download an
 *   updated snapshot and replace the file in /data if you want the seed to include new items.
 */
const Storage = (() => {
  const K = {
    USER: 'ecocycle_user',
    LISTINGS: 'ecocycle_listings',
    TX: 'ecocycle_transactions',
    CART: 'ecocycle_cart',
  };

  // Phí vận chuyển đồng giá áp dụng cho mọi đơn hàng (demo).
  const SHIPPING_FEE = 30000;

  // Danh mục voucher đổi bằng điểm tích lũy.
  // - type 'ship'    : giảm % phí vận chuyển (freeship = percent 100)
  // - type 'product' : giảm % tiền hàng, có `maxDiscount` (mức giảm tối đa quy ra tiền)
  //   để đảm bảo sàn không bị lỗ vốn với đơn hàng giá trị lớn, và `minOrder`
  //   (giá trị đơn tối thiểu) để voucher không áp dụng cho đơn quá nhỏ.
  // - `cost` (điểm) được định giá tương ứng với giá trị khuyến mãi để chi phí voucher
  //   luôn được bù lại bằng điểm mà người dùng đã tích lũy từ các giao dịch trước đó.
  const VOUCHER_CATALOG = [
    { id: 'SHIP50',   name: 'Giảm 50% phí vận chuyển',    type: 'ship',    percent: 50,  cost: 200,  minOrder: 0,      maxDiscount: null,   icon: '🚚' },
    { id: 'FREESHIP', name: 'Miễn phí vận chuyển',         type: 'ship',    percent: 100, cost: 500,  minOrder: 0,      maxDiscount: null,   icon: '🚚' },
    { id: 'SALE20',   name: 'Giảm 20% giá trị sản phẩm',   type: 'product', percent: 20,  cost: 700,  minOrder: 200000, maxDiscount: 200000, icon: '🎟️' },
    { id: 'SALE50',   name: 'Giảm 50% giá trị sản phẩm',   type: 'product', percent: 50,  cost: 1000, minOrder: 500000, maxDiscount: 350000, icon: '🎟️' },
  ];

  // Fallback data used only if the JSON files can't be fetched
  // (e.g. the site was opened directly as a file:// page instead of via a local server).
  const FALLBACK_PRODUCTS = [
    { id: 'p1', name: 'Áo Hoodie Tech Fleece', brand: 'Nike', category: 'Áo', size: 'M', color: 'Xám', price: 520000, oldPrice: 1450000, cond: 90, segment: 'Bình dân', img: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=600' },
    { id: 'p2', name: "Quần Jean Slim Fit", brand: "Levi's", category: 'Quần', size: '32', color: 'Xanh', price: 390000, oldPrice: 1200000, cond: 88, segment: 'Bình dân', img: 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=600' },
    { id: 'p3', name: 'Áo Sơ Mi Oxford', brand: 'Uniqlo', category: 'Áo', size: 'L', color: 'Trắng', price: 180000, oldPrice: 590000, cond: 92, segment: 'Bình dân', img: 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=600' },
    { id: 'p4', name: 'Giày Sneakers Court', brand: 'Adidas', category: 'Giày', size: '42', color: 'Trắng', price: 680000, oldPrice: 1890000, cond: 85, segment: 'Bình dân', img: 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=600' },
  ];
  const FALLBACK_TX = [
    { id: 'HD-2026001', productName: 'Áo Hoodie Tech Fleece', buyer: 'Minh Anh', seller: '@ecoseller_87', amount: 520000, ecoImpact: 18, paymentMethod: 'COD', status: 'Đã hoàn thành', createdAt: '2026-06-02T08:12:00.000Z' },
  ];

  function get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch { return fallback; }
  }
  function set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      console.error('[Storage] set failed:', key, err);
      throw err;
    }
  }

  // ---------- Seed data (fetched once, cached in memory) ----------
  let _catalogCache = null;
  let _ledgerCache = null;
  let _sellersCache = null;

  async function initCatalog() {
    if (_catalogCache) return _catalogCache;
    try {
      const res = await fetch('datasets/products_init.json', { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();
      _catalogCache = Array.isArray(json.products) ? json.products : FALLBACK_PRODUCTS;
    } catch (err) {
      console.warn('[Storage] Không tải được datasets/products_init.json, dùng dữ liệu dự phòng.', err);
      _catalogCache = FALLBACK_PRODUCTS;
    }
    return _catalogCache;
  }

  async function initLedger() {
    if (_ledgerCache) return _ledgerCache;
    try {
      const res = await fetch('datasets/transaction_init.json', { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();
      _ledgerCache = Array.isArray(json.transactions) ? json.transactions : FALLBACK_TX;
    } catch (err) {
      console.warn('[Storage] Không tải được datasets/transaction_init.json, dùng dữ liệu dự phòng.', err);
      _ledgerCache = FALLBACK_TX;
    }
    return _ledgerCache;
  }

  async function initSellers() {
    if (_sellersCache) return _sellersCache;
    try {
      const res = await fetch('datasets/sellers.json', { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();
      _sellersCache = Array.isArray(json.sellers) ? json.sellers : [];
    } catch (err) {
      console.warn('[Storage] Không tải được datasets/sellers.json.', err);
      _sellersCache = [];
    }
    return _sellersCache;
  }

  function getCatalogSync() { return _catalogCache || FALLBACK_PRODUCTS; }
  function getLedgerSync() { return _ledgerCache || FALLBACK_TX; }
  function getSellersSync() { return _sellersCache || []; }

  // ---------- Export helpers (download merged data as the seed JSON files) ----------
  function downloadJson(filename, obj) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function exportProductsJson() {
    const listings = get(K.LISTINGS, []).map(l => ({
      id: l.id,
      name: l.name,
      brand: l.ai?.brand || l.segment || 'EcoSeller',
      category: l.category || '—',
      size: l.size || '-',
      color: l.color || '—',
      price: l.price,
      oldPrice: l.origPrice || Math.round(l.price * 2.5),
      cond: l.ai?.condition || 90,
      segment: l.segment || 'Bình dân',
      img: l.img || '',
      description: l.description || '',
      status: l.status,
      sellerEmail: l.sellerEmail || '',
      createdAt: l.createdAt,
    }));
    downloadJson('products_init.json', {
      updatedAt: new Date().toISOString(),
      products: [...listings, ...getCatalogSync()],
    });
  }

  function exportTransactionsJson() {
    downloadJson('transaction_init.json', {
      updatedAt: new Date().toISOString(),
      transactions: [...get(K.TX, []), ...getLedgerSync()],
    });
  }

  // Xuất TOÀN BỘ dữ liệu cập nhật trên sàn (sản phẩm, người dùng, hóa đơn giao dịch,
  // điểm tích lũy, voucher) thành MỘT file JSON duy nhất — dùng để lưu về máy / nạp
  // vào datasets khi cần "chốt" một bản snapshot đầy đủ của hệ thống.
  function exportAllDataJson() {
    const listings = get(K.LISTINGS, []);
    const liveTx = get(K.TX, []);
    downloadJson(`ecocycle-full-export-${Date.now()}.json`, {
      exportedAt: new Date().toISOString(),
      products: {
        catalogSeed: getCatalogSync(),
        userListings: listings,
        soldCatalogIds: get('ecocycle_sold_catalog_ids', []),
      },
      users: get('ecocycle_users', [
        { name: 'Admin', email: 'admin@ecocycle.ai', password: 'admin123456', isGoogleUser: false }
      ]),
      userPoints: get('ecocycle_user_points', {}),
      userVouchers: get('ecocycle_user_vouchers', {}),
      transactions: {
        seed: getLedgerSync(),
        live: liveTx,
      },
      sellers: _sellersCache || [],
    });
  }

  // ---------- Public API ----------
  return {
    // Seed data loading
    initCatalog,
    initLedger,
    initSellers,
    getCatalog: getCatalogSync,
    getLedger: getLedgerSync,
    getSellers: getSellersSync,
    getSellerByEmail: (email) => {
      const sellers = getSellersSync();
      return sellers.find(s => s.email === email) || { name: 'Người bán ẩn danh', email, avatar: 'https://via.placeholder.com/150' };
    },

    // Auth
    getUser: () => get(K.USER),
    setUser: (u) => set(K.USER, u),
    logout: () => localStorage.removeItem(K.USER),

    // Listings (sản phẩm người dùng đăng bán)
    getListings: () => get(K.LISTINGS, []),
    addListing: (item) => {
      const arr = get(K.LISTINGS, []);
      const rec = { id: 'SP-' + Date.now(), createdAt: Date.now(), ...item };
      arr.unshift(rec);
      set(K.LISTINGS, arr);
      return rec;
    },
    updateListing: (id, patch) => {
      const arr = get(K.LISTINGS, []);
      const idx = arr.findIndex(l => l.id === id);
      if (idx === -1) return null;
      arr[idx] = { ...arr[idx], ...patch };
      set(K.LISTINGS, arr);
      return arr[idx];
    },

    // Transactions / Hóa đơn
    deleteListing: (id, sellerEmail) => {
      const arr = get(K.LISTINGS, []);
      const idx = arr.findIndex(l => l.id === id);
      if (idx === -1) return { ok: false, reason: 'not-found' };
      if (sellerEmail && arr[idx].sellerEmail !== sellerEmail) {
        return { ok: false, reason: 'forbidden' };
      }
      const [removed] = arr.splice(idx, 1);
      set(K.LISTINGS, arr);
      return { ok: true, listing: removed };
    },

    getTx: () => get(K.TX, []),
    addTx: (t) => {
      const arr = get(K.TX, []);
      const rec = {
        id: 'HD-' + (2026000 + arr.length + getLedgerSync().length + 1),
        createdAt: new Date().toISOString(),
        ...t,
      };
      arr.unshift(rec);
      set(K.TX, arr);
      return rec;
    },

    // Cart / Giỏ hàng
    getCart: () => get(K.CART, []),
    setCart: (items) => set(K.CART, items),
    addToCart: (product, qty = 1) => {
      const cart = get(K.CART, []);
      const existing = cart.find(c => c.id === product.id);
      if (existing) {
        existing.qty += qty;
      } else {
        cart.push({
          id: product.id,
          name: product.name,
          brand: product.brand,
          price: product.price,
          img: product.img,
          qty,
        });
      }
      set(K.CART, cart);
      return cart;
    },
    removeFromCart: (id) => {
      const cart = get(K.CART, []).filter(c => c.id !== id);
      set(K.CART, cart);
      return cart;
    },
    updateCartQty: (id, qty) => {
      const cart = get(K.CART, []);
      const item = cart.find(c => c.id === id);
      if (item) item.qty = Math.max(1, qty);
      set(K.CART, cart);
      return cart;
    },
    clearCart: () => set(K.CART, []),
    cartCount: () => get(K.CART, []).reduce((s, c) => s + c.qty, 0),
    cartTotal: () => get(K.CART, []).reduce((s, c) => s + c.qty * c.price, 0),

    // Export to JSON files
    exportProductsJson,
    exportTransactionsJson,
    exportAllDataJson,

    // ---------- Vận chuyển & Voucher ----------
    getShippingFee: () => SHIPPING_FEE,
    buyerPurchasePoints: (amount) => {
      const v = Number(amount) || 0;
      if (v > 1000000) return 200;
      if (v >= 500000) return 100;
      if (v >= 200000) return 50;
      return 0;
    },
    platformFee: (amount) => Math.round((Number(amount) || 0) * 0.10),
    getVoucherCatalog: () => VOUCHER_CATALOG,
    getUserVouchers: (email) => {
      const all = get('ecocycle_user_vouchers', {});
      return all[email] || [];
    },
    // Đổi điểm tích lũy lấy voucher. Trả về { ok, msg?, voucher?, remainingPoints? }
    redeemVoucher: (email, voucherId) => {
      const def = VOUCHER_CATALOG.find(v => v.id === voucherId);
      if (!def) return { ok: false, msg: 'Voucher không tồn tại.' };
      const pointsMap = get('ecocycle_user_points', {});
      const balance = pointsMap[email] || 0;
      if (balance < def.cost) return { ok: false, msg: 'Điểm tích lũy không đủ để đổi voucher này.' };

      pointsMap[email] = balance - def.cost;
      set('ecocycle_user_points', pointsMap);

      const all = get('ecocycle_user_vouchers', {});
      if (!all[email]) all[email] = [];
      const rec = {
        code: 'VC-' + Date.now().toString(36).toUpperCase(),
        voucherId: def.id,
        name: def.name,
        type: def.type,
        percent: def.percent,
        maxDiscount: def.maxDiscount || null,
        minOrder: def.minOrder || 0,
        cost: def.cost,
        used: false,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      };
      all[email].push(rec);
      set('ecocycle_user_vouchers', all);
      return { ok: true, voucher: rec, remainingPoints: pointsMap[email] };
    },
    markVoucherUsed: (email, code) => {
      const all = get('ecocycle_user_vouchers', {});
      const list = all[email] || [];
      const v = list.find(x => x.code === code);
      if (v) {
        v.used = true;
        v.usedAt = new Date().toISOString();
        set('ecocycle_user_vouchers', all);
      }
      return v || null;
    },

    // ---------- Ẩn sản phẩm đã bán khỏi trang chủ ----------
    getSoldCatalogIds: () => get('ecocycle_sold_catalog_ids', []),
    markCatalogSold: (id) => {
      const arr = get('ecocycle_sold_catalog_ids', []);
      if (!arr.includes(id)) {
        arr.push(id);
        set('ecocycle_sold_catalog_ids', arr);
      }
    },

    // ---------- Suy ra tên người bán từ email (dùng cho Dashboard) ----------
    resolveSellerName: (email) => {
      if (!email) return 'EcoCycle Official Store';
      const users = get('ecocycle_users', [
        { name: 'Admin', email: 'admin@ecocycle.ai', password: 'admin123456', isGoogleUser: false }
      ]);
      const u = users.find(x => x.email === email);
      if (u && u.name) return u.name;
      const sellers = _sellersCache || [];
      const s = sellers.find(x => x.email === email);
      if (s && s.name) return s.name;
      return email;
    },

    // User management
    getAllUsers: () => get('ecocycle_users', [
      { name: 'Admin', email: 'admin@ecocycle.ai', password: 'admin123456', isGoogleUser: false }
    ]),
    addUser: (userData) => {
      const users = get('ecocycle_users', [{ name: 'Admin', email: 'admin@ecocycle.ai', password: 'admin123456', isGoogleUser: false }]);
      const newUser = {
        ...userData,
        createdAt: new Date().toISOString(),
      };
      users.push(newUser);
      set('ecocycle_users', users);
      return newUser;
    },
    updateUser: (email, updates) => {
      const users = get('ecocycle_users', []);
      const idx = users.findIndex(u => u.email === email);
      if (idx !== -1) {
        users[idx] = { ...users[idx], ...updates };
        set('ecocycle_users', users);
      }
      return users[idx];
    },
    setResetToken: (email, token) => {
      set(`reset_token_${email}`, { token, createdAt: Date.now() });
    },
    verifyResetToken: (email, token) => {
      const data = get(`reset_token_${email}`);
      if (!data || data.token !== token) return false;
      if (Date.now() - data.createdAt > 3600000) return false; // 1 hour expiry
      return true;
    },

    // User Points System
    getUserPoints: (email) => {
      const points = get('ecocycle_user_points', {});
      return points[email] || 0;
    },
    addUserPoints: (email, amount) => {
      const points = get('ecocycle_user_points', {});
      points[email] = (points[email] || 0) + amount;
      set('ecocycle_user_points', points);
      return points[email];
    },
    setUserPoints: (email, amount) => {
      const points = get('ecocycle_user_points', {});
      points[email] = amount;
      set('ecocycle_user_points', points);
      return points[email];
    },
  };
})();

// Currency formatter — VND
function formatVnd(n) {
  return new Intl.NumberFormat('vi-VN').format(Math.round(n || 0)) + 'đ';
}