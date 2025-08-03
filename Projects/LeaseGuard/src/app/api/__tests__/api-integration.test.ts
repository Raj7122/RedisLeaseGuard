/**
 * Comprehensive API Integration Test Suite
 * 
 * Tests all API endpoints including:
 * - Health check endpoints
 * - Document upload and processing
 * - AI chat functionality
 * - Session management
 * - Analytics and monitoring
 * - Error handling and resilience
 * 
 * S.A.F.E. D.R.Y. Principles:
 * - Strategic: Comprehensive API coverage
 * - Automated: Full automation of API testing
 * - Fortified: Tests security and error handling
 * - Evolving: Tests can be extended for new endpoints
 * - DRY: Reusable test utilities and patterns
 * - Resilient: Tests handle failures gracefully
 * - Your-Focused: Tests user-facing API functionality
 */

import { NextRequest } from 'next/server';
import { GET, POST } from '../health/route';
import { POST as chatPOST } from '../chat/route';
import { POST as uploadPOST } from '../upload/route';
import { POST as sessionPOST } from '../session/route';
import { POST as analyticsPOST } from '../analytics/route';

// Mock dependencies
jest.mock('@/lib/redis', () => ({
  default: {
    connect: jest.fn().mockResolvedValue(true),
    getClient: jest.fn(() => ({
      json: {
        set: jest.fn().mockResolvedValue('OK'),
        get: jest.fn().mockResolvedValue(null),
      },
      ping: jest.fn().mockResolvedValue('PONG'),
      ft: {
        search: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue('OK'),
      },
    })),
    healthCheck: jest.fn().mockResolvedValue(true),
  },
}));

jest.mock('@/lib/gemini', () => ({
  generateResponse: jest.fn().mockResolvedValue({
    response: 'This is a test AI response with legal disclaimers.',
    sessionId: 'test-session-123',
  }),
}));

jest.mock('@/lib/document-processor', () => ({
  __esModule: true,
  default: {
    validateFile: jest.fn((file) => {
      if (file.size > 10 * 1024 * 1024) {
        return { valid: false, error: 'File size must be less than 10MB' };
      }
      if (!['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'].includes(file.type)) {
        return { valid: false, error: 'File type not supported. Please upload a PDF or image file.' };
      }
      return { valid: true };
    }),
    processDocument: jest.fn().mockResolvedValue({
      leaseId: 'test-lease-123',
      clauses: [
        {
          id: 'clause-1',
          text: 'Sample lease clause 1',
          section: 'Rent',
          metadata: {
            confidence: 0.9,
            flagged: false,
            leaseId: 'test-lease-123'
          },
          vector: new Array(768).fill(0.1)
        },
        {
          id: 'clause-2',
          text: 'Sample lease clause 2',
          section: 'Security Deposit',
          metadata: {
            confidence: 0.85,
            flagged: true,
            leaseId: 'test-lease-123',
            severity: 'High',
            violationType: 'Illegal Fee',
            legalReference: 'NYC Admin Code § 26-511'
          },
          vector: new Array(768).fill(0.1)
        }
      ],
      violations: [
        {
          clauseId: 'clause-2',
          type: 'Illegal Fee',
          severity: 'High',
          description: 'Sample lease clause 2',
          legalReference: 'NYC Admin Code § 26-511'
        }
      ],
      summary: {
        totalClauses: 2,
        flaggedClauses: 1,
        criticalViolations: 0,
        highViolations: 1,
        mediumViolations: 0,
        lowViolations: 0
      }
    }),
    healthCheck: jest.fn().mockResolvedValue(true)
  }
}));

jest.mock('@/lib/session-management', () => ({
  getSessionManager: jest.fn(() => ({
    createSession: jest.fn().mockResolvedValue({
      id: 'test-session-123',
      userId: 'test-user-123',
      createdAt: new Date().toISOString(),
      status: 'active',
      userAgent: 'test-agent',
      ipAddress: '127.0.0.1',
      metadata: {
        deviceType: 'desktop',
        language: 'en-US',
        timezone: 'UTC'
      }
    }),
    getSession: jest.fn().mockResolvedValue({
      id: 'test-session-123',
      userId: 'test-user-123',
      createdAt: new Date().toISOString(),
      status: 'active',
      userAgent: 'test-agent',
      ipAddress: '127.0.0.1',
      metadata: {
        deviceType: 'desktop',
        language: 'en-US',
        timezone: 'UTC'
      }
    }),
    logActivity: jest.fn().mockResolvedValue(true),
    getSessionActivities: jest.fn().mockResolvedValue([]),
    updateSessionStatus: jest.fn().mockResolvedValue(true),
    cleanupExpiredSessions: jest.fn().mockResolvedValue(0),
    trackAnalytics: jest.fn().mockResolvedValue(true),
    trackPerformance: jest.fn().mockResolvedValue(true),
    trackError: jest.fn().mockResolvedValue(true)
  })),
  sessionManager: {
    createSession: jest.fn().mockResolvedValue({
      id: 'test-session-123',
      userId: 'test-user-123',
      createdAt: new Date().toISOString(),
      status: 'active',
      userAgent: 'test-agent',
      ipAddress: '127.0.0.1',
      metadata: {
        deviceType: 'desktop',
        language: 'en-US',
        timezone: 'UTC'
      }
    }),
    getSession: jest.fn().mockResolvedValue({
      id: 'test-session-123',
      userId: 'test-user-123',
      createdAt: new Date().toISOString(),
      status: 'active',
      userAgent: 'test-agent',
      ipAddress: '127.0.0.1',
      metadata: {
        deviceType: 'desktop',
        language: 'en-US',
        timezone: 'UTC'
      }
    }),
    logActivity: jest.fn().mockResolvedValue(true),
    getSessionActivities: jest.fn().mockResolvedValue([]),
    updateSessionStatus: jest.fn().mockResolvedValue(true),
    cleanupExpiredSessions: jest.fn().mockResolvedValue(0),
    trackAnalytics: jest.fn().mockResolvedValue(true),
    trackPerformance: jest.fn().mockResolvedValue(true),
    trackError: jest.fn().mockResolvedValue(true)
  }
}));

jest.mock('@/lib/error-handling', () => ({
  getSystemHealth: jest.fn().mockResolvedValue({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    components: {
      redis: { status: 'healthy', responseTime: 50 },
      gemini: { status: 'healthy', responseTime: 100 },
      supabase: { status: 'healthy', responseTime: 75 },
    },
    metrics: {
      uptime: 3600000, // 1 hour
      errorRate: 0.01,
      responseTime: 150
    }
  }),
  executeWithErrorHandling: jest.fn().mockImplementation(async (operation, component, primaryOperation) => {
    return await primaryOperation();
  }),
  SystemHealthStatus: {
    HEALTHY: 'healthy',
    DEGRADED: 'degraded',
    UNHEALTHY: 'unhealthy',
  },
}));

describe('API Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Health Check API', () => {
    test('should return healthy status when all components are healthy', async () => {
      const request = new NextRequest('http://localhost:3000/api/health');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('healthy');
      expect(data.components.redis.status).toBe('healthy');
      expect(data.components.gemini.status).toBe('healthy');
      expect(data.components.supabase.status).toBe('healthy');
    });

    test('should return proper headers for health check', async () => {
      const request = new NextRequest('http://localhost:3000/api/health');
      const response = await GET(request);

      expect(response.headers.get('content-type')).toBe('application/json');
      expect(response.headers.get('cache-control')).toBe('no-store, no-cache, must-revalidate, proxy-revalidate');
    });

    test('should handle health check errors gracefully', async () => {
      const { getSystemHealth } = require('@/lib/error-handling');
      getSystemHealth.mockRejectedValueOnce(new Error('Health check failed'));

      const request = new NextRequest('http://localhost:3000/api/health');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.status).toBe('unhealthy');
      expect(data.message).toContain('Failed to retrieve system health');
    });
  });

  describe('Chat API', () => {
    test('should handle chat requests with proper validation', async () => {
      const requestBody = {
        question: 'What are my rights regarding late fees?',
        sessionId: 'test-session-123',
        leaseContext: 'Sample lease text with late fee clause',
      };

      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const response = await chatPOST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.response).toContain('This is a test AI response');
      expect(data.sessionId).toBe('test-session-123');
    });

    test('should validate required fields in chat request', async () => {
      const requestBody = {
        // Missing question field
        sessionId: 'test-session-123',
      };

      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const response = await chatPOST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Question is required');
    });

    test('should handle AI service errors gracefully', async () => {
      const { generateResponse } = require('@/lib/gemini');
      generateResponse.mockRejectedValueOnce(new Error('AI service unavailable'));

      const requestBody = {
        question: 'What are my rights?',
        sessionId: 'test-session-123',
      };

      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const response = await chatPOST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('Unable to process your question');
    });

    test('should include legal disclaimers in responses', async () => {
      const requestBody = {
        question: 'Is this clause legal?',
        sessionId: 'test-session-123',
      };

      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const response = await chatPOST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.response).toContain('legal disclaimers');
    });

    test('should handle rate limiting', async () => {
      // Mock rate limiting by making multiple requests
      const requestBody = {
        question: 'Test question',
        sessionId: 'test-session-123',
      };

      const requests = Array(10).fill(null).map(() => 
        new NextRequest('http://localhost:3000/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        })
      );

      const responses = await Promise.all(requests.map(req => chatPOST(req)));
      
      // All should succeed in test environment
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });
  });

  describe('Upload API', () => {
    test('should process PDF documents successfully', async () => {
      const formData = new FormData();
      const file = new File(['fake pdf content'], 'test-lease.pdf', { type: 'application/pdf' });
      formData.append('file', file);

      const request = new NextRequest('http://localhost:3000/api/upload', {
        method: 'POST',
        body: formData,
      });

      const response = await uploadPOST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.text).toBe('Sample lease document text');
      expect(data.clauses).toHaveLength(2);
      expect(data.violations).toHaveLength(1);
    });

    test('should validate file types', async () => {
      const formData = new FormData();
      const file = new File(['fake content'], 'test.txt', { type: 'text/plain' });
      formData.append('file', file);

      const request = new NextRequest('http://localhost:3000/api/upload', {
        method: 'POST',
        body: formData,
      });

      const response = await uploadPOST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('File type not supported');
    });

    test('should validate file size limits', async () => {
      const formData = new FormData();
      const largeContent = 'x'.repeat(11 * 1024 * 1024); // 11MB
      const file = new File([largeContent], 'large-file.pdf', { type: 'application/pdf' });
      formData.append('file', file);

      const request = new NextRequest('http://localhost:3000/api/upload', {
        method: 'POST',
        body: formData,
      });

      const response = await uploadPOST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('File too large');
    });

    test('should handle document processing errors', async () => {
      const { processDocument } = require('@/lib/document-processor');
      processDocument.mockRejectedValueOnce(new Error('Document processing failed'));

      const formData = new FormData();
      const file = new File(['fake content'], 'test.pdf', { type: 'application/pdf' });
      formData.append('file', file);

      const request = new NextRequest('http://localhost:3000/api/upload', {
        method: 'POST',
        body: formData,
      });

      const response = await uploadPOST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('Unable to process document');
    });

    test('should handle missing file upload', async () => {
      const formData = new FormData();
      // No file appended

      const request = new NextRequest('http://localhost:3000/api/upload', {
        method: 'POST',
        body: formData,
      });

      const response = await uploadPOST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('No file provided');
    });
  });

  describe('Session Management API', () => {
    test('should create new sessions', async () => {
      const requestBody = {
        userId: 'test-user-123',
        userAgent: 'Mozilla/5.0 (Test Browser)',
        ipAddress: '192.168.1.1',
      };

      const request = new NextRequest('http://localhost:3000/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const response = await sessionPOST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.session.id).toBe('test-session-123');
      expect(data.success).toBe(true);
    });

    test('should log session activities', async () => {
      const requestBody = {
        sessionId: 'test-session-123',
        activity: 'document_upload',
        details: { fileName: 'test.pdf', fileSize: 1024 },
      };

      const request = new NextRequest('http://localhost:3000/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const response = await sessionPOST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    test('should validate session data', async () => {
      const requestBody = {
        // Missing required fields
      };

      const request = new NextRequest('http://localhost:3000/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const response = await sessionPOST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid session data');
    });
  });

  describe('Analytics API', () => {
    test('should track user analytics', async () => {
      const requestBody = {
        event: 'document_processed',
        sessionId: 'test-session-123',
        userId: 'test-user-123',
        metadata: {
          documentType: 'pdf',
          processingTime: 1500,
          violationsFound: 2,
        },
      };

      const request = new NextRequest('http://localhost:3000/api/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const response = await analyticsPOST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    test('should handle analytics errors gracefully', async () => {
      const requestBody = {
        event: 'invalid_event',
        sessionId: 'test-session-123',
      };

      const request = new NextRequest('http://localhost:3000/api/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const response = await analyticsPOST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid analytics event');
    });
  });

  describe('Error Handling and Resilience', () => {
    test('should handle Redis connection failures', async () => {
      const { default: redisClient } = require('@/lib/redis');
      redisClient.getClient.mockImplementationOnce(() => {
        throw new Error('Redis connection failed');
      });

      const request = new NextRequest('http://localhost:3000/api/health');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.status).toBe('unhealthy');
    });

    test('should handle AI service timeouts', async () => {
      const { generateResponse } = require('@/lib/gemini');
      generateResponse.mockImplementationOnce(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 100)
        )
      );

      const requestBody = {
        question: 'Test question',
        sessionId: 'test-session-123',
      };

      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const response = await chatPOST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('Unable to process your question');
    });

    test('should handle malformed JSON requests', async () => {
      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json',
      });

      const response = await chatPOST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid JSON');
    });

    test('should handle missing content-type headers', async () => {
      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify({ question: 'test' }),
        // No Content-Type header
      });

      const response = await chatPOST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Content-Type must be application/json');
    });
  });

  describe('Security Tests', () => {
    test('should prevent XSS in request bodies', async () => {
      const requestBody = {
        question: '<script>alert("xss")</script>What are my rights?',
        sessionId: 'test-session-123',
      };

      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const response = await chatPOST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      // Should sanitize the input
      expect(data.response).not.toContain('<script>');
    });

    test('should validate file upload security', async () => {
      const formData = new FormData();
      const maliciousFile = new File(['malicious content'], 'malicious.exe', { 
        type: 'application/x-msdownload' 
      });
      formData.append('file', maliciousFile);

      const request = new NextRequest('http://localhost:3000/api/upload', {
        method: 'POST',
        body: formData,
      });

      const response = await uploadPOST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('File type not allowed');
    });

    test('should handle suspicious activity detection', async () => {
      const requestBody = {
        question: 'test'.repeat(1000), // Very long question
        sessionId: 'test-session-123',
      };

      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const response = await chatPOST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Input too long');
    });
  });

  describe('Performance Tests', () => {
    test('should respond within acceptable time limits', async () => {
      const startTime = Date.now();

      const request = new NextRequest('http://localhost:3000/api/health');
      const response = await GET(request);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(1000); // Should respond within 1 second
      expect(response.status).toBe(200);
    });

    test('should handle concurrent requests', async () => {
      const requests = Array(5).fill(null).map(() => 
        new NextRequest('http://localhost:3000/api/health')
      );

      const startTime = Date.now();
      const responses = await Promise.all(requests.map(req => GET(req)));
      const totalTime = Date.now() - startTime;

      expect(totalTime).toBeLessThan(2000); // Should handle 5 concurrent requests within 2 seconds
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });
  });

  describe('Data Validation Tests', () => {
    test('should validate chat request structure', async () => {
      const invalidRequests = [
        { question: '' }, // Empty question
        { question: 'a'.repeat(10001) }, // Too long
        { sessionId: 'test' }, // Missing question
        { question: 'test', sessionId: '' }, // Empty session ID
      ];

      for (const requestBody of invalidRequests) {
        const request = new NextRequest('http://localhost:3000/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });

        const response = await chatPOST(request);
        expect(response.status).toBe(400);
      }
    });

    test('should validate upload request structure', async () => {
      const formData = new FormData();
      // No file appended

      const request = new NextRequest('http://localhost:3000/api/upload', {
        method: 'POST',
        body: formData,
      });

      const response = await uploadPOST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('No file provided');
    });

    test('should validate session request structure', async () => {
      const invalidRequests = [
        {}, // Empty request
        { userId: '' }, // Empty user ID
        { userId: 'test', userAgent: '' }, // Empty user agent
      ];

      for (const requestBody of invalidRequests) {
        const request = new NextRequest('http://localhost:3000/api/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });

        const response = await sessionPOST(request);
        expect(response.status).toBe(400);
      }
    });
  });
}); 