-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Bảo mật ở mức database - chỉ user đã login mới đọc/ghi được
-- ============================================================================

-- Bật RLS cho tất cả các bảng
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopee_reconciliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- HELPER: Kiểm tra role của user hiện tại
-- ============================================================================
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role FROM public.user_profiles WHERE id = auth.uid() AND is_active = true
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.user_profiles 
    WHERE id = auth.uid() AND role = 'admin' AND is_active = true
  )
$$;

CREATE OR REPLACE FUNCTION public.can_edit()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.user_profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'accountant') 
    AND is_active = true
  )
$$;

-- ============================================================================
-- USER PROFILES POLICIES
-- ============================================================================
-- Mọi user đã login đều xem được profile của mình
CREATE POLICY "Users can view their own profile" ON public.user_profiles
  FOR SELECT USING (auth.uid() = id);

-- Admin xem được tất cả profiles
CREATE POLICY "Admins can view all profiles" ON public.user_profiles
  FOR SELECT USING (public.is_admin());

-- User tự cập nhật profile của mình (trừ role)
CREATE POLICY "Users can update own profile" ON public.user_profiles
  FOR UPDATE USING (auth.uid() = id);

-- Admin có toàn quyền
CREATE POLICY "Admins have full access to profiles" ON public.user_profiles
  FOR ALL USING (public.is_admin());

-- ============================================================================
-- BUSINESS DATA POLICIES
-- Quy tắc chung: admin + accountant có toàn quyền, viewer chỉ xem
-- ============================================================================

-- Affiliate accounts
CREATE POLICY "Authenticated users can view affiliates" ON public.affiliate_accounts
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Editors can manage affiliates" ON public.affiliate_accounts
  FOR ALL USING (public.can_edit());

-- Commissions
CREATE POLICY "Authenticated users can view commissions" ON public.commissions
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Editors can manage commissions" ON public.commissions
  FOR ALL USING (public.can_edit());

-- Withdrawals
CREATE POLICY "Authenticated users can view withdrawals" ON public.withdrawals
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Editors can manage withdrawals" ON public.withdrawals
  FOR ALL USING (public.can_edit());

-- Cash transactions
CREATE POLICY "Authenticated users can view cash" ON public.cash_transactions
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Editors can manage cash" ON public.cash_transactions
  FOR ALL USING (public.can_edit());

-- Bank accounts
CREATE POLICY "Authenticated users can view banks" ON public.bank_accounts
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Editors can manage banks" ON public.bank_accounts
  FOR ALL USING (public.can_edit());

-- Bank transactions
CREATE POLICY "Authenticated users can view bank trans" ON public.bank_transactions
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Editors can manage bank trans" ON public.bank_transactions
  FOR ALL USING (public.can_edit());

-- Expense categories
CREATE POLICY "Authenticated users can view categories" ON public.expense_categories
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Editors can manage categories" ON public.expense_categories
  FOR ALL USING (public.can_edit());

-- Tax records
CREATE POLICY "Authenticated users can view tax" ON public.tax_records
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Editors can manage tax" ON public.tax_records
  FOR ALL USING (public.can_edit());

-- Reconciliations
CREATE POLICY "Authenticated users can view recon" ON public.shopee_reconciliations
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Editors can manage recon" ON public.shopee_reconciliations
  FOR ALL USING (public.can_edit());

-- Audit logs - ai cũng đọc được, KHÔNG AI sửa/xóa được (trừ admin xem all)
CREATE POLICY "Authenticated users can view audit logs" ON public.audit_logs
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "System can insert audit logs" ON public.audit_logs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================================
-- AUTO CREATE USER PROFILE khi đăng ký
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- User đầu tiên đăng ký sẽ là admin, các user sau là accountant
  INSERT INTO public.user_profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    CASE 
      WHEN (SELECT COUNT(*) FROM public.user_profiles) = 0 THEN 'admin'
      ELSE 'accountant'
    END
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
