import { NextRequest, NextResponse } from 'next/server';
import redisClient from '@/lib/redis';
import { executeWithErrorHandling } from '@/lib/error-handling';

/**
 * GET /api/analytics
 * Get performance analytics and metrics
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const metric = searchParams.get('metric') || 'processing_time';
    const operation = searchParams.get('operation') || 'total_processing';
    const from = parseInt(searchParams.get('from') || '0');
    const to = parseInt(searchParams.get('to') || Date.now().toString());
    
    const result = await executeWithErrorHandling(
      'analytics_query',
      'redis',
      async () => {
        await redisClient.connect();
        
        const key = `${metric}:${operation}`;
        const data = await redisClient.getTimeSeriesData(key, from, to);
        const stats = await redisClient.getTimeSeriesStats(key, from, to);
        
        return {
          metric,
          operation,
          data,
          stats,
          timeRange: { from, to }
        };
      },
      { sessionId: 'analytics' }
    );

    return NextResponse.json({
      success: true,
      ...result
    });
    
  } catch (error) {
    console.error('Analytics API error:', error);
    
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
 * POST /api/analytics
 * Get comprehensive analytics dashboard data
 */
export async function POST(request: NextRequest) {
  try {
    const { timeRange = '24h', leaseId } = await request.json();
    
    const result = await executeWithErrorHandling(
      'analytics_dashboard',
      'redis',
      async () => {
        await redisClient.connect();
        
        const now = Date.now();
        let from: number;
        
        switch (timeRange) {
          case '1h':
            from = now - (60 * 60 * 1000);
            break;
          case '24h':
            from = now - (24 * 60 * 60 * 1000);
            break;
          case '7d':
            from = now - (7 * 24 * 60 * 60 * 1000);
            break;
          case '30d':
            from = now - (30 * 24 * 60 * 60 * 1000);
            break;
          default:
            from = now - (24 * 60 * 60 * 1000); // Default to 24h
        }
        
        // Get processing performance metrics
        const processingMetrics = await getProcessingMetrics(from, now);
        
        // Get user engagement metrics
        const engagementMetrics = await getEngagementMetrics(from, now);
        
        // Get violation detection metrics
        const violationMetrics = await getViolationMetrics(from, now, leaseId);
        
        // Get system health metrics
        const healthMetrics = await getHealthMetrics(from, now);
        
        return {
          timeRange,
          leaseId,
          processing: processingMetrics,
          engagement: engagementMetrics,
          violations: violationMetrics,
          health: healthMetrics
        };
      },
      { sessionId: leaseId || 'analytics' }
    );

    return NextResponse.json({
      success: true,
      ...result
    });
    
  } catch (error) {
    console.error('Analytics dashboard API error:', error);
    
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
 * Get processing performance metrics
 */
async function getProcessingMetrics(from: number, to: number) {
  const operations = ['text_extraction', 'clause_extraction', 'clause_processing', 'violation_detection', 'redis_storage', 'total_processing'];
  const metrics: any = {};
  
  for (const operation of operations) {
    const processingTimeData = await redisClient.getTimeSeriesData(`processing_time:${operation}`, from, to);
    const successRateData = await redisClient.getTimeSeriesData(`success_rate:${operation}`, from, to);
    const throughputData = await redisClient.getTimeSeriesData(`throughput:${operation}`, from, to);
    
    metrics[operation] = {
      processingTime: {
        data: processingTimeData,
        avg: processingTimeData.length > 0 ? processingTimeData.reduce((sum: number, point: any) => sum + point[1], 0) / processingTimeData.length : 0
      },
      successRate: {
        data: successRateData,
        avg: successRateData.length > 0 ? successRateData.reduce((sum: number, point: any) => sum + point[1], 0) / successRateData.length : 0
      },
      throughput: {
        data: throughputData,
        total: throughputData.reduce((sum: number, point: any) => sum + point[1], 0)
      }
    };
  }
  
  return metrics;
}

/**
 * Get user engagement metrics
 */
async function getEngagementMetrics(from: number, to: number) {
  try {
    const redis = await redisClient.getClient();
    
    // Get session data
    const sessionKeys = await redis.keys('session:*');
    const sessions = [];
    
    for (const key of sessionKeys) {
      const sessionData = await redis.json.get(key);
      if (sessionData && sessionData.lastActivity) {
        const lastActivity = new Date(sessionData.lastActivity).getTime();
        if (lastActivity >= from && lastActivity <= to) {
          sessions.push(sessionData);
        }
      }
    }
    
    return {
      totalSessions: sessions.length,
      activeSessions: sessions.filter(s => s.participants && s.participants.length > 0).length,
      avgSessionDuration: sessions.length > 0 ? sessions.reduce((sum, s) => {
        const duration = new Date(s.lastActivity).getTime() - new Date(s.createdAt).getTime();
        return sum + duration;
      }, 0) / sessions.length : 0
    };
  } catch (error) {
    console.error('Error getting engagement metrics:', error);
    return {
      totalSessions: 0,
      activeSessions: 0,
      avgSessionDuration: 0
    };
  }
}

/**
 * Get violation detection metrics
 */
async function getViolationMetrics(from: number, to: number, leaseId?: string) {
  try {
    const redis = await redisClient.getClient();
    
    // Get violation events from stream
    const violationEvents = await redisClient.getEventStream('lease_processing_stream', '0');
    const filteredEvents = violationEvents.filter((event: any) => {
      const eventTime = new Date(event.timestamp).getTime();
      return eventTime >= from && eventTime <= to && 
             event.type === 'violations_detected' &&
             (!leaseId || event.data.leaseId === leaseId);
    });
    
    const totalViolations = filteredEvents.reduce((sum: number, event: any) => {
      return sum + (event.data.violationCount || 0);
    }, 0);
    
    const severityBreakdown = {
      Critical: 0,
      High: 0,
      Medium: 0,
      Low: 0
    };
    
    filteredEvents.forEach((event: any) => {
      event.data.violations?.forEach((violation: any) => {
        if (severityBreakdown[violation.severity as keyof typeof severityBreakdown] !== undefined) {
          severityBreakdown[violation.severity as keyof typeof severityBreakdown]++;
        }
      });
    });
    
    return {
      totalViolations,
      severityBreakdown,
      detectionEvents: filteredEvents.length
    };
  } catch (error) {
    console.error('Error getting violation metrics:', error);
    return {
      totalViolations: 0,
      severityBreakdown: { Critical: 0, High: 0, Medium: 0, Low: 0 },
      detectionEvents: 0
    };
  }
}

/**
 * Get system health metrics
 */
async function getHealthMetrics(from: number, to: number) {
  try {
    const redis = await redisClient.getClient();
    
    // Get error events
    const errorEvents = await redisClient.getEventStream('lease_processing_stream', '0');
    const filteredErrors = errorEvents.filter((event: any) => {
      const eventTime = new Date(event.timestamp).getTime();
      return eventTime >= from && eventTime <= to && event.type === 'processing_error';
    });
    
    return {
      totalErrors: filteredErrors.length,
      errorRate: errorEvents.length > 0 ? (filteredErrors.length / errorEvents.length) * 100 : 0,
      redisHealth: await redisClient.healthCheck(),
      lastError: filteredErrors.length > 0 ? filteredErrors[filteredErrors.length - 1] : null
    };
  } catch (error) {
    console.error('Error getting health metrics:', error);
    return {
      totalErrors: 0,
      errorRate: 0,
      redisHealth: false,
      lastError: null
    };
  }
} 