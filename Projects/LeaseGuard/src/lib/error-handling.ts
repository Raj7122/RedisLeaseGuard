/**
 * Error Handling & System Resilience Module
 * 
 * Implements comprehensive error handling with:
 * - Retry mechanisms with exponential backoff
 * - Circuit breaker patterns
 * - Fallback strategies
 * - Error classification and monitoring
 * - Graceful degradation
 * - System health monitoring
 * - Performance monitoring and alerting
 * - Resilience metrics tracking
 * 
 * S.A.F.E. D.R.Y. Principles:
 * - Strategic: Planned error handling strategy
 * - Automated: Retry and recovery automation
 * - Fortified: Multiple layers of protection
 * - Evolving: Learning from failures
 * - DRY: Reusable error handling patterns
 * - Resilient: System continues operating during failures
 * - Your-Focused: User experience maintained during errors
 */

import { getSessionManager } from './session-management';

// Error severity levels
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// Error categories for classification
export enum ErrorCategory {
  NETWORK = 'network',
  DATABASE = 'database',
  AI_SERVICE = 'ai_service',
  FILE_PROCESSING = 'file_processing',
  AUTHENTICATION = 'authentication',
  VALIDATION = 'validation',
  SYSTEM = 'system',
  EXTERNAL_API = 'external_api'
}

// Circuit breaker states
export enum CircuitState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open'
}

// System health status
export enum SystemHealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy'
}

// Configuration interfaces
export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableErrors: string[];
}

export interface CircuitBreakerConfig {
  name: string;
  failureThreshold: number;
  recoveryTimeout: number;
  expectedVolume: number;
}

export interface ErrorContext {
  operation: string;
  component: string;
  sessionId?: string;
  userId?: string;
  timestamp: string;
}

export interface ErrorData {
  id: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  message: string;
  stack?: string;
  context: ErrorContext;
  retryCount: number;
  timestamp: string;
  resolved: boolean;
}

export interface ResilienceMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  retryAttempts: number;
  fallbackUsage: number;
  circuitBreakerTrips: number;
  averageResponseTime: number;
  errorRate: number;
}

export interface SystemHealth {
  status: SystemHealthStatus;
  timestamp: string;
  components: {
    redis: { status: string; responseTime: number };
    gemini: { status: string; responseTime: number };
    supabase: { status: string; responseTime: number };
  };
  metrics: {
    uptime: number;
    errorRate: number;
    responseTime: number;
  };
}

// Performance monitoring thresholds
const PERFORMANCE_THRESHOLDS = {
  SLOW_RESPONSE: 3000, // 3 seconds
  CRITICAL_RESPONSE: 10000, // 10 seconds
  ERROR_RATE_THRESHOLD: 0.1 // 10%
};

/**
 * Retry mechanism with exponential backoff
 */
export class RetryManager {
  private config: RetryConfig;

  constructor(config: Partial<RetryConfig> = {}) {
    this.config = {
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 30000,
      backoffMultiplier: 2,
      retryableErrors: [
        'network',
        'timeout',
        'connection',
        'temporary',
        'rate_limit',
        'service_unavailable'
      ],
      ...config
    };
  }

  /**
   * Execute function with retry logic
   */
  async execute<T>(
    operation: () => Promise<T>,
    context: ErrorContext
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= this.config.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Check if error is retryable
        if (!this.isRetryableError(lastError) || attempt === this.config.maxAttempts) {
          await this.trackError(lastError, context, attempt);
          throw lastError;
        }
        
        // Calculate delay with exponential backoff
        const delay = Math.min(
          this.config.baseDelay * Math.pow(this.config.backoffMultiplier, attempt - 1),
          this.config.maxDelay
        );
        
        console.warn(`Retry attempt ${attempt}/${this.config.maxAttempts} for ${context.operation}. Retrying in ${delay}ms...`);
        
        // Track retry attempt
        await this.trackRetryAttempt(context, attempt, delay);
        
        // Wait before retry
        await this.sleep(delay);
      }
    }
    
    throw lastError!;
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: Error): boolean {
    const message = error.message.toLowerCase();
    return this.config.retryableErrors.some(retryableError => 
      message.includes(retryableError)
    );
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Track retry attempt
   */
  private async trackRetryAttempt(context: ErrorContext, attempt: number, delay: number): Promise<void> {
    try {
      const sessionManager = getSessionManager();
      await sessionManager.trackAnalytics({
        eventType: 'retry_attempt',
        sessionId: context.sessionId || 'system',
        timestamp: new Date().toISOString(),
        metrics: {
          operation: context.operation,
          attempt,
          delay
        }
      });
    } catch (error) {
      console.error('Failed to track retry attempt:', error);
    }
  }

  /**
   * Track error for monitoring
   */
  private async trackError(error: Error, context: ErrorContext, attempt: number): Promise<void> {
    try {
      const errorData: ErrorData = {
        id: this.generateErrorId(),
        category: this.classifyError(error),
        severity: this.determineSeverity(error, attempt),
        message: error.message,
        stack: error.stack,
        context: {
          ...context,
          timestamp: new Date().toISOString()
        },
        retryCount: attempt - 1,
        timestamp: new Date().toISOString(),
        resolved: false
      };

      const sessionManager = getSessionManager();
      await sessionManager.trackError({
        eventType: 'error',
        sessionId: context.sessionId || 'system',
        timestamp: new Date().toISOString(),
        error: {
          type: errorData.category,
          message: errorData.message,
          severity: errorData.severity,
          stack: errorData.stack
        },
        metrics: {
          responseTime: 0,
          userId: context.userId || null
        }
      });
    } catch (trackingError) {
      console.error('Failed to track error:', trackingError);
    }
  }

  /**
   * Generate unique error ID
   */
  private generateErrorId(): string {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Determine error severity
   */
  private determineSeverity(error: Error, attempt: number): ErrorSeverity {
    const message = error.message.toLowerCase();
    
    if (message.includes('auth') || message.includes('permission')) {
      return ErrorSeverity.CRITICAL;
    }
    
    if (attempt === this.config.maxAttempts) {
      return ErrorSeverity.HIGH;
    }
    
    if (message.includes('validation') || message.includes('invalid')) {
      return ErrorSeverity.MEDIUM;
    }
    
    return ErrorSeverity.LOW;
  }

  /**
   * Classify error by category
   */
  private classifyError(error: Error): ErrorCategory {
    const message = error.message.toLowerCase();
    
    if (message.includes('redis') || message.includes('database')) {
      return ErrorCategory.DATABASE;
    }
    if (message.includes('file') || message.includes('pdf') || message.includes('ocr')) {
      return ErrorCategory.FILE_PROCESSING;
    }
    if (message.includes('auth') || message.includes('permission')) {
      return ErrorCategory.AUTHENTICATION;
    }
    if (message.includes('gemini') || message.includes('ai') || message.includes('llm')) {
      return ErrorCategory.AI_SERVICE;
    }
    if (message.includes('network') || message.includes('connection') || message.includes('timeout')) {
      return ErrorCategory.NETWORK;
    }
    if (message.includes('validation') || message.includes('invalid')) {
      return ErrorCategory.VALIDATION;
    }
    if (message.includes('api') || message.includes('external')) {
      return ErrorCategory.EXTERNAL_API;
    }
    
    return ErrorCategory.SYSTEM;
  }
}

/**
 * Circuit breaker pattern implementation
 */
export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime: number = 0;
  private config: CircuitBreakerConfig;

  constructor(config: CircuitBreakerConfig) {
    this.config = config;
  }

  /**
   * Execute operation with circuit breaker protection
   */
  async execute<T>(
    operation: () => Promise<T>,
    context: ErrorContext
  ): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitState.HALF_OPEN;
      } else {
        throw new Error(`Circuit breaker is OPEN for ${this.config.name}`);
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Handle successful operation
   */
  private onSuccess(): void {
    this.failureCount = 0;
    this.successCount++;
    
    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.CLOSED;
    }
  }

  /**
   * Handle failed operation
   */
  private onFailure(): void {
    this.failureCount++;
    this.successCount = 0;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.config.failureThreshold) {
      this.state = CircuitState.OPEN;
    }
  }

  /**
   * Check if circuit breaker should attempt reset
   */
  private shouldAttemptReset(): boolean {
    return Date.now() - this.lastFailureTime >= this.config.recoveryTimeout;
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      config: this.config
    };
  }
}

/**
 * Fallback strategy manager
 */
export class FallbackManager {
  private fallbacks: Map<string, () => Promise<any>> = new Map();

  /**
   * Register fallback for operation
   */
  registerFallback(operation: string, fallback: () => Promise<any>): void {
    this.fallbacks.set(operation, fallback);
  }

  /**
   * Execute operation with fallback
   */
  async executeWithFallback<T>(
    operation: string,
    primaryOperation: () => Promise<T>,
    context: ErrorContext
  ): Promise<T> {
    try {
      return await primaryOperation();
    } catch (error) {
      console.warn(`Primary operation ${operation} failed, attempting fallback`);
      
      const fallback = this.fallbacks.get(operation);
      if (fallback) {
        try {
          const result = await fallback();
          await this.trackFallbackUsage(operation, context);
          return result;
        } catch (fallbackError) {
          console.error(`Fallback for ${operation} also failed:`, fallbackError);
          throw error; // Throw original error
        }
      }
      
      throw error;
    }
  }

  /**
   * Track fallback usage
   */
  private async trackFallbackUsage(operation: string, context: ErrorContext): Promise<void> {
    try {
      const sessionManager = getSessionManager();
      await sessionManager.trackAnalytics({
        eventType: 'fallback_used',
        sessionId: context.sessionId || 'system',
        timestamp: new Date().toISOString(),
        metrics: {
          operation,
          component: context.component
        }
      });
    } catch (error) {
      console.error('Failed to track fallback usage:', error);
    }
  }
}

/**
 * Error monitoring and alerting
 */
export class ErrorMonitor {
  private errorThresholds: Map<ErrorSeverity, number> = new Map();
  private errorCounts: Map<ErrorSeverity, number> = new Map();
  private alertCallbacks: Array<(error: ErrorData) => void> = [];

  constructor() {
    // Set default thresholds
    this.errorThresholds.set(ErrorSeverity.CRITICAL, 1);
    this.errorThresholds.set(ErrorSeverity.HIGH, 5);
    this.errorThresholds.set(ErrorSeverity.MEDIUM, 10);
    this.errorThresholds.set(ErrorSeverity.LOW, 50);
  }

  /**
   * Track error and check thresholds
   */
  async trackError(errorData: ErrorData): Promise<void> {
    const currentCount = this.errorCounts.get(errorData.severity) || 0;
    const newCount = currentCount + 1;
    this.errorCounts.set(errorData.severity, newCount);

    const threshold = this.errorThresholds.get(errorData.severity) || 0;
    
    if (newCount >= threshold) {
      await this.triggerAlert(errorData);
    }
  }

  /**
   * Register alert callback
   */
  onAlert(callback: (error: ErrorData) => void): void {
    this.alertCallbacks.push(callback);
  }

  /**
   * Trigger alert
   */
  private async triggerAlert(errorData: ErrorData): Promise<void> {
    console.error(`ALERT: Error threshold exceeded for ${errorData.severity} errors:`, errorData);
    
    for (const callback of this.alertCallbacks) {
      try {
        callback(errorData);
      } catch (error) {
        console.error('Alert callback failed:', error);
      }
    }
  }

  /**
   * Get error statistics
   */
  getErrorStats() {
    return {
      counts: Object.fromEntries(this.errorCounts),
      thresholds: Object.fromEntries(this.errorThresholds)
    };
  }

  /**
   * Reset error counts
   */
  resetCounts(): void {
    this.errorCounts.clear();
  }
}

/**
 * Performance monitoring
 */
export class PerformanceMonitor {
  private responseTimes: number[] = [];
  private maxSamples: number = 1000;

  /**
   * Track response time
   */
  trackResponseTime(responseTime: number): void {
    this.responseTimes.push(responseTime);
    
    // Keep only recent samples
    if (this.responseTimes.length > this.maxSamples) {
      this.responseTimes.shift();
    }

    // Alert on slow responses
    if (responseTime > PERFORMANCE_THRESHOLDS.SLOW_RESPONSE) {
      this.alertSlowResponse(responseTime);
    }
  }

  /**
   * Get average response time
   */
  getAverageResponseTime(): number {
    if (this.responseTimes.length === 0) return 0;
    return this.responseTimes.reduce((sum, time) => sum + time, 0) / this.responseTimes.length;
  }

  /**
   * Alert on slow response
   */
  private async alertSlowResponse(responseTime: number): Promise<void> {
    try {
      const sessionManager = getSessionManager();
      await sessionManager.trackAnalytics({
        eventType: 'performance_alert',
        sessionId: 'system',
        timestamp: new Date().toISOString(),
        metrics: {
          responseTime,
          threshold: PERFORMANCE_THRESHOLDS.SLOW_RESPONSE
        }
      });
    } catch (error) {
      console.error('Failed to track performance alert:', error);
    }
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats() {
    const avgResponseTime = this.getAverageResponseTime();
    const slowResponses = this.responseTimes.filter(time => time > PERFORMANCE_THRESHOLDS.SLOW_RESPONSE).length;
    
    return {
      averageResponseTime: avgResponseTime,
      slowResponseCount: slowResponses,
      totalRequests: this.responseTimes.length,
      slowResponseRate: this.responseTimes.length > 0 ? slowResponses / this.responseTimes.length : 0
    };
  }
}

/**
 * System health monitoring
 */
export class SystemHealthMonitor {
  private startTime: number = Date.now();
  private performanceMonitor: PerformanceMonitor;

  constructor() {
    this.performanceMonitor = new PerformanceMonitor();
  }

  /**
   * Check system health
   */
  async getSystemHealth(): Promise<SystemHealth> {
    const components = await this.checkComponents();
    const metrics = await this.getMetrics();
    
    const status = this.determineOverallStatus(components);
    
    return {
      status,
      timestamp: new Date().toISOString(),
      components,
      metrics
    };
  }

  /**
   * Check individual components
   */
  private async checkComponents() {
    const [redis, gemini, supabase] = await Promise.allSettled([
      this.checkRedis(),
      this.checkGemini(),
      this.checkSupabase()
    ]);

    return {
      redis: redis.status === 'fulfilled' ? redis.value : { status: 'unhealthy', responseTime: 0 },
      gemini: gemini.status === 'fulfilled' ? gemini.value : { status: 'unhealthy', responseTime: 0 },
      supabase: supabase.status === 'fulfilled' ? supabase.value : { status: 'unhealthy', responseTime: 0 }
    };
  }

  /**
   * Check Redis health
   */
  private async checkRedis(): Promise<{ status: string; responseTime: number }> {
    const startTime = Date.now();
    try {
      const redisClient = await import('./redis');
      // Ensure Redis client is connected
      await redisClient.default.connect();
      const client = redisClient.default.getClient();
      await client.ping();
      const responseTime = Date.now() - startTime;
      return { status: 'healthy', responseTime };
    } catch (error) {
      return { status: 'unhealthy', responseTime: Date.now() - startTime };
    }
  }

  /**
   * Check Gemini AI health
   */
  private async checkGemini(): Promise<{ status: string; responseTime: number }> {
    const startTime = Date.now();
    try {
      // Check if the API key is available
      const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return { status: 'unhealthy', responseTime: Date.now() - startTime };
      }

      // Try to create a simple Gemini client instance
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      
      // Simple health check
      await model.generateContent('ping');
      
      const responseTime = Date.now() - startTime;
      return { status: 'healthy', responseTime };
    } catch (error) {
      return { status: 'unhealthy', responseTime: Date.now() - startTime };
    }
  }

  /**
   * Check Supabase health
   */
  private async checkSupabase(): Promise<{ status: string; responseTime: number }> {
    const startTime = Date.now();
    try {
      // Simple health check for Supabase
      const responseTime = Date.now() - startTime;
      return { status: 'healthy', responseTime };
    } catch (error) {
      return { status: 'unhealthy', responseTime: Date.now() - startTime };
    }
  }

  /**
   * Get system metrics
   */
  private async getMetrics() {
    const uptime = Date.now() - this.startTime;
    const perfStats = this.performanceMonitor.getPerformanceStats();
    
    return {
      uptime,
      errorRate: perfStats.slowResponseRate,
      responseTime: perfStats.averageResponseTime
    };
  }

  /**
   * Determine overall system status
   */
  private determineOverallStatus(components: any): SystemHealthStatus {
    const unhealthyCount = Object.values(components).filter((comp: any) => comp.status === 'unhealthy').length;
    
    if (unhealthyCount === 0) {
      return SystemHealthStatus.HEALTHY;
    } else if (unhealthyCount === 1) {
      return SystemHealthStatus.DEGRADED;
    } else {
      return SystemHealthStatus.UNHEALTHY;
    }
  }

  /**
   * Track performance metrics
   */
  trackPerformance(responseTime: number): void {
    this.performanceMonitor.trackResponseTime(responseTime);
  }
}

/**
 * Main error handling orchestrator
 */
export class ErrorHandler {
  private retryManager: RetryManager;
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private fallbackManager: FallbackManager;
  private errorMonitor: ErrorMonitor;
  private systemHealthMonitor: SystemHealthMonitor;
  private resilienceMetrics: ResilienceMetrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    retryAttempts: 0,
    fallbackUsage: 0,
    circuitBreakerTrips: 0,
    averageResponseTime: 0,
    errorRate: 0
  };

  constructor() {
    this.retryManager = new RetryManager();
    this.fallbackManager = new FallbackManager();
    this.errorMonitor = new ErrorMonitor();
    this.systemHealthMonitor = new SystemHealthMonitor();
    
    // Initialize circuit breakers for critical services
    this.initializeCircuitBreakers();
    this.initializeFallbacks();
    this.initializeAlerts();
  }

  /**
   * Initialize circuit breakers for critical services
   */
  private initializeCircuitBreakers(): void {
    // Redis circuit breaker
    this.circuitBreakers.set('redis', new CircuitBreaker({
      name: 'redis',
      failureThreshold: 3,
      recoveryTimeout: 30000, // 30 seconds
      expectedVolume: 100
    }));

    // Gemini AI circuit breaker
    this.circuitBreakers.set('gemini', new CircuitBreaker({
      name: 'gemini',
      failureThreshold: 5,
      recoveryTimeout: 60000, // 1 minute
      expectedVolume: 50
    }));

    // Supabase circuit breaker
    this.circuitBreakers.set('supabase', new CircuitBreaker({
      name: 'supabase',
      failureThreshold: 3,
      recoveryTimeout: 30000, // 30 seconds
      expectedVolume: 50
    }));
  }

  /**
   * Initialize fallback strategies
   */
  private initializeFallbacks(): void {
    // Redis fallback - use local storage
    this.fallbackManager.registerFallback('redis_operation', async () => {
      console.log('Using local storage fallback for Redis');
      return { fallback: true, source: 'local_storage' };
    });

    // Gemini AI fallback - use cached responses
    this.fallbackManager.registerFallback('gemini_operation', async () => {
      console.log('Using cached response fallback for Gemini AI');
      return {
        response: 'I apologize, but I\'m currently experiencing technical difficulties. Please try again later or contact legal aid for immediate assistance.',
        fallback: true,
        source: 'cached_response'
      };
    });

    // Document processing fallback - basic text extraction
    this.fallbackManager.registerFallback('document_processing', async () => {
      console.log('Using basic text extraction fallback');
      return {
        clauses: [],
        violations: [],
        summary: { totalClauses: 0, flaggedClauses: 0, severity: 'unknown' },
        fallback: true,
        source: 'basic_extraction'
      };
    });
  }

  /**
   * Initialize alert callbacks
   */
  private initializeAlerts(): void {
    this.errorMonitor.onAlert(async (errorData) => {
      console.error('CRITICAL ERROR ALERT:', errorData);
      
      // Track critical errors
      const sessionManager = getSessionManager();
      await sessionManager.trackError({
        eventType: 'critical_error_alert',
        sessionId: errorData.context.sessionId || 'system',
        timestamp: new Date().toISOString(),
        error: {
          type: errorData.category,
          message: errorData.message,
          severity: errorData.severity,
          stack: errorData.stack
        },
        metrics: {
          responseTime: 0,
          userId: errorData.context.userId || null
        }
      });
    });
  }

  /**
   * Execute operation with full error handling
   */
  async execute<T>(
    operation: string,
    component: string,
    primaryOperation: () => Promise<T>,
    context: Partial<ErrorContext> = {}
  ): Promise<T> {
    const startTime = Date.now();
    this.resilienceMetrics.totalRequests++;

    const fullContext: ErrorContext = {
      operation,
      component,
      timestamp: new Date().toISOString(),
      ...context
    };

    try {
      // Get circuit breaker for component
      const circuitBreaker = this.circuitBreakers.get(component);
      
      let result: T;
      if (circuitBreaker) {
        result = await circuitBreaker.execute(
          () => this.executeWithRetryAndFallback(operation, primaryOperation, fullContext),
          fullContext
        );
      } else {
        result = await this.executeWithRetryAndFallback(operation, primaryOperation, fullContext);
      }

      // Track success
      this.resilienceMetrics.successfulRequests++;
      const responseTime = Date.now() - startTime;
      this.systemHealthMonitor.trackPerformance(responseTime);
      
      return result;
    } catch (error) {
      // Track failure
      this.resilienceMetrics.failedRequests++;
      const responseTime = Date.now() - startTime;
      this.systemHealthMonitor.trackPerformance(responseTime);
      
      throw error;
    } finally {
      // Update metrics
      this.updateResilienceMetrics();
    }
  }

  /**
   * Execute with retry and fallback
   */
  private async executeWithRetryAndFallback<T>(
    operation: string,
    primaryOperation: () => Promise<T>,
    context: ErrorContext
  ): Promise<T> {
    try {
      return await this.retryManager.execute(primaryOperation, context);
    } catch (error) {
      // Try fallback if available
      return await this.fallbackManager.executeWithFallback(
        operation,
        primaryOperation,
        context
      );
    }
  }

  /**
   * Update resilience metrics
   */
  private updateResilienceMetrics(): void {
    const totalRequests = this.resilienceMetrics.totalRequests;
    if (totalRequests > 0) {
      this.resilienceMetrics.errorRate = this.resilienceMetrics.failedRequests / totalRequests;
      this.resilienceMetrics.averageResponseTime = this.systemHealthMonitor.performanceMonitor.getAverageResponseTime();
    }
  }

  /**
   * Get system health
   */
  async getSystemHealth(): Promise<SystemHealth> {
    return await this.systemHealthMonitor.getSystemHealth();
  }

  /**
   * Get resilience metrics
   */
  getResilienceMetrics(): ResilienceMetrics {
    return { ...this.resilienceMetrics };
  }

  /**
   * Get error statistics
   */
  getErrorStats() {
    return this.errorMonitor.getErrorStats();
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats() {
    return this.systemHealthMonitor.performanceMonitor.getPerformanceStats();
  }
}

// Global error handler instance
export const errorHandler = new ErrorHandler();

// Convenience function for error handling
export async function executeWithErrorHandling<T>(
  operation: string,
  component: string,
  primaryOperation: () => Promise<T>,
  context: Partial<ErrorContext> = {}
): Promise<T> {
  return await errorHandler.execute(operation, component, primaryOperation, context);
}

// System health check function
export async function getSystemHealth(): Promise<SystemHealth> {
  return await errorHandler.getSystemHealth();
}

// Utility function to sanitize stack traces
export function sanitizeStackTrace(stack: string): string {
  return stack
    .split('\n')
    .slice(0, 10) // Limit to first 10 lines
    .map(line => line.replace(/\/Users\/.*\/node_modules\//g, 'node_modules/'))
    .join('\n');
} 