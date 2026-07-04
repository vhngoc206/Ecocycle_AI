# EcoCycle.AI — Ghi chú bản sửa

## 1. Lỗi AI thẩm định đã sửa
Trong `sell-item.html` gốc, hàm `runAIScan()` được viết đầy đủ nhưng **không có nơi nào gọi nó** —
sự kiện `change` trên input file chỉ hiển thị ảnh xem trước rồi dừng lại. Vì vậy sau khi tải ảnh,
phần thẩm định AI không bao giờ chạy.

**Đã sửa** (`js/page-sell.js`): ngay sau khi ảnh được đọc xong bằng `FileReader`, `runAIScan()`
được gọi tự động. Ngoài ra có thêm nút "Chạy lại AI thẩm định" để bạn thẩm định lại sau khi sửa
Danh mục / Mô tả (vì `AIEngine.analyze()` giờ đọc cả 2 trường này để tính điểm).

`js/ai-engine.js` cũng được viết lại: kết quả (thương hiệu, % mới, lỗi phát hiện, giá đề xuất)
giờ được suy ra từ ảnh + danh mục + mô tả + giá gốc thay vì `Math.random()` thuần túy, nên quét
lại cùng một ảnh cho ra kết quả nhất quán, và mô tả bạn nhập ("rách", "gần như mới"...) thật sự
ảnh hưởng tới điểm.

## 2. Tách JS ra khỏi HTML
Mỗi trang giờ chỉ còn HTML + `<script src="...">`, không còn `<script>` nội tuyến hàng trăm dòng:

| Trang | File JS logic riêng |
|---|---|
| `index.html` | `js/page-index.js` |
| `sell-item.html` | `js/page-sell.js` |
| `product-detail.html` | `js/page-product-detail.js` |
| `transactions.html` | `js/page-transactions.js` |

Dùng chung mọi trang: `js/storage-manager.js`, `js/ai-engine.js`, `js/app.js` (navbar/modal/đăng nhập),
`js/cart.js` (giỏ hàng), `js/payment.js` (thanh toán + hóa đơn).

## 3. Bắt buộc đăng nhập trước khi mua/bán
`requireLogin()` trong `app.js` được dùng thống nhất cho: đăng bán sản phẩm, thêm vào giỏ hàng,
mua ngay, và thanh toán. Chưa đăng nhập → tự mở modal đăng nhập, chặn thao tác.

## 4. Giỏ hàng + Mua ngay + Thanh toán
- Trang chi tiết sản phẩm có 2 nút: **Mua Ngay** (thanh toán 1 sản phẩm ngay) và
  **Thêm giỏ hàng** (gom nhiều sản phẩm rồi thanh toán 1 lần).
- Icon giỏ hàng trên navbar hiển thị số lượng, bấm vào mở modal xem/sửa số lượng/xóa.
- Modal thanh toán dùng chung hỗ trợ 3 phương thức: **COD**, **Chuyển khoản ngân hàng (VietQR)**,
  **Ví MoMo**.
- Sau khi xác nhận, hệ thống tạo **hóa đơn** (modal hóa đơn có thể "In hóa đơn" hoặc xem lại trong
  Dashboard Quản Trị) và ghi vào sổ cái giao dịch.

### Về việc gọi API MoMo / Ngân hàng thật
- **VietQR**: dùng thật endpoint ảnh công khai `img.vietqr.io` để sinh mã QR chuyển khoản động theo
  số tiền/đơn vị/nội dung — đây là API công khai, không cần khóa bí mật, phù hợp cho đồ án.
- **MoMo**: MoMo yêu cầu tài khoản merchant (`partnerCode` + `secretKey`) và một backend để ký request
  — việc này không thể và không nên làm an toàn từ JavaScript phía trình duyệt (sẽ lộ khóa bí mật).
  Vì vậy phần MoMo trong đồ án là **mô phỏng sandbox** (được ghi rõ trên giao diện là demo), mô phỏng
  đúng luồng UX: bấm "Mở ứng dụng MoMo" → chờ xác nhận → hoàn tất thanh toán. Nếu muốn tích hợp MoMo
  thật, cần thêm một backend (Node/PHP...) để gọi MoMo API và ký chữ ký, phần front-end sẽ gọi sang
  backend đó thay vì gọi thẳng MoMo.

## 5. Dữ liệu sản phẩm & hóa đơn lưu ra 2 file JSON
Vì đây là dự án thuần front-end (không có server/database), trình duyệt **chỉ có thể ghi vào
LocalStorage**, không thể tự ghi đè file trên đĩa. Giải pháp áp dụng:

- Khi tải trang, `Storage.initCatalog()` / `Storage.initLedger()` sẽ `fetch()` dữ liệu gốc từ
  `data/products_init.json` và `data/transaction_init.json` (đã được viết lại với ~22 sản phẩm và
  5 hóa đơn mẫu, đầy đủ hơn dữ liệu hard-code cũ).
- Sản phẩm đăng mới / giao dịch mới trong lúc bạn dùng web được lưu vào LocalStorage.
- Trong Dashboard Quản Trị (`transactions.html`) có 2 nút **"Xuất products_init.json"** và
  **"Xuất transaction_init.json"** — bấm vào sẽ tải xuống bản JSON đã gộp (dữ liệu gốc + dữ liệu bạn
  vừa tạo). Bạn chỉ cần thay file trong thư mục `data/` bằng file vừa tải để "lưu vĩnh viễn" thay đổi.
  Đây là cách hợp lý nhất để làm việc với 2 file JSON khi không có backend thật; nếu đồ án yêu cầu có
  backend, bước tiếp theo hợp lý là viết một API nhỏ (Node/Express) nhận `POST` và ghi thẳng vào file
  hoặc vào database.

## 6. Chạy thử
Vì các trang dùng `fetch()` để tải file JSON, cần chạy qua **local server** (mở trực tiếp bằng
`file://` sẽ bị trình duyệt chặn CORS khi fetch JSON). Ví dụ:

```bash
cd ecocycle-ai
python3 -m http.server 5500
# rồi mở http://localhost:5500/index.html
```

Hoặc dùng extension "Live Server" trong VS Code. Nếu bạn vẫn mở trực tiếp bằng file://, trang sẽ tự
dùng bộ dữ liệu dự phòng nhỏ (4 sản phẩm) được nhúng sẵn trong `storage-manager.js` để không bị vỡ trang.

## 7. Lưu ý
- `css/style.css` không có trong các file bạn gửi nên không nằm trong gói này — giữ nguyên file CSS
  cũ của bạn ở đường dẫn `css/style.css` là dùng được ngay.
- File `product-detail.html` gốc có 2 khối modal mua hàng trùng `id` (`paymentMethod`, `vietQrImg`...)
  và 2 hàm xử lý submit chồng nhau — đây cũng là một phần gây lỗi. Bản mới dùng chung một modal thanh
  toán duy nhất được mount từ `app.js` cho tất cả các trang.


## Tai khoan Admin Demo

Thong tin dang nhap admin dung de kiem thu dashboard quan tri:

- Email: admin@ecocycle.ai
- Mat khau: admin123456

Thong tin nay da duoc go khoi man hinh dang nhap de giao dien gon va chuyen nghiep hon.
