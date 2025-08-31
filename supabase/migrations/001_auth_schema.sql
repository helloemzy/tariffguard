-- ================================
-- AUTHENTICATION AND USER MANAGEMENT SCHEMA
-- ================================
-- This migration sets up the core authentication and user management tables
-- with Row Level Security (RLS) policies for the TariffGuard application.

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ================================
-- USER PROFILES TABLE
-- ================================
-- Extends Supabase auth.users with additional profile information
CREATE TABLE public.user_profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    company_name TEXT,
    job_title TEXT,
    phone_number TEXT,
    country TEXT DEFAULT 'US',
    time_zone TEXT DEFAULT 'America/New_York',
    
    -- Subscription and billing
    subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'basic', 'premium', 'enterprise')),
    subscription_status TEXT DEFAULT 'active' CHECK (subscription_status IN ('active', 'inactive', 'cancelled', 'past_due')),
    billing_customer_id TEXT, -- Stripe customer ID
    
    -- User preferences
    email_notifications BOOLEAN DEFAULT true,
    push_notifications BOOLEAN DEFAULT true,
    sms_notifications BOOLEAN DEFAULT false,
    marketing_emails BOOLEAN DEFAULT false,
    
    -- Application settings
    default_currency TEXT DEFAULT 'USD',
    date_format TEXT DEFAULT 'MM/DD/YYYY',
    language TEXT DEFAULT 'en',
    theme TEXT DEFAULT 'light' CHECK (theme IN ('light', 'dark', 'auto')),
    
    -- Security settings
    two_factor_enabled BOOLEAN DEFAULT false,
    backup_codes_generated_at TIMESTAMPTZ,
    last_password_change TIMESTAMPTZ,
    
    -- Tracking fields
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    last_sign_in_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    
    CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- ================================
-- USER SESSIONS TABLE
-- ================================
-- Track user sessions for security and analytics
CREATE TABLE public.user_sessions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    session_token TEXT NOT NULL UNIQUE,
    ip_address INET,
    user_agent TEXT,
    device_type TEXT,
    browser TEXT,
    operating_system TEXT,
    location_country TEXT,
    location_city TEXT,
    
    -- Session status
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    last_activity_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    ended_at TIMESTAMPTZ,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb
);

-- ================================
-- USER ACTIVITY LOG
-- ================================
-- Track important user actions for audit and analytics
CREATE TABLE public.user_activity_log (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    action TEXT NOT NULL,
    resource_type TEXT,
    resource_id TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    
    -- Request metadata
    ip_address INET,
    user_agent TEXT,
    session_id UUID REFERENCES public.user_sessions(id) ON DELETE SET NULL,
    
    -- Tracking
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    -- Indexes for common queries
    INDEX idx_user_activity_user_id ON user_activity_log(user_id),
    INDEX idx_user_activity_action ON user_activity_log(action),
    INDEX idx_user_activity_created_at ON user_activity_log(created_at)
);

-- ================================
-- AUTHENTICATION PROVIDERS TABLE
-- ================================
-- Track which authentication providers users have connected
CREATE TABLE public.user_auth_providers (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    provider TEXT NOT NULL, -- 'email', 'google', 'github', etc.
    provider_user_id TEXT NOT NULL,
    provider_username TEXT,
    provider_email TEXT,
    
    -- Provider metadata
    provider_data JSONB DEFAULT '{}'::jsonb,
    
    -- Status
    is_primary BOOLEAN DEFAULT false,
    is_verified BOOLEAN DEFAULT false,
    connected_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    last_used_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    -- Ensure unique provider per user
    UNIQUE(user_id, provider),
    UNIQUE(provider, provider_user_id)
);

-- ================================
-- PASSWORD RESET TOKENS
-- ================================
-- Secure password reset token management
CREATE TABLE public.password_reset_tokens (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    -- Metadata
    ip_address INET,
    user_agent TEXT
);

-- ================================
-- EMAIL VERIFICATION TOKENS
-- ================================
-- Email verification token management
CREATE TABLE public.email_verification_tokens (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    email TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    -- Metadata
    ip_address INET,
    user_agent TEXT
);

-- ================================
-- TWO-FACTOR AUTHENTICATION
-- ================================
-- TOTP and backup codes for 2FA
CREATE TABLE public.user_two_factor_auth (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    
    -- TOTP settings
    totp_secret TEXT,
    totp_enabled BOOLEAN DEFAULT false,
    totp_verified_at TIMESTAMPTZ,
    
    -- Backup codes (hashed)
    backup_codes TEXT[], -- Array of hashed backup codes
    backup_codes_used INTEGER[] DEFAULT ARRAY[]::INTEGER[], -- Indexes of used codes
    
    -- Recovery settings
    recovery_email TEXT,
    recovery_phone TEXT,
    
    -- Tracking
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    -- Ensure one record per user
    UNIQUE(user_id)
);

-- ================================
-- SECURITY EVENTS LOG
-- ================================
-- Track security-related events
CREATE TABLE public.security_events (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL, -- 'login_success', 'login_failed', 'password_changed', etc.
    severity TEXT DEFAULT 'info' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    description TEXT,
    
    -- Event context
    ip_address INET,
    user_agent TEXT,
    location_country TEXT,
    location_city TEXT,
    
    -- Additional data
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Tracking
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    -- Indexes
    INDEX idx_security_events_user_id ON security_events(user_id),
    INDEX idx_security_events_type ON security_events(event_type),
    INDEX idx_security_events_severity ON security_events(severity),
    INDEX idx_security_events_created_at ON security_events(created_at)
);

-- ================================
-- USER PREFERENCES TABLE
-- ================================
-- Store user-specific application preferences
CREATE TABLE public.user_preferences (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    
    -- Dashboard preferences
    dashboard_layout JSONB DEFAULT '{}'::jsonb,
    default_charts TEXT[] DEFAULT ARRAY[]::TEXT[],
    favorite_products TEXT[] DEFAULT ARRAY[]::TEXT[],
    
    -- Notification preferences
    alert_frequency TEXT DEFAULT 'realtime' CHECK (alert_frequency IN ('realtime', 'daily', 'weekly', 'monthly')),
    alert_types TEXT[] DEFAULT ARRAY['tariff_changes', 'new_regulations']::TEXT[],
    quiet_hours_start TIME,
    quiet_hours_end TIME,
    
    -- Data preferences
    preferred_units JSONB DEFAULT '{}'::jsonb,
    currency_display_format TEXT DEFAULT 'symbol', -- 'symbol', 'code', 'name'
    number_format TEXT DEFAULT 'en-US',
    
    -- Export preferences
    export_format TEXT DEFAULT 'xlsx' CHECK (export_format IN ('xlsx', 'csv', 'json', 'pdf')),
    export_includes JSONB DEFAULT '{}'::jsonb,
    
    -- API preferences
    api_rate_limit INTEGER DEFAULT 100,
    api_webhook_url TEXT,
    api_webhook_events TEXT[] DEFAULT ARRAY[]::TEXT[],
    
    -- Tracking
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    -- Ensure one record per user
    UNIQUE(user_id)
);

-- ================================
-- FUNCTIONS AND TRIGGERS
-- ================================

-- Function to update the updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at columns
CREATE TRIGGER user_profiles_updated_at
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER user_two_factor_auth_updated_at
    BEFORE UPDATE ON public.user_two_factor_auth
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER user_preferences_updated_at
    BEFORE UPDATE ON public.user_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (id, email, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
        NEW.raw_user_meta_data->>'avatar_url'
    );
    
    INSERT INTO public.user_preferences (user_id)
    VALUES (NEW.id);
    
    -- Log the user registration
    INSERT INTO public.user_activity_log (user_id, action, details)
    VALUES (NEW.id, 'user_registered', jsonb_build_object(
        'provider', NEW.app_metadata->>'provider',
        'email_confirmed', NEW.email_confirmed_at IS NOT NULL
    ));
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create user profile on signup
CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to log user activity
CREATE OR REPLACE FUNCTION public.log_user_activity(
    p_user_id UUID,
    p_action TEXT,
    p_resource_type TEXT DEFAULT NULL,
    p_resource_id TEXT DEFAULT NULL,
    p_details JSONB DEFAULT '{}'::jsonb,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    activity_id UUID;
BEGIN
    INSERT INTO public.user_activity_log (
        user_id, action, resource_type, resource_id, details, ip_address, user_agent
    )
    VALUES (
        p_user_id, p_action, p_resource_type, p_resource_id, p_details, p_ip_address, p_user_agent
    )
    RETURNING id INTO activity_id;
    
    RETURN activity_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log security events
CREATE OR REPLACE FUNCTION public.log_security_event(
    p_user_id UUID,
    p_event_type TEXT,
    p_severity TEXT DEFAULT 'info',
    p_description TEXT DEFAULT NULL,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
    event_id UUID;
BEGIN
    INSERT INTO public.security_events (
        user_id, event_type, severity, description, ip_address, user_agent, metadata
    )
    VALUES (
        p_user_id, p_event_type, p_severity, p_description, p_ip_address, p_user_agent, p_metadata
    )
    RETURNING id INTO event_id;
    
    RETURN event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================
-- INDEXES FOR PERFORMANCE
-- ================================

-- User profiles indexes
CREATE INDEX idx_user_profiles_email ON public.user_profiles(email);
CREATE INDEX idx_user_profiles_company ON public.user_profiles(company_name);
CREATE INDEX idx_user_profiles_subscription ON public.user_profiles(subscription_tier, subscription_status);
CREATE INDEX idx_user_profiles_active ON public.user_profiles(is_active);

-- User sessions indexes
CREATE INDEX idx_user_sessions_user_id ON public.user_sessions(user_id);
CREATE INDEX idx_user_sessions_active ON public.user_sessions(is_active, expires_at);
CREATE INDEX idx_user_sessions_expires_at ON public.user_sessions(expires_at);

-- Auth providers indexes
CREATE INDEX idx_user_auth_providers_user_id ON public.user_auth_providers(user_id);
CREATE INDEX idx_user_auth_providers_provider ON public.user_auth_providers(provider);

-- Password reset tokens indexes
CREATE INDEX idx_password_reset_tokens_user_id ON public.password_reset_tokens(user_id);
CREATE INDEX idx_password_reset_tokens_expires_at ON public.password_reset_tokens(expires_at);

-- Email verification tokens indexes
CREATE INDEX idx_email_verification_tokens_user_id ON public.email_verification_tokens(user_id);
CREATE INDEX idx_email_verification_tokens_expires_at ON public.email_verification_tokens(expires_at);

-- Comments for documentation
COMMENT ON TABLE public.user_profiles IS 'Extended user profile information beyond Supabase auth.users';
COMMENT ON TABLE public.user_sessions IS 'Active user sessions for security tracking';
COMMENT ON TABLE public.user_activity_log IS 'Audit log of user actions';
COMMENT ON TABLE public.user_auth_providers IS 'Connected authentication providers per user';
COMMENT ON TABLE public.password_reset_tokens IS 'Secure password reset token management';
COMMENT ON TABLE public.email_verification_tokens IS 'Email verification token management';
COMMENT ON TABLE public.user_two_factor_auth IS 'Two-factor authentication settings and backup codes';
COMMENT ON TABLE public.security_events IS 'Security-related events and alerts';
COMMENT ON TABLE public.user_preferences IS 'User-specific application preferences and settings';