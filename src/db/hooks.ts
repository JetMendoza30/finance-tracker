import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './database'
import type { Currency, CategoryType } from '@/types'
import { getMonthTotals, getHourlyRate } from '@/utils/calculations'

export function useTransactions(month?: string) {
  return useLiveQuery(async () => {
    let query = db.transactions.orderBy('date').reverse()
    if (month) {
      const start = `${month}-01`
      const end = `${month}-31`
      query = db.transactions.where('date').between(start, end, true, true).reverse()
    }
    return query.toArray()
  }, [month], [])
}

export function useCategories(type?: CategoryType) {
  return useLiveQuery(async () => {
    if (type) {
      return db.categories.where('type').equals(type).toArray()
    }
    return db.categories.toArray()
  }, [type], [])
}

export function useBudgets(month: string) {
  return useLiveQuery(
    () => db.budgets.where('month').equals(month).toArray(),
    [month],
    [],
  )
}

export function useTaxPayments(year?: string) {
  return useLiveQuery(async () => {
    if (year) {
      const start = `${year}-01-01`
      const end = `${year}-12-31`
      return db.taxPayments.where('date').between(start, end, true, true).reverse().toArray()
    }
    return db.taxPayments.orderBy('date').reverse().toArray()
  }, [year], [])
}

export function useSetting<T>(key: string, defaultValue: T): T {
  const result = useLiveQuery(
    () => db.settings.get(key),
    [key],
  )
  if (!result) return defaultValue
  try {
    return JSON.parse(result.value) as T
  } catch {
    return defaultValue
  }
}

export async function setSetting(key: string, value: unknown) {
  await db.settings.put({ key, value: JSON.stringify(value) })
}

export function usePrimaryCurrency(): Currency {
  return useSetting<Currency>('primaryCurrency', 'PHP')
}

export function useWorkingHoursPerMonth(): number {
  return useSetting<number>('workingHoursPerMonth', 160)
}

export function useFallbackMonthlySalary(): number {
  return useSetting<number>('fallbackMonthlySalary', 0)
}

export function useHourlyRate(month: string): number {
  const transactions = useTransactions(month)
  const currency = usePrimaryCurrency()
  const workingHours = useWorkingHoursPerMonth()
  const fallbackSalary = useFallbackMonthlySalary()

  return useMemo(() => {
    const totals = getMonthTotals(transactions, currency)
    return getHourlyRate(totals.income, workingHours, fallbackSalary)
  }, [transactions, currency, workingHours, fallbackSalary])
}
