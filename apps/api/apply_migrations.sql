-- Apply migrations 016 through 022
-- Current state: 015_user_alerts

BEGIN;

-- ════════════════════════════════════════════════════════
-- 016 — Watchlists
-- ════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS user_watchlists (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    asset_type VARCHAR(20) NOT NULL,
    symbol VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL DEFAULT '',
    display_order INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    target_price FLOAT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_watchlist_user_asset_symbol ON user_watchlists(user_id, asset_type, symbol);
CREATE INDEX IF NOT EXISTS ix_watchlist_user_order ON user_watchlists(user_id, display_order);

-- ════════════════════════════════════════════════════════
-- 017 — Retirement
-- ════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS retirement_profiles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    birth_year INTEGER NOT NULL,
    target_retirement_age INTEGER NOT NULL DEFAULT 64,
    current_monthly_income BIGINT NOT NULL DEFAULT 0,
    current_monthly_expenses BIGINT NOT NULL DEFAULT 0,
    monthly_savings BIGINT NOT NULL DEFAULT 0,
    pension_estimate_monthly BIGINT,
    pension_quarters_acquired INTEGER NOT NULL DEFAULT 0,
    target_lifestyle_pct FLOAT NOT NULL DEFAULT 80.0,
    inflation_rate_pct FLOAT NOT NULL DEFAULT 2.0,
    life_expectancy INTEGER NOT NULL DEFAULT 90,
    include_real_estate BOOLEAN NOT NULL DEFAULT true,
    asset_returns JSONB NOT NULL DEFAULT '{}'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_retirement_profiles_user_id ON retirement_profiles(user_id);

-- ════════════════════════════════════════════════════════
-- 018 — Heritage
-- ════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS heritage_simulations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    marital_regime VARCHAR(32) NOT NULL DEFAULT 'communaute',
    heirs JSONB NOT NULL DEFAULT '[]',
    life_insurance_before_70 BIGINT NOT NULL DEFAULT 0,
    life_insurance_after_70 BIGINT NOT NULL DEFAULT 0,
    donation_history JSONB NOT NULL DEFAULT '[]',
    include_real_estate BOOLEAN NOT NULL DEFAULT true,
    include_life_insurance BOOLEAN NOT NULL DEFAULT true,
    custom_patrimoine_override BIGINT,
    last_simulation_result JSONB,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_heritage_simulations_user_id ON heritage_simulations(user_id);

-- ════════════════════════════════════════════════════════
-- 019 — Fee Negotiator
-- ════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS bank_fee_schedules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    bank_slug VARCHAR(64) NOT NULL UNIQUE,
    bank_name VARCHAR(128) NOT NULL,
    is_online BOOLEAN NOT NULL DEFAULT false,
    fee_account_maintenance BIGINT NOT NULL DEFAULT 0,
    fee_card_classic BIGINT NOT NULL DEFAULT 0,
    fee_card_premium BIGINT NOT NULL DEFAULT 0,
    fee_card_international BIGINT NOT NULL DEFAULT 0,
    fee_overdraft_commission BIGINT NOT NULL DEFAULT 0,
    fee_transfer_sepa BIGINT NOT NULL DEFAULT 0,
    fee_transfer_intl BIGINT NOT NULL DEFAULT 0,
    fee_check BIGINT NOT NULL DEFAULT 0,
    fee_insurance_card BIGINT NOT NULL DEFAULT 0,
    fee_reject BIGINT NOT NULL DEFAULT 0,
    fee_atm_other_bank BIGINT NOT NULL DEFAULT 0,
    metadata JSONB NOT NULL DEFAULT '{}',
    valid_from DATE NOT NULL DEFAULT current_date,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fee_analyses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    total_fees_annual BIGINT NOT NULL DEFAULT 0,
    fees_by_type JSONB NOT NULL DEFAULT '{}',
    monthly_breakdown JSONB NOT NULL DEFAULT '[]',
    best_alternative_slug VARCHAR(64),
    best_alternative_saving BIGINT NOT NULL DEFAULT 0,
    top_alternatives JSONB NOT NULL DEFAULT '[]',
    overcharge_score INTEGER NOT NULL DEFAULT 50,
    negotiation_status VARCHAR(32) NOT NULL DEFAULT 'none',
    negotiation_letter TEXT,
    negotiation_sent_at TIMESTAMPTZ,
    negotiation_result_amount BIGINT NOT NULL DEFAULT 0,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_fee_analyses_user_id ON fee_analyses(user_id);

-- Seed bank fee data
INSERT INTO bank_fee_schedules (bank_slug, bank_name, is_online, fee_account_maintenance, fee_card_classic, fee_card_premium, fee_card_international, fee_overdraft_commission, fee_transfer_sepa, fee_transfer_intl, fee_check, fee_insurance_card, fee_reject, fee_atm_other_bank) VALUES
('boursorama', 'Boursorama Banque', true, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
('fortuneo', 'Fortuneo', true, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
('hello_bank', 'Hello Bank', true, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
('boursobank', 'BoursoBank', true, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
('ing', 'ING', true, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
('monabanq', 'Monabanq', true, 0, 2400, 7200, 0, 0, 0, 0, 0, 0, 0, 0),
('orange_bank', 'Orange Bank', true, 0, 0, 5988, 0, 0, 0, 0, 0, 0, 0, 0),
('n26', 'N26', true, 0, 0, 11880, 0, 0, 0, 0, 0, 0, 0, 0),
('revolut', 'Revolut', true, 0, 0, 9588, 0, 0, 0, 0, 0, 0, 0, 0),
('axa_banque', 'AXA Banque', true, 0, 0, 9000, 0, 0, 0, 0, 0, 0, 0, 0),
('sg', 'Société Générale', false, 2400, 4500, 13200, 1200, 9600, 0, 350, 0, 2400, 2000, 100),
('bnp', 'BNP Paribas', false, 2100, 4200, 12600, 1200, 9600, 0, 350, 0, 2400, 2000, 100),
('credit_agricole', 'Crédit Agricole', false, 2280, 4200, 12000, 1000, 9600, 0, 300, 0, 2200, 2000, 100),
('lcl', 'LCL', false, 2160, 4200, 12000, 1000, 9600, 0, 350, 0, 2400, 2000, 100),
('credit_mutuel', 'Crédit Mutuel', false, 1800, 3900, 11400, 1000, 9600, 0, 300, 0, 2200, 2000, 100),
('la_banque_postale', 'La Banque Postale', false, 1800, 3000, 9600, 800, 8280, 0, 300, 0, 2000, 1600, 100),
('hsbc', 'HSBC France', false, 3000, 4800, 14400, 1500, 9600, 0, 400, 0, 2800, 2000, 100),
('cic', 'CIC', false, 2160, 4200, 12000, 1000, 9600, 0, 350, 0, 2400, 2000, 100),
('banque_populaire', 'Banque Populaire', false, 2400, 4500, 12600, 1200, 9600, 0, 350, 0, 2400, 2000, 100),
('caisse_epargne', 'Caisse d''Épargne', false, 2160, 4200, 12600, 1000, 9600, 0, 350, 0, 2400, 2000, 100)
ON CONFLICT (bank_slug) DO NOTHING;

-- ════════════════════════════════════════════════════════
-- 020 — Fiscal Radar
-- ════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS fiscal_profiles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    tax_household VARCHAR(16) NOT NULL DEFAULT 'single',
    parts_fiscales FLOAT NOT NULL DEFAULT 1.0,
    tmi_rate FLOAT NOT NULL DEFAULT 30.0,
    revenu_fiscal_ref BIGINT NOT NULL DEFAULT 0,
    pea_open_date DATE,
    pea_total_deposits BIGINT NOT NULL DEFAULT 0,
    per_annual_deposits BIGINT NOT NULL DEFAULT 0,
    per_plafond BIGINT NOT NULL DEFAULT 0,
    av_open_date DATE,
    av_total_deposits BIGINT NOT NULL DEFAULT 0,
    total_revenus_fonciers BIGINT NOT NULL DEFAULT 0,
    total_charges_deductibles BIGINT NOT NULL DEFAULT 0,
    deficit_foncier_reportable BIGINT NOT NULL DEFAULT 0,
    crypto_pv_annuelle BIGINT NOT NULL DEFAULT 0,
    crypto_mv_annuelle BIGINT NOT NULL DEFAULT 0,
    dividendes_bruts_annuels BIGINT NOT NULL DEFAULT 0,
    pv_cto_annuelle BIGINT NOT NULL DEFAULT 0,
    fiscal_score INTEGER NOT NULL DEFAULT 0,
    total_economy_estimate BIGINT NOT NULL DEFAULT 0,
    analysis_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    alerts_data JSONB NOT NULL DEFAULT '[]'::jsonb,
    export_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ix_fiscal_profiles_user_id ON fiscal_profiles(user_id);

-- ════════════════════════════════════════════════════════
-- 021 — Wealth Autopilot
-- ════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS autopilot_configs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    safety_cushion_months FLOAT NOT NULL DEFAULT 3.0,
    min_savings_amount BIGINT NOT NULL DEFAULT 2000,
    savings_step BIGINT NOT NULL DEFAULT 1000,
    lookback_days INTEGER NOT NULL DEFAULT 90,
    forecast_days INTEGER NOT NULL DEFAULT 7,
    monthly_income BIGINT NOT NULL DEFAULT 0,
    income_day INTEGER NOT NULL DEFAULT 1,
    other_income BIGINT NOT NULL DEFAULT 0,
    allocations JSONB NOT NULL DEFAULT '[]'::jsonb,
    last_available BIGINT NOT NULL DEFAULT 0,
    last_suggestion JSONB NOT NULL DEFAULT '{}'::jsonb,
    suggestions_history JSONB NOT NULL DEFAULT '[]'::jsonb,
    autopilot_score INTEGER NOT NULL DEFAULT 0,
    savings_rate_pct FLOAT NOT NULL DEFAULT 0.0,
    analysis_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ix_autopilot_configs_user_id ON autopilot_configs(user_id);

-- ════════════════════════════════════════════════════════
-- 022 — Digital Vault
-- ════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS tangible_assets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(30) NOT NULL DEFAULT 'other',
    subcategory VARCHAR(100),
    brand VARCHAR(100),
    model VARCHAR(255),
    purchase_price BIGINT NOT NULL DEFAULT 0,
    purchase_date DATE NOT NULL,
    current_value BIGINT NOT NULL DEFAULT 0,
    depreciation_type VARCHAR(20) NOT NULL DEFAULT 'linear',
    depreciation_rate FLOAT NOT NULL DEFAULT 20.0,
    residual_pct FLOAT NOT NULL DEFAULT 10.0,
    warranty_expires DATE,
    warranty_provider VARCHAR(255),
    condition VARCHAR(20) NOT NULL DEFAULT 'good',
    serial_number VARCHAR(255),
    notes TEXT,
    image_url VARCHAR(500),
    extra_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_tangible_assets_user_id ON tangible_assets(user_id);

CREATE TABLE IF NOT EXISTS nft_assets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    collection_name VARCHAR(255) NOT NULL,
    token_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    blockchain VARCHAR(20) NOT NULL DEFAULT 'ethereum',
    contract_address VARCHAR(255),
    purchase_price_eth FLOAT,
    purchase_price_eur BIGINT,
    current_floor_eur BIGINT,
    marketplace VARCHAR(100),
    marketplace_url VARCHAR(500),
    image_url VARCHAR(500),
    animation_url VARCHAR(500),
    last_price_update TIMESTAMPTZ,
    rarity_rank INTEGER,
    traits JSONB NOT NULL DEFAULT '{}'::jsonb,
    extra_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_nft_assets_user_id ON nft_assets(user_id);

CREATE TABLE IF NOT EXISTS card_wallet (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    card_name VARCHAR(255) NOT NULL,
    bank_name VARCHAR(100) NOT NULL,
    card_type VARCHAR(20) NOT NULL DEFAULT 'visa',
    card_tier VARCHAR(20) NOT NULL DEFAULT 'standard',
    last_four VARCHAR(4) NOT NULL,
    expiry_month INTEGER NOT NULL,
    expiry_year INTEGER NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    monthly_fee BIGINT NOT NULL DEFAULT 0,
    annual_fee BIGINT NOT NULL DEFAULT 0,
    cashback_pct FLOAT NOT NULL DEFAULT 0.0,
    insurance_level VARCHAR(20) NOT NULL DEFAULT 'none',
    benefits JSONB NOT NULL DEFAULT '[]'::jsonb,
    color VARCHAR(7),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_card_wallet_user_id ON card_wallet(user_id);

CREATE TABLE IF NOT EXISTS loyalty_programs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    program_name VARCHAR(255) NOT NULL,
    provider VARCHAR(100) NOT NULL,
    program_type VARCHAR(20) NOT NULL DEFAULT 'other',
    points_balance BIGINT NOT NULL DEFAULT 0,
    points_unit VARCHAR(50) NOT NULL DEFAULT 'points',
    eur_per_point FLOAT NOT NULL DEFAULT 0.01,
    estimated_value BIGINT NOT NULL DEFAULT 0,
    expiry_date DATE,
    account_number VARCHAR(255),
    tier_status VARCHAR(50),
    last_updated DATE,
    notes TEXT,
    extra_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_loyalty_programs_user_id ON loyalty_programs(user_id);

CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    provider VARCHAR(100) NOT NULL,
    category VARCHAR(30) NOT NULL DEFAULT 'other',
    amount BIGINT NOT NULL,
    billing_cycle VARCHAR(20) NOT NULL DEFAULT 'monthly',
    currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
    next_billing_date DATE NOT NULL,
    contract_start_date DATE NOT NULL,
    contract_end_date DATE,
    cancellation_deadline DATE,
    auto_renew BOOLEAN NOT NULL DEFAULT true,
    cancellation_notice_days INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_essential BOOLEAN NOT NULL DEFAULT false,
    url VARCHAR(500),
    notes TEXT,
    color VARCHAR(7),
    icon VARCHAR(50),
    extra_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_subscriptions_user_id ON subscriptions(user_id);

CREATE TABLE IF NOT EXISTS vault_documents (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(30) NOT NULL DEFAULT 'other',
    document_type VARCHAR(100) NOT NULL,
    issuer VARCHAR(255),
    issue_date DATE,
    expiry_date DATE,
    document_number VARCHAR(512),
    reminder_days INTEGER NOT NULL DEFAULT 30,
    notes TEXT,
    extra_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_vault_documents_user_id ON vault_documents(user_id);

CREATE TABLE IF NOT EXISTS peer_debts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    counterparty_name VARCHAR(255) NOT NULL,
    counterparty_email VARCHAR(255),
    counterparty_phone VARCHAR(20),
    direction VARCHAR(10) NOT NULL,
    amount BIGINT NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
    description TEXT,
    date_created DATE NOT NULL,
    due_date DATE,
    is_settled BOOLEAN NOT NULL DEFAULT false,
    settled_date DATE,
    settled_amount BIGINT,
    reminder_enabled BOOLEAN NOT NULL DEFAULT true,
    reminder_interval_days INTEGER NOT NULL DEFAULT 7,
    last_reminder_at TIMESTAMPTZ,
    notes TEXT,
    extra_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_peer_debts_user_id ON peer_debts(user_id);

-- Update alembic version
UPDATE alembic_version SET version_num = '022_digital_vault';

COMMIT;
