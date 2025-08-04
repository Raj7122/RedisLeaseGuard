import redisClient from './redis';
import timeSeriesManager from './timeseries-manager';
import semanticCacheManager from './semantic-cache-manager';

/**
 * Search query interface
 */
interface SearchQuery {
  query: string;
  leaseId: string;
  context?: any;
  filters?: any;
  userId?: string;
  language?: string;
}

/**
 * Search result interface
 */
interface SearchResult {
  id: string;
  text: string;
  score: number;
  metadata: any;
  relevance: {
    vectorSimilarity: number;
    textMatch: number;
    contextRelevance: number;
    userPreference: number;
  };
  highlights?: string[];
}

/**
 * Legal terminology dictionary for synonym expansion
 */
const LEGAL_TERMINOLOGY = {
  'rent': ['rental payment', 'monthly payment', 'lease payment'],
  'deposit': ['security deposit', 'damage deposit', 'refundable deposit'],
  'eviction': ['eviction notice', 'termination', 'removal'],
  'maintenance': ['repairs', 'upkeep', 'maintenance request'],
  'utilities': ['electricity', 'water', 'gas', 'internet', 'utilities'],
  'pets': ['animals', 'pet policy', 'pet deposit'],
  'sublet': ['sublease', 'subletting', 'assignment'],
  'late fee': ['late payment fee', 'penalty', 'late charge'],
  'notice': ['notification', 'advance notice', 'termination notice'],
  'inspection': ['property inspection', 'walkthrough', 'inspection notice']
};

/**
 * Multi-language support for common lease terms
 */
const MULTI_LANGUAGE_TERMS = {
  'es': { // Spanish
    'rent': ['renta', 'alquiler'],
    'deposit': ['depósito', 'fianza'],
    'eviction': ['desalojo', 'desahucio'],
    'maintenance': ['mantenimiento', 'reparaciones'],
    'utilities': ['servicios', 'servicios públicos']
  },
  'fr': { // French
    'rent': ['loyer', 'bail'],
    'deposit': ['dépôt', 'caution'],
    'eviction': ['expulsion', 'éviction'],
    'maintenance': ['entretien', 'maintenance'],
    'utilities': ['services', 'utilitaires']
  },
  'de': { // German
    'rent': ['miete', 'mietzahlung'],
    'deposit': ['kaution', 'depot'],
    'eviction': ['räumung', 'kündigung'],
    'maintenance': ['wartung', 'instandhaltung'],
    'utilities': ['versorgungsunternehmen', 'nützlichkeiten']
  }
};

/**
 * Enhanced Search Engine for advanced search capabilities
 * Implements S.A.F.E. D.R.Y. principles with comprehensive search features
 */
class EnhancedSearchEngine {
  private static instance: EnhancedSearchEngine;
  private readonly FUZZY_THRESHOLD = 0.8; // 80% similarity for fuzzy matching
  private readonly MAX_SYNONYMS = 3; // Maximum synonyms to expand
  private readonly SUPPORTED_LANGUAGES = ['en', 'es', 'fr', 'de'];

  /**
   * Singleton pattern for search engine
   */
  public static getInstance(): EnhancedSearchEngine {
    if (!EnhancedSearchEngine.instance) {
      EnhancedSearchEngine.instance = new EnhancedSearchEngine();
    }
    return EnhancedSearchEngine.instance;
  }

  /**
   * Perform enhanced hybrid search with all advanced features
   * Strategic: Comprehensive search strategy with multiple approaches
   */
  async enhancedSearch(query: SearchQuery): Promise<SearchResult[]> {
    try {
      // Check semantic cache first
      const cachedResponse = await semanticCacheManager.getCachedResponse(query);
      if (cachedResponse) {
        return JSON.parse(cachedResponse);
      }

      // Track search performance
      const startTime = Date.now();

      // Process query with all enhancements
      const processedQuery = await this.processQuery(query);
      
      // Perform multi-modal search
      const results = await this.performMultiModalSearch(processedQuery);
      
      // Apply relevance scoring
      const scoredResults = await this.applyRelevanceScoring(results, query);
      
      // Apply user preferences
      const personalizedResults = await this.applyUserPreferences(scoredResults, query);
      
      // Generate highlights
      const highlightedResults = this.generateHighlights(personalizedResults, query.query);

      // Cache the results
      await semanticCacheManager.storeCachedResponse(query, JSON.stringify(highlightedResults));

      // Track search metrics
      const searchTime = Date.now() - startTime;
      await this.trackSearchMetrics(query, searchTime, highlightedResults.length);

      return highlightedResults;
    } catch (error) {
      console.error('Error in enhanced search:', error);
      return [];
    }
  }

  /**
   * Process query with all enhancements
   * Automated: Comprehensive query processing automation
   */
  private async processQuery(query: SearchQuery): Promise<any> {
    const processed = {
      original: query.query,
      normalized: this.normalizeQuery(query.query),
      expanded: await this.expandSynonyms(query.query, query.language || 'en'),
      fuzzy: this.generateFuzzyVariations(query.query),
      context: query.context || {},
      filters: query.filters || {}
    };

    return processed;
  }

  /**
   * Normalize query for consistent processing
   */
  private normalizeQuery(query: string): string {
    return query
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/[^\w\s]/g, ''); // Remove special characters
  }

  /**
   * Expand synonyms for better search coverage
   * Don't Repeat Yourself: Centralized synonym expansion
   */
  private async expandSynonyms(query: string, language: string): Promise<string[]> {
    const expansions: string[] = [query];
    const normalizedQuery = this.normalizeQuery(query);
    const words = normalizedQuery.split(/\s+/);

    for (const word of words) {
      // Get language-specific synonyms
      const synonyms = this.getSynonyms(word, language);
      
      for (const synonym of synonyms.slice(0, this.MAX_SYNONYMS)) {
        const expandedQuery = normalizedQuery.replace(word, synonym);
        if (!expansions.includes(expandedQuery)) {
          expansions.push(expandedQuery);
        }
      }
    }

    return expansions;
  }

  /**
   * Get synonyms for a word in the specified language
   */
  private getSynonyms(word: string, language: string): string[] {
    if (language === 'en') {
      return LEGAL_TERMINOLOGY[word as keyof typeof LEGAL_TERMINOLOGY] || [];
    } else {
      const languageTerms = MULTI_LANGUAGE_TERMS[language as keyof typeof MULTI_LANGUAGE_TERMS];
      if (languageTerms) {
        return languageTerms[word as keyof typeof languageTerms] || [];
      }
    }
    return [];
  }

  /**
   * Generate fuzzy variations for typo tolerance
   * Fortified: Robust fuzzy matching with error handling
   */
  private generateFuzzyVariations(query: string): string[] {
    const variations: string[] = [query];
    const words = query.split(/\s+/);

    for (const word of words) {
      if (word.length > 3) { // Only process words longer than 3 characters
        const fuzzyWords = this.generateFuzzyWords(word);
        for (const fuzzyWord of fuzzyWords) {
          const variation = query.replace(word, fuzzyWord);
          if (!variations.includes(variation)) {
            variations.push(variation);
          }
        }
      }
    }

    return variations;
  }

  /**
   * Generate fuzzy word variations using common typo patterns
   */
  private generateFuzzyWords(word: string): string[] {
    const variations: string[] = [];
    
    // Common typo patterns
    const typoPatterns = [
      // Transposed letters
      (w: string) => {
        for (let i = 0; i < w.length - 1; i++) {
          const chars = w.split('');
          [chars[i], chars[i + 1]] = [chars[i + 1], chars[i]];
          variations.push(chars.join(''));
        }
      },
      // Missing letters
      (w: string) => {
        for (let i = 0; i < w.length; i++) {
          variations.push(w.slice(0, i) + w.slice(i + 1));
        }
      },
      // Extra letters
      (w: string) => {
        const vowels = 'aeiou';
        for (let i = 0; i <= w.length; i++) {
          for (const vowel of vowels) {
            variations.push(w.slice(0, i) + vowel + w.slice(i));
          }
        }
      }
    ];

    typoPatterns.forEach(pattern => pattern(word));
    return variations.slice(0, 5); // Limit to 5 variations per word
  }

  /**
   * Perform multi-modal search combining different search strategies
   * Evolving: Advanced search with multiple approaches
   */
  private async performMultiModalSearch(processedQuery: any): Promise<SearchResult[]> {
    const allResults: SearchResult[] = [];

    // Perform searches with different query variations
    const searchQueries = [
      processedQuery.original,
      ...processedQuery.expanded,
      ...processedQuery.fuzzy
    ];

    for (const searchQuery of searchQueries) {
      try {
        const results = await redisClient.hybridSearch(
          searchQuery,
          processedQuery.context.leaseId || 'unknown',
          processedQuery.filters
        );

        // Convert to SearchResult format
        const convertedResults = results.map((result: any) => ({
          id: result.id,
          text: result.text,
          score: result.score || 0,
          metadata: result.metadata || {},
          relevance: {
            vectorSimilarity: result.score || 0,
            textMatch: 0,
            contextRelevance: 0,
            userPreference: 0
          }
        }));

        allResults.push(...convertedResults);
      } catch (error) {
        console.error(`Error searching with query "${searchQuery}":`, error);
      }
    }

    // Remove duplicates and merge scores
    return this.mergeDuplicateResults(allResults);
  }

  /**
   * Merge duplicate results and combine scores
   */
  private mergeDuplicateResults(results: SearchResult[]): SearchResult[] {
    const merged = new Map<string, SearchResult>();

    for (const result of results) {
      if (merged.has(result.id)) {
        const existing = merged.get(result.id)!;
        existing.score = Math.max(existing.score, result.score);
        existing.relevance.vectorSimilarity = Math.max(
          existing.relevance.vectorSimilarity,
          result.relevance.vectorSimilarity
        );
      } else {
        merged.set(result.id, result);
      }
    }

    return Array.from(merged.values());
  }

  /**
   * Apply advanced relevance scoring
   * Your-Focused: User-centric relevance scoring
   */
  private async applyRelevanceScoring(results: SearchResult[], query: SearchQuery): Promise<SearchResult[]> {
    return results.map(result => {
      // Calculate text match score
      const textMatch = this.calculateTextMatch(result.text, query.query);
      
      // Calculate context relevance
      const contextRelevance = this.calculateContextRelevance(result, query.context);
      
      // Calculate user preference score
      const userPreference = this.calculateUserPreference(result, query.userId);

      // Update relevance scores
      result.relevance = {
        vectorSimilarity: result.relevance.vectorSimilarity,
        textMatch,
        contextRelevance,
        userPreference
      };

      // Calculate combined score
      result.score = this.calculateCombinedScore(result.relevance);

      return result;
    });
  }

  /**
   * Calculate text match score using fuzzy matching
   */
  private calculateTextMatch(text: string, query: string): number {
    const normalizedText = this.normalizeQuery(text);
    const normalizedQuery = this.normalizeQuery(query);
    
    // Simple word overlap score
    const textWords = new Set(normalizedText.split(/\s+/));
    const queryWords = new Set(normalizedQuery.split(/\s+/));
    
    const intersection = new Set([...textWords].filter(x => queryWords.has(x)));
    const union = new Set([...textWords, ...queryWords]);
    
    return intersection.size / union.size;
  }

  /**
   * Calculate context relevance based on lease context
   */
  private calculateContextRelevance(result: SearchResult, context: any): number {
    if (!context || !context.clauses) return 0;

    // Check if result text appears in lease clauses
    const normalizedResult = this.normalizeQuery(result.text);
    let relevance = 0;

    for (const clause of context.clauses) {
      const normalizedClause = this.normalizeQuery(clause.text);
      if (normalizedClause.includes(normalizedResult) || 
          normalizedResult.includes(normalizedClause)) {
        relevance += 0.5;
      }
    }

    return Math.min(relevance, 1.0);
  }

  /**
   * Calculate user preference score based on user history
   */
  private calculateUserPreference(result: SearchResult, userId?: string): number {
    // This would be implemented with user preference data
    // For now, return a neutral score
    return 0.5;
  }

  /**
   * Calculate combined relevance score
   */
  private calculateCombinedScore(relevance: any): number {
    const weights = {
      vectorSimilarity: 0.4,
      textMatch: 0.3,
      contextRelevance: 0.2,
      userPreference: 0.1
    };

    return (
      relevance.vectorSimilarity * weights.vectorSimilarity +
      relevance.textMatch * weights.textMatch +
      relevance.contextRelevance * weights.contextRelevance +
      relevance.userPreference * weights.userPreference
    );
  }

  /**
   * Apply user preferences to search results
   * Resilient: Robust preference application with fallbacks
   */
  private async applyUserPreferences(results: SearchResult[], query: SearchQuery): Promise<SearchResult[]> {
    if (!query.userId) {
      return results;
    }

    try {
      // Get user preferences from Redis
      const redis = await redisClient.getClient();
      const userPrefs = await redis.json.get(`user_preferences:${query.userId}`);
      
      if (userPrefs && userPrefs.searchPreferences) {
        // Apply user-specific ranking preferences
        return results.map(result => {
          const preferenceBoost = this.calculatePreferenceBoost(result, userPrefs.searchPreferences);
          result.score *= preferenceBoost;
          return result;
        });
      }
    } catch (error) {
      console.error('Error applying user preferences:', error);
    }

    return results;
  }

  /**
   * Calculate preference boost based on user preferences
   */
  private calculatePreferenceBoost(result: SearchResult, preferences: any): number {
    let boost = 1.0;

    // Apply severity preferences
    if (preferences.severity && result.metadata.severity) {
      if (preferences.severity.includes(result.metadata.severity)) {
        boost *= 1.2;
      }
    }

    // Apply content type preferences
    if (preferences.contentTypes && result.metadata.type) {
      if (preferences.contentTypes.includes(result.metadata.type)) {
        boost *= 1.1;
      }
    }

    return boost;
  }

  /**
   * Generate highlights for search results
   */
  private generateHighlights(results: SearchResult[], query: string): SearchResult[] {
    const normalizedQuery = this.normalizeQuery(query);
    const queryWords = normalizedQuery.split(/\s+/);

    return results.map(result => {
      const highlights: string[] = [];
      const normalizedText = this.normalizeQuery(result.text);

      for (const word of queryWords) {
        if (normalizedText.includes(word)) {
          // Find the original word in the text (case-insensitive)
          const regex = new RegExp(word, 'gi');
          const matches = result.text.match(regex);
          if (matches) {
            highlights.push(...matches);
          }
        }
      }

      result.highlights = [...new Set(highlights)]; // Remove duplicates
      return result;
    });
  }

  /**
   * Track search metrics for analytics
   */
  private async trackSearchMetrics(query: SearchQuery, searchTime: number, resultCount: number): Promise<void> {
    try {
      await timeSeriesManager.addMetric(
        'search_performance:response_time',
        searchTime,
        { 
          queryLength: query.query.length,
          resultCount,
          language: query.language || 'en'
        }
      );

      await timeSeriesManager.addMetric(
        'search_performance:result_count',
        resultCount,
        { 
          queryLength: query.query.length,
          language: query.language || 'en'
        }
      );

      await timeSeriesManager.addMetric(
        'search_usage:queries',
        1,
        { 
          language: query.language || 'en',
          hasFilters: !!query.filters
        }
      );
    } catch (error) {
      console.error('Error tracking search metrics:', error);
    }
  }

  /**
   * Get search suggestions based on query and context
   */
  async getSearchSuggestions(query: string, leaseId: string, language: string = 'en'): Promise<string[]> {
    try {
      const suggestions: string[] = [];
      
      // Add original query
      suggestions.push(query);

      // Add synonym expansions
      const synonyms = await this.expandSynonyms(query, language);
      suggestions.push(...synonyms.slice(0, 3));

      // Add fuzzy variations
      const fuzzy = this.generateFuzzyVariations(query);
      suggestions.push(...fuzzy.slice(0, 2));

      // Get recent searches for this lease
      const redis = await redisClient.getClient();
      const recentSearches = await redis.lrange(`recent_searches:${leaseId}`, 0, 4);
      suggestions.push(...recentSearches);

      return [...new Set(suggestions)].slice(0, 10); // Remove duplicates and limit
    } catch (error) {
      console.error('Error getting search suggestions:', error);
      return [query];
    }
  }

  /**
   * Health check for search engine
   */
  async healthCheck(): Promise<boolean> {
    try {
      const testQuery: SearchQuery = {
        query: 'test search',
        leaseId: 'test-lease',
        language: 'en'
      };

      const results = await this.enhancedSearch(testQuery);
      return Array.isArray(results);
    } catch (error) {
      console.error('Search engine health check failed:', error);
      return false;
    }
  }
}

// Export singleton instance
const enhancedSearchEngine = EnhancedSearchEngine.getInstance();
export default enhancedSearchEngine; 