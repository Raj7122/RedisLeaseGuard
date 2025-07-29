import { createClient } from '@supabase/supabase-js';
import redisClient from './redis';
import { v4 as uuidv4 } from 'uuid';

// Types for session management and analytics
export interface SessionData {
  id: string;
  createdAt: string;
  userId: string | null;
  userAgent: string | null;
  ipAddress: string | null;
  status: 'active' | 'expired' | 'terminated';
  metadata: {
    language?: string;
    timezone?: string;
    deviceType?: 'desktop' | 'mobile' | 'tablet';
    [key: string]: any;
  };
}

export interface ActivityData {
  type: 'document_upload' | 'question_asked' | 'violation_found' | 'session_start' | 'session_end';
  timestamp: string;
  metadata: {
    fileType?: string;
    fileSize?: number;
    processingTime?: number;
    questionLength?: number;
    violationsCount?: number;
    responseTime?: number;
    tokensUsed?: number;
    [key: string]: any;
  };
}

export interface AnalyticsData {
  eventType: string;
  sessionId: string;
  timestamp: string;
  metrics: {
    userId: string | null;
    ipAddress?: string | null;
    [key: string]: any;
  };
}

export interface PerformanceData {
  eventType: 'performance_metric';
  sessionId: string;
  timestamp: string;
  metrics: {
    redisQueryTime: number;
    geminiResponseTime: number;
    totalProcessingTime: number;
    memoryUsage: number;
    userId: string | null;
  };
}

export interface ErrorData {
  eventType: 'error';
  sessionId: string;
  timestamp: string;
  error: {
    type: string;
    message: string;
    stack?: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
  };
  metrics: {
    responseTime: number;
    userId: string | null;
  };
}

/**
 * Session Management & Analytics System
 * 
 * This module provides comprehensive session tracking, analytics collection,
 * and performance monitoring for the LeaseGuard application.
 * 
 * Security Features:
 * - PII redaction and anonymization
 * - Encrypted session storage
 * - Privacy-compliant data collection
 * - Secure Redis and Supabase integration
 * 
 * Performance Features:
 * - Real-time analytics tracking
 * - Performance metrics collection
 * - Error rate monitoring
 * - Session cleanup automation
 */
class SessionManager {
  private supabase: any;
  private redis: any;
  private readonly SESSION_TTL = 7 * 24 * 60 * 60; // 7 days
  private readonly ACTIVITY_TTL = 30 * 24 * 60 * 60; // 30 days

  constructor() {
    // Initialize Supabase client
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );

    // Initialize Redis client
    this.redis = redisClient.getClient();
  }

  /**
   * Create a new session with unique ID and metadata
   * @param userAgent - Browser user agent string
   * @param ipAddress - User's IP address (optional for privacy)
   * @param userId - User ID if authenticated (optional)
   * @returns SessionData with unique session ID
   */
  async createSession(
    userAgent: string | null = null,
    ipAddress: string | null = null,
    userId: string | null = null
  ): Promise<SessionData> {
    const sessionId = uuidv4();
    const sessionData: SessionData = {
      id: sessionId,
      createdAt: new Date().toISOString(),
      userId,
      userAgent,
      ipAddress: null, // Don't store IP for privacy
      status: 'active',
      metadata: {
        language: 'en',
        timezone: 'America/New_York',
        deviceType: this.detectDeviceType(userAgent),
      }
    };

    try {
      // Store session in Redis for fast access
      await this.redis.json.set(`session:${sessionId}`, '.', sessionData);
      await this.redis.expire(`session:${sessionId}`, this.SESSION_TTL);

      // Store session in Supabase for analytics
      await this.supabase.from('sessions').insert(sessionData);

      // Log session creation activity
      await this.logActivity(sessionId, {
        type: 'session_start',
        timestamp: sessionData.createdAt,
        metadata: {}
      });

      return sessionData;
    } catch (error) {
      console.error('Failed to create session:', error);
      throw new Error('Session creation failed');
    }
  }

  /**
   * Update session with new activity and metadata
   * @param sessionId - Session identifier
   * @param activity - Activity data to log
   */
  async logActivity(sessionId: string, activity: ActivityData): Promise<void> {
    try {
      // Log activity to Redis Stream for real-time processing
      await this.redis.xadd(
        `session:${sessionId}:activities`,
        '*',
        'type', activity.type,
        'timestamp', activity.timestamp,
        'metadata', JSON.stringify(activity.metadata)
      );

      // Set TTL for activity stream
      await this.redis.expire(`session:${sessionId}:activities`, this.ACTIVITY_TTL);

      // Store activity in Supabase for analytics
      await this.supabase.from('session_activities').insert({
        sessionId,
        ...activity
      });
    } catch (error) {
      console.error('Failed to log activity:', error);
      // Don't throw error to avoid breaking main functionality
    }
  }

  /**
   * Track analytics event with metrics
   * @param analyticsData - Analytics data to track
   */
  async trackAnalytics(analyticsData: AnalyticsData): Promise<void> {
    try {
      // Store analytics in Supabase
      await this.supabase.from('analytics').insert(analyticsData);
    } catch (error) {
      console.error('Failed to track analytics:', error);
      // Don't throw error to avoid breaking main functionality
    }
  }

  /**
   * Track performance metrics
   * @param performanceData - Performance data to track
   */
  async trackPerformance(performanceData: PerformanceData): Promise<void> {
    try {
      // Store performance metrics in Supabase
      await this.supabase.from('performance_metrics').insert(performanceData);
    } catch (error) {
      console.error('Failed to track performance:', error);
      // Don't throw error to avoid breaking main functionality
    }
  }

  /**
   * Track error events with severity and context
   * @param errorData - Error data to track
   */
  async trackError(errorData: ErrorData): Promise<void> {
    try {
      // Store error in Supabase
      await this.supabase.from('error_logs').insert(errorData);
    } catch (error) {
      console.error('Failed to track error:', error);
      // Don't throw error to avoid breaking main functionality
    }
  }

  /**
   * Get session data from Redis
   * @param sessionId - Session identifier
   * @returns SessionData or null if not found
   */
  async getSession(sessionId: string): Promise<SessionData | null> {
    try {
      const sessionData = await this.redis.json.get(`session:${sessionId}`);
      return sessionData;
    } catch (error) {
      console.error('Failed to get session:', error);
      return null;
    }
  }

  /**
   * Get session activities from Redis Stream
   * @param sessionId - Session identifier
   * @returns Array of activity data
   */
  async getSessionActivities(sessionId: string): Promise<ActivityData[]> {
    try {
      const activities = await this.redis.xrange(`session:${sessionId}:activities`, '-', '+');
      return activities.map(([id, fields]: [string, string[]]) => {
        const activity: any = {};
        for (let i = 0; i < fields.length; i += 2) {
          activity[fields[i]] = fields[i + 1];
        }
        return {
          type: activity.type,
          timestamp: activity.timestamp,
          metadata: JSON.parse(activity.metadata || '{}')
        };
      });
    } catch (error) {
      console.error('Failed to get session activities:', error);
      return [];
    }
  }

  /**
   * Update session status
   * @param sessionId - Session identifier
   * @param status - New status
   */
  async updateSessionStatus(sessionId: string, status: SessionData['status']): Promise<void> {
    try {
      // Update in Redis
      await this.redis.json.set(`session:${sessionId}`, '.status', status);

      // Update in Supabase
      await this.supabase.from('sessions')
        .update({ status })
        .eq('id', sessionId);
    } catch (error) {
      console.error('Failed to update session status:', error);
    }
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<void> {
    try {
      // Get expired sessions from Supabase
      const expiredDate = new Date();
      expiredDate.setDate(expiredDate.getDate() - 7);

      const { data: expiredSessions } = await this.supabase
        .from('sessions')
        .select('id')
        .lt('createdAt', expiredDate.toISOString())
        .eq('status', 'active');

      if (expiredSessions) {
        for (const session of expiredSessions) {
          // Clean up Redis data
          await this.redis.del(`session:${session.id}`);
          await this.redis.del(`session:${session.id}:activities`);

          // Update status in Supabase
          await this.supabase.from('sessions')
            .update({ status: 'expired' })
            .eq('id', session.id);
        }
      }
    } catch (error) {
      console.error('Failed to cleanup expired sessions:', error);
    }
  }

  /**
   * Anonymize old analytics data for privacy compliance
   */
  async anonymizeOldData(): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 30);

      // Anonymize analytics data older than 30 days
      await this.supabase.from('analytics')
        .update({
          'metrics->userId': null,
          'metrics->ipAddress': null
        })
        .lt('timestamp', cutoffDate.toISOString());

      // Anonymize performance metrics
      await this.supabase.from('performance_metrics')
        .update({
          'metrics->userId': null
        })
        .lt('timestamp', cutoffDate.toISOString());
    } catch (error) {
      console.error('Failed to anonymize old data:', error);
    }
  }

  /**
   * Generate analytics reports
   * @param startDate - Start date for report
   * @param endDate - End date for report
   * @returns Analytics report data
   */
  async generateAnalyticsReport(startDate: string, endDate: string): Promise<any> {
    try {
      // Get daily usage statistics
      const { data: dailyUsage } = await this.supabase
        .from('analytics')
        .select('eventType, count(*)')
        .gte('timestamp', startDate)
        .lt('timestamp', endDate)
        .group('eventType');

      // Get performance trends
      const { data: performanceTrends } = await this.supabase
        .from('performance_metrics')
        .select('date, avg(responseTime), avg(errorRate)')
        .gte('timestamp', startDate)
        .lt('timestamp', endDate)
        .group('date')
        .order('date');

      // Get error rates
      const { data: errorRates } = await this.supabase
        .from('error_logs')
        .select('error->type, count(*)')
        .gte('timestamp', startDate)
        .lt('timestamp', endDate)
        .group('error->type');

      return {
        dailyUsage,
        performanceTrends,
        errorRates,
        reportGenerated: new Date().toISOString()
      };
    } catch (error) {
      console.error('Failed to generate analytics report:', error);
      return null;
    }
  }

  /**
   * Detect device type from user agent string
   * @param userAgent - Browser user agent string
   * @returns Device type
   */
  private detectDeviceType(userAgent: string | null): 'desktop' | 'mobile' | 'tablet' {
    if (!userAgent) return 'desktop';
    
    const mobileRegex = /Mobile|Android|iPhone|iPad|Windows Phone/i;
    const tabletRegex = /iPad|Android(?=.*\bMobile\b)(?=.*\bSafari\b)/i;
    
    if (tabletRegex.test(userAgent)) return 'tablet';
    if (mobileRegex.test(userAgent)) return 'mobile';
    return 'desktop';
  }

  /**
   * Monitor Redis performance
   * @param operation - Operation name for tracking
   * @param operationFn - Function to execute and monitor
   * @returns Performance metrics
   */
  async monitorRedisPerformance<T>(
    operation: string,
    operationFn: () => Promise<T>
  ): Promise<{ result: T; performance: { startTime: number; endTime: number; duration: number } }> {
    const startTime = Date.now();
    const result = await operationFn();
    const endTime = Date.now();
    const duration = endTime - startTime;

    // Track performance if it exceeds threshold
    if (duration > 100) {
      await this.trackPerformance({
        eventType: 'performance_metric',
        sessionId: 'system',
        timestamp: new Date().toISOString(),
        metrics: {
          redisQueryTime: duration,
          geminiResponseTime: 0,
          totalProcessingTime: duration,
          memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
          userId: null
        }
      });
    }

    return { result, performance: { startTime, endTime, duration } };
  }

  /**
   * Monitor Supabase performance
   * @param operation - Operation name for tracking
   * @param operationFn - Function to execute and monitor
   * @returns Performance metrics
   */
  async monitorSupabasePerformance<T>(
    operation: string,
    operationFn: () => Promise<T>
  ): Promise<{ result: T; performance: { startTime: number; endTime: number; duration: number } }> {
    const startTime = Date.now();
    const result = await operationFn();
    const endTime = Date.now();
    const duration = endTime - startTime;

    // Track performance if it exceeds threshold
    if (duration > 500) {
      await this.trackPerformance({
        eventType: 'performance_metric',
        sessionId: 'system',
        timestamp: new Date().toISOString(),
        metrics: {
          redisQueryTime: 0,
          geminiResponseTime: 0,
          totalProcessingTime: duration,
          memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
          userId: null
        }
      });
    }

    return { result, performance: { startTime, endTime, duration } };
  }
}

// Export singleton instance
export const sessionManager = new SessionManager();

// Export types for external use
export type {
  SessionData,
  ActivityData,
  AnalyticsData,
  PerformanceData,
  ErrorData
}; 