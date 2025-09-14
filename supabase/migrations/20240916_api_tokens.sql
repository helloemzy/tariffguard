-- API Access Tokens and Developer Portal
-- Enables enterprise customers to integrate with TariffGuard programmatically

-- API Access Tokens table
CREATE TABLE public.api_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Token details
  name VARCHAR(255) NOT NULL, -- Human-readable name for the token
  token_hash VARCHAR(255) NOT NULL UNIQUE, -- SHA-256 hash of the actual token
  token_prefix VARCHAR(20) NOT NULL, -- First few characters for identification

  -- Permissions and scope
  scopes TEXT[] DEFAULT '{}', -- Array of allowed API endpoints/actions
  rate_limit_per_minute INTEGER DEFAULT 60,
  rate_limit_per_hour INTEGER DEFAULT 1000,
  rate_limit_per_day INTEGER DEFAULT 10000,

  -- Status and lifecycle
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'revoked')),
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,

  -- Metadata
  user_agent TEXT, -- Last user agent that used this token
  ip_address INET, -- Last IP address that used this token
  usage_count INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- API Usage Logs table for tracking and analytics
CREATE TABLE public.api_usage_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  token_id UUID REFERENCES public.api_tokens(id) ON DELETE SET NULL,

  -- Request details
  endpoint VARCHAR(255) NOT NULL,
  method VARCHAR(10) NOT NULL,
  status_code INTEGER NOT NULL,
  response_time_ms INTEGER,

  -- Client information
  ip_address INET,
  user_agent TEXT,

  -- Rate limiting
  rate_limit_remaining INTEGER,
  rate_limit_reset_at TIMESTAMPTZ,

  -- Metadata
  request_size_bytes INTEGER,
  response_size_bytes INTEGER,
  error_message TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_api_tokens_workspace_id ON public.api_tokens(workspace_id);
CREATE INDEX idx_api_tokens_token_hash ON public.api_tokens(token_hash);
CREATE INDEX idx_api_tokens_status ON public.api_tokens(status);
CREATE INDEX idx_api_tokens_expires_at ON public.api_tokens(expires_at);

CREATE INDEX idx_api_usage_logs_workspace_id ON public.api_usage_logs(workspace_id);
CREATE INDEX idx_api_usage_logs_token_id ON public.api_usage_logs(token_id);
CREATE INDEX idx_api_usage_logs_created_at ON public.api_usage_logs(created_at);
CREATE INDEX idx_api_usage_logs_endpoint ON public.api_usage_logs(endpoint);

-- Row Level Security policies
ALTER TABLE public.api_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_usage_logs ENABLE ROW LEVEL SECURITY;

-- API tokens can only be accessed by workspace members
CREATE POLICY "Users can manage API tokens for their workspaces" ON public.api_tokens
  FOR ALL USING (
    workspace_id IN (
      SELECT wm.workspace_id
      FROM public.workspace_members wm
      WHERE wm.user_id = auth.uid()
      AND wm.status = 'active'
      AND wm.role IN ('owner', 'admin')
    )
  );

-- API usage logs can be viewed by workspace members
CREATE POLICY "Users can view API usage for their workspaces" ON public.api_usage_logs
  FOR SELECT USING (
    workspace_id IN (
      SELECT wm.workspace_id
      FROM public.workspace_members wm
      WHERE wm.user_id = auth.uid()
      AND wm.status = 'active'
    )
  );

-- Function to log API usage
CREATE OR REPLACE FUNCTION public.log_api_usage(
  p_workspace_id UUID,
  p_token_id UUID,
  p_endpoint TEXT,
  p_method TEXT,
  p_status_code INTEGER,
  p_response_time_ms INTEGER DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_request_size_bytes INTEGER DEFAULT NULL,
  p_response_size_bytes INTEGER DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  usage_log_id UUID;
BEGIN
  INSERT INTO public.api_usage_logs (
    workspace_id,
    token_id,
    endpoint,
    method,
    status_code,
    response_time_ms,
    ip_address,
    user_agent,
    request_size_bytes,
    response_size_bytes,
    error_message
  ) VALUES (
    p_workspace_id,
    p_token_id,
    p_endpoint,
    p_method,
    p_status_code,
    p_response_time_ms,
    p_ip_address,
    p_user_agent,
    p_request_size_bytes,
    p_response_size_bytes,
    p_error_message
  ) RETURNING id INTO usage_log_id;

  -- Update token usage statistics
  IF p_token_id IS NOT NULL THEN
    UPDATE public.api_tokens
    SET
      usage_count = usage_count + 1,
      last_used_at = NOW(),
      ip_address = COALESCE(p_ip_address, ip_address),
      user_agent = COALESCE(p_user_agent, user_agent),
      updated_at = NOW()
    WHERE id = p_token_id;
  END IF;

  RETURN usage_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check rate limits
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_token_id UUID,
  p_window TEXT DEFAULT 'minute' -- 'minute', 'hour', 'day'
) RETURNS JSONB AS $$
DECLARE
  token_record RECORD;
  usage_count INTEGER;
  window_start TIMESTAMPTZ;
  rate_limit INTEGER;
  result JSONB;
BEGIN
  -- Get token details
  SELECT * INTO token_record
  FROM public.api_tokens
  WHERE id = p_token_id AND status = 'active';

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'error', 'Token not found or inactive'
    );
  END IF;

  -- Check if token is expired
  IF token_record.expires_at IS NOT NULL AND token_record.expires_at < NOW() THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'error', 'Token has expired'
    );
  END IF;

  -- Set window start time and rate limit based on window type
  CASE p_window
    WHEN 'minute' THEN
      window_start := DATE_TRUNC('minute', NOW());
      rate_limit := token_record.rate_limit_per_minute;
    WHEN 'hour' THEN
      window_start := DATE_TRUNC('hour', NOW());
      rate_limit := token_record.rate_limit_per_hour;
    WHEN 'day' THEN
      window_start := DATE_TRUNC('day', NOW());
      rate_limit := token_record.rate_limit_per_day;
    ELSE
      RETURN jsonb_build_object(
        'allowed', false,
        'error', 'Invalid window type'
      );
  END CASE;

  -- Count usage in the current window
  SELECT COUNT(*)
  INTO usage_count
  FROM public.api_usage_logs
  WHERE token_id = p_token_id
    AND created_at >= window_start
    AND status_code < 500; -- Don't count server errors against rate limit

  -- Build result
  result := jsonb_build_object(
    'allowed', usage_count < rate_limit,
    'current_usage', usage_count,
    'rate_limit', rate_limit,
    'window', p_window,
    'window_start', window_start,
    'reset_at', window_start + INTERVAL '1 ' || p_window
  );

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Available API scopes
CREATE TABLE public.api_scopes (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(50) NOT NULL,
  is_premium BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default API scopes
INSERT INTO public.api_scopes (id, name, description, category) VALUES
('calculations.read', 'Read Calculations', 'View calculations and results', 'calculations'),
('calculations.create', 'Create Calculations', 'Create new import duty calculations', 'calculations'),
('calculations.update', 'Update Calculations', 'Modify existing calculations', 'calculations'),
('calculations.delete', 'Delete Calculations', 'Remove calculations', 'calculations'),
('rates.read', 'Read Tariff Rates', 'Access current and historical tariff rates', 'rates'),
('alerts.read', 'Read Alerts', 'View tariff rate change alerts', 'alerts'),
('analytics.read', 'Read Analytics', 'Access analytics and reporting data', 'analytics'),
('team.read', 'Read Team Data', 'View team members and activity', 'team'),
('webhooks.create', 'Create Webhooks', 'Set up webhook endpoints', 'webhooks'),
('bulk.operations', 'Bulk Operations', 'Perform bulk calculations and imports', 'bulk');

-- Function to mark team activities as read
CREATE OR REPLACE FUNCTION public.mark_activities_as_read(
  p_user_id TEXT,
  p_activity_ids UUID[],
  p_read_timestamp TIMESTAMPTZ
) RETURNS VOID AS $$
BEGIN
  UPDATE public.team_activity_feed
  SET read_by = COALESCE(read_by, '{}'::jsonb) ||
                jsonb_build_object(p_user_id, p_read_timestamp::text)
  WHERE id = ANY(p_activity_ids);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant usage permissions
GRANT USAGE ON SEQUENCE public.api_tokens_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE public.api_usage_logs_id_seq TO authenticated;