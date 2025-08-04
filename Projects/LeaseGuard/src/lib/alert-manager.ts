import timeSeriesManager from './timeseries-manager';

/**
 * Alert severity levels
 */
export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

/**
 * Alert configuration interface
 */
interface AlertConfig {
  metric: string;
  threshold: number;
  severity: AlertSeverity;
  condition: 'above' | 'below' | 'equals';
  message: string;
  cooldown?: number; // milliseconds
}

/**
 * Alert interface
 */
export interface Alert {
  id: string;
  type: string;
  severity: AlertSeverity;
  value: number;
  threshold: number;
  message: string;
  timestamp: string;
  metric: string;
  resolved?: boolean;
}

/**
 * Alert Manager for real-time monitoring and alerting
 * Implements S.A.F.E. D.R.Y. principles with comprehensive monitoring
 */
class AlertManager {
  private static instance: AlertManager;
  private alertConfigs: AlertConfig[] = [];
  private activeAlerts = new Map<string, Alert>();
  private lastAlertTime = new Map<string, number>();

  /**
   * Singleton pattern for alert manager
   */
  public static getInstance(): AlertManager {
    if (!AlertManager.instance) {
      AlertManager.instance = new AlertManager();
    }
    return AlertManager.instance;
  }

  /**
   * Initialize default alert configurations
   * Strategic: Pre-configured alerts for common monitoring scenarios
   */
  initializeDefaultAlerts(): void {
    this.alertConfigs = [
      // Processing performance alerts
      {
        metric: 'processing_time:total_processing',
        threshold: 10000, // 10 seconds
        severity: AlertSeverity.WARNING,
        condition: 'above',
        message: 'Document processing is taking longer than expected',
        cooldown: 5 * 60 * 1000 // 5 minutes
      },
      {
        metric: 'processing_time:total_processing',
        threshold: 30000, // 30 seconds
        severity: AlertSeverity.ERROR,
        condition: 'above',
        message: 'Document processing is critically slow',
        cooldown: 2 * 60 * 1000 // 2 minutes
      },
      
      // Error rate alerts
      {
        metric: 'error_rate:total',
        threshold: 0.05, // 5%
        severity: AlertSeverity.WARNING,
        condition: 'above',
        message: 'Error rate is above acceptable threshold',
        cooldown: 10 * 60 * 1000 // 10 minutes
      },
      {
        metric: 'error_rate:total',
        threshold: 0.10, // 10%
        severity: AlertSeverity.CRITICAL,
        condition: 'above',
        message: 'Critical error rate detected',
        cooldown: 5 * 60 * 1000 // 5 minutes
      },
      
      // Success rate alerts
      {
        metric: 'success_rate:total_processing',
        threshold: 0.95, // 95%
        severity: AlertSeverity.WARNING,
        condition: 'below',
        message: 'Success rate is below acceptable threshold',
        cooldown: 5 * 60 * 1000 // 5 minutes
      },
      
      // System health alerts
      {
        metric: 'response_time:api',
        threshold: 2000, // 2 seconds
        severity: AlertSeverity.WARNING,
        condition: 'above',
        message: 'API response time is degraded',
        cooldown: 3 * 60 * 1000 // 3 minutes
      }
    ];
  }

  /**
   * Add custom alert configuration
   */
  addAlertConfig(config: AlertConfig): void {
    this.alertConfigs.push(config);
  }

  /**
   * Check for alerts based on current metrics
   * Automated: Automatic alert checking and generation
   */
  async checkAlerts(timeRange: string = '1h'): Promise<Alert[]> {
    const alerts: Alert[] = [];
    const now = Date.now();
    const from = this.getTimeRangeStart(now, timeRange);

    for (const config of this.alertConfigs) {
      try {
        // Check if we should skip due to cooldown
        const lastAlert = this.lastAlertTime.get(config.metric);
        if (lastAlert && config.cooldown && (now - lastAlert) < config.cooldown) {
          continue;
        }

        // Get current metric value
        const metricData = await timeSeriesManager.getAggregatedMetrics(
          config.metric,
          from,
          now,
          'avg',
          300000 // 5-minute buckets
        );

        if (metricData.length === 0) {
          continue;
        }

        // Calculate current value (average of recent data points)
        const currentValue = metricData.reduce((sum, point) => sum + point.value, 0) / metricData.length;

        // Check if alert condition is met
        const shouldAlert = this.checkAlertCondition(currentValue, config.threshold, config.condition);

        if (shouldAlert) {
          const alert: Alert = {
            id: this.generateAlertId(),
            type: config.metric,
            severity: config.severity,
            value: currentValue,
            threshold: config.threshold,
            message: config.message,
            timestamp: new Date().toISOString(),
            metric: config.metric
          };

          alerts.push(alert);
          this.activeAlerts.set(alert.id, alert);
          this.lastAlertTime.set(config.metric, now);

          console.log(`Alert generated: ${alert.severity} - ${alert.message} (${currentValue} vs ${config.threshold})`);
        }
      } catch (error) {
        console.error(`Error checking alert for ${config.metric}:`, error);
      }
    }

    return alerts;
  }

  /**
   * Check if alert condition is met
   */
  private checkAlertCondition(value: number, threshold: number, condition: string): boolean {
    switch (condition) {
      case 'above':
        return value > threshold;
      case 'below':
        return value < threshold;
      case 'equals':
        return Math.abs(value - threshold) < 0.001; // Small tolerance for floating point
      default:
        return false;
    }
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values());
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.activeAlerts.get(alertId);
    if (alert) {
      alert.resolved = true;
      this.activeAlerts.delete(alertId);
      console.log(`Alert ${alertId} resolved`);
      return true;
    }
    return false;
  }

  /**
   * Clear all alerts
   */
  clearAlerts(): void {
    this.activeAlerts.clear();
    this.lastAlertTime.clear();
    console.log('All alerts cleared');
  }

  /**
   * Get time range start based on range string
   */
  private getTimeRangeStart(now: number, timeRange: string): number {
    switch (timeRange) {
      case '1h':
        return now - (60 * 60 * 1000);
      case '24h':
        return now - (24 * 60 * 60 * 1000);
      case '7d':
        return now - (7 * 24 * 60 * 60 * 1000);
      case '30d':
        return now - (30 * 24 * 60 * 60 * 1000);
      default:
        return now - (60 * 60 * 1000); // Default to 1 hour
    }
  }

  /**
   * Generate unique alert ID
   */
  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Health check for alert manager
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Check if we can access TimeSeries
      await timeSeriesManager.healthCheck();
      
      // Check if alert configurations are loaded
      if (this.alertConfigs.length === 0) {
        this.initializeDefaultAlerts();
      }
      
      return true;
    } catch (error) {
      console.error('Alert manager health check failed:', error);
      return false;
    }
  }
}

// Export singleton instance
const alertManager = AlertManager.getInstance();
export default alertManager; 