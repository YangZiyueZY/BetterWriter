import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import { useStore } from '../store/useStore';
import { getEyeCareModalBackgroundColor } from '../lib/theme';

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactElement;
  className?: string;
  delay?: number;
}

export const Tooltip: React.FC<TooltipProps> = ({ 
  content, 
  children, 
  className,
  delay = 0.3 
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, position: 'top' as 'top' | 'bottom' | 'left' | 'right' });
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { settings } = useStore();

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;

    const rect = triggerRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const tooltipWidth = tooltipRef.current?.offsetWidth || 120; // fallback width
    const tooltipHeight = tooltipRef.current?.offsetHeight || 32; // fallback height
    const margin = 12;

    let bestPosition: 'top' | 'bottom' | 'left' | 'right' = 'top';
    let top = 0;
    let left = 0;

    // Default: try top
    if (rect.top > tooltipHeight + margin) {
      bestPosition = 'top';
      top = rect.top - tooltipHeight - margin;
      left = rect.left + rect.width / 2 - tooltipWidth / 2;
    } 
    // Fallback: try bottom
    else if (viewportHeight - rect.bottom > tooltipHeight + margin) {
      bestPosition = 'bottom';
      top = rect.bottom + margin;
      left = rect.left + rect.width / 2 - tooltipWidth / 2;
    }
    // Fallback: try right
    else if (viewportWidth - rect.right > tooltipWidth + margin) {
      bestPosition = 'right';
      top = rect.top + rect.height / 2 - tooltipHeight / 2;
      left = rect.right + margin;
    }
    // Fallback: try left
    else {
      bestPosition = 'left';
      top = rect.top + rect.height / 2 - tooltipHeight / 2;
      left = rect.left - tooltipWidth - margin;
    }

    // Keep within horizontal bounds
    left = Math.max(margin, Math.min(left, viewportWidth - tooltipWidth - margin));
    // Keep within vertical bounds
    top = Math.max(margin, Math.min(top, viewportHeight - tooltipHeight - margin));

    setCoords({ top, left, position: bestPosition });
  }, []);

  const showTooltip = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
      // Wait for next frame to ensure element is rendered so we can measure it
      requestAnimationFrame(updatePosition);
    }, delay * 1000);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsVisible(false);
  };

  useEffect(() => {
    if (isVisible) {
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition, true);
    }
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isVisible, updatePosition]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const modalBgColor = getEyeCareModalBackgroundColor(settings);

  return (
    <div 
      ref={triggerRef}
      className="flex items-center"
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
    >
      {children}
      {isVisible && createPortal(
        <AnimatePresence mode="wait">
          <motion.div
            ref={tooltipRef}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            style={{ 
              top: coords.top, 
              left: coords.left,
              backgroundColor: modalBgColor ? modalBgColor.replace('0.95', '0.98') : undefined
            }}
            className={cn(
              "fixed z-[9999] pointer-events-none",
              "px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shadow-2xl backdrop-blur-md",
              !modalBgColor && "bg-slate-900/95 dark:bg-slate-100/95 text-white dark:text-slate-900",
              modalBgColor && "text-slate-800 border border-black/5 ring-1 ring-white/20",
              className
            )}
          >
            {content}
          </motion.div>
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
};
