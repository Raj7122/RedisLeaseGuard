'use client';

import { useState } from 'react';
import { Upload, FileText, AlertTriangle, CheckCircle, MessageCircle, Loader2 } from 'lucide-react';

interface LeaseAnalysis {
  leaseId: string;
  summary: {
    totalClauses: number;
    flaggedClauses: number;
    criticalViolations: number;
    highViolations: number;
    mediumViolations: number;
    lowViolations: number;
  };
  violations: Array<{
    clauseId: string;
    type: string;
    description: string;
    legalReference: string;
    severity: 'Critical' | 'High' | 'Medium' | 'Low';
  }>;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [analysis, setAnalysis] = useState<LeaseAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [question, setQuestion] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      setAnalysis(data);
      setChatHistory([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleAskQuestion = async () => {
    if (!question.trim() || !analysis) return;

    setIsAsking(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: question.trim(),
          leaseId: analysis.leaseId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get response');
      }

      const newMessage: ChatMessage = {
        role: 'assistant',
        content: data.response,
        timestamp: new Date().toISOString(),
      };

      setChatHistory(prev => [
        ...prev,
        { role: 'user', content: question, timestamp: new Date().toISOString() },
        newMessage,
      ]);

      setQuestion('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get response');
    } finally {
      setIsAsking(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'Critical':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'High':
        return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'Medium':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'Low':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'Critical':
        return <AlertTriangle className="w-4 h-4" />;
      case 'High':
        return <AlertTriangle className="w-4 h-4" />;
      case 'Medium':
        return <AlertTriangle className="w-4 h-4" />;
      case 'Low':
        return <FileText className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">LeaseGuard</h1>
              <p className="text-sm text-gray-600">AI-Powered Tenant Rights Assistant</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Upload Section */}
        {!analysis && (
          <div className="bg-white rounded-lg shadow-sm border p-6 mb-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Upload className="w-8 h-8 text-blue-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Upload Your Lease Document
              </h2>
              <p className="text-gray-600 mb-6">
                Get instant analysis of your lease to identify potential violations and understand your rights.
              </p>

              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 mb-6">
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.tiff,.bmp"
                  onChange={handleFileChange}
                  className="hidden"
                  id="file-upload"
                />
                <label
                  htmlFor="file-upload"
                  className="cursor-pointer flex flex-col items-center"
                >
                  <Upload className="w-8 h-8 text-gray-400 mb-2" />
                  <span className="text-sm text-gray-600">
                    {file ? file.name : 'Click to select PDF or image file'}
                  </span>
                  <span className="text-xs text-gray-500 mt-1">
                    Max 10MB • PDF, JPG, PNG, TIFF, BMP
                  </span>
                </label>
              </div>

              {file && (
                <button
                  onClick={handleUpload}
                  disabled={isUploading}
                  className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    'Analyze Lease'
                  )}
                </button>
              )}

              {error && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-600 text-sm">{error}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Analysis Results */}
        {analysis && (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-lg border">
                <div className="flex items-center">
                  <FileText className="w-5 h-5 text-blue-600 mr-2" />
                  <span className="text-sm text-gray-600">Total Clauses</span>
                </div>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {analysis.summary.totalClauses}
                </p>
              </div>

              <div className="bg-white p-4 rounded-lg border">
                <div className="flex items-center">
                  <AlertTriangle className="w-5 h-5 text-red-600 mr-2" />
                  <span className="text-sm text-gray-600">Flagged</span>
                </div>
                <p className="text-2xl font-bold text-red-600 mt-1">
                  {analysis.summary.flaggedClauses}
                </p>
              </div>

              <div className="bg-white p-4 rounded-lg border">
                <div className="flex items-center">
                  <AlertTriangle className="w-5 h-5 text-orange-600 mr-2" />
                  <span className="text-sm text-gray-600">Critical</span>
                </div>
                <p className="text-2xl font-bold text-orange-600 mt-1">
                  {analysis.summary.criticalViolations}
                </p>
              </div>

              <div className="bg-white p-4 rounded-lg border">
                <div className="flex items-center">
                  <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                  <span className="text-sm text-gray-600">Compliant</span>
                </div>
                <p className="text-2xl font-bold text-green-600 mt-1">
                  {analysis.summary.totalClauses - analysis.summary.flaggedClauses}
                </p>
              </div>
            </div>

            {/* Violations List */}
            {analysis.violations.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border">
                <div className="p-6 border-b">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Potential Violations Found
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    These clauses may violate NYC housing laws
                  </p>
                </div>
                <div className="divide-y">
                  {analysis.violations.map((violation, index) => (
                    <div key={index} className="p-6">
                      <div className="flex items-start space-x-3">
                        <div className={`p-2 rounded-lg border ${getSeverityColor(violation.severity)}`}>
                          {getSeverityIcon(violation.severity)}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor(violation.severity)}`}>
                              {violation.severity}
                            </span>
                            <span className="text-sm text-gray-500">
                              {violation.type}
                            </span>
                          </div>
                          <p className="text-gray-900 mb-2">{violation.description}</p>
                          <p className="text-sm text-gray-600">
                            <strong>Legal Reference:</strong> {violation.legalReference}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Chat Interface */}
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="p-6 border-b">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <MessageCircle className="w-5 h-5 mr-2" />
                  Ask Questions About Your Lease
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  Get personalized guidance about your specific lease clauses
                </p>
              </div>

              {/* Chat History */}
              {chatHistory.length > 0 && (
                <div className="p-6 border-b max-h-96 overflow-y-auto">
                  <div className="space-y-4">
                    {chatHistory.map((message, index) => (
                      <div
                        key={index}
                        className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                            message.role === 'user'
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 text-gray-900'
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Question Input */}
              <div className="p-6">
                <div className="flex space-x-3">
                  <input
                    type="text"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="Ask about your lease clauses..."
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    onKeyPress={(e) => e.key === 'Enter' && handleAskQuestion()}
                  />
                  <button
                    onClick={handleAskQuestion}
                    disabled={!question.trim() || isAsking}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                  >
                    {isAsking ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      'Ask'
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Upload New Document */}
            <div className="text-center">
              <button
                onClick={() => {
                  setAnalysis(null);
                  setFile(null);
                  setChatHistory([]);
                  setError(null);
                }}
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                Upload Another Document
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
