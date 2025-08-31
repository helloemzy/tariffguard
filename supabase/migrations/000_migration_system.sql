-- ================================
-- MIGRATION SYSTEM AND VERSION CONTROL
-- ================================
-- This migration creates the infrastructure for database version control,
-- migration tracking, and rollback management for TariffGuard.
-- Version: 1.0.0
-- Date: 2025-01-30

-- Enable required extensions for the migration system
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ================================
-- MIGRATION METADATA TABLE
-- ================================
-- Track all migrations applied to the database
CREATE TABLE IF NOT EXISTS public.schema_migrations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    version TEXT NOT NULL UNIQUE, -- e.g., '001_auth_schema', '002_rls_policies'
    name TEXT NOT NULL,
    description TEXT,
    
    -- Migration file info
    filename TEXT NOT NULL,
    checksum TEXT NOT NULL, -- SHA-256 of migration file content
    file_size INTEGER,
    
    -- Execution tracking
    executed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    execution_time_ms INTEGER, -- Time taken to execute in milliseconds
    executed_by TEXT DEFAULT current_user(), -- Database user who ran migration
    execution_context TEXT DEFAULT 'manual', -- 'manual', 'automated', 'rollback', 'repair'
    
    -- Environment tracking
    environment TEXT DEFAULT 'development', -- 'development', 'staging', 'production'
    database_version TEXT, -- PostgreSQL version when executed
    
    -- Status and validation
    status TEXT DEFAULT 'applied' CHECK (status IN ('applied', 'failed', 'rolled_back', 'pending')),
    validation_status TEXT DEFAULT 'valid' CHECK (validation_status IN ('valid', 'invalid', 'needs_verification')),
    
    -- Rollback information
    is_rollback BOOLEAN DEFAULT false,
    rollback_of_version TEXT REFERENCES public.schema_migrations(version) ON DELETE SET NULL,
    rollback_script TEXT, -- SQL script to rollback this migration
    
    -- Dependencies
    depends_on TEXT[], -- Array of migration versions this depends on
    conflicts_with TEXT[], -- Array of migration versions this conflicts with
    
    -- Metadata
    migration_metadata JSONB DEFAULT '{}'::jsonb,
    error_message TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ================================
-- MIGRATION LOCKS TABLE
-- ================================
-- Prevent concurrent migrations
CREATE TABLE IF NOT EXISTS public.migration_locks (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    lock_name TEXT NOT NULL UNIQUE DEFAULT 'migration_lock',
    locked_by TEXT NOT NULL DEFAULT current_user(),
    locked_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    lock_timeout TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 minutes'),
    
    -- Lock metadata
    process_id INTEGER DEFAULT pg_backend_pid(),
    lock_reason TEXT DEFAULT 'migration_in_progress',
    metadata JSONB DEFAULT '{}'::jsonb
);

-- ================================
-- SCHEMA CHANGE LOG TABLE
-- ================================
-- Track all schema changes for audit purposes
CREATE TABLE IF NOT EXISTS public.schema_change_log (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    migration_version TEXT REFERENCES public.schema_migrations(version) ON DELETE CASCADE,
    
    -- Change details
    change_type TEXT NOT NULL CHECK (change_type IN (
        'create_table', 'drop_table', 'alter_table', 'rename_table',
        'create_column', 'drop_column', 'alter_column', 'rename_column',
        'create_index', 'drop_index', 'alter_index',
        'create_constraint', 'drop_constraint', 'alter_constraint',
        'create_function', 'drop_function', 'alter_function',
        'create_trigger', 'drop_trigger', 'alter_trigger',
        'create_view', 'drop_view', 'alter_view',
        'create_extension', 'drop_extension',
        'grant_permission', 'revoke_permission',
        'insert_data', 'update_data', 'delete_data'
    )),
    
    -- Object details
    schema_name TEXT DEFAULT 'public',
    object_name TEXT NOT NULL,
    object_type TEXT NOT NULL CHECK (object_type IN (
        'table', 'column', 'index', 'constraint', 'function', 'trigger', 
        'view', 'extension', 'sequence', 'type', 'domain'
    )),
    
    -- Change description
    change_description TEXT NOT NULL,
    sql_command TEXT NOT NULL, -- The actual SQL that was executed
    
    -- Impact assessment
    breaking_change BOOLEAN DEFAULT false,
    data_loss_risk BOOLEAN DEFAULT false,
    performance_impact TEXT CHECK (performance_impact IN ('none', 'low', 'medium', 'high')),
    
    -- Metadata
    change_metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    applied_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ================================
-- DATABASE ENVIRONMENT TABLE
-- ================================
-- Track database environment configuration
CREATE TABLE IF NOT EXISTS public.database_environments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    environment_name TEXT NOT NULL UNIQUE, -- 'development', 'staging', 'production'
    
    -- Environment configuration
    is_active BOOLEAN DEFAULT true,
    is_production BOOLEAN DEFAULT false,
    auto_migrate BOOLEAN DEFAULT false, -- Automatically apply new migrations
    require_approval BOOLEAN DEFAULT false, -- Require approval for migrations
    
    -- Database connection info (encrypted)
    database_url_encrypted TEXT, -- Encrypted connection string
    connection_pool_size INTEGER DEFAULT 10,
    
    -- Migration policies
    max_concurrent_migrations INTEGER DEFAULT 1,
    migration_timeout_minutes INTEGER DEFAULT 30,
    rollback_retention_days INTEGER DEFAULT 30,
    
    -- Backup policies
    backup_before_migration BOOLEAN DEFAULT true,
    backup_retention_days INTEGER DEFAULT 7,
    
    -- Notification settings
    notify_on_migration BOOLEAN DEFAULT true,
    notify_on_failure BOOLEAN DEFAULT true,
    notification_channels JSONB DEFAULT '[]'::jsonb, -- Array of webhook URLs, emails, etc.
    
    -- Metadata
    environment_metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    last_migration_at TIMESTAMPTZ
);

-- ================================
-- MIGRATION APPROVALS TABLE
-- ================================
-- Track migration approvals for production environments
CREATE TABLE IF NOT EXISTS public.migration_approvals (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    migration_version TEXT REFERENCES public.schema_migrations(version) ON DELETE CASCADE NOT NULL,
    environment_name TEXT REFERENCES public.database_environments(environment_name) ON DELETE CASCADE NOT NULL,
    
    -- Approval details
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
    requested_by TEXT NOT NULL,
    requested_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    -- Approval info
    approved_by TEXT,
    approved_at TIMESTAMPTZ,
    rejection_reason TEXT,
    
    -- Migration details
    migration_plan TEXT, -- Detailed plan of what will be executed
    estimated_duration_minutes INTEGER,
    estimated_downtime_minutes INTEGER DEFAULT 0,
    risk_assessment TEXT CHECK (risk_assessment IN ('low', 'medium', 'high', 'critical')),
    
    -- Rollback plan
    rollback_plan TEXT NOT NULL,
    rollback_tested BOOLEAN DEFAULT false,
    
    -- Metadata
    approval_metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Constraints
    UNIQUE(migration_version, environment_name)
);

-- ================================
-- SEED DATA MANAGEMENT TABLE
-- ================================
-- Track seed data and initial data loading
CREATE TABLE IF NOT EXISTS public.seed_data_sets (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    seed_name TEXT NOT NULL UNIQUE,
    description TEXT,
    
    -- Seed configuration
    environment_specific BOOLEAN DEFAULT false,
    target_environments TEXT[] DEFAULT ARRAY['development', 'staging']::TEXT[],
    
    -- Execution details
    sql_content TEXT NOT NULL, -- The actual seed SQL
    content_checksum TEXT NOT NULL, -- SHA-256 of SQL content
    execution_order INTEGER DEFAULT 0, -- Order of execution relative to other seeds
    
    -- Dependencies
    depends_on TEXT[], -- Other seed sets this depends on
    table_dependencies TEXT[], -- Tables this seed depends on
    
    -- Status tracking
    status TEXT DEFAULT 'available' CHECK (status IN ('available', 'applied', 'failed', 'deprecated')),
    last_applied_at TIMESTAMPTZ,
    last_applied_by TEXT,
    application_count INTEGER DEFAULT 0,
    
    -- Data info
    estimated_rows INTEGER,
    estimated_size_kb INTEGER,
    
    -- Metadata
    seed_metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ================================
-- MIGRATION FUNCTIONS
-- ================================

-- Function to acquire migration lock
CREATE OR REPLACE FUNCTION public.acquire_migration_lock(
    p_lock_reason TEXT DEFAULT 'migration_in_progress',
    p_timeout_minutes INTEGER DEFAULT 30
)
RETURNS BOOLEAN AS $$
DECLARE
    existing_lock RECORD;
    lock_acquired BOOLEAN := false;
BEGIN
    -- Check for existing locks
    SELECT * INTO existing_lock 
    FROM public.migration_locks 
    WHERE lock_timeout > NOW()
    LIMIT 1;
    
    IF FOUND THEN
        -- Check if lock has expired
        IF existing_lock.lock_timeout <= NOW() THEN
            DELETE FROM public.migration_locks WHERE id = existing_lock.id;
        ELSE
            RAISE NOTICE 'Migration lock already held by % since %', existing_lock.locked_by, existing_lock.locked_at;
            RETURN false;
        END IF;
    END IF;
    
    -- Acquire new lock
    INSERT INTO public.migration_locks (lock_reason, lock_timeout)
    VALUES (p_lock_reason, NOW() + (p_timeout_minutes || ' minutes')::INTERVAL);
    
    RETURN true;
EXCEPTION
    WHEN unique_violation THEN
        RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to release migration lock
CREATE OR REPLACE FUNCTION public.release_migration_lock()
RETURNS BOOLEAN AS $$
BEGIN
    DELETE FROM public.migration_locks 
    WHERE locked_by = current_user()
      AND process_id = pg_backend_pid();
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to record migration execution
CREATE OR REPLACE FUNCTION public.record_migration(
    p_version TEXT,
    p_name TEXT,
    p_filename TEXT,
    p_checksum TEXT,
    p_execution_time_ms INTEGER DEFAULT NULL,
    p_environment TEXT DEFAULT 'development',
    p_rollback_script TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    migration_id UUID;
BEGIN
    INSERT INTO public.schema_migrations (
        version, name, filename, checksum, execution_time_ms, 
        environment, rollback_script
    )
    VALUES (
        p_version, p_name, p_filename, p_checksum, p_execution_time_ms,
        p_environment, p_rollback_script
    )
    RETURNING id INTO migration_id;
    
    -- Update environment last migration time
    UPDATE public.database_environments 
    SET last_migration_at = NOW() 
    WHERE environment_name = p_environment;
    
    RETURN migration_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log schema changes
CREATE OR REPLACE FUNCTION public.log_schema_change(
    p_migration_version TEXT,
    p_change_type TEXT,
    p_object_name TEXT,
    p_object_type TEXT,
    p_change_description TEXT,
    p_sql_command TEXT,
    p_breaking_change BOOLEAN DEFAULT false,
    p_data_loss_risk BOOLEAN DEFAULT false
)
RETURNS UUID AS $$
DECLARE
    change_id UUID;
BEGIN
    INSERT INTO public.schema_change_log (
        migration_version, change_type, object_name, object_type,
        change_description, sql_command, breaking_change, data_loss_risk
    )
    VALUES (
        p_migration_version, p_change_type, p_object_name, p_object_type,
        p_change_description, p_sql_command, p_breaking_change, p_data_loss_risk
    )
    RETURNING id INTO change_id;
    
    RETURN change_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check migration dependencies
CREATE OR REPLACE FUNCTION public.check_migration_dependencies(p_version TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    dep TEXT;
    migration_info RECORD;
BEGIN
    -- Get migration info
    SELECT depends_on INTO migration_info FROM public.schema_migrations WHERE version = p_version;
    
    IF NOT FOUND OR migration_info.depends_on IS NULL THEN
        RETURN true;
    END IF;
    
    -- Check each dependency
    FOREACH dep IN ARRAY migration_info.depends_on LOOP
        IF NOT EXISTS (
            SELECT 1 FROM public.schema_migrations 
            WHERE version = dep AND status = 'applied'
        ) THEN
            RAISE NOTICE 'Migration dependency not met: %', dep;
            RETURN false;
        END IF;
    END LOOP;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get current database version
CREATE OR REPLACE FUNCTION public.get_database_version()
RETURNS TABLE (
    latest_version TEXT,
    migration_count INTEGER,
    last_migration_date TIMESTAMPTZ,
    environment TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sm.version as latest_version,
        COUNT(*)::INTEGER as migration_count,
        MAX(sm.executed_at) as last_migration_date,
        sm.environment
    FROM public.schema_migrations sm
    WHERE sm.status = 'applied'
    GROUP BY sm.environment
    ORDER BY MAX(sm.executed_at) DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to validate migration integrity
CREATE OR REPLACE FUNCTION public.validate_migration_integrity()
RETURNS TABLE (
    version TEXT,
    status TEXT,
    issue TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH migration_issues AS (
        -- Check for missing dependencies
        SELECT 
            sm.version,
            'dependency_missing' as issue_type,
            'Missing dependency: ' || dep as issue
        FROM public.schema_migrations sm,
             UNNEST(COALESCE(sm.depends_on, ARRAY[]::TEXT[])) dep
        WHERE sm.status = 'applied'
          AND NOT EXISTS (
              SELECT 1 FROM public.schema_migrations dep_sm 
              WHERE dep_sm.version = dep AND dep_sm.status = 'applied'
          )
        
        UNION ALL
        
        -- Check for conflicts
        SELECT 
            sm.version,
            'conflict_detected' as issue_type,
            'Conflicts with: ' || conflict as issue
        FROM public.schema_migrations sm,
             UNNEST(COALESCE(sm.conflicts_with, ARRAY[]::TEXT[])) conflict
        WHERE sm.status = 'applied'
          AND EXISTS (
              SELECT 1 FROM public.schema_migrations conflict_sm 
              WHERE conflict_sm.version = conflict AND conflict_sm.status = 'applied'
          )
    )
    SELECT 
        mi.version,
        CASE WHEN mi.issue_type IS NULL THEN 'valid' ELSE 'invalid' END as status,
        COALESCE(mi.issue, 'No issues detected') as issue
    FROM public.schema_migrations sm
    LEFT JOIN migration_issues mi ON sm.version = mi.version
    WHERE sm.status = 'applied'
    ORDER BY sm.executed_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================
-- INDEXES AND CONSTRAINTS
-- ================================

-- Migration metadata indexes
CREATE INDEX idx_schema_migrations_version ON public.schema_migrations(version);
CREATE INDEX idx_schema_migrations_status ON public.schema_migrations(status, executed_at DESC);
CREATE INDEX idx_schema_migrations_environment ON public.schema_migrations(environment, executed_at DESC);
CREATE INDEX idx_schema_migrations_checksum ON public.schema_migrations(checksum);

-- Schema change log indexes
CREATE INDEX idx_schema_change_log_migration ON public.schema_change_log(migration_version);
CREATE INDEX idx_schema_change_log_change_type ON public.schema_change_log(change_type, applied_at DESC);
CREATE INDEX idx_schema_change_log_object ON public.schema_change_log(schema_name, object_name);
CREATE INDEX idx_schema_change_log_breaking ON public.schema_change_log(breaking_change) WHERE breaking_change = true;

-- Migration locks indexes
CREATE INDEX idx_migration_locks_timeout ON public.migration_locks(lock_timeout);
CREATE INDEX idx_migration_locks_process ON public.migration_locks(process_id, locked_by);

-- Environment indexes
CREATE INDEX idx_database_environments_active ON public.database_environments(is_active) WHERE is_active = true;
CREATE INDEX idx_database_environments_production ON public.database_environments(is_production) WHERE is_production = true;

-- Approval indexes
CREATE INDEX idx_migration_approvals_status ON public.migration_approvals(status, requested_at DESC);
CREATE INDEX idx_migration_approvals_environment ON public.migration_approvals(environment_name, status);

-- Seed data indexes
CREATE INDEX idx_seed_data_sets_status ON public.seed_data_sets(status, execution_order);
CREATE INDEX idx_seed_data_sets_environment ON public.seed_data_sets USING GIN (target_environments);

-- ================================
-- TRIGGERS
-- ================================

-- Trigger to update updated_at for environments
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER database_environments_updated_at
    BEFORE UPDATE ON public.database_environments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER seed_data_sets_updated_at
    BEFORE UPDATE ON public.seed_data_sets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ================================
-- INITIAL DATA
-- ================================

-- Insert default environments
INSERT INTO public.database_environments (
    environment_name, is_production, auto_migrate, require_approval,
    backup_before_migration, notify_on_migration
) VALUES
('development', false, true, false, false, false),
('staging', false, true, true, true, true),
('production', true, false, true, true, true)
ON CONFLICT (environment_name) DO NOTHING;

-- ================================
-- TABLE COMMENTS
-- ================================

COMMENT ON TABLE public.schema_migrations IS 'Tracks all database migrations and their execution status';
COMMENT ON TABLE public.migration_locks IS 'Prevents concurrent migration execution';
COMMENT ON TABLE public.schema_change_log IS 'Audit log of all schema changes made by migrations';
COMMENT ON TABLE public.database_environments IS 'Configuration for different deployment environments';
COMMENT ON TABLE public.migration_approvals IS 'Migration approval workflow for production deployments';
COMMENT ON TABLE public.seed_data_sets IS 'Manages initial and test data seeding';

-- Record this migration
SELECT public.record_migration(
    '000_migration_system',
    'Migration System Infrastructure',
    '000_migration_system.sql',
    encode(digest('000_migration_system', 'sha256'), 'hex'),
    NULL,
    'development',
    'DROP TABLE IF EXISTS public.seed_data_sets CASCADE; DROP TABLE IF EXISTS public.migration_approvals CASCADE; DROP TABLE IF EXISTS public.database_environments CASCADE; DROP TABLE IF EXISTS public.schema_change_log CASCADE; DROP TABLE IF EXISTS public.migration_locks CASCADE; DROP TABLE IF EXISTS public.schema_migrations CASCADE;'
);