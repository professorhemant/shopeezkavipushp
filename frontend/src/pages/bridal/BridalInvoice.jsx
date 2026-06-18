import { useEffect, useMemo, useRef, useState } from 'react'
import { Calendar, Truck, CheckCircle2, Printer, FileDown } from 'lucide-react'
import { useReactToPrint } from 'react-to-print'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import toast from 'react-hot-toast'
import { bridalAPI } from '../../api'
import useAuthStore from '../../store/authStore'
import { formatCurrency } from '../../utils/formatters'
import LoadingSpinner from '../../components/common/LoadingSpinner'

const fmtDate = (d) => {
  if (!d) return '—'
  const [y, m, day] = String(d).split('T')[0].split('-')
  return `${day}/${m}/${y}`
}

// Cosmetic, stable-per-booking invoice number (no saved counter yet)
const invoiceNo = (prefix, booking) => {
  const seed = String(booking?.id || '')
  let n = 0
  for (let i = 0; i < seed.length; i++) n = (n * 31 + seed.charCodeAt(i)) % 100000
  return `${prefix}-${String(n).padStart(5, '0')}`
}

const TERMS = [
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

const TYPES = [
  { key: 'booking', label: 'Booking Invoice', icon: Calendar },
  { key: 'pickup',  label: 'Pickup Invoice',  icon: Truck },
  { key: 'final',   label: 'Final Invoice',   icon: CheckCircle2 },
]

export default function BridalInvoice() {
  const { firm } = useAuthStore()
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState('')
  const [type, setType] = useState('booking')
  const [security, setSecurity] = useState('')
  const [setImage, setSetImage] = useState(null)
  const fileRef = useRef(null)
  const printRef = useRef(null)

  useEffect(() => {
    (async () => {
      try { const { data } = await bridalAPI.listBookings(); setBookings(data.data || []) }
      catch { toast.error('Failed to load customers') }
      finally { setLoading(false) }
    })()
  }, [])

  const booking = useMemo(() => bookings.find(b => b.id === selectedId), [bookings, selectedId])

  const rent = parseFloat(booking?.bridal_set_rent) || 0
  const bookingAmt = parseFloat(booking?.booking_amount) || 0
  const remaining = rent - bookingAmt
  const securityNum = parseFloat(security) || 0
  const totalOnPickup = remaining + securityNum

  const handlePrint = useReactToPrint({ content: () => printRef.current, documentTitle: booking ? invoiceNo('BK', booking) : 'invoice' })

  const handlePdf = async () => {
    if (!printRef.current) return
    try {
      const canvas = await html2canvas(printRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff' })
      const img = canvas.toDataURL('image/png')
      const pdf = new jsPDF({ orientation: 'p', unit: 'px', format: [canvas.width, canvas.height] })
      pdf.addImage(img, 'PNG', 0, 0, canvas.width, canvas.height)
      pdf.save(`${invoiceNo('BK', booking)}.pdf`)
    } catch { toast.error('Could not create PDF') }
  }

  const onPickImage = (f) => {
    if (!f) return
    const reader = new FileReader()
    reader.onload = (e) => setSetImage(e.target.result)
    reader.readAsDataURL(f)
  }

  const addr = [firm?.address, firm?.city, firm?.state].filter(Boolean).join(', ')

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Bridal Invoice Management</h1>
        <p className="text-sm text-slate-500 mt-0.5">Generate Booking / Pickup / Final invoices for bridal rentals</p>
      </div>

      {/* Generate controls */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 space-y-4">
        <div className="flex items-center gap-2 text-slate-800 font-semibold"><Calendar className="h-4 w-4 text-amber-600" /> Generate Invoice</div>

        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-[260px]">
            <label className="block text-xs font-medium text-slate-700 mb-1">Select Customer</label>
            <select value={selectedId} onChange={e => setSelectedId(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500">
              <option value="">-- Select a Customer --</option>
              {bookings.map(b => (
                <option key={b.id} value={b.id}>{(b.customer_name || 'Unnamed')} — ({fmtDate(b.function_date)})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Bridal Set Image</label>
            <input ref={fileRef} id="bridal-invoice-img" type="file" accept="image/*" className="hidden"
              onChange={e => onPickImage(e.target.files?.[0])} />
            <div className="flex items-center gap-3">
              <label htmlFor="bridal-invoice-img" className="bg-amber-50 hover:bg-amber-100 text-amber-700 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer inline-block select-none">Choose file</label>
              <span className="text-sm text-slate-500 truncate max-w-[160px]">{setImage ? 'Image attached' : 'No file chosen'}</span>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Invoice Type</label>
          <div className="flex flex-wrap gap-2">
            {TYPES.map(t => {
              const Icon = t.icon
              return (
                <button key={t.key} onClick={() => setType(t.key)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border ${type === t.key ? 'bg-amber-600 border-amber-600 text-white' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                  <Icon className="h-4 w-4" /> {t.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Preview */}
      {loading ? (
        <div className="flex items-center justify-center py-16"><LoadingSpinner size="lg" /></div>
      ) : !booking ? (
        <div className="bg-white rounded-xl p-10 shadow-sm border border-slate-200 text-center text-slate-400">
          Select a customer and invoice type above to preview and generate the invoice.
        </div>
      ) : type !== 'booking' ? (
        <div className="bg-white rounded-xl p-10 shadow-sm border border-slate-200 text-center text-slate-500">
          The <strong>{type === 'pickup' ? 'Pickup' : 'Final'} Invoice</strong> layout will be added once you share its screenshot.
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-2 sm:p-4">
            {/* Printable area */}
            <div ref={printRef} className="bg-white p-6 sm:p-8 text-slate-800" style={{ maxWidth: 800, margin: '0 auto' }}>
              {/* Header */}
              <div className="text-center border-b-2 border-amber-600 pb-3">
                <h2 className="text-xl font-bold text-slate-900">{firm?.name || 'Kavipushp Jewels'}</h2>
                {addr && <p className="text-xs text-slate-500 mt-1">{addr}</p>}
                <p className="text-xs text-slate-500">
                  {firm?.phone ? `Phone: ${firm.phone}` : ''}{firm?.phone && firm?.email ? '  |  ' : ''}{firm?.email || ''}
                </p>
              </div>

              <div className="text-center mt-4">
                <h3 className="font-bold tracking-wide">BOOKING INVOICE</h3>
                <p className="text-xs text-slate-500 mt-1">Invoice #: {invoiceNo('BK', booking)} | Date: {fmtDate(new Date().toISOString())}</p>
              </div>

              {/* Bill To + Rental period */}
              <div className="grid grid-cols-2 gap-4 mt-5 text-sm">
                <div>
                  <p className="text-amber-700 font-semibold mb-1">Bill To</p>
                  <p className="font-semibold">{booking.customer_name || '—'}</p>
                  <p>{booking.mobile_no || '—'}</p>
                  <p>{booking.aadhaar_no || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-amber-700 font-semibold mb-1">Rental Period</p>
                  <p><span className="font-medium">Function:</span> {fmtDate(booking.function_date)}</p>
                  <p><span className="font-medium">Pickup:</span> {fmtDate(booking.pickup_date)}</p>
                  <p><span className="font-medium">Return:</span> {fmtDate(booking.return_date)}</p>
                </div>
              </div>

              {setImage && (
                <div className="mt-4"><img src={setImage} alt="Bridal set" className="max-h-40 rounded-lg border border-slate-200" /></div>
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
                    <td className="px-3 py-2">{booking.set_name || '—'}</td>
                    <td className="px-3 py-2">{booking.category || '—'}</td>
                    <td className="px-3 py-2">{booking.set_code || '—'}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(rent)}</td>
                  </tr>
                  <tr className="border-b border-slate-100 text-red-600">
                    <td className="px-3 py-2" colSpan={3}>Less: Booking Amount</td>
                    <td className="px-3 py-2 text-right">- {formatCurrency(bookingAmt)}</td>
                  </tr>
                  <tr className="border-b-2 border-amber-600 font-bold">
                    <td className="px-3 py-2" colSpan={3}>Remaining Balance</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(remaining)}</td>
                  </tr>
                </tbody>
              </table>

              {/* Stylist */}
              {booking.stylist && (
                <div className="mt-4 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-sm">
                  <span className="text-blue-700 font-semibold">Stylist Who Attended:</span> {booking.stylist}
                </div>
              )}

              {/* Important to note */}
              <div className="mt-4 border-2 border-red-300 rounded-lg p-3">
                <p className="text-red-600 font-semibold text-sm border-b border-red-200 pb-2">Important to Note Customers</p>
                <div className="flex justify-between text-sm mt-2">
                  <span>Remaining Bridal Rent</span><span className="font-medium">{formatCurrency(remaining)}</span>
                </div>
                <div className="flex justify-between items-center text-sm mt-2">
                  <span>Security to be Paid on Pickup</span>
                  <span className="flex items-center gap-1">₹
                    <input type="number" min="0" value={security} onChange={e => setSecurity(e.target.value)} placeholder="0"
                      className="border border-red-200 rounded px-2 py-1 text-sm w-24 text-right focus:outline-none focus:ring-2 focus:ring-amber-500/30" />
                  </span>
                </div>
                <div className="flex justify-between text-sm mt-2 pt-2 border-t border-red-200 text-red-600 font-bold">
                  <span>Total to be Paid by Customer on Pickup</span><span>{formatCurrency(totalOnPickup)}</span>
                </div>
              </div>

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
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <button onClick={handlePrint} className="border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
              <Printer className="h-4 w-4" /> Print Invoice
            </button>
            <button onClick={handlePdf} className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
              <FileDown className="h-4 w-4" /> Create PDF
            </button>
          </div>
        </>
      )}
    </div>
  )
}
