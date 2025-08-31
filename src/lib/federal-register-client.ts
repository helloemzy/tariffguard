/**
 * Production Federal Register API Client
 * 
 * This module provides a comprehensive API client for the Federal Register
 * focused on tariff monitoring for Preston's steel importing business.
 */

// Types and interfaces
export interface FederalRegisterDocument {
  abstract: string | null
  action: string | null
  agencies: Array<{
    id: number
    name: string
    slug: string
  }>
  body_html_url: string | null
  citation: string | null
  comment_url: string | null
  correction_of: string | null
  document_number: string
  effective_on: string | null
  end_page: number | null
  excerpts: string | null
  executive_order_notes: string | null
  executive_order_number: string | null
  full_text_xml_url: string | null
  html_url: string
  json_url: string
  mods_url: string | null
  pdf_url: string | null
  presidential_document_number: string | null
  public_inspection_pdf_url: string | null
  publication_date: string
  raw_text_url: string | null
  regulation_id_numbers: string[]
  regulations_dot_gov_info: any
  start_page: number | null
  subtype: string | null
  title: string
  type: string
  volume: number | null
}

export interface FederalRegisterSearchResult {
  count: number
  description: string
  total_pages: number
  next_page_url: string | null
  previous_page_url: string | null
  results: FederalRegisterDocument[]
}

export interface TariffRate {
  hsCode: string
  productDescription: string
  currentRate: number
  newRate?: number
  effectiveDate?: string
  documentNumber?: string
  changePercent?: number
  isSignificant: boolean
  containerImpact?: number
  source: 'federal-register' | 'document-parsing' | 'manual'
}

export interface MonitoringResult {
  success: boolean
  timestamp: string
  documentsScanned: number
  rateChangesFound: TariffRate[]
  significantChanges: TariffRate[]
  errors: string[]
  nextCheckRecommended?: string
}

// Configuration
const CONFIG = {
  baseUrl: 'https://www.federalregister.gov/api/v1',
  timeout: 30000, // 30 seconds for document retrieval
  retryAttempts: 3,
  retryDelay: 2000, // 2 seconds
  rateLimit: {
    requestsPerMinute: 100, // Conservative rate limiting
    lastRequestTime: 0,
    minInterval: 600, // Minimum 600ms between requests
  },
  userAgent: 'TariffGuard/1.0 Preston Steel Import Monitor',
} as const

// Preston's monitored HS codes with product descriptions
export const PRESTON_HS_CODES = {
  '7318.15.20': 'Steel fasteners - bolts, screws, and threaded articles',
  '8481.80.90': 'Taps, cocks, valves and similar appliances, other', 
  '7326.90.85': 'Other articles of iron or steel, not elsewhere specified',
} as const

// Search terms for different tariff types
/* const TARIFF_SEARCH_TERMS = {
  section232: 'Section 232 OR steel tariff OR steel duty OR "adjusting imports of steel"',
  section301: 'Section 301 OR China tariff OR additional duties OR "trade action"',
  general: 'tariff OR duty OR "Harmonized Tariff" OR HTS OR customs OR import',
  steel: 'steel OR iron OR fastener OR valve OR "iron or steel articles"',
} as const */

/**
 * Federal Register API Client
 */
export class FederalRegisterClient {
  private lastRequestTime = 0

  /**
   * Rate limiting - ensure we don't overwhelm the API
   */
  private async enforceRateLimit(): Promise<void> {
    const now = Date.now()
    const timeSinceLastRequest = now - this.lastRequestTime
    
    if (timeSinceLastRequest < CONFIG.rateLimit.minInterval) {
      const delay = CONFIG.rateLimit.minInterval - timeSinceLastRequest
      await new Promise(resolve => setTimeout(resolve, delay))
    }
    
    this.lastRequestTime = Date.now()
  }

  /**
   * Make authenticated request with retry logic
   */
  private async makeRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
    await this.enforceRateLimit()

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.timeout)

    let lastError: Error | null = null

    for (let attempt = 1; attempt <= CONFIG.retryAttempts; attempt++) {
      try {
        const response = await fetch(url, {
          ...options,
          headers: {
            'Accept': 'application/json',
            'User-Agent': CONFIG.userAgent,
            ...options.headers,
          },
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        const data = await response.json()
        return data as T
        
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error')
        
        if (attempt === CONFIG.retryAttempts) {
          break
        }

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, CONFIG.retryDelay * attempt))
        
        // Reset timeout for next attempt
        clearTimeout(timeoutId)
        const newController = new AbortController()
        setTimeout(() => newController.abort(), CONFIG.timeout)
        controller.abort = newController.abort.bind(newController)
      }
    }

    clearTimeout(timeoutId)
    throw lastError || new Error('Request failed after all retries')
  }

  /**
   * Search for documents with comprehensive parameters
   */
  async searchDocuments(params: {
    term?: string
    agencies?: string[]
    hsCode?: string
    dateFrom?: string
    dateTo?: string
    documentTypes?: string[]
    perPage?: number
    page?: number
  }): Promise<FederalRegisterSearchResult> {
    const url = new URL(`${CONFIG.baseUrl}/documents.json`)

    // Build search term
    const searchTerms: string[] = []
    
    if (params.term) {
      searchTerms.push(params.term)
    }
    
    if (params.hsCode) {
      searchTerms.push(`"${params.hsCode}"`)
    }

    if (searchTerms.length > 0) {
      url.searchParams.append('conditions[term]', searchTerms.join(' AND '))
    }

    // Date range
    if (params.dateFrom) {
      url.searchParams.append('conditions[publication_date][gte]', params.dateFrom)
    }
    if (params.dateTo) {
      url.searchParams.append('conditions[publication_date][lte]', params.dateTo)
    }

    // Agencies
    if (params.agencies && params.agencies.length > 0) {
      params.agencies.forEach(agency => {
        url.searchParams.append('conditions[agencies][]', agency)
      })
    }

    // Document types
    if (params.documentTypes && params.documentTypes.length > 0) {
      params.documentTypes.forEach(type => {
        url.searchParams.append('conditions[type][]', type)
      })
    }

    // Pagination
    url.searchParams.append('per_page', String(params.perPage || 20))
    url.searchParams.append('page', String(params.page || 1))
    url.searchParams.append('order', 'newest')

    return this.makeRequest<FederalRegisterSearchResult>(url.toString())
  }

  /**
   * Get single document with full content
   */
  async getDocument(documentNumber: string): Promise<FederalRegisterDocument> {
    const url = `${CONFIG.baseUrl}/documents/${documentNumber}.json`
    return this.makeRequest<FederalRegisterDocument>(url)
  }

  /**
   * Search for tariff-related documents affecting Preston's business
   */
  async searchTariffDocuments(options: {
    daysBack?: number
    includeProposed?: boolean
    specificHsCode?: string
  } = {}): Promise<FederalRegisterSearchResult> {
    const { daysBack = 30, includeProposed = true, specificHsCode } = options
    
    const endDate = new Date().toISOString().split('T')[0]
    const startDate = new Date(Date.now() - (daysBack * 24 * 60 * 60 * 1000))
      .toISOString().split('T')[0]

    // Use simpler search terms for Federal Register API
    const searchTerm = 'steel OR tariff OR "Section 232"'

    return this.searchDocuments({
      term: searchTerm,
      agencies: ['commerce-department', 'trade-representative', 'treasury-department'],
      hsCode: specificHsCode,
      dateFrom: startDate,
      dateTo: endDate,
      documentTypes: includeProposed 
        ? ['rule', 'proposed-rule', 'notice', 'presidential-document']
        : ['rule', 'notice', 'presidential-document'],
      perPage: 50
    })
  }

  /**
   * Extract tariff rates from document content
   */
  async extractTariffRates(document: FederalRegisterDocument): Promise<TariffRate[]> {
    const rates: TariffRate[] = []
    
    try {
      // Try to get document content for parsing
      let content = ''
      
      if (document.abstract) {
        content += `${document.abstract  } `
      }
      
      // If we have full text URL, fetch it
      if (document.raw_text_url) {
        try {
          const textResponse = await fetch(document.raw_text_url)
          if (textResponse.ok) {
            content += await textResponse.text()
          }
        } catch (error) {
          console.warn(`Failed to fetch full text for document ${document.document_number}:`, error)
        }
      }

      // Parse content for tariff rate information
      rates.push(...this.parseContentForRates(content, document))
      
    } catch (error) {
      console.error(`Error extracting tariff rates from document ${document.document_number}:`, error)
    }
    
    return rates
  }

  /**
   * Parse document content for rate information
   */
  private parseContentForRates(content: string, document: FederalRegisterDocument): TariffRate[] {
    const rates: TariffRate[] = []
    const contentLower = content.toLowerCase()
    
    // Check each of Preston's HS codes
    for (const [hsCode, productDescription] of Object.entries(PRESTON_HS_CODES)) {
      if (contentLower.includes(hsCode.toLowerCase())) {
        // Look for rate patterns near the HS code
        const rate = this.extractRateNearHsCode(content, hsCode)
        
        if (rate !== null) {
          rates.push({
            hsCode,
            productDescription,
            currentRate: rate,
            documentNumber: document.document_number,
            effectiveDate: document.effective_on || document.publication_date,
            isSignificant: true, // Will be calculated based on comparison
            source: 'document-parsing'
          })
        }
      }
    }

    // Look for Section 232 steel tariffs (affects all Preston's codes)
    if (contentLower.includes('section 232') && contentLower.includes('steel')) {
      const section232Rate = this.extractSection232Rate(content)
      
      if (section232Rate !== null) {
        // Apply to all steel-related HS codes
        Object.entries(PRESTON_HS_CODES).forEach(([hsCode, productDescription]) => {
          rates.push({
            hsCode,
            productDescription: `${productDescription} (Section 232)`,
            currentRate: section232Rate,
            documentNumber: document.document_number,
            effectiveDate: document.effective_on || document.publication_date,
            isSignificant: true,
            source: 'document-parsing'
          })
        })
      }
    }

    return rates
  }

  /**
   * Extract tariff rate from text near HS code mention
   */
  private extractRateNearHsCode(content: string, hsCode: string): number | null {
    const hsIndex = content.toLowerCase().indexOf(hsCode.toLowerCase())
    if (hsIndex === -1) {return null}

    // Look for rate patterns within 500 characters of HS code mention
    const contextStart = Math.max(0, hsIndex - 250)
    const contextEnd = Math.min(content.length, hsIndex + 250)
    const context = content.substring(contextStart, contextEnd)

    // Common rate patterns: "25%", "25 percent", "25.5%", etc.
    const ratePatterns = [
      /(\d+\.?\d*)\s*(?:percent|%)/gi,
      /rate of (\d+\.?\d*)/gi,
      /(\d+\.?\d*)\s*ad valorem/gi,
    ]

    for (const pattern of ratePatterns) {
      const match = pattern.exec(context)
      if (match) {
        const rate = parseFloat(match[1] || '0')
        if (rate >= 0 && rate <= 1000) { // Sanity check
          return rate
        }
      }
    }

    return null
  }

  /**
   * Extract Section 232 tariff rate
   */
  private extractSection232Rate(content: string): number | null {
    const section232Patterns = [
      /section 232.*?(\d+\.?\d*)\s*(?:percent|%)/gi,
      /steel.*?tariff.*?(\d+\.?\d*)\s*(?:percent|%)/gi,
      /additional duty.*?(\d+\.?\d*)\s*(?:percent|%)/gi,
    ]

    for (const pattern of section232Patterns) {
      const match = pattern.exec(content)
      if (match) {
        const rate = parseFloat(match[1] || '0')
        if (rate >= 0 && rate <= 100) { // Section 232 rates typically 25-50%
          return rate
        }
      }
    }

    return null
  }

  /**
   * Monitor for tariff changes affecting Preston's business
   */
  async monitorTariffChanges(options: {
    daysBack?: number
    baselineRates?: { [hsCode: string]: number }
    changeThreshold?: number
  } = {}): Promise<MonitoringResult> {
    const { daysBack = 7, baselineRates = {}, changeThreshold = 1.0 } = options
    
    const result: MonitoringResult = {
      success: false,
      timestamp: new Date().toISOString(),
      documentsScanned: 0,
      rateChangesFound: [],
      significantChanges: [],
      errors: []
    }

    try {
      // Search for recent tariff documents
      const searchResult = await this.searchTariffDocuments({ daysBack })
      result.documentsScanned = searchResult.results.length

      // Process each document for rate information
      for (const document of searchResult.results) {
        try {
          const rates = await this.extractTariffRates(document)
          result.rateChangesFound.push(...rates)

          // Calculate significance and container impact
          for (const rate of rates) {
            const baselineRate = baselineRates[rate.hsCode] || 0
            
            if (baselineRate > 0 && rate.currentRate !== baselineRate) {
              rate.changePercent = ((rate.currentRate - baselineRate) / baselineRate) * 100
              rate.isSignificant = Math.abs(rate.changePercent) >= changeThreshold
              
              if (rate.isSignificant) {
                rate.containerImpact = this.calculateContainerImpact(rate.changePercent)
                result.significantChanges.push(rate)
              }
            }
          }
          
        } catch (error) {
          result.errors.push(`Failed to process document ${document.document_number}: ${error}`)
        }
      }

      result.success = true
      result.nextCheckRecommended = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString() // 6 hours

    } catch (error) {
      result.errors.push(`Monitoring failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    return result
  }

  /**
   * Calculate container cost impact for Preston's business
   */
  private calculateContainerImpact(changePercent: number): number {
    // Preston's typical container values: $40k-$75k
    const averageContainerValue = 57500 // Average of $40k-$75k
    const averageDutyRate = 0.25 // Assuming 25% baseline (Section 232 steel)
    const baseDutyCost = averageContainerValue * averageDutyRate
    
    return Math.round(baseDutyCost * (changePercent / 100))
  }
}

/**
 * Default instance for easy importing
 */
export const federalRegisterClient = new FederalRegisterClient()

/**
 * Helper function to test API connectivity
 */
export async function testFederalRegisterAPI(): Promise<{
  success: boolean
  message: string
  details?: any
}> {
  try {
    const client = new FederalRegisterClient()
    
    // Test basic search functionality
    const result = await client.searchDocuments({
      term: 'tariff',
      perPage: 1
    })
    
    return {
      success: true,
      message: 'Federal Register API is accessible and responding',
      details: {
        totalDocuments: result.count,
        apiVersion: 'v1',
        lastChecked: new Date().toISOString()
      }
    }
    
  } catch (error) {
    return {
      success: false,
      message: 'Federal Register API test failed',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
        lastChecked: new Date().toISOString()
      }
    }
  }
}