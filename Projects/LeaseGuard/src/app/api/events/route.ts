import { NextRequest, NextResponse } from 'next/server';
import redisClient from '@/lib/redis';
import { executeWithErrorHandling } from '@/lib/error-handling';

/**
 * GET /api/events
 * Get recent processing events from Redis Streams
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const streamName = searchParams.get('stream') || 'lease_processing_stream';
    const startId = searchParams.get('startId') || '0';
    const limit = parseInt(searchParams.get('limit') || '50');
    
    // Execute event retrieval with error handling
    const result = await executeWithErrorHandling(
      'event_retrieval',
      'redis',
      async () => {
        // Initialize Redis connection
        await redisClient.connect();
        
        // Get events from stream
        const events = await redisClient.getEventStream(streamName, startId);
        
        return {
          events: events.slice(0, limit),
          streamName,
          totalEvents: events.length,
          lastEventId: events.length > 0 ? events[events.length - 1]?.id : startId
        };
      },
      { streamName, startId }
    );

    return NextResponse.json({
      success: true,
      ...result
    });
    
  } catch (error) {
    console.error('Events API error:', error);
    
    if (error instanceof Error) {
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
 * POST /api/events
 * Publish a custom event to Redis Streams
 */
export async function POST(request: NextRequest) {
  try {
    const { eventType, data, leaseId, sessionId } = await request.json();
    
    if (!eventType || !data) {
      return NextResponse.json(
        { error: 'Event type and data are required' },
        { status: 400 }
      );
    }

    // Execute event publishing with error handling
    const result = await executeWithErrorHandling(
      'event_publishing',
      'redis',
      async () => {
        // Initialize Redis connection
        await redisClient.connect();
        
        const redis = await redisClient.getClient();
        
        // Publish event to stream
        const eventId = await redis.xadd('lease_processing_stream', '*', 
          'leaseId', leaseId || 'system',
          'eventType', eventType,
          'data', JSON.stringify(data),
          'sessionId', sessionId || 'system',
          'timestamp', new Date().toISOString()
        );
        
        return {
          eventId,
          eventType,
          leaseId: leaseId || 'system',
          sessionId: sessionId || 'system',
          timestamp: new Date().toISOString()
        };
      },
      { eventType, leaseId, sessionId }
    );

    return NextResponse.json({
      success: true,
      ...result
    });
    
  } catch (error) {
    console.error('Event publishing API error:', error);
    
    if (error instanceof Error) {
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