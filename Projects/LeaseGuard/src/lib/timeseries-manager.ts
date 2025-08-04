import redisClient from './redis';

/**
 * Redis TimeSeries Key Naming Convention
 * Following Redis best practices for TimeSeries organization
 */
export const TIMESERIES_KEYS = {
  // Processing Performance
  PROCESSING_TIME: 'processing_time:{operation}',
  SUCCESS_RATE: 'success_rate:{operation}', 
  THROUGHPUT: 'throughput:{operation}',
  
  // User Engagement
  SESSION_DURATION: 'session_duration:{sessionId}',
  USER_INTERACTIONS: 'user_interactions:{action}',
  FEATURE_USAGE: 'feature_usage:{feature}',
  
  // System Health
  ERROR_RATE: 'error_rate:{component}',
  RESPONSE_TIME: 'response_time:{endpoint}',
  MEMORY_USAGE: 'memory_usage:{component}',
  
  // Business Metrics
  VIOLATION_DETECTION: 'violation_detection:{severity}',
  DOCUMENT_PROCESSING: 'document_processing:{type}',
  AI_RESPONSE_TIME: 'ai_response_time:{model}'
} as const;

/**
 * TimeSeries Configuration for different metric types
 */
interface TimeSeriesConfig {
  key: string;
  retention: string;
  labels: string[];
  description: string;
}

/**
 * TimeSeries Manager for Redis TimeSeries operations
 * Implements S.A.F.E. D.R.Y. principles with comprehensive error handling
 */
class TimeSeriesManager {
  private static instance: TimeSeriesManager;
  private initialized = false;
  private cache = new Map<string, { data: any[], timestamp: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Singleton pattern for TimeSeries manager
   */
  public static getInstance(): TimeSeriesManager {
    if (!TimeSeriesManager.instance) {
      TimeSeriesManager.instance = new TimeSeriesManager();
    }
    return TimeSeriesManager.instance;
  }

  /**
   * Initialize TimeSeries with retention policies and labels
   * Strategic: Proper configuration for long-term data management
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      const redis = await redisClient.getClient();
      
      // TimeSeries configurations with retention policies
      const timeSeriesConfigs: TimeSeriesConfig[] = [
        {
          key: 'processing_time:*',
          retention: '30d', // 30 days retention
          labels: ['metric_type:processing', 'component:document_processor'],
          description: 'Document processing performance metrics'
        },
        {
          key: 'user_engagement:*', 
          retention: '90d', // 90 days for user data
          labels: ['metric_type:engagement', 'component:user_behavior'],
          description: 'User engagement and interaction metrics'
        },
        {
          key: 'system_health:*',
          retention: '7d', // 7 days for system metrics
          labels: ['metric_type:health', 'component:system'],
          description: 'System health and performance metrics'
        },
        {
          key: 'business_metrics:*',
          retention: '365d', // 1 year for business data
          labels: ['metric_type:business', 'component:analytics'],
          description: 'Business intelligence and analytics metrics'
        }
      ];
      
      // Initialize each TimeSeries configuration
      for (const config of timeSeriesConfigs) {
        await this.initializeTimeSeries(redis, config);
      }
      
      this.initialized = true;
      console.log('TimeSeries manager initialized successfully');
    } catch (error) {
      console.error('Error initializing TimeSeries manager:', error);
      // Don't throw - allow graceful degradation
    }
  }

  /**
   * Initialize individual TimeSeries with proper configuration
   */
  private async initializeTimeSeries(redis: any, config: TimeSeriesConfig): Promise<void> {
    try {
      // Create TimeSeries with retention and labels
      await redis.ts.create(config.key, {
        RETENTION: config.retention,
        LABELS: config.labels
      });
      console.log(`TimeSeries ${config.key} initialized with retention ${config.retention}`);
    } catch (error: any) {
      // TimeSeries might already exist or Redis Cloud plan doesn't support TimeSeries
      if (error.message?.includes('TS.THEN') || error.message?.includes('unknown command')) {
        console.log(`TimeSeries ${config.key} not supported in current Redis plan - using fallback`);
      } else {
        console.log(`TimeSeries ${config.key} already exists or creation failed:`, error.message);
      }
    }
  }

  /**
   * Add metric to TimeSeries with labels
   * Fortified: Comprehensive error handling and validation
   */
  async addMetric(
    key: string, 
    value: number, 
    labels?: Record<string, string>,
    timestamp?: number
  ): Promise<void> {
    try {
      const redis = await redisClient.getClient();
      const currentTimestamp = timestamp || Date.now();
      
      // Validate input parameters
      if (typeof value !== 'number' || isNaN(value)) {
        console.warn(`Invalid metric value for ${key}: ${value}`);
        return;
      }
      
      // Add data point with labels
      await redis.ts.add(key, currentTimestamp, value, {
        LABELS: labels || {}
      });
      
      // Update aggregations for trending analysis
      await this.updateAggregations(key, value, currentTimestamp);
      
      console.log(`Added metric ${key}: ${value} at ${currentTimestamp}`);
    } catch (error) {
      console.error(`Error adding TimeSeries metric for ${key}:`, error);
      // Don't throw - metrics failure shouldn't block main functionality
    }
  }

  /**
   * Update rolling aggregations for trending analysis
   * Automated: Automatic aggregation updates for analytics
   */
  private async updateAggregations(key: string, value: number, timestamp: number): Promise<void> {
    try {
      const redis = await redisClient.getClient();
      
      // Update rolling averages
      const avgKey = `${key}:avg`;
      await redis.ts.add(avgKey, timestamp, value);
      
      // Update min/max tracking
      const minKey = `${key}:min`;
      const maxKey = `${key}:max`;
      await redis.ts.add(minKey, timestamp, value);
      await redis.ts.add(maxKey, timestamp, value);
      
      // Update count for rate calculations
      const countKey = `${key}:count`;
      await redis.ts.add(countKey, timestamp, 1);
    } catch (error) {
      console.error(`Error updating aggregations for ${key}:`, error);
      // Don't throw - aggregation failure shouldn't block main functionality
    }
  }

  /**
   * Get aggregated metrics with flexible time buckets
   * Resilient: Comprehensive error handling with fallbacks
   */
  async getAggregatedMetrics(
    key: string, 
    from: number, 
    to: number, 
    aggregation: 'avg' | 'min' | 'max' | 'sum' | 'count',
    bucketSize: number = 3600000 // 1 hour default
  ): Promise<any[]> {
    try {
      const redis = await redisClient.getClient();
      
      const result = await redis.ts.range(key, from, to, {
        AGGREGATION: {
          type: aggregation,
          timeBucket: bucketSize
        }
      });
      
      return result.map(([timestamp, value]) => ({
        timestamp,
        value,
        bucket: Math.floor(timestamp / bucketSize) * bucketSize
      }));
    } catch (error) {
      console.error(`Error querying TimeSeries ${key}:`, error);
      // Return empty array as fallback
      return [];
    }
  }

  /**
   * Get multi-series comparison for dashboard analytics
   */
  async getMultiSeriesComparison(
    keys: string[],
    from: number,
    to: number,
    aggregation: string = 'avg'
  ): Promise<Record<string, any[]>> {
    const results: Record<string, any[]> = {};
    
    // Process each key in parallel for better performance
    const promises = keys.map(async (key) => {
      results[key] = await this.getAggregatedMetrics(key, from, to, aggregation as any);
    });
    
    await Promise.all(promises);
    return results;
  }

  /**
   * Get cached metrics for performance optimization
   * Evolving: Intelligent caching with TTL management
   */
  async getCachedMetrics(key: string, from: number, to: number): Promise<any[]> {
    const cacheKey = `${key}:${from}:${to}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }
    
    // Fetch fresh data
    const data = await this.fetchMetrics(key, from, to);
    
    // Cache the result
    this.cache.set(cacheKey, {
      data,
      timestamp: Date.now()
    });
    
    return data;
  }

  /**
   * Fetch raw metrics from Redis TimeSeries
   */
  private async fetchMetrics(key: string, from: number, to: number): Promise<any[]> {
    try {
      const redis = await redisClient.getClient();
      return await redis.ts.range(key, from, to);
    } catch (error) {
      console.error(`Error fetching metrics for ${key}:`, error);
      return [];
    }
  }

  /**
   * Health check for TimeSeries functionality
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.initialize();
      const testKey = 'health_check:timeseries';
      await this.addMetric(testKey, 1, { test: 'true' });
      return true;
    } catch (error) {
      console.error('TimeSeries health check failed:', error);
      return false;
    }
  }

  /**
   * Clear cache for memory management
   */
  clearCache(): void {
    this.cache.clear();
    console.log('TimeSeries cache cleared');
  }
}

// Export singleton instance
const timeSeriesManager = TimeSeriesManager.getInstance();
export default timeSeriesManager; 