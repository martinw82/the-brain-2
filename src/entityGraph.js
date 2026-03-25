/**
 * Relational Entity Graph (REL) Module
 * Phase 0 Foundation - v2.2 Architecture
 * 
 * Tracks lineage, dependencies, and relationships across all entities.
 * All things must understand all other things.
 */

import { db } from './db/index.ts';
import { rel_entities } from './db/schema.ts';
import { eq, and, or, like, inArray, sql } from 'drizzle-orm';

// Valid entity types
const VALID_TYPES = ['file', 'task', 'asset', 'workflow', 'agent', 'worker', 'email', 'competition', 'video', 'script', 'storyboard'];

// Valid entity statuses
const VALID_STATUSES = ['pending', 'active', 'complete', 'failed', 'orphaned'];

// Valid memory types
const VALID_MEMORY_TYPES = ['policy', 'preference', 'fact', 'episodic', 'trace'];

// Valid scopes
const VALID_SCOPES = ['global', 'project', 'user', 'session'];

/**
 * Create a new entity node in the graph
 * @param {string} uri - Unique resource identifier (brain://...)
 * @param {string} type - Entity type (file, task, asset, etc.)
 * @param {string} scope - Scope (global, project, user, session)
 * @param {string} memoryType - Memory classification
 * @param {Object} meta - Additional metadata
 * @returns {Promise<Object>} - Created entity
 */
export async function createNode(uri, type, scope = 'project', memoryType = null, meta = {}) {
  // Validation
  if (!uri || typeof uri !== 'string') {
    throw new Error('URI is required and must be a string');
  }
  
  if (!VALID_TYPES.includes(type)) {
    throw new Error(`Invalid type: ${type}. Must be one of: ${VALID_TYPES.join(', ')}`);
  }
  
  if (!VALID_SCOPES.includes(scope)) {
    throw new Error(`Invalid scope: ${scope}. Must be one of: ${VALID_SCOPES.join(', ')}`);
  }
  
  if (memoryType && !VALID_MEMORY_TYPES.includes(memoryType)) {
    throw new Error(`Invalid memory_type: ${memoryType}. Must be one of: ${VALID_MEMORY_TYPES.join(', ')}`);
  }
  
  // Extract project_id from URI if scope is project
  let projectId = null;
  if (scope === 'project' && uri.startsWith('brain://project/')) {
    const match = uri.match(/brain:\/\/project\/([^/]+)/);
    if (match) projectId = match[1];
  }
  
  const entity = {
    uri,
    type,
    scope,
    memory_type: memoryType,
    status: 'pending',
    metadata: JSON.stringify(meta),
    project_id: projectId,
  };
  
  try {
    await db.insert(rel_entities).values(entity);
    return { ...entity, metadata: meta };
  } catch (error) {
    // Handle duplicate URI - update instead
    if (error.code === 'ER_DUP_ENTRY') {
      await db.update(rel_entities)
        .set({ type, scope, memory_type: memoryType, metadata: JSON.stringify(meta), updated_at: new Date() })
        .where(eq(rel_entities.uri, uri));
      return { ...entity, metadata: meta, updated: true };
    }
    throw error;
  }
}

/**
 * Mark an entity as realized (completed) with output
 * @param {string} uri - Entity URI
 * @param {Object} output - Output data
 * @param {string} checksum - Content checksum
 * @returns {Promise<Object>} - Updated entity
 */
export async function realizeNode(uri, output = null, checksum = null) {
  if (!uri) throw new Error('URI is required');
  
  const updates = {
    status: 'complete',
    updated_at: new Date(),
  };
  
  if (output) {
    // Merge with existing metadata
    const [existing] = await db.select({ metadata: rel_entities.metadata })
      .from(rel_entities)
      .where(eq(rel_entities.uri, uri));
    
    const meta = existing?.metadata ? JSON.parse(existing.metadata) : {};
    meta.output = output;
    updates.metadata = JSON.stringify(meta);
  }
  
  if (checksum) {
    updates.checksum = checksum;
  }
  
  await db.update(rel_entities)
    .set(updates)
    .where(eq(rel_entities.uri, uri));
  
  return { uri, status: 'complete', output, checksum };
}

/**
 * Get all upstream dependencies for an entity
 * @param {string} uri - Entity URI
 * @param {string} relationType - Optional specific relation type
 * @returns {Promise<Array>} - Array of dependent entities
 */
export async function getDependencies(uri, relationType = null) {
  if (!uri) throw new Error('URI is required');
  
  // Query entity_links table for depends_on relationships where uri is target
  const conditions = [eq(entity_links.target_uri, uri)];
  if (relationType) {
    conditions.push(eq(entity_links.relation_type, relationType));
  }
  
  const links = await db.select()
    .from(entity_links)
    .where(and(...conditions));
  
  if (links.length === 0) return [];
  
  // Fetch full entity details
  const sourceUris = links.map(l => l.source_uri);
  const entities = await db.select()
    .from(rel_entities)
    .where(inArray(rel_entities.uri, sourceUris));
  
  // Map entities with their relation type
  return entities.map(e => {
    const link = links.find(l => l.source_uri === e.uri);
    return { ...e, relation_type: link?.relation_type, metadata: JSON.parse(e.metadata || '{}') };
  });
}

/**
 * Get all downstream dependents (entities that depend on this one)
 * @param {string} uri - Entity URI
 * @param {string} relationType - Optional specific relation type
 * @returns {Promise<Array>} - Array of dependent entities
 */
export async function getDependents(uri, relationType = null) {
  if (!uri) throw new Error('URI is required');
  
  // Query entity_links table for relationships where uri is source
  const conditions = [eq(entity_links.source_uri, uri)];
  if (relationType) {
    conditions.push(eq(entity_links.relation_type, relationType));
  }
  
  const links = await db.select()
    .from(entity_links)
    .where(and(...conditions));
  
  if (links.length === 0) return [];
  
  // Fetch full entity details
  const targetUris = links.map(l => l.target_uri);
  const entities = await db.select()
    .from(rel_entities)
    .where(inArray(rel_entities.uri, targetUris));
  
  // Map entities with their relation type
  return entities.map(e => {
    const link = links.find(l => l.target_uri === e.uri);
    return { ...e, relation_type: link?.relation_type, metadata: JSON.parse(e.metadata || '{}') };
  });
}

/**
 * Propagate tags from an entity to all its children/dependents
 * @param {string} uri - Entity URI
 * @param {Array<string>} tags - Tags to propagate (if null, uses entity's tags)
 * @returns {Promise<number>} - Number of entities tagged
 */
export async function propagateTags(uri, tags = null) {
  if (!uri) throw new Error('URI is required');
  
  // Get entity's tags if not provided
  let tagsToPropagate = tags;
  if (!tagsToPropagate) {
    const entityTags = await db.select()
      .from(entity_tags)
      .where(eq(entity_tags.uri, uri));
    tagsToPropagate = entityTags.map(t => t.tag);
  }
  
  if (tagsToPropagate.length === 0) return 0;
  
  // Get all dependents
  const dependents = await getDependents(uri);
  let propagatedCount = 0;
  
  for (const dep of dependents) {
    for (const tag of tagsToPropagate) {
      try {
        await db.insert(entity_tags).values({
          uri: dep.uri,
          tag,
          inherited: true,
        });
        propagatedCount++;
      } catch (error) {
        // Ignore duplicate tag errors
        if (error.code !== 'ER_DUP_ENTRY') throw error;
      }
    }
  }
  
  return propagatedCount;
}

/**
 * Get full lineage (provenance chain) from an entity back to its root
 * @param {string} uri - Entity URI
 * @param {number} maxDepth - Maximum depth to traverse
 * @returns {Promise<Array>} - Array of entities from root to this entity
 */
export async function getLineage(uri, maxDepth = 10) {
  if (!uri) throw new Error('URI is required');
  
  const lineage = [];
  const visited = new Set();
  let currentUri = uri;
  let depth = 0;
  
  while (currentUri && depth < maxDepth) {
    if (visited.has(currentUri)) {
      throw new Error(`Circular dependency detected at ${currentUri}`);
    }
    visited.add(currentUri);
    
    // Get entity details
    const [entity] = await db.select()
      .from(rel_entities)
      .where(eq(rel_entities.uri, currentUri));
    
    if (!entity) break;
    
    lineage.unshift({ ...entity, metadata: JSON.parse(entity.metadata || '{}') });
    
    // Find generated_by or depends_on relationships (upstream)
    const parents = await db.select()
      .from(entity_links)
      .where(and(
        eq(entity_links.target_uri, currentUri),
        or(
          eq(entity_links.relation_type, 'generated_by'),
          eq(entity_links.relation_type, 'depends_on')
        )
      ));
    
    // Move to parent (prefer generated_by over depends_on)
    const generatedBy = parents.find(p => p.relation_type === 'generated_by');
    const dependsOn = parents.find(p => p.relation_type === 'depends_on');
    currentUri = generatedBy?.source_uri || dependsOn?.source_uri || null;
    
    depth++;
  }
  
  return lineage;
}

/**
 * Find and mark orphaned entities (entities with no relations after 48h)
 * @returns {Promise<Array>} - Array of orphaned entities
 */
export async function pruneOrphans() {
  const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
  
  // Find entities older than 48h with no relations
  const orphans = await db.select({
    uri: rel_entities.uri,
    type: rel_entities.type,
    created_at: rel_entities.created_at,
  })
    .from(rel_entities)
    .leftJoin(entity_links, or(
      eq(rel_entities.uri, entity_links.source_uri),
      eq(rel_entities.uri, entity_links.target_uri)
    ))
    .where(and(
      sql`${rel_entities.created_at} < ${fortyEightHoursAgo}`,
      sql`${entity_links.id} IS NULL`,
      ne(rel_entities.status, 'orphaned')
    ));
  
  // Mark as orphaned
  for (const orphan of orphans) {
    await db.update(rel_entities)
      .set({ status: 'orphaned', updated_at: new Date() })
      .where(eq(rel_entities.uri, orphan.uri));
  }
  
  return orphans;
}

/**
 * Query the graph with flexible filters
 * @param {Object} filters - Query filters
 * @param {string} filters.type - Entity type
 * @param {string} filters.scope - Entity scope
 * @param {string} filters.status - Entity status
 * @param {string} filters.projectId - Project ID
 * @param {string} filters.tag - Entity tag
 * @param {number} filters.limit - Max results
 * @returns {Promise<Array>} - Matching entities
 */
export async function queryGraph(filters = {}) {
  const conditions = [];
  
  if (filters.type) {
    conditions.push(eq(rel_entities.type, filters.type));
  }
  
  if (filters.scope) {
    conditions.push(eq(rel_entities.scope, filters.scope));
  }
  
  if (filters.status) {
    conditions.push(eq(rel_entities.status, filters.status));
  }
  
  if (filters.projectId) {
    conditions.push(eq(rel_entities.project_id, filters.projectId));
  }
  
  let query = db.select().from(rel_entities);
  
  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }
  
  if (filters.limit) {
    query = query.limit(filters.limit);
  }
  
  const results = await query;
  
  // Parse metadata
  return results.map(e => ({
    ...e,
    metadata: JSON.parse(e.metadata || '{}')
  }));
}

/**
 * Create a relationship between two entities
 * @param {string} sourceUri - Source entity URI
 * @param {string} targetUri - Target entity URI  
 * @param {string} relationType - Type of relationship
 * @param {number} confidence - Confidence score (0-1)
 * @param {string} userId - User creating the link
 * @returns {Promise<Object>} - Created link
 */
export async function createLink(sourceUri, targetUri, relationType, confidence = 1.0, userId = null) {
  if (!sourceUri || !targetUri) {
    throw new Error('Source and target URIs are required');
  }
  
  const link = {
    id: crypto.randomUUID(),
    user_id: userId,
    source_uri: sourceUri,
    source_type: 'entity',
    source_id: sourceUri,
    target_uri: targetUri,
    target_type: 'entity',
    target_id: targetUri,
    relationship: relationType,
    confidence,
    created_at: new Date(),
    updated_at: new Date(),
  };
  
  await db.insert(entity_links).values(link);
  
  return link;
}

/**
 * Check if an entity has circular dependencies
 * @param {string} uri - Entity to check
 * @param {string} newDependency - Potential new dependency to add
 * @returns {Promise<boolean>} - True if circular dependency would be created
 */
export async function checkCircularDependency(uri, newDependency) {
  const visited = new Set();
  const toVisit = [newDependency];
  
  while (toVisit.length > 0) {
    const current = toVisit.pop();
    
    if (current === uri) {
      return true; // Circular!
    }
    
    if (visited.has(current)) continue;
    visited.add(current);
    
    // Get dependencies of current
    const deps = await db.select({ target_uri: entity_links.target_uri })
      .from(entity_links)
      .where(eq(entity_links.source_uri, current));
    
    for (const dep of deps) {
      toVisit.push(dep.target_uri);
    }
  }
  
  return false;
}

// Import entity_links and entity_tags at the end to avoid circular issues
import { entity_links, entity_tags } from './db/schema.ts';
import { ne } from 'drizzle-orm';

// Default export
export default {
  createNode,
  realizeNode,
  getDependencies,
  getDependents,
  propagateTags,
  getLineage,
  pruneOrphans,
  queryGraph,
  createLink,
  checkCircularDependency,
};
