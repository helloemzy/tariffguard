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
        <div className='container mx-auto p-4'>
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
          <div className='mx-auto mt-16 max-w-4xl'>
            <div className='rounded-lg bg-white p-8 shadow-lg'>
              <h3 className='mb-6 text-center text-2xl font-semibold text-gray-900'>
                Live Demo: Import Duty Calculator
              </h3>
              
              {demoStep === 1 && (
                <div className='text-center'>
                  <div className='mx-auto mb-4 size-12 animate-spin rounded-full border-b-2 border-blue-600' />
                  <p className='text-gray-600'>⏳ Fetching rates from USITC...</p>
                  <p className='mt-2 text-sm text-gray-500'>✓ Retrieved rate for 8517.12</p>
                </div>
              )}
              
              {demoStep === 2 && (
                <div className='space-y-4'>
                  <div className='rounded-lg bg-gray-50 p-4'>
                    <div className='mb-2 text-sm text-gray-600'>Calculation Results - Source: USITC (Official)</div>
                    {calculations.map((calc, index) => (
                      <div key={index} className='border-b border-gray-200 pb-4 last:border-b-0'>
                        <div className='flex items-center justify-between'>
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
                  <div className='rounded-lg bg-blue-50 p-4'>
                    <div className='flex items-center justify-between'>
                      <div>
                        <div className='font-semibold'>Total Import: $100,000</div>
                        <div className='font-semibold'>Total Duties: $7,500</div>
                      </div>
                      <div className='text-2xl font-bold text-blue-600'>$107,500</div>
                    </div>
                  </div>
                  <div className='flex justify-center gap-2'>
                    <button className='rounded-md bg-blue-600 px-4 py-2 text-sm text-white'>Save</button>
                    <button className='rounded-md bg-gray-600 px-4 py-2 text-sm text-white'>Export PDF</button>
                    <button 
                      onClick={() => setDemoStep(0)} 
                      className='rounded-md bg-green-600 px-4 py-2 text-sm text-white'
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
            <div className='mx-auto mb-4 flex size-12 items-center justify-center rounded-lg bg-blue-100'>
              <span className='text-2xl'>📊</span>
            </div>
            <h3 className='mb-3 text-center text-xl font-semibold text-gray-900'>
              Real-Time Calculations
            </h3>
            <p className='text-center text-gray-600'>
              Upload invoices or enter products manually. Get instant duty calculations 
              using live USITC government data.
            </p>
          </div>
          <div className='rounded-lg bg-white p-6 shadow-sm'>
            <div className='mx-auto mb-4 flex size-12 items-center justify-center rounded-lg bg-green-100'>
              <span className='text-2xl'>🚨</span>
            </div>
            <h3 className='mb-3 text-center text-xl font-semibold text-gray-900'>Instant Alerts</h3>
            <p className='text-center text-gray-600'>
              Get notified immediately when tariff rates change for your products. 
              Never miss important updates again.
            </p>
          </div>
          <div className='rounded-lg bg-white p-6 shadow-sm'>
            <div className='mx-auto mb-4 flex size-12 items-center justify-center rounded-lg bg-purple-100'>
              <span className='text-2xl'>📎</span>
            </div>
            <h3 className='mb-3 text-center text-xl font-semibold text-gray-900'>
              Document Upload
            </h3>
            <p className='text-center text-gray-600'>
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
          
          <div className='mx-auto grid max-w-6xl grid-cols-1 gap-6 md:grid-cols-3'>
            <div className='rounded-lg border border-gray-200 bg-white p-6 shadow-sm'>
              <div className='text-center'>
                <h3 className='mb-2 text-xl font-semibold text-gray-900'>Starter</h3>
                <div className='mb-4 text-3xl font-bold text-gray-900'>Free</div>
                <ul className='mb-6 space-y-2 text-sm text-gray-600'>
                  <li>✓ 5 calculations per month</li>
                  <li>✓ Basic tariff monitoring</li>
                  <li>✓ Email alerts</li>
                  <li>✓ USITC government data</li>
                </ul>
                <Link 
                  href='/login'
                  className='block w-full rounded-md border border-gray-300 px-4 py-2 text-center text-gray-700 hover:bg-gray-50'
                >
                  Get Started
                </Link>
              </div>
            </div>
            
            <div className='relative rounded-lg border-2 border-blue-500 bg-white p-6 shadow-lg'>
              <div className='absolute -top-3 left-1/2 -translate-x-1/2'>
                <span className='rounded-full bg-blue-500 px-3 py-1 text-xs font-medium text-white'>
                  Most Popular
                </span>
              </div>
              <div className='text-center'>
                <h3 className='mb-2 text-xl font-semibold text-gray-900'>Professional</h3>
                <div className='mb-4 text-3xl font-bold text-gray-900'>$49<span className='text-lg text-gray-600'>/month</span></div>
                <ul className='mb-6 space-y-2 text-sm text-gray-600'>
                  <li>✓ Unlimited calculations</li>
                  <li>✓ Document upload & OCR</li>
                  <li>✓ Real-time alerts</li>
                  <li>✓ Export to PDF/Excel</li>
                  <li>✓ Priority support</li>
                </ul>
                <Link 
                  href='/login'
                  className='block w-full rounded-md bg-blue-600 px-4 py-2 text-center text-white hover:bg-blue-700'
                >
                  Start Free Trial
                </Link>
              </div>
            </div>
            
            <div className='rounded-lg border border-gray-200 bg-white p-6 shadow-sm'>
              <div className='text-center'>
                <h3 className='mb-2 text-xl font-semibold text-gray-900'>Enterprise</h3>
                <div className='mb-4 text-3xl font-bold text-gray-900'>Custom</div>
                <ul className='mb-6 space-y-2 text-sm text-gray-600'>
                  <li>✓ Everything in Professional</li>
                  <li>✓ API access</li>
                  <li>✓ Custom integrations</li>
                  <li>✓ Dedicated support</li>
                  <li>✓ Team management</li>
                </ul>
                <button className='w-full rounded-md border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50'>
                  Contact Sales
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className='mt-16 rounded-lg bg-blue-600 p-8 text-center'>
          <h2 className='mb-4 text-3xl font-bold text-white'>
            Ready to stop missing tariff changes?
          </h2>
          <p className='mb-6 text-lg text-blue-100'>
            Join importers who save thousands with real-time tariff monitoring
          </p>
          <Link
            href='/login'
            className='inline-block rounded-lg bg-white px-8 py-3 font-medium text-blue-600 transition-colors hover:bg-blue-50'
          >
            Start Free Trial
          </Link>
        </div>

        {/* Footer */}
        <div className='mt-16 border-t border-gray-200 pt-8 text-center text-sm text-gray-500'>
          <div className='mb-4 flex justify-center space-x-6'>
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