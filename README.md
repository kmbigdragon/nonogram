# Nonogram — Tô ô theo số

Minigame **Nonogram** (Picross, Griddlers): dựa vào các con số ở đầu mỗi hàng và mỗi cột để tô đúng các ô. Tô đúng hết, một bức tranh sẽ hiện ra.

## Chạy dự án

```bash
pnpm install
pnpm dev       # http://localhost:5173
pnpm build     # kiểm tra kiểu + build production vào dist/
pnpm lint
```

## Tính năng

- **4 mức độ**: Dễ (5×5), Trung bình (10×10), Khó (15×15), Rất khó (20×20).
- **Câu đố sinh ngẫu nhiên mỗi ván**, luôn có **đúng một lời giải** và giải được hoàn toàn bằng suy luận từng hàng/cột, không cần đoán. Mức càng khó, bộ sinh càng chọn câu đố cần nhiều vòng suy luận hơn.
- **Đồng hồ và giới hạn thời gian** chỉnh được cho từng mức (bật/tắt trong Cài đặt). Tự tạm dừng khi chuyển tab.
- Chạm để tô, **giữ và kéo** để tô cả dãy (khóa theo hàng hoặc cột), chuột phải hoặc công cụ *Đánh dấu* để gạch × ô trống. Bắt đầu kéo từ ô đã tô để xóa.
- Số gợi ý đã xong tự mờ đi, hàng/cột khớp gợi ý chuyển màu xanh; xem trước bức tranh ở góc bảng.
- **Gợi ý thông minh**: chỉ ra các ô đánh dấu sai, hoặc chỉ ra hàng/cột có thể suy luận tiếp và điền giúp 1 ô.
- Tùy chọn hỗ trợ: tự gạch ô thừa, tô sáng hàng & cột, **báo lỗi ngay** (kèm bộ đếm lỗi).
- Hoàn tác / làm lại, xóa bảng, tạm dừng (ẩn bảng), bỏ cuộc kèm lời giải, phóng to bảng trên điện thoại.
- Đánh giá sao, kỷ lục thời gian theo từng mức, hiệu ứng âm thanh, giao diện sáng/tối, hỗ trợ điện thoại.

Phím tắt: `X` đổi công cụ · mũi tên/`WASD` di chuyển ô chọn · `Space`/`Enter` tô ô chọn · `Z`/`Backspace` hoàn tác · `Y`/`Shift+Z` làm lại · `H` gợi ý · `P` tạm dừng · `N` đề mới.

## Cấu trúc

| Đường dẫn | Nội dung |
| --- | --- |
| `src/game/solver.ts` | Bộ giải theo dòng (quy hoạch động trên các cách đặt khối), lặp qua hàng/cột tới điểm dừng; tìm suy luận cho gợi ý. |
| `src/game/generator.ts` | Sinh tranh ngẫu nhiên (có thể đối xứng), lật các ô bộ giải còn phân vân cho tới khi câu đố giải được duy nhất bằng suy luận. |
| `src/game/puzzle.ts` | Kiểu dữ liệu ô, tính gợi ý, đánh dấu số gợi ý đã xong. |
| `src/game/state.ts` | Reducer trạng thái ván chơi, lịch sử hoàn tác, ô bị khóa (lỗi/gợi ý), đồng hồ. |
| `src/game/storage.ts` | Cài đặt và kỷ lục (localStorage). |
| `src/components/` | Giao diện: trang chủ, bàn chơi, HUD, các hộp thoại. |
