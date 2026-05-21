export type Currency = 'PHP' | 'USD'

export type TransactionType = 'income' | 'expense'

export type ProductivityTag = 'productive' | 'neutral' | 'wasteful'

export type CategoryType = 'income' | 'expense'

export interface Transaction {
  id: string
  amount: number
  currency: Currency
  type: TransactionType
  categoryId: string
  date: string // YYYY-MM-DD
  description: string
  productivityTag: ProductivityTag
  receiptImage?: string // base64 data URL
  createdAt: number
}

export interface Category {
  id: string
  name: string
  type: CategoryType
  icon: string // lucide icon name
  color: string // hex
}

export interface Budget {
  id: string
  categoryId: string
  monthlyLimit: number
  currency: Currency
  month: string // YYYY-MM
}

export interface TaxPayment {
  id: string
  amount: number
  currency: Currency
  date: string // YYYY-MM-DD
  description: string
  taxType: string // withholding, quarterly, annual, other
  createdAt: number
}

export interface Setting {
  key: string
  value: string // JSON-serialized
}
