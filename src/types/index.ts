// Database types
export interface User {
  id: string
  email: string
  created_at: string
  updated_at: string
  full_name?: string
  avatar_url?: string
  organization?: string
}

// Tariff monitoring types
export interface TariffRate {
  id: string
  hs_code: string
  product_description: string
  country_origin: string
  country_destination: string
  current_rate: number
  previous_rate?: number
  effective_date: string
  source: string
  created_at: string
  updated_at: string
}

export interface TariffAlert {
  id: string
  user_id: string
  hs_code: string
  country_origin: string
  country_destination: string
  threshold_percentage: number
  alert_type: 'increase' | 'decrease' | 'any_change'
  is_active: boolean
  last_triggered?: string
  created_at: string
  updated_at: string
}

export interface TariffMonitor {
  id: string
  user_id: string
  name: string
  description?: string
  hs_codes: string[]
  countries: string[]
  is_active: boolean
  created_at: string
  updated_at: string
  alerts: TariffAlert[]
}

// API response types
export interface ApiResponse<T> {
  data: T
  success: boolean
  message?: string
  error?: string
}

export interface PaginatedResponse<T> extends ApiResponse<T> {
  pagination: {
    page: number
    per_page: number
    total: number
    total_pages: number
  }
}

// Form types
export interface CreateMonitorForm {
  name: string
  description?: string
  hs_codes: string[]
  countries: string[]
  alerts: Omit<
    TariffAlert,
    'id' | 'user_id' | 'created_at' | 'updated_at' | 'last_triggered'
  >[]
}

// Chart data types
export interface ChartDataPoint {
  date: string
  rate: number
  label?: string
}

export interface TariffTrendData {
  hs_code: string
  product_description: string
  data: ChartDataPoint[]
}
