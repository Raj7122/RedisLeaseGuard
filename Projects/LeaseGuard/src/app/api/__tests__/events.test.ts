import { NextRequest } from 'next/server';
import { GET, POST } from '../events/route';

// Mock NextRequest
const createMockRequest = (url: string, method: string, body?: any): NextRequest => {
  const request = {
    url,
    method,
    json: async () => body || {},
    formData: async () => new FormData(),
  } as NextRequest;
  
  return request;
};

describe('Events API', () => {
  describe('GET /api/events', () => {
    test('should retrieve events from stream', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/events?stream=lease_processing_stream&startId=0&limit=10',
        'GET'
      );
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.events).toBeDefined();
      expect(Array.isArray(data.events)).toBe(true);
      expect(data.streamName).toBe('lease_processing_stream');
    });

    test('should handle missing parameters gracefully', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/events',
        'GET'
      );
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.events).toBeDefined();
      expect(data.streamName).toBe('lease_processing_stream');
    });

    test('should handle custom stream names', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/events?stream=custom_stream&startId=0&limit=5',
        'GET'
      );
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.streamName).toBe('custom_stream');
    });

    test('should handle limit parameter', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/events?limit=5',
        'GET'
      );
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.events.length).toBeLessThanOrEqual(5);
    });
  });

  describe('POST /api/events', () => {
    test('should publish custom event', async () => {
      const eventData = {
        eventType: 'test_event',
        data: { message: 'Test event data' },
        leaseId: 'test-lease-123',
        sessionId: 'test-session-456'
      };
      
      const request = createMockRequest(
        'http://localhost:3000/api/events',
        'POST',
        eventData
      );
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.eventId).toBeDefined();
      expect(data.eventType).toBe('test_event');
      expect(data.leaseId).toBe('test-lease-123');
      expect(data.sessionId).toBe('test-session-456');
    });

    test('should handle missing required fields', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/events',
        'POST',
        { eventType: 'test_event' } // Missing data
      );
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toBe('Event type and data are required');
    });

    test('should handle missing event type', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/events',
        'POST',
        { data: { message: 'Test' } } // Missing eventType
      );
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toBe('Event type and data are required');
    });

    test('should handle complex event data', async () => {
      const complexData = {
        eventType: 'complex_event',
        data: {
          user: { id: 'user123', name: 'Test User' },
          action: 'document_upload',
          metadata: {
            fileSize: 1024,
            fileType: 'application/pdf',
            timestamp: new Date().toISOString()
          }
        },
        leaseId: 'complex-lease-123',
        sessionId: 'complex-session-456'
      };
      
      const request = createMockRequest(
        'http://localhost:3000/api/events',
        'POST',
        complexData
      );
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.eventType).toBe('complex_event');
      expect(data.leaseId).toBe('complex-lease-123');
    });

    test('should handle system events without lease ID', async () => {
      const systemEvent = {
        eventType: 'system_maintenance',
        data: { message: 'System maintenance scheduled' }
        // No leaseId or sessionId
      };
      
      const request = createMockRequest(
        'http://localhost:3000/api/events',
        'POST',
        systemEvent
      );
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.leaseId).toBe('system');
      expect(data.sessionId).toBe('system');
    });
  });

  describe('Error Handling', () => {
    test('should handle malformed request body', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/events',
        'POST',
        null
      );
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toBe('Event type and data are required');
    });

    test('should handle invalid JSON in request body', async () => {
      const request = {
        url: 'http://localhost:3000/api/events',
        method: 'POST',
        json: async () => {
          throw new Error('Invalid JSON');
        },
        formData: async () => new FormData(),
      } as NextRequest;
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error. Please try again.');
    });
  });

  describe('Event Data Validation', () => {
    test('should validate event structure', async () => {
      const validEvent = {
        eventType: 'valid_event',
        data: { test: 'data' },
        leaseId: 'test-lease',
        sessionId: 'test-session'
      };
      
      const request = createMockRequest(
        'http://localhost:3000/api/events',
        'POST',
        validEvent
      );
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.timestamp).toBeDefined();
      expect(new Date(data.timestamp)).toBeInstanceOf(Date);
    });

    test('should handle empty data object', async () => {
      const eventWithEmptyData = {
        eventType: 'empty_data_event',
        data: {},
        leaseId: 'test-lease'
      };
      
      const request = createMockRequest(
        'http://localhost:3000/api/events',
        'POST',
        eventWithEmptyData
      );
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });
}); 