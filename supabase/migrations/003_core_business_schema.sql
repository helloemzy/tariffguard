-- ================================
-- CORE BUSINESS SCHEMA FOR TARIFFGUARD
-- ================================
-- This migration creates the core business entities for TariffGuard:
-- - HS codes management and monitoring
-- - Tariff rates with multi-source data
-- - Change detection and tracking
-- - Product management
-- Version: 1.0.0
-- Date: 2025-01-30

-- ================================
-- EXTEND EXISTING EXTENSIONS
-- ================================
CREATE EXTENSION IF NOT EXISTS "btree_gin";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ================================
-- HS CODES MASTER TABLE
-- ================================
-- Master reference table for all HS codes with descriptions
CREATE TABLE public.hs_codes_master (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    hs_code TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    parent_code TEXT,
    level INTEGER NOT NULL, -- 2, 4, 6, 8, or 10 digit level
    is_active BOOLEAN DEFAULT true,
    
    -- Additional metadata
    general_rate TEXT, -- MFN rate
    special_rates JSONB DEFAULT '{}'::jsonb, -- Special rates by country
    units TEXT, -- Units of measure
    statistical_suffix TEXT,
    
    -- Source tracking
    data_source TEXT DEFAULT 'HTSUS',
    last_verified_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    -- Constraints
    CONSTRAINT valid_hs_code_format CHECK (hs_code ~ '^\d{4}(\.\d{2}){0,3}$|^\d{10}$'),
    CONSTRAINT valid_level CHECK (level IN (2, 4, 6, 8, 10))
);

-- ================================
-- USER HS CODES - PRODUCTS TABLE
-- ================================
-- User-specific HS codes they want to monitor
CREATE TABLE public.user_hs_codes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    hs_code_id UUID REFERENCES public.hs_codes_master(id) ON DELETE RESTRICT NOT NULL,
    
    -- User-customized information
    product_name TEXT NOT NULL, -- User's name for this product
    product_description TEXT,
    typical_order_value DECIMAL(12,2), -- For impact calculations
    typical_order_currency TEXT DEFAULT 'USD',
    internal_sku TEXT, -- User's internal product code
    
    -- Monitoring settings
    monitoring_enabled BOOLEAN DEFAULT true,
    alert_threshold_percentage DECIMAL(5,2) DEFAULT 1.00, -- Alert on 1%+ changes
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    
    -- Alert preferences for this specific product
    email_alerts BOOLEAN DEFAULT true,
    sms_alerts BOOLEAN DEFAULT false,
    webhook_alerts BOOLEAN DEFAULT false,
    
    -- Business context
    supplier_country TEXT,
    origin_country TEXT,
    import_frequency TEXT CHECK (import_frequency IN ('weekly', 'monthly', 'quarterly', 'annually', 'as-needed')),
    
    -- Metadata
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Status tracking
    is_active BOOLEAN DEFAULT true,
    last_quoted_at TIMESTAMPTZ,
    last_checked_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    -- Unique constraint
    UNIQUE(user_id, hs_code_id)
);

-- ================================
-- TARIFF RATES TABLE
-- ================================
-- Current and historical tariff rates from all sources
CREATE TABLE public.tariff_rates (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    hs_code TEXT NOT NULL,
    
    -- Rate information
    general_rate DECIMAL(8,4), -- MFN rate (can be percentage or specific amount)
    general_rate_type TEXT DEFAULT 'ad_valorem' CHECK (general_rate_type IN ('ad_valorem', 'specific', 'compound')),
    general_rate_unit TEXT, -- Unit for specific rates (e.g., 'per kg', 'per liter')
    
    -- Special rates (country-specific)
    special_rates JSONB DEFAULT '{}'::jsonb, -- {"MX": {"rate": 0, "program": "USMCA"}, "CN": {"rate": 25, "program": "Section 301"}}
    
    -- Additional duties
    antidumping_duties JSONB DEFAULT '{}'::jsonb, -- Country-specific AD duties
    countervailing_duties JSONB DEFAULT '{}'::jsonb, -- Country-specific CVD duties
    section_301_duties JSONB DEFAULT '{}'::jsonb, -- Section 301 tariffs
    section_232_duties JSONB DEFAULT '{}'::jsonb, -- Section 232 tariffs
    safeguard_duties JSONB DEFAULT '{}'::jsonb, -- Safeguard measures
    
    -- Effective dates
    effective_date DATE NOT NULL,
    end_date DATE, -- NULL means still active
    
    -- Source tracking
    data_source TEXT NOT NULL, -- 'USITC', 'FEDERAL_REGISTER', 'CBP_CSMS', 'HTSUS'
    source_document_id TEXT,
    source_document_url TEXT,
    source_document_title TEXT,
    
    -- Processing metadata
    raw_data JSONB, -- Original data from source
    confidence_score DECIMAL(3,2) DEFAULT 1.00, -- Data quality score
    verification_status TEXT DEFAULT 'unverified' CHECK (verification_status IN ('unverified', 'verified', 'disputed')),
    verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    verified_at TIMESTAMPTZ,
    
    -- Change tracking
    supersedes_id UUID REFERENCES public.tariff_rates(id) ON DELETE SET NULL,
    change_reason TEXT, -- Why this rate changed
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    -- Indexes
    INDEX idx_tariff_rates_hs_code_date ON tariff_rates(hs_code, effective_date DESC),
    INDEX idx_tariff_rates_source ON tariff_rates(data_source, created_at DESC),
    INDEX idx_tariff_rates_active ON tariff_rates(hs_code) WHERE end_date IS NULL
);

-- ================================
-- RATE CHANGES TABLE
-- ================================
-- Detected changes in tariff rates with impact analysis
CREATE TABLE public.rate_changes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    hs_code TEXT NOT NULL,
    old_rate_id UUID REFERENCES public.tariff_rates(id) ON DELETE CASCADE,
    new_rate_id UUID REFERENCES public.tariff_rates(id) ON DELETE CASCADE NOT NULL,
    
    -- Change analysis
    change_type TEXT NOT NULL CHECK (change_type IN ('increase', 'decrease', 'new', 'removed', 'modified')),
    
    -- General rate changes
    general_rate_old DECIMAL(8,4),
    general_rate_new DECIMAL(8,4),
    general_rate_change_pct DECIMAL(8,4),
    general_rate_change_abs DECIMAL(8,4),
    
    -- Special rates changes (most significant)
    special_rates_changes JSONB DEFAULT '{}'::jsonb,
    most_significant_change JSONB, -- Summary of biggest impact
    
    -- Additional duties changes
    additional_duties_changes JSONB DEFAULT '{}'::jsonb,
    
    -- Impact assessment
    severity_level TEXT DEFAULT 'medium' CHECK (severity_level IN ('low', 'medium', 'high', 'critical')),
    estimated_impact_percentage DECIMAL(8,4), -- Overall cost impact
    affected_countries TEXT[], -- Countries affected by this change
    
    -- Detection metadata
    detected_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    detection_method TEXT NOT NULL, -- 'api_poll', 'scraper', 'manual_entry', 'federal_register'
    detection_confidence DECIMAL(3,2) DEFAULT 1.00,
    
    -- Source information
    source_document_id TEXT,
    source_document_url TEXT,
    source_document_date DATE,
    federal_register_number TEXT,
    cbp_bulletin_number TEXT,
    
    -- Processing status
    processing_status TEXT DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processed', 'notified', 'archived')),
    processed_at TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    -- Ensure we don't duplicate the same change
    UNIQUE(hs_code, new_rate_id)
);

-- ================================
-- USER ALERTS TABLE
-- ================================
-- Individual alerts sent to users about rate changes
CREATE TABLE public.user_alerts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    user_hs_code_id UUID REFERENCES public.user_hs_codes(id) ON DELETE CASCADE NOT NULL,
    rate_change_id UUID REFERENCES public.rate_changes(id) ON DELETE CASCADE NOT NULL,
    
    -- Alert content
    alert_type TEXT NOT NULL CHECK (alert_type IN ('rate_change', 'proposed_change', 'urgent_change', 'deadline_reminder')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    severity TEXT DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    
    -- Impact calculation for this user
    estimated_cost_impact DECIMAL(12,2),
    impact_currency TEXT DEFAULT 'USD',
    impact_percentage DECIMAL(8,4),
    
    -- Delivery channels
    email_sent BOOLEAN DEFAULT false,
    email_sent_at TIMESTAMPTZ,
    email_opened_at TIMESTAMPTZ,
    email_clicked_at TIMESTAMPTZ,
    
    sms_sent BOOLEAN DEFAULT false,
    sms_sent_at TIMESTAMPTZ,
    sms_delivered_at TIMESTAMPTZ,
    
    webhook_sent BOOLEAN DEFAULT false,
    webhook_sent_at TIMESTAMPTZ,
    webhook_response_code INTEGER,
    
    push_sent BOOLEAN DEFAULT false,
    push_sent_at TIMESTAMPTZ,
    push_opened_at TIMESTAMPTZ,
    
    -- User engagement
    viewed_at TIMESTAMPTZ,
    acknowledged_at TIMESTAMPTZ,
    dismissed_at TIMESTAMPTZ,
    
    -- Action taken
    action_taken TEXT, -- 'adjusted_pricing', 'contacted_supplier', 'ignored', 'postponed_order'
    action_notes TEXT,
    action_taken_at TIMESTAMPTZ,
    
    -- Metadata
    alert_data JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    -- Indexes
    INDEX idx_user_alerts_user_unread ON user_alerts(user_id, acknowledged_at) WHERE acknowledged_at IS NULL,
    INDEX idx_user_alerts_created ON user_alerts(created_at DESC),
    INDEX idx_user_alerts_severity ON user_alerts(severity, created_at DESC)
);

-- ================================
-- QUOTE CALCULATIONS TABLE
-- ================================
-- Track user quote calculations for validation and history
CREATE TABLE public.quote_calculations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    user_hs_code_id UUID REFERENCES public.user_hs_codes(id) ON DELETE SET NULL,
    
    -- Quote details
    quote_reference TEXT, -- User's internal quote reference
    customer_name TEXT,
    product_description TEXT,
    
    -- Calculation inputs
    hs_code TEXT NOT NULL,
    origin_country TEXT NOT NULL,
    quantity DECIMAL(12,4) NOT NULL,
    unit_value DECIMAL(12,2) NOT NULL,
    value_currency TEXT DEFAULT 'USD',
    
    -- Rates used (snapshot at time of calculation)
    general_rate DECIMAL(8,4),
    special_rate DECIMAL(8,4),
    applicable_rate DECIMAL(8,4), -- Rate actually used
    additional_duties JSONB DEFAULT '{}'::jsonb,
    total_duty_rate DECIMAL(8,4),
    
    -- Calculated results
    duty_amount DECIMAL(12,2),
    total_landed_cost DECIMAL(12,2),
    cost_currency TEXT DEFAULT 'USD',
    
    -- Validation
    rates_current_as_of TIMESTAMPTZ NOT NULL,
    rate_freshness_warning BOOLEAN DEFAULT false,
    validation_warnings TEXT[],
    
    -- Quote status
    quote_status TEXT DEFAULT 'draft' CHECK (quote_status IN ('draft', 'sent', 'accepted', 'rejected', 'expired')),
    quote_sent_at TIMESTAMPTZ,
    quote_valid_until DATE,
    
    -- Metadata
    calculation_metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    -- Indexes
    INDEX idx_quote_calculations_user_date ON quote_calculations(user_id, created_at DESC),
    INDEX idx_quote_calculations_hs_code ON quote_calculations(hs_code, created_at DESC)
);

-- ================================
-- DATA SOURCE STATUS TABLE
-- ================================
-- Track the health and status of external data sources
CREATE TABLE public.data_source_status (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    source_name TEXT NOT NULL UNIQUE, -- 'USITC', 'FEDERAL_REGISTER', 'CBP_CSMS', etc.
    source_url TEXT NOT NULL,
    
    -- Status information
    is_active BOOLEAN DEFAULT true,
    last_successful_check TIMESTAMPTZ,
    last_failed_check TIMESTAMPTZ,
    consecutive_failures INTEGER DEFAULT 0,
    
    -- Response metrics
    average_response_time_ms INTEGER,
    success_rate_24h DECIMAL(5,2), -- Success rate in last 24 hours
    
    -- Data freshness
    last_data_update TIMESTAMPTZ,
    data_lag_hours INTEGER, -- How far behind is the data
    
    -- Configuration
    check_frequency_minutes INTEGER DEFAULT 60,
    timeout_seconds INTEGER DEFAULT 30,
    retry_attempts INTEGER DEFAULT 3,
    
    -- Rate limiting
    rate_limit_per_hour INTEGER,
    current_hour_requests INTEGER DEFAULT 0,
    rate_limit_reset_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '1 hour'),
    
    -- Health status
    health_status TEXT DEFAULT 'healthy' CHECK (health_status IN ('healthy', 'degraded', 'unhealthy', 'maintenance')),
    health_message TEXT,
    
    -- Metadata
    source_metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ================================
-- MONITORING JOBS TABLE
-- ================================
-- Track automated monitoring jobs and their status
CREATE TABLE public.monitoring_jobs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    job_type TEXT NOT NULL CHECK (job_type IN ('rate_check', 'federal_register_scan', 'cbp_bulletin_scan', 'data_validation', 'alert_processing')),
    
    -- Job configuration
    source_name TEXT REFERENCES public.data_source_status(source_name) ON DELETE CASCADE,
    target_hs_codes TEXT[], -- Specific codes to check, or NULL for all
    job_parameters JSONB DEFAULT '{}'::jsonb,
    
    -- Execution details
    status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    duration_seconds INTEGER,
    
    -- Results
    records_processed INTEGER DEFAULT 0,
    records_updated INTEGER DEFAULT 0,
    changes_detected INTEGER DEFAULT 0,
    alerts_generated INTEGER DEFAULT 0,
    errors_encountered INTEGER DEFAULT 0,
    
    -- Error handling
    error_message TEXT,
    error_details JSONB,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    next_retry_at TIMESTAMPTZ,
    
    -- Metadata
    job_metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    -- Indexes
    INDEX idx_monitoring_jobs_status ON monitoring_jobs(status, created_at),
    INDEX idx_monitoring_jobs_type_date ON monitoring_jobs(job_type, created_at DESC)
);

-- ================================
-- FEDERAL REGISTER ENTRIES TABLE
-- ================================
-- Track Federal Register entries related to tariffs
CREATE TABLE public.federal_register_entries (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    
    -- Federal Register identifiers
    document_number TEXT NOT NULL UNIQUE,
    federal_register_number TEXT,
    regulation_id_numbers TEXT[],
    
    -- Document metadata
    title TEXT NOT NULL,
    abstract TEXT,
    document_type TEXT, -- 'Proposed Rule', 'Final Rule', 'Notice', etc.
    agency TEXT,
    subagency TEXT,
    
    -- Dates
    publication_date DATE NOT NULL,
    effective_date DATE,
    comment_deadline DATE,
    
    -- Content
    full_text TEXT,
    html_url TEXT,
    pdf_url TEXT,
    
    -- Tariff relevance
    affects_tariffs BOOLEAN DEFAULT false,
    affected_hs_codes TEXT[],
    tariff_impact_summary TEXT,
    
    -- Processing status
    processing_status TEXT DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processed', 'analyzed', 'ignored')),
    ai_analysis JSONB, -- AI-extracted insights
    human_review_status TEXT CHECK (human_review_status IN ('pending', 'approved', 'rejected')),
    reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    
    -- Metadata
    raw_data JSONB,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    -- Indexes
    INDEX idx_federal_register_publication ON federal_register_entries(publication_date DESC),
    INDEX idx_federal_register_effective ON federal_register_entries(effective_date) WHERE effective_date IS NOT NULL,
    INDEX idx_federal_register_comments ON federal_register_entries(comment_deadline) WHERE comment_deadline IS NOT NULL AND comment_deadline > NOW(),
    INDEX idx_federal_register_hs_codes ON federal_register_entries USING GIN (affected_hs_codes)
);

-- ================================
-- SYSTEM CONFIGURATION TABLE
-- ================================
-- Application-wide configuration settings
CREATE TABLE public.system_configuration (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    config_key TEXT NOT NULL UNIQUE,
    config_value JSONB NOT NULL,
    config_type TEXT NOT NULL CHECK (config_type IN ('string', 'number', 'boolean', 'object', 'array')),
    
    -- Metadata
    description TEXT,
    is_sensitive BOOLEAN DEFAULT false,
    requires_restart BOOLEAN DEFAULT false,
    
    -- Validation
    validation_schema JSONB, -- JSON schema for value validation
    
    -- Version tracking
    version INTEGER DEFAULT 1,
    modified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ================================
-- FUNCTIONS AND TRIGGERS
-- ================================

-- Function to update updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all relevant tables
CREATE TRIGGER hs_codes_master_updated_at
    BEFORE UPDATE ON public.hs_codes_master
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER user_hs_codes_updated_at
    BEFORE UPDATE ON public.user_hs_codes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER tariff_rates_updated_at
    BEFORE UPDATE ON public.tariff_rates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER user_alerts_updated_at
    BEFORE UPDATE ON public.user_alerts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER quote_calculations_updated_at
    BEFORE UPDATE ON public.quote_calculations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER data_source_status_updated_at
    BEFORE UPDATE ON public.data_source_status
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER monitoring_jobs_updated_at
    BEFORE UPDATE ON public.monitoring_jobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER federal_register_entries_updated_at
    BEFORE UPDATE ON public.federal_register_entries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER system_configuration_updated_at
    BEFORE UPDATE ON public.system_configuration
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ================================
-- BUSINESS LOGIC FUNCTIONS
-- ================================

-- Function to get current rate for an HS code
CREATE OR REPLACE FUNCTION public.get_current_rate(p_hs_code TEXT)
RETURNS TABLE (
    general_rate DECIMAL(8,4),
    special_rates JSONB,
    additional_duties JSONB,
    effective_date DATE,
    source TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        tr.general_rate,
        tr.special_rates,
        COALESCE(tr.antidumping_duties, '{}'::jsonb) || 
        COALESCE(tr.countervailing_duties, '{}'::jsonb) || 
        COALESCE(tr.section_301_duties, '{}'::jsonb) || 
        COALESCE(tr.section_232_duties, '{}'::jsonb) || 
        COALESCE(tr.safeguard_duties, '{}'::jsonb) as additional_duties,
        tr.effective_date,
        tr.data_source
    FROM public.tariff_rates tr
    WHERE tr.hs_code = p_hs_code
      AND (tr.end_date IS NULL OR tr.end_date > CURRENT_DATE)
    ORDER BY tr.effective_date DESC, tr.created_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate total duty rate
CREATE OR REPLACE FUNCTION public.calculate_total_duty(
    p_hs_code TEXT,
    p_origin_country TEXT DEFAULT 'CN',
    p_value DECIMAL DEFAULT 1000.00
)
RETURNS TABLE (
    general_rate DECIMAL(8,4),
    applicable_special_rate DECIMAL(8,4),
    total_additional_duties DECIMAL(8,4),
    total_rate DECIMAL(8,4),
    duty_amount DECIMAL(12,2)
) AS $$
DECLARE
    current_rates RECORD;
    special_rate DECIMAL(8,4) := 0;
    additional_rate DECIMAL(8,4) := 0;
    final_rate DECIMAL(8,4);
BEGIN
    -- Get current rates
    SELECT * INTO current_rates FROM public.get_current_rate(p_hs_code) LIMIT 1;
    
    IF NOT FOUND THEN
        -- No rates found
        RETURN QUERY SELECT NULL::DECIMAL, NULL::DECIMAL, NULL::DECIMAL, NULL::DECIMAL, NULL::DECIMAL;
        RETURN;
    END IF;
    
    -- Calculate special rate if applicable
    IF current_rates.special_rates ? p_origin_country THEN
        special_rate := COALESCE((current_rates.special_rates->>p_origin_country)::DECIMAL, 0);
    END IF;
    
    -- Calculate additional duties
    additional_rate := 0;
    IF current_rates.additional_duties ? p_origin_country THEN
        additional_rate := COALESCE((current_rates.additional_duties->>p_origin_country)::DECIMAL, 0);
    END IF;
    
    -- Determine final rate (use special rate if lower than general rate)
    final_rate := LEAST(COALESCE(current_rates.general_rate, 0), special_rate) + additional_rate;
    
    RETURN QUERY SELECT 
        current_rates.general_rate,
        special_rate,
        additional_rate,
        final_rate,
        ROUND((p_value * final_rate / 100), 2);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================
-- PERFORMANCE INDEXES
-- ================================

-- HS Codes Master indexes
CREATE INDEX idx_hs_codes_master_code ON public.hs_codes_master(hs_code);
CREATE INDEX idx_hs_codes_master_parent ON public.hs_codes_master(parent_code);
CREATE INDEX idx_hs_codes_master_level ON public.hs_codes_master(level);
CREATE INDEX idx_hs_codes_master_active ON public.hs_codes_master(is_active) WHERE is_active = true;
CREATE INDEX idx_hs_codes_master_search ON public.hs_codes_master USING GIN (to_tsvector('english', description));

-- User HS Codes indexes
CREATE INDEX idx_user_hs_codes_user_active ON public.user_hs_codes(user_id, is_active) WHERE is_active = true;
CREATE INDEX idx_user_hs_codes_monitoring ON public.user_hs_codes(monitoring_enabled, priority) WHERE monitoring_enabled = true;
CREATE INDEX idx_user_hs_codes_product_search ON public.user_hs_codes USING GIN (to_tsvector('english', product_name || ' ' || COALESCE(product_description, '')));

-- Rate Changes indexes  
CREATE INDEX idx_rate_changes_hs_severity ON public.rate_changes(hs_code, severity_level, detected_at DESC);
CREATE INDEX idx_rate_changes_unprocessed ON public.rate_changes(processing_status, detected_at) WHERE processing_status = 'pending';
CREATE INDEX idx_rate_changes_detection_method ON public.rate_changes(detection_method, detected_at DESC);

-- Federal Register indexes
CREATE INDEX idx_federal_register_tariff_relevant ON public.federal_register_entries(affects_tariffs, publication_date DESC) WHERE affects_tariffs = true;
CREATE INDEX idx_federal_register_unprocessed ON public.federal_register_entries(processing_status, publication_date DESC) WHERE processing_status = 'pending';
CREATE INDEX idx_federal_register_full_text_search ON public.federal_register_entries USING GIN (to_tsvector('english', title || ' ' || COALESCE(abstract, '') || ' ' || COALESCE(full_text, '')));

-- ================================
-- TABLE COMMENTS
-- ================================

COMMENT ON TABLE public.hs_codes_master IS 'Master reference table for all HS codes with official descriptions and rates';
COMMENT ON TABLE public.user_hs_codes IS 'User-specific products mapped to HS codes with monitoring preferences';
COMMENT ON TABLE public.tariff_rates IS 'Historical and current tariff rates from all government sources';
COMMENT ON TABLE public.rate_changes IS 'Detected changes in tariff rates with impact analysis';
COMMENT ON TABLE public.user_alerts IS 'Individual alerts sent to users about rate changes affecting their products';
COMMENT ON TABLE public.quote_calculations IS 'User quote calculations for validation and history tracking';
COMMENT ON TABLE public.data_source_status IS 'Health monitoring for external government data sources';
COMMENT ON TABLE public.monitoring_jobs IS 'Automated jobs that check for tariff changes and updates';
COMMENT ON TABLE public.federal_register_entries IS 'Federal Register entries related to tariff changes';
COMMENT ON TABLE public.system_configuration IS 'Application-wide configuration settings';

-- ================================
-- INITIAL DATA
-- ================================

-- Insert default data source configurations
INSERT INTO public.data_source_status (source_name, source_url, check_frequency_minutes, rate_limit_per_hour) VALUES
('USITC_DATAWEB', 'https://dataweb.usitc.gov/api/tariff', 60, 1000),
('FEDERAL_REGISTER', 'https://www.federalregister.gov/api/v1', 120, 1000),
('CBP_CSMS', 'https://csms.cbp.gov', 180, 100),
('HTSUS_DATABASE', 'https://hts.usitc.gov/current', 1440, 50);

-- Insert default system configuration
INSERT INTO public.system_configuration (config_key, config_value, config_type, description) VALUES
('alert_batch_size', '100', 'number', 'Maximum number of alerts to process in one batch'),
('rate_change_threshold', '1.0', 'number', 'Default percentage threshold for rate change alerts'),
('data_retention_days', '2555', 'number', 'Number of days to retain historical data (7 years)'),
('max_user_hs_codes_free', '2', 'number', 'Maximum HS codes for free tier users'),
('max_user_hs_codes_pro', '10', 'number', 'Maximum HS codes for professional tier users'),
('max_user_hs_codes_business', '50', 'number', 'Maximum HS codes for business tier users'),
('email_rate_limit_per_hour', '10', 'number', 'Maximum emails per user per hour'),
('sms_rate_limit_per_day', '5', 'number', 'Maximum SMS per user per day'),
('webhook_timeout_seconds', '10', 'number', 'Timeout for webhook deliveries'),
('federal_register_lookback_days', '30', 'number', 'Days to look back when scanning Federal Register'),
('enable_ai_analysis', 'true', 'boolean', 'Enable AI analysis of Federal Register entries');