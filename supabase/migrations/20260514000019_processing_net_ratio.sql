-- ============================================================================
-- FIX: get_total_assets - cộng Shopee processing dạng Net (× 0.9) thay vì Gross
-- 
-- DB lưu Gross (số copy trực tiếp từ Shopee), nhưng Tổng tài sản cộng Net 
-- (sau thuế 10%) vì đó mới là số tiền thật sự sẽ về tay
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_total_assets();

CREATE OR REPLACE FUNCTION public.get_total_assets()
RETURNS TABLE(
  cash_balance DECIMAL(15, 2),
  bank_balance DECIMAL(15, 2),
  affiliate_holding DECIMAL(15, 2),
  shopee_pending DECIMAL(15, 2),
  shopee_processing DECIMAL(15, 2),
  total_assets DECIMAL(15, 2),
  bank_breakdown JSONB,
  affiliate_breakdown JSONB,
  processing_breakdown JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cash DECIMAL(15, 2);
  v_bank DECIMAL(15, 2);
  v_holding DECIMAL(15, 2);
  v_pending DECIMAL(15, 2);
  v_processing DECIMAL(15, 2);
  v_bank_breakdown JSONB;
  v_affiliate_breakdown JSONB;
  v_processing_breakdown JSONB;
BEGIN
  -- Tiền mặt
  SELECT COALESCE(SUM(
    CASE WHEN trans_type = 'income' THEN amount ELSE -amount END
  ), 0) INTO v_cash
  FROM public.cash_transactions
  WHERE COALESCE(is_deleted, false) = false;

  -- Tiền ngân hàng = opening_balance + sum(transactions)
  WITH bank_opening AS (
    SELECT COALESCE(SUM(opening_balance), 0) AS total
    FROM public.bank_accounts
    WHERE COALESCE(is_deleted, false) = false
  ),
  bank_txns AS (
    SELECT COALESCE(SUM(
      CASE WHEN trans_type = 'income' THEN amount ELSE -amount END
    ), 0) AS total
    FROM public.bank_transactions
    WHERE COALESCE(is_deleted, false) = false
  )
  SELECT (SELECT total FROM bank_opening) + (SELECT total FROM bank_txns) INTO v_bank;

  -- Affiliate đang cầm
  WITH per_affiliate AS (
    SELECT 
      aa.id,
      aa.full_name,
      COALESCE(c.received_total, 0) AS received,
      COALESCE(d.deposited_total, 0) AS deposited,
      COALESCE(c.received_total, 0) - COALESCE(d.deposited_total, 0) AS holding
    FROM public.affiliate_accounts aa
    LEFT JOIN LATERAL (
      SELECT SUM(net_amount) AS received_total
      FROM public.commissions
      WHERE account_id = aa.id 
        AND is_deleted = false 
        AND status = 'received'
    ) c ON true
    LEFT JOIN LATERAL (
      SELECT SUM(amount) AS deposited_total
      FROM public.cash_transactions
      WHERE account_id = aa.id
        AND trans_type = 'income'
        AND COALESCE(is_deleted, false) = false
    ) d ON true
    WHERE aa.is_deleted = false
  )
  SELECT 
    COALESCE(SUM(GREATEST(holding, 0)), 0),
    COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', id, 'name', full_name,
        'received', received, 'deposited', deposited, 'holding', holding
      ) ORDER BY holding DESC
    ) FILTER (WHERE holding > 0), '[]'::jsonb)
  INTO v_holding, v_affiliate_breakdown
  FROM per_affiliate;

  -- Shopee chưa chuyển (đã có sẵn dạng Net trong commissions.net_amount)
  SELECT COALESCE(SUM(net_amount), 0) INTO v_pending
  FROM public.commissions
  WHERE is_deleted = false AND status = 'pending';

  -- ✨ Shopee đang xử lý: DB lưu Gross → KPI tổng dùng Net (× 0.9)
  BEGIN
    SELECT COALESCE(SUM(amount * 0.9), 0) INTO v_processing
    FROM public.shopee_processing_amounts;
  EXCEPTION WHEN undefined_table THEN
    v_processing := 0;
  END;

  -- Processing breakdown - trả về cả Gross và Net để frontend dùng
  BEGIN
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'affiliate_id', aa.id,
        'affiliate_name', aa.full_name,
        'amount', COALESCE(sp.amount, 0),                          -- Gross (raw)
        'amount_net', ROUND(COALESCE(sp.amount, 0) * 0.9),          -- Net (× 0.9)
        'snapshot_date', sp.snapshot_date,
        'updated_at', sp.updated_at,
        'notes', sp.notes
      ) ORDER BY aa.full_name
    ), '[]'::jsonb)
    INTO v_processing_breakdown
    FROM public.affiliate_accounts aa
    LEFT JOIN public.shopee_processing_amounts sp ON sp.affiliate_id = aa.id
    WHERE aa.is_deleted = false
      AND aa.status IN ('active', 'paused');
  EXCEPTION WHEN undefined_table THEN
    v_processing_breakdown := '[]'::jsonb;
  END;

  -- Bank breakdown
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', ba.id,
      'bank_name', ba.bank_name,
      'account_number', ba.account_number,
      'opening_balance', COALESCE(ba.opening_balance, 0),
      'balance', COALESCE(ba.opening_balance, 0) + COALESCE(bt.balance, 0)
    ) ORDER BY ba.bank_name
  ), '[]'::jsonb)
  INTO v_bank_breakdown
  FROM public.bank_accounts ba
  LEFT JOIN LATERAL (
    SELECT SUM(
      CASE WHEN trans_type = 'income' THEN amount ELSE -amount END
    ) AS balance
    FROM public.bank_transactions
    WHERE bank_account_id = ba.id 
      AND COALESCE(is_deleted, false) = false
  ) bt ON true
  WHERE COALESCE(ba.is_deleted, false) = false;

  RETURN QUERY SELECT 
    v_cash,
    v_bank,
    v_holding,
    v_pending,
    v_processing,                                                   -- Đã là Net
    v_cash + v_bank + v_holding + v_pending + v_processing,
    v_bank_breakdown,
    v_affiliate_breakdown,
    v_processing_breakdown;
END;
$$;
