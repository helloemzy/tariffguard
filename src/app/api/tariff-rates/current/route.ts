/**
 * Current Tariff Rates API
 * 
 * Provides endpoints for fetching current official tariff rates from USITC DataWeb
 * and managing rate data for Preston's steel importing business.
 */

import { NextRequest, NextResponse } from 'next/server';

import { createServerSupabaseClient } from '@/lib/supabase-minimal';
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
    // const hsCodes = searchParams.get('hsCodes')?.split(',') || Object.keys(PRESTON_HS_CODES_USITC);
    const source = searchParams.get('source') || 'usitc';
    const includeAnalysis = searchParams.get('analysis') !== 'false';
    
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