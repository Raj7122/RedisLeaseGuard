import { NextRequest } from 'next/server';
import { POST, GET } from '../chat/route';
import geminiClient from '@/lib/gemini';
import redisClient from '@/lib/redis';

// Mock dependencies
jest.mock('@/lib/gemini');
jest.mock('@/lib/redis');

const mockGeminiClient = geminiClient as jest.Mocked<typeof geminiClient>;
const mockRedisClient = redisClient as jest.Mocked<typeof redisClient>;

describe('Chat API Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock Redis client
    mockRedisClient.getClient.mockReturnValue({
      json: {
        get: jest.fn().mockResolvedValue(null),
      },
      keys: jest.fn().mockResolvedValue([]),
      lrange: jest.fn().mockResolvedValue([]),
      lpush: jest.fn().mockResolvedValue(undefined),
      ltrim: jest.fn().mockResolvedValue(undefined),
      expire: jest.fn().mockResolvedValue(undefined),
    } as any);
  });

  describe('POST /api/chat', () => {
    it('should process a question and return response', async () => {
      const mockResponse = 'Based on your lease, the security deposit clause violates NYC law...';
      mockGeminiClient.processQuestion.mockResolvedValue(mockResponse);
      
      const mockLeaseData = {
        id: 'test-lease-123',
        processedAt: '2025-01-27T10:00:00Z',
        clauseCount: 5,
        flaggedCount: 2
      };
      
      const mockClauseData = {
        text: 'Security deposit equal to three months rent',
        metadata: {
          flagged: true,
          severity: 'Critical',
          violationType: 'Excessive Security Deposit',
          legalReference: 'NYC Housing Maintenance Code §27-2056'
        }
      };
      
      mockRedisClient.getClient().json.get
        .mockResolvedValueOnce(mockLeaseData) // lease data
        .mockResolvedValueOnce(mockClauseData); // clause data
      
      mockRedisClient.getClient().keys.mockResolvedValue(['clause:test-lease-123_1']);
      
      const requestBody = {
        question: 'What should I do about the security deposit issue?',
        leaseId: 'test-lease-123',
        sessionId: 'test-session-123'
      };
      
      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const response = await POST(request);
      const responseData = await response.json();
      
      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.response).toBe(mockResponse);
      expect(responseData.sessionId).toBe('test-session-123');
      expect(responseData.context.totalClauses).toBe(1);
      expect(responseData.context.flaggedClauses).toBe(1);
      expect(responseData.context.violations).toBe(1);
    });

    it('should handle missing question parameter', async () => {
      const requestBody = {
        leaseId: 'test-lease-123'
      };
      
      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const response = await POST(request);
      const responseData = await response.json();
      
      expect(response.status).toBe(400);
      expect(responseData.error).toBe('Question and leaseId are required');
    });

    it('should handle missing leaseId parameter', async () => {
      const requestBody = {
        question: 'What should I do?'
      };
      
      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const response = await POST(request);
      const responseData = await response.json();
      
      expect(response.status).toBe(400);
      expect(responseData.error).toBe('Question and leaseId are required');
    });

    it('should handle lease not found', async () => {
      mockRedisClient.getClient().json.get.mockResolvedValue(null);
      
      const requestBody = {
        question: 'What should I do?',
        leaseId: 'nonexistent-lease'
      };
      
      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const response = await POST(request);
      const responseData = await response.json();
      
      expect(response.status).toBe(404);
      expect(responseData.error).toBe('Lease not found or expired');
    });

    it('should handle Gemini API failures', async () => {
      const mockLeaseData = {
        id: 'test-lease-123',
        processedAt: '2025-01-27T10:00:00Z',
        clauseCount: 5,
        flaggedCount: 2
      };
      
      mockRedisClient.getClient().json.get.mockResolvedValue(mockLeaseData);
      mockRedisClient.getClient().keys.mockResolvedValue([]);
      mockGeminiClient.processQuestion.mockRejectedValue(new Error('Failed to process question'));
      
      const requestBody = {
        question: 'What should I do?',
        leaseId: 'test-lease-123'
      };
      
      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const response = await POST(request);
      const responseData = await response.json();
      
      expect(response.status).toBe(500);
      expect(responseData.error).toBe('Unable to process your question. Please try again.');
    });

    it('should handle Redis connection failures', async () => {
      mockRedisClient.connect.mockRejectedValue(new Error('Redis connection failed'));
      
      const requestBody = {
        question: 'What should I do?',
        leaseId: 'test-lease-123'
      };
      
      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const response = await POST(request);
      const responseData = await response.json();
      
      expect(response.status).toBe(503);
      expect(responseData.error).toBe('Service temporarily unavailable. Please try again.');
    });

    it('should store conversation in Redis', async () => {
      const mockResponse = 'Response from AI';
      mockGeminiClient.processQuestion.mockResolvedValue(mockResponse);
      
      const mockLeaseData = {
        id: 'test-lease-123',
        processedAt: '2025-01-27T10:00:00Z',
        clauseCount: 5,
        flaggedCount: 2
      };
      
      mockRedisClient.getClient().json.get.mockResolvedValue(mockLeaseData);
      mockRedisClient.getClient().keys.mockResolvedValue([]);
      
      const requestBody = {
        question: 'What should I do?',
        leaseId: 'test-lease-123',
        sessionId: 'test-session-123'
      };
      
      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      await POST(request);
      
      // Verify conversation was stored
      expect(mockRedisClient.getClient().lpush).toHaveBeenCalledTimes(2); // user + assistant messages
      expect(mockRedisClient.getClient().ltrim).toHaveBeenCalledWith('conversation:test-session-123', 0, 19);
      expect(mockRedisClient.getClient().expire).toHaveBeenCalledWith('conversation:test-session-123', 7 * 24 * 60 * 60);
    });
  });

  describe('GET /api/chat/history', () => {
    it('should retrieve conversation history', async () => {
      const mockHistory = [
        JSON.stringify({ role: 'user', content: 'What about the security deposit?', timestamp: '2025-01-27T10:00:00Z' }),
        JSON.stringify({ role: 'assistant', content: 'The security deposit clause violates NYC law...', timestamp: '2025-01-27T10:01:00Z' })
      ];
      
      mockRedisClient.getClient().lrange.mockResolvedValue(mockHistory);
      
      const request = new NextRequest('http://localhost:3000/api/chat/history?sessionId=test-session-123');
      
      const response = await GET(request);
      const responseData = await response.json();
      
      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.history).toEqual(mockHistory);
      expect(responseData.sessionId).toBe('test-session-123');
    });

    it('should handle missing sessionId parameter', async () => {
      const request = new NextRequest('http://localhost:3000/api/chat/history');
      
      const response = await GET(request);
      const responseData = await response.json();
      
      expect(response.status).toBe(400);
      expect(responseData.error).toBe('Session ID is required');
    });

    it('should handle empty conversation history', async () => {
      mockRedisClient.getClient().lrange.mockResolvedValue([]);
      
      const request = new NextRequest('http://localhost:3000/api/chat/history?sessionId=empty-session');
      
      const response = await GET(request);
      const responseData = await response.json();
      
      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.history).toEqual([]);
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedisClient.getClient().lrange.mockRejectedValue(new Error('Redis error'));
      
      const request = new NextRequest('http://localhost:3000/api/chat/history?sessionId=test-session-123');
      
      const response = await GET(request);
      const responseData = await response.json();
      
      expect(response.status).toBe(500);
      expect(responseData.error).toBe('Failed to retrieve conversation history');
    });
  });

  describe('Performance Requirements', () => {
    it('should respond within 2.5 seconds', async () => {
      const mockResponse = 'Response from AI';
      mockGeminiClient.processQuestion.mockImplementation(async () => {
        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 100));
        return mockResponse;
      });
      
      const mockLeaseData = {
        id: 'test-lease-123',
        processedAt: '2025-01-27T10:00:00Z',
        clauseCount: 5,
        flaggedCount: 2
      };
      
      mockRedisClient.getClient().json.get.mockResolvedValue(mockLeaseData);
      mockRedisClient.getClient().keys.mockResolvedValue([]);
      
      const requestBody = {
        question: 'What should I do?',
        leaseId: 'test-lease-123'
      };
      
      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const startTime = Date.now();
      const response = await POST(request);
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(2500);
    });

    it('should handle concurrent requests efficiently', async () => {
      const mockResponse = 'Response from AI';
      mockGeminiClient.processQuestion.mockResolvedValue(mockResponse);
      
      const mockLeaseData = {
        id: 'test-lease-123',
        processedAt: '2025-01-27T10:00:00Z',
        clauseCount: 5,
        flaggedCount: 2
      };
      
      mockRedisClient.getClient().json.get.mockResolvedValue(mockLeaseData);
      mockRedisClient.getClient().keys.mockResolvedValue([]);
      
      const requests = Array.from({ length: 3 }, (_, i) => {
        const requestBody = {
          question: `Question ${i + 1}`,
          leaseId: 'test-lease-123'
        };
        
        return new NextRequest('http://localhost:3000/api/chat', {
          method: 'POST',
          body: JSON.stringify(requestBody),
          headers: {
            'Content-Type': 'application/json',
          },
        });
      });
      
      const startTime = Date.now();
      const responses = await Promise.all(requests.map(request => POST(request)));
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      expect(responses).toHaveLength(3);
      expect(responses.every(r => r.status === 200)).toBe(true);
      expect(totalTime).toBeLessThan(5000); // Should handle 3 concurrent requests efficiently
    });
  });

  describe('Context Building', () => {
    it('should build comprehensive lease context', async () => {
      const mockResponse = 'Response from AI';
      mockGeminiClient.processQuestion.mockResolvedValue(mockResponse);
      
      const mockLeaseData = {
        id: 'test-lease-123',
        processedAt: '2025-01-27T10:00:00Z',
        clauseCount: 3,
        flaggedCount: 2
      };
      
      const mockClauseData1 = {
        text: 'Security deposit equal to three months rent',
        metadata: {
          flagged: true,
          severity: 'Critical',
          violationType: 'Excessive Security Deposit',
          legalReference: 'NYC Housing Maintenance Code §27-2056'
        }
      };
      
      const mockClauseData2 = {
        text: 'Rent due on first of month',
        metadata: {
          flagged: false,
          severity: undefined,
          violationType: undefined,
          legalReference: undefined
        }
      };
      
      const mockClauseData3 = {
        text: 'Tenant waives repair claims',
        metadata: {
          flagged: true,
          severity: 'Critical',
          violationType: 'Repair Responsibility Waiver',
          legalReference: 'NYC Housing Maintenance Code Article 1'
        }
      };
      
      mockRedisClient.getClient().json.get
        .mockResolvedValueOnce(mockLeaseData) // lease data
        .mockResolvedValueOnce(mockClauseData1) // clause 1
        .mockResolvedValueOnce(mockClauseData2) // clause 2
        .mockResolvedValueOnce(mockClauseData3); // clause 3
      
      mockRedisClient.getClient().keys.mockResolvedValue([
        'clause:test-lease-123_1',
        'clause:test-lease-123_2',
        'clause:test-lease-123_3'
      ]);
      
      const requestBody = {
        question: 'What violations are in my lease?',
        leaseId: 'test-lease-123'
      };
      
      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const response = await POST(request);
      const responseData = await response.json();
      
      expect(response.status).toBe(200);
      expect(responseData.context.totalClauses).toBe(3);
      expect(responseData.context.flaggedClauses).toBe(2);
      expect(responseData.context.violations).toBe(2);
    });
  });
}); 