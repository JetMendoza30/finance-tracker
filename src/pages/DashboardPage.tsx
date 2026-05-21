import { useMemo } from 'react'
import { TrendingUp, TrendingDown, DollarSign, Clock, ArrowLeftRight } from 'lucide-react'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { useTransactions, useCategories, usePrimaryCurrency, useTaxPayments, useHourlyRate } from '@/db/hooks'
import { formatCurrency, formatCompact, formatWorkTime } from '@/utils/currency'
import { getCurrentMonth, getCurrentYear, getLastNMonths, formatMonthLabel, formatDate } from '@/utils/date'
import {
  getMonthTotals,
  getCategoryBreakdown,
  getProductivityBreakdown,
  getMonthlyTrend,
  getTaxYTD,
  getEffectiveTaxRate,
  calculateWorkTime,
} from '@/utils/calculations'
import { EmptyState } from '@/components/shared/EmptyState'

export function DashboardPage() {
  const currentMonth = getCurrentMonth()
  const currentYear = getCurrentYear()
  const currency = usePrimaryCurrency()
  const transactions = useTransactions(currentMonth)
  const allTransactions = useTransactions()
  const categories = useCategories()
  const taxPayments = useTaxPayments(currentYear)
  const hourlyRate = useHourlyRate(currentMonth)

  const totals = useMemo(() => getMonthTotals(transactions, currency), [transactions, currency])
  const categoryBreakdown = useMemo(() => getCategoryBreakdown(transactions, categories, currency), [transactions, categories, currency])
  const productivity = useMemo(() => getProductivityBreakdown(transactions, currency), [transactions, currency])
  const months = useMemo(() => getLastNMonths(6), [])
  const trend = useMemo(() => getMonthlyTrend(allTransactions, months, currency), [allTransactions, months, currency])
  const taxYTD = useMemo(() => getTaxYTD(taxPayments, currentYear, currency), [taxPayments, currentYear, currency])

  // YTD income for effective rate
  const ytdIncome = useMemo(() => {
    return allTransactions
      .filter((t) => t.type === 'income' && t.date.startsWith(currentYear) && t.currency === currency)
      .reduce((sum, t) => sum + t.amount, 0)
  }, [allTransactions, currentYear, currency])

  const effectiveRate = getEffectiveTaxRate(taxYTD, ytdIncome)

  const pieColors = categoryBreakdown.map((c) => c.category?.color ?? '#6b7280')

  return (
    <div className="pt-6 space-y-4 pb-4">
      <h1 className="text-xl font-bold">Dashboard</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-income mb-1">
            <TrendingUp size={16} />
            <span className="text-xs font-medium">Income</span>
          </div>
          <div className="text-lg font-bold">{formatCurrency(totals.income, currency)}</div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-expense mb-1">
            <TrendingDown size={16} />
            <span className="text-xs font-medium">Expenses</span>
          </div>
          <div className="text-lg font-bold">{formatCurrency(totals.expense, currency)}</div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-primary mb-1">
            <DollarSign size={16} />
            <span className="text-xs font-medium">Net Balance</span>
          </div>
          <div className={`text-lg font-bold ${totals.net >= 0 ? 'text-income' : 'text-expense'}`}>
            {formatCurrency(totals.net, currency)}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-tax mb-1">
            <span className="text-xs font-medium">Tax YTD</span>
          </div>
          <div className="text-lg font-bold">{formatCurrency(taxYTD, currency)}</div>
          <div className="text-xs text-slate-400 mt-0.5">Rate: {effectiveRate.toFixed(1)}%</div>
        </div>
      </div>

      {/* Work Hours Card */}
      {hourlyRate > 0 && totals.expense > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={16} className="text-primary" />
            <h2 className="text-sm font-medium text-slate-500 dark:text-slate-400">Work Hours This Month</h2>
          </div>
          <div className="text-lg font-bold">
            {formatWorkTime(calculateWorkTime(totals.expense, hourlyRate).totalMinutes)}
          </div>
          <div className="text-xs text-slate-400 mt-0.5">
            to cover {formatCurrency(totals.expense, currency)} in expenses &middot; {formatCurrency(hourlyRate, currency)}/hr
          </div>
        </div>
      )}

      {/* Spending by Category */}
      {categoryBreakdown.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4">
          <h2 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3">Spending by Category</h2>
          <div className="flex items-center gap-4">
            <div className="w-32 h-32 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryBreakdown}
                    dataKey="total"
                    nameKey="categoryId"
                    cx="50%"
                    cy="50%"
                    innerRadius={30}
                    outerRadius={55}
                    strokeWidth={2}
                    stroke="transparent"
                  >
                    {categoryBreakdown.map((_, i) => (
                      <Cell key={i} fill={pieColors[i]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-1.5 min-w-0">
              {categoryBreakdown.slice(0, 5).map((item) => (
                <div key={item.categoryId} className="flex items-center gap-2 text-sm">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.category?.color }} />
                  <span className="truncate flex-1">{item.category?.name ?? 'Unknown'}</span>
                  <span className="font-medium shrink-0">{item.percentage.toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Monthly Trend */}
      {trend.some((t) => t.income > 0 || t.expense > 0) && (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4">
          <h2 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3">Monthly Trend</h2>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trend} barGap={2}>
                <XAxis dataKey="month" tickFormatter={formatMonthLabel} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => formatCompact(v, currency)} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={50} />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value, currency)}
                  labelFormatter={formatMonthLabel}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Bar dataKey="income" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Productivity Breakdown */}
      {(productivity.productive > 0 || productivity.neutral > 0 || productivity.wasteful > 0) && (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4">
          <h2 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3">Spending Productivity</h2>
          <div className="space-y-3">
            {[
              { label: 'Productive', pct: productivity.productivePercent, amount: productivity.productive, color: 'bg-emerald-500' },
              { label: 'Neutral', pct: productivity.neutralPercent, amount: productivity.neutral, color: 'bg-slate-400' },
              { label: 'Wasteful', pct: productivity.wastefulPercent, amount: productivity.wasteful, color: 'bg-red-500' },
            ].map((item) => (
              <div key={item.label}>
                <div className="flex justify-between text-sm mb-1">
                  <span>{item.label}</span>
                  <span className="font-medium">{item.pct.toFixed(0)}% &middot; {formatCurrency(item.amount, currency)}</span>
                </div>
                <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div className={`h-full ${item.color} rounded-full transition-all`} style={{ width: `${item.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Transactions */}
      {transactions.length > 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4">
          <h2 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3">Recent Transactions</h2>
          <div className="space-y-2">
            {transactions.slice(0, 5).map((tx) => {
              const cat = categories.find((c) => c.id === tx.categoryId)
              return (
                <div key={tx.id} className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                    style={{ backgroundColor: cat?.color ?? '#6b7280' }}
                  >
                    {(cat?.name ?? '?')[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{cat?.name ?? 'Unknown'}</div>
                    <div className="text-xs text-slate-400">{formatDate(tx.date)}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`text-sm font-semibold ${tx.type === 'income' ? 'text-income' : 'text-expense'}`}>
                      {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount, tx.currency)}
                    </div>
                    {tx.type === 'expense' && hourlyRate > 0 && tx.currency === currency && (
                      <div className="text-[10px] text-slate-400 dark:text-slate-500">
                        {formatWorkTime(calculateWorkTime(tx.amount, hourlyRate).totalMinutes)}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <EmptyState
          icon={<ArrowLeftRight size={48} />}
          title="No data yet"
          description="Add transactions to see your financial overview"
        />
      )}
    </div>
  )
}
