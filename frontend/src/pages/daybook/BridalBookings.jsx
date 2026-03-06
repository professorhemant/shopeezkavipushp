import { useEffect, useState } from 'react'
import { Plus, Edit2, Trash2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { dayBookAPI } from '../../api'
import { formatCurrency } from '../../utils/formatters'
import LoadingSpinner from '../../components/common/LoadingSpinner'

const today = () => new Date().toISOString().split('T')[0]
const EMPTY = { slip_no: '', amount: '', payment_mode: 'cash' }

export default function BridalBookings() {
  const [date, setDate] = useState(today())
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(EMPTY)
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)

  const load = async () => {
    setLoading(true)
    try { const { data } = await dayBookAPI.getBridalBookings(date); setRows(data.data || []) }
    catch { toast.error('Failed to load') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [date])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.amount) return toast.error('Amount is required')
    setSaving(true)
    try {
      if (editId) { await dayBookAPI.updateBridalBooking(editId, { ...form, date }); toast.success('Updated') }
      else { await dayBookAPI.createBridalBooking({ ...form, date }); toast.success('Added') }
      setForm(EMPTY); setEditId(null); setShowForm(false); load()
    } catch { toast.error('Failed to save') }
    finally { setSaving(false) }
  }

  const startEdit = (row) => { setForm({ slip_no: row.slip_no || '', amount: row.amount, payment_mode: row.payment_mode }); setEditId(row.id); setShowForm(true) }
  const handleDelete = async (id) => {
    if (!window.confirm('Delete this entry?')) return
    try { await dayBookAPI.deleteBridalBooking(id); toast.success('Deleted'); load() }
    catch { toast.error('Failed to delete') }
  }

  const cashTotal = rows.filter(r => r.payment_mode === 'cash').reduce((a, r) => a + parseFloat(r.amount || 0), 0)
  const onlineTotal = rows.filter(r => r.payment_mode === 'online').reduce((a, r) => a + parseFloat(r.amount || 0), 0)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Day Book — Bridal Bookings</h1>
          <p className="text-sm text-slate-500 mt-0.5">{rows.length} entries</p>
        </div>
        <div className="flex items-center gap-3">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" />
          <button onClick={() => { setForm(EMPTY); setEditId(null); setShowForm(true) }}
            className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
            <Plus className="h-4 w-4" /> Add Entry
          </button>
        </div>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl p-4 shadow-sm border border-amber-200">
          <form onSubmit={handleSubmit} className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Slip No.</label>
              <input value={form.slip_no} onChange={(e) => setForm({ ...form, slip_no: e.target.value })}
                placeholder="Slip number"
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm w-40 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Amount (₹) *</label>
              <input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="0.00" required
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm w-36 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Mode</label>
              <select value={form.payment_mode} onChange={(e) => setForm({ ...form, payment_mode: e.target.value })}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500">
                <option value="cash">Cash</option>
                <option value="online">Online</option>
              </select>
            </div>
            <button type="submit" disabled={saving}
              className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium">
              {saving ? 'Saving...' : editId ? 'Update' : 'Add'}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setEditId(null); setForm(EMPTY) }}
              className="border border-slate-200 text-slate-600 hover:bg-slate-50 px-3 py-2 rounded-lg text-sm">
              <X className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? <div className="flex items-center justify-center py-16"><LoadingSpinner size="lg" /></div> : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
              <tr>
                <th className="px-4 py-3 text-left">S.No.</th>
                <th className="px-4 py-3 text-left">Slip No.</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-center">Mode</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-12 text-slate-400">No entries for this date</td></tr>
              ) : rows.map((r, i) => (
                <tr key={r.id} className="border-b hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-500">{i + 1}</td>
                  <td className="px-4 py-3 font-medium text-amber-600">{r.slip_no || '-'}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-800">{formatCurrency(r.amount)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${r.payment_mode === 'cash' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                      {r.payment_mode === 'cash' ? 'Cash' : 'Online'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1.5">
                      <button onClick={() => startEdit(r)} className="p-1.5 rounded hover:bg-amber-50 text-slate-400 hover:text-amber-600"><Edit2 className="h-4 w-4" /></button>
                      <button onClick={() => handleDelete(r.id)} className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            {rows.length > 0 && (
              <tfoot className="bg-slate-50 text-sm font-semibold">
                <tr>
                  <td colSpan={2} className="px-4 py-3 text-slate-600">Total</td>
                  <td className="px-4 py-3 text-right text-slate-800">{formatCurrency(cashTotal + onlineTotal)}</td>
                  <td colSpan={2} className="px-4 py-3 text-slate-500 text-xs font-normal">Cash: {formatCurrency(cashTotal)} · Online: {formatCurrency(onlineTotal)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        )}
      </div>
    </div>
  )
}
