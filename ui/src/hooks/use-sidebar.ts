import { useState, useEffect, useCallback } from 'react';

export type SidebarMode = 'desktop' | 'tablet' | 'mobile';

function getMode(width: number): SidebarMode {
  if (width >= 1024) return 'desktop';
  if (width >= 768) return 'tablet';
  return 'mobile';
}

export function useSidebar() {
  const [mode, setMode] = useState<SidebarMode>(() => getMode(window.innerWidth));
  const [isOpen, setIsOpen] = useState(false); // mobile overlay
  const [isCollapsed, setIsCollapsed] = useState(false); // desktop manual collapse

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    function handleResize() {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        const newMode = getMode(window.innerWidth);
        setMode(newMode);
        if (newMode === 'mobile') setIsOpen(false);
      }, 150);
    }
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timeout);
    };
  }, []);

  const toggle = useCallback(() => {
    if (mode === 'mobile') {
      setIsOpen((prev) => !prev);
    } else {
      setIsCollapsed((prev) => !prev);
    }
  }, [mode]);

  const close = useCallback(() => {
    if (mode === 'mobile') setIsOpen(false);
  }, [mode]);

  // Tablet: collapsed by default, user can expand
  // Desktop: expanded by default, user can collapse
  const effectiveCollapsed = mode === 'tablet' ? !isCollapsed : isCollapsed;

  return {
    mode,
    isOpen,
    isCollapsed: effectiveCollapsed,
    toggle,
    close,
    setIsOpen,
  };
}
