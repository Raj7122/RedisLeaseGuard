import { NextRequest } from 'next/server';
import { POST as createSession, GET as getSession, PUT as updateSession } from '../session/route';
import { POST as logActivity, GET as getActivities } from '../session/activity/route';
import { POST as trackAnalytics, GET as getAnalyticsReport } from '../analytics/route';
import { POST as trackPerformance } from '../analytics/performance/route';
import { POST as trackError } from '../analytics/error/route';

// Mock session manager
jest.mock('@/lib/session-management', () => ({
  sessionManager: {
    createSession: jest.fn(),
    getSession: jest.fn(),
    updateSessionStatus: jest.fn(),
    logActivity: jest.fn(),
    getSessionActivities: jest.fn(),
    trackAnalytics: jest.fn(),
    generateAnalyticsReport: jest.fn(),
    trackPerformance: jest.fn(),
    trackError: jest.fn(),
  }
}));

import { sessionManager } from '@/lib/session-management';

const mockSessionManager = sessionManager as jest.Mocked<typeof sessionManager>;

describe('Session Management API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/session', () => {
    it('should create a new session successfully', async () => {
      const mockSession = {
        id: 'test-session-123',
        createdAt: '2025-01-27T10:00:00Z',
        status: 'active' as const,
        metadata: { deviceType: 'desktop' }
      };

      mockSessionManager.createSession.mockResolvedValue(mockSession);

      const request = new NextRequest('http://localhost:3000/api/session', {
        method: 'POST',
        body: JSON.stringify({
          userAgent: 'Mozilla/5.0 (Test Browser)',
          ipAddress: '127.0.0.1',
          userId: null
        })
      });

      const response = await createSession(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.session.id).toBe('test-session-123');
      expect(mockSessionManager.createSession).toHaveBeenCalledWith(
        'Mozilla/5.0 (Test Browser)',
        '127.0.0.1',
        null
      );
    });

    it('should handle invalid user agent format', async () => {
      const request = new NextRequest('http://localhost:3000/api/session', {
        method: 'POST',
        body: JSON.stringify({
          userAgent: 123, // Invalid type
          ipAddress: '127.0.0.1',
          userId: null
        })
      });

      const response = await createSession(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid user agent format');
    });

    it('should handle session creation errors', async () => {
      mockSessionManager.createSession.mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost:3000/api/session', {
        method: 'POST',
        body: JSON.stringify({
          userAgent: 'Mozilla/5.0 (Test Browser)',
          ipAddress: '127.0.0.1',
          userId: null
        })
      });

      const response = await createSession(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to create session');
    });
  });

  describe('GET /api/session', () => {
    it('should retrieve session data successfully', async () => {
      const mockSession = {
        id: 'test-session-123',
        createdAt: '2025-01-27T10:00:00Z',
        status: 'active' as const,
        metadata: { deviceType: 'desktop' }
      };

      mockSessionManager.getSession.mockResolvedValue(mockSession);

      const request = new NextRequest('http://localhost:3000/api/session?sessionId=test-session-123');

      const response = await getSession(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.session.id).toBe('test-session-123');
      expect(mockSessionManager.getSession).toHaveBeenCalledWith('test-session-123');
    });

    it('should handle missing session ID', async () => {
      const request = new NextRequest('http://localhost:3000/api/session');

      const response = await getSession(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Session ID is required');
    });

    it('should handle invalid session ID format', async () => {
      const request = new NextRequest('http://localhost:3000/api/session?sessionId=123');

      const response = await getSession(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid session ID format');
    });

    it('should handle session not found', async () => {
      mockSessionManager.getSession.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/session?sessionId=test-session-123');

      const response = await getSession(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Session not found');
    });
  });

  describe('PUT /api/session', () => {
    it('should update session status successfully', async () => {
      mockSessionManager.updateSessionStatus.mockResolvedValue();

      const request = new NextRequest('http://localhost:3000/api/session?sessionId=test-session-123', {
        method: 'PUT',
        body: JSON.stringify({ status: 'expired' })
      });

      const response = await updateSession(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockSessionManager.updateSessionStatus).toHaveBeenCalledWith('test-session-123', 'expired');
    });

    it('should handle invalid status value', async () => {
      const request = new NextRequest('http://localhost:3000/api/session?sessionId=test-session-123', {
        method: 'PUT',
        body: JSON.stringify({ status: 'invalid' })
      });

      const response = await updateSession(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid status value');
    });
  });
});

describe('Session Activity API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/session/activity', () => {
    it('should log activity successfully', async () => {
      mockSessionManager.logActivity.mockResolvedValue();

      const request = new NextRequest('http://localhost:3000/api/session/activity', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: 'test-session-123',
          activity: {
            type: 'document_upload',
            timestamp: '2025-01-27T10:00:00Z',
            metadata: { fileType: 'pdf', fileSize: 1024000 }
          }
        })
      });

      const response = await logActivity(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockSessionManager.logActivity).toHaveBeenCalledWith('test-session-123', {
        type: 'document_upload',
        timestamp: '2025-01-27T10:00:00Z',
        metadata: { fileType: 'pdf', fileSize: 1024000 }
      });
    });

    it('should handle invalid activity type', async () => {
      const request = new NextRequest('http://localhost:3000/api/session/activity', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: 'test-session-123',
          activity: {
            type: 'invalid_type',
            timestamp: '2025-01-27T10:00:00Z',
            metadata: {}
          }
        })
      });

      const response = await logActivity(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid activity type');
    });

    it('should sanitize metadata to prevent injection', async () => {
      mockSessionManager.logActivity.mockResolvedValue();

      const request = new NextRequest('http://localhost:3000/api/session/activity', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: 'test-session-123',
          activity: {
            type: 'document_upload',
            timestamp: '2025-01-27T10:00:00Z',
            metadata: { 
              fileType: 'pdf<script>alert("xss")</script>',
              fileSize: 1024000,
              maliciousField: 'should be removed'
            }
          }
        })
      });

      const response = await logActivity(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      
      // Verify that malicious content was sanitized
      expect(mockSessionManager.logActivity).toHaveBeenCalledWith('test-session-123', {
        type: 'document_upload',
        timestamp: '2025-01-27T10:00:00Z',
        metadata: { 
          fileType: 'pdfscriptalert("xss")/script', // Script tags removed
          fileSize: 1024000
          // maliciousField should be removed
        }
      });
    });
  });

  describe('GET /api/session/activity', () => {
    it('should retrieve session activities successfully', async () => {
      const mockActivities = [
        {
          type: 'document_upload',
          timestamp: '2025-01-27T10:00:00Z',
          metadata: { fileType: 'pdf' }
        },
        {
          type: 'question_asked',
          timestamp: '2025-01-27T10:01:00Z',
          metadata: { questionLength: 50 }
        }
      ];

      mockSessionManager.getSessionActivities.mockResolvedValue(mockActivities);

      const request = new NextRequest('http://localhost:3000/api/session/activity?sessionId=test-session-123');

      const response = await getActivities(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.activities).toHaveLength(2);
      expect(mockSessionManager.getSessionActivities).toHaveBeenCalledWith('test-session-123');
    });
  });
});

describe('Analytics API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/analytics', () => {
    it('should track analytics successfully', async () => {
      mockSessionManager.trackAnalytics.mockResolvedValue();

      const request = new NextRequest('http://localhost:3000/api/analytics', {
        method: 'POST',
        body: JSON.stringify({
          eventType: 'document_upload',
          sessionId: 'test-session-123',
          metrics: {
            fileType: 'pdf',
            fileSize: 1024000,
            processingTime: 2500
          }
        })
      });

      const response = await trackAnalytics(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockSessionManager.trackAnalytics).toHaveBeenCalledWith({
        eventType: 'document_upload',
        sessionId: 'test-session-123',
        timestamp: expect.any(String),
        metrics: {
          fileType: 'pdf',
          fileSize: 1024000,
          processingTime: 2500
        }
      });
    });

    it('should handle invalid event type', async () => {
      const request = new NextRequest('http://localhost:3000/api/analytics', {
        method: 'POST',
        body: JSON.stringify({
          eventType: 'invalid_event',
          sessionId: 'test-session-123',
          metrics: {}
        })
      });

      const response = await trackAnalytics(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid event type');
    });
  });

  describe('GET /api/analytics', () => {
    it('should generate analytics report successfully', async () => {
      const mockReport = {
        dailyUsage: [
          { eventType: 'document_upload', count: 150 },
          { eventType: 'ai_question', count: 300 }
        ],
        performanceTrends: [
          { date: '2025-01-27', avgResponseTime: 1800, errorRate: 0.02 }
        ],
        errorRates: [
          { type: 'redis_connection_failed', count: 5 }
        ],
        reportGenerated: '2025-01-27T10:00:00Z'
      };

      mockSessionManager.generateAnalyticsReport.mockResolvedValue(mockReport);

      const request = new NextRequest('http://localhost:3000/api/analytics?startDate=2025-01-27&endDate=2025-01-28');

      const response = await getAnalyticsReport(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.report).toEqual(mockReport);
    });

    it('should handle missing date parameters', async () => {
      const request = new NextRequest('http://localhost:3000/api/analytics');

      const response = await getAnalyticsReport(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Start date and end date are required');
    });

    it('should handle invalid date format', async () => {
      const request = new NextRequest('http://localhost:3000/api/analytics?startDate=invalid&endDate=2025-01-28');

      const response = await getAnalyticsReport(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid date format');
    });
  });
});

describe('Performance Analytics API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/analytics/performance', () => {
    it('should track performance metrics successfully', async () => {
      mockSessionManager.trackPerformance.mockResolvedValue();

      const request = new NextRequest('http://localhost:3000/api/analytics/performance', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: 'test-session-123',
          redisQueryTime: 45,
          geminiResponseTime: 1800,
          totalProcessingTime: 2500
        })
      });

      const response = await trackPerformance(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockSessionManager.trackPerformance).toHaveBeenCalledWith({
        eventType: 'performance_metric',
        sessionId: 'test-session-123',
        timestamp: expect.any(String),
        metrics: {
          redisQueryTime: 45,
          geminiResponseTime: 1800,
          totalProcessingTime: 2500,
          memoryUsage: expect.any(Number),
          userId: null
        }
      });
    });

    it('should return warnings for performance degradation', async () => {
      mockSessionManager.trackPerformance.mockResolvedValue();

      const request = new NextRequest('http://localhost:3000/api/analytics/performance', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: 'test-session-123',
          redisQueryTime: 150, // Exceeds 100ms threshold
          geminiResponseTime: 3000, // Exceeds 2.5s threshold
          totalProcessingTime: 6000 // Exceeds 5s threshold
        })
      });

      const response = await trackPerformance(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.warnings).toContain('Redis query time exceeded 100ms threshold');
      expect(data.warnings).toContain('Gemini response time exceeded 2.5s threshold');
      expect(data.warnings).toContain('Total processing time exceeded 5s threshold');
    });
  });
});

describe('Error Analytics API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/analytics/error', () => {
    it('should track error successfully', async () => {
      mockSessionManager.trackError.mockResolvedValue();

      const request = new NextRequest('http://localhost:3000/api/analytics/error', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: 'test-session-123',
          error: {
            type: 'redis_connection_failed',
            message: 'Redis connection timeout',
            severity: 'high'
          },
          responseTime: 5000
        })
      });

      const response = await trackError(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.severity).toBe('high');
      expect(mockSessionManager.trackError).toHaveBeenCalledWith({
        eventType: 'error',
        sessionId: 'test-session-123',
        timestamp: expect.any(String),
        error: {
          type: 'redis_connection_failed',
          message: 'Redis connection timeout',
          severity: 'high'
        },
        metrics: {
          responseTime: 5000,
          userId: null
        }
      });
    });

    it('should sanitize stack trace', async () => {
      mockSessionManager.trackError.mockResolvedValue();

      const request = new NextRequest('http://localhost:3000/api/analytics/error', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: 'test-session-123',
          error: {
            type: 'test_error',
            message: 'Test error message',
            severity: 'medium',
            stack: 'Error: Test error\n    at TestFunction (/path/to/file.js:10:20)\n    at AnotherFunction (/path/to/another.js:15:25)'
          },
          responseTime: 1000
        })
      });

      const response = await trackError(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      
      // Verify stack trace was sanitized
      expect(mockSessionManager.trackError).toHaveBeenCalledWith({
        eventType: 'error',
        sessionId: 'test-session-123',
        timestamp: expect.any(String),
        error: {
          type: 'test_error',
          message: 'Test error message',
          severity: 'medium',
          stack: expect.stringContaining('<sanitized>')
        },
        metrics: {
          responseTime: 1000,
          userId: null
        }
      });
    });

    it('should handle invalid error severity', async () => {
      const request = new NextRequest('http://localhost:3000/api/analytics/error', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: 'test-session-123',
          error: {
            type: 'test_error',
            message: 'Test error message',
            severity: 'invalid_severity'
          },
          responseTime: 1000
        })
      });

      const response = await trackError(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Valid error severity is required');
    });
  });
}); 