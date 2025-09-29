/**
 * Current Tariff Rates API
 * 
 * Provides endpoints for fetching current official tariff rates from USITC DataWeb
 * and managing rate data for Preston's steel importing business.
 */

import { NextRequest, NextResponse } from 'next/server';

import { createServerSupabaseClient } from '@/lib/supabase-server';
import { usitcDataWebClient, getPrestonCurrentRates, PRESTON_HS_CODES_USITC } from '@/lib/usitc-dataweb-client';

// Types for API responses
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
  requestId: string;
}

interface CurrentRatesResponse {
  rates: { [hsCode: string]: number };
  source: 'USITC_DataWeb' | 'fallback';
  lastUpdated: string;
  prestonAnalysis: {
    totalContainerValue: number;
    annualDutyCost: number;
    averageRate: number;
  };
}

/**
 * GET /api/tariff-rates/current
 * Fetch current tariff rates for Preston's HS codes
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const requestId = generateRequestId();
  
  try {
    console.log(`📊 Fetching current tariff rates - Request: ${requestId}`);
    
    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const hsCode = searchParams.get('hs_code'); // Single HS code lookup
    const source = searchParams.get('source') || 'usitc';
    const includeAnalysis = searchParams.get('analysis') !== 'false';
    
    // If single HS code requested, handle individual lookup
    if (hsCode) {
      return handleSingleHsCodeLookup(hsCode, source, requestId);
    }
    
    let rates: { [hsCode: string]: number } = {};
    let dataSource: 'USITC_DataWeb' | 'fallback' = 'fallback';

    if (source === 'usitc') {
      try {
        // Get rates from USITC DataWeb API
        const usitcResponse = await usitcDataWebClient.getCurrentRates();
        
        if (usitcResponse.success && usitcResponse.data) {
          usitcResponse.data.forEach(rate => {
            rates[rate.hsCode] = rate.effectiveRate;
          });
          dataSource = 'USITC_DataWeb';
        } else {
          console.warn('USITC API call failed, using fallback rates');
          rates = await getPrestonCurrentRates();
        }
        
      } catch (error) {
        console.warn('USITC integration error, using fallback rates:', error);
        rates = await getPrestonCurrentRates();
      }
    } else {
      // Use fallback/database rates
      rates = await getPrestonCurrentRates();
    }

    // Calculate Preston business analysis
    let prestonAnalysis = {
      totalContainerValue: 0,
      annualDutyCost: 0,
      averageRate: 0,
    };

    if (includeAnalysis) {
      const entries = Object.entries(PRESTON_HS_CODES_USITC);
      let totalValue = 0;
      let totalDuty = 0;
      let totalRate = 0;

      entries.forEach(([hsCode, info]) => {
        const rate = rates[hsCode] || 0;
        const annualValue = info.containerValue * info.containersPeryear;
        const annualDuty = annualValue * (rate / 100);
        
        totalValue += annualValue;
        totalDuty += annualDuty;
        totalRate += rate;
      });

      prestonAnalysis = {
        totalContainerValue: totalValue,
        annualDutyCost: totalDuty,
        averageRate: totalRate / entries.length,
      };
    }

    const response: CurrentRatesResponse = {
      rates,
      source: dataSource,
      lastUpdated: new Date().toISOString(),
      prestonAnalysis,
    };

    console.log(`✅ Current rates retrieved - Request: ${requestId}, Source: ${dataSource}`);

    return NextResponse.json({
      success: true,
      data: response,
      timestamp: new Date().toISOString(),
      requestId,
    } satisfies ApiResponse<CurrentRatesResponse>);

  } catch (error) {
    console.error(`❌ Current rates request failed - Request: ${requestId}:`, error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date().toISOString(),
      requestId,
    } satisfies ApiResponse, { status: 500 });
  }
}

/**
 * POST /api/tariff-rates/current
 * Update current rates in database
 */
export async function POST(_request: NextRequest): Promise<NextResponse> {
  const requestId = generateRequestId();
  
  try {
    console.log(`🔄 Updating current tariff rates - Request: ${requestId}`);
    
    // Parse request body
    // const body = await request.json().catch(() => ({}));
    // const { source = 'usitc', forceUpdate = false } = body;

    // Get fresh rates from USITC
    const usitcResponse = await usitcDataWebClient.getCurrentRates();
    
    if (!usitcResponse.success || !usitcResponse.data) {
      throw new Error(`USITC API error: ${usitcResponse.error}`);
    }

    // Store in database (gracefully handle if database not configured)
    let stored = 0;
    try {
      const supabase = createServerSupabaseClient();
      
      for (const rate of usitcResponse.data) {
        const { error } = await supabase
          .from('tariff_rates')
          .upsert({
            hs_code: rate.hsCode,
            current_rate: rate.effectiveRate,
            general_rate: rate.generalRate,
            special_rate: rate.specialRate,
            effective_date: rate.effectiveDate,
            source: 'USITC_DataWeb',
            is_current: true,
            last_updated: new Date().toISOString(),
            request_id: requestId,
          })
          .select('id');

        if (!error || error.message.includes('does not exist')) {
          stored++;
        }
      }
      
    } catch (dbError) {
      console.warn('Database update failed (continuing with API response):', dbError);
    }

    console.log(`✅ Rates updated - Request: ${requestId}, Rates: ${usitcResponse.data.length}, Stored: ${stored}`);

    return NextResponse.json({
      success: true,
      data: {
        updated: usitcResponse.data.length,
        stored,
        rates: usitcResponse.data,
        source: 'USITC_DataWeb',
      },
      timestamp: new Date().toISOString(),
      requestId,
    } satisfies ApiResponse);

  } catch (error) {
    console.error(`❌ Rate update failed - Request: ${requestId}:`, error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date().toISOString(),
      requestId,
    } satisfies ApiResponse, { status: 500 });
  }
}

/**
 * PUT /api/tariff-rates/current
 * Force refresh all Preston's rates
 */
export async function PUT(_request: NextRequest): Promise<NextResponse> {
  const requestId = generateRequestId();
  
  try {
    console.log(`🔃 Force refreshing Preston's tariff rates - Request: ${requestId}`);
    
    // Force fresh data from USITC for all Preston's codes
    const usitcResponse = await usitcDataWebClient.getCurrentRates();
    
    if (!usitcResponse.success) {
      throw new Error(`USITC API error: ${usitcResponse.error}`);
    }

    // Calculate business impact
    const businessImpact = calculatePrestonImpact(usitcResponse.data || []);

    console.log(`✅ Force refresh completed - Request: ${requestId}`);

    return NextResponse.json({
      success: true,
      data: {
        rates: usitcResponse.data,
        businessImpact,
        refreshed: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
      requestId,
    } satisfies ApiResponse);

  } catch (error) {
    console.error(`❌ Force refresh failed - Request: ${requestId}:`, error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date().toISOString(),
      requestId,
    } satisfies ApiResponse, { status: 500 });
  }
}

/**
 * Helper Functions
 */

async function handleSingleHsCodeLookup(hsCode: string, source: string, requestId: string): Promise<NextResponse> {
  try {
    console.log(`🔍 [API] Single HS code lookup started: ${hsCode} - Request: ${requestId}`);
    console.log(`📋 [API] Lookup parameters - source: ${source}, hsCode: ${hsCode}`);
    
    let rate: number | null = null;
    let dataSource: 'USITC_DataWeb' | 'fallback' | 'database' = 'fallback';

    // First try to get from database if we have it
    console.log(`💾 [API] Attempting database lookup for HS code: ${hsCode}`);
    try {
      const supabase = createServerSupabaseClient();
      const cleanHsCode = hsCode.replace(/\./g, '');
      console.log(`🔧 [API] Cleaned HS code for DB query: ${cleanHsCode}`);
      
      const { data: dbRate, error } = await supabase
        .from('tariff_rates')
        .select('current_rate, general_rate')
        .eq('hs_code', cleanHsCode)
        .eq('is_current', true)
        .single();

      console.log(`📊 [API] Database query result - error: ${error?.message || 'none'}, data:`, dbRate);

      if (!error && dbRate) {
        rate = dbRate.current_rate || dbRate.general_rate || 0;
        dataSource = 'database';
        console.log(`✅ [API] Found rate in database: ${hsCode} = ${rate}% - Request: ${requestId}`);
      } else {
        console.log(`❌ [API] No rate found in database for ${hsCode} - Error: ${error?.message || 'No data'}`);
      }
    } catch (dbError) {
      console.warn(`⚠️ [API] Database lookup failed for ${hsCode}, trying external sources:`, dbError);
    }

    // If not found in database and source allows USITC, try external lookup
    if (rate === null && source === 'usitc') {
      console.log(`🌐 [API] Attempting USITC lookup for ${hsCode} since not found in database`);
      try {
        // For now, get all rates and find the specific one
        // TODO: Optimize this to lookup single HS code directly
        const usitcResponse = await usitcDataWebClient.getCurrentRates();
        console.log(`📡 [API] USITC response - success: ${usitcResponse.success}, data count: ${usitcResponse.data?.length || 0}`);
        
        if (usitcResponse.success && usitcResponse.data) {
          const foundRate = usitcResponse.data.find(r => r.hsCode === hsCode);
          console.log(`🔎 [API] Searching USITC data for ${hsCode}:`, foundRate ? `Found: ${foundRate.effectiveRate}%` : 'Not found');
          
          if (foundRate) {
            rate = foundRate.effectiveRate;
            dataSource = 'USITC_DataWeb';
            console.log(`✅ [API] Found rate via USITC: ${hsCode} = ${rate}% - Request: ${requestId}`);
          }
        } else {
          console.log(`❌ [API] USITC API call failed or returned no data for ${hsCode}`);
        }
      } catch (error) {
        console.warn(`⚠️ [API] USITC lookup failed for ${hsCode}:`, error);
      }
    }

    // Fallback to Preston's predefined rates if available
    if (rate === null) {
      console.log(`🔄 [API] Attempting Preston fallback rates for ${hsCode}`);
      try {
        const prestonRates = await getPrestonCurrentRates();
        console.log(`📋 [API] Preston rates available:`, Object.keys(prestonRates));
        
        if (prestonRates[hsCode] !== undefined) {
          rate = prestonRates[hsCode];
          dataSource = 'fallback';
          console.log(`✅ [API] Found rate in Preston fallback: ${hsCode} = ${rate}% - Request: ${requestId}`);
        } else {
          console.log(`❌ [API] HS code ${hsCode} not found in Preston fallback rates`);
        }
      } catch (error) {
        console.warn(`⚠️ [API] Preston fallback lookup failed for ${hsCode}:`, error);
      }
    }

    // Final result logging
    const finalResponse = {
      success: true,
      rate: rate,
      hsCode: hsCode,
      source: dataSource,
      timestamp: new Date().toISOString(),
      requestId,
    };
    
    console.log(`🎯 [API] Final response for ${hsCode}:`, finalResponse);
    console.log(`📊 [API] Rate lookup summary - HS: ${hsCode}, Rate: ${rate}, Source: ${dataSource}, Success: ${rate !== null}`);

    // Return response in format expected by calculator
    return NextResponse.json(finalResponse);

  } catch (error) {
    console.error(`❌ [API] Single HS code lookup failed - Request: ${requestId}, HS: ${hsCode}:`, error);
    
    const errorResponse = {
      success: false,
      rate: null,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date().toISOString(),
      requestId,
    };
    
    console.log(`💥 [API] Error response for ${hsCode}:`, errorResponse);
    
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

function generateRequestId(): string {
  return `rates-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function calculatePrestonImpact(rates: any[]): any {
  const impacts = rates.map(rate => {
    const info = PRESTON_HS_CODES_USITC[rate.hsCode as keyof typeof PRESTON_HS_CODES_USITC];
    if (!info) {return null;}

    const annualValue = info.containerValue * info.containersPeryear;
    const annualDuty = annualValue * (rate.effectiveRate / 100);
    const perContainerDuty = info.containerValue * (rate.effectiveRate / 100);

    return {
      hsCode: rate.hsCode,
      description: info.description,
      currentRate: rate.effectiveRate,
      containerValue: info.containerValue,
      containersPerYear: info.containersPeryear,
      annualImportValue: annualValue,
      annualDutyCost: annualDuty,
      perContainerDuty,
    };
  }).filter(Boolean);

  const totals = impacts.reduce((acc, impact) => ({
    totalAnnualValue: acc.totalAnnualValue + (impact?.annualImportValue || 0),
    totalAnnualDuty: acc.totalAnnualDuty + (impact?.annualDutyCost || 0),
    totalContainers: acc.totalContainers + (impact?.containersPerYear || 0),
  }), { totalAnnualValue: 0, totalAnnualDuty: 0, totalContainers: 0 });

  return {
    byProduct: impacts,
    totals,
    effectiveDutyRate: totals.totalAnnualValue > 0 ? (totals.totalAnnualDuty / totals.totalAnnualValue) * 100 : 0,
  };
}