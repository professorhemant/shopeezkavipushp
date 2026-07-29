/**
 * GST calculation utilities for frontend
 */

export const GST_RATES = [0, 5, 12, 18, 28]

/**
 * Calculate GST for a single item
 */
export function calculateItemGST({ price, quantity, discount = 0, discountType = 'percent', taxRate = 18, taxType = 'exclusive', isInterstate = false }) {
  let baseAmount = parseFloat(price) * parseFloat(quantity)

  // Apply discount
  let discountAmount = 0
  if (discountType === 'percent') {
    discountAmount = (baseAmount * parseFloat(discount)) / 100
  } else {
    discountAmount = parseFloat(discount)
  }
  baseAmount -= discountAmount

  let taxableAmount, cgst, sgst, igst, total

  if (taxType === 'inclusive') {
    taxableAmount = baseAmount / (1 + taxRate / 100)
    const taxAmount = baseAmount - taxableAmount
    if (isInterstate) {
      cgst = 0; sgst = 0; igst = taxAmount
    } else {
      cgst = taxAmount / 2; sgst = taxAmount / 2; igst = 0
    }
    total = baseAmount
  } else {
    taxableAmount = baseAmount
    const taxAmount = (baseAmount * taxRate) / 100
    if (isInterstate) {
      cgst = 0; sgst = 0; igst = taxAmount
    } else {
      cgst = taxAmount / 2; sgst = taxAmount / 2; igst = 0
    }
    total = baseAmount + taxAmount
  }

  return {
    baseAmount: round2(parseFloat(price) * parseFloat(quantity)),
    discountAmount: round2(discountAmount),
    taxableAmount: round2(taxableAmount),
    cgstRate: isInterstate ? 0 : taxRate / 2,
    sgstRate: isInterstate ? 0 : taxRate / 2,
    igstRate: isInterstate ? taxRate : 0,
    cgst: round2(cgst),
    sgst: round2(sgst),
    igst: round2(igst),
    taxAmount: round2(cgst + sgst + igst),
    total: round2(total),
  }
}

/**
 * Calculate invoice totals from items array
 */
export function calculateInvoiceTotals(items, { discountType = 'percent', discount = 0, shippingCharges = 0, otherCharges = 0, tcsRate = 0, isInterstate = false } = {}) {
  const subtotal = items.reduce((s, i) => s + (parseFloat(i.baseAmount) || 0), 0)

  let invoiceDiscount = 0
  if (discountType === 'percent') {
    invoiceDiscount = (subtotal * parseFloat(discount)) / 100
  } else {
    invoiceDiscount = parseFloat(discount)
  }

  const taxableAmount = items.reduce((s, i) => s + (parseFloat(i.taxableAmount) || 0), 0) - invoiceDiscount
  const cgst = isInterstate ? 0 : items.reduce((s, i) => s + (parseFloat(i.cgst) || 0), 0)
  const sgst = isInterstate ? 0 : items.reduce((s, i) => s + (parseFloat(i.sgst) || 0), 0)
  const igst = isInterstate ? items.reduce((s, i) => s + (parseFloat(i.igst) || 0) + (parseFloat(i.cgst) || 0) + (parseFloat(i.sgst) || 0), 0) : 0
  const totalTax = cgst + sgst + igst

  const beforeTCS = taxableAmount + totalTax + parseFloat(shippingCharges || 0) + parseFloat(otherCharges || 0)
  const tcsAmount = (beforeTCS * parseFloat(tcsRate || 0)) / 100
  const grandTotal = beforeTCS + tcsAmount

  // Round off
  const roundedTotal = Math.round(grandTotal)
  const roundOff = round2(roundedTotal - grandTotal)

  return {
    subtotal: round2(subtotal),
    discountAmount: round2(invoiceDiscount),
    taxableAmount: round2(taxableAmount),
    cgst: round2(cgst),
    sgst: round2(sgst),
    igst: round2(igst),
    totalTax: round2(totalTax),
    shippingCharges: round2(parseFloat(shippingCharges || 0)),
    otherCharges: round2(parseFloat(otherCharges || 0)),
    tcsAmount: round2(tcsAmount),
    roundOff,
    grandTotal: roundedTotal,
  }
}

const round2 = (n) => Math.round(parseFloat(n || 0) * 100) / 100
