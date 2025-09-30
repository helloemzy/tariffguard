/**
 * Save Calculation API
 * Handles saving calculations with usage tracking and subscription enforcement
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { enforceUsageLimit, incrementCalculationUsage } from '@/lib/usage-tracking'

export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient()

  try {
    const { 
      workspaceId, 
      name, 
      lineItems, 
      totalValue, 
      totalDuty, 
      effectiveRate,
      metadata 
    } = await request.json()

    if (!workspaceId || !name || !lineItems || !Array.isArray(lineItems)) {
      return NextResponse.json(
        { error: 'Missing required fields: workspaceId, name, lineItems' },
        { status: 400 }
      )
    }

    // TODO: Re-enable usage limits when billing is implemented
    // Check usage limits before saving
    // try {
    //   await enforceUsageLimit(workspaceId)
    // } catch (error) {
    //   return NextResponse.json(
    //     { 
    //       error: 'Usage limit exceeded',
    //       message: error instanceof Error ? error.message : 'Unknown error',
    //       limitExceeded: true
    //     },
    //     { status: 403 }
    //   )
    // }

    // Save the calculation
    const { data: calculation, error: saveError } = await supabase
      .from('calculations')
      .insert({
        workspace_id: workspaceId,
        name: name.trim(),
        line_items: lineItems,
        total_value: totalValue || 0,
        total_duty: totalDuty || 0,
        effective_rate: effectiveRate || 0,
        metadata: metadata || {}
      })
      .select()
      .single()

    if (saveError) {
      console.error('❌ Error saving calculation:', saveError)
      return NextResponse.json(
        { error: 'Failed to save calculation' },
        { status: 500 }
      )
    }

    // Increment usage count
    const usageUpdated = await incrementCalculationUsage(workspaceId)
    if (!usageUpdated) {
      console.warn('⚠️ Failed to increment usage count, but calculation was saved')
    }

    console.log(`✅ Saved calculation "${name}" for workspace ${workspaceId}`)

    return NextResponse.json({
      success: true,
      calculation: {
        id: calculation.id,
        name: calculation.name,
        totalValue: calculation.total_value,
        totalDuty: calculation.total_duty,
        effectiveRate: calculation.effective_rate,
        createdAt: calculation.created_at,
        lineItemsCount: lineItems.length
      }
    })

  } catch (error) {
    console.error('❌ Failed to save calculation:', error)
    return NextResponse.json(
      { error: 'Failed to save calculation' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  const supabase = createServerSupabaseClient()

  try {
    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')
    const limit = parseInt(searchParams.get('limit') || '10')
    const offset = parseInt(searchParams.get('offset') || '0')

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Missing required parameter: workspaceId' },
        { status: 400 }
      )
    }

    // Get calculations for workspace
    const { data: calculations, error } = await supabase
      .from('calculations')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('❌ Error fetching calculations:', error)
      return NextResponse.json(
        { error: 'Failed to fetch calculations' },
        { status: 500 }
      )
    }

    // Get total count
    const { count, error: countError } = await supabase
      .from('calculations')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)

    if (countError) {
      console.error('❌ Error getting calculations count:', countError)
    }

    return NextResponse.json({
      success: true,
      calculations: calculations?.map(calc => ({
        id: calc.id,
        name: calc.name,
        totalValue: calc.total_value,
        totalDuty: calc.total_duty,
        effectiveRate: calc.effective_rate,
        lineItemsCount: Array.isArray(calc.line_items) ? calc.line_items.length : 0,
        createdAt: calc.created_at,
        updatedAt: calc.updated_at
      })) || [],
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: (count || 0) > offset + limit
      }
    })

  } catch (error) {
    console.error('❌ Failed to fetch calculations:', error)
    return NextResponse.json(
      { error: 'Failed to fetch calculations' },
      { status: 500 }
    )
  }
}