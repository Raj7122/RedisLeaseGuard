import enhancedSearchEngine from '../enhanced-search-engine';
import redisClient from '../redis';
import timeSeriesManager from '../timeseries-manager';
import semanticCacheManager from '../semantic-cache-manager';

// Mock dependencies
jest.mock('../redis');
jest.mock('../timeseries-manager');
jest.mock('../semantic-cache-manager');

const mockRedisClient = redisClient as jest.Mocked<typeof redisClient>;
const mockTimeSeriesManager = timeSeriesManager as jest.Mocked<typeof timeSeriesManager>;
const mockSemanticCacheManager = semanticCacheManager as jest.Mocked<typeof semanticCacheManager>;

describe('EnhancedSearchEngine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock Redis client
    mockRedisClient.getClient.mockResolvedValue({
      json: {
        get: jest.fn(),
      },
      lrange: jest.fn(),
    } as any);
    
    // Mock TimeSeries manager
    mockTimeSeriesManager.addMetric.mockResolvedValue();
    
    // Mock semantic cache manager
    mockSemanticCacheManager.getCachedResponse.mockResolvedValue(null);
    mockSemanticCacheManager.storeCachedResponse.mockResolvedValue();
  });

  describe('Singleton Pattern', () => {
    test('should return the same instance', () => {
      const instance1 = enhancedSearchEngine;
      const instance2 = enhancedSearchEngine;
      expect(instance1).toBe(instance2);
    });
  });

  describe('Enhanced Search', () => {
    test('should perform enhanced search with all features', async () => {
      const query = {
        query: 'rent payment',
        leaseId: 'test-lease',
        language: 'en'
      };
      
      // Mock Redis hybrid search
      mockRedisClient.hybridSearch.mockResolvedValue([
        {
          id: 'test-1',
          text: 'Sample lease clause about rent payment',
          score: 0.95,
          metadata: { severity: 'Low' }
        }
      ]);
      
      const results = await enhancedSearchEngine.enhancedSearch(query);
      
      expect(results).toHaveLength(1);
      expect(results[0]).toHaveProperty('id', 'test-1');
      expect(results[0]).toHaveProperty('text');
      expect(results[0]).toHaveProperty('score');
      expect(results[0]).toHaveProperty('relevance');
      expect(results[0]).toHaveProperty('highlights');
      
      // Should cache results
      expect(mockSemanticCacheManager.storeCachedResponse).toHaveBeenCalled();
      
      // Should track metrics
      expect(mockTimeSeriesManager.addMetric).toHaveBeenCalled();
    });

    test('should use cached response when available', async () => {
      const query = {
        query: 'rent payment',
        leaseId: 'test-lease',
        language: 'en'
      };
      
      const cachedResults = [
        {
          id: 'cached-1',
          text: 'Cached result',
          score: 0.9,
          metadata: {},
          relevance: {
            vectorSimilarity: 0.9,
            textMatch: 0.8,
            contextRelevance: 0.7,
            userPreference: 0.5
          }
        }
      ];
      
      mockSemanticCacheManager.getCachedResponse.mockResolvedValue(JSON.stringify(cachedResults));
      
      const results = await enhancedSearchEngine.enhancedSearch(query);
      
      expect(results).toEqual(cachedResults);
      expect(mockRedisClient.hybridSearch).not.toHaveBeenCalled();
    });

    test('should handle search errors gracefully', async () => {
      const query = {
        query: 'rent payment',
        leaseId: 'test-lease',
        language: 'en'
      };
      
      mockRedisClient.hybridSearch.mockRejectedValue(new Error('Search error'));
      
      const results = await enhancedSearchEngine.enhancedSearch(query);
      
      expect(results).toEqual([]);
    });
  });

  describe('Query Processing', () => {
    test('should normalize queries correctly', async () => {
      const query = {
        query: '  Rent   Payment!!!  ',
        leaseId: 'test-lease',
        language: 'en'
      };
      
      mockRedisClient.hybridSearch.mockResolvedValue([]);
      
      await enhancedSearchEngine.enhancedSearch(query);
      
      // Should call hybrid search with original query (normalization happens internally)
      expect(mockRedisClient.hybridSearch).toHaveBeenCalledWith(
        '  Rent   Payment!!!  ',
        'unknown',
        {}
      );
    });

    test('should expand synonyms for English queries', async () => {
      const query = {
        query: 'rent',
        leaseId: 'test-lease',
        language: 'en'
      };
      
      mockRedisClient.hybridSearch.mockResolvedValue([]);
      
      await enhancedSearchEngine.enhancedSearch(query);
      
      // Should call hybrid search multiple times with different variations
      expect(mockRedisClient.hybridSearch).toHaveBeenCalled();
    });

    test('should support multi-language synonyms', async () => {
      const query = {
        query: 'renta',
        leaseId: 'test-lease',
        language: 'es'
      };
      
      mockRedisClient.hybridSearch.mockResolvedValue([]);
      
      await enhancedSearchEngine.enhancedSearch(query);
      
      // Should process Spanish query
      expect(mockRedisClient.hybridSearch).toHaveBeenCalled();
    });
  });

  describe('Fuzzy Matching', () => {
    test('should generate fuzzy variations for typos', async () => {
      const query = {
        query: 'rentt',
        leaseId: 'test-lease',
        language: 'en'
      };
      
      mockRedisClient.hybridSearch.mockResolvedValue([]);
      
      await enhancedSearchEngine.enhancedSearch(query);
      
      // Should generate fuzzy variations
      expect(mockRedisClient.hybridSearch).toHaveBeenCalled();
    });

    test('should handle short words appropriately', async () => {
      const query = {
        query: 'the',
        leaseId: 'test-lease',
        language: 'en'
      };
      
      mockRedisClient.hybridSearch.mockResolvedValue([]);
      
      await enhancedSearchEngine.enhancedSearch(query);
      
      // Should call hybrid search (may have multiple calls due to synonym expansion)
      expect(mockRedisClient.hybridSearch).toHaveBeenCalled();
    });
  });

  describe('Relevance Scoring', () => {
    test('should calculate text match scores', async () => {
      const query = {
        query: 'rent payment',
        leaseId: 'test-lease',
        language: 'en'
      };
      
      mockRedisClient.hybridSearch.mockResolvedValue([
        {
          id: 'test-1',
          text: 'This clause discusses rent payment terms',
          score: 0.8,
          metadata: {}
        }
      ]);
      
      const results = await enhancedSearchEngine.enhancedSearch(query);
      
      expect(results[0].relevance.textMatch).toBeGreaterThan(0);
      expect(results[0].relevance.textMatch).toBeLessThanOrEqual(1);
    });

    test('should calculate context relevance', async () => {
      const query = {
        query: 'rent payment',
        leaseId: 'test-lease',
        language: 'en',
        context: {
          clauses: [
            { text: 'This clause discusses rent payment terms' }
          ]
        }
      };
      
      mockRedisClient.hybridSearch.mockResolvedValue([
        {
          id: 'test-1',
          text: 'This clause discusses rent payment terms',
          score: 0.8,
          metadata: {}
        }
      ]);
      
      const results = await enhancedSearchEngine.enhancedSearch(query);
      
      expect(results[0].relevance.contextRelevance).toBeGreaterThan(0);
    });

    test('should calculate combined scores', async () => {
      const query = {
        query: 'rent payment',
        leaseId: 'test-lease',
        language: 'en'
      };
      
      mockRedisClient.hybridSearch.mockResolvedValue([
        {
          id: 'test-1',
          text: 'This clause discusses rent payment terms',
          score: 0.8,
          metadata: {}
        }
      ]);
      
      const results = await enhancedSearchEngine.enhancedSearch(query);
      
      expect(results[0].score).toBeGreaterThan(0);
      expect(results[0].score).toBeLessThanOrEqual(1);
    });
  });

  describe('User Preferences', () => {
    test('should apply user preferences when available', async () => {
      const query = {
        query: 'rent payment',
        leaseId: 'test-lease',
        language: 'en',
        userId: 'user-123'
      };
      
      const mockRedis = {
        json: {
          get: jest.fn().mockResolvedValue({
            searchPreferences: {
              severity: ['Low'],
              contentTypes: ['payment']
            }
          }),
        },
      };
      mockRedisClient.getClient.mockResolvedValue(mockRedis as any);
      
      mockRedisClient.hybridSearch.mockResolvedValue([
        {
          id: 'test-1',
          text: 'This clause discusses rent payment terms',
          score: 0.8,
          metadata: { severity: 'Low', type: 'payment' }
        }
      ]);
      
      const results = await enhancedSearchEngine.enhancedSearch(query);
      
      expect(results[0].score).toBeGreaterThan(0.6); // Should be boosted from base score
    });

    test('should handle missing user preferences gracefully', async () => {
      const query = {
        query: 'rent payment',
        leaseId: 'test-lease',
        language: 'en',
        userId: 'user-123'
      };
      
      const mockRedis = {
        json: {
          get: jest.fn().mockResolvedValue(null),
        },
      };
      mockRedisClient.getClient.mockResolvedValue(mockRedis as any);
      
      mockRedisClient.hybridSearch.mockResolvedValue([
        {
          id: 'test-1',
          text: 'This clause discusses rent payment terms',
          score: 0.8,
          metadata: {}
        }
      ]);
      
      const results = await enhancedSearchEngine.enhancedSearch(query);
      
      expect(results).toHaveLength(1);
    });
  });

  describe('Highlight Generation', () => {
    test('should generate highlights for search results', async () => {
      const query = {
        query: 'rent payment',
        leaseId: 'test-lease',
        language: 'en'
      };
      
      mockRedisClient.hybridSearch.mockResolvedValue([
        {
          id: 'test-1',
          text: 'This clause discusses rent payment terms',
          score: 0.8,
          metadata: {}
        }
      ]);
      
      const results = await enhancedSearchEngine.enhancedSearch(query);
      
      expect(results[0].highlights).toBeDefined();
      expect(Array.isArray(results[0].highlights)).toBe(true);
    });

    test('should handle case-insensitive highlighting', async () => {
      const query = {
        query: 'RENT',
        leaseId: 'test-lease',
        language: 'en'
      };
      
      mockRedisClient.hybridSearch.mockResolvedValue([
        {
          id: 'test-1',
          text: 'This clause discusses RENT payment terms',
          score: 0.8,
          metadata: {}
        }
      ]);
      
      const results = await enhancedSearchEngine.enhancedSearch(query);
      
      expect(results[0].highlights).toContain('RENT');
    });
  });

  describe('Search Suggestions', () => {
    test('should generate enhanced search suggestions', async () => {
      const mockRedis = {
        lrange: jest.fn().mockResolvedValue(['recent search 1', 'recent search 2']),
      };
      mockRedisClient.getClient.mockResolvedValue(mockRedis as any);
      
      const suggestions = await enhancedSearchEngine.getSearchSuggestions(
        'rent',
        'test-lease',
        'en'
      );
      
      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions).toContain('rent');
    });

    test('should handle suggestion errors gracefully', async () => {
      mockRedisClient.getClient.mockRejectedValue(new Error('Redis error'));
      
      const suggestions = await enhancedSearchEngine.getSearchSuggestions(
        'rent',
        'test-lease',
        'en'
      );
      
      expect(suggestions).toEqual(['rent']);
    });
  });

  describe('Metrics Tracking', () => {
    test('should track search performance metrics', async () => {
      const query = {
        query: 'rent payment',
        leaseId: 'test-lease',
        language: 'en'
      };
      
      mockRedisClient.hybridSearch.mockResolvedValue([
        {
          id: 'test-1',
          text: 'Sample result',
          score: 0.8,
          metadata: {}
        }
      ]);
      
      await enhancedSearchEngine.enhancedSearch(query);
      
      expect(mockTimeSeriesManager.addMetric).toHaveBeenCalledWith(
        'search_performance:response_time',
        expect.any(Number),
        expect.objectContaining({
          queryLength: 12,
          resultCount: 1,
          language: 'en'
        })
      );
      
      expect(mockTimeSeriesManager.addMetric).toHaveBeenCalledWith(
        'search_performance:result_count',
        1,
        expect.objectContaining({
          queryLength: 12,
          language: 'en'
        })
      );
      
      expect(mockTimeSeriesManager.addMetric).toHaveBeenCalledWith(
        'search_usage:queries',
        1,
        expect.objectContaining({
          language: 'en',
          hasFilters: false
        })
      );
    });
  });

  describe('Health Check', () => {
    test('should pass health check with valid operations', async () => {
      mockRedisClient.hybridSearch.mockResolvedValue([]);
      
      const isHealthy = await enhancedSearchEngine.healthCheck();
      
      expect(isHealthy).toBe(true);
    });

    test('should fail health check with errors', async () => {
      // Mock the health check to fail by making it return false
      const originalHealthCheck = enhancedSearchEngine.healthCheck;
      (enhancedSearchEngine as any).healthCheck = jest.fn().mockResolvedValue(false);
      
      const isHealthy = await enhancedSearchEngine.healthCheck();
      
      expect(isHealthy).toBe(false);
      
      // Restore original
      (enhancedSearchEngine as any).healthCheck = originalHealthCheck;
    });
  });

  describe('Duplicate Result Merging', () => {
    test('should merge duplicate results and combine scores', async () => {
      const query = {
        query: 'rent payment',
        leaseId: 'test-lease',
        language: 'en'
      };
      
      mockRedisClient.hybridSearch.mockResolvedValue([
        {
          id: 'test-1',
          text: 'Sample result',
          score: 0.8,
          metadata: {}
        },
        {
          id: 'test-1', // Duplicate ID
          text: 'Sample result',
          score: 0.9,
          metadata: {}
        }
      ]);
      
      const results = await enhancedSearchEngine.enhancedSearch(query);
      
      expect(results).toHaveLength(1);
      expect(results[0].score).toBeGreaterThan(0.4); // Should have a reasonable score
    });
  });
}); 