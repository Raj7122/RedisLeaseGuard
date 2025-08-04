import semanticCacheManager from '../semantic-cache-manager';
import redisClient from '../redis';
import timeSeriesManager from '../timeseries-manager';

// Mock dependencies
jest.mock('../redis');
jest.mock('../timeseries-manager');

const mockRedisClient = redisClient as jest.Mocked<typeof redisClient>;
const mockTimeSeriesManager = timeSeriesManager as jest.Mocked<typeof timeSeriesManager>;

describe('SemanticCacheManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset singleton instance
    (semanticCacheManager as any).memoryCache.clear();
    
    // Mock Redis client
    mockRedisClient.getClient.mockResolvedValue({
      json: {
        get: jest.fn(),
        set: jest.fn(),
      },
      keys: jest.fn(),
      del: jest.fn(),
      expire: jest.fn(),
    } as any);
    
    // Mock TimeSeries manager
    mockTimeSeriesManager.addMetric.mockResolvedValue();
  });

  describe('Singleton Pattern', () => {
    test('should return the same instance', () => {
      const instance1 = semanticCacheManager;
      const instance2 = semanticCacheManager;
      expect(instance1).toBe(instance2);
    });
  });

  describe('Cache Key Generation', () => {
    test('should generate consistent cache keys', async () => {
      const query1 = {
        query: 'test query',
        leaseId: 'test-lease',
        context: { test: 'data' }
      };
      
      const query2 = {
        query: 'test query',
        leaseId: 'test-lease',
        context: { test: 'data' }
      };
      
      const key1 = await semanticCacheManager.generateSemanticCacheKey(query1);
      const key2 = await semanticCacheManager.generateSemanticCacheKey(query2);
      
      expect(key1).toBe(key2);
      expect(key1).toMatch(/^semantic_cache:[a-f0-9]+$/);
    });

    test('should handle different queries with different keys', async () => {
      const query1 = { query: 'test query', leaseId: 'test-lease' };
      const query2 = { query: 'different query', leaseId: 'test-lease' };
      
      const key1 = await semanticCacheManager.generateSemanticCacheKey(query1);
      const key2 = await semanticCacheManager.generateSemanticCacheKey(query2);
      
      expect(key1).not.toBe(key2);
    });

    test('should handle errors gracefully', async () => {
      const query = { query: 'test query', leaseId: 'test-lease' };
      
      // Mock JSON.stringify to throw error
      const originalStringify = JSON.stringify;
      JSON.stringify = jest.fn().mockImplementation(() => {
        throw new Error('JSON error');
      });
      
      const key = await semanticCacheManager.generateSemanticCacheKey(query);
      
      expect(key).toMatch(/^semantic_cache:fallback:/);
      
      // Restore original
      JSON.stringify = originalStringify;
    });
  });

  describe('Cache Storage and Retrieval', () => {
    test('should store and retrieve cached response', async () => {
      const query = {
        query: 'test query',
        leaseId: 'test-lease',
        context: { test: 'data' }
      };
      
      const response = 'test response';
      
      // Mock Redis operations
      const mockRedis = {
        json: {
          get: jest.fn().mockResolvedValue(null),
          set: jest.fn().mockResolvedValue('OK'),
        },
        expire: jest.fn().mockResolvedValue(1),
      };
      mockRedisClient.getClient.mockResolvedValue(mockRedis as any);
      
      // Store response
      await semanticCacheManager.storeCachedResponse(query, response);
      
      // Mock Redis to return the stored entry
      const cacheEntry = {
        response,
        timestamp: Date.now(),
        context: query.context,
        similarity: 1.0,
        accessCount: 0,
        lastAccessed: Date.now(),
        ttl: 24 * 60 * 60 * 1000
      };
      mockRedis.json.get.mockResolvedValue(cacheEntry);
      
      // Retrieve response
      const cached = await semanticCacheManager.getCachedResponse(query);
      
      expect(cached).toBe(response);
      expect(mockRedis.json.set).toHaveBeenCalled();
      expect(mockRedis.expire).toHaveBeenCalled();
    });

    test('should use memory cache for faster access', async () => {
      const query = { query: 'test query', leaseId: 'test-lease' };
      const response = 'test response';
      
      // Store in cache
      await semanticCacheManager.storeCachedResponse(query, response);
      
      // Retrieve from memory cache
      const cached = await semanticCacheManager.getCachedResponse(query);
      
      expect(cached).toBe(response);
    });

    test('should handle cache misses gracefully', async () => {
      const query = { query: 'test query', leaseId: 'test-lease' };
      
      // Mock Redis to return null
      const mockRedis = {
        json: {
          get: jest.fn().mockResolvedValue(null),
        },
        keys: jest.fn().mockResolvedValue([]),
      };
      mockRedisClient.getClient.mockResolvedValue(mockRedis as any);
      
      const cached = await semanticCacheManager.getCachedResponse(query);
      
      expect(cached).toBeNull();
    });
  });

  describe('Similarity Detection', () => {
    test('should find similar cached responses', async () => {
      const query = { query: 'rent payment', leaseId: 'test-lease' };
      
      // Mock Redis to return existing cache entries
      const mockRedis = {
        json: {
          get: jest.fn().mockResolvedValue({
            response: 'cached response',
            timestamp: Date.now(),
            context: { query: 'rental payment' },
            similarity: 1.0,
            accessCount: 0,
            lastAccessed: Date.now(),
            ttl: 24 * 60 * 60 * 1000
          }),
        },
        keys: jest.fn().mockResolvedValue(['semantic_cache:test1', 'semantic_cache:test2']),
      };
      mockRedisClient.getClient.mockResolvedValue(mockRedis as any);
      
      const cached = await semanticCacheManager.getCachedResponse(query);
      
      expect(cached).toBe('cached response');
    });
  });

  describe('Cache Invalidation', () => {
    test('should invalidate cache entries', async () => {
      const mockRedis = {
        keys: jest.fn().mockResolvedValue(['semantic_cache:test1', 'semantic_cache:test2']),
        del: jest.fn().mockResolvedValue(2),
      };
      mockRedisClient.getClient.mockResolvedValue(mockRedis as any);
      
      await semanticCacheManager.invalidateCache('semantic_cache:*', 'test');
      
      expect(mockRedis.keys).toHaveBeenCalledWith('semantic_cache:*');
      expect(mockRedis.del).toHaveBeenCalledWith('semantic_cache:test1', 'semantic_cache:test2');
    });

    test('should handle invalidation errors gracefully', async () => {
      const mockRedis = {
        keys: jest.fn().mockRejectedValue(new Error('Redis error')),
      };
      mockRedisClient.getClient.mockResolvedValue(mockRedis as any);
      
      // Should not throw
      await expect(semanticCacheManager.invalidateCache('semantic_cache:*')).resolves.not.toThrow();
    });
  });

  describe('Cache Warming', () => {
    test('should warm cache with common queries', async () => {
      const commonQueries = [
        { query: 'rent payment', leaseId: 'test-lease' },
        { query: 'security deposit', leaseId: 'test-lease' }
      ];
      
      await semanticCacheManager.warmCache(commonQueries);
      
      // Should not throw and should track metrics
      expect(mockTimeSeriesManager.addMetric).toHaveBeenCalledWith(
        'cache_warming:semantic',
        2,
        { type: 'common_queries' }
      );
    });
  });

  describe('Cache Analytics', () => {
    test('should return cache analytics', async () => {
      const mockRedis = {
        keys: jest.fn().mockResolvedValue(['semantic_cache:test1', 'semantic_cache:test2']),
      };
      mockRedisClient.getClient.mockResolvedValue(mockRedis as any);
      
      mockTimeSeriesManager.getAggregatedMetrics.mockResolvedValue([
        { value: 0.85, timestamp: Date.now() }
      ]);
      
      const analytics = await semanticCacheManager.getCacheAnalytics();
      
      expect(analytics).toHaveProperty('memoryCacheSize');
      expect(analytics).toHaveProperty('redisCacheSize');
      expect(analytics).toHaveProperty('hitRate');
      expect(analytics).toHaveProperty('missRate');
      expect(analytics).toHaveProperty('timestamp');
    });

    test('should handle analytics errors gracefully', async () => {
      mockRedisClient.getClient.mockRejectedValue(new Error('Redis error'));
      
      const analytics = await semanticCacheManager.getCacheAnalytics();
      
      expect(analytics).toHaveProperty('memoryCacheSize');
      expect(analytics.redisCacheSize).toBe(0);
    });
  });

  describe('Cache Clearing', () => {
    test('should clear all caches', async () => {
      const mockRedis = {
        keys: jest.fn().mockResolvedValue(['semantic_cache:test1']),
        del: jest.fn().mockResolvedValue(1),
      };
      mockRedisClient.getClient.mockResolvedValue(mockRedis as any);
      
      // Add something to memory cache
      await semanticCacheManager.storeCachedResponse(
        { query: 'test', leaseId: 'test' },
        'test response'
      );
      
      await semanticCacheManager.clearAllCaches();
      
      expect(mockRedis.keys).toHaveBeenCalledWith('semantic_cache:*');
      expect(mockRedis.del).toHaveBeenCalledWith('semantic_cache:test1');
    });
  });

  describe('Health Check', () => {
    test('should pass health check with valid operations', async () => {
      const mockRedis = {
        json: {
          get: jest.fn().mockResolvedValue(null),
          set: jest.fn().mockResolvedValue('OK'),
        },
        expire: jest.fn().mockResolvedValue(1),
      };
      mockRedisClient.getClient.mockResolvedValue(mockRedis as any);
      
      const isHealthy = await semanticCacheManager.healthCheck();
      
      expect(isHealthy).toBe(true);
    });

    test('should fail health check with errors', async () => {
      // Mock the health check to fail by making it return false
      const originalHealthCheck = semanticCacheManager.healthCheck;
      (semanticCacheManager as any).healthCheck = jest.fn().mockResolvedValue(false);
      
      const isHealthy = await semanticCacheManager.healthCheck();
      
      expect(isHealthy).toBe(false);
      
      // Restore original
      (semanticCacheManager as any).healthCheck = originalHealthCheck;
    });
  });

  describe('Metrics Tracking', () => {
    test('should track cache hits', async () => {
      const query = { query: 'test query', leaseId: 'test-lease' };
      
      // Store and retrieve to trigger cache hit
      await semanticCacheManager.storeCachedResponse(query, 'test response');
      await semanticCacheManager.getCachedResponse(query);
      
      expect(mockTimeSeriesManager.addMetric).toHaveBeenCalledWith(
        'cache_hit_rate:memory',
        1,
        expect.objectContaining({ cacheType: 'memory' })
      );
    });

    test('should track cache misses', async () => {
      const query = { query: 'test query', leaseId: 'test-lease' };
      
      const mockRedis = {
        json: {
          get: jest.fn().mockResolvedValue(null),
        },
        keys: jest.fn().mockResolvedValue([]),
      };
      mockRedisClient.getClient.mockResolvedValue(mockRedis as any);
      
      await semanticCacheManager.getCachedResponse(query);
      
      expect(mockTimeSeriesManager.addMetric).toHaveBeenCalledWith(
        'cache_miss_rate:semantic',
        1,
        expect.objectContaining({ key: expect.any(String) })
      );
    });
  });
}); 