/**
 * Accessibility utilities and helpers
 * Provides ARIA support, keyboard navigation, screen reader compatibility, and accessibility testing
 */

import React, { useEffect, useRef, useState } from 'react';

// ARIA role definitions
export type AriaRole = 
  | 'button' | 'link' | 'menuitem' | 'tab' | 'tabpanel' | 'dialog' | 'alertdialog'
  | 'tooltip' | 'status' | 'alert' | 'log' | 'marquee' | 'timer' | 'progressbar'
  | 'slider' | 'spinbutton' | 'textbox' | 'combobox' | 'listbox' | 'option'
  | 'grid' | 'gridcell' | 'row' | 'columnheader' | 'rowheader' | 'tree' | 'treeitem';

// Accessibility configuration
export interface AccessibilityConfig {
  announceChanges: boolean;
  keyboardNavigation: boolean;
  highContrast: boolean;
  reducedMotion: boolean;
  screenReaderOptimized: boolean;
}

// ARIA attributes interface
export interface AriaAttributes {
  role?: AriaRole;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  'aria-expanded'?: boolean;
  'aria-selected'?: boolean;
  'aria-checked'?: boolean | 'mixed';
  'aria-disabled'?: boolean;
  'aria-hidden'?: boolean;
  'aria-live'?: 'off' | 'polite' | 'assertive';
  'aria-atomic'?: boolean;
  'aria-relevant'?: string;
  'aria-busy'?: boolean;
  'aria-controls'?: string;
  'aria-owns'?: string;
  'aria-activedescendant'?: string;
  'aria-level'?: number;
  'aria-setsize'?: number;
  'aria-posinset'?: number;
  'aria-valuemin'?: number;
  'aria-valuemax'?: number;
  'aria-valuenow'?: number;
  'aria-valuetext'?: string;
  tabIndex?: number;
}

// Keyboard event handler type
export type KeyboardHandler = (event: KeyboardEvent) => void;

// Screen reader announcement utility
class ScreenReaderAnnouncer {
  private liveRegion: HTMLElement | null = null;

  constructor() {
    this.createLiveRegion();
  }

  private createLiveRegion(): void {
    if (typeof document !== 'undefined') {
      this.liveRegion = document.createElement('div');
      this.liveRegion.setAttribute('aria-live', 'polite');
      this.liveRegion.setAttribute('aria-atomic', 'true');
      this.liveRegion.style.position = 'absolute';
      this.liveRegion.style.left = '-10000px';
      this.liveRegion.style.width = '1px';
      this.liveRegion.style.height = '1px';
      this.liveRegion.style.overflow = 'hidden';
      document.body.appendChild(this.liveRegion);
    }
  }

  announce(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
    if (this.liveRegion) {
      this.liveRegion.setAttribute('aria-live', priority);
      this.liveRegion.textContent = message;
      
      // Clear after announcement to allow repeated messages
      setTimeout(() => {
        if (this.liveRegion) {
          this.liveRegion.textContent = '';
        }
      }, 1000);
    }
  }

  cleanup(): void {
    if (this.liveRegion && this.liveRegion.parentNode) {
      this.liveRegion.parentNode.removeChild(this.liveRegion);
    }
  }
}

// Singleton announcer
const announcer = new ScreenReaderAnnouncer();

// Keyboard navigation utilities
export const KeyCodes = {
  ENTER: 13,
  SPACE: 32,
  ESCAPE: 27,
  ARROW_UP: 38,
  ARROW_DOWN: 40,
  ARROW_LEFT: 37,
  ARROW_RIGHT: 39,
  TAB: 9,
  HOME: 36,
  END: 35,
  PAGE_UP: 33,
  PAGE_DOWN: 34
} as const;

// Focus management utilities
export class FocusManager {
  private static focusableSelectors = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
    '[contenteditable="true"]'
  ].join(', ');

  static getFocusableElements(container: HTMLElement): HTMLElement[] {
    return Array.from(container.querySelectorAll(this.focusableSelectors));
  }

  static getFirstFocusable(container: HTMLElement): HTMLElement | null {
    const focusable = this.getFocusableElements(container);
    return focusable[0] || null;
  }

  static getLastFocusable(container: HTMLElement): HTMLElement | null {
    const focusable = this.getFocusableElements(container);
    return focusable[focusable.length - 1] || null;
  }

  static trapFocus(container: HTMLElement): () => void {
    const focusable = this.getFocusableElements(container);
    const firstFocusable = focusable[0];
    const lastFocusable = focusable[focusable.length - 1];

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Tab') {
        if (event.shiftKey) {
          if (document.activeElement === firstFocusable) {
            event.preventDefault();
            lastFocusable?.focus();
          }
        } else {
          if (document.activeElement === lastFocusable) {
            event.preventDefault();
            firstFocusable?.focus();
          }
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    
    // Focus first element
    firstFocusable?.focus();

    return () => {
      container.removeEventListener('keydown', handleKeyDown);
    };
  }
}

// React hooks for accessibility
export function useAnnouncer() {
  return {
    announce: (message: string, priority?: 'polite' | 'assertive') => {
      announcer.announce(message, priority);
    }
  };
}

export function useKeyboardNavigation(
  onKeyDown?: KeyboardHandler,
  dependencies: React.DependencyList = []
) {
  useEffect(() => {
    if (onKeyDown) {
      document.addEventListener('keydown', onKeyDown);
      return () => document.removeEventListener('keydown', onKeyDown);
    }
  }, dependencies);
}

export function useFocusTrap(isActive: boolean = true) {
  const containerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (isActive && containerRef.current) {
      return FocusManager.trapFocus(containerRef.current);
    }
  }, [isActive]);

  return containerRef;
}

export function useAccessibilityPreferences() {
  const [preferences, setPreferences] = useState<AccessibilityConfig>({
    announceChanges: true,
    keyboardNavigation: true,
    highContrast: false,
    reducedMotion: false,
    screenReaderOptimized: false
  });

  useEffect(() => {
    // Check for system preferences
    if (typeof window !== 'undefined') {
      const mediaQueries = {
        reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)'),
        highContrast: window.matchMedia('(prefers-contrast: high)'),
      };

      const updatePreferences = () => {
        setPreferences(prev => ({
          ...prev,
          reducedMotion: mediaQueries.reducedMotion.matches,
          highContrast: mediaQueries.highContrast.matches
        }));
      };

      // Initial check
      updatePreferences();

      // Listen for changes
      Object.values(mediaQueries).forEach(mq => {
        mq.addEventListener('change', updatePreferences);
      });

      return () => {
        Object.values(mediaQueries).forEach(mq => {
          mq.removeEventListener('change', updatePreferences);
        });
      };
    }
  }, []);

  return { preferences, setPreferences };
}

// Accessibility testing utilities
export class AccessibilityTester {
  static checkColorContrast(foreground: string, background: string): {
    ratio: number;
    wcagAA: boolean;
    wcagAAA: boolean;
  } {
    // Simplified contrast ratio calculation
    // In a real implementation, you'd use a proper color contrast library
    const getLuminance = (color: string): number => {
      // This is a simplified version - use a proper color library in production
      const rgb = color.match(/\d+/g)?.map(Number) || [0, 0, 0];
      const [r, g, b] = rgb.map(c => {
        c = c / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };

    const l1 = getLuminance(foreground);
    const l2 = getLuminance(background);
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);

    return {
      ratio,
      wcagAA: ratio >= 4.5,
      wcagAAA: ratio >= 7
    };
  }

  static validateAriaAttributes(element: HTMLElement): string[] {
    const issues: string[] = [];
    const role = element.getAttribute('role');
    const ariaLabel = element.getAttribute('aria-label');
    const ariaLabelledBy = element.getAttribute('aria-labelledby');

    // Check for missing labels on interactive elements
    if (['button', 'link', 'textbox'].includes(role || '')) {
      if (!ariaLabel && !ariaLabelledBy && !element.textContent?.trim()) {
        issues.push('Interactive element missing accessible name');
      }
    }

    // Check for invalid ARIA attributes
    const ariaAttributes = Array.from(element.attributes)
      .filter(attr => attr.name.startsWith('aria-'));
    
    ariaAttributes.forEach(attr => {
      if (attr.value === '') {
        issues.push(`Empty ARIA attribute: ${attr.name}`);
      }
    });

    return issues;
  }

  static auditPage(): {
    errors: string[];
    warnings: string[];
    suggestions: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    if (typeof document !== 'undefined') {
      // Check for missing alt text on images
      const images = document.querySelectorAll('img');
      images.forEach((img, index) => {
        if (!img.alt && !img.getAttribute('aria-hidden')) {
          errors.push(`Image ${index + 1} missing alt text`);
        }
      });

      // Check for heading structure
      const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
      if (headings.length === 0) {
        warnings.push('No headings found - consider adding semantic structure');
      }

      // Check for form labels
      const inputs = document.querySelectorAll('input, select, textarea');
      inputs.forEach((input, index) => {
        const hasLabel = input.getAttribute('aria-label') || 
                        input.getAttribute('aria-labelledby') ||
                        document.querySelector(`label[for="${input.id}"]`);
        
        if (!hasLabel) {
          errors.push(`Form input ${index + 1} missing label`);
        }
      });

      // Check for skip links
      const skipLink = document.querySelector('a[href="#main"], a[href="#content"]');
      if (!skipLink) {
        suggestions.push('Consider adding skip navigation links');
      }

      // Check for focus indicators
      const focusableElements = document.querySelectorAll(
        'a, button, input, select, textarea, [tabindex]'
      );
      
      if (focusableElements.length > 0) {
        suggestions.push('Ensure all focusable elements have visible focus indicators');
      }
    }

    return { errors, warnings, suggestions };
  }
}

// Utility functions
export function createAriaAttributes(config: Partial<AriaAttributes>): AriaAttributes {
  return {
    ...config
  };
}

export function generateId(prefix: string = 'a11y'): string {
  return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
}

// Higher-order component for accessibility
export function withAccessibility<P extends object>(
  Component: React.ComponentType<P>,
  defaultAriaProps?: Partial<AriaAttributes>
) {
  return React.forwardRef<HTMLElement, P & { ariaProps?: Partial<AriaAttributes> }>(
    (props, ref) => {
      const { ariaProps, ...componentProps } = props;
      const combinedAriaProps = { ...defaultAriaProps, ...ariaProps };
      
      return (
        <Component
          {...(componentProps as P)}
          {...combinedAriaProps}
          ref={ref}
        />
      );
    }
  );
}

// Export utilities
export { announcer as screenReaderAnnouncer };
export default {
  FocusManager,
  AccessibilityTester,
  KeyCodes,
  createAriaAttributes,
  generateId,
  withAccessibility
};