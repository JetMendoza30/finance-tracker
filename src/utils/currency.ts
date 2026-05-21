import type { Currency } from '@/types'

const formatters: Record<Currency, Intl.NumberFormat> = {
  PHP: new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }),
  USD: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }),
}

export function formatCurrency(amount: number, currency: Currency): string {
  return formatters[currency].format(amount)
}

export function formatCompact(amount: number, currency: Currency): string {
  const symbol = currency === 'PHP' ? '\u20B1' : '$'
  if (amount >= 1_000_000) return `${symbol}${(amount / 1_000_000).toFixed(1)}M`
  if (amount >= 1_000) return `${symbol}${(amount / 1_000).toFixed(1)}K`
  return `${symbol}${amount.toFixed(0)}`
}

export function formatWorkTime(totalMinutes: number): string {
  if (totalMinutes < 1) return '<1 min of work'
  if (totalMinutes < 60) return `${Math.round(totalMinutes)} min of work`
  const hours = totalMinutes / 60
  if (hours < 24) return `${hours.toFixed(1)} hrs of work`
  const days = hours / 8
  return `${days.toFixed(1)} days of work`
}
