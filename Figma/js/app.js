/* EcoCycle.AI — Shared App Shell
 * Modals, navbar (incl. giỏ hàng/cart badge), auth state, login-gate helper.
 * Page-specific logic now lives in js/page-*.js.
 * Product catalog now comes from data/products_init.json via Storage.initCatalog().
 */

// ---------- Modal Utilities ----------
function openModal(id) {
  const m = document.getElementById(id);
  if (!m) return;
  m.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeModal(id) {
  const m = document.getElementById(id);
  if (!m) return;
  m.classList.remove('open');
  document.body.style.overflow = '';
}
// Backdrop click to close
document.addEventListener('click', (e) => {
  if (e.target.classList && e.target.classList.contains('modal-backdrop')) {
    e.target.classList.remove('open');
    document.body.style.overflow = '';
  }
});

// ---------- Login Gate ----------
// Central helper used by every "mua hàng / đăng bán / thêm giỏ hàng" action.
// Returns true if logged in; otherwise opens the auth modal and returns false.
function requireLogin(message) {
  const user = Storage.getUser();
  if (!user) {
    alert(message || '🔒 Vui lòng đăng nhập tài khoản trước khi thực hiện thao tác này.');
    if (typeof openModal === 'function') openModal('authModal');
    return false;
  }
  return true;
}

// ---------- Auth State Rendering ----------
function renderAuthArea() {
  const el = document.getElementById('authArea');
  if (!el) return;
  const u = Storage.getUser();
  if (u) {
    el.innerHTML = `
      <div class="flex items-center gap-2">
        <span class="text-sm text-[color:var(--muted)] hidden md:inline">Xin chào,</span>
        <span class="font-semibold text-[color:var(--brand)]">${u.email.split('@')[0]}</span>
        <span class="text-xs px-2 py-1 rounded-full bg-[color:var(--neon)] text-[#0b2a1e] font-semibold">${u.role}</span>
        <button class="btn btn-outline ml-2" onclick="doLogout()">Đăng xuất</button>
      </div>`;
  } else {
    el.innerHTML = `<button class="btn btn-primary" onclick="openModal('authModal')">Đăng Nhập / Đăng Ký</button>`;
  }
}
function doLogout() {
  Storage.logout();
  renderAuthArea();
}
function handleAuthSubmit(e) {
  e.preventDefault();
  const email = document.getElementById('authEmail').value.trim();
  const pass = document.getElementById('authPass').value.trim();
  if (!email || !pass) return false;

  // Xác thực admin
  if (email === 'admin@ecocycle.ai') {
    if (pass !== 'admin123456') {
      alert('❌ Mật khẩu admin không đúng!');
      return false;
    }
    Storage.setUser({ email, role: 'Admin' });
  } else {
    // Kiểm tra người dùng có đăng ký chưa
    const users = Storage.getAllUsers();
    const user = users.find(u => u.email === email);
    if (!user) {
      alert('❌ Email này chưa được đăng ký. Vui lòng tạo tài khoản mới.');
      switchToSignup();
      return false;
    }
    if (user.password !== pass) {
      alert('❌ Mật khẩu không đúng!');
      return false;
    }
    Storage.setUser({ email, role: 'Người dùng', name: user.name });
    
    // Khởi tạo điểm nếu lần đầu đăng nhập
    if (!Storage.getUserPoints(email)) {
      Storage.setUserPoints(email, 50); // Điểm khởi tạo cho người dùng mới
    }
  }

  closeModal('authModal');
  renderAuthArea();
  if (typeof renderCartBadge === 'function') renderCartBadge();
  return false;
}

function switchToLogin() {
  document.getElementById('loginForm').style.display = 'block';
  document.getElementById('signupForm').style.display = 'none';
  document.getElementById('forgotForm').style.display = 'none';
  document.getElementById('authTitle').textContent = 'Đăng Nhập';
  document.getElementById('authSubtitle').textContent = 'Đăng nhập vào tài khoản EcoCycle.AI của bạn.';
}

function switchToSignup() {
  document.getElementById('loginForm').style.display = 'none';
  document.getElementById('signupForm').style.display = 'block';
  document.getElementById('forgotForm').style.display = 'none';
  document.getElementById('authTitle').textContent = 'Tạo Tài Khoản';
  document.getElementById('authSubtitle').textContent = 'Đăng ký để mua bán thời trang tuần hoàn.';
}

function switchToForgotPassword() {
  document.getElementById('loginForm').style.display = 'none';
  document.getElementById('signupForm').style.display = 'none';
  document.getElementById('forgotForm').style.display = 'block';
  document.getElementById('authTitle').textContent = 'Quên Mật Khẩu';
  document.getElementById('authSubtitle').textContent = 'Reset mật khẩu của bạn.';
}

function handleSignup(e) {
  e.preventDefault();
  const name = document.getElementById('signupName').value.trim();
  const email = document.getElementById('signupEmail').value.trim();
  const pass = document.getElementById('signupPass').value.trim();
  const pass2 = document.getElementById('signupPass2').value.trim();

  if (!name || !email || !pass || !pass2) return false;
  if (pass !== pass2) {
    alert('❌ Mật khẩu xác nhận không trùng khớp!');
    return false;
  }
  if (pass.length < 6) {
    alert('❌ Mật khẩu phải có ít nhất 6 ký tự!');
    return false;
  }

  // Kiểm tra email đã tồn tại chưa
  const users = Storage.getAllUsers();
  if (users.find(u => u.email === email)) {
    alert('❌ Email này đã được đăng ký!');
    return false;
  }

  // Tạo tài khoản mới
  Storage.addUser({ name, email, password: pass });
  Storage.setUserPoints(email, 50); // Điểm khởi tạo cho người dùng mới
  alert(`✅ Tạo tài khoản thành công! Vui lòng đăng nhập.`);
  
  document.getElementById('signupEmail').value = email;
  document.getElementById('signupPass').value = '';
  document.getElementById('signupPass2').value = '';
  switchToLogin();
  document.getElementById('authEmail').value = email;
  return false;
}

function handleForgotPassword(e) {
  e.preventDefault();
  const email = document.getElementById('forgotEmail').value.trim();
  if (!email) return false;

  const users = Storage.getAllUsers();
  const user = users.find(u => u.email === email);
  if (!user) {
    alert('❌ Email này không tồn tại trong hệ thống!');
    return false;
  }

  // Giả lập gửi email reset
  const resetToken = Math.random().toString(36).substring(2, 15);
  alert(`✅ Yêu cầu reset mật khẩu đã được gửi!\n\n📧 Email: ${email}\n🔑 Token reset: ${resetToken}\n\nVui lòng sử dụng token này để reset mật khẩu.\n\n(Trong demo này, bạn có thể dùng: newpassword123)`);
  
  // Lưu token tạm thời
  Storage.setResetToken(email, resetToken);
  switchToLogin();
  return false;
}

function simulateGoogleLogin() {
  // Giả lập Google OAuth flow
  const randomName = ['Nguyễn', 'Trần', 'Phạm', 'Hoàng'][Math.floor(Math.random() * 4)] + 
                     ' ' + ['Văn', 'Thị'][Math.floor(Math.random() * 2)] + 
                     ' ' + ['An', 'B', 'C', 'Minh'][Math.floor(Math.random() * 4)];
  const randomNum = Math.floor(Math.random() * 10000);
  const email = `user.${randomNum}@gmail.com`;
  
  const users = Storage.getAllUsers();
  let user = users.find(u => u.email === email);
  if (!user) {
    Storage.addUser({ name: randomName, email, password: 'google_oauth', isGoogleUser: true });
    Storage.setUserPoints(email, 50); // Điểm khởi tạo
    alert(`✅ Đã tạo tài khoản Google mới: ${email}`);
  } else {
    alert(`✅ Đăng nhập thành công với Google!`);
  }

  Storage.setUser({ email, role: 'Người dùng', name: randomName });
  closeModal('authModal');
  renderAuthArea();
  if (typeof renderCartBadge === 'function') renderCartBadge();
}

// ---------- Navbar, Auth Modal & Cart Mount ----------
function mountChrome(activeKey = '') {
  const navMount = document.getElementById('navMount');
  if (navMount) {
    navMount.innerHTML = `
      <div class="nav">
        <div class="container nav-inner">
          <a href="index.html" class="logo">
            <span class="dot"></span> EcoCycle<span style="color:var(--neon)">.AI</span>
          </a>
          <div class="search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            <input placeholder="Tìm áo, quần, giày, thương hiệu..." />
          </div>
          <nav class="nav-links hidden md:flex">
            <a href="index.html" ${activeKey === 'shop' ? 'style="color:var(--brand);font-weight:700"' : ''}>Mua Sắm</a>
            <a href="sell-item.html" ${activeKey === 'sell' ? 'style="color:var(--brand);font-weight:700"' : ''}>Đăng Bán</a>
            <a href="transactions.html" ${activeKey === 'admin' ? 'style="color:var(--brand);font-weight:700"' : ''}>Quản Trị</a>
          </nav>
          <button class="btn btn-outline" style="position:relative" onclick="openCartModal()" title="Giỏ hàng">
            🛒 Giỏ hàng
            <span id="cartBadge" style="display:none;position:absolute;top:-8px;right:-8px;background:var(--neon);color:#0b2a1e;font-size:11px;font-weight:800;border-radius:999px;padding:1px 6px;">0</span>
          </button>
          <div id="authArea"></div>
        </div>
      </div>`;
  }

  const modalMount = document.getElementById('modalMount');
  if (modalMount) {
    modalMount.innerHTML = `
      <!-- Auth Modal -->
      <div class="modal-backdrop" id="authModal">
        <div class="modal-wrap">
          <div class="modal" style="max-height:90vh;overflow-y:auto">
            <button class="close" onclick="closeModal('authModal')">×</button>
            <h3 id="authTitle">Đăng Nhập</h3>
            <p class="sub" id="authSubtitle">Đăng nhập vào tài khoản EcoCycle.AI của bạn.</p>
            
            <!-- Login Form -->
            <form id="loginForm" onsubmit="return handleAuthSubmit(event)" style="display:block">
              <div class="field">
                <label>Email</label>
                <input id="authEmail" type="email" required placeholder="ban@email.com" />
              </div>
              <div class="field">
                <label>Mật khẩu</label>
                <input id="authPass" type="password" required placeholder="••••••••" />
              </div>
              <button class="btn btn-primary w-full" style="width:100%" type="submit">Đăng Nhập</button>
              <div style="text-align:center;margin:12px 0;font-size:12px;color:var(--muted)">hoặc</div>
              <button class="btn btn-outline w-full" style="width:100%;background:rgba(59,89,152,.1);border-color:#3b5998;color:#3b5998" type="button" onclick="switchToSignup()">📝 Tạo tài khoản mới</button>
              <button class="btn btn-outline w-full" style="width:100%;margin-top:6px" type="button" onclick="switchToForgotPassword()">🔑 Quên mật khẩu?</button>
            </form>

            <!-- Signup Form -->
            <form id="signupForm" onsubmit="return handleSignup(event)" style="display:none">
              <div class="field">
                <label>Họ và tên</label>
                <input id="signupName" type="text" required placeholder="Nguyễn Văn A" />
              </div>
              <div class="field">
                <label>Email</label>
                <input id="signupEmail" type="email" required placeholder="ban@email.com" />
              </div>
              <div class="field">
                <label>Mật khẩu</label>
                <input id="signupPass" type="password" required placeholder="••••••••" minlength="6" />
              </div>
              <div class="field">
                <label>Xác nhận mật khẩu</label>
                <input id="signupPass2" type="password" required placeholder="••••••••" minlength="6" />
              </div>
              <button class="btn btn-primary w-full" style="width:100%" type="submit">Tạo tài khoản</button>
              <div style="text-align:center;margin:12px 0;font-size:12px;color:var(--muted)">hoặc</div>
              <button class="btn btn-outline w-full" style="width:100%;background:rgba(219,68,55,.1);border-color:#db4437;color:#db4437" type="button" onclick="simulateGoogleLogin()">🔗 Đăng nhập bằng Google</button>
              <button class="btn btn-outline w-full" style="width:100%;margin-top:6px" type="button" onclick="switchToLogin()">← Quay lại đăng nhập</button>
            </form>

            <!-- Forgot Password Form -->
            <form id="forgotForm" onsubmit="return handleForgotPassword(event)" style="display:none">
              <p style="font-size:12px;color:var(--muted);margin-bottom:12px">Nhập email để nhận hướng dẫn reset mật khẩu.</p>
              <div class="field">
                <label>Email</label>
                <input id="forgotEmail" type="email" required placeholder="ban@email.com" />
              </div>
              <button class="btn btn-primary w-full" style="width:100%" type="submit">Gửi yêu cầu</button>
              <button class="btn btn-outline w-full" style="width:100%;margin-top:8px" type="button" onclick="switchToLogin()">← Quay lại đăng nhập</button>
            </form>
          </div>
        </div>
      </div>

      <!-- Cart Modal -->
      <div class="modal-backdrop" id="cartModal">
        <div class="modal-wrap">
          <div class="modal">
            <button class="close" onclick="closeModal('cartModal')">×</button>
            <h3>Giỏ hàng của bạn</h3>
            <p class="sub">Kiểm tra sản phẩm trước khi thanh toán.</p>
            <div id="cartItemsArea"></div>
            <div class="flex items-center justify-between mt-4" style="border-top:1px solid var(--border);padding-top:12px">
              <b>Tổng cộng</b>
              <b id="cartTotal" style="color:var(--brand);font-size:18px">0đ</b>
            </div>
            <button class="btn btn-primary w-full mt-3" style="width:100%" id="cartCheckoutBtn" onclick="startCartCheckout()">Tiến hành thanh toán</button>
          </div>
        </div>
      </div>

      <!-- Checkout / Payment Modal -->
      <div class="modal-backdrop" id="checkoutModal">
        <div class="modal-wrap">
          <div class="modal" style="max-height:90vh;overflow-y:auto;display:flex;flex-direction:column">
            <button class="close" onclick="closeModal('checkoutModal')">×</button>
            <h3>Xác nhận đơn hàng</h3>
            <p class="sub">Nhập thông tin giao hàng và chọn phương thức thanh toán.</p>
            <div id="checkoutItemsArea" style="margin-bottom:10px;flex-shrink:0"></div>
            <form onsubmit="return submitCheckout(event)" style="flex:1;overflow-y:auto;padding-right:8px">
              <div class="field"><label>Họ và tên</label><input id="coName" required placeholder="Nguyễn Văn A" /></div>
              <div class="field"><label>Số điện thoại</label><input id="coPhone" required placeholder="09xx xxx xxx" /></div>
              <div class="field"><label>Địa chỉ giao hàng</label><textarea id="coAddr" required rows="2" placeholder="Số nhà, đường, quận, TP"></textarea></div>
              <div class="field">
                <label>🎟️ Voucher (đổi bằng điểm tích lũy)</label>
                <select id="coVoucher" onchange="onVoucherChange(this.value)">
                  <option value="">— Không dùng voucher —</option>
                </select>
                <div id="coVoucherHint" style="font-size:11px;color:var(--muted);margin-top:4px"></div>
              </div>
              <div id="coPriceBreakdown" style="background:#f4fbf7;border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin-bottom:14px;font-size:13px">
                <div class="flex items-center justify-between"><span>Tiền hàng</span><b id="coSubtotal">0đ</b></div>
                <div class="flex items-center justify-between"><span>Phí vận chuyển</span><b id="coShipFee">0đ</b></div>
                <div class="flex items-center justify-between" id="coDiscountRow" style="display:none;color:#0F8A56"><span>Giảm giá voucher</span><b id="coDiscount">-0đ</b></div>
                <div class="flex items-center justify-between mt-2" style="border-top:1px dashed var(--border);padding-top:6px">
                  <b>Tổng thanh toán</b>
                  <b id="coFinalTotal" style="color:var(--brand);font-size:16px">0đ</b>
                </div>
              </div>
              <div class="field">
                <label>Phương thức thanh toán</label>
                <select id="coMethod" onchange="onPaymentMethodChange(this.value)">
                  <option value="COD">Thanh toán khi nhận hàng (COD)</option>
                  <option value="BANK">Chuyển khoản ngân hàng (VietQR)</option>
                  <option value="MOMO">Ví MoMo</option>
                </select>
              </div>
              <div id="paymentPanelArea" style="min-height:100px"></div>
              <button class="btn btn-primary" style="width:100%;flex-shrink:0" type="submit" id="checkoutSubmitBtn">Xác nhận thanh toán</button>
            </form>
          </div>
        </div>
      </div>

      <!-- Invoice Modal -->
      <div class="modal-backdrop" id="invoiceModal">
        <div class="modal-wrap">
          <div class="modal" id="invoicePrintArea">
            <button class="close" onclick="closeModal('invoiceModal')">×</button>
            <h3>🧾 Hóa đơn giao dịch</h3>
            <p class="sub">Giao dịch đã được ghi vào sổ cái hệ thống (Dashboard Quản Trị).</p>
            <div id="invoiceBody"></div>
            <div class="flex gap-2 mt-4">
              <button class="btn btn-outline" style="flex:1" onclick="window.print()">In hóa đơn</button>
              <a class="btn btn-primary" style="flex:1;text-align:center" href="transactions.html">Xem trong Dashboard</a>
            </div>
          </div>
        </div>
      </div>`;
  }

  renderAuthArea();
  if (typeof renderCartBadge === 'function') renderCartBadge();
}

// ---------- Footer ----------
function mountFooter() {
  const f = document.getElementById('footerMount');
  if (f) {
    f.innerHTML = `
    <footer style="background: linear-gradient(135deg, #0b2a1e 0%, #1a3a2a 100%); color: #e9fff2; padding: 48px 0 24px; margin-top: 60px">
      <div class="container">
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 32px; margin-bottom: 40px">
          <!-- About -->
          <div>
            <h4 style="color: var(--neon); font-weight: 700; margin-bottom: 12px">🌿 EcoCycle.AI</h4>
            <p style="font-size: 13px; line-height: 1.6; color: rgba(233, 255, 242, 0.8)">
              Sàn thương mại thời trang cũ được kiểm định bằng AI. Mua bán bền vững, giá minh bạch, chất lượng đảm bảo.
            </p>
            <p style="font-size: 12px; color: var(--neon); margin-top: 8px">
              💚 Giảm CO₂ • 💧 Tiết kiệm nước • ♻️ Tái tuần hoàn
            </p>
          </div>

          <!-- Links -->
          <div>
            <h4 style="color: var(--neon); font-weight: 700; margin-bottom: 12px">📱 Liên kết nhanh</h4>
            <ul style="list-style: none; padding: 0; margin: 0; font-size: 13px">
              <li style="margin-bottom: 6px"><a href="index.html" style="color: #e9fff2; text-decoration: none; border-bottom: 1px solid transparent; transition: all 0.2s">Mua sắm</a></li>
              <li style="margin-bottom: 6px"><a href="sell-item.html" style="color: #e9fff2; text-decoration: none; border-bottom: 1px solid transparent; transition: all 0.2s">Đăng bán</a></li>
              <li style="margin-bottom: 6px"><a href="transactions.html" style="color: #e9fff2; text-decoration: none; border-bottom: 1px solid transparent; transition: all 0.2s">Quản lý tài khoản</a></li>
              <li style="margin-bottom: 6px"><a href="#" style="color: #e9fff2; text-decoration: none; border-bottom: 1px solid transparent; transition: all 0.2s">Về chúng tôi</a></li>
            </ul>
          </div>

          <!-- Policies -->
          <div>
            <h4 style="color: var(--neon); font-weight: 700; margin-bottom: 12px">⚖️ Chính sách</h4>
            <ul style="list-style: none; padding: 0; margin: 0; font-size: 13px">
              <li style="margin-bottom: 6px"><a href="#" style="color: #e9fff2; text-decoration: none">Điều khoản sử dụng</a></li>
              <li style="margin-bottom: 6px"><a href="#" style="color: #e9fff2; text-decoration: none">Chính sách bảo mật</a></li>
              <li style="margin-bottom: 6px"><a href="#" style="color: #e9fff2; text-decoration: none">Quy tắc thanh toán</a></li>
              <li style="margin-bottom: 6px"><a href="#" style="color: #e9fff2; text-decoration: none">Hỗ trợ khách hàng</a></li>
            </ul>
          </div>

          <!-- Contact -->
          <div>
            <h4 style="color: var(--neon); font-weight: 700; margin-bottom: 12px">📞 Liên hệ</h4>
            <p style="font-size: 13px; margin: 6px 0; color: #e9fff2">
              <strong>Địa chỉ:</strong> 123 Phố Cổ, Hoàn Kiếm, Hà Nội
            </p>
            <p style="font-size: 13px; margin: 6px 0; color: #e9fff2">
              <strong>Email:</strong> <a href="mailto:hello@ecocycle.ai" style="color: var(--neon); text-decoration: none">hello@ecocycle.ai</a>
            </p>
            <p style="font-size: 13px; margin: 6px 0; color: #e9fff2">
              <strong>Hotline:</strong> <a href="tel:+84912345678" style="color: var(--neon); text-decoration: none">(+84) 9 1234 5678</a>
            </p>
            <div style="margin-top: 12px; display: flex; gap: 10px">
              <a href="#" style="display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; background: rgba(46,224,126,.2); border-radius: 50%; color: var(--neon); font-size: 16px; text-decoration: none; transition: all 0.2s" title="Facebook">f</a>
              <a href="#" style="display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; background: rgba(46,224,126,.2); border-radius: 50%; color: var(--neon); font-size: 14px; text-decoration: none; transition: all 0.2s" title="Twitter">𝕏</a>
              <a href="#" style="display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; background: rgba(46,224,126,.2); border-radius: 50%; color: var(--neon); font-size: 16px; text-decoration: none; transition: all 0.2s" title="Instagram">📷</a>
              <a href="#" style="display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; background: rgba(46,224,126,.2); border-radius: 50%; color: var(--neon); font-size: 16px; text-decoration: none; transition: all 0.2s" title="TikTok">♪</a>
            </div>
          </div>
        </div>

        <div style="border-top: 1px solid rgba(46,224,126,.2); padding-top: 24px; text-align: center">
          <p style="font-size: 12px; color: rgba(233, 255, 242, 0.6); margin: 0">
            © 2026 <strong>EcoCycle.AI</strong> — Tái tuần hoàn phong cách, kiểm định bằng AI 🌿
          </p>
          <p style="font-size: 11px; color: rgba(233, 255, 242, 0.5); margin: 8px 0 0">
            Thiết kế & phát triển bởi <strong>EcoCycle Team</strong> | Made with 💚
          </p>
        </div>
      </div>
    </footer>`;
  }
}