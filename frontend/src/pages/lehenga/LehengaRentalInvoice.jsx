import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Calendar, Truck, CheckCircle2, Printer, FileDown, Save, List } from 'lucide-react'
import { useReactToPrint } from 'react-to-print'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import toast from 'react-hot-toast'
import { lehengaAPI } from '../../api'
import useAuthStore from '../../store/authStore'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import BridalImageUpload from '../../components/bridal/BridalImageUpload'
import LehengaRentalInvoiceDocument, { TYPE_META, fmtDate } from './LehengaRentalInvoiceDocument'

const TYPES = [
  { key: 'booking', label: 'Booking Invoice', icon: Calendar },
  { key: 'pickup',  label: 'Pickup Invoice',  icon: Truck },
  { key: 'final',   label: 'Final Invoice',   icon: CheckCircle2 },
]

export default function LehengaRentalInvoice() {
  const { firm } = useAuthStore()
  const [searchParams] = useSearchParams()
  const [rentals, setRentals] = useState([])
  const [loading, setLoading] = useState(true)
  // Preselect the rental when arriving from the rentals list "Generate invoice" action
  const [selectedId, setSelectedId] = useState(searchParams.get('rental') || '')
  const [type, setType] = useState('booking')
  const [security, setSecurity] = useState('')
  const [damage, setDamage] = useState('')
  const [reasons, setReasons] = useState('')
  const [image, setImage] = useState(null)
  const [savedNo, setSavedNo] = useState('')
  const [savingInv, setSavingInv] = useState(false)
  const printRef = useRef(null)

  useEffect(() => {
    (async () => {
      try { const { data } = await lehengaAPI.listRentals(); setRentals(data.data || []) }
      catch { toast.error('Failed to load rentals') }
      finally { setLoading(false) }
    })()
  }, [])

  const rental = useMemo(() => rentals.find(b => b.id === selectedId), [rentals, selectedId])

  const meta = TYPE_META[type]
  // The real number is assigned by the server on save; show a clear draft
  // placeholder beforehand so the preview never displays a number that won't match.
  const displayNo = savedNo || `${meta.prefix}-DRAFT`

  // Reset the "saved" state whenever the rental or invoice type changes
  useEffect(() => { setSavedNo('') }, [selectedId, type])

  // Seed the amounts from the selected rental (until the user overrides them)
  useEffect(() => {
    setImage(rental?.lehenga_image || null)
    setSecurity(rental?.security_amount != null ? String(rental.security_amount) : '')
    setDamage(rental?.damage_charges != null ? String(rental.damage_charges) : '')
  }, [selectedId]) // eslint-disable-line react-hooks/exhaustive-deps

  const rent = parseFloat(rental?.rental_amount) || 0
  const discount = parseFloat(rental?.discount) || 0
  const bookingAmt = parseFloat(rental?.booking_amount) || 0
  const securityNum = parseFloat(security) || 0
  const damageNum = parseFloat(damage) || 0
  const remaining = Math.max(0, rent - discount) - bookingAmt
  const totalOnPickup = remaining + securityNum

  // Shape passed to the shared printable document
  const inv = rental ? {
    type,
    invoice_no: displayNo,
    invoice_date: new Date().toISOString(),
    customer_name: rental.customer_name,
    mobile_no: rental.mobile_no,
    aadhaar_no: rental.aadhaar_no,
    address: rental.address,
    name: rental.name || rental.customized_lehenga,
    code: rental.code,
    category: rental.category,
    size: rental.size,
    colour: rental.colour,
    stylist: rental.stylist,
    alteration: rental.alteration,
    function_date: rental.function_date,
    pickup_date: rental.pickup_date,
    return_date: rental.return_date,
    rent,
    discount,
    booking_amount: bookingAmt,
    security: security === '' ? '' : securityNum,
    damage: damageNum,
    reasons,
    lehenga_image: image,
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
    if (!rental) return
    setSavingInv(true)
    try {
      const { data } = await lehengaAPI.createRentalInvoice({
        type,
        rental_id: rental.id,
        customer_name: rental.customer_name,
        mobile_no: rental.mobile_no,
        aadhaar_no: rental.aadhaar_no || null,
        address: rental.address || null,
        name: rental.name || rental.customized_lehenga,
        code: rental.code,
        category: rental.category,
        size: rental.size,
        colour: rental.colour,
        stylist: rental.stylist || null,
        alteration: rental.alteration || null,
        function_date: rental.function_date || null,
        pickup_date: rental.pickup_date || null,
        return_date: rental.return_date || null,
        rent,
        discount,
        booking_amount: bookingAmt,
        security: securityNum,
        damage: damageNum,
        total: totalOnPickup,
        reasons: reasons || null,
        lehenga_image: image || null,
      })
      const no = data?.data?.invoice_no || ''
      setSavedNo(no)
      toast.success(`${data?.updated ? 'Invoice updated' : 'Invoice saved'}${no ? ' as ' + no : ''}`)
    } catch { toast.error('Failed to save invoice') }
    finally { setSavingInv(false) }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Lehenga Rental Invoice</h1>
          <p className="text-sm text-slate-500 mt-0.5">Generate Booking / Pickup / Final invoices for lehenga rentals</p>
        </div>
        <Link to="/lehenga/rental-invoices" className="border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
          <List className="h-4 w-4" /> Saved Invoices
        </Link>
      </div>

      {/* Generate controls */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 space-y-4">
        <div className="flex items-center gap-2 text-slate-800 font-semibold"><Calendar className="h-4 w-4 text-amber-600" /> Generate Invoice</div>

        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-[300px]">
            <label className="block text-xs font-medium text-slate-700 mb-1">Select Rental</label>
            <select value={selectedId} onChange={e => setSelectedId(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500">
              <option value="">-- Select a Rental --</option>
              {rentals.map(b => (
                <option key={b.id} value={b.id}>
                  {(b.customer_name || 'Unnamed')} — {b.code || b.customized_lehenga || 'Customized'} ({fmtDate(b.function_date)})
                </option>
              ))}
            </select>
          </div>
          <BridalImageUpload label="Lehenga Image" value={image} onChange={setImage} uploadFn={lehengaAPI.uploadImage} />
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
      ) : !rental ? (
        <div className="bg-white rounded-xl p-10 shadow-sm border border-slate-200 text-center text-slate-400">
          Select a rental and invoice type above to preview and generate the invoice.
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-2 sm:p-4">
            <LehengaRentalInvoiceDocument ref={printRef} inv={inv} firm={firm}
              editableSecurity={type === 'booking'} onSecurityChange={setSecurity} />
          </div>

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
