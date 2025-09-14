/**
 * Federal Register Monitoring API Endpoints
 * 
 * Provides RESTful endpoints for manual and automated tariff monitoring
 * focused on Preston's steel importing business requirements.
 */

import { NextRequest, NextResponse } from 'next/server'

import { federalRegisterClient, PRESTON_HS_CODES, type MonitoringResult, type TariffRate } from '@/lib/federal-register-client'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// Types for API responses
interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  timestamp: string
  requestId: string
}

interface ManualCheckResponse {
  monitoring: MonitoringResult
  storedFindings: number
  alertsGenerated: number
  summary: {
    documentsScanned: number
    significantChanges: number
    containerImpactRange: string
    nextRecommendedCheck: string
  }
}

/**
 * GET /api/monitor/federal-register
 * Manual monitoring check - triggered by user action or dashboard
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const requestId = generateRequestId()
  
  try {
    console.log(`📊 Federal Register manual check initiated - Request: ${requestId}`)
    
    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const daysBack = parseInt(searchParams.get('daysBack') || '7')
    // const hsCode = searchParams.get('hsCode') || undefined
    // const forceCheck = searchParams.get('force') === 'true'
    
    // Input validation
    if (daysBack < 1 || daysBack > 90) {
      return NextResponse.json({
        success: false,
        error: 'daysBack parameter must be between 1 and 90',
        timestamp: new Date().toISOString(),
        requestId
      } satisfies ApiResponse, { status: 400 })
    }
    
    // Get baseline rates from database
    const baselineRates = await getBaselineRates()
    
    // Perform monitoring
    const monitoring = await federalRegisterClient.monitorTariffChanges({
      daysBack,
      baselineRates,
      changeThreshold: 1.0 // 1% threshold for Preston
    })
    
    // Store findings in database
    const storedFindings = await storeTariffFindings(monitoring.rateChangesFound, requestId)
    
    // Generate alerts for significant changes
    const alertsGenerated = await generateAlerts(monitoring.significantChanges, requestId)
    
    // Calculate summary statistics
    const summary = {
      documentsScanned: monitoring.documentsScanned,
      significantChanges: monitoring.significantChanges.length,
      containerImpactRange: calculateImpactRange(monitoring.significantChanges),
      nextRecommendedCheck: monitoring.nextCheckRecommended || 
        new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString()
    }
    
    const response: ManualCheckResponse = {
      monitoring,
      storedFindings,
      alertsGenerated,
      summary
    }
    
    console.log(`✅ Federal Register check completed - Request: ${requestId}, Changes: ${monitoring.significantChanges.length}`)
    
    return NextResponse.json({
      success: true,
      data: response,
      timestamp: new Date().toISOString(),
      requestId
    } satisfies ApiResponse<ManualCheckResponse>)
    
  } catch (error) {
    console.error(`❌ Federal Register check failed - Request: ${requestId}:`, error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date().toISOString(),
      requestId
    } satisfies ApiResponse, { status: 500 })
  }
}

/**
 * POST /api/monitor/federal-register
 * Triggered monitoring - for automated checks and webhooks
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const requestId = generateRequestId()
  
  try {
    console.log(`🔄 Federal Register triggered check initiated - Request: ${requestId}`)
    
    // Parse request body
    const body = await request.json().catch(() => ({}))
    const {
      daysBack = 1,
      specificHsCode,
      alertThreshold = 1.0,
      source = 'automated',
      metadata = {}
    } = body
    
    // Input validation
    if (daysBack < 1 || daysBack > 30) {
      return NextResponse.json({
        success: false,
        error: 'daysBack parameter must be between 1 and 30 for triggered checks',
        timestamp: new Date().toISOString(),
        requestId
      } satisfies ApiResponse, { status: 400 })
    }
    
    // Validate HS code if provided
    if (specificHsCode && !Object.keys(PRESTON_HS_CODES).includes(specificHsCode)) {
      return NextResponse.json({
        success: false,
        error: `Invalid HS code. Must be one of: ${Object.keys(PRESTON_HS_CODES).join(', ')}`,
        timestamp: new Date().toISOString(),
        requestId
      } satisfies ApiResponse, { status: 400 })
    }
    
    // Get baseline rates
    const baselineRates = await getBaselineRates()
    
    // Perform focused monitoring
    const monitoring = await federalRegisterClient.monitorTariffChanges({
      daysBack,
      baselineRates,
      changeThreshold: alertThreshold
    })
    
    // Store findings with source tracking
    const storedFindings = await storeTariffFindings(
      monitoring.rateChangesFound, 
      requestId, 
      { source, ...metadata }
    )
    
    // Generate high-priority alerts for triggered checks
    const alertsGenerated = await generateAlerts(
      monitoring.significantChanges, 
      requestId, 
      { priority: 'high', source }
    )
    
    // Log successful automated check
    if (source === 'automated') {
      console.log(`🤖 Automated check completed - Request: ${requestId}, Significant changes: ${monitoring.significantChanges.length}`)
    }
    
    const response = {
      monitoring,
      storedFindings,
      alertsGenerated,
      source,
      processingTime: Date.now() - parseInt(requestId.split('-')[1] || '0')
    }
    
    return NextResponse.json({
      success: true,
      data: response,
      timestamp: new Date().toISOString(),
      requestId
    } satisfies ApiResponse)
    
  } catch (error) {
    console.error(`❌ Federal Register triggered check failed - Request: ${requestId}:`, error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date().toISOString(),
      requestId
    } satisfies ApiResponse, { status: 500 })
  }
}

/**
 * Helper Functions
 */

/**
 * Generate unique request ID for tracking
 */
function generateRequestId(): string {
  return `fr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Get baseline tariff rates from database
 */
async function getBaselineRates(): Promise<{ [hsCode: string]: number }> {
  try {
    const supabase = createServerSupabaseClient()
    
    const { data, error } = await supabase
      .from('tariff_rates')
      .select('hs_code, current_rate')
      .in('hs_code', Object.keys(PRESTON_HS_CODES))
      .eq('is_current', true)
    
    if (error && !error.message.includes('does not exist')) {
      throw error
    }
    
    // Convert to map for easy lookup
    const rates: { [hsCode: string]: number } = {}
    
    if (data) {
      data.forEach((row: any) => {
        rates[row.hs_code] = row.current_rate
      })
    }
    
    // Fill in default rates for Preston's codes if not in database
    const defaults: { [hsCode: string]: number } = {
      '7318.15.20': 25.0, // Section 232 steel tariff
      '8481.80.90': 25.0, // Section 232 steel tariff
      '7326.90.85': 25.0, // Section 232 steel tariff
    }
    
    Object.keys(PRESTON_HS_CODES).forEach(hsCode => {
      if (!rates[hsCode]) {
        rates[hsCode] = defaults[hsCode] || 0
      }
    })
    
    return rates
    
  } catch (error) {
    console.warn('Failed to get baseline rates from database, using defaults:', error)
    
    // Return default Section 232 rates for Preston's steel products
    return {
      '7318.15.20': 25.0,
      '8481.80.90': 25.0,
      '7326.90.85': 25.0,
    }
  }
}

/**
 * Store tariff findings in database
 */
async function storeTariffFindings(
  findings: TariffRate[], 
  requestId: string, 
  metadata: any = {}
): Promise<number> {
  try {
    if (findings.length === 0) {return 0}
    
    const supabase = createServerSupabaseClient()
    
    // Prepare records for insertion
    const records = findings.map(finding => ({
      hs_code: finding.hsCode,
      product_description: finding.productDescription,
      current_rate: finding.currentRate,
      new_rate: finding.newRate,
      effective_date: finding.effectiveDate,
      document_number: finding.documentNumber,
      change_percent: finding.changePercent,
      is_significant: finding.isSignificant,
      container_impact: finding.containerImpact,
      source: finding.source,
      discovery_timestamp: new Date().toISOString(),
      request_id: requestId,
      metadata
    }))
    
    const { data, error } = await supabase
      .from('tariff_findings')
      .insert(records)
      .select('id')
    
    if (error && !error.message.includes('does not exist')) {
      throw error
    }
    
    return data?.length || records.length
    
  } catch (error) {
    console.error('Failed to store tariff findings:', error)
    return 0 // Continue execution even if storage fails
  }
}

/**
 * Generate alerts for significant changes
 */
async function generateAlerts(
  significantChanges: TariffRate[], 
  requestId: string,
  options: { priority?: 'high' | 'normal', source?: string } = {}
): Promise<number> {
  try {
    if (significantChanges.length === 0) {return 0}
    
    const { priority = 'normal', source = 'manual' } = options
    const supabase = createServerSupabaseClient()
    
    // Create alert records
    const alerts = significantChanges.map(change => ({
      type: 'tariff_rate_change',
      title: `Tariff Change Alert: ${change.hsCode}`,
      message: generateAlertMessage(change),
      priority,
      hs_code: change.hsCode,
      old_rate: change.currentRate - (change.changePercent || 0) / 100 * change.currentRate,
      new_rate: change.currentRate,
      change_percent: change.changePercent,
      container_impact: change.containerImpact,
      effective_date: change.effectiveDate,
      document_number: change.documentNumber,
      source,
      request_id: requestId,
      created_at: new Date().toISOString(),
      is_read: false
    }))
    
    const { data, error } = await supabase
      .from('alerts')
      .insert(alerts)
      .select('id')
    
    if (error && !error.message.includes('does not exist')) {
      throw error
    }
    
    // Log alert generation for monitoring
    console.log(`🚨 Generated ${alerts.length} alert(s) for significant tariff changes - Request: ${requestId}`)
    
    return data?.length || alerts.length
    
  } catch (error) {
    console.error('Failed to generate alerts:', error)
    return 0 // Continue execution even if alert generation fails
  }
}

/**
 * Generate alert message for tariff change
 */
function generateAlertMessage(change: TariffRate): string {
  const direction = (change.changePercent || 0) > 0 ? 'increased' : 'decreased'
  const impactText = change.containerImpact 
    ? ` This change will impact container costs by approximately $${Math.abs(change.containerImpact).toLocaleString()}.`
    : ''
  
  return `Tariff rate for ${change.productDescription} (${change.hsCode}) has ${direction} by ${Math.abs(change.changePercent || 0).toFixed(1)}%.${impactText} Effective: ${change.effectiveDate || 'TBD'}`
}

/**
 * Calculate container impact range for summary
 */
function calculateImpactRange(changes: TariffRate[]): string {
  if (changes.length === 0) {return '$0'}
  
  const impacts = changes
    .map(c => Math.abs(c.containerImpact || 0))
    .filter(impact => impact > 0)
  
  if (impacts.length === 0) {return '$0'}
  
  const min = Math.min(...impacts)
  const max = Math.max(...impacts)
  
  if (min === max) {return `$${min.toLocaleString()}`}
  return `$${min.toLocaleString()} - $${max.toLocaleString()}`
}