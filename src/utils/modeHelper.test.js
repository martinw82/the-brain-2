/**
 * Mode Helper Tests
 * Tests for assistance mode behavior matrix
 */

import {
  getMode,
  getBehavior,
  shouldShow,
  MODE_INFO,
  MODE_MATRIX,
} from '../../modeHelper.js';

describe('Mode Helper', () => {
  describe('getMode', () => {
    it('should return coach as default', () => {
      expect(getMode({})).toBe('coach');
      expect(getMode(null)).toBe('coach');
      expect(getMode(undefined)).toBe('coach');
    });

    it('should return assistant when set', () => {
      expect(getMode({ assistance_mode: 'assistant' })).toBe('assistant');
    });

    it('should return silent when set', () => {
      expect(getMode({ assistance_mode: 'silent' })).toBe('silent');
    });

    it('should default to coach for invalid values', () => {
      expect(getMode({ assistance_mode: 'invalid' })).toBe('coach');
      expect(getMode({ assistance_mode: '' })).toBe('coach');
    });
  });

  describe('getBehavior', () => {
    it('should return correct behavior for coach mode', () => {
      expect(getBehavior('daily_checkin', 'coach')).toBe('mandatory');
      expect(getBehavior('drift_alerts', 'coach')).toBe('alert');
      expect(getBehavior('ai_tone', 'coach')).toBe('challenging');
    });

    it('should return correct behavior for assistant mode', () => {
      expect(getBehavior('daily_checkin', 'assistant')).toBe('available');
      expect(getBehavior('drift_alerts', 'assistant')).toBe('badge');
      expect(getBehavior('ai_tone', 'assistant')).toBe('supportive');
    });

    it('should return correct behavior for silent mode', () => {
      expect(getBehavior('daily_checkin', 'silent')).toBe('off');
      expect(getBehavior('drift_alerts', 'silent')).toBe('off');
      expect(getBehavior('ai_tone', 'silent')).toBe('minimal');
    });

    it('should default to coach behavior for unknown feature', () => {
      expect(getBehavior('unknown_feature', 'assistant')).toBe('off');
    });

    it('should return all mode behaviors from matrix', () => {
      // Verify matrix consistency
      Object.keys(MODE_MATRIX).forEach((feature) => {
        ['coach', 'assistant', 'silent'].forEach((mode) => {
          const behavior = getBehavior(feature, mode);
          expect(behavior).toBeDefined();
          expect(typeof behavior).toBe('string');
        });
      });
    });
  });

  describe('shouldShow', () => {
    it('should show feature when behavior is not off/hidden/none', () => {
      expect(shouldShow('daily_checkin', 'coach')).toBe(true);
      expect(shouldShow('ai_coach_tab', 'assistant')).toBe(true);
    });

    it('should hide feature when behavior is off', () => {
      expect(shouldShow('daily_checkin', 'silent')).toBe(false);
      expect(shouldShow('drift_alerts', 'silent')).toBe(false);
    });

    it('should hide feature when behavior is hidden', () => {
      expect(shouldShow('ai_coach_tab', 'silent')).toBe(false);
    });

    it('should hide feature when behavior is none', () => {
      expect(shouldShow('notifications', 'silent')).toBe(false);
    });
  });

  describe('MODE_INFO', () => {
    it('should have info for all three modes', () => {
      expect(MODE_INFO.coach).toBeDefined();
      expect(MODE_INFO.assistant).toBeDefined();
      expect(MODE_INFO.silent).toBeDefined();
    });

    it('should have required fields for each mode', () => {
      ['coach', 'assistant', 'silent'].forEach((mode) => {
        expect(MODE_INFO[mode].label).toBeDefined();
        expect(MODE_INFO[mode].icon).toBeDefined();
        expect(MODE_INFO[mode].description).toBeDefined();
      });
    });
  });

  describe('Agent trigger behavior across modes', () => {
    it('should auto-trigger in coach mode', () => {
      expect(getBehavior('agent_trigger', 'coach')).toBe('auto');
    });

    it('should use preview in assistant mode', () => {
      expect(getBehavior('agent_trigger', 'assistant')).toBe('preview');
    });

    it('should be manual in silent mode', () => {
      expect(getBehavior('agent_trigger', 'silent')).toBe('manual');
    });
  });

  describe('Workflow advance behavior', () => {
    it('should auto-advance in coach and assistant modes', () => {
      expect(getBehavior('workflow_advance', 'coach')).toBe('auto');
      expect(getBehavior('workflow_advance', 'assistant')).toBe('auto');
    });

    it('should be manual in silent mode', () => {
      expect(getBehavior('workflow_advance', 'silent')).toBe('manual');
    });
  });
});
