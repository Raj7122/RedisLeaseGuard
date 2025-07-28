import { NextRequest, NextResponse } from 'next/server';
import geminiClient from '@/lib/gemini';
import redisClient from '@/lib/redis';

/**
 * POST /api/chat
 * Handle AI Q&A with contextual memory
 */
export async function POST(request: NextRequest) {
  try {
    // Initialize Redis connection
    await redisClient.connect();
    
    // Parse request body
    const { question, leaseId, sessionId } = await request.json();
    
    if (!question || !leaseId) {
      return NextResponse.json(
        { error: 'Question and leaseId are required' },
        { status: 400 }
      );
    }
    
    // Get lease context from Redis
    const leaseContext = await getLeaseContext(leaseId);
    if (!leaseContext) {
      return NextResponse.json(
        { error: 'Lease not found or expired' },
        { status: 404 }
      );
    }
    
    // Get conversation history from Redis
    const conversationHistory = await getConversationHistory(sessionId || leaseId);
    
    // Process question with context
    const response = await geminiClient.processQuestion(
      question,
      leaseContext,
      conversationHistory
    );
    
    // Store conversation in Redis
    await storeConversation(sessionId || leaseId, {
      role: 'user',
      content: question,
      timestamp: new Date().toISOString()
    });
    
    await storeConversation(sessionId || leaseId, {
      role: 'assistant',
      content: response,
      timestamp: new Date().toISOString()
    });
    
    return NextResponse.json({
      success: true,
      response,
      sessionId: sessionId || leaseId,
      context: {
        totalClauses: leaseContext.clauses.length,
        flaggedClauses: leaseContext.clauses.filter(c => c.flagged).length,
        violations: leaseContext.violations.length
      }
    });
    
  } catch (error) {
    console.error('Chat API error:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('Redis connection failed')) {
        return NextResponse.json(
          { error: 'Service temporarily unavailable. Please try again.' },
          { status: 503 }
        );
      }
      
      if (error.message.includes('Lease not found')) {
        return NextResponse.json(
          { error: 'Lease analysis not found. Please upload your document again.' },
          { status: 404 }
        );
      }
      
      if (error.message.includes('Failed to process question')) {
        return NextResponse.json(
          { error: 'Unable to process your question. Please try again.' },
          { status: 500 }
        );
      }
    }
    
    return NextResponse.json(
      { error: 'Internal server error. Please try again.' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/chat/history/:sessionId
 * Get conversation history for a session
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    
    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }
    
    // Initialize Redis connection
    await redisClient.connect();
    
    // Get conversation history
    const history = await getConversationHistory(sessionId);
    
    return NextResponse.json({
      success: true,
      history,
      sessionId
    });
    
  } catch (error) {
    console.error('Chat history API error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve conversation history' },
      { status: 500 }
    );
  }
}

/**
 * Get lease context from Redis
 */
async function getLeaseContext(leaseId: string) {
  try {
    const redis = redisClient.getClient();
    
    // Get lease metadata
    const leaseData = await redis.json.get(`lease:${leaseId}`);
    if (!leaseData) {
      return null;
    }
    
    // Get all clauses for this lease
    const clauseKeys = await redis.keys(`clause:${leaseId}_*`);
    const clauses = [];
    const violations = [];
    
    for (const key of clauseKeys) {
      const clauseData = await redis.json.get(key);
      if (clauseData) {
        clauses.push({
          text: clauseData.text,
          flagged: clauseData.metadata.flagged,
          severity: clauseData.metadata.severity
        });
        
        if (clauseData.metadata.flagged) {
          violations.push({
            type: clauseData.metadata.violationType,
            description: clauseData.text,
            legal_reference: clauseData.metadata.legalReference
          });
        }
      }
    }
    
    return {
      clauses,
      violations
    };
    
  } catch (error) {
    console.error('Error getting lease context:', error);
    return null;
  }
}

/**
 * Get conversation history from Redis
 */
async function getConversationHistory(sessionId: string) {
  try {
    const redis = redisClient.getClient();
    const historyKey = `conversation:${sessionId}`;
    
    const history = await redis.lrange(historyKey, 0, -1);
    
    return history.map(item => JSON.parse(item));
    
  } catch (error) {
    console.error('Error getting conversation history:', error);
    return [];
  }
}

/**
 * Store conversation message in Redis
 */
async function storeConversation(sessionId: string, message: {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}) {
  try {
    const redis = redisClient.getClient();
    const historyKey = `conversation:${sessionId}`;
    
    // Add message to conversation history
    await redis.lpush(historyKey, JSON.stringify(message));
    
    // Keep only last 20 messages to prevent memory issues
    await redis.ltrim(historyKey, 0, 19);
    
    // Set expiration for 7 days
    await redis.expire(historyKey, 7 * 24 * 60 * 60);
    
  } catch (error) {
    console.error('Error storing conversation:', error);
  }
} 