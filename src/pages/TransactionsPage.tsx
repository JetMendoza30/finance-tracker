import { useState, useMemo } from 'react'
import { ArrowLeftRight, Trash2, Edit3, ChevronLeft, ChevronRight } from 'lucide-react'
import { db } from '@/db/database'
import { useTransactions, useCategories, useHourlyRate, usePrimaryCurrency } from '@/db/hooks'
import { formatCurrency, formatWorkTime } from '@/utils/currency'
import { calculateWorkTime } from '@/utils/calculations'
import { formatDate, getCurrentMonth, formatMonthShort } from '@/utils/date'
import { EmptyState } from '@/components/shared/EmptyState'
import { TransactionForm } from '@/components/transactions/TransactionForm'
import { format, subMonths, addMonths } from 'date-fns'
import type { Transaction, TransactionType } from '@/types'

export function TransactionsPage() {
  const [month, setMonth] = useState(getCurrentMonth())
  const [filterType, setFilterType] = useState<TransactionType | 'all'>('all')
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)

  const transactions = useTransactions(month)
  const categories = useCategories()
  const hourlyRate = useHourlyRate(month)
  const primaryCurrency = usePrimaryCurrency()
  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])

  const filtered = useMemo(() => {
    if (filterType === 'all') return transactions
    return transactions.filter((t) => t.type === filterType)
  }, [transactions, filterType])

  // Group by date
  const grouped = useMemo(() => {
    const map = new Map<string, Transaction[]>()
    for (const t of filtered) {
      const list = map.get(t.date) ?? []
      list.push(t)
      map.set(t.date, list)
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]))
  }, [filtered])

  const handleDelete = async (id: string) => {
    await db.transactions.delete(id)
  }

  const prevMonth = () => setMonth(format(subMonths(new Date(`${month}-01`), 1), 'yyyy-MM'))
  const nextMonth = () => setMonth(format(addMonths(new Date(`${month}-01`), 1), 'yyyy-MM'))

  return (
    <div className="pt-6 space-y-4">
      <h1 className="text-xl font-bold">Transactions</h1>

      {/* Month nav */}
      <div className="flex items-center justify-between bg-white dark:bg-slate-800 rounded-xl px-4 py-3">
        <button onClick={prevMonth} className="p-1"><ChevronLeft size={20} /></button>
        <span className="font-medium">{formatMonthShort(month)}</span>
        <button onClick={nextMonth} className="p-1"><ChevronRight size={20} /></button>
      </div>

      {/* Filter */}
      <div className="flex rounded-lg bg-white dark:bg-slate-800 p-1 gap-1">
        {(['all', 'income', 'expense', 'tax'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilterType(f)}
            className={`flex-1 py-2 text-sm rounded-md font-medium capitalize transition-colors ${
              filterType === f
                ? 'bg-primary text-white'
                : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* List */}
      {grouped.length === 0 ? (
        <EmptyState
          icon={<ArrowLeftRight size={48} />}
          title="No transactions"
          description="Tap + to add your first transaction"
        />
      ) : (
        <div className="space-y-4">
          {grouped.map(([date, txs]) => (
            <div key={date}>
              <h3 className="text-xs font-medium text-slate-400 dark:text-slate-500 mb-2 px-1">
                {formatDate(date)}
              </h3>
              <div className="bg-white dark:bg-slate-800 rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-700">
                {txs.map((tx) => {
                  const cat = catMap.get(tx.categoryId)
                  return (
                    <div key={tx.id} className="flex items-center px-4 py-3 gap-3">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                        style={{ backgroundColor: cat?.color ?? '#6b7280' }}
                      >
                        {(cat?.name ?? '?')[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{cat?.name ?? 'Unknown'}</div>
                        {tx.description && (
                          <div className="text-xs text-slate-400 truncate">{tx.description}</div>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <div className={`font-semibold text-sm ${
                          tx.type === 'income' ? 'text-income' :
                          tx.type === 'tax' ? 'text-tax' : 'text-expense'
                        }`}>
                          {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount, tx.currency)}
                        </div>
                        {tx.type === 'tax' && tx.taxType && (
                          <div className="text-[10px] font-medium text-amber-500">{tx.taxType}</div>
                        )}
                        {tx.type === 'expense' && (
                          <div className={`text-[10px] font-medium ${
                            tx.productivityTag === 'productive' ? 'text-emerald-500' :
                            tx.productivityTag === 'wasteful' ? 'text-red-400' : 'text-slate-400'
                          }`}>
                            {tx.productivityTag}
                          </div>
                        )}
                        {(tx.type === 'expense' || tx.type === 'tax') && hourlyRate > 0 && tx.currency === primaryCurrency && (
                          <div className="text-[10px] text-slate-400 dark:text-slate-500">
                            {formatWorkTime(calculateWorkTime(tx.amount, hourlyRate).totalMinutes)}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button
                          onClick={() => setEditingTx(tx)}
                          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(tx.id)}
                          className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {editingTx && (
        <TransactionForm
          editTransaction={editingTx}
          onClose={() => setEditingTx(null)}
        />
      )}
    </div>
  )
}
