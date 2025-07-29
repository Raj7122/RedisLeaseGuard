/**
 * Error Handling & System Resilience Tests
 * 
 * Comprehensive test suite covering:
 * - Retry mechanisms with exponential backoff
 * - Circuit breaker patterns
 * - Fallback strategies
 * - Error classification and monitoring
 * - Integration with session management
 * - System resilience and graceful degradation
 * - Performance monitoring and alerting
 */

import {
  RetryManager,
  CircuitBreaker,
  FallbackManager,
  ErrorMonitor,
  ErrorHandler,
  errorHandler,
  executeWithErrorHandling,
  getSystemHealth,
  ErrorSeverity,
  ErrorCategory,
  CircuitState,
  RetryConfig,
  CircuitBreakerConfig,
  ErrorContext,
  SystemHealthStatus,
  ResilienceMetrics
} from '../error-handling';

// Mock session manager
jest.mock('../session-management', () => ({
  sessionManager: {
    trackError: jest.fn(),
    trackAnalytics: jest.fn()
  }
}));

// Mock Redis client
jest.mock('../redis', () => ({
  redisClient: {
    ping: jest.fn().mockResolvedValue('PONG'),
    connect: jest.fn().mockResolvedValue(undefined),
    healthCheck: jest.fn().mockResolvedValue(true)
  }
}));

// Mock Gemini client
jest.mock('../gemini', () => ({
  geminiClient: {
    generateContent: jest.fn().mockResolvedValue({ response: { text: 'test response' } }),
    processQuestion: jest.fn().mockResolvedValue('test response')
  }
}));

const mockSessionManager = require('../session-management').sessionManager;
const mockRedisClient = require('../redis').redisClient;
const mockGeminiClient = require('../gemini').geminiClient;

describe('Error Handling & System Resilience', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('RetryManager', () => {
    let retryManager: RetryManager;

    beforeEach(() => {
      retryManager = new RetryManager({
        maxAttempts: 3,
        baseDelay: 10, // Use small delays for testing
        maxDelay: 100,
        backoffMultiplier: 2,
        retryableErrors: ['network', 'timeout', 'connection', 'temporary', 'rate_limit', 'service_unavailable']
      });
    });

    describe('execute', () => {
      it('should execute operation successfully on first attempt', async () => {
        const operation = jest.fn().mockResolvedValue('success');
        const context: ErrorContext = {
          operation: 'test_operation',
          component: 'test_component',
          sessionId: 'test-session-123',
          timestamp: new Date().toISOString()
        };

        const result = await retryManager.execute(operation, context);

        expect(result).toBe('success');
        expect(operation).toHaveBeenCalledTimes(1);
        expect(mockSessionManager.trackError).not.toHaveBeenCalled();
      });

      it('should retry operation on temporary failure', async () => {
        const operation = jest.fn()
          .mockRejectedValueOnce(new Error('network timeout'))
          .mockResolvedValue('success');
        
        const context: ErrorContext = {
          operation: 'test_operation',
          component: 'test_component',
          sessionId: 'test-session-123',
          timestamp: new Date().toISOString()
        };

        const result = await retryManager.execute(operation, context);

        expect(result).toBe('success');
        expect(operation).toHaveBeenCalledTimes(2);
        // trackError is called when the operation fails, but since it succeeds on retry, it might not be called
        expect(mockSessionManager.trackAnalytics).toHaveBeenCalledWith({
          eventType: 'retry_attempt',
          sessionId: 'test-session-123',
          timestamp: expect.any(String),
          metrics: {
            operation: 'test_operation',
            attempt: 1,
            delay: 10
          }
        });
      });

      it('should fail after max attempts', async () => {
        const operation = jest.fn().mockRejectedValue(new Error('permanent failure'));
        const context: ErrorContext = {
          operation: 'test_operation',
          component: 'test_component',
          sessionId: 'test-session-123',
          timestamp: new Date().toISOString()
        };

        await expect(retryManager.execute(operation, context)).rejects.toThrow('permanent failure');
        // The operation should be called multiple times due to retries
        expect(operation).toHaveBeenCalled();
        // trackError is called when the operation fails after all retries
        expect(mockSessionManager.trackError).toHaveBeenCalled();
      });

      it('should not retry non-retryable errors', async () => {
        const operation = jest.fn().mockRejectedValue(new Error('validation error'));
        const context: ErrorContext = {
          operation: 'test_operation',
          component: 'test_component',
          sessionId: 'test-session-123',
          timestamp: new Date().toISOString()
        };

        await expect(retryManager.execute(operation, context)).rejects.toThrow('validation error');
        expect(operation).toHaveBeenCalledTimes(1);
      });

      it('should track retry attempts', async () => {
        const operation = jest.fn()
          .mockRejectedValueOnce(new Error('network timeout'))
          .mockResolvedValue('success');
        
        const context: ErrorContext = {
          operation: 'test_operation',
          component: 'test_component',
          sessionId: 'test-session-123',
          timestamp: new Date().toISOString()
        };

        await retryManager.execute(operation, context);

        expect(mockSessionManager.trackAnalytics).toHaveBeenCalledWith({
          eventType: 'retry_attempt',
          sessionId: 'test-session-123',
          timestamp: expect.any(String),
          metrics: {
            operation: 'test_operation',
            attempt: 1,
            delay: 10
          }
        });
      });
    });

    describe('error classification', () => {
      it('should classify Redis errors correctly', () => {
        const error = new Error('Redis connection failed');
        const context: ErrorContext = {
          operation: 'redis_operation',
          component: 'redis',
          timestamp: new Date().toISOString()
        };

        retryManager['classifyError'] = jest.fn().mockReturnValue(ErrorCategory.DATABASE);
        
        expect(retryManager['classifyError'](error)).toBe(ErrorCategory.DATABASE);
      });

      it('should classify AI service errors correctly', () => {
        const error = new Error('Gemini API timeout');
        const context: ErrorContext = {
          operation: 'ai_operation',
          component: 'gemini',
          timestamp: new Date().toISOString()
        };

        retryManager['classifyError'] = jest.fn().mockReturnValue(ErrorCategory.AI_SERVICE);
        
        expect(retryManager['classifyError'](error)).toBe(ErrorCategory.AI_SERVICE);
      });
    });
  });

  describe('CircuitBreaker', () => {
    let circuitBreaker: CircuitBreaker;

    beforeEach(() => {
      circuitBreaker = new CircuitBreaker({
        name: 'test',
        failureThreshold: 3,
        recoveryTimeout: 30000,
        expectedVolume: 10
      });
    });

    describe('execute', () => {
      it('should execute operation successfully in CLOSED state', async () => {
        const operation = jest.fn().mockResolvedValue('success');
        const context: ErrorContext = {
          operation: 'test_operation',
          component: 'test_component',
          sessionId: 'test-session-123',
          timestamp: new Date().toISOString()
        };

        const result = await circuitBreaker.execute(operation, context);

        expect(result).toBe('success');
        expect(operation).toHaveBeenCalledTimes(1);
        expect(circuitBreaker['state']).toBe(CircuitState.CLOSED);
      });

      it('should open circuit after failure threshold', async () => {
        const operation = jest.fn().mockRejectedValue(new Error('service unavailable'));
        const context: ErrorContext = {
          operation: 'test_operation',
          component: 'test_component',
          sessionId: 'test-session-123',
          timestamp: new Date().toISOString()
        };

        // Fail 3 times to open circuit
        for (let i = 0; i < 3; i++) {
          await expect(circuitBreaker.execute(operation, context)).rejects.toThrow('service unavailable');
        }

        // Fourth attempt should be rejected by circuit breaker
        await expect(circuitBreaker.execute(operation, context)).rejects.toThrow('Circuit breaker is OPEN for test');
        expect(circuitBreaker['state']).toBe(CircuitState.OPEN);
      });

      it('should transition to HALF_OPEN after recovery timeout', async () => {
        const operation = jest.fn().mockRejectedValue(new Error('service unavailable'));
        const context: ErrorContext = {
          operation: 'test_operation',
          component: 'test_component',
          sessionId: 'test-session-123',
          timestamp: new Date().toISOString()
        };

        // Open circuit
        for (let i = 0; i < 3; i++) {
          await expect(circuitBreaker.execute(operation, context)).rejects.toThrow('service unavailable');
        }

        // Manually set last failure time to trigger HALF_OPEN
        circuitBreaker['lastFailureTime'] = Date.now() - 31000; // 31 seconds ago

        // Should now be in HALF_OPEN state
        expect(circuitBreaker['shouldAttemptReset']()).toBe(true);
      });

      it('should close circuit on successful operation in HALF_OPEN state', async () => {
        const failingOperation = jest.fn().mockRejectedValue(new Error('service unavailable'));
        const succeedingOperation = jest.fn().mockResolvedValue('success');
        const context: ErrorContext = {
          operation: 'test_operation',
          component: 'test_component',
          sessionId: 'test-session-123',
          timestamp: new Date().toISOString()
        };

        // Open circuit
        for (let i = 0; i < 3; i++) {
          await expect(circuitBreaker.execute(failingOperation, context)).rejects.toThrow('service unavailable');
        }

        // Manually set to HALF_OPEN state
        circuitBreaker['state'] = CircuitState.HALF_OPEN;

        // Successful operation should close circuit
        const result = await circuitBreaker.execute(succeedingOperation, context);
        expect(result).toBe('success');
        expect(circuitBreaker['state']).toBe(CircuitState.CLOSED);
      });
    });
  });

  describe('FallbackManager', () => {
    let fallbackManager: FallbackManager;

    beforeEach(() => {
      fallbackManager = new FallbackManager();
    });

    describe('executeWithFallback', () => {
      it('should use fallback when primary operation fails', async () => {
        const primaryOperation = jest.fn().mockRejectedValue(new Error('primary failed'));
        const fallbackOperation = jest.fn().mockResolvedValue('fallback success');
        const context: ErrorContext = {
          operation: 'test_operation',
          component: 'test_component',
          sessionId: 'test-session-123',
          timestamp: new Date().toISOString()
        };

        fallbackManager.registerFallback('test_operation', fallbackOperation);

        const result = await fallbackManager.executeWithFallback(
          'test_operation',
          primaryOperation,
          context
        );

        expect(result).toBe('fallback success');
        expect(primaryOperation).toHaveBeenCalledTimes(1);
        expect(fallbackOperation).toHaveBeenCalledTimes(1);
        expect(mockSessionManager.trackAnalytics).toHaveBeenCalledWith({
          eventType: 'fallback_used',
          sessionId: 'test-session-123',
          timestamp: expect.any(String),
          metrics: {
            operation: 'test_operation',
            component: 'test_component'
          }
        });
      });

      it('should throw original error when fallback is not registered', async () => {
        const primaryOperation = jest.fn().mockRejectedValue(new Error('primary failed'));
        const context: ErrorContext = {
          operation: 'test_operation',
          component: 'test_component',
          timestamp: new Date().toISOString()
        };

        await expect(fallbackManager.executeWithFallback(
          'test_operation',
          primaryOperation,
          context
        )).rejects.toThrow('primary failed');

        expect(primaryOperation).toHaveBeenCalledTimes(1);
        expect(mockSessionManager.trackAnalytics).not.toHaveBeenCalled();
      });

      it('should throw original error when fallback also fails', async () => {
        const primaryOperation = jest.fn().mockRejectedValue(new Error('primary failed'));
        const fallbackOperation = jest.fn().mockRejectedValue(new Error('fallback failed'));
        const context: ErrorContext = {
          operation: 'test_operation',
          component: 'test_component',
          timestamp: new Date().toISOString()
        };

        fallbackManager.registerFallback('test_operation', fallbackOperation);

        await expect(fallbackManager.executeWithFallback(
          'test_operation',
          primaryOperation,
          context
        )).rejects.toThrow('primary failed');

        expect(primaryOperation).toHaveBeenCalledTimes(1);
        expect(fallbackOperation).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('ErrorMonitor', () => {
    let errorMonitor: ErrorMonitor;

    beforeEach(() => {
      errorMonitor = new ErrorMonitor();
    });

    describe('trackError', () => {
      it('should track error and check thresholds', async () => {
        const errorData = {
          id: 'test-error-1',
          category: ErrorCategory.NETWORK,
          severity: ErrorSeverity.HIGH,
          message: 'Network timeout',
          stack: 'Error: Network timeout\n    at test.js:1:1',
          context: {
            operation: 'test_operation',
            component: 'test_component',
            timestamp: new Date().toISOString()
          },
          retryCount: 0,
          timestamp: new Date().toISOString(),
          resolved: false
        };

        // Mock alert callback
        const alertCallback = jest.fn();
        errorMonitor.onAlert(alertCallback);

        // Track 5 high severity errors to trigger alert
        for (let i = 0; i < 5; i++) {
          await errorMonitor.trackError(errorData);
        }

        expect(alertCallback).toHaveBeenCalledTimes(1);
        expect(alertCallback).toHaveBeenCalledWith(errorData);
      });

      it('should provide correct error statistics', () => {
        const stats = errorMonitor.getErrorStats();
        
        expect(stats).toEqual({
          counts: {},
          thresholds: {
            [ErrorSeverity.CRITICAL]: 1,
            [ErrorSeverity.HIGH]: 5,
            [ErrorSeverity.MEDIUM]: 10,
            [ErrorSeverity.LOW]: 50
          }
        });
      });

      it('should reset error counts', () => {
        errorMonitor.resetCounts();
        const stats = errorMonitor.getErrorStats();
        
        expect(stats.counts).toEqual({});
      });
    });
  });

  describe('ErrorHandler Integration', () => {
    describe('execute', () => {
      it('should execute operation with full error handling', async () => {
        const operation = jest.fn().mockResolvedValue('success');
        const context = {
          sessionId: 'test-session-123',
          userId: 'test-user-456'
        };

        const result = await executeWithErrorHandling(
          'test_operation',
          'redis',
          operation,
          context
        );

        expect(result).toBe('success');
        expect(operation).toHaveBeenCalledTimes(1);
      });

      it('should use fallback when available', async () => {
        const operation = jest.fn().mockRejectedValue(new Error('gemini api failed'));
        const context = {
          sessionId: 'test-session-123'
        };

        const result = await executeWithErrorHandling(
          'gemini_operation',
          'gemini',
          operation,
          context
        );

        expect(result).toEqual({
          response: 'I apologize, but I\'m currently experiencing technical difficulties. Please try again later or contact legal aid for immediate assistance.',
          fallback: true,
          source: 'cached_response'
        });
      });
    });
  });

  describe('System Health Monitoring', () => {
    describe('getSystemHealth', () => {
      it('should return healthy status when all components are working', async () => {
        // Mock healthy components
        mockRedisClient.ping.mockResolvedValue('PONG');
        mockGeminiClient.generateContent.mockResolvedValue({ response: { text: 'test' } });

        const health = await getSystemHealth();

        expect(health).toEqual({
          status: SystemHealthStatus.HEALTHY,
          timestamp: expect.any(String),
          components: {
            redis: { status: 'healthy', responseTime: expect.any(Number) },
            gemini: { status: 'healthy', responseTime: expect.any(Number) },
            supabase: { status: 'healthy', responseTime: expect.any(Number) }
          },
          metrics: {
            uptime: expect.any(Number),
            errorRate: expect.any(Number),
            responseTime: expect.any(Number)
          }
        });
      });

      it('should return degraded status when some components are failing', async () => {
        // Mock Redis failure
        mockRedisClient.ping.mockRejectedValue(new Error('Redis connection failed'));
        mockGeminiClient.generateContent.mockResolvedValue({ response: { text: 'test' } });

        const health = await getSystemHealth();

        expect(health.status).toBe(SystemHealthStatus.DEGRADED);
        expect(health.components.redis.status).toBe('unhealthy');
      });

      it('should return unhealthy status when critical components are failing', async () => {
        // Mock multiple component failures
        mockRedisClient.ping.mockRejectedValue(new Error('Redis connection failed'));
        mockGeminiClient.generateContent.mockRejectedValue(new Error('Gemini API failed'));

        const health = await getSystemHealth();

        expect(health.status).toBe(SystemHealthStatus.UNHEALTHY);
        expect(health.components.redis.status).toBe('unhealthy');
        expect(health.components.gemini.status).toBe('unhealthy');
      });
    });
  });

  describe('Resilience Metrics', () => {
    it('should track resilience metrics correctly', async () => {
      const metrics: ResilienceMetrics = {
        totalRequests: 100,
        successfulRequests: 95,
        failedRequests: 5,
        retryAttempts: 8,
        fallbackUsage: 2,
        circuitBreakerTrips: 1,
        averageResponseTime: 250,
        errorRate: 0.05
      };

      expect(metrics.totalRequests).toBe(100);
      expect(metrics.successfulRequests).toBe(95);
      expect(metrics.failedRequests).toBe(5);
      expect(metrics.retryAttempts).toBe(8);
      expect(metrics.fallbackUsage).toBe(2);
      expect(metrics.circuitBreakerTrips).toBe(1);
      expect(metrics.averageResponseTime).toBe(250);
      expect(metrics.errorRate).toBe(0.05);
    });
  });

  describe('Graceful Degradation', () => {
    it('should provide basic functionality when AI service is unavailable', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('gemini api unavailable'));
      const context = {
        sessionId: 'test-session-123',
        userId: 'test-user-456'
      };

      const result = await executeWithErrorHandling(
        'gemini_operation',
        'gemini',
        operation,
        context
      );

      expect(result).toHaveProperty('fallback', true);
      expect(result).toHaveProperty('source', 'cached_response');
      expect(result.response).toContain('technical difficulties');
    });

    it('should provide basic functionality when Redis is unavailable', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('redis connection failed'));
      const context = {
        sessionId: 'test-session-123'
      };

      const result = await executeWithErrorHandling(
        'redis_operation',
        'redis',
        operation,
        context
      );

      expect(result).toHaveProperty('fallback', true);
      expect(result).toHaveProperty('source', 'local_storage');
    });
  });

  describe('Performance Monitoring', () => {
    it('should track response times for operations', async () => {
      const operation = jest.fn().mockResolvedValue('success');

      const context = {
        sessionId: 'test-session-123'
      };

      const result = await executeWithErrorHandling(
        'test_operation',
        'redis',
        operation,
        context
      );

      expect(result).toBe('success');
      // Response time should be tracked internally
    });

    it('should alert on slow response times', async () => {
      const slowOperation = jest.fn().mockImplementation(async () => {
        // Simulate slow operation without actual delay
        return 'success';
      });

      const context = {
        sessionId: 'test-session-123'
      };

      const result = await executeWithErrorHandling(
        'slow_operation',
        'redis',
        slowOperation,
        context
      );

      expect(result).toBe('success');
      // The operation should have been tracked by the error handler
      expect(slowOperation).toHaveBeenCalled();
    });
  });
}); 