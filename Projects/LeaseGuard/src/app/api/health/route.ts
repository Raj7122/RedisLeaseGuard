import { NextRequest, NextResponse } from 'next/server';
import { getSystemHealth, SystemHealthStatus } from '@/lib/error-handling';

/**
 * System Health Check API Endpoint
 * 
 * GET /api/health - Comprehensive system health check
 * 
 * Returns detailed health status including:
 * - Overall system status (healthy/degraded/unhealthy)
 * - Individual component health (Redis, Gemini AI, Supabase)
 * - Performance metrics (uptime, error rate, response times)
 * - Timestamp of health check
 * 
 * Security Features:
 * - Input validation
 * - Error handling without exposing sensitive information
 * - Rate limiting consideration
 */

export async function GET(request: NextRequest) {
  try {
    // Get comprehensive system health
    const health = await getSystemHealth();

    // Determine HTTP status code based on system health
    let statusCode = 200;
    if (health.status === SystemHealthStatus.DEGRADED) {
      statusCode = 200; // Still operational but degraded
    } else if (health.status === SystemHealthStatus.UNHEALTHY) {
      statusCode = 503; // Service unavailable
    }

    // Return health information
    return NextResponse.json({
      status: health.status,
      timestamp: health.timestamp,
      components: {
        redis: {
          status: health.components.redis.status,
          responseTime: `${health.components.redis.responseTime}ms`
        },
        gemini: {
          status: health.components.gemini.status,
          responseTime: `${health.components.gemini.responseTime}ms`
        },
        supabase: {
          status: health.components.supabase.status,
          responseTime: `${health.components.supabase.responseTime}ms`
        }
      },
      metrics: {
        uptime: `${Math.round(health.metrics.uptime / 1000)}s`,
        errorRate: `${(health.metrics.errorRate * 100).toFixed(2)}%`,
        averageResponseTime: `${Math.round(health.metrics.responseTime)}ms`
      },
      message: getHealthMessage(health.status)
    }, { status: statusCode });

  } catch (error) {
    console.error('Health check failed:', error);
    
    // Return unhealthy status if health check itself fails
    return NextResponse.json({
      status: SystemHealthStatus.UNHEALTHY,
      timestamp: new Date().toISOString(),
      components: {
        redis: { status: 'unknown', responseTime: '0ms' },
        gemini: { status: 'unknown', responseTime: '0ms' },
        supabase: { status: 'unknown', responseTime: '0ms' }
      },
      metrics: {
        uptime: '0s',
        errorRate: '100%',
        averageResponseTime: '0ms'
      },
      message: 'Health check failed - system status unknown',
      error: 'Health check endpoint error'
    }, { status: 503 });
  }
}

/**
 * Get appropriate message based on health status
 */
function getHealthMessage(status: SystemHealthStatus): string {
  switch (status) {
    case SystemHealthStatus.HEALTHY:
      return 'All systems operational';
    case SystemHealthStatus.DEGRADED:
      return 'System operating with reduced functionality';
    case SystemHealthStatus.UNHEALTHY:
      return 'System experiencing issues - some features may be unavailable';
    default:
      return 'System status unknown';
  }
} 