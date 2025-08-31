-- ================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ================================
-- This migration enables Row Level Security and creates comprehensive policies
-- for all authentication and user management tables.

-- ================================
-- ENABLE RLS ON ALL TABLES
-- ================================

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_auth_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_verification_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_two_factor_auth ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- ================================
-- USER PROFILES RLS POLICIES
-- ================================

-- Users can view their own profile
CREATE POLICY "Users can view own profile" ON public.user_profiles
    FOR SELECT USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON public.user_profiles
    FOR UPDATE USING (auth.uid() = id);

-- Users can insert their own profile (handled by trigger, but allow for manual creation)
CREATE POLICY "Users can insert own profile" ON public.user_profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Service role can manage all profiles (for admin operations)
CREATE POLICY "Service role can manage all profiles" ON public.user_profiles
    FOR ALL USING (
        current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
    );

-- Authenticated users can view basic profile info of other users (for mentions, etc.)
CREATE POLICY "Authenticated users can view basic profile info" ON public.user_profiles
    FOR SELECT USING (
        auth.role() = 'authenticated' AND
        current_setting('app.current_user_id', true)::uuid IS NOT NULL
    );

-- ================================
-- USER SESSIONS RLS POLICIES
-- ================================

-- Users can view their own sessions
CREATE POLICY "Users can view own sessions" ON public.user_sessions
    FOR SELECT USING (auth.uid() = user_id);

-- Users can update their own sessions (for ending sessions)
CREATE POLICY "Users can update own sessions" ON public.user_sessions
    FOR UPDATE USING (auth.uid() = user_id);

-- Service role can manage all sessions
CREATE POLICY "Service role can manage all sessions" ON public.user_sessions
    FOR ALL USING (
        current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
    );

-- System can insert sessions
CREATE POLICY "System can insert sessions" ON public.user_sessions
    FOR INSERT WITH CHECK (
        auth.uid() = user_id OR
        current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
    );

-- ================================
-- USER ACTIVITY LOG RLS POLICIES
-- ================================

-- Users can view their own activity log
CREATE POLICY "Users can view own activity log" ON public.user_activity_log
    FOR SELECT USING (auth.uid() = user_id);

-- Service role can manage all activity logs
CREATE POLICY "Service role can manage all activity logs" ON public.user_activity_log
    FOR ALL USING (
        current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
    );

-- System can insert activity logs
CREATE POLICY "System can insert activity logs" ON public.user_activity_log
    FOR INSERT WITH CHECK (
        auth.uid() = user_id OR
        current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
    );

-- ================================
-- USER AUTH PROVIDERS RLS POLICIES
-- ================================

-- Users can view their own auth providers
CREATE POLICY "Users can view own auth providers" ON public.user_auth_providers
    FOR SELECT USING (auth.uid() = user_id);

-- Users can update their own auth providers
CREATE POLICY "Users can update own auth providers" ON public.user_auth_providers
    FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own auth providers
CREATE POLICY "Users can delete own auth providers" ON public.user_auth_providers
    FOR DELETE USING (auth.uid() = user_id);

-- Service role can manage all auth providers
CREATE POLICY "Service role can manage all auth providers" ON public.user_auth_providers
    FOR ALL USING (
        current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
    );

-- System can insert auth providers
CREATE POLICY "System can insert auth providers" ON public.user_auth_providers
    FOR INSERT WITH CHECK (
        auth.uid() = user_id OR
        current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
    );

-- ================================
-- PASSWORD RESET TOKENS RLS POLICIES
-- ================================

-- Service role can manage all password reset tokens
CREATE POLICY "Service role can manage password reset tokens" ON public.password_reset_tokens
    FOR ALL USING (
        current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
    );

-- System can insert password reset tokens (for password reset flow)
CREATE POLICY "System can insert password reset tokens" ON public.password_reset_tokens
    FOR INSERT WITH CHECK (true); -- Allow system to create tokens

-- Users can view their own password reset tokens (for validation)
CREATE POLICY "Users can view own password reset tokens" ON public.password_reset_tokens
    FOR SELECT USING (auth.uid() = user_id);

-- ================================
-- EMAIL VERIFICATION TOKENS RLS POLICIES
-- ================================

-- Service role can manage all email verification tokens
CREATE POLICY "Service role can manage email verification tokens" ON public.email_verification_tokens
    FOR ALL USING (
        current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
    );

-- System can insert email verification tokens
CREATE POLICY "System can insert email verification tokens" ON public.email_verification_tokens
    FOR INSERT WITH CHECK (true); -- Allow system to create tokens

-- Users can view their own email verification tokens
CREATE POLICY "Users can view own email verification tokens" ON public.email_verification_tokens
    FOR SELECT USING (auth.uid() = user_id);

-- ================================
-- TWO-FACTOR AUTH RLS POLICIES
-- ================================

-- Users can view their own 2FA settings
CREATE POLICY "Users can view own 2FA settings" ON public.user_two_factor_auth
    FOR SELECT USING (auth.uid() = user_id);

-- Users can update their own 2FA settings
CREATE POLICY "Users can update own 2FA settings" ON public.user_two_factor_auth
    FOR UPDATE USING (auth.uid() = user_id);

-- Users can insert their own 2FA settings
CREATE POLICY "Users can insert own 2FA settings" ON public.user_two_factor_auth
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can delete their own 2FA settings
CREATE POLICY "Users can delete own 2FA settings" ON public.user_two_factor_auth
    FOR DELETE USING (auth.uid() = user_id);

-- Service role can manage all 2FA settings
CREATE POLICY "Service role can manage all 2FA settings" ON public.user_two_factor_auth
    FOR ALL USING (
        current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
    );

-- ================================
-- SECURITY EVENTS RLS POLICIES
-- ================================

-- Users can view their own security events
CREATE POLICY "Users can view own security events" ON public.security_events
    FOR SELECT USING (auth.uid() = user_id);

-- Service role can manage all security events
CREATE POLICY "Service role can manage all security events" ON public.security_events
    FOR ALL USING (
        current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
    );

-- System can insert security events
CREATE POLICY "System can insert security events" ON public.security_events
    FOR INSERT WITH CHECK (
        auth.uid() = user_id OR
        current_setting('request.jwt.claims', true)::json->>'role' = 'service_role' OR
        user_id IS NULL -- Allow system-wide events
    );

-- ================================
-- USER PREFERENCES RLS POLICIES
-- ================================

-- Users can view their own preferences
CREATE POLICY "Users can view own preferences" ON public.user_preferences
    FOR SELECT USING (auth.uid() = user_id);

-- Users can update their own preferences
CREATE POLICY "Users can update own preferences" ON public.user_preferences
    FOR UPDATE USING (auth.uid() = user_id);

-- Users can insert their own preferences
CREATE POLICY "Users can insert own preferences" ON public.user_preferences
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Service role can manage all preferences
CREATE POLICY "Service role can manage all preferences" ON public.user_preferences
    FOR ALL USING (
        current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
    );

-- ================================
-- UTILITY FUNCTIONS FOR RLS
-- ================================

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = auth.uid()
        AND metadata->>'role' = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has specific permission
CREATE OR REPLACE FUNCTION public.has_permission(permission TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = auth.uid()
        AND (
            metadata->>'role' = 'admin' OR
            metadata->'permissions' ? permission
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user can access resource
CREATE OR REPLACE FUNCTION public.can_access_resource(resource_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- User can access their own resources
    IF auth.uid() = resource_user_id THEN
        RETURN true;
    END IF;
    
    -- Admins can access all resources
    IF public.is_admin() THEN
        RETURN true;
    END IF;
    
    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================
-- RLS POLICIES FOR SHARED ACCESS
-- ================================

-- Policy for shared resource access (if needed in the future)
CREATE POLICY "Shared resource access" ON public.user_profiles
    FOR SELECT USING (
        -- Allow if user has explicit permission
        EXISTS (
            SELECT 1 FROM public.user_profiles up
            WHERE up.id = auth.uid()
            AND (
                up.metadata->'shared_access' ? public.user_profiles.id::text OR
                up.metadata->>'role' = 'admin'
            )
        )
    );

-- ================================
-- COMMENTS FOR DOCUMENTATION
-- ================================

COMMENT ON POLICY "Users can view own profile" ON public.user_profiles IS 'Users can only view their own profile data';
COMMENT ON POLICY "Users can update own profile" ON public.user_profiles IS 'Users can only update their own profile data';
COMMENT ON POLICY "Service role can manage all profiles" ON public.user_profiles IS 'Service role (backend) can manage all user profiles';

COMMENT ON POLICY "Users can view own sessions" ON public.user_sessions IS 'Users can only view their own active sessions';
COMMENT ON POLICY "Users can update own sessions" ON public.user_sessions IS 'Users can update their own sessions (e.g., to end them)';

COMMENT ON POLICY "Users can view own activity log" ON public.user_activity_log IS 'Users can view their own activity history';
COMMENT ON POLICY "System can insert activity logs" ON public.user_activity_log IS 'System can log user activities';

COMMENT ON POLICY "Users can view own auth providers" ON public.user_auth_providers IS 'Users can view their connected auth providers';
COMMENT ON POLICY "Users can update own auth providers" ON public.user_auth_providers IS 'Users can manage their connected auth providers';

COMMENT ON POLICY "Users can view own 2FA settings" ON public.user_two_factor_auth IS 'Users can view their two-factor authentication settings';
COMMENT ON POLICY "Users can update own 2FA settings" ON public.user_two_factor_auth IS 'Users can manage their two-factor authentication';

COMMENT ON POLICY "Users can view own security events" ON public.security_events IS 'Users can view security events related to their account';

COMMENT ON POLICY "Users can view own preferences" ON public.user_preferences IS 'Users can view their application preferences';
COMMENT ON POLICY "Users can update own preferences" ON public.user_preferences IS 'Users can update their application preferences';