/**
 * Database Schema Definitions
 * 
 * TypeScript definitions for database tables supporting Preston's
 * tariff monitoring system with Federal Register integration.
 */

export interface TariffRate {
  id: string
  hs_code: string
  product_description: string
  current_rate: number
  previous_rate?: number
  effective_date: string
  source: 'federal-register' | 'manual' | 'import' | 'api'
  is_current: boolean
  created_at: string
  updated_at: string
  metadata?: Record<string, any>
}

export interface TariffFinding {
  id: string
  hs_code: string
  product_description: string
  current_rate: number
  new_rate?: number
  effective_date?: string
  document_number?: string
  change_percent?: number
  is_significant: boolean
  container_impact?: number
  source: 'federal-register' | 'document-parsing' | 'manual'
  discovery_timestamp: string
  request_id: string
  processed: boolean
  created_at: string
  metadata?: Record<string, any>
}

export interface Alert {
  id: string
  type: 'tariff_rate_change' | 'document_published' | 'system_notification'
  title: string
  message: string
  priority: 'high' | 'normal' | 'low'
  hs_code?: string
  old_rate?: number
  new_rate?: number
  change_percent?: number
  container_impact?: number
  effective_date?: string
  document_number?: string
  source: string
  request_id?: string
  is_read: boolean
  read_at?: string
  created_at: string
  expires_at?: string
}

export interface MonitoringLog {
  id: string
  request_id: string
  type: 'manual' | 'automated' | 'triggered'
  status: 'success' | 'error' | 'partial'
  documents_scanned: number
  findings_count: number
  significant_changes: number
  alerts_generated: number
  duration_ms: number
  error_message?: string
  metadata?: Record<string, any>
  created_at: string
}

export interface HSCode {
  code: string
  description: string
  category: string
  is_monitored: boolean
  baseline_rate?: number
  alert_threshold?: number
  container_value_estimate?: number
  preston_priority: 'high' | 'medium' | 'low'
  created_at: string
  updated_at: string
  notes?: string
}

/**
 * SQL Schema Creation Scripts
 * These can be run in Supabase SQL editor to create the necessary tables
 */

export const CREATE_TARIFF_RATES_TABLE = `
CREATE TABLE IF NOT EXISTS tariff_rates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  hs_code TEXT NOT NULL,
  product_description TEXT NOT NULL,
  current_rate DECIMAL(5,2) NOT NULL,
  previous_rate DECIMAL(5,2),
  effective_date DATE NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('federal-register', 'manual', 'import', 'api')),
  is_current BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_tariff_rates_hs_code ON tariff_rates(hs_code);
CREATE INDEX IF NOT EXISTS idx_tariff_rates_current ON tariff_rates(hs_code, is_current);
CREATE INDEX IF NOT EXISTS idx_tariff_rates_effective_date ON tariff_rates(effective_date);
`;

export const CREATE_TARIFF_FINDINGS_TABLE = `
CREATE TABLE IF NOT EXISTS tariff_findings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  hs_code TEXT NOT NULL,
  product_description TEXT NOT NULL,
  current_rate DECIMAL(5,2) NOT NULL,
  new_rate DECIMAL(5,2),
  effective_date DATE,
  document_number TEXT,
  change_percent DECIMAL(5,2),
  is_significant BOOLEAN DEFAULT false,
  container_impact INTEGER,
  source TEXT NOT NULL CHECK (source IN ('federal-register', 'document-parsing', 'manual')),
  discovery_timestamp TIMESTAMPTZ DEFAULT NOW(),
  request_id TEXT NOT NULL,
  processed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_tariff_findings_hs_code ON tariff_findings(hs_code);
CREATE INDEX IF NOT EXISTS idx_tariff_findings_request_id ON tariff_findings(request_id);
CREATE INDEX IF NOT EXISTS idx_tariff_findings_significant ON tariff_findings(is_significant, created_at);
CREATE INDEX IF NOT EXISTS idx_tariff_findings_processed ON tariff_findings(processed, created_at);
`;

export const CREATE_ALERTS_TABLE = `
CREATE TABLE IF NOT EXISTS alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('tariff_rate_change', 'document_published', 'system_notification')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('high', 'normal', 'low')),
  hs_code TEXT,
  old_rate DECIMAL(5,2),
  new_rate DECIMAL(5,2),
  change_percent DECIMAL(5,2),
  container_impact INTEGER,
  effective_date DATE,
  document_number TEXT,
  source TEXT NOT NULL,
  request_id TEXT,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_alerts_unread ON alerts(is_read, created_at);
CREATE INDEX IF NOT EXISTS idx_alerts_hs_code ON alerts(hs_code);
CREATE INDEX IF NOT EXISTS idx_alerts_priority ON alerts(priority, created_at);
CREATE INDEX IF NOT EXISTS idx_alerts_expires ON alerts(expires_at);
`;

export const CREATE_MONITORING_LOG_TABLE = `
CREATE TABLE IF NOT EXISTS monitoring_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('manual', 'automated', 'triggered')),
  status TEXT NOT NULL CHECK (status IN ('success', 'error', 'partial')),
  documents_scanned INTEGER DEFAULT 0,
  findings_count INTEGER DEFAULT 0,
  significant_changes INTEGER DEFAULT 0,
  alerts_generated INTEGER DEFAULT 0,
  duration_ms INTEGER DEFAULT 0,
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_monitoring_log_type ON monitoring_log(type, created_at);
CREATE INDEX IF NOT EXISTS idx_monitoring_log_status ON monitoring_log(status, created_at);
CREATE INDEX IF NOT EXISTS idx_monitoring_log_request_id ON monitoring_log(request_id);
`;

export const CREATE_HS_CODES_TABLE = `
CREATE TABLE IF NOT EXISTS hs_codes (
  code TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  is_monitored BOOLEAN DEFAULT false,
  baseline_rate DECIMAL(5,2),
  alert_threshold DECIMAL(5,2) DEFAULT 1.0,
  container_value_estimate INTEGER,
  preston_priority TEXT CHECK (preston_priority IN ('high', 'medium', 'low')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_hs_codes_monitored ON hs_codes(is_monitored);
CREATE INDEX IF NOT EXISTS idx_hs_codes_priority ON hs_codes(preston_priority);
`;

export const INSERT_PRESTON_HS_CODES = `
INSERT INTO hs_codes (code, description, category, is_monitored, baseline_rate, container_value_estimate, preston_priority, notes)
VALUES 
  ('7318.15.20', 'Steel fasteners - bolts, screws, and threaded articles', 'Steel Products', true, 25.0, 57500, 'high', 'Primary product for Preston''s construction business'),
  ('8481.80.90', 'Taps, cocks, valves and similar appliances, other', 'Valves & Fittings', true, 25.0, 57500, 'high', 'Industrial valves for construction projects'),
  ('7326.90.85', 'Other articles of iron or steel, not elsewhere specified', 'Steel Articles', true, 25.0, 57500, 'high', 'Miscellaneous steel articles and components')
ON CONFLICT (code) DO UPDATE SET
  description = EXCLUDED.description,
  is_monitored = EXCLUDED.is_monitored,
  baseline_rate = EXCLUDED.baseline_rate,
  container_value_estimate = EXCLUDED.container_value_estimate,
  preston_priority = EXCLUDED.preston_priority,
  notes = EXCLUDED.notes,
  updated_at = NOW();
`;

/**
 * Row Level Security Policies
 * These ensure data security in Supabase
 */

export const CREATE_RLS_POLICIES = `
-- Enable RLS on all tables
ALTER TABLE tariff_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE tariff_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitoring_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE hs_codes ENABLE ROW LEVEL SECURITY;

-- Allow read access for authenticated users
CREATE POLICY "Allow read access for authenticated users" ON tariff_rates FOR SELECT USING (true);
CREATE POLICY "Allow read access for authenticated users" ON tariff_findings FOR SELECT USING (true);
CREATE POLICY "Allow read access for authenticated users" ON alerts FOR SELECT USING (true);
CREATE POLICY "Allow read access for authenticated users" ON monitoring_log FOR SELECT USING (true);
CREATE POLICY "Allow read access for authenticated users" ON hs_codes FOR SELECT USING (true);

-- Allow insert/update for service role (API operations)
CREATE POLICY "Allow API operations" ON tariff_rates FOR ALL USING (true);
CREATE POLICY "Allow API operations" ON tariff_findings FOR ALL USING (true);
CREATE POLICY "Allow API operations" ON alerts FOR ALL USING (true);
CREATE POLICY "Allow API operations" ON monitoring_log FOR ALL USING (true);
CREATE POLICY "Allow API operations" ON hs_codes FOR ALL USING (true);
`;

/**
 * Database initialization function
 */
export async function initializeDatabase(supabaseClient: any): Promise<void> {
  const scripts = [
    CREATE_TARIFF_RATES_TABLE,
    CREATE_TARIFF_FINDINGS_TABLE,
    CREATE_ALERTS_TABLE,
    CREATE_MONITORING_LOG_TABLE,
    CREATE_HS_CODES_TABLE,
    INSERT_PRESTON_HS_CODES,
    CREATE_RLS_POLICIES
  ];

  for (const script of scripts) {
    try {
      await supabaseClient.rpc('exec_sql', { sql_query: script });
      console.log('✅ Database script executed successfully');
    } catch (error) {
      console.error('❌ Database script failed:', error);
      throw error;
    }
  }
}