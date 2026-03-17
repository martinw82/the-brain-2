import { useState, useCallback } from 'react';

const useUndoRedo = (limit = 50) => {
  const [state, setState] = useState({
    past: [],
    present: null,
    future: [],
  });

  const canUndo = state.past.length > 0;
  const canRedo = state.future.length > 0;

  const init = useCallback((initialState) => {
    setState({ past: [], present: initialState, future: [] });
  }, []);

  const push = useCallback(
    (newPresent, actionType = 'edit') => {
      setState((prev) => {
        const newPast = [
          ...prev.past,
          { state: prev.present, action: actionType },
        ].slice(-limit);
        return { past: newPast, present: newPresent, future: [] };
      });
    },
    [limit]
  );

  const undo = useCallback(() => {
    if (!canUndo) return null;
    const previous = state.past[state.past.length - 1];
    const newPast = state.past.slice(0, -1);
    setState({
      past: newPast,
      present: previous.state,
      future: [
        { state: state.present, action: previous.action },
        ...state.future,
      ].slice(0, limit),
    });
    return { state: previous.state, action: previous.action };
  }, [state, canUndo, limit]);

  const redo = useCallback(() => {
    if (!canRedo) return null;
    const next = state.future[0];
    const newFuture = state.future.slice(1);
    setState((prev) => ({
      past: [...prev.past, { state: prev.present, action: next.action }].slice(
        -limit
      ),
      present: next.state,
      future: newFuture,
    }));
    return { state: next.state, action: next.action };
  }, [state, canRedo, limit]);

  const clear = useCallback(() => {
    setState({ past: [], present: null, future: [] });
  }, []);

  return {
    state: state.present,
    init,
    push,
    undo,
    redo,
    canUndo,
    canRedo,
    clear,
  };
};

export default useUndoRedo;
