/**
 * OCR Service for TariffGuard
 * Handles document processing and line item extraction from invoices and commercial documents
 */

import { createWorker } from 'tesseract.js'

export interface ExtractedLineItem {
  description: string
  hsCode?: string
  value?: number
  quantity?: number
  unit?: string
  confidence: number
  rawText: string
}

export interface OCRResult {
  success: boolean
  lineItems: ExtractedLineItem[]
  fullText: string
  confidence: number
  processingTime: number
  error?: string
}

export class OCRService {
  private worker: Tesseract.Worker | null = null

  /**
   * Initialize Tesseract worker
   */
  async initialize(): Promise<void> {
    if (this.worker) {
      return
    }

    try {
      console.log('🔍 Initializing OCR worker...')
      this.worker = await createWorker('eng')

      // Configure for better number and table recognition
      await this.worker.setParameters({
        tessedit_char_whitelist:
          '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.,()-$ ',
        preserve_interword_spaces: '1',
      })

      console.log('✅ OCR worker initialized successfully')
    } catch (error) {
      console.error('❌ Failed to initialize OCR worker:', error)
      throw new Error('Failed to initialize OCR service')
    }
  }

  /**
   * Process image file and extract line items
   */
  async processImage(imageBuffer: Buffer, mimeType: string): Promise<OCRResult> {
    const startTime = Date.now()

    try {
      await this.initialize()

      if (!this.worker) {
        throw new Error('OCR worker not initialized')
      }

      console.log(`🔍 Processing ${mimeType} image for OCR...`)

      // Perform OCR
      const {
        data: { text, confidence },
      } = await this.worker.recognize(imageBuffer)

      console.log(`✅ OCR completed with ${confidence.toFixed(1)}% confidence`)

      // Extract line items from text
      const lineItems = this.extractLineItemsFromText(text, confidence)

      const processingTime = Date.now() - startTime

      return {
        success: true,
        lineItems,
        fullText: text,
        confidence,
        processingTime,
      }
    } catch (error) {
      console.error('❌ OCR processing failed:', error)
      const processingTime = Date.now() - startTime

      return {
        success: false,
        lineItems: [],
        fullText: '',
        confidence: 0,
        processingTime,
        error: error instanceof Error ? error.message : 'Unknown OCR error',
      }
    }
  }

  /**
   * Process PDF file and extract line items
   */
  async processPDF(pdfBuffer: Buffer): Promise<OCRResult> {
    const startTime = Date.now()

    try {
      console.log('🔍 Processing PDF document...')

      // Dynamically import pdf-parse to avoid build issues
      const pdfParse = (await import('pdf-parse')).default as any

      // Extract text from PDF
      const data = await pdfParse(pdfBuffer)
      const text = data.text

      console.log(`✅ PDF text extracted: ${text.length} characters`)

      // If PDF has selectable text, use it directly
      if (text && text.trim().length > 50) {
        const lineItems = this.extractLineItemsFromText(text, 95) // High confidence for PDF text
        const processingTime = Date.now() - startTime

        return {
          success: true,
          lineItems,
          fullText: text,
          confidence: 95,
          processingTime,
        }
      } else {
        // PDF is likely image-based, would need image extraction
        // For now, return empty result with message
        const processingTime = Date.now() - startTime

        return {
          success: false,
          lineItems: [],
          fullText: '',
          confidence: 0,
          processingTime,
          error:
            'PDF appears to be image-based. Please convert to image format for OCR processing.',
        }
      }
    } catch (error) {
      console.error('❌ PDF processing failed:', error)
      const processingTime = Date.now() - startTime

      return {
        success: false,
        lineItems: [],
        fullText: '',
        confidence: 0,
        processingTime,
        error: error instanceof Error ? error.message : 'Unknown PDF processing error',
      }
    }
  }

  /**
   * Extract line items from OCR text using pattern matching
   */
  private extractLineItemsFromText(
    text: string,
    baseConfidence: number
  ): ExtractedLineItem[] {
    const lineItems: ExtractedLineItem[] = []
    const lines = text.split('\n').filter(line => line.trim().length > 5)

    console.log(`🔍 Analyzing ${lines.length} lines of text for line items...`)

    for (const line of lines) {
      const trimmedLine = line.trim()

      // Skip header lines and short lines
      if (this.isHeaderLine(trimmedLine) || trimmedLine.length < 10) {
        continue
      }

      // Try to extract line item data
      const lineItem = this.parseLineItem(trimmedLine, baseConfidence)
      if (lineItem) {
        lineItems.push(lineItem)
      }
    }

    console.log(`✅ Extracted ${lineItems.length} potential line items`)
    return lineItems
  }

  /**
   * Check if line is likely a header or label
   */
  private isHeaderLine(line: string): boolean {
    const headerKeywords = [
      'invoice',
      'commercial',
      'packing',
      'list',
      'total',
      'subtotal',
      'description',
      'quantity',
      'price',
      'amount',
      'hs code',
      'harmonized',
      'date',
      'bill to',
      'ship to',
      'from',
      'page',
      'invoice number',
    ]

    const lowerLine = line.toLowerCase()
    return headerKeywords.some(keyword => lowerLine.includes(keyword))
  }

  /**
   * Parse individual line item from text
   */
  private parseLineItem(
    line: string,
    baseConfidence: number
  ): ExtractedLineItem | null {
    // Patterns for different line item formats
    const patterns: RegExp[] = [
      // Pattern 1: Description - Quantity - Price (common invoice format)
      /^(.+?)\s+(\d+(?:\.\d+)?)\s+\$?(\d+(?:,\d{3})*(?:\.\d{2})?)/,

      // Pattern 2: HS Code followed by description and value
      /(\d{4}(?:\.\d{2}(?:\.\d{2})?)?)\s+(.+?)\s+\$?(\d+(?:,\d{3})*(?:\.\d{2})?)/,

      // Pattern 3: Description with possible HS code embedded
      /(.+?(?:\d{4}\.\d{2}\.\d{2}.+?))\s+\$?(\d+(?:,\d{3})*(?:\.\d{2})?)/,

      // Pattern 4: Simple description and value
      /^(.+?)\s+\$?(\d+(?:,\d{3})*(?:\.\d{2})?)$/,
    ]

    for (let i = 0; i < patterns.length; i++) {
      const match = line.match(patterns[i]!)
      if (match) {
        return this.createLineItemFromMatch(match, line, baseConfidence - i * 5)
      }
    }

    // If no specific pattern matches but line contains numbers, create basic item
    if (/\d+/.test(line) && line.length > 10) {
      return {
        description: line.replace(/\s+/g, ' ').trim(),
        confidence: Math.max(30, baseConfidence - 40),
        rawText: line,
      }
    }

    return null
  }

  /**
   * Create line item from regex match
   */
  private createLineItemFromMatch(
    match: RegExpMatchArray,
    rawText: string,
    confidence: number
  ): ExtractedLineItem {
    const lineItem: ExtractedLineItem = {
      description: '',
      confidence: Math.max(10, confidence),
      rawText,
    }

    // Extract HS code if present
    const hsCodeMatch = rawText.match(/\b(\d{4}(?:\.\d{2}(?:\.\d{2})?)?)\b/)
    if (hsCodeMatch) {
      lineItem.hsCode = hsCodeMatch[1]
      lineItem.confidence += 15
    }

    // Extract description (usually first capture group)
    if (match[1]) {
      lineItem.description = match[1].replace(/\s+/g, ' ').trim()
    } else if (match[2]) {
      lineItem.description = match[2].replace(/\s+/g, ' ').trim()
    }

    // Extract quantity (look for standalone numbers before price)
    const quantityMatch = rawText.match(/\b(\d+(?:\.\d+)?)\s+(?:\$|USD|\d+,)/i)
    if (quantityMatch && quantityMatch[1] && parseFloat(quantityMatch[1]) < 10000) {
      lineItem.quantity = parseFloat(quantityMatch[1])
      lineItem.confidence += 10
    }

    // Extract value (look for currency amounts)
    const valueMatch = rawText.match(/\$?(\d+(?:,\d{3})*(?:\.\d{2})?)/g)
    if (valueMatch) {
      // Get the largest number as likely the total value
      const values = valueMatch
        .map(v => parseFloat(v.replace(/[$,]/g, '')))
        .filter(v => !isNaN(v))

      if (values.length > 0) {
        lineItem.value = Math.max(...values)
        lineItem.confidence += 15
      }
    }

    // Extract unit if present
    const unitMatch = rawText.match(
      /\b(pcs?|pieces?|kg|kgs?|lbs?|each|ea|units?|boxes?|cartons?)\b/i
    )
    if (unitMatch && unitMatch[1]) {
      lineItem.unit = unitMatch[1].toLowerCase()
      lineItem.confidence += 5
    }

    return lineItem
  }

  /**
   * Cleanup resources
   */
  async terminate(): Promise<void> {
    if (this.worker) {
      console.log('🔄 Terminating OCR worker...')
      await this.worker.terminate()
      this.worker = null
      console.log('✅ OCR worker terminated')
    }
  }
}

// Export singleton instance
export const ocrService = new OCRService()
