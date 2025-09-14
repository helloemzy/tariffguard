-- Team Collaboration and Multi-User Workspace System
-- Enables multiple users per workspace with role-based permissions

-- Drop existing tables if they exist
DROP TABLE IF EXISTS public.workspace_members CASCADE;
DROP TABLE IF EXISTS public.team_invitations CASCADE;
DROP TABLE IF EXISTS public.calculation_approvals CASCADE;
DROP TABLE IF EXISTS public.team_activity_feed CASCADE;
DROP TABLE IF EXISTS public.api_keys CASCADE;

-- Create user roles enum
CREATE TYPE public.workspace_role AS ENUM (
  'owner',      -- Full access, billing, member management
  'admin',      -- Most access, can manage members and settings
  'manager',    -- Can approve calculations, manage projects
  'calculator', -- Can create and edit calculations
  'viewer'      -- Read-only access to calculations and reports
);

-- Create workspace members table (many-to-many relationship)
CREATE TABLE public.workspace_members (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role public.workspace_role NOT NULL DEFAULT 'viewer',

    -- Permissions and settings
    permissions jsonb DEFAULT '{}',
    can_approve_calculations boolean DEFAULT false,
    can_manage_alerts boolean DEFAULT false,
    can_export_data boolean DEFAULT true,
    can_view_billing boolean DEFAULT false,

    -- Status and timestamps
    status text DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'pending')),
    invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    invited_at timestamptz DEFAULT now(),
    joined_at timestamptz DEFAULT now(),
    last_active_at timestamptz DEFAULT now(),

    -- Metadata
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),

    -- Constraints
    UNIQUE(workspace_id, user_id)
);

-- Create team invitations table
CREATE TABLE public.team_invitations (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    email text NOT NULL,
    role public.workspace_role NOT NULL DEFAULT 'viewer',

    -- Invitation details
    invited_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    invitation_token uuid DEFAULT gen_random_uuid() UNIQUE,
    expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),

    -- Status and message
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
    personal_message text,

    -- Acceptance tracking
    accepted_at timestamptz,
    accepted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,

    -- Metadata
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),

    -- Constraints
    UNIQUE(workspace_id, email, status) -- Prevent duplicate pending invitations
);

-- Create calculation approvals table
CREATE TABLE public.calculation_approvals (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    calculation_id uuid NOT NULL, -- References calculations table
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,

    -- Request details
    requested_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    requested_at timestamptz NOT NULL DEFAULT now(),
    calculation_data jsonb NOT NULL,
    total_value numeric(15,2),
    total_duty numeric(15,2),

    -- Approval details
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    reviewed_at timestamptz,
    review_notes text,

    -- Final calculation reference
    final_calculation_id uuid, -- Set when approved and calculation is created

    -- Metadata
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create team activity feed table
CREATE TABLE public.team_activity_feed (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,

    -- Activity details
    activity_type text NOT NULL,
    activity_data jsonb DEFAULT '{}',
    description text NOT NULL,

    -- User and context
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    target_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    entity_type text, -- 'calculation', 'member', 'workspace', 'billing', etc.
    entity_id uuid,

    -- Visibility and importance
    visibility text DEFAULT 'team' CHECK (visibility IN ('private', 'team', 'admins', 'owners')),
    importance text DEFAULT 'normal' CHECK (importance IN ('low', 'normal', 'high', 'critical')),

    -- Read tracking
    read_by jsonb DEFAULT '{}', -- Object with user_id: timestamp mapping

    -- Metadata
    created_at timestamptz DEFAULT now()
);

-- Create API keys table
CREATE TABLE public.api_keys (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,

    -- Key details
    name text NOT NULL,
    key_hash text NOT NULL UNIQUE, -- bcrypt hash of the actual key
    key_prefix text NOT NULL, -- First 8 chars for display (e.g., "tg_live_")

    -- Permissions and limits
    scopes jsonb DEFAULT '["read:calculations"]', -- Array of permission scopes
    rate_limit_per_minute integer DEFAULT 100,
    rate_limit_per_day integer DEFAULT 10000,

    -- Usage tracking
    last_used_at timestamptz,
    total_requests bigint DEFAULT 0,

    -- Status and expiry
    status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'revoked')),
    expires_at timestamptz, -- NULL for no expiry

    -- Metadata
    created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_workspace_members_workspace_id ON public.workspace_members(workspace_id);
CREATE INDEX idx_workspace_members_user_id ON public.workspace_members(user_id);
CREATE INDEX idx_workspace_members_role ON public.workspace_members(role);
CREATE INDEX idx_workspace_members_status ON public.workspace_members(status);

CREATE INDEX idx_team_invitations_workspace_id ON public.team_invitations(workspace_id);
CREATE INDEX idx_team_invitations_email ON public.team_invitations(email);
CREATE INDEX idx_team_invitations_token ON public.team_invitations(invitation_token);
CREATE INDEX idx_team_invitations_status ON public.team_invitations(status);
CREATE INDEX idx_team_invitations_expires_at ON public.team_invitations(expires_at);

CREATE INDEX idx_calculation_approvals_workspace_id ON public.calculation_approvals(workspace_id);
CREATE INDEX idx_calculation_approvals_status ON public.calculation_approvals(status);
CREATE INDEX idx_calculation_approvals_requested_by ON public.calculation_approvals(requested_by);
CREATE INDEX idx_calculation_approvals_reviewed_by ON public.calculation_approvals(reviewed_by);

CREATE INDEX idx_team_activity_feed_workspace_id ON public.team_activity_feed(workspace_id);
CREATE INDEX idx_team_activity_feed_created_at ON public.team_activity_feed(created_at DESC);
CREATE INDEX idx_team_activity_feed_activity_type ON public.team_activity_feed(activity_type);
CREATE INDEX idx_team_activity_feed_visibility ON public.team_activity_feed(visibility);

CREATE INDEX idx_api_keys_workspace_id ON public.api_keys(workspace_id);
CREATE INDEX idx_api_keys_key_hash ON public.api_keys(key_hash);
CREATE INDEX idx_api_keys_key_prefix ON public.api_keys(key_prefix);
CREATE INDEX idx_api_keys_status ON public.api_keys(status);

-- Enable RLS on all tables
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calculation_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_activity_feed ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- RLS Policies for workspace_members
CREATE POLICY "Users can view members of their workspaces"
ON public.workspace_members FOR SELECT
USING (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members wm
    WHERE wm.user_id = auth.uid() AND wm.status = 'active'
  )
);

CREATE POLICY "Admins can manage workspace members"
ON public.workspace_members FOR ALL
USING (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members wm
    WHERE wm.user_id = auth.uid()
    AND wm.role IN ('owner', 'admin')
    AND wm.status = 'active'
  )
);

-- RLS Policies for team_invitations
CREATE POLICY "Users can view invitations for their workspaces"
ON public.team_invitations FOR SELECT
USING (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members wm
    WHERE wm.user_id = auth.uid()
    AND wm.role IN ('owner', 'admin')
    AND wm.status = 'active'
  )
);

CREATE POLICY "Admins can manage team invitations"
ON public.team_invitations FOR ALL
USING (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members wm
    WHERE wm.user_id = auth.uid()
    AND wm.role IN ('owner', 'admin')
    AND wm.status = 'active'
  )
);

-- RLS Policies for calculation_approvals
CREATE POLICY "Team members can view calculation approvals"
ON public.calculation_approvals FOR SELECT
USING (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members wm
    WHERE wm.user_id = auth.uid() AND wm.status = 'active'
  )
);

CREATE POLICY "Users can create calculation approval requests"
ON public.calculation_approvals FOR INSERT
WITH CHECK (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members wm
    WHERE wm.user_id = auth.uid()
    AND wm.role IN ('calculator', 'manager', 'admin', 'owner')
    AND wm.status = 'active'
  )
  AND requested_by = auth.uid()
);

CREATE POLICY "Managers can update calculation approvals"
ON public.calculation_approvals FOR UPDATE
USING (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members wm
    WHERE wm.user_id = auth.uid()
    AND (wm.can_approve_calculations = true OR wm.role IN ('manager', 'admin', 'owner'))
    AND wm.status = 'active'
  )
);

-- RLS Policies for team_activity_feed
CREATE POLICY "Team members can view activity feed"
ON public.team_activity_feed FOR SELECT
USING (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members wm
    WHERE wm.user_id = auth.uid() AND wm.status = 'active'
  )
  AND (
    visibility = 'team' OR
    (visibility = 'admins' AND EXISTS (
      SELECT 1 FROM public.workspace_members wm2
      WHERE wm2.user_id = auth.uid()
      AND wm2.workspace_id = team_activity_feed.workspace_id
      AND wm2.role IN ('admin', 'owner')
    )) OR
    (visibility = 'owners' AND EXISTS (
      SELECT 1 FROM public.workspace_members wm3
      WHERE wm3.user_id = auth.uid()
      AND wm3.workspace_id = team_activity_feed.workspace_id
      AND wm3.role = 'owner'
    ))
  )
);

-- RLS Policies for api_keys
CREATE POLICY "Admins can manage API keys"
ON public.api_keys FOR ALL
USING (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members wm
    WHERE wm.user_id = auth.uid()
    AND wm.role IN ('owner', 'admin')
    AND wm.status = 'active'
  )
);

-- Service role policies (for API endpoints)
CREATE POLICY "Service role can manage all team data"
ON public.workspace_members FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role can manage invitations"
ON public.team_invitations FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role can manage approvals"
ON public.calculation_approvals FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role can manage activity feed"
ON public.team_activity_feed FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role can manage API keys"
ON public.api_keys FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

-- Create function to add team member
CREATE OR REPLACE FUNCTION public.add_team_member(
    p_workspace_id uuid,
    p_user_id uuid,
    p_role public.workspace_role DEFAULT 'viewer',
    p_invited_by uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    member_id uuid;
BEGIN
    INSERT INTO public.workspace_members (
        workspace_id,
        user_id,
        role,
        invited_by,
        status
    ) VALUES (
        p_workspace_id,
        p_user_id,
        p_role,
        p_invited_by,
        'active'
    )
    RETURNING id INTO member_id;

    -- Log activity
    INSERT INTO public.team_activity_feed (
        workspace_id,
        activity_type,
        description,
        user_id,
        target_user_id,
        entity_type,
        entity_id
    ) VALUES (
        p_workspace_id,
        'member_added',
        CASE
            WHEN p_invited_by IS NOT NULL THEN 'New team member added'
            ELSE 'Team member joined'
        END,
        p_invited_by,
        p_user_id,
        'member',
        member_id
    );

    RETURN member_id;
END;
$$;

-- Create function to remove team member
CREATE OR REPLACE FUNCTION public.remove_team_member(
    p_workspace_id uuid,
    p_user_id uuid,
    p_removed_by uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Cannot remove the workspace owner
    IF EXISTS (
        SELECT 1 FROM public.workspace_members
        WHERE workspace_id = p_workspace_id
        AND user_id = p_user_id
        AND role = 'owner'
    ) THEN
        RAISE EXCEPTION 'Cannot remove workspace owner';
    END IF;

    -- Update member status
    UPDATE public.workspace_members
    SET status = 'suspended', updated_at = now()
    WHERE workspace_id = p_workspace_id AND user_id = p_user_id;

    -- Log activity
    INSERT INTO public.team_activity_feed (
        workspace_id,
        activity_type,
        description,
        user_id,
        target_user_id,
        entity_type
    ) VALUES (
        p_workspace_id,
        'member_removed',
        'Team member removed',
        p_removed_by,
        p_user_id,
        'member'
    );

    RETURN FOUND;
END;
$$;

-- Create function to update member role
CREATE OR REPLACE FUNCTION public.update_member_role(
    p_workspace_id uuid,
    p_user_id uuid,
    p_new_role public.workspace_role,
    p_updated_by uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    old_role public.workspace_role;
BEGIN
    -- Get current role
    SELECT role INTO old_role
    FROM public.workspace_members
    WHERE workspace_id = p_workspace_id AND user_id = p_user_id;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- Cannot change owner role
    IF old_role = 'owner' OR p_new_role = 'owner' THEN
        RAISE EXCEPTION 'Cannot change owner role';
    END IF;

    -- Update role
    UPDATE public.workspace_members
    SET role = p_new_role, updated_at = now()
    WHERE workspace_id = p_workspace_id AND user_id = p_user_id;

    -- Log activity
    INSERT INTO public.team_activity_feed (
        workspace_id,
        activity_type,
        description,
        user_id,
        target_user_id,
        entity_type,
        activity_data
    ) VALUES (
        p_workspace_id,
        'role_updated',
        'Team member role updated',
        p_updated_by,
        p_user_id,
        'member',
        jsonb_build_object('old_role', old_role, 'new_role', p_new_role)
    );

    RETURN TRUE;
END;
$$;

-- Create function to log team activity
CREATE OR REPLACE FUNCTION public.log_team_activity(
    p_workspace_id uuid,
    p_activity_type text,
    p_description text,
    p_user_id uuid DEFAULT NULL,
    p_target_user_id uuid DEFAULT NULL,
    p_entity_type text DEFAULT NULL,
    p_entity_id uuid DEFAULT NULL,
    p_activity_data jsonb DEFAULT '{}',
    p_visibility text DEFAULT 'team',
    p_importance text DEFAULT 'normal'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    activity_id uuid;
BEGIN
    INSERT INTO public.team_activity_feed (
        workspace_id,
        activity_type,
        description,
        user_id,
        target_user_id,
        entity_type,
        entity_id,
        activity_data,
        visibility,
        importance
    ) VALUES (
        p_workspace_id,
        p_activity_type,
        p_description,
        p_user_id,
        p_target_user_id,
        p_entity_type,
        p_entity_id,
        p_activity_data,
        p_visibility,
        p_importance
    )
    RETURNING id INTO activity_id;

    RETURN activity_id;
END;
$$;

-- Create function to get team member permissions
CREATE OR REPLACE FUNCTION public.get_member_permissions(
    p_workspace_id uuid,
    p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    member_record record;
    permissions jsonb;
BEGIN
    SELECT * INTO member_record
    FROM public.workspace_members
    WHERE workspace_id = p_workspace_id
    AND user_id = p_user_id
    AND status = 'active';

    IF NOT FOUND THEN
        RETURN '{"error": "Member not found"}'::jsonb;
    END IF;

    -- Build permissions object based on role
    permissions := jsonb_build_object(
        'role', member_record.role,
        'can_view_calculations', true,
        'can_create_calculations', member_record.role IN ('calculator', 'manager', 'admin', 'owner'),
        'can_approve_calculations', member_record.can_approve_calculations OR member_record.role IN ('manager', 'admin', 'owner'),
        'can_manage_alerts', member_record.can_manage_alerts OR member_record.role IN ('admin', 'owner'),
        'can_export_data', member_record.can_export_data,
        'can_view_billing', member_record.can_view_billing OR member_record.role IN ('admin', 'owner'),
        'can_manage_members', member_record.role IN ('admin', 'owner'),
        'can_manage_workspace', member_record.role = 'owner',
        'can_view_activity', true,
        'can_manage_api_keys', member_record.role IN ('admin', 'owner')
    );

    RETURN permissions;
END;
$$;

-- Add helpful comments
COMMENT ON TABLE public.workspace_members IS 'Multi-user workspace membership with role-based permissions';
COMMENT ON TABLE public.team_invitations IS 'Team invitation management with expiry and status tracking';
COMMENT ON TABLE public.calculation_approvals IS 'Workflow approval system for calculations';
COMMENT ON TABLE public.team_activity_feed IS 'Team collaboration activity and audit trail';
COMMENT ON TABLE public.api_keys IS 'API access tokens with scoped permissions and rate limiting';

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_invitations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calculation_approvals TO authenticated;
GRANT SELECT, INSERT ON public.team_activity_feed TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_keys TO authenticated;

GRANT EXECUTE ON FUNCTION public.add_team_member(uuid, uuid, public.workspace_role, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_team_member(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_member_role(uuid, uuid, public.workspace_role, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_team_activity(uuid, text, text, uuid, uuid, text, uuid, jsonb, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_member_permissions(uuid, uuid) TO authenticated;

RAISE NOTICE 'Team collaboration system created successfully';