/**
 * Entity Graph Unit Tests — Phase 0 Gate
 * Brain OS v2.2
 *
 * 5-node fixture graph:
 *
 *   research.json ──depends_on──▶ script.md ──depends_on──▶ storyboard.json
 *        │                              │
 *        generated_by                   generated_by
 *        │                              │
 *        ▼                              ▼
 *     topic-task                    script-task
 *
 * All tests use a mocked mysql2 pool.
 */

import {
  createNode,
  realizeNode,
  linkNodes,
  getDependencies,
  getDependents,
  propagateTags,
  getLineage,
  pruneOrphans,
  queryGraph,
} from '../entityGraph.js';

// ── Mock DB ─────────────────────────────────────────────────────
// In-memory store that simulates mysql2 execute() responses
function createMockDb() {
  const entities = new Map();
  const links = [];
  const tags = [];
  let linkIdCounter = 0;

  const db = {
    execute: jest.fn(async (sql, params = []) => {
      const sqlNorm = sql.replace(/\s+/g, ' ').trim();

      // INSERT INTO rel_entities
      if (sqlNorm.startsWith('INSERT INTO rel_entities')) {
        const [uri, type, status, scope, memType, metaJson] = sqlNorm.includes(
          "'pending'"
        )
          ? [params[0], params[1], 'pending', params[2], params[3], params[4]]
          : params;
        const meta = metaJson ? JSON.parse(metaJson) : null;
        if (entities.has(uri)) {
          throw new Error(`Duplicate entry '${uri}' for key 'PRIMARY'`);
        }
        entities.set(uri, {
          uri,
          type,
          status: status || 'pending',
          scope,
          memory_type: memType,
          metadata: meta,
          checksum: null,
          created_at: new Date(),
          updated_at: new Date(),
        });
        return [{ affectedRows: 1 }];
      }

      // SELECT metadata FROM rel_entities WHERE uri = ?
      if (sqlNorm.includes('SELECT metadata FROM rel_entities WHERE uri')) {
        const entity = entities.get(params[0]);
        return [entity ? [{ metadata: entity.metadata }] : []];
      }

      // UPDATE rel_entities SET status = 'complete'
      if (sqlNorm.includes("SET status = 'complete'")) {
        const checksum = params[0];
        const metaJson = params[1];
        const uri = params[2];
        const entity = entities.get(uri);
        if (entity) {
          entity.status = 'complete';
          entity.checksum = checksum;
          entity.metadata = metaJson ? JSON.parse(metaJson) : entity.metadata;
          entity.updated_at = new Date();
        }
        return [{ affectedRows: entity ? 1 : 0 }];
      }

      // INSERT INTO rel_entity_links
      if (sqlNorm.startsWith('INSERT INTO rel_entity_links')) {
        const [sourceUri, targetUri, relationType, confidence] = params;
        const existing = links.find(
          (l) =>
            l.source_uri === sourceUri &&
            l.target_uri === targetUri &&
            l.relation_type === relationType
        );
        if (existing) {
          existing.confidence = confidence;
          return [{ affectedRows: 1 }];
        }
        links.push({
          id: String(++linkIdCounter),
          source_uri: sourceUri,
          target_uri: targetUri,
          relation_type: relationType,
          confidence,
          created_at: new Date(),
        });
        return [{ affectedRows: 1 }];
      }

      // getDependencies: SELECT e.* FROM rel_entities e JOIN rel_entity_links l ON e.uri = l.target_uri WHERE l.source_uri = ? AND l.relation_type = 'depends_on'
      if (
        sqlNorm.includes('e.uri = l.target_uri') &&
        sqlNorm.includes("'depends_on'")
      ) {
        const sourceUri = params[0];
        const deps = links
          .filter(
            (l) =>
              l.source_uri === sourceUri && l.relation_type === 'depends_on'
          )
          .map((l) => entities.get(l.target_uri))
          .filter(Boolean);
        return [deps];
      }

      // getDependents: SELECT e.* FROM rel_entities e JOIN rel_entity_links l ON e.uri = l.source_uri WHERE l.target_uri = ? AND l.relation_type = 'depends_on'
      if (
        sqlNorm.includes('e.uri = l.source_uri') &&
        sqlNorm.includes("'depends_on'")
      ) {
        const targetUri = params[0];
        const deps = links
          .filter(
            (l) =>
              l.target_uri === targetUri && l.relation_type === 'depends_on'
          )
          .map((l) => entities.get(l.source_uri))
          .filter(Boolean);
        return [deps];
      }

      // SELECT tag FROM rel_entity_tags WHERE uri = ?
      if (sqlNorm.includes('SELECT tag FROM rel_entity_tags WHERE uri')) {
        const uri = params[0];
        const entityTags = tags
          .filter((t) => t.uri === uri)
          .map((t) => ({ tag: t.tag }));
        return [entityTags];
      }

      // SELECT DISTINCT source_uri ... part_of, generated_by, output_from
      if (
        sqlNorm.includes('source_uri AS uri') &&
        sqlNorm.includes('part_of')
      ) {
        const targetUri = params[0];
        const children = links
          .filter(
            (l) =>
              l.target_uri === targetUri &&
              ['part_of', 'generated_by', 'output_from'].includes(
                l.relation_type
              )
          )
          .map((l) => ({ uri: l.source_uri }));
        return [children];
      }

      // INSERT INTO rel_entity_tags
      if (sqlNorm.startsWith('INSERT INTO rel_entity_tags')) {
        const [uri, tag] = params;
        // TRUE is hardcoded in the SQL, not a param
        const isInherited = sqlNorm.includes('TRUE');
        const existing = tags.find((t) => t.uri === uri && t.tag === tag);
        if (existing) {
          existing.inherited = true;
          return [{ affectedRows: 1 }];
        }
        tags.push({ uri, tag, inherited: isInherited });
        return [{ affectedRows: 1 }];
      }

      // SELECT * FROM rel_entities WHERE uri = ? (for getLineage)
      if (sqlNorm.includes('SELECT * FROM rel_entities WHERE uri =')) {
        const entity = entities.get(params[0]);
        return [entity ? [entity] : []];
      }

      // SELECT target_uri FROM rel_entity_links WHERE source_uri = ? AND relation_type = 'generated_by'
      if (
        sqlNorm.includes('target_uri') &&
        sqlNorm.includes("'generated_by'") &&
        sqlNorm.includes('LIMIT 1')
      ) {
        const sourceUri = params[0];
        const parent = links.find(
          (l) =>
            l.source_uri === sourceUri && l.relation_type === 'generated_by'
        );
        return [parent ? [{ target_uri: parent.target_uri }] : []];
      }

      // pruneOrphans: SELECT e.uri FROM rel_entities e LEFT JOIN...
      if (
        sqlNorm.includes('LEFT JOIN rel_entity_links ls') &&
        sqlNorm.includes('ls.id IS NULL')
      ) {
        const orphans = [];
        for (const [uri, entity] of entities) {
          if (entity.status === 'orphaned') continue;
          const hasSource = links.some((l) => l.source_uri === uri);
          const hasTarget = links.some((l) => l.target_uri === uri);
          if (!hasSource && !hasTarget) {
            // Check age (mock: always consider old enough)
            orphans.push({ uri });
          }
        }
        return [orphans];
      }

      // UPDATE rel_entities SET status = 'orphaned'
      if (
        sqlNorm.includes("status = 'orphaned'") &&
        sqlNorm.includes('WHERE uri IN')
      ) {
        for (const uri of params) {
          const entity = entities.get(uri);
          if (entity) entity.status = 'orphaned';
        }
        return [{ affectedRows: params.length }];
      }

      // queryGraph: SELECT * FROM rel_entities ... ORDER BY ... LIMIT
      if (
        sqlNorm.includes('FROM rel_entities') &&
        sqlNorm.includes('ORDER BY') &&
        sqlNorm.includes('LIMIT ?')
      ) {
        let results = Array.from(entities.values());

        // Parse the WHERE clause to figure out which filters are applied
        // Use regex with space-boundary to avoid 'memory_type' matching 'type'
        const qFilterFields = [];
        if (/ type = \?/.test(sqlNorm)) qFilterFields.push('type');
        if (/ status = \?/.test(sqlNorm)) qFilterFields.push('status');
        if (/ scope = \?/.test(sqlNorm)) qFilterFields.push('scope');
        if (/memory_type = \?/.test(sqlNorm)) qFilterFields.push('memory_type');
        if (/uri LIKE \?/.test(sqlNorm)) qFilterFields.push('uriPattern');

        let pi = 0;
        for (const field of qFilterFields) {
          const val = params[pi++];
          if (field === 'uriPattern') {
            const pattern = val.replace(/%/g, '.*');
            results = results.filter((e) => new RegExp(pattern).test(e.uri));
          } else {
            results = results.filter((e) => e[field] === val);
          }
        }

        // Last two params are always limit and offset
        const qLimit = params[pi] || 50;
        const qOffset = params[pi + 1] || 0;
        results = results.slice(qOffset, qOffset + qLimit);

        return [results];
      }

      return [[]];
    }),

    // Expose internals for test assertions
    _entities: entities,
    _links: links,
    _tags: tags,
  };

  return db;
}

// ── Fixture Setup ───────────────────────────────────────────────
async function setupFixtureGraph(db) {
  // Create 5 nodes
  await createNode(
    db,
    'brain://project/yt1/file/research.json',
    'file',
    'project',
    'fact'
  );
  await createNode(
    db,
    'brain://project/yt1/file/script.md',
    'file',
    'project',
    'episodic'
  );
  await createNode(
    db,
    'brain://project/yt1/file/storyboard.json',
    'file',
    'project',
    'episodic'
  );
  await createNode(
    db,
    'brain://project/yt1/task/topic-research',
    'task',
    'project',
    'trace'
  );
  await createNode(
    db,
    'brain://project/yt1/task/script-writing',
    'task',
    'project',
    'trace'
  );

  // Link: script depends_on research
  await linkNodes(
    db,
    'brain://project/yt1/file/script.md',
    'brain://project/yt1/file/research.json',
    'depends_on'
  );

  // Link: storyboard depends_on script
  await linkNodes(
    db,
    'brain://project/yt1/file/storyboard.json',
    'brain://project/yt1/file/script.md',
    'depends_on'
  );

  // Link: research generated_by topic-task
  await linkNodes(
    db,
    'brain://project/yt1/file/research.json',
    'brain://project/yt1/task/topic-research',
    'generated_by'
  );

  // Link: script generated_by script-task
  await linkNodes(
    db,
    'brain://project/yt1/file/script.md',
    'brain://project/yt1/task/script-writing',
    'generated_by'
  );
}

// ── Tests ───────────────────────────────────────────────────────

describe('Entity Graph (REL Foundation)', () => {
  let db;

  beforeEach(() => {
    db = createMockDb();
  });

  describe('createNode', () => {
    it('should create a new entity with pending status', async () => {
      const result = await createNode(
        db,
        'brain://project/test/file/readme.md',
        'file',
        'project',
        'fact',
        { title: 'README' }
      );

      expect(result.uri).toBe('brain://project/test/file/readme.md');
      expect(result.type).toBe('file');
      expect(result.status).toBe('pending');
      expect(result.scope).toBe('project');
      expect(result.memory_type).toBe('fact');
      expect(result.metadata).toEqual({ title: 'README' });
      expect(db._entities.has('brain://project/test/file/readme.md')).toBe(
        true
      );
    });

    it('should reject invalid URI', async () => {
      await expect(createNode(db, 'invalid', 'file')).rejects.toThrow(
        'Invalid URI'
      );
    });

    it('should reject invalid entity type', async () => {
      await expect(
        createNode(db, 'brain://project/x/file/a.md', 'invalid_type')
      ).rejects.toThrow('Invalid entity type');
    });

    it('should reject invalid scope', async () => {
      await expect(
        createNode(db, 'brain://project/x/file/a.md', 'file', 'invalid_scope')
      ).rejects.toThrow('Invalid scope');
    });

    it('should reject invalid memory type', async () => {
      await expect(
        createNode(
          db,
          'brain://project/x/file/a.md',
          'file',
          'project',
          'invalid_mem'
        )
      ).rejects.toThrow('Invalid memory type');
    });
  });

  describe('realizeNode', () => {
    it('should mark entity as complete with checksum', async () => {
      await createNode(
        db,
        'brain://project/test/file/out.mp4',
        'asset',
        'project'
      );
      const result = await realizeNode(
        db,
        'brain://project/test/file/out.mp4',
        { path: '/tmp/out.mp4' },
        'sha256:abc123'
      );

      expect(result.status).toBe('complete');
      expect(result.checksum).toBe('sha256:abc123');
      expect(result.metadata.output).toEqual({ path: '/tmp/out.mp4' });
    });

    it('should throw if entity not found', async () => {
      await expect(
        realizeNode(db, 'brain://project/x/file/missing.md')
      ).rejects.toThrow('Entity not found');
    });

    it('should reject invalid URI', async () => {
      await expect(realizeNode(db, 'bad-uri')).rejects.toThrow('Invalid URI');
    });
  });

  describe('linkNodes', () => {
    it('should create a directed edge between entities', async () => {
      await createNode(db, 'brain://project/x/file/a.md', 'file');
      await createNode(db, 'brain://project/x/file/b.md', 'file');
      const result = await linkNodes(
        db,
        'brain://project/x/file/a.md',
        'brain://project/x/file/b.md',
        'depends_on'
      );

      expect(result.source_uri).toBe('brain://project/x/file/a.md');
      expect(result.target_uri).toBe('brain://project/x/file/b.md');
      expect(result.relation_type).toBe('depends_on');
      expect(result.confidence).toBe(1.0);
      expect(db._links).toHaveLength(1);
    });

    it('should reject invalid relation type', async () => {
      await expect(
        linkNodes(
          db,
          'brain://project/x/file/a.md',
          'brain://project/x/file/b.md',
          'invalid_rel'
        )
      ).rejects.toThrow('Invalid relation type');
    });

    it('should update confidence on duplicate link', async () => {
      await createNode(db, 'brain://project/x/file/a.md', 'file');
      await createNode(db, 'brain://project/x/file/b.md', 'file');
      await linkNodes(
        db,
        'brain://project/x/file/a.md',
        'brain://project/x/file/b.md',
        'depends_on',
        0.5
      );
      await linkNodes(
        db,
        'brain://project/x/file/a.md',
        'brain://project/x/file/b.md',
        'depends_on',
        0.9
      );

      expect(db._links[0].confidence).toBe(0.9);
    });
  });

  describe('getDependencies', () => {
    it('should return upstream dependencies', async () => {
      await setupFixtureGraph(db);

      const deps = await getDependencies(
        db,
        'brain://project/yt1/file/script.md'
      );

      expect(deps).toHaveLength(1);
      expect(deps[0].uri).toBe('brain://project/yt1/file/research.json');
    });

    it('should return empty array for root entities', async () => {
      await setupFixtureGraph(db);

      const deps = await getDependencies(
        db,
        'brain://project/yt1/file/research.json'
      );
      expect(deps).toHaveLength(0);
    });

    it('should reject invalid URI', async () => {
      await expect(getDependencies(db, 'not-a-uri')).rejects.toThrow(
        'Invalid URI'
      );
    });
  });

  describe('getDependents', () => {
    it('should return downstream dependents', async () => {
      await setupFixtureGraph(db);

      const deps = await getDependents(
        db,
        'brain://project/yt1/file/script.md'
      );

      expect(deps).toHaveLength(1);
      expect(deps[0].uri).toBe('brain://project/yt1/file/storyboard.json');
    });

    it('should return empty array for leaf entities', async () => {
      await setupFixtureGraph(db);

      const deps = await getDependents(
        db,
        'brain://project/yt1/file/storyboard.json'
      );
      expect(deps).toHaveLength(0);
    });
  });

  describe('getLineage', () => {
    it('should trace full provenance chain', async () => {
      await setupFixtureGraph(db);

      const lineage = await getLineage(
        db,
        'brain://project/yt1/file/research.json'
      );

      // research.json → topic-research (via generated_by)
      expect(lineage).toHaveLength(2);
      expect(lineage[0].uri).toBe('brain://project/yt1/file/research.json');
      expect(lineage[1].uri).toBe('brain://project/yt1/task/topic-research');
    });

    it('should return single node for root entity', async () => {
      await setupFixtureGraph(db);

      const lineage = await getLineage(
        db,
        'brain://project/yt1/task/topic-research'
      );

      expect(lineage).toHaveLength(1);
      expect(lineage[0].uri).toBe('brain://project/yt1/task/topic-research');
    });

    it('should handle circular references gracefully', async () => {
      await createNode(db, 'brain://project/x/file/a.md', 'file');
      await createNode(db, 'brain://project/x/file/b.md', 'file');
      await linkNodes(
        db,
        'brain://project/x/file/a.md',
        'brain://project/x/file/b.md',
        'generated_by'
      );
      await linkNodes(
        db,
        'brain://project/x/file/b.md',
        'brain://project/x/file/a.md',
        'generated_by'
      );

      const lineage = await getLineage(db, 'brain://project/x/file/a.md');

      // Should terminate, not infinite loop
      expect(lineage.length).toBeLessThanOrEqual(2);
    });
  });

  describe('propagateTags', () => {
    it('should cascade tags to child entities', async () => {
      await setupFixtureGraph(db);

      // Add tags to topic-research task
      db._tags.push({
        uri: 'brain://project/yt1/task/topic-research',
        tag: 'youtube',
        inherited: false,
      });
      db._tags.push({
        uri: 'brain://project/yt1/task/topic-research',
        tag: 'documentary',
        inherited: false,
      });

      // research.json has generated_by pointing to topic-research
      // So propagating from topic-research should cascade tags to research.json
      const count = await propagateTags(
        db,
        'brain://project/yt1/task/topic-research'
      );

      expect(count).toBe(2); // 2 tags × 1 child
      const researchTags = db._tags.filter(
        (t) => t.uri === 'brain://project/yt1/file/research.json'
      );
      expect(researchTags).toHaveLength(2);
      expect(researchTags.every((t) => t.inherited === true)).toBe(true);
    });

    it('should return 0 if entity has no tags', async () => {
      await setupFixtureGraph(db);
      const count = await propagateTags(
        db,
        'brain://project/yt1/task/topic-research'
      );
      expect(count).toBe(0);
    });
  });

  describe('pruneOrphans', () => {
    it('should flag entities with no links', async () => {
      // Create an orphan entity (no links)
      await createNode(
        db,
        'brain://project/x/file/orphan.md',
        'file',
        'project'
      );

      const orphaned = await pruneOrphans(db, 48);

      expect(orphaned).toContain('brain://project/x/file/orphan.md');
      expect(db._entities.get('brain://project/x/file/orphan.md').status).toBe(
        'orphaned'
      );
    });

    it('should not flag linked entities', async () => {
      await setupFixtureGraph(db);

      const orphaned = await pruneOrphans(db, 48);

      // All 5 nodes are linked, none should be orphaned
      expect(orphaned).toHaveLength(0);
    });
  });

  describe('queryGraph', () => {
    it('should filter by type', async () => {
      await setupFixtureGraph(db);

      const files = await queryGraph(db, { type: 'file' });

      expect(files).toHaveLength(3);
      files.forEach((e) => expect(e.type).toBe('file'));
    });

    it('should filter by scope', async () => {
      await setupFixtureGraph(db);

      const projectEntities = await queryGraph(db, { scope: 'project' });

      expect(projectEntities).toHaveLength(5);
    });

    it('should filter by status', async () => {
      await setupFixtureGraph(db);
      await realizeNode(
        db,
        'brain://project/yt1/file/research.json',
        { done: true },
        'sha256:abc'
      );

      const completed = await queryGraph(db, { status: 'complete' });

      expect(completed).toHaveLength(1);
      expect(completed[0].uri).toBe('brain://project/yt1/file/research.json');
    });

    it('should return empty for no matches', async () => {
      await setupFixtureGraph(db);

      const results = await queryGraph(db, { type: 'competition' });

      expect(results).toHaveLength(0);
    });

    it('should filter by memory_type', async () => {
      await setupFixtureGraph(db);

      // Verify the entities exist with the right memory_type
      const topicTask = db._entities.get(
        'brain://project/yt1/task/topic-research'
      );
      const scriptTask = db._entities.get(
        'brain://project/yt1/task/script-writing'
      );
      expect(topicTask.memory_type).toBe('trace');
      expect(scriptTask.memory_type).toBe('trace');

      // Verify filtering works at the data level
      const allEntities = Array.from(db._entities.values());
      const traceEntities = allEntities.filter(
        (e) => e.memory_type === 'trace'
      );
      expect(traceEntities).toHaveLength(2);

      const traces = await queryGraph(db, { memory_type: 'trace' });

      expect(traces).toHaveLength(2); // topic-research and script-writing tasks
    });
  });

  describe('5-node fixture graph integrity', () => {
    it('should create 5 entities and 4 links', async () => {
      await setupFixtureGraph(db);

      expect(db._entities.size).toBe(5);
      expect(db._links).toHaveLength(4);
    });

    it('should have correct dependency chain: storyboard → script → research', async () => {
      await setupFixtureGraph(db);

      // storyboard depends on script
      const sbDeps = await getDependencies(
        db,
        'brain://project/yt1/file/storyboard.json'
      );
      expect(sbDeps).toHaveLength(1);
      expect(sbDeps[0].uri).toBe('brain://project/yt1/file/script.md');

      // script depends on research
      const scriptDeps = await getDependencies(
        db,
        'brain://project/yt1/file/script.md'
      );
      expect(scriptDeps).toHaveLength(1);
      expect(scriptDeps[0].uri).toBe('brain://project/yt1/file/research.json');

      // research has no dependencies
      const resDeps = await getDependencies(
        db,
        'brain://project/yt1/file/research.json'
      );
      expect(resDeps).toHaveLength(0);
    });

    it('should trace lineage through generated_by edges', async () => {
      await setupFixtureGraph(db);

      // script.md → script-writing (via generated_by)
      const scriptLineage = await getLineage(
        db,
        'brain://project/yt1/file/script.md'
      );
      expect(scriptLineage).toHaveLength(2);
      expect(scriptLineage[1].uri).toBe(
        'brain://project/yt1/task/script-writing'
      );
    });
  });
});
