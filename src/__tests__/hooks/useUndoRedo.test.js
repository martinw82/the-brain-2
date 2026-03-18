/**
 * useUndoRedo Hook Tests
 */

import { renderHook, act } from '@testing-library/react';
import useUndoRedo from '../../hooks/useUndoRedo';

describe('useUndoRedo', () => {
  it('should initialize with empty history', () => {
    const { result } = renderHook(() => useUndoRedo());

    expect(result.current.state).toBeNull();
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it('should initialize with initial state', () => {
    const { result } = renderHook(() => useUndoRedo());

    act(() => {
      result.current.init({ text: 'initial' });
    });

    expect(result.current.state).toEqual({ text: 'initial' });
  });

  it('should push new state', () => {
    const { result } = renderHook(() => useUndoRedo());

    act(() => {
      result.current.init({ count: 0 });
    });

    act(() => {
      result.current.push({ count: 1 }, 'increment');
    });

    expect(result.current.state).toEqual({ count: 1 });
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
  });

  it('should undo to previous state', () => {
    const { result } = renderHook(() => useUndoRedo());

    act(() => {
      result.current.init({ count: 0 });
    });

    act(() => {
      result.current.push({ count: 1 }, 'increment');
    });

    act(() => {
      const undone = result.current.undo();
      expect(undone.state).toEqual({ count: 0 });
    });

    expect(result.current.state).toEqual({ count: 0 });
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);
  });

  it('should redo to next state', () => {
    const { result } = renderHook(() => useUndoRedo());

    act(() => {
      result.current.init({ count: 0 });
    });

    act(() => {
      result.current.push({ count: 1 }, 'increment');
    });

    act(() => {
      result.current.undo();
    });

    act(() => {
      result.current.redo();
    });

    expect(result.current.state).toEqual({ count: 1 });
  });

  it('should clear history', () => {
    const { result } = renderHook(() => useUndoRedo());

    act(() => {
      result.current.init({ count: 0 });
    });

    act(() => {
      result.current.push({ count: 1 });
    });

    act(() => {
      result.current.clear();
    });

    expect(result.current.state).toBeNull();
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it('should respect history limit', () => {
    const { result } = renderHook(() => useUndoRedo(3));

    act(() => {
      result.current.init({ count: 0 });
    });

    // Push more than limit
    act(() => result.current.push({ count: 1 }));
    act(() => result.current.push({ count: 2 }));
    act(() => result.current.push({ count: 3 }));
    act(() => result.current.push({ count: 4 }));

    // Should only keep last 3
    act(() => {
      result.current.undo();
      result.current.undo();
      result.current.undo();
    });

    // After 3 undos, should be at count: 1 (not 0, since it was pushed out)
    expect(result.current.state).toEqual({ count: 1 });
  });

  it('should clear future when pushing new state', () => {
    const { result } = renderHook(() => useUndoRedo());

    act(() => {
      result.current.init({ count: 0 });
    });

    act(() => result.current.push({ count: 1 }));
    act(() => result.current.push({ count: 2 }));

    act(() => {
      result.current.undo();
    });

    expect(result.current.canRedo).toBe(true);

    // Push new state - should clear redo history
    act(() => {
      result.current.push({ count: 3 });
    });

    expect(result.current.canRedo).toBe(false);
    expect(result.current.state).toEqual({ count: 3 });
  });

  it('should return null when undoing with no history', () => {
    const { result } = renderHook(() => useUndoRedo());

    act(() => {
      result.current.init({ count: 0 });
    });

    let undone;
    act(() => {
      undone = result.current.undo();
    });

    expect(undone).toBeNull();
  });

  it('should return null when redoing with no future', () => {
    const { result } = renderHook(() => useUndoRedo());

    act(() => {
      result.current.init({ count: 0 });
    });

    let redone;
    act(() => {
      redone = result.current.redo();
    });

    expect(redone).toBeNull();
  });

  it('should track action types', () => {
    const { result } = renderHook(() => useUndoRedo());

    act(() => {
      result.current.init({ text: '' });
    });

    act(() => {
      result.current.push({ text: 'a' }, 'type-a');
    });

    act(() => {
      result.current.push({ text: 'ab' }, 'type-b');
    });

    act(() => {
      const undone = result.current.undo();
      expect(undone.action).toBe('type-b');
    });
  });
});
