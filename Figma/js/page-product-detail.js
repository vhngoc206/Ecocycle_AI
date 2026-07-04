/* EcoCycle.AI — Trang Chi Tiết Sản Phẩm (product-detail.html) */

let currentProduct = null;

document.addEventListener('DOMContentLoaded', init);

async function init() {
  mountChrome('shop');
  mountFooter();
  await Storage.initCatalog();
  await Storage.initLedger();
  await Storage.initSellers();

  const params = new URLSearchParams(location.search);
  const id = params.get('id') || 'p1';

  let p = Storage.getCatalog().find(x => x.id === id);
  let seller = null;
  if (!p) {
    const listing = Storage.getListings().find(l => l.id === id);
    if (listing) {
      p = {
        id: listing.id,
        name: listing.name,
        brand: listing.ai?.brand || listing.segment || 'EcoSeller',
        size: listing.size || '-',
        color: listing.color || '—',
        price: listing.price,
        oldPrice: listing.origPrice || Math.round(listing.price * 2.5),
        cond: listing.ai?.condition || 90,
        img: listing.img || 'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?w=600',
        brandAccuracy: listing.ai?.brandAccuracy || 90,
        defect: listing.ai?.defect || 'Không phát hiện lỗi đáng kể',
        description: listing.description,
        sellerEmail: listing.sellerEmail || '@ecoseller_87',
      };
    }
  }
  if (!p) p = Storage.getCatalog()[0];
  currentProduct = p;

  // Lấy thông tin người bán
  const sellerEmail = p.sellerEmail || '@ecoseller_87';
  seller = Storage.getSellerByEmail(sellerEmail);

  renderProduct(p);
  renderSellerInfo(seller);
  renderChart(p);
}

function renderProduct(p) {
  document.getElementById('crumb').textContent = p.name;
  document.getElementById('pName').textContent = p.name;
  document.getElementById('pBrand').textContent = p.brand + ' · Đã kiểm định AI';
  document.getElementById('pPrice').textContent = formatVnd(p.price);
  document.getElementById('pOld').textContent = ' ' + formatVnd(p.oldPrice);
  document.getElementById('pSize').textContent = p.size;
  document.getElementById('pColor').textContent = p.color || '—';
  document.getElementById('pCondText').textContent = p.cond + '% Like New';
  document.getElementById('rBrand').textContent = `${p.brand} (Độ chính xác: ${p.brandAccuracy || 94}%)`;
  document.getElementById('rCond').textContent = `${p.cond}% Like New`;
  document.getElementById('rDefect').textContent = p.defect || 'Không phát hiện lỗi đáng kể';
  
  // Mô tả sản phẩm
  if (document.getElementById('productDescription')) {
    document.getElementById('productDescription').textContent = p.description || 'Sản phẩm chất lượng cao, được kiểm định kỹ lưỡng bởi AI. Phù hợp cho những khách hàng quan tâm đến bền vững và tiết kiệm chi phí.';
  }

  document.getElementById('mainImg').src = p.img;
  const thumbUrls = [p.img, p.img + '&sat=-30', p.img + '&flip=h', p.img + '&blur=1'];
  document.getElementById('thumbs').innerHTML = thumbUrls.map((u, i) => `
    <div class="t ${i === 0 ? 'active' : ''}" onclick="swapThumb(this,'${u}')"><img src="${u}"/></div>
  `).join('');
}

function swapThumb(el, url) {
  document.querySelectorAll('.thumbs .t').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('mainImg').src = url;
}

function renderChart(p) {
  const trend = AIEngine.priceTrend(p.price);
  new Chart(document.getElementById('priceTrendChart'), {
    type: 'line',
    data: {
      labels: trend.labels,
      datasets: [{
        label: 'Giá thị trường (đ)',
        data: trend.data,
        borderColor: '#0F4A39',
        backgroundColor: 'rgba(46,224,126,.18)',
        borderWidth: 1.5,
        fill: true,
        tension: 0.35,
        pointRadius: 0,
        pointHoverRadius: 3,
        pointBackgroundColor: '#2EE07E',
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: 0 },
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { font: { size: 9 }, maxTicksLimit: 5 }, grid: { display: false } },
        y: {
          ticks: {
            font: { size: 9 },
            maxTicksLimit: 3,
            callback: v => new Intl.NumberFormat('vi-VN', { notation: 'compact' }).format(v) + 'đ',
          },
        },
      },
    },
  });
}

function renderSellerInfo(seller) {
  const area = document.getElementById('sellerInfoArea');
  if (!area) return;
  
  const ratingStars = '⭐'.repeat(Math.floor(seller.rating || 4.8)) + (seller.rating % 1 >= 0.5 ? '✨' : '');
  
  area.innerHTML = `
    <div style="background: rgba(46,224,126,.08); border: 1px solid rgba(46,224,126,.2); border-radius: 10px; padding: 16px">
      <div style="display: flex; align-items: flex-start; gap: 12px; margin-bottom: 12px">
        <img src="${seller.avatar || 'https://via.placeholder.com/60'}" style="width: 60px; height: 60px; border-radius: 50%; object-fit: cover; border: 2px solid var(--neon)"/>
        <div style="flex: 1">
          <div style="font-weight: 700; color: var(--ink); font-size: 16px">${seller.name || 'Người bán ẩn danh'}</div>
          <div style="font-size: 12px; color: var(--muted); margin: 2px 0">${ratingStars} ${seller.rating || 4.8}/5 (${seller.totalSales || 0} đơn hàng)</div>
          <div style="font-size: 12px; color: var(--muted)">Phản hồi trong ${seller.responseTime || '1 giờ'}</div>
        </div>
      </div>

      <div style="background: #fff; padding: 10px; border-radius: 6px; margin-bottom: 12px; font-size: 12px; line-height: 1.5; color: var(--muted)">
        <p style="margin: 0">${seller.bio || 'Người bán uy tín trên EcoCycle.AI'}</p>
      </div>

      ${seller.certifications && seller.certifications.length > 0 ? `
        <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px">
          ${seller.certifications.map(cert => `
            <span style="background: var(--neon); color: #0b2a1e; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600">✓ ${cert}</span>
          `).join('')}
        </div>
      ` : ''}

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px">
        <div style="background: #fff; padding: 8px; border-radius: 6px; text-align: center">
          <div style="font-size: 11px; color: var(--muted); margin-bottom: 2px">Tham gia</div>
          <div style="font-weight: 600; color: var(--ink); font-size: 12px">${new Date(seller.joinedAt || Date.now()).getFullYear()}</div>
        </div>
        <div style="background: #fff; padding: 8px; border-radius: 6px; text-align: center">
          <div style="font-size: 11px; color: var(--muted); margin-bottom: 2px">Địa chỉ</div>
          <div style="font-weight: 600; color: var(--ink); font-size: 11px">${seller.address ? seller.address.split(',')[0] : 'Hà Nội'}</div>
        </div>
      </div>

      <div style="display: flex; gap: 8px">
        <button class="btn btn-outline" style="flex: 1; padding: 8px; font-size: 12px" onclick="openSellerChat('${seller.name}', '${seller.email}')">
          💬 Chat với người bán
        </button>
        <button class="btn btn-primary" style="flex: 1; padding: 8px; font-size: 12px" onclick="viewSellerProfile('${seller.email}')">
          👤 Xem hồ sơ
        </button>
      </div>
    </div>
  `;
}

function openSellerChat(sellerName, sellerEmail) {
  const user = Storage.getUser();
  if (!user) {
    alert('🔒 Vui lòng đăng nhập trước khi chat với người bán!');
    openModal('authModal');
    return;
  }
  
  // Giả lập mở chat
  alert(`💬 Mở cuộc trò chuyện với ${sellerName}\n\nNội dung: "Bạn ơi, tôi có vài câu hỏi về sản phẩm này"\n\n(Chức năng chat sẽ được tích hợp sau)`);
}

function viewSellerProfile(sellerEmail) {
  alert(`👤 Xem hồ sơ người bán: ${sellerEmail}\n\n(Trang hồ sơ người bán sẽ được tích hợp sau)`);
}

function handleBuyNow() {
  if (currentProduct) buyNowProduct(currentProduct);
}
function handleAddToCart() {
  if (currentProduct) addProductToCart(currentProduct);
}

window.swapThumb = swapThumb;
window.handleBuyNow = handleBuyNow;
window.handleAddToCart = handleAddToCart;
