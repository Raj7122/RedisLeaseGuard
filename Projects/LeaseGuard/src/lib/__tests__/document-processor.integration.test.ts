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
    it('should process a lease document and detect multiple violations', async () => {
      const leaseFile = new File([sampleLeaseText], 'lease.pdf', { type: 'application/pdf' });
      const leaseId = 'integration-test-lease-123';

      // Mock text extraction
      const extractTextSpy = jest.spyOn(documentProcessor as any, 'extractTextFromPDF')
        .mockResolvedValue(sampleLeaseText);

      const result = await documentProcessor.processDocument(leaseFile, leaseId);

      // Verify the complete pipeline
      expect(result.leaseId).toBe(leaseId);
      expect(result.clauses).toHaveLength(5);
      expect(result.violations).toHaveLength(3); // Should detect 3 critical violations

      // Verify clause processing
      const securityDepositClause = result.clauses.find(c => c.text.includes('security deposit'));
      expect(securityDepositClause).toBeDefined();
      expect(securityDepositClause?.metadata.flagged).toBe(true);
      expect(securityDepositClause?.metadata.severity).toBe('Critical');

      const repairWaiverClause = result.clauses.find(c => c.text.includes('waives any claims for repairs'));
      expect(repairWaiverClause).toBeDefined();
      expect(repairWaiverClause?.metadata.flagged).toBe(true);
      expect(repairWaiverClause?.metadata.severity).toBe('Critical');

      const courtWaiverClause = result.clauses.find(c => c.text.includes('waives right to contest eviction'));
      expect(courtWaiverClause).toBeDefined();
      expect(courtWaiverClause?.metadata.flagged).toBe(true);
      expect(courtWaiverClause?.metadata.severity).toBe('Critical');

      // Verify summary statistics
      expect(result.summary.totalClauses).toBe(5);
      expect(result.summary.flaggedClauses).toBe(3);
      expect(result.summary.criticalViolations).toBe(3);
      expect(result.summary.highViolations).toBe(0);
      expect(result.summary.mediumViolations).toBe(0);
      expect(result.summary.lowViolations).toBe(0);

      // Verify Redis storage was called
      expect(mockRedisClient.getClient().json.set).toHaveBeenCalledTimes(6); // 5 clauses + 1 lease metadata
      expect(mockRedisClient.getClient().expire).toHaveBeenCalledTimes(5); // 5 clauses with expiration

      // Verify Gemini integration
      expect(mockGeminiClient.extractClauses).toHaveBeenCalledWith(sampleLeaseText);
      // Note: generateEmbedding is called for each clause during processing
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

      const extractTextSpy = jest.spyOn(documentProcessor as any, 'extractTextFromPDF')
        .mockResolvedValue(cleanLeaseText);

      const result = await documentProcessor.processDocument(leaseFile, leaseId);

      // Verify no violations detected
      expect(result.violations).toHaveLength(0);
      expect(result.summary.flaggedClauses).toBe(0);
      expect(result.summary.criticalViolations).toBe(0);

      // Verify all clauses are marked as compliant
      result.clauses.forEach(clause => {
        expect(clause.metadata.flagged).toBe(false);
        expect(clause.metadata.confidence).toBe(0.0);
      });

      extractTextSpy.mockRestore();
    });

    it('should process image files with OCR', async () => {
      const imageLeaseText = 'This is a scanned lease document with rent terms.';
      const imageExtractedClauses = [
        { text: 'This is a scanned lease document with rent terms.', section: 'General' }
      ];

      mockGeminiClient.extractClauses.mockResolvedValue(imageExtractedClauses);

      const imageFile = new File(['image data'], 'lease.jpg', { type: 'image/jpeg' });
      const leaseId = 'image-lease-test-123';

      const extractTextSpy = jest.spyOn(documentProcessor as any, 'extractTextFromImage')
        .mockResolvedValue(imageLeaseText);

      const result = await documentProcessor.processDocument(imageFile, leaseId);

      expect(result.leaseId).toBe(leaseId);
      expect(result.clauses).toHaveLength(1);
      expect(extractTextSpy).toHaveBeenCalledWith(imageFile);

      extractTextSpy.mockRestore();
    });

    it('should handle large documents with pagination', async () => {
      // Create a large document that would trigger pagination
      const largeLeaseText = 'Large lease document. '.repeat(1000); // ~20,000 characters
      const largeExtractedClauses = Array.from({ length: 20 }, (_, i) => ({
        text: `Clause ${i + 1}: This is a sample clause in the large lease document.`,
        section: 'General'
      }));

      mockGeminiClient.extractClauses.mockResolvedValue(largeExtractedClauses);

      const largeFile = new File([largeLeaseText], 'large-lease.pdf', { type: 'application/pdf' });
      const leaseId = 'large-lease-test-123';

      const extractTextSpy = jest.spyOn(documentProcessor as any, 'extractTextFromPDF')
        .mockResolvedValue(largeLeaseText);

      const result = await documentProcessor.processDocument(largeFile, leaseId);

      expect(result.clauses).toHaveLength(20);
      expect(result.summary.totalClauses).toBe(20);
      // Note: generateEmbedding is called for each clause during processing
      expect(mockGeminiClient.generateEmbedding).toHaveBeenCalled();

      extractTextSpy.mockRestore();
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should continue processing when some clauses fail embedding generation', async () => {
      const leaseFile = new File([sampleLeaseText], 'lease.pdf', { type: 'application/pdf' });
      const leaseId = 'error-test-lease-123';

      const extractTextSpy = jest.spyOn(documentProcessor as any, 'extractTextFromPDF')
        .mockResolvedValue(sampleLeaseText);

      // Mock embedding generation to fail for some clauses
      mockGeminiClient.generateEmbedding
        .mockResolvedValueOnce([0.1, 0.2, 0.3]) // First clause succeeds
        .mockRejectedValueOnce(new Error('Embedding failed')) // Second clause fails
        .mockResolvedValueOnce([0.4, 0.5, 0.6]); // Third clause succeeds

      const result = await documentProcessor.processDocument(leaseFile, leaseId);

      // Should still process successfully, skipping failed clauses
      expect(result.leaseId).toBe(leaseId);
      expect(result.clauses.length).toBeGreaterThan(0);

      extractTextSpy.mockRestore();
    });

    it('should handle Redis storage failures gracefully', async () => {
      const leaseFile = new File([sampleLeaseText], 'lease.pdf', { type: 'application/pdf' });
      const leaseId = 'redis-error-test-123';

      const extractTextSpy = jest.spyOn(documentProcessor as any, 'extractTextFromPDF')
        .mockResolvedValue(sampleLeaseText);

      // Mock Redis storage to fail
      mockRedisClient.getClient().json.set.mockRejectedValue(new Error('Redis storage failed'));

      // The current implementation handles Redis failures gracefully
      const result = await documentProcessor.processDocument(leaseFile, leaseId);
      
      // Should still return analysis results even if storage fails
      expect(result.leaseId).toBe(leaseId);
      expect(result.clauses).toHaveLength(5);
      expect(result.violations).toHaveLength(3);

      extractTextSpy.mockRestore();
    });
  });

  describe('Performance and Scalability', () => {
    it('should process documents within reasonable time limits', async () => {
      const leaseFile = new File([sampleLeaseText], 'lease.pdf', { type: 'application/pdf' });
      const leaseId = 'performance-test-123';

      const extractTextSpy = jest.spyOn(documentProcessor as any, 'extractTextFromPDF')
        .mockResolvedValue(sampleLeaseText);

      const startTime = Date.now();
      const result = await documentProcessor.processDocument(leaseFile, leaseId);
      const endTime = Date.now();

      const processingTime = endTime - startTime;

      // Should complete within 5 seconds (allowing for test overhead)
      expect(processingTime).toBeLessThan(5000);
      expect(result.leaseId).toBe(leaseId);

      extractTextSpy.mockRestore();
    });
  });
}); 