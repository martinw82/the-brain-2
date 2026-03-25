/**
 * Agent Registry Tests
 */

import {
  getAgents,
  findByCapability,
  getAgent,
  getAgentStats,
  selectAgent,
  clearAgentCache,
  cloneAgent,
  buildAgentPrompt,
} from '../agents.js';
import { agents as agentsApi } from '../api.js';

// Mock fetch and API
jest.mock('../api.js', () => ({
  agents: {
    getStats: jest.fn(),
    getAllStats: jest.fn(),
  },
  tasks: {
    getAgentHistory: jest.fn(),
  },
}));

global.fetch = jest.fn();

describe('Agent Registry', () => {
  const mockDevAgent = {
    id: 'system-dev-v1',
    version: 1,
    name: 'Dev Agent',
    icon: '🛠',
    capabilities: ['code.write', 'code.review', 'code.debug'],
    permissions: ['read:all', 'write:code-modules'],
    model: 'claude-sonnet-4-6',
    temperature: 0.7,
    prompt_prefix: 'You are a senior developer...',
  };

  const mockContentAgent = {
    id: 'system-content-v1',
    version: 1,
    name: 'Content Agent',
    icon: '✍️',
    capabilities: ['content.write', 'content.edit'],
    permissions: ['read:all', 'write:content-assets'],
    model: 'claude-sonnet-4-6',
    prompt_prefix: 'You are a content writer...',
  };

  beforeEach(() => {
    fetch.mockClear();
    clearAgentCache();
  });

  describe('getAgents', () => {
    it('should load all system agents', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        text: async () => `---
id: system-dev-v1
version: 1
name: Dev Agent
icon: 🛠
capabilities:
  - code.write
  - code.review
---
You are a senior developer...`,
      });

      // Mock other agent files
      for (let i = 0; i < 4; i++) {
        fetch.mockResolvedValueOnce({
          ok: true,
          text: async () => `---
id: system-other-v1
name: Other Agent
icon: 🤖
capabilities: []
---
Prompt...`,
        });
      }

      const agents = await getAgents();

      expect(agents.length).toBeGreaterThan(0);
      expect(fetch).toHaveBeenCalledWith('/agents/system-dev.md');
    });

    it('should use cache on subsequent calls', async () => {
      fetch.mockResolvedValue({
        ok: true,
        text: async () => `---
id: test-agent
name: Test
capabilities: []
---
Prompt`,
      });

      await getAgents();
      await getAgents(); // Second call

      // Should not fetch again within cache TTL
      expect(fetch).toHaveBeenCalledTimes(5); // Only initial loads
    });

    it('should skip failed agent files', async () => {
      fetch.mockResolvedValueOnce({ ok: false }).mockResolvedValueOnce({
        ok: true,
        text: async () => `---
id: working-agent
name: Working
capabilities: []
---
Prompt`,
      });

      // Mock remaining files
      for (let i = 0; i < 3; i++) {
        fetch.mockResolvedValueOnce({ ok: false });
      }

      const agents = await getAgents();

      expect(agents.length).toBe(1);
      expect(agents[0].id).toBe('working-agent');
    });
  });

  describe('findByCapability', () => {
    beforeEach(async () => {
      fetch.mockResolvedValue({
        ok: true,
        text: async () => `---
id: system-dev-v1
name: Dev Agent
capabilities:
  - code.write
  - code.review
---
Prompt`,
      });
    });

    it('should find agents by capability', async () => {
      const agents = await findByCapability('code.write');

      expect(agents.length).toBeGreaterThan(0);
      expect(agents[0].capabilities).toContain('code.write');
    });

    it('should return empty array for unknown capability', async () => {
      const agents = await findByCapability('unknown.capability');

      expect(agents).toEqual([]);
    });
  });

  describe('getAgent', () => {
    beforeEach(async () => {
      fetch.mockResolvedValue({
        ok: true,
        text: async () => `---
id: system-dev-v1
name: Dev Agent
capabilities: []
---
Prompt`,
      });
    });

    it('should return agent by id', async () => {
      const agent = await getAgent('system-dev-v1');

      expect(agent).toBeDefined();
      expect(agent.id).toBe('system-dev-v1');
    });

    it('should return null for unknown agent', async () => {
      const agent = await getAgent('unknown-agent');

      expect(agent).toBeNull();
    });
  });

  describe('getAgentStats', () => {
    it('should fetch stats from API', async () => {
      const mockStats = {
        total_tasks: 10,
        completed_tasks: 8,
        avg_cost: 0.05,
        avg_duration_minutes: 15,
        success_rate: 0.8,
      };

      agentsApi.getStats.mockResolvedValueOnce(mockStats);

      const stats = await getAgentStats('system-dev-v1');

      expect(stats.total_tasks).toBe(10);
      expect(stats.success_rate).toBe(0.8);
    });

    it('should return zeros on error', async () => {
      agentsApi.getStats.mockRejectedValueOnce(new Error('API Error'));

      const stats = await getAgentStats('system-dev-v1');

      expect(stats.total_tasks).toBe(0);
      expect(stats.success_rate).toBe(0);
    });
  });

  describe('selectAgent', () => {
    beforeEach(() => {
      fetch.mockResolvedValue({
        ok: true,
        text: async () => `---
id: system-dev-v1
name: Dev Agent
capabilities:
  - code.write
cost_per_task_estimate: 0.02
avg_duration_minutes_estimate: 15
---
Prompt`,
      });

      agentsApi.getStats.mockResolvedValue({
        total_tasks: 10,
        completed_tasks: 10,
        avg_cost: 0.02,
        avg_duration_minutes: 15,
        success_rate: 0.9,
      });
    });

    it('should select best agent by capability', async () => {
      const agent = await selectAgent('code.write');

      expect(agent).toBeDefined();
      expect(agent.capabilities).toContain('code.write');
    });

    it('should return null for unknown capability', async () => {
      fetch.mockResolvedValue({
        ok: true,
        text: async () => `---
id: other-agent
name: Other
capabilities:
  - other.skill
---
Prompt`,
      });

      const agent = await selectAgent('code.write');

      expect(agent).toBeNull();
    });
  });

  describe('cloneAgent', () => {
    it('should create new agent from existing', async () => {
      const baseAgent = {
        id: 'system-dev-v1',
        version: 1,
        name: 'Dev Agent',
        capabilities: ['code.write'],
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        text: async () => `---
id: system-dev-v1
version: 1
name: Dev Agent
capabilities:
  - code.write
---
Prompt`,
      });

      const cloned = await cloneAgent('system-dev-v1', {
        name: 'My Custom Dev Agent',
      });

      expect(cloned.id).toContain('system-dev-v2');
      expect(cloned.version).toBe(2);
      expect(cloned.name).toBe('My Custom Dev Agent');
      expect(cloned.previous_version).toBe('system-dev-v1');
      expect(cloned.is_system).toBe(false);
    });

    it('should throw if base agent not found', async () => {
      fetch.mockResolvedValueOnce({ ok: false });

      await expect(cloneAgent('unknown-agent')).rejects.toThrow(
        'Agent not found: unknown-agent'
      );
    });
  });

  describe('buildAgentPrompt', () => {
    it('should build prompt with context', () => {
      const agent = {
        prompt_prefix: 'You are a developer.',
        sop: ['Step 1', 'Step 2'],
      };

      const context = {
        project: { name: 'My Project', phase: 'BUILD' },
        task: { title: 'Fix bug', priority: 'high' },
      };

      const prompt = buildAgentPrompt(agent, context);

      expect(prompt).toContain('You are a developer.');
      expect(prompt).toContain('My Project');
      expect(prompt).toContain('Fix bug');
      expect(prompt).toContain('Step 1');
    });

    it('should handle minimal context', () => {
      const agent = {
        prompt_prefix: 'You are a developer.',
      };

      const prompt = buildAgentPrompt(agent, {});

      expect(prompt).toContain('You are a developer.');
    });
  });
});
