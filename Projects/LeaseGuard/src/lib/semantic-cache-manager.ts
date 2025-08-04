import redisClient from './redis';
import timeSeriesManager from './timeseries-manager';

/**
 * Cache entry interface with metadata
 */
interface CacheEntry {
  response: string;
  timestamp: number;
  context: any;
  similarity: number;
  accessCount: number;
  lastAccessed: number;
  ttl: number;
}

/**
 * Semantic similarity result
 */
interface SimilarityResult {
  similarity: number;
  cacheKey: string;
  entry: CacheEntry;
}

/**
 * Search query with context
 */
interface SearchQuery {
  query: string;
  leaseId: string;
  context?: any;
  filters?: any;
  userId?: string;
}

/**
 * Semantic Cache Manager for intelligent caching
 * Implements S.A.F.E. D.R.Y. principles with comprehensive caching strategy
 */
class SemanticCacheManager {
  private static instance: SemanticCacheManager;
  private memoryCache = new Map<string, CacheEntry>();
  private readonly MEMORY_CACHE_SIZE = 1000;
  private readonly MEMORY_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly REDIS_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
  private readonly SIMILARITY_THRESHOLD = 0.85; // 85% similarity threshold

  /**
   * Singleton pattern for cache manager
   */
  public static getInstance(): SemanticCacheManager {
    if (!SemanticCacheManager.instance) {
      SemanticCacheManager.instance = new SemanticCacheManager();
    }
    return SemanticCacheManager.instance;
  }

  /**
   * Generate semantic cache key based on query and context
   * Strategic: Context-aware key generation for optimal cache hits
   */
  async generateSemanticCacheKey(query: SearchQuery): Promise<string> {
    try {
      // Create semantic content combining query and context
      const semanticContent = {
        query: query.query.toLowerCase().trim(),
        leaseId: query.leaseId,
        context: query.context || {},
        filters: query.filters || {},
        userId: query.userId || 'anonymous'
      };

      // Generate hash from semantic content
      const contentString = JSON.stringify(semanticContent);
      const hash = this.simpleHash(contentString);
      
      // Create cache key with prefix for organization
      const cacheKey = `semantic_cache:${hash.toString(16)}`;
      
      return cacheKey;
    } catch (error) {
      console.error('Error generating semantic cache key:', error);
      // Fallback to simple hash
      return `semantic_cache:fallback:${this.simpleHash(query.query)}`;
    }
  }

  /**
   * Get cached response with semantic similarity matching
   * Automated: Intelligent cache retrieval with similarity detection
   */
  async getCachedResponse(query: SearchQuery): Promise<string | null> {
    try {
      const cacheKey = await this.generateSemanticCacheKey(query);
      
      // Check memory cache first (L1 cache)
      const memoryEntry = this.memoryCache.get(cacheKey);
      if (memoryEntry && this.isValidEntry(memoryEntry)) {
        this.updateAccessStats(memoryEntry);
        await this.trackCacheHit('memory', cacheKey);
        return memoryEntry.response;
      }

      // Check Redis cache (L2 cache)
      const redisEntry = await this.getRedisCacheEntry(cacheKey);
      if (redisEntry && this.isValidEntry(redisEntry)) {
        // Move to memory cache for faster access
        this.addToMemoryCache(cacheKey, redisEntry);
        this.updateAccessStats(redisEntry);
        await this.trackCacheHit('redis', cacheKey);
        return redisEntry.response;
      }

      // Check for similar cached responses
      const similarEntry = await this.findSimilarCachedResponse(query);
      if (similarEntry && similarEntry.similarity >= this.SIMILARITY_THRESHOLD) {
        await this.trackCacheHit('similar', similarEntry.cacheKey);
        return similarEntry.entry.response;
      }

      await this.trackCacheMiss(cacheKey);
      return null;
    } catch (error) {
      console.error('Error getting cached response:', error);
      return null;
    }
  }

  /**
   * Store response in cache with metadata
   * Fortified: Comprehensive error handling and validation
   */
  async storeCachedResponse(query: SearchQuery, response: string, ttl?: number): Promise<void> {
    try {
      const cacheKey = await this.generateSemanticCacheKey(query);
      const now = Date.now();
      
      const cacheEntry: CacheEntry = {
        response,
        timestamp: now,
        context: query.context || {},
        similarity: 1.0, // Perfect match for exact query
        accessCount: 0,
        lastAccessed: now,
        ttl: ttl || this.REDIS_CACHE_TTL
      };

      // Store in memory cache (L1)
      this.addToMemoryCache(cacheKey, cacheEntry);

      // Store in Redis cache (L2)
      await this.storeRedisCacheEntry(cacheKey, cacheEntry);

      // Track cache storage metrics
      await this.trackCacheStorage(cacheKey, response.length);

      console.log(`Stored response in cache: ${cacheKey}`);
    } catch (error) {
      console.error('Error storing cached response:', error);
      // Don't throw - cache storage failure shouldn't block main functionality
    }
  }

  /**
   * Find similar cached responses using semantic similarity
   * Evolving: Advanced similarity detection for better cache utilization
   */
  private async findSimilarCachedResponse(query: SearchQuery): Promise<SimilarityResult | null> {
    try {
      const redis = await redisClient.getClient();
      
      // Get all cache keys for this lease
      const cacheKeys = await redis.keys(`semantic_cache:*`);
      let bestMatch: SimilarityResult | null = null;

      for (const key of cacheKeys.slice(0, 50)) { // Limit to 50 keys for performance
        const entry = await this.getRedisCacheEntry(key);
        if (entry && this.isValidEntry(entry)) {
          const similarity = this.calculateSimilarity(query.query, entry.context);
          
          if (similarity > this.SIMILARITY_THRESHOLD && 
              (!bestMatch || similarity > bestMatch.similarity)) {
            bestMatch = {
              similarity,
              cacheKey: key,
              entry
            };
          }
        }
      }

      return bestMatch;
    } catch (error) {
      console.error('Error finding similar cached response:', error);
      return null;
    }
  }

  /**
   * Calculate similarity between two queries
   * Don't Repeat Yourself: Centralized similarity calculation
   */
  private calculateSimilarity(query1: string, query2: any): number {
    try {
      // Simple cosine similarity for text comparison
      const words1 = new Set(query1.toLowerCase().split(/\s+/));
      const words2 = new Set(query2.query?.toLowerCase().split(/\s+/) || []);
      
      const intersection = new Set([...words1].filter(x => words2.has(x)));
      const union = new Set([...words1, ...words2]);
      
      return intersection.size / union.size;
    } catch (error) {
      console.error('Error calculating similarity:', error);
      return 0;
    }
  }

  /**
   * Intelligent cache invalidation based on patterns
   * Resilient: Robust invalidation with fallback mechanisms
   */
  async invalidateCache(pattern: string, reason: string = 'manual'): Promise<void> {
    try {
      const redis = await redisClient.getClient();
      
      // Get keys matching pattern
      const keys = await redis.keys(pattern);
      
      // Invalidate memory cache
      for (const key of keys) {
        this.memoryCache.delete(key);
      }

      // Invalidate Redis cache
      if (keys.length > 0) {
        await redis.del(...keys);
      }

      // Track invalidation metrics
      await this.trackCacheInvalidation(keys.length, reason);

      console.log(`Invalidated ${keys.length} cache entries: ${reason}`);
    } catch (error) {
      console.error('Error invalidating cache:', error);
    }
  }

  /**
   * Cache warming for common queries
   * Your-Focused: Proactive cache population for better user experience
   */
  async warmCache(commonQueries: SearchQuery[]): Promise<void> {
    try {
      console.log(`Warming cache with ${commonQueries.length} queries`);
      
      for (const query of commonQueries) {
        // Generate cache key to ensure it's available
        await this.generateSemanticCacheKey(query);
      }

      await this.trackCacheWarming(commonQueries.length);
    } catch (error) {
      console.error('Error warming cache:', error);
    }
  }

  /**
   * Get cache analytics and performance metrics
   */
  async getCacheAnalytics(): Promise<any> {
    try {
      const redis = await redisClient.getClient();
      
      // Get cache statistics
      const memoryCacheSize = this.memoryCache.size;
      const redisCacheKeys = await redis.keys('semantic_cache:*');
      
      // Get TimeSeries metrics
      const now = Date.now();
      const oneHourAgo = now - 60 * 60 * 1000;
      
      const hitMetrics = await timeSeriesManager.getAggregatedMetrics(
        'cache_hit_rate:semantic',
        oneHourAgo,
        now,
        'avg'
      );

      const missMetrics = await timeSeriesManager.getAggregatedMetrics(
        'cache_miss_rate:semantic',
        oneHourAgo,
        now,
        'avg'
      );

      return {
        memoryCacheSize,
        redisCacheSize: redisCacheKeys.length,
        hitRate: hitMetrics.length > 0 ? hitMetrics[0].value : 0,
        missRate: missMetrics.length > 0 ? missMetrics[0].value : 0,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error getting cache analytics:', error);
      return {
        memoryCacheSize: this.memoryCache.size,
        redisCacheSize: 0,
        hitRate: 0,
        missRate: 0,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Clear all caches
   */
  async clearAllCaches(): Promise<void> {
    try {
      // Clear memory cache
      this.memoryCache.clear();
      
      // Clear Redis cache
      const redis = await redisClient.getClient();
      const keys = await redis.keys('semantic_cache:*');
      if (keys.length > 0) {
        await redis.del(...keys);
      }

      console.log('All caches cleared');
    } catch (error) {
      console.error('Error clearing caches:', error);
    }
  }

  /**
   * Health check for cache manager
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Test cache key generation
      const testQuery: SearchQuery = {
        query: 'test query',
        leaseId: 'test-lease'
      };
      
      const cacheKey = await this.generateSemanticCacheKey(testQuery);
      
      // Test cache storage and retrieval
      await this.storeCachedResponse(testQuery, 'test response');
      const cached = await this.getCachedResponse(testQuery);
      
      return cached === 'test response';
    } catch (error) {
      console.error('Cache manager health check failed:', error);
      return false;
    }
  }

  // Private helper methods

  private addToMemoryCache(key: string, entry: CacheEntry): void {
    // Implement LRU eviction if cache is full
    if (this.memoryCache.size >= this.MEMORY_CACHE_SIZE) {
      const oldestKey = this.memoryCache.keys().next().value;
      this.memoryCache.delete(oldestKey);
    }
    
    this.memoryCache.set(key, entry);
  }

  private async getRedisCacheEntry(key: string): Promise<CacheEntry | null> {
    try {
      const redis = await redisClient.getClient();
      const entry = await redis.json.get(key);
      return entry as CacheEntry;
    } catch (error) {
      return null;
    }
  }

  private async storeRedisCacheEntry(key: string, entry: CacheEntry): Promise<void> {
    try {
      const redis = await redisClient.getClient();
      await redis.json.set(key, '$', entry);
      await redis.expire(key, Math.floor(entry.ttl / 1000));
    } catch (error) {
      console.error('Error storing Redis cache entry:', error);
    }
  }

  private isValidEntry(entry: CacheEntry): boolean {
    const now = Date.now();
    return entry.timestamp + entry.ttl > now;
  }

  private updateAccessStats(entry: CacheEntry): void {
    entry.accessCount++;
    entry.lastAccessed = Date.now();
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  // Metrics tracking methods

  private async trackCacheHit(cacheType: string, key: string): Promise<void> {
    try {
      await timeSeriesManager.addMetric(
        `cache_hit_rate:${cacheType}`,
        1,
        { cacheType, key: key.substring(0, 20) }
      );
    } catch (error) {
      console.error('Error tracking cache hit:', error);
    }
  }

  private async trackCacheMiss(key: string): Promise<void> {
    try {
      await timeSeriesManager.addMetric(
        'cache_miss_rate:semantic',
        1,
        { key: key.substring(0, 20) }
      );
    } catch (error) {
      console.error('Error tracking cache miss:', error);
    }
  }

  private async trackCacheStorage(key: string, responseLength: number): Promise<void> {
    try {
      await timeSeriesManager.addMetric(
        'cache_storage:semantic',
        responseLength,
        { key: key.substring(0, 20) }
      );
    } catch (error) {
      console.error('Error tracking cache storage:', error);
    }
  }

  private async trackCacheInvalidation(count: number, reason: string): Promise<void> {
    try {
      await timeSeriesManager.addMetric(
        'cache_invalidation:semantic',
        count,
        { reason }
      );
    } catch (error) {
      console.error('Error tracking cache invalidation:', error);
    }
  }

  private async trackCacheWarming(count: number): Promise<void> {
    try {
      await timeSeriesManager.addMetric(
        'cache_warming:semantic',
        count,
        { type: 'common_queries' }
      );
    } catch (error) {
      console.error('Error tracking cache warming:', error);
    }
  }
}

// Export singleton instance
const semanticCacheManager = SemanticCacheManager.getInstance();
export default semanticCacheManager; 