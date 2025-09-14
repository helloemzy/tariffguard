-- Team Collaboration Tables for TariffGuard
-- This migration adds team member management, roles, and collaboration features

-- Create user roles enum
CREATE TYPE user_role AS ENUM ('owner', 'admin', 'member', 'viewer');

-- Create team member status enum
CREATE TYPE member_status AS ENUM ('active', 'invited', 'suspended', 'inactive');

-- Workspace members table (many-to-many between users and workspaces)
CREATE TABLE workspace_members (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'member',
  status member_status NOT NULL DEFAULT 'active',
  invited_by uuid REFERENCES auth.users(id),
  invited_at timestamptz,
  joined_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  
  -- Ensure unique user per workspace
  UNIQUE(workspace_id, user_id)
);

-- Team invitations table
CREATE TABLE team_invitations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email text NOT NULL,
  role user_role NOT NULL DEFAULT 'member',
  token text NOT NULL UNIQUE,
  invited_by uuid NOT NULL REFERENCES auth.users(id),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  
  -- Ensure unique email per workspace
  UNIQUE(workspace_id, email)
);

-- Activity log table for team activities
CREATE TABLE activity_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  resource_type text NOT NULL, -- 'calculation', 'member', 'workspace', 'alert', etc.
  resource_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Shared calculations table (for collaboration)
CREATE TABLE calculation_shares (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  calculation_id uuid NOT NULL REFERENCES calculations(id) ON DELETE CASCADE,
  shared_with_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  shared_with_role user_role, -- If shared with all users of a certain role
  permission text NOT NULL DEFAULT 'view', -- 'view', 'edit', 'comment'
  shared_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now() NOT NULL,
  
  -- Either shared with specific user OR role, not both
  CHECK (
    (shared_with_user_id IS NOT NULL AND shared_with_role IS NULL) OR
    (shared_with_user_id IS NULL AND shared_with_role IS NOT NULL)
  )
);

-- Comments table for collaborative calculations
CREATE TABLE calculation_comments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  calculation_id uuid NOT NULL REFERENCES calculations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  parent_id uuid REFERENCES calculation_comments(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Add team collaboration fields to existing tables

-- Add created_by to calculations for ownership tracking
ALTER TABLE calculations ADD COLUMN created_by uuid REFERENCES auth.users(id);
ALTER TABLE calculations ADD COLUMN is_shared boolean DEFAULT false;
ALTER TABLE calculations ADD COLUMN shared_settings jsonb DEFAULT '{}'::jsonb;

-- Add team member count to workspaces for quick access
ALTER TABLE workspaces ADD COLUMN team_member_count integer DEFAULT 1;

-- Create indexes for performance
CREATE INDEX idx_workspace_members_workspace_id ON workspace_members(workspace_id);
CREATE INDEX idx_workspace_members_user_id ON workspace_members(user_id);
CREATE INDEX idx_workspace_members_status ON workspace_members(status);
CREATE INDEX idx_team_invitations_workspace_id ON team_invitations(workspace_id);
CREATE INDEX idx_team_invitations_email ON team_invitations(email);
CREATE INDEX idx_team_invitations_token ON team_invitations(token);
CREATE INDEX idx_team_invitations_expires_at ON team_invitations(expires_at);
CREATE INDEX idx_activity_logs_workspace_id ON activity_logs(workspace_id);
CREATE INDEX idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_created_at ON activity_logs(created_at DESC);
CREATE INDEX idx_calculation_shares_calculation_id ON calculation_shares(calculation_id);
CREATE INDEX idx_calculation_comments_calculation_id ON calculation_comments(calculation_id);

-- RLS Policies

-- Workspace members policies
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view workspace members they belong to"
  ON workspace_members FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "Workspace admins can manage members"
  ON workspace_members FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid() 
      AND status = 'active'
      AND role IN ('owner', 'admin')
    )
  );

-- Team invitations policies
ALTER TABLE team_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view invitations for their workspaces"
  ON team_invitations FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid() AND status = 'active'
      AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Workspace admins can manage invitations"
  ON team_invitations FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid() 
      AND status = 'active'
      AND role IN ('owner', 'admin')
    )
  );

-- Activity logs policies
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view activity logs for their workspaces"
  ON activity_logs FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "System can insert activity logs"
  ON activity_logs FOR INSERT
  WITH CHECK (true);

-- Calculation shares policies
ALTER TABLE calculation_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view shares for their calculations"
  ON calculation_shares FOR SELECT
  USING (
    calculation_id IN (
      SELECT id FROM calculations 
      WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members 
        WHERE user_id = auth.uid() AND status = 'active'
      )
    )
  );

CREATE POLICY "Calculation owners can manage shares"
  ON calculation_shares FOR ALL
  USING (
    calculation_id IN (
      SELECT id FROM calculations 
      WHERE created_by = auth.uid()
      OR workspace_id IN (
        SELECT workspace_id FROM workspace_members 
        WHERE user_id = auth.uid() 
        AND status = 'active'
        AND role IN ('owner', 'admin')
      )
    )
  );

-- Calculation comments policies
ALTER TABLE calculation_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view comments on accessible calculations"
  ON calculation_comments FOR SELECT
  USING (
    calculation_id IN (
      SELECT id FROM calculations 
      WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members 
        WHERE user_id = auth.uid() AND status = 'active'
      )
    )
    OR calculation_id IN (
      SELECT calculation_id FROM calculation_shares 
      WHERE shared_with_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can comment on accessible calculations"
  ON calculation_comments FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND (
      calculation_id IN (
        SELECT id FROM calculations 
        WHERE workspace_id IN (
          SELECT workspace_id FROM workspace_members 
          WHERE user_id = auth.uid() AND status = 'active'
        )
      )
      OR calculation_id IN (
        SELECT calculation_id FROM calculation_shares 
        WHERE shared_with_user_id = auth.uid()
      )
    )
  );

-- Functions

-- Function to check user role in workspace
CREATE OR REPLACE FUNCTION get_user_role_in_workspace(workspace_uuid uuid, user_uuid uuid)
RETURNS user_role
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_role_result user_role;
BEGIN
  SELECT role INTO user_role_result
  FROM workspace_members
  WHERE workspace_id = workspace_uuid 
    AND user_id = user_uuid 
    AND status = 'active';
  
  RETURN user_role_result;
END;
$$;

-- Function to check if user has permission
CREATE OR REPLACE FUNCTION user_has_permission(
  workspace_uuid uuid, 
  user_uuid uuid, 
  required_role user_role
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_role user_role;
BEGIN
  current_role := get_user_role_in_workspace(workspace_uuid, user_uuid);
  
  IF current_role IS NULL THEN
    RETURN false;
  END IF;
  
  -- Role hierarchy: owner > admin > member > viewer
  CASE required_role
    WHEN 'viewer' THEN
      RETURN current_role IN ('owner', 'admin', 'member', 'viewer');
    WHEN 'member' THEN
      RETURN current_role IN ('owner', 'admin', 'member');
    WHEN 'admin' THEN
      RETURN current_role IN ('owner', 'admin');
    WHEN 'owner' THEN
      RETURN current_role = 'owner';
    ELSE
      RETURN false;
  END CASE;
END;
$$;

-- Function to log activity
CREATE OR REPLACE FUNCTION log_activity(
  workspace_uuid uuid,
  user_uuid uuid,
  action_text text,
  resource_type_text text,
  resource_uuid uuid DEFAULT NULL,
  metadata_json jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO activity_logs (
    workspace_id,
    user_id,
    action,
    resource_type,
    resource_id,
    metadata
  ) VALUES (
    workspace_uuid,
    user_uuid,
    action_text,
    resource_type_text,
    resource_uuid,
    metadata_json
  );
END;
$$;

-- Function to update team member count
CREATE OR REPLACE FUNCTION update_team_member_count()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Update count for the affected workspace
  UPDATE workspaces 
  SET team_member_count = (
    SELECT COUNT(*) 
    FROM workspace_members 
    WHERE workspace_id = COALESCE(NEW.workspace_id, OLD.workspace_id)
    AND status = 'active'
  )
  WHERE id = COALESCE(NEW.workspace_id, OLD.workspace_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Triggers

-- Update team member count when members change
CREATE TRIGGER update_team_member_count_trigger
  AFTER INSERT OR UPDATE OR DELETE ON workspace_members
  FOR EACH ROW
  EXECUTE FUNCTION update_team_member_count();

-- Update timestamps
CREATE TRIGGER workspace_members_updated_at
  BEFORE UPDATE ON workspace_members
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER calculation_comments_updated_at
  BEFORE UPDATE ON calculation_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Log activity for important actions
CREATE OR REPLACE FUNCTION log_member_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Log member additions
  IF TG_OP = 'INSERT' THEN
    PERFORM log_activity(
      NEW.workspace_id,
      NEW.invited_by,
      'member_added',
      'member',
      NEW.id,
      jsonb_build_object(
        'member_email', (SELECT email FROM auth.users WHERE id = NEW.user_id),
        'role', NEW.role
      )
    );
  END IF;
  
  -- Log role changes
  IF TG_OP = 'UPDATE' AND OLD.role != NEW.role THEN
    PERFORM log_activity(
      NEW.workspace_id,
      auth.uid(),
      'member_role_changed',
      'member',
      NEW.id,
      jsonb_build_object(
        'old_role', OLD.role,
        'new_role', NEW.role,
        'member_email', (SELECT email FROM auth.users WHERE id = NEW.user_id)
      )
    );
  END IF;
  
  -- Log member removal
  IF TG_OP = 'DELETE' THEN
    PERFORM log_activity(
      OLD.workspace_id,
      auth.uid(),
      'member_removed',
      'member',
      OLD.id,
      jsonb_build_object(
        'member_email', (SELECT email FROM auth.users WHERE id = OLD.user_id),
        'role', OLD.role
      )
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER log_member_activity_trigger
  AFTER INSERT OR UPDATE OR DELETE ON workspace_members
  FOR EACH ROW
  EXECUTE FUNCTION log_member_activity();

-- Create default workspace member for existing workspaces
INSERT INTO workspace_members (workspace_id, user_id, role, status, joined_at)
SELECT id, user_id, 'owner', 'active', created_at
FROM workspaces
WHERE user_id IS NOT NULL
ON CONFLICT (workspace_id, user_id) DO NOTHING;

-- Update team member counts for existing workspaces
UPDATE workspaces 
SET team_member_count = (
  SELECT COUNT(*) 
  FROM workspace_members 
  WHERE workspace_id = workspaces.id
  AND status = 'active'
);