-- ================================
-- MINIMAL MVP SCHEMA FOR TARIFFGUARD
-- ================================
-- Simplified schema focused on Preston's Federal Register monitoring use case
-- Only 3 essential tables for tariff change detection
-- Version: MVP 1.0.0
-- Date: 2025-08-30

-- ================================
-- HS CODES TABLE
-- ================================
-- Simple table for Preston's specific HS codes
CREATE TABLE public.hs_codes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    hs_code TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    
    -- Monitoring status
    is_active BOOLEAN DEFAULT true,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    -- Constraints
    CONSTRAINT valid_hs_code_format CHECK (hs_code ~ '^\d{4}\.\d{2}\.\d{2}$')
);

-- ================================
-- TARIFF RATES TABLE
-- ================================
-- Current and historical tariff rates from Federal Register
CREATE TABLE public.tariff_rates (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    hs_code TEXT NOT NULL REFERENCES public.hs_codes(hs_code) ON DELETE CASCADE,
    
    -- Rate information
    current_rate DECIMAL(8,4) NOT NULL, -- Current applicable rate as percentage
    previous_rate DECIMAL(8,4), -- Previous rate for change calculation
    
    -- Source tracking
    effective_date DATE NOT NULL,
    source_url TEXT, -- Federal Register document URL
    
    -- Change tracking
    rate_change_percentage DECIMAL(8,4), -- Calculated change from previous rate
    is_significant_change BOOLEAN DEFAULT false, -- True if change > 1%
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    -- Indexes
    INDEX idx_tariff_rates_hs_code_date ON tariff_rates(hs_code, effective_date DESC),
    INDEX idx_tariff_rates_significant ON tariff_rates(is_significant_change, created_at DESC) WHERE is_significant_change = true
);

-- ================================
-- ALERTS SENT TABLE
-- ================================
-- Track alerts sent to Preston about rate changes
CREATE TABLE public.alerts_sent (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    hs_code TEXT NOT NULL REFERENCES public.hs_codes(hs_code) ON DELETE CASCADE,
    tariff_rate_id UUID REFERENCES public.tariff_rates(id) ON DELETE CASCADE NOT NULL,
    
    -- Alert content
    alert_message TEXT NOT NULL,
    rate_change_percentage DECIMAL(8,4) NOT NULL,
    old_rate DECIMAL(8,4),
    new_rate DECIMAL(8,4),
    
    -- Delivery tracking
    sent_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    delivery_status TEXT DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'sent', 'failed')),
    
    -- Source information
    federal_register_url TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    -- Indexes
    INDEX idx_alerts_sent_hs_code ON alerts_sent(hs_code, sent_at DESC),
    INDEX idx_alerts_sent_status ON alerts_sent(delivery_status, created_at DESC)
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

-- Apply updated_at triggers
CREATE TRIGGER hs_codes_updated_at
    BEFORE UPDATE ON public.hs_codes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER tariff_rates_updated_at
    BEFORE UPDATE ON public.tariff_rates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ================================
-- BUSINESS LOGIC FUNCTIONS
-- ================================

-- Function to detect significant rate changes
CREATE OR REPLACE FUNCTION public.detect_rate_change(
    p_hs_code TEXT,
    p_new_rate DECIMAL(8,4),
    p_effective_date DATE,
    p_source_url TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    current_rate_record RECORD;
    rate_change_pct DECIMAL(8,4);
    is_significant BOOLEAN := false;
BEGIN
    -- Get current rate for this HS code
    SELECT * INTO current_rate_record
    FROM public.tariff_rates
    WHERE hs_code = p_hs_code
    ORDER BY effective_date DESC, created_at DESC
    LIMIT 1;
    
    -- Calculate change percentage
    IF current_rate_record.current_rate IS NOT NULL AND current_rate_record.current_rate != 0 THEN
        rate_change_pct := ((p_new_rate - current_rate_record.current_rate) / current_rate_record.current_rate) * 100;
    ELSE
        rate_change_pct := 100; -- Treat new rates as 100% change
    END IF;
    
    -- Determine if change is significant (>1% absolute change)
    is_significant := ABS(rate_change_pct) > 1.0;
    
    -- Insert new rate record
    INSERT INTO public.tariff_rates (
        hs_code,
        current_rate,
        previous_rate,
        effective_date,
        source_url,
        rate_change_percentage,
        is_significant_change
    ) VALUES (
        p_hs_code,
        p_new_rate,
        current_rate_record.current_rate,
        p_effective_date,
        p_source_url,
        rate_change_pct,
        is_significant
    );
    
    RETURN is_significant;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create alert for significant changes
CREATE OR REPLACE FUNCTION public.create_alert_for_change(
    p_hs_code TEXT,
    p_tariff_rate_id UUID
)
RETURNS UUID AS $$
DECLARE
    rate_record RECORD;
    hs_record RECORD;
    alert_message TEXT;
    alert_id UUID;
BEGIN
    -- Get rate change details
    SELECT * INTO rate_record
    FROM public.tariff_rates
    WHERE id = p_tariff_rate_id;
    
    -- Get HS code description
    SELECT * INTO hs_record
    FROM public.hs_codes
    WHERE hs_code = p_hs_code;
    
    -- Create alert message
    alert_message := format(
        'TARIFF CHANGE ALERT: %s (%s) - Rate changed from %s%% to %s%% (%s%s%%). Effective: %s',
        hs_record.hs_code,
        hs_record.description,
        COALESCE(rate_record.previous_rate::TEXT, 'N/A'),
        rate_record.current_rate,
        CASE WHEN rate_record.rate_change_percentage > 0 THEN '+' ELSE '' END,
        ROUND(rate_record.rate_change_percentage, 2),
        rate_record.effective_date
    );
    
    -- Insert alert
    INSERT INTO public.alerts_sent (
        hs_code,
        tariff_rate_id,
        alert_message,
        rate_change_percentage,
        old_rate,
        new_rate,
        federal_register_url
    ) VALUES (
        p_hs_code,
        p_tariff_rate_id,
        alert_message,
        rate_record.rate_change_percentage,
        rate_record.previous_rate,
        rate_record.current_rate,
        rate_record.source_url
    ) RETURNING id INTO alert_id;
    
    RETURN alert_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================
-- INITIAL DATA - PRESTON'S HS CODES
-- ================================

-- Insert Preston's target HS codes
INSERT INTO public.hs_codes (hs_code, description) VALUES
('7318.15.20', 'Steel fasteners - bolts, screws, and threaded articles'),
('8481.80.90', 'Taps, cocks, valves and similar appliances, other'),
('7326.90.85', 'Other articles of iron or steel, not elsewhere specified');

-- ================================
-- TABLE COMMENTS
-- ================================

COMMENT ON TABLE public.hs_codes IS 'Simplified HS codes table for Preston''s monitored products';
COMMENT ON TABLE public.tariff_rates IS 'Current and historical tariff rates with change detection';
COMMENT ON TABLE public.alerts_sent IS 'Alerts sent about significant tariff changes';

-- ================================
-- PERFORMANCE INDEXES
-- ================================

-- Essential indexes for Federal Register monitoring
CREATE INDEX idx_hs_codes_active ON public.hs_codes(is_active) WHERE is_active = true;
CREATE INDEX idx_tariff_rates_recent ON public.tariff_rates(created_at DESC);
CREATE INDEX idx_alerts_recent ON public.alerts_sent(created_at DESC);