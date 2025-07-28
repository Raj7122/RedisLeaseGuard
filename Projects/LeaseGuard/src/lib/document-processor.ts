import * as pdfjsLib from 'pdfjs-dist';
import Tesseract from 'tesseract.js';
import geminiClient from './gemini';
import redisClient from './redis';
import { ViolationPattern, getAllViolationPatterns, findViolationPatternById } from './housing-law-database';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export interface ProcessedClause {
  id: string;
  text: string;
  section: string;
  vector: number[];
  metadata: {
    leaseId: string;
    flagged: boolean;
    severity?: 'Critical' | 'High' | 'Medium' | 'Low';
    violationType?: string;
    legalReference?: string;
    confidence: number;
  };
}

export interface LeaseAnalysis {
  leaseId: string;
  clauses: ProcessedClause[];
  violations: Array<{
    clauseId: string;
    type: string;
    description: string;
    legalReference: string;
    severity: 'Critical' | 'High' | 'Medium' | 'Low';
  }>;
  summary: {
    totalClauses: number;
    flaggedClauses: number;
    criticalViolations: number;
    highViolations: number;
    mediumViolations: number;
    lowViolations: number;
  };
}

/**
 * Document processing pipeline for LeaseGuard
 * Handles PDF text extraction, OCR, and clause analysis
 */
class DocumentProcessor {
  /**
   * Process uploaded document (PDF or image)
   * @param file - Uploaded file
   * @param leaseId - Unique lease identifier
   * @returns Processed lease analysis
   */
  async processDocument(file: File, leaseId: string): Promise<LeaseAnalysis> {
    try {
      console.log(`Processing document: ${file.name} (${file.size} bytes)`);
      
      // Extract text from document
      const extractedText = await this.extractText(file);
      
      // Extract clauses using AI
      const extractedClauses = await geminiClient.extractClauses(extractedText);
      
      // Generate embeddings and analyze clauses
      const processedClauses = await this.processClauses(extractedClauses, leaseId);
      
      // Detect violations
      const violations = await this.detectViolations(processedClauses);
      
      // Store in Redis
      await this.storeInRedis(processedClauses, leaseId);
      
      // Generate summary
      const summary = this.generateSummary(processedClauses, violations);
      
      return {
        leaseId,
        clauses: processedClauses,
        violations,
        summary
      };
    } catch (error) {
      console.error('Error processing document:', error);
      throw new Error(`Failed to process document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract text from PDF or image file
   */
  private async extractText(file: File): Promise<string> {
    const fileType = file.type;
    
    if (fileType === 'application/pdf') {
      return await this.extractTextFromPDF(file);
    } else if (fileType.startsWith('image/')) {
      return await this.extractTextFromImage(file);
    } else {
      throw new Error('Unsupported file type. Please upload a PDF or image file.');
    }
  }

  /**
   * Extract text from PDF using PDF.js
   */
  private async extractTextFromPDF(file: File): Promise<string> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      let fullText = '';
      
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');
        
        fullText += pageText + '\n';
      }
      
      return fullText.trim();
    } catch (error) {
      console.error('Error extracting text from PDF:', error);
      throw new Error('Failed to extract text from PDF. The file may be corrupted or password-protected.');
    }
  }

  /**
   * Extract text from image using Tesseract.js OCR
   */
  private async extractTextFromImage(file: File): Promise<string> {
    try {
      const result = await Tesseract.recognize(file, 'eng', {
        logger: m => console.log(m)
      });
      
      return result.data.text.trim();
    } catch (error) {
      console.error('Error extracting text from image:', error);
      throw new Error('Failed to extract text from image. Please ensure the image is clear and readable.');
    }
  }

  /**
   * Process extracted clauses with embeddings and violation detection
   */
  private async processClauses(
    extractedClauses: Array<{ text: string; section: string }>,
    leaseId: string
  ): Promise<ProcessedClause[]> {
    const processedClauses: ProcessedClause[] = [];
    
    for (const clause of extractedClauses) {
      try {
        // Generate embedding
        const vector = await geminiClient.generateEmbedding(clause.text);
        
        // Detect violations
        const violation = await this.detectClauseViolation(clause.text);
        
        const processedClause: ProcessedClause = {
          id: `${leaseId}_${processedClauses.length}`,
          text: clause.text,
          section: clause.section,
          vector,
          metadata: {
            leaseId,
            flagged: !!violation,
            severity: violation?.severity,
            violationType: violation?.violation_type,
            legalReference: violation?.legal_violation,
            confidence: violation ? 0.85 : 0.0
          }
        };
        
        processedClauses.push(processedClause);
      } catch (error) {
        console.error('Error processing clause:', error);
        // Continue with other clauses
      }
    }
    
    return processedClauses;
  }

  /**
   * Detect violations in a single clause
   */
  private async detectClauseViolation(clauseText: string): Promise<ViolationPattern | null> {
    try {
      // First, try regex-based detection for speed
      const violationPatterns = getAllViolationPatterns();
      
      for (const pattern of violationPatterns) {
        const regex = new RegExp(pattern.detection_regex, 'i');
        if (regex.test(clauseText)) {
          return pattern;
        }
      }
      
      // If no regex match, try vector similarity search
      const clauseEmbedding = await geminiClient.generateEmbedding(clauseText);
      const redis = redisClient.getClient();
      
      // Search for similar violation patterns in Redis
      const searchResults = await redis.ft.search('clause_idx', 
        `*=>[KNN 5 @vector $vector AS score]`,
        {
          PARAMS: {
            vector: Buffer.from(Float32Array.from(clauseEmbedding).buffer)
          },
          RETURN: ['text', 'metadata', 'score'],
          SORTBY: 'score'
        }
      );
      
      // Check if any violation patterns have high similarity
      for (const result of searchResults.documents) {
        const score = parseFloat(result.score as string);
        if (score >= 0.85) {
          const metadata = result.metadata as any;
          if (metadata?.violationType) {
            return findViolationPatternById(metadata.violationType);
          }
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error detecting clause violation:', error);
      return null;
    }
  }

  /**
   * Detect all violations in processed clauses
   */
  private async detectViolations(clauses: ProcessedClause[]): Promise<LeaseAnalysis['violations']> {
    const violations: LeaseAnalysis['violations'] = [];
    
    for (const clause of clauses) {
      if (clause.metadata.flagged && clause.metadata.violationType) {
        violations.push({
          clauseId: clause.id,
          type: clause.metadata.violationType,
          description: clause.text,
          legalReference: clause.metadata.legalReference || 'Unknown',
          severity: clause.metadata.severity || 'Low'
        });
      }
    }
    
    return violations;
  }

  /**
   * Store processed clauses in Redis
   */
  private async storeInRedis(clauses: ProcessedClause[], leaseId: string): Promise<void> {
    try {
      const redis = redisClient.getClient();
      
      for (const clause of clauses) {
        const key = `clause:${clause.id}`;
        
        await redis.json.set(key, '$', {
          text: clause.text,
          vector: clause.vector,
          metadata: clause.metadata
        });
        
        // Set expiration for 30 days
        await redis.expire(key, 30 * 24 * 60 * 60);
      }
      
      // Store lease metadata
      await redis.json.set(`lease:${leaseId}`, '$', {
        id: leaseId,
        processedAt: new Date().toISOString(),
        clauseCount: clauses.length,
        flaggedCount: clauses.filter(c => c.metadata.flagged).length
      });
      
      console.log(`Stored ${clauses.length} clauses in Redis for lease ${leaseId}`);
    } catch (error) {
      console.error('Error storing in Redis:', error);
      throw new Error('Failed to store processed data');
    }
  }

  /**
   * Generate analysis summary
   */
  private generateSummary(
    clauses: ProcessedClause[],
    violations: LeaseAnalysis['violations']
  ): LeaseAnalysis['summary'] {
    const flaggedClauses = clauses.filter(c => c.metadata.flagged);
    
    return {
      totalClauses: clauses.length,
      flaggedClauses: flaggedClauses.length,
      criticalViolations: violations.filter(v => v.severity === 'Critical').length,
      highViolations: violations.filter(v => v.severity === 'High').length,
      mediumViolations: violations.filter(v => v.severity === 'Medium').length,
      lowViolations: violations.filter(v => v.severity === 'Low').length
    };
  }

  /**
   * Validate file before processing
   */
  validateFile(file: File): { valid: boolean; error?: string } {
    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/tiff',
      'image/bmp'
    ];
    
    if (file.size > maxSize) {
      return { valid: false, error: 'File size must be less than 10MB' };
    }
    
    if (!allowedTypes.includes(file.type)) {
      return { valid: false, error: 'File type not supported. Please upload a PDF or image file.' };
    }
    
    return { valid: true };
  }

  /**
   * Health check for document processing
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Check if PDF.js worker is available
      if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
        return false;
      }
      
      // Check if Tesseract is available
      const tesseractAvailable = typeof Tesseract !== 'undefined';
      
      return tesseractAvailable;
    } catch (error) {
      console.error('Document processor health check failed:', error);
      return false;
    }
  }
}

// Singleton instance
const documentProcessor = new DocumentProcessor();

export default documentProcessor; 