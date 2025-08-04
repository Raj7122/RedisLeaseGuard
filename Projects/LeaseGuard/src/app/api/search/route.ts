import { NextRequest, NextResponse } from 'next/server';
import redisClient from '@/lib/redis';
import { executeWithErrorHandling } from '@/lib/error-handling';

/**
 * POST /api/search
 * Perform hybrid search combining vector and text search
 */
export async function POST(request: NextRequest) {
  try {
    const { query, leaseId, filters, limit = 10 } = await request.json();
    
    if (!query || !leaseId) {
      return NextResponse.json(
        { error: 'Query and leaseId are required' },
        { status: 400 }
      );
    }

    const result = await executeWithErrorHandling(
      'hybrid_search',
      'redis',
      async () => {
        await redisClient.connect();
        
        const searchResults = await redisClient.hybridSearch(query, leaseId, filters);
        
        return {
          results: searchResults.slice(0, limit),
          total: searchResults.length,
          query,
          leaseId,
          filters
        };
      },
      { sessionId: leaseId }
    );

    return NextResponse.json({
      success: true,
      ...result
    });
    
  } catch (error) {
    console.error('Search API error:', error);
    
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
 * Get search suggestions and recent searches
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const leaseId = searchParams.get('leaseId');
    const type = searchParams.get('type') || 'suggestions';
    
    if (!leaseId) {
      return NextResponse.json(
        { error: 'LeaseId is required' },
        { status: 400 }
      );
    }

    const result = await executeWithErrorHandling(
      'search_suggestions',
      'redis',
      async () => {
        await redisClient.connect();
        
        if (type === 'recent') {
          // Get recent searches for this lease
          const recentSearches = await getRecentSearches(leaseId);
          return { type: 'recent', searches: recentSearches };
        } else {
          // Get search suggestions based on lease content
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
    console.error('Search suggestions API error:', error);
    
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