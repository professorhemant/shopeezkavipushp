import { forwardRef } from 'react'
import { formatCurrency } from '../../utils/formatters'
import InvoiceLetterhead from '../../components/InvoiceLetterhead'
import { LEHENGA_BRAND, LEHENGA_FIRM } from '../../utils/brand'

export const fmtDate = (d) => {
  if (!d) return '—'
  const [y, m, day] = String(d).split('T')[0].split('-')
  return `${day}/${m}/${y}`
}

/**
 * The GST maths, in one place. The sale form previews these numbers and the
 * server recomputes the identical formula on save, so the printed bill, the
 * saved row and the preview can never disagree.
 */
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100

export const computeSaleTotals = (src) => {
  const quantity = Math.max(1, parseInt(src?.quantity, 10) || 1)
  const unitPrice = Math.max(0, parseFloat(src?.unit_price) || 0)
  const discount = Math.max(0, parseFloat(src?.discount) || 0)
  const gstRate = src?.gst_rate === '' || src?.gst_rate == null ? 5 : Math.max(0, parseFloat(src.gst_rate) || 0)

  const gross = round2(unitPrice * quantity)
  const taxable = round2(Math.max(0, gross - discount))
  // Intra-state sale: the rate splits evenly into CGST + SGST (rate/200 each)
  const half = round2((taxable * gstRate) / 200)
  const total = round2(taxable + half * 2)
  const paid = Math.max(0, parseFloat(src?.amount_paid) || 0)

  return { quantity, unitPrice, discount, gstRate, gross, taxable, cgst: half, sgst: half, total, paid, balance: round2(total - paid) }
}

export const TERMS = [
  'Goods once sold will not be taken back or exchanged.',
  'Please check the garment for fit, stitching and finish at the time of purchase.',
  'Any alteration requested after purchase is chargeable.',
  'Colour variation between the display piece and the delivered piece may occur due to lighting and screen differences.',
  'This is a computer-generated tax invoice; GST is charged as per applicable rates.',
  'Warranty or guarantee is not applicable on rented or discounted merchandise.',
  'All disputes are subject to local jurisdiction.',
]

/**
 * Presentational, print-ready lehenga tax invoice with a CGST/SGST breakup.
 */
const LehengaSaleInvoiceDocument = forwardRef(function LehengaSaleInvoiceDocument({ inv, firm }, ref) {
  const t = computeSaleTotals(inv)
  const displayNo = inv?.invoice_no || '—'
  const dateStr = fmtDate(inv?.sale_date || new Date().toISOString())
  const halfRate = t.gstRate / 2

  return (
    <div ref={ref} className="bg-white p-6 sm:p-8 text-slate-800" style={{ maxWidth: 800, margin: '0 auto' }}>
      <InvoiceLetterhead firm={firm} name={LEHENGA_BRAND}
        legalName={LEHENGA_FIRM.legal_name} gstin={LEHENGA_FIRM.gstin} pan={LEHENGA_FIRM.pan} />

      <div className="text-center mt-4">
        <h3 className="font-bold tracking-wide">TAX INVOICE — LEHENGA SALE</h3>
        <p className="text-xs text-slate-500 mt-1">Invoice #: {displayNo} | Date: {dateStr}</p>
      </div>

      {/* Bill To + photo */}
      <div className="grid grid-cols-3 gap-4 mt-5 text-sm items-start">
        <div>
          <p className="text-amber-700 font-semibold mb-1">Bill To</p>
          <p className="font-semibold">{inv?.customer_name || '—'}</p>
          <p>{inv?.mobile_no || '—'}</p>
          {inv?.address && <p className="text-xs text-slate-500">{inv.address}</p>}
          {inv?.gstin && <p className="text-xs"><span className="font-medium">GSTIN:</span> {inv.gstin}</p>}
          {inv?.aadhaar_no && <p className="text-xs text-slate-500">{inv.aadhaar_no}</p>}
        </div>
        <div className="flex justify-center">
          {inv?.lehenga_image && (
            <img src={inv.lehenga_image} alt="Lehenga" className="max-h-40 rounded-lg border border-slate-200" />
          )}
        </div>
        <div>
          <p className="text-amber-700 font-semibold mb-1">Invoice Details</p>
          <p><span className="font-medium">Date:</span> {dateStr}</p>
          <p><span className="font-medium">Payment:</span> {(inv?.payment_mode || 'cash').toUpperCase()}</p>
          {/* Place of Supply is what justifies charging CGST+SGST instead of IGST */}
          {LEHENGA_FIRM.state && (
            <p>
              <span className="font-medium">Place of Supply:</span> {LEHENGA_FIRM.state}
              {LEHENGA_FIRM.state_code ? ` (${LEHENGA_FIRM.state_code})` : ''}
            </p>
          )}
          {inv?.salesperson && <p><span className="font-medium">Sold by:</span> {inv.salesperson}</p>}
        </div>
      </div>

      {/* Item line */}
      <table className="w-full text-sm mt-5">
        <thead>
          <tr className="bg-slate-100 text-slate-600 text-xs">
            <th className="text-left px-3 py-2">Description</th>
            <th className="text-left px-3 py-2">HSN</th>
            <th className="text-left px-3 py-2">Size / Colour</th>
            <th className="text-right px-3 py-2">Qty</th>
            <th className="text-right px-3 py-2">Rate</th>
            <th className="text-right px-3 py-2">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-slate-100">
            <td className="px-3 py-2">
              {inv?.name || '—'}
              {inv?.code && <span className="text-xs text-slate-400"> ({inv.code})</span>}
              {inv?.category && <div className="text-xs text-slate-500">{inv.category}</div>}
            </td>
            <td className="px-3 py-2">{inv?.hsn_code || '6204'}</td>
            <td className="px-3 py-2">{[inv?.size, inv?.colour].filter(Boolean).join(' / ') || '—'}</td>
            <td className="px-3 py-2 text-right">{t.quantity}</td>
            <td className="px-3 py-2 text-right">{formatCurrency(t.unitPrice)}</td>
            <td className="px-3 py-2 text-right">{formatCurrency(t.gross)}</td>
          </tr>
        </tbody>
      </table>

      {/* Totals */}
      <div className="flex justify-end mt-4">
        <div className="w-full sm:w-80 text-sm">
          <div className="flex justify-between py-1"><span className="text-slate-600">Gross Amount</span><span>{formatCurrency(t.gross)}</span></div>
          {t.discount > 0 && (
            <div className="flex justify-between py-1 text-red-600"><span>Less: Discount</span><span>− {formatCurrency(t.discount)}</span></div>
          )}
          <div className="flex justify-between py-1 border-t border-slate-200 font-semibold">
            <span>Taxable Value</span><span>{formatCurrency(t.taxable)}</span>
          </div>
          <div className="flex justify-between py-1 text-slate-600"><span>CGST @ {halfRate}%</span><span>{formatCurrency(t.cgst)}</span></div>
          <div className="flex justify-between py-1 text-slate-600"><span>SGST @ {halfRate}%</span><span>{formatCurrency(t.sgst)}</span></div>
          <div className="flex justify-between py-2 border-t-2 border-amber-600 font-bold text-base">
            <span>Grand Total</span><span>{formatCurrency(t.total)}</span>
          </div>
          <div className="flex justify-between py-1 text-green-700"><span>Amount Paid</span><span>{formatCurrency(t.paid)}</span></div>
          <div className={`flex justify-between py-1 font-semibold ${t.balance > 0 ? 'text-red-600' : 'text-green-700'}`}>
            <span>Balance Due</span><span>{formatCurrency(t.balance)}</span>
          </div>
        </div>
      </div>

      {inv?.notes && (
        <div className="mt-4 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm">
          <span className="font-semibold text-slate-700">Notes:</span> {inv.notes}
        </div>
      )}

      {/* Terms */}
      <div className="mt-5 border border-slate-200 rounded-lg p-3">
        <p className="text-xs font-semibold text-slate-700 mb-2">{LEHENGA_BRAND} – Lehenga Sale Terms &amp; Conditions</p>
        <ol className="list-decimal pl-5 space-y-1 text-[11px] text-slate-600">
          {TERMS.map((x, i) => <li key={i}>{x}</li>)}
        </ol>
        <p className="text-xs font-semibold text-slate-700 mt-4">Accepted and Agreed By:</p>
        <div className="grid grid-cols-2 gap-8 mt-8 text-xs text-slate-600">
          <div className="border-t border-slate-400 pt-1">Customer Signature &amp; Date</div>
          <div className="border-t border-slate-400 pt-1">Authorized Signatory</div>
        </div>
      </div>
    </div>
  )
})

export default LehengaSaleInvoiceDocument
