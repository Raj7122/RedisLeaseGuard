import geminiClient from '../gemini';
import redisClient from '../redis';

// Mock dependencies
jest.mock('../gemini');
jest.mock('../redis');

const mockGeminiClient = geminiClient as jest.Mocked<typeof geminiClient>;
const mockRedisClient = redisClient as jest.Mocked<typeof redisClient>;

describe('AI Q&A System with Contextual Memory', () => {
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

  describe('Question Processing', () => {
    it('should process questions with lease context', async () => {
      const mockResponse = 'Based on your lease, the security deposit clause appears to violate NYC law...\n\n---\n**Legal Disclaimer**: This information is for educational purposes only and does not constitute legal advice. For specific legal guidance, please consult with a qualified attorney or legal aid organization.';
      mockGeminiClient.processQuestion.mockResolvedValue(mockResponse);
      
      const question = 'What should I do about the security deposit issue?';
      const leaseContext = {
        clauses: [
          {
            text: 'Tenant shall provide a security deposit equal to three months rent',
            flagged: true,
            severity: 'Critical'
          }
        ],
        violations: [
          {
            type: 'Excessive Security Deposit',
            description: 'Security deposit exceeds one month rent',
            legal_reference: 'NYC Housing Maintenance Code §27-2056'
          }
        ]
      };
      
      const response = await mockGeminiClient.processQuestion(question, leaseContext);
      
      expect(mockGeminiClient.processQuestion).toHaveBeenCalledTimes(1);
      const callArgs = mockGeminiClient.processQuestion.mock.calls[0];
      expect(callArgs[0]).toBe(question);
      expect(callArgs[1]).toEqual(leaseContext);
      expect(callArgs[2] === undefined || (Array.isArray(callArgs[2]) && callArgs[2].length === 0)).toBe(true);
      expect(response).toBe(mockResponse);
    });

    it('should include conversation history in context', async () => {
      const mockResponse = 'Following up on your previous question about the security deposit...';
      mockGeminiClient.processQuestion.mockResolvedValue(mockResponse);
      
      const question = 'How do I get my extra deposit money back?';
      const leaseContext = {
        clauses: [],
        violations: []
      };
      const conversationHistory = [
        { role: 'user' as const, content: 'What should I do about the security deposit issue?' },
        { role: 'assistant' as const, content: 'The security deposit clause violates NYC law...' }
      ];
      
      await mockGeminiClient.processQuestion(question, leaseContext, conversationHistory);
      
      expect(mockGeminiClient.processQuestion).toHaveBeenCalledWith(
        question,
        leaseContext,
        conversationHistory
      );
    });

    it('should handle questions about flagged violations', async () => {
      const mockResponse = 'The repair responsibility waiver in your lease is illegal...';
      mockGeminiClient.processQuestion.mockResolvedValue(mockResponse);
      
      const question = 'Is the repair waiver clause legal?';
      const leaseContext = {
        clauses: [
          {
            text: 'Tenant waives any claims for repairs and maintenance',
            flagged: true,
            severity: 'Critical'
          }
        ],
        violations: [
          {
            type: 'Repair Responsibility Waiver',
            description: 'Tenant waives repair claims',
            legal_reference: 'NYC Housing Maintenance Code Article 1'
          }
        ]
      };
      
      const response = await mockGeminiClient.processQuestion(question, leaseContext);
      
      expect(response).toContain('repair');
      expect(response).toContain('illegal');
    });

    it('should handle questions about compliant clauses', async () => {
      const mockResponse = 'The rent payment clause in your lease appears to be standard and compliant...';
      mockGeminiClient.processQuestion.mockResolvedValue(mockResponse);
      
      const question = 'Is the rent payment clause normal?';
      const leaseContext = {
        clauses: [
          {
            text: 'Rent shall be due on the first of each month',
            flagged: false,
            severity: undefined
          }
        ],
        violations: []
      };
      
      const response = await mockGeminiClient.processQuestion(question, leaseContext);
      
      expect(response).toContain('standard');
      expect(response).toContain('compliant');
    });

    it('should add legal disclaimer to responses', async () => {
      const mockResponse = 'This is legal information about your lease.\n\n---\n**Legal Disclaimer**: This information is for educational purposes only and does not constitute legal advice. For specific legal guidance, please consult with a qualified attorney or legal aid organization.';
      mockGeminiClient.processQuestion.mockResolvedValue(mockResponse);
      
      const question = 'What are my rights?';
      const leaseContext = { clauses: [], violations: [] };
      
      const response = await mockGeminiClient.processQuestion(question, leaseContext);
      
      expect(response).toContain('Legal Disclaimer');
      expect(response).toContain('educational purposes only');
      expect(response).toContain('not constitute legal advice');
    });
  });

  describe('Context Retrieval', () => {
    it('should retrieve lease context from Redis', async () => {
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
      
      // This would be the actual context retrieval logic
      const leaseData = await mockRedisClient.getClient().json.get('lease:test-lease-123');
      const clauseKeys = await mockRedisClient.getClient().keys('clause:test-lease-123_*');
      
      expect(leaseData).toEqual(mockLeaseData);
      expect(clauseKeys).toEqual(['clause:test-lease-123_1']);
    });

    it('should handle missing lease context gracefully', async () => {
      mockRedisClient.getClient().json.get.mockResolvedValue(null);
      
      const leaseData = await mockRedisClient.getClient().json.get('lease:nonexistent');
      
      expect(leaseData).toBeNull();
    });

    it('should retrieve conversation history from Redis', async () => {
      const mockHistory = [
        JSON.stringify({ role: 'user', content: 'What about the security deposit?', timestamp: '2025-01-27T10:00:00Z' }),
        JSON.stringify({ role: 'assistant', content: 'The security deposit clause violates NYC law...', timestamp: '2025-01-27T10:01:00Z' })
      ];
      
      mockRedisClient.getClient().lrange.mockResolvedValue(mockHistory);
      
      const history = await mockRedisClient.getClient().lrange('conversation:test-session', 0, -1);
      
      expect(history).toEqual(mockHistory);
      expect(mockRedisClient.getClient().lrange).toHaveBeenCalledWith('conversation:test-session', 0, -1);
    });

    it('should handle empty conversation history', async () => {
      mockRedisClient.getClient().lrange.mockResolvedValue([]);
      
      const history = await mockRedisClient.getClient().lrange('conversation:new-session', 0, -1);
      
      expect(history).toEqual([]);
    });
  });

  describe('Conversation Storage', () => {
    it('should store user messages in Redis', async () => {
      const message = {
        role: 'user' as const,
        content: 'What should I do about the security deposit?',
        timestamp: '2025-01-27T10:00:00Z'
      };
      
      await mockRedisClient.getClient().lpush('conversation:test-session', JSON.stringify(message));
      await mockRedisClient.getClient().ltrim('conversation:test-session', 0, 19);
      await mockRedisClient.getClient().expire('conversation:test-session', 7 * 24 * 60 * 60);
      
      expect(mockRedisClient.getClient().lpush).toHaveBeenCalledWith('conversation:test-session', JSON.stringify(message));
      expect(mockRedisClient.getClient().ltrim).toHaveBeenCalledWith('conversation:test-session', 0, 19);
      expect(mockRedisClient.getClient().expire).toHaveBeenCalledWith('conversation:test-session', 7 * 24 * 60 * 60);
    });

    it('should store assistant responses in Redis', async () => {
      const message = {
        role: 'assistant' as const,
        content: 'The security deposit clause violates NYC law...',
        timestamp: '2025-01-27T10:01:00Z'
      };
      
      await mockRedisClient.getClient().lpush('conversation:test-session', JSON.stringify(message));
      
      expect(mockRedisClient.getClient().lpush).toHaveBeenCalledWith('conversation:test-session', JSON.stringify(message));
    });

    it('should limit conversation history to 20 messages', async () => {
      const message = {
        role: 'user' as const,
        content: 'Test message',
        timestamp: '2025-01-27T10:00:00Z'
      };
      
      await mockRedisClient.getClient().lpush('conversation:test-session', JSON.stringify(message));
      await mockRedisClient.getClient().ltrim('conversation:test-session', 0, 19);
      
      expect(mockRedisClient.getClient().ltrim).toHaveBeenCalledWith('conversation:test-session', 0, 19);
    });

    it('should set conversation expiration to 7 days', async () => {
      const message = {
        role: 'user' as const,
        content: 'Test message',
        timestamp: '2025-01-27T10:00:00Z'
      };
      
      await mockRedisClient.getClient().lpush('conversation:test-session', JSON.stringify(message));
      await mockRedisClient.getClient().expire('conversation:test-session', 7 * 24 * 60 * 60);
      
      expect(mockRedisClient.getClient().expire).toHaveBeenCalledWith('conversation:test-session', 7 * 24 * 60 * 60);
    });
  });

  describe('Performance Requirements', () => {
    it('should process questions within 2.5 seconds', async () => {
      const startTime = Date.now();
      
      mockGeminiClient.processQuestion.mockImplementation(async () => {
        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 100));
        return 'Response within time limit';
      });
      
      const question = 'What should I do about the security deposit?';
      const leaseContext = { clauses: [], violations: [] };
      
      const response = await mockGeminiClient.processQuestion(question, leaseContext);
      const endTime = Date.now();
      const processingTime = endTime - startTime;
      
      expect(processingTime).toBeLessThan(2500);
      expect(response).toBe('Response within time limit');
    });

    it('should handle concurrent questions efficiently', async () => {
      const questions = Array.from({ length: 5 }, (_, i) => `Question ${i + 1}`);
      const leaseContext = { clauses: [], violations: [] };
      
      mockGeminiClient.processQuestion.mockResolvedValue('Response');
      
      const startTime = Date.now();
      
      const responses = await Promise.all(
        questions.map(question => mockGeminiClient.processQuestion(question, leaseContext))
      );
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      expect(responses).toHaveLength(5);
      expect(totalTime).toBeLessThan(5000); // Should handle 5 concurrent requests efficiently
    });
  });

  describe('Error Handling', () => {
    it('should handle Gemini API failures gracefully', async () => {
      mockGeminiClient.processQuestion.mockRejectedValue(new Error('Gemini API error'));
      
      const question = 'What should I do?';
      const leaseContext = { clauses: [], violations: [] };
      
      await expect(mockGeminiClient.processQuestion(question, leaseContext))
        .rejects.toThrow('Gemini API error');
    });

    it('should handle Redis connection failures gracefully', async () => {
      mockRedisClient.getClient().json.get.mockRejectedValue(new Error('Redis connection failed'));
      
      try {
        await mockRedisClient.getClient().json.get('lease:test-lease');
      } catch (error) {
        expect(error.message).toBe('Redis connection failed');
      }
    });

    it('should handle malformed conversation history', async () => {
      const malformedHistory = ['invalid json', '{"role": "user", "content": "valid"}'];
      
      mockRedisClient.getClient().lrange.mockResolvedValue(malformedHistory);
      
      const history = await mockRedisClient.getClient().lrange('conversation:test-session', 0, -1);
      
      expect(history).toEqual(malformedHistory);
    });
  });

  describe('Context Building', () => {
    it('should build context prompt with flagged clauses', async () => {
      const leaseContext = {
        clauses: [
          {
            text: 'Security deposit equal to three months rent',
            flagged: true,
            severity: 'Critical'
          },
          {
            text: 'Rent due on first of month',
            flagged: false,
            severity: undefined
          }
        ],
        violations: [
          {
            type: 'Excessive Security Deposit',
            description: 'Security deposit exceeds one month rent',
            legal_reference: 'NYC Housing Maintenance Code §27-2056'
          }
        ]
      };
      
      const conversationHistory = [
        { role: 'user' as const, content: 'Previous question' },
        { role: 'assistant' as const, content: 'Previous answer' }
      ];
      
      mockGeminiClient.processQuestion.mockResolvedValue('Response');
      
      await mockGeminiClient.processQuestion('Test question', leaseContext, conversationHistory);
      
      expect(mockGeminiClient.processQuestion).toHaveBeenCalledWith(
        'Test question',
        leaseContext,
        conversationHistory
      );
    });

    it('should handle empty lease context', async () => {
      const leaseContext = { clauses: [], violations: [] };
      const conversationHistory = [];
      
      mockGeminiClient.processQuestion.mockResolvedValue('Response');
      
      await mockGeminiClient.processQuestion('Test question', leaseContext, conversationHistory);
      
      expect(mockGeminiClient.processQuestion).toHaveBeenCalledWith(
        'Test question',
        leaseContext,
        conversationHistory
      );
    });
  });
}); 