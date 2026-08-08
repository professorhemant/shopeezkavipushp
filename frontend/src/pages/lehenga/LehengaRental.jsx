import { useEffect, useState, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, CheckCircle, Save, Shirt } from 'lucide-react'
import toast from 'react-hot-toast'
import { lehengaAPI } from '../../api'
import { formatCurrency } from '../../utils/formatters'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import BridalImageUpload from '../../components/bridal/BridalImageUpload'

const today = () => new Date().toISOString().split('T')[0]
const addDays = (dateStr, days) => {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}
export const fmtDate = (d) => {
  if (!d) return '—'
  const [y, m, day] = String(d).split('T')[0].split('-')
  return `${day}/${m}/${y}`
}
const itemLabel = (it) => {
  const bits = [it.code ? `${it.code} — ${it.name}` : it.name]
  const attrs = [it.size, it.colour].filter(Boolean).join(', ')
  if (attrs) bits.push(`(${attrs})`)
  return bits.join(' ')
}

const EMPTY = {
  lehenga_id: '', code: '', name: '', category: '', size: '', colour: '', lehenga_image: '',
  customized_lehenga: '',
  customer_name: '', mobile_no: '', aadhaar_no: '', address: '',
  function_date: '', booking_date: today(), pickup_date: '', return_date: '',
  rental_amount: '', booking_amount: '', security_amount: '', discount: '',
  payment_mode: 'cash', stylist: '', alteration: '', notes: '',
}

const inp = "border border-slate-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
const lbl = "block text-xs font-medium text-slate-700 mb-1"

export default function LehengaRental() {
  const navigate = useNavigate()
  const [inv, setInv] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [pieceSearch, setPieceSearch] = useState('')
  const [nameSearch, setNameSearch] = useState('')

  // in-form availability (for the lehenga being booked)
  const [availability, setAvailability] = useState([])
  const [checkingAvail, setCheckingAvail] = useState(false)
  const availRef = useRef(null)

  // standalone "Check Lehenga Availability" box
  const [checkerCode, setCheckerCode] = useState('')
  const [checkerDate, setCheckerDate] = useState('')
  const [checkerResult, setCheckerResult] = useState(null) // null = not checked, [] = free, [...] = clashes
  const [checkerLoading, setCheckerLoading] = useState(false)
  const checkerRef = useRef(null)

  useEffect(() => {
    (async () => {
      // Only pieces flagged rental-capable can be booked out
      try { const { data } = await lehengaAPI.listInventory('rental'); setInv(data.data || []) }
      catch { toast.error('Failed to load lehenga inventory') }
      finally { setLoading(false) }
    })()
  }, [])

  const filteredPieces = useMemo(() => {
    const q = pieceSearch.trim().toLowerCase()
    if (!q) return inv
    return inv.filter(s => `${s.code || ''} ${s.name} ${s.colour || ''} ${s.size || ''}`.toLowerCase().includes(q))
  }, [inv, pieceSearch])

  const nameResults = nameSearch.trim().length >= 2
    ? inv.filter(s => s.name.toLowerCase().includes(nameSearch.trim().toLowerCase())).slice(0, 10)
    : []

  const setField = (key, val) => setForm(f => ({ ...f, [key]: val }))

  const applyPiece = (s, f) => ({
    ...f,
    lehenga_id: s.id,
    code: s.code || '',
    name: s.name || '',
    category: s.category || '',
    size: s.size || '',
    colour: s.colour || '',
    lehenga_image: s.image || f.lehenga_image,
    // A customized piece keeps whatever rent was typed manually
    rental_amount: f.customized_lehenga ? f.rental_amount : (s.rental_price ?? ''),
  })

  const handlePieceSelect = (id) => {
    const s = inv.find(x => String(x.id) === String(id))
    if (!s) {
      setForm(f => ({ ...f, lehenga_id: '', code: '', name: '', category: '', size: '', colour: '', rental_amount: '' }))
      return
    }
    setForm(f => applyPiece(s, f))
  }

  // Auto-select when the typed code exactly matches an inventory code
  useEffect(() => {
    const q = pieceSearch.trim().toLowerCase()
    if (!q) return
    const exact = inv.find(s => (s.code || '').trim().toLowerCase() === q)
    if (exact) handlePieceSelect(exact.id)
  }, [pieceSearch, inv]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleFunctionDate = (val) => {
    setForm(f => ({ ...f, function_date: val, pickup_date: addDays(val, -1), return_date: addDays(val, +1) }))
  }

  // Availability check driven by the form's own code + function date
  useEffect(() => {
    if (availRef.current) clearTimeout(availRef.current)
    const code = form.code.trim()
    if (!code || !form.function_date) { setAvailability([]); return }
    availRef.current = setTimeout(async () => {
      setCheckingAvail(true)
      try { const res = await lehengaAPI.checkAvailability(code, form.function_date); setAvailability(res.data.data || []) }
      catch { setAvailability([]) }
      finally { setCheckingAvail(false) }
    }, 500)
    return () => clearTimeout(availRef.current)
  }, [form.code, form.function_date])

  // The inventory piece whose code matches what's typed in the checker
  const checkerMatch = checkerCode.trim()
    ? inv.find(s => (s.code || '').trim().toLowerCase() === checkerCode.trim().toLowerCase())
    : null

  // Fill the form's lehenga the moment a typed code matches, independent of date
  useEffect(() => {
    if (!checkerMatch) return
    setForm(f => applyPiece(checkerMatch, f))
  }, [checkerMatch?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Standalone availability check (needs code + function date)
  useEffect(() => {
    if (checkerRef.current) clearTimeout(checkerRef.current)
    const code = checkerCode.trim()
    if (!code || !checkerDate) { setCheckerResult(null); return }
    checkerRef.current = setTimeout(async () => {
      setCheckerLoading(true)
      try {
        const res = await lehengaAPI.checkAvailability(code, checkerDate)
        setCheckerResult(res.data.data || [])
        // Carry the checked date into the form when this is the selected piece
        setForm(f => (f.code && f.code.trim().toLowerCase() === code.toLowerCase())
          ? { ...f, function_date: checkerDate, pickup_date: addDays(checkerDate, -1), return_date: addDays(checkerDate, +1) }
          : f)
      } catch { setCheckerResult([]) }
      finally { setCheckerLoading(false) }
    }, 500)
    return () => clearTimeout(checkerRef.current)
  }, [checkerCode, checkerDate])

  const rent = parseFloat(form.rental_amount) || 0
  const discount = parseFloat(form.discount) || 0
  const advance = parseFloat(form.booking_amount) || 0
  const security = parseFloat(form.security_amount) || 0
  const netRent = Math.max(0, rent - discount)
  const remaining = netRent - advance
  const dueOnPickup = remaining + security

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.lehenga_id && !form.customized_lehenga.trim()) {
      toast.error('Select a lehenga from inventory or enter a customized lehenga')
      return
    }
    setSaving(true)
    try {
      await lehengaAPI.createRental({
        ...form,
        lehenga_id: form.lehenga_id || null,
        function_date: form.function_date || null,
        booking_date: form.booking_date || null,
        pickup_date: form.pickup_date || null,
        return_date: form.return_date || null,
      })
      toast.success('Rental saved')
      navigate('/lehenga/rentals')
    } catch { toast.error('Failed to save rental') }
    finally { setSaving(false) }
  }

  if (loading) return <div className="flex items-center justify-center py-20"><LoadingSpinner size="lg" /></div>

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Shirt className="h-5 w-5 text-amber-600" /> Bridal Lehenga Rental
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">New rental booking · saved rentals appear under <strong>Lehenga Rentals</strong></p>
      </div>

      {inv.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
          No rental-ready lehengas yet. Add them under <strong>Lehenga Inventory</strong> with <em>Available For</em> set to
          &ldquo;Rental Only&rdquo; or &ldquo;Rental + Sale&rdquo; so they appear in the dropdown below.
        </div>
      )}

      {/* Customer details */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Customer Details</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><label className={lbl}>Customer Name</label><input value={form.customer_name} onChange={e => setField('customer_name', e.target.value)} placeholder="Customer name" className={inp} /></div>
          <div><label className={lbl}>Mobile Number</label><input value={form.mobile_no} onChange={e => setField('mobile_no', e.target.value)} placeholder="Mobile number" className={inp} /></div>
          <div><label className={lbl}>Aadhaar Number</label><input value={form.aadhaar_no} onChange={e => setField('aadhaar_no', e.target.value)} placeholder="Aadhaar number" className={inp} /></div>
          <div><label className={lbl}>Address</label><input value={form.address} onChange={e => setField('address', e.target.value)} placeholder="Address" className={inp} /></div>
        </div>
      </div>

      {/* Standalone availability checker */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Check Lehenga Availability</p>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className={lbl}>Lehenga Code</label>
            <input value={checkerCode} onChange={e => setCheckerCode(e.target.value)} placeholder="e.g. LH001"
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm w-44 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" />
            {checkerCode.trim() && (
              checkerMatch
                ? <p className="text-xs text-green-600 mt-1 truncate w-44">✓ {checkerMatch.name} — filled below</p>
                : <p className="text-xs text-amber-600 mt-1 truncate w-44">Not found in Lehenga Inventory</p>
            )}
          </div>
          <div>
            <label className={lbl}>Function Date</label>
            <input type="date" value={checkerDate} onChange={e => setCheckerDate(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm w-44 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" />
          </div>
          <div className="pb-0.5 flex-1 min-w-[200px]">
            {(!checkerCode.trim() || !checkerDate) && (
              <p className="text-xs text-slate-400 italic">Enter a lehenga code + function date to check.</p>
            )}
            {checkerLoading && <p className="text-xs text-slate-400 italic">Checking…</p>}
            {!checkerLoading && checkerResult !== null && checkerCode.trim() && checkerDate && (
              checkerResult.length === 0 ? (
                <span className="flex items-center gap-1.5 text-green-600 text-sm font-semibold">
                  <CheckCircle className="h-4 w-4" /> &ldquo;{checkerCode}&rdquo; is available for {fmtDate(checkerDate)}
                </span>
              ) : (
                <div className="space-y-1">
                  <span className="flex items-center gap-1.5 text-red-600 text-sm font-semibold">
                    <AlertCircle className="h-4 w-4 shrink-0" /> &ldquo;{checkerCode}&rdquo; not available for {fmtDate(checkerDate)}:
                  </span>
                  {checkerResult.map((r, i) => (
                    <p key={i} className="text-xs bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-1.5 inline-block">
                      Already booked from <strong>{fmtDate(r.pickup_date)}</strong> to <strong>{fmtDate(r.return_date)}</strong>
                      {r.customer_name ? <span className="text-red-400"> (by {r.customer_name})</span> : ''}
                    </p>
                  ))}
                </div>
              )
            )}
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 space-y-5">

        {/* Dates */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div><label className={lbl}>Booking Date</label><input type="date" value={form.booking_date} onChange={e => setField('booking_date', e.target.value)} className={inp} /></div>
          <div><label className={lbl}>Function Date</label><input type="date" value={form.function_date} onChange={e => handleFunctionDate(e.target.value)} className={inp} /></div>
          <div><label className={lbl}>Pickup <span className="text-slate-400 font-normal">(−1)</span></label><input type="date" value={form.pickup_date} onChange={e => setField('pickup_date', e.target.value)} className={inp} /></div>
          <div><label className={lbl}>Return <span className="text-slate-400 font-normal">(+1)</span></label><input type="date" value={form.return_date} onChange={e => setField('return_date', e.target.value)} className={inp} /></div>
        </div>

        {/* Name → Code lookup */}
        <div className="pt-2 border-t border-slate-100">
          <label className={lbl}>Find Lehenga Code by Name</label>
          <div className="relative">
            <input value={nameSearch} onChange={e => setNameSearch(e.target.value)}
              placeholder="Type lehenga name to find its code…" className={inp} />
            {nameResults.length > 0 && (
              <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {nameResults.map(s => (
                  <button key={s.id} type="button"
                    onMouseDown={() => { setPieceSearch(s.code || ''); setNameSearch('') }}
                    className="w-full text-left px-4 py-2.5 hover:bg-amber-50 border-b border-slate-100 last:border-0 flex items-center justify-between gap-4">
                    <span className="text-sm text-slate-700 truncate">{s.name}</span>
                    <span className="text-sm font-bold text-amber-700 shrink-0">{s.code}</span>
                  </button>
                ))}
              </div>
            )}
            {nameSearch.trim().length >= 2 && nameResults.length === 0 && (
              <p className="text-xs text-slate-400 mt-1">No lehengas found</p>
            )}
          </div>
        </div>

        {/* Lehenga picker */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
          <div>
            <label className={lbl}>Lehenga *</label>
            <input value={pieceSearch} onChange={e => setPieceSearch(e.target.value)} placeholder="Search by name, code, colour…" className={`${inp} mb-2`} />
            <select value={form.lehenga_id} onChange={e => handlePieceSelect(e.target.value)} className={inp}>
              <option value="">-- Select a Lehenga --</option>
              {filteredPieces.map(s => <option key={s.id} value={s.id}>{itemLabel(s)}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div><label className={lbl}>Category</label><input value={form.category} onChange={e => setField('category', e.target.value)} placeholder="Auto" className={`${inp} bg-slate-50`} /></div>
            <div><label className={lbl}>Size</label><input value={form.size} onChange={e => setField('size', e.target.value)} placeholder="Auto" className={`${inp} bg-slate-50`} /></div>
            <div><label className={lbl}>Colour</label><input value={form.colour} onChange={e => setField('colour', e.target.value)} placeholder="Auto" className={`${inp} bg-slate-50`} /></div>
          </div>
        </div>

        {/* Availability of the selected piece for the chosen function date */}
        {(checkingAvail || (form.code && form.function_date)) && (
          <div className="min-h-[20px]">
            {checkingAvail && <p className="text-xs text-slate-400 italic">Checking availability…</p>}
            {!checkingAvail && availability.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 space-y-1">
                <div className="flex items-center gap-1.5 text-red-700 font-semibold text-xs">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" /> &ldquo;{form.code}&rdquo; not available for {fmtDate(form.function_date)}:
                </div>
                {availability.map((a, i) => (
                  <p key={i} className="text-xs text-red-600 pl-5">
                    Already booked from {fmtDate(a.pickup_date)} to {fmtDate(a.return_date)}{a.customer_name ? ` (by ${a.customer_name})` : ''}
                  </p>
                ))}
              </div>
            )}
            {!checkingAvail && form.code && form.function_date && availability.length === 0 && (
              <p className="text-xs text-green-600 flex items-center gap-1"><CheckCircle className="h-3.5 w-3.5" /> &ldquo;{form.code}&rdquo; is available for {fmtDate(form.function_date)}</p>
            )}
          </div>
        )}

        <div>
          <label className={lbl}>Customized Lehenga</label>
          <input value={form.customized_lehenga} onChange={e => setField('customized_lehenga', e.target.value)}
            placeholder="Enter customized lehenga details (if not from inventory)…" className={inp} />
          <p className="text-xs text-slate-400 mt-1">If filled, you can enter the Rental Amount manually below.</p>
        </div>

        <div className="pt-2 border-t border-slate-100">
          <BridalImageUpload label="Lehenga Image (auto-filled from inventory; flows into the invoice)"
            value={form.lehenga_image} onChange={(url) => setField('lehenga_image', url || '')} uploadFn={lehengaAPI.uploadImage} />
        </div>

        {/* Amounts */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
          <div><label className={lbl}>Rental Amount (₹)</label><input type="number" step="0.01" min="0" value={form.rental_amount} onChange={e => setField('rental_amount', e.target.value)} placeholder="Auto-filled / manual" className={inp} /></div>
          <div><label className={lbl}>Discount (₹)</label><input type="number" step="0.01" min="0" value={form.discount} onChange={e => setField('discount', e.target.value)} placeholder="0" className={inp} /></div>
          <div><label className={lbl}>Booking Advance (₹)</label><input type="number" step="0.01" min="0" value={form.booking_amount} onChange={e => setField('booking_amount', e.target.value)} placeholder="Advance paid" className={inp} /></div>
          <div><label className={lbl}>Security Deposit (₹)</label><input type="number" step="0.01" min="0" value={form.security_amount} onChange={e => setField('security_amount', e.target.value)} placeholder="Collected on pickup" className={inp} /></div>
          <div>
            <label className={lbl}>Payment Mode</label>
            <select value={form.payment_mode} onChange={e => setField('payment_mode', e.target.value)} className={inp}>
              <option value="cash">Cash</option>
              <option value="online">Online / UPI</option>
              <option value="card">Card</option>
            </select>
          </div>
          <div><label className={lbl}>Stylist Who Attended</label><input value={form.stylist} onChange={e => setField('stylist', e.target.value)} placeholder="Enter stylist name" className={inp} /></div>
        </div>

        {/* Live money summary */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm space-y-1.5">
          <div className="flex justify-between"><span className="text-slate-600">Rental Amount</span><span>{formatCurrency(rent)}</span></div>
          {discount > 0 && <div className="flex justify-between text-red-600"><span>Less: Discount</span><span>− {formatCurrency(discount)}</span></div>}
          <div className="flex justify-between text-red-600"><span>Less: Booking Advance</span><span>− {formatCurrency(advance)}</span></div>
          <div className="flex justify-between font-semibold border-t border-slate-200 pt-1.5"><span>Remaining Rent</span><span>{formatCurrency(remaining)}</span></div>
          {security > 0 && <div className="flex justify-between text-blue-700"><span>Add: Security on Pickup</span><span>+ {formatCurrency(security)}</span></div>}
          <div className="flex justify-between font-bold text-amber-700 border-t border-slate-200 pt-1.5"><span>Total Due on Pickup</span><span>{formatCurrency(dueOnPickup)}</span></div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><label className={lbl}>Alteration / Fitting Notes</label><textarea value={form.alteration} onChange={e => setField('alteration', e.target.value)} rows={3} placeholder="Blouse size, hem length, fall &amp; pico…" className={inp} /></div>
          <div><label className={lbl}>Other Notes</label><textarea value={form.notes} onChange={e => setField('notes', e.target.value)} rows={3} placeholder="Anything else to record…" className={inp} /></div>
        </div>

        <div className="flex justify-center pt-2">
          <button type="submit" disabled={saving}
            className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white px-8 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2">
            <Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save Rental'}
          </button>
        </div>
      </form>
    </div>
  )
}
