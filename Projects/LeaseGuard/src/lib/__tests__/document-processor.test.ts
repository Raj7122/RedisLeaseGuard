import documentProcessor from '../document-processor';
import geminiClient from '../gemini';
import redisClient from '../redis';
import { ViolationPattern } from '../housing-law-database';

// Mock dependencies
jest.mock('../gemini');
jest.mock('../redis');
jest.mock('../housing-law-database');

const mockGeminiClient = geminiClient as jest.Mocked<typeof geminiClient>;
const mockRedisClient = redisClient as jest.Mocked<typeof redisClient>;

describe('DocumentProcessor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock Redis client methods
    mockRedisClient.getClient.mockReturnValue({
      json: {
        set: jest.fn().mockResolvedValue(undefined),
        get: jest.fn().mockResolvedValue(null),
      },
      expire: jest.fn().mockResolvedValue(undefined),
      ft: {
        search: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue(undefined),
        info: jest.fn().mockResolvedValue(false),
      },
      ping: jest.fn().mockResolvedValue('PONG'),
    } as any);
  });

  describe('validateFile', () => {
    it('should validate PDF files correctly', () => {
      const pdfFile = new File(['test'], 'lease.pdf', { type: 'application/pdf' });
      const result = documentProcessor.validateFile(pdfFile);
      
      expect(result.valid).toBe(true);
      expect(result.error).toBeNull(); // Fixed: actual implementation returns null, not undefined
    });

    it('should validate image files correctly', () => {
      const imageFile = new File(['test'], 'lease.jpg', { type: 'image/jpeg' });
      const result = documentProcessor.validateFile(imageFile);
      
      expect(result.valid).toBe(true);
      expect(result.error).toBeNull(); // Fixed: actual implementation returns null, not undefined
    });

    it('should reject files larger than 10MB', () => {
      const largeFile = new File(['x'.repeat(11 * 1024 * 1024)], 'large.pdf', { type: 'application/pdf' });
      const result = documentProcessor.validateFile(largeFile);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('File size must be less than 10MB');
    });

    it('should reject unsupported file types', () => {
      const unsupportedFile = new File(['test'], 'lease.txt', { type: 'text/plain' });
      const result = documentProcessor.validateFile(unsupportedFile);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('File type not supported. Please upload a PDF or image file.');
    });
  });

  describe('healthCheck', () => {
    it('should return health status when Tesseract is available', async () => {
      const result = await documentProcessor.healthCheck();
      expect(typeof result).toBe('boolean'); // Fixed: expect boolean, not specific value
      expect(result).toBe(true); // Should be true when Tesseract is available
    });
  });

  describe('processDocument', () => {
    const mockLeaseId = 'test-lease-123';
    const mockExtractedText = 'This is a sample lease agreement. Rent is $2000 per month.';
    const mockExtractedClauses = [
      { text: 'Rent is $2000 per month', section: 'rent_payment' },
      { text: 'Security deposit is $3000', section: 'security_deposit' }
    ];
    const mockProcessedClauses = [
      {
        id: 'test-lease-123_0',
        text: 'Rent is $2000 per month',
        section: 'rent_payment',
        vector: [0.1, 0.2, 0.3],
        metadata: {
          leaseId: mockLeaseId,
          flagged: false,
          confidence: 0.0
        }
      },
      {
        id: 'test-lease-123_1',
        text: 'Security deposit is $3000',
        section: 'security_deposit',
        vector: [0.4, 0.5, 0.6],
        metadata: {
          leaseId: mockLeaseId,
          flagged: true,
          severity: 'Critical',
          violationType: 'security_deposit_violation',
          legalReference: 'NYC Housing Maintenance Code §27-2056',
          confidence: 0.85
        }
      }
    ];

    beforeEach(() => {
      // Mock Gemini client methods
      mockGeminiClient.extractClauses.mockResolvedValue(mockExtractedClauses);
      mockGeminiClient.generateEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
    });

    it('should process a valid PDF document successfully', async () => {
      const pdfFile = new File(['test pdf content'], 'lease.pdf', { type: 'application/pdf' });
      
      // Mock the extractText method to return our test text
      const extractTextSpy = jest.spyOn(documentProcessor as any, 'extractText')
        .mockResolvedValue(mockExtractedText);

      const result = await documentProcessor.processDocument(pdfFile, mockLeaseId);

      // Verify the result structure
      expect(result.leaseId).toBe(mockLeaseId);
      expect(result.clauses).toHaveLength(2);
      expect(result.violations).toHaveLength(1); // Should detect 1 violation
      expect(result.summary.totalClauses).toBe(2);
      expect(result.summary.flaggedClauses).toBe(1);
      expect(result.summary.criticalViolations).toBe(1);

      // Verify method calls
      expect(extractTextSpy).toHaveBeenCalledWith(pdfFile);
      expect(mockGeminiClient.extractClauses).toHaveBeenCalledWith(mockExtractedText);

      // Clean up spies
      extractTextSpy.mockRestore();
    });

    it('should process a valid image document successfully', async () => {
      const imageFile = new File(['test image content'], 'lease.jpg', { type: 'image/jpeg' });
      
      const extractTextSpy = jest.spyOn(documentProcessor as any, 'extractText')
        .mockResolvedValue(mockExtractedText);

      const result = await documentProcessor.processDocument(imageFile, mockLeaseId);

      expect(result.leaseId).toBe(mockLeaseId);
      expect(extractTextSpy).toHaveBeenCalledWith(imageFile);

      // Clean up spies
      extractTextSpy.mockRestore();
    });

    it('should throw error for unsupported file type', async () => {
      const unsupportedFile = new File(['test'], 'lease.txt', { type: 'text/plain' });
      
      await expect(documentProcessor.processDocument(unsupportedFile, mockLeaseId))
        .rejects.toThrow('Unsupported file type. Please upload a PDF or image file.');
    });

    it('should handle Gemini client errors gracefully', async () => {
      const pdfFile = new File(['test'], 'lease.pdf', { type: 'application/pdf' });
      
      const extractTextSpy = jest.spyOn(documentProcessor as any, 'extractText')
        .mockResolvedValue(mockExtractedText);
      
      // Mock Gemini client to throw error
      mockGeminiClient.extractClauses.mockRejectedValue(new Error('Gemini API error'));

      await expect(documentProcessor.processDocument(pdfFile, mockLeaseId))
        .rejects.toThrow('Failed to process document: Gemini API error');

      extractTextSpy.mockRestore();
    });

    it('should handle Redis storage errors gracefully', async () => {
      const pdfFile = new File(['test'], 'lease.pdf', { type: 'application/pdf' });
      
      const extractTextSpy = jest.spyOn(documentProcessor as any, 'extractText')
        .mockResolvedValue(mockExtractedText);
      
      // Mock Redis to throw error
      mockRedisClient.getClient.mockReturnValue({
        json: {
          set: jest.fn().mockRejectedValue(new Error('Redis error')),
          get: jest.fn().mockResolvedValue(null),
        },
        expire: jest.fn().mockResolvedValue(undefined),
        ft: {
          search: jest.fn().mockResolvedValue([]),
          create: jest.fn().mockResolvedValue(undefined),
          info: jest.fn().mockResolvedValue(false),
        },
        ping: jest.fn().mockResolvedValue('PONG'),
      } as any);

      // Should still process successfully even if Redis fails
      const result = await documentProcessor.processDocument(pdfFile, mockLeaseId);
      
      expect(result.leaseId).toBe(mockLeaseId);
      expect(result.clauses).toHaveLength(2);

      extractTextSpy.mockRestore();
    });
  });

  describe('generateSummary', () => {
    it('should generate correct summary statistics', () => {
      const clauses = [
        {
          id: '1',
          text: 'Sample clause 1',
          section: 'Rent',
          vector: [0.1, 0.2, 0.3],
          metadata: {
            leaseId: 'test-lease-123',
            flagged: false,
            confidence: 0.9
          }
        },
        {
          id: '2',
          text: 'Sample clause 2',
          section: 'Security Deposit',
          vector: [0.4, 0.5, 0.6],
          metadata: {
            leaseId: 'test-lease-123',
            flagged: true,
            severity: 'Critical',
            violationType: 'security_deposit_violation',
            legalReference: 'NYC Housing Maintenance Code §27-2056',
            confidence: 0.85
          }
        }
      ];

      const violations = [
        {
          clauseId: '2',
          type: 'security_deposit_violation',
          description: 'Security deposit exceeds legal limit',
          legalReference: 'NYC Housing Maintenance Code §27-2056',
          severity: 'Critical' as const
        }
      ];

      // Use the private method through reflection
      const generateSummaryMethod = (documentProcessor as any).generateSummary.bind(documentProcessor);
      const summary = generateSummaryMethod(clauses, violations);

      expect(summary.totalClauses).toBe(2);
      expect(summary.flaggedClauses).toBe(1);
      expect(summary.criticalViolations).toBe(1); // Fixed: should be 1, not 0
      expect(summary.highViolations).toBe(0);
      expect(summary.mediumViolations).toBe(0);
      expect(summary.lowViolations).toBe(0);
    });
  });
}); 