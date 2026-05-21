import { useState, useRef } from 'react'
import { Camera, X, Loader2 } from 'lucide-react'
import { Modal } from '@/components/shared/Modal'
import { db } from '@/db/database'
import { useCategories, usePrimaryCurrency, useHourlyRate } from '@/db/hooks'
import { getCurrentMonth, getToday } from '@/utils/date'
import { formatWorkTime } from '@/utils/currency'
import { calculateWorkTime } from '@/utils/calculations'
import { compressImage, recognizeReceipt } from '@/utils/ocr'
import type { Transaction, TransactionType, ProductivityTag, Currency } from '@/types'

const TAX_TYPES = ['Withholding', 'Quarterly', 'Annual', 'Other']

interface TransactionFormProps {
  onClose: () => void
  editTransaction?: Transaction
}

export function TransactionForm({ onClose, editTransaction }: TransactionFormProps) {
  const primaryCurrency = usePrimaryCurrency()
  const hourlyRate = useHourlyRate(getCurrentMonth())
  const [type, setType] = useState<TransactionType>(editTransaction?.type ?? 'expense')
  const categories = useCategories(type)
  const [amount, setAmount] = useState(editTransaction?.amount?.toString() ?? '')
  const [currency, setCurrency] = useState<Currency>(editTransaction?.currency ?? primaryCurrency)
  const [categoryId, setCategoryId] = useState(editTransaction?.categoryId ?? '')
  const [date, setDate] = useState(editTransaction?.date ?? getToday())
  const [description, setDescription] = useState(editTransaction?.description ?? '')
  const [productivityTag, setProductivityTag] = useState<ProductivityTag>(editTransaction?.productivityTag ?? 'neutral')
  const [taxType, setTaxType] = useState(editTransaction?.taxType ?? 'Withholding')
  const [receiptImage, setReceiptImage] = useState<string | null>(editTransaction?.receiptImage ?? null)
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrDetails, setOcrDetails] = useState<{ netAmount?: number; vatAmount?: number; receiptNumber?: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const parsedAmount = parseFloat(amount)
  const showWorkTime = (type === 'expense' || type === 'tax') && hourlyRate > 0 && !isNaN(parsedAmount) && parsedAmount > 0 && currency === primaryCurrency

  const handleReceiptCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async () => {
      const dataUrl = reader.result as string
      const compressed = await compressImage(dataUrl)
      setReceiptImage(compressed)

      setOcrLoading(true)
      const result = await recognizeReceipt(compressed)
      setOcrLoading(false)

      if (result.amount !== null && !amount) {
        setAmount(result.amount.toString())
      }
      if (result.description && !description) {
        setDescription(result.description)
      }
      if (result.date) {
        setDate(result.date)
      }

      // Store extracted details for display
      setOcrDetails({
        netAmount: result.netAmount ?? undefined,
        vatAmount: result.vatAmount ?? undefined,
        receiptNumber: result.receiptNumber ?? undefined,
      })
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = parseFloat(amount)
    if (!parsed || !categoryId) return

    const data: Transaction = {
      id: editTransaction?.id ?? crypto.randomUUID(),
      amount: parsed,
      currency,
      type,
      categoryId,
      date,
      description,
      productivityTag: type === 'expense' ? productivityTag : 'neutral',
      ...(type === 'tax' ? { taxType } : {}),
      ...(receiptImage ? { receiptImage } : {}),
      createdAt: editTransaction?.createdAt ?? Date.now(),
    }

    await db.transactions.put(data)
    onClose()
  }

  const typeConfig: { value: TransactionType; label: string; activeClass: string }[] = [
    { value: 'income', label: 'Income', activeClass: 'bg-emerald-500 text-white' },
    { value: 'expense', label: 'Expense', activeClass: 'bg-red-500 text-white' },
    { value: 'tax', label: 'Tax', activeClass: 'bg-amber-500 text-white' },
  ]

  const tagOptions: { value: ProductivityTag; label: string; color: string }[] = [
    { value: 'productive', label: 'Productive', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
    { value: 'neutral', label: 'Neutral', color: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300' },
    { value: 'wasteful', label: 'Wasteful', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  ]

  return (
    <Modal title={editTransaction ? 'Edit Transaction' : 'Add Transaction'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Type toggle */}
        <div className="flex rounded-lg bg-slate-100 dark:bg-slate-700 p-1">
          {typeConfig.map(({ value, label, activeClass }) => (
            <button
              key={value}
              type="button"
              onClick={() => { setType(value); setCategoryId('') }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                type === value ? activeClass : 'text-slate-500'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Amount + Currency */}
        <div>
          <div className="flex gap-2">
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="flex-1 px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
            <div className="flex rounded-lg bg-slate-100 dark:bg-slate-700 p-1">
              {(['PHP', 'USD'] as Currency[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCurrency(c)}
                  className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    currency === c ? 'bg-white dark:bg-slate-600 shadow-sm' : 'text-slate-500'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          {showWorkTime && (
            <div className="text-xs text-slate-400 dark:text-slate-500 mt-1 px-1">
              {formatWorkTime(calculateWorkTime(parsedAmount, hourlyRate).totalMinutes)}
            </div>
          )}
        </div>

        {/* Category */}
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-primary"
          required
        >
          <option value="">Select category</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>

        {/* Tax type selector */}
        {type === 'tax' && (
          <div className="flex rounded-lg bg-slate-100 dark:bg-slate-700 p-1">
            {TAX_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTaxType(t)}
                className={`flex-1 py-2 text-xs font-medium rounded-md transition-colors ${
                  taxType === t ? 'bg-white dark:bg-slate-600 shadow-sm' : 'text-slate-500'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        )}

        {/* Date */}
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-primary"
        />

        {/* Description */}
        <input
          type="text"
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-primary"
        />

        {/* Receipt capture */}
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleReceiptCapture}
            className="hidden"
          />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 text-sm text-slate-500 hover:border-primary hover:text-primary transition-colors"
            >
              <Camera size={16} />
              {receiptImage ? 'Change receipt' : 'Scan receipt'}
            </button>
            {receiptImage && (
              <div className="relative">
                <img
                  src={receiptImage}
                  alt="Receipt"
                  className="w-12 h-12 rounded-lg object-cover border border-slate-200 dark:border-slate-600"
                />
                {ocrLoading && (
                  <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                    <Loader2 size={16} className="text-white animate-spin" />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => { setReceiptImage(null); setOcrDetails(null) }}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center"
                >
                  <X size={10} />
                </button>
              </div>
            )}
          </div>
          {/* OCR extracted details */}
          {ocrDetails && (ocrDetails.netAmount || ocrDetails.vatAmount || ocrDetails.receiptNumber) && (
            <div className="mt-2 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-700/50 text-xs space-y-1">
              {ocrDetails.receiptNumber && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Receipt #</span>
                  <span className="font-medium">{ocrDetails.receiptNumber}</span>
                </div>
              )}
              {ocrDetails.netAmount != null && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Net amount</span>
                  <span className="font-medium">{currency === 'PHP' ? '₱' : '$'}{ocrDetails.netAmount.toFixed(2)}</span>
                </div>
              )}
              {ocrDetails.vatAmount != null && (
                <div className="flex justify-between">
                  <span className="text-slate-400">VAT / Tax</span>
                  <span className="font-medium">{currency === 'PHP' ? '₱' : '$'}{ocrDetails.vatAmount.toFixed(2)}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Productivity tag — only for expenses */}
        {type === 'expense' && (
          <div>
            <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">Productivity</label>
            <div className="flex gap-2">
              {tagOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setProductivityTag(opt.value)}
                  className={`flex-1 py-2 text-sm rounded-lg transition-all ${
                    productivityTag === opt.value
                      ? `${opt.color} ring-2 ring-offset-1 ring-current`
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-400'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          className="w-full py-3 rounded-lg bg-primary text-white font-medium hover:bg-primary-dark active:scale-[0.98] transition-all"
        >
          {editTransaction ? 'Update' : 'Add Transaction'}
        </button>
      </form>
    </Modal>
  )
}
