import { NextRequest, NextResponse } from 'next/server';
import documentProcessor from '@/lib/document-processor';
import redisClient from '@/lib/redis';
import { executeWithErrorHandling } from '@/lib/error-handling';
import { v4 as uuidv4 } from 'uuid';

/**
 * POST /api/upload
 * Handle document upload and processing
 */
export async function POST(request: NextRequest) {
  try {
    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }
    
    // Validate file
    const validation = documentProcessor.validateFile(file);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }
    
    // Generate unique lease ID
    const leaseId = uuidv4();
    
    // Execute document processing with error handling
    const analysis = await executeWithErrorHandling(
      'document_processing',
      'redis',
      async () => {
        // Initialize Redis connection
        await redisClient.connect();
        
        // Process document
        console.log(`Starting document processing for lease ${leaseId}`);
        return await documentProcessor.processDocument(file, leaseId);
      },
      { sessionId: leaseId }
    );
    
    // Return analysis results
    return NextResponse.json({
      success: true,
      leaseId: analysis.leaseId,
      summary: analysis.summary,
      violations: analysis.violations,
      message: `Successfully processed ${analysis.clauses.length} clauses. Found ${analysis.summary.flaggedClauses} potential violations.`
    });
    
  } catch (error) {
    console.error('Upload API error:', error);
    
    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes('Failed to extract text')) {
        return NextResponse.json(
          { error: 'Unable to read document. Please ensure the file is not corrupted and try again.' },
          { status: 422 }
        );
      }
      
      if (error.message.includes('Unsupported file type')) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        );
      }
      
      if (error.message.includes('Circuit breaker is OPEN')) {
        return NextResponse.json(
          { error: 'Service temporarily unavailable. Please try again in a moment.' },
          { status: 503 }
        );
      }
    }
    
    return NextResponse.json(
      { error: 'Internal server error. Please try again.' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/upload
 * Health check endpoint
 */
export async function GET() {
  try {
    // Initialize Redis connection if needed
    await redisClient.connect();
    
    // Check Redis connection
    const redisHealthy = await redisClient.healthCheck();
    
    // Check document processor
    const processorHealthy = await documentProcessor.healthCheck();
    
    if (!redisHealthy || !processorHealthy) {
      return NextResponse.json(
        { 
          status: 'unhealthy',
          redis: redisHealthy,
          processor: processorHealthy
        },
        { status: 503 }
      );
    }
    
    return NextResponse.json({
      status: 'healthy',
      redis: true,
      processor: true,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Health check error:', error);
    return NextResponse.json(
      { 
        status: 'unhealthy',
        error: 'Health check failed'
      },
      { status: 503 }
    );
  }
} 