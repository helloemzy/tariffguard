/**
 * Public API v1 - Calculations
 * External API endpoint for developers to integrate with TariffGuard
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { withApiAuth } from '@/lib/api-middleware'

// Get calculations
export async function GET(request: NextRequest) {
  const supabase = createServerSupabaseClient()

  return withApiAuth(request, async (req, context) => {
    const { searchParams } = new URL(req.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const status = searchParams.get('status') // pending, completed, etc.

    let query = supabase
      .from('calculations')
      .select(`
        id,
        name,
        line_items,
        total_value,
        total_duty,
        status,
        created_at,
        updated_at
      `)
      .eq('workspace_id', context.workspace.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status) {
      query = query.eq('status', status)
    }

    const { data: calculations, error } = await query

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch calculations' },
        { status: 500 }
      )
    }

    // Format calculations for API response
    const formattedCalculations = calculations?.map(calc => ({
      id: calc.id,
      name: calc.name,
      lineItems: calc.line_items,
      totals: {
        value: calc.total_value,
        duty: calc.total_duty,
        effectiveRate: calc.total_value > 0
          ? (calc.total_duty / calc.total_value) * 100
          : 0
      },
      status: calc.status,
      createdAt: calc.created_at,
      updatedAt: calc.updated_at
    })) || []

    return NextResponse.json({
      success: true,
      data: formattedCalculations,
      pagination: {
        limit,
        offset,
        hasMore: calculations?.length === limit,
        total: formattedCalculations.length
      }
    })
  })
}

// Create new calculation
export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient()

  return withApiAuth(request, async (req, context) => {
    const body = await req.json()
    const { name, lineItems, metadata } = body

    if (!name || !lineItems || !Array.isArray(lineItems)) {
      return NextResponse.json(
        {
          error: 'Missing required fields',
          details: 'name (string) and lineItems (array) are required'
        },
        { status: 400 }
      )
    }

    // Validate line items structure
    for (const item of lineItems) {
      if (!item.hsCode || !item.description || !item.value || !item.quantity) {
        return NextResponse.json(
          {
            error: 'Invalid line item structure',
            details: 'Each line item must have: hsCode, description, value, quantity'
          },
          { status: 400 }
        )
      }
    }

    try {
      // Calculate duties for each line item
      const processedLineItems = []
      let totalValue = 0
      let totalDuty = 0

      for (const item of lineItems) {
        // Fetch current tariff rate
        const { data: tariffRate } = await supabase
          .from('tariff_rates')
          .select('current_rate')
          .eq('hs_code', item.hsCode.replace(/\./g, ''))
          .eq('is_current', true)
          .single()

        const rate = tariffRate?.current_rate || 0
        const itemValue = parseFloat(item.value) * parseInt(item.quantity)
        const itemDuty = itemValue * (rate / 100)

        processedLineItems.push({
          ...item,
          rate,
          totalValue: itemValue,
          duty: itemDuty,
          effectiveRate: rate
        })

        totalValue += itemValue
        totalDuty += itemDuty
      }

      // Create calculation record
      const { data: calculation, error } = await supabase
        .from('calculations')
        .insert({
          workspace_id: context.workspace.id,
          name,
          line_items: processedLineItems,
          total_value: totalValue,
          total_duty: totalDuty,
          status: 'completed',
          metadata,
          created_via: 'api'
        })
        .select()
        .single()

      if (error) {
        return NextResponse.json(
          { error: 'Failed to create calculation' },
          { status: 500 }
        )
      }

      // Log team activity
      await supabase.rpc('log_team_activity', {
        p_workspace_id: context.workspace.id,
        p_activity_type: 'calculation_created_api',
        p_description: `Calculation "${name}" created via API`,
        p_entity_type: 'calculation',
        p_entity_id: calculation.id,
        p_activity_data: {
          created_via: 'api',
          token_name: context.token.name,
          line_items_count: processedLineItems.length,
          total_value: totalValue,
          total_duty: totalDuty
        }
      })

      return NextResponse.json({
        success: true,
        data: {
          id: calculation.id,
          name: calculation.name,
          lineItems: processedLineItems,
          totals: {
            value: totalValue,
            duty: totalDuty,
            effectiveRate: totalValue > 0 ? (totalDuty / totalValue) * 100 : 0
          },
          status: calculation.status,
          createdAt: calculation.created_at
        }
      }, { status: 201 })

    } catch (error) {
      console.error('Calculation creation error:', error)
      return NextResponse.json(
        { error: 'Failed to process calculation' },
        { status: 500 }
      )
    }
  })
}