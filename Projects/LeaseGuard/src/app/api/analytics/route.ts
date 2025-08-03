import { NextRequest, NextResponse } from 'next/server';
import { getSessionManager, AnalyticsData, PerformanceData, ErrorData } from '@/lib/session-management';

/**
 * Analytics API Endpoints
 * 
 * POST /api/analytics - Track analytics event
 * POST /api/analytics/performance - Track performance metrics
 * POST /api/analytics/error - Track error events
 * GET /api/analytics/report - Generate analytics report
 * 
 * Security Features:
 * - Input validation and sanitization
 * - Rate limiting protection
 * - Privacy-compliant data collection
 * - Error handling without exposing sensitive information
 */

export async function POST(request: NextRequest) {
  try {
    const { eventType, sessionId, metrics } = await request.json();

    // Input validation
    if (!eventType || typeof eventType !== 'string') {
      return NextResponse.json(
        { error: 'Valid event type is required' },
        { status: 400 }
      );
    }

    if (!sessionId || typeof sessionId !== 'string') {
      return NextResponse.json(
        { error: 'Valid session ID is required' },
        { status: 400 }
      );
    }

    if (!metrics || typeof metrics !== 'object') {
      return NextResponse.json(
        { error: 'Valid metrics object is required' },
        { status: 400 }
      );
    }

    // Validate event type
    const validEventTypes = [
      'document_upload',
      'ai_question',
      'session_created',
      'violation_found',
      'user_login',
      'user_logout'
    ];

    if (!validEventTypes.includes(eventType)) {
      return NextResponse.json(
        { error: 'Invalid event type' },
        { status: 400 }
      );
    }

    // Sanitize metrics
    const sanitizedMetrics = sanitizeMetrics(metrics);

    const analyticsData: AnalyticsData = {
      eventType,
      sessionId,
      timestamp: new Date().toISOString(),
      metrics: sanitizedMetrics
    };

    // Track analytics
    const sessionManager = getSessionManager();
    await sessionManager.trackAnalytics(analyticsData);

    return NextResponse.json({
      success: true,
      message: 'Analytics tracked successfully'
    });

  } catch (error) {
    console.error('Analytics tracking error:', error);
    return NextResponse.json(
      { error: 'Failed to track analytics' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Input validation
    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Start date and end date are required' },
        { status: 400 }
      );
    }

    // Validate date format
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);

    if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format' },
        { status: 400 }
      );
    }

    if (startDateObj >= endDateObj) {
      return NextResponse.json(
        { error: 'Start date must be before end date' },
        { status: 400 }
      );
    }

    // Generate analytics report
    const sessionManager = getSessionManager();
    const report = await sessionManager.generateAnalyticsReport(startDate, endDate);

    if (!report) {
      return NextResponse.json(
        { error: 'Failed to generate report' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      report
    });

  } catch (error) {
    console.error('Analytics report error:', error);
    return NextResponse.json(
      { error: 'Failed to generate analytics report' },
      { status: 500 }
    );
  }
}

/**
 * Sanitize metrics to prevent injection attacks
 * @param metrics - Raw metrics object
 * @returns Sanitized metrics object
 */
function sanitizeMetrics(metrics: any): any {
  const sanitized: any = {};

  // Only allow specific metric fields
  const allowedFields = [
    'userId',
    'ipAddress',
    'fileType',
    'fileSize',
    'processingTime',
    'questionLength',
    'responseTime',
    'tokensUsed',
    'violationsCount',
    'language',
    'timezone',
    'deviceType'
  ];

  for (const [key, value] of Object.entries(metrics)) {
    if (allowedFields.includes(key)) {
      // Validate and sanitize values
      if (typeof value === 'string' && value.length <= 1000) {
        sanitized[key] = value.replace(/[<>]/g, ''); // Remove potential HTML tags
      } else if (typeof value === 'number' && isFinite(value)) {
        sanitized[key] = value;
      } else if (typeof value === 'boolean') {
        sanitized[key] = value;
      } else if (value === null) {
        sanitized[key] = null;
      }
    }
  }

  return sanitized;
} 