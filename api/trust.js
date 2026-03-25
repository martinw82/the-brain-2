/**
 * Trust API Endpoint
 * Phase 1 - v2.2 Architecture
 * 
 * GET /api/trust - List pending approvals
 * POST /api/trust - Record a gate decision
 */

import { recordGateDecision, getTrustStatus, listWorkflowTrust } from './_lib/trustLadder.js';
import { db } from '../src/db/index.ts';
import { workflow_trust, trust_events } from '../src/db/schema.ts';
import { eq, and, desc } from 'drizzle-orm';
import { TIER_DESCRIPTIONS, GATE_STATUS } from '../src/config/trustLadder.js';

export default async function handler(req, res) {
  // GET /api/trust - List pending approvals
  if (req.method === 'GET') {
    return handleGet(req, res);
  }
  
  // POST /api/trust - Record decision
  if (req.method === 'POST') {
    return handlePost(req, res);
  }

  return res.status(405).json({ error: 'Method not allowed', allowed: ['GET', 'POST'] });
}

async function handleGet(req, res) {
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
      
      // Determine pending gates
      const pendingGates = [];
      
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

async function handlePost(req, res) {
  try {
    const { workflow_id, run_id, gate_name, decision, notes, decided_by } = req.body;

    // Validate required fields
    if (!workflow_id || !run_id || !gate_name || !decision) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['workflow_id', 'run_id', 'gate_name', 'decision'],
        received: { workflow_id, run_id, gate_name, decision },
      });
    }

    // Validate decision value
    const validDecisions = ['approved', 'rejected', 'modified'];
    if (!validDecisions.includes(decision)) {
      return res.status(400).json({
        error: 'Invalid decision value',
        allowed: validDecisions,
        received: decision,
      });
    }

    // Record the decision
    const result = await recordGateDecision(
      workflow_id,
      run_id,
      gate_name,
      decision,
      notes,
      decided_by
    );

    // Return success response
    return res.status(200).json({
      success: true,
      message: `Gate ${gate_name} ${decision}`,
      data: {
        event: result.event,
        trust_status: {
          workflow_id: result.trust.workflow_id,
          current_tier: result.trust.current_tier,
          run_count: result.trust.run_count,
          approval_count: result.trust.approval_count,
          consecutive_approvals: result.trust.consecutive_approvals,
        },
        promotion: result.promotion,
        regression: result.regression,
      },
    });

  } catch (error) {
    console.error('Trust decision error:', error);
    return res.status(500).json({
      error: 'Failed to record trust decision',
      message: error.message,
    });
  }
}
