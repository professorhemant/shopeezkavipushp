import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, CheckCircle, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import { bridalAPI } from '../../api'
import LoadingSpinner from '../../components/common/LoadingSpinner'

const today = () => new Date().toISOString().split('T')[0]
const addDays = (dateStr, days) => {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}
const fmtDate = (d) => {
  if (!d) return '—'
  const [y, m, day] = String(d).split('T')[0].split('-')
  return `${day}/${m}/${y}`
}
const itemLabel = (it) => (it.code ? `${it.code} — ${it.name}` : it.name)

// accessory field key → inventory item_type
const ACCESSORIES = [
  { key: 'nath',         label: 'Nath',         type: 'nath' },
  { key: 'maang_teeka',  label: 'Maang Teeka',  type: 'maang_teeka' },
  { key: 'ring',         label: 'Ring',         type: 'ring' },
  { key: 'matha_patti',  label: 'Matha Patti',  type: 'matha_patti' },
  { key: 'sheesh_patti', label: 'Sheesh Patti', type: 'sheesh_patti' },
  { key: 'hath_phool',   label: 'Hath Phool',   type: 'hath_phool' },
  { key: 'pasa',         label: 'Pasa',         type: 'pasa' },
]

const EMPTY = {
  bridal_set_id: '', set_code: '', set_name: '', category: '', customized_set: '',
  nath: '', maang_teeka: '', ring: '', matha_patti: '', sheesh_patti: '', hath_phool: '', pasa: '',
  any_other_item: '', bridal_set_rent: '', booking_amount: '', customization: '', stylist: '',
  customer_name: '', mobile_no: '',
  function_date: '', booking_date: today(), pickup_date: '', return_date: '',
}

const inp = "border border-slate-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
const lbl = "block text-xs font-medium text-slate-700 mb-1"

export default function BridalBookings() {
  const navigate = useNavigate()
  const [inv, setInv] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [setSearch, setSetSearch] = useState('')

  // in-form availability (for the set being booked)
  const [availability, setAvailability] = useState([])
  const [checkingAvail, setCheckingAvail] = useState(false)
  const availRef = useRef(null)

  // standalone "Check Set Availability" box
  const [checkerCode, setCheckerCode] = useState('')
  const [checkerDate, setCheckerDate] = useState('')
  const [checkerResult, setCheckerResult] = useState(null) // null = not checked, [] = available, [...] = conflicts
  const [checkerLoading, setCheckerLoading] = useState(false)
  const checkerRef = useRef(null)

  useEffect(() => {
    (async () => {
      try { const { data } = await bridalAPI.listInventory(); setInv(data.data || []) }
      catch { toast.error('Failed to load bridal inventory') }
      finally { setLoading(false) }
    })()
  }, [])

  const sets = inv.filter(i => i.item_type === 'set')
  const byType = (t) => inv.filter(i => i.item_type === t)
  const filteredSets = setSearch.trim()
    ? sets.filter(s => `${s.code || ''} ${s.name}`.toLowerCase().includes(setSearch.trim().toLowerCase()))
    : sets

  const setField = (key, val) => setForm(f => ({ ...f, [key]: val }))

  const handleSetSelect = (id) => {
    const s = sets.find(x => x.id === id)
    if (!s) { setForm(f => ({ ...f, bridal_set_id: '', set_code: '', set_name: '', category: '', bridal_set_rent: '' })); return }
    setForm(f => ({
      ...f,
      bridal_set_id: s.id,
      set_code: s.code || '',
      set_name: s.name || '',
      category: s.category || '',
      bridal_set_rent: f.customized_set ? f.bridal_set_rent : (s.rental_price ?? ''),
    }))
  }

  const handleFunctionDate = (val) => {
    setForm(f => ({ ...f, function_date: val, pickup_date: addDays(val, -1), return_date: addDays(val, +1) }))
  }

  // availability check on set_code + function_date
  useEffect(() => {
    if (availRef.current) clearTimeout(availRef.current)
    const code = form.set_code.trim()
    if (!code || !form.function_date) { setAvailability([]); return }
    availRef.current = setTimeout(async () => {
      setCheckingAvail(true)
      try { const res = await bridalAPI.checkAvailability(code, form.function_date); setAvailability(res.data.data || []) }
      catch { setAvailability([]) }
      finally { setCheckingAvail(false) }
    }, 500)
    return () => clearTimeout(availRef.current)
  }, [form.set_code, form.function_date])

  // standalone checker: fires as soon as a set code + function date are entered
  useEffect(() => {
    if (checkerRef.current) clearTimeout(checkerRef.current)
    const code = checkerCode.trim()
    if (!code || !checkerDate) { setCheckerResult(null); return }
    checkerRef.current = setTimeout(async () => {
      setCheckerLoading(true)
      try { const res = await bridalAPI.checkAvailability(code, checkerDate); setCheckerResult(res.data.data || []) }
      catch { setCheckerResult([]) }
      finally { setCheckerLoading(false) }
    }, 500)
    return () => clearTimeout(checkerRef.current)
  }, [checkerCode, checkerDate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.bridal_set_id && !form.customized_set.trim()) {
      toast.error('Select a Bridal Set or enter a Customized Bridal Set')
      return
    }
    setSaving(true)
    try {
      await bridalAPI.createBooking({
        ...form,
        bridal_set_id: form.bridal_set_id || null,
        bridal_set_rent: form.bridal_set_rent === '' ? null : parseFloat(form.bridal_set_rent),
        booking_amount: form.booking_amount === '' ? null : parseFloat(form.booking_amount),
        function_date: form.function_date || null,
        booking_date: form.booking_date || null,
        pickup_date: form.pickup_date || null,
        return_date: form.return_date || null,
      })
      toast.success('Booking saved')
      navigate('/bridal/saved')
    } catch { toast.error('Failed to save booking') }
    finally { setSaving(false) }
  }

  if (loading) return <div className="flex items-center justify-center py-20"><LoadingSpinner size="lg" /></div>

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Day Book — Bridal Bookings</h1>
        <p className="text-sm text-slate-500 mt-0.5">New booking · saved bookings appear under <strong>Saved Booking</strong></p>
      </div>

      {sets.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
          No bridal sets in inventory yet. Add them under <strong>Bridal Inventory</strong> so they appear in the dropdown below.
        </div>
      )}

      {/* Standalone availability checker */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Check Set Availability</p>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className={lbl}>Set Code</label>
            <input value={checkerCode} onChange={e => setCheckerCode(e.target.value)} placeholder="e.g. B001"
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm w-44 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" />
          </div>
          <div>
            <label className={lbl}>Function Date</label>
            <input type="date" value={checkerDate} onChange={e => setCheckerDate(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm w-44 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" />
          </div>
          <div className="pb-0.5 flex-1 min-w-[200px]">
            {(!checkerCode.trim() || !checkerDate) && (
              <p className="text-xs text-slate-400 italic">Enter a set code + function date to check.</p>
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
                      {r.function_date ? <span className="text-red-400"> (Function: {fmtDate(r.function_date)})</span> : ''}
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

        {/* Bridal Set */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
          <div>
            <label className={lbl}>Bridal Set *</label>
            <input value={setSearch} onChange={e => setSetSearch(e.target.value)} placeholder="Search by Set ID/Code…" className={`${inp} mb-2`} />
            <select value={form.bridal_set_id} onChange={e => handleSetSelect(e.target.value)} className={inp}>
              <option value="">-- Select a Set --</option>
              {filteredSets.map(s => <option key={s.id} value={s.id}>{itemLabel(s)}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>Category</label>
            <input value={form.category} onChange={e => setField('category', e.target.value)} placeholder="Auto-filled from selected set" className={`${inp} bg-slate-50`} />
          </div>
        </div>

        {/* Availability of the selected set for the chosen function date */}
        {(checkingAvail || (form.set_code && form.function_date)) && (
          <div className="min-h-[20px]">
            {checkingAvail && <p className="text-xs text-slate-400 italic">Checking availability…</p>}
            {!checkingAvail && availability.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 space-y-1">
                <div className="flex items-center gap-1.5 text-red-700 font-semibold text-xs">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" /> &ldquo;{form.set_code}&rdquo; not available for {fmtDate(form.function_date)}:
                </div>
                {availability.map((a, i) => (
                  <p key={i} className="text-xs text-red-600 pl-5">
                    Already booked from {fmtDate(a.pickup_date)} to {fmtDate(a.return_date)}{a.function_date ? ` (Function: ${fmtDate(a.function_date)})` : ''}
                  </p>
                ))}
              </div>
            )}
            {!checkingAvail && form.set_code && form.function_date && availability.length === 0 && (
              <p className="text-xs text-green-600 flex items-center gap-1"><CheckCircle className="h-3.5 w-3.5" /> &ldquo;{form.set_code}&rdquo; is available for {fmtDate(form.function_date)}</p>
            )}
          </div>
        )}

        <div>
          <label className={lbl}>Customized Bridal Set</label>
          <input value={form.customized_set} onChange={e => setField('customized_set', e.target.value)} placeholder="Enter customized set details (if applicable)…" className={inp} />
          <p className="text-xs text-slate-400 mt-1">If filled, you can enter Bridal Set Rent manually below.</p>
        </div>

        {/* Accessories */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {ACCESSORIES.map(a => {
            const opts = byType(a.type)
            return (
              <div key={a.key}>
                <label className={lbl}>{a.label}</label>
                <select value={form[a.key]} onChange={e => setField(a.key, e.target.value)} className={inp}>
                  <option value="">-- Select {a.label} --</option>
                  {opts.map(o => <option key={o.id} value={itemLabel(o)}>{itemLabel(o)}</option>)}
                </select>
              </div>
            )
          })}
          <div className="sm:col-span-2">
            <label className={lbl}>Any Other Item</label>
            <input value={form.any_other_item} onChange={e => setField('any_other_item', e.target.value)} placeholder="Enter any other item details…" className={inp} />
          </div>
        </div>

        {/* Amounts + customer */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
          <div><label className={lbl}>Bridal Set Rent (₹)</label><input type="number" step="0.01" min="0" value={form.bridal_set_rent} onChange={e => setField('bridal_set_rent', e.target.value)} placeholder="Auto-filled / manual" className={inp} /></div>
          <div><label className={lbl}>Booking Amount (₹)</label><input type="number" step="0.01" min="0" value={form.booking_amount} onChange={e => setField('booking_amount', e.target.value)} placeholder="Advance paid by customer" className={inp} /></div>
          <div><label className={lbl}>Customer Name</label><input value={form.customer_name} onChange={e => setField('customer_name', e.target.value)} placeholder="Customer name" className={inp} /></div>
          <div><label className={lbl}>Mobile No.</label><input value={form.mobile_no} onChange={e => setField('mobile_no', e.target.value)} placeholder="Mobile number" className={inp} /></div>
          <div><label className={lbl}>Stylist Who Attended</label><input value={form.stylist} onChange={e => setField('stylist', e.target.value)} placeholder="Enter stylist name" className={inp} /></div>
        </div>

        <div>
          <label className={lbl}>Customization</label>
          <textarea value={form.customization} onChange={e => setField('customization', e.target.value)} rows={3} placeholder="Enter any customization details…" className={inp} />
        </div>

        <div className="flex justify-center pt-2">
          <button type="submit" disabled={saving}
            className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white px-8 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2">
            <Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save Booking'}
          </button>
        </div>
      </form>
    </div>
  )
}
