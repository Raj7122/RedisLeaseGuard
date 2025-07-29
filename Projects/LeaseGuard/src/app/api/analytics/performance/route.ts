import { NextRequest, NextResponse } from 'next/server';
import { sessionManager, PerformanceData } from '@/lib/session-management';

/**
 * Performance Analytics API Endpoints
 * 
 * POST /api/analytics/performance - Track performance metrics
 * 
 * Security Features:
 * - Input validation and sanitization
 * - Performance threshold monitoring
 * - Memory usage tracking
 * - Error handling without exposing sensitive information
 */

export async function POST(request: NextRequest) {
  try {
    const { sessionId, redisQueryTime, geminiResponseTime, totalProcessingTime } = await request.json();

    // Input validation
    if (!sessionId || typeof sessionId !== 'string') {
      return NextResponse.json(
        { error: 'Valid session ID is required' },
        { status: 400 }
      );
    }

    if (typeof redisQueryTime !== 'number' || redisQueryTime < 0) {
      return NextResponse.json(
        { error: 'Valid Redis query time is required' },
        { status: 400 }
      );
    }

    if (typeof geminiResponseTime !== 'number' || geminiResponseTime < 0) {
      return NextResponse.json(
        { error: 'Valid Gemini response time is required' },
        { status: 400 }
      );
    }

    if (typeof totalProcessingTime !== 'number' || totalProcessingTime < 0) {
      return NextResponse.json(
        { error: 'Valid total processing time is required' },
        { status: 400 }
      );
    }

    // Calculate memory usage
    const memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024; // MB

    const performanceData: PerformanceData = {
      eventType: 'performance_metric',
      sessionId,
      timestamp: new Date().toISOString(),
      metrics: {
        redisQueryTime,
        geminiResponseTime,
        totalProcessingTime,
        memoryUsage,
        userId: null // Will be set by session manager if available
      }
    };

    // Track performance
    await sessionManager.trackPerformance(performanceData);

    // Check for performance degradation
    const warnings = [];
    if (redisQueryTime > 100) {
      warnings.push('Redis query time exceeded 100ms threshold');
    }
    if (geminiResponseTime > 2500) {
      warnings.push('Gemini response time exceeded 2.5s threshold');
    }
    if (totalProcessingTime > 5000) {
      warnings.push('Total processing time exceeded 5s threshold');
    }
    if (memoryUsage > 512) {
      warnings.push('Memory usage exceeded 512MB threshold');
    }

    return NextResponse.json({
      success: true,
      message: 'Performance metrics tracked successfully',
      warnings: warnings.length > 0 ? warnings : undefined
    });

  } catch (error) {
    console.error('Performance tracking error:', error);
    return NextResponse.json(
      { error: 'Failed to track performance metrics' },
      { status: 500 }
    );
  }
} 