/* EcoCycle.AI — Payment & Checkout
 * Supports COD, VietQR bank transfer, and a MoMo "sandbox" simulation.
 *
 * IMPORTANT (be upfront about this in the demo/report): real MoMo/bank payment
 * integration requires a signed merchant account (partnerCode + secretKey) issued
 * by MoMo/the bank and a backend to sign requests — that cannot run safely in
 * pure client-side JS. VietQR's public image endpoint (img.vietqr.io) *is* real
 * and genuinely renders a valid-looking transfer QR for a given account/amount/memo,
 * so that path is left as-is. The MoMo panel is clearly labeled as a sandbox/demo
 * simulation so nobody mistakes it for a live payment.
 */

// ---------- Buy Now (single item, from product-detail.html) ----------
function buyNowProduct(product) {
  if (!requireLogin('🔒 Vui lòng đăng nhập tài khoản trước khi mua hàng!')) return;
  window.__checkoutItems = [{ id: product.id, name: product.name, brand: product.brand, price: product.price, img: product.img, qty: 1 }];
  window.__checkoutFromCart = false;
  openCheckoutModal();
}

// ---------- Checkout Modal ----------
function openCheckoutModal() {
  const items = window.__checkoutItems || [];
  if (!items.length) return;
  window.__checkoutVoucher = null;

  const area = document.getElementById('checkoutItemsArea');
  const subtotal = checkoutSubtotal();
  area.innerHTML = `
    <div style="background:#f4fbf7;border:1px solid var(--border);border-radius:8px;padding:10px 12px">
      ${items.map(i => `
        <div class="flex items-center justify-between" style="padding:4px 0">
          <span>${i.name} ${i.qty > 1 ? `× ${i.qty}` : ''}</span>
          <b>${formatVnd(i.price * i.qty)}</b>
        </div>`).join('')}
    </div>`;

  renderVoucherOptions(subtotal);
  renderPriceBreakdown();

  document.getElementById('coMethod').value = 'COD';
  document.getElementById('checkoutSubmitBtn').disabled = false;
  document.getElementById('checkoutSubmitBtn').textContent = 'Xác nhận thanh toán';
  onPaymentMethodChange('COD');
  openModal('checkoutModal');
}

// ---------- Price math: tiền hàng + phí ship - giảm giá voucher ----------
function checkoutSubtotal() {
  return (window.__checkoutItems || []).reduce((s, i) => s + i.price * i.qty, 0);
}

function checkoutShippingFee() {
  return Storage.getShippingFee();
}

// Trả về { shipDiscount, productDiscount }
function checkoutVoucherDiscount() {
  const v = window.__checkoutVoucher;
  const subtotal = checkoutSubtotal();
  const shipFee = checkoutShippingFee();
  if (!v) return { shipDiscount: 0, productDiscount: 0 };

  if (v.type === 'ship') {
    const shipDiscount = Math.round(shipFee * (v.percent / 100));
    return { shipDiscount, productDiscount: 0 };
  }
  if (v.type === 'product') {
    let productDiscount = Math.round(subtotal * (v.percent / 100));
    if (v.maxDiscount) productDiscount = Math.min(productDiscount, v.maxDiscount);
    return { shipDiscount: 0, productDiscount };
  }
  return { shipDiscount: 0, productDiscount: 0 };
}

function checkoutTotal() {
  const subtotal = checkoutSubtotal();
  const shipFee = checkoutShippingFee();
  const { shipDiscount, productDiscount } = checkoutVoucherDiscount();
  const total = (subtotal - productDiscount) + Math.max(0, shipFee - shipDiscount);
  return Math.max(0, total);
}

// ---------- Voucher select ----------
function renderVoucherOptions(subtotal) {
  const sel = document.getElementById('coVoucher');
  const hint = document.getElementById('coVoucherHint');
  if (!sel) return;

  const user = Storage.getUser();
  const myVouchers = user ? Storage.getUserVouchers(user.email) : [];
  const now = Date.now();
  const usable = myVouchers.filter(v => !v.used && new Date(v.expiresAt).getTime() > now && subtotal >= (v.minOrder || 0));

  sel.innerHTML = '<option value="">— Không dùng voucher —</option>' + usable.map(v => `
    <option value="${v.code}">${v.type === 'ship' ? '🚚' : '🎟️'} ${v.name} (còn hạn)</option>
  `).join('');

  if (hint) {
    const locked = myVouchers.filter(v => !v.used && subtotal < (v.minOrder || 0));
    hint.textContent = locked.length
      ? `Có ${locked.length} voucher cần đơn tối thiểu cao hơn để dùng được. Đổi thêm voucher trong Dashboard.`
      : (usable.length ? '' : 'Chưa có voucher khả dụng — đổi điểm tích lũy lấy voucher trong Dashboard.');
  }
  window.__checkoutVoucher = null;
}

function onVoucherChange(code) {
  const user = Storage.getUser();
  const myVouchers = user ? Storage.getUserVouchers(user.email) : [];
  window.__checkoutVoucher = myVouchers.find(v => v.code === code) || null;
  renderPriceBreakdown();
  // Refresh payment panel (QR/MoMo amount) vì tổng tiền vừa thay đổi
  const method = document.getElementById('coMethod').value;
  onPaymentMethodChange(method);
}

function renderPriceBreakdown() {
  const subtotal = checkoutSubtotal();
  const shipFee = checkoutShippingFee();
  const { shipDiscount, productDiscount } = checkoutVoucherDiscount();
  const discount = shipDiscount + productDiscount;
  const total = checkoutTotal();

  document.getElementById('coSubtotal').textContent = formatVnd(subtotal);
  document.getElementById('coShipFee').textContent = formatVnd(Math.max(0, shipFee - shipDiscount)) + (shipDiscount > 0 ? ` (giảm ${formatVnd(shipDiscount)})` : '');

  const discountRow = document.getElementById('coDiscountRow');
  if (productDiscount > 0) {
    discountRow.style.display = 'flex';
    document.getElementById('coDiscount').textContent = '-' + formatVnd(productDiscount);
  } else {
    discountRow.style.display = 'none';
  }

  document.getElementById('coFinalTotal').textContent = formatVnd(total);
}

// ---------- VietQR (bank transfer) ----------
function buildVietQrUrl(amount, memo) {
  const BANK_ID = 'MB';               // Ngân hàng demo dùng trong đồ án
  const ACCOUNT_NO = '0999999999';    // Số tài khoản demo
  const ACCOUNT_NAME = 'NGUYEN VAN A';
  return `https://img.vietqr.io/image/${BANK_ID}-${ACCOUNT_NO}-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(memo)}&accountName=${encodeURIComponent(ACCOUNT_NAME)}`;
}

// ---------- Payment method panel switching ----------
function onPaymentMethodChange(method) {
  const panel = document.getElementById('paymentPanelArea');
  const total = checkoutTotal();
  const memo = 'ECOCYCLE ' + Date.now().toString().slice(-8);
  window.__checkoutMemo = memo;

  if (method === 'BANK') {
    const url = buildVietQrUrl(total, memo);
    panel.innerHTML = `
      <div style="text-align:center;margin-top:10px;padding:16px;background:#f4fbf7;border:1px dashed var(--neon);border-radius:8px">
        <p style="font-size:12px;color:var(--muted);margin-bottom:8px">Dùng app Ngân hàng (Banking) hoặc MoMo quét mã QR để chuyển khoản:</p>
        <img src="${url}" style="width:180px;height:180px;margin:0 auto;border-radius:6px;box-shadow:0 2px 8px rgba(0,0,0,.1)"/>
        <p style="font-size:12px;font-weight:700;color:var(--brand);margin-top:8px">Nội dung CK bắt buộc: <span style="color:red;background:#fff;padding:2px 6px;border:1px solid red;border-radius:4px">${memo}</span></p>
      </div>`;
    document.getElementById('checkoutSubmitBtn').disabled = false;
    document.getElementById('checkoutSubmitBtn').textContent = 'Tôi đã chuyển khoản — Xác nhận';
  } else if (method === 'MOMO') {
    panel.innerHTML = `
      <div style="text-align:center;margin-top:10px;padding:16px;background:#fff0f6;border:1px dashed #d82d8b;border-radius:8px">
        <p style="font-size:12px;color:#a3195b;margin-bottom:8px;font-weight:600">Ví MoMo — môi trường Sandbox (demo đồ án, không phát sinh giao dịch thật)</p>
        <div style="font-weight:800;color:#d82d8b;font-size:20px">${formatVnd(total)}</div>
        <p style="font-size:12px;color:var(--muted);margin:6px 0">Mã đơn hàng: <b>${memo}</b></p>
        <button type="button" class="btn" style="background:#d82d8b;color:#fff;width:100%" onclick="simulateMomoPayment()">Mở ứng dụng MoMo (giả lập)</button>
        <p id="momoStatus" style="font-size:12px;color:var(--muted);margin-top:8px">Hoặc nhấn nút "Xác nhận thanh toán" dưới đây để tiếp tục</p>
      </div>`;
    document.getElementById('checkoutSubmitBtn').disabled = false;
    document.getElementById('checkoutSubmitBtn').textContent = 'Xác nhận thanh toán';
  } else {
    panel.innerHTML = `<p style="font-size:12px;color:var(--muted);margin-top:8px">Thanh toán bằng tiền mặt khi nhận hàng.</p>`;
    document.getElementById('checkoutSubmitBtn').disabled = false;
    document.getElementById('checkoutSubmitBtn').textContent = 'Xác nhận thanh toán';
  }
}

function simulateMomoPayment() {
  const statusEl = document.getElementById('momoStatus');
  const submitBtn = document.getElementById('checkoutSubmitBtn');
  if (statusEl) statusEl.textContent = '⏳ Đang chờ xác nhận từ ứng dụng MoMo...';
  setTimeout(() => {
    window.__momoConfirmed = true;
    if (statusEl) statusEl.innerHTML = '✅ Thanh toán MoMo (sandbox) thành công';
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Xác nhận thanh toán';
    }
  }, 1800);
}

// ---------- Submit checkout -> create invoice ----------
function submitCheckout(e) {
  e.preventDefault();
  const loggedUser = Storage.getUser();
  if (!loggedUser) {
    alert('🔒 Vui lòng đăng nhập tài khoản trước khi thanh toán!');
    openModal('authModal');
    return false;
  }

  const items = window.__checkoutItems || [];
  if (!items.length) return false;

  const subtotal = checkoutSubtotal();
  const shipFee = checkoutShippingFee();
  const { shipDiscount, productDiscount } = checkoutVoucherDiscount();
  const finalShipFee = Math.max(0, shipFee - shipDiscount);
  const total = checkoutTotal();
  const voucher = window.__checkoutVoucher;

  const productLabel = items.length === 1 ? items[0].name : `${items[0].name} và ${items.length - 1} sản phẩm khác`;

  // Với mỗi sản phẩm: đánh dấu đã bán (ẩn khỏi trang chủ) + cộng điểm cho người bán.
  const allListings = Storage.getListings();
  const itemsWithSeller = items.map(i => {
    const listing = allListings.find(l => l.id === i.id);
    let sellerEmail = listing ? listing.sellerEmail : null;
    let sellerName = Storage.resolveSellerName(sellerEmail);

    if (listing) {
      const sellerPoints = Math.max(1, Math.floor((i.price * i.qty) / 2000));
      Storage.updateListing(listing.id, {
        status: 'Đã bán',
        soldAt: new Date().toISOString(),
        buyerEmail: loggedUser.email,
        soldPoints: sellerPoints,
      });
      if (sellerEmail) Storage.addUserPoints(sellerEmail, sellerPoints);
    } else {
      // Sản phẩm thuộc catalog gốc (không phải người dùng đăng bán) — ẩn khỏi trang chủ.
      Storage.markCatalogSold(i.id);
    }

    return { id: i.id, name: i.name, qty: i.qty, price: i.price, img: i.img, sellerEmail: sellerEmail || '', sellerName };
  });

  const sellerNames = [...new Set(itemsWithSeller.map(i => i.sellerName))];

  const tx = Storage.addTx({
    productName: productLabel,
    productId: items[0]?.id || null,
    items: itemsWithSeller,
    buyer: loggedUser.email,
    buyerPhone: document.getElementById('coPhone').value,
    buyerAddr: document.getElementById('coAddr').value,
    seller: sellerNames.join(', '),
    subtotal,
    shippingFee: finalShipFee,
    shippingFeeOriginal: shipFee,
    discount: productDiscount + shipDiscount,
    voucherUsed: voucher ? { code: voucher.code, name: voucher.name } : null,
    amount: total,
    ecoImpact: Math.max(1, Math.floor(total / 30000)),
    paymentMethod: document.getElementById('coMethod').value,
    memo: window.__checkoutMemo || '',
    status: 'Đã hoàn thành',
  });

  // Cộng điểm tích lũy cho người mua (1 điểm per 1000đ chi tiêu thực tế)
  const buyerPoints = Math.floor(total / 1000);
  Storage.addUserPoints(loggedUser.email, buyerPoints);

  // Đánh dấu voucher đã sử dụng
  if (voucher) Storage.markVoucherUsed(loggedUser.email, voucher.code);

  // Clear cart only if this checkout came from the cart
  if (window.__checkoutFromCart) Storage.clearCart();
  window.__checkoutItems = null;
  window.__checkoutFromCart = false;
  window.__checkoutVoucher = null;

  if (typeof renderCartBadge === 'function') renderCartBadge();
  closeModal('checkoutModal');
  showInvoice(tx);
  return false;
}

// ---------- Invoice ----------
function showInvoice(tx) {
  const body = document.getElementById('invoiceBody');
  const methodLabel = { COD: 'Thanh toán khi nhận hàng', BANK: 'Chuyển khoản ngân hàng (VietQR)', MOMO: 'Ví MoMo' }[tx.paymentMethod] || tx.paymentMethod;
  const hasBreakdown = typeof tx.subtotal === 'number';
  body.innerHTML = `
    <div style="border:1px solid var(--border);border-radius:8px;padding:14px">
      <div class="flex items-center justify-between"><span>Mã hóa đơn</span><b style="color:var(--brand)">#${tx.id}</b></div>
      <div class="flex items-center justify-between"><span>Sản phẩm</span><b>${tx.productName}</b></div>
      <div class="flex items-center justify-between"><span>Người mua</span><b>${tx.buyer}</b></div>
      <div class="flex items-center justify-between"><span>Người bán</span><b>${tx.seller}</b></div>
      <div class="flex items-center justify-between"><span>Phương thức</span><b>${methodLabel}</b></div>
      ${hasBreakdown ? `
      <div class="flex items-center justify-between"><span>Tiền hàng</span><b>${formatVnd(tx.subtotal)}</b></div>
      <div class="flex items-center justify-between"><span>Phí vận chuyển</span><b>${formatVnd(tx.shippingFee)}</b></div>
      ${tx.discount > 0 ? `<div class="flex items-center justify-between" style="color:#0F8A56"><span>Giảm giá voucher${tx.voucherUsed ? ' (' + tx.voucherUsed.name + ')' : ''}</span><b>-${formatVnd(tx.discount)}</b></div>` : ''}
      ` : ''}
      <div class="flex items-center justify-between"><span>Tổng thanh toán</span><b style="color:var(--brand)">${formatVnd(tx.amount)}</b></div>
      <div class="flex items-center justify-between"><span>Eco-Impact</span><b style="color:var(--brand)">+${tx.ecoImpact}</b></div>
      <div class="flex items-center justify-between"><span>Trạng thái</span><span class="status">${tx.status}</span></div>
    </div>`;
  openModal('invoiceModal');
}