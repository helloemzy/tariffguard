import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Dashboard - TariffGuard',
  description: 'Monitor tariff changes and trade policies in real-time',
}

export default function DashboardPage() {
  return (
    <div className='min-h-screen bg-gray-50'>
      <header className='border-b bg-white shadow-sm'>
        <div className='mx-auto max-w-7xl p-4'>
          <h1 className='text-2xl font-bold text-gray-900'>
            Tariff Monitoring Dashboard
          </h1>
          <p className='text-gray-600'>Real-time tariff tracking and analysis</p>
        </div>
      </header>

      <main className='mx-auto max-w-7xl px-4 py-8'>
        <div className='mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4'>
          <div className='rounded-lg bg-white p-6 shadow-sm'>
            <h3 className='text-sm font-medium uppercase tracking-wide text-gray-500'>
              Active Monitors
            </h3>
            <p className='mt-2 text-3xl font-bold text-blue-600'>12</p>
          </div>
          <div className='rounded-lg bg-white p-6 shadow-sm'>
            <h3 className='text-sm font-medium uppercase tracking-wide text-gray-500'>
              Recent Changes
            </h3>
            <p className='mt-2 text-3xl font-bold text-green-600'>3</p>
          </div>
          <div className='rounded-lg bg-white p-6 shadow-sm'>
            <h3 className='text-sm font-medium uppercase tracking-wide text-gray-500'>
              Alerts Today
            </h3>
            <p className='mt-2 text-3xl font-bold text-yellow-600'>7</p>
          </div>
          <div className='rounded-lg bg-white p-6 shadow-sm'>
            <h3 className='text-sm font-medium uppercase tracking-wide text-gray-500'>
              Total Savings
            </h3>
            <p className='mt-2 text-3xl font-bold text-indigo-600'>$24.5K</p>
          </div>
        </div>

        <div className='grid grid-cols-1 gap-8 lg:grid-cols-2'>
          <div className='rounded-lg bg-white p-6 shadow-sm'>
            <h2 className='mb-4 text-lg font-semibold text-gray-900'>
              Recent Tariff Changes
            </h2>
            <div className='space-y-4'>
              <div className='flex items-center justify-between rounded bg-gray-50 p-3'>
                <div>
                  <p className='font-medium'>Steel Products - HS 7208</p>
                  <p className='text-sm text-gray-600'>USA → China</p>
                </div>
                <div className='text-right'>
                  <p className='font-medium text-red-600'>+2.5%</p>
                  <p className='text-sm text-gray-500'>2 hours ago</p>
                </div>
              </div>
              <div className='flex items-center justify-between rounded bg-gray-50 p-3'>
                <div>
                  <p className='font-medium'>Textiles - HS 6109</p>
                  <p className='text-sm text-gray-600'>EU → USA</p>
                </div>
                <div className='text-right'>
                  <p className='font-medium text-green-600'>-1.2%</p>
                  <p className='text-sm text-gray-500'>1 day ago</p>
                </div>
              </div>
            </div>
          </div>

          <div className='rounded-lg bg-white p-6 shadow-sm'>
            <h2 className='mb-4 text-lg font-semibold text-gray-900'>Active Alerts</h2>
            <div className='space-y-3'>
              <div className='flex items-center rounded border border-yellow-200 bg-yellow-50 p-3'>
                <div className='mr-3 size-3 rounded-full bg-yellow-400' />
                <div>
                  <p className='font-medium'>Rate increase detected</p>
                  <p className='text-sm text-gray-600'>Electronics HS 8517</p>
                </div>
              </div>
              <div className='flex items-center rounded border border-blue-200 bg-blue-50 p-3'>
                <div className='mr-3 size-3 rounded-full bg-blue-400' />
                <div>
                  <p className='font-medium'>New regulation published</p>
                  <p className='text-sm text-gray-600'>Automotive parts</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
