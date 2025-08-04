import redisClient from '../redis';

describe('Phase 1: Redis Streams Integration', () => {
  beforeEach(async () => {
    // Clear any existing connections
    await redisClient.disconnect();
  });

  afterEach(async () => {
    // Clean up
    await redisClient.disconnect();
  });

  describe('Redis Streams Basic Functionality', () => {
    test('should connect to Redis and use mock client in test environment', async () => {
      const client = await redisClient.getClient();
      expect(client).toBeDefined();
      
      // Test basic Redis operations
      const pingResult = await client.ping();
      expect(pingResult).toBe('PONG');
    });

    test('should publish events to streams', async () => {
      const client = await redisClient.getClient();
      
      // Publish a test event
      const eventId = await client.xadd('test_stream', '*', 
        'eventType', 'test_event',
        'data', JSON.stringify({ message: 'Test event' }),
        'timestamp', new Date().toISOString()
      );
      
      expect(eventId).toBeDefined();
      expect(typeof eventId).toBe('string');
    });

    test('should retrieve events from streams', async () => {
      const client = await redisClient.getClient();
      
      // First publish an event
      await client.xadd('test_stream', '*', 
        'eventType', 'test_event',
        'data', JSON.stringify({ message: 'Test event' }),
        'timestamp', new Date().toISOString()
      );
      
      // Then retrieve events
      const events = await client.xrange('test_stream', '0', '+');
      expect(Array.isArray(events)).toBe(true);
      expect(events.length).toBeGreaterThan(0);
    });

    test('should publish notifications via Pub/Sub', async () => {
      const client = await redisClient.getClient();
      
      // Publish a notification
      const subscribers = await client.publish('test_channel', JSON.stringify({
        message: 'Test notification',
        timestamp: new Date().toISOString()
      }));
      
      expect(subscribers).toBe(1); // Mock client returns 1
    });
  });

  describe('Redis Client Stream Methods', () => {
    test('should get event stream using helper method', async () => {
      const client = await redisClient.getClient();
      
      // Publish some test events
      await client.xadd('lease_processing_stream', '*', 
        'leaseId', 'test-lease-1',
        'eventType', 'document_uploaded',
        'data', JSON.stringify({ fileName: 'test.pdf' }),
        'sessionId', 'test-session-1',
        'timestamp', new Date().toISOString()
      );
      
      await client.xadd('lease_processing_stream', '*', 
        'leaseId', 'test-lease-1',
        'eventType', 'text_extraction_complete',
        'data', JSON.stringify({ textLength: 1000 }),
        'sessionId', 'test-session-1',
        'timestamp', new Date().toISOString()
      );
      
      // Get events using the helper method
      const events = await redisClient.getEventStream('lease_processing_stream');
      
      expect(Array.isArray(events)).toBe(true);
      expect(events.length).toBeGreaterThan(0);
      
      // Check event structure
      events.forEach(event => {
        expect(event).toHaveProperty('id');
        expect(event).toHaveProperty('type');
        expect(event).toHaveProperty('data');
        expect(event).toHaveProperty('timestamp');
      });
    });

    test('should subscribe to processing events', async () => {
      const callback = jest.fn();
      
      const subscriber = await redisClient.subscribeToProcessingEvents(callback);
      
      expect(subscriber).toBeDefined();
      expect(typeof subscriber.unsubscribe).toBe('function');
      
      // Clean up
      await subscriber.unsubscribe();
    });

    test('should subscribe to violation alerts', async () => {
      const callback = jest.fn();
      
      const subscriber = await redisClient.subscribeToViolationAlerts(callback);
      
      expect(subscriber).toBeDefined();
      expect(typeof subscriber.unsubscribe).toBe('function');
      
      // Clean up
      await subscriber.unsubscribe();
    });
  });

  describe('Event Data Structure', () => {
    test('should handle complex event data', async () => {
      const client = await redisClient.getClient();
      
      const complexData = {
        leaseId: 'test-lease-123',
        eventType: 'analysis_complete',
        data: {
          summary: {
            totalClauses: 10,
            flaggedClauses: 3,
            criticalViolations: 1,
            highViolations: 2
          },
          processingTime: 5000,
          userId: 'user-123'
        },
        sessionId: 'session-456',
        timestamp: new Date().toISOString()
      };
      
      // Publish complex event
      const eventId = await client.xadd('lease_processing_stream', '*', 
        'leaseId', complexData.leaseId,
        'eventType', complexData.eventType,
        'data', JSON.stringify(complexData.data),
        'sessionId', complexData.sessionId,
        'timestamp', complexData.timestamp
      );
      
      expect(eventId).toBeDefined();
      
      // Retrieve and verify
      const events = await redisClient.getEventStream('lease_processing_stream');
      const event = events.find(e => e.id === eventId);
      
      expect(event).toBeDefined();
      expect(event?.type).toBe('analysis_complete');
      expect(event?.data).toHaveProperty('summary');
      expect(event?.data.summary.totalClauses).toBe(10);
    });
  });

  describe('Error Handling', () => {
    test('should handle empty streams gracefully', async () => {
      const events = await redisClient.getEventStream('non_existent_stream');
      expect(Array.isArray(events)).toBe(true);
      expect(events.length).toBe(0);
    });

    test('should handle malformed event data gracefully', async () => {
      const client = await redisClient.getClient();
      
      // Publish event with malformed data
      await client.xadd('test_stream', '*', 
        'eventType', 'test_event',
        'data', 'invalid json',
        'timestamp', new Date().toISOString()
      );
      
      // Should not throw when retrieving
      const events = await redisClient.getEventStream('test_stream');
      expect(Array.isArray(events)).toBe(true);
    });
  });

  describe('Performance', () => {
    test('should handle multiple events efficiently', async () => {
      const client = await redisClient.getClient();
      const startTime = Date.now();
      
      // Publish 10 events
      for (let i = 0; i < 10; i++) {
        await client.xadd('performance_test_stream', '*', 
          'eventType', 'test_event',
          'data', JSON.stringify({ index: i, message: `Event ${i}` }),
          'timestamp', new Date().toISOString()
        );
      }
      
      const publishTime = Date.now() - startTime;
      expect(publishTime).toBeLessThan(1000); // Should be very fast
      
      // Retrieve all events
      const retrieveStartTime = Date.now();
      const events = await redisClient.getEventStream('performance_test_stream');
      const retrieveTime = Date.now() - retrieveStartTime;
      
      expect(events.length).toBe(10);
      expect(retrieveTime).toBeLessThan(1000); // Should be very fast
    });
  });
}); 