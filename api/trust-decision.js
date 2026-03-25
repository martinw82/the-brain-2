/**
 * Trust Decision API Endpoint
 * Phase 1 - v2.2 Architecture
 * 
 * POST /api/trust-decision
 * Records a gate decision and updates trust metrics
 */

import { recordGateDecision, getTrustStatus } from './trustLadder.js';

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed', allowed: ['POST'] });
  }

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
