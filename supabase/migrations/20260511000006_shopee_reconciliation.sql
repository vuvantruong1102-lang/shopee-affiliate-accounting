-- ============================================================================
-- PHASE 4: ĐỐI SOÁT SHOPEE
-- 
-- Mỗi tuần Shopee chuyển tiền hoa hồng 2 lần (Đợt thanh toán).
-- Mỗi đợt gộp nhiều ngày hoa hồng.
-- Mục đích: đối soát tổng tiền Shopee báo vs hoa hồng đã nhập tay.
-- ============================================================================

-- ============================================================================
-- 1. Bảng ĐỢT THANH TOÁN SHOPEE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.shopee_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.affiliate_accounts(id) ON DELETE CASCADE,
  
  -- Mã thanh toán duy nhất từ Shopee (vd: 17393600530260504)
  payment_code TEXT NOT NULL,
  
  -- Ngày tháng
  reconcile_date DATE NOT NULL,           -- Ngày đối soát (vd: 04-05-2026)
  payment_date DATE NOT NULL,             -- Ngày Shopee thực sự chuyển tiền (vd: 07-05-2026)
  
  -- Số tiền (theo file đối soát của Shopee)
  total_gross DECIMAL(15, 2) NOT NULL,    -- Tổng doanh thu hợp lệ
  total_tax DECIMAL(15, 2) NOT NULL DEFAULT 0,  -- Số tiền thuế TNCN (PIT) bị khấu trừ
  total_net DECIMAL(15, 2) NOT NULL,      -- Tổng thanh toán sau thuế
  
  -- Thông tin nhận tiền (optional)
  bank_name TEXT,
  bank_account_last4 TEXT,                -- 4 số cuối TK
  
  -- Trạng thái nhận tiền
  is_received BOOLEAN NOT NULL DEFAULT false,  -- Đã thực nhận vào TK chưa
  
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  
  -- Mã thanh toán phải unique trong cùng 1 affiliate
  UNIQUE(account_id, payment_code)
);

CREATE INDEX IF NOT EXISTS idx_shopee_payments_account 
  ON public.shopee_payments(account_id) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_shopee_payments_date 
  ON public.shopee_payments(payment_date DESC) WHERE is_deleted = false;

-- ============================================================================
-- 2. Bảng CHI TIẾT TỪNG NGÀY trong 1 đợt thanh toán
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.shopee_payment_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES public.shopee_payments(id) ON DELETE CASCADE,
  
  earned_date DATE NOT NULL,              -- Ngày hoa hồng hoàn thành
  gross_amount DECIMAL(15, 2) NOT NULL,   -- Số tiền hoa hồng ngày đó (gross)
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- 1 ngày chỉ xuất hiện 1 lần trong 1 đợt
  UNIQUE(payment_id, earned_date)
);

CREATE INDEX IF NOT EXISTS idx_shopee_payment_days_date 
  ON public.shopee_payment_days(earned_date);

-- ============================================================================
-- 3. RLS Policies
-- ============================================================================
ALTER TABLE public.shopee_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopee_payment_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view shopee_payments" ON public.shopee_payments
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can insert shopee_payments" ON public.shopee_payments
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can update shopee_payments" ON public.shopee_payments
  FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can delete shopee_payments" ON public.shopee_payments
  FOR DELETE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated can view shopee_payment_days" ON public.shopee_payment_days
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can insert shopee_payment_days" ON public.shopee_payment_days
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can update shopee_payment_days" ON public.shopee_payment_days
  FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can delete shopee_payment_days" ON public.shopee_payment_days
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- ============================================================================
-- 4. RPC: Đối soát 1 đợt thanh toán
-- Trả về danh sách ngày với 3 trạng thái: matched / mismatched / missing
-- ============================================================================
CREATE OR REPLACE FUNCTION public.reconcile_shopee_payment(p_payment_id UUID)
RETURNS TABLE(
  earned_date DATE,
  shopee_gross DECIMAL(15, 2),
  manual_gross DECIMAL(15, 2),
  difference DECIMAL(15, 2),
  status TEXT,
  commission_id UUID
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_account_id UUID;
BEGIN
  -- Lấy account_id của đợt thanh toán
  SELECT sp.account_id INTO v_account_id
  FROM public.shopee_payments sp
  WHERE sp.id = p_payment_id;

  RETURN QUERY
  SELECT
    spd.earned_date,
    spd.gross_amount AS shopee_gross,
    COALESCE(c.gross_amount, 0)::DECIMAL(15, 2) AS manual_gross,
    (spd.gross_amount - COALESCE(c.gross_amount, 0))::DECIMAL(15, 2) AS difference,
    CASE
      WHEN c.id IS NULL THEN 'missing'
      WHEN ABS(spd.gross_amount - c.gross_amount) < 1 THEN 'matched'
      ELSE 'mismatched'
    END AS status,
    c.id AS commission_id
  FROM public.shopee_payment_days spd
  LEFT JOIN public.commissions c
    ON c.account_id = v_account_id
    AND c.earned_date = spd.earned_date
    AND c.is_deleted = false
  WHERE spd.payment_id = p_payment_id
  ORDER BY spd.earned_date ASC;
END;
$$;

-- ============================================================================
-- 5. RPC: Thống kê tổng quan đối soát của 1 affiliate
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_reconciliation_summary(p_account_id UUID)
RETURNS TABLE(
  total_payments BIGINT,            -- Tổng số đợt thanh toán
  total_received BIGINT,            -- Số đợt đã nhận
  total_pending BIGINT,             -- Số đợt chưa nhận
  total_gross_received DECIMAL(15, 2),
  total_gross_pending DECIMAL(15, 2),
  total_net_received DECIMAL(15, 2),
  total_net_pending DECIMAL(15, 2)
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    COUNT(*)::BIGINT AS total_payments,
    COUNT(*) FILTER (WHERE is_received = true)::BIGINT,
    COUNT(*) FILTER (WHERE is_received = false)::BIGINT,
    COALESCE(SUM(total_gross) FILTER (WHERE is_received = true), 0)::DECIMAL(15, 2),
    COALESCE(SUM(total_gross) FILTER (WHERE is_received = false), 0)::DECIMAL(15, 2),
    COALESCE(SUM(total_net) FILTER (WHERE is_received = true), 0)::DECIMAL(15, 2),
    COALESCE(SUM(total_net) FILTER (WHERE is_received = false), 0)::DECIMAL(15, 2)
  FROM public.shopee_payments
  WHERE account_id = p_account_id AND is_deleted = false;
$$;
