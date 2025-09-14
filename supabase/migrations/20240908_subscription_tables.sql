-- Subscription Management Tables for TariffGuard
-- This migration adds subscription, billing, and usage tracking tables

-- Create subscription plans enum
CREATE TYPE subscription_plan AS ENUM ('FREE', 'PROFESSIONAL', 'ENTERPRISE');
CREATE TYPE subscription_status AS ENUM ('active', 'canceled', 'past_due', 'unpaid', 'incomplete');

-- Subscriptions table
CREATE TABLE subscriptions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  plan subscription_plan NOT NULL DEFAULT 'FREE',
  status subscription_status NOT NULL DEFAULT 'active',
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  
  -- Ensure one subscription per workspace
  UNIQUE(workspace_id)
);

-- Usage tracking table
CREATE TABLE usage_tracking (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  month_year text NOT NULL, -- Format: "2024-09"
  calculations_count integer NOT NULL DEFAULT 0,
  api_calls_count integer NOT NULL DEFAULT 0,
  ocr_processing_count integer NOT NULL DEFAULT 0,
  email_alerts_sent integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  
  -- Ensure one record per workspace per month
  UNIQUE(workspace_id, month_year)
);

-- Billing events table (for tracking billing history)
CREATE TABLE billing_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  stripe_event_id text UNIQUE NOT NULL,
  event_type text NOT NULL,
  amount_cents integer,
  currency text DEFAULT 'usd',
  status text NOT NULL,
  stripe_invoice_id text,
  stripe_payment_intent_id text,
  processed_at timestamptz DEFAULT now() NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb
);

-- Add subscription info to workspaces table (denormalized for quick access)
ALTER TABLE workspaces ADD COLUMN subscription_plan subscription_plan NOT NULL DEFAULT 'FREE';
ALTER TABLE workspaces ADD COLUMN subscription_status subscription_status NOT NULL DEFAULT 'active';
ALTER TABLE workspaces ADD COLUMN stripe_customer_id text;
ALTER TABLE workspaces ADD COLUMN current_period_end timestamptz;

-- RLS Policies
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_events ENABLE ROW LEVEL SECURITY;

-- Subscriptions policies
CREATE POLICY "Users can view their workspace subscription"
  ON subscriptions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspaces 
      WHERE workspaces.id = subscriptions.workspace_id 
      AND workspaces.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their workspace subscription"
  ON subscriptions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM workspaces 
      WHERE workspaces.id = subscriptions.workspace_id 
      AND workspaces.user_id = auth.uid()
    )
  );

-- Usage tracking policies
CREATE POLICY "Users can view their workspace usage"
  ON usage_tracking FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspaces 
      WHERE workspaces.id = usage_tracking.workspace_id 
      AND workspaces.user_id = auth.uid()
    )
  );

CREATE POLICY "System can manage usage tracking"
  ON usage_tracking FOR ALL
  USING (true);

-- Billing events policies
CREATE POLICY "Users can view their workspace billing events"
  ON billing_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspaces 
      WHERE workspaces.id = billing_events.workspace_id 
      AND workspaces.user_id = auth.uid()
    )
  );

CREATE POLICY "System can manage billing events"
  ON billing_events FOR ALL
  USING (true);

-- Functions

-- Function to get current month usage
CREATE OR REPLACE FUNCTION get_current_month_usage(workspace_uuid uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_month text;
  usage_count integer;
BEGIN
  current_month := to_char(now(), 'YYYY-MM');
  
  SELECT calculations_count INTO usage_count
  FROM usage_tracking
  WHERE workspace_id = workspace_uuid AND month_year = current_month;
  
  RETURN COALESCE(usage_count, 0);
END;
$$;

-- Function to increment usage count
CREATE OR REPLACE FUNCTION increment_calculation_usage(workspace_uuid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_month text;
BEGIN
  current_month := to_char(now(), 'YYYY-MM');
  
  INSERT INTO usage_tracking (workspace_id, month_year, calculations_count)
  VALUES (workspace_uuid, current_month, 1)
  ON CONFLICT (workspace_id, month_year)
  DO UPDATE SET 
    calculations_count = usage_tracking.calculations_count + 1,
    updated_at = now();
END;
$$;

-- Function to check if workspace can make calculation
CREATE OR REPLACE FUNCTION can_make_calculation(workspace_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  workspace_plan subscription_plan;
  current_usage integer;
BEGIN
  -- Get workspace plan
  SELECT subscription_plan INTO workspace_plan
  FROM workspaces
  WHERE id = workspace_uuid;
  
  -- Get current month usage
  current_usage := get_current_month_usage(workspace_uuid);
  
  -- Check limits based on plan
  CASE workspace_plan
    WHEN 'FREE' THEN
      RETURN current_usage < 5;
    WHEN 'PROFESSIONAL' THEN
      RETURN current_usage < 1000;
    WHEN 'ENTERPRISE' THEN
      RETURN true; -- Unlimited
    ELSE
      RETURN false;
  END CASE;
END;
$$;

-- Triggers

-- Update workspaces subscription info when subscriptions table changes
CREATE OR REPLACE FUNCTION sync_workspace_subscription()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE workspaces
  SET 
    subscription_plan = NEW.plan,
    subscription_status = NEW.status,
    stripe_customer_id = NEW.stripe_customer_id,
    current_period_end = NEW.current_period_end,
    updated_at = now()
  WHERE id = NEW.workspace_id;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER sync_workspace_subscription_trigger
  AFTER INSERT OR UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION sync_workspace_subscription();

-- Update timestamps
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER usage_tracking_updated_at
  BEFORE UPDATE ON usage_tracking
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Create initial free subscription for existing workspaces
INSERT INTO subscriptions (workspace_id, plan, status)
SELECT id, 'FREE', 'active'
FROM workspaces
ON CONFLICT (workspace_id) DO NOTHING;