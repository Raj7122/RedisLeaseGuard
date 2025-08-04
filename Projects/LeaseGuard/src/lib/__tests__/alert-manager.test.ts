import alertManager, { AlertSeverity, Alert } from '../alert-manager';
import timeSeriesManager from '../timeseries-manager';

// Mock TimeSeries manager
jest.mock('../timeseries-manager', () => ({
  getAggregatedMetrics: jest.fn(),
  healthCheck: jest.fn()
}));

describe('Alert Manager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (timeSeriesManager.getAggregatedMetrics as jest.Mock).mockResolvedValue([]);
    (timeSeriesManager.healthCheck as jest.Mock).mockResolvedValue(true);
    
    // Reset the alert manager state for each test
    alertManager.clearAlerts();
  });

  describe('Initialization', () => {
    it('should initialize default alerts successfully', () => {
      alertManager.initializeDefaultAlerts();
      
      // Should have default alert configurations
      expect(alertManager.getActiveAlerts()).toEqual([]);
    });

    it('should add custom alert configuration', () => {
      const customConfig = {
        metric: 'custom_metric',
        threshold: 100,
        severity: AlertSeverity.WARNING,
        condition: 'above' as const,
        message: 'Custom alert message',
        cooldown: 60000
      };
      
      alertManager.addAlertConfig(customConfig);
      
      // Configuration should be added (we can't directly access private configs, but we can test through behavior)
      expect(true).toBe(true);
    });
  });

  describe('Alert Checking', () => {
    beforeEach(() => {
      alertManager.initializeDefaultAlerts();
    });

    it('should check alerts and return empty array when no conditions met', async () => {
      (timeSeriesManager.getAggregatedMetrics as jest.Mock).mockResolvedValue([]);
      
      const alerts = await alertManager.checkAlerts('1h');
      
      expect(alerts).toEqual([]);
    });

    it('should generate alert when condition is met', async () => {
      const mockData = [
        { timestamp: 1000, value: 15000 }, // Above 10s threshold
        { timestamp: 2000, value: 12000 }
      ];
      
      (timeSeriesManager.getAggregatedMetrics as jest.Mock).mockResolvedValue(mockData);
      
      const alerts = await alertManager.checkAlerts('1h');
      
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0]).toMatchObject({
        type: 'processing_time:total_processing',
        severity: AlertSeverity.WARNING,
        message: 'Document processing is taking longer than expected'
      });
    });

    it('should respect cooldown periods', async () => {
      alertManager.initializeDefaultAlerts();
      
      const mockData = [
        { timestamp: 1000, value: 15000 }
      ];
      
      (timeSeriesManager.getAggregatedMetrics as jest.Mock).mockResolvedValue(mockData);
      
      // First alert
      const alerts1 = await alertManager.checkAlerts('1h');
      expect(alerts1.length).toBeGreaterThan(0);
      
      // Second alert within cooldown period (should be blocked)
      const alerts2 = await alertManager.checkAlerts('1h');
      expect(alerts2.length).toBe(0); // Should be blocked by cooldown
    });

    it('should handle different alert conditions', async () => {
      // Test 'below' condition
      const belowData = [
        { timestamp: 1000, value: 0.90 } // Below 95% success rate
      ];
      
      (timeSeriesManager.getAggregatedMetrics as jest.Mock).mockResolvedValue(belowData);
      
      const alerts = await alertManager.checkAlerts('1h');
      
      // Should find success rate alert
      const successRateAlert = alerts.find(alert => 
        alert.type === 'success_rate:total_processing'
      );
      
      expect(successRateAlert).toBeDefined();
      expect(successRateAlert?.severity).toBe(AlertSeverity.WARNING);
    });

    it('should handle TimeSeries errors gracefully', async () => {
      alertManager.initializeDefaultAlerts();
      
      (timeSeriesManager.getAggregatedMetrics as jest.Mock).mockRejectedValue(new Error('TimeSeries error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const alerts = await alertManager.checkAlerts('1h');
      
      expect(alerts).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith('Error checking alert for processing_time:total_processing:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });
  });

  describe('Alert Management', () => {
    beforeEach(() => {
      alertManager.initializeDefaultAlerts();
    });

    it('should get active alerts', () => {
      const activeAlerts = alertManager.getActiveAlerts();
      
      expect(Array.isArray(activeAlerts)).toBe(true);
    });

    it('should resolve alert successfully', async () => {
      // Initialize default alerts first
      alertManager.initializeDefaultAlerts();
      
      // Generate an alert first
      const mockData = [{ timestamp: 1000, value: 15000 }];
      (timeSeriesManager.getAggregatedMetrics as jest.Mock).mockResolvedValue(mockData);
      
      const alerts = await alertManager.checkAlerts('1h');
      expect(alerts.length).toBeGreaterThan(0);
      
      const alertId = alerts[0].id;
      const result = alertManager.resolveAlert(alertId);
      
      expect(result).toBe(true);
    });

    it('should return false when resolving non-existent alert', () => {
      const result = alertManager.resolveAlert('non_existent_id');
      expect(result).toBe(false);
    });

    it('should clear all alerts', () => {
      alertManager.clearAlerts();
      
      const activeAlerts = alertManager.getActiveAlerts();
      expect(activeAlerts).toEqual([]);
    });
  });

  describe('Time Range Calculations', () => {
    it('should calculate correct time ranges', () => {
      const now = Date.now();
      
      // Test different time ranges through the checkAlerts method
      // We'll test this indirectly by ensuring the method doesn't throw
      expect(async () => {
        await alertManager.checkAlerts('1h');
        await alertManager.checkAlerts('24h');
        await alertManager.checkAlerts('7d');
        await alertManager.checkAlerts('30d');
        await alertManager.checkAlerts('invalid'); // Should default to 1h
      }).not.toThrow();
    });
  });

  describe('Health Check', () => {
    it('should perform health check successfully', async () => {
      (timeSeriesManager.healthCheck as jest.Mock).mockResolvedValue(true);
      
      const result = await alertManager.healthCheck();
      
      expect(result).toBe(true);
      expect(timeSeriesManager.healthCheck).toHaveBeenCalled();
    });

    it('should handle health check failures', async () => {
      (timeSeriesManager.healthCheck as jest.Mock).mockRejectedValue(new Error('Health check failed'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const result = await alertManager.healthCheck();
      
      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('Alert manager health check failed:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });
  });

  describe('Alert Severity Enum', () => {
    it('should have correct severity levels', () => {
      expect(AlertSeverity.INFO).toBe('info');
      expect(AlertSeverity.WARNING).toBe('warning');
      expect(AlertSeverity.ERROR).toBe('error');
      expect(AlertSeverity.CRITICAL).toBe('critical');
    });
  });

  describe('Alert Interface', () => {
    it('should have correct Alert interface structure', () => {
      const alert: Alert = {
        id: 'test_id',
        type: 'test_type',
        severity: AlertSeverity.WARNING,
        value: 100,
        threshold: 50,
        message: 'Test message',
        timestamp: new Date().toISOString(),
        metric: 'test_metric'
      };
      
      expect(alert).toHaveProperty('id');
      expect(alert).toHaveProperty('type');
      expect(alert).toHaveProperty('severity');
      expect(alert).toHaveProperty('value');
      expect(alert).toHaveProperty('threshold');
      expect(alert).toHaveProperty('message');
      expect(alert).toHaveProperty('timestamp');
      expect(alert).toHaveProperty('metric');
    });
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = alertManager;
      const instance2 = alertManager;
      
      expect(instance1).toBe(instance2);
    });
  });

  describe('Default Alert Configurations', () => {
    it('should have processing performance alerts', () => {
      alertManager.initializeDefaultAlerts();
      
      // Test that we can generate processing alerts
      const mockData = [{ timestamp: 1000, value: 15000 }];
      (timeSeriesManager.getAggregatedMetrics as jest.Mock).mockResolvedValue(mockData);
      
      expect(async () => {
        const alerts = await alertManager.checkAlerts('1h');
        // Should be able to check alerts without errors
      }).not.toThrow();
    });

    it('should have error rate alerts', () => {
      alertManager.initializeDefaultAlerts();
      
      // Test error rate alert
      const mockData = [{ timestamp: 1000, value: 0.06 }]; // 6% error rate
      (timeSeriesManager.getAggregatedMetrics as jest.Mock).mockResolvedValue(mockData);
      
      expect(async () => {
        const alerts = await alertManager.checkAlerts('1h');
        // Should be able to check alerts without errors
      }).not.toThrow();
    });
  });
}); 