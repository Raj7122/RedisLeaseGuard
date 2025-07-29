/**
 * Health Check API Tests
 * 
 * Comprehensive test suite covering:
 * - System health status checks
 * - Component health validation
 * - Error handling scenarios
 * - Response format validation
 */

import { NextRequest } from 'next/server';
import { GET } from '../health/route';

// Mock dependencies
jest.mock('@/lib/error-handling', () => ({
  getSystemHealth: jest.fn(),
  SystemHealthStatus: {
    HEALTHY: 'healthy',
    DEGRADED: 'degraded',
    UNHEALTHY: 'unhealthy'
  }
}));

import { getSystemHealth, SystemHealthStatus } from '@/lib/error-handling';

const mockGetSystemHealth = getSystemHealth as jest.MockedFunction<typeof getSystemHealth>;

describe('Health Check API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/health', () => {
    it('should return healthy status when all components are healthy', async () => {
      // Mock healthy system health
      mockGetSystemHealth.mockResolvedValue({
        status: SystemHealthStatus.HEALTHY,
        timestamp: '2025-01-27T10:00:00Z',
        components: {
          redis: { status: 'healthy', responseTime: 50 },
          gemini: { status: 'healthy', responseTime: 200 },
          supabase: { status: 'healthy', responseTime: 100 }
        },
        metrics: {
          uptime: 3600000, // 1 hour
          errorRate: 0.01, // 1%
          responseTime: 150
        }
      });

      const request = new NextRequest('http://localhost:3000/api/health');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('healthy');
      expect(data.components.redis.status).toBe('healthy');
      expect(data.components.gemini.status).toBe('healthy');
      expect(data.components.supabase.status).toBe('healthy');
      expect(data.metrics.uptime).toBe('3600s');
      expect(data.metrics.errorRate).toBe('1.00%');
      expect(data.metrics.averageResponseTime).toBe('150ms');
      expect(data.message).toBe('All systems operational');
    });

    it('should return degraded status when some components are failing', async () => {
      // Mock degraded system health (Redis unhealthy)
      mockGetSystemHealth.mockResolvedValue({
        status: SystemHealthStatus.DEGRADED,
        timestamp: '2025-01-27T10:00:00Z',
        components: {
          redis: { status: 'unhealthy', responseTime: 5000 },
          gemini: { status: 'healthy', responseTime: 200 },
          supabase: { status: 'healthy', responseTime: 100 }
        },
        metrics: {
          uptime: 3600000, // 1 hour
          errorRate: 0.15, // 15%
          responseTime: 300
        }
      });

      const request = new NextRequest('http://localhost:3000/api/health');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('degraded');
      expect(data.components.redis.status).toBe('unhealthy');
      expect(data.components.gemini.status).toBe('healthy');
      expect(data.components.supabase.status).toBe('healthy');
      expect(data.metrics.uptime).toBe('3600s');
      expect(data.metrics.errorRate).toBe('15.00%');
      expect(data.metrics.averageResponseTime).toBe('300ms');
      expect(data.message).toBe('System operating with reduced functionality');
    });

    it('should return unhealthy status when critical components are failing', async () => {
      // Mock unhealthy system health (multiple components failing)
      mockGetSystemHealth.mockResolvedValue({
        status: SystemHealthStatus.UNHEALTHY,
        timestamp: '2025-01-27T10:00:00Z',
        components: {
          redis: { status: 'unhealthy', responseTime: 10000 },
          gemini: { status: 'unhealthy', responseTime: 5000 },
          supabase: { status: 'healthy', responseTime: 100 }
        },
        metrics: {
          uptime: 3600000, // 1 hour
          errorRate: 0.45, // 45%
          responseTime: 800
        }
      });

      const request = new NextRequest('http://localhost:3000/api/health');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.status).toBe('unhealthy');
      expect(data.components.redis.status).toBe('unhealthy');
      expect(data.components.gemini.status).toBe('unhealthy');
      expect(data.components.supabase.status).toBe('healthy');
      expect(data.metrics.uptime).toBe('3600s');
      expect(data.metrics.errorRate).toBe('45.00%');
      expect(data.metrics.averageResponseTime).toBe('800ms');
      expect(data.message).toBe('System experiencing issues - some features may be unavailable');
    });

    it('should handle Redis connection errors gracefully', async () => {
      // Mock Redis connection error
      mockGetSystemHealth.mockResolvedValue({
        status: SystemHealthStatus.DEGRADED,
        timestamp: '2025-01-27T10:00:00Z',
        components: {
          redis: { status: 'unhealthy', responseTime: 0 },
          gemini: { status: 'healthy', responseTime: 200 },
          supabase: { status: 'healthy', responseTime: 100 }
        },
        metrics: {
          uptime: 3600000,
          errorRate: 0.25,
          responseTime: 200
        }
      });

      const request = new NextRequest('http://localhost:3000/api/health');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('degraded');
      expect(data.components.redis.status).toBe('unhealthy');
      expect(data.components.redis.responseTime).toBe('0ms');
    });

    it('should track health check analytics', async () => {
      // Mock healthy system
      mockGetSystemHealth.mockResolvedValue({
        status: SystemHealthStatus.HEALTHY,
        timestamp: '2025-01-27T10:00:00Z',
        components: {
          redis: { status: 'healthy', responseTime: 50 },
          gemini: { status: 'healthy', responseTime: 200 },
          supabase: { status: 'healthy', responseTime: 100 }
        },
        metrics: {
          uptime: 3600000,
          errorRate: 0.01,
          responseTime: 150
        }
      });

      const request = new NextRequest('http://localhost:3000/api/health');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('healthy');
      expect(data.timestamp).toBe('2025-01-27T10:00:00Z');
    });

    it('should handle overall health check failure', async () => {
      // Mock health check failure
      mockGetSystemHealth.mockRejectedValue(new Error('System health check failed'));

      const request = new NextRequest('http://localhost:3000/api/health');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.status).toBe('unhealthy');
      expect(data.message).toBe('Health check failed - system status unknown');
      expect(data.error).toBe('Health check endpoint error');
      expect(data.components.redis.status).toBe('unknown');
      expect(data.components.gemini.status).toBe('unknown');
      expect(data.components.supabase.status).toBe('unknown');
    });

    it('should include response time in health check', async () => {
      // Mock system with specific response times
      mockGetSystemHealth.mockResolvedValue({
        status: SystemHealthStatus.HEALTHY,
        timestamp: '2025-01-27T10:00:00Z',
        components: {
          redis: { status: 'healthy', responseTime: 25 },
          gemini: { status: 'healthy', responseTime: 150 },
          supabase: { status: 'healthy', responseTime: 75 }
        },
        metrics: {
          uptime: 7200000, // 2 hours
          errorRate: 0.005, // 0.5%
          responseTime: 83
        }
      });

      const request = new NextRequest('http://localhost:3000/api/health');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.components.redis.responseTime).toBe('25ms');
      expect(data.components.gemini.responseTime).toBe('150ms');
      expect(data.components.supabase.responseTime).toBe('75ms');
      expect(data.metrics.averageResponseTime).toBe('83ms');
    });

    it('should handle Redis URL configuration status', async () => {
      // Mock system with Redis configuration issues
      mockGetSystemHealth.mockResolvedValue({
        status: SystemHealthStatus.DEGRADED,
        timestamp: '2025-01-27T10:00:00Z',
        components: {
          redis: { status: 'unhealthy', responseTime: 0 },
          gemini: { status: 'healthy', responseTime: 200 },
          supabase: { status: 'healthy', responseTime: 100 }
        },
        metrics: {
          uptime: 3600000,
          errorRate: 0.1,
          responseTime: 150
        }
      });

      const request = new NextRequest('http://localhost:3000/api/health');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('degraded');
      expect(data.components.redis.status).toBe('unhealthy');
      expect(data.components.redis.responseTime).toBe('0ms');
    });

    it('should provide detailed component information', async () => {
      // Mock system with detailed component status
      mockGetSystemHealth.mockResolvedValue({
        status: SystemHealthStatus.HEALTHY,
        timestamp: '2025-01-27T10:00:00Z',
        components: {
          redis: { status: 'healthy', responseTime: 30 },
          gemini: { status: 'healthy', responseTime: 180 },
          supabase: { status: 'healthy', responseTime: 90 }
        },
        metrics: {
          uptime: 10800000, // 3 hours
          errorRate: 0.02, // 2%
          responseTime: 100
        }
      });

      const request = new NextRequest('http://localhost:3000/api/health');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.components).toHaveProperty('redis');
      expect(data.components).toHaveProperty('gemini');
      expect(data.components).toHaveProperty('supabase');
      expect(data.metrics).toHaveProperty('uptime');
      expect(data.metrics).toHaveProperty('errorRate');
      expect(data.metrics).toHaveProperty('averageResponseTime');
      expect(data.metrics.uptime).toBe('10800s');
      expect(data.metrics.errorRate).toBe('2.00%');
    });
  });
}); 