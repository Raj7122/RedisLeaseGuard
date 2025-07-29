import { NextRequest, NextResponse } from 'next/server';
import { sessionManager } from '@/lib/session-management';

/**
 * Session Management API Endpoints
 * 
 * POST /api/session - Create a new session
 * GET /api/session/:sessionId - Get session data
 * PUT /api/session/:sessionId - Update session status
 * POST /api/session/:sessionId/activity - Log session activity
 * GET /api/session/:sessionId/activities - Get session activities
 * 
 * Security Features:
 * - Input validation and sanitization
 * - Rate limiting (implemented via Redis)
 * - Privacy-compliant data handling
 * - Error handling without exposing sensitive information
 */

export async function POST(request: NextRequest) {
  try {
    const { userAgent, ipAddress, userId } = await request.json();

    // Input validation
    if (userAgent && typeof userAgent !== 'string') {
      return NextResponse.json(
        { error: 'Invalid user agent format' },
        { status: 400 }
      );
    }

    if (ipAddress && typeof ipAddress !== 'string') {
      return NextResponse.json(
        { error: 'Invalid IP address format' },
        { status: 400 }
      );
    }

    if (userId && typeof userId !== 'string') {
      return NextResponse.json(
        { error: 'Invalid user ID format' },
        { status: 400 }
      );
    }

    // Create new session
    const session = await sessionManager.createSession(userAgent, ipAddress, userId);

    return NextResponse.json({
      success: true,
      session: {
        id: session.id,
        createdAt: session.createdAt,
        status: session.status,
        metadata: session.metadata
      }
    });

  } catch (error) {
    console.error('Session creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create session' },
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

    // Get session data
    const session = await sessionManager.getSession(sessionId);

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Return session data without sensitive information
    return NextResponse.json({
      success: true,
      session: {
        id: session.id,
        createdAt: session.createdAt,
        status: session.status,
        metadata: session.metadata
      }
    });

  } catch (error) {
    console.error('Session retrieval error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve session' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const { status } = await request.json();

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    if (!status || !['active', 'expired', 'terminated'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status value' },
        { status: 400 }
      );
    }

    // Update session status
    await sessionManager.updateSessionStatus(sessionId, status);

    return NextResponse.json({
      success: true,
      message: 'Session status updated successfully'
    });

  } catch (error) {
    console.error('Session update error:', error);
    return NextResponse.json(
      { error: 'Failed to update session' },
      { status: 500 }
    );
  }
} 