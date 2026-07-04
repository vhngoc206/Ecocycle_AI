/* EcoCycle.AI — Cart Logic
 * Handles the "Thêm vào giỏ hàng" flow, the cart badge in the navbar,
 * and the cart modal (view / edit quantity / remove / go to checkout).
 */

function renderCartBadge() {
  const badge = document.getElementById('cartBadge');
  if (!badge) return;
  const count = Storage.cartCount();
  badge.textContent = count;
  badge.style.display = count > 0 ? 'inline-block' : 'none';
}

// Called from product-detail.html
function addProductToCart(product, qty = 1) {
  if (!requireLogin('🔒 Vui lòng đăng nhập trước khi thêm sản phẩm vào giỏ hàng!')) return;
  Storage.addToCart(product, qty);
  renderCartBadge();
  alert(`✅ Đã thêm "${product.name}" vào giỏ hàng.`);
}

function openCartModal() {
  if (!requireLogin('🔒 Vui lòng đăng nhập để xem giỏ hàng của bạn!')) return;
  renderCartItems();
  openModal('cartModal');
}

function renderCartItems() {
  const area = document.getElementById('cartItemsArea');
  const totalEl = document.getElementById('cartTotal');
  if (!area) return;
  const cart = Storage.getCart();
  if (!cart.length) {
    area.innerHTML = `<p style="color:var(--muted);text-align:center;padding:24px 0">Giỏ hàng trống. Hãy khám phá sàn giao dịch!</p>`;
    if (totalEl) totalEl.textContent = formatVnd(0);
    const btn = document.getElementById('cartCheckoutBtn');
    if (btn) btn.disabled = true;
    return;
  }
  area.innerHTML = cart.map(c => `
    <div class="flex items-center gap-3" style="padding:10px 0;border-bottom:1px solid var(--border)">
      <img src="${c.img}" style="width:56px;height:56px;object-fit:cover;border-radius:8px" alt="${c.name}"/>
      <div style="flex:1">
        <div style="font-weight:600">${c.name}</div>
        <div style="font-size:12px;color:var(--muted)">${c.brand} · ${formatVnd(c.price)}</div>
      </div>
      <input type="number" min="1" value="${c.qty}" style="width:56px;padding:4px;border:1px solid var(--border);border-radius:6px;text-align:center"
        onchange="changeCartQty('${c.id}', this.value)"/>
      <button class="btn btn-outline" style="padding:4px 10px" onclick="removeCartItem('${c.id}')">Xóa</button>
    </div>
  `).join('');
  if (totalEl) totalEl.textContent = formatVnd(Storage.cartTotal());
  const btn = document.getElementById('cartCheckoutBtn');
  if (btn) btn.disabled = false;
}

function changeCartQty(id, val) {
  Storage.updateCartQty(id, Number(val) || 1);
  renderCartItems();
  renderCartBadge();
}

function removeCartItem(id) {
  Storage.removeFromCart(id);
  renderCartItems();
  renderCartBadge();
}

// Kick off checkout using everything currently in the cart
function startCartCheckout() {
  const cart = Storage.getCart();
  if (!cart.length) return;
  window.__checkoutItems = cart.map(c => ({ ...c }));
  window.__checkoutFromCart = true;
  closeModal('cartModal');
  openCheckoutModal();
}

window.addEventListener('storage', renderCartBadge);
window.addEventListener('focus', renderCartBadge);
