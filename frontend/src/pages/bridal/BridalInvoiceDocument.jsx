import { forwardRef } from 'react'
import { formatCurrency } from '../../utils/formatters'

export const fmtDate = (d) => {
  if (!d) return '—'
  const [y, m, day] = String(d).split('T')[0].split('-')
  return `${day}/${m}/${y}`
}

export const TYPE_META = {
  booking: { title: 'BOOKING INVOICE', prefix: 'BK' },
  pickup:  { title: 'PICKUP INVOICE',  prefix: 'PK' },
  final:   { title: 'FINAL INVOICE',   prefix: 'FN' },
}

export const TERMS = [
  'Jewellery is rented only for the period mentioned; late return will be charged per day.',
  'A refundable security deposit may be collected and returned after condition check.',
  'Any damage, loss, or missing parts will be charged as per repair or replacement value mentioned before dispatch in the whatsapp group.',
  'Full payment must be made before delivery; advance/booking amount is non-refundable.',
  'Customer must provide valid ID proof and is responsible for the safety of the jewellery during the rental period.',
  'All disputes are subject to local jurisdiction.',
  'There shall be no discount on the rental prices of the set.',
  'Rental price does not include customization charges if applicable.',
  'Booking amount is neither refundable nor adjustable or transferable in any condition, no exceptions.',
  'No excuses like jewellery will be provided by in-laws, in-laws insisting on wearing gold only, wedding postponed or cancelled are entertained.',
  'Articles agreed on at the time of booking will only be provided; extra article will be chargeable.',
  'Use official number 9977722271 for any query or requirements; no responsibility for any personal number of employee.',
  'Rental clarification: First 3 days normal rent of Bridal Set, next 2 days Rs.500 extra (if informed at the time of booking).',
  'If the bridal set is not returned within the informed timeline, per day rental charges will be applicable as extra charge.',
]

/**
 * Presentational, print-ready bridal invoice. Computes all derived amounts
 * from the base fields on `inv` so the generator and the saved-invoice view
 * render identically. Pass `editableSecurity` + `onSecurityChange` to make the
 * booking-type security an inline input (generate mode only).
 */
const BridalInvoiceDocument = forwardRef(function BridalInvoiceDocument(
  { inv, firm, editableSecurity = false, onSecurityChange },
  ref,
) {
  const type = inv?.type || 'booking'
  const meta = TYPE_META[type] || TYPE_META.booking

  const rent = parseFloat(inv?.rent) || 0
  const bookingAmt = parseFloat(inv?.booking_amount) || 0
  const remaining = rent - bookingAmt
  const securityNum = parseFloat(inv?.security) || 0
  const damageNum = parseFloat(inv?.damage) || 0
  const totalOnPickup = remaining + securityNum
  const totalReceivedOnPickup = remaining + securityNum
  const securityRefund = securityNum - damageNum

  const displayNo = inv?.invoice_no || '—'
  const dateStr = fmtDate(inv?.invoice_date || new Date().toISOString())
  const addr = [firm?.address, firm?.city, firm?.state].filter(Boolean).join(', ')
  const reasons = inv?.reasons || ''

  return (
    <div ref={ref} className="bg-white p-6 sm:p-8 text-slate-800" style={{ maxWidth: 800, margin: '0 auto' }}>
      {/* Header */}
      <div className="text-center border-b-2 border-amber-600 pb-3">
        <h2 className="text-xl font-bold text-slate-900">{firm?.name || 'Kavipushp Jewels'}</h2>
        {addr && <p className="text-xs text-slate-500 mt-1">{addr}</p>}
        <p className="text-xs text-slate-500">
          {firm?.phone ? `Phone: ${firm.phone}` : ''}{firm?.phone && firm?.email ? '  |  ' : ''}{firm?.email || ''}
        </p>
      </div>

      <div className="text-center mt-4">
        <h3 className="font-bold tracking-wide">{meta.title}</h3>
        <p className="text-xs text-slate-500 mt-1">Invoice #: {displayNo} | Date: {dateStr}</p>
      </div>

      {/* Bill To + Rental period */}
      <div className="grid grid-cols-2 gap-4 mt-5 text-sm">
        <div>
          <p className="text-amber-700 font-semibold mb-1">Bill To</p>
          <p className="font-semibold">{inv?.customer_name || '—'}</p>
          <p>{inv?.mobile_no || '—'}</p>
          <p>{inv?.aadhaar_no || 'N/A'}</p>
        </div>
        <div>
          <p className="text-amber-700 font-semibold mb-1">Rental Period</p>
          <p><span className="font-medium">Function:</span> {fmtDate(inv?.function_date)}</p>
          <p><span className="font-medium">Pickup:</span> {fmtDate(inv?.pickup_date)}</p>
          <p><span className="font-medium">Return:</span> {fmtDate(inv?.return_date)}</p>
        </div>
      </div>

      {inv?.set_image && (
        <div className="mt-4"><img src={inv.set_image} alt="Bridal set" className="max-h-40 rounded-lg border border-slate-200" /></div>
      )}

      {/* Items */}
      <table className="w-full text-sm mt-5">
        <thead>
          <tr className="bg-slate-100 text-slate-600 text-xs">
            <th className="text-left px-3 py-2">Item</th>
            <th className="text-left px-3 py-2">Category</th>
            <th className="text-left px-3 py-2">Set Code</th>
            <th className="text-right px-3 py-2">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-slate-100">
            <td className="px-3 py-2">{inv?.set_name || '—'}</td>
            <td className="px-3 py-2">{inv?.category || '—'}</td>
            <td className="px-3 py-2">{inv?.set_code || '—'}</td>
            <td className="px-3 py-2 text-right">{formatCurrency(rent)}</td>
          </tr>
          <tr className="border-b border-slate-100 text-red-600">
            <td className="px-3 py-2" colSpan={3}>Less: Booking Amount</td>
            <td className="px-3 py-2 text-right">- {formatCurrency(bookingAmt)}</td>
          </tr>
          <tr className="border-b-2 border-amber-600 font-bold">
            <td className="px-3 py-2" colSpan={3}>{type === 'final' ? 'Remaining Rent Received on Pickup' : 'Remaining Balance'}</td>
            <td className="px-3 py-2 text-right">{formatCurrency(remaining)}</td>
          </tr>
        </tbody>
      </table>

      {/* Stylist */}
      {inv?.stylist && (
        <div className="mt-4 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-sm">
          <span className="text-blue-700 font-semibold">Stylist Who Attended:</span> {inv.stylist}
        </div>
      )}

      {/* Payment summary */}
      {type === 'booking' ? (
        <div className="mt-4 border-2 border-red-300 rounded-lg p-3">
          <p className="text-red-600 font-semibold text-sm border-b border-red-200 pb-2">Important to Note Customers</p>
          <div className="flex justify-between text-sm mt-2">
            <span>Remaining Bridal Rent</span><span className="font-medium">{formatCurrency(remaining)}</span>
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
            <span>Remaining Bridal Rent</span><span>{formatCurrency(remaining)}</span>
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
            <span>Total Received on Pickup</span><span>{formatCurrency(totalReceivedOnPickup)}</span>
          </div>
          <div className="flex justify-between px-3 py-2 text-green-700 font-semibold">
            <span>Security Refund after Damage or Late Charges or Security Hold</span><span>{formatCurrency(securityRefund)}</span>
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
        <p className="text-xs font-semibold text-slate-700 mb-2">Kavipushp Jewels – Terms &amp; Conditions</p>
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

export default BridalInvoiceDocument
