-- ============================================================================
-- PHASE 2 - SETTINGS, RPC FUNCTIONS, TRIGGERS
-- Bổ sung cho Phase 1 schema
-- ============================================================================

-- ============================================================================
-- 1. APP SETTINGS - Cấu hình hệ thống (giữ key-value đơn giản)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view settings" ON public.app_settings
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can manage settings" ON public.app_settings
  FOR ALL USING (public.is_admin());

-- Cấu hình mặc định: TK ngân hàng công ty mặc định (sẽ set sau khi user tạo)
INSERT INTO public.app_settings (key, value, description) VALUES
  ('default_bank_account_id', 'null'::jsonb, 'ID tài khoản ngân hàng công ty mặc định để gom tiền'),
  ('withholding_tax_rate', '0.10'::jsonb, 'Tỷ lệ khấu trừ thuế TNCN tại nguồn (10%)'),
  ('withholding_tax_threshold', '2000000'::jsonb, 'Ngưỡng áp dụng khấu trừ thuế (2tr/lần)')
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- 2. RPC: Tính số dư tiền mặt tại 1 thời điểm
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_cash_balance(at_date DATE DEFAULT CURRENT_DATE)
RETURNS DECIMAL(15, 2)
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(SUM(
    CASE 
      WHEN trans_type = 'income' THEN amount
      WHEN trans_type = 'expense' THEN -amount
      ELSE 0
    END
  ), 0)::DECIMAL(15, 2)
  FROM public.cash_transactions
  WHERE trans_date <= at_date AND is_deleted = false;
$$;

-- ============================================================================
-- 3. RPC: Tính số dư ngân hàng tại 1 thời điểm
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_bank_balance(
  p_bank_account_id UUID,
  at_date DATE DEFAULT CURRENT_DATE
)
RETURNS DECIMAL(15, 2)
LANGUAGE sql
STABLE
AS $$
  SELECT 
    COALESCE((SELECT opening_balance FROM public.bank_accounts WHERE id = p_bank_account_id), 0) +
    COALESCE((
      SELECT SUM(
        CASE 
          WHEN trans_type = 'income' THEN amount
          WHEN trans_type = 'expense' THEN -amount
          ELSE 0
        END
      )
      FROM public.bank_transactions
      WHERE bank_account_id = p_bank_account_id 
        AND trans_date <= at_date 
        AND is_deleted = false
    ), 0)::DECIMAL(15, 2);
$$;

-- ============================================================================
-- 4. RPC: Lấy thống kê tổng quan cho 1 affiliate
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_affiliate_summary(p_account_id UUID)
RETURNS TABLE(
  total_gross DECIMAL(15, 2),
  total_tax_withheld DECIMAL(15, 2),
  total_net DECIMAL(15, 2),
  received_net DECIMAL(15, 2),
  pending_net DECIMAL(15, 2),
  total_withdrawn DECIMAL(15, 2),
  total_deposited DECIMAL(15, 2)
)
LANGUAGE sql
STABLE
AS $$
  WITH commission_stats AS (
    SELECT
      COALESCE(SUM(gross_amount), 0)::DECIMAL(15, 2) AS total_gross,
      COALESCE(SUM(tax_withheld), 0)::DECIMAL(15, 2) AS total_tax,
      COALESCE(SUM(net_amount), 0)::DECIMAL(15, 2) AS total_net,
      COALESCE(SUM(CASE WHEN status = 'received' THEN net_amount ELSE 0 END), 0)::DECIMAL(15, 2) AS received,
      COALESCE(SUM(CASE WHEN status = 'pending' THEN net_amount ELSE 0 END), 0)::DECIMAL(15, 2) AS pending
    FROM public.commissions
    WHERE account_id = p_account_id AND is_deleted = false
  ),
  withdrawal_stats AS (
    SELECT COALESCE(SUM(amount), 0)::DECIMAL(15, 2) AS total
    FROM public.withdrawals
    WHERE account_id = p_account_id AND is_deleted = false
  ),
  deposit_stats AS (
    SELECT COALESCE(SUM(amount), 0)::DECIMAL(15, 2) AS total
    FROM public.cash_transactions
    WHERE account_id = p_account_id 
      AND trans_type = 'income'
      AND is_deleted = false
  )
  SELECT 
    cs.total_gross,
    cs.total_tax,
    cs.total_net,
    cs.received,
    cs.pending,
    ws.total,
    ds.total
  FROM commission_stats cs, withdrawal_stats ws, deposit_stats ds;
$$;

-- ============================================================================
-- 5. TRIGGER: Tự động cập nhật balance_after cho cash_transactions
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_cash_balance_after()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  prev_balance DECIMAL(15, 2);
BEGIN
  -- Lấy số dư của giao dịch gần nhất TRƯỚC giao dịch này
  SELECT COALESCE(balance_after, 0) INTO prev_balance
  FROM public.cash_transactions
  WHERE (trans_date < NEW.trans_date 
         OR (trans_date = NEW.trans_date AND created_at < NEW.created_at))
    AND is_deleted = false
  ORDER BY trans_date DESC, created_at DESC
  LIMIT 1;
  
  -- Tính số dư mới
  NEW.balance_after := COALESCE(prev_balance, 0) + 
    CASE 
      WHEN NEW.trans_type = 'income' THEN NEW.amount
      WHEN NEW.trans_type = 'expense' THEN -NEW.amount
      ELSE 0
    END;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_cash_balance ON public.cash_transactions;
CREATE TRIGGER set_cash_balance
  BEFORE INSERT ON public.cash_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_cash_balance_after();

-- ============================================================================
-- 6. TRIGGER: Tương tự cho bank_transactions
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_bank_balance_after()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  prev_balance DECIMAL(15, 2);
  opening_bal DECIMAL(15, 2);
BEGIN
  SELECT opening_balance INTO opening_bal
  FROM public.bank_accounts WHERE id = NEW.bank_account_id;
  
  SELECT COALESCE(balance_after, opening_bal) INTO prev_balance
  FROM public.bank_transactions
  WHERE bank_account_id = NEW.bank_account_id
    AND (trans_date < NEW.trans_date 
         OR (trans_date = NEW.trans_date AND created_at < NEW.created_at))
    AND is_deleted = false
  ORDER BY trans_date DESC, created_at DESC
  LIMIT 1;
  
  NEW.balance_after := COALESCE(prev_balance, COALESCE(opening_bal, 0)) + 
    CASE 
      WHEN NEW.trans_type = 'income' THEN NEW.amount
      WHEN NEW.trans_type = 'expense' THEN -NEW.amount
      ELSE 0
    END;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_bank_balance ON public.bank_transactions;
CREATE TRIGGER set_bank_balance
  BEFORE INSERT ON public.bank_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_bank_balance_after();
