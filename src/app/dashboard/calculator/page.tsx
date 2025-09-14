'use client'

import { 
  DocumentArrowUpIcon, 
  PlusIcon, 
  TrashIcon, 
  CalculatorIcon,
  ArrowDownTrayIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'

import { createClientSupabaseClient, type Workspace } from '@/lib/supabase'

interface LineItem {
  id: string
  hsCode: string
  description: string
  value: number
  quantity: number
  unit: string
  rate: number | null
  duty: number
}

interface CalculationResult {
  lineItems: LineItem[]
  totalValue: number
  totalDuty: number
  effectiveRate: number
}

export default function CalculatorPage() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [loading, setLoading] = useState(true)
  const [calculating, setCalculating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'manual' | 'upload'>('manual')
  
  // Manual entry state
  const [lineItems, setLineItems] = useState<LineItem[]>([
    {
      id: '1',
      hsCode: '',
      description: '',
      value: 0,
      quantity: 1,
      unit: 'units',
      rate: null,
      duty: 0
    }
  ])
  
  // Results state
  const [result, setResult] = useState<CalculationResult | null>(null)
  const [calculationName, setCalculationName] = useState('')
  
  // Upload state
  const [dragActive, setDragActive] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'processing' | 'success' | 'error' | 'no-data'>('idle')
  const [uploadError, setUploadError] = useState<string | null>(null)

  const router = useRouter()
  const supabase = createClientSupabaseClient()

  // Authentication and workspace check
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        
        if (!session) {
          router.push('/login')
          return
        }

        // User authenticated

        // Get user's workspace
        const { data: workspaceData, error } = await supabase
          .from('workspaces')
          .select('*')
          .eq('user_id', session.user.id)
          .single()

        if (error || !workspaceData) {
          router.push('/setup')
          return
        }

        setWorkspace(workspaceData)
      } catch (error) {
        console.error('Auth check error:', error)
        router.push('/login')
      } finally {
        setLoading(false)
      }
    }

    checkAuth()
  }, [router, supabase])

  // Add new line item
  const addLineItem = () => {
    const newItem: LineItem = {
      id: Date.now().toString(),
      hsCode: '',
      description: '',
      value: 0,
      quantity: 1,
      unit: 'units',
      rate: null,
      duty: 0
    }
    setLineItems([...lineItems, newItem])
  }

  // Remove line item
  const removeLineItem = (id: string) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter(item => item.id !== id))
    }
  }

  // Update line item
  const updateLineItem = (id: string, field: keyof LineItem, value: any) => {
    setLineItems(items =>
      items.map(item =>
        item.id === id ? { ...item, [field]: value } : item
      )
    )
  }

  // Fetch tariff rate for HS code
  const fetchTariffRate = async (hsCode: string, itemId: string) => {
    if (!hsCode || hsCode.length < 4) {return}

    try {
      const response = await fetch(`/api/tariff-rates/current?hs_code=${hsCode}`)
      const data = await response.json()

      if (data.success && data.rate !== null) {
        updateLineItem(itemId, 'rate', data.rate)
        // Recalculate duty for this item
        const item = lineItems.find(i => i.id === itemId)
        if (item) {
          const duty = (item.value * data.rate) / 100
          updateLineItem(itemId, 'duty', duty)
        }
      } else {
        updateLineItem(itemId, 'rate', null)
        updateLineItem(itemId, 'duty', 0)
      }
    } catch (error) {
      console.error('Error fetching tariff rate:', error)
    }
  }

  // Calculate duties for all items
  const calculateDuties = async () => {
    setCalculating(true)
    
    try {
      const updatedItems = [...lineItems]
      let totalValue = 0
      let totalDuty = 0

      for (const item of updatedItems) {
        if (!item.hsCode || !item.value) {continue}

        // Fetch rate if not already available
        if (item.rate === null) {
          const response = await fetch(`/api/tariff-rates/current?hs_code=${item.hsCode}`)
          const data = await response.json()
          
          if (data.success && data.rate !== null) {
            item.rate = data.rate
          }
        }

        // Calculate duty
        if (item.rate !== null) {
          item.duty = (item.value * item.rate) / 100
        }

        totalValue += item.value
        totalDuty += item.duty
      }

      const effectiveRate = totalValue > 0 ? (totalDuty / totalValue) * 100 : 0

      setLineItems(updatedItems)
      setResult({
        lineItems: updatedItems,
        totalValue,
        totalDuty,
        effectiveRate
      })
    } catch (error) {
      console.error('Calculation error:', error)
    } finally {
      setCalculating(false)
    }
  }

  // Save calculation to database with usage tracking
  const saveCalculation = async () => {
    if (!workspace || !result) {return}

    setSaving(true)
    
    try {
      const response = await fetch('/api/calculations/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: workspace.id,
          name: calculationName || 'Import Duty Calculation',
          lineItems: result.lineItems,
          totalValue: result.totalValue,
          totalDuty: result.totalDuty,
          effectiveRate: result.effectiveRate,
          metadata: {
            source: activeTab === 'upload' ? 'document_upload' : 'manual_entry',
            itemCount: result.lineItems.length
          }
        })
      })

      const data = await response.json()

      if (!response.ok) {
        if (data.limitExceeded) {
          alert(`Usage limit exceeded: ${data.message}\n\nPlease upgrade your plan to continue.`)
        } else {
          throw new Error(data.error || 'Failed to save calculation')
        }
        return
      }

      // Show success message
      alert('Calculation saved successfully!')
      
      // Optionally redirect to billing if approaching limits
      if (data.shouldUpgrade) {
        setTimeout(() => {
          if (confirm('You\'re approaching your monthly limit. Would you like to view upgrade options?')) {
            window.location.href = '/dashboard/billing'
          }
        }, 1000)
      }
    } catch (error) {
      console.error('Save error:', error)
      alert('Failed to save calculation: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setSaving(false)
    }
  }

  // Handle file upload with real OCR processing
  const handleFileUpload = async (file: File) => {
    setUploadedFile(file)
    setUploadStatus('processing')
    setUploadError(null)

    try {
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf']
      if (!allowedTypes.includes(file.type)) {
        throw new Error(`Unsupported file type: ${file.type}`)
      }

      // Validate file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        throw new Error('File too large. Maximum size is 10MB.')
      }

      console.log(`📄 Processing document: ${file.name} (${Math.round(file.size / 1024)}KB)`)

      // Create form data for upload
      const formData = new FormData()
      formData.append('document', file)

      // Send to OCR processing API
      const response = await fetch('/api/documents/process', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Document processing failed')
      }

      console.log(`✅ OCR completed: ${result.lineItems.length} line items extracted`)

      // Convert OCR results to line items
      const extractedItems: LineItem[] = await Promise.all(
        result.lineItems.map(async (ocrItem: any, index: number) => {
          const lineItem: LineItem = {
            id: `ocr-${index + 1}`,
            description: ocrItem.description || 'Unknown item',
            value: ocrItem.value || 0,
            quantity: ocrItem.quantity || 1,
            unit: ocrItem.unit || 'units',
            hsCode: ocrItem.hsCode || '',
            rate: null,
            duty: 0
          }

          // Fetch tariff rate if HS code was detected
          if (lineItem.hsCode) {
            try {
              const rateResponse = await fetch(`/api/tariff-rates/current?hs_code=${lineItem.hsCode}`)
              const rateData = await rateResponse.json()
              if (rateData.success && rateData.rate !== null) {
                lineItem.rate = rateData.rate
                lineItem.duty = (lineItem.value * rateData.rate) / 100
              }
            } catch (error) {
              console.warn(`Failed to fetch rate for HS code ${lineItem.hsCode}:`, error)
            }
          }

          return lineItem
        })
      )

      if (extractedItems.length > 0) {
        setLineItems(extractedItems)
        setUploadStatus('success')
        calculateDuties()
        
        // Show success message with extraction details
        console.log(`📊 Successfully extracted ${extractedItems.length} line items with ${result.confidence.toFixed(1)}% confidence`)
      } else {
        setUploadStatus('no-data')
        setUploadError('No line items could be extracted from the document. Try manual entry instead.')
      }

    } catch (error) {
      console.error('❌ Document processing failed:', error)
      setUploadStatus('error')
      setUploadError(error instanceof Error ? error.message : 'Document processing failed')
    }
  }

  // Drag and drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0])
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="size-8 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="flex items-center text-2xl font-bold text-gray-900">
                <CalculatorIcon className="mr-2 size-6 text-blue-600" />
                Import Duty Calculator
              </h1>
              <p className="text-gray-600">Calculate duties and taxes for your imports</p>
            </div>
            <button
              onClick={() => router.push('/dashboard')}
              className="text-gray-600 hover:text-gray-900"
            >
              ← Back to Dashboard
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8">
        {/* Input Method Tabs */}
        <div className="mb-8">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('manual')}
                className={`border-b-2 px-1 py-2 text-sm font-medium ${
                  activeTab === 'manual'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Manual Entry
              </button>
              <button
                onClick={() => setActiveTab('upload')}
                className={`border-b-2 px-1 py-2 text-sm font-medium ${
                  activeTab === 'upload'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Document Upload
              </button>
            </nav>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Input Section */}
          <div className="lg:col-span-2">
            {activeTab === 'manual' && (
              <div className="rounded-lg border bg-white shadow-sm">
                <div className="p-6">
                  <div className="mb-6 flex items-center justify-between">
                    <h2 className="text-lg font-medium text-gray-900">Line Items</h2>
                    <button
                      onClick={addLineItem}
                      className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium leading-4 text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    >
                      <PlusIcon className="mr-1 size-4" />
                      Add Item
                    </button>
                  </div>

                  <div className="space-y-4">
                    {lineItems.map((item, index) => (
                      <div key={item.id} className="grid grid-cols-1 gap-4 rounded-lg border border-gray-200 p-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-700">Item #{index + 1}</span>
                          {lineItems.length > 1 && (
                            <button
                              onClick={() => removeLineItem(item.id)}
                              className="text-red-600 hover:text-red-800"
                            >
                              <TrashIcon className="size-4" />
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                          <div>
                            <label className="mb-1 block text-sm font-medium text-gray-700">
                              HS Code *
                            </label>
                            <input
                              type="text"
                              value={item.hsCode}
                              onChange={(e) => updateLineItem(item.id, 'hsCode', e.target.value)}
                              onBlur={() => fetchTariffRate(item.hsCode, item.id)}
                              placeholder="e.g., 8517.12"
                              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                            />
                          </div>

                          <div>
                            <label className="mb-1 block text-sm font-medium text-gray-700">
                              Description
                            </label>
                            <input
                              type="text"
                              value={item.description}
                              onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                              placeholder="Product description"
                              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                            />
                          </div>

                          <div>
                            <label className="mb-1 block text-sm font-medium text-gray-700">
                              Value (USD) *
                            </label>
                            <input
                              type="number"
                              value={item.value || ''}
                              onChange={(e) => updateLineItem(item.id, 'value', parseFloat(e.target.value) || 0)}
                              placeholder="0.00"
                              min="0"
                              step="0.01"
                              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="mb-1 block text-sm font-medium text-gray-700">
                                Quantity
                              </label>
                              <input
                                type="number"
                                value={item.quantity || ''}
                                onChange={(e) => updateLineItem(item.id, 'quantity', parseFloat(e.target.value) || 1)}
                                placeholder="1"
                                min="1"
                                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-sm font-medium text-gray-700">
                                Unit
                              </label>
                              <select
                                value={item.unit}
                                onChange={(e) => updateLineItem(item.id, 'unit', e.target.value)}
                                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                              >
                                <option value="units">Units</option>
                                <option value="kg">Kilograms</option>
                                <option value="lbs">Pounds</option>
                                <option value="pieces">Pieces</option>
                                <option value="pairs">Pairs</option>
                                <option value="dozens">Dozens</option>
                              </select>
                            </div>
                          </div>
                        </div>

                        {/* Rate Display */}
                        <div className="mt-2 rounded-md bg-gray-50 p-3">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">Current Tariff Rate:</span>
                            <span className={`font-medium ${item.rate !== null ? 'text-gray-900' : 'text-gray-400'}`}>
                              {item.rate !== null ? `${item.rate}%` : 'Enter HS Code'}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center justify-between text-sm">
                            <span className="text-gray-600">Calculated Duty:</span>
                            <span className="font-medium text-gray-900">
                              ${item.duty.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 flex justify-center">
                    <button
                      onClick={calculateDuties}
                      disabled={calculating}
                      className="inline-flex items-center rounded-md border border-transparent bg-blue-600 px-6 py-3 text-base font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                    >
                      {calculating ? (
                        <>
                          <div className="mr-2 size-4 animate-spin rounded-full border-b-2 border-white" />
                          Calculating...
                        </>
                      ) : (
                        <>
                          <CalculatorIcon className="mr-2 size-5" />
                          Calculate Duties
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'upload' && (
              <div className="rounded-lg border bg-white shadow-sm">
                <div className="p-6">
                  <h2 className="mb-6 text-lg font-medium text-gray-900">Upload Documents</h2>

                  {/* Upload Area */}
                  <div
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    className={`rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
                      dragActive
                        ? 'border-blue-400 bg-blue-50'
                        : uploadStatus === 'success'
                        ? 'border-green-400 bg-green-50'
                        : uploadStatus === 'error' || uploadStatus === 'no-data'
                        ? 'border-red-400 bg-red-50'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    {uploadStatus === 'processing' ? (
                      <div className="flex flex-col items-center">
                        <div className="mb-4 size-8 animate-spin rounded-full border-b-2 border-blue-600" />
                        <p className="text-sm text-gray-600">Processing document...</p>
                      </div>
                    ) : uploadStatus === 'success' ? (
                      <div className="flex flex-col items-center">
                        <div className="mb-4 flex size-8 items-center justify-center rounded-full bg-green-100">
                          <svg className="size-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <p className="text-sm font-medium text-green-600">Document processed successfully!</p>
                        <p className="mt-1 text-xs text-gray-500">Line items extracted and populated below</p>
                      </div>
                    ) : uploadStatus === 'error' ? (
                      <div className="flex flex-col items-center">
                        <ExclamationTriangleIcon className="mb-4 size-8 text-red-600" />
                        <p className="text-sm font-medium text-red-600">Processing failed</p>
                        <p className="mt-1 text-xs text-gray-500">{uploadError}</p>
                      </div>
                    ) : uploadStatus === 'no-data' ? (
                      <div className="flex flex-col items-center">
                        <InformationCircleIcon className="mb-4 size-8 text-yellow-600" />
                        <p className="text-sm font-medium text-yellow-600">No line items found</p>
                        <p className="mt-1 text-xs text-gray-500">{uploadError}</p>
                        <p className="mt-2 text-xs text-gray-500">Try a clearer image or use manual entry</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center">
                        <DocumentArrowUpIcon className="mb-4 size-12 text-gray-400" />
                        <div className="space-y-2">
                          <p className="text-sm text-gray-600">
                            Drop your invoice, packing list, or commercial document here
                          </p>
                          <p className="text-xs text-gray-500">
                            Supports PDF, PNG, JPG, Excel formats
                          </p>
                        </div>
                        <input
                          type="file"
                          accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls"
                          onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                          className="hidden"
                          id="file-upload"
                        />
                        <label
                          htmlFor="file-upload"
                          className="mt-4 inline-flex cursor-pointer items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                        >
                          Select File
                        </label>
                      </div>
                    )}
                  </div>

                  {uploadedFile && (
                    <div className="mt-4 rounded-md bg-gray-50 p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <DocumentArrowUpIcon className="mr-2 size-5 text-gray-400" />
                          <span className="text-sm text-gray-700">{uploadedFile.name}</span>
                        </div>
                        <span className="text-xs text-gray-500">
                          {(uploadedFile.size / 1024).toFixed(1)} KB
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Results Section */}
          <div className="lg:col-span-1">
            <div className="sticky top-4 rounded-lg border bg-white shadow-sm">
              <div className="p-6">
                <h2 className="mb-6 text-lg font-medium text-gray-900">Calculation Results</h2>

                {result ? (
                  <div className="space-y-6">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 gap-4">
                      <div className="rounded-lg bg-blue-50 p-4">
                        <div className="text-sm font-medium text-blue-600">Total Value</div>
                        <div className="text-2xl font-bold text-blue-900">
                          ${result.totalValue.toLocaleString()}
                        </div>
                      </div>

                      <div className="rounded-lg bg-green-50 p-4">
                        <div className="text-sm font-medium text-green-600">Total Duty</div>
                        <div className="text-2xl font-bold text-green-900">
                          ${result.totalDuty.toLocaleString()}
                        </div>
                      </div>

                      <div className="rounded-lg bg-indigo-50 p-4">
                        <div className="text-sm font-medium text-indigo-600">Effective Rate</div>
                        <div className="text-2xl font-bold text-indigo-900">
                          {result.effectiveRate.toFixed(2)}%
                        </div>
                      </div>
                    </div>

                    {/* Item Breakdown */}
                    <div>
                      <h3 className="mb-3 text-sm font-medium text-gray-700">Item Breakdown</h3>
                      <div className="space-y-2">
                        {result.lineItems.map((item, index) => (
                          <div key={item.id} className="flex items-center justify-between rounded bg-gray-50 p-2">
                            <div className="text-sm">
                              <div className="font-medium text-gray-900">Item #{index + 1}</div>
                              <div className="text-gray-600">{item.hsCode}</div>
                            </div>
                            <div className="text-right text-sm">
                              <div className="font-medium text-gray-900">${item.duty.toFixed(2)}</div>
                              <div className="text-gray-600">{item.rate}%</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="space-y-3">
                      <div>
                        <label className="mb-2 block text-sm font-medium text-gray-700">
                          Calculation Name
                        </label>
                        <input
                          type="text"
                          value={calculationName}
                          onChange={(e) => setCalculationName(e.target.value)}
                          placeholder="Enter a name for this calculation"
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <button
                        onClick={saveCalculation}
                        disabled={saving}
                        className="flex w-full items-center justify-center rounded-md border border-transparent bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50"
                      >
                        {saving ? (
                          <>
                            <div className="mr-2 size-4 animate-spin rounded-full border-b-2 border-white" />
                            Saving...
                          </>
                        ) : (
                          'Save Calculation'
                        )}
                      </button>

                      <button
                        onClick={() => {
                          // Export functionality - will implement CSV/PDF export
                          const csvContent = result.lineItems.map((item, i) => 
                            `Item ${i+1},${item.hsCode},${item.description},${item.value},${item.rate}%,${item.duty}`
                          ).join('\n')
                          
                          const blob = new Blob([`Item,HS Code,Description,Value,Rate,Duty\n${csvContent}`], { type: 'text/csv' })
                          const url = window.URL.createObjectURL(blob)
                          const a = document.createElement('a')
                          a.href = url
                          a.download = 'duty-calculation.csv'
                          a.click()
                        }}
                        className="flex w-full items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                      >
                        <ArrowDownTrayIcon className="mr-2 size-4" />
                        Export CSV
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="py-8 text-center">
                    <CalculatorIcon className="mx-auto mb-4 size-12 text-gray-300" />
                    <p className="text-gray-500">
                      Enter line items and calculate duties to see results
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}