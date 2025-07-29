import { NextRequest, NextResponse } from 'next/server';
import { sessionManager, ErrorData } from '@/lib/session-management';

/**
 * Error Analytics API Endpoints
 * 
 * POST /api/analytics/error - Track error events
 * 
 * Security Features:
 * - Input validation and sanitization
 * - Error severity classification
 * - Stack trace sanitization
 * - Error handling without exposing sensitive information
 */

export async function POST(request: NextRequest) {
  try {
    const { sessionId, error, responseTime } = await request.json();

    // Input validation
    if (!sessionId || typeof sessionId !== 'string') {
      return NextResponse.json(
        { error: 'Valid session ID is required' },
        { status: 400 }
      );
    }

    if (!error || typeof error !== 'object') {
      return NextResponse.json(
        { error: 'Valid error object is required' },
        { status: 400 }
      );
    }

    if (!error.type || typeof error.type !== 'string') {
      return NextResponse.json(
        { error: 'Valid error type is required' },
        { status: 400 }
      );
    }

    if (!error.message || typeof error.message !== 'string') {
      return NextResponse.json(
        { error: 'Valid error message is required' },
        { status: 400 }
      );
    }

    if (!error.severity || !['low', 'medium', 'high', 'critical'].includes(error.severity)) {
      return NextResponse.json(
        { error: 'Valid error severity is required' },
        { status: 400 }
      );
    }

    if (typeof responseTime !== 'number' || responseTime < 0) {
      return NextResponse.json(
        { error: 'Valid response time is required' },
        { status: 400 }
      );
    }

    // Sanitize error data
    const sanitizedError = {
      type: error.type.replace(/[<>]/g, '').substring(0, 100),
      message: error.message.replace(/[<>]/g, '').substring(0, 1000),
      stack: error.stack ? sanitizeStackTrace(error.stack) : undefined,
      severity: error.severity
    };

    const errorData: ErrorData = {
      eventType: 'error',
      sessionId,
      timestamp: new Date().toISOString(),
      error: sanitizedError,
      metrics: {
        responseTime,
        userId: null // Will be set by session manager if available
      }
    };

    // Track error
    await sessionManager.trackError(errorData);

    // Check for critical errors that need immediate attention
    if (error.severity === 'critical') {
      console.error('CRITICAL ERROR DETECTED:', {
        sessionId,
        errorType: error.type,
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Error tracked successfully',
      severity: error.severity
    });

  } catch (error) {
    console.error('Error tracking error:', error);
    return NextResponse.json(
      { error: 'Failed to track error' },
      { status: 500 }
    );
  }
}

/**
 * Sanitize stack trace to remove sensitive information
 * @param stackTrace - Raw stack trace string
 * @returns Sanitized stack trace string
 */
function sanitizeStackTrace(stackTrace: string): string {
  // Remove file paths that might contain sensitive information
  let sanitized = stackTrace
    .replace(/at\s+.*?\(.*?\)/g, (match) => {
      // Keep function names but remove file paths
      const functionMatch = match.match(/at\s+(.+?)\s+\(/);
      if (functionMatch) {
        return `at ${functionMatch[1]} (<sanitized>)`;
      }
      return match;
    })
    .replace(/at\s+.*?:\d+:\d+/g, (match) => {
      // Remove line numbers and file paths
      const functionMatch = match.match(/at\s+(.+?)\s+/);
      if (functionMatch) {
        return `at ${functionMatch[1]} (<sanitized>)`;
      }
      return match;
    });

  // Limit stack trace length
  if (sanitized.length > 2000) {
    sanitized = sanitized.substring(0, 2000) + '... (truncated)';
  }

  return sanitized;
} 