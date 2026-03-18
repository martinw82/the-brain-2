/**
 * Constants Tests
 * Verify design tokens and constants
 */

import { C, S, BREAKPOINTS, THAILAND_TARGET, BUIDL_VERSION } from '../../utils/constants.js';

describe('Constants', () => {
  describe('Colors (C)', () => {
    it('should have all required colors', () => {
      expect(C.bg).toBeDefined();
      expect(C.surface).toBeDefined();
      expect(C.border).toBeDefined();
      expect(C.blue).toBeDefined();
      expect(C.blue2).toBeDefined();
      expect(C.green).toBeDefined();
      expect(C.amber).toBeDefined();
      expect(C.red).toBeDefined();
      expect(C.purple).toBeDefined();
      expect(C.text).toBeDefined();
      expect(C.muted).toBeDefined();
      expect(C.dim).toBeDefined();
      expect(C.mono).toBeDefined();
    });

    it('should have valid hex colors', () => {
      const hexPattern = /^#[0-9a-fA-F]{6}$/;
      ['bg', 'surface', 'border', 'blue', 'green', 'amber', 'red', 'purple', 'text', 'muted', 'dim'].forEach((key) => {
        expect(C[key]).toMatch(hexPattern);
      });
    });
  });

  describe('Styles (S)', () => {
    it('should have required style functions', () => {
      expect(typeof S.root).toBe('object');
      expect(typeof S.card).toBe('function');
      expect(typeof S.input).toBe('object');
      expect(typeof S.sel).toBe('object');
      expect(typeof S.btn).toBe('function');
      expect(typeof S.tab).toBe('function');
      expect(typeof S.badge).toBe('function');
      expect(typeof S.label).toBe('function');
    });

    it('should generate card styles correctly', () => {
      const defaultCard = S.card(false);
      expect(defaultCard.background).toBeDefined();
      expect(defaultCard.border).toBeDefined();

      const highlightedCard = S.card(true, C.green);
      expect(highlightedCard.border).toContain(C.green);
    });

    it('should generate button styles correctly', () => {
      const primaryBtn = S.btn('primary');
      expect(primaryBtn.background).toBeDefined();
      expect(primaryBtn.minHeight).toBe(44);

      const ghostBtn = S.btn('ghost');
      expect(ghostBtn.background).toBe('transparent');
    });

    it('should have minimum 44px touch targets for mobile', () => {
      const btn = S.btn('primary');
      expect(btn.minHeight).toBeGreaterThanOrEqual(44);

      const tab = S.tab(true);
      expect(tab.minHeight).toBeGreaterThanOrEqual(44);
    });
  });

  describe('Breakpoints', () => {
    it('should have mobile breakpoint', () => {
      expect(BREAKPOINTS.mobile).toBe(768);
    });

    it('should have tablet breakpoint', () => {
      expect(BREAKPOINTS.tablet).toBe(1024);
    });
  });

  describe('App Constants', () => {
    it('should have Thailand target', () => {
      expect(THAILAND_TARGET).toBe(3000);
      expect(typeof THAILAND_TARGET).toBe('number');
    });

    it('should have BUIDL version', () => {
      expect(BUIDL_VERSION).toBeDefined();
      expect(typeof BUIDL_VERSION).toBe('string');
    });
  });
});
