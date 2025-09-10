/**
 * Performance monitoring and optimization utilities
 * Tracks bundle size, load times, memory usage, and provides optimization insights
 */

import React from 'react';

export interface PerformanceMetrics {
  bundleSize: number;
  loadTime: number;
  memoryUsage: {
    used: number;
    total: number;
    percentage: number;
  };
  renderTime: number;
  firstContentfulPaint?: number;
  largestContentfulPaint?: number;
  cumulativeLayoutShift?: number;
}

export interface OptimizationSuggestion {
  type: 'bundle' | 'memory' | 'render' | 'network';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  impact: string;
  solution: string;
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics;
  private startTime: number;
  private observer: PerformanceObserver | null = null;

  constructor() {
    this.startTime = performance.now();
    this.metrics = {
      bundleSize: 0,
      loadTime: 0,
      memoryUsage: { used: 0, total: 0, percentage: 0 },
      renderTime: 0
    };
    
    this.initializeObserver();
  }

  private initializeObserver(): void {
    if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
      this.observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        
        entries.forEach((entry) => {
          switch (entry.entryType) {
            case 'paint':
              if (entry.name === 'first-contentful-paint') {
                this.metrics.firstContentfulPaint = entry.startTime;
              }
              break;
            case 'largest-contentful-paint':
              this.metrics.largestContentfulPaint = entry.startTime;
              break;
            case 'layout-shift':
              if (!entry.hadRecentInput) {
                this.metrics.cumulativeLayoutShift = 
                  (this.metrics.cumulativeLayoutShift || 0) + (entry as any).value;
              }
              break;
          }
        });
      });

      try {
        this.observer.observe({ entryTypes: ['paint', 'largest-contentful-paint', 'layout-shift'] });
      } catch (error) {
        console.warn('Performance observer not fully supported:', error);
      }
    }
  }

  /**
   * Measure current memory usage
   */
  measureMemoryUsage(): void {
    if (typeof window !== 'undefined' && 'performance' in window && 'memory' in performance) {
      const memory = (performance as any).memory;
      this.metrics.memoryUsage = {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        percentage: (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100
      };
    }
  }

  /**
   * Measure render performance
   */
  measureRenderTime(componentName: string): () => void {
    const startTime = performance.now();
    
    return () => {
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      this.metrics.renderTime = renderTime;
      
      if (renderTime > 16) { // More than one frame at 60fps
        console.warn(`Slow render detected in ${componentName}: ${renderTime.toFixed(2)}ms`);
      }
    };
  }

  /**
   * Estimate bundle size from network resources
   */
  async measureBundleSize(): Promise<void> {
    if (typeof window !== 'undefined' && 'performance' in window) {
      const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      let totalSize = 0;
      
      resources.forEach((resource) => {
        if (resource.name.includes('.js') || resource.name.includes('.css')) {
          totalSize += resource.transferSize || 0;
        }
      });
      
      this.metrics.bundleSize = totalSize;
    }
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics {
    this.measureMemoryUsage();
    this.metrics.loadTime = performance.now() - this.startTime;
    return { ...this.metrics };
  }

  /**
   * Analyze performance and provide optimization suggestions
   */
  analyzePerformance(): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];
    const metrics = this.getMetrics();

    // Bundle size analysis
    if (metrics.bundleSize > 1024 * 1024) { // > 1MB
      suggestions.push({
        type: 'bundle',
        severity: 'high',
        message: 'Large bundle size detected',
        impact: `Bundle size is ${(metrics.bundleSize / 1024 / 1024).toFixed(2)}MB`,
        solution: 'Consider code splitting, tree shaking, or lazy loading'
      });
    }

    // Memory usage analysis
    if (metrics.memoryUsage.percentage > 80) {
      suggestions.push({
        type: 'memory',
        severity: 'critical',
        message: 'High memory usage detected',
        impact: `Memory usage at ${metrics.memoryUsage.percentage.toFixed(1)}%`,
        solution: 'Check for memory leaks, optimize data structures, or implement virtualization'
      });
    } else if (metrics.memoryUsage.percentage > 60) {
      suggestions.push({
        type: 'memory',
        severity: 'medium',
        message: 'Elevated memory usage',
        impact: `Memory usage at ${metrics.memoryUsage.percentage.toFixed(1)}%`,
        solution: 'Monitor memory usage patterns and consider optimization'
      });
    }

    // Render performance analysis
    if (metrics.renderTime > 50) {
      suggestions.push({
        type: 'render',
        severity: 'high',
        message: 'Slow render performance',
        impact: `Render time: ${metrics.renderTime.toFixed(2)}ms`,
        solution: 'Use React.memo, useMemo, or useCallback to optimize renders'
      });
    }

    // Core Web Vitals analysis
    if (metrics.largestContentfulPaint && metrics.largestContentfulPaint > 2500) {
      suggestions.push({
        type: 'network',
        severity: 'high',
        message: 'Poor Largest Contentful Paint',
        impact: `LCP: ${metrics.largestContentfulPaint.toFixed(0)}ms`,
        solution: 'Optimize images, reduce server response times, or implement preloading'
      });
    }

    if (metrics.cumulativeLayoutShift && metrics.cumulativeLayoutShift > 0.1) {
      suggestions.push({
        type: 'render',
        severity: 'medium',
        message: 'Layout shift detected',
        impact: `CLS: ${metrics.cumulativeLayoutShift.toFixed(3)}`,
        solution: 'Set explicit dimensions for images and containers'
      });
    }

    return suggestions;
  }

  /**
   * Log performance report to console
   */
  logPerformanceReport(): void {
    const metrics = this.getMetrics();
    const suggestions = this.analyzePerformance();

    console.group('🚀 Performance Report');
    console.log('📊 Metrics:', metrics);
    
    if (suggestions.length > 0) {
      console.group('💡 Optimization Suggestions');
      suggestions.forEach((suggestion, index) => {
        const emoji = {
          low: '💚',
          medium: '💛',
          high: '🧡',
          critical: '🔴'
        }[suggestion.severity];
        
        console.log(`${emoji} ${suggestion.message}`);
        console.log(`   Impact: ${suggestion.impact}`);
        console.log(`   Solution: ${suggestion.solution}`);
      });
      console.groupEnd();
    } else {
      console.log('✅ No performance issues detected');
    }
    
    console.groupEnd();
  }

  /**
   * Clean up observer
   */
  disconnect(): void {
    if (this.observer) {
      this.observer.disconnect();
    }
  }
}

// Singleton instance
const performanceMonitor = new PerformanceMonitor();

// React hook for performance monitoring
export function usePerformanceMonitor() {
  const measureRender = (componentName: string) => {
    return performanceMonitor.measureRenderTime(componentName);
  };

  const getMetrics = () => {
    return performanceMonitor.getMetrics();
  };

  const analyze = () => {
    return performanceMonitor.analyzePerformance();
  };

  return {
    measureRender,
    getMetrics,
    analyze,
    logReport: () => performanceMonitor.logPerformanceReport()
  };
}

// Utility functions
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

// Lazy loading utility
export const lazy = <T extends React.ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>
) => {
  return React.lazy(importFunc);
};

// Export singleton
export default performanceMonitor;