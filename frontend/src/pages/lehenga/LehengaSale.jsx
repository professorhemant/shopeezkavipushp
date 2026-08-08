import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ShoppingBag, Printer, FileDown, Save, List, AlertTriangle } from 'lucide-react'
import { useReactToPrint } from 'react-to-print'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import toast from 'react-hot-toast'
import { lehengaAPI } from '../../api'
import useAuthStore from '../../store/authStore'
import { formatCurrency } from '../../utils/formatters'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import BridalImageUpload from '../../components/bridal/BridalImageUpload'
import LehengaSaleInvoiceDocument, { computeSaleTotals } from './LehengaSaleInvoiceDocument'

const today = () => new Date().toISOString().split('T')[0]

// Ready-to-wear / stitched garments sit in HSN 6204; 5% up to ₹1000 a piece,
// 12% above — the operator can still override both fields.
const GST_RATES = [0, 5, 12, 18]

const itemLabel = (it) => {
  const bits = [it.code ? `${it.code} — ${it.name}` : it.name]
  const attrs = [it.size, it.colour].filter(Boolean).join(', ')
  if (attrs) bits.push(`(${attrs})`)
  return bits.join(' ')
}

const EMPTY = {
  lehenga_id: '', code: '', name: '', category: '', size: '', colour: '', hsn_code: '6204', lehenga_image: '',
  customer_name: '', mobile_no: '', aadhaar_no: '', address: '', gstin: '',
  sale_date: today(), quantity: '1', unit_price: '', discount: '', gst_rate: '5',
  amount_paid: '', payment_mode: 'cash', salesperson: '', notes: '',
}

const inp = "border border-slate-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
const lbl = "block text-xs font-medium text-slate-700 mb-1"

export default function LehengaSale() {
  const navigate = useNavigate()
  const { firm } = useAuthStore()
  const [inv, setInv] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [savedNo, setSavedNo] = useState('')
  // Once saved, further saves edit that same bill rather than issuing a second
  // invoice number (and decrementing stock a second time).
  const [savedId, setSavedId] = useState('')
  const [search, setSearch] = useState('')
  const printRef = useRef(null)

  useEffect(() => {
    (async () => {
      // Only pieces flagged sale-capable can be billed out
      try { const { data } = await lehengaAPI.listInventory('sale'); setInv(data.data || []) }
      catch { toast.error('Failed to load lehenga inventory') }
      finally { setLoading(false) }
    })()
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return inv
    return inv.filter(s => `${s.code || ''} ${s.name} ${s.colour || ''} ${s.size || ''}`.toLowerCase().includes(q))
  }, [inv, search])

  const selected = useMemo(() => inv.find(s => String(s.id) === String(form.lehenga_id)), [inv, form.lehenga_id])

  const setField = (key, val) => setForm(f => ({ ...f, [key]: val }))

  const handleSelect = (id) => {
    const s = inv.find(x => String(x.id) === String(id))
    if (!s) {
      setForm(f => ({ ...f, lehenga_id: '', code: '', name: '', category: '', size: '', colour: '', unit_price: '' }))
      return
    }
    setForm(f => ({
      ...f,
      lehenga_id: s.id,
      code: s.code || '',
      name: s.name || '',
      category: s.category || '',
      size: s.size || '',
      colour: s.colour || '',
      lehenga_image: s.image || f.lehenga_image,
      unit_price: s.sale_price ?? '',
    }))
  }

  // Auto-select when the typed code exactly matches an inventory code
  useEffect(() => {
    const q = search.trim().toLowerCase()
    if (!q) return
    const exact = inv.find(s => (s.code || '').trim().toLowerCase() === q)
    if (exact && String(exact.id) !== String(form.lehenga_id)) handleSelect(exact.id)
  }, [search, inv]) // eslint-disable-line react-hooks/exhaustive-deps

  const totals = computeSaleTotals(form)
  const qty = totals.quantity
  const availableStock = selected ? (parseInt(selected.stock, 10) || 0) : null
  const shortStock = availableStock !== null && qty > availableStock

  // Shape passed to the shared printable document
  const previewInv = {
    ...form,
    invoice_no: savedNo || 'LS-DRAFT',
    quantity: qty,
  }

  const handlePrint = useReactToPrint({ content: () => printRef.current, documentTitle: savedNo || 'lehenga-sale' })

  const handlePdf = async () => {
    if (!printRef.current) return
    try {
      const canvas = await html2canvas(printRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff' })
      const img = canvas.toDataURL('image/png')
      const pdf = new jsPDF({ orientation: 'p', unit: 'px', format: [canvas.width, canvas.height] })
      pdf.addImage(img, 'PNG', 0, 0, canvas.width, canvas.height)
      pdf.save(`${savedNo || 'lehenga-sale'}.pdf`)
    } catch { toast.error('Could not create PDF') }
  }

  const save = async () => {
    if (!form.name.trim()) { toast.error('Select a lehenga, or type an item name') ; return }
    if (totals.unitPrice <= 0) { toast.error('Enter a sale price'); return }
    if (shortStock && !window.confirm(`Only ${availableStock} in stock but ${qty} being sold. Save anyway? Stock will be floored at 0.`)) return

    setSaving(true)
    try {
      const payload = {
        ...form,
        lehenga_id: form.lehenga_id || null,
        sale_date: form.sale_date || today(),
        quantity: qty,
      }
      const { data } = savedId
        ? await lehengaAPI.updateSale(savedId, payload)
        : await lehengaAPI.createSale(payload)
      const no = data?.data?.invoice_no || ''
      setSavedNo(no)
      setSavedId(data?.data?.id || savedId)
      toast.success(savedId
        ? `Sale ${no} updated`
        : `Sale saved${no ? ' as ' + no : ''}${form.lehenga_id ? ` · stock reduced by ${qty}` : ''}`)
      // Refresh inventory so the stock figure on screen reflects the sale
      try { const { data: fresh } = await lehengaAPI.listInventory('sale'); setInv(fresh.data || []) } catch { /* non-fatal */ }
    } catch { toast.error('Failed to save sale') }
    finally { setSaving(false) }
  }

  const startNew = () => { setForm(EMPTY); setSearch(''); setSavedNo(''); setSavedId('') }

  if (loading) return <div className="flex items-center justify-center py-20"><LoadingSpinner size="lg" /></div>

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800 flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-amber-600" /> Bridal Lehenga Sale
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Outright sale with a GST tax invoice · stock is reduced on save</p>
        </div>
        <Link to="/lehenga/sales" className="border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
          <List className="h-4 w-4" /> Saved Sales
        </Link>
      </div>

      {inv.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
          No sale-ready lehengas yet. Add them under <strong>Lehenga Inventory</strong> with <em>Available For</em> set to
          &ldquo;Sale Only&rdquo; or &ldquo;Rental + Sale&rdquo;.
        </div>
      )}

      {/* Item */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 space-y-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Lehenga</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Select from Inventory</label>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, code, colour…" className={`${inp} mb-2`} />
            <select value={form.lehenga_id} onChange={e => handleSelect(e.target.value)} className={inp}>
              <option value="">-- Select a Lehenga (or bill manually below) --</option>
              {filtered.map(s => <option key={s.id} value={s.id}>{itemLabel(s)}</option>)}
            </select>
            {selected && (
              <p className={`text-xs mt-1 ${availableStock <= 0 ? 'text-red-600' : 'text-slate-500'}`}>
                In stock: <strong>{availableStock}</strong>
                {selected.cost_price > 0 && <span className="text-slate-400"> · cost {formatCurrency(selected.cost_price)}</span>}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 content-start">
            <div className="col-span-2"><label className={lbl}>Item Name *</label><input value={form.name} onChange={e => setField('name', e.target.value)} placeholder="Auto-filled, or type a manual item" className={inp} /></div>
            <div><label className={lbl}>Code</label><input value={form.code} onChange={e => setField('code', e.target.value)} className={inp} /></div>
            <div><label className={lbl}>HSN Code</label><input value={form.hsn_code} onChange={e => setField('hsn_code', e.target.value)} className={inp} /></div>
            <div><label className={lbl}>Category</label><input value={form.category} onChange={e => setField('category', e.target.value)} className={inp} /></div>
            <div><label className={lbl}>Size</label><input value={form.size} onChange={e => setField('size', e.target.value)} className={inp} /></div>
            <div><label className={lbl}>Colour</label><input value={form.colour} onChange={e => setField('colour', e.target.value)} className={inp} /></div>
          </div>
        </div>
        <BridalImageUpload label="Lehenga Image (prints on the invoice)" value={form.lehenga_image}
          onChange={(url) => setField('lehenga_image', url || '')} uploadFn={lehengaAPI.uploadImage} />
      </div>

      {/* Customer */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Customer Details</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div><label className={lbl}>Customer Name</label><input value={form.customer_name} onChange={e => setField('customer_name', e.target.value)} placeholder="Customer name" className={inp} /></div>
          <div><label className={lbl}>Mobile Number</label><input value={form.mobile_no} onChange={e => setField('mobile_no', e.target.value)} placeholder="Mobile number" className={inp} /></div>
          <div><label className={lbl}>Aadhaar Number</label><input value={form.aadhaar_no} onChange={e => setField('aadhaar_no', e.target.value)} placeholder="Aadhaar number" className={inp} /></div>
          <div className="sm:col-span-2"><label className={lbl}>Address</label><input value={form.address} onChange={e => setField('address', e.target.value)} placeholder="Billing address" className={inp} /></div>
          <div><label className={lbl}>Customer GSTIN <span className="text-slate-400 font-normal">(optional)</span></label><input value={form.gstin} onChange={e => setField('gstin', e.target.value)} placeholder="For B2B billing" className={inp} /></div>
        </div>
      </div>

      {/* Pricing */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 space-y-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Pricing &amp; Payment</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div><label className={lbl}>Sale Date</label><input type="date" value={form.sale_date} onChange={e => setField('sale_date', e.target.value)} className={inp} /></div>
          <div><label className={lbl}>Quantity</label><input type="number" min="1" value={form.quantity} onChange={e => setField('quantity', e.target.value)} className={inp} /></div>
          <div><label className={lbl}>Sale Price / pc (₹) *</label><input type="number" step="0.01" min="0" value={form.unit_price} onChange={e => setField('unit_price', e.target.value)} placeholder="0.00" className={inp} /></div>
          <div><label className={lbl}>Discount (₹)</label><input type="number" step="0.01" min="0" value={form.discount} onChange={e => setField('discount', e.target.value)} placeholder="0.00" className={inp} /></div>
          <div>
            <label className={lbl}>GST Rate (%)</label>
            <select value={form.gst_rate} onChange={e => setField('gst_rate', e.target.value)} className={inp}>
              {GST_RATES.map(r => <option key={r} value={String(r)}>{r}%</option>)}
            </select>
          </div>
          <div><label className={lbl}>Amount Paid (₹)</label><input type="number" step="0.01" min="0" value={form.amount_paid} onChange={e => setField('amount_paid', e.target.value)} placeholder="0.00" className={inp} /></div>
          <div>
            <label className={lbl}>Payment Mode</label>
            <select value={form.payment_mode} onChange={e => setField('payment_mode', e.target.value)} className={inp}>
              <option value="cash">Cash</option>
              <option value="online">Online / UPI</option>
              <option value="card">Card</option>
            </select>
          </div>
          <div><label className={lbl}>Salesperson</label><input value={form.salesperson} onChange={e => setField('salesperson', e.target.value)} placeholder="Who sold it" className={inp} /></div>
          <div className="col-span-2 sm:col-span-4"><label className={lbl}>Notes</label><textarea value={form.notes} onChange={e => setField('notes', e.target.value)} rows={2} placeholder="Anything to print on the bill…" className={inp} /></div>
        </div>

        {shortStock && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>Only <strong>{availableStock}</strong> in stock but you are selling <strong>{qty}</strong>. Saving is still allowed — stock will not go below zero.</span>
          </div>
        )}

        {/* Live GST summary */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm max-w-sm ml-auto space-y-1">
          <div className="flex justify-between"><span className="text-slate-600">Gross ({qty} × {formatCurrency(totals.unitPrice)})</span><span>{formatCurrency(totals.gross)}</span></div>
          {totals.discount > 0 && <div className="flex justify-between text-red-600"><span>Less: Discount</span><span>− {formatCurrency(totals.discount)}</span></div>}
          <div className="flex justify-between font-semibold border-t border-slate-200 pt-1"><span>Taxable Value</span><span>{formatCurrency(totals.taxable)}</span></div>
          <div className="flex justify-between text-slate-600"><span>CGST @ {totals.gstRate / 2}%</span><span>{formatCurrency(totals.cgst)}</span></div>
          <div className="flex justify-between text-slate-600"><span>SGST @ {totals.gstRate / 2}%</span><span>{formatCurrency(totals.sgst)}</span></div>
          <div className="flex justify-between font-bold text-amber-700 border-t-2 border-amber-600 pt-1"><span>Grand Total</span><span>{formatCurrency(totals.total)}</span></div>
          <div className="flex justify-between text-green-700"><span>Amount Paid</span><span>{formatCurrency(totals.paid)}</span></div>
          <div className={`flex justify-between font-semibold ${totals.balance > 0 ? 'text-red-600' : 'text-green-700'}`}><span>Balance Due</span><span>{formatCurrency(totals.balance)}</span></div>
        </div>
      </div>

      {/* Invoice preview */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-2 sm:p-4">
        <LehengaSaleInvoiceDocument ref={printRef} inv={previewInv} firm={firm} />
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={save} disabled={saving}
          className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
          <Save className="h-4 w-4" /> {saving ? 'Saving…' : savedNo ? `Update Saved (${savedNo})` : 'Save Sale'}
        </button>
        <button onClick={handlePrint} className="border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
          <Printer className="h-4 w-4" /> Print Invoice
        </button>
        <button onClick={handlePdf} className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
          <FileDown className="h-4 w-4" /> Create PDF
        </button>
        {savedNo && (
          <>
            <button onClick={startNew} className="border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium">New Sale</button>
            <button onClick={() => navigate('/lehenga/sales')} className="border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium">Go to Saved Sales</button>
          </>
        )}
      </div>
    </div>
  )
}
