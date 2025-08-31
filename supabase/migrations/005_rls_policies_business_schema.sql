-- ================================
-- ROW LEVEL SECURITY POLICIES - BUSINESS SCHEMA
-- ================================
-- This migration enables Row Level Security and creates comprehensive policies
-- for all business tables created in migrations 003 and 004
-- Version: 1.0.0
-- Date: 2025-01-30

-- ================================
-- ENABLE RLS ON ALL BUSINESS TABLES
-- ================================

-- Core business tables
ALTER TABLE public.hs_codes_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_hs_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tariff_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_calculations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_source_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monitoring_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.federal_register_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_configuration ENABLE ROW LEVEL SECURITY;

-- Subscription and billing tables
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_usage_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_alerts ENABLE ROW LEVEL SECURITY;

-- ================================
-- HS CODES MASTER RLS POLICIES
-- ================================

-- Everyone can read HS codes master data (public reference data)
CREATE POLICY "HS codes master is publicly readable" ON public.hs_codes_master
    FOR SELECT USING (true);

-- Service role can manage HS codes master data
CREATE POLICY "Service role can manage HS codes master" ON public.hs_codes_master
    FOR ALL USING (
        current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
    );

-- ================================
-- USER HS CODES RLS POLICIES
-- ================================

-- Users can view their own HS codes
CREATE POLICY "Users can view own HS codes" ON public.user_hs_codes
    FOR SELECT USING (
        auth.uid() = user_id OR 
        public.can_access_user_data(auth.uid(), user_id)
    );

-- Users can insert their own HS codes (with subscription limit checks)
CREATE POLICY "Users can insert own HS codes" ON public.user_hs_codes
    FOR INSERT WITH CHECK (
        auth.uid() = user_id AND
        public.can_add_hs_code(auth.uid())
    );

-- Users can update their own HS codes
CREATE POLICY "Users can update own HS codes" ON public.user_hs_codes
    FOR UPDATE USING (
        auth.uid() = user_id OR 
        public.can_access_user_data(auth.uid(), user_id)
    )
    WITH CHECK (
        auth.uid() = user_id OR 
        public.can_access_user_data(auth.uid(), user_id)
    );

-- Users can delete their own HS codes
CREATE POLICY "Users can delete own HS codes" ON public.user_hs_codes
    FOR DELETE USING (
        auth.uid() = user_id OR 
        public.can_access_user_data(auth.uid(), user_id)
    );

-- Service role can manage all user HS codes
CREATE POLICY "Service role can manage all user HS codes" ON public.user_hs_codes
    FOR ALL USING (
        current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
    );

-- ================================
-- TARIFF RATES RLS POLICIES
-- ================================

-- Authenticated users can read tariff rates (public government data)
CREATE POLICY "Authenticated users can read tariff rates" ON public.tariff_rates
    FOR SELECT USING (auth.role() = 'authenticated');

-- Service role can manage tariff rates
CREATE POLICY "Service role can manage tariff rates" ON public.tariff_rates
    FOR ALL USING (
        current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
    );

-- ================================
-- RATE CHANGES RLS POLICIES
-- ================================

-- Users can view rate changes for their monitored HS codes
CREATE POLICY "Users can view relevant rate changes" ON public.rate_changes
    FOR SELECT USING (
        auth.role() = 'authenticated' AND (
            -- User monitors this HS code
            EXISTS (
                SELECT 1 FROM public.user_hs_codes uhc
                JOIN public.hs_codes_master hcm ON uhc.hs_code_id = hcm.id
                WHERE uhc.user_id = auth.uid() 
                AND uhc.monitoring_enabled = true 
                AND hcm.hs_code = public.rate_changes.hs_code
            ) OR
            -- Service role can see all
            current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
        )
    );

-- Service role can manage rate changes
CREATE POLICY "Service role can manage rate changes" ON public.rate_changes
    FOR ALL USING (
        current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
    );

-- ================================
-- USER ALERTS RLS POLICIES
-- ================================

-- Users can view their own alerts
CREATE POLICY "Users can view own alerts" ON public.user_alerts
    FOR SELECT USING (
        auth.uid() = user_id OR 
        public.can_access_user_data(auth.uid(), user_id)
    );

-- Users can update their own alerts (acknowledge, dismiss)
CREATE POLICY "Users can update own alerts" ON public.user_alerts
    FOR UPDATE USING (
        auth.uid() = user_id OR 
        public.can_access_user_data(auth.uid(), user_id)
    );

-- Service role can manage all alerts
CREATE POLICY "Service role can manage all alerts" ON public.user_alerts
    FOR ALL USING (
        current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
    );

-- ================================
-- QUOTE CALCULATIONS RLS POLICIES
-- ================================

-- Users can view their own quote calculations
CREATE POLICY "Users can view own quote calculations" ON public.quote_calculations
    FOR SELECT USING (
        auth.uid() = user_id OR 
        public.can_access_user_data(auth.uid(), user_id)
    );

-- Users can insert their own quote calculations
CREATE POLICY "Users can insert own quote calculations" ON public.quote_calculations
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own quote calculations
CREATE POLICY "Users can update own quote calculations" ON public.quote_calculations
    FOR UPDATE USING (
        auth.uid() = user_id OR 
        public.can_access_user_data(auth.uid(), user_id)
    );

-- Users can delete their own quote calculations
CREATE POLICY "Users can delete own quote calculations" ON public.quote_calculations
    FOR DELETE USING (
        auth.uid() = user_id OR 
        public.can_access_user_data(auth.uid(), user_id)
    );

-- Service role can manage all quote calculations
CREATE POLICY "Service role can manage all quote calculations" ON public.quote_calculations
    FOR ALL USING (
        current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
    );

-- ================================
-- DATA SOURCE STATUS RLS POLICIES
-- ================================

-- Authenticated users can view data source status (system health)
CREATE POLICY "Authenticated users can view data source status" ON public.data_source_status
    FOR SELECT USING (auth.role() = 'authenticated');

-- Service role can manage data source status
CREATE POLICY "Service role can manage data source status" ON public.data_source_status
    FOR ALL USING (
        current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
    );

-- ================================
-- MONITORING JOBS RLS POLICIES
-- ================================

-- Authenticated users can view monitoring jobs (system transparency)
CREATE POLICY "Authenticated users can view monitoring jobs" ON public.monitoring_jobs
    FOR SELECT USING (auth.role() = 'authenticated');

-- Service role can manage monitoring jobs
CREATE POLICY "Service role can manage monitoring jobs" ON public.monitoring_jobs
    FOR ALL USING (
        current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
    );

-- ================================
-- FEDERAL REGISTER ENTRIES RLS POLICIES
-- ================================

-- Authenticated users can view Federal Register entries
CREATE POLICY "Authenticated users can view federal register entries" ON public.federal_register_entries
    FOR SELECT USING (auth.role() = 'authenticated');

-- Service role can manage Federal Register entries
CREATE POLICY "Service role can manage federal register entries" ON public.federal_register_entries
    FOR ALL USING (
        current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
    );

-- ================================
-- SYSTEM CONFIGURATION RLS POLICIES
-- ================================

-- Only service role and admins can view system configuration
CREATE POLICY "Admins can view system configuration" ON public.system_configuration
    FOR SELECT USING (
        current_setting('request.jwt.claims', true)::json->>'role' = 'service_role' OR
        public.is_admin()
    );

-- Only service role can modify system configuration
CREATE POLICY "Service role can manage system configuration" ON public.system_configuration
    FOR ALL USING (
        current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
    );

-- ================================
-- SUBSCRIPTION PLANS RLS POLICIES
-- ================================

-- Everyone can view active subscription plans (public pricing)
CREATE POLICY "Public can view active subscription plans" ON public.subscription_plans
    FOR SELECT USING (is_active = true AND is_public = true);

-- Authenticated users can view all plans
CREATE POLICY "Authenticated users can view all subscription plans" ON public.subscription_plans
    FOR SELECT USING (auth.role() = 'authenticated');

-- Service role can manage subscription plans
CREATE POLICY "Service role can manage subscription plans" ON public.subscription_plans
    FOR ALL USING (
        current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
    );

-- ================================
-- USER SUBSCRIPTIONS RLS POLICIES
-- ================================

-- Users can view their own subscription
CREATE POLICY "Users can view own subscription" ON public.user_subscriptions
    FOR SELECT USING (
        auth.uid() = user_id OR 
        public.can_access_user_data(auth.uid(), user_id)
    );

-- Users can update their own subscription (cancel, modify)
CREATE POLICY "Users can update own subscription" ON public.user_subscriptions
    FOR UPDATE USING (auth.uid() = user_id);

-- Service role can manage all subscriptions
CREATE POLICY "Service role can manage all subscriptions" ON public.user_subscriptions
    FOR ALL USING (
        current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
    );

-- ================================
-- SUBSCRIPTION USAGE RLS POLICIES
-- ================================

-- Users can view their own subscription usage
CREATE POLICY "Users can view own subscription usage" ON public.subscription_usage
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_subscriptions us
            WHERE us.id = public.subscription_usage.subscription_id
            AND (us.user_id = auth.uid() OR public.can_access_user_data(auth.uid(), us.user_id))
        )
    );

-- Service role can manage all subscription usage
CREATE POLICY "Service role can manage subscription usage" ON public.subscription_usage
    FOR ALL USING (
        current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
    );

-- ================================
-- BILLING TRANSACTIONS RLS POLICIES
-- ================================

-- Users can view their own billing transactions
CREATE POLICY "Users can view own billing transactions" ON public.billing_transactions
    FOR SELECT USING (
        auth.uid() = user_id OR 
        public.can_access_user_data(auth.uid(), user_id)
    );

-- Service role can manage all billing transactions
CREATE POLICY "Service role can manage billing transactions" ON public.billing_transactions
    FOR ALL USING (
        current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
    );

-- ================================
-- API KEYS RLS POLICIES
-- ================================

-- Users can view their own API keys
CREATE POLICY "Users can view own API keys" ON public.api_keys
    FOR SELECT USING (
        auth.uid() = user_id OR 
        public.can_access_user_data(auth.uid(), user_id)
    );

-- Users can manage their own API keys
CREATE POLICY "Users can manage own API keys" ON public.api_keys
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own API keys" ON public.api_keys
    FOR UPDATE USING (
        auth.uid() = user_id OR 
        public.can_access_user_data(auth.uid(), user_id)
    );

CREATE POLICY "Users can delete own API keys" ON public.api_keys
    FOR DELETE USING (
        auth.uid() = user_id OR 
        public.can_access_user_data(auth.uid(), user_id)
    );

-- Service role can manage all API keys
CREATE POLICY "Service role can manage API keys" ON public.api_keys
    FOR ALL USING (
        current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
    );

-- ================================
-- API USAGE LOG RLS POLICIES
-- ================================

-- Users can view their own API usage
CREATE POLICY "Users can view own API usage" ON public.api_usage_log
    FOR SELECT USING (
        auth.uid() = user_id OR 
        public.can_access_user_data(auth.uid(), user_id)
    );

-- Service role can view and manage all API usage
CREATE POLICY "Service role can manage API usage log" ON public.api_usage_log
    FOR ALL USING (
        current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
    );

-- ================================
-- WEBHOOK ENDPOINTS RLS POLICIES
-- ================================

-- Users can view their own webhook endpoints
CREATE POLICY "Users can view own webhook endpoints" ON public.webhook_endpoints
    FOR SELECT USING (
        auth.uid() = user_id OR 
        public.can_access_user_data(auth.uid(), user_id)
    );

-- Users can manage their own webhook endpoints
CREATE POLICY "Users can manage own webhook endpoints" ON public.webhook_endpoints
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own webhook endpoints" ON public.webhook_endpoints
    FOR UPDATE USING (
        auth.uid() = user_id OR 
        public.can_access_user_data(auth.uid(), user_id)
    );

CREATE POLICY "Users can delete own webhook endpoints" ON public.webhook_endpoints
    FOR DELETE USING (
        auth.uid() = user_id OR 
        public.can_access_user_data(auth.uid(), user_id)
    );

-- Service role can manage all webhook endpoints
CREATE POLICY "Service role can manage webhook endpoints" ON public.webhook_endpoints
    FOR ALL USING (
        current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
    );

-- ================================
-- WEBHOOK DELIVERIES RLS POLICIES
-- ================================

-- Users can view their own webhook deliveries
CREATE POLICY "Users can view own webhook deliveries" ON public.webhook_deliveries
    FOR SELECT USING (
        auth.uid() = user_id OR 
        public.can_access_user_data(auth.uid(), user_id)
    );

-- Service role can manage all webhook deliveries
CREATE POLICY "Service role can manage webhook deliveries" ON public.webhook_deliveries
    FOR ALL USING (
        current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
    );

-- ================================
-- TEAM MEMBERS RLS POLICIES
-- ================================

-- Team owners can view their team members
CREATE POLICY "Team owners can view their members" ON public.team_members
    FOR SELECT USING (auth.uid() = team_owner_id);

-- Team members can view their own membership
CREATE POLICY "Team members can view their membership" ON public.team_members
    FOR SELECT USING (auth.uid() = member_user_id);

-- Team owners can manage their team members
CREATE POLICY "Team owners can manage team members" ON public.team_members
    FOR INSERT WITH CHECK (auth.uid() = team_owner_id);

CREATE POLICY "Team owners can update team members" ON public.team_members
    FOR UPDATE USING (auth.uid() = team_owner_id);

CREATE POLICY "Team owners can remove team members" ON public.team_members
    FOR DELETE USING (auth.uid() = team_owner_id);

-- Team members can update their own acceptance status
CREATE POLICY "Team members can update own status" ON public.team_members
    FOR UPDATE USING (auth.uid() = member_user_id)
    WITH CHECK (
        auth.uid() = member_user_id AND 
        OLD.status = 'pending' AND 
        NEW.status = 'active'
    );

-- Service role can manage all team memberships
CREATE POLICY "Service role can manage team members" ON public.team_members
    FOR ALL USING (
        current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
    );

-- ================================
-- USAGE ALERTS RLS POLICIES
-- ================================

-- Users can view their own usage alerts
CREATE POLICY "Users can view own usage alerts" ON public.usage_alerts
    FOR SELECT USING (
        auth.uid() = user_id OR 
        public.can_access_user_data(auth.uid(), user_id)
    );

-- Users can acknowledge their own usage alerts
CREATE POLICY "Users can acknowledge own usage alerts" ON public.usage_alerts
    FOR UPDATE USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Service role can manage all usage alerts
CREATE POLICY "Service role can manage usage alerts" ON public.usage_alerts
    FOR ALL USING (
        current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
    );

-- ================================
-- UTILITY FUNCTIONS FOR RLS
-- ================================

-- Function to check if user can access another user's data (team member)
CREATE OR REPLACE FUNCTION public.can_access_user_data(accessing_user_id UUID, target_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- User can always access their own data
    IF accessing_user_id = target_user_id THEN
        RETURN true;
    END IF;
    
    -- Check if accessing user is a team member with appropriate permissions
    RETURN EXISTS (
        SELECT 1 FROM public.team_members tm
        WHERE tm.team_owner_id = target_user_id
        AND tm.member_user_id = accessing_user_id
        AND tm.status = 'active'
        AND tm.role IN ('admin', 'editor')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user can add more HS codes
CREATE OR REPLACE FUNCTION public.can_add_hs_code(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    limit_check RECORD;
BEGIN
    -- Get current usage and limits
    SELECT * INTO limit_check
    FROM public.check_subscription_limit(p_user_id, 'hs_codes');
    
    -- Allow if under limit
    RETURN NOT limit_check.is_over_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has specific feature access
CREATE OR REPLACE FUNCTION public.has_feature_access(p_user_id UUID, p_feature TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    subscription_record RECORD;
BEGIN
    -- Get user's current subscription and plan
    SELECT us.*, sp.features
    INTO subscription_record
    FROM public.user_subscriptions us
    JOIN public.subscription_plans sp ON us.plan_id = sp.id
    WHERE us.user_id = p_user_id AND us.status = 'active';
    
    IF NOT FOUND THEN
        -- No active subscription, check free tier features
        SELECT features INTO subscription_record
        FROM public.subscription_plans
        WHERE plan_code = 'free'
        LIMIT 1;
        
        IF NOT FOUND THEN
            RETURN false;
        END IF;
    END IF;
    
    -- Check if feature is enabled in the plan
    RETURN COALESCE((subscription_record.features->>p_feature)::boolean, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's effective role (considering team memberships)
CREATE OR REPLACE FUNCTION public.get_user_role_for_data(p_user_id UUID, p_data_owner_id UUID)
RETURNS TEXT AS $$
BEGIN
    -- Owner always has full access
    IF p_user_id = p_data_owner_id THEN
        RETURN 'owner';
    END IF;
    
    -- Check team membership
    SELECT tm.role INTO result
    FROM public.team_members tm
    WHERE tm.team_owner_id = p_data_owner_id
    AND tm.member_user_id = p_user_id
    AND tm.status = 'active';
    
    IF FOUND THEN
        RETURN result;
    END IF;
    
    RETURN 'none';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================
-- COMMENTS FOR DOCUMENTATION
-- ================================

COMMENT ON POLICY "Users can view own HS codes" ON public.user_hs_codes IS 'Users can view their own monitored HS codes and team members with appropriate permissions';
COMMENT ON POLICY "Users can insert own HS codes" ON public.user_hs_codes IS 'Users can add HS codes within their subscription limits';
COMMENT ON POLICY "Users can view relevant rate changes" ON public.rate_changes IS 'Users can only view rate changes for HS codes they are monitoring';
COMMENT ON POLICY "Users can view own alerts" ON public.user_alerts IS 'Users can view alerts generated for their monitored products';
COMMENT ON POLICY "Users can view own subscription" ON public.user_subscriptions IS 'Users can view their subscription status and team members with permissions';
COMMENT ON POLICY "Users can view own API keys" ON public.api_keys IS 'Users can manage their API keys for programmatic access';
COMMENT ON POLICY "Team owners can view their members" ON public.team_members IS 'Team owners can manage their team member access and permissions';

-- Function to validate RLS policies are working correctly
CREATE OR REPLACE FUNCTION public.test_rls_policies()
RETURNS TABLE (
    table_name TEXT,
    policy_count INTEGER,
    has_service_role_policy BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        schemaname || '.' || tablename as table_name,
        COUNT(*)::INTEGER as policy_count,
        COUNT(*) FILTER (WHERE cmd LIKE '%service_role%') > 0 as has_service_role_policy
    FROM pg_policies 
    WHERE schemaname = 'public'
    AND tablename IN (
        'hs_codes_master', 'user_hs_codes', 'tariff_rates', 'rate_changes', 
        'user_alerts', 'quote_calculations', 'data_source_status', 
        'monitoring_jobs', 'federal_register_entries', 'system_configuration',
        'subscription_plans', 'user_subscriptions', 'subscription_usage',
        'billing_transactions', 'api_keys', 'api_usage_log',
        'webhook_endpoints', 'webhook_deliveries', 'team_members', 'usage_alerts'
    )
    GROUP BY schemaname, tablename
    ORDER BY table_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;