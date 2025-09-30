export const dynamic = 'force-dynamic'
/**
 * USITC DataWeb API Test Endpoint
 * 
 * Tests the USITC DataWeb API integration with real credentials
 */

import { NextRequest, NextResponse } from 'next/server';

import { usitcDataWebClient } from '@/lib/usitc-dataweb-client';

export async function GET(_request: NextRequest): Promise<NextResponse> {
  const requestId = `test-usitc-${Date.now()}`;
  
  try {
    console.log(`🧪 Testing USITC DataWeb API - Request: ${requestId}`);
    
    // Test 1: API Connectivity
    const connectivityTest = await usitcDataWebClient.testConnection();
    
    // Test 2: Current Rates Retrieval  
    let ratesTest = null;
    try {
      ratesTest = await usitcDataWebClient.getCurrentRates();
    } catch (error) {
      ratesTest = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    // Test 3: Configuration Check
    const configTest = {
      hasApiKey: Boolean(process.env.USITC_API_KEY),
      hasBaseUrl: Boolean(process.env.USITC_BASE_URL),
      baseUrl: process.env.USITC_BASE_URL || 'Not configured',
    };

    const results = {
      connectivity: connectivityTest,
      rates: ratesTest,
      configuration: configTest,
      timestamp: new Date().toISOString(),
      requestId,
    };

    const allTestsPassed = connectivityTest.success && (ratesTest?.success !== false);

    console.log(`${allTestsPassed ? '✅' : '❌'} USITC tests completed - Request: ${requestId}`);

    return NextResponse.json({
      success: allTestsPassed,
      data: results,
      timestamp: new Date().toISOString(),
      requestId,
    }, { status: allTestsPassed ? 200 : 500 });

  } catch (error) {
    console.error(`❌ USITC test failed - Request: ${requestId}:`, error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date().toISOString(),
      requestId,
    }, { status: 500 });
  }
}