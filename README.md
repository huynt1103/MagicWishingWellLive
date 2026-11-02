# The Magic Wishing Well - TikTok Live Interactive (Coin Fountain)

Ứng dụng tương tác livestream TikTok với chủ đề **"The Magic Wishing Well - Hồ / Giếng Nước Ném Đồng Xu Ước Nguyện"** thiết kế chuyên biệt cho thị trường quốc tế (Mỹ, Anh, Canada, Úc...) hỗ trợ rút tiền quà tặng trực tiếp qua **PayPal**.

Dự án kết nối trực tiếp với TikTok Livestream qua WebSocket (`tiktok-live-connector`), tự động nhận diện bình luận, thả tim, quà tặng và render hoạt ảnh ném đồng xu vật lý 3D, sóng nước lan tỏa, cột nước thần phát sáng kèm giọng đọc AI tiếng Anh chúc phúc theo thời gian thực.

---

## 🌟 Tính Năng Nổi Bật

- 🪙 **Tung Đồng Xu Vật Lý 3D (Interactive Coin Drop)**:
  - Khi người xem bình luận (Chat) hoặc vào phòng live (Join): Một đồng xu vàng in avatar và tên người xem được tung lên không trung theo quỹ đạo parabol và rơi xuống giếng nước kèm tiếng leng keng (`coin_drop`) và tiếng nước bì bõm (`splash`).
  - Thả tim (Likes): Rơi những tia sáng may mắn và đồng xu nhỏ tạo gợn sóng nước liên tục.
- 🌊 **Cột Nước Thần & Đại Lễ Tặng Quà (Gift Fountain Surge)**:
  - Khi tặng quà (Gift xu): Kích hoạt cột nước thần / cột sáng thiên giới phun trào từ đáy giếng, chuông giáo đường ngân vang, mở ra cuộn sớ điều ước cát tường (*The Ancient Scroll of Wishes*).
- 🗣️ **Giọng Đọc AI Tiếng Anh Tự Động (AI Voice TTS)**:
  - Tự động xướng tên người tặng quà và đọc to lời chúc lành, thịnh vượng bằng tiếng Anh bản địa (`en-US-JennyNeural`, `en-US-GuyNeural` hoặc Web Speech API).
- 🏆 **Bảng Xếp Hạng "Fountain Guardians"**:
  - Tự động vinh danh top các người xem ném nhiều xu nhất theo thời gian thực.
- 🛡️ **Thiết Kế Đạt Chuẩn Thuật Toán TikTok (Anti-Static & OCR Safe)**:
  - Canvas 60 FPS với hiệu ứng đom đóm bay, ánh sáng lấp lánh và sóng nước chuyển động liên tục, chống bị TikTok quét lỗi "luồng video tĩnh".
  - Các thẻ hành động được đặt tên an toàn (*Make a Wish, Abundance, Eternal Joy*), né bot quét từ ngữ xin tiền tệ của TikTok.
- 💳 **Tương Thích Tuyệt Đối Với Payout PayPal**:
  - Toàn bộ ngôn ngữ giao diện, điều ước và giọng đọc đều là tiếng Anh, tối ưu hoàn hảo cho kênh TikTok US/UK rút tiền về ví PayPal chính chủ.

---

## 🚀 Hướng Dẫn Cài Đặt & Sử Dụng Nhanh

### 1. Yêu cầu hệ thống
- Máy tính cài sẵn **Node.js** (khuyến nghị phiên bản LTS v18 trở lên).
- Python 3.8+ (tùy chọn để chạy giọng đọc gTTS chất lượng cao).

### 2. Khởi chạy nhanh bằng 1 click
Trong thư mục dự án:
1. Nhấp đúp chuột vào file **`start_app.bat`**.
2. Ứng dụng tự động cài đặt thư viện (`npm install` nếu chưa có) và khởi động máy chủ tại cổng `3000`.
3. Trình duyệt sẽ tự động mở 2 trang:
   - **Màn hình Overlay Live (OBS)**: `http://localhost:3000/index.html`
   - **Bảng Điều Khiển Admin (Controller)**: `http://localhost:3000/admin.html`

### 3. Đưa vào OBS Studio / TikTok Live Studio
1. Trong OBS Studio / TikTok Live Studio, thêm nguồn mới: **Browser Source** (Trình duyệt).
2. Điền URL: `http://localhost:3000/index.html`
3. Đặt kích thước:
   - Chiều rộng (Width): `1080`
   - Chiều cao (Height): `1920`
4. Đánh dấu tích vào: *"Control audio via OBS"* (Kiểm soát âm thanh qua OBS).

---

## 📁 Cấu Trúc Thư Mục

```
MagicWishingWellLive/
├── README.md               # Tài liệu giới thiệu & hướng dẫn sử dụng
├── server.js               # Máy chủ Node.js & Socket.IO xử lý sự kiện TikTok
├── package.json            # Danh sách dependencies (Express, Socket.IO, tiktok-live-connector)
├── wishes.json             # Danh sách 10+ lời chúc may mắn, thịnh vượng tiếng Anh
├── fortunes.json           # Dữ liệu quẻ bói tiếng Việt (dự phòng)
├── start_app.bat           # File khởi chạy ứng dụng 1-click
├── install_dependencies.bat# File cài đặt thư viện tự động
├── tts_service.py          # Script Python xử lý giọng đọc AI TTS
└── public/
    ├── index.html          # Màn hình Live Stream chính (1080x1920)
    ├── admin.html          # Bảng điều khiển admin, kết nối TikTok & test hiệu ứng
    ├── css/                # live.css, admin.css
    ├── js/
    │   ├── live.js         # Canvas render giếng nước, sóng nước, tung đồng xu 3D
    │   ├── audio.js        # Web Audio API tổng hợp tiếng xu leng keng, tiếng nước, chuông
    │   └── admin.js        # Logic điều khiển bảng admin
    └── assets/             # Âm thanh chuông & nhạc thiền thư giãn
```

---

## ⚠️ Lưu Ý Vận Hành Live Thị Trường US/UK

1. **Proxy Dân Cư (Residential Proxy):** Khi phát live kênh US/UK từ Việt Nam, luôn kết nối máy tính qua Proxy dân cư sạch tại US/UK để luồng live được TikTok phân phối đến người xem bản địa.
2. **Cấu Hình PayPal:** Trong TikTok Creator Dashboard, liên kết tài khoản PayPal chính chủ đã xác thực thẻ ngân hàng để nhận tiền rút tự động.
