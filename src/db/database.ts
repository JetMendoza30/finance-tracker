import Dexie, { type Table } from 'dexie'
import type { Transaction, Category, Budget, TaxPayment, Setting } from '@/types'

export class FinanceDB extends Dexie {
  transactions!: Table<Transaction>
  categories!: Table<Category>
  budgets!: Table<Budget>
  taxPayments!: Table<TaxPayment>
  settings!: Table<Setting>

  constructor() {
    super('finance-tracker')
    this.version(1).stores({
      transactions: 'id, type, categoryId, date, currency, productivityTag, createdAt',
      categories: 'id, type',
      budgets: 'id, categoryId, month, [categoryId+month]',
      taxPayments: 'id, date, taxType, createdAt',
      settings: 'key',
    })
  }
}

export const db = new FinanceDB()
