import { NextRequest, NextResponse } from 'next/server';
import redisClient from '@/lib/redis';
import { executeWithErrorHandling } from '@/lib/error-handling';

/**
 * GET /api/notifications
 * Get recent notifications and subscribe to real-time updates
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const channel = searchParams.get('channel') || 'violation_alerts';
    const sessionId = searchParams.get('sessionId');
    
    // Execute notification retrieval with error handling
    const result = await executeWithErrorHandling(
      'notification_retrieval',
      'redis',
      async () => {
        // Initialize Redis connection
        await redisClient.connect();
        
        // For now, return subscription info
        // In a real implementation, this would handle WebSocket connections
        return {
          channel,
          sessionId,
          subscriptionStatus: 'active',
          message: 'Notifications endpoint ready for WebSocket connection'
        };
      },
      { channel, sessionId }
    );

    return NextResponse.json({
      success: true,
      ...result
    });
    
  } catch (error) {
    console.error('Notifications API error:', error);
    
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
 * POST /api/notifications
 * Send a notification via Redis Pub/Sub
 */
export async function POST(request: NextRequest) {
  try {
    const { message, channel, severity, leaseId, sessionId } = await request.json();
    
    if (!message || !channel) {
      return NextResponse.json(
        { error: 'Message and channel are required' },
        { status: 400 }
      );
    }

    // Execute notification sending with error handling
    const result = await executeWithErrorHandling(
      'notification_sending',
      'redis',
      async () => {
        // Initialize Redis connection
        await redisClient.connect();
        
        const redis = await redisClient.getClient();
        
        // Prepare notification data
        const notificationData = {
          message,
          severity: severity || 'info',
          leaseId: leaseId || 'system',
          sessionId: sessionId || 'system',
          timestamp: new Date().toISOString(),
          channel
        };
        
        // Publish notification
        const subscribers = await redis.publish(channel, JSON.stringify(notificationData));
        
        return {
          message,
          channel,
          subscribers,
          timestamp: new Date().toISOString(),
          severity: severity || 'info'
        };
      },
      { message, channel, severity, leaseId, sessionId }
    );

    return NextResponse.json({
      success: true,
      ...result
    });
    
  } catch (error) {
    console.error('Notification sending API error:', error);
    
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
 * PUT /api/notifications/subscribe
 * Subscribe to a notification channel
 */
export async function PUT(request: NextRequest) {
  try {
    const { channel, sessionId, callback } = await request.json();
    
    if (!channel || !sessionId) {
      return NextResponse.json(
        { error: 'Channel and sessionId are required' },
        { status: 400 }
      );
    }

    // Execute subscription with error handling
    const result = await executeWithErrorHandling(
      'notification_subscription',
      'redis',
      async () => {
        // Initialize Redis connection
        await redisClient.connect();
        
        // Subscribe to channel
        const subscriber = await redisClient.subscribeToViolationAlerts((alert) => {
          console.log('Received violation alert:', alert);
          // In a real implementation, this would send to WebSocket
        });
        
        return {
          channel,
          sessionId,
          subscriptionStatus: 'active',
          message: 'Successfully subscribed to notifications'
        };
      },
      { channel, sessionId }
    );

    return NextResponse.json({
      success: true,
      ...result
    });
    
  } catch (error) {
    console.error('Notification subscription API error:', error);
    
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