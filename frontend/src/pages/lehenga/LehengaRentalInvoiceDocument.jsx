import { forwardRef } from 'react'
import { formatCurrency } from '../../utils/formatters'
import InvoiceLetterhead from '../../components/InvoiceLetterhead'

export const fmtDate = (d) => {
  if (!d) return '—'
  const [y, m, day] = String(d).split('T')[0].split('-')
  return `${day}/${m}/${y}`
}

export const TYPE_META = {
  booking: { title: 'LEHENGA BOOKING INVOICE', prefix: 'LBK' },
  pickup:  { title: 'LEHENGA PICKUP INVOICE',  prefix: 'LPK' },
  final:   { title: 'LEHENGA FINAL INVOICE',   prefix: 'LFN' },
}

export const TERMS = [
  'The lehenga is rented only for the period mentioned; late return will be charged per day.',
  'A refundable security deposit is collected and returned after a condition check on return.',
  'Any damage, stain, tear, burn, missing dupatta/blouse or lost embellishment will be charged as per repair or replacement value.',
  'Professional dry-cleaning is arranged by us — the customer must not wash or dry-clean the lehenga.',
  'Full payment must be made before delivery; the advance/booking amount is non-refundable.',
  'Alterations are limited to hem and blouse fitting, and only where the garment allows; permanent cutting is not done.',
  'Customer must provide valid ID proof and is responsible for the safety of the garment during the rental period.',
  'Booking amount is neither refundable nor adjustable or transferable in any condition, no exceptions.',
  'No excuses such as the function being postponed or cancelled are entertained.',
  'Only the articles agreed at the time of booking will be provided; any extra article is chargeable.',
  'Use official number 9977722271 for any query or requirement; no responsibility is taken for any personal number of an employee.',
  'If the lehenga is not returned within the informed timeline, per-day rental charges apply as an extra charge.',
  'All disputes are subject to local jurisdiction.',
]

/**
 * Presentational, print-ready lehenga rental invoice. Every derived amount is
 * computed here from the base fields on `inv` so the generator preview and the
 * saved-invoice view can never drift apart. Pass `editableSecurity` +
 * `onSecurityChange` to make the booking-type security an inline input.
 */
const LehengaRentalInvoiceDocument = forwardRef(function LehengaRentalInvoiceDocument(
  { inv, firm, editableSecurity = false, onSecurityChange },
  ref,
) {
  const type = inv?.type || 'booking'
  const meta = TYPE_META[type] || TYPE_META.booking

  const rent = parseFloat(inv?.rent) || 0
  const discount = parseFloat(inv?.discount) || 0
  const netRent = Math.max(0, rent - discount)
  const bookingAmt = parseFloat(inv?.booking_amount) || 0
  const remaining = netRent - bookingAmt
  const securityNum = parseFloat(inv?.security) || 0
  const damageNum = parseFloat(inv?.damage) || 0
  const totalOnPickup = remaining + securityNum
  const securityRefund = securityNum - damageNum

  const displayNo = inv?.invoice_no || '—'
  const dateStr = fmtDate(inv?.invoice_date || new Date().toISOString())
  const reasons = inv?.reasons || ''

  return (
    <div ref={ref} className="bg-white p-6 sm:p-8 text-slate-800" style={{ maxWidth: 800, margin: '0 auto' }}>
      <InvoiceLetterhead firm={firm} />

      <div className="text-center mt-4">
        <h3 className="font-bold tracking-wide">{meta.title}</h3>
        <p className="text-xs text-slate-500 mt-1">Invoice #: {displayNo} | Date: {dateStr}</p>
      </div>

      {/* Bill To + photo + rental period */}
      <div className="grid grid-cols-3 gap-4 mt-5 text-sm items-start">
        <div>
          <p className="text-amber-700 font-semibold mb-1">Bill To</p>
          <p className="font-semibold">{inv?.customer_name || '—'}</p>
          <p>{inv?.mobile_no || '—'}</p>
          <p>{inv?.aadhaar_no || 'N/A'}</p>
          {inv?.address && <p className="text-xs text-slate-500">{inv.address}</p>}
        </div>
        <div className="flex justify-center">
          {inv?.lehenga_image && (
            <img src={inv.lehenga_image} alt="Lehenga" className="max-h-40 rounded-lg border border-slate-200" />
          )}
        </div>
        <div>
          <p className="text-amber-700 font-semibold mb-1">Rental Period</p>
          <p><span className="font-medium">Function:</span> {fmtDate(inv?.function_date)}</p>
          <p><span className="font-medium">Pickup:</span> {fmtDate(inv?.pickup_date)}</p>
          <p><span className="font-medium">Return:</span> {fmtDate(inv?.return_date)}</p>
        </div>
      </div>

      {/* Items */}
      <table className="w-full text-sm mt-5">
        <thead>
          <tr className="bg-slate-100 text-slate-600 text-xs">
            <th className="text-left px-3 py-2">Lehenga</th>
            <th className="text-left px-3 py-2">Category</th>
            <th className="text-left px-3 py-2">Size / Colour</th>
            <th className="text-left px-3 py-2">Code</th>
            <th className="text-right px-3 py-2">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-slate-100">
            <td className="px-3 py-2">{inv?.name || '—'}</td>
            <td className="px-3 py-2">{inv?.category || '—'}</td>
            <td className="px-3 py-2">{[inv?.size, inv?.colour].filter(Boolean).join(' / ') || '—'}</td>
            <td className="px-3 py-2">{inv?.code || '—'}</td>
            <td className="px-3 py-2 text-right">{formatCurrency(rent)}</td>
          </tr>
          {discount > 0 && (
            <tr className="border-b border-slate-100 text-red-600">
              <td className="px-3 py-2" colSpan={4}>Less: Discount</td>
              <td className="px-3 py-2 text-right">- {formatCurrency(discount)}</td>
            </tr>
          )}
          <tr className="border-b border-slate-100 text-red-600">
            <td className="px-3 py-2" colSpan={4}>Less: Booking Amount</td>
            <td className="px-3 py-2 text-right">- {formatCurrency(bookingAmt)}</td>
          </tr>
          <tr className="border-b-2 border-amber-600 font-bold">
            <td className="px-3 py-2" colSpan={4}>{type === 'final' ? 'Remaining Rent Received on Pickup' : 'Remaining Balance'}</td>
            <td className="px-3 py-2 text-right">{formatCurrency(remaining)}</td>
          </tr>
        </tbody>
      </table>

      {inv?.alteration && (
        <div className="mt-4 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-sm">
          <span className="text-amber-700 font-semibold">Alteration / Fitting:</span> {inv.alteration}
        </div>
      )}

      {inv?.stylist && (
        <div className="mt-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-sm">
          <span className="text-blue-700 font-semibold">Stylist Who Attended:</span> {inv.stylist}
        </div>
      )}

      {/* Payment summary */}
      {type === 'booking' ? (
        <div className="mt-4 border-2 border-red-300 rounded-lg p-3">
          <p className="text-red-600 font-semibold text-sm border-b border-red-200 pb-2">Important to Note Customers</p>
          <div className="flex justify-between text-sm mt-2">
            <span>Remaining Lehenga Rent</span><span className="font-medium">{formatCurrency(remaining)}</span>
          </div>
          <div className="flex justify-between items-center text-sm mt-2">
            <span>Security to be Paid on Pickup</span>
            {editableSecurity ? (
              <span className="flex items-center gap-1">₹
                <input type="number" min="0" value={inv?.security ?? ''} onChange={e => onSecurityChange?.(e.target.value)} placeholder="0"
                  className="border border-red-200 rounded px-2 py-1 text-sm w-24 text-right focus:outline-none focus:ring-2 focus:ring-amber-500/30" />
              </span>
            ) : (
              <span className="font-medium">{formatCurrency(securityNum)}</span>
            )}
          </div>
          <div className="flex justify-between text-sm mt-2 pt-2 border-t border-red-200 text-red-600 font-bold">
            <span>Total to be Paid by Customer on Pickup</span><span>{formatCurrency(totalOnPickup)}</span>
          </div>
        </div>
      ) : type === 'pickup' ? (
        <div className="mt-4 text-sm">
          <div className="flex justify-between bg-slate-50 px-3 py-2 font-semibold">
            <span>Remaining Lehenga Rent</span><span>{formatCurrency(remaining)}</span>
          </div>
          <div className="flex justify-between bg-slate-50 px-3 py-2 text-blue-700">
            <span>Security to be Paid on Pickup</span><span>{formatCurrency(securityNum)}</span>
          </div>
          <div className="flex justify-between px-3 py-2 text-green-700 font-bold border-t-2 border-amber-600">
            <span>Total to be Paid by Customer on Pickup</span><span>{formatCurrency(totalOnPickup)}</span>
          </div>
        </div>
      ) : (
        <div className="mt-4 text-sm">
          <div className="flex justify-between px-3 py-2 text-green-700 font-bold">
            <span>Total Received on Pickup</span><span>{formatCurrency(totalOnPickup)}</span>
          </div>
          <div className="flex justify-between px-3 py-2 text-slate-700">
            <span>Less: Damage / Late Charges / Security Hold</span><span>- {formatCurrency(damageNum)}</span>
          </div>
          <div className="flex justify-between px-3 py-2 text-green-700 font-semibold border-t border-slate-200">
            <span>Security Refund</span><span>{formatCurrency(securityRefund)}</span>
          </div>
          {reasons.trim() && (
            <div className="px-3 py-2 text-xs text-slate-600 border-t border-slate-200">
              <span className="font-semibold">Reason for Security Hold:</span> {reasons}
            </div>
          )}
        </div>
      )}

      {/* Terms */}
      <div className="mt-5 border border-slate-200 rounded-lg p-3">
        <p className="text-xs font-semibold text-slate-700 mb-2">Kavipushp Jewels – Lehenga Rental Terms &amp; Conditions</p>
        <ol className="list-decimal pl-5 space-y-1 text-[11px] text-slate-600">
          {TERMS.map((t, i) => <li key={i}>{t}</li>)}
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

export default LehengaRentalInvoiceDocument
