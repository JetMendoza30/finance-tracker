export interface OcrResult {
  rawText: string
  amount: number | null
  netAmount: number | null
  vatAmount: number | null
  date: string | null // YYYY-MM-DD
  receiptNumber: string | null
  description: string | null
  confidence: number
}

export function compressImage(dataUrl: string, maxSize = 800): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      let { width, height } = img

      if (width > maxSize || height > maxSize) {
        if (width > height) {
          height = Math.round((height / width) * maxSize)
          width = maxSize
        } else {
          width = Math.round((width / height) * maxSize)
          height = maxSize
        }
      }

      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, width, height)
      resolve(canvas.toDataURL('image/jpeg', 0.7))
    }
    img.src = dataUrl
  })
}

// --- Flexible keyword patterns for different receipt formats and languages ---

// Total / Grand total — the final amount to pay
const TOTAL_KEYWORDS = /\b(total|grand\s*total|amount\s*due|balance\s*due|total\s*due|total\s*amount|amount\s*payable|net\s*payable|total\s*bayad|kabuuang\s*halaga|kabuuan|totale|montant|gesamt|合計|합계)\b/i

// Net / Subtotal — amount before tax
const NET_KEYWORDS = /\b(net|subtotal|sub\s*total|net\s*amount|net\s*total|taxable\s*amount|taxable\s*sales|vatable\s*sales|vatable\s*amount|amount\s*before\s*tax|before\s*vat|halaga\s*bago\s*buwis)\b/i

// VAT / Tax on receipt
const VAT_KEYWORDS = /\b(vat|tax|vat\s*amount|tax\s*amount|sales\s*tax|value\s*added|output\s*tax|vat\s*12|vat\s*\d+|buwis|impuesto|gst|hst|tvq|tva|mwst|消費税)\b/i

// Receipt / Invoice number
const RECEIPT_NUM_KEYWORDS = /\b(receipt\s*#?|receipt\s*no\.?|receipt\s*number|invoice\s*#?|invoice\s*no\.?|or\s*#?|or\s*no\.?|official\s*receipt|si\s*#?|si\s*no\.?|sales\s*invoice|trans(?:action)?\s*#?|trans(?:action)?\s*no\.?|ref(?:erence)?\s*#?|ref(?:erence)?\s*no\.?|order\s*#?|order\s*no\.?|ticket\s*#?|numero|beleg)\b/i

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3,
  apr: 4, april: 4, may: 5, jun: 6, june: 6,
  jul: 7, july: 7, aug: 8, august: 8, sep: 9, september: 9,
  oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
}

function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/[₱$PHP,USD\s]/gi, '')
  const value = parseFloat(cleaned)
  return isNaN(value) || value <= 0 ? null : value
}

function extractAmountFromLine(line: string): number | null {
  // Match currency amounts: ₱1,234.56 or $50.00 or PHP 1234 or just 1,234.56
  const matches = line.match(/[₱$]?\s*(?:PHP|USD)?\s*[\d,]+\.?\d{0,2}/gi)
  if (!matches) return null

  let best: number | null = null
  for (const raw of matches) {
    const val = parseAmount(raw)
    if (val !== null && (best === null || val > best)) {
      best = val
    }
  }
  return best
}

function extractDate(lines: string[]): string | null {
  for (const line of lines) {
    // YYYY-MM-DD or YYYY/MM/DD
    const iso = line.match(/(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})/)
    if (iso) {
      const [, y, m, d] = iso
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
    }

    // MM/DD/YYYY or DD/MM/YYYY
    const mdy = line.match(/(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/)
    if (mdy) {
      const [, a, b, y] = mdy
      const aNum = parseInt(a), bNum = parseInt(b)
      // If first number > 12, it's DD/MM/YYYY
      if (aNum > 12 && bNum <= 12) {
        return `${y}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`
      }
      // Default: MM/DD/YYYY
      return `${y}-${a.padStart(2, '0')}-${b.padStart(2, '0')}`
    }

    // Month name formats: "May 21, 2026" or "21 May 2026"
    const named1 = line.match(/(\w{3,9})\s+(\d{1,2}),?\s+(\d{4})/)
    if (named1) {
      const m = MONTHS[named1[1].toLowerCase()]
      if (m) return `${named1[3]}-${String(m).padStart(2, '0')}-${named1[2].padStart(2, '0')}`
    }
    const named2 = line.match(/(\d{1,2})\s+(\w{3,9})\s+(\d{4})/)
    if (named2) {
      const m = MONTHS[named2[2].toLowerCase()]
      if (m) return `${named2[3]}-${String(m).padStart(2, '0')}-${named2[1].padStart(2, '0')}`
    }
  }
  return null
}

function extractReceiptNumber(lines: string[]): string | null {
  for (const line of lines) {
    if (RECEIPT_NUM_KEYWORDS.test(line)) {
      // Extract the number/code after the keyword
      const after = line.replace(RECEIPT_NUM_KEYWORDS, '').trim()
      const numMatch = after.match(/[:#\s]*([A-Z0-9][\w\-]{2,20})/i)
      if (numMatch) return numMatch[1]
    }
  }
  return null
}

export interface ParsedReceipt {
  amount: number | null
  netAmount: number | null
  vatAmount: number | null
  date: string | null
  receiptNumber: string | null
  description: string | null
}

export function parseReceiptText(text: string): ParsedReceipt {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)

  let totalAmount: number | null = null
  let netAmount: number | null = null
  let vatAmount: number | null = null
  let fallbackLargest: number | null = null

  for (const line of lines) {
    const lineAmount = extractAmountFromLine(line)
    if (lineAmount === null) continue

    // Categorize by keyword match — check most specific first
    if (VAT_KEYWORDS.test(line)) {
      if (vatAmount === null || lineAmount > vatAmount) vatAmount = lineAmount
    } else if (NET_KEYWORDS.test(line)) {
      if (netAmount === null || lineAmount > netAmount) netAmount = lineAmount
    } else if (TOTAL_KEYWORDS.test(line)) {
      if (totalAmount === null || lineAmount > totalAmount) totalAmount = lineAmount
    }

    // Track the largest number as fallback
    if (fallbackLargest === null || lineAmount > fallbackLargest) {
      fallbackLargest = lineAmount
    }
  }

  // If we found net + vat but no total, compute total
  if (totalAmount === null && netAmount !== null && vatAmount !== null) {
    totalAmount = netAmount + vatAmount
  }

  // If we found total + vat but no net, derive net
  if (netAmount === null && totalAmount !== null && vatAmount !== null) {
    netAmount = totalAmount - vatAmount
  }

  // If we found total + net but no vat, derive vat
  if (vatAmount === null && totalAmount !== null && netAmount !== null && totalAmount > netAmount) {
    vatAmount = totalAmount - netAmount
  }

  // Description: first non-numeric, non-trivial line (merchant name)
  let description: string | null = null
  for (const line of lines.slice(0, 8)) {
    // Skip lines that are mostly numbers, dates, or receipt keywords
    if (RECEIPT_NUM_KEYWORDS.test(line)) continue
    if (/^\d/.test(line) && /\d$/.test(line)) continue
    const stripped = line.replace(/[^a-zA-ZÀ-ÿ\s]/g, '').trim()
    if (stripped.length >= 3) {
      description = line.slice(0, 60)
      break
    }
  }

  return {
    amount: totalAmount ?? fallbackLargest,
    netAmount,
    vatAmount,
    date: extractDate(lines),
    receiptNumber: extractReceiptNumber(lines),
    description,
  }
}

export async function recognizeReceipt(imageDataUrl: string): Promise<OcrResult> {
  try {
    const Tesseract = await import('tesseract.js')
    const worker = await Tesseract.createWorker('eng')
    const { data } = await worker.recognize(imageDataUrl)
    await worker.terminate()

    const parsed = parseReceiptText(data.text)

    return {
      rawText: data.text,
      amount: parsed.amount,
      netAmount: parsed.netAmount,
      vatAmount: parsed.vatAmount,
      date: parsed.date,
      receiptNumber: parsed.receiptNumber,
      description: parsed.description,
      confidence: data.confidence / 100,
    }
  } catch {
    return {
      rawText: '',
      amount: null,
      netAmount: null,
      vatAmount: null,
      date: null,
      receiptNumber: null,
      description: null,
      confidence: 0,
    }
  }
}
