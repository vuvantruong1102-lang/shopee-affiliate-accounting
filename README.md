# Tích hợp Global Search vào Dashboard Layout

## Bước 1: Upload file

```
components/global-search/search-provider.tsx        ← MỚI
```

## Bước 2: Tìm file dashboard layout

Vào github.dev → mở file:
```
app/(dashboard)/layout.tsx
```

(Hoặc file có route group bao trùm toàn bộ dashboard. Nếu không có `(dashboard)` thì kiểm tra `app/layout.tsx`.)

## Bước 3: Thêm 2 dòng vào layout

**Trước**:
```tsx
import { ... } from "...";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="...">
      <Sidebar />
      <main>{children}</main>
    </div>
  );
}
```

**Sau** (thêm 2 dòng có dấu `// ✨`):
```tsx
import { ... } from "...";
import { GlobalSearchProvider } from "@/components/global-search/search-provider"; // ✨ MỚI

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="...">
      <Sidebar />
      <main>{children}</main>
      <GlobalSearchProvider /> {/* ✨ MỚI - bắt Ctrl+K toàn cục */}
    </div>
  );
}
```

## Bước 4: Commit + Push

Message: `Phase 12 integrate: add GlobalSearchProvider to dashboard layout`

## Bước 5: Test

1. Vào bất kỳ trang nào trong dashboard
2. Bấm **Ctrl+K** (Windows) hoặc **Cmd+K** (Mac)
3. Modal search hiện ở giữa màn hình
4. Gõ "Trần" → thấy affiliate Trần Văn An
5. Bấm Enter → đi tới trang chi tiết

## Nếu vẫn không thấy modal khi bấm Ctrl+K

1. Mở F12 Console → check có lỗi gì không
2. Check xem file `components/global-search/search-modal.tsx` và `actions.ts` đã upload chưa
3. Check `search-provider.tsx` có được render trong page source không (F12 → Elements → search "GlobalSearchProvider" sẽ không thấy vì invisible, nhưng modal sẽ append vào body khi mở)

## Optional: Thêm nút "🔍 Tìm kiếm Ctrl+K" vào topbar

Nếu muốn có button trực quan:

1. Tìm file `components/layout/topbar.tsx` (hoặc tương tự)
2. Thêm import:
   ```tsx
   import { GlobalSearchTrigger } from "@/components/global-search/search-trigger";
   ```
3. Đặt `<GlobalSearchTrigger />` ở vị trí phù hợp trong header (bên cạnh notification/avatar)

**LƯU Ý**: Nếu dùng `GlobalSearchTrigger` thì **KHÔNG cần** `GlobalSearchProvider` (vì trigger đã tự bắt phím tắt rồi). Tránh dùng cả 2 → modal sẽ mở 2 lần.
