import { NextRequest, NextResponse } from 'next/server';
import redisClient from '@/lib/redis';
import timeSeriesManager from '@/lib/timeseries-manager';
import alertManager from '@/lib/alert-manager';
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
        await timeSeriesManager.initialize();
        
        const key = `${metric}:${operation}`;
        
        // Get cached metrics for better performance
        const data = await timeSeriesManager.getCachedMetrics(key, from, to);
        
        // Get aggregated metrics for different time buckets
        const hourlyData = await timeSeriesManager.getAggregatedMetrics(key, from, to, 'avg', 3600000); // 1 hour
        const dailyData = await timeSeriesManager.getAggregatedMetrics(key, from, to, 'avg', 86400000); // 1 day
        
        // Get statistics
        const stats = await getTimeSeriesStatistics(key, from, to);
        
        // Check for alerts (using 1h as default timeRange for GET requests)
        const alerts = await alertManager.checkAlerts('1h');
        
        return {
          metric,
          operation,
          data,
          hourlyData,
          dailyData,
          stats,
          alerts,
          timeRange: { from, to },
          generatedAt: new Date().toISOString()
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
        
        // Initialize alert manager
        await alertManager.healthCheck();
        
        // Get system health metrics
        const healthMetrics = await getHealthMetrics(from, now);
        
        // Check for real-time alerts
        const alerts = await alertManager.checkAlerts(timeRange);
        const activeAlerts = alertManager.getActiveAlerts();
        
        return {
          timeRange,
          leaseId,
          processing: processingMetrics,
          engagement: engagementMetrics,
          violations: violationMetrics,
          health: healthMetrics,
          alerts: {
            current: alerts,
            active: activeAlerts
          },
          generatedAt: new Date().toISOString()
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
 * Get TimeSeries statistics with enhanced calculations
 */
async function getTimeSeriesStatistics(key: string, from: number, to: number) {
  try {
    const redis = await redisClient.getClient();
    
    // Get min, max, avg, sum, count using TimeSeries aggregations
    const minData = await timeSeriesManager.getAggregatedMetrics(key, from, to, 'min');
    const maxData = await timeSeriesManager.getAggregatedMetrics(key, from, to, 'max');
    const avgData = await timeSeriesManager.getAggregatedMetrics(key, from, to, 'avg');
    const sumData = await timeSeriesManager.getAggregatedMetrics(key, from, to, 'sum');
    const countData = await timeSeriesManager.getAggregatedMetrics(key, from, to, 'count');
    
    return {
      min: minData.length > 0 ? Math.min(...minData.map(d => d.value)) : 0,
      max: maxData.length > 0 ? Math.max(...maxData.map(d => d.value)) : 0,
      avg: avgData.length > 0 ? avgData.reduce((sum, d) => sum + d.value, 0) / avgData.length : 0,
      sum: sumData.length > 0 ? sumData.reduce((sum, d) => sum + d.value, 0) : 0,
      count: countData.length > 0 ? countData.reduce((sum, d) => sum + d.value, 0) : 0,
      dataPoints: countData.length
    };
  } catch (error) {
    console.error('Error getting TimeSeries statistics:', error);
    return {
      min: 0,
      max: 0,
      avg: 0,
      sum: 0,
      count: 0,
      dataPoints: 0
    };
  }
}

/**
 * Get processing performance metrics with enhanced TimeSeries queries
 */
async function getProcessingMetrics(from: number, to: number) {
  const operations = ['text_extraction', 'clause_extraction', 'clause_processing', 'violation_detection', 'redis_storage', 'total_processing'];
  const metrics: any = {};
  
  // Get multi-series comparison for better performance
  const processingTimeKeys = operations.map(op => `processing_time:${op}`);
  const successRateKeys = operations.map(op => `success_rate:${op}`);
  const throughputKeys = operations.map(op => `throughput:${op}`);
  
  const processingTimeData = await timeSeriesManager.getMultiSeriesComparison(processingTimeKeys, from, to, 'avg');
  const successRateData = await timeSeriesManager.getMultiSeriesComparison(successRateKeys, from, to, 'avg');
  const throughputData = await timeSeriesManager.getMultiSeriesComparison(throughputKeys, from, to, 'sum');
  
  for (const operation of operations) {
    const processingTimeKey = `processing_time:${operation}`;
    const successRateKey = `success_rate:${operation}`;
    const throughputKey = `throughput:${operation}`;
    
    metrics[operation] = {
      processingTime: {
        data: processingTimeData[processingTimeKey] || [],
        avg: processingTimeData[processingTimeKey]?.length > 0 
          ? processingTimeData[processingTimeKey].reduce((sum: number, point: any) => sum + point.value, 0) / processingTimeData[processingTimeKey].length 
          : 0
      },
      successRate: {
        data: successRateData[successRateKey] || [],
        avg: successRateData[successRateKey]?.length > 0 
          ? successRateData[successRateKey].reduce((sum: number, point: any) => sum + point.value, 0) / successRateData[successRateKey].length 
          : 0
      },
      throughput: {
        data: throughputData[throughputKey] || [],
        total: throughputData[throughputKey]?.reduce((sum: number, point: any) => sum + point.value, 0) || 0
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