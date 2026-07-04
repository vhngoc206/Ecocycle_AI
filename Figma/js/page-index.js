/* EcoCycle.AI — Trang Sàn Giao Dịch (index.html) */

document.addEventListener('DOMContentLoaded', init);

async function init() {
  mountChrome('shop');
  mountFooter();
  await Storage.initCatalog();
  await Storage.initLedger();
  setupFilterListeners();
  setupSearchListener();
  renderGrid();
  window.addEventListener('storage', renderGrid);
  window.addEventListener('focus', renderGrid);
}

// Setup filter event listeners
function setupFilterListeners() {
  const filterCheckboxes = document.querySelectorAll('.filter input[type="checkbox"]');
  filterCheckboxes.forEach(checkbox => {
    checkbox.addEventListener('change', () => {
      renderGrid();
    });
  });
}

// Setup search listener
function setupSearchListener() {
  const searchInput = document.querySelector('.search input');
  const searchBtn = document.querySelector('.search svg').parentElement;
  
  if (searchInput) {
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        renderGrid();
      }
    });
  }
  
  if (searchBtn) {
    searchBtn.addEventListener('click', () => {
      renderGrid();
    });
  }
}

// Get filter criteria from checkboxes
function getFilterCriteria() {
  const criteria = {
    categories: [],
    conditions: [],
    priceRanges: [],
  };

  const categoryCheckboxes = document.querySelectorAll('.filter input[data-category]');
  categoryCheckboxes.forEach(cb => {
    if (cb.checked && cb.dataset.category !== '') {
      criteria.categories.push(cb.dataset.category);
    }
  });

  const conditionCheckboxes = document.querySelectorAll('.filter input[type="checkbox"]');
  conditionCheckboxes.forEach(cb => {
    const label = cb.parentElement.textContent.trim();
    if (cb.checked && label.includes('Like New')) criteria.conditions.push([90, 99]);
    if (cb.checked && label.includes('Rất tốt')) criteria.conditions.push([80, 89]);
    if (cb.checked && label.includes('Tốt')) criteria.conditions.push([70, 79]);
  });

  const priceCheckboxes = document.querySelectorAll('.filter input[type="checkbox"]');
  priceCheckboxes.forEach(cb => {
    const label = cb.parentElement.textContent.trim();
    if (cb.checked && label.includes('Dưới 200')) criteria.priceRanges.push([0, 200000]);
    if (cb.checked && label.includes('200.000 - 500')) criteria.priceRanges.push([200000, 500000]);
    if (cb.checked && label.includes('500.000 - 1')) criteria.priceRanges.push([500000, 1000000]);
    if (cb.checked && label.includes('Trên 1.000')) criteria.priceRanges.push([1000000, Infinity]);
  });

  return criteria;
}

// Get search keyword
function getSearchKeyword() {
  const searchInput = document.querySelector('.search input');
  return searchInput ? searchInput.value.trim().toLowerCase() : '';
}

// Apply filters and search
function filterProducts(products) {
  const criteria = getFilterCriteria();
  const keyword = getSearchKeyword();

  return products.filter(p => {
    // Category filter
    if (criteria.categories.length > 0) {
      const matches = criteria.categories.some(cat => p.category === cat);
      if (!matches) return false;
    }

    // Condition filter
    if (criteria.conditions.length > 0) {
      const matches = criteria.conditions.some(([min, max]) => p.cond >= min && p.cond <= max);
      if (!matches) return false;
    }

    // Price filter
    if (criteria.priceRanges.length > 0) {
      const matches = criteria.priceRanges.some(([min, max]) => p.price >= min && p.price <= max);
      if (!matches) return false;
    }

    // Search keyword filter
    if (keyword) {
      const searchableText = `${p.name} ${p.brand} ${p.category}`.toLowerCase();
      if (!searchableText.includes(keyword)) return false;
    }

    return true;
  });
}

function renderGrid() {
  const grid = document.getElementById('productGrid');
  if (!grid) return;

  // Sản phẩm đã bán (status 'Đã bán') không hiển thị lên trang chủ nữa.
  const userListings = Storage.getListings()
    .filter(l => l.status !== 'Đã bán')
    .map(l => ({
      id: l.id,
      name: l.name,
      brand: l.ai?.brand || l.segment || 'EcoSeller',
      size: l.size || '-',
      price: l.price,
      oldPrice: l.origPrice || Math.round(l.price * 2.5),
      cond: l.ai?.condition || 90,
      category: l.category || '—',
      img: l.img || 'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?w=600',
      _user: true,
      _status: l.status,
    }));

  // Sản phẩm catalog gốc đã được bán qua giao dịch cũng bị ẩn tương tự.
  const soldCatalogIds = Storage.getSoldCatalogIds();
  const catalog = Storage.getCatalog().filter(p => !soldCatalogIds.includes(p.id));

  const all = [...userListings, ...catalog];
  const filtered = filterProducts(all);

  if (filtered.length === 0) {
    grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--muted);">
      Không tìm thấy sản phẩm nào phù hợp với tiêu chí của bạn.
    </div>`;
    return;
  }

  grid.innerHTML = filtered.map(p => `
    <a class="card" href="product-detail.html?id=${p.id}">
      <div class="thumb">
        <img src="${p.img}" alt="${p.name}" loading="lazy"/>
        <div class="badge-ai">AI Verified · ${p.cond}% Mới</div>
        ${p._user ? `<div class="badge-ai" style="top:auto;bottom:10px;left:10px;background:var(--brand);color:#fff">Đăng bởi bạn</div>` : ''}
      </div>
      <div class="body">
        <div class="brand">${p.brand} · Size ${p.size}</div>
        <div class="name">${p.name}</div>
        <div class="price-row">
          <span class="price">${formatVnd(p.price)}</span>
          <span class="price-old">${formatVnd(p.oldPrice)}</span>
        </div>
      </div>
    </a>
  `).join('');
}