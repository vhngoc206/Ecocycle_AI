/* EcoCycle.AI - Mock AI Engine
 * Pricing engine for second-hand fashion: image/context scoring, catalog reference,
 * sold-history reference, and transparent review signals for moderation.
 */
const AIEngine = (() => {
  const BRANDS_BY_CATEGORY = {
    'Áo': ['Nike', 'Uniqlo', 'Zara', 'H&M', "Levi's"],
    'Quần': ["Levi's", 'Uniqlo', 'Zara', 'Adidas'],
    'Váy': ['Zara', 'H&M', 'Uniqlo'],
    'Giày': ['Nike', 'Adidas', 'Coach'],
    'Túi xách': ['Coach', 'Zara'],
  };
  const ALL_BRANDS = ['Nike', 'Uniqlo', 'Zara', 'Adidas', "Levi's", 'H&M', 'Coach'];
  const CATEGORY_AVG = { 'Áo': 150000, 'Quần': 220000, 'Váy': 260000, 'Giày': 450000, 'Túi xách': 650000 };

  const DEFECTS_LOW = ['Không phát hiện lỗi đáng kể', 'Bề mặt vải/da đồng đều, không lỗi rõ rệt'];
  const DEFECTS_MED = ['Vết bẩn nhẹ ở tay áo', 'Sờn nhẹ ở cổ viền', 'Bạc màu nhẹ vùng vai', 'Xù nhẹ bề mặt vải'];
  const DEFECTS_HIGH = ['Vết ố loang khó xử lý', 'Rách nhẹ ở đường chỉ', 'Trầy xước rõ trên bề mặt da'];

  const analysisCache = {};

  function hashString(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
    return h;
  }
  function pick(arr, seed) { return arr[seed % arr.length]; }
  function roundVnd(n) { return Math.round((n || 0) / 1000) * 1000; }
  function normalizeText(value) { return String(value || '').trim().toLowerCase(); }

  function catalogReference({ catalog = [], category = '', brand = '' }) {
    const sameBrandCategory = catalog.filter(p => p.category === category && p.brand === brand);
    const sameCategory = catalog.filter(p => p.category === category);
    const source = sameBrandCategory.length >= 2 ? sameBrandCategory : sameCategory;
    const prices = source.map(p => Number(p.oldPrice || p.origPrice || p.price || 0)).filter(Boolean);
    const fallback = CATEGORY_AVG[category] || 250000;
    if (!prices.length) return { avg: fallback, count: 0, source: 'fallback' };
    const avg = prices.reduce((s, v) => s + v, 0) / prices.length;
    return { avg: Math.round(avg), count: prices.length, source: sameBrandCategory.length >= 2 ? 'brand-category' : 'category' };
  }

  function soldMarketReference({ catalog = [], listings = [], transactions = [], category = '', brand = '', condition = 90 }) {
    const productIndex = new Map([...catalog, ...listings].map(p => [p.id, p]));
    const sold = [];
    transactions.forEach(t => {
      const items = Array.isArray(t.items) && t.items.length ? t.items : [{ id: t.productId, name: t.productName, price: t.amount, qty: 1 }];
      items.forEach(item => {
        const src = productIndex.get(item.id) || item;
        const itemBrand = item.brand || src.brand || src.ai?.brand || '';
        const itemCategory = src.category || item.category || '';
        const itemCond = Number(src.cond || src.ai?.condition || condition || 90);
        if (itemCategory === category && (!brand || itemBrand === brand) && Math.abs(itemCond - condition) <= 15) {
          const price = Number(item.price || src.price || 0) * Number(item.qty || 1);
          if (price > 0) sold.push(price);
        }
      });
    });
    if (!sold.length) return null;
    sold.sort((a, b) => a - b);
    const avg = sold.reduce((s, v) => s + v, 0) / sold.length;
    return {
      avg: Math.round(avg),
      low: roundVnd(avg * 0.85),
      high: roundVnd(avg * 1.15),
      count: sold.length,
    };
  }

  function reviewPrice({ aiPrice = 0, finalPrice = 0, origPrice = 0, category = '', brand = '', condition = 90, catalog = [], listings = [], transactions = [] }) {
    const suggestedPrice = Number(aiPrice || 0);
    const price = Number(finalPrice || 0);
    /*const minAllowed = roundVnd(suggestedPrice * 0.8);
    const maxAllowed = roundVnd(suggestedPrice * 1.2);*/
    const minAllowed = roundVnd(suggestedPrice * 0.9);
    const maxAllowed = roundVnd(suggestedPrice * 1.1);
    const diffPct = suggestedPrice ? Math.round(((price - suggestedPrice) / suggestedPrice) * 100) : 0;
    const catalogRef = catalogReference({ catalog, category, brand });
    const marketRef = soldMarketReference({ catalog, listings, transactions, category, brand, condition });
    const flags = [];

    if (price < minAllowed || price > maxAllowed) flags.push('PRICE_OUT_OF_AI_RANGE');
    if (origPrice && catalogRef.avg && origPrice > catalogRef.avg * 3) flags.push('ORIG_PRICE_OUTLIER');
    if (marketRef && (price < marketRef.low || price > marketRef.high)) flags.push('MARKET_OUTLIER');

    return {
      minAllowed,
      maxAllowed,
      diffPct,
      catalogRef,
      marketRef,
      flags,
      needsReview: flags.length > 0 || Math.abs(diffPct) >= 30,
    };
  }

  function analyze(input = {}) {
    const { imageDataUrl = '', category = '', description = '', origPrice = 0, segment = 'Bình dân', catalog = [] } = input;
    return new Promise((resolve) => {
      setTimeout(() => {
        const seedSrc = (imageDataUrl.slice(-2000) || 'no-image') + '|' + category + '|' + description + '|' + origPrice + '|' + segment;
        if (analysisCache[seedSrc]) { resolve(analysisCache[seedSrc]); return; }

        const seed = hashString(seedSrc);
        const brandPool = BRANDS_BY_CATEGORY[category] || ALL_BRANDS;
        const brand = pick(brandPool, seed);
        const brandAccuracy = 85 + (seed % 10);
        const descLower = normalizeText(description);

        let condition = 80 + (seed % 12);
        if (!descLower) condition -= 15;
        if (['rách', 'lỗi', 'hỏng', 'ố', 'ố vàng', 'vết dơ', 'loang màu', 'bạc màu nhiều', 'sờn nặng'].some(k => descLower.includes(k))) condition -= 20;
        if (['mới', 'chưa mặc', 'like new', 'gần như mới', 'nguyên tag'].some(k => descLower.includes(k))) condition += 5;
        condition = Math.max(40, Math.min(95, condition));

        const defect = condition >= 90 ? pick(DEFECTS_LOW, seed) : condition >= 70 ? pick(DEFECTS_MED, seed >> 2) : pick(DEFECTS_HIGH, seed >> 3);
        /*const segmentMultiplier = segment === 'Xa xỉ' ? 1.6 : segment === 'Cao cấp' ? 1.2 : 1;
        const conditionFactor = 0.15 + (condition / 100) * 0.25;
        const catalogRef = catalogReference({ catalog, category, brand });
        const categoryBase = catalogRef.avg || CATEGORY_AVG[category] || 250000;
        const priceFromOrig = origPrice > 0 ? origPrice * conditionFactor * segmentMultiplier : 0;
        const basePriceBand = (categoryBase + (seed % 240) * 900) * segmentMultiplier;
        let suggestedPrice = priceFromOrig > 0
          ? roundVnd(priceFromOrig * 0.55 + basePriceBand * 0.45)
          : roundVnd(basePriceBand);

        if (origPrice > 0) suggestedPrice = Math.min(suggestedPrice, roundVnd(origPrice * 0.7));
        suggestedPrice = Math.max(30000, suggestedPrice);*/
        const segmentMultiplier =
  segment === 'Xa xỉ'
    ? 1.35
    : segment === 'Cao cấp'
      ? 1.15
      : 1;

const catalogRef = catalogReference({ catalog, category, brand });
const categoryBase = catalogRef.avg || CATEGORY_AVG[category] || 250000;

// ==========================
// Khấu hao đồ second-hand
// ==========================
let conditionFactor;

if (condition >= 98) conditionFactor = 0.85;
else if (condition >= 95) conditionFactor = 0.80;
else if (condition >= 90) conditionFactor = 0.70;
else if (condition >= 85) conditionFactor = 0.60;
else if (condition >= 80) conditionFactor = 0.55;
else if (condition >= 70) conditionFactor = 0.45;
else conditionFactor = 0.35;

let suggestedPrice;

// Có giá gốc -> lấy giá gốc làm chuẩn
if (origPrice > 0) {

  suggestedPrice =
    origPrice *
    conditionFactor *
    segmentMultiplier;

  // Không vượt 70% giá gốc
  suggestedPrice = Math.min(
    suggestedPrice,
    origPrice * 0.85
  );

} else {

  // Chưa nhập giá gốc thì chỉ ước lượng nhẹ
  suggestedPrice =
    categoryBase * 0.45;

}

// Không vượt quá khoảng 65% giá catalog
const marketCap = categoryBase * 0.85;

suggestedPrice = Math.min(
  suggestedPrice,
  marketCap
);

suggestedPrice = Math.max(
  suggestedPrice,
  30000
);

suggestedPrice = roundVnd(suggestedPrice);

        const result = {
          brand,
          condition,
          brandAccuracy,
          defect,
          sanitized: 'Đã khử khuẩn (Ozone + UV)',
          suggestedPrice,
          /*minPrice: roundVnd(suggestedPrice * 0.8),
          maxPrice: roundVnd(suggestedPrice * 1.2),*/
          minPrice: roundVnd(suggestedPrice * 0.9),
          maxPrice: roundVnd(suggestedPrice * 1.1),
          catalogRef,
          scannedAt: new Date().toISOString(),
        };
        analysisCache[seedSrc] = result;
        resolve(result);
      }, 900);
    });
  }

  function priceTrend(base = 520000) {
    const days = 14;
    const labels = [];
    const data = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      labels.push(d.getDate() + '/' + (d.getMonth() + 1));
      const jitter = (Math.random() - 0.5) * 0.18;
      data.push(Math.round(base * (1 + jitter)));
    }
    return { labels, data };
  }

  return { analyze, priceTrend, reviewPrice, catalogReference, soldMarketReference };
})();
