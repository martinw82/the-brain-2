import { useState, useEffect } from 'react';
import { C, S } from '../utils/constants.js';

// ═══════════════════════════════════════════════════════════
// TOUR TOOLTIP COMPONENT (Phase 4.2)
// ═══════════════════════════════════════════════════════════
const TourTooltip = ({
  step,
  totalSteps,
  title,
  content,
  position,
  targetRef,
  onNext,
  onSkip,
  onPrev,
  isMobile,
}) => {
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (targetRef?.current) {
      const rect = targetRef.current.getBoundingClientRect();
      const tooltipWidth = 320;
      const tooltipHeight = 180;

      let top = rect.bottom + 16;
      let left = rect.left + rect.width / 2 - tooltipWidth / 2;

      // Keep in viewport
      if (left < 16) left = 16;
      if (left + tooltipWidth > window.innerWidth - 16)
        left = window.innerWidth - tooltipWidth - 16;
      if (top + tooltipHeight > window.innerHeight - 16) {
        top = rect.top - tooltipHeight - 16;
      }

      setCoords({ top, left });
    }
  }, [targetRef, step]);

  return (
    <>
      {/* Spotlight overlay */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          zIndex: 450,
          pointerEvents: 'none',
        }}
      />

      {/* Tooltip */}
      <div
        style={{
          position: 'fixed',
          top: coords.top,
          left: coords.left,
          width: isMobile ? 'calc(100vw - 32px)' : 320,
          background: C.surface,
          border: `2px solid ${C.blue}`,
          borderRadius: 12,
          padding: 20,
          zIndex: 460,
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12,
          }}
        >
          <span style={{ fontSize: 10, color: C.blue, fontWeight: 600 }}>
            TOUR {step}/{totalSteps}
          </span>
          <button
            style={{ ...S.btn('ghost'), padding: '4px 8px', fontSize: 9 }}
            onClick={onSkip}
          >
            Skip tour
          </button>
        </div>

        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: '#f1f5f9',
            marginBottom: 8,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 11,
            color: C.text,
            lineHeight: 1.6,
            marginBottom: 16,
          }}
        >
          {content}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          {step > 1 ? (
            <button
              style={{ ...S.btn('ghost'), fontSize: 10 }}
              onClick={onPrev}
            >
              \u2190 Prev
            </button>
          ) : (
            <div />
          )}

          <button
            style={{ ...S.btn('primary'), fontSize: 10 }}
            onClick={onNext}
          >
            {step === totalSteps ? 'Got it!' : 'Next \u2192'}
          </button>
        </div>
      </div>
    </>
  );
};

export default TourTooltip;
