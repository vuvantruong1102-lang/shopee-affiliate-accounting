import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Construction } from "lucide-react";

export default function Page() {
  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Nhập liệu hàng ngày"
        description="Ghi nhận hoa hồng, rút tiền, nộp tiền và chi tiêu"
      />
      <Card>
        <CardContent className="py-16 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-4">
            <Construction className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">Module đang được phát triển</p>
          <p className="text-xs text-muted-foreground mt-1">
            Sẽ có trong giai đoạn tiếp theo
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
