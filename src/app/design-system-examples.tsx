/**
 * Design System Component Examples
 * This file demonstrates the usage of the Manifest design system
 * for tariff monitoring application components.
 */

import React from 'react'

export const DesignSystemExamples = () => {
  return (
    <div className='min-h-screen space-y-12 bg-background p-8'>
      {/* Typography Examples */}
      <section className='space-y-6'>
        <h1 className='gradient-text'>Manifest Design System</h1>
        <div className='space-y-4'>
          <h1>H1: Tariff Dashboard Overview</h1>
          <h2>H2: Recent Import Changes</h2>
          <h3>H3: Category Analysis</h3>
          <h4>H4: Detailed Metrics</h4>
          <p className='text-muted-foreground'>
            Professional typography for displaying financial and trade data with
            clarity.
          </p>
        </div>
      </section>

      {/* Color Palette Examples */}
      <section className='space-y-6'>
        <h2>Color Palette</h2>
        <div className='grid grid-cols-2 gap-4 md:grid-cols-4'>
          <div className='space-y-2'>
            <div className='h-20 rounded-md bg-primary shadow-sm' />
            <p className='text-sm font-medium'>Primary</p>
            <p className='text-xs text-muted-foreground'>Trust & Authority</p>
          </div>
          <div className='space-y-2'>
            <div className='h-20 rounded-md bg-secondary shadow-sm' />
            <p className='text-sm font-medium'>Secondary</p>
            <p className='text-xs text-muted-foreground'>Professional Slate</p>
          </div>
          <div className='space-y-2'>
            <div className='h-20 rounded-md bg-success shadow-sm' />
            <p className='text-sm font-medium'>Success</p>
            <p className='text-xs text-muted-foreground'>Positive Changes</p>
          </div>
          <div className='space-y-2'>
            <div className='h-20 rounded-md bg-warning shadow-sm' />
            <p className='text-sm font-medium'>Warning</p>
            <p className='text-xs text-muted-foreground'>Alerts & Notices</p>
          </div>
        </div>
      </section>

      {/* Button Examples */}
      <section className='space-y-6'>
        <h2>Button Components</h2>
        <div className='flex flex-wrap gap-4'>
          <button className='btn-primary'>View Tariff Report</button>
          <button className='btn-secondary'>Export Data</button>
          <button className='btn-outline'>Filter Results</button>
          <button className='btn-ghost'>Learn More</button>
          <button className='btn-destructive'>Delete Alert</button>
        </div>

        {/* Button Sizes */}
        <div className='flex flex-wrap items-center gap-4'>
          <button className='btn-primary px-3 py-1.5 text-xs'>Small</button>
          <button className='btn-primary'>Default</button>
          <button className='btn-primary px-6 py-3 text-lg'>Large</button>
        </div>
      </section>

      {/* Input Examples */}
      <section className='space-y-6'>
        <h2>Form Components</h2>
        <div className='max-w-md space-y-4'>
          <div>
            <label htmlFor='hs-code-search' className='mb-2 block text-sm font-medium'>
              HS Code Search
            </label>
            <input
              id='hs-code-search'
              type='text'
              className='input-field'
              placeholder='Enter HS code or product name...'
            />
          </div>

          <fieldset>
            <legend className='mb-2 block text-sm font-medium'>Date Range</legend>
            <div className='grid grid-cols-2 gap-4'>
              <input
                id='date-from'
                type='date'
                className='input-field'
                aria-label='From date'
              />
              <input
                id='date-to'
                type='date'
                className='input-field'
                aria-label='To date'
              />
            </div>
          </fieldset>

          <div>
            <label
              htmlFor='country-selection'
              className='mb-2 block text-sm font-medium'
            >
              Country Selection
            </label>
            <select id='country-selection' className='input-field'>
              <option>United States</option>
              <option>European Union</option>
              <option>China</option>
              <option>Canada</option>
            </select>
          </div>
        </div>
      </section>

      {/* Card Examples */}
      <section className='space-y-6'>
        <h2>Card Components</h2>
        <div className='grid gap-6 md:grid-cols-3'>
          {/* Standard Card */}
          <div className='card'>
            <div className='card-header'>
              <h3 className='text-lg font-semibold'>Import Duties</h3>
              <p className='text-sm text-muted-foreground'>Last 30 days</p>
            </div>
            <div className='card-content'>
              <div className='text-2xl font-bold'>$24,563</div>
              <p className='text-xs text-success'>+12.5% from last month</p>
            </div>
            <div className='card-footer'>
              <button className='btn-ghost text-sm'>View Details</button>
            </div>
          </div>

          {/* Alert Card */}
          <div className='card border-warning/20 bg-warning/5'>
            <div className='card-header'>
              <h3 className='text-lg font-semibold text-warning'>Tariff Alert</h3>
              <p className='text-sm text-muted-foreground'>2 hours ago</p>
            </div>
            <div className='card-content'>
              <p className='text-sm'>Steel imports from EU face 25% increase</p>
            </div>
            <div className='card-footer'>
              <button className='btn-outline text-sm'>Review Impact</button>
            </div>
          </div>

          {/* Glass Card */}
          <div className='card glass'>
            <div className='card-header'>
              <h3 className='text-lg font-semibold'>Quick Actions</h3>
            </div>
            <div className='card-content space-y-2'>
              <button className='btn-ghost w-full justify-start'>
                Calculate Duties
              </button>
              <button className='btn-ghost w-full justify-start'>Compare Rates</button>
              <button className='btn-ghost w-full justify-start'>Set Alerts</button>
            </div>
          </div>
        </div>
      </section>

      {/* Badge Examples */}
      <section className='space-y-6'>
        <h2>Status Badges</h2>
        <div className='flex flex-wrap gap-3'>
          <span className='badge badge-primary'>Active</span>
          <span className='badge badge-success'>Decreased</span>
          <span className='badge badge-warning'>Pending Review</span>
          <span className='badge badge-destructive'>Increased</span>
          <span className='badge bg-muted text-muted-foreground'>Archived</span>
        </div>
      </section>

      {/* Alert Examples */}
      <section className='space-y-6'>
        <h2>Alert Components</h2>
        <div className='max-w-2xl space-y-4'>
          <div className='alert alert-default'>
            <h4 className='font-semibold'>Information</h4>
            <p className='mt-1 text-sm'>
              New tariff schedules have been published for Q2 2024.
            </p>
          </div>

          <div className='alert alert-success'>
            <h4 className='font-semibold'>Success</h4>
            <p className='mt-1 text-sm'>
              Your tariff monitoring preferences have been updated.
            </p>
          </div>

          <div className='alert alert-warning'>
            <h4 className='font-semibold'>Warning</h4>
            <p className='mt-1 text-sm'>
              Upcoming changes to textile import duties effective next month.
            </p>
          </div>

          <div className='alert alert-destructive'>
            <h4 className='font-semibold'>Critical Alert</h4>
            <p className='mt-1 text-sm'>
              Emergency tariff increase of 35% on aluminum imports.
            </p>
          </div>
        </div>
      </section>

      {/* Table Example */}
      <section className='space-y-6'>
        <h2>Data Table</h2>
        <div className='overflow-x-auto'>
          <table className='table'>
            <thead className='table-header'>
              <tr>
                <th className='table-cell text-left font-semibold'>HS Code</th>
                <th className='table-cell text-left font-semibold'>Product</th>
                <th className='table-cell text-left font-semibold'>Current Rate</th>
                <th className='table-cell text-left font-semibold'>Change</th>
                <th className='table-cell text-left font-semibold'>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr className='table-row'>
                <td className='table-cell font-mono text-sm'>7208.10</td>
                <td className='table-cell'>Flat-rolled iron</td>
                <td className='table-cell'>12.5%</td>
                <td className='table-cell text-destructive'>+2.5%</td>
                <td className='table-cell'>
                  <span className='badge badge-destructive'>Increased</span>
                </td>
              </tr>
              <tr className='table-row'>
                <td className='table-cell font-mono text-sm'>8703.23</td>
                <td className='table-cell'>Motor vehicles</td>
                <td className='table-cell'>8.0%</td>
                <td className='table-cell text-success'>-1.0%</td>
                <td className='table-cell'>
                  <span className='badge badge-success'>Decreased</span>
                </td>
              </tr>
              <tr className='table-row'>
                <td className='table-cell font-mono text-sm'>6110.20</td>
                <td className='table-cell'>Cotton sweaters</td>
                <td className='table-cell'>15.0%</td>
                <td className='table-cell text-muted-foreground'>0%</td>
                <td className='table-cell'>
                  <span className='badge bg-muted text-muted-foreground'>Stable</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Loading States */}
      <section className='space-y-6'>
        <h2>Loading States</h2>
        <div className='space-y-4'>
          {/* Skeleton Card */}
          <div className='card'>
            <div className='card-header'>
              <div className='skeleton h-6 w-32' />
              <div className='skeleton mt-2 h-4 w-24' />
            </div>
            <div className='card-content space-y-2'>
              <div className='skeleton h-8 w-28' />
              <div className='skeleton h-4 w-full' />
              <div className='skeleton h-4 w-3/4' />
            </div>
          </div>

          {/* Loading Spinner */}
          <div className='flex items-center gap-4'>
            <div className='size-6 animate-spin rounded-full border-2 border-primary border-t-transparent' />
            <span className='text-muted-foreground'>Loading tariff data...</span>
          </div>
        </div>
      </section>

      {/* Responsive Grid Example */}
      <section className='space-y-6'>
        <h2>Responsive Grid Layout</h2>
        <div className='grid-responsive'>
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
            <div key={i} className='card'>
              <div className='card-content'>
                <div className='skeleton mb-4 h-20 w-full' />
                <h4 className='mb-2 font-semibold'>Category {i}</h4>
                <p className='text-sm text-muted-foreground'>Tariff category details</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Animation Examples */}
      <section className='space-y-6'>
        <h2>Animations</h2>
        <div className='flex flex-wrap gap-4'>
          <div className='card animate-fade-in'>
            <div className='card-content'>
              <p>Fade In Animation</p>
            </div>
          </div>
          <div className='card animate-slide-up'>
            <div className='card-content'>
              <p>Slide Up Animation</p>
            </div>
          </div>
          <div className='card animate-scale-in'>
            <div className='card-content'>
              <p>Scale In Animation</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

export default DesignSystemExamples
