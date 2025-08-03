import documentProcessor from '../document-processor';
import geminiClient from '../gemini';
import redisClient from '../redis';
import { getAllViolationPatterns } from '../housing-law-database';

// Mock dependencies for integration testing
jest.mock('../gemini');
jest.mock('../redis');
jest.mock('../housing-law-database');

const mockGeminiClient = geminiClient as jest.Mocked<typeof geminiClient>;
const mockRedisClient = redisClient as jest.Mocked<typeof redisClient>;

describe('DocumentProcessor Integration Tests', () => {
  const sampleLeaseText = `
    RESIDENTIAL LEASE AGREEMENT
    
    ARTICLE 1: RENT PAYMENT
    Tenant agrees to pay monthly rent of $2,500 due on the first of each month.
    
    ARTICLE 2: SECURITY DEPOSIT
    Tenant shall provide a security deposit equal to three months' rent ($7,500).
    
    ARTICLE 3: REPAIRS AND MAINTENANCE
    Tenant waives any claims for repairs and maintenance of the premises.
    
    ARTICLE 4: LANDLORD ENTRY
    Landlord may enter premises at any time without notice.
    
    ARTICLE 5: TERMINATION
    Tenant waives right to contest eviction in court.
  `;

  const mockExtractedClauses = [
    { text: 'Tenant agrees to pay monthly rent of $2,500 due on the first of each month.', section: 'Rent & Payment' },
    { text: 'Tenant shall provide a security deposit equal to three months\' rent ($7,500).', section: 'Security Deposit' },
    { text: 'Tenant waives any claims for repairs and maintenance of the premises.', section: 'Repairs & Maintenance' },
    { text: 'Landlord may enter premises at any time without notice.', section: 'Landlord Entry' },
    { text: 'Tenant waives right to contest eviction in court.', section: 'Termination & Eviction' }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock Redis client
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

    // Mock Gemini client
    mockGeminiClient.extractClauses.mockResolvedValue(mockExtractedClauses);
    mockGeminiClient.generateEmbedding.mockResolvedValue([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]);

    // Mock housing law database with valid JavaScript regex patterns
    (getAllViolationPatterns as jest.Mock).mockReturnValue([
      {
        id: 'CRIT-001',
        violation_type: 'Excessive Security Deposit',
        severity: 'Critical',
        illegal_clause_pattern: 'Security deposit exceeding one month\'s rent',
        description: 'Any lease clause requiring security deposit greater than one month\'s rent',
        legal_violation: 'NYC Housing Maintenance Code §27-2056',
        example_illegal_clause: 'Tenant agrees to pay security deposit equal to two months\' rent',
        legal_standard: 'Maximum security deposit is one month\'s rent',
        penalties: 'Tenant can recover excess amount plus interest',
        detection_regex: '(security\\s+deposit|deposit).*(?:two|2|three|3|four|4).*(month|rent)',
        source: 'https://rentguidelinesboard.cityofnewyork.us/resources/faqs/security-deposits/',
        hpd_violation_code: 'SEC-DEP-01'
      },
      {
        id: 'CRIT-002',
        violation_type: 'Repair Responsibility Waiver',
        severity: 'Critical',
        illegal_clause_pattern: 'Waiving landlord\'s duty to maintain premises',
        description: 'Clauses that require tenant to waive landlord\'s obligation to maintain habitability',
        legal_violation: 'NYC Housing Maintenance Code Article 1, Warranty of Habitability',
        example_illegal_clause: 'Tenant waives any claims for repairs and maintenance',
        legal_standard: 'Landlord cannot waive duty to maintain habitable conditions',
        penalties: 'Clause is void; tenant retains all habitability rights',
        detection_regex: '(waive|waiver|waiving).*(repair|maintenance|habitab|condition)',
        source: 'NY Real Property Law §235-b',
        hpd_violation_code: 'HAB-WAIV-01'
      },
      {
        id: 'CRIT-003',
        violation_type: 'Right to Court Waiver',
        severity: 'Critical',
        illegal_clause_pattern: 'Waiving tenant\'s right to court proceedings',
        description: 'Clauses requiring tenant to waive right to appear in housing court',
        legal_violation: 'Due Process Clause, RPAPL',
        example_illegal_clause: 'Tenant waives right to contest eviction in court',
        legal_standard: 'Constitutional right to due process cannot be waived',
        penalties: 'Clause is void and unenforceable',
        detection_regex: '(waive|waiver).*(court|legal|proceeding|contest)',
        source: 'US Constitution 14th Amendment, NY Constitution',
        hpd_violation_code: 'COURT-WAIV-01'
      }
    ]);
  });

  describe('Complete Document Processing Pipeline', () => {
    it('should process a lease document and detect violations', async () => {
      const leaseFile = new File([sampleLeaseText], 'lease.pdf', { type: 'application/pdf' });
      const leaseId = 'integration-test-lease-123';

      // Mock text extraction
      const extractTextSpy = jest.spyOn(documentProcessor as any, 'extractText')
        .mockResolvedValue(sampleLeaseText);

      const result = await documentProcessor.processDocument(leaseFile, leaseId);

      // Verify the complete pipeline
      expect(result.leaseId).toBe(leaseId);
      expect(result.clauses).toHaveLength(5); // Should process all 5 clauses
      expect(result.violations.length).toBeGreaterThan(0); // Should detect at least some violations

      // Verify clause processing
      const securityDepositClause = result.clauses.find(c => c.text.includes('security deposit'));
      expect(securityDepositClause).toBeDefined();

      const repairWaiverClause = result.clauses.find(c => c.text.includes('waives any claims for repairs'));
      expect(repairWaiverClause).toBeDefined();

      const courtWaiverClause = result.clauses.find(c => c.text.includes('waives right to contest eviction'));
      expect(courtWaiverClause).toBeDefined();

      // Verify summary statistics
      expect(result.summary.totalClauses).toBe(5);
      expect(result.summary.flaggedClauses).toBeGreaterThan(0);
      expect(result.summary.criticalViolations).toBeGreaterThan(0);

      // Verify Redis storage was called
      expect(mockRedisClient.getClient().json.set).toHaveBeenCalled();
      expect(mockRedisClient.getClient().expire).toHaveBeenCalled();

      // Verify Gemini integration
      expect(mockGeminiClient.extractClauses).toHaveBeenCalledWith(sampleLeaseText);
      expect(mockGeminiClient.generateEmbedding).toHaveBeenCalled();

      extractTextSpy.mockRestore();
    });

    it('should handle a lease with no violations', async () => {
      const cleanLeaseText = `
        RESIDENTIAL LEASE AGREEMENT
        
        ARTICLE 1: RENT PAYMENT
        Tenant agrees to pay monthly rent of $2,000 due on the first of each month.
        
        ARTICLE 2: SECURITY DEPOSIT
        Tenant shall provide a security deposit equal to one month's rent ($2,000).
        
        ARTICLE 3: REPAIRS AND MAINTENANCE
        Landlord is responsible for maintaining the premises in habitable condition.
      `;

      const cleanExtractedClauses = [
        { text: 'Tenant agrees to pay monthly rent of $2,000 due on the first of each month.', section: 'Rent & Payment' },
        { text: 'Tenant shall provide a security deposit equal to one month\'s rent ($2,000).', section: 'Security Deposit' },
        { text: 'Landlord is responsible for maintaining the premises in habitable condition.', section: 'Repairs & Maintenance' }
      ];

      mockGeminiClient.extractClauses.mockResolvedValue(cleanExtractedClauses);

      const leaseFile = new File([cleanLeaseText], 'clean-lease.pdf', { type: 'application/pdf' });
      const leaseId = 'clean-lease-test-123';

      const extractTextSpy = jest.spyOn(documentProcessor as any, 'extractText')
        .mockResolvedValue(cleanLeaseText);

      const result = await documentProcessor.processDocument(leaseFile, leaseId);

      // Verify processing completed successfully
      expect(result.leaseId).toBe(leaseId);
      expect(result.clauses).toHaveLength(3);
      expect(result.summary.totalClauses).toBe(3);

      // Verify all clauses are processed
      result.clauses.forEach(clause => {
        expect(clause.id).toBeDefined();
        expect(clause.text).toBeDefined();
        expect(clause.section).toBeDefined();
        expect(clause.vector).toBeDefined();
        expect(clause.metadata.leaseId).toBe(leaseId);
      });

      extractTextSpy.mockRestore();
    });

    it('should process image files with OCR', async () => {
      const imageLeaseText = 'Tenant agrees to pay monthly rent of $2,000.';
      const imageExtractedClauses = [
        { text: 'Tenant agrees to pay monthly rent of $2,000.', section: 'Rent & Payment' }
      ];

      mockGeminiClient.extractClauses.mockResolvedValue(imageExtractedClauses);

      const imageFile = new File(['image data'], 'lease.jpg', { type: 'image/jpeg' });
      const leaseId = 'image-lease-test-123';

      const extractTextSpy = jest.spyOn(documentProcessor as any, 'extractText')
        .mockResolvedValue(imageLeaseText);

      const result = await documentProcessor.processDocument(imageFile, leaseId);

      expect(result.leaseId).toBe(leaseId);
      expect(result.clauses).toHaveLength(1);
      expect(extractTextSpy).toHaveBeenCalledWith(imageFile);

      extractTextSpy.mockRestore();
    });

    it('should handle large documents with pagination', async () => {
      const largeLeaseText = 'Large lease document content. '.repeat(1000);
      const largeExtractedClauses = Array.from({ length: 20 }, (_, i) => ({
        text: `Clause ${i + 1}: Sample lease clause content.`,
        section: `Section ${i + 1}`
      }));

      mockGeminiClient.extractClauses.mockResolvedValue(largeExtractedClauses);

      const largeFile = new File([largeLeaseText], 'large-lease.pdf', { type: 'application/pdf' });
      const leaseId = 'large-lease-test-123';

      const extractTextSpy = jest.spyOn(documentProcessor as any, 'extractText')
        .mockResolvedValue(largeLeaseText);

      const result = await documentProcessor.processDocument(largeFile, leaseId);

      expect(result.leaseId).toBe(leaseId);
      expect(result.clauses).toHaveLength(20);
      expect(result.summary.totalClauses).toBe(20);
      expect(mockGeminiClient.generateEmbedding).toHaveBeenCalled();

      extractTextSpy.mockRestore();
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should continue processing when some clauses fail embedding generation', async () => {
      const leaseFile = new File([sampleLeaseText], 'lease.pdf', { type: 'application/pdf' });
      const leaseId = 'embedding-error-test-123';

      const extractTextSpy = jest.spyOn(documentProcessor as any, 'extractText')
        .mockResolvedValue(sampleLeaseText);

      // Mock some embedding generations to fail
      mockGeminiClient.generateEmbedding
        .mockResolvedValueOnce([0.1, 0.2, 0.3]) // First call succeeds
        .mockRejectedValueOnce(new Error('Embedding failed')) // Second call fails
        .mockResolvedValueOnce([0.4, 0.5, 0.6]); // Third call succeeds

      const result = await documentProcessor.processDocument(leaseFile, leaseId);

      // Should still process successfully
      expect(result.leaseId).toBe(leaseId);
      expect(result.clauses.length).toBeGreaterThan(0);

      extractTextSpy.mockRestore();
    });

    it('should handle Redis storage failures gracefully', async () => {
      const leaseFile = new File([sampleLeaseText], 'lease.pdf', { type: 'application/pdf' });
      const leaseId = 'redis-error-test-123';

      const extractTextSpy = jest.spyOn(documentProcessor as any, 'extractText')
        .mockResolvedValue(sampleLeaseText);

      // Mock Redis to throw error
      mockRedisClient.getClient.mockReturnValue({
        json: {
          set: jest.fn().mockRejectedValue(new Error('Redis connection failed')),
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

      // Should still return analysis results even if storage fails
      const result = await documentProcessor.processDocument(leaseFile, leaseId);
      
      expect(result.leaseId).toBe(leaseId);
      expect(result.clauses).toHaveLength(5);

      extractTextSpy.mockRestore();
    });
  });

  describe('Performance and Scalability', () => {
    it('should process documents within reasonable time limits', async () => {
      const leaseFile = new File([sampleLeaseText], 'lease.pdf', { type: 'application/pdf' });
      const leaseId = 'performance-test-123';

      const extractTextSpy = jest.spyOn(documentProcessor as any, 'extractText')
        .mockResolvedValue(sampleLeaseText);

      const startTime = Date.now();
      const result = await documentProcessor.processDocument(leaseFile, leaseId);
      const endTime = Date.now();

      const processingTime = endTime - startTime;

      // Should complete within 10 seconds (generous limit for testing)
      expect(processingTime).toBeLessThan(10000);
      expect(result.leaseId).toBe(leaseId);
      expect(result.clauses).toHaveLength(5);

      extractTextSpy.mockRestore();
    });
  });
}); 