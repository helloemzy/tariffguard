-- Error Logging and Monitoring System
-- Creates tables for comprehensive application monitoring and error tracking

-- Drop existing tables if they exist
DROP TABLE IF EXISTS public.error_logs CASCADE;
DROP TABLE IF EXISTS public.performance_metrics CASCADE;
DROP TABLE IF EXISTS public.security_events CASCADE;

-- Create error logs table
CREATE TABLE public.error_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    timestamp timestamptz NOT NULL DEFAULT now(),
    level text NOT NULL CHECK (level IN ('error', 'warn', 'info', 'debug')),
    message text NOT NULL,
    context jsonb DEFAULT '{}',
    stack_trace text,
    environment text NOT NULL DEFAULT 'production',

    -- Request context
    workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL,
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    endpoint text,
    method text,
    status_code integer,
    duration_ms integer,

    -- Metadata
    resolved boolean DEFAULT false,
    resolved_at timestamptz,
    resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now()
);

-- Create performance metrics table
CREATE TABLE public.performance_metrics (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    timestamp timestamptz NOT NULL DEFAULT now(),
    operation text NOT NULL,
    duration_ms integer NOT NULL,

    -- Context
    workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL,
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    endpoint text,
    method text,

    -- Additional metrics
    memory_usage_mb integer,
    cpu_usage_percent numeric(5,2),
    database_queries_count integer,
    external_api_calls_count integer,

    -- Metadata
    context jsonb DEFAULT '{}',
    environment text NOT NULL DEFAULT 'production',
    created_at timestamptz DEFAULT now()
);

-- Create security events table
CREATE TABLE public.security_events (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    timestamp timestamptz NOT NULL DEFAULT now(),
    event_type text NOT NULL,
    severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    description text NOT NULL,

    -- Context
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL,
    ip_address inet,
    user_agent text,
    endpoint text,

    -- Details
    details jsonb DEFAULT '{}',
    action_taken text,
    investigated boolean DEFAULT false,
    investigated_at timestamptz,
    investigated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,

    -- Metadata
    environment text NOT NULL DEFAULT 'production',
    created_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_error_logs_timestamp ON public.error_logs(timestamp DESC);
CREATE INDEX idx_error_logs_level ON public.error_logs(level);
CREATE INDEX idx_error_logs_environment ON public.error_logs(environment);
CREATE INDEX idx_error_logs_workspace_id ON public.error_logs(workspace_id);
CREATE INDEX idx_error_logs_user_id ON public.error_logs(user_id);
CREATE INDEX idx_error_logs_endpoint ON public.error_logs(endpoint);
CREATE INDEX idx_error_logs_resolved ON public.error_logs(resolved);

CREATE INDEX idx_performance_metrics_timestamp ON public.performance_metrics(timestamp DESC);
CREATE INDEX idx_performance_metrics_operation ON public.performance_metrics(operation);
CREATE INDEX idx_performance_metrics_duration ON public.performance_metrics(duration_ms DESC);
CREATE INDEX idx_performance_metrics_workspace_id ON public.performance_metrics(workspace_id);
CREATE INDEX idx_performance_metrics_endpoint ON public.performance_metrics(endpoint);

CREATE INDEX idx_security_events_timestamp ON public.security_events(timestamp DESC);
CREATE INDEX idx_security_events_severity ON public.security_events(severity);
CREATE INDEX idx_security_events_event_type ON public.security_events(event_type);
CREATE INDEX idx_security_events_user_id ON public.security_events(user_id);
CREATE INDEX idx_security_events_ip_address ON public.security_events(ip_address);
CREATE INDEX idx_security_events_investigated ON public.security_events(investigated);

-- Enable RLS
ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies (Admin-only access for error logs)
CREATE POLICY "Admin can view all error logs"
ON public.error_logs FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.workspaces w
    WHERE w.user_id = auth.uid()
    AND w.is_admin = true
  )
);

CREATE POLICY "Service role can manage error logs"
ON public.error_logs FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Admin can view all performance metrics"
ON public.performance_metrics FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.workspaces w
    WHERE w.user_id = auth.uid()
    AND w.is_admin = true
  )
);

CREATE POLICY "Service role can manage performance metrics"
ON public.performance_metrics FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Admin can view all security events"
ON public.security_events FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.workspaces w
    WHERE w.user_id = auth.uid()
    AND w.is_admin = true
  )
);

CREATE POLICY "Service role can manage security events"
ON public.security_events FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

-- Create function to get error statistics
CREATE OR REPLACE FUNCTION public.get_error_statistics(
    p_workspace_id uuid DEFAULT NULL,
    p_hours_back integer DEFAULT 24
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result json;
BEGIN
    SELECT json_build_object(
        'total_errors', COUNT(*),
        'error_count', COUNT(*) FILTER (WHERE level = 'error'),
        'warning_count', COUNT(*) FILTER (WHERE level = 'warn'),
        'info_count', COUNT(*) FILTER (WHERE level = 'info'),
        'unresolved_errors', COUNT(*) FILTER (WHERE level = 'error' AND resolved = false),
        'avg_resolution_time_hours',
            EXTRACT(EPOCH FROM AVG(resolved_at - timestamp))/3600
            FILTER (WHERE resolved = true AND resolved_at IS NOT NULL),
        'most_common_endpoints', (
            SELECT json_agg(json_build_object('endpoint', endpoint, 'count', count))
            FROM (
                SELECT endpoint, COUNT(*) as count
                FROM public.error_logs
                WHERE timestamp >= now() - interval '1 hour' * p_hours_back
                AND (p_workspace_id IS NULL OR workspace_id = p_workspace_id)
                AND endpoint IS NOT NULL
                GROUP BY endpoint
                ORDER BY count DESC
                LIMIT 5
            ) t
        ),
        'error_trends', (
            SELECT json_agg(json_build_object('hour', hour, 'count', count))
            FROM (
                SELECT
                    EXTRACT(HOUR FROM timestamp) as hour,
                    COUNT(*) as count
                FROM public.error_logs
                WHERE timestamp >= now() - interval '1 hour' * p_hours_back
                AND (p_workspace_id IS NULL OR workspace_id = p_workspace_id)
                GROUP BY EXTRACT(HOUR FROM timestamp)
                ORDER BY hour
            ) t
        )
    ) INTO result
    FROM public.error_logs
    WHERE timestamp >= now() - interval '1 hour' * p_hours_back
    AND (p_workspace_id IS NULL OR workspace_id = p_workspace_id);

    RETURN result;
END;
$$;

-- Create function to get performance statistics
CREATE OR REPLACE FUNCTION public.get_performance_statistics(
    p_workspace_id uuid DEFAULT NULL,
    p_hours_back integer DEFAULT 24
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result json;
BEGIN
    SELECT json_build_object(
        'avg_response_time_ms', ROUND(AVG(duration_ms), 2),
        'p95_response_time_ms', PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms),
        'p99_response_time_ms', PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY duration_ms),
        'slowest_endpoints', (
            SELECT json_agg(json_build_object('endpoint', endpoint, 'avg_duration', avg_duration))
            FROM (
                SELECT endpoint, ROUND(AVG(duration_ms), 2) as avg_duration
                FROM public.performance_metrics
                WHERE timestamp >= now() - interval '1 hour' * p_hours_back
                AND (p_workspace_id IS NULL OR workspace_id = p_workspace_id)
                AND endpoint IS NOT NULL
                GROUP BY endpoint
                ORDER BY avg_duration DESC
                LIMIT 5
            ) t
        ),
        'total_operations', COUNT(*),
        'operations_per_hour', COUNT(*) / GREATEST(p_hours_back, 1)
    ) INTO result
    FROM public.performance_metrics
    WHERE timestamp >= now() - interval '1 hour' * p_hours_back
    AND (p_workspace_id IS NULL OR workspace_id = p_workspace_id);

    RETURN result;
END;
$$;

-- Create function to cleanup old logs (run daily)
CREATE OR REPLACE FUNCTION public.cleanup_old_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    error_retention_days integer := 90;  -- Keep errors for 3 months
    performance_retention_days integer := 30;  -- Keep performance metrics for 1 month
    security_retention_days integer := 180;  -- Keep security events for 6 months
BEGIN
    -- Clean up old error logs (except unresolved errors)
    DELETE FROM public.error_logs
    WHERE timestamp < now() - interval '1 day' * error_retention_days
    AND resolved = true;

    -- Clean up old performance metrics
    DELETE FROM public.performance_metrics
    WHERE timestamp < now() - interval '1 day' * performance_retention_days;

    -- Clean up old security events (except uninvestigated high/critical severity)
    DELETE FROM public.security_events
    WHERE timestamp < now() - interval '1 day' * security_retention_days
    AND (investigated = true OR severity IN ('low', 'medium'));

    RAISE NOTICE 'Completed log cleanup';
END;
$$;

-- Add helpful comments
COMMENT ON TABLE public.error_logs IS 'Application error logs with context and resolution tracking';
COMMENT ON TABLE public.performance_metrics IS 'Performance monitoring data for operations and endpoints';
COMMENT ON TABLE public.security_events IS 'Security-related events and potential threats';

COMMENT ON FUNCTION public.get_error_statistics(uuid, integer) IS 'Returns comprehensive error statistics for monitoring dashboard';
COMMENT ON FUNCTION public.get_performance_statistics(uuid, integer) IS 'Returns performance metrics for monitoring dashboard';
COMMENT ON FUNCTION public.cleanup_old_logs() IS 'Cleanup function for log retention management';

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.error_logs TO authenticated;
GRANT SELECT, INSERT ON public.performance_metrics TO authenticated;
GRANT SELECT, INSERT ON public.security_events TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_error_statistics(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_performance_statistics(uuid, integer) TO authenticated;

RAISE NOTICE 'Error logging and monitoring system created successfully';