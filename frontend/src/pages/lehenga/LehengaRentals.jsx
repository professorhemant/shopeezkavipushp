import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Search, Trash2, Eye, X, Save, Plus, Undo2, Receipt } from 'lucide-react'
import toast from 'react-hot-toast'
import { lehengaAPI } from '../../api'
import { formatCurrency } from '../../utils/formatters'
import LoadingSpinner from '../../components/common/LoadingSpinner'

const fmtDate = (d) => {
  if (!d) return '—'
  const [y, m, day] = String(d).split('T')[0].split('-')
  return `${day}/${m}/${y}`
}
const dateOnly = (d) => (d ? String(d).split('T')[0] : '')

const inp = "border border-slate-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
const lbl = "block text-xs font-medium text-slate-700 mb-1"

const STATUS_BADGE = {
  active:    { label: 'Active',    cls: 'bg-amber-100 text-amber-700' },
  returned:  { label: 'Returned',  cls: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Cancelled', cls: 'bg-slate-200 text-slate-600' },
}

const STATUS_TABS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'returned', label: 'Returned' },
  { value: 'cancelled', label: 'Cancelled' },
]

export default function LehengaRentals() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [detail, setDetail] = useState(null)

  const load = async () => {
    setLoading(true)
    try { const { data } = await lehengaAPI.listRentals(); setRows(data.data || []) }
    catch { toast.error('Failed to load rentals') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const remove = async (r) => {
    if (!window.confirm('Delete this rental? This cannot be undone.')) return
    try { await lehengaAPI.deleteRental(r.id); toast.success('Deleted'); setDetail(null); load() }
    catch { toast.error('Failed to delete') }
  }

  const markReturned = async (r) => {
    if (!window.confirm(`Mark "${r.code || r.customized_lehenga || 'this lehenga'}" as returned?`)) return
    try { await lehengaAPI.markRentalReturned(r.id); toast.success('Marked returned'); setDetail(null); load() }
    catch { toast.error('Failed to update') }
  }

  const visible = useMemo(() => {
    let list = statusFilter === 'all' ? rows : rows.filter(r => (r.status || 'active') === statusFilter)
    const term = q.trim().toLowerCase()
    if (!term) return list
    return list.filter(r => [r.code, r.name, r.customized_lehenga, r.customer_name, r.mobile_no, r.category, r.colour]
      .some(v => (v || '').toLowerCase().includes(term)))
  }, [rows, q, statusFilter])

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Saved Lehenga Rentals</h1>
          <p className="text-sm text-slate-500 mt-0.5">{rows.length} rentals · {rows.filter(r => (r.status || 'active') === 'active').length} currently out</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search lehenga / customer / mobile"
              className="border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm w-72 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" />
          </div>
          <Link to="/lehenga/rental" className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
            <Plus className="h-4 w-4" /> New Rental
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {STATUS_TABS.map(t => {
          const n = t.value === 'all' ? rows.length : rows.filter(r => (r.status || 'active') === t.value).length
          return (
            <button key={t.value} onClick={() => setStatusFilter(t.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium ${statusFilter === t.value ? 'bg-amber-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              {t.label} ({n})
            </button>
          )
        })}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16"><LoadingSpinner size="lg" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-800 text-xs text-slate-200 uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Lehenga</th>
                  <th className="px-4 py-3 text-left">Customer</th>
                  <th className="px-4 py-3 text-left">Function</th>
                  <th className="px-4 py-3 text-left">Pickup → Return</th>
                  <th className="px-4 py-3 text-right">Rent (₹)</th>
                  <th className="px-4 py-3 text-right">Advance (₹)</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-12 text-slate-400">{rows.length ? 'No matches' : 'No rentals yet'}</td></tr>
                ) : visible.map(r => {
                  const badge = STATUS_BADGE[r.status] || STATUS_BADGE.active
                  return (
                    <tr key={r.id} className="border-b hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {r.lehenga_image
                            ? <img src={r.lehenga_image} alt="" className="h-9 w-9 rounded object-cover border border-slate-200 shrink-0" />
                            : <span className="h-9 w-9 rounded bg-slate-100 border border-slate-200 shrink-0" />}
                          <div className="min-w-0">
                            <div className="font-semibold text-amber-600">{r.code || r.customized_lehenga || '—'}</div>
                            <div className="text-xs text-slate-500 truncate">
                              {r.name || (r.customized_lehenga ? 'Customized' : '')}
                              {[r.size, r.colour].filter(Boolean).length ? ` · ${[r.size, r.colour].filter(Boolean).join(', ')}` : ''}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {r.customer_name || <span className="text-slate-300">—</span>}
                        {r.mobile_no && <div className="text-xs text-slate-400">{r.mobile_no}</div>}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{fmtDate(r.function_date)}</td>
                      <td className="px-4 py-3 text-slate-600 text-xs">{fmtDate(r.pickup_date)} → {fmtDate(r.return_date)}</td>
                      <td className="px-4 py-3 text-right text-slate-700">{parseFloat(r.rental_amount) > 0 ? formatCurrency(r.rental_amount) : '—'}</td>
                      <td className="px-4 py-3 text-right text-green-700 font-medium">{parseFloat(r.booking_amount) > 0 ? formatCurrency(r.booking_amount) : '—'}</td>
                      <td className="px-4 py-3 text-center"><span className={`text-xs rounded px-2 py-0.5 ${badge.cls}`}>{badge.label}</span></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1.5">
                          <Link to={`/lehenga/rental-invoice?rental=${r.id}`} className="p-1.5 rounded hover:bg-amber-50 text-slate-400 hover:text-amber-600" title="Generate invoice"><Receipt className="h-4 w-4" /></Link>
                          {r.status === 'active' && (
                            <button onClick={() => markReturned(r)} className="p-1.5 rounded hover:bg-green-50 text-slate-400 hover:text-green-600" title="Mark returned"><Undo2 className="h-4 w-4" /></button>
                          )}
                          <button onClick={() => setDetail(r)} className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700" title="View / Edit"><Eye className="h-4 w-4" /></button>
                          <button onClick={() => remove(r)} className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-600" title="Delete"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {detail && (
        <DetailModal rental={detail} onClose={() => setDetail(null)}
          onSaved={() => { setDetail(null); load() }}
          onDelete={() => remove(detail)}
          onReturned={() => markReturned(detail)} />
      )}
    </div>
  )
}

function DetailModal({ rental, onClose, onSaved, onDelete, onReturned }) {
  const [form, setForm] = useState({
    customer_name: rental.customer_name || '', mobile_no: rental.mobile_no || '',
    aadhaar_no: rental.aadhaar_no || '', address: rental.address || '',
    rental_amount: rental.rental_amount ?? '', discount: rental.discount ?? '',
    booking_amount: rental.booking_amount ?? '', security_amount: rental.security_amount ?? '',
    damage_charges: rental.damage_charges ?? '',
    stylist: rental.stylist || '', alteration: rental.alteration || '', notes: rental.notes || '',
    function_date: dateOnly(rental.function_date),
    pickup_date: dateOnly(rental.pickup_date),
    return_date: dateOnly(rental.return_date),
    status: rental.status || 'active',
  })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const save = async () => {
    setSaving(true)
    try {
      await lehengaAPI.updateRental(rental.id, {
        ...form,
        function_date: form.function_date || null,
        pickup_date: form.pickup_date || null,
        return_date: form.return_date || null,
      })
      toast.success('Updated'); onSaved()
    } catch { toast.error('Failed to update') }
    finally { setSaving(false) }
  }

  const rent = parseFloat(form.rental_amount) || 0
  const discount = parseFloat(form.discount) || 0
  const advance = parseFloat(form.booking_amount) || 0
  const remaining = Math.max(0, rent - discount) - advance

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-800">Rental — {rental.code || rental.customized_lehenga || 'Customized'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X className="h-5 w-5" /></button>
        </div>

        {/* read-only summary */}
        <div className="bg-slate-50 rounded-lg p-3 mb-4 text-sm flex items-start gap-3">
          {rental.lehenga_image && <img src={rental.lehenga_image} alt="" className="h-20 w-20 rounded-lg object-cover border border-slate-200 shrink-0" />}
          <div className="space-y-1 min-w-0">
            <div><span className="text-slate-500">Lehenga:</span> <strong>{rental.name || '—'}</strong>{rental.category ? ` · ${rental.category}` : ''}</div>
            {(rental.size || rental.colour) && <div className="text-slate-600">{[rental.size && `Size: ${rental.size}`, rental.colour && `Colour: ${rental.colour}`].filter(Boolean).join(' · ')}</div>}
            {rental.customized_lehenga && <div><span className="text-slate-500">Customized:</span> {rental.customized_lehenga}</div>}
            <div className="text-slate-500 text-xs">Booked {fmtDate(rental.booking_date)}{rental.returned_on ? ` · Returned ${fmtDate(rental.returned_on)}` : ''}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div><label className={lbl}>Customer Name</label><input value={form.customer_name} onChange={e => set('customer_name', e.target.value)} className={inp} /></div>
          <div><label className={lbl}>Mobile Number</label><input value={form.mobile_no} onChange={e => set('mobile_no', e.target.value)} className={inp} /></div>
          <div><label className={lbl}>Aadhaar No.</label><input value={form.aadhaar_no} onChange={e => set('aadhaar_no', e.target.value)} className={inp} /></div>
          <div><label className={lbl}>Address</label><input value={form.address} onChange={e => set('address', e.target.value)} className={inp} /></div>
          <div><label className={lbl}>Function Date</label><input type="date" value={form.function_date} onChange={e => set('function_date', e.target.value)} className={inp} /></div>
          <div><label className={lbl}>Stylist</label><input value={form.stylist} onChange={e => set('stylist', e.target.value)} className={inp} /></div>
          <div><label className={lbl}>Pickup</label><input type="date" value={form.pickup_date} onChange={e => set('pickup_date', e.target.value)} className={inp} /></div>
          <div><label className={lbl}>Return</label><input type="date" value={form.return_date} onChange={e => set('return_date', e.target.value)} className={inp} /></div>
          <div><label className={lbl}>Rental Amount (₹)</label><input type="number" step="0.01" value={form.rental_amount} onChange={e => set('rental_amount', e.target.value)} className={inp} /></div>
          <div><label className={lbl}>Discount (₹)</label><input type="number" step="0.01" value={form.discount} onChange={e => set('discount', e.target.value)} className={inp} /></div>
          <div><label className={lbl}>Booking Advance (₹)</label><input type="number" step="0.01" value={form.booking_amount} onChange={e => set('booking_amount', e.target.value)} className={inp} /></div>
          <div><label className={lbl}>Security Deposit (₹)</label><input type="number" step="0.01" value={form.security_amount} onChange={e => set('security_amount', e.target.value)} className={inp} /></div>
          <div><label className={lbl}>Damage / Late Charges (₹)</label><input type="number" step="0.01" value={form.damage_charges} onChange={e => set('damage_charges', e.target.value)} className={inp} /></div>
          <div>
            <label className={lbl}>Status</label>
            <select value={form.status} onChange={e => set('status', e.target.value)} className={inp}>
              <option value="active">Active</option>
              <option value="returned">Returned</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div className="col-span-2"><label className={lbl}>Alteration / Fitting Notes</label><textarea value={form.alteration} onChange={e => set('alteration', e.target.value)} rows={2} className={inp} /></div>
          <div className="col-span-2"><label className={lbl}>Other Notes</label><textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} className={inp} /></div>
        </div>

        <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm flex justify-between font-semibold text-amber-800">
          <span>Remaining Rent</span><span>{formatCurrency(remaining)}</span>
        </div>

        <div className="flex flex-wrap justify-between gap-2 mt-5">
          <button onClick={onDelete} className="text-red-600 hover:bg-red-50 px-4 py-2 rounded-lg text-sm flex items-center gap-1.5"><Trash2 className="h-4 w-4" /> Delete</button>
          <div className="flex flex-wrap gap-2">
            {rental.status === 'active' && (
              <button onClick={onReturned} className="border border-green-200 text-green-700 hover:bg-green-50 px-4 py-2 rounded-lg text-sm flex items-center gap-1.5">
                <Undo2 className="h-4 w-4" /> Mark Returned
              </button>
            )}
            <button onClick={onClose} className="border border-slate-200 text-slate-600 hover:bg-slate-50 px-4 py-2 rounded-lg text-sm">Close</button>
            <button onClick={save} disabled={saving} className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5"><Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
