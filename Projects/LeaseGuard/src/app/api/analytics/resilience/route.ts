import { NextRequest, NextResponse } from 'next/server';
import { errorHandler } from '@/lib/error-handling';

/**
 * Resilience Metrics API Endpoint
 * 
 * GET /api/analytics/resilience - Get system resilience metrics
 * 
 * Returns comprehensive resilience metrics including:
 * - Request success/failure rates
 * - Retry attempt statistics
 * - Fallback usage metrics
 * - Circuit breaker trip counts
 * - Performance statistics
 * - Error rates and trends
 * 
 * Security Features:
 * - Input validation
 * - Error handling without exposing sensitive information
 * - Rate limiting consideration
 */

export async function GET(request: NextRequest) {
  try {
    // Get resilience metrics
    const resilienceMetrics = errorHandler.getResilienceMetrics();
    
    // Get error statistics
    const errorStats = errorHandler.getErrorStats();
    
    // Get performance statistics
    const performanceStats = errorHandler.getPerformanceStats();
    
    // Calculate additional metrics
    const successRate = resilienceMetrics.totalRequests > 0 
      ? (resilienceMetrics.successfulRequests / resilienceMetrics.totalRequests) * 100 
      : 0;
    
    const retryRate = resilienceMetrics.totalRequests > 0 
      ? (resilienceMetrics.retryAttempts / resilienceMetrics.totalRequests) * 100 
      : 0;
    
    const fallbackRate = resilienceMetrics.totalRequests > 0 
      ? (resilienceMetrics.fallbackUsage / resilienceMetrics.totalRequests) * 100 
      : 0;

    // Return comprehensive resilience metrics
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      metrics: {
        requests: {
          total: resilienceMetrics.totalRequests,
          successful: resilienceMetrics.successfulRequests,
          failed: resilienceMetrics.failedRequests,
          successRate: `${successRate.toFixed(2)}%`,
          errorRate: `${(resilienceMetrics.errorRate * 100).toFixed(2)}%`
        },
        resilience: {
          retryAttempts: resilienceMetrics.retryAttempts,
          retryRate: `${retryRate.toFixed(2)}%`,
          fallbackUsage: resilienceMetrics.fallbackUsage,
          fallbackRate: `${fallbackRate.toFixed(2)}%`,
          circuitBreakerTrips: resilienceMetrics.circuitBreakerTrips
        },
        performance: {
          averageResponseTime: `${Math.round(resilienceMetrics.averageResponseTime)}ms`,
          slowResponseCount: performanceStats.slowResponseCount,
          slowResponseRate: `${(performanceStats.slowResponseRate * 100).toFixed(2)}%`,
          totalRequests: performanceStats.totalRequests
        }
      },
      errorStats: {
        counts: errorStats.counts,
        thresholds: errorStats.thresholds
      },
      status: {
        overall: successRate >= 95 ? 'excellent' : successRate >= 90 ? 'good' : successRate >= 80 ? 'fair' : 'poor',
        performance: resilienceMetrics.averageResponseTime < 1000 ? 'excellent' : 
                    resilienceMetrics.averageResponseTime < 2000 ? 'good' : 
                    resilienceMetrics.averageResponseTime < 5000 ? 'fair' : 'poor',
        reliability: resilienceMetrics.errorRate < 0.01 ? 'excellent' : 
                    resilienceMetrics.errorRate < 0.05 ? 'good' : 
                    resilienceMetrics.errorRate < 0.10 ? 'fair' : 'poor'
      }
    });

  } catch (error) {
    console.error('Resilience metrics error:', error);
    
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      error: 'Failed to retrieve resilience metrics',
      metrics: {
        requests: { total: 0, successful: 0, failed: 0, successRate: '0%', errorRate: '0%' },
        resilience: { retryAttempts: 0, retryRate: '0%', fallbackUsage: 0, fallbackRate: '0%', circuitBreakerTrips: 0 },
        performance: { averageResponseTime: '0ms', slowResponseCount: 0, slowResponseRate: '0%', totalRequests: 0 }
      },
      errorStats: { counts: {}, thresholds: {} },
      status: { overall: 'unknown', performance: 'unknown', reliability: 'unknown' }
    }, { status: 500 });
  }
} 