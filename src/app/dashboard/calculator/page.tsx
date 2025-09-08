'use client'

import { useState, useEffect } from 'react'
import { createClientSupabaseClient, type Workspace } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { 
  DocumentArrowUpIcon, 
  PlusIcon, 
  TrashIcon, 
  CalculatorIcon,
  ArrowDownTrayIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'

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
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle')
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
    if (!hsCode || hsCode.length < 4) return

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
        if (!item.hsCode || !item.value) continue

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

  // Save calculation to database
  const saveCalculation = async () => {
    if (!workspace || !result) return

    setSaving(true)
    
    try {
      const { error } = await supabase
        .from('calculations')
        .insert({
          workspace_id: workspace.id,
          name: calculationName || 'Import Duty Calculation',
          line_items: result.lineItems,
          total_value: result.totalValue,
          total_duty: result.totalDuty
        })

      if (error) throw error

      // Show success message
      alert('Calculation saved successfully!')
    } catch (error) {
      console.error('Save error:', error)
      alert('Failed to save calculation')
    } finally {
      setSaving(false)
    }
  }

  // Handle file upload
  const handleFileUpload = async (file: File) => {
    setUploadedFile(file)
    setUploadStatus('processing')
    setUploadError(null)

    // Simulate file processing (will implement actual OCR/PDF parsing later)
    setTimeout(() => {
      // Mock extraction results
      const mockItems: LineItem[] = [
        {
          id: '1',
          hsCode: '8517.12',
          description: 'Smartphones',
          value: 15000,
          quantity: 100,
          unit: 'units',
          rate: 7.5,
          duty: 1125
        },
        {
          id: '2',
          hsCode: '6109.10',
          description: 'Cotton T-shirts',
          value: 5000,
          quantity: 500,
          unit: 'pieces',
          rate: 16.5,
          duty: 825
        }
      ]

      setLineItems(mockItems)
      setUploadStatus('success')
      
      // Auto-calculate
      calculateDuties()
    }, 2000)
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
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
              <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                <CalculatorIcon className="w-6 h-6 mr-2 text-blue-600" />
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
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'manual'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Manual Entry
              </button>
              <button
                onClick={() => setActiveTab('upload')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Input Section */}
          <div className="lg:col-span-2">
            {activeTab === 'manual' && (
              <div className="bg-white rounded-lg shadow-sm border">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-medium text-gray-900">Line Items</h2>
                    <button
                      onClick={addLineItem}
                      className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      <PlusIcon className="w-4 h-4 mr-1" />
                      Add Item
                    </button>
                  </div>

                  <div className="space-y-4">
                    {lineItems.map((item, index) => (
                      <div key={item.id} className="grid grid-cols-1 gap-4 p-4 border border-gray-200 rounded-lg">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-700">Item #{index + 1}</span>
                          {lineItems.length > 1 && (
                            <button
                              onClick={() => removeLineItem(item.id)}
                              className="text-red-600 hover:text-red-800"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              HS Code *
                            </label>
                            <input
                              type="text"
                              value={item.hsCode}
                              onChange={(e) => updateLineItem(item.id, 'hsCode', e.target.value)}
                              onBlur={() => fetchTariffRate(item.hsCode, item.id)}
                              placeholder="e.g., 8517.12"
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Description
                            </label>
                            <input
                              type="text"
                              value={item.description}
                              onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                              placeholder="Product description"
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Value (USD) *
                            </label>
                            <input
                              type="number"
                              value={item.value || ''}
                              onChange={(e) => updateLineItem(item.id, 'value', parseFloat(e.target.value) || 0)}
                              placeholder="0.00"
                              min="0"
                              step="0.01"
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Quantity
                              </label>
                              <input
                                type="number"
                                value={item.quantity || ''}
                                onChange={(e) => updateLineItem(item.id, 'quantity', parseFloat(e.target.value) || 1)}
                                placeholder="1"
                                min="1"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Unit
                              </label>
                              <select
                                value={item.unit}
                                onChange={(e) => updateLineItem(item.id, 'unit', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                        <div className="mt-2 p-3 bg-gray-50 rounded-md">
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-600">Current Tariff Rate:</span>
                            <span className={`font-medium ${item.rate !== null ? 'text-gray-900' : 'text-gray-400'}`}>
                              {item.rate !== null ? `${item.rate}%` : 'Enter HS Code'}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-sm mt-1">
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
                      className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      {calculating ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Calculating...
                        </>
                      ) : (
                        <>
                          <CalculatorIcon className="w-5 h-5 mr-2" />
                          Calculate Duties
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'upload' && (
              <div className="bg-white rounded-lg shadow-sm border">
                <div className="p-6">
                  <h2 className="text-lg font-medium text-gray-900 mb-6">Upload Documents</h2>

                  {/* Upload Area */}
                  <div
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                      dragActive
                        ? 'border-blue-400 bg-blue-50'
                        : uploadStatus === 'success'
                        ? 'border-green-400 bg-green-50'
                        : uploadStatus === 'error'
                        ? 'border-red-400 bg-red-50'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    {uploadStatus === 'processing' ? (
                      <div className="flex flex-col items-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
                        <p className="text-sm text-gray-600">Processing document...</p>
                      </div>
                    ) : uploadStatus === 'success' ? (
                      <div className="flex flex-col items-center">
                        <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mb-4">
                          <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <p className="text-sm text-green-600 font-medium">Document processed successfully!</p>
                        <p className="text-xs text-gray-500 mt-1">Line items extracted and populated below</p>
                      </div>
                    ) : uploadStatus === 'error' ? (
                      <div className="flex flex-col items-center">
                        <ExclamationTriangleIcon className="w-8 h-8 text-red-600 mb-4" />
                        <p className="text-sm text-red-600 font-medium">Processing failed</p>
                        <p className="text-xs text-gray-500 mt-1">{uploadError}</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center">
                        <DocumentArrowUpIcon className="w-12 h-12 text-gray-400 mb-4" />
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
                          className="mt-4 inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 cursor-pointer"
                        >
                          Select File
                        </label>
                      </div>
                    )}
                  </div>

                  {uploadedFile && (
                    <div className="mt-4 p-3 bg-gray-50 rounded-md">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <DocumentArrowUpIcon className="w-5 h-5 text-gray-400 mr-2" />
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
            <div className="bg-white rounded-lg shadow-sm border sticky top-4">
              <div className="p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-6">Calculation Results</h2>

                {result ? (
                  <div className="space-y-6">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 gap-4">
                      <div className="p-4 bg-blue-50 rounded-lg">
                        <div className="text-sm text-blue-600 font-medium">Total Value</div>
                        <div className="text-2xl font-bold text-blue-900">
                          ${result.totalValue.toLocaleString()}
                        </div>
                      </div>

                      <div className="p-4 bg-green-50 rounded-lg">
                        <div className="text-sm text-green-600 font-medium">Total Duty</div>
                        <div className="text-2xl font-bold text-green-900">
                          ${result.totalDuty.toLocaleString()}
                        </div>
                      </div>

                      <div className="p-4 bg-indigo-50 rounded-lg">
                        <div className="text-sm text-indigo-600 font-medium">Effective Rate</div>
                        <div className="text-2xl font-bold text-indigo-900">
                          {result.effectiveRate.toFixed(2)}%
                        </div>
                      </div>
                    </div>

                    {/* Item Breakdown */}
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 mb-3">Item Breakdown</h3>
                      <div className="space-y-2">
                        {result.lineItems.map((item, index) => (
                          <div key={item.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
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
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Calculation Name
                        </label>
                        <input
                          type="text"
                          value={calculationName}
                          onChange={(e) => setCalculationName(e.target.value)}
                          placeholder="Enter a name for this calculation"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                        />
                      </div>

                      <button
                        onClick={saveCalculation}
                        disabled={saving}
                        className="w-full flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                      >
                        {saving ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
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
                        className="w-full flex justify-center items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        <ArrowDownTrayIcon className="w-4 h-4 mr-2" />
                        Export CSV
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <CalculatorIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
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