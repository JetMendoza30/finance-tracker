import type { Transaction, TaxPayment, Category, Currency } from '@/types'

export interface MonthTotals {
  income: number
  expense: number
  tax: number
  net: number
}

export function getMonthTotals(transactions: Transaction[], currency?: Currency): MonthTotals {
  let income = 0
  let expense = 0
  let tax = 0
  for (const t of transactions) {
    if (currency && t.currency !== currency) continue
    if (t.type === 'income') income += t.amount
    else if (t.type === 'tax') tax += t.amount
    else expense += t.amount
  }
  return { income, expense, tax, net: income - expense - tax }
}

export interface CategoryBreakdown {
  categoryId: string
  category: Category | undefined
  total: number
  percentage: number
}

export function getCategoryBreakdown(
  transactions: Transaction[],
  categories: Category[],
  currency?: Currency,
): CategoryBreakdown[] {
  const map = new Map<string, number>()
  let total = 0

  for (const t of transactions) {
    if (t.type !== 'expense') continue
    if (currency && t.currency !== currency) continue
    map.set(t.categoryId, (map.get(t.categoryId) ?? 0) + t.amount)
    total += t.amount
  }

  const catMap = new Map(categories.map((c) => [c.id, c]))

  return Array.from(map.entries())
    .map(([categoryId, amount]) => ({
      categoryId,
      category: catMap.get(categoryId),
      total: amount,
      percentage: total > 0 ? (amount / total) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total)
}

export interface ProductivityBreakdown {
  productive: number
  neutral: number
  wasteful: number
  productivePercent: number
  neutralPercent: number
  wastefulPercent: number
}

export function getProductivityBreakdown(transactions: Transaction[], currency?: Currency): ProductivityBreakdown {
  let productive = 0
  let neutral = 0
  let wasteful = 0

  for (const t of transactions) {
    if (t.type !== 'expense') continue
    if (currency && t.currency !== currency) continue
    if (t.productivityTag === 'productive') productive += t.amount
    else if (t.productivityTag === 'wasteful') wasteful += t.amount
    else neutral += t.amount
  }

  const total = productive + neutral + wasteful
  return {
    productive,
    neutral,
    wasteful,
    productivePercent: total > 0 ? (productive / total) * 100 : 0,
    neutralPercent: total > 0 ? (neutral / total) * 100 : 0,
    wastefulPercent: total > 0 ? (wasteful / total) * 100 : 0,
  }
}

export interface MonthlyTrendItem {
  month: string
  income: number
  expense: number
}

export function getMonthlyTrend(transactions: Transaction[], months: string[], currency?: Currency): MonthlyTrendItem[] {
  return months.map((month) => {
    const filtered = transactions.filter((t) => t.date.startsWith(month))
    const totals = getMonthTotals(filtered, currency)
    return { month, income: totals.income, expense: totals.expense }
  })
}

export function getTaxYTD(taxPayments: TaxPayment[], transactions: Transaction[], year: string, currency?: Currency): number {
  const legacyTotal = taxPayments
    .filter((t) => t.date.startsWith(year) && (!currency || t.currency === currency))
    .reduce((sum, t) => sum + t.amount, 0)
  const txTaxTotal = transactions
    .filter((t) => t.type === 'tax' && t.date.startsWith(year) && (!currency || t.currency === currency))
    .reduce((sum, t) => sum + t.amount, 0)
  return legacyTotal + txTaxTotal
}

export function getEffectiveTaxRate(taxTotal: number, incomeTotal: number): number {
  if (incomeTotal <= 0) return 0
  return (taxTotal / incomeTotal) * 100
}

export function getBudgetSpent(transactions: Transaction[], categoryId: string, month: string, currency?: Currency): number {
  return transactions
    .filter(
      (t) =>
        t.type === 'expense' &&
        t.categoryId === categoryId &&
        t.date.startsWith(month) &&
        (!currency || t.currency === currency),
    )
    .reduce((sum, t) => sum + t.amount, 0)
}

export function getHourlyRate(monthlyIncome: number, workingHoursPerMonth: number, fallbackSalary: number): number {
  if (monthlyIncome > 0) return monthlyIncome / workingHoursPerMonth
  if (fallbackSalary > 0) return fallbackSalary / workingHoursPerMonth
  return 0
}

export interface WorkTime {
  hours: number
  minutes: number
  totalMinutes: number
}

export function calculateWorkTime(amount: number, hourlyRate: number): WorkTime {
  if (hourlyRate <= 0) return { hours: 0, minutes: 0, totalMinutes: 0 }
  const totalMinutes = (amount / hourlyRate) * 60
  const hours = Math.floor(totalMinutes / 60)
  const minutes = Math.round(totalMinutes % 60)
  return { hours, minutes, totalMinutes }
}
