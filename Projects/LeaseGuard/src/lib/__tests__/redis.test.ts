import { getAllViolationPatterns } from '../housing-law-database';

// Mock Redis client for testing
jest.mock('../redis', () => ({
  __esModule: true,
  default: {
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    healthCheck: jest.fn().mockResolvedValue(true),
    getClient: jest.fn().mockReturnValue({
      json: {
        set: jest.fn().mockResolvedValue(undefined),
        get: jest.fn().mockResolvedValue({
          id: 'test-1',
          text: 'Test clause text',
          metadata: { flagged: true, severity: 'High' }
        })
      },
      del: jest.fn().mockResolvedValue(1),
      ft: {
        info: jest.fn().mockResolvedValue({ index_name: 'clause_idx' })
      }
    })
  }
}));

describe('Redis Client (Mocked)', () => {
  test('should have health check method', async () => {
    const redisClient = require('../redis').default;
    const isHealthy = await redisClient.healthCheck();
    expect(isHealthy).toBe(true);
  });

  test('should have client methods', () => {
    const redisClient = require('../redis').default;
    const client = redisClient.getClient();
    expect(client.json.set).toBeDefined();
    expect(client.json.get).toBeDefined();
    expect(client.del).toBeDefined();
  });
});

describe('Housing Law Database', () => {
  test('should contain violation patterns', () => {
    const patterns = getAllViolationPatterns();
    expect(patterns.length).toBeGreaterThan(0);
    expect(patterns[0]).toHaveProperty('id');
    expect(patterns[0]).toHaveProperty('violation_type');
    expect(patterns[0]).toHaveProperty('severity');
    expect(patterns[0]).toHaveProperty('detection_regex');
  });

  test('should have critical violations', () => {
    const patterns = getAllViolationPatterns();
    const criticalViolations = patterns.filter(p => p.severity === 'Critical');
    expect(criticalViolations.length).toBeGreaterThan(0);
  });
}); 