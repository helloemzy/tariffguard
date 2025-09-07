-- TariffGuard SaaS Expansion Database Schema
-- This migration transforms TariffGuard from Preston-specific to multi-tenant SaaS

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Workspaces table for multi-tenant architecture
CREATE TABLE IF NOT EXISTS workspaces (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  products TEXT,
  route_from TEXT,
  route_to TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enhanced tariff_rates table (keeping existing Preston data)
ALTER TABLE tariff_rates 
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS previous_rate DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'USITC',
ADD COLUMN IF NOT EXISTS last_verified TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Update existing tariff_rates with descriptions
UPDATE tariff_rates SET 
  description = CASE 
    WHEN hs_code = '7318.15.20' THEN 'Steel fasteners - bolts, screws, and threaded articles'
    WHEN hs_code = '8481.80.90' THEN 'Taps, cocks, valves and similar appliances'
    WHEN hs_code = '7326.90.85' THEN 'Other articles of iron or steel, not elsewhere specified'
    ELSE 'Unknown product'
  END
WHERE description IS NULL;

-- Calculations table for storing user import calculations
CREATE TABLE IF NOT EXISTS calculations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Untitled Calculation',
  line_items JSONB NOT NULL DEFAULT '[]',
  total_value DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_duty DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Alerts table for rate change notifications
CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  hs_code TEXT NOT NULL,
  old_rate DECIMAL(5,2),
  new_rate DECIMAL(5,2) NOT NULL,
  message TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email_alerts BOOLEAN DEFAULT TRUE,
  push_notifications BOOLEAN DEFAULT TRUE,
  alert_threshold DECIMAL(3,2) DEFAULT 1.0, -- Minimum % change to trigger alert
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed additional sample tariff data for SaaS platform
INSERT INTO tariff_rates (hs_code, description, current_rate, previous_rate, source) VALUES
('8517.12', 'Smartphones and mobile phones', 7.5, 5.0, 'USITC'),
('8471.30', 'Portable automatic data processing machines (laptops)', 0, 0, 'USITC'),
('6109.10', 'T-shirts, singlets and other vests, knitted, of cotton', 16.5, 16.5, 'USITC'),
('6403.99', 'Other footwear with outer soles of rubber or plastics', 37.5, 35.0, 'USITC'),
('9403.10', 'Metal furniture of a kind used in offices', 0, 0, 'USITC'),
('3926.90', 'Other articles of plastics', 5.3, 5.3, 'USITC'),
('8703.23', 'Motor cars with spark-ignition internal combustion engines', 2.5, 2.5, 'USITC'),
('6204.62', 'Women\'s or girls\' trousers of cotton', 16.6, 16.6, 'USITC')
ON CONFLICT (hs_code) DO NOTHING;

-- Row Level Security (RLS) policies
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE calculations ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Workspace policies
CREATE POLICY "Users can view their own workspaces" ON workspaces
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own workspaces" ON workspaces
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own workspaces" ON workspaces
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own workspaces" ON workspaces
  FOR DELETE USING (auth.uid() = user_id);

-- Calculations policies
CREATE POLICY "Users can view calculations in their workspaces" ON calculations
  FOR SELECT USING (
    workspace_id IN (
      SELECT id FROM workspaces WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create calculations in their workspaces" ON calculations
  FOR INSERT WITH CHECK (
    workspace_id IN (
      SELECT id FROM workspaces WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update calculations in their workspaces" ON calculations
  FOR UPDATE USING (
    workspace_id IN (
      SELECT id FROM workspaces WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete calculations in their workspaces" ON calculations
  FOR DELETE USING (
    workspace_id IN (
      SELECT id FROM workspaces WHERE user_id = auth.uid()
    )
  );

-- Alerts policies
CREATE POLICY "Users can view alerts for their workspaces" ON alerts
  FOR SELECT USING (
    workspace_id IN (
      SELECT id FROM workspaces WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update alerts in their workspaces" ON alerts
  FOR UPDATE USING (
    workspace_id IN (
      SELECT id FROM workspaces WHERE user_id = auth.uid()
    )
  );

-- User preferences policies
CREATE POLICY "Users can view their own preferences" ON user_preferences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own preferences" ON user_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own preferences" ON user_preferences
  FOR UPDATE USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_workspaces_user_id ON workspaces(user_id);
CREATE INDEX IF NOT EXISTS idx_calculations_workspace_id ON calculations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_alerts_workspace_id ON alerts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_alerts_is_read ON alerts(is_read);
CREATE INDEX IF NOT EXISTS idx_tariff_rates_hs_code ON tariff_rates(hs_code);

-- Functions for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_workspaces_updated_at 
  BEFORE UPDATE ON workspaces 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_calculations_updated_at 
  BEFORE UPDATE ON calculations 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_preferences_updated_at 
  BEFORE UPDATE ON user_preferences 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();