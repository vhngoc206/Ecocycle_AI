/* EcoCycle.AI — Trang Đăng Bán (sell-item.html) */

let lastAI = null;
let lastPriceReview = null;
let fileInput, dropzone, dropzoneContent;


function getPriceBounds() {
  if (!lastAI) return { min: 0, max: Infinity };
  return {
    min: lastAI.minPrice || Math.round(lastAI.suggestedPrice * 0.8),
    max: lastAI.maxPrice || Math.round(lastAI.suggestedPrice * 1.2),
  };
}

function clampPrice(value) {
  const { min, max } = getPriceBounds();
  const n = Number(value) || 0;
  if (!n || !lastAI) return n;
  return Math.max(min, Math.min(max, n));
}

function renderPriceComparison(review) {
  lastPriceReview = review;
  const el = document.getElementById('priceComparePanel');
  if (!el || !review) return;
  el.style.display = 'block';

  const origPrice = Number(document.getElementById('fOrig').value) || 0;
  const catalogLabel = review.catalogRef.source === 'brand-category'
    ? 'TB cùng thương hiệu & danh mục'
    : review.catalogRef.source === 'category'
      ? 'TB cùng danh mục'
      : 'TB danh mục (ước tính)';

  let marketHtml = '<span style="color:#a7d9c2">Chưa có giao dịch tương tự trên sàn</span>';
  if (review.marketRef) {
    marketHtml = `${formatVnd(review.marketRef.low)} – ${formatVnd(review.marketRef.high)} <span style="opacity:.85">(TB ${formatVnd(review.marketRef.avg)}, ${review.marketRef.count} đơn)</span>`;
  }

  let origHtml = '<span style="color:#a7d9c2">—</span>';
  if (origPrice > 0) {
    const pctOfOrig = Math.round((review.finalPrice / origPrice) * 100);
    origHtml = `${formatVnd(origPrice)} → bạn đặt <b>${pctOfOrig}%</b> giá gốc`;
  }

  el.innerHTML = `
    <div class="price-compare-grid">
      <div class="pc-row"><span>Phân loại định giá</span><b>${review.category || '—'} · ${review.brand || '—'}</b></div>
      <div class="pc-row"><span>${catalogLabel}</span><b>${formatVnd(review.catalogRef.avg)}</b></div>
      <div class="pc-row"><span>Giá thị trường đã bán</span><b>${marketHtml}</b></div>
      <div class="pc-row"><span>So với giá gốc</span><b>${origHtml}</b></div>
      <div class="pc-row"><span>Biên độ cho phép</span><b>${formatVnd(review.minAllowed)} – ${formatVnd(review.maxAllowed)}</b></div>
    </div>`;
}

function refreshPriceReview() {
  if (!lastAI) return;
  const finalPrice = clampPrice(Number(document.getElementById('fFinal').value) || lastAI.suggestedPrice);
  const review = AIEngine.reviewPrice({
    aiPrice: lastAI.suggestedPrice,
    finalPrice,
    origPrice: Number(document.getElementById('fOrig').value) || 0,
    category: document.getElementById('fCat').value,
    brand: lastAI.brand,
    condition: lastAI.condition,
    catalog: Storage.getCatalog(),
    listings: Storage.getListings(),
    transactions: [...Storage.getTx(), ...Storage.getLedger()],
  });
  review.category = document.getElementById('fCat').value;
  review.brand = lastAI.brand;
  review.finalPrice = finalPrice;
  renderPriceComparison(review);
  updatePriceBoundsUI(review.minAllowed, review.maxAllowed);
}

document.addEventListener('DOMContentLoaded', init);

async function init() {
  mountChrome('sell');
  mountFooter();
  await Storage.initCatalog();
  await Storage.initLedger();

  fileInput = document.getElementById('fileInput');
  dropzone = document.getElementById('dropzone');
  dropzoneContent = document.getElementById('dropzoneContent');

  if (dropzone && fileInput) {
    dropzone.addEventListener('click', (e) => {
      if (e.target.classList.contains('btn-remove-img')) return;
      fileInput.click();
    });
  }

  if (fileInput) {
    fileInput.addEventListener('change', function (e) {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function (event) {
        dropzoneContent.innerHTML = `
          <img src="${event.target.result}" id="uploadedImg" class="w-full h-full object-contain rounded-xl" style="max-height:240px;margin:0 auto;display:block;" />
          <span class="btn-remove-img" onclick="clearSelectedImage(event)" style="position:absolute;top:12px;right:12px;background:rgba(0,0,0,.7);color:#fff;width:28px;height:28px;line-height:26px;text-align:center;border-radius:50%;font-size:18px;font-weight:bold;cursor:pointer;z-index:50;">×</span>`;
        document.getElementById('aiResult').classList.remove('show');
        // BUG FIX: uploading a photo used to just preview it and stop — the AI
        // scan was never actually triggered. Now the scan kicks off right away.
        runAIScan();
      };
      reader.readAsDataURL(file);
    });
  }

  ['fCat', 'fOrig', 'fSeg', 'fDesc'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', () => { if (document.getElementById('uploadedImg')) runAIScan(); });
  });

  refreshAll();
  window.addEventListener('storage', refreshAll);
  window.addEventListener('focus', refreshAll);
}

function updatePriceBoundsUI(min, max) {
  const rangeEl = document.getElementById('rRange');
  if (rangeEl) rangeEl.textContent = `Biên độ cho phép: ${formatVnd(min)} – ${formatVnd(max)} (±20% so với AI)`;
  const input = document.getElementById('fFinal');
  if (input) {
    input.min = min;
    input.max = max;
    input.title = `Chỉ được điều chỉnh từ ${formatVnd(min)} đến ${formatVnd(max)}`;
  }
  const hint = document.getElementById('fFinalBoundsHint');
  if (hint) hint.textContent = `Chỉ được nhập trong khoảng ${formatVnd(min)} – ${formatVnd(max)}`;
}

function clearSelectedImage(e) {
  e.stopPropagation();
  fileInput.value = '';
  dropzoneContent.innerHTML = `
    <div class="dz-icn">📸</div>
    <p>Kéo thả ảnh hoặc click để duyệt file từ máy tính</p>
    <div class="dz-sub">Hỗ trợ ảnh JPG, PNG chất lượng rõ nét</div>`;
  document.getElementById('aiResult').classList.remove('show');
  lastAI = null;
}

async function runAIScan() {

 const origPrice =
  Number(document.getElementById("fOrig").value);

if (!origPrice) {
    alert("Vui lòng nhập giá gốc trước khi AI định giá.");
    return;
}

  const imgEl = document.getElementById('uploadedImg');
  if (!imgEl) {
    alert('⚠️ Vui lòng chọn ảnh trang phục trước khi chạy AI!');
    return;
  }

  const result = document.getElementById('aiResult');
  if (result) result.classList.remove('show');
  dropzone.classList.add('scanning');

  try {
    const r = await AIEngine.analyze({
      imageDataUrl: imgEl.src,
      category: document.getElementById('fCat').value,
      description: document.getElementById('fDesc').value,
      origPrice: Number(document.getElementById('fOrig').value) || 0,
      segment: document.getElementById('fSeg').value,
      catalog: Storage.getCatalog(),
    });

    dropzone.classList.remove('scanning');
    lastAI = r;

    document.getElementById('rB').textContent = `${r.brand} (${r.brandAccuracy}%)`;
    document.getElementById('rC').textContent = `${r.condition}% Like New`;
    document.getElementById('rD').textContent = r.defect;
    document.getElementById('rPrice').textContent = formatVnd(r.suggestedPrice);

    document.getElementById('fFinal').value = r.suggestedPrice;
    refreshPriceReview();
    updatePriceDelta();

    if (result) result.classList.add('show');

    // #region agent log
    fetch('http://127.0.0.1:7808/ingest/f77c37b6-40a4-4786-a3c0-3feec095e479',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'abe799'},body:JSON.stringify({sessionId:'abe799',location:'page-sell.js:runAIScan',message:'AI scan completed',data:{brand:r.brand,category:document.getElementById('fCat').value,suggestedPrice:r.suggestedPrice,minPrice:r.minPrice,maxPrice:r.maxPrice,catalogAvg:lastPriceReview?.catalogRef?.avg},timestamp:Date.now(),hypothesisId:'E'})}).catch(()=>{});
    // #endregion
  } catch (err) {
    console.error(err);
    dropzone.classList.remove('scanning');
    // #region agent log
    fetch('http://127.0.0.1:7808/ingest/f77c37b6-40a4-4786-a3c0-3feec095e479',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'abe799'},body:JSON.stringify({sessionId:'abe799',location:'page-sell.js:runAIScan',message:'AI scan error',data:{error:String(err)},timestamp:Date.now(),hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    alert('AI thẩm định gặp lỗi, vui lòng thử lại.');
  }
}

function updatePriceDelta() {
  const input = document.getElementById('fFinal');
  const raw = Number(input.value) || 0;
  const { min, max } = getPriceBounds();
  const v = lastAI ? clampPrice(raw) : raw;

  if (lastAI && raw !== v) {
    input.value = v;
    const warn = document.getElementById('fFinalBoundsWarn');
    if (warn) {
      warn.textContent = raw > max
        ? `⚠️ Vượt biên độ tối đa — đã điều chỉnh về ${formatVnd(max)}`
        : raw < min
          ? `⚠️ Dưới biên độ tối thiểu — đã điều chỉnh về ${formatVnd(min)}`
          : '';
    }
  } else {
    const warn = document.getElementById('fFinalBoundsWarn');
    if (warn) warn.textContent = '';
  }

  document.getElementById('fFinalPreview').textContent = '≈ ' + formatVnd(v);
  const el = document.getElementById('fFinalDelta');
  if (!lastAI || !v) { el.textContent = '—'; el.style.color = '#a7d9c2'; return; }
  const diff = v - lastAI.suggestedPrice;
  const pct = ((diff / lastAI.suggestedPrice) * 100).toFixed(1);
  const sign = diff > 0 ? '+' : '';
  el.textContent = `${sign}${formatVnd(diff)} (${sign}${pct}% so với AI)`;
  el.style.color = diff > 0 ? '#2ee07e' : diff < 0 ? '#ffb4a2' : '#a7d9c2';
  refreshPriceReview();
}

function useAIPrice() {
  if (!lastAI) return;
  document.getElementById('fFinal').value = lastAI.suggestedPrice;
  updatePriceDelta();
}

function adjustPrice(pct) {
  const input = document.getElementById('fFinal');
  const base = Number(input.value) || lastAI?.suggestedPrice || 0;
  if (!base) return;
  input.value = clampPrice(Math.round(base * (1 + pct)));
  updatePriceDelta();
}

function compressImageDataUrl(dataUrl, maxWidth = 500, quality = 0.45) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxWidth / (img.width || maxWidth));
      const w = Math.round((img.width || maxWidth) * scale);
      const h = Math.round((img.height || maxWidth) * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => reject(new Error('compress failed'));
    img.src = dataUrl;
  });
}

async function publishItem() {
  const loggedIn = requireLogin('🔒 Vui lòng đăng nhập trước khi đăng bán sản phẩm!');
  // #region agent log
  fetch('http://127.0.0.1:7808/ingest/f77c37b6-40a4-4786-a3c0-3feec095e479',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'abe799'},body:JSON.stringify({sessionId:'abe799',location:'page-sell.js:publishItem',message:'publishItem called',data:{loggedIn,hasLastAI:!!lastAI,hasImg:!!document.getElementById('uploadedImg')},timestamp:Date.now(),hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  if (!loggedIn) return;

  const name = document.getElementById('fName').value || 'Sản phẩm chưa đặt tên';
  const aiPrice = lastAI?.suggestedPrice || 0;
  const price = clampPrice(Number(document.getElementById('fFinal').value) || aiPrice);
  const imgEl = document.getElementById('uploadedImg');
  const { min, max } = getPriceBounds();

  if (!imgEl) {
    alert('⚠️ Hãy chọn ảnh trang phục tải lên trước.');
    return;
  }
  if (!lastAI) {
    alert('⚠️ AI đang thẩm định ảnh, vui lòng đợi vài giây rồi thử lại.');
    return;
  }
  if (!price) {
    alert('⚠️ Vui lòng nhập giá bán trước khi đăng.');
    return;
  }
  if (price < min || price > max) {
    alert(`⚠️ Giá bán phải nằm trong biên độ cho phép: ${formatVnd(min)} – ${formatVnd(max)}`);
    return;
  }

  const listingPayload = {
    name,
    category: document.getElementById('fCat').value,
    size: document.getElementById('fSize').value,
    origPrice: Number(document.getElementById('fOrig').value) || 0,
    segment: document.getElementById('fSeg').value,
    description: document.getElementById('fDesc').value,
    aiSuggestedPrice: aiPrice,
    price,
    img: imgEl.src,
    ai: lastAI,
    priceReview: lastPriceReview,
    status: 'Đã duyệt',
    sellerEmail: Storage.getUser().email,
  };

  try {
   /*listingPayload.img = await compressImageDataUrl(imgEl.src);*/
   // Nếu ảnh là URL thì giữ nguyên
if (!imgEl.src.startsWith("data:")) {
    listingPayload.img = imgEl.src;
} else {
    listingPayload.img = await compressImageDataUrl(imgEl.src, 350, 0.35);
}
  } catch (_) { /* giữ ảnh gốc nếu nén thất bại */ }

  let saved;
  try {
    saved = Storage.addListing(listingPayload);
  } catch (err) {
  console.error(err);

  alert(err.name + "\n" + err.message);

  return;
}
  // #region agent log
  fetch('http://127.0.0.1:7808/ingest/f77c37b6-40a4-4786-a3c0-3feec095e479',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'abe799'},body:JSON.stringify({sessionId:'abe799',location:'page-sell.js:publishItem',message:'addListing success',data:{listingId:saved?.id,price},timestamp:Date.now(),hypothesisId:'C',runId:'post-fix'})}).catch(()=>{});
  // #endregion

  const user = Storage.getUser();
  Storage.addUserPoints(user.email, 50);

  alert(`✅ Đã đăng thành công "${name}" lên hệ thống.\n💚 Bạn nhận được +50 điểm tích lũy!`);
  refreshAll();
  window.location.href = 'index.html';
}

function renderDashboard() {
  const listings = Storage.getListings();
  const tx = Storage.getTx();
  const active = listings.filter(l => l.status === 'Đã duyệt' || l.status === 'Đang bán').length;
  const revenue = tx.reduce((s, t) => s + (t.amount || 0), 0);

  if (document.getElementById('sActive')) document.getElementById('sActive').textContent = active;
  if (document.getElementById('sSold')) document.getElementById('sSold').textContent = tx.length;
  if (document.getElementById('sRev')) document.getElementById('sRev').textContent = formatVnd(revenue);
}

function formatTime(ts) {
  const d = new Date(ts);
  const pad = n => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function statusBadge(s) {
  if (s === 'Đã duyệt' || s === 'Đang bán') return `<span class="status">${s}</span>`;
  if (s === 'Đã bán') return `<span class="status" style="background:#0b2a1e">${s}</span>`;
  return `<span class="status">${s || 'Đã duyệt'}</span>`;
}

function renderMyListings() {
  const user = Storage.getUser();
  const list = Storage.getListings().filter(l => !user || l.sellerEmail === user.email);
  const body = document.getElementById('myListings');
  if (!body) return;

  if (!list.length) {
    body.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--muted)">
      Bạn chưa đăng sản phẩm nào. Hãy chọn ảnh để AI thẩm định!</td></tr>`;
    return;
  }
  body.innerHTML = list.map(l => `
    <tr>
      <td><b style="color:var(--brand)">#${l.id || 'SP'}</b></td>
      <td>
        <a href="product-detail.html?id=${l.id}" style="color:var(--ink);font-weight:600">${l.name}</a>
        <div style="font-size:12px;color:var(--muted)">${l.ai?.brand ? l.ai.brand + ' · ' : ''}${l.ai?.condition ? l.ai.condition + '% Mới' : ''}</div>
      </td>
      <td>${l.category || '—'}</td>
      <td>${l.size || '—'}</td>
      <td><b>${formatVnd(l.price)}</b></td>
      <td style="color:var(--muted)">${formatTime(l.createdAt || Date.now())}</td>
      <td>${statusBadge(l.status)}</td>
      <td><button type="button" class="btn btn-outline" style="padding:4px 8px;font-size:12px" onclick="deleteMyListing('${l.id}')">Xóa</button></td>
    </tr>
  `).join('');
}

function deleteMyListing(productId) {
  const user = Storage.getUser();
  if (!user) {
    alert('Vui long dang nhap de xoa san pham.');
    return;
  }
  if (!confirm('Ban chac chan muon xoa san pham nay khoi danh sach dang ban?')) return;

  const result = Storage.deleteListing(productId, user.email);
  if (!result.ok) {
    alert(result.reason === 'forbidden'
      ? 'Ban chi co the xoa san pham do chinh ban dang ban.'
      : 'Khong tim thay san pham can xoa.');
    return;
  }

  alert('Da xoa san pham khoi danh sach dang ban.');
  refreshAll();
}

function refreshListings() { refreshAll(); }

function refreshAll() {
  renderDashboard();
  renderMyListings();
}

function exportMyListingsCsv() {
  const user = Storage.getUser();
  const listings = Storage.getListings().filter(l => !user || l.sellerEmail === user.email);
  if (!listings.length) {
    alert('Bạn chưa đăng sản phẩm nào để xuất.');
    return;
  }
  
  const header = ['Mã SP', 'Tên sản phẩm', 'Danh mục', 'Size', 'Giá bán (đ)', 'Giá gốc (đ)', 'Độ mới %', 'Trạng thái', 'Thời gian đăng'];
  const rows = listings.map(l => [
    l.id,
    l.name,
    l.category || '—',
    l.size || '—',
    l.price,
    l.origPrice || '—',
    l.ai?.condition || '—',
    l.status,
    formatTime(l.createdAt || Date.now())
  ]);
  
  const csv = [header, ...rows]
    .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ecocycle-listings-${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  
  alert(`✅ Đã xuất ${listings.length} sản phẩm của bạn thành CSV.`);
}

// expose for inline onclick= handlers in the HTML
window.runAIScan = runAIScan;
window.publishItem = publishItem;
window.updatePriceDelta = updatePriceDelta;
window.useAIPrice = useAIPrice;
window.adjustPrice = adjustPrice;
window.clearSelectedImage = clearSelectedImage;
window.refreshListings = refreshListings;
window.exportMyListingsCsv = exportMyListingsCsv;
window.deleteMyListing = deleteMyListing;
