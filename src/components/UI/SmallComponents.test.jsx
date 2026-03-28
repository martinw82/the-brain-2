/**
 * Small Components Tests
 * Tests for shared UI primitives
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  AreaPill,
  TagPill,
  Dots,
  HealthBar,
  BadgeStatus,
  Modal,
  Toast,
} from '../../../components/UI/SmallComponents.jsx';

describe('SmallComponents', () => {
  describe('AreaPill', () => {
    const mockArea = {
      name: 'Business',
      icon: '💼',
      color: '#3b82f6',
    };

    it('should render area name and icon', () => {
      render(<AreaPill area={mockArea} />);

      expect(screen.getByText('💼')).toBeInTheDocument();
      expect(screen.getByText('Business')).toBeInTheDocument();
    });

    it('should show active state', () => {
      render(<AreaPill area={mockArea} active={true} />);

      const button = screen.getByRole('button');
      expect(button).toHaveStyle({ background: '#3b82f6' });
    });

    it('should call onClick when clicked', () => {
      const onClick = jest.fn();
      render(<AreaPill area={mockArea} onClick={onClick} />);

      fireEvent.click(screen.getByRole('button'));
      expect(onClick).toHaveBeenCalled();
    });
  });

  describe('TagPill', () => {
    const mockTag = {
      name: 'urgent',
      color: '#ef4444',
    };

    it('should render tag name', () => {
      render(<TagPill tag={mockTag} />);

      expect(screen.getByText('urgent')).toBeInTheDocument();
    });

    it('should show remove button when onRemove provided', () => {
      const onRemove = jest.fn();
      render(<TagPill tag={mockTag} onRemove={onRemove} />);

      const removeBtn = screen.getByText('×');
      expect(removeBtn).toBeInTheDocument();

      fireEvent.click(removeBtn);
      expect(onRemove).toHaveBeenCalledWith(mockTag);
    });

    it('should not show remove button without onRemove', () => {
      render(<TagPill tag={mockTag} />);

      expect(screen.queryByText('×')).not.toBeInTheDocument();
    });
  });

  describe('Dots', () => {
    it('should render correct number of dots', () => {
      const { container } = render(<Dots n={3} max={5} />);

      const dots = container.querySelectorAll('div > div');
      expect(dots).toHaveLength(5);
    });

    it('should highlight correct number of dots', () => {
      const { container } = render(<Dots n={2} max={5} />);

      const dots = container.querySelectorAll('div > div');
      // First 2 should have blue background (filled)
      expect(dots[0]).toHaveStyle({
        background: expect.stringContaining('3b82f6'),
      });
      expect(dots[1]).toHaveStyle({
        background: expect.stringContaining('3b82f6'),
      });
    });

    it('should use custom size', () => {
      const { container } = render(<Dots n={1} max={3} size={10} />);

      const dots = container.querySelectorAll('div > div');
      expect(dots[0]).toHaveStyle({ width: '10px', height: '10px' });
    });
  });

  describe('HealthBar', () => {
    it('should show green for high health', () => {
      render(<HealthBar score={80} />);

      expect(screen.getByText('80')).toBeInTheDocument();
      // Should use green color
      expect(screen.getByText('80')).toHaveStyle({
        color: expect.stringContaining('10b981'),
      });
    });

    it('should show amber for medium health', () => {
      render(<HealthBar score={50} />);

      expect(screen.getByText('50')).toHaveStyle({
        color: expect.stringContaining('f59e0b'),
      });
    });

    it('should show red for low health', () => {
      render(<HealthBar score={30} />);

      expect(screen.getByText('30')).toHaveStyle({
        color: expect.stringContaining('ef4444'),
      });
    });

    it('should render progress bar', () => {
      const { container } = render(<HealthBar score={75} />);

      const bar = container.querySelector('[style*="width: 75%"]');
      expect(bar).toBeInTheDocument();
    });
  });

  describe('BadgeStatus', () => {
    it('should render ACTIVE for active status', () => {
      render(<BadgeStatus status="active" />);

      expect(screen.getByText('ACTIVE')).toBeInTheDocument();
    });

    it('should render STALLED for stalled status', () => {
      render(<BadgeStatus status="stalled" />);

      expect(screen.getByText('STALLED')).toBeInTheDocument();
    });

    it('should render default for unknown status', () => {
      render(<BadgeStatus status="unknown" />);

      expect(screen.getByText('IDEA')).toBeInTheDocument();
    });
  });

  describe('Modal', () => {
    it('should render title and children', () => {
      render(
        <Modal title="Test Modal" onClose={() => {}}>
          <div>Modal content</div>
        </Modal>
      );

      expect(screen.getByText('Test Modal')).toBeInTheDocument();
      expect(screen.getByText('Modal content')).toBeInTheDocument();
    });

    it('should call onClose when close button clicked', () => {
      const onClose = jest.fn();
      render(
        <Modal title="Test" onClose={onClose}>
          <div>Content</div>
        </Modal>
      );

      fireEvent.click(screen.getByText('✕'));
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('Toast', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should render message', () => {
      render(<Toast msg="Test message" onDone={() => {}} />);

      expect(screen.getByText('Test message')).toBeInTheDocument();
    });

    it('should call onDone after timeout', () => {
      const onDone = jest.fn();
      render(<Toast msg="Test" onDone={onDone} />);

      expect(onDone).not.toHaveBeenCalled();

      jest.advanceTimersByTime(2200);

      expect(onDone).toHaveBeenCalled();
    });
  });
});
