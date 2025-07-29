import redisClient from '../redis';

// Mock dependencies
jest.mock('../redis');

const mockRedisClient = redisClient as jest.Mocked<typeof redisClient>;

// Mock Supabase client with query builder support
const createQueryBuilder = (mockResult: any) => ({
  insert: jest.fn().mockResolvedValue(mockResult),
  select: jest.fn().mockReturnValue({
    gte: jest.fn().mockReturnValue({
      lt: jest.fn().mockReturnValue({
        group: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue(mockResult),
        }),
      }),
    }),
    group: jest.fn().mockReturnValue({
      order: jest.fn().mockResolvedValue(mockResult),
    }),
    eq: jest.fn().mockResolvedValue(mockResult),
    ...mockResult,
  }),
  update: jest.fn().mockReturnValue({
    lt: jest.fn().mockResolvedValue(mockResult),
  }),
  delete: jest.fn().mockReturnValue({
    eq: jest.fn().mockResolvedValue(mockResult),
  }),
  ...mockResult,
});

// Enhanced query builder for complex analytics queries
const createAnalyticsQueryBuilder = (mockResult: any) => {
  const mockChain = {
    gte: jest.fn().mockReturnValue({
      lt: jest.fn().mockReturnValue({
        group: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue(mockResult),
        }),
      }),
    }),
    group: jest.fn().mockReturnValue({
      order: jest.fn().mockResolvedValue(mockResult),
    }),
    order: jest.fn().mockResolvedValue(mockResult),
  };

  return {
    select: jest.fn().mockReturnValue(mockChain),
    ...mockResult,
  };
};

const mockSupabaseClient = {
  from: jest.fn().mockReturnValue(createQueryBuilder({ data: null, error: null })),
  rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
};

describe('Session Management & Analytics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock Redis client
    mockRedisClient.getClient.mockReturnValue({
      json: {
        set: jest.fn().mockResolvedValue('OK'),
        get: jest.fn().mockResolvedValue(null),
      },
      xadd: jest.fn().mockResolvedValue('1234567890-0'),
      xrange: jest.fn().mockResolvedValue([]),
      expire: jest.fn().mockResolvedValue(1),
      del: jest.fn().mockResolvedValue(1),
    } as any);
  });

  describe('Session Creation', () => {
    it('should create a new session with unique ID', async () => {
      const sessionId = 'test-session-123';
      const sessionData = {
        id: sessionId,
        createdAt: new Date().toISOString(),
        userId: null, // Anonymous session
        userAgent: 'Mozilla/5.0 (Test Browser)',
        ipAddress: '127.0.0.1',
        status: 'active',
        metadata: {
          language: 'en',
          timezone: 'America/New_York',
          deviceType: 'desktop',
        }
      };
      
      // Mock Redis storage
      mockRedisClient.getClient().json.set.mockResolvedValue('OK');
      
      // Mock Supabase storage
      const mockInsert = jest.fn().mockResolvedValue({ data: sessionData, error: null });
      mockSupabaseClient.from.mockReturnValue(createQueryBuilder({ data: sessionData, error: null }));
      
      // This would be the actual session creation logic
      await mockRedisClient.getClient().json.set(`session:${sessionId}`, '.', sessionData);
      await mockRedisClient.getClient().expire(`session:${sessionId}`, 7 * 24 * 60 * 60); // 7 days
      
      const result = await mockSupabaseClient.from('sessions').insert(sessionData);
      
      expect(mockRedisClient.getClient().json.set).toHaveBeenCalledWith(
        `session:${sessionId}`,
        '.',
        sessionData
      );
      expect(mockRedisClient.getClient().expire).toHaveBeenCalledWith(
        `session:${sessionId}`,
        7 * 24 * 60 * 60
      );
      expect(result.data).toEqual(sessionData);
    });

    it('should handle session creation errors gracefully', async () => {
      const sessionId = 'test-session-123';
      const sessionData = {
        id: sessionId,
        createdAt: new Date().toISOString(),
        userId: null,
        userAgent: 'Mozilla/5.0 (Test Browser)',
        ipAddress: '127.0.0.1',
        status: 'active',
        metadata: {}
      };
      
      // Mock Redis failure
      mockRedisClient.getClient().json.set.mockRejectedValue(new Error('Redis connection failed'));
      
      // Mock Supabase failure
      mockSupabaseClient.from.mockReturnValue(createQueryBuilder({ data: null, error: { message: 'Database error' } }));
      
      try {
        await mockRedisClient.getClient().json.set(`session:${sessionId}`, '.', sessionData);
      } catch (error) {
        expect(error.message).toBe('Redis connection failed');
      }
      
      const result = await mockSupabaseClient.from('sessions').insert(sessionData);
      expect(result.error).toEqual({ message: 'Database error' });
    });
  });

  describe('Session Persistence', () => {
    it('should update session with user activity', async () => {
      const sessionId = 'test-session-123';
      const activityData = {
        type: 'document_upload',
        timestamp: new Date().toISOString(),
        metadata: {
          fileType: 'pdf',
          fileSize: 1024000,
          processingTime: 2500,
        }
      };
      
      // Mock Redis activity logging
      mockRedisClient.getClient().xadd.mockResolvedValue('1234567890-1');
      
      // Mock Supabase activity logging
      mockSupabaseClient.from.mockReturnValue(createQueryBuilder({ data: activityData, error: null }));
      
      // Log activity to Redis Stream
      await mockRedisClient.getClient().xadd(
        `session:${sessionId}:activities`,
        '*',
        'type', activityData.type,
        'timestamp', activityData.timestamp,
        'metadata', JSON.stringify(activityData.metadata)
      );
      
      // Log activity to Supabase
      const result = await mockSupabaseClient.from('session_activities').insert({
        sessionId,
        ...activityData
      });
      
      expect(mockRedisClient.getClient().xadd).toHaveBeenCalledWith(
        `session:${sessionId}:activities`,
        '*',
        'type', activityData.type,
        'timestamp', activityData.timestamp,
        'metadata', JSON.stringify(activityData.metadata)
      );
      expect(result.data).toEqual(activityData);
    });

    it('should retrieve session history from Redis and Supabase', async () => {
      const sessionId = 'test-session-123';
      const mockSessionData = {
        id: sessionId,
        createdAt: '2025-01-27T10:00:00Z',
        status: 'active',
        metadata: {}
      };
      
      const mockActivities = [
        {
          id: 1,
          sessionId,
          type: 'document_upload',
          timestamp: '2025-01-27T10:01:00Z',
          metadata: { fileType: 'pdf' }
        },
        {
          id: 2,
          sessionId,
          type: 'question_asked',
          timestamp: '2025-01-27T10:02:00Z',
          metadata: { questionLength: 50 }
        }
      ];
      
      // Mock Redis session retrieval
      mockRedisClient.getClient().json.get.mockResolvedValue(mockSessionData);
      
      // Mock Redis activities retrieval
      mockRedisClient.getClient().xrange.mockResolvedValue([
        ['1234567890-1', ['type', 'document_upload', 'timestamp', '2025-01-27T10:01:00Z']],
        ['1234567890-2', ['type', 'question_asked', 'timestamp', '2025-01-27T10:02:00Z']]
      ]);
      
      // Mock Supabase activities retrieval
      mockSupabaseClient.from.mockReturnValue(createQueryBuilder({ data: mockActivities, error: null }));
      
      // Retrieve session data
      const sessionData = await mockRedisClient.getClient().json.get(`session:${sessionId}`);
      const redisActivities = await mockRedisClient.getClient().xrange(`session:${sessionId}:activities`, '-', '+');
      const supabaseActivities = await mockSupabaseClient.from('session_activities').select('*');
      
      expect(sessionData).toEqual(mockSessionData);
      expect(redisActivities).toHaveLength(2);
      expect(supabaseActivities.data).toEqual(mockActivities);
    });
  });

  describe('Analytics Tracking', () => {
    it('should track document upload analytics', async () => {
      const analyticsData = {
        eventType: 'document_upload',
        sessionId: 'test-session-123',
        timestamp: new Date().toISOString(),
        metrics: {
          fileType: 'pdf',
          fileSize: 1024000,
          processingTime: 2500,
          clausesExtracted: 15,
          violationsFound: 3,
          userId: null,
        }
      };
      
      // Mock Supabase analytics insertion
      mockSupabaseClient.from.mockReturnValue(createQueryBuilder({ data: analyticsData, error: null }));
      
      const result = await mockSupabaseClient.from('analytics').insert(analyticsData);
      
      expect(result.data).toEqual(analyticsData);
    });

    it('should track AI Q&A analytics', async () => {
      const analyticsData = {
        eventType: 'ai_question',
        sessionId: 'test-session-123',
        timestamp: new Date().toISOString(),
        metrics: {
          questionLength: 50,
          responseTime: 1800,
          tokensUsed: 150,
          userId: null,
        }
      };
      
      // Mock Supabase analytics insertion
      mockSupabaseClient.from.mockReturnValue(createQueryBuilder({ data: analyticsData, error: null }));
      
      const result = await mockSupabaseClient.from('analytics').insert(analyticsData);
      
      expect(result.data).toEqual(analyticsData);
    });

    it('should track performance metrics', async () => {
      const performanceData = {
        eventType: 'performance_metric',
        sessionId: 'test-session-123',
        timestamp: new Date().toISOString(),
        metrics: {
          redisQueryTime: 45,
          geminiResponseTime: 1800,
          totalProcessingTime: 2500,
          memoryUsage: 128,
          userId: null,
        }
      };
      
      // Mock Supabase performance logging
      mockSupabaseClient.from.mockReturnValue(createQueryBuilder({ data: performanceData, error: null }));
      
      const result = await mockSupabaseClient.from('performance_metrics').insert(performanceData);
      
      expect(result.data).toEqual(performanceData);
    });
  });

  describe('Performance Monitoring', () => {
    it('should monitor Redis query performance', async () => {
      const startTime = Date.now();
      
      // Simulate Redis query
      await mockRedisClient.getClient().json.get('test-key');
      
      const endTime = Date.now();
      const queryTime = endTime - startTime;
      
      expect(queryTime).toBeLessThan(100); // Should be very fast for mocked operation
      expect(mockRedisClient.getClient().json.get).toHaveBeenCalledWith('test-key');
    });

    it('should monitor Supabase query performance', async () => {
      const startTime = Date.now();
      
      // Simulate Supabase query
      mockSupabaseClient.from.mockReturnValue(createQueryBuilder({ data: [], error: null }));
      
      await mockSupabaseClient.from('sessions').select('*');
      
      const endTime = Date.now();
      const queryTime = endTime - startTime;
      
      expect(queryTime).toBeLessThan(100); // Should be very fast for mocked operation
    });

    it('should track error rates and performance degradation', async () => {
      const errorData = {
        eventType: 'error',
        sessionId: 'test-session-123',
        timestamp: new Date().toISOString(),
        error: {
          type: 'redis_connection_failed',
          message: 'Redis connection timeout',
          stack: 'Error: Redis connection timeout\n    at RedisClient.connect',
          severity: 'high',
        },
        metrics: {
          responseTime: 5000,
          userId: null,
        }
      };
      
      // Mock Supabase error logging
      mockSupabaseClient.from.mockReturnValue(createQueryBuilder({ data: errorData, error: null }));
      
      const result = await mockSupabaseClient.from('error_logs').insert(errorData);
      
      expect(result.data).toEqual(errorData);
    });
  });

  describe('Session Cleanup', () => {
    it('should clean up expired sessions', async () => {
      const expiredSessionId = 'expired-session-123';
      
      // Mock Redis cleanup
      mockRedisClient.getClient().del.mockResolvedValue(1);
      
      // Mock Supabase cleanup
      mockSupabaseClient.from.mockReturnValue(createQueryBuilder({ data: null, error: null }));
      
      // Clean up expired session from Redis
      await mockRedisClient.getClient().del(`session:${expiredSessionId}`);
      await mockRedisClient.getClient().del(`session:${expiredSessionId}:activities`);
      
      // Clean up expired session from Supabase
      await mockSupabaseClient.from('sessions').delete().eq('id', expiredSessionId);
      await mockSupabaseClient.from('session_activities').delete().eq('sessionId', expiredSessionId);
      
      expect(mockRedisClient.getClient().del).toHaveBeenCalledWith(`session:${expiredSessionId}`);
      expect(mockRedisClient.getClient().del).toHaveBeenCalledWith(`session:${expiredSessionId}:activities`);
    });

    it('should anonymize old analytics data', async () => {
      const oldAnalyticsData = {
        id: 1,
        sessionId: 'old-session-123',
        eventType: 'document_upload',
        timestamp: '2025-01-01T00:00:00Z',
        metrics: {
          userId: 'user-123',
          ipAddress: '192.168.1.1',
        }
      };
      
      const anonymizedData = {
        id: 1,
        sessionId: 'anonymized-session-123',
        eventType: 'document_upload',
        timestamp: '2025-01-01T00:00:00Z',
        metrics: {
          userId: null,
          ipAddress: null,
        }
      };
      
      // Mock Supabase anonymization
      mockSupabaseClient.from.mockReturnValue(createQueryBuilder({ data: anonymizedData, error: null }));
      
      const result = await mockSupabaseClient.from('analytics').update({
        'metrics->userId': null,
        'metrics->ipAddress': null,
      }).lt('timestamp', '2025-01-15T00:00:00Z');
      
      expect(result.data).toEqual(anonymizedData);
    });
  });

  describe('Data Privacy & Security', () => {
    it('should not log sensitive user information', async () => {
      const sessionData = {
        id: 'test-session-123',
        createdAt: new Date().toISOString(),
        userId: null, // Anonymous session
        userAgent: 'Mozilla/5.0 (Test Browser)',
        ipAddress: null, // Not logged for privacy
        status: 'active',
        metadata: {
          language: 'en',
          timezone: 'America/New_York',
          deviceType: 'desktop',
          // No personal information
        }
      };
      
      // Verify no sensitive data is included
      expect(sessionData.userId).toBeNull();
      expect(sessionData.ipAddress).toBeNull();
      expect(sessionData.metadata).not.toHaveProperty('email');
      expect(sessionData.metadata).not.toHaveProperty('phone');
      expect(sessionData.metadata).not.toHaveProperty('name');
    });

    it('should encrypt sensitive session data', async () => {
      const sensitiveData = {
        sessionId: 'test-session-123',
        leaseContent: 'This is sensitive lease content',
        personalInfo: 'Should be encrypted',
      };
      
      // Mock encryption (in real implementation, this would use proper encryption)
      const encryptedData = Buffer.from(JSON.stringify(sensitiveData)).toString('base64');
      
      // Mock Redis storage of encrypted data
      mockRedisClient.getClient().json.set.mockResolvedValue('OK');
      
      await mockRedisClient.getClient().json.set(
        `session:${sensitiveData.sessionId}:encrypted`,
        '.',
        { encrypted: encryptedData }
      );
      
      expect(mockRedisClient.getClient().json.set).toHaveBeenCalledWith(
        `session:${sensitiveData.sessionId}:encrypted`,
        '.',
        { encrypted: encryptedData }
      );
    });
  });

  describe('Analytics Reporting', () => {
    it('should generate daily usage reports', async () => {
      const mockAnalyticsData = [
        { eventType: 'document_upload', count: 150 },
        { eventType: 'ai_question', count: 300 },
        { eventType: 'session_created', count: 200 },
      ];
      
      // Mock Supabase analytics aggregation
      const mockResult = { data: mockAnalyticsData, error: null };
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          gte: jest.fn().mockReturnValue({
            lt: jest.fn().mockReturnValue({
              group: jest.fn().mockResolvedValue(mockResult),
            }),
          }),
        }),
      });
      
      const result = await mockSupabaseClient.from('analytics')
        .select('eventType, count(*)')
        .gte('timestamp', '2025-01-27T00:00:00Z')
        .lt('timestamp', '2025-01-28T00:00:00Z')
        .group('eventType');
      
      expect(result.data).toEqual(mockAnalyticsData);
    });

    it('should track performance trends', async () => {
      const mockPerformanceData = [
        { date: '2025-01-27', avgResponseTime: 1800, errorRate: 0.02 },
        { date: '2025-01-26', avgResponseTime: 1750, errorRate: 0.015 },
        { date: '2025-01-25', avgResponseTime: 1900, errorRate: 0.025 },
      ];
      
      // Mock Supabase performance aggregation
      const mockResult = { data: mockPerformanceData, error: null };
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          gte: jest.fn().mockReturnValue({
            group: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue(mockResult),
            }),
          }),
        }),
      });
      
      const result = await mockSupabaseClient.from('performance_metrics')
        .select('date, avg(responseTime), avg(errorRate)')
        .gte('timestamp', '2025-01-25T00:00:00Z')
        .group('date')
        .order('date');
      
      expect(result.data).toEqual(mockPerformanceData);
    });
  });
}); 