-- ============================================================================
-- SHOPEE AFFILIATE ACCOUNTING - DATABASE SCHEMA
-- Version: 1.0.0
-- Description: Schema đầy đủ cho phần mềm kế toán affiliate Shopee
-- ============================================================================

-- Extensions cần thiết
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. USERS & ROLES (Người dùng phần mềm - khác với affiliate)
-- ============================================================================
-- Supabase auth.users đã có sẵn, ta tạo bảng profile mở rộng
CREATE TABLE public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'accountant' CHECK (role IN ('admin', 'accountant', 'viewer')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.user_profiles IS 'Profile mở rộng cho người dùng hệ thống (admin/kế toán)';
COMMENT ON COLUMN public.user_profiles.role IS 'admin: toàn quyền, accountant: nhập liệu + xem, viewer: chỉ xem';

-- ============================================================================
-- 2. AFFILIATE ACCOUNTS (Tài khoản affiliate Shopee - người đứng tên)
-- ============================================================================
CREATE TABLE public.affiliate_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Thông tin cá nhân
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  cccd TEXT,                          -- CCCD/CMND
  tax_code TEXT,                      -- MST cá nhân
  date_of_birth DATE,
  address TEXT,
  
  -- Thông tin tài khoản ngân hàng cá nhân (TK Shopee chuyển về)
  bank_name TEXT,
  bank_account_number TEXT,
  bank_account_holder TEXT,
  
  -- Thông tin Shopee
  shopee_account_email TEXT,          -- Email đăng ký Shopee Affiliate
  shopee_affiliate_id TEXT,           -- ID affiliate trên Shopee (nếu có)
  
  -- Thông tin tính thuế
  has_personal_deduction BOOLEAN NOT NULL DEFAULT true,  -- Có giảm trừ bản thân không
  dependent_count INTEGER NOT NULL DEFAULT 0,            -- Số người phụ thuộc
  
  -- Tài liệu đính kèm (URL trên Supabase Storage)
  cccd_front_url TEXT,
  cccd_back_url TEXT,
  
  -- Trạng thái
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'closed')),
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  notes TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  is_deleted BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX idx_affiliate_status ON public.affiliate_accounts(status) WHERE is_deleted = false;
CREATE INDEX idx_affiliate_email ON public.affiliate_accounts(email);

COMMENT ON TABLE public.affiliate_accounts IS 'Danh sách người đứng tên cho mỗi tài khoản affiliate Shopee';
COMMENT ON COLUMN public.affiliate_accounts.dependent_count IS 'Số người phụ thuộc - dùng tính giảm trừ gia cảnh khi quyết toán thuế';

-- ============================================================================
-- 3. COMMISSIONS (Hoa hồng - mỗi đợt Shopee chốt)
-- ============================================================================
CREATE TABLE public.commissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES public.affiliate_accounts(id),
  
  -- Thời gian
  period_month INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  period_year INTEGER NOT NULL CHECK (period_year BETWEEN 2020 AND 2100),
  earned_date DATE NOT NULL,           -- Ngày Shopee chốt hoa hồng
  received_date DATE,                  -- Ngày tiền về TK cá nhân (NULL nếu chưa nhận)
  
  -- 3 con số quan trọng (lưu ý: DECIMAL chứ không phải FLOAT)
  gross_amount DECIMAL(15, 2) NOT NULL CHECK (gross_amount >= 0),    -- Hoa hồng Shopee tính (trước thuế)
  tax_withheld DECIMAL(15, 2) NOT NULL DEFAULT 0 CHECK (tax_withheld >= 0),  -- Shopee khấu trừ 10%
  net_amount DECIMAL(15, 2) NOT NULL CHECK (net_amount >= 0),       -- Thực nhận (= gross - tax_withheld)
  
  -- Trạng thái
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'received', 'cancelled', 'adjusted')),
  
  -- Chi tiết
  description TEXT,
  shopee_order_id TEXT,                -- ID đơn hàng Shopee (nếu cụ thể)
  attachment_url TEXT,                 -- Ảnh chụp màn hình Shopee dashboard
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  
  -- Constraint: net_amount phải bằng gross - tax_withheld (cho phép sai số 1 đồng do làm tròn)
  CONSTRAINT check_amount_consistency 
    CHECK (ABS(net_amount - (gross_amount - tax_withheld)) < 1)
);

CREATE INDEX idx_commission_account ON public.commissions(account_id);
CREATE INDEX idx_commission_period ON public.commissions(period_year, period_month);
CREATE INDEX idx_commission_status ON public.commissions(status) WHERE is_deleted = false;
CREATE INDEX idx_commission_earned_date ON public.commissions(earned_date DESC);

COMMENT ON TABLE public.commissions IS 'Hoa hồng từ Shopee - lưu 3 con số: gross, tax_withheld (10%), net';
COMMENT ON COLUMN public.commissions.tax_withheld IS '10% thuế TNCN Shopee đã khấu trừ tại nguồn (TT 111/2013)';

-- ============================================================================
-- 4. WITHDRAWALS (Rút tiền mặt từ TK cá nhân)
-- ============================================================================
CREATE TABLE public.withdrawals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES public.affiliate_accounts(id),
  
  withdraw_date DATE NOT NULL,
  amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
  
  method TEXT NOT NULL DEFAULT 'atm' CHECK (method IN ('atm', 'counter', 'transfer', 'other')),
  description TEXT,
  evidence_url TEXT,                   -- Ảnh biên lai rút tiền
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  is_deleted BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX idx_withdrawal_account ON public.withdrawals(account_id);
CREATE INDEX idx_withdrawal_date ON public.withdrawals(withdraw_date DESC);

COMMENT ON TABLE public.withdrawals IS 'Mỗi lần affiliate rút tiền mặt từ TK ngân hàng cá nhân';

-- ============================================================================
-- 5. CASH BOOK (Sổ quỹ tiền mặt)
-- ============================================================================
CREATE TABLE public.cash_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  trans_date DATE NOT NULL,
  trans_type TEXT NOT NULL CHECK (trans_type IN ('income', 'expense')),
  
  amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
  description TEXT NOT NULL,
  
  -- Liên kết: nếu là nộp tiền từ affiliate vào sổ quỹ
  account_id UUID REFERENCES public.affiliate_accounts(id),
  depositor_name TEXT,                 -- Tên người nộp/nhận (có thể khác affiliate)
  
  -- Liên kết: nếu là chi tiêu, gắn với category
  expense_category_id UUID,            -- FK đến expense_categories (sẽ thêm)
  
  -- Số dư sau giao dịch (tính tự động bằng trigger)
  balance_after DECIMAL(15, 2),
  
  attachment_url TEXT,
  notes TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  is_deleted BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX idx_cash_date ON public.cash_transactions(trans_date DESC);
CREATE INDEX idx_cash_account ON public.cash_transactions(account_id) WHERE account_id IS NOT NULL;
CREATE INDEX idx_cash_type ON public.cash_transactions(trans_type);

COMMENT ON TABLE public.cash_transactions IS 'Sổ quỹ tiền mặt - mọi giao dịch thu/chi tiền mặt';

-- ============================================================================
-- 6. BANK BOOK (Sổ quỹ ngân hàng công ty)
-- ============================================================================
CREATE TABLE public.bank_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bank_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  account_holder TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'VND',
  opening_balance DECIMAL(15, 2) NOT NULL DEFAULT 0,
  opening_date DATE NOT NULL DEFAULT CURRENT_DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.bank_accounts IS 'Danh sách TK ngân hàng công ty (đầu mối gom tiền)';

CREATE TABLE public.bank_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bank_account_id UUID NOT NULL REFERENCES public.bank_accounts(id),
  
  trans_date DATE NOT NULL,
  trans_type TEXT NOT NULL CHECK (trans_type IN ('income', 'expense')),
  
  amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
  description TEXT NOT NULL,
  
  -- Tham chiếu: nếu thu là từ nộp tiền mặt
  cash_transaction_id UUID REFERENCES public.cash_transactions(id),
  
  -- Tham chiếu: nếu chi là theo khoản mục
  expense_category_id UUID,
  
  counterparty_name TEXT,              -- Tên đối tác (bên chuyển/nhận)
  counterparty_bank TEXT,
  reference_no TEXT,                   -- Số tham chiếu giao dịch ngân hàng
  
  balance_after DECIMAL(15, 2),
  attachment_url TEXT,
  notes TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  is_deleted BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX idx_bank_trans_date ON public.bank_transactions(trans_date DESC);
CREATE INDEX idx_bank_trans_account ON public.bank_transactions(bank_account_id);
CREATE INDEX idx_bank_trans_type ON public.bank_transactions(trans_type);

COMMENT ON TABLE public.bank_transactions IS 'Sổ ngân hàng - thu/chi qua TK ngân hàng công ty';

-- ============================================================================
-- 7. EXPENSE CATEGORIES (Khoản mục chi phí)
-- ============================================================================
CREATE TABLE public.expense_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('operating', 'marketing', 'salary', 'tax', 'other')),
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.expense_categories IS 'Khoản mục chi - phân loại chi phí cho báo cáo';

-- Thêm FK sau khi bảng tồn tại
ALTER TABLE public.cash_transactions 
  ADD CONSTRAINT fk_cash_expense_category 
  FOREIGN KEY (expense_category_id) REFERENCES public.expense_categories(id);

ALTER TABLE public.bank_transactions 
  ADD CONSTRAINT fk_bank_expense_category 
  FOREIGN KEY (expense_category_id) REFERENCES public.expense_categories(id);

-- ============================================================================
-- 8. TAX RECORDS (Hồ sơ thuế TNCN - tính theo năm)
-- ============================================================================
CREATE TABLE public.tax_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES public.affiliate_accounts(id),
  tax_year INTEGER NOT NULL CHECK (tax_year BETWEEN 2020 AND 2100),
  
  -- Tổng hợp cả năm
  total_gross_income DECIMAL(15, 2) NOT NULL DEFAULT 0,        -- Tổng hoa hồng gross cả năm
  total_tax_withheld DECIMAL(15, 2) NOT NULL DEFAULT 0,        -- Tổng 10% Shopee đã khấu trừ
  
  -- Giảm trừ
  personal_deduction DECIMAL(15, 2) NOT NULL DEFAULT 132000000,  -- 11tr x 12 tháng
  dependent_deduction DECIMAL(15, 2) NOT NULL DEFAULT 0,         -- 4.4tr x 12 tháng x số người
  
  -- Tính toán
  taxable_income DECIMAL(15, 2) NOT NULL DEFAULT 0,            -- Thu nhập tính thuế
  tax_payable DECIMAL(15, 2) NOT NULL DEFAULT 0,               -- Thuế phải nộp theo lũy tiến
  tax_difference DECIMAL(15, 2) NOT NULL DEFAULT 0,            -- = tax_payable - total_tax_withheld
                                                                -- > 0: phải nộp thêm, < 0: được hoàn
  
  -- Trạng thái quyết toán
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'finalized', 'submitted')),
  finalized_at TIMESTAMPTZ,
  
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(account_id, tax_year)
);

CREATE INDEX idx_tax_account ON public.tax_records(account_id);
CREATE INDEX idx_tax_year ON public.tax_records(tax_year);

COMMENT ON TABLE public.tax_records IS 'Quyết toán thuế TNCN theo năm cho mỗi affiliate';

-- ============================================================================
-- 9. SHOPEE RECONCILIATION (Đối soát file Shopee)
-- ============================================================================
CREATE TABLE public.shopee_reconciliations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES public.affiliate_accounts(id),
  
  import_batch_id UUID NOT NULL,       -- Group các dòng import cùng 1 file
  import_date DATE NOT NULL,
  source_file_name TEXT,
  
  -- Dữ liệu từ file Shopee
  shopee_period TEXT,                  -- Tháng/kỳ trên file Shopee
  shopee_gross DECIMAL(15, 2) NOT NULL,
  shopee_tax DECIMAL(15, 2) NOT NULL DEFAULT 0,
  shopee_net DECIMAL(15, 2) NOT NULL,
  
  -- Dữ liệu trong hệ thống (đối chiếu)
  system_commission_id UUID REFERENCES public.commissions(id),
  system_gross DECIMAL(15, 2),
  system_net DECIMAL(15, 2),
  
  -- Chênh lệch
  gross_difference DECIMAL(15, 2),
  net_difference DECIMAL(15, 2),
  
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'matched', 'unmatched', 'resolved')),
  resolution_note TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX idx_recon_account ON public.shopee_reconciliations(account_id);
CREATE INDEX idx_recon_batch ON public.shopee_reconciliations(import_batch_id);
CREATE INDEX idx_recon_status ON public.shopee_reconciliations(status);

COMMENT ON TABLE public.shopee_reconciliations IS 'Đối soát số liệu từ file Excel Shopee với dữ liệu hệ thống';

-- ============================================================================
-- 10. AUDIT LOG (Lịch sử thay đổi - bắt buộc với phần mềm tài chính)
-- ============================================================================
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  user_email TEXT,
  
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete', 'restore')),
  entity_type TEXT NOT NULL,           -- 'commission', 'affiliate', 'cash_transaction', etc
  entity_id UUID NOT NULL,
  
  before_data JSONB,                   -- Dữ liệu trước khi thay đổi
  after_data JSONB,                    -- Dữ liệu sau khi thay đổi
  
  ip_address INET,
  user_agent TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_user ON public.audit_logs(user_id);
CREATE INDEX idx_audit_date ON public.audit_logs(created_at DESC);

COMMENT ON TABLE public.audit_logs IS 'Ghi lại MỌI thay đổi dữ liệu - phục vụ kiểm toán';

-- ============================================================================
-- TRIGGERS - Tự động cập nhật updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Áp dụng cho tất cả các bảng có updated_at
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN 
    SELECT table_name FROM information_schema.columns 
    WHERE table_schema = 'public' AND column_name = 'updated_at'
  LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS set_updated_at ON public.%I;
      CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    ', t, t);
  END LOOP;
END $$;

-- ============================================================================
-- SEED DATA - Dữ liệu mẫu khoản mục chi phí
-- ============================================================================
INSERT INTO public.expense_categories (name, type, display_order) VALUES
  ('Lương nhân viên', 'salary', 1),
  ('Thưởng/Hoa hồng nội bộ', 'salary', 2),
  ('Marketing Facebook Ads', 'marketing', 10),
  ('Marketing Google Ads', 'marketing', 11),
  ('Mua content/sản phẩm', 'marketing', 12),
  ('Tiền điện', 'operating', 20),
  ('Tiền nước', 'operating', 21),
  ('Tiền internet', 'operating', 22),
  ('Thuê văn phòng', 'operating', 23),
  ('Văn phòng phẩm', 'operating', 24),
  ('Thuế TNCN', 'tax', 30),
  ('Phí ngân hàng', 'operating', 40),
  ('Chi khác', 'other', 99)
ON CONFLICT (name) DO NOTHING;
