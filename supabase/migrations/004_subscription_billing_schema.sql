-- ================================
-- SUBSCRIPTION AND BILLING MANAGEMENT SCHEMA
-- ================================
-- This migration creates the subscription management, billing, and API usage tracking
-- components for TariffGuard's SaaS business model
-- Version: 1.0.0
-- Date: 2025-01-30

-- ================================
-- SUBSCRIPTION PLANS TABLE
-- ================================
-- Define available subscription plans and their limits
CREATE TABLE public.subscription_plans (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    plan_code TEXT NOT NULL UNIQUE, -- 'free', 'professional', 'business', 'enterprise'
    plan_name TEXT NOT NULL,
    display_name TEXT NOT NULL,
    
    -- Pricing
    price_monthly DECIMAL(10,2) NOT NULL DEFAULT 0,
    price_annually DECIMAL(10,2) NOT NULL DEFAULT 0,
    currency TEXT DEFAULT 'USD',
    
    -- Plan limits
    max_hs_codes INTEGER NOT NULL DEFAULT 2,
    max_users INTEGER NOT NULL DEFAULT 1,
    max_alerts_per_month INTEGER NOT NULL DEFAULT 100,
    max_api_calls_per_month INTEGER NOT NULL DEFAULT 0,
    max_webhooks INTEGER NOT NULL DEFAULT 0,
    max_quote_calculations_per_month INTEGER NOT NULL DEFAULT 100,
    
    -- Features
    features JSONB DEFAULT '{}'::jsonb, -- {"email_alerts": true, "sms_alerts": false, "api_access": false}
    
    -- Plan metadata
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    is_public BOOLEAN DEFAULT true, -- Public plans shown on pricing page
    sort_order INTEGER DEFAULT 0,
    
    -- Stripe integration
    stripe_price_id_monthly TEXT, -- Stripe price ID for monthly billing
    stripe_price_id_annually TEXT, -- Stripe price ID for annual billing
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ================================
-- USER SUBSCRIPTIONS TABLE
-- ================================
-- Track user subscriptions and billing status
CREATE TABLE public.user_subscriptions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    plan_id UUID REFERENCES public.subscription_plans(id) ON DELETE RESTRICT NOT NULL,
    
    -- Subscription details
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'trialing', 'past_due', 'canceled', 'unpaid', 'paused')),
    billing_cycle TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'annually', 'lifetime')),
    
    -- Billing information
    current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    current_period_end TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 month'),
    trial_start TIMESTAMPTZ,
    trial_end TIMESTAMPTZ,
    
    -- Stripe integration
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT UNIQUE,
    stripe_payment_method_id TEXT,
    
    -- Pricing (snapshot at time of subscription)
    price_amount DECIMAL(10,2) NOT NULL,
    price_currency TEXT DEFAULT 'USD',
    
    -- Cancellation
    canceled_at TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN DEFAULT false,
    cancellation_reason TEXT,
    
    -- Usage tracking reset
    usage_reset_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Metadata
    subscription_metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    -- Ensure one active subscription per user
    UNIQUE(user_id) DEFERRABLE INITIALLY DEFERRED
);

-- ================================
-- SUBSCRIPTION USAGE TABLE
-- ================================
-- Track usage against subscription limits
CREATE TABLE public.subscription_usage (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    subscription_id UUID REFERENCES public.user_subscriptions(id) ON DELETE CASCADE NOT NULL,
    
    -- Usage period
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    
    -- Current usage counters
    hs_codes_count INTEGER DEFAULT 0,
    users_count INTEGER DEFAULT 1,
    alerts_sent_count INTEGER DEFAULT 0,
    api_calls_count INTEGER DEFAULT 0,
    webhook_deliveries_count INTEGER DEFAULT 0,
    quote_calculations_count INTEGER DEFAULT 0,
    
    -- Usage details
    usage_details JSONB DEFAULT '{}'::jsonb,
    
    -- Status
    is_current_period BOOLEAN DEFAULT true,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    -- Unique constraint for current period
    UNIQUE(subscription_id, is_current_period) DEFERRABLE INITIALLY DEFERRED
);

-- ================================
-- BILLING TRANSACTIONS TABLE
-- ================================
-- Track all billing transactions and payments
CREATE TABLE public.billing_transactions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    subscription_id UUID REFERENCES public.user_subscriptions(id) ON DELETE CASCADE,
    
    -- Transaction details
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('payment', 'refund', 'adjustment', 'credit', 'invoice')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'failed', 'canceled', 'refunded')),
    
    -- Amount information
    amount DECIMAL(10,2) NOT NULL,
    currency TEXT DEFAULT 'USD',
    net_amount DECIMAL(10,2), -- Amount after fees
    fee_amount DECIMAL(10,2),
    
    -- Billing period this covers
    billing_period_start TIMESTAMPTZ,
    billing_period_end TIMESTAMPTZ,
    
    -- Stripe integration
    stripe_payment_intent_id TEXT,
    stripe_charge_id TEXT,
    stripe_invoice_id TEXT,
    stripe_refund_id TEXT,
    
    -- Payment method
    payment_method_type TEXT, -- 'card', 'bank_account', 'paypal'
    payment_method_details JSONB,
    
    -- Transaction metadata
    description TEXT,
    failure_reason TEXT,
    failure_code TEXT,
    
    -- Timestamps
    attempted_at TIMESTAMPTZ DEFAULT NOW(),
    succeeded_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    
    -- Metadata
    transaction_metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    -- Indexes
    INDEX idx_billing_transactions_user_date ON billing_transactions(user_id, created_at DESC),
    INDEX idx_billing_transactions_status ON billing_transactions(status, created_at DESC),
    INDEX idx_billing_transactions_stripe ON billing_transactions(stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL
);

-- ================================
-- API KEYS TABLE
-- ================================
-- Manage API keys for user access
CREATE TABLE public.api_keys (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    
    -- Key information
    key_name TEXT NOT NULL,
    key_hash TEXT NOT NULL UNIQUE, -- Hashed version of the actual key
    key_prefix TEXT NOT NULL, -- First few characters for display (e.g., "tg_sk_...")
    
    -- Permissions and scope
    scopes TEXT[] DEFAULT ARRAY['read']::TEXT[], -- 'read', 'write', 'admin'
    allowed_endpoints TEXT[], -- Specific endpoints this key can access
    
    -- Rate limiting (per key)
    rate_limit_per_hour INTEGER DEFAULT 100,
    rate_limit_per_day INTEGER DEFAULT 1000,
    
    -- Key status
    is_active BOOLEAN DEFAULT true,
    last_used_at TIMESTAMPTZ,
    
    -- IP restrictions
    allowed_ips TEXT[], -- CIDR notation allowed
    
    -- Expiration
    expires_at TIMESTAMPTZ,
    
    -- Metadata
    key_metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    -- Indexes
    INDEX idx_api_keys_user_active ON api_keys(user_id, is_active) WHERE is_active = true,
    INDEX idx_api_keys_expires ON api_keys(expires_at) WHERE expires_at IS NOT NULL
);

-- ================================
-- API USAGE LOG TABLE
-- ================================
-- Detailed logging of API usage for billing and analytics
CREATE TABLE public.api_usage_log (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    api_key_id UUID REFERENCES public.api_keys(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    
    -- Request details
    endpoint TEXT NOT NULL,
    http_method TEXT NOT NULL,
    request_size_bytes INTEGER DEFAULT 0,
    response_size_bytes INTEGER DEFAULT 0,
    
    -- Response information
    status_code INTEGER NOT NULL,
    response_time_ms INTEGER NOT NULL,
    
    -- Request metadata
    ip_address INET,
    user_agent TEXT,
    referer TEXT,
    
    -- Rate limiting
    rate_limit_remaining INTEGER,
    rate_limit_reset_at TIMESTAMPTZ,
    
    -- Cost calculation (for potential metered billing)
    compute_units DECIMAL(8,4) DEFAULT 1.0, -- Weighted cost based on endpoint complexity
    
    -- Error information
    error_code TEXT,
    error_message TEXT,
    
    -- Timestamps
    timestamp TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    -- Partitioning hint (for future partitioning by date)
    date_partition DATE GENERATED ALWAYS AS (timestamp::DATE) STORED,
    
    -- Indexes
    INDEX idx_api_usage_log_user_date ON api_usage_log(user_id, timestamp DESC),
    INDEX idx_api_usage_log_key_date ON api_usage_log(api_key_id, timestamp DESC) WHERE api_key_id IS NOT NULL,
    INDEX idx_api_usage_log_endpoint ON api_usage_log(endpoint, timestamp DESC),
    INDEX idx_api_usage_log_partition ON api_usage_log(date_partition, timestamp DESC)
);

-- ================================
-- WEBHOOK ENDPOINTS TABLE
-- ================================
-- User-configured webhook endpoints for notifications
CREATE TABLE public.webhook_endpoints (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    
    -- Endpoint configuration
    url TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    
    -- Authentication
    auth_method TEXT DEFAULT 'none' CHECK (auth_method IN ('none', 'bearer_token', 'basic_auth', 'hmac_sha256')),
    auth_credentials JSONB DEFAULT '{}'::jsonb, -- Encrypted auth data
    
    -- Event subscription
    subscribed_events TEXT[] DEFAULT ARRAY['rate_change']::TEXT[], -- Events this webhook receives
    
    -- Delivery settings
    timeout_seconds INTEGER DEFAULT 10,
    retry_attempts INTEGER DEFAULT 3,
    retry_backoff_seconds INTEGER DEFAULT 60,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    last_successful_delivery TIMESTAMPTZ,
    last_failed_delivery TIMESTAMPTZ,
    consecutive_failures INTEGER DEFAULT 0,
    
    -- Security
    secret_token TEXT, -- For HMAC signature verification
    allowed_ips TEXT[], -- IP whitelist
    
    -- Metadata
    webhook_metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    -- Indexes
    INDEX idx_webhook_endpoints_user_active ON webhook_endpoints(user_id, is_active) WHERE is_active = true
);

-- ================================
-- WEBHOOK DELIVERIES TABLE
-- ================================
-- Track webhook delivery attempts and results
CREATE TABLE public.webhook_deliveries (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    webhook_endpoint_id UUID REFERENCES public.webhook_endpoints(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    
    -- Delivery details
    event_type TEXT NOT NULL,
    event_id UUID, -- ID of the triggering event (e.g., rate_change_id)
    
    -- HTTP request details
    http_method TEXT DEFAULT 'POST',
    request_headers JSONB,
    request_body JSONB NOT NULL,
    request_size_bytes INTEGER,
    
    -- HTTP response details
    status_code INTEGER,
    response_headers JSONB,
    response_body TEXT,
    response_size_bytes INTEGER,
    response_time_ms INTEGER,
    
    -- Delivery status
    delivery_status TEXT DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'delivered', 'failed', 'timeout', 'retry')),
    failure_reason TEXT,
    
    -- Retry information
    attempt_number INTEGER DEFAULT 1,
    max_attempts INTEGER DEFAULT 3,
    next_retry_at TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    delivered_at TIMESTAMPTZ,
    
    -- Indexes
    INDEX idx_webhook_deliveries_endpoint_date ON webhook_deliveries(webhook_endpoint_id, created_at DESC),
    INDEX idx_webhook_deliveries_status ON webhook_deliveries(delivery_status, next_retry_at) WHERE delivery_status = 'retry',
    INDEX idx_webhook_deliveries_user_date ON webhook_deliveries(user_id, created_at DESC)
);

-- ================================
-- TEAM MEMBERS TABLE
-- ================================
-- Support for team accounts and role-based access
CREATE TABLE public.team_members (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    team_owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    member_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    
    -- Role and permissions
    role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'editor', 'viewer')),
    permissions JSONB DEFAULT '{}'::jsonb, -- Granular permissions
    
    -- Invitation details
    invitation_email TEXT,
    invitation_token TEXT,
    invited_at TIMESTAMPTZ DEFAULT NOW(),
    accepted_at TIMESTAMPTZ,
    
    -- Status
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended', 'removed')),
    
    -- Access restrictions
    allowed_hs_codes UUID[], -- Specific HS codes this member can access
    
    -- Metadata
    member_metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    -- Unique constraint
    UNIQUE(team_owner_id, member_user_id),
    
    -- Indexes
    INDEX idx_team_members_owner ON team_members(team_owner_id, status),
    INDEX idx_team_members_member ON team_members(member_user_id, status)
);

-- ================================
-- USAGE ALERTS TABLE
-- ================================
-- Alerts for approaching subscription limits
CREATE TABLE public.usage_alerts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    subscription_id UUID REFERENCES public.user_subscriptions(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    
    -- Alert details
    alert_type TEXT NOT NULL CHECK (alert_type IN ('approaching_limit', 'limit_exceeded', 'billing_failure', 'plan_change')),
    usage_type TEXT NOT NULL, -- 'hs_codes', 'api_calls', 'alerts', etc.
    
    -- Usage information
    current_usage INTEGER NOT NULL,
    usage_limit INTEGER NOT NULL,
    usage_percentage DECIMAL(5,2) NOT NULL,
    
    -- Alert thresholds (trigger at 80%, 95%, 100%)
    threshold_percentage DECIMAL(5,2) NOT NULL,
    
    -- Alert content
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    recommended_action TEXT,
    
    -- Delivery status
    sent_at TIMESTAMPTZ,
    acknowledged_at TIMESTAMPTZ,
    
    -- Metadata
    alert_metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    -- Indexes
    INDEX idx_usage_alerts_subscription ON usage_alerts(subscription_id, created_at DESC),
    INDEX idx_usage_alerts_unacknowledged ON usage_alerts(user_id, acknowledged_at) WHERE acknowledged_at IS NULL
);

-- ================================
-- FUNCTIONS AND TRIGGERS
-- ================================

-- Apply updated_at triggers
CREATE TRIGGER subscription_plans_updated_at
    BEFORE UPDATE ON public.subscription_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER user_subscriptions_updated_at
    BEFORE UPDATE ON public.user_subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER subscription_usage_updated_at
    BEFORE UPDATE ON public.subscription_usage
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER billing_transactions_updated_at
    BEFORE UPDATE ON public.billing_transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER api_keys_updated_at
    BEFORE UPDATE ON public.api_keys
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER webhook_endpoints_updated_at
    BEFORE UPDATE ON public.webhook_endpoints
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER team_members_updated_at
    BEFORE UPDATE ON public.team_members
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ================================
-- BUSINESS LOGIC FUNCTIONS
-- ================================

-- Function to check if user has reached their subscription limit
CREATE OR REPLACE FUNCTION public.check_subscription_limit(
    p_user_id UUID,
    p_limit_type TEXT
)
RETURNS TABLE (
    current_usage INTEGER,
    usage_limit INTEGER,
    is_over_limit BOOLEAN,
    usage_percentage DECIMAL
) AS $$
DECLARE
    subscription_record RECORD;
    usage_record RECORD;
    current_count INTEGER := 0;
    limit_value INTEGER := 0;
BEGIN
    -- Get user's current subscription
    SELECT us.*, sp.*
    INTO subscription_record
    FROM public.user_subscriptions us
    JOIN public.subscription_plans sp ON us.plan_id = sp.id
    WHERE us.user_id = p_user_id AND us.status = 'active';
    
    IF NOT FOUND THEN
        -- User has no active subscription, return default limits
        RETURN QUERY SELECT 0, 2, false, 0.0::DECIMAL; -- Free tier defaults
        RETURN;
    END IF;
    
    -- Get current period usage
    SELECT * INTO usage_record
    FROM public.subscription_usage
    WHERE subscription_id = subscription_record.id AND is_current_period = true;
    
    -- Determine current usage and limit based on type
    CASE p_limit_type
        WHEN 'hs_codes' THEN
            current_count := COALESCE(usage_record.hs_codes_count, 0);
            limit_value := subscription_record.max_hs_codes;
        WHEN 'api_calls' THEN
            current_count := COALESCE(usage_record.api_calls_count, 0);
            limit_value := subscription_record.max_api_calls_per_month;
        WHEN 'alerts' THEN
            current_count := COALESCE(usage_record.alerts_sent_count, 0);
            limit_value := subscription_record.max_alerts_per_month;
        WHEN 'users' THEN
            current_count := COALESCE(usage_record.users_count, 1);
            limit_value := subscription_record.max_users;
        ELSE
            current_count := 0;
            limit_value := 0;
    END CASE;
    
    RETURN QUERY SELECT 
        current_count,
        limit_value,
        current_count >= limit_value,
        CASE WHEN limit_value > 0 THEN (current_count::DECIMAL / limit_value * 100) ELSE 0 END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment usage counter
CREATE OR REPLACE FUNCTION public.increment_usage(
    p_user_id UUID,
    p_usage_type TEXT,
    p_increment INTEGER DEFAULT 1
)
RETURNS BOOLEAN AS $$
DECLARE
    subscription_id_val UUID;
    usage_id_val UUID;
BEGIN
    -- Get user's active subscription
    SELECT id INTO subscription_id_val
    FROM public.user_subscriptions
    WHERE user_id = p_user_id AND status = 'active';
    
    IF subscription_id_val IS NULL THEN
        RETURN false; -- No active subscription
    END IF;
    
    -- Get or create current usage record
    SELECT id INTO usage_id_val
    FROM public.subscription_usage
    WHERE subscription_id = subscription_id_val AND is_current_period = true;
    
    IF usage_id_val IS NULL THEN
        -- Create new usage record for current period
        INSERT INTO public.subscription_usage (
            subscription_id,
            period_start,
            period_end,
            is_current_period
        )
        SELECT 
            subscription_id_val,
            current_period_start,
            current_period_end,
            true
        FROM public.user_subscriptions
        WHERE id = subscription_id_val
        RETURNING id INTO usage_id_val;
    END IF;
    
    -- Increment the appropriate counter
    CASE p_usage_type
        WHEN 'hs_codes' THEN
            UPDATE public.subscription_usage 
            SET hs_codes_count = hs_codes_count + p_increment
            WHERE id = usage_id_val;
        WHEN 'api_calls' THEN
            UPDATE public.subscription_usage 
            SET api_calls_count = api_calls_count + p_increment
            WHERE id = usage_id_val;
        WHEN 'alerts' THEN
            UPDATE public.subscription_usage 
            SET alerts_sent_count = alerts_sent_count + p_increment
            WHERE id = usage_id_val;
        WHEN 'webhooks' THEN
            UPDATE public.subscription_usage 
            SET webhook_deliveries_count = webhook_deliveries_count + p_increment
            WHERE id = usage_id_val;
        WHEN 'quotes' THEN
            UPDATE public.subscription_usage 
            SET quote_calculations_count = quote_calculations_count + p_increment
            WHERE id = usage_id_val;
        ELSE
            RETURN false; -- Invalid usage type
    END CASE;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to generate API key
CREATE OR REPLACE FUNCTION public.generate_api_key(
    p_user_id UUID,
    p_key_name TEXT,
    p_scopes TEXT[] DEFAULT ARRAY['read']
)
RETURNS TEXT AS $$
DECLARE
    api_key TEXT;
    key_hash TEXT;
    key_prefix TEXT;
BEGIN
    -- Generate a random API key (format: tg_sk_live_...)
    api_key := 'tg_sk_live_' || encode(gen_random_bytes(32), 'base64');
    api_key := replace(replace(api_key, '+', ''), '/', '');
    
    -- Create hash for storage
    key_hash := encode(digest(api_key, 'sha256'), 'hex');
    
    -- Create display prefix
    key_prefix := substring(api_key, 1, 12) || '...';
    
    -- Insert API key record
    INSERT INTO public.api_keys (
        user_id,
        key_name,
        key_hash,
        key_prefix,
        scopes
    ) VALUES (
        p_user_id,
        p_key_name,
        key_hash,
        key_prefix,
        p_scopes
    );
    
    RETURN api_key;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================
-- INITIAL DATA
-- ================================

-- Insert default subscription plans
INSERT INTO public.subscription_plans (plan_code, plan_name, display_name, price_monthly, price_annually, max_hs_codes, max_users, max_alerts_per_month, max_api_calls_per_month, max_webhooks, max_quote_calculations_per_month, features) VALUES
('free', 'Free', 'Free Tier', 0.00, 0.00, 2, 1, 10, 0, 0, 50, '{"email_alerts": true, "sms_alerts": false, "api_access": false, "webhook_alerts": false, "csv_export": false, "priority_support": false}'),
('professional', 'Professional', 'Professional', 99.00, 990.00, 10, 1, 100, 1000, 1, 500, '{"email_alerts": true, "sms_alerts": true, "api_access": false, "webhook_alerts": false, "csv_export": true, "priority_support": false}'),
('business', 'Business', 'Business', 299.00, 2990.00, 50, 5, 1000, 10000, 5, 2000, '{"email_alerts": true, "sms_alerts": true, "api_access": true, "webhook_alerts": true, "csv_export": true, "priority_support": true}'),
('enterprise', 'Enterprise', 'Enterprise', 999.00, 9990.00, 999999, 25, 999999, 100000, 25, 999999, '{"email_alerts": true, "sms_alerts": true, "api_access": true, "webhook_alerts": true, "csv_export": true, "priority_support": true, "white_label": true, "sla": true}');

-- ================================
-- TABLE COMMENTS
-- ================================

COMMENT ON TABLE public.subscription_plans IS 'Available subscription plans with limits and pricing';
COMMENT ON TABLE public.user_subscriptions IS 'User subscription status and billing information';
COMMENT ON TABLE public.subscription_usage IS 'Track usage against subscription limits per billing period';
COMMENT ON TABLE public.billing_transactions IS 'All billing transactions and payment history';
COMMENT ON TABLE public.api_keys IS 'API keys for programmatic access';
COMMENT ON TABLE public.api_usage_log IS 'Detailed API usage logging for billing and analytics';
COMMENT ON TABLE public.webhook_endpoints IS 'User-configured webhook endpoints for notifications';
COMMENT ON TABLE public.webhook_deliveries IS 'Track webhook delivery attempts and results';
COMMENT ON TABLE public.team_members IS 'Team account members and role-based access control';
COMMENT ON TABLE public.usage_alerts IS 'Alerts for approaching or exceeding subscription limits';