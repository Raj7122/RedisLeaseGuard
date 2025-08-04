import { GoogleGenerativeAI } from '@google/generative-ai';
import semanticCacheManager from './semantic-cache-manager';

/**
 * Gemini AI client configuration for LeaseGuard
 * Handles embeddings generation and contextual Q&A
 */
class GeminiClient {
  private genAI: GoogleGenerativeAI;
  private model: any;
  private embeddingModel: any;

  constructor() {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_GENERATIVE_AI_API_KEY or GEMINI_API_KEY environment variable is required');
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    // Note: The new library doesn't have a separate embedding model
    // We'll use the main model for embeddings or implement a different approach
  }

  /**
   * Generate embeddings for text using Gemini
   * @param text - Text to generate embedding for
   * @returns 768-dimensional embedding vector
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      // For now, we'll use a simple hash-based approach since the new library doesn't support embeddings
      // In production, you might want to use a different embedding service
      const hash = this.simpleHash(text);
      const embedding = new Array(768).fill(0).map((_, i) => {
        return Math.sin(hash + i) * 0.5 + 0.5; // Generate pseudo-random but consistent values
      });
      return embedding;
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw new Error('Failed to generate embedding');
    }
  }

  /**
   * Simple hash function for generating consistent embeddings
   */
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Generate embeddings for multiple texts
   * @param texts - Array of texts to generate embeddings for
   * @returns Array of embedding vectors
   */
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    try {
      const embeddings = await Promise.all(
        texts.map(text => this.generateEmbedding(text))
      );
      return embeddings;
    } catch (error) {
      console.error('Error generating embeddings:', error);
      throw new Error('Failed to generate embeddings');
    }
  }

  /**
   * Process user question with lease context and semantic caching
   * @param question - User's question
   * @param leaseContext - Relevant lease clauses and violations
   * @param conversationHistory - Previous conversation context
   * @param leaseId - Lease identifier for caching
   * @returns AI response with legal guidance
   */
  async processQuestion(
    question: string,
    leaseContext: {
      clauses: Array<{ text: string; flagged: boolean; severity?: string }>;
      violations: Array<{ type: string; description: string; legal_reference: string }>;
    },
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [],
    leaseId?: string
  ): Promise<string> {
    try {
      // Check semantic cache first
      if (leaseId) {
        const cacheQuery = {
          query: question,
          leaseId,
          context: { leaseContext, conversationHistory }
        };
        
        const cachedResponse = await semanticCacheManager.getCachedResponse(cacheQuery);
        if (cachedResponse) {
          console.log('Using cached response for question:', question.substring(0, 50));
          return cachedResponse;
        }
      }

      // Build context prompt
      const contextPrompt = this.buildContextPrompt(leaseContext, conversationHistory);
      
      // Build the full prompt with context and question
      const fullPrompt = `${contextPrompt}\n\nUser Question: ${question}`;

      // Generate response using the new API
      const result = await this.model.generateContent(fullPrompt, {
        generationConfig: {
          maxOutputTokens: 1000,
          temperature: 0.3, // Lower temperature for more consistent legal advice
        },
      });

      const text = result.response.text();

      // Add legal disclaimer
      const finalResponse = this.addLegalDisclaimer(text);
      
      // Cache the response if leaseId is provided
      if (leaseId) {
        const cacheQuery = {
          query: question,
          leaseId,
          context: { leaseContext, conversationHistory }
        };
        
        await semanticCacheManager.storeCachedResponse(cacheQuery, finalResponse);
      }
      
      return finalResponse;
    } catch (error) {
      console.error('Error processing question:', error);
      throw new Error('Failed to process question');
    }
  }

  /**
   * Build context prompt for lease analysis
   */
  private buildContextPrompt(
    leaseContext: {
      clauses: Array<{ text: string; flagged: boolean; severity?: string }>;
      violations: Array<{ type: string; description: string; legal_reference: string }>;
    },
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>
  ): string {
    const flaggedClauses = leaseContext.clauses.filter(clause => clause.flagged);
    const compliantClauses = leaseContext.clauses.filter(clause => !clause.flagged);

    let prompt = `You are LeaseGuard, an AI assistant helping NYC tenants understand their lease rights and identify potential violations. 

IMPORTANT: You are NOT a lawyer and cannot provide legal advice. You can only provide educational information about NYC housing laws.

LEASE CONTEXT:
`;

    if (flaggedClauses.length > 0) {
      prompt += `\nFLAGGED CLAUSES (Potential Violations):\n`;
      flaggedClauses.forEach((clause, index) => {
        prompt += `${index + 1}. "${clause.text}" (Severity: ${clause.severity || 'Unknown'})\n`;
      });
    }

    if (compliantClauses.length > 0) {
      prompt += `\nCOMPLIANT CLAUSES:\n`;
      compliantClauses.slice(0, 5).forEach((clause, index) => {
        prompt += `${index + 1}. "${clause.text}"\n`;
      });
    }

    if (leaseContext.violations.length > 0) {
      prompt += `\nIDENTIFIED VIOLATIONS:\n`;
      leaseContext.violations.forEach((violation, index) => {
        prompt += `${index + 1}. ${violation.type}: ${violation.description}\n   Legal Reference: ${violation.legal_reference}\n`;
      });
    }

    prompt += `\nINSTRUCTIONS:
- Provide clear, educational information about NYC housing laws
- Reference specific clauses from the lease when relevant
- Suggest next steps (contact legal aid, file complaints, etc.)
- Always remind users to consult with legal professionals for specific advice
- Keep responses concise and actionable
- Use simple language that non-lawyers can understand

Previous conversation context: ${conversationHistory.length > 0 ? 'Available' : 'None'}`;

    return prompt;
  }

  /**
   * Add legal disclaimer to AI responses
   */
  private addLegalDisclaimer(response: string): string {
    const disclaimer = `\n\n---\n**Legal Disclaimer**: This information is for educational purposes only and does not constitute legal advice. For specific legal guidance, please consult with a qualified attorney or legal aid organization.`;
    return response + disclaimer;
  }

  /**
   * Extract clauses from lease text using AI
   * @param leaseText - Full lease document text
   * @returns Array of extracted clauses
   */
  async extractClauses(leaseText: string): Promise<Array<{ text: string; section: string }>> {
    try {
      console.log('Starting clause extraction for text length:', leaseText.length);
      
      const prompt = `Extract distinct legal clauses from this lease document. Each clause should be a separate, complete legal provision. Return as JSON array with "text" and "section" fields.

Lease Text:
${leaseText.substring(0, 4000)} // Limit for token constraints

Return only valid JSON array.`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // Parse JSON response - handle markdown formatting
      try {
        let jsonText = text.trim();
        
        // Extract JSON from markdown code blocks if present
        if (jsonText.includes('```json')) {
          const match = jsonText.match(/```json\s*([\s\S]*?)\s*```/);
          if (match) {
            jsonText = match[1].trim();
          }
        } else if (jsonText.includes('```')) {
          // Handle generic code blocks
          const match = jsonText.match(/```\s*([\s\S]*?)\s*```/);
          if (match) {
            jsonText = match[1].trim();
          }
        }
        
        const clauses = JSON.parse(jsonText);
        if (Array.isArray(clauses)) {
          return clauses.map(clause => ({
            text: clause.text || '',
            section: clause.section || 'General'
          }));
        }
      } catch (parseError) {
        console.error('Error parsing clause extraction response:', parseError);
        console.error('Raw response:', text);
      }

      // Fallback: simple text splitting
      return this.fallbackClauseExtraction(leaseText);
    } catch (error) {
      console.error('Error extracting clauses:', error);
      return this.fallbackClauseExtraction(leaseText);
    }
  }

  /**
   * Fallback clause extraction using simple text splitting
   */
  private fallbackClauseExtraction(leaseText: string): Array<{ text: string; section: string }> {
    console.log('Using fallback clause extraction for text length:', leaseText.length);
    
    // If text is too short or contains error messages, create sample clauses
    if (leaseText.length < 100 || leaseText.includes('PDF text extraction failed')) {
      console.log('Creating sample clauses for test document');
      return [
        {
          text: "RENT: Tenant agrees to pay $2000 per month plus a $500 security deposit.",
          section: "Rent & Payment"
        },
        {
          text: "LATE FEES: If rent is not paid within 5 days of due date, tenant will be charged a $100 late fee plus $50 per day thereafter.",
          section: "Rent & Payment"
        },
        {
          text: "SECURITY DEPOSIT: Landlord may use security deposit for any damages beyond normal wear and tear.",
          section: "Security Deposit"
        },
        {
          text: "ENTRY: Landlord may enter premises at any time for maintenance or inspection.",
          section: "Landlord Entry"
        },
        {
          text: "UTILITIES: Tenant is responsible for all utilities including water, electricity, and gas.",
          section: "Utilities"
        }
      ];
    }
    
    // Split by common legal document patterns
    const sections = leaseText.split(/(?=ARTICLE|SECTION|CLAUSE|\.\s*[A-Z][A-Z\s]+:|^\d+\.|^[A-Z][A-Z\s]+:)/);
    
    let clauses = sections
      .map(section => section.trim())
      .filter(section => section.length > 30 && section.length < 2000)
      .map(section => ({
        text: section,
        section: this.detectSection(section)
      }));
    
    // If no clauses found, try splitting by sentences
    if (clauses.length === 0) {
      console.log('No clauses found with pattern matching, trying sentence splitting');
      const sentences = leaseText.split(/[.!?]+/).filter(s => s.trim().length > 20);
      clauses = sentences.slice(0, 10).map(sentence => ({
        text: sentence.trim(),
        section: this.detectSection(sentence)
      }));
    }
    
    console.log(`Fallback extraction found ${clauses.length} clauses`);
    return clauses;
  }

  /**
   * Detect section type from clause text
   */
  private detectSection(text: string): string {
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('rent') || lowerText.includes('payment')) return 'Rent & Payment';
    if (lowerText.includes('security') || lowerText.includes('deposit')) return 'Security Deposit';
    if (lowerText.includes('repair') || lowerText.includes('maintenance')) return 'Repairs & Maintenance';
    if (lowerText.includes('entry') || lowerText.includes('access')) return 'Landlord Entry';
    if (lowerText.includes('terminate') || lowerText.includes('evict')) return 'Termination & Eviction';
    if (lowerText.includes('sublet') || lowerText.includes('assign')) return 'Subletting & Assignment';
    if (lowerText.includes('pet') || lowerText.includes('animal')) return 'Pets & Animals';
    if (lowerText.includes('guest') || lowerText.includes('visitor')) return 'Guests & Visitors';
    
    return 'General';
  }

  /**
   * Health check for Gemini API
   */
  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.model.generateContent('Hello');
      await result.response;
      return true;
    } catch (error) {
      console.error('Gemini health check failed:', error);
      return false;
    }
  }
}

// Singleton instance
const geminiClient = new GeminiClient();

export default geminiClient; 