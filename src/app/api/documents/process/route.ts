/**
 * Document Processing API Endpoint
 * Handles OCR processing of uploaded documents (images and PDFs)
 */

import { NextRequest, NextResponse } from 'next/server'
import { ocrService, type OCRResult } from '@/lib/ocr'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB limit
const ALLOWED_TYPES = [
  'image/jpeg',
  'image/jpg', 
  'image/png',
  'application/pdf'
]

export async function POST(request: NextRequest) {
  try {
    console.log('📄 Document processing request received')
    
    // Parse form data
    const formData = await request.formData()
    const file = formData.get('document') as File
    
    if (!file) {
      return NextResponse.json(
        { error: 'No document file provided' },
        { status: 400 }
      )
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { 
          error: `Unsupported file type: ${file.type}. Supported types: ${ALLOWED_TYPES.join(', ')}` 
        },
        { status: 400 }
      )
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { 
          error: `File too large: ${Math.round(file.size / 1024 / 1024)}MB. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB` 
        },
        { status: 400 }
      )
    }

    console.log(`📄 Processing ${file.type} document: ${file.name} (${Math.round(file.size / 1024)}KB)`)

    // Convert file to buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    let result: OCRResult

    // Process based on file type
    if (file.type === 'application/pdf') {
      result = await ocrService.processPDF(buffer)
    } else {
      // Image processing
      result = await ocrService.processImage(buffer, file.type)
    }

    console.log(`✅ Document processing completed in ${result.processingTime}ms`)
    console.log(`📊 Extracted ${result.lineItems.length} line items with ${result.confidence.toFixed(1)}% confidence`)

    // Return results
    return NextResponse.json({
      success: result.success,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      processingTime: result.processingTime,
      confidence: result.confidence,
      lineItems: result.lineItems,
      fullText: result.fullText.substring(0, 1000), // Limit full text in response
      error: result.error,
      metadata: {
        totalLines: result.fullText.split('\n').length,
        textLength: result.fullText.length,
        extractedItems: result.lineItems.length
      }
    })

  } catch (error) {
    console.error('❌ Document processing API error:', error)
    
    return NextResponse.json(
      { 
        error: 'Document processing failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Health check endpoint
export async function GET() {
  try {
    return NextResponse.json({
      status: 'Document processing API is operational',
      supportedTypes: ALLOWED_TYPES,
      maxFileSize: `${MAX_FILE_SIZE / 1024 / 1024}MB`,
      features: [
        'OCR text extraction',
        'PDF text parsing', 
        'Line item detection',
        'HS code recognition',
        'Value and quantity extraction'
      ],
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Service health check failed' },
      { status: 500 }
    )
  }
}