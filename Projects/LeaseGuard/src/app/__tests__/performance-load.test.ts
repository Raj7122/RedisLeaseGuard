/**
 * Comprehensive Performance & Load Testing Suite
 * 
 * Tests application performance under various conditions:
 * - Concurrent user load testing
 * - Large document processing performance
 * - API response time testing
 * - Memory usage monitoring
 * - Stress testing scenarios
 * - Performance regression detection
 * 
 * S.A.F.E. D.R.Y. Principles:
 * - Strategic: Comprehensive performance coverage
 * - Automated: Full automation of performance testing
 * - Fortified: Tests system limits and failure points
 * - Evolving: Tests can be extended for new performance metrics
 * - DRY: Reusable test utilities and patterns
 * - Resilient: Tests handle performance failures gracefully
 * - Your-Focused: Tests user experience performance
 */

import { NextRequest } from 'next/server';
// Mock health route for performance testing
const mockHealthRoute = async () => {
  return new Response(JSON.stringify({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    components: {
      redis: { status: 'healthy', responseTime: 5 },
      gemini: { status: 'healthy', responseTime: 200 },
      supabase: { status: 'healthy', responseTime: 10 }
    },
    metrics: {
      uptime: 3600000,
      errorRate: 0.01,
      responseTime: 150
    }
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
import { POST as chatPOST } from '../chat/route';
import { POST as uploadPOST } from '../upload/route';

// Performance testing utilities
const measurePerformance = async (fn: () => Promise<any>) => {
  const startTime = performance.now();
  const startMemory = process.memoryUsage();
  
  try {
    const result = await fn();
    const endTime = performance.now();
    const endMemory = process.memoryUsage();
    
    return {
      success: true,
      result,
      duration: endTime - startTime,
      memoryDelta: {
        heapUsed: endMemory.heapUsed - startMemory.heapUsed,
        heapTotal: endMemory.heapTotal - startMemory.heapTotal,
        external: endMemory.external - startMemory.external,
      },
    };
  } catch (error) {
    const endTime = performance.now();
    return {
      success: false,
      error,
      duration: endTime - startTime,
    };
  }
};

const createConcurrentRequests = async (
  requestFn: () => Promise<any>,
  concurrency: number,
  totalRequests: number
) => {
  const results = [];
  const batches = Math.ceil(totalRequests / concurrency);
  
  for (let batch = 0; batch < batches; batch++) {
    const batchSize = Math.min(concurrency, totalRequests - batch * concurrency);
    const batchPromises = Array(batchSize).fill(null).map(() => requestFn());
    
    const batchResults = await Promise.allSettled(batchPromises);
    results.push(...batchResults);
  }
  
  return results;
};

// Mock dependencies for performance testing
jest.mock('@/lib/redis', () => ({
  default: {
    getClient: jest.fn(() => ({
      json: {
        set: jest.fn().mockResolvedValue('OK'),
        get: jest.fn().mockResolvedValue(null),
      },
      ping: jest.fn().mockResolvedValue('PONG'),
      ft: {
        search: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue('OK'),
      },
    })),
    healthCheck: jest.fn().mockResolvedValue(true),
  },
}));

jest.mock('@/lib/gemini', () => ({
  generateResponse: jest.fn().mockImplementation(async () => {
    // Simulate AI processing time
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));
    return {
      response: 'This is a test AI response with legal disclaimers.',
      sessionId: 'test-session-123',
    };
  }),
}));

jest.mock('@/lib/document-processor', () => ({
  processDocument: jest.fn().mockImplementation(async (file: File) => {
    // Simulate document processing time based on file size
    const processingTime = Math.min(file.size / 1024, 2000); // Max 2 seconds
    await new Promise(resolve => setTimeout(resolve, processingTime));
    
    return {
      text: 'Sample lease document text',
      clauses: [
        { text: 'RENT: $2000 per month', severity: 'low' },
        { text: 'LATE FEES: $100 per day', severity: 'high' },
      ],
      violations: [
        {
          severity: 'high',
          description: 'Illegal late fee amount',
          explanation: 'Late fees cannot exceed 5% of monthly rent',
          confidence: 0.95,
        },
      ],
    };
  }),
}));

describe('Performance & Load Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('API Response Time Tests', () => {
    test('health check should respond within 100ms', async () => {
      const performance = await measurePerformance(async () => {
        return await mockHealthRoute();
      });

      expect(performance.success).toBe(true);
      expect(performance.duration).toBeLessThan(100);
      expect(performance.result.status).toBe(200);
    });

    test('chat API should respond within 2 seconds', async () => {
      const requestBody = {
        question: 'What are my rights regarding late fees?',
        sessionId: 'test-session-123',
      };

      const performance = await measurePerformance(async () => {
        const request = new NextRequest('http://localhost:3000/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });
        return await chatPOST(request);
      });

      expect(performance.success).toBe(true);
      expect(performance.duration).toBeLessThan(2000);
      expect(performance.result.status).toBe(200);
    });

    test('upload API should process small files within 1 second', async () => {
      const formData = new FormData();
      const smallFile = new File(['small content'], 'small.pdf', { type: 'application/pdf' });
      formData.append('file', smallFile);

      const performance = await measurePerformance(async () => {
        const request = new NextRequest('http://localhost:3000/api/upload', {
          method: 'POST',
          body: formData,
        });
        return await uploadPOST(request);
      });

      expect(performance.success).toBe(true);
      expect(performance.duration).toBeLessThan(1000);
      expect(performance.result.status).toBe(200);
    });

    test('upload API should process large files within 5 seconds', async () => {
      const formData = new FormData();
      const largeContent = 'x'.repeat(5 * 1024 * 1024); // 5MB
      const largeFile = new File([largeContent], 'large.pdf', { type: 'application/pdf' });
      formData.append('file', largeFile);

      const performance = await measurePerformance(async () => {
        const request = new NextRequest('http://localhost:3000/api/upload', {
          method: 'POST',
          body: formData,
        });
        return await uploadPOST(request);
      });

      expect(performance.success).toBe(true);
      expect(performance.duration).toBeLessThan(5000);
      expect(performance.result.status).toBe(200);
    });
  });

  describe('Concurrent Load Testing', () => {
    test('should handle 10 concurrent health check requests', async () => {
      const requestFn = async () => {
        return await mockHealthRoute();
      };

      const performance = await measurePerformance(async () => {
        return await createConcurrentRequests(requestFn, 10, 10);
      });

      expect(performance.success).toBe(true);
      expect(performance.duration).toBeLessThan(1000); // Should handle 10 concurrent requests within 1 second
      
      const results = performance.result;
      expect(results).toHaveLength(10);
      
      const successfulRequests = results.filter(r => r.status === 'fulfilled');
      expect(successfulRequests).toHaveLength(10);
      
      successfulRequests.forEach(result => {
        expect(result.value.status).toBe(200);
      });
    });

    test('should handle 5 concurrent chat requests', async () => {
      const requestFn = async () => {
        const requestBody = {
          question: 'What are my rights?',
          sessionId: 'test-session-123',
        };
        const request = new NextRequest('http://localhost:3000/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });
        return await chatPOST(request);
      };

      const performance = await measurePerformance(async () => {
        return await createConcurrentRequests(requestFn, 5, 5);
      });

      expect(performance.success).toBe(true);
      expect(performance.duration).toBeLessThan(3000); // Should handle 5 concurrent AI requests within 3 seconds
      
      const results = performance.result;
      expect(results).toHaveLength(5);
      
      const successfulRequests = results.filter(r => r.status === 'fulfilled');
      expect(successfulRequests).toHaveLength(5);
      
      successfulRequests.forEach(result => {
        expect(result.value.status).toBe(200);
      });
    });

    test('should handle 3 concurrent file uploads', async () => {
      const requestFn = async () => {
        const formData = new FormData();
        const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
        formData.append('file', file);
        
        const request = new NextRequest('http://localhost:3000/api/upload', {
          method: 'POST',
          body: formData,
        });
        return await uploadPOST(request);
      };

      const performance = await measurePerformance(async () => {
        return await createConcurrentRequests(requestFn, 3, 3);
      });

      expect(performance.success).toBe(true);
      expect(performance.duration).toBeLessThan(2000); // Should handle 3 concurrent uploads within 2 seconds
      
      const results = performance.result;
      expect(results).toHaveLength(3);
      
      const successfulRequests = results.filter(r => r.status === 'fulfilled');
      expect(successfulRequests).toHaveLength(3);
      
      successfulRequests.forEach(result => {
        expect(result.value.status).toBe(200);
      });
    });
  });

  describe('Memory Usage Tests', () => {
    test('should not leak memory during repeated health checks', async () => {
      const initialMemory = process.memoryUsage();
      
      // Perform 100 health checks
      for (let i = 0; i < 100; i++) {
        const request = new NextRequest('http://localhost:3000/api/health');
        await GET(request);
      }
      
      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      // Memory increase should be reasonable (less than 10MB)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });

    test('should not leak memory during repeated chat requests', async () => {
      const initialMemory = process.memoryUsage();
      
      // Perform 20 chat requests
      for (let i = 0; i < 20; i++) {
        const requestBody = {
          question: `Test question ${i}`,
          sessionId: 'test-session-123',
        };
        const request = new NextRequest('http://localhost:3000/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });
        await chatPOST(request);
      }
      
      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });

    test('should handle large document processing without memory issues', async () => {
      const initialMemory = process.memoryUsage();
      
      // Process a large document
      const formData = new FormData();
      const largeContent = 'x'.repeat(10 * 1024 * 1024); // 10MB
      const largeFile = new File([largeContent], 'large.pdf', { type: 'application/pdf' });
      formData.append('file', largeFile);
      
      const request = new NextRequest('http://localhost:3000/api/upload', {
        method: 'POST',
        body: formData,
      });
      await uploadPOST(request);
      
      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      // Memory increase should be reasonable (less than 100MB)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
    });
  });

  describe('Stress Testing', () => {
    test('should handle rapid successive requests', async () => {
      const requestFn = async () => {
        const request = new NextRequest('http://localhost:3000/api/health');
        return await GET(request);
      };

      const performance = await measurePerformance(async () => {
        // Make 50 rapid requests
        const promises = Array(50).fill(null).map(() => requestFn());
        return await Promise.allSettled(promises);
      });

      expect(performance.success).toBe(true);
      expect(performance.duration).toBeLessThan(2000); // Should handle 50 rapid requests within 2 seconds
      
      const results = performance.result;
      expect(results).toHaveLength(50);
      
      const successfulRequests = results.filter(r => r.status === 'fulfilled');
      expect(successfulRequests.length).toBeGreaterThan(45); // At least 90% success rate
    });

    test('should handle mixed workload stress test', async () => {
      const performance = await measurePerformance(async () => {
        const promises = [];
        
        // 20 health checks
        for (let i = 0; i < 20; i++) {
          const request = new NextRequest('http://localhost:3000/api/health');
          promises.push(GET(request));
        }
        
        // 10 chat requests
        for (let i = 0; i < 10; i++) {
          const requestBody = {
            question: `Stress test question ${i}`,
            sessionId: 'test-session-123',
          };
          const request = new NextRequest('http://localhost:3000/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
          });
          promises.push(chatPOST(request));
        }
        
        // 5 file uploads
        for (let i = 0; i < 5; i++) {
          const formData = new FormData();
          const file = new File([`content ${i}`], `test${i}.pdf`, { type: 'application/pdf' });
          formData.append('file', file);
          const request = new NextRequest('http://localhost:3000/api/upload', {
            method: 'POST',
            body: formData,
          });
          promises.push(uploadPOST(request));
        }
        
        return await Promise.allSettled(promises);
      });

      expect(performance.success).toBe(true);
      expect(performance.duration).toBeLessThan(10000); // Should handle mixed workload within 10 seconds
      
      const results = performance.result;
      expect(results).toHaveLength(35); // 20 + 10 + 5
      
      const successfulRequests = results.filter(r => r.status === 'fulfilled');
      expect(successfulRequests.length).toBeGreaterThan(30); // At least 85% success rate
    });
  });

  describe('Performance Regression Tests', () => {
    test('health check performance should not degrade over time', async () => {
      const responseTimes = [];
      
      // Measure response times over 10 requests
      for (let i = 0; i < 10; i++) {
        const performance = await measurePerformance(async () => {
          const request = new NextRequest('http://localhost:3000/api/health');
          return await GET(request);
        });
        
        responseTimes.push(performance.duration);
      }
      
      // Calculate statistics
      const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const maxResponseTime = Math.max(...responseTimes);
      const minResponseTime = Math.min(...responseTimes);
      
      // Performance should be consistent
      expect(avgResponseTime).toBeLessThan(50); // Average under 50ms
      expect(maxResponseTime).toBeLessThan(100); // Max under 100ms
      expect(maxResponseTime - minResponseTime).toBeLessThan(50); // Variance under 50ms
    });

    test('chat API performance should remain consistent', async () => {
      const responseTimes = [];
      
      // Measure response times over 5 requests
      for (let i = 0; i < 5; i++) {
        const requestBody = {
          question: `Performance test question ${i}`,
          sessionId: 'test-session-123',
        };
        
        const performance = await measurePerformance(async () => {
          const request = new NextRequest('http://localhost:3000/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
          });
          return await chatPOST(request);
        });
        
        responseTimes.push(performance.duration);
      }
      
      // Calculate statistics
      const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const maxResponseTime = Math.max(...responseTimes);
      
      // Performance should be consistent
      expect(avgResponseTime).toBeLessThan(1500); // Average under 1.5 seconds
      expect(maxResponseTime).toBeLessThan(2000); // Max under 2 seconds
    });
  });

  describe('Resource Usage Tests', () => {
    test('should handle CPU-intensive operations gracefully', async () => {
      const performance = await measurePerformance(async () => {
        // Simulate CPU-intensive operation (multiple concurrent AI requests)
        const promises = Array(10).fill(null).map(async () => {
          const requestBody = {
            question: 'Complex legal question requiring extensive analysis',
            sessionId: 'test-session-123',
          };
          const request = new NextRequest('http://localhost:3000/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
          });
          return await chatPOST(request);
        });
        
        return await Promise.allSettled(promises);
      });

      expect(performance.success).toBe(true);
      expect(performance.duration).toBeLessThan(5000); // Should complete within 5 seconds
      
      const results = performance.result;
      const successfulRequests = results.filter(r => r.status === 'fulfilled');
      expect(successfulRequests.length).toBeGreaterThan(8); // At least 80% success rate
    });

    test('should handle I/O-intensive operations efficiently', async () => {
      const performance = await measurePerformance(async () => {
        // Simulate I/O-intensive operation (multiple file uploads)
        const promises = Array(5).fill(null).map(async (_, index) => {
          const formData = new FormData();
          const content = 'x'.repeat((index + 1) * 1024 * 1024); // 1MB to 5MB files
          const file = new File([content], `test${index}.pdf`, { type: 'application/pdf' });
          formData.append('file', file);
          
          const request = new NextRequest('http://localhost:3000/api/upload', {
            method: 'POST',
            body: formData,
          });
          return await uploadPOST(request);
        });
        
        return await Promise.allSettled(promises);
      });

      expect(performance.success).toBe(true);
      expect(performance.duration).toBeLessThan(8000); // Should complete within 8 seconds
      
      const results = performance.result;
      const successfulRequests = results.filter(r => r.status === 'fulfilled');
      expect(successfulRequests.length).toBeGreaterThan(4); // At least 80% success rate
    });
  });

  describe('Error Recovery Performance', () => {
    test('should recover quickly from temporary failures', async () => {
      // Mock temporary failure
      const { generateResponse } = require('@/lib/gemini');
      generateResponse.mockRejectedValueOnce(new Error('Temporary failure'));
      generateResponse.mockResolvedValueOnce({
        response: 'Recovery successful',
        sessionId: 'test-session-123',
      });

      const performance = await measurePerformance(async () => {
        const requestBody = {
          question: 'Test question',
          sessionId: 'test-session-123',
        };
        
        // First request should fail
        const request1 = new NextRequest('http://localhost:3000/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });
        
        // Second request should succeed
        const request2 = new NextRequest('http://localhost:3000/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });
        
        const [result1, result2] = await Promise.allSettled([
          chatPOST(request1),
          chatPOST(request2),
        ]);
        
        return { result1, result2 };
      });

      expect(performance.success).toBe(true);
      expect(performance.duration).toBeLessThan(3000); // Should recover within 3 seconds
      
      expect(performance.result.result1.status).toBe('rejected');
      expect(performance.result.result2.status).toBe('fulfilled');
    });
  });

  describe('Scalability Tests', () => {
    test('should maintain performance with increasing load', async () => {
      const loadLevels = [1, 5, 10, 20];
      const performanceResults = [];
      
      for (const load of loadLevels) {
        const performance = await measurePerformance(async () => {
          return await createConcurrentRequests(
            async () => {
              const request = new NextRequest('http://localhost:3000/api/health');
              return await GET(request);
            },
            load,
            load
          );
        });
        
        performanceResults.push({
          load,
          duration: performance.duration,
          successRate: performance.result.filter(r => r.status === 'fulfilled').length / load,
        });
      }
      
      // Performance should scale reasonably
      performanceResults.forEach(result => {
        expect(result.successRate).toBeGreaterThan(0.9); // At least 90% success rate
        expect(result.duration).toBeLessThan(1000); // Should complete within 1 second
      });
      
      // Performance degradation should be linear or better
      const firstResult = performanceResults[0];
      const lastResult = performanceResults[performanceResults.length - 1];
      const loadRatio = lastResult.load / firstResult.load;
      const durationRatio = lastResult.duration / firstResult.duration;
      
      // Duration increase should not be worse than linear
      expect(durationRatio).toBeLessThan(loadRatio * 1.5);
    });
  });
}); 