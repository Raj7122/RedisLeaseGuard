import '@testing-library/jest-dom'

// Mock environment variables for testing
process.env.NODE_ENV = 'test'
process.env.REDIS_URL = 'redis://localhost:6379'
process.env.GEMINI_API_KEY = 'test-api-key'

// Mock Next.js Request and Response for API route testing
global.Request = class MockRequest {
  constructor(url, options = {}) {
    Object.defineProperty(this, 'url', {
      value: url,
      writable: false,
      configurable: true
    });
    this.method = options.method || 'GET';
    this.body = options.body;
    this.headers = new Map(Object.entries(options.headers || {}));
  }
  
  json() {
    try {
      return Promise.resolve(JSON.parse(this.body || '{}'));
    } catch (error) {
      return Promise.reject(new SyntaxError('Invalid JSON'));
    }
  }
  
  text() {
    return Promise.resolve(this.body || '');
  }
  
  formData() {
    // Mock FormData for file upload tests
    const mockFormData = {
      get: jest.fn((key) => {
        if (key === 'file') {
          return {
            name: 'test.pdf',
            type: 'application/pdf',
            size: 1024
          };
        }
        return null;
      })
    };
    return Promise.resolve(mockFormData);
  }
}

global.Response = class MockResponse {
  constructor(body, options = {}) {
    this.body = body;
    this.status = options.status || 200;
    this.headers = new Map(Object.entries(options.headers || {}));
  }
  
  json() {
    return Promise.resolve(typeof this.body === 'string' ? JSON.parse(this.body) : this.body);
  }
  
  text() {
    return Promise.resolve(typeof this.body === 'string' ? this.body : JSON.stringify(this.body));
  }
}

// Mock NextResponse for API route testing
jest.mock('next/server', () => ({
  NextRequest: global.Request,
  NextResponse: {
    json: jest.fn((data, options = {}) => {
      return new global.Response(JSON.stringify(data), {
        status: options.status || 200,
        headers: options.headers || {}
      });
    })
  }
}));

// Mock PDF.js and Tesseract.js for testing
jest.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: {
    workerSrc: 'test-worker-src'
  },
  getDocument: jest.fn().mockResolvedValue({
    numPages: 1,
    getPage: jest.fn().mockResolvedValue({
      getTextContent: jest.fn().mockResolvedValue({
        items: [{ str: 'Test PDF content' }]
      })
    })
  })
}))

jest.mock('tesseract.js', () => ({
  recognize: jest.fn().mockResolvedValue({
    data: { text: 'Test OCR content' }
  })
}))

// Mock Google Generative AI
jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: jest.fn().mockReturnValue({
      embedContent: jest.fn().mockResolvedValue({
        embedding: {
          values: new Array(768).fill(0.1)
        }
      }),
      generateContent: jest.fn().mockResolvedValue({
        response: {
          text: () => 'Test AI response'
        }
      }),
      startChat: jest.fn().mockReturnValue({
        sendMessage: jest.fn().mockResolvedValue({
          response: {
            text: () => 'Test chat response'
          }
        })
      })
    })
  }))
}))

// Mock document processor
jest.mock('@/lib/document-processor', () => {
  const mockDocumentProcessor = {
    validateFile: jest.fn((file) => {
      // Simulate validation logic
      if (file.size > 10 * 1024 * 1024) {
        return { valid: false, error: 'File size must be less than 10MB' };
      }
      if (!['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'].includes(file.type)) {
        return { valid: false, error: 'File type not supported. Please upload a PDF or image file.' };
      }
      return { valid: true };
    }),
    processDocument: jest.fn(async (file, leaseId) => ({
      leaseId,
      clauses: [
        {
          id: 'clause-1',
          text: 'Sample lease clause 1',
          section: 'Rent',
          metadata: {
            confidence: 0.9,
            flagged: false,
            leaseId
          },
          vector: new Array(768).fill(0.1)
        },
        {
          id: 'clause-2',
          text: 'Sample lease clause 2',
          section: 'Security Deposit',
          metadata: {
            confidence: 0.85,
            flagged: true,
            leaseId,
            severity: 'High',
            violationType: 'Illegal Fee',
            legalReference: 'NYC Admin Code § 26-511'
          },
          vector: new Array(768).fill(0.1)
        }
      ],
      violations: [
        {
          clauseId: 'clause-2',
          type: 'Illegal Fee',
          severity: 'High',
          description: 'Sample lease clause 2',
          legalReference: 'NYC Admin Code § 26-511'
        }
      ],
      summary: {
        totalClauses: 2,
        flaggedClauses: 1,
        criticalViolations: 0,
        highViolations: 1,
        mediumViolations: 0,
        lowViolations: 0
      }
    })),
    healthCheck: jest.fn(async () => true)
  };
  
  return {
    __esModule: true,
    default: mockDocumentProcessor
  };
});

// Mock session management
jest.mock('@/lib/session-management', () => {
  const mockSessionManager = {
    createSession: jest.fn().mockResolvedValue({
      id: 'test-session-123',
      userId: 'test-user-123',
      createdAt: new Date().toISOString(),
      status: 'active',
      userAgent: 'test-agent',
      ipAddress: '127.0.0.1',
      metadata: {
        deviceType: 'desktop',
        language: 'en-US',
        timezone: 'UTC'
      }
    }),
    getSession: jest.fn().mockResolvedValue({
      id: 'test-session-123',
      userId: 'test-user-123',
      createdAt: new Date().toISOString(),
      status: 'active',
      userAgent: 'test-agent',
      ipAddress: '127.0.0.1',
      metadata: {
        deviceType: 'desktop',
        language: 'en-US',
        timezone: 'UTC'
      }
    }),
    logActivity: jest.fn().mockResolvedValue(true),
    getSessionActivities: jest.fn().mockResolvedValue([]),
    updateSessionStatus: jest.fn().mockResolvedValue(true),
    cleanupExpiredSessions: jest.fn().mockResolvedValue(0),
    trackAnalytics: jest.fn().mockResolvedValue(true),
    trackPerformance: jest.fn().mockResolvedValue(true),
    trackError: jest.fn().mockResolvedValue(true)
  };

  return {
    __esModule: true,
    getSessionManager: jest.fn(() => mockSessionManager),
    sessionManager: mockSessionManager,
    SessionData: {},
    ActivityData: {},
    AnalyticsData: {},
    PerformanceData: {},
    ErrorData: {}
  };
});

// Mock error handling
jest.mock('@/lib/error-handling', () => ({
  __esModule: true,
  getSystemHealth: jest.fn().mockResolvedValue({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    components: {
      redis: { status: 'healthy', responseTime: 5 },
      gemini: { status: 'healthy', responseTime: 200 },
      supabase: { status: 'healthy', responseTime: 10 }
    },
    metrics: {
      uptime: 3600000, // 1 hour
      errorRate: 0.01,
      responseTime: 150
    }
  }),
  executeWithErrorHandling: jest.fn().mockImplementation(async (operation, component, primaryOperation) => {
    return await primaryOperation();
  }),
  SystemHealthStatus: {
    HEALTHY: 'healthy',
    DEGRADED: 'degraded',
    UNHEALTHY: 'unhealthy'
  }
})) 