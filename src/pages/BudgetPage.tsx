import { useState, useMemo } from 'react'
import { Plus, Wallet, Trash2, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react'
import { db } from '@/db/database'
import { useBudgets, useTransactions, useCategories, usePrimaryCurrency } from '@/db/hooks'
import { formatCurrency } from '@/utils/currency'
import { getCurrentMonth, formatMonthShort } from '@/utils/date'
import { getBudgetSpent } from '@/utils/calculations'
import { Modal } from '@/components/shared/Modal'
import { EmptyState } from '@/components/shared/EmptyState'
import { format, subMonths, addMonths } from 'date-fns'
import type { Currency } from '@/types'

export function BudgetPage() {
  const [month, setMonth] = useState(getCurrentMonth())
  const currency = usePrimaryCurrency()
  const budgets = useBudgets(month)
  const transactions = useTransactions(month)
  const categories = useCategories('expense')
  const [showForm, setShowForm] = useState(false)
  const [formCategoryId, setFormCategoryId] = useState('')
  const [formLimit, setFormLimit] = useState('')
  const [formCurrency, setFormCurrency] = useState<Currency>(currency)

  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])

  const budgetData = useMemo(() => {
    return budgets.map((b) => {
      const spent = getBudgetSpent(transactions, b.categoryId, month, b.currency)
      const pct = b.monthlyLimit > 0 ? (spent / b.monthlyLimit) * 100 : 0
      return { ...b, spent, pct, category: catMap.get(b.categoryId) }
    }).sort((a, b) => b.pct - a.pct)
  }, [budgets, transactions, month, catMap])

  const totalBudget = budgetData.reduce((sum, b) => sum + b.monthlyLimit, 0)
  const totalSpent = budgetData.reduce((sum, b) => sum + b.spent, 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const limit = parseFloat(formLimit)
    if (!limit || !formCategoryId) return

    const existing = await db.budgets.where('[categoryId+month]').equals([formCategoryId, month]).first()
    if (existing) {
      await db.budgets.update(existing.id, { monthlyLimit: limit, currency: formCurrency })
    } else {
      await db.budgets.add({
        id: crypto.randomUUID(),
        categoryId: formCategoryId,
        monthlyLimit: limit,
        currency: formCurrency,
        month,
      })
    }
    setShowForm(false)
    setFormCategoryId('')
    setFormLimit('')
  }

  const handleDelete = async (id: string) => {
    await db.budgets.delete(id)
  }

  const prevMonth = () => setMonth(format(subMonths(new Date(`${month}-01`), 1), 'yyyy-MM'))
  const nextMonth = () => setMonth(format(addMonths(new Date(`${month}-01`), 1), 'yyyy-MM'))

  const getBarColor = (pct: number) => {
    if (pct >= 90) return 'bg-red-500'
    if (pct >= 75) return 'bg-amber-500'
    return 'bg-emerald-500'
  }

  return (
    <div className="pt-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Budget</h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-sm rounded-lg hover:bg-primary-dark"
        >
          <Plus size={16} /> Set Budget
        </button>
      </div>

      {/* Month nav */}
      <div className="flex items-center justify-between bg-white dark:bg-slate-800 rounded-xl px-4 py-3">
        <button onClick={prevMonth} className="p-1"><ChevronLeft size={20} /></button>
        <span className="font-medium">{formatMonthShort(month)}</span>
        <button onClick={nextMonth} className="p-1"><ChevronRight size={20} /></button>
      </div>

      {/* Summary */}
      {budgetData.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-slate-500">Total Spent / Budget</span>
            <span className="font-semibold">
              {formatCurrency(totalSpent, currency)} / {formatCurrency(totalBudget, currency)}
            </span>
          </div>
          <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${getBarColor(totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0)}`}
              style={{ width: `${Math.min(100, totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0)}%` }}
            />
          </div>
        </div>
      )}

      {/* Budget list */}
      {budgetData.length === 0 ? (
        <EmptyState
          icon={<Wallet size={48} />}
          title="No budgets set"
          description="Set a monthly budget to track your spending limits"
        />
      ) : (
        <div className="space-y-3">
          {budgetData.map((b) => (
            <div key={b.id} className="bg-white dark:bg-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: b.category?.color ?? '#6b7280' }}
                  />
                  <span className="font-medium text-sm">{b.category?.name ?? 'Unknown'}</span>
                </div>
                <div className="flex items-center gap-2">
                  {b.pct >= 90 && <AlertTriangle size={14} className="text-red-500" />}
                  <button
                    onClick={() => handleDelete(b.id)}
                    className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <div className="flex justify-between text-sm mb-1.5">
                <span className={b.pct > 100 ? 'text-red-500 font-medium' : 'text-slate-500'}>
                  {formatCurrency(b.spent, b.currency)}
                </span>
                <span className="text-slate-400">{formatCurrency(b.monthlyLimit, b.currency)}</span>
              </div>
              <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${getBarColor(b.pct)}`}
                  style={{ width: `${Math.min(100, b.pct)}%` }}
                />
              </div>
              <div className="text-right text-xs text-slate-400 mt-1">{b.pct.toFixed(0)}%</div>
            </div>
          ))}
        </div>
      )}

      {/* Budget Form Modal */}
      {showForm && (
        <Modal title="Set Monthly Budget" onClose={() => setShowForm(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <select
              value={formCategoryId}
              onChange={(e) => setFormCategoryId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-primary"
              required
            >
              <option value="">Select category</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>

            <div className="flex gap-2">
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                placeholder="Monthly limit"
                value={formLimit}
                onChange={(e) => setFormLimit(e.target.value)}
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

            <button
              type="submit"
              className="w-full py-3 rounded-lg bg-primary text-white font-medium hover:bg-primary-dark active:scale-[0.98] transition-all"
            >
              Save Budget
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}
