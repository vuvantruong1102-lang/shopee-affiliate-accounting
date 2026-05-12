-- ============================================================================
-- PHASE 6: AUDIT LOG + DASHBOARD ALERTS
-- ============================================================================

-- ============================================================================
-- 1. Bảng AUDIT LOG
-- Ghi lại mọi thay đổi quan trọng: create, update, delete
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Người thực hiện
  user_id UUID REFERENCES auth.users(id),
  user_email TEXT,
  
  -- Hành động
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete', 'restore')),
  table_name TEXT NOT NULL,         -- VD: 'commissions', 'cash_transactions'
  record_id UUID,                   -- ID của record bị tác động
  
  -- Diễn giải dễ đọc (đã được render sẵn cho UI)
  description TEXT NOT NULL,        -- VD: "Sửa hoa hồng 5.000.000đ → 4.500.000đ của Trần Văn An"
  
  -- Chi tiết thay đổi (JSON)
  old_values JSONB,                 -- Giá trị trước khi sửa (cho update/delete)
  new_values JSONB,                 -- Giá trị mới (cho create/update)
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_created 
  ON public.audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_user 
  ON public.audit_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_table 
  ON public.audit_log(table_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_record 
  ON public.audit_log(record_id) WHERE record_id IS NOT NULL;

-- RLS: chỉ user đã đăng nhập đọc được, không ai sửa/xóa được
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view audit_log" ON public.audit_log
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can insert audit_log" ON public.audit_log
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
-- KHÔNG có policy UPDATE/DELETE → audit log là immutable

-- ============================================================================
-- 2. RPC: Helper insert audit log
-- ============================================================================
CREATE OR REPLACE FUNCTION public.log_audit(
  p_action TEXT,
  p_table_name TEXT,
  p_record_id UUID,
  p_description TEXT,
  p_old_values JSONB DEFAULT NULL,
  p_new_values JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_user_email TEXT;
  v_id UUID;
BEGIN
  v_user_id := auth.uid();
  
  -- Lấy email user
  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;
  
  INSERT INTO public.audit_log (
    user_id, user_email, action, table_name, record_id,
    description, old_values, new_values
  )
  VALUES (
    v_user_id, v_user_email, p_action, p_table_name, p_record_id,
    p_description, p_old_values, p_new_values
  )
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$;

-- ============================================================================
-- 3. RPC: Dashboard alerts
-- Trả về các cảnh báo cần lưu ý
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_dashboard_alerts()
RETURNS TABLE(
  alert_type TEXT,
  severity TEXT,
  title TEXT,
  description TEXT,
  affiliate_id UUID,
  affiliate_name TEXT,
  amount DECIMAL(15, 2),
  count_value INTEGER,
  link_url TEXT
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  
  -- ===========================================================================
  -- ALERT 1: Affiliate có hoa hồng "received" nhưng chưa nộp vào công ty
  -- (đã nhận về TK cá nhân > đã nộp vào TK công ty)
  -- ===========================================================================
  SELECT
    'undeposited'::TEXT AS alert_type,
    CASE 
      WHEN undeposited > 50000000 THEN 'high'
      WHEN undeposited > 10000000 THEN 'medium'
      ELSE 'low'
    END::TEXT AS severity,
    'Đang cầm tiền của công ty'::TEXT AS title,
    (aa.full_name || ' đã nhận ' || to_char(undeposited, 'FM999,999,999') || 'đ nhưng chưa nộp')::TEXT AS description,
    aa.id AS affiliate_id,
    aa.full_name AS affiliate_name,
    undeposited AS amount,
    NULL::INTEGER AS count_value,
    ('/affiliates/' || aa.id)::TEXT AS link_url
  FROM (
    SELECT
      aa.id,
      aa.full_name,
      COALESCE(SUM(CASE WHEN c.status = 'received' THEN c.net_amount ELSE 0 END), 0) -
      COALESCE((
        SELECT SUM(bt.amount)
        FROM public.bank_transactions bt
        WHERE bt.account_id = aa.id 
          AND bt.trans_type = 'income'
          AND bt.is_deleted = false
      ), 0) AS undeposited
    FROM public.affiliate_accounts aa
    LEFT JOIN public.commissions c ON c.account_id = aa.id AND c.is_deleted = false
    WHERE aa.is_deleted = false AND aa.status = 'active'
    GROUP BY aa.id, aa.full_name
  ) aa
  WHERE aa.undeposited > 1000000  -- chỉ cảnh báo nếu > 1tr
  
  UNION ALL
  
  -- ===========================================================================
  -- ALERT 2: Hoa hồng pending quá 7 ngày (chưa nhận tiền về)
  -- ===========================================================================
  SELECT
    'pending_commission'::TEXT,
    CASE 
      WHEN EXTRACT(DAY FROM NOW() - MIN(c.earned_date)) > 14 THEN 'high'
      ELSE 'medium'
    END::TEXT,
    'Hoa hồng chậm về'::TEXT,
    (aa.full_name || ': ' || COUNT(c.id) || ' đợt pending, tổng ' || 
     to_char(SUM(c.net_amount), 'FM999,999,999') || 'đ, đợt cũ nhất ' ||
     EXTRACT(DAY FROM NOW() - MIN(c.earned_date))::INTEGER || ' ngày')::TEXT,
    aa.id,
    aa.full_name,
    SUM(c.net_amount)::DECIMAL(15, 2),
    COUNT(c.id)::INTEGER,
    ('/affiliates/' || aa.id)::TEXT
  FROM public.affiliate_accounts aa
  JOIN public.commissions c ON c.account_id = aa.id
  WHERE c.status = 'pending' 
    AND c.is_deleted = false
    AND aa.is_deleted = false
    AND c.earned_date < NOW() - INTERVAL '7 days'
  GROUP BY aa.id, aa.full_name
  
  UNION ALL
  
  -- ===========================================================================
  -- ALERT 3: Đợt Shopee chưa đối soát (chưa đánh dấu received)
  -- ===========================================================================
  SELECT
    'unreconciled'::TEXT,
    CASE 
      WHEN EXTRACT(DAY FROM NOW() - MIN(sp.payment_date)) > 5 THEN 'high'
      ELSE 'medium'
    END::TEXT,
    'Đợt thanh toán chưa đánh dấu nhận'::TEXT,
    (aa.full_name || ': ' || COUNT(sp.id) || ' đợt chưa đánh dấu, tổng ' || 
     to_char(SUM(sp.total_net), 'FM999,999,999') || 'đ')::TEXT,
    aa.id,
    aa.full_name,
    SUM(sp.total_net)::DECIMAL(15, 2),
    COUNT(sp.id)::INTEGER,
    '/reconciliation'::TEXT
  FROM public.affiliate_accounts aa
  JOIN public.shopee_payments sp ON sp.account_id = aa.id
  WHERE sp.is_received = false 
    AND sp.is_deleted = false
    AND aa.is_deleted = false
  GROUP BY aa.id, aa.full_name;
END;
$$;

-- ============================================================================
-- 4. RPC: Thống kê 12 tháng gần đây cho dashboard chart
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_monthly_revenue_trend()
RETURNS TABLE(
  year_month TEXT,
  total_gross DECIMAL(15, 2),
  total_net DECIMAL(15, 2),
  total_tax DECIMAL(15, 2),
  commission_count BIGINT
)
LANGUAGE sql
STABLE
AS $$
  WITH months AS (
    SELECT 
      EXTRACT(YEAR FROM d)::INT AS y,
      EXTRACT(MONTH FROM d)::INT AS m
    FROM generate_series(
      date_trunc('month', NOW() - INTERVAL '11 months'),
      date_trunc('month', NOW()),
      INTERVAL '1 month'
    ) d
  )
  SELECT
    LPAD(m.m::TEXT, 2, '0') || '/' || m.y::TEXT AS year_month,
    COALESCE(SUM(c.gross_amount), 0)::DECIMAL(15, 2),
    COALESCE(SUM(c.net_amount), 0)::DECIMAL(15, 2),
    COALESCE(SUM(c.tax_withheld), 0)::DECIMAL(15, 2),
    COUNT(c.id)::BIGINT
  FROM months m
  LEFT JOIN public.commissions c 
    ON c.period_year = m.y 
    AND c.period_month = m.m
    AND c.is_deleted = false
  GROUP BY m.y, m.m
  ORDER BY m.y, m.m;
$$;

-- ============================================================================
-- 5. RPC: Top affiliate theo doanh thu trong khoảng thời gian
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_top_affiliates(
  p_from_date DATE,
  p_to_date DATE,
  p_limit INT DEFAULT 5
)
RETURNS TABLE(
  affiliate_id UUID,
  affiliate_name TEXT,
  total_gross DECIMAL(15, 2),
  total_net DECIMAL(15, 2),
  commission_count BIGINT
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    aa.id,
    aa.full_name,
    COALESCE(SUM(c.gross_amount), 0)::DECIMAL(15, 2),
    COALESCE(SUM(c.net_amount), 0)::DECIMAL(15, 2),
    COUNT(c.id)::BIGINT
  FROM public.affiliate_accounts aa
  LEFT JOIN public.commissions c 
    ON c.account_id = aa.id
    AND c.earned_date BETWEEN p_from_date AND p_to_date
    AND c.is_deleted = false
  WHERE aa.is_deleted = false
  GROUP BY aa.id, aa.full_name
  HAVING COUNT(c.id) > 0
  ORDER BY SUM(c.gross_amount) DESC NULLS LAST
  LIMIT p_limit;
$$;
