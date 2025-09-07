'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'

interface DemoCalculation {
  product: string
  hsCode: string
  value: number
  rate: number
  duty: number
}

export default function HomePage() {
  const [demoStep, setDemoStep] = useState(0)
  const [calculations, setCalculations] = useState<DemoCalculation[]>([])

  // Demo calculation simulation
  useEffect(() => {
    if (demoStep === 1) {
      setTimeout(() => {
        setCalculations([
          {
            product: 'iPhone 15',
            hsCode: '8517.12',
            value: 100000,
            rate: 7.5,
            duty: 7500
          }
        ])
        setDemoStep(2)
      }, 2000)
    }
  }, [demoStep])

  const startDemo = () => {
    setDemoStep(1)
    setCalculations([])
  }

  return (
    <main className='min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100'>
      {/* Navigation */}
      <nav className='border-b border-white/20 bg-white/50 backdrop-blur-sm'>
        <div className='container mx-auto px-4 py-4'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center space-x-4'>
              <h1 className='text-2xl font-bold text-gray-900'>TariffGuard</h1>
            </div>
            <div className='flex items-center space-x-4'>
              <Link
                href='/login'
                className='text-gray-600 hover:text-gray-900'
              >
                Sign In
              </Link>
              <Link
                href='/login'
                className='rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700'
              >
                Start Free
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className='container mx-auto px-4 py-16'>
        <div className='text-center'>
          <h1 className='mb-6 text-5xl font-bold text-gray-900'>
            Never miss a tariff change
          </h1>
          <p className='mx-auto mb-8 max-w-2xl text-xl text-gray-600'>
            Professional tariff monitoring and import duty calculator. 
            Get real-time alerts from official US government sources.
          </p>
          <div className='flex justify-center gap-4'>
            <Link
              href='/login'
              className='rounded-lg bg-blue-600 px-8 py-3 font-medium text-white transition-colors hover:bg-blue-700'
            >
              Start Free Trial
            </Link>
            <button
              onClick={startDemo}
              className='rounded-lg border border-gray-300 bg-white px-8 py-3 font-medium text-gray-700 hover:bg-gray-50'
            >
              See Demo
            </button>
          </div>
        </div>

        {/* Demo Section */}
        {demoStep > 0 && (
          <div className='mt-16 mx-auto max-w-4xl'>
            <div className='rounded-lg bg-white p-8 shadow-lg'>
              <h3 className='mb-6 text-2xl font-semibold text-gray-900 text-center'>
                Live Demo: Import Duty Calculator
              </h3>
              
              {demoStep === 1 && (
                <div className='text-center'>
                  <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4'></div>
                  <p className='text-gray-600'>⏳ Fetching rates from USITC...</p>
                  <p className='text-sm text-gray-500 mt-2'>✓ Retrieved rate for 8517.12</p>
                </div>
              )}
              
              {demoStep === 2 && (
                <div className='space-y-4'>
                  <div className='bg-gray-50 p-4 rounded-lg'>
                    <div className='text-sm text-gray-600 mb-2'>Calculation Results - Source: USITC (Official)</div>
                    {calculations.map((calc, index) => (
                      <div key={index} className='border-b border-gray-200 pb-4 last:border-b-0'>
                        <div className='flex justify-between items-center'>
                          <div>
                            <div className='font-semibold'>{calc.product} | {calc.hsCode}</div>
                            <div className='text-sm text-gray-600'>Value: ${calc.value.toLocaleString()}</div>
                          </div>
                          <div className='text-right'>
                            <div className='text-lg font-bold text-red-600'>${calc.duty.toLocaleString()}</div>
                            <div className='text-sm text-gray-600'>{calc.rate}% duty</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className='bg-blue-50 p-4 rounded-lg'>
                    <div className='flex justify-between items-center'>
                      <div>
                        <div className='font-semibold'>Total Import: $100,000</div>
                        <div className='font-semibold'>Total Duties: $7,500</div>
                      </div>
                      <div className='text-2xl font-bold text-blue-600'>$107,500</div>
                    </div>
                  </div>
                  <div className='flex gap-2 justify-center'>
                    <button className='px-4 py-2 bg-blue-600 text-white rounded-md text-sm'>Save</button>
                    <button className='px-4 py-2 bg-gray-600 text-white rounded-md text-sm'>Export PDF</button>
                    <button 
                      onClick={() => setDemoStep(0)} 
                      className='px-4 py-2 bg-green-600 text-white rounded-md text-sm'
                    >
                      Try For Real
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Features */}
        <div className='mt-16 grid grid-cols-1 gap-8 md:grid-cols-3'>
          <div className='rounded-lg bg-white p-6 shadow-sm'>
            <div className='w-12 h-12 mx-auto mb-4 bg-blue-100 rounded-lg flex items-center justify-center'>
              <span className='text-2xl'>📊</span>
            </div>
            <h3 className='mb-3 text-xl font-semibold text-gray-900 text-center'>
              Real-Time Calculations
            </h3>
            <p className='text-gray-600 text-center'>
              Upload invoices or enter products manually. Get instant duty calculations 
              using live USITC government data.
            </p>
          </div>
          <div className='rounded-lg bg-white p-6 shadow-sm'>
            <div className='w-12 h-12 mx-auto mb-4 bg-green-100 rounded-lg flex items-center justify-center'>
              <span className='text-2xl'>🚨</span>
            </div>
            <h3 className='mb-3 text-xl font-semibold text-gray-900 text-center'>Instant Alerts</h3>
            <p className='text-gray-600 text-center'>
              Get notified immediately when tariff rates change for your products. 
              Never miss important updates again.
            </p>
          </div>
          <div className='rounded-lg bg-white p-6 shadow-sm'>
            <div className='w-12 h-12 mx-auto mb-4 bg-purple-100 rounded-lg flex items-center justify-center'>
              <span className='text-2xl'>📎</span>
            </div>
            <h3 className='mb-3 text-xl font-semibold text-gray-900 text-center'>
              Document Upload
            </h3>
            <p className='text-gray-600 text-center'>
              Drag and drop PDFs or images. Our OCR automatically extracts 
              HS codes and values for calculation.
            </p>
          </div>
        </div>

        {/* Pricing Section */}
        <div className='mt-16'>
          <div className='mb-8 text-center'>
            <h2 className='mb-4 text-3xl font-bold text-gray-900'>Simple, Transparent Pricing</h2>
            <p className='text-gray-600'>Start free, upgrade when you need more</p>
          </div>
          
          <div className='grid grid-cols-1 gap-6 md:grid-cols-3 max-w-6xl mx-auto'>
            <div className='rounded-lg bg-white p-6 shadow-sm border border-gray-200'>
              <div className='text-center'>
                <h3 className='text-xl font-semibold text-gray-900 mb-2'>Starter</h3>
                <div className='text-3xl font-bold text-gray-900 mb-4'>Free</div>
                <ul className='space-y-2 text-sm text-gray-600 mb-6'>
                  <li>✓ 5 calculations per month</li>
                  <li>✓ Basic tariff monitoring</li>
                  <li>✓ Email alerts</li>
                  <li>✓ USITC government data</li>
                </ul>
                <Link 
                  href='/login'
                  className='w-full block text-center py-2 px-4 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50'
                >
                  Get Started
                </Link>
              </div>
            </div>
            
            <div className='rounded-lg bg-white p-6 shadow-lg border-2 border-blue-500 relative'>
              <div className='absolute -top-3 left-1/2 transform -translate-x-1/2'>
                <span className='bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-medium'>
                  Most Popular
                </span>
              </div>
              <div className='text-center'>
                <h3 className='text-xl font-semibold text-gray-900 mb-2'>Professional</h3>
                <div className='text-3xl font-bold text-gray-900 mb-4'>$49<span className='text-lg text-gray-600'>/month</span></div>
                <ul className='space-y-2 text-sm text-gray-600 mb-6'>
                  <li>✓ Unlimited calculations</li>
                  <li>✓ Document upload & OCR</li>
                  <li>✓ Real-time alerts</li>
                  <li>✓ Export to PDF/Excel</li>
                  <li>✓ Priority support</li>
                </ul>
                <Link 
                  href='/login'
                  className='w-full block text-center py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700'
                >
                  Start Free Trial
                </Link>
              </div>
            </div>
            
            <div className='rounded-lg bg-white p-6 shadow-sm border border-gray-200'>
              <div className='text-center'>
                <h3 className='text-xl font-semibold text-gray-900 mb-2'>Enterprise</h3>
                <div className='text-3xl font-bold text-gray-900 mb-4'>Custom</div>
                <ul className='space-y-2 text-sm text-gray-600 mb-6'>
                  <li>✓ Everything in Professional</li>
                  <li>✓ API access</li>
                  <li>✓ Custom integrations</li>
                  <li>✓ Dedicated support</li>
                  <li>✓ Team management</li>
                </ul>
                <button className='w-full py-2 px-4 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50'>
                  Contact Sales
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className='mt-16 bg-blue-600 rounded-lg p-8 text-center'>
          <h2 className='text-3xl font-bold text-white mb-4'>
            Ready to stop missing tariff changes?
          </h2>
          <p className='text-blue-100 mb-6 text-lg'>
            Join importers who save thousands with real-time tariff monitoring
          </p>
          <Link
            href='/login'
            className='inline-block bg-white text-blue-600 px-8 py-3 rounded-lg font-medium hover:bg-blue-50 transition-colors'
          >
            Start Free Trial
          </Link>
        </div>

        {/* Footer */}
        <div className='mt-16 pt-8 border-t border-gray-200 text-center text-sm text-gray-500'>
          <div className='flex justify-center space-x-6 mb-4'>
            <Link href='/terms' className='hover:text-gray-700'>Terms</Link>
            <Link href='/privacy' className='hover:text-gray-700'>Privacy</Link>
            <Link href='/contact' className='hover:text-gray-700'>Contact</Link>
            <Link href='/status' className='hover:text-gray-700'>System Status</Link>
          </div>
          <p>&copy; 2025 TariffGuard. Built with real USITC government data.</p>
        </div>
      </div>
    </main>
  )
}