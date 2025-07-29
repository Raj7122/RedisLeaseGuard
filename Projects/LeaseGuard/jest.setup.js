import '@testing-library/jest-dom'

// Mock environment variables for testing
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
    return Promise.resolve(JSON.parse(this.body || '{}'));
  }
  
  text() {
    return Promise.resolve(this.body || '');
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