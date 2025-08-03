import { NextRequest, NextResponse } from 'next/server';
import geminiClient from '@/lib/gemini';
import redisClient from '@/lib/redis';
import { executeWithErrorHandling } from '@/lib/error-handling';

/**
 * POST /api/chat
 * Handle AI Q&A with contextual memory
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const { question, leaseId, sessionId } = await request.json();
    
    if (!question || !leaseId) {
      return NextResponse.json(
        { error: 'Question and leaseId are required' },
        { status: 400 }
      );
    }

    // Execute chat operation with error handling
    const result = await executeWithErrorHandling(
      'chat_operation',
      'gemini',
      async () => {
        // Initialize Redis connection
        await redisClient.connect();
        
        // Get lease context from Redis
        const leaseContext = await getLeaseContext(leaseId);
        if (!leaseContext) {
          console.log(`Lease context not found for ${leaseId}, providing fallback response`);
          // Provide a fallback response instead of throwing error
          const fallbackResponse = {
            response: "I don't have access to your lease document at the moment. Please upload your lease document first, and then I'll be able to help you with your questions about it.",
            sessionId
          };
          
          // Store the fallback response in conversation history
          await storeConversation(sessionId, {
            role: 'user',
            content: question,
            timestamp: new Date().toISOString()
          });
          
          await storeConversation(sessionId, {
            role: 'assistant',
            content: fallbackResponse.response,
            timestamp: new Date().toISOString()
          });
          
          return NextResponse.json(fallbackResponse);
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
        
        return {
          response,
          sessionId: sessionId || leaseId,
          context: {
            totalClauses: leaseContext.clauses.length,
            flaggedClauses: leaseContext.clauses.filter(c => c.flagged).length,
            violations: leaseContext.violations.length
          }
        };
      },
      { sessionId, userId: sessionId }
    );

    return NextResponse.json({
      success: true,
      ...result
    });
    
  } catch (error) {
    console.error('Chat API error:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('Lease not found')) {
        return NextResponse.json(
          { error: 'Lease analysis not found. Please upload your document again.' },
          { status: 404 }
        );
      }
      
      if (error.message.includes('Circuit breaker is OPEN')) {
        return NextResponse.json(
          { error: 'Service temporarily unavailable. Please try again in a moment.' },
          { status: 503 }
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
    const redis = await redisClient.getClient();
    
    // Get lease metadata
    console.log(`Retrieving lease context: lease:${leaseId}`);
    const leaseData = await redis.json.get(`lease:${leaseId}`);
    console.log(`Lease data retrieved:`, leaseData);
    
    if (!leaseData) {
      console.log(`No lease data found for: lease:${leaseId}`);
      return null;
    }
    
    // Get all clauses for this lease
    const clauseKeys = await redis.keys(`clause:${leaseId}_*`);
    const clauses = [];
    const violations = [];
    
    console.log(`Found ${clauseKeys.length} clause keys for lease ${leaseId}`);
    
    for (const key of clauseKeys) {
      const clauseData = await redis.json.get(key);
      if (clauseData) {
        console.log(`Processing clause: ${clauseData.text.substring(0, 100)}...`);
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
    
    console.log(`Retrieved ${clauses.length} clauses and ${violations.length} violations`);
    
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
    const redis = await redisClient.getClient();
    const historyKey = `conversation:${sessionId}`;
    
    console.log(`Retrieving conversation history: ${historyKey}`);
    const history = await redis.lrange(historyKey, 0, -1);
    console.log(`Conversation history retrieved:`, history);
    
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
    const redis = await redisClient.getClient();
    const historyKey = `conversation:${sessionId}`;
    
    console.log(`Storing conversation message: ${historyKey}`, message);
    
    // Add message to conversation history
    await redis.lpush(historyKey, JSON.stringify(message));
    
    // Keep only last 20 messages to prevent memory issues
    await redis.ltrim(historyKey, 0, 19);
    
    // Set expiration for 7 days
    await redis.expire(historyKey, 7 * 24 * 60 * 60);
    
    console.log(`Successfully stored conversation message for session: ${sessionId}`);
  } catch (error) {
    console.error('Error storing conversation:', error);
  }
} 