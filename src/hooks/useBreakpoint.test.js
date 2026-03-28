/**
 * useBreakpoint Hook Tests
 */

import { renderHook } from '@testing-library/react';
import useBreakpoint from '../../hooks/useBreakpoint';

// Mock window.innerWidth
const mockInnerWidth = (width) => {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width,
  });
  window.dispatchEvent(new Event('resize'));
};

describe('useBreakpoint', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should detect mobile breakpoint', () => {
    mockInnerWidth(500);
    const { result } = renderHook(() => useBreakpoint());

    expect(result.current.breakpoint).toBe('mobile');
    expect(result.current.isMobile).toBe(true);
    expect(result.current.isTablet).toBe(false);
    expect(result.current.isDesktop).toBe(false);
  });

  it('should detect tablet breakpoint', () => {
    mockInnerWidth(800);
    const { result } = renderHook(() => useBreakpoint());

    expect(result.current.breakpoint).toBe('tablet');
    expect(result.current.isMobile).toBe(false);
    expect(result.current.isTablet).toBe(true);
    expect(result.current.isDesktop).toBe(false);
  });

  it('should detect desktop breakpoint', () => {
    mockInnerWidth(1200);
    const { result } = renderHook(() => useBreakpoint());

    expect(result.current.breakpoint).toBe('desktop');
    expect(result.current.isMobile).toBe(false);
    expect(result.current.isTablet).toBe(false);
    expect(result.current.isDesktop).toBe(true);
  });

  it('should handle boundary at 768px (mobile/tablet)', () => {
    mockInnerWidth(767);
    const { result: mobileResult } = renderHook(() => useBreakpoint());
    expect(mobileResult.current.isMobile).toBe(true);

    mockInnerWidth(768);
    const { result: tabletResult } = renderHook(() => useBreakpoint());
    expect(tabletResult.current.isTablet).toBe(true);
  });

  it('should handle boundary at 1024px (tablet/desktop)', () => {
    mockInnerWidth(1023);
    const { result: tabletResult } = renderHook(() => useBreakpoint());
    expect(tabletResult.current.isTablet).toBe(true);

    mockInnerWidth(1024);
    const { result: desktopResult } = renderHook(() => useBreakpoint());
    expect(desktopResult.current.isDesktop).toBe(true);
  });

  it('should update on window resize', () => {
    mockInnerWidth(1200);
    const { result, rerender } = renderHook(() => useBreakpoint());

    expect(result.current.isDesktop).toBe(true);

    mockInnerWidth(500);
    rerender();

    expect(result.current.isMobile).toBe(true);
  });

  it('should cleanup event listener on unmount', () => {
    const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() => useBreakpoint());
    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'resize',
      expect.any(Function)
    );
  });
});
