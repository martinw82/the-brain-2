/**
 * Trust Pending API Endpoint
 * Phase 1 - v2.2 Architecture
 * 
 * GET /api/trust-pending
 * Lists pending trust gate approvals
 */

import { db } from '../src/db/index.ts';
import { workflow_trust, trust_events } from '../src/db/schema.ts';
import { eq, and, desc, isNull } from 'drizzle-orm';
import { TIER_DESCRIPTIONS, GATE_STATUS } from '../src/config/trustLadder.js';

export default async function handler(req, res) {
  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed', allowed: ['GET'] });
  }

  try {
    const { 
      project_id, 
      workflow_id, 
      gate_name,
      tier,
      limit = 50,
      offset = 0 
    } = req.query;

    // Build query for workflows needing approval
    let query = db.select().from(workflow_trust);
    
    if (project_id) {
      query = query.where(eq(workflow_trust.project_id, project_id));
    }
    
    if (workflow_id) {
      query = query.where(eq(workflow_trust.workflow_id, workflow_id));
    }
    
    if (tier) {
      query = query.where(eq(workflow_trust.current_tier, parseInt(tier)));
    }
    
    // Get workflows that need approval (Tier 1 or Tier 2)
    const workflows = await query;
    
    // For each workflow, get pending gates
    const pendingApprovals = [];
    
    for (const workflow of workflows) {
      // Skip Tier 3 (autopilot)
      if (workflow.current_tier === 3) continue;
      
      // Get recent events to determine which gates are pending
      const recentEvents = await db.select()
        .from(trust_events)
        .where(eq(trust_events.workflow_id, workflow.workflow_id))
        .orderBy(desc(trust_events.decided_at));
      
      // Group events by gate
      const gateStatus = {};
      for (const event of recentEvents) {
        if (!gateStatus[event.gate_name]) {
          gateStatus[event.gate_name] = event;
        }
      }
      
      // Determine pending gates (this would need project-specific gate configuration)
      // For now, list all gates that don't have a recent approval
      const pendingGates = [];
      
      // If no gates have been passed, the workflow needs initial approval
      const approvedGates = Object.values(gateStatus).filter(e => e.decision === 'approved');
      const rejectedGates = Object.values(gateStatus).filter(e => e.decision === 'rejected');
      
      if (approvedGates.length === 0 && workflow.current_tier === 1) {
        pendingGates.push({
          gate_name: 'initial_approval',
          status: GATE_STATUS.PENDING,
          reason: 'Workflow requires initial approval (Tier 1)',
        });
      }
      
      // Add rejected gates that need re-approval
      for (const rejected of rejectedGates) {
        pendingGates.push({
          gate_name: rejected.gate_name,
          status: GATE_STATUS.BLOCKED,
          last_decision: 'rejected',
          decided_at: rejected.decided_at,
          notes: rejected.notes,
        });
      }
      
      if (pendingGates.length > 0) {
        pendingApprovals.push({
          workflow_id: workflow.workflow_id,
          project_id: workflow.project_id,
          current_tier: workflow.current_tier,
          tier_name: TIER_DESCRIPTIONS[workflow.current_tier]?.name,
          run_count: workflow.run_count,
          approval_count: workflow.approval_count,
          consecutive_approvals: workflow.consecutive_approvals,
          tier_locked: workflow.tier_locked === 1,
          pending_gates: pendingGates,
          last_activity: recentEvents[0]?.decided_at || workflow.updated_at,
        });
      }
    }
    
    // Sort by tier (lower tiers first - more urgent), then by last activity
    pendingApprovals.sort((a, b) => {
      if (a.current_tier !== b.current_tier) {
        return a.current_tier - b.current_tier;
      }
      return new Date(b.last_activity) - new Date(a.last_activity);
    });
    
    // Apply pagination
    const total = pendingApprovals.length;
    const paginated = pendingApprovals.slice(parseInt(offset), parseInt(offset) + parseInt(limit));
    
    return res.status(200).json({
      success: true,
      data: {
        pending: paginated,
        pagination: {
          total,
          limit: parseInt(limit),
          offset: parseInt(offset),
          has_more: total > parseInt(offset) + parseInt(limit),
        },
        summary: {
          total_pending: total,
          by_tier: {
            tier_1: pendingApprovals.filter(p => p.current_tier === 1).length,
            tier_2: pendingApprovals.filter(p => p.current_tier === 2).length,
          },
        },
      },
    });

  } catch (error) {
    console.error('Trust pending error:', error);
    return res.status(500).json({
      error: 'Failed to fetch pending approvals',
      message: error.message,
    });
  }
}
