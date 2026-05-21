export interface OcrResult {
  rawText: string
  amount: number | null
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

export function parseReceiptText(text: string): { amount: number | null; description: string | null } {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)

  // Find amounts near total-related keywords
  const totalKeywords = /total|amount\s*due|grand\s*total|balance\s*due|subtotal|sum|bayad|kabuuan/i
  const amountPattern = /[₱$]?\s*[\d,]+\.?\d{0,2}/g

  let bestAmount: number | null = null
  let fallbackAmount: number | null = null

  for (const line of lines) {
    const amounts = line.match(amountPattern)
    if (!amounts) continue

    for (const raw of amounts) {
      const cleaned = raw.replace(/[₱$,\s]/g, '')
      const value = parseFloat(cleaned)
      if (isNaN(value) || value <= 0) continue

      if (totalKeywords.test(line)) {
        if (bestAmount === null || value > bestAmount) {
          bestAmount = value
        }
      }
      if (fallbackAmount === null || value > fallbackAmount) {
        fallbackAmount = value
      }
    }
  }

  // Description: first non-numeric, non-trivial line (merchant name)
  let description: string | null = null
  for (const line of lines.slice(0, 5)) {
    const stripped = line.replace(/[^a-zA-Z\s]/g, '').trim()
    if (stripped.length >= 3) {
      description = line.slice(0, 50)
      break
    }
  }

  return {
    amount: bestAmount ?? fallbackAmount,
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
      description: parsed.description,
      confidence: data.confidence / 100,
    }
  } catch {
    return {
      rawText: '',
      amount: null,
      description: null,
      confidence: 0,
    }
  }
}
