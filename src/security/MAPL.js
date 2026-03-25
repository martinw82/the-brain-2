/**
 * MAPL (Multi-Agent Policy Language) Security Module
 * Phase 1 - v2.2 Architecture
 * 
 * Phase 1: Stubs - Policy ID validation, PEP placeholder
 * Phase 6+: Full cryptographic signing with HMAC-SHA256
 */

import crypto from 'crypto';

// Policy registry (in-memory for Phase 1, move to DB in Phase 6)
const POLICY_REGISTRY = new Map();

/**
 * Register a policy (Phase 1: simple validation)
 * @param {string} policyId - Policy identifier
 * @param {Object} policy - Policy definition
 */
export function registerPolicy(policyId, policy) {
  POLICY_REGISTRY.set(policyId, {
    id: policyId,
    version: policy.version || '1.0',
    permissions: policy.permissions || [],
    constraints: policy.constraints || {},
    created_at: new Date(),
  });
}

/**
 * Validate that a policy ID exists
 * @param {string} policyId - Policy ID to validate
 * @returns {boolean} - Whether policy exists
 */
export function validatePolicyId(policyId) {
  if (!policyId || typeof policyId !== 'string') {
    return false;
  }
  
  // Phase 1: Check against registry or allow known policies
  if (POLICY_REGISTRY.has(policyId)) {
    return true;
  }
  
  // Allow known policy patterns in Phase 1
  const knownPatterns = [
    /^policy-video-render-v\d+$/,
    /^policy-outreach-v\d+$/,
    /^policy-competition-v\d+$/,
    /^policy-research-v\d+$/,
  ];
  
  return knownPatterns.some(pattern => pattern.test(policyId));
}

/**
 * Policy Enforcement Point (PEP) - Phase 1 Stub
 * 
 * In Phase 1: Validates policy_id presence and basic format
 * In Phase 6: Verifies cryptographic signatures, checks policy authority
 * 
 * @param {Object} executionPackage - The execution package to enforce
 * @returns {Object} - Enforcement result
 */
export function enforcePolicy(executionPackage) {
  const { security } = executionPackage;
  
  if (!security || !security.policy_id) {
    return {
      allowed: false,
      reason: 'Missing security.policy_id',
      action: 'reject',
    };
  }
  
  if (!validatePolicyId(security.policy_id)) {
    return {
      allowed: false,
      reason: `Unknown policy: ${security.policy_id}`,
      action: 'reject',
    };
  }
  
  // Phase 1: Signature validation stub
  if (security.signature && security.signature !== 'stub') {
    // In Phase 6, this would verify HMAC-SHA256
    const sigValid = verifySignatureStub(executionPackage);
    if (!sigValid) {
      return {
        allowed: false,
        reason: 'Invalid signature (stub validation)',
        action: 'reject',
      };
    }
  }
  
  // Get policy for additional checks
  const policy = POLICY_REGISTRY.get(security.policy_id);
  
  return {
    allowed: true,
    policy: policy || { id: security.policy_id, version: '1.0-stub' },
    enforced_at: new Date().toISOString(),
    note: 'Phase 1 stub enforcement - signatures not cryptographically verified',
  };
}

/**
 * Sign an execution package (Phase 1 Stub)
 * 
 * In Phase 6: Creates HMAC-SHA256 signature
 * 
 * @param {Object} executionPackage - Package to sign
 * @param {string} privateKey - Private key (ignored in Phase 1)
 * @returns {Object} - Package with signature
 */
export function signExecutionPackage(executionPackage, privateKey = null) {
  // Phase 1: Add placeholder signature
  const signedPackage = {
    ...executionPackage,
    security: {
      ...executionPackage.security,
      signature: 'stub', // Phase 6: HMAC-SHA256 signature
      signed_at: new Date().toISOString(),
    },
  };
  
  return signedPackage;
}

/**
 * Verify signature (Phase 1 Stub)
 * @param {Object} executionPackage - Package to verify
 * @returns {boolean} - Verification result
 */
function verifySignatureStub(executionPackage) {
  // Phase 1: Always return true for stubs
  // Phase 6: Actually verify HMAC-SHA256
  return executionPackage.security?.signature === 'stub';
}

/**
 * Create policy from template
 * @param {string} type - Policy type
 * @param {Object} overrides - Policy overrides
 * @returns {Object} - Policy definition
 */
export function createPolicy(type, overrides = {}) {
  const templates = {
    'video-render': {
      permissions: ['execute:remotion', 'write:assets', 'read:storyboard'],
      constraints: {
        max_duration: 1800, // 30 minutes
        max_cost: 0.50, // $0.50
        allowed_providers: ['local', 'fal', 'elevenlabs'],
      },
    },
    'outreach': {
      permissions: ['read:leads', 'send:email', 'read:inbox'],
      constraints: {
        max_emails_per_day: 50,
        forbidden_words: ['solution', 'synergy', 'leverage', 'holistic'],
      },
    },
    'competition': {
      permissions: ['scrape:web', 'fill:forms', 'read:personal-data'],
      constraints: {
        max_submissions_per_day: 20,
        personal_data_encryption: true,
      },
    },
  };
  
  const template = templates[type] || { permissions: [], constraints: {} };
  
  return {
    id: `policy-${type}-v1`,
    version: '1.0',
    ...template,
    ...overrides,
  };
}

// Register default policies
registerPolicy('policy-video-render-v1', createPolicy('video-render'));
registerPolicy('policy-outreach-v1', createPolicy('outreach'));
registerPolicy('policy-competition-v1', createPolicy('competition'));
registerPolicy('policy-research-v1', createPolicy('research', {
  permissions: ['search:web', 'read:documents'],
  constraints: { max_results: 100 },
}));

export default {
  registerPolicy,
  validatePolicyId,
  enforcePolicy,
  signExecutionPackage,
  createPolicy,
};
