import { NextRequest, NextResponse } from 'next/server';
import redisClient from '@/lib/redis';
import enhancedSearchEngine from '@/lib/enhanced-search-engine';
import semanticCacheManager from '@/lib/semantic-cache-manager';
import { executeWithErrorHandling } from '@/lib/error-handling';

/**
 * POST /api/search
 * Perform enhanced hybrid search with advanced features
 */
export async function POST(request: NextRequest) {
  try {
    const { 
      query, 
      leaseId, 
      filters, 
      limit = 10, 
      language = 'en',
      userId,
      context 
    } = await request.json();
    
    if (!query || !leaseId) {
      return NextResponse.json(
        { error: 'Query and leaseId are required' },
        { status: 400 }
      );
    }

    const result = await executeWithErrorHandling(
      'enhanced_search',
      'search_engine',
      async () => {
        await redisClient.connect();
        
        // Use enhanced search engine
        const searchQuery = {
          query,
          leaseId,
          context,
          filters,
          userId,
          language
        };
        
        const searchResults = await enhancedSearchEngine.enhancedSearch(searchQuery);
        
        // Store recent search for suggestions
        await storeRecentSearch(leaseId, query);
        
        return {
          results: searchResults.slice(0, limit),
          total: searchResults.length,
          query,
          leaseId,
          filters,
          language,
          enhanced: true
        };
      },
      { sessionId: leaseId }
    );

    return NextResponse.json({
      success: true,
      ...result
    });
    
  } catch (error) {
    console.error('Enhanced search API error:', error);
    
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/search
 * Get enhanced search suggestions and recent searches
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const leaseId = searchParams.get('leaseId');
    const type = searchParams.get('type') || 'suggestions';
    const query = searchParams.get('query') || '';
    const language = searchParams.get('language') || 'en';
    
    if (!leaseId) {
      return NextResponse.json(
        { error: 'LeaseId is required' },
        { status: 400 }
      );
    }

    const result = await executeWithErrorHandling(
      'enhanced_search_suggestions',
      'search_engine',
      async () => {
        await redisClient.connect();
        
        if (type === 'recent') {
          // Get recent searches for this lease
          const recentSearches = await getRecentSearches(leaseId);
          return { type: 'recent', searches: recentSearches };
        } else if (type === 'enhanced') {
          // Get enhanced search suggestions
          const suggestions = await enhancedSearchEngine.getSearchSuggestions(
            query, 
            leaseId, 
            language
          );
          return { type: 'enhanced', suggestions };
        } else {
          // Get basic search suggestions based on lease content
          const suggestions = await getSearchSuggestions(leaseId);
          return { type: 'suggestions', suggestions };
        }
      },
      { sessionId: leaseId }
    );

    return NextResponse.json({
      success: true,
      ...result
    });
    
  } catch (error) {
    console.error('Enhanced search suggestions API error:', error);
    
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Get recent searches for a lease
 */
async function getRecentSearches(leaseId: string): Promise<string[]> {
  try {
    const redis = await redisClient.getClient();
    const searchKey = `recent_searches:${leaseId}`;
    
    const searches = await redis.lrange(searchKey, 0, 9); // Last 10 searches
    return searches;
  } catch (error) {
    console.error('Error getting recent searches:', error);
    return [];
  }
}

/**
 * Store recent search for suggestions
 */
async function storeRecentSearch(leaseId: string, query: string): Promise<void> {
  try {
    const redis = await redisClient.getClient();
    const searchKey = `recent_searches:${leaseId}`;
    
    // Add to recent searches list
    await redis.lpush(searchKey, query);
    
    // Keep only last 20 searches
    await redis.ltrim(searchKey, 0, 19);
    
    // Set expiration (30 days)
    await redis.expire(searchKey, 30 * 24 * 60 * 60);
  } catch (error) {
    console.error('Error storing recent search:', error);
  }
}

/**
 * Get search suggestions based on lease content
 */
async function getSearchSuggestions(leaseId: string): Promise<string[]> {
  try {
    const redis = await redisClient.getClient();
    
    // Get lease clauses to generate suggestions
    const clauseKeys = await redis.keys(`clause:${leaseId}_*`);
    const suggestions: string[] = [];
    
    for (const key of clauseKeys.slice(0, 5)) { // Limit to 5 clauses for suggestions
      const clauseData = await redis.json.get(key);
      if (clauseData) {
        // Extract key terms from clause text
        const terms = clauseData.text
          .split(/\s+/)
          .filter((word: string) => word.length > 3)
          .slice(0, 3);
        
        suggestions.push(...terms);
      }
    }
    
    return [...new Set(suggestions)].slice(0, 10); // Remove duplicates and limit to 10
  } catch (error) {
    console.error('Error getting search suggestions:', error);
    return [];
  }
}

/**
 * PUT /api/search/cache/warm
 * Warm cache with common queries
 */
export async function PUT(request: NextRequest) {
  try {
    const { leaseId, commonQueries } = await request.json();
    
    if (!leaseId || !commonQueries) {
      return NextResponse.json(
        { error: 'LeaseId and commonQueries are required' },
        { status: 400 }
      );
    }

    const result = await executeWithErrorHandling(
      'cache_warming',
      'cache_manager',
      async () => {
        await redisClient.connect();
        
        // Warm cache with common queries
        await semanticCacheManager.warmCache(commonQueries);
        
        return {
          warmed: commonQueries.length,
          leaseId
        };
      },
      { sessionId: leaseId }
    );

    return NextResponse.json({
      success: true,
      ...result
    });
    
  } catch (error) {
    console.error('Cache warming API error:', error);
    
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/search/cache
 * Clear search cache
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pattern = searchParams.get('pattern') || 'semantic_cache:*';
    const reason = searchParams.get('reason') || 'manual';
    
    const result = await executeWithErrorHandling(
      'cache_invalidation',
      'cache_manager',
      async () => {
        await redisClient.connect();
        
        // Invalidate cache
        await semanticCacheManager.invalidateCache(pattern, reason);
        
        return {
          invalidated: true,
          pattern,
          reason
        };
      },
      { sessionId: 'system' }
    );

    return NextResponse.json({
      success: true,
      ...result
    });
    
  } catch (error) {
    console.error('Cache invalidation API error:', error);
    
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 