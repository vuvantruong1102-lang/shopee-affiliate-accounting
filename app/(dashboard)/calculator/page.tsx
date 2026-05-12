import { PageHeader } from "@/components/layout/page-header";
import { CalculatorForm } from "@/components/calculator/calculator-form";

export default function CalculatorPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Tính toán"
        description="Ước tính sơ bộ thuế TNCN và lợi nhuận dự kiến (Luật 2026)"
      />
      <CalculatorForm />
    </div>
  );
}
