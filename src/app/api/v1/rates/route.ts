/**
 * Public API v1 - Tariff Rates
 * External API endpoint for accessing current and historical tariff rates
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { withApiAuth } from '@/lib/api-middleware'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Get tariff rates
export async function GET(request: NextRequest) {
  return withApiAuth(request, async (req, _context) => {
    const { searchParams } = new URL(req.url)
    const hsCode = searchParams.get('hsCode')
    const includePrevious = searchParams.get('includePrevious') === 'true'
    const limit = parseInt(searchParams.get('limit') || '100')

    if (hsCode) {
      // Get specific HS code rate
      const cleanHsCode = hsCode.replace(/\./g, '')

      let query = supabase
        .from('tariff_rates')
        .select('*')
        .eq('hs_code', cleanHsCode)

      if (!includePrevious) {
        query = query.eq('is_current', true)
      }

      const { data: rates, error } = await query
        .order('effective_date', { ascending: false })

      if (error) {
        return NextResponse.json(
          { error: 'Failed to fetch tariff rate' },
          { status: 500 }
        )
      }

      if (!rates || rates.length === 0) {
        return NextResponse.json(
          { error: 'Tariff rate not found for HS code', hsCode },
          { status: 404 }
        )
      }

      const currentRate = rates.find(r => r.is_current)
      const historicalRates = rates.filter(r => !r.is_current)

      return NextResponse.json({
        success: true,
        data: {
          hsCode: hsCode,
          current: currentRate ? {
            rate: currentRate.current_rate,
            description: currentRate.description,
            source: currentRate.source,
            effectiveDate: currentRate.effective_date,
            lastVerified: currentRate.last_verified
          } : null,
          historical: includePrevious ? historicalRates.map(rate => ({
            rate: rate.current_rate,
            effectiveDate: rate.effective_date,
            source: rate.source
          })) : undefined
        }
      })

    } else {
      // Get multiple rates (for bulk lookups)
      const hsCodes = searchParams.get('hsCodes')?.split(',').map(code => code.replace(/\./g, ''))

      if (!hsCodes || hsCodes.length === 0) {
        return NextResponse.json(
          {
            error: 'Missing required parameter',
            details: 'Either hsCode or hsCodes parameter is required'
          },
          { status: 400 }
        )
      }

      if (hsCodes.length > limit) {
        return NextResponse.json(
          {
            error: 'Too many HS codes requested',
            details: `Maximum ${limit} HS codes allowed per request`
          },
          { status: 400 }
        )
      }

      const { data: rates, error } = await supabase
        .from('tariff_rates')
        .select('*')
        .in('hs_code', hsCodes)
        .eq('is_current', true)

      if (error) {
        return NextResponse.json(
          { error: 'Failed to fetch tariff rates' },
          { status: 500 }
        )
      }

      // Format rates by HS code
      const ratesByHsCode = (rates || []).reduce((acc, rate) => {
        acc[rate.hs_code] = {
          rate: rate.current_rate,
          description: rate.description,
          source: rate.source,
          effectiveDate: rate.effective_date,
          lastVerified: rate.last_verified
        }
        return acc
      }, {} as Record<string, any>)

      // Include requested codes that weren't found
      const result = hsCodes.reduce((acc, hsCode) => {
        acc[hsCode] = ratesByHsCode[hsCode] || null
        return acc
      }, {} as Record<string, any>)

      return NextResponse.json({
        success: true,
        data: {
          rates: result,
          found: Object.values(result).filter(r => r !== null).length,
          total: hsCodes.length
        }
      })
    }
  })
}

// Bulk rate lookup endpoint
export async function POST(request: NextRequest) {
  return withApiAuth(request, async (req, _context) => {
    const body = await req.json()
    const { hsCodes, includeDescription = true } = body

    if (!hsCodes || !Array.isArray(hsCodes)) {
      return NextResponse.json(
        {
          error: 'Invalid request body',
          details: 'hsCodes array is required'
        },
        { status: 400 }
      )
    }

    if (hsCodes.length > 1000) {
      return NextResponse.json(
        {
          error: 'Too many HS codes',
          details: 'Maximum 1000 HS codes allowed per bulk request'
        },
        { status: 400 }
      )
    }

    // Clean HS codes
    const cleanHsCodes = hsCodes.map(code =>
      typeof code === 'string' ? code.replace(/\./g, '') : String(code)
    )

    const { data: rates, error } = await supabase
      .from('tariff_rates')
      .select('*')
      .in('hs_code', cleanHsCodes)
      .eq('is_current', true)

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch tariff rates' },
        { status: 500 }
      )
    }

    // Create lookup map
    const rateMap = new Map(
      (rates || []).map(rate => [
        rate.hs_code,
        {
          hsCode: rate.hs_code,
          rate: rate.current_rate,
          description: includeDescription ? rate.description : undefined,
          source: rate.source,
          effectiveDate: rate.effective_date,
          lastVerified: rate.last_verified
        }
      ])
    )

    // Build result with all requested codes
    const results = cleanHsCodes.map(hsCode => ({
      hsCode,
      found: rateMap.has(hsCode),
      data: rateMap.get(hsCode) || null
    }))

    const foundCount = results.filter(r => r.found).length

    return NextResponse.json({
      success: true,
      data: {
        results,
        summary: {
          requested: cleanHsCodes.length,
          found: foundCount,
          notFound: cleanHsCodes.length - foundCount
        }
      }
    })
  })
}