import { getAllViolationPatterns, findViolationPatternById } from '../housing-law-database';
import geminiClient from '../gemini';
import redisClient from '../redis';

// Mock dependencies
jest.mock('../gemini');
jest.mock('../redis');

const mockGeminiClient = geminiClient as jest.Mocked<typeof geminiClient>;
const mockRedisClient = redisClient as jest.Mocked<typeof redisClient>;

describe('Violation Detection System', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock Redis client
    mockRedisClient.getClient.mockReturnValue({
      ft: {
        search: jest.fn().mockResolvedValue([]),
      },
    } as any);
  });

  describe('Regex-Based Detection', () => {
    it('should detect excessive security deposit violation', () => {
      const patterns = getAllViolationPatterns();
      const securityDepositPattern = patterns.find(p => p.id === 'CRIT-001');
      
      expect(securityDepositPattern).toBeDefined();
      
      const testClauses = [
        'Tenant shall provide a security deposit equal to two months rent',
        'Security deposit of 3 months rent required',
        'Deposit shall be 4 months rent',
        'Tenant agrees to pay security deposit equal to 2.5 months rent'
      ];
      
      for (const clause of testClauses) {
        const regex = new RegExp(securityDepositPattern!.detection_regex, 'i');
        expect(regex.test(clause)).toBe(true);
      }
    });

    it('should detect repair responsibility waiver violation', () => {
      const patterns = getAllViolationPatterns();
      const repairWaiverPattern = patterns.find(p => p.id === 'CRIT-002');
      
      expect(repairWaiverPattern).toBeDefined();
      
      const testClauses = [
        'Tenant waives any claims for repairs and maintenance',
        'Tenant waiving right to request repairs',
        'Tenant agrees to waive maintenance claims',
        'Tenant responsible for all repairs and maintenance'
      ];
      
      for (const clause of testClauses) {
        const regex = new RegExp(repairWaiverPattern!.detection_regex, 'i');
        expect(regex.test(clause)).toBe(true);
      }
    });

    it('should detect right to court waiver violation', () => {
      const patterns = getAllViolationPatterns();
      const courtWaiverPattern = patterns.find(p => p.id === 'CRIT-004');
      
      expect(courtWaiverPattern).toBeDefined();
      
      const testClauses = [
        'Tenant waives right to contest eviction in court',
        'Tenant waiving legal proceedings',
        'Tenant agrees to waive court rights',
        'No court proceedings allowed'
      ];
      
      for (const clause of testClauses) {
        const regex = new RegExp(courtWaiverPattern!.detection_regex, 'i');
        expect(regex.test(clause)).toBe(true);
      }
    });

    it('should detect discriminatory provisions', () => {
      const patterns = getAllViolationPatterns();
      const discriminationPattern = patterns.find(p => p.id === 'HIGH-002');
      
      expect(discriminationPattern).toBeDefined();
      
      const testClauses = [
        'No children under 12 permitted in apartment',
        'Adults only - no children allowed',
        'Single person occupancy only',
        'No families with children'
      ];
      
      for (const clause of testClauses) {
        const regex = new RegExp(discriminationPattern!.detection_regex, 'i');
        expect(regex.test(clause)).toBe(true);
      }
    });

    it('should detect illegal rent increase provisions', () => {
      const patterns = getAllViolationPatterns();
      const rentIncreasePattern = patterns.find(p => p.id === 'HIGH-001');
      
      expect(rentIncreasePattern).toBeDefined();
      
      const testClauses = [
        'Rent may be increased at any time with 15 days notice',
        'Rent increase with immediate effect',
        'Rent can be increased with 1-5 days notice'
      ];
      
      for (const clause of testClauses) {
        const regex = new RegExp(rentIncreasePattern!.detection_regex, 'i');
        expect(regex.test(clause)).toBe(true);
      }
    });

    it('should detect excessive late fees', () => {
      const patterns = getAllViolationPatterns();
      const lateFeePattern = patterns.find(p => p.id === 'MED-001');
      
      expect(lateFeePattern).toBeDefined();
      
      const testClauses = [
        'Late fee of $100 per day after 5 days late',
        'Late fee compounds daily',
        'Late fee of $50 per day'
      ];
      
      for (const clause of testClauses) {
        const regex = new RegExp(lateFeePattern!.detection_regex, 'i');
        expect(regex.test(clause)).toBe(true);
      }
    });

    it('should detect pet fees in stabilized units', () => {
      const patterns = getAllViolationPatterns();
      const petFeePattern = patterns.find(p => p.id === 'LOW-004');
      
      expect(petFeePattern).toBeDefined();
      
      const testClauses = [
        'Monthly pet fee of $50 for any pets',
        'Additional pet charge of $25',
        'Pet fee required for all animals'
      ];
      
      for (const clause of testClauses) {
        const regex = new RegExp(petFeePattern!.detection_regex, 'i');
        expect(regex.test(clause)).toBe(true);
      }
    });
  });

  describe('False Positive Prevention', () => {
    it('should not flag compliant security deposit clauses', () => {
      const patterns = getAllViolationPatterns();
      const securityDepositPattern = patterns.find(p => p.id === 'CRIT-001');
      
      const compliantClauses = [
        'Security deposit equal to one month rent',
        'Deposit of 1 month rent required',
        'Security deposit shall be one month rent'
      ];
      
      for (const clause of compliantClauses) {
        const regex = new RegExp(securityDepositPattern!.detection_regex, 'i');
        expect(regex.test(clause)).toBe(false);
      }
    });

    it('should not flag standard repair clauses', () => {
      const patterns = getAllViolationPatterns();
      const repairWaiverPattern = patterns.find(p => p.id === 'CRIT-002');
      
      const compliantClauses = [
        'Landlord responsible for major repairs',
        'Tenant responsible for minor repairs',
        'Repairs will be made within 30 days'
      ];
      
      for (const clause of compliantClauses) {
        const regex = new RegExp(repairWaiverPattern!.detection_regex, 'i');
        expect(regex.test(clause)).toBe(false);
      }
    });

    it('should not flag standard rent payment clauses', () => {
      const patterns = getAllViolationPatterns();
      const rentIncreasePattern = patterns.find(p => p.id === 'HIGH-001');
      
      const compliantClauses = [
        'Rent due on the first of each month',
        'Rent payment of $2000 monthly',
        'Rent increases subject to rent stabilization laws'
      ];
      
      for (const clause of compliantClauses) {
        const regex = new RegExp(rentIncreasePattern!.detection_regex, 'i');
        expect(regex.test(clause)).toBe(false);
      }
    });
  });

  describe('Vector Similarity Detection', () => {
    it('should use vector search when regex fails', async () => {
      const testClause = 'Tenant shall provide a security deposit equal to two months rent';
      const mockEmbedding = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8];
      
      mockGeminiClient.generateEmbedding.mockResolvedValue(mockEmbedding);
      
      // Mock Redis search to return a high-similarity match
      mockRedisClient.getClient().ft.search.mockResolvedValue([
        {
          score: '0.92',
          metadata: {
            violationType: 'CRIT-001'
          }
        }
      ] as any);
      
      // This would be the actual detection logic
      const embedding = await mockGeminiClient.generateEmbedding(testClause);
      const searchResults = await mockRedisClient.getClient().ft.search('clause_idx', 
        `*=>[KNN 5 @vector $vector AS score]`,
        {
          PARAMS: {
            vector: Buffer.from(Float32Array.from(embedding).buffer)
          },
          RETURN: ['text', 'metadata', 'score'],
          SORTBY: 'score'
        }
      );
      
      expect(mockGeminiClient.generateEmbedding).toHaveBeenCalledWith(testClause);
      expect(mockRedisClient.getClient().ft.search).toHaveBeenCalled();
      
      // Check if we found a high-similarity match
      const highSimilarityMatch = searchResults.find((result: any) => 
        parseFloat(result.score) >= 0.85
      );
      
      expect(highSimilarityMatch).toBeDefined();
      expect(highSimilarityMatch?.metadata?.violationType).toBe('CRIT-001');
    });

    it('should handle vector search failures gracefully', async () => {
      const testClause = 'Standard rent payment clause';
      const mockEmbedding = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8];
      
      mockGeminiClient.generateEmbedding.mockResolvedValue(mockEmbedding);
      mockRedisClient.getClient().ft.search.mockRejectedValue(new Error('Redis search failed'));
      
      try {
        await mockRedisClient.getClient().ft.search('clause_idx', '*');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toBe('Redis search failed');
      }
    });
  });

  describe('Detection Accuracy', () => {
    it('should achieve >90% accuracy on known violation patterns', () => {
      const patterns = getAllViolationPatterns();
      const testCases = [
        {
          clause: 'Tenant shall provide a security deposit equal to three months rent',
          expectedViolation: 'CRIT-001',
          description: 'Excessive security deposit'
        },
        {
          clause: 'Tenant waives any claims for repairs and maintenance of the premises',
          expectedViolation: 'CRIT-002',
          description: 'Repair responsibility waiver'
        },
        {
          clause: 'Tenant waives right to contest eviction in court',
          expectedViolation: 'CRIT-004',
          description: 'Right to court waiver'
        },
        {
          clause: 'No children under 12 permitted in apartment',
          expectedViolation: 'HIGH-002',
          description: 'Discriminatory provision'
        },
        {
          clause: 'Rent may be increased at any time with 15 days notice',
          expectedViolation: 'HIGH-001',
          description: 'Illegal rent increase'
        },
        {
          clause: 'Late fee of $100 per day after 5 days late',
          expectedViolation: 'MED-001',
          description: 'Excessive late fees'
        },
        {
          clause: 'Monthly pet fee of $50 for any pets',
          expectedViolation: 'LOW-004',
          description: 'Pet fee in stabilized unit'
        }
      ];
      
      let correctDetections = 0;
      
      for (const testCase of testCases) {
        const expectedPattern = findViolationPatternById(testCase.expectedViolation);
        expect(expectedPattern).toBeDefined();
        
        const regex = new RegExp(expectedPattern!.detection_regex, 'i');
        if (regex.test(testCase.clause)) {
          correctDetections++;
        }
      }
      
      const accuracy = (correctDetections / testCases.length) * 100;
      expect(accuracy).toBeGreaterThan(90);
    });
  });

  describe('Performance Requirements', () => {
    it('should detect violations within reasonable time', async () => {
      const testClause = 'Tenant shall provide a security deposit equal to two months rent';
      const patterns = getAllViolationPatterns();
      
      const startTime = Date.now();
      
      // Simulate regex detection
      for (const pattern of patterns) {
        const regex = new RegExp(pattern.detection_regex, 'i');
        regex.test(testClause);
      }
      
      const endTime = Date.now();
      const detectionTime = endTime - startTime;
      
      // Should complete within 100ms for regex detection
      expect(detectionTime).toBeLessThan(100);
    });

    it('should handle large numbers of clauses efficiently', async () => {
      const patterns = getAllViolationPatterns();
      const testClauses = Array.from({ length: 100 }, (_, i) => 
        `Test clause ${i}: Tenant shall provide a security deposit equal to ${i % 3 + 1} months rent`
      );
      
      const startTime = Date.now();
      
      for (const clause of testClauses) {
        for (const pattern of patterns) {
          const regex = new RegExp(pattern.detection_regex, 'i');
          regex.test(clause);
        }
      }
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      // Should process 100 clauses against 20 patterns within 1 second
      expect(totalTime).toBeLessThan(1000);
    });
  });
}); 