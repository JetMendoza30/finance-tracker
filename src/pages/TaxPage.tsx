import { useState, useMemo } from 'react'
import { Plus, Receipt, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'
import { db } from '@/db/database'
import { useTaxPayments, useTransactions, usePrimaryCurrency } from '@/db/hooks'
import { formatCurrency } from '@/utils/currency'
import { getCurrentYear, getToday, formatDate } from '@/utils/date'
import { getTaxYTD, getEffectiveTaxRate } from '@/utils/calculations'
import { Modal } from '@/components/shared/Modal'
import { EmptyState } from '@/components/shared/EmptyState'
import type { Currency } from '@/types'

const TAX_TYPES = ['Withholding', 'Quarterly', 'Annual', 'Other']

export function TaxPage() {
  const [year, setYear] = useState(getCurrentYear())
  const currency = usePrimaryCurrency()
  const taxPayments = useTaxPayments(year)
  const allTransactions = useTransactions()
  const [showForm, setShowForm] = useState(false)

  const [formAmount, setFormAmount] = useState('')
  const [formCurrency, setFormCurrency] = useState<Currency>(currency)
  const [formDate, setFormDate] = useState(getToday())
  const [formDescription, setFormDescription] = useState('')
  const [formTaxType, setFormTaxType] = useState('Withholding')

  const taxYTD = useMemo(() => getTaxYTD(taxPayments, year, currency), [taxPayments, year, currency])

  const ytdIncome = useMemo(() => {
    return allTransactions
      .filter((t) => t.type === 'income' && t.date.startsWith(year) && t.currency === currency)
      .reduce((sum, t) => sum + t.amount, 0)
  }, [allTransactions, year, currency])

  const effectiveRate = getEffectiveTaxRate(taxYTD, ytdIncome)

  // Group by tax type
  const byType = useMemo(() => {
    const map = new Map<string, number>()
    for (const tp of taxPayments) {
      if (tp.currency !== currency) continue
      map.set(tp.taxType, (map.get(tp.taxType) ?? 0) + tp.amount)
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1])
  }, [taxPayments, currency])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const amount = parseFloat(formAmount)
    if (!amount) return

    await db.taxPayments.add({
      id: crypto.randomUUID(),
      amount,
      currency: formCurrency,
      date: formDate,
      description: formDescription,
      taxType: formTaxType,
      createdAt: Date.now(),
    })
    setShowForm(false)
    setFormAmount('')
    setFormDescription('')
  }

  const handleDelete = async (id: string) => {
    await db.taxPayments.delete(id)
  }

  return (
    <div className="pt-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Tax Tracker</h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-sm rounded-lg hover:bg-primary-dark"
        >
          <Plus size={16} /> Add Payment
        </button>
      </div>

      {/* Year nav */}
      <div className="flex items-center justify-between bg-white dark:bg-slate-800 rounded-xl px-4 py-3">
        <button onClick={() => setYear(String(Number(year) - 1))} className="p-1"><ChevronLeft size={20} /></button>
        <span className="font-medium">{year}</span>
        <button onClick={() => setYear(String(Number(year) + 1))} className="p-1"><ChevronRight size={20} /></button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Total Tax Paid</div>
          <div className="text-lg font-bold text-tax">{formatCurrency(taxYTD, currency)}</div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Effective Tax Rate</div>
          <div className="text-lg font-bold">{effectiveRate.toFixed(1)}%</div>
          <div className="text-xs text-slate-400 mt-0.5">of {formatCurrency(ytdIncome, currency)} income</div>
        </div>
      </div>

      {/* By type breakdown */}
      {byType.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4">
          <h2 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3">By Type</h2>
          <div className="space-y-2">
            {byType.map(([type, total]) => (
              <div key={type} className="flex justify-between text-sm">
                <span>{type}</span>
                <span className="font-medium">{formatCurrency(total, currency)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payment List */}
      {taxPayments.length === 0 ? (
        <EmptyState
          icon={<Receipt size={48} />}
          title="No tax payments"
          description="Add your tax payments to track your total tax burden"
        />
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-700">
          {taxPayments.map((tp) => (
            <div key={tp.id} className="flex items-center px-4 py-3 gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                <Receipt size={18} className="text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{tp.taxType}</div>
                <div className="text-xs text-slate-400 truncate">
                  {formatDate(tp.date)}{tp.description ? ` \u2014 ${tp.description}` : ''}
                </div>
              </div>
              <div className="text-sm font-semibold text-tax shrink-0">
                {formatCurrency(tp.amount, tp.currency)}
              </div>
              <button
                onClick={() => handleDelete(tp.id)}
                className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 shrink-0"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add Tax Payment Modal */}
      {showForm && (
        <Modal title="Add Tax Payment" onClose={() => setShowForm(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex gap-2">
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                placeholder="Amount"
                value={formAmount}
                onChange={(e) => setFormAmount(e.target.value)}
                className="flex-1 px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
              <div className="flex rounded-lg bg-slate-100 dark:bg-slate-700 p-1">
                {(['PHP', 'USD'] as Currency[]).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setFormCurrency(c)}
                    className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                      formCurrency === c ? 'bg-white dark:bg-slate-600 shadow-sm' : 'text-slate-500'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <select
              value={formTaxType}
              onChange={(e) => setFormTaxType(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {TAX_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>

            <input
              type="date"
              value={formDate}
              onChange={(e) => setFormDate(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-primary"
            />

            <input
              type="text"
              placeholder="Description (optional)"
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-primary"
            />

            <button
              type="submit"
              className="w-full py-3 rounded-lg bg-primary text-white font-medium hover:bg-primary-dark active:scale-[0.98] transition-all"
            >
              Add Payment
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}
