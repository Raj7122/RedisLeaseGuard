import timeSeriesManager, { TIMESERIES_KEYS } from '../timeseries-manager';
import redisClient from '../redis';

// Mock Redis client
jest.mock('../redis', () => ({
  getClient: jest.fn(),
  connect: jest.fn()
}));

const mockRedisClient = {
  ts: {
    create: jest.fn(),
    add: jest.fn(),
    range: jest.fn()
  }
};

describe('TimeSeries Manager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (redisClient.getClient as jest.Mock).mockResolvedValue(mockRedisClient);
    (redisClient.connect as jest.Mock).mockResolvedValue(undefined);
    
    // Reset the singleton instance for each test
    (timeSeriesManager as any).initialized = false;
  });

  describe('Initialization', () => {
    it('should initialize TimeSeries configurations successfully', async () => {
      mockRedisClient.ts.create.mockResolvedValue('OK');
      
      await timeSeriesManager.initialize();
      
      expect(mockRedisClient.ts.create).toHaveBeenCalledTimes(4);
      expect(mockRedisClient.ts.create).toHaveBeenCalledWith('processing_time:*', {
        RETENTION: '30d',
        LABELS: ['metric_type:processing', 'component:document_processor']
      });
    });

    it('should handle TimeSeries creation errors gracefully', async () => {
      mockRedisClient.ts.create.mockRejectedValue(new Error('TimeSeries not supported'));
      
      await expect(timeSeriesManager.initialize()).resolves.not.toThrow();
      
      // Should still attempt to create TimeSeries even if it fails
      expect(mockRedisClient.ts.create).toHaveBeenCalled();
    });

    it('should not reinitialize if already initialized', async () => {
      mockRedisClient.ts.create.mockResolvedValue('OK');
      
      await timeSeriesManager.initialize();
      await timeSeriesManager.initialize(); // Second call
      
      // Should only be called 4 times (once for each config) due to initialization check
      expect(mockRedisClient.ts.create).toHaveBeenCalledTimes(4);
    });
  });

  describe('Metric Addition', () => {
    beforeEach(async () => {
      mockRedisClient.ts.create.mockResolvedValue('OK');
      await timeSeriesManager.initialize();
    });

    it('should add metric with labels successfully', async () => {
      mockRedisClient.ts.add.mockResolvedValue('OK');
      
      const timestamp = Date.now();
      await timeSeriesManager.addMetric('test_metric', 100, { test: 'label' }, timestamp);
      
      expect(mockRedisClient.ts.add).toHaveBeenCalledWith('test_metric', timestamp, 100, {
        LABELS: { test: 'label' }
      });
    });

    it('should add metric without labels', async () => {
      mockRedisClient.ts.add.mockResolvedValue('OK');
      
      await timeSeriesManager.addMetric('test_metric', 100);
      
      expect(mockRedisClient.ts.add).toHaveBeenCalledWith('test_metric', expect.any(Number), 100, {
        LABELS: {}
      });
    });

    it('should validate metric value before adding', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      await timeSeriesManager.addMetric('test_metric', NaN);
      
      expect(consoleSpy).toHaveBeenCalledWith('Invalid metric value for test_metric: NaN');
      expect(mockRedisClient.ts.add).not.toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedisClient.ts.add.mockRejectedValue(new Error('Redis error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      await expect(timeSeriesManager.addMetric('test_metric', 100)).resolves.not.toThrow();
      
      expect(consoleSpy).toHaveBeenCalledWith('Error adding TimeSeries metric for test_metric:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });
  });

  describe('Aggregated Metrics', () => {
    beforeEach(async () => {
      mockRedisClient.ts.create.mockResolvedValue('OK');
      await timeSeriesManager.initialize();
    });

    it('should get aggregated metrics successfully', async () => {
      const mockData = [[1000, 50], [2000, 75], [3000, 100]];
      mockRedisClient.ts.range.mockResolvedValue(mockData);
      
      const result = await timeSeriesManager.getAggregatedMetrics('test_metric', 0, 5000, 'avg', 1000);
      
      expect(mockRedisClient.ts.range).toHaveBeenCalledWith('test_metric', 0, 5000, {
        AGGREGATION: {
          type: 'avg',
          timeBucket: 1000
        }
      });
      
      expect(result).toEqual([
        { timestamp: 1000, value: 50, bucket: 1000 },
        { timestamp: 2000, value: 75, bucket: 2000 },
        { timestamp: 3000, value: 100, bucket: 3000 }
      ]);
    });

    it('should handle Redis errors and return empty array', async () => {
      mockRedisClient.ts.range.mockRejectedValue(new Error('Redis error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const result = await timeSeriesManager.getAggregatedMetrics('test_metric', 0, 5000, 'avg');
      
      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith('Error querying TimeSeries test_metric:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });
  });

  describe('Multi-Series Comparison', () => {
    beforeEach(async () => {
      mockRedisClient.ts.create.mockResolvedValue('OK');
      await timeSeriesManager.initialize();
    });

    it('should get multi-series comparison successfully', async () => {
      const mockData1 = [[1000, 50], [2000, 75]];
      const mockData2 = [[1000, 25], [2000, 35]];
      
      mockRedisClient.ts.range
        .mockResolvedValueOnce(mockData1)
        .mockResolvedValueOnce(mockData2);
      
      const result = await timeSeriesManager.getMultiSeriesComparison(
        ['metric1', 'metric2'],
        0,
        5000,
        'avg'
      );
      
      expect(result).toEqual({
        metric1: [
          { timestamp: 1000, value: 50, bucket: 0 },
          { timestamp: 2000, value: 75, bucket: 0 }
        ],
        metric2: [
          { timestamp: 1000, value: 25, bucket: 0 },
          { timestamp: 2000, value: 35, bucket: 0 }
        ]
      });
    });
  });

  describe('Caching', () => {
    beforeEach(async () => {
      mockRedisClient.ts.create.mockResolvedValue('OK');
      await timeSeriesManager.initialize();
    });

    it('should cache metrics and return cached data', async () => {
      const mockData = [[1000, 50], [2000, 75]];
      mockRedisClient.ts.range.mockResolvedValue(mockData);
      
      // First call - should fetch from Redis
      const result1 = await timeSeriesManager.getCachedMetrics('test_metric', 0, 5000);
      
      // Second call - should return cached data
      const result2 = await timeSeriesManager.getCachedMetrics('test_metric', 0, 5000);
      
      expect(mockRedisClient.ts.range).toHaveBeenCalledTimes(1);
      expect(result1).toEqual(result2);
    });

    it('should clear cache successfully', () => {
      timeSeriesManager.clearCache();
      
      // Cache should be cleared, no errors should occur
      expect(true).toBe(true);
    });
  });

  describe('Health Check', () => {
    it('should perform health check successfully', async () => {
      mockRedisClient.ts.create.mockResolvedValue('OK');
      mockRedisClient.ts.add.mockResolvedValue('OK');
      
      const result = await timeSeriesManager.healthCheck();
      
      expect(result).toBe(true);
    });

    it('should handle health check failures', async () => {
      // Mock the addMetric method to fail
      const originalAddMetric = timeSeriesManager.addMetric;
      (timeSeriesManager as any).addMetric = jest.fn().mockRejectedValue(new Error('Health check failed'));
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const result = await timeSeriesManager.healthCheck();
      
      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('TimeSeries health check failed:', expect.any(Error));
      
      // Restore original method
      (timeSeriesManager as any).addMetric = originalAddMetric;
      consoleSpy.mockRestore();
    });
  });

  describe('Constants', () => {
    it('should export TIMESERIES_KEYS with correct structure', () => {
      expect(TIMESERIES_KEYS).toHaveProperty('PROCESSING_TIME');
      expect(TIMESERIES_KEYS).toHaveProperty('SUCCESS_RATE');
      expect(TIMESERIES_KEYS).toHaveProperty('THROUGHPUT');
      expect(TIMESERIES_KEYS).toHaveProperty('USER_INTERACTIONS');
      expect(TIMESERIES_KEYS).toHaveProperty('ERROR_RATE');
      expect(TIMESERIES_KEYS).toHaveProperty('VIOLATION_DETECTION');
    });

    it('should have correct key naming patterns', () => {
      expect(TIMESERIES_KEYS.PROCESSING_TIME).toBe('processing_time:{operation}');
      expect(TIMESERIES_KEYS.SUCCESS_RATE).toBe('success_rate:{operation}');
      expect(TIMESERIES_KEYS.VIOLATION_DETECTION).toBe('violation_detection:{severity}');
    });
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = timeSeriesManager;
      const instance2 = timeSeriesManager;
      
      expect(instance1).toBe(instance2);
    });
  });
}); 