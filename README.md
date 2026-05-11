# Phần mềm Kế toán Affiliate Shopee

Phần mềm quản lý kế toán nội bộ cho hệ thống affiliate Shopee, hỗ trợ theo dõi hoa hồng, tính thuế TNCN, sổ quỹ tiền mặt và ngân hàng.

## ✨ Tính năng

- 📊 **Dashboard tổng quan** với KPI và biểu đồ
- 👥 **Quản lý 10-20+ tài khoản affiliate**
- 💰 **Theo dõi hoa hồng**: gross / 10% thuế / thực nhận
- 🏦 **Sổ quỹ tiền mặt & ngân hàng** với running balance
- 🧾 **Tính thuế TNCN lũy tiến 7 bậc** theo luật Việt Nam
- 📤 **Đối soát với file Shopee** xuất ra
- 📈 **Báo cáo và xuất Excel**
- 🔒 **Phân quyền** Admin / Kế toán / Người xem
- 📝 **Audit log** mọi thay đổi

## 🛠️ Tech Stack

- **Framework**: Next.js 15 (App Router) + React 19
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth
- **Charts**: Recharts
- **Tables**: TanStack Table
- **Forms**: React Hook Form + Zod
- **Excel**: ExcelJS + SheetJS

---

## 🚀 Hướng dẫn cài đặt (lần đầu)

### Bước 1: Cài Node.js

Tải và cài Node.js phiên bản **20 trở lên** từ https://nodejs.org

Kiểm tra:
```bash
node --version  # Phải ≥ v20.0.0
npm --version
```

### Bước 2: Cài dependencies

Mở terminal trong thư mục project, chạy:
```bash
npm install
```

Lệnh này sẽ mất khoảng 2-3 phút lần đầu.

### Bước 3: Tạo project Supabase

1. Truy cập https://supabase.com và đăng ký tài khoản (miễn phí)
2. Bấm **"New Project"**
3. Điền:
   - **Name**: `shopee-affiliate-accounting` (tùy)
   - **Database Password**: ⚠️ Lưu lại mật khẩu này
   - **Region**: chọn **Southeast Asia (Singapore)** cho tốc độ tốt nhất
4. Bấm Create → chờ ~2 phút project khởi tạo

### Bước 4: Chạy SQL Migration

1. Trong Supabase Dashboard, vào menu **SQL Editor** (icon database bên trái)
2. Bấm **"New Query"**
3. Mở file `supabase/migrations/20260511000001_initial_schema.sql` trong project, **copy toàn bộ nội dung**, paste vào SQL Editor, bấm **Run** (góc dưới phải)
4. Đợi báo "Success" → tạo query mới
5. Tiếp tục với file `supabase/migrations/20260511000002_rls_policies.sql` — copy/paste/Run tương tự
6. Kiểm tra: vào **Table Editor**, phải thấy các bảng: `affiliate_accounts`, `commissions`, `cash_transactions`, ...

### Bước 5: Lấy API keys

1. Trong Supabase Dashboard, vào **Settings** → **API**
2. Copy 2 giá trị:
   - **Project URL** (dạng `https://xxxxx.supabase.co`)
   - **anon public** key (dài ~200 ký tự)
3. Vào **Settings** → **API** → cuộn xuống **Project API keys** → copy **service_role** key (KHÔNG share key này)

### Bước 6: Cấu hình biến môi trường

Trong thư mục project, copy file `.env.example` thành `.env.local`:
```bash
cp .env.example .env.local
```

Mở `.env.local` và điền các giá trị từ Bước 5:
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...
NEXT_PUBLIC_APP_NAME="Kế toán Affiliate Shopee"
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Bước 7: Bật Email Auth trên Supabase

1. Trong Supabase Dashboard, vào **Authentication** → **Providers**
2. Đảm bảo **Email** đã được bật
3. **Tắt** "Confirm email" nếu muốn dùng nội bộ ngay (Email Templates → tạm thời disable confirm)
   - Hoặc cấu hình SMTP nếu muốn xác nhận email thật

### Bước 8: Chạy ứng dụng

```bash
npm run dev
```

Mở trình duyệt: http://localhost:3000

Lần đầu sẽ chuyển sang trang **/login**. Bấm "Đăng ký", nhập email + mật khẩu → tài khoản đầu tiên sẽ tự động là **admin**.

---

## 📁 Cấu trúc project

```
shopee-affiliate-accounting/
├── app/                          # Next.js App Router
│   ├── (dashboard)/             # Các trang sau khi login
│   │   ├── dashboard/           # Dashboard chính
│   │   ├── affiliates/          # Quản lý affiliate
│   │   ├── data-entry/          # Nhập liệu hàng ngày
│   │   ├── cash-book/           # Sổ quỹ tiền mặt
│   │   ├── bank-book/           # Sổ ngân hàng
│   │   ├── tax/                 # Thuế TNCN
│   │   ├── reconciliation/      # Đối soát Shopee
│   │   ├── reports/             # Báo cáo
│   │   └── settings/            # Cài đặt
│   ├── login/                   # Trang đăng nhập
│   ├── layout.tsx               # Root layout
│   └── globals.css              # CSS toàn cục
│
├── components/
│   ├── auth/                    # Form đăng nhập
│   ├── layout/                  # Sidebar, Topbar, PageHeader
│   └── ui/                      # shadcn/ui base (Button, Card, ...)
│
├── lib/
│   ├── supabase/                # Supabase clients (server, browser, middleware)
│   ├── tax-calculator.ts        # Tính thuế TNCN theo luật VN
│   └── utils.ts                 # Hàm chung: formatCurrency, cn, ...
│
├── supabase/
│   └── migrations/              # SQL migrations
│       ├── 20260511000001_initial_schema.sql
│       └── 20260511000002_rls_policies.sql
│
├── middleware.ts                # Middleware Next.js (auth)
├── package.json
└── tsconfig.json
```

---

## 🧪 Lệnh thông dụng

```bash
npm run dev        # Chạy dev server (port 3000)
npm run build      # Build production
npm run start      # Chạy production build
npm run typecheck  # Kiểm tra TypeScript
npm run lint       # Lint code
```

---

## 🌍 Deploy lên Vercel (production)

1. Push code lên GitHub (private repo)
2. Vào https://vercel.com, đăng nhập bằng GitHub
3. Bấm **Add New Project** → chọn repo
4. **Environment Variables**: thêm các biến từ `.env.local`
5. Bấm Deploy → có URL production trong ~2 phút

**Lưu ý**: chỉ những email được phép mới đăng ký được vào hệ thống. Để chặn người ngoài đăng ký, ta sẽ thêm chức năng "Mời thành viên" ở giai đoạn sau.

---

## ❓ FAQ

**Q: Tôi quên mật khẩu Supabase database?**
A: Vào Supabase Dashboard → Settings → Database → Reset password.

**Q: Tài khoản đầu tiên có quyền admin tự động phải không?**
A: Đúng. Trigger `handle_new_user()` set user đầu tiên là `admin`, các user sau là `accountant`.

**Q: Làm sao đổi role user?**
A: Tạm thời vào Supabase Table Editor → `user_profiles` → sửa cột `role`. Giai đoạn sau sẽ có UI quản lý user.

**Q: Dữ liệu có được backup không?**
A: Supabase free tier có backup 7 ngày. Pro tier ($25/tháng) có Point-in-Time Recovery. Khuyến nghị export định kỳ ra Excel bằng module Báo cáo.

---

## 📞 Lộ trình phát triển

- ✅ **Giai đoạn 1** (hiện tại): Foundation + Auth + Layout + Database schema
- ⏳ **Giai đoạn 2**: CRUD Affiliate + Form nhập liệu
- ⏳ **Giai đoạn 3**: Dashboard với số liệu thật + Biểu đồ + Báo cáo
- ⏳ **Giai đoạn 4**: Thuế TNCN + Quyết toán năm
- ⏳ **Giai đoạn 5**: Đối soát Shopee + Audit log + Cảnh báo
