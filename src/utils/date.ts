import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'

export function getCurrentMonth(): string {
  return format(new Date(), 'yyyy-MM')
}

export function getCurrentYear(): string {
  return format(new Date(), 'yyyy')
}

export function getToday(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

export function formatDate(dateStr: string): string {
  return format(new Date(dateStr), 'MMM d, yyyy')
}

export function formatMonthShort(month: string): string {
  return format(new Date(`${month}-01`), 'MMM yyyy')
}

export function formatMonthLabel(month: string): string {
  return format(new Date(`${month}-01`), 'MMM')
}

export function getLastNMonths(n: number): string[] {
  const months: string[] = []
  const now = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const d = subMonths(now, i)
    months.push(format(d, 'yyyy-MM'))
  }
  return months
}

export function getMonthRange(month: string): { start: string; end: string } {
  const date = new Date(`${month}-01`)
  return {
    start: format(startOfMonth(date), 'yyyy-MM-dd'),
    end: format(endOfMonth(date), 'yyyy-MM-dd'),
  }
}
