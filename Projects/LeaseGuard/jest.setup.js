import '@testing-library/jest-dom'

// Mock environment variables for testing
process.env.REDIS_URL = 'redis://localhost:6379'
process.env.GEMINI_API_KEY = 'test-api-key'

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