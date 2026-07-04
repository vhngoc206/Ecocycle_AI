/* EcoCycle.AI — Trang Dashboard (transactions.html) */

let currentUser = null;
let currentTab = 'bought';
let currentAdminTab = 'all';
let revenueChartInstance = null;

document.addEventListener('DOMContentLoaded', init);

async function init() {
  mountChrome('admin');
  mountFooter();
  await Storage.initCatalog();
  await Storage.initLedger();
  await Storage.initSellers();

  currentUser = Storage.getUser();
  if (!currentUser) {
    alert('❌ Vui lòng đăng nhập trước khi truy cập Dashboard.');
    window.location.href = 'index.html';
    return;
  }

  // Xác định loại dashboard
  if (currentUser.role === 'Admin') {
    renderAdminDashboard();
  } else {
    renderUserDashboard();
  }

  document.getElementById('exportCsvBtn')?.addEventListener('click', exportLedgerCsv);
  document.getElementById('exportAllJsonBtn')?.addEventListener('click', () => {
    Storage.exportAllDataJson();
    alert('✅ Đã xuất toàn bộ dữ liệu sản phẩm, người dùng và hóa đơn giao dịch ra file JSON.');
  });
}

// ========== USER DASHBOARD ==========
function renderUserDashboard() {
  document.getElementById('dashboardTitle').textContent = '📊 Dashboard Cá Nhân';
  document.getElementById('dashboardDesc').textContent = 'Quản lý sản phẩm, lịch sử mua bán, và đổi voucher.';
  document.getElementById('userDashboard').style.display = 'block';
  document.getElementById('adminDashboard').style.display = 'none';

  // Hiển thị điểm tích lũy
  const points = Storage.getUserPoints(currentUser.email) || 0;
  document.getElementById('userPoints').textContent = points.toLocaleString('vi-VN');

  // Hiển thị vouchers
  renderUserVouchers();

  // Hiển thị sản phẩm mặc định (Đã mua)
  switchUserTab('bought');
}

function switchUserTab(tab) {
  currentTab = tab;

  // Cập nhật tab button style
  document.querySelectorAll('.tabBtn[data-tab]').forEach(btn => {
    btn.style.color = btn.dataset.tab === tab ? 'var(--brand)' : 'var(--muted)';
    btn.style.borderBottomColor = btn.dataset.tab === tab ? 'var(--brand)' : 'transparent';
  });

  let products = [];
  const userEmail = currentUser.email;

  if (tab === 'bought') {
    // Sản phẩm đã mua = giao dịch mà người dùng là buyer
    const allTx = [...Storage.getTx(), ...Storage.getLedger()];
    const boughtTx = allTx.filter(t => t.buyer === userEmail);

    // Lấy sản phẩm từ transactions (với ảnh từ items)
    products = boughtTx.map(t => ({
      id: t.id || t.productId,
      name: t.productName,
      price: t.amount,
      img: t.items?.[0]?.img || 'https://via.placeholder.com/300',
      transactionId: t.id,
    }));
  }
  else if (tab === 'selling') {
    // Sản phẩm đang bán = listing của người dùng chưa bán
    const allListings = Storage.getListings();
    products = allListings.filter(l => l.sellerEmail === userEmail && l.status !== 'Đã bán');
  }
  else if (tab === 'sold') {
    // Sản phẩm đã bán = listing của người dùng có status 'Đã bán'
    const allListings = Storage.getListings();
    products = allListings.filter(l => l.sellerEmail === userEmail && l.status === 'Đã bán');
  }

  renderUserProducts(products, tab);
}

function renderUserProducts(products, tab) {
  const grid = document.getElementById('userProductsGrid');

  if (products.length === 0) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:32px;color:var(--muted)">
      Bạn chưa có sản phẩm nào ở tab này.
    </div>`;
    return;
  }

  grid.innerHTML = products.map(p => {
    const price = p.price || p.origPrice;
    const imgUrl = p.img || (p.items && p.items[0] && p.items[0].img) || 'https://via.placeholder.com/300';

    return `
      <div style="border:1px solid rgba(46,224,126,.2);border-radius:8px;overflow:hidden;background:#fff;transition:all 0.3s">
        <img src="${imgUrl}" style="width:100%;height:150px;object-fit:cover;background:#f0f0f0"/>
        <div style="padding:12px">
          <div style="font-weight:600;color:var(--ink);font-size:13px;margin-bottom:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
            ${p.name}
          </div>
          <div style="font-size:14px;color:var(--brand);font-weight:700;margin-bottom:4px">💰 ${formatVnd(price)}</div>
          ${tab === 'bought' ? `
            <div style="font-size:11px;color:var(--muted);margin-bottom:8px">+${Math.floor(price/1000)} Eco Points</div>
          ` : ''}
          ${tab === 'sold' ? `
            <div style="font-size:11px;color:#0F8A56;font-weight:600;margin-bottom:8px">💚 +${p.soldPoints || 0} Điểm tích lũy xanh</div>
          ` : ''}
          ${tab === 'selling' ? `
            <button class="btn btn-outline" style="width:100%;padding:6px;font-size:11px" onclick="deleteListingProduct('${p.id}')">
              🗑️ Xóa bán
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function deleteListingProduct(productId) {
  if (!confirm('Bạn chắc chắn muốn xóa sản phẩm này khỏi danh sách bán?')) return;

  const result = Storage.deleteListing(productId, currentUser.email);
  if (!result.ok) {
    alert(result.reason === 'forbidden'
      ? 'Ban chi co the xoa san pham do chinh ban dang ban.'
      : 'Khong tim thay san pham can xoa.');
    return;
  }
  switchUserTab('selling'); // Refresh
}

// ---------- Voucher: đổi điểm tích lũy lấy voucher freeship / giảm giá ----------
function renderUserVouchers() {
  const points = Storage.getUserPoints(currentUser.email) || 0;
  const container = document.getElementById('userVouchers');
  const vouchers = Storage.getVoucherCatalog();

  container.innerHTML = vouchers.map(v => `
    <button class="btn ${points >= v.cost ? 'btn-primary' : 'btn-outline'}"
            style="font-size:11px;padding:8px;text-align:left;opacity:${points >= v.cost ? '1' : '0.6'};cursor:${points >= v.cost ? 'pointer' : 'not-allowed'}"
            ${points >= v.cost ? `onclick="exchangeVoucher('${v.id}')"` : 'disabled'}>
      ${v.icon} ${v.name} (${v.cost} pts)${v.minOrder ? `<div style="font-size:10px;font-weight:400;opacity:.85">Đơn tối thiểu ${formatVnd(v.minOrder)}</div>` : ''}
    </button>
  `).join('');

  renderMyVoucherList();
}

function renderMyVoucherList() {
  const listEl = document.getElementById('userVoucherList');
  if (!listEl) return; // panel optional, chỉ render nếu HTML có phần tử này
  const myVouchers = Storage.getUserVouchers(currentUser.email);
  const now = Date.now();
  const active = myVouchers.filter(v => !v.used && new Date(v.expiresAt).getTime() > now);

  if (!active.length) {
    listEl.innerHTML = `<p style="font-size:12px;color:var(--muted)">Bạn chưa có voucher nào còn hiệu lực.</p>`;
    return;
  }
  listEl.innerHTML = active.map(v => `
    <div style="font-size:12px;background:#fff;border:1px dashed var(--brand);border-radius:6px;padding:6px 10px;margin-bottom:6px">
      <b>${v.name}</b> — mã <code>${v.code}</code>
      <div style="color:var(--muted)">Hết hạn: ${new Date(v.expiresAt).toLocaleDateString('vi-VN')}</div>
    </div>
  `).join('');
}

function exchangeVoucher(voucherId) {
  const catalog = Storage.getVoucherCatalog();
  const def = catalog.find(v => v.id === voucherId);
  if (!def) return;

  if (!confirm(`Bạn muốn đổi "${def.name}" với giá ${def.cost} điểm?`)) return;

  const result = Storage.redeemVoucher(currentUser.email, voucherId);
  if (!result.ok) {
    alert('❌ ' + result.msg);
    return;
  }

  alert(`✅ Bạn đã đổi được voucher "${result.voucher.name}"!\nMã: ${result.voucher.code}\nĐiểm còn lại: ${result.remainingPoints}`);
  renderUserDashboard(); // Refresh
}

// ========== ADMIN DASHBOARD ==========
function renderAdminDashboard() {
  document.getElementById('dashboardTitle').textContent = '🛡️ Dashboard Admin';
  document.getElementById('dashboardDesc').textContent = 'Quản lý tổng thể sàn thương mại.';
  document.getElementById('userDashboard').style.display = 'none';
  document.getElementById('adminDashboard').style.display = 'block';
  document.getElementById('adminStats').style.display = 'grid';

  updateAdminStats();
  switchAdminTab('all');
}

function updateAdminStats() {
  const allUsers = Storage.getAllUsers();
  const allCatalog = Storage.getCatalog();
  const allListings = Storage.getListings();
  const allTx = [...Storage.getTx(), ...Storage.getLedger()];

  document.getElementById('totalMembers').textContent = allUsers.length;
  document.getElementById('totalProducts').textContent = (allCatalog.length + allListings.length);
  document.getElementById('totalTx').textContent = allTx.length;

  const monthRevenue = revenueForMonth(allTx, new Date().getMonth(), new Date().getFullYear());
  document.getElementById('monthRevenue').textContent = formatVnd(monthRevenue);
}

function revenueForMonth(allTx, month, year) {
  return allTx
    .filter(t => {
      const d = new Date(t.createdAt || t.date || Date.now());
      return d.getMonth() === month && d.getFullYear() === year;
    })
    .reduce((sum, t) => sum + (t.amount || 0), 0);
}

// ---------- Tab switching ----------
function switchAdminTab(tab) {
  currentAdminTab = tab;
  document.querySelectorAll('.tabBtn[data-admintab]').forEach(btn => {
    const active = btn.dataset.admintab === tab;
    btn.style.color = active ? 'var(--brand)' : 'var(--muted)';
    btn.style.borderBottomColor = active ? 'var(--brand)' : 'transparent';
  });

  document.getElementById('adminAllProductsPanel').style.display = tab === 'all' ? 'block' : 'none';
  document.getElementById('adminSoldProductsPanel').style.display = tab === 'sold' ? 'block' : 'none';

  if (tab === 'all') renderAdminAllProducts();
  else renderAdminSoldProducts();
}

// ---------- Mục 1: Tất cả sản phẩm hiện có trên sàn (kèm tên người bán) ----------
function renderAdminAllProducts() {
  const soldCatalogIds = Storage.getSoldCatalogIds();
  const catalogRows = Storage.getCatalog().map(p => ({
    img: p.img,
    name: p.name,
    category: p.category || '—',
    sellerName: 'EcoCycle Official Store',
    price: p.price,
    status: soldCatalogIds.includes(p.id) ? 'Đã bán' : 'Đang bán',
  }));

  const listingRows = Storage.getListings().map(l => ({
    img: l.img || 'https://via.placeholder.com/50',
    name: l.name,
    category: l.category || '—',
    sellerName: Storage.resolveSellerName(l.sellerEmail),
    price: l.price,
    status: l.status === 'Đã bán' ? 'Đã bán' : 'Đang bán',
  }));

  const rows = [...listingRows, ...catalogRows];
  document.getElementById('adminAllProductsCount').textContent = `${rows.length} sản phẩm`;

  const table = document.getElementById('adminAllProductsTable');
  if (!rows.length) {
    table.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--muted)">Không có dữ liệu.</td></tr>`;
    return;
  }

  table.innerHTML = rows.map(r => `
    <tr>
      <td><img src="${r.img}" style="width:40px;height:40px;border-radius:4px;object-fit:cover"/></td>
      <td><b>${r.name}</b></td>
      <td>${r.category}</td>
      <td>${r.sellerName}</td>
      <td><b>${formatVnd(r.price)}</b></td>
      <td><span class="status" style="${r.status === 'Đã bán' ? 'background:#0b2a1e' : ''}">${r.status}</span></td>
    </tr>
  `).join('');
}

// ---------- Mục 2: Tất cả sản phẩm đã bán (kèm tên người bán, doanh thu tháng, biểu đồ) ----------
function buildSoldRows() {
  const allTx = [...Storage.getTx(), ...Storage.getLedger()];
  const rows = [];

  allTx.forEach(t => {
    if (Array.isArray(t.items) && t.items.length) {
      t.items.forEach(it => {
        rows.push({
          img: it.img || 'https://via.placeholder.com/50',
          name: it.name,
          sellerName: it.sellerName || Storage.resolveSellerName(it.sellerEmail) || 'EcoCycle Official Store',
          buyer: t.buyer || '—',
          amount: (it.price || 0) * (it.qty || 1),
          createdAt: t.createdAt,
          status: t.status,
        });
      });
    } else {
      rows.push({
        img: t.img || 'https://via.placeholder.com/50',
        name: t.productName,
        sellerName: t.seller || 'EcoCycle Official Store',
        buyer: t.buyer || '—',
        amount: t.amount || 0,
        createdAt: t.createdAt,
        status: t.status,
      });
    }
  });

  return rows;
}

function renderAdminSoldProducts() {
  const rows = buildSoldRows();
  const allTx = [...Storage.getTx(), ...Storage.getLedger()];

  const now = new Date();
  document.getElementById('soldMonthRevenue').textContent = formatVnd(revenueForMonth(allTx, now.getMonth(), now.getFullYear()));
  document.getElementById('soldTotalCount').textContent = rows.length;

  const table = document.getElementById('adminSoldProductsTable');
  if (!rows.length) {
    table.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--muted)">Chưa có sản phẩm nào được bán.</td></tr>`;
  } else {
    table.innerHTML = rows
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .map(r => {
        const d = new Date(r.createdAt || Date.now());
        const monthLabel = `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
        return `
        <tr>
          <td><img src="${r.img}" style="width:40px;height:40px;border-radius:4px;object-fit:cover"/></td>
          <td><b>${r.name}</b></td>
          <td>${r.sellerName}</td>
          <td>${r.buyer}</td>
          <td><b>${formatVnd(r.amount)}</b></td>
          <td>${monthLabel}</td>
          <td><span class="status">${r.status}</span></td>
        </tr>`;
      }).join('');
  }

  renderRevenueByMonthChart(allTx);
}

function renderRevenueByMonthChart(allTx) {
  const canvas = document.getElementById('revenueByMonthChart');
  if (!canvas || typeof Chart === 'undefined') return;

  // Gom doanh thu theo 6 tháng gần nhất (kể cả tháng hiện tại)
  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ month: d.getMonth(), year: d.getFullYear(), label: `Th.${d.getMonth() + 1}/${d.getFullYear()}` });
  }

  const revenues = months.map(m => revenueForMonth(allTx, m.month, m.year));

  if (revenueChartInstance) revenueChartInstance.destroy();
  revenueChartInstance = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: months.map(m => m.label),
      datasets: [{
        label: 'Doanh thu (đ)',
        data: revenues,
        backgroundColor: 'rgba(46,224,126,.55)',
        borderColor: '#0F4A39',
        borderWidth: 1,
        borderRadius: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: {
          ticks: {
            callback: v => new Intl.NumberFormat('vi-VN', { notation: 'compact' }).format(v) + 'đ',
          },
        },
      },
    },
  });
}

function exportLedgerCsv() {
  const allTx = [...Storage.getTx(), ...Storage.getLedger()];
  const header = ['ID', 'Sản phẩm', 'Người mua', 'Người bán', 'Số tiền', 'Trạng thái', 'Ngày'];
  const rows = allTx.map(t => [
    t.id,
    t.productName,
    t.buyer || '—',
    t.seller || '—',
    t.amount,
    t.status,
    new Date(t.createdAt || t.date || Date.now()).toLocaleDateString('vi-VN'),
  ]);

  const csv = [header, ...rows]
    .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ecocycle-${currentUser.role.toLowerCase()}-${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Make functions global
window.switchUserTab = switchUserTab;
window.deleteListingProduct = deleteListingProduct;
window.exchangeVoucher = exchangeVoucher;
window.switchAdminTab = switchAdminTab;