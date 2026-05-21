import { useState } from 'react'
import { Download, Upload, Sun, Moon, Monitor, Clock, ChevronRight } from 'lucide-react'
import { db } from '@/db/database'
import { usePrimaryCurrency, setSetting, useSetting, useWorkingHoursPerMonth, useFallbackMonthlySalary } from '@/db/hooks'
import { useTheme } from '@/hooks/useTheme'
import type { Currency } from '@/types'

export function SettingsPage() {
  const primaryCurrency = usePrimaryCurrency()
  const { theme, setTheme } = useTheme()
  const workingHours = useWorkingHoursPerMonth()
  const fallbackSalary = useFallbackMonthlySalary()
  const [importStatus, setImportStatus] = useState<string | null>(null)

  const handleExport = async () => {
    const data = {
      transactions: await db.transactions.toArray(),
      categories: await db.categories.toArray(),
      budgets: await db.budgets.toArray(),
      taxPayments: await db.taxPayments.toArray(),
      settings: await db.settings.toArray(),
      exportedAt: new Date().toISOString(),
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `finance-tracker-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      try {
        const text = await file.text()
        const data = JSON.parse(text)
        await db.transaction('rw', [db.transactions, db.categories, db.budgets, db.taxPayments, db.settings], async () => {
          if (data.transactions) {
            await db.transactions.clear()
            await db.transactions.bulkAdd(data.transactions)
          }
          if (data.categories) {
            await db.categories.clear()
            await db.categories.bulkAdd(data.categories)
          }
          if (data.budgets) {
            await db.budgets.clear()
            await db.budgets.bulkAdd(data.budgets)
          }
          if (data.taxPayments) {
            await db.taxPayments.clear()
            await db.taxPayments.bulkAdd(data.taxPayments)
          }
          if (data.settings) {
            await db.settings.clear()
            await db.settings.bulkAdd(data.settings)
          }
        })
        setImportStatus('Data imported successfully!')
      } catch {
        setImportStatus('Import failed. Invalid file format.')
      }
      setTimeout(() => setImportStatus(null), 3000)
    }
    input.click()
  }

  const themeOptions = [
    { value: 'light' as const, icon: Sun, label: 'Light' },
    { value: 'dark' as const, icon: Moon, label: 'Dark' },
    { value: 'system' as const, icon: Monitor, label: 'System' },
  ]

  return (
    <div className="pt-6 space-y-6">
      <h1 className="text-xl font-bold">Settings</h1>

      {/* Currency */}
      <section className="bg-white dark:bg-slate-800 rounded-xl p-4">
        <h2 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3">Primary Currency</h2>
        <div className="flex rounded-lg bg-slate-100 dark:bg-slate-700 p-1">
          {(['PHP', 'USD'] as Currency[]).map((c) => (
            <button
              key={c}
              onClick={() => setSetting('primaryCurrency', c)}
              className={`flex-1 py-2.5 text-sm font-medium rounded-md transition-colors ${
                primaryCurrency === c ? 'bg-white dark:bg-slate-600 shadow-sm' : 'text-slate-500'
              }`}
            >
              {c === 'PHP' ? '\u20B1 Philippine Peso' : '$ US Dollar'}
            </button>
          ))}
        </div>
      </section>

      {/* Theme */}
      <section className="bg-white dark:bg-slate-800 rounded-xl p-4">
        <h2 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3">Theme</h2>
        <div className="flex rounded-lg bg-slate-100 dark:bg-slate-700 p-1">
          {themeOptions.map(({ value, icon: Icon, label }) => (
            <button
              key={value}
              onClick={() => setTheme(value)}
              className={`flex-1 py-2.5 text-sm font-medium rounded-md transition-colors flex items-center justify-center gap-1.5 ${
                theme === value ? 'bg-white dark:bg-slate-600 shadow-sm' : 'text-slate-500'
              }`}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>
      </section>

      {/* Work Hours */}
      <section className="bg-white dark:bg-slate-800 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Clock size={16} className="text-slate-500 dark:text-slate-400" />
          <h2 className="text-sm font-medium text-slate-500 dark:text-slate-400">Work Hours</h2>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-slate-400 dark:text-slate-500 mb-1">Hours per month</label>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={744}
              value={workingHours}
              onChange={(e) => {
                const v = Math.max(1, Math.min(744, parseInt(e.target.value) || 160))
                setSetting('workingHoursPerMonth', v)
              }}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-primary text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 dark:text-slate-500 mb-1">Fallback monthly salary (for months with no income)</label>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min={0}
              value={fallbackSalary || ''}
              placeholder="0"
              onChange={(e) => setSetting('fallbackMonthlySalary', parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-primary text-sm"
            />
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Shows how many hours of work each expense costs. Uses your actual monthly income; fallback is used for months with no income recorded.
          </p>
        </div>
      </section>

      {/* Data */}
      <section className="bg-white dark:bg-slate-800 rounded-xl overflow-hidden">
        <h2 className="text-sm font-medium text-slate-500 dark:text-slate-400 px-4 pt-4 pb-2">Data</h2>
        <button
          onClick={handleExport}
          className="w-full flex items-center px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
        >
          <Download size={20} className="text-primary mr-3" />
          <span className="flex-1 text-left">Export Data</span>
          <ChevronRight size={16} className="text-slate-400" />
        </button>
        <div className="mx-4 border-t border-slate-100 dark:border-slate-700" />
        <button
          onClick={handleImport}
          className="w-full flex items-center px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
        >
          <Upload size={20} className="text-primary mr-3" />
          <span className="flex-1 text-left">Import Data</span>
          <ChevronRight size={16} className="text-slate-400" />
        </button>
      </section>

      {importStatus && (
        <div className={`text-center text-sm py-2 px-4 rounded-lg ${
          importStatus.includes('success') ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
        }`}>
          {importStatus}
        </div>
      )}

      <p className="text-center text-xs text-slate-400 dark:text-slate-600 pb-4">
        Finance Tracker v1.0 &mdash; All data stored locally
      </p>
    </div>
  )
}
