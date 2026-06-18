import { useEffect, useState } from 'react'
import { Search, Trash2, Eye, X, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import { bridalAPI } from '../../api'
import { formatCurrency } from '../../utils/formatters'
import LoadingSpinner from '../../components/common/LoadingSpinner'

const fmtDate = (d) => {
  if (!d) return '—'
  const [y, m, day] = String(d).split('T')[0].split('-')
  return `${day}/${m}/${y}`
}
const inp = "border border-slate-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
const lbl = "block text-xs font-medium text-slate-700 mb-1"

const ACCESSORY_FIELDS = [
  ['nath', 'Nath'], ['maang_teeka', 'Maang Teeka'], ['ring', 'Ring'], ['matha_patti', 'Matha Patti'],
  ['sheesh_patti', 'Sheesh Patti'], ['hath_phool', 'Hath Phool'], ['pasa', 'Pasa'], ['any_other_item', 'Any Other Item'],
]

export default function SavedBookings() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [detail, setDetail] = useState(null)

  const load = async () => {
    setLoading(true)
    try { const { data } = await bridalAPI.listBookings(); setRows(data.data || []) }
    catch { toast.error('Failed to load bookings') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const remove = async (r) => {
    if (!window.confirm('Delete this booking?')) return
    try { await bridalAPI.deleteBooking(r.id); toast.success('Deleted'); setDetail(null); load() }
    catch { toast.error('Failed to delete') }
  }

  const term = q.trim().toLowerCase()
  const visible = term
    ? rows.filter(r => [r.set_code, r.set_name, r.customer_name, r.mobile_no, r.category]
        .some(v => (v || '').toLowerCase().includes(term)))
    : rows

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Saved Booking</h1>
          <p className="text-sm text-slate-500 mt-0.5">{rows.length} bookings</p>
        </div>
        <div className="relative">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search set / customer / mobile"
            className="border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm w-72 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16"><LoadingSpinner size="lg" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-800 text-xs text-slate-200 uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Set</th>
                  <th className="px-4 py-3 text-left">Customer</th>
                  <th className="px-4 py-3 text-left">Function Date</th>
                  <th className="px-4 py-3 text-right">Rent (₹)</th>
                  <th className="px-4 py-3 text-right">Advance (₹)</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-12 text-slate-400">{rows.length ? 'No matches' : 'No bookings yet'}</td></tr>
                ) : visible.map(r => (
                  <tr key={r.id} className="border-b hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-amber-600">{r.set_code || r.customized_set || '—'}</div>
                      <div className="text-xs text-slate-500">{r.set_name || (r.customized_set ? 'Customized' : '')}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {r.customer_name || <span className="text-slate-300">—</span>}
                      {r.mobile_no && <div className="text-xs text-slate-400">{r.mobile_no}</div>}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{fmtDate(r.function_date)}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{parseFloat(r.bridal_set_rent) > 0 ? formatCurrency(r.bridal_set_rent) : '—'}</td>
                    <td className="px-4 py-3 text-right text-green-700 font-medium">{parseFloat(r.booking_amount) > 0 ? formatCurrency(r.booking_amount) : '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1.5">
                        <button onClick={() => setDetail(r)} className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700" title="View / Edit"><Eye className="h-4 w-4" /></button>
                        <button onClick={() => remove(r)} className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-600" title="Delete"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {detail && <DetailModal booking={detail} onClose={() => setDetail(null)} onSaved={() => { setDetail(null); load() }} onDelete={() => remove(detail)} />}
    </div>
  )
}

function DetailModal({ booking, onClose, onSaved, onDelete }) {
  const [form, setForm] = useState({
    customer_name: booking.customer_name || '', mobile_no: booking.mobile_no || '',
    bridal_set_rent: booking.bridal_set_rent ?? '', booking_amount: booking.booking_amount ?? '',
    stylist: booking.stylist || '', customization: booking.customization || '',
    function_date: booking.function_date ? String(booking.function_date).split('T')[0] : '',
    pickup_date: booking.pickup_date ? String(booking.pickup_date).split('T')[0] : '',
    return_date: booking.return_date ? String(booking.return_date).split('T')[0] : '',
  })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const save = async () => {
    setSaving(true)
    try {
      await bridalAPI.updateBooking(booking.id, {
        ...form,
        bridal_set_rent: form.bridal_set_rent === '' ? null : parseFloat(form.bridal_set_rent),
        booking_amount: form.booking_amount === '' ? null : parseFloat(form.booking_amount),
        function_date: form.function_date || null,
        pickup_date: form.pickup_date || null,
        return_date: form.return_date || null,
      })
      toast.success('Updated'); onSaved()
    } catch { toast.error('Failed to update') }
    finally { setSaving(false) }
  }

  const accessories = ACCESSORY_FIELDS.filter(([k]) => booking[k]).map(([k, label]) => `${label}: ${booking[k]}`)

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-800">Booking — {booking.set_code || booking.customized_set || 'Customized'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X className="h-5 w-5" /></button>
        </div>

        {/* read-only summary */}
        <div className="bg-slate-50 rounded-lg p-3 mb-4 text-sm space-y-1">
          <div><span className="text-slate-500">Set:</span> <strong>{booking.set_name || '—'}</strong>{booking.category ? ` · ${booking.category}` : ''}</div>
          {booking.customized_set && <div><span className="text-slate-500">Customized:</span> {booking.customized_set}</div>}
          {accessories.length > 0 && <div className="text-slate-600">{accessories.join(' · ')}</div>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div><label className={lbl}>Customer Name</label><input value={form.customer_name} onChange={e => set('customer_name', e.target.value)} className={inp} /></div>
          <div><label className={lbl}>Mobile No.</label><input value={form.mobile_no} onChange={e => set('mobile_no', e.target.value)} className={inp} /></div>
          <div><label className={lbl}>Function Date</label><input type="date" value={form.function_date} onChange={e => set('function_date', e.target.value)} className={inp} /></div>
          <div><label className={lbl}>Stylist</label><input value={form.stylist} onChange={e => set('stylist', e.target.value)} className={inp} /></div>
          <div><label className={lbl}>Pickup</label><input type="date" value={form.pickup_date} onChange={e => set('pickup_date', e.target.value)} className={inp} /></div>
          <div><label className={lbl}>Return</label><input type="date" value={form.return_date} onChange={e => set('return_date', e.target.value)} className={inp} /></div>
          <div><label className={lbl}>Bridal Set Rent (₹)</label><input type="number" step="0.01" value={form.bridal_set_rent} onChange={e => set('bridal_set_rent', e.target.value)} className={inp} /></div>
          <div><label className={lbl}>Booking Amount (₹)</label><input type="number" step="0.01" value={form.booking_amount} onChange={e => set('booking_amount', e.target.value)} className={inp} /></div>
          <div className="col-span-2"><label className={lbl}>Customization</label><textarea value={form.customization} onChange={e => set('customization', e.target.value)} rows={2} className={inp} /></div>
        </div>

        <div className="flex justify-between gap-2 mt-5">
          <button onClick={onDelete} className="text-red-600 hover:bg-red-50 px-4 py-2 rounded-lg text-sm flex items-center gap-1.5"><Trash2 className="h-4 w-4" /> Delete</button>
          <div className="flex gap-2">
            <button onClick={onClose} className="border border-slate-200 text-slate-600 hover:bg-slate-50 px-4 py-2 rounded-lg text-sm">Close</button>
            <button onClick={save} disabled={saving} className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5"><Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
