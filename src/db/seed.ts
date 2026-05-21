import { db } from './database'
import type { Category, Setting } from '@/types'

const DEFAULT_CATEGORIES: Category[] = [
  // Expense
  { id: 'food', name: 'Food & Dining', type: 'expense', icon: 'utensils', color: '#ef4444' },
  { id: 'transport', name: 'Transportation', type: 'expense', icon: 'car', color: '#f97316' },
  { id: 'housing', name: 'Housing & Rent', type: 'expense', icon: 'home', color: '#eab308' },
  { id: 'utilities', name: 'Utilities', type: 'expense', icon: 'zap', color: '#84cc16' },
  { id: 'health', name: 'Health', type: 'expense', icon: 'heart-pulse', color: '#22c55e' },
  { id: 'entertainment', name: 'Entertainment', type: 'expense', icon: 'gamepad-2', color: '#06b6d4' },
  { id: 'shopping', name: 'Shopping', type: 'expense', icon: 'shopping-bag', color: '#3b82f6' },
  { id: 'education', name: 'Education', type: 'expense', icon: 'book-open', color: '#8b5cf6' },
  { id: 'subscriptions', name: 'Subscriptions', type: 'expense', icon: 'repeat', color: '#a855f7' },
  { id: 'other-expense', name: 'Other', type: 'expense', icon: 'circle-ellipsis', color: '#6b7280' },
  // Income
  { id: 'salary', name: 'Salary', type: 'income', icon: 'briefcase', color: '#10b981' },
  { id: 'freelance', name: 'Freelance', type: 'income', icon: 'laptop', color: '#14b8a6' },
  { id: 'investment', name: 'Investments', type: 'income', icon: 'trending-up', color: '#0ea5e9' },
  { id: 'other-income', name: 'Other Income', type: 'income', icon: 'plus-circle', color: '#6366f1' },
]

const DEFAULT_SETTINGS: Setting[] = [
  { key: 'primaryCurrency', value: JSON.stringify('PHP') },
  { key: 'theme', value: JSON.stringify('system') },
  { key: 'workingHoursPerMonth', value: JSON.stringify(160) },
  { key: 'fallbackMonthlySalary', value: JSON.stringify(0) },
]

export async function seedDatabase() {
  const count = await db.categories.count()
  if (count === 0) {
    await db.transaction('rw', [db.categories, db.settings], async () => {
      await db.categories.bulkAdd(DEFAULT_CATEGORIES)
      await db.settings.bulkPut(DEFAULT_SETTINGS)
    })
    return
  }

  // Ensure new settings exist for existing users
  for (const setting of DEFAULT_SETTINGS) {
    const exists = await db.settings.get(setting.key)
    if (!exists) {
      await db.settings.put(setting)
    }
  }
}
