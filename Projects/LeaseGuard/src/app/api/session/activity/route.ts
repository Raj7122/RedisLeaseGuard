import { NextRequest, NextResponse } from 'next/server';
import { sessionManager, ActivityData } from '@/lib/session-management';

/**
 * Session Activity API Endpoints
 * 
 * POST /api/session/activity - Log session activity
 * GET /api/session/activity - Get session activities
 * 
 * Security Features:
 * - Input validation and sanitization
 * - Activity type validation
 * - Metadata sanitization
 * - Rate limiting protection
 */

export async function POST(request: NextRequest) {
  try {
    const { sessionId, activity } = await request.json();

    // Input validation
    if (!sessionId || typeof sessionId !== 'string') {
      return NextResponse.json(
        { error: 'Valid session ID is required' },
        { status: 400 }
      );
    }

    if (!activity || typeof activity !== 'object') {
      return NextResponse.json(
        { error: 'Valid activity data is required' },
        { status: 400 }
      );
    }

    // Validate activity type
    const validActivityTypes = [
      'document_upload',
      'question_asked',
      'violation_found',
      'session_start',
      'session_end'
    ];

    if (!activity.type || !validActivityTypes.includes(activity.type)) {
      return NextResponse.json(
        { error: 'Invalid activity type' },
        { status: 400 }
      );
    }

    // Validate timestamp
    if (!activity.timestamp || typeof activity.timestamp !== 'string') {
      return NextResponse.json(
        { error: 'Valid timestamp is required' },
        { status: 400 }
      );
    }

    // Validate metadata
    if (activity.metadata && typeof activity.metadata !== 'object') {
      return NextResponse.json(
        { error: 'Metadata must be an object' },
        { status: 400 }
      );
    }

    // Sanitize metadata to prevent injection
    const sanitizedMetadata = sanitizeMetadata(activity.metadata || {});

    const activityData: ActivityData = {
      type: activity.type,
      timestamp: activity.timestamp,
      metadata: sanitizedMetadata
    };

    // Log activity
    await sessionManager.logActivity(sessionId, activityData);

    return NextResponse.json({
      success: true,
      message: 'Activity logged successfully'
    });

  } catch (error) {
    console.error('Activity logging error:', error);
    return NextResponse.json(
      { error: 'Failed to log activity' },
      { status: 500 }
    );
  }
}

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

    // Input validation
    if (typeof sessionId !== 'string' || sessionId.length < 10) {
      return NextResponse.json(
        { error: 'Invalid session ID format' },
        { status: 400 }
      );
    }

    // Get session activities
    const activities = await sessionManager.getSessionActivities(sessionId);

    return NextResponse.json({
      success: true,
      activities: activities.map(activity => ({
        type: activity.type,
        timestamp: activity.timestamp,
        metadata: activity.metadata
      }))
    });

  } catch (error) {
    console.error('Activity retrieval error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve activities' },
      { status: 500 }
    );
  }
}

/**
 * Sanitize metadata to prevent injection attacks
 * @param metadata - Raw metadata object
 * @returns Sanitized metadata object
 */
function sanitizeMetadata(metadata: any): any {
  const sanitized: any = {};

  // Only allow specific metadata fields
  const allowedFields = [
    'fileType',
    'fileSize',
    'processingTime',
    'questionLength',
    'violationsCount',
    'responseTime',
    'tokensUsed',
    'language',
    'timezone',
    'deviceType'
  ];

  for (const [key, value] of Object.entries(metadata)) {
    if (allowedFields.includes(key)) {
      // Validate and sanitize values
      if (typeof value === 'string' && value.length <= 1000) {
        sanitized[key] = value.replace(/[<>]/g, ''); // Remove potential HTML tags
      } else if (typeof value === 'number' && isFinite(value)) {
        sanitized[key] = value;
      } else if (typeof value === 'boolean') {
        sanitized[key] = value;
      }
    }
  }

  return sanitized;
} 