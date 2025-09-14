/**
 * Calculation Approval Workflow API
 * Handles calculation approval requests and workflow management
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Create calculation approval request
export async function POST(request: NextRequest) {
  try {
    const {
      workspaceId,
      calculationData,
      totalValue,
      totalDuty,
      requestedBy
    } = await request.json()

    if (!workspaceId || !calculationData || !requestedBy) {
      return NextResponse.json(
        { error: 'Missing required fields: workspaceId, calculationData, requestedBy' },
        { status: 400 }
      )
    }

    // Verify user has permission to create calculations
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role, status')
      .eq('workspace_id', workspaceId)
      .eq('user_id', requestedBy)
      .eq('status', 'active')
      .single()

    if (!member) {
      return NextResponse.json(
        { error: 'User is not a member of this workspace' },
        { status: 403 }
      )
    }

    if (!['calculator', 'manager', 'admin', 'owner'].includes(member.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions to create calculations' },
        { status: 403 }
      )
    }

    // Create approval request
    const { data: approval, error } = await supabase
      .from('calculation_approvals')
      .insert({
        workspace_id: workspaceId,
        requested_by: requestedBy,
        calculation_data: calculationData,
        total_value: totalValue || 0,
        total_duty: totalDuty || 0,
        status: 'pending'
      })
      .select()
      .single()

    if (error) {
      await logger.error('Failed to create calculation approval request', {
        workspaceId,
        requestedBy,
        errorMessage: error.message
      }, error)

      return NextResponse.json(
        { error: 'Failed to create approval request' },
        { status: 500 }
      )
    }

    // Log team activity
    await supabase.rpc('log_team_activity', {
      p_workspace_id: workspaceId,
      p_activity_type: 'approval_requested',
      p_description: `Calculation approval requested`,
      p_user_id: requestedBy,
      p_entity_type: 'approval',
      p_entity_id: approval.id,
      p_activity_data: {
        total_value: totalValue,
        total_duty: totalDuty,
        line_items_count: calculationData.lineItems?.length || 0
      }
    })

    // Get requester info for response
    const { data: requester } = await supabase.auth.admin.getUserById(requestedBy)

    return NextResponse.json({
      success: true,
      approval: {
        id: approval.id,
        status: approval.status,
        totalValue: approval.total_value,
        totalDuty: approval.total_duty,
        requestedAt: approval.requested_at,
        requester: {
          email: requester.user?.email,
          name: requester.user?.user_metadata?.full_name || requester.user?.email?.split('@')[0]
        }
      }
    })

  } catch (error) {
    await logger.error('Failed to create calculation approval', {
      errorMessage: (error as Error).message
    }, error as Error)

    return NextResponse.json(
      { error: 'Failed to create approval request' },
      { status: 500 }
    )
  }
}

// Get pending approvals for workspace
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')
    const status = searchParams.get('status') || 'pending'

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Missing required parameter: workspaceId' },
        { status: 400 }
      )
    }

    // Get approvals
    const { data: approvals, error } = await supabase
      .from('calculation_approvals')
      .select(`
        id,
        calculation_data,
        total_value,
        total_duty,
        status,
        requested_by,
        requested_at,
        reviewed_by,
        reviewed_at,
        review_notes,
        final_calculation_id
      `)
      .eq('workspace_id', workspaceId)
      .eq('status', status)
      .order('requested_at', { ascending: false })

    if (error) {
      await logger.error('Failed to fetch calculation approvals', {
        workspaceId,
        errorMessage: error.message
      }, error)

      return NextResponse.json(
        { error: 'Failed to fetch approvals' },
        { status: 500 }
      )
    }

    // Get user details for requesters and reviewers
    const formattedApprovals = await Promise.all(
      approvals?.map(async (approval) => {
        const { data: requester } = await supabase.auth.admin.getUserById(approval.requested_by)

        let reviewer = null
        if (approval.reviewed_by) {
          const { data: reviewerData } = await supabase.auth.admin.getUserById(approval.reviewed_by)
          reviewer = {
            email: reviewerData.user?.email,
            name: reviewerData.user?.user_metadata?.full_name || reviewerData.user?.email?.split('@')[0]
          }
        }

        return {
          id: approval.id,
          calculationData: approval.calculation_data,
          totalValue: approval.total_value,
          totalDuty: approval.total_duty,
          status: approval.status,
          requestedAt: approval.requested_at,
          reviewedAt: approval.reviewed_at,
          reviewNotes: approval.review_notes,
          finalCalculationId: approval.final_calculation_id,
          requester: {
            email: requester.user?.email,
            name: requester.user?.user_metadata?.full_name || requester.user?.email?.split('@')[0]
          },
          reviewer
        }
      }) || []
    )

    return NextResponse.json({
      success: true,
      approvals: formattedApprovals
    })

  } catch (error) {
    await logger.error('Failed to fetch calculation approvals', {
      errorMessage: (error as Error).message
    }, error as Error)

    return NextResponse.json(
      { error: 'Failed to fetch approvals' },
      { status: 500 }
    )
  }
}

// Approve or reject calculation
export async function PATCH(request: NextRequest) {
  try {
    const {
      approvalId,
      action, // 'approve' or 'reject'
      reviewedBy,
      reviewNotes,
      workspaceId
    } = await request.json()

    if (!approvalId || !action || !reviewedBy || !workspaceId) {
      return NextResponse.json(
        { error: 'Missing required fields: approvalId, action, reviewedBy, workspaceId' },
        { status: 400 }
      )
    }

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "approve" or "reject"' },
        { status: 400 }
      )
    }

    // Verify user has permission to approve calculations
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role, can_approve_calculations')
      .eq('workspace_id', workspaceId)
      .eq('user_id', reviewedBy)
      .eq('status', 'active')
      .single()

    if (!member) {
      return NextResponse.json(
        { error: 'User is not a member of this workspace' },
        { status: 403 }
      )
    }

    const canApprove = member.can_approve_calculations ||
                      ['manager', 'admin', 'owner'].includes(member.role)

    if (!canApprove) {
      return NextResponse.json(
        { error: 'Insufficient permissions to approve calculations' },
        { status: 403 }
      )
    }

    // Get the approval request
    const { data: approval, error: getError } = await supabase
      .from('calculation_approvals')
      .select('*')
      .eq('id', approvalId)
      .eq('workspace_id', workspaceId)
      .single()

    if (getError || !approval) {
      return NextResponse.json(
        { error: 'Approval request not found' },
        { status: 404 }
      )
    }

    if (approval.status !== 'pending') {
      return NextResponse.json(
        { error: 'Approval request has already been processed' },
        { status: 400 }
      )
    }

    let finalCalculationId = null

    // If approving, create the actual calculation
    if (action === 'approve') {
      const { data: calculation, error: calcError } = await supabase
        .from('calculations')
        .insert({
          workspace_id: workspaceId,
          name: approval.calculation_data.name || 'Approved Calculation',
          line_items: approval.calculation_data.lineItems || [],
          total_value: approval.total_value,
          total_duty: approval.total_duty,
          created_by: approval.requested_by,
          approved_by: reviewedBy
        })
        .select()
        .single()

      if (calcError) {
        await logger.error('Failed to create approved calculation', {
          approvalId,
          workspaceId,
          errorMessage: calcError.message
        }, calcError)

        return NextResponse.json(
          { error: 'Failed to create calculation' },
          { status: 500 }
        )
      }

      finalCalculationId = calculation.id
    }

    // Update approval status
    const { error: updateError } = await supabase
      .from('calculation_approvals')
      .update({
        status: action === 'approve' ? 'approved' : 'rejected',
        reviewed_by: reviewedBy,
        reviewed_at: new Date().toISOString(),
        review_notes: reviewNotes,
        final_calculation_id: finalCalculationId
      })
      .eq('id', approvalId)

    if (updateError) {
      await logger.error('Failed to update approval status', {
        approvalId,
        action,
        errorMessage: updateError.message
      }, updateError)

      return NextResponse.json(
        { error: 'Failed to update approval' },
        { status: 500 }
      )
    }

    // Log activity
    await supabase.rpc('log_team_activity', {
      p_workspace_id: workspaceId,
      p_activity_type: `calculation_${action}d`,
      p_description: `Calculation ${action}d`,
      p_user_id: reviewedBy,
      p_target_user_id: approval.requested_by,
      p_entity_type: 'approval',
      p_entity_id: approvalId,
      p_activity_data: {
        action,
        has_notes: !!reviewNotes,
        final_calculation_id: finalCalculationId
      }
    })

    return NextResponse.json({
      success: true,
      approval: {
        id: approvalId,
        status: action === 'approve' ? 'approved' : 'rejected',
        reviewedAt: new Date().toISOString(),
        finalCalculationId
      }
    })

  } catch (error) {
    await logger.error('Failed to process calculation approval', {
      errorMessage: (error as Error).message
    }, error as Error)

    return NextResponse.json(
      { error: 'Failed to process approval' },
      { status: 500 }
    )
  }
}