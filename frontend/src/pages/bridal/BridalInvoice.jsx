import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Calendar, Truck, CheckCircle2, Printer, FileDown, Save, List } from 'lucide-react'
import { useReactToPrint } from 'react-to-print'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import toast from 'react-hot-toast'
import { bridalAPI } from '../../api'
import useAuthStore from '../../store/authStore'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import BridalInvoiceDocument, { TYPE_META, fmtDate } from './BridalInvoiceDocument'

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
  const [damage, setDamage] = useState('')
  const [reasons, setReasons] = useState('')
  const [setImage, setSetImage] = useState(null)
  const [savedNo, setSavedNo] = useState('')
  const [savingInv, setSavingInv] = useState(false)
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

  const meta = TYPE_META[type]
  // The real number is assigned by the server on save; show a clear draft
  // placeholder beforehand so the preview never displays a number that won't match.
  const displayNo = savedNo || `${meta.prefix}-DRAFT`

  // Reset the "saved" state whenever the customer or invoice type changes
  useEffect(() => { setSavedNo('') }, [selectedId, type])

  const rent = parseFloat(booking?.bridal_set_rent) || 0
  const bookingAmt = parseFloat(booking?.booking_amount) || 0
  const securityNum = parseFloat(security) || 0
  const damageNum = parseFloat(damage) || 0
  const remaining = rent - bookingAmt
  const totalOnPickup = remaining + securityNum

  // Shape passed to the shared printable document
  const inv = booking ? {
    type,
    invoice_no: displayNo,
    invoice_date: new Date().toISOString(),
    customer_name: booking.customer_name,
    mobile_no: booking.mobile_no,
    aadhaar_no: booking.aadhaar_no,
    set_name: booking.set_name,
    set_code: booking.set_code,
    category: booking.category,
    stylist: booking.stylist,
    function_date: booking.function_date,
    pickup_date: booking.pickup_date,
    return_date: booking.return_date,
    rent,
    booking_amount: bookingAmt,
    security: security === '' ? '' : securityNum,
    damage: damageNum,
    reasons,
    set_image: setImage,
  } : null

  const handlePrint = useReactToPrint({ content: () => printRef.current, documentTitle: displayNo || 'invoice' })

  const handlePdf = async () => {
    if (!printRef.current) return
    try {
      const canvas = await html2canvas(printRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff' })
      const img = canvas.toDataURL('image/png')
      const pdf = new jsPDF({ orientation: 'p', unit: 'px', format: [canvas.width, canvas.height] })
      pdf.addImage(img, 'PNG', 0, 0, canvas.width, canvas.height)
      pdf.save(`${displayNo}.pdf`)
    } catch { toast.error('Could not create PDF') }
  }

  const saveInvoice = async () => {
    if (!booking) return
    setSavingInv(true)
    try {
      const { data } = await bridalAPI.createInvoice({
        type,
        booking_id: booking.id,
        customer_name: booking.customer_name,
        mobile_no: booking.mobile_no,
        aadhaar_no: booking.aadhaar_no || null,
        set_name: booking.set_name,
        set_code: booking.set_code,
        category: booking.category,
        stylist: booking.stylist || null,
        function_date: booking.function_date || null,
        pickup_date: booking.pickup_date || null,
        return_date: booking.return_date || null,
        rent,
        booking_amount: bookingAmt,
        security: securityNum,
        damage: damageNum,
        total: totalOnPickup,
        reasons: reasons || null,
        set_image: setImage || null,
      })
      const no = data?.data?.invoice_no || ''
      setSavedNo(no)
      toast.success(`${data?.updated ? 'Invoice updated' : 'Invoice saved'}${no ? ' as ' + no : ''}`)
    } catch { toast.error('Failed to save invoice') }
    finally { setSavingInv(false) }
  }

  const onPickImage = (f) => {
    if (!f) return
    const reader = new FileReader()
    reader.onload = (e) => setSetImage(e.target.result)
    reader.readAsDataURL(f)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Bridal Invoice Management</h1>
          <p className="text-sm text-slate-500 mt-0.5">Generate Booking / Pickup / Final invoices for bridal rentals</p>
        </div>
        <Link to="/bridal/invoices" className="border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
          <List className="h-4 w-4" /> Saved Invoices
        </Link>
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

        <div className="flex flex-wrap items-end gap-6">
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
          {(type === 'pickup' || type === 'final') && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Security Amount (₹)</label>
              <input type="number" min="0" value={security} onChange={e => setSecurity(e.target.value)} placeholder="0"
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm w-44 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" />
            </div>
          )}
        </div>

        {type === 'final' && (
          <div className="flex flex-wrap items-start gap-6">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Damage or Late Charges or Security Hold (₹)</label>
              <input type="number" min="0" value={damage} onChange={e => setDamage(e.target.value)} placeholder="0"
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm w-72 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" />
            </div>
            <div className="flex-1 min-w-[280px]">
              <label className="block text-xs font-medium text-slate-700 mb-1">Reasons for Security Hold</label>
              <textarea value={reasons} onChange={e => setReasons(e.target.value)} rows={2}
                placeholder="Enter reasons for security hold, damage or late charges (if any)…"
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" />
            </div>
          </div>
        )}
      </div>

      {/* Preview */}
      {loading ? (
        <div className="flex items-center justify-center py-16"><LoadingSpinner size="lg" /></div>
      ) : !booking ? (
        <div className="bg-white rounded-xl p-10 shadow-sm border border-slate-200 text-center text-slate-400">
          Select a customer and invoice type above to preview and generate the invoice.
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-2 sm:p-4">
            <BridalInvoiceDocument
              ref={printRef}
              inv={inv}
              firm={firm}
              editableSecurity={type === 'booking'}
              onSecurityChange={setSecurity}
            />
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <button onClick={saveInvoice} disabled={savingInv}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
              <Save className="h-4 w-4" /> {savingInv ? 'Saving…' : savedNo ? `Update Saved (${savedNo})` : 'Save Invoice'}
            </button>
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
