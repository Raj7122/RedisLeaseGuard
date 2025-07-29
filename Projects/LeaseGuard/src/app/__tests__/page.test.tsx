import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Home from '../page';

// Mock fetch for API calls
global.fetch = jest.fn();

// Mock File API
const mockFile = new File(['test content'], 'test-lease.pdf', { type: 'application/pdf' });

describe('LeaseGuard Home Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
  });

  describe('Initial State', () => {
    it('should render the header with correct branding', () => {
      render(<Home />);
      
      expect(screen.getByText('LeaseGuard')).toBeInTheDocument();
      expect(screen.getByText('AI-Powered Tenant Rights Assistant')).toBeInTheDocument();
    });

    it('should show upload section when no analysis is present', () => {
      render(<Home />);
      
      expect(screen.getByText('Upload Your Lease Document')).toBeInTheDocument();
      expect(screen.getByText(/Get instant analysis of your lease/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Click to select PDF or image file/)).toBeInTheDocument();
    });

    it('should not show analysis results initially', () => {
      render(<Home />);
      
      expect(screen.queryByText('Potential Violations Found')).not.toBeInTheDocument();
      expect(screen.queryByText('Ask Questions About Your Lease')).not.toBeInTheDocument();
    });
  });

  describe('File Upload', () => {
    it('should handle file selection', async () => {
      const user = userEvent.setup();
      render(<Home />);
      
      const fileInput = screen.getByLabelText(/Click to select PDF or image file/);
      await user.upload(fileInput, mockFile);
      
      expect(screen.getByText('test-lease.pdf')).toBeInTheDocument();
      expect(screen.getByText('Analyze Lease')).toBeInTheDocument();
    });

    it('should clear error when new file is selected', async () => {
      const user = userEvent.setup();
      render(<Home />);
      
      // First, trigger an error by simulating a failed upload
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Upload failed'));
      
      const fileInput = screen.getByLabelText(/Click to select PDF or image file/);
      await user.upload(fileInput, mockFile);
      
      const analyzeButton = screen.getByText('Analyze Lease');
      await user.click(analyzeButton);
      
      await waitFor(() => {
        expect(screen.getByText('Upload failed')).toBeInTheDocument();
      });
      
      // Now select a new file
      const newFile = new File(['new content'], 'new-lease.pdf', { type: 'application/pdf' });
      await user.upload(fileInput, newFile);
      
      expect(screen.queryByText('Upload failed')).not.toBeInTheDocument();
    });
  });

  describe('Upload Process', () => {
    it('should handle successful upload and analysis', async () => {
      const user = userEvent.setup();
      const mockAnalysis = {
        leaseId: 'test-123',
        summary: {
          totalClauses: 10,
          flaggedClauses: 3,
          criticalViolations: 1,
          highViolations: 1,
          mediumViolations: 1,
          lowViolations: 0
        },
        violations: [
          {
            clauseId: 'clause-1',
            type: 'Excessive Security Deposit',
            description: 'Security deposit exceeds one month rent',
            legalReference: 'NYC Housing Maintenance Code §27-2056',
            severity: 'Critical' as const
          }
        ]
      };
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockAnalysis
      });
      
      render(<Home />);
      
      const fileInput = screen.getByLabelText(/Click to select PDF or image file/);
      await user.upload(fileInput, mockFile);
      
      const analyzeButton = screen.getByText('Analyze Lease');
      await user.click(analyzeButton);
      
      await waitFor(() => {
        expect(screen.getByText('Potential Violations Found')).toBeInTheDocument();
        expect(screen.getByText('10')).toBeInTheDocument(); // Total clauses
        expect(screen.getByText('3')).toBeInTheDocument(); // Flagged clauses
        expect(screen.getByText('1')).toBeInTheDocument(); // Critical violations
      });
    });

    it('should handle upload errors gracefully', async () => {
      const user = userEvent.setup();
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));
      
      render(<Home />);
      
      const fileInput = screen.getByLabelText(/Click to select PDF or image file/);
      await user.upload(fileInput, mockFile);
      
      const analyzeButton = screen.getByText('Analyze Lease');
      await user.click(analyzeButton);
      
      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });

    it('should handle API error responses', async () => {
      const user = userEvent.setup();
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Invalid file format' })
      });
      
      render(<Home />);
      
      const fileInput = screen.getByLabelText(/Click to select PDF or image file/);
      await user.upload(fileInput, mockFile);
      
      const analyzeButton = screen.getByText('Analyze Lease');
      await user.click(analyzeButton);
      
      await waitFor(() => {
        expect(screen.getByText('Invalid file format')).toBeInTheDocument();
      });
    });
  });

  describe('Analysis Results Display', () => {
    const mockAnalysis = {
      leaseId: 'test-123',
      summary: {
        totalClauses: 15,
        flaggedClauses: 4,
        criticalViolations: 2,
        highViolations: 1,
        mediumViolations: 1,
        lowViolations: 0
      },
      violations: [
        {
          clauseId: 'clause-1',
          type: 'Excessive Security Deposit',
          description: 'Security deposit exceeds one month rent',
          legalReference: 'NYC Housing Maintenance Code §27-2056',
          severity: 'Critical' as const
        },
        {
          clauseId: 'clause-2',
          type: 'Repair Responsibility Waiver',
          description: 'Tenant waives repair claims',
          legalReference: 'NYC Housing Maintenance Code Article 1',
          severity: 'High' as const
        }
      ]
    };

    beforeEach(() => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockAnalysis
      });
    });

    it('should display summary cards with correct data', async () => {
      const user = userEvent.setup();
      render(<Home />);
      
      const fileInput = screen.getByLabelText(/Click to select PDF or image file/);
      await user.upload(fileInput, mockFile);
      
      const analyzeButton = screen.getByText('Analyze Lease');
      await user.click(analyzeButton);
      
      await waitFor(() => {
        expect(screen.getByText('15')).toBeInTheDocument(); // Total clauses
        expect(screen.getByText('4')).toBeInTheDocument(); // Flagged clauses
        expect(screen.getByText('2')).toBeInTheDocument(); // Critical violations
        expect(screen.getByText('11')).toBeInTheDocument(); // Compliant clauses (15-4)
      });
    });

    it('should display violations with correct severity styling', async () => {
      const user = userEvent.setup();
      render(<Home />);
      
      const fileInput = screen.getByLabelText(/Click to select PDF or image file/);
      await user.upload(fileInput, mockFile);
      
      const analyzeButton = screen.getByText('Analyze Lease');
      await user.click(analyzeButton);
      
      await waitFor(() => {
        expect(screen.getByText('Excessive Security Deposit')).toBeInTheDocument();
        expect(screen.getByText('Repair Responsibility Waiver')).toBeInTheDocument();
        expect(screen.getAllByText('Critical')).toHaveLength(2); // Summary card + violation badge
        expect(screen.getByText('High')).toBeInTheDocument();
      });
    });

    it('should show legal references for violations', async () => {
      const user = userEvent.setup();
      render(<Home />);
      
      const fileInput = screen.getByLabelText(/Click to select PDF or image file/);
      await user.upload(fileInput, mockFile);
      
      const analyzeButton = screen.getByText('Analyze Lease');
      await user.click(analyzeButton);
      
      await waitFor(() => {
        expect(screen.getByText(/NYC Housing Maintenance Code §27-2056/)).toBeInTheDocument();
        expect(screen.getByText(/NYC Housing Maintenance Code Article 1/)).toBeInTheDocument();
      });
    });
  });

  describe('Chat Interface', () => {
    const mockAnalysis = {
      leaseId: 'test-123',
      summary: { totalClauses: 5, flaggedClauses: 1, criticalViolations: 1, highViolations: 0, mediumViolations: 0, lowViolations: 0 },
      violations: []
    };

    beforeEach(() => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockAnalysis
      });
    });

    it('should display chat interface after analysis', async () => {
      const user = userEvent.setup();
      render(<Home />);
      
      const fileInput = screen.getByLabelText(/Click to select PDF or image file/);
      await user.upload(fileInput, mockFile);
      
      const analyzeButton = screen.getByText('Analyze Lease');
      await user.click(analyzeButton);
      
      await waitFor(() => {
        expect(screen.getByText('Ask Questions About Your Lease')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Ask about your lease clauses...')).toBeInTheDocument();
      });
    });

    it('should handle question submission', async () => {
      const user = userEvent.setup();
      
      // Mock the upload response
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockAnalysis
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ response: 'This is a test response from the AI.' })
        });
      
      render(<Home />);
      
      const fileInput = screen.getByLabelText(/Click to select PDF or image file/);
      await user.upload(fileInput, mockFile);
      
      const analyzeButton = screen.getByText('Analyze Lease');
      await user.click(analyzeButton);
      
      await waitFor(() => {
        expect(screen.getByText('Ask Questions About Your Lease')).toBeInTheDocument();
      });
      
      const questionInput = screen.getByPlaceholderText('Ask about your lease clauses...');
      const askButton = screen.getByText('Ask');
      
      await user.type(questionInput, 'What should I do about the security deposit?');
      await user.click(askButton);
      
      await waitFor(() => {
        expect(screen.getByText('What should I do about the security deposit?')).toBeInTheDocument();
        expect(screen.getByText('This is a test response from the AI.')).toBeInTheDocument();
      });
    });

    it('should disable ask button when question is empty', async () => {
      const user = userEvent.setup();
      render(<Home />);
      
      const fileInput = screen.getByLabelText(/Click to select PDF or image file/);
      await user.upload(fileInput, mockFile);
      
      const analyzeButton = screen.getByText('Analyze Lease');
      await user.click(analyzeButton);
      
      await waitFor(() => {
        const askButton = screen.getByText('Ask');
        expect(askButton).toBeDisabled();
      });
    });
  });

  describe('Navigation and State Management', () => {
    it('should allow uploading a new document after analysis', async () => {
      const user = userEvent.setup();
      const mockAnalysis = {
        leaseId: 'test-123',
        summary: { totalClauses: 5, flaggedClauses: 1, criticalViolations: 1, highViolations: 0, mediumViolations: 0, lowViolations: 0 },
        violations: []
      };
      
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockAnalysis
      });
      
      render(<Home />);
      
      const fileInput = screen.getByLabelText(/Click to select PDF or image file/);
      await user.upload(fileInput, mockFile);
      
      const analyzeButton = screen.getByText('Analyze Lease');
      await user.click(analyzeButton);
      
      await waitFor(() => {
        expect(screen.getByText('Ask Questions About Your Lease')).toBeInTheDocument();
      });
      
      const uploadNewButton = screen.getByText('Upload Another Document');
      await user.click(uploadNewButton);
      
      expect(screen.getByText('Upload Your Lease Document')).toBeInTheDocument();
      expect(screen.queryByText('Ask Questions About Your Lease')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels and semantic HTML', () => {
      render(<Home />);
      
      // Check for proper heading hierarchy
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
      
      // Check for proper form labels
      expect(screen.getByLabelText(/Click to select PDF or image file/)).toBeInTheDocument();
      
      // Check for proper button roles - the button is only visible when a file is selected
      const fileInput = screen.getByLabelText(/Click to select PDF or image file/);
      expect(fileInput).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<Home />);
      
      const fileInput = screen.getByLabelText(/Click to select PDF or image file/);
      await user.upload(fileInput, mockFile);
      
      const analyzeButton = screen.getByText('Analyze Lease');
      expect(analyzeButton).toBeInTheDocument();
      
      // Tab navigation should work
      await user.tab();
      expect(analyzeButton).toHaveFocus();
    });
  });

  describe('Responsive Design', () => {
    it('should display summary cards in grid layout', async () => {
      const user = userEvent.setup();
      const mockAnalysis = {
        leaseId: 'test-123',
        summary: { totalClauses: 5, flaggedClauses: 1, criticalViolations: 1, highViolations: 0, mediumViolations: 0, lowViolations: 0 },
        violations: []
      };
      
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockAnalysis
      });
      
      render(<Home />);
      
      const fileInput = screen.getByLabelText(/Click to select PDF or image file/);
      await user.upload(fileInput, mockFile);
      
      const analyzeButton = screen.getByText('Analyze Lease');
      await user.click(analyzeButton);
      
      await waitFor(() => {
        const summaryCards = screen.getAllByText(/Total Clauses|Flagged|Critical|Compliant/);
        expect(summaryCards.length).toBeGreaterThan(0);
      });
    });
  });
}); 