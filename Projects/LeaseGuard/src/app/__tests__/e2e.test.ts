/**
 * Comprehensive E2E Test Suite for LeaseGuard
 * 
 * Tests all major functionality including:
 * - Page load and responsive design
 * - File upload and document processing
 * - AI Q&A system
 * - Security features
 * - Error handling
 * - Performance metrics
 * 
 * S.A.F.E. D.R.Y. Principles:
 * - Strategic: Comprehensive test coverage
 * - Automated: Full automation of manual test scenarios
 * - Fortified: Tests security and error handling
 * - Evolving: Tests can be extended for new features
 * - DRY: Reusable test utilities and patterns
 * - Resilient: Tests handle failures gracefully
 * - Your-Focused: Tests user experience and functionality
 */

import { test, expect, Page } from '@playwright/test';
import path from 'path';

// Test utilities
const createMockPDF = () => {
  // Create a simple PDF content for testing
  return Buffer.from('%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n/Contents 4 0 R\n>>\nendobj\n4 0 obj\n<<\n/Length 44\n>>\nstream\nBT\n/F1 12 Tf\n72 720 Td\n(Test Lease Document) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000204 00000 n \ntrailer\n<<\n/Size 5\n/Root 1 0 R\n>>\nstartxref\n297\n%%EOF');
};

const createMockImage = () => {
  // Create a simple PNG image for testing
  return Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
    0x00, 0x00, 0x00, 0x0D, // IHDR chunk length
    0x49, 0x48, 0x44, 0x52, // IHDR
    0x00, 0x00, 0x00, 0x01, // width: 1
    0x00, 0x00, 0x00, 0x01, // height: 1
    0x08, 0x02, 0x00, 0x00, 0x00, // bit depth, color type, compression, filter, interlace
    0x90, 0x77, 0x53, 0xDE, // CRC
    0x00, 0x00, 0x00, 0x0C, // IDAT chunk length
    0x49, 0x44, 0x41, 0x54, // IDAT
    0x08, 0x99, 0x01, 0x01, 0x00, 0x00, 0x00, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01, // compressed data
    0xE2, 0x21, 0xBC, 0x33, // CRC
    0x00, 0x00, 0x00, 0x00, // IEND chunk length
    0x49, 0x45, 0x4E, 0x44, // IEND
    0xAE, 0x42, 0x60, 0x82  // CRC
  ]);
};

// Test data
const sampleLeaseContent = `
LEASE AGREEMENT

This lease agreement is made between Landlord and Tenant.

1. RENT: Tenant agrees to pay $2000 per month plus a $500 security deposit.

2. LATE FEES: If rent is not paid within 5 days of due date, tenant will be charged a $100 late fee plus $50 per day thereafter.

3. SECURITY DEPOSIT: Landlord may use security deposit for any damages beyond normal wear and tear.

4. ENTRY: Landlord may enter premises at any time for maintenance or inspection.

5. UTILITIES: Tenant is responsible for all utilities including water, electricity, and gas.

6. PETS: No pets allowed without written permission and additional $500 pet deposit.

7. SUBLETTING: Tenant may not sublet without written permission from landlord.

8. TERMINATION: Landlord may terminate lease with 30 days notice for any reason.

9. MAINTENANCE: Tenant is responsible for all repairs and maintenance.

10. QUIET ENJOYMENT: Tenant must maintain quiet hours from 10 PM to 8 AM.
`;

test.describe('LeaseGuard E2E Tests', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    
    // Set viewport for consistent testing
    await page.setViewportSize({ width: 1280, height: 720 });
    
    // Enable request interception for API mocking
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      
      // Mock API responses for testing
      if (url.includes('/api/health')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            components: {
              redis: { status: 'healthy', responseTime: 50 },
              gemini: { status: 'healthy', responseTime: 100 },
              supabase: { status: 'healthy', responseTime: 75 }
            }
          })
        });
      } else if (url.includes('/api/chat')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            response: 'This is a test AI response with legal disclaimers.',
            sessionId: 'test-session-123'
          })
        });
      } else {
        await route.continue();
      }
    });
  });

  test.afterAll(async () => {
    await page.close();
  });

  test.describe('1. Page Load & Responsive Design Tests', () => {
    test('should load main page successfully', async () => {
      const startTime = Date.now();
      
      await page.goto('http://localhost:3000');
      
      const loadTime = Date.now() - startTime;
      expect(loadTime).toBeLessThan(3000); // Should load within 3 seconds
      
      // Check page title
      await expect(page).toHaveTitle(/LeaseGuard/);
      
      // Check main header
      await expect(page.locator('h1')).toContainText('LeaseGuard');
      await expect(page.locator('p')).toContainText('AI-Powered Tenant Rights Assistant');
    });

    test('should display upload interface correctly', async () => {
      await page.goto('http://localhost:3000');
      
      // Check upload area exists
      const uploadArea = page.locator('[for="file-upload"]');
      await expect(uploadArea).toBeVisible();
      
      // Check file type restrictions
      const fileInput = page.locator('#file-upload');
      await expect(fileInput).toHaveAttribute('accept', '.pdf,.jpg,.jpeg,.png,.tiff,.bmp');
      
      // Check file size message
      await expect(page.locator('text=Max 10MB')).toBeVisible();
    });

    test('should be responsive on different screen sizes', async () => {
      await page.goto('http://localhost:3000');
      
      // Test desktop view
      await page.setViewportSize({ width: 1280, height: 720 });
      await expect(page.locator('.max-w-4xl')).toBeVisible();
      
      // Test tablet view
      await page.setViewportSize({ width: 768, height: 1024 });
      await expect(page.locator('.max-w-4xl')).toBeVisible();
      
      // Test mobile view
      await page.setViewportSize({ width: 375, height: 667 });
      await expect(page.locator('.max-w-4xl')).toBeVisible();
      
      // Verify touch targets are appropriately sized
      const uploadButton = page.locator('[for="file-upload"]');
      const buttonBox = await uploadButton.boundingBox();
      expect(buttonBox?.width).toBeGreaterThanOrEqual(44);
      expect(buttonBox?.height).toBeGreaterThanOrEqual(44);
    });
  });

  test.describe('2. File Upload Tests', () => {
    test('should handle PDF file upload', async () => {
      await page.goto('http://localhost:3000');
      
      // Create test PDF file
      const pdfBuffer = createMockPDF();
      
      // Mock file upload
      await page.setInputFiles('#file-upload', {
        name: 'test-lease.pdf',
        mimeType: 'application/pdf',
        buffer: pdfBuffer
      });
      
      // Verify upload was successful
      await expect(page.locator('text=test-lease.pdf')).toBeVisible();
    });

    test('should handle image file upload', async () => {
      await page.goto('http://localhost:3000');
      
      // Create test image file
      const imageBuffer = createMockImage();
      
      // Mock file upload
      await page.setInputFiles('#file-upload', {
        name: 'test-lease.png',
        mimeType: 'image/png',
        buffer: imageBuffer
      });
      
      // Verify upload was successful
      await expect(page.locator('text=test-lease.png')).toBeVisible();
    });

    test('should reject unsupported file types', async () => {
      await page.goto('http://localhost:3000');
      
      // Try to upload unsupported file
      await page.setInputFiles('#file-upload', {
        name: 'test.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('test content')
      });
      
      // Should show error message
      await expect(page.locator('text=File type not supported')).toBeVisible();
    });

    test('should reject files larger than 10MB', async () => {
      await page.goto('http://localhost:3000');
      
      // Create large file buffer (11MB)
      const largeBuffer = Buffer.alloc(11 * 1024 * 1024);
      
      // Mock file upload
      await page.setInputFiles('#file-upload', {
        name: 'large-file.pdf',
        mimeType: 'application/pdf',
        buffer: largeBuffer
      });
      
      // Should show file size error
      await expect(page.locator('text=File too large')).toBeVisible();
    });

    test('should provide drag and drop functionality', async () => {
      await page.goto('http://localhost:3000');
      
      const uploadArea = page.locator('[for="file-upload"]');
      
      // Test drag over visual feedback
      await uploadArea.hover();
      await expect(uploadArea).toHaveCSS('border-color', 'rgb(59, 130, 246)'); // Blue border
      
      // Test drag and drop
      const pdfBuffer = createMockPDF();
      await page.evaluate((buffer) => {
        const dataTransfer = new DataTransfer();
        const file = new File([buffer], 'test.pdf', { type: 'application/pdf' });
        dataTransfer.items.add(file);
        return dataTransfer;
      }, pdfBuffer);
      
      // Verify file was dropped
      await expect(page.locator('text=test.pdf')).toBeVisible();
    });
  });

  test.describe('3. Document Processing Tests', () => {
    test('should process PDF documents and extract text', async () => {
      await page.goto('http://localhost:3000');
      
      // Mock successful document processing
      await page.route('**/api/upload', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            text: sampleLeaseContent,
            clauses: [
              { text: 'RENT: Tenant agrees to pay $2000 per month', severity: 'low' },
              { text: 'LATE FEES: If rent is not paid within 5 days', severity: 'high' }
            ]
          })
        });
      });
      
      // Upload document
      const pdfBuffer = createMockPDF();
      await page.setInputFiles('#file-upload', {
        name: 'test-lease.pdf',
        mimeType: 'application/pdf',
        buffer: pdfBuffer
      });
      
      // Wait for processing
      await page.waitForSelector('text=Processing complete', { timeout: 10000 });
      
      // Verify results
      await expect(page.locator('text=Processing complete')).toBeVisible();
      await expect(page.locator('text=RENT: Tenant agrees to pay $2000 per month')).toBeVisible();
    });

    test('should detect violations in lease documents', async () => {
      await page.goto('http://localhost:3000');
      
      // Mock violation detection
      await page.route('**/api/upload', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            violations: [
              {
                severity: 'critical',
                description: 'Illegal late fee amount',
                explanation: 'Late fees cannot exceed 5% of monthly rent',
                confidence: 0.95
              },
              {
                severity: 'high',
                description: 'Unlawful entry clause',
                explanation: 'Landlord must provide 24-hour notice for non-emergency entry',
                confidence: 0.88
              }
            ]
          })
        });
      });
      
      // Upload document
      const pdfBuffer = createMockPDF();
      await page.setInputFiles('#file-upload', {
        name: 'test-lease.pdf',
        mimeType: 'application/pdf',
        buffer: pdfBuffer
      });
      
      // Wait for analysis
      await page.waitForSelector('text=Illegal late fee amount', { timeout: 10000 });
      
      // Verify violations are displayed
      await expect(page.locator('text=Illegal late fee amount')).toBeVisible();
      await expect(page.locator('text=Unlawful entry clause')).toBeVisible();
      
      // Check severity colors
      const criticalViolation = page.locator('text=Illegal late fee amount').first();
      await expect(criticalViolation).toHaveCSS('color', 'rgb(220, 38, 38)'); // Red for critical
    });
  });

  test.describe('4. AI Q&A System Tests', () => {
    test('should display chat interface after document analysis', async () => {
      await page.goto('http://localhost:3000');
      
      // Mock document processing
      await page.route('**/api/upload', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, text: sampleLeaseContent })
        });
      });
      
      // Upload document
      const pdfBuffer = createMockPDF();
      await page.setInputFiles('#file-upload', {
        name: 'test-lease.pdf',
        mimeType: 'application/pdf',
        buffer: pdfBuffer
      });
      
      // Wait for processing and look for chat interface
      await page.waitForSelector('input[placeholder*="question"]', { timeout: 10000 });
      
      // Verify chat interface
      await expect(page.locator('input[placeholder*="question"]')).toBeVisible();
      await expect(page.locator('button:has-text("Send")')).toBeVisible();
    });

    test('should handle user questions and provide AI responses', async () => {
      await page.goto('http://localhost:3000');
      
      // Mock document processing and chat
      await page.route('**/api/upload', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, text: sampleLeaseContent })
        });
      });
      
      await page.route('**/api/chat', async (route) => {
        const request = route.request();
        const postData = request.postDataJSON();
        
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            response: `Based on your lease, ${postData.question} - Here's what you need to know...`,
            sessionId: 'test-session-123'
          })
        });
      });
      
      // Upload document
      const pdfBuffer = createMockPDF();
      await page.setInputFiles('#file-upload', {
        name: 'test-lease.pdf',
        mimeType: 'application/pdf',
        buffer: pdfBuffer
      });
      
      // Wait for chat interface
      await page.waitForSelector('input[placeholder*="question"]', { timeout: 10000 });
      
      // Ask a question
      await page.fill('input[placeholder*="question"]', 'What are my rights regarding late fees?');
      await page.click('button:has-text("Send")');
      
      // Wait for response
      await page.waitForSelector('text=Based on your lease', { timeout: 10000 });
      
      // Verify response
      await expect(page.locator('text=Based on your lease')).toBeVisible();
      await expect(page.locator('text=late fees')).toBeVisible();
    });

    test('should maintain conversation context', async () => {
      await page.goto('http://localhost:3000');
      
      // Mock chat with context
      let conversationCount = 0;
      await page.route('**/api/chat', async (route) => {
        conversationCount++;
        const request = route.request();
        const postData = request.postDataJSON();
        
        let response = '';
        if (conversationCount === 1) {
          response = 'Your lease mentions late fees of $100.';
        } else {
          response = 'Yes, that $100 late fee amount is illegal in NYC.';
        }
        
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            response,
            sessionId: 'test-session-123'
          })
        });
      });
      
      // Upload document and start chat
      await page.route('**/api/upload', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, text: sampleLeaseContent })
        });
      });
      
      const pdfBuffer = createMockPDF();
      await page.setInputFiles('#file-upload', {
        name: 'test-lease.pdf',
        mimeType: 'application/pdf',
        buffer: pdfBuffer
      });
      
      await page.waitForSelector('input[placeholder*="question"]', { timeout: 10000 });
      
      // First question
      await page.fill('input[placeholder*="question"]', 'What does my lease say about late fees?');
      await page.click('button:has-text("Send")');
      await page.waitForSelector('text=Your lease mentions late fees of $100', { timeout: 10000 });
      
      // Follow-up question
      await page.fill('input[placeholder*="question"]', 'Is that legal?');
      await page.click('button:has-text("Send")');
      await page.waitForSelector('text=Yes, that $100 late fee amount is illegal', { timeout: 10000 });
      
      // Verify context was maintained
      await expect(page.locator('text=Your lease mentions late fees of $100')).toBeVisible();
      await expect(page.locator('text=Yes, that $100 late fee amount is illegal')).toBeVisible();
    });

    test('should include legal disclaimers in AI responses', async () => {
      await page.goto('http://localhost:3000');
      
      // Mock chat response with disclaimer
      await page.route('**/api/chat', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            response: 'This is legal advice. DISCLAIMER: This information is for educational purposes only and does not constitute legal advice.',
            sessionId: 'test-session-123'
          })
        });
      });
      
      // Upload document and ask question
      await page.route('**/api/upload', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, text: sampleLeaseContent })
        });
      });
      
      const pdfBuffer = createMockPDF();
      await page.setInputFiles('#file-upload', {
        name: 'test-lease.pdf',
        mimeType: 'application/pdf',
        buffer: pdfBuffer
      });
      
      await page.waitForSelector('input[placeholder*="question"]', { timeout: 10000 });
      await page.fill('input[placeholder*="question"]', 'Is this clause legal?');
      await page.click('button:has-text("Send")');
      
      await page.waitForSelector('text=DISCLAIMER', { timeout: 10000 });
      await expect(page.locator('text=DISCLAIMER')).toBeVisible();
      await expect(page.locator('text=educational purposes only')).toBeVisible();
    });
  });

  test.describe('5. Security Tests', () => {
    test('should have proper security headers', async () => {
      const response = await page.goto('http://localhost:3000');
      
      const headers = response?.headers();
      
      // Check security headers
      expect(headers?.['x-frame-options']).toBe('DENY');
      expect(headers?.['x-content-type-options']).toBe('nosniff');
      expect(headers?.['x-xss-protection']).toBe('1; mode=block');
      expect(headers?.['referrer-policy']).toBe('strict-origin-when-cross-origin');
      expect(headers?.['content-security-policy']).toContain("default-src 'self'");
    });

    test('should prevent XSS attacks in chat input', async () => {
      await page.goto('http://localhost:3000');
      
      // Mock document processing
      await page.route('**/api/upload', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, text: sampleLeaseContent })
        });
      });
      
      // Upload document
      const pdfBuffer = createMockPDF();
      await page.setInputFiles('#file-upload', {
        name: 'test-lease.pdf',
        mimeType: 'application/pdf',
        buffer: pdfBuffer
      });
      
      await page.waitForSelector('input[placeholder*="question"]', { timeout: 10000 });
      
      // Try to inject XSS
      const xssPayload = '<script>alert("xss")</script>What are my rights?';
      await page.fill('input[placeholder*="question"]', xssPayload);
      
      // Check that script tags are not executed
      const inputValue = await page.inputValue('input[placeholder*="question"]');
      expect(inputValue).not.toContain('<script>');
    });

    test('should validate file uploads securely', async () => {
      await page.goto('http://localhost:3000');
      
      // Try to upload executable file
      await page.setInputFiles('#file-upload', {
        name: 'malicious.exe',
        mimeType: 'application/x-msdownload',
        buffer: Buffer.from('fake executable content')
      });
      
      // Should reject executable files
      await expect(page.locator('text=File type not allowed')).toBeVisible();
    });

    test('should handle rate limiting', async () => {
      await page.goto('http://localhost:3000');
      
      // Mock rate limit response
      await page.route('**/api/chat', async (route) => {
        await route.fulfill({
          status: 429,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Rate limit exceeded. Please try again later.'
          })
        });
      });
      
      // Upload document and try to send multiple messages quickly
      await page.route('**/api/upload', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, text: sampleLeaseContent })
        });
      });
      
      const pdfBuffer = createMockPDF();
      await page.setInputFiles('#file-upload', {
        name: 'test-lease.pdf',
        mimeType: 'application/pdf',
        buffer: pdfBuffer
      });
      
      await page.waitForSelector('input[placeholder*="question"]', { timeout: 10000 });
      
      // Send multiple messages quickly
      for (let i = 0; i < 5; i++) {
        await page.fill('input[placeholder*="question"]', `Question ${i}`);
        await page.click('button:has-text("Send")');
      }
      
      // Should show rate limit error
      await expect(page.locator('text=Rate limit exceeded')).toBeVisible();
    });
  });

  test.describe('6. Error Handling Tests', () => {
    test('should handle network errors gracefully', async () => {
      await page.goto('http://localhost:3000');
      
      // Mock network error
      await page.route('**/api/upload', async (route) => {
        await route.abort('failed');
      });
      
      // Upload document
      const pdfBuffer = createMockPDF();
      await page.setInputFiles('#file-upload', {
        name: 'test-lease.pdf',
        mimeType: 'application/pdf',
        buffer: pdfBuffer
      });
      
      // Should show user-friendly error
      await expect(page.locator('text=Unable to process document')).toBeVisible();
      await expect(page.locator('text=Please try again')).toBeVisible();
    });

    test('should handle server errors gracefully', async () => {
      await page.goto('http://localhost:3000');
      
      // Mock server error
      await page.route('**/api/upload', async (route) => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Internal server error'
          })
        });
      });
      
      // Upload document
      const pdfBuffer = createMockPDF();
      await page.setInputFiles('#file-upload', {
        name: 'test-lease.pdf',
        mimeType: 'application/pdf',
        buffer: pdfBuffer
      });
      
      // Should show user-friendly error
      await expect(page.locator('text=Something went wrong')).toBeVisible();
    });

    test('should handle invalid file uploads', async () => {
      await page.goto('http://localhost:3000');
      
      // Try to upload corrupted file
      await page.setInputFiles('#file-upload', {
        name: 'corrupted.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('not a real pdf')
      });
      
      // Should show appropriate error
      await expect(page.locator('text=Unable to read file')).toBeVisible();
    });
  });

  test.describe('7. Performance Tests', () => {
    test('should load page within acceptable time', async () => {
      const startTime = Date.now();
      
      await page.goto('http://localhost:3000');
      
      const loadTime = Date.now() - startTime;
      expect(loadTime).toBeLessThan(3000); // Should load within 3 seconds
    });

    test('should process documents within reasonable time', async () => {
      await page.goto('http://localhost:3000');
      
      // Mock fast processing
      await page.route('**/api/upload', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, text: sampleLeaseContent })
        });
      });
      
      const startTime = Date.now();
      
      // Upload document
      const pdfBuffer = createMockPDF();
      await page.setInputFiles('#file-upload', {
        name: 'test-lease.pdf',
        mimeType: 'application/pdf',
        buffer: pdfBuffer
      });
      
      // Wait for processing
      await page.waitForSelector('text=Processing complete', { timeout: 10000 });
      
      const processingTime = Date.now() - startTime;
      expect(processingTime).toBeLessThan(10000); // Should process within 10 seconds
    });

    test('should provide AI responses within reasonable time', async () => {
      await page.goto('http://localhost:3000');
      
      // Mock fast AI response
      await page.route('**/api/chat', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            response: 'This is a test response.',
            sessionId: 'test-session-123'
          })
        });
      });
      
      // Upload document and start chat
      await page.route('**/api/upload', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, text: sampleLeaseContent })
        });
      });
      
      const pdfBuffer = createMockPDF();
      await page.setInputFiles('#file-upload', {
        name: 'test-lease.pdf',
        mimeType: 'application/pdf',
        buffer: pdfBuffer
      });
      
      await page.waitForSelector('input[placeholder*="question"]', { timeout: 10000 });
      
      const startTime = Date.now();
      
      // Ask question
      await page.fill('input[placeholder*="question"]', 'What are my rights?');
      await page.click('button:has-text("Send")');
      
      // Wait for response
      await page.waitForSelector('text=This is a test response', { timeout: 10000 });
      
      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(5000); // Should respond within 5 seconds
    });
  });

  test.describe('8. Accessibility Tests', () => {
    test('should have proper ARIA labels', async () => {
      await page.goto('http://localhost:3000');
      
      // Check for ARIA labels
      const fileInput = page.locator('#file-upload');
      await expect(fileInput).toHaveAttribute('aria-label');
      
      const uploadLabel = page.locator('[for="file-upload"]');
      await expect(uploadLabel).toBeVisible();
    });

    test('should support keyboard navigation', async () => {
      await page.goto('http://localhost:3000');
      
      // Test tab navigation
      await page.keyboard.press('Tab');
      await expect(page.locator('#file-upload')).toBeFocused();
      
      // Test enter key for file selection
      await page.keyboard.press('Enter');
      // Should open file dialog (can't test file dialog in Playwright)
    });

    test('should have sufficient color contrast', async () => {
      await page.goto('http://localhost:3000');
      
      // Check main text contrast
      const mainText = page.locator('h1');
      const color = await mainText.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return style.color;
      });
      
      // Should be dark text on light background
      expect(color).toBe('rgb(17, 24, 39)'); // Dark gray
    });
  });

  test.describe('9. Mobile Experience Tests', () => {
    test('should work properly on mobile devices', async () => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('http://localhost:3000');
      
      // Check mobile layout
      await expect(page.locator('.max-w-4xl')).toBeVisible();
      
      // Check touch targets are appropriately sized
      const uploadButton = page.locator('[for="file-upload"]');
      const buttonBox = await uploadButton.boundingBox();
      expect(buttonBox?.width).toBeGreaterThanOrEqual(44);
      expect(buttonBox?.height).toBeGreaterThanOrEqual(44);
    });

    test('should handle mobile file upload', async () => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('http://localhost:3000');
      
      // Mock mobile file upload
      await page.route('**/api/upload', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, text: sampleLeaseContent })
        });
      });
      
      const pdfBuffer = createMockPDF();
      await page.setInputFiles('#file-upload', {
        name: 'mobile-test.pdf',
        mimeType: 'application/pdf',
        buffer: pdfBuffer
      });
      
      await expect(page.locator('text=mobile-test.pdf')).toBeVisible();
    });
  });

  test.describe('10. Integration Tests', () => {
    test('should complete full user journey', async () => {
      await page.goto('http://localhost:3000');
      
      // Mock all API calls for full journey
      await page.route('**/api/upload', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            text: sampleLeaseContent,
            violations: [
              {
                severity: 'high',
                description: 'Illegal late fee',
                explanation: 'Late fees cannot exceed 5% of rent',
                confidence: 0.9
              }
            ]
          })
        });
      });
      
      await page.route('**/api/chat', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            response: 'Based on your lease, the late fee clause appears to be illegal.',
            sessionId: 'test-session-123'
          })
        });
      });
      
      // 1. Upload document
      const pdfBuffer = createMockPDF();
      await page.setInputFiles('#file-upload', {
        name: 'full-journey-test.pdf',
        mimeType: 'application/pdf',
        buffer: pdfBuffer
      });
      
      // 2. Wait for processing
      await page.waitForSelector('text=Illegal late fee', { timeout: 10000 });
      
      // 3. Verify violations found
      await expect(page.locator('text=Illegal late fee')).toBeVisible();
      
      // 4. Start chat
      await page.waitForSelector('input[placeholder*="question"]', { timeout: 10000 });
      await page.fill('input[placeholder*="question"]', 'What should I do about this?');
      await page.click('button:has-text("Send")');
      
      // 5. Verify AI response
      await page.waitForSelector('text=Based on your lease', { timeout: 10000 });
      await expect(page.locator('text=Based on your lease')).toBeVisible();
      
      // 6. Verify session persistence
      await expect(page.locator('text=Illegal late fee')).toBeVisible(); // Previous results still visible
    });
  });
}); 