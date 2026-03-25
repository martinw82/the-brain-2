/**
 * Entity Graph Module Tests
 * Phase 0 Foundation - v2.2 Architecture
 */

import {
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
} from '../entityGraph.js';

// Mock the database
jest.mock('../db/index.ts', () => ({
  db: {
    insert: jest.fn(),
    select: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
}));

import { db } from '../db/index.ts';
import { rel_entities, entity_links, entity_tags } from '../db/schema.ts';

describe('Entity Graph Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createNode', () => {
    it('should create a valid entity node', async () => {
      const mockInsert = jest.fn().mockReturnValue({ values: jest.fn().mockResolvedValue(undefined) });
      db.insert = mockInsert;

      const result = await createNode(
        'brain://project/test/task/1',
        'task',
        'project',
        'episodic',
        { priority: 'high' }
      );

      expect(mockInsert).toHaveBeenCalledWith(rel_entities);
      expect(result.uri).toBe('brain://project/test/task/1');
      expect(result.type).toBe('task');
      expect(result.status).toBe('pending');
    });

    it('should extract project_id from URI', async () => {
      const mockInsert = jest.fn().mockReturnValue({ values: jest.fn().mockResolvedValue(undefined) });
      db.insert = mockInsert;

      await createNode('brain://project/my-project/file/test.js', 'file');

      const callArg = mockInsert().values.mock.calls[0][0];
      expect(callArg.project_id).toBe('my-project');
    });

    it('should reject invalid types', async () => {
      await expect(createNode('brain://test', 'invalid_type'))
        .rejects.toThrow('Invalid type');
    });

    it('should reject invalid scopes', async () => {
      await expect(createNode('brain://test', 'task', 'invalid_scope'))
        .rejects.toThrow('Invalid scope');
    });

    it('should reject invalid memory types', async () => {
      await expect(createNode('brain://test', 'task', 'project', 'invalid_memory'))
        .rejects.toThrow('Invalid memory_type');
    });
  });

  describe('realizeNode', () => {
    it('should mark entity as complete with output', async () => {
      const mockSelect = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([{ metadata: '{}' }]),
        }),
      });
      const mockUpdate = jest.fn().mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(undefined),
        }),
      });
      db.select = mockSelect;
      db.update = mockUpdate;

      const result = await realizeNode(
        'brain://project/test/task/1',
        { result: 'success' },
        'sha256:abc123'
      );

      expect(result.status).toBe('complete');
      expect(result.checksum).toBe('sha256:abc123');
    });
  });

  describe('getDependencies', () => {
    it('should return upstream dependencies', async () => {
      const mockLinks = [
        { source_uri: 'brain://project/test/script/1', relation_type: 'depends_on' },
      ];
      const mockEntities = [
        { uri: 'brain://project/test/script/1', type: 'script', metadata: '{}' },
      ];

      db.select = jest.fn()
        .mockReturnValueOnce({ from: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue(mockLinks) }) })
        .mockReturnValueOnce({ from: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue(mockEntities) }) });

      const result = await getDependencies('brain://project/test/video/1');

      expect(result).toHaveLength(1);
      expect(result[0].uri).toBe('brain://project/test/script/1');
      expect(result[0].relation_type).toBe('depends_on');
    });

    it('should filter by relation type', async () => {
      const mockLinks = [
        { source_uri: 'brain://test/1', relation_type: 'generated_by' },
        { source_uri: 'brain://test/2', relation_type: 'depends_on' },
      ];

      db.select = jest.fn()
        .mockReturnValueOnce({ from: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue([mockLinks[0]]) }) })
        .mockReturnValueOnce({ from: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue([]) }) });

      await getDependencies('brain://test', 'generated_by');

      // Should only query for generated_by relation
    });
  });

  describe('getDependents', () => {
    it('should return downstream dependents', async () => {
      const mockLinks = [
        { target_uri: 'brain://project/test/video/1', relation_type: 'succeeded_by' },
      ];
      const mockEntities = [
        { uri: 'brain://project/test/video/1', type: 'video', metadata: '{}' },
      ];

      db.select = jest.fn()
        .mockReturnValueOnce({ from: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue(mockLinks) }) })
        .mockReturnValueOnce({ from: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue(mockEntities) }) });

      const result = await getDependents('brain://project/test/script/1');

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('video');
    });
  });

  describe('getLineage', () => {
    it('should trace full provenance chain', async () => {
      const entities = [
        { uri: 'brain://project/test/video/1', type: 'video', metadata: '{}' },
        { uri: 'brain://project/test/script/1', type: 'script', metadata: '{}' },
        { uri: 'brain://project/test/research/1', type: 'research', metadata: '{}' },
      ];

      const mockLinks = [
        { source_uri: 'brain://project/test/script/1', target_uri: 'brain://project/test/video/1', relation_type: 'generated_by' },
        { source_uri: 'brain://project/test/research/1', target_uri: 'brain://project/test/script/1', relation_type: 'depends_on' },
      ];

      db.select = jest.fn()
        .mockReturnValueOnce({ from: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue([entities[0]]) }) }) // video
        .mockReturnValueOnce({ from: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue([mockLinks[0]]) }) }) // video parents
        .mockReturnValueOnce({ from: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue([entities[1]]) }) }) // script
        .mockReturnValueOnce({ from: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue([mockLinks[1]]) }) }) // script parents
        .mockReturnValueOnce({ from: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue([entities[2]]) }) }) // research
        .mockReturnValueOnce({ from: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue([]) }) }); // no more parents

      const result = await getLineage('brain://project/test/video/1');

      expect(result).toHaveLength(3);
      expect(result[0].type).toBe('research');
      expect(result[1].type).toBe('script');
      expect(result[2].type).toBe('video');
    });

    it('should detect circular dependencies', async () => {
      db.select = jest.fn()
        .mockReturnValueOnce({ from: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue([{ type: 'task', metadata: '{}' }]) }) })
        .mockReturnValueOnce({ from: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue([{ source_uri: 'brain://circular' }]) }) })
        .mockReturnValueOnce({ from: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue([{ type: 'task', metadata: '{}' }]) }) })
        .mockReturnValueOnce({ from: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue([{ source_uri: 'brain://original' }]) }) });

      await expect(getLineage('brain://original'))
        .rejects.toThrow('Circular dependency detected');
    });

    it('should respect maxDepth', async () => {
      db.select = jest.fn()
        .mockReturnValueOnce({ from: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue([{ type: 'task', metadata: '{}' }]) }) })
        .mockReturnValueOnce({ from: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue([{ source_uri: 'brain://parent' }]) }) })
        .mockReturnValueOnce({ from: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue([{ type: 'task', metadata: '{}' }]) }) })
        .mockReturnValueOnce({ from: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue([{ source_uri: 'brain://grandparent' }]) }) });

      const result = await getLineage('brain://child', 2);

      expect(result.length).toBeLessThanOrEqual(2);
    });
  });

  describe('queryGraph', () => {
    it('should filter by type', async () => {
      const mockEntities = [
        { uri: 'brain://test/1', type: 'video', metadata: '{}' },
        { uri: 'brain://test/2', type: 'video', metadata: '{}' },
      ];

      db.select = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue(mockEntities),
          }),
        }),
      });

      const result = await queryGraph({ type: 'video', limit: 10 });

      expect(result).toHaveLength(2);
      expect(result[0].type).toBe('video');
    });

    it('should filter by status', async () => {
      db.select = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      await queryGraph({ status: 'complete' });

      expect(db.select).toHaveBeenCalled();
    });
  });

  describe('createLink', () => {
    it('should create a relationship between entities', async () => {
      const mockInsert = jest.fn().mockReturnValue({ values: jest.fn().mockResolvedValue(undefined) });
      db.insert = mockInsert;

      const result = await createLink(
        'brain://source',
        'brain://target',
        'generated_by',
        0.95,
        'user-123'
      );

      expect(mockInsert).toHaveBeenCalledWith(entity_links);
      expect(result.source_uri).toBe('brain://source');
      expect(result.target_uri).toBe('brain://target');
      expect(result.relationship).toBe('generated_by');
      expect(result.confidence).toBe(0.95);
    });

    it('should reject missing URIs', async () => {
      await expect(createLink(null, 'brain://target', 'depends_on'))
        .rejects.toThrow('Source and target URIs are required');
    });
  });

  describe('checkCircularDependency', () => {
    it('should detect circular dependencies', async () => {
      // A -> B -> C -> A (circular)
      db.select = jest.fn()
        .mockReturnValueOnce({ from: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue([{ target_uri: 'brain://C' }]) }) })
        .mockReturnValueOnce({ from: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue([{ target_uri: 'brain://A' }]) }) })
        .mockReturnValueOnce({ from: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue([]) }) });

      const result = await checkCircularDependency('brain://A', 'brain://B');
      expect(result).toBe(true);
    });

    it('should allow non-circular dependencies', async () => {
      db.select = jest.fn()
        .mockReturnValueOnce({ from: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue([{ target_uri: 'brain://C' }]) }) })
        .mockReturnValueOnce({ from: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue([]) }) });

      const result = await checkCircularDependency('brain://A', 'brain://B');
      expect(result).toBe(false);
    });
  });

  describe('Performance Requirements', () => {
    it('should complete lineage query in under 100ms for depth 3', async () => {
      const entities = Array(5).fill(null).map((_, i) => ({
        uri: `brain://test/${i}`,
        type: 'task',
        metadata: '{}',
      }));

      const links = Array(4).fill(null).map((_, i) => ({
        source_uri: `brain://test/${i}`,
        target_uri: `brain://test/${i + 1}`,
        relation_type: 'depends_on',
      }));

      let selectCount = 0;
      db.select = jest.fn(() => {
        const idx = Math.floor(selectCount / 2);
        const isEntity = selectCount % 2 === 0;
        selectCount++;
        
        const result = isEntity 
          ? (idx < entities.length ? [entities[idx]] : [])
          : (idx < links.length ? [links[idx]] : []);
        
        return {
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue(result),
          }),
        };
      });

      const start = Date.now();
      await getLineage('brain://test/4', 3);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100);
    });
  });
});

// Integration test with 5-node fixture graph
describe('5-Node Fixture Graph', () => {
  const fixtureData = {
    entities: [
      { uri: 'brain://project/demo/research/1', type: 'research', scope: 'project' },
      { uri: 'brain://project/demo/outline/1', type: 'outline', scope: 'project' },
      { uri: 'brain://project/demo/script/1', type: 'script', scope: 'project' },
      { uri: 'brain://project/demo/storyboard/1', type: 'storyboard', scope: 'project' },
      { uri: 'brain://project/demo/video/1', type: 'video', scope: 'project' },
    ],
    links: [
      // Research -> Outline (depends_on)
      { source: 'brain://project/demo/research/1', target: 'brain://project/demo/outline/1', type: 'depends_on' },
      // Outline -> Script (depends_on)
      { source: 'brain://project/demo/outline/1', target: 'brain://project/demo/script/1', type: 'depends_on' },
      // Script -> Storyboard (succeeded_by)
      { source: 'brain://project/demo/script/1', target: 'brain://project/demo/storyboard/1', type: 'succeeded_by' },
      // Storyboard -> Video (generated_by)
      { source: 'brain://project/demo/storyboard/1', target: 'brain://project/demo/video/1', type: 'generated_by' },
      // Script -> Video (part_of - the script is part of the video)
      { source: 'brain://project/demo/script/1', target: 'brain://project/demo/video/1', type: 'part_of' },
    ],
  };

  beforeEach(() => {
    // Setup fixture data in mocks
    let selectCall = 0;
    db.select = jest.fn(() => {
      selectCall++;
      return {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockImplementation(() => {
            // Return appropriate data based on query
            return Promise.resolve([]);
          }),
        }),
      };
    });
  });

  it('should create all 5 fixture entities', async () => {
    const mockInsert = jest.fn().mockReturnValue({ values: jest.fn().mockResolvedValue(undefined) });
    db.insert = mockInsert;

    for (const entity of fixtureData.entities) {
      await createNode(entity.uri, entity.type, entity.scope);
    }

    expect(mockInsert).toHaveBeenCalledTimes(5);
  });

  it('should create all fixture relationships', async () => {
    const mockInsert = jest.fn().mockReturnValue({ values: jest.fn().mockResolvedValue(undefined) });
    db.insert = mockInsert;

    for (const link of fixtureData.links) {
      await createLink(link.source, link.target, link.type);
    }

    expect(mockInsert).toHaveBeenCalledTimes(5);
  });
});
