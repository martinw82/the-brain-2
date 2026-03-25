/**
 * Relational Entity Graph (REL) — Phase 0 Foundation
 * Brain OS v2.2
 *
 * The 8 core functions that power the relational entity layer.
 * Every entity (file, task, asset, workflow, agent output) must be
 * registered here before execution begins. The graph enforces:
 *   - What created it (generated_by)
 *   - What it requires (depends_on)
 *   - What it enables (succeeded_by)
 *   - What it relates to (relates_to, part_of)
 *
 * All functions accept a mysql2 pool/connection as first argument.
 */

import { isValidURI } from './uri.js';

// Valid entity types
const ENTITY_TYPES = [
  'file',
  'task',
  'asset',
  'workflow',
  'agent',
  'worker',
  'email',
  'competition',
];

// Valid statuses
const ENTITY_STATUSES = ['pending', 'active', 'complete', 'failed', 'orphaned'];

// Valid scopes
const ENTITY_SCOPES = ['global', 'project', 'user', 'session'];

// Valid memory types
const MEMORY_TYPES = ['policy', 'preference', 'fact', 'episodic', 'trace'];

// Valid relation types
const RELATION_TYPES = [
  'depends_on',
  'generated_by',
  'part_of',
  'succeeded_by',
  'version_of',
  'input_to',
  'output_from',
  'blocks',
  'relates_to',
  'awaits_reply_by',
  'responds_to',
];

/**
 * Register a new entity node in the graph.
 * Must be called BEFORE execution begins.
 *
 * @param {object} db - mysql2 pool or connection
 * @param {string} uri - brain:// URI (primary key)
 * @param {string} type - Entity type (file, task, asset, etc.)
 * @param {string} [scope] - Scope (global, project, user, session)
 * @param {string} [memType] - Memory type (policy, preference, fact, episodic, trace)
 * @param {object} [meta] - Arbitrary metadata JSON
 * @returns {Promise<object>} - The created entity record
 */
export async function createNode(
  db,
  uri,
  type,
  scope = null,
  memType = null,
  meta = null
) {
  if (!uri || !isValidURI(uri)) {
    throw new Error(`Invalid URI: ${uri}`);
  }
  if (!ENTITY_TYPES.includes(type)) {
    throw new Error(
      `Invalid entity type: ${type}. Must be one of: ${ENTITY_TYPES.join(', ')}`
    );
  }
  if (scope && !ENTITY_SCOPES.includes(scope)) {
    throw new Error(`Invalid scope: ${scope}`);
  }
  if (memType && !MEMORY_TYPES.includes(memType)) {
    throw new Error(`Invalid memory type: ${memType}`);
  }

  const metaJson = meta ? JSON.stringify(meta) : null;

  await db.execute(
    `INSERT INTO rel_entities (uri, type, status, scope, memory_type, metadata)
     VALUES (?, ?, 'pending', ?, ?, ?)`,
    [uri, type, scope, memType, metaJson]
  );

  return {
    uri,
    type,
    status: 'pending',
    scope,
    memory_type: memType,
    metadata: meta,
  };
}

/**
 * Mark an entity as complete with output artifact and checksum.
 *
 * @param {object} db - mysql2 pool or connection
 * @param {string} uri - brain:// URI of the entity
 * @param {object} [output] - Output metadata (stored in metadata.output)
 * @param {string} [checksum] - SHA256 checksum of output artifact
 * @returns {Promise<object>} - Updated entity
 */
export async function realizeNode(db, uri, output = null, checksum = null) {
  if (!uri || !isValidURI(uri)) {
    throw new Error(`Invalid URI: ${uri}`);
  }

  // Merge output into existing metadata
  const [rows] = await db.execute(
    'SELECT metadata FROM rel_entities WHERE uri = ?',
    [uri]
  );

  if (rows.length === 0) {
    throw new Error(`Entity not found: ${uri}`);
  }

  let existingMeta = {};
  try {
    existingMeta = rows[0].metadata
      ? typeof rows[0].metadata === 'string'
        ? JSON.parse(rows[0].metadata)
        : rows[0].metadata
      : {};
  } catch {
    /* ignore parse errors */
  }

  if (output) {
    existingMeta.output = output;
  }

  await db.execute(
    `UPDATE rel_entities
     SET status = 'complete', checksum = ?, metadata = ?, updated_at = NOW()
     WHERE uri = ?`,
    [checksum, JSON.stringify(existingMeta), uri]
  );

  return { uri, status: 'complete', checksum, metadata: existingMeta };
}

/**
 * Create a directed edge between two entities.
 *
 * @param {object} db - mysql2 pool or connection
 * @param {string} sourceUri - Source entity URI
 * @param {string} targetUri - Target entity URI
 * @param {string} relationType - Relation type (depends_on, generated_by, etc.)
 * @param {number} [confidence=1.0] - Confidence score (0.0–1.0)
 * @returns {Promise<object>} - The created link
 */
export async function linkNodes(
  db,
  sourceUri,
  targetUri,
  relationType,
  confidence = 1.0
) {
  if (!sourceUri || !isValidURI(sourceUri)) {
    throw new Error(`Invalid source URI: ${sourceUri}`);
  }
  if (!targetUri || !isValidURI(targetUri)) {
    throw new Error(`Invalid target URI: ${targetUri}`);
  }
  if (!RELATION_TYPES.includes(relationType)) {
    throw new Error(
      `Invalid relation type: ${relationType}. Must be one of: ${RELATION_TYPES.join(', ')}`
    );
  }

  await db.execute(
    `INSERT INTO rel_entity_links (source_uri, target_uri, relation_type, confidence)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE confidence = VALUES(confidence)`,
    [sourceUri, targetUri, relationType, confidence]
  );

  return {
    source_uri: sourceUri,
    target_uri: targetUri,
    relation_type: relationType,
    confidence,
  };
}

/**
 * Get all upstream dependencies of an entity.
 * Returns entities that this entity depends_on.
 *
 * @param {object} db - mysql2 pool or connection
 * @param {string} uri - Entity URI
 * @returns {Promise<object[]>} - Array of dependency entities
 */
export async function getDependencies(db, uri) {
  if (!uri || !isValidURI(uri)) {
    throw new Error(`Invalid URI: ${uri}`);
  }

  const [rows] = await db.execute(
    `SELECT e.*
     FROM rel_entities e
     JOIN rel_entity_links l ON e.uri = l.target_uri
     WHERE l.source_uri = ? AND l.relation_type = 'depends_on'`,
    [uri]
  );

  return rows;
}

/**
 * Get all downstream entities that depend on this entity.
 * Returns entities that have depends_on pointing to this URI.
 *
 * @param {object} db - mysql2 pool or connection
 * @param {string} uri - Entity URI
 * @returns {Promise<object[]>} - Array of dependent entities
 */
export async function getDependents(db, uri) {
  if (!uri || !isValidURI(uri)) {
    throw new Error(`Invalid URI: ${uri}`);
  }

  const [rows] = await db.execute(
    `SELECT e.*
     FROM rel_entities e
     JOIN rel_entity_links l ON e.uri = l.source_uri
     WHERE l.target_uri = ? AND l.relation_type = 'depends_on'`,
    [uri]
  );

  return rows;
}

/**
 * Cascade tags from a parent entity to all its children.
 * Children are entities linked via part_of, generated_by, or output_from
 * pointing to the source URI.
 *
 * @param {object} db - mysql2 pool or connection
 * @param {string} uri - Parent entity URI to propagate tags from
 * @returns {Promise<number>} - Number of tags propagated
 */
export async function propagateTags(db, uri) {
  if (!uri || !isValidURI(uri)) {
    throw new Error(`Invalid URI: ${uri}`);
  }

  // Get tags on the source entity
  const [sourceTags] = await db.execute(
    'SELECT tag FROM rel_entity_tags WHERE uri = ?',
    [uri]
  );

  if (sourceTags.length === 0) return 0;

  // Get child entities (those that reference this URI via part_of, generated_by, output_from)
  const [children] = await db.execute(
    `SELECT DISTINCT source_uri AS uri
     FROM rel_entity_links
     WHERE target_uri = ? AND relation_type IN ('part_of', 'generated_by', 'output_from')`,
    [uri]
  );

  let count = 0;
  for (const child of children) {
    for (const { tag } of sourceTags) {
      try {
        await db.execute(
          `INSERT INTO rel_entity_tags (uri, tag, inherited)
           VALUES (?, ?, TRUE)
           ON DUPLICATE KEY UPDATE inherited = TRUE`,
          [child.uri, tag]
        );
        count++;
      } catch {
        // Skip duplicates
      }
    }
  }

  return count;
}

/**
 * Trace full provenance chain from entity to root.
 * Walks generated_by edges recursively.
 *
 * @param {object} db - mysql2 pool or connection
 * @param {string} uri - Starting entity URI
 * @param {number} [maxDepth=10] - Maximum traversal depth
 * @returns {Promise<object[]>} - Ordered array from entity to root ancestor
 */
export async function getLineage(db, uri, maxDepth = 10) {
  if (!uri || !isValidURI(uri)) {
    throw new Error(`Invalid URI: ${uri}`);
  }

  const lineage = [];
  let currentUri = uri;
  const visited = new Set();

  for (let depth = 0; depth < maxDepth; depth++) {
    if (visited.has(currentUri)) break; // Circular reference protection
    visited.add(currentUri);

    const [rows] = await db.execute(
      'SELECT * FROM rel_entities WHERE uri = ?',
      [currentUri]
    );

    if (rows.length === 0) break;
    lineage.push(rows[0]);

    // Follow generated_by edge to parent
    const [parents] = await db.execute(
      `SELECT target_uri
       FROM rel_entity_links
       WHERE source_uri = ? AND relation_type = 'generated_by'
       LIMIT 1`,
      [currentUri]
    );

    if (parents.length === 0) break;
    currentUri = parents[0].target_uri;
  }

  return lineage;
}

/**
 * Detect and flag entities with no relations after a threshold period.
 *
 * @param {object} db - mysql2 pool or connection
 * @param {number} [maxAgeHours=48] - Hours before an unlinked entity is flagged
 * @returns {Promise<string[]>} - Array of orphaned entity URIs
 */
export async function pruneOrphans(db, maxAgeHours = 48) {
  // Find entities with no incoming or outgoing links, older than threshold
  const [orphans] = await db.execute(
    `SELECT e.uri
     FROM rel_entities e
     LEFT JOIN rel_entity_links ls ON e.uri = ls.source_uri
     LEFT JOIN rel_entity_links lt ON e.uri = lt.target_uri
     WHERE ls.id IS NULL AND lt.id IS NULL
       AND e.status != 'orphaned'
       AND e.created_at < DATE_SUB(NOW(), INTERVAL ? HOUR)`,
    [maxAgeHours]
  );

  const orphanUris = orphans.map((r) => r.uri);

  if (orphanUris.length > 0) {
    // Flag as orphaned
    const placeholders = orphanUris.map(() => '?').join(',');
    await db.execute(
      `UPDATE rel_entities SET status = 'orphaned', updated_at = NOW()
       WHERE uri IN (${placeholders})`,
      orphanUris
    );
  }

  return orphanUris;
}

/**
 * Flexible search across the entity graph.
 *
 * @param {object} db - mysql2 pool or connection
 * @param {object} filters - Query filters
 * @param {string} [filters.type] - Entity type
 * @param {string} [filters.status] - Entity status
 * @param {string} [filters.scope] - Entity scope
 * @param {string} [filters.memory_type] - Memory type
 * @param {string} [filters.uriPattern] - LIKE pattern for URI
 * @param {number} [filters.limit=50] - Max results
 * @param {number} [filters.offset=0] - Offset for pagination
 * @returns {Promise<object[]>} - Matching entities
 */
export async function queryGraph(db, filters = {}) {
  const conditions = [];
  const params = [];

  if (filters.type) {
    conditions.push('type = ?');
    params.push(filters.type);
  }
  if (filters.status) {
    conditions.push('status = ?');
    params.push(filters.status);
  }
  if (filters.scope) {
    conditions.push('scope = ?');
    params.push(filters.scope);
  }
  if (filters.memory_type) {
    conditions.push('memory_type = ?');
    params.push(filters.memory_type);
  }
  if (filters.uriPattern) {
    conditions.push('uri LIKE ?');
    params.push(filters.uriPattern);
  }

  const where =
    conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = Math.min(filters.limit || 50, 200);
  const offset = filters.offset || 0;

  const [rows] = await db.execute(
    `SELECT * FROM rel_entities ${where} ORDER BY updated_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return rows;
}

// Constants exported for validation in other modules
export {
  ENTITY_TYPES,
  ENTITY_STATUSES,
  ENTITY_SCOPES,
  MEMORY_TYPES,
  RELATION_TYPES,
};

export default {
  createNode,
  realizeNode,
  linkNodes,
  getDependencies,
  getDependents,
  propagateTags,
  getLineage,
  pruneOrphans,
  queryGraph,
  ENTITY_TYPES,
  ENTITY_STATUSES,
  ENTITY_SCOPES,
  MEMORY_TYPES,
  RELATION_TYPES,
};
