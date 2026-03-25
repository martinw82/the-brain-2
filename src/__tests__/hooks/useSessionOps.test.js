/**
 * useSessionOps Hook Tests
 */

import { renderHook, act } from '@testing-library/react';
import useSessionOps from '../../hooks/useSessionOps';
import { ideas as ideasApi, sessions as sessionsApi } from '../../api.js';

jest.mock('../../api.js', () => ({
  ideas: {
    create: jest.fn(),
  },
  sessions: {
    create: jest.fn(),
  },
}));

describe('useSessionOps', () => {
  const mockDeps = {
    ideas: [],
    setIdeas: jest.fn(),
    focusId: 'project-1',
    sessionStart: Date.now() - 3600000, // 1 hour ago
    sessionLog: 'Session notes',
    setSessionLog: jest.fn(),
    setSessionStart: jest.fn(),
    setFocusId: jest.fn(),
    setCheckinModal: jest.fn(),
    setTrainingModal: jest.fn(),
    setOutreachModal: jest.fn(),
    setTodayCheckin: jest.fn(),
    setTodayOutreach: jest.fn(),
    setWeeklyTraining: jest.fn(),
    showToast: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('addIdea', () => {
    it('should create new idea', async () => {
      ideasApi.create.mockResolvedValueOnce({ success: true, id: 'idea-123' });

      const { result } = renderHook(() => useSessionOps(mockDeps));

      await act(async () => {
        await result.current.addIdea('New Idea', ['tag1']);
      });

      expect(ideasApi.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'New Idea',
          tags: ['tag1'],
        })
      );
      expect(mockDeps.showToast).toHaveBeenCalledWith(
        expect.stringContaining('Idea saved')
      );
    });

    it('should handle API errors', async () => {
      ideasApi.create.mockRejectedValueOnce(new Error('API Error'));

      const { result } = renderHook(() => useSessionOps(mockDeps));

      await act(async () => {
        await result.current.addIdea('New Idea');
      });

      expect(mockDeps.showToast).toHaveBeenCalledWith(
        expect.stringContaining('Failed')
      );
    });
  });

  describe('endSession', () => {
    it('should not create session if duration is 0', async () => {
      const depsWithNoDuration = {
        ...mockDeps,
        sessionStart: Date.now(), // No time elapsed
      };

      const { result } = renderHook(() => useSessionOps(depsWithNoDuration));

      await act(async () => {
        await result.current.endSession();
      });

      expect(sessionsApi.create).not.toHaveBeenCalled();
    });

    it('should not create session if no focusId', async () => {
      const depsWithNoFocus = {
        ...mockDeps,
        focusId: null,
      };

      const { result } = renderHook(() => useSessionOps(depsWithNoFocus));

      await act(async () => {
        await result.current.endSession();
      });

      expect(sessionsApi.create).not.toHaveBeenCalled();
    });

    it('should create session with correct duration', async () => {
      sessionsApi.create.mockResolvedValueOnce({ success: true });

      const { result } = renderHook(() => useSessionOps(mockDeps));

      await act(async () => {
        await result.current.endSession();
      });

      expect(sessionsApi.create).toHaveBeenCalledWith(
        expect.objectContaining({
          project_id: 'project-1',
          duration_s: expect.any(Number),
          log: 'Session notes',
        })
      );

      expect(mockDeps.setSessionStart).toHaveBeenCalledWith(null);
      expect(mockDeps.setFocusId).toHaveBeenCalledWith(null);
    });
  });

  describe('Modal Controls', () => {
    it('should open checkin modal', () => {
      const { result } = renderHook(() => useSessionOps(mockDeps));

      act(() => {
        result.current.saveCheckin();
      });

      expect(mockDeps.setCheckinModal).toHaveBeenCalledWith(true);
    });

    it('should open training modal', () => {
      const { result } = renderHook(() => useSessionOps(mockDeps));

      act(() => {
        result.current.loadWeeklyTraining();
      });

      expect(mockDeps.setTrainingModal).toHaveBeenCalledWith(true);
    });

    it('should open outreach modal', () => {
      const { result } = renderHook(() => useSessionOps(mockDeps));

      act(() => {
        result.current.loadTodayOutreach();
      });

      expect(mockDeps.setOutreachModal).toHaveBeenCalledWith(true);
    });
  });
});
