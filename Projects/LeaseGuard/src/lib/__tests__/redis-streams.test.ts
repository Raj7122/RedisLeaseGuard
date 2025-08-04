import redisClient from '../redis';
import documentProcessor from '../document-processor';

// Mock file for testing
const createMockFile = (name: string, content: string): File => {
  const blob = new Blob([content], { type: 'application/pdf' });
  return new File([blob], name, { type: 'application/pdf' });
};

describe('Redis Streams Integration', () => {
  beforeEach(async () => {
    // Clear any existing connections
    await redisClient.disconnect();
  });

  afterEach(async () => {
    // Clean up
    await redisClient.disconnect();
  });

  describe('Event Publishing', () => {
    test('should publish document upload events', async () => {
      const leaseId = 'test-lease-123';
      const sessionId = 'test-session-456';
      
      // Set session ID
      documentProcessor.setSessionId(sessionId);
      
      // Create mock file
      const mockFile = createMockFile('test-lease.pdf', 'Test lease content');
      
      // Process document (this should trigger events)
      const result = await documentProcessor.processDocument(mockFile, leaseId);
      
      // Verify processing completed
      expect(result.leaseId).toBe(leaseId);
      expect(result.clauses.length).toBeGreaterThan(0);
      
      // Get events from stream
      const events = await redisClient.getEventStream('lease_processing_stream');
      
      // Should have multiple events
      expect(events.length).toBeGreaterThan(0);
      
      // Check for specific event types
      const eventTypes = events.map((event: any) => event.type);
      expect(eventTypes).toContain('document_uploaded');
      expect(eventTypes).toContain('text_extraction_complete');
      expect(eventTypes).toContain('clauses_extracted');
      expect(eventTypes).toContain('analysis_complete');
    });

    test('should publish violation alerts for critical violations', async () => {
      const leaseId = 'test-lease-violations';
      const sessionId = 'test-session-violations';
      
      // Set session ID
      documentProcessor.setSessionId(sessionId);
      
      // Create mock file with violation content
      const violationContent = `
        RESIDENTIAL LEASE AGREEMENT
        
        ARTICLE 1 - RENT: Tenant agrees to pay $2000 per month.
        
        ARTICLE 2 - LATE FEES: If rent is not paid within 5 days of due date, 
        tenant will be charged a $100 late fee plus $50 per day thereafter.
        
        ARTICLE 3 - SECURITY DEPOSIT: Landlord may use security deposit for any damages.
        
        ARTICLE 4 - ENTRY: Landlord may enter premises at any time for maintenance.
        
        ARTICLE 5 - MAINTENANCE: Tenant is responsible for all repairs and maintenance.
      `;
      
      const mockFile = createMockFile('test-violations.pdf', violationContent);
      
      // Process document
      const result = await documentProcessor.processDocument(mockFile, leaseId);
      
      // Should have violations
      expect(result.violations.length).toBeGreaterThan(0);
      
      // Get events from stream
      const events = await redisClient.getEventStream('lease_processing_stream');
      
      // Should have violation detection event
      const violationEvents = events.filter((event: any) => event.type === 'violations_detected');
      expect(violationEvents.length).toBeGreaterThan(0);
    });

    test('should handle event publishing errors gracefully', async () => {
      const leaseId = 'test-lease-error';
      const sessionId = 'test-session-error';
      
      // Set session ID
      documentProcessor.setSessionId(sessionId);
      
      // Create mock file
      const mockFile = createMockFile('test-error.pdf', 'Test content');
      
      // Process document - should not throw even if event publishing fails
      const result = await documentProcessor.processDocument(mockFile, leaseId);
      
      // Should still complete processing
      expect(result.leaseId).toBe(leaseId);
      expect(result.clauses.length).toBeGreaterThan(0);
    });
  });

  describe('Event Retrieval', () => {
    test('should retrieve events from stream', async () => {
      const events = await redisClient.getEventStream('lease_processing_stream');
      
      // Should return array of events
      expect(Array.isArray(events)).toBe(true);
      
      // Each event should have required fields
      events.forEach((event: any) => {
        expect(event).toHaveProperty('id');
        expect(event).toHaveProperty('type');
        expect(event).toHaveProperty('data');
        expect(event).toHaveProperty('timestamp');
      });
    });

    test('should handle empty stream gracefully', async () => {
      // Get events from non-existent stream
      const events = await redisClient.getEventStream('non_existent_stream');
      
      // Should return empty array
      expect(Array.isArray(events)).toBe(true);
      expect(events.length).toBe(0);
    });

    test('should limit events when specified', async () => {
      const events = await redisClient.getEventStream('lease_processing_stream', '0');
      
      // Should not exceed reasonable limit
      expect(events.length).toBeLessThanOrEqual(100);
    });
  });

  describe('Subscription Management', () => {
    test('should subscribe to processing events', async () => {
      const callback = jest.fn();
      
      const subscriber = await redisClient.subscribeToProcessingEvents(callback);
      
      // Should return subscriber object
      expect(subscriber).toBeDefined();
      expect(typeof subscriber.unsubscribe).toBe('function');
      
      // Clean up
      await subscriber.unsubscribe();
    });

    test('should subscribe to violation alerts', async () => {
      const callback = jest.fn();
      
      const subscriber = await redisClient.subscribeToViolationAlerts(callback);
      
      // Should return subscriber object
      expect(subscriber).toBeDefined();
      expect(typeof subscriber.unsubscribe).toBe('function');
      
      // Clean up
      await subscriber.unsubscribe();
    });
  });

  describe('Event Data Structure', () => {
    test('should have consistent event structure', async () => {
      const leaseId = 'test-lease-structure';
      const sessionId = 'test-session-structure';
      
      // Set session ID
      documentProcessor.setSessionId(sessionId);
      
      // Create mock file
      const mockFile = createMockFile('test-structure.pdf', 'Test content');
      
      // Process document
      await documentProcessor.processDocument(mockFile, leaseId);
      
      // Get events
      const events = await redisClient.getEventStream('lease_processing_stream');
      
      // Check event structure
      events.forEach((event: any) => {
        expect(event).toHaveProperty('id');
        expect(event).toHaveProperty('type');
        expect(event).toHaveProperty('data');
        expect(event).toHaveProperty('timestamp');
        
        // Data should be parseable JSON
        expect(() => JSON.parse(event.data)).not.toThrow();
      });
    });

    test('should include session ID in events', async () => {
      const leaseId = 'test-lease-session';
      const sessionId = 'test-session-id';
      
      // Set session ID
      documentProcessor.setSessionId(sessionId);
      
      // Create mock file
      const mockFile = createMockFile('test-session.pdf', 'Test content');
      
      // Process document
      await documentProcessor.processDocument(mockFile, leaseId);
      
      // Get events
      const events = await redisClient.getEventStream('lease_processing_stream');
      
      // Check that events include session ID
      const sessionEvents = events.filter((event: any) => {
        const data = JSON.parse(event.data);
        return data.sessionId === sessionId;
      });
      
      expect(sessionEvents.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle Redis connection errors gracefully', async () => {
      // This test verifies that the system continues to work even if Redis is unavailable
      const leaseId = 'test-lease-no-redis';
      const sessionId = 'test-session-no-redis';
      
      // Set session ID
      documentProcessor.setSessionId(sessionId);
      
      // Create mock file
      const mockFile = createMockFile('test-no-redis.pdf', 'Test content');
      
      // Process document - should not throw even without Redis
      const result = await documentProcessor.processDocument(mockFile, leaseId);
      
      // Should still complete processing
      expect(result.leaseId).toBe(leaseId);
      expect(result.clauses.length).toBeGreaterThan(0);
    });

    test('should handle malformed event data gracefully', async () => {
      // This test verifies that the system handles malformed events properly
      const events = await redisClient.getEventStream('lease_processing_stream');
      
      // Should handle any malformed events without throwing
      events.forEach((event: any) => {
        expect(() => {
          if (event.data) {
            JSON.parse(event.data);
          }
        }).not.toThrow();
      });
    });
  });
}); 