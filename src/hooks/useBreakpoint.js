import { useState, useEffect } from 'react';
import { BREAKPOINTS } from '../utils/constants.js';

const useBreakpoint = () => {
  const [bp, setBp] = useState(() => {
    const w = window.innerWidth;
    if (w < BREAKPOINTS.mobile) return 'mobile';
    if (w < BREAKPOINTS.tablet) return 'tablet';
    return 'desktop';
  });

  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      if (w < BREAKPOINTS.mobile) setBp('mobile');
      else if (w < BREAKPOINTS.tablet) setBp('tablet');
      else setBp('desktop');
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return {
    breakpoint: bp,
    isMobile: bp === 'mobile',
    isTablet: bp === 'tablet',
    isDesktop: bp === 'desktop',
  };
};

export default useBreakpoint;
