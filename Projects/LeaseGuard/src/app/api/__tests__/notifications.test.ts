import { NextRequest } from 'next/server';
import { GET, POST, PUT } from '../notifications/route';

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

describe('Notifications API', () => {
  describe('GET /api/notifications', () => {
    test('should return subscription info', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/notifications?channel=violation_alerts&sessionId=test-session',
        'GET'
      );
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.channel).toBe('violation_alerts');
      expect(data.sessionId).toBe('test-session');
      expect(data.subscriptionStatus).toBe('active');
      expect(data.message).toBe('Notifications endpoint ready for WebSocket connection');
    });

    test('should handle missing parameters', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/notifications',
        'GET'
      );
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.channel).toBe('violation_alerts');
      expect(data.sessionId).toBeUndefined();
    });

    test('should handle custom channels', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/notifications?channel=user_notifications&sessionId=user123',
        'GET'
      );
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.channel).toBe('user_notifications');
      expect(data.sessionId).toBe('user123');
    });
  });

  describe('POST /api/notifications', () => {
    test('should send notification', async () => {
      const notificationData = {
        message: 'Test notification message',
        channel: 'violation_alerts',
        severity: 'high',
        leaseId: 'test-lease-123',
        sessionId: 'test-session-456'
      };
      
      const request = createMockRequest(
        'http://localhost:3000/api/notifications',
        'POST',
        notificationData
      );
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('Test notification message');
      expect(data.channel).toBe('violation_alerts');
      expect(data.severity).toBe('high');
      expect(data.subscribers).toBeDefined();
      expect(data.timestamp).toBeDefined();
    });

    test('should handle missing required fields', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/notifications',
        'POST',
        { message: 'Test message' } // Missing channel
      );
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toBe('Message and channel are required');
    });

    test('should handle missing message', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/notifications',
        'POST',
        { channel: 'test_channel' } // Missing message
      );
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toBe('Message and channel are required');
    });

    test('should use default severity when not provided', async () => {
      const notificationData = {
        message: 'Test notification',
        channel: 'test_channel',
        leaseId: 'test-lease'
        // No severity specified
      };
      
      const request = createMockRequest(
        'http://localhost:3000/api/notifications',
        'POST',
        notificationData
      );
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.severity).toBe('info'); // Default severity
    });

    test('should handle different severity levels', async () => {
      const severities = ['info', 'warning', 'error', 'critical'];
      
      for (const severity of severities) {
        const notificationData = {
          message: `Test ${severity} notification`,
          channel: 'test_channel',
          severity,
          leaseId: 'test-lease'
        };
        
        const request = createMockRequest(
          'http://localhost:3000/api/notifications',
          'POST',
          notificationData
        );
        
        const response = await POST(request);
        const data = await response.json();
        
        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.severity).toBe(severity);
      }
    });

    test('should handle system notifications', async () => {
      const systemNotification = {
        message: 'System maintenance scheduled',
        channel: 'system_alerts',
        severity: 'warning'
        // No leaseId or sessionId
      };
      
      const request = createMockRequest(
        'http://localhost:3000/api/notifications',
        'POST',
        systemNotification
      );
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.leaseId).toBe('system');
      expect(data.sessionId).toBe('system');
    });
  });

  describe('PUT /api/notifications/subscribe', () => {
    test('should subscribe to notification channel', async () => {
      const subscriptionData = {
        channel: 'violation_alerts',
        sessionId: 'test-session-123',
        callback: 'http://localhost:3000/webhook'
      };
      
      const request = createMockRequest(
        'http://localhost:3000/api/notifications/subscribe',
        'PUT',
        subscriptionData
      );
      
      const response = await PUT(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.channel).toBe('violation_alerts');
      expect(data.sessionId).toBe('test-session-123');
      expect(data.subscriptionStatus).toBe('active');
      expect(data.message).toBe('Successfully subscribed to notifications');
    });

    test('should handle missing required fields', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/notifications/subscribe',
        'PUT',
        { channel: 'test_channel' } // Missing sessionId
      );
      
      const response = await PUT(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toBe('Channel and sessionId are required');
    });

    test('should handle missing channel', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/notifications/subscribe',
        'PUT',
        { sessionId: 'test-session' } // Missing channel
      );
      
      const response = await PUT(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toBe('Channel and sessionId are required');
    });

    test('should handle custom channels', async () => {
      const subscriptionData = {
        channel: 'user_notifications',
        sessionId: 'user123',
        callback: 'http://localhost:3000/user-webhook'
      };
      
      const request = createMockRequest(
        'http://localhost:3000/api/notifications/subscribe',
        'PUT',
        subscriptionData
      );
      
      const response = await PUT(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.channel).toBe('user_notifications');
      expect(data.sessionId).toBe('user123');
    });
  });

  describe('Error Handling', () => {
    test('should handle malformed request body', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/notifications',
        'POST',
        null
      );
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toBe('Message and channel are required');
    });

    test('should handle invalid JSON in request body', async () => {
      const request = {
        url: 'http://localhost:3000/api/notifications',
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

  describe('Notification Data Validation', () => {
    test('should validate notification structure', async () => {
      const validNotification = {
        message: 'Valid notification',
        channel: 'test_channel',
        severity: 'info',
        leaseId: 'test-lease',
        sessionId: 'test-session'
      };
      
      const request = createMockRequest(
        'http://localhost:3000/api/notifications',
        'POST',
        validNotification
      );
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.timestamp).toBeDefined();
      expect(new Date(data.timestamp)).toBeInstanceOf(Date);
    });

    test('should handle long messages', async () => {
      const longMessage = 'A'.repeat(1000); // 1000 character message
      const notificationData = {
        message: longMessage,
        channel: 'test_channel',
        severity: 'info'
      };
      
      const request = createMockRequest(
        'http://localhost:3000/api/notifications',
        'POST',
        notificationData
      );
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe(longMessage);
    });

    test('should handle special characters in messages', async () => {
      const specialMessage = 'Test notification with special chars: !@#$%^&*()_+-=[]{}|;:,.<>?';
      const notificationData = {
        message: specialMessage,
        channel: 'test_channel',
        severity: 'warning'
      };
      
      const request = createMockRequest(
        'http://localhost:3000/api/notifications',
        'POST',
        notificationData
      );
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe(specialMessage);
    });
  });
}); 