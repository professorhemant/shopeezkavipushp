import { useEffect, useState } from 'react'
import { Plus, Edit2, Trash2, Banknote, CreditCard, Smartphone } from 'lucide-react'
import toast from 'react-hot-toast'
import { dayBookAPI } from '../../api'
import { formatCurrency } from '../../utils/formatters'
import LoadingSpinner from '../../components/common/LoadingSpinner'

const today = () => new Date().toISOString().split('T')[0]
const EMPTY_SPLIT = { slip_no: '', cash: '', card: '', online: '' }
const EMPTY_EDIT  = { slip_no: '', amount: '', payment_mode: 'cash' }

export default function BridalDispatch() {
  const [date, setDate] = useState(today())
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [splitForm, setSplitForm] = useState(EMPTY_SPLIT)
  const [editForm, setEditForm]   = useState(EMPTY_EDIT)
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)

  const load = async () => {
    setLoading(true)
    try { const { data } = await dayBookAPI.getBridalDispatch(date); setRows(data.data || []) }
    catch { toast.error('Failed to load') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [date])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (editId) {
        if (!editForm.amount) { toast.error('Amount is required'); setSaving(false); return }
        await dayBookAPI.updateBridalDispatch(editId, { slip_no: editForm.slip_no, amount: editForm.amount, payment_mode: editForm.payment_mode, date })
        toast.success('Updated')
      } else {
        const entries = [
          { mode: 'cash',   amount: parseFloat(splitForm.cash)   || 0 },
          { mode: 'card',   amount: parseFloat(splitForm.card)   || 0 },
          { mode: 'online', amount: parseFloat(splitForm.online) || 0 },
        ].filter(e => e.amount > 0)
        if (!entries.length) { toast.error('Enter at least one amount'); setSaving(false); return }
        for (const entry of entries) {
          await dayBookAPI.createBridalDispatch({ slip_no: splitForm.slip_no, amount: entry.amount, payment_mode: entry.mode, date })
        }
        toast.success(`${entries.length} entry/entries added`)
      }
      setSplitForm(EMPTY_SPLIT); setEditForm(EMPTY_EDIT); setEditId(null); setShowForm(false); load()
    } catch { toast.error('Failed to save') }
    finally { setSaving(false) }
  }

  const startEdit = (row) => {
    setEditForm({ slip_no: row.slip_no || '', amount: row.amount, payment_mode: row.payment_mode })
    setEditId(row.id); setShowForm(true)
  }
  const handleDelete = async (id) => {
    if (!window.confirm('Delete this entry?')) return
    try { await dayBookAPI.deleteBridalDispatch(id); toast.success('Deleted'); load() }
    catch { toast.error('Failed to delete') }
  }

  const cashTotal   = rows.filter(r => r.payment_mode === 'cash').reduce((a, r) => a + parseFloat(r.amount || 0), 0)
  const cardTotal   = rows.filter(r => r.payment_mode === 'card').reduce((a, r) => a + parseFloat(r.amount || 0), 0)
  const onlineTotal = rows.filter(r => r.payment_mode === 'online').reduce((a, r) => a + parseFloat(r.amount || 0), 0)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Day Book — Bridal Dispatch</h1>
          <p className="text-sm text-slate-500 mt-0.5">{rows.length} entries</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" />
          <button onClick={() => { setSplitForm(EMPTY_SPLIT); setEditForm(EMPTY_EDIT); setEditId(null); setShowForm(true) }}
            className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
            <Plus className="h-4 w-4" /> Add Entry
          </button>
        </div>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl p-4 shadow-sm border border-amber-200">
          <form onSubmit={handleSubmit}>
            <div className="flex flex-wrap gap-3 items-end mb-3" onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault() }}>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Slip No.</label>
                <input
                  value={editId ? editForm.slip_no : splitForm.slip_no}
                  onChange={(e) => editId ? setEditForm(f => ({...f, slip_no: e.target.value})) : setSplitForm(f => ({...f, slip_no: e.target.value}))}
                  placeholder="Slip number"
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm w-40 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" />
              </div>

              {editId ? (
                <>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Amount (₹)</label>
                    <input type="number" step="0.01" value={editForm.amount} onChange={(e) => setEditForm(f => ({...f, amount: e.target.value}))}
                      placeholder="0.00" required
                      className="border border-slate-200 rounded-lg px-3 py-2 text-sm w-36 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Mode</label>
                    <select value={editForm.payment_mode} onChange={(e) => setEditForm(f => ({...f, payment_mode: e.target.value}))}
                      className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500">
                      <option value="cash">Cash</option>
                      <option value="card">Card</option>
                      <option value="online">Online</option>
                    </select>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="flex items-center gap-1 text-xs font-medium text-green-700 mb-1"><Banknote className="h-3.5 w-3.5" /> Cash (₹)</label>
                    <input type="number" step="0.01" min="0" value={splitForm.cash} onChange={(e) => setSplitForm(f => ({...f, cash: e.target.value}))}
                      placeholder="0.00"
                      className="border-2 border-green-200 focus:border-green-400 rounded-lg px-3 py-2 text-sm w-32 focus:outline-none focus:ring-2 focus:ring-green-300" />
                  </div>
                  <div>
                    <label className="flex items-center gap-1 text-xs font-medium text-blue-700 mb-1"><CreditCard className="h-3.5 w-3.5" /> Card (₹)</label>
                    <input type="number" step="0.01" min="0" value={splitForm.card} onChange={(e) => setSplitForm(f => ({...f, card: e.target.value}))}
                      placeholder="0.00"
                      className="border-2 border-blue-200 focus:border-blue-400 rounded-lg px-3 py-2 text-sm w-32 focus:outline-none focus:ring-2 focus:ring-blue-300" />
                  </div>
                  <div>
                    <label className="flex items-center gap-1 text-xs font-medium text-violet-700 mb-1"><Smartphone className="h-3.5 w-3.5" /> Online (₹)</label>
                    <input type="number" step="0.01" min="0" value={splitForm.online} onChange={(e) => setSplitForm(f => ({...f, online: e.target.value}))}
                      placeholder="0.00"
                      className="border-2 border-violet-200 focus:border-violet-400 rounded-lg px-3 py-2 text-sm w-32 focus:outline-none focus:ring-2 focus:ring-violet-300" />
                  </div>
                  {(parseFloat(splitForm.cash)||0) + (parseFloat(splitForm.card)||0) + (parseFloat(splitForm.online)||0) > 0 && (
                    <div className="flex flex-col justify-end pb-2">
                      <span className="text-xs text-slate-500">Total</span>
                      <span className="text-sm font-bold text-slate-800">
                        {formatCurrency((parseFloat(splitForm.cash)||0) + (parseFloat(splitForm.card)||0) + (parseFloat(splitForm.online)||0))}
                      </span>
                    </div>
                  )}
                </>
              )}

              <div className="flex flex-col justify-end gap-1 pb-0.5">
                <button type="submit" disabled={saving}
                  className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-semibold">
                  {saving ? 'Saving...' : editId ? 'Update' : 'Save'}
                </button>
                <button type="button" onClick={() => { setShowForm(false); setEditId(null); setSplitForm(EMPTY_SPLIT); setEditForm(EMPTY_EDIT) }}
                  className="border border-slate-200 text-slate-500 hover:bg-slate-50 px-4 py-1.5 rounded-lg text-xs text-center">
                  Cancel
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? <div className="flex items-center justify-center py-16"><LoadingSpinner size="lg" /></div> : (() => {
          const groups = Object.values(rows.reduce((acc, r) => {
            const key = r.slip_no || `__noslip__${r.id}`
            if (!acc[key]) acc[key] = { slip_no: r.slip_no, entries: [] }
            acc[key].entries.push(r)
            return acc
          }, {}))

          const handleDeleteGroup = async (entries) => {
            if (!window.confirm('Delete all entries for this slip?')) return
            for (const e of entries) {
              try { await dayBookAPI.deleteBridalDispatch(e.id) } catch {}
            }
            toast.success('Deleted'); load()
          }

          const startEditGroup = (entries) => {
            const first = entries[0]
            setEditForm({ slip_no: first.slip_no || '', amount: first.amount, payment_mode: first.payment_mode })
            setEditId(first.id); setShowForm(true)
          }

          return (
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead className="bg-slate-800 text-xs text-slate-200 uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">#</th>
                  <th className="px-4 py-3 text-left">Slip No.</th>
                  <th className="px-4 py-3 text-right text-green-300">Cash</th>
                  <th className="px-4 py-3 text-right text-blue-300">Card</th>
                  <th className="px-4 py-3 text-right text-violet-300">Online</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {groups.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-12 text-slate-400">No entries for this date</td></tr>
                ) : groups.map((g, i) => {
                  const cash   = g.entries.filter(e => e.payment_mode === 'cash').reduce((s, e) => s + parseFloat(e.amount || 0), 0)
                  const card   = g.entries.filter(e => e.payment_mode === 'card').reduce((s, e) => s + parseFloat(e.amount || 0), 0)
                  const online = g.entries.filter(e => e.payment_mode === 'online').reduce((s, e) => s + parseFloat(e.amount || 0), 0)
                  const total  = cash + card + online
                  return (
                    <tr key={g.slip_no || i} className="border-b hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-500">{i + 1}</td>
                      <td className="px-4 py-3 font-semibold text-amber-600">{g.slip_no || '-'}</td>
                      <td className="px-4 py-3 text-right text-green-700 font-medium">{cash > 0 ? formatCurrency(cash) : <span className="text-slate-300">—</span>}</td>
                      <td className="px-4 py-3 text-right text-blue-700 font-medium">{card > 0 ? formatCurrency(card) : <span className="text-slate-300">—</span>}</td>
                      <td className="px-4 py-3 text-right text-violet-700 font-medium">{online > 0 ? formatCurrency(online) : <span className="text-slate-300">—</span>}</td>
                      <td className="px-4 py-3 text-right font-bold text-slate-800">{formatCurrency(total)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1.5">
                          <button onClick={() => startEditGroup(g.entries)} className="p-1.5 rounded hover:bg-amber-50 text-slate-400 hover:text-amber-600" title="Edit"><Edit2 className="h-4 w-4" /></button>
                          <button onClick={() => handleDeleteGroup(g.entries)} className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-600" title="Delete"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              {groups.length > 0 && (
                <tfoot className="bg-slate-50 text-sm font-semibold border-t-2 border-slate-200">
                  <tr>
                    <td colSpan={2} className="px-4 py-3 text-slate-600">Total ({groups.length} slips)</td>
                    <td className="px-4 py-3 text-right text-green-700">{cashTotal > 0 ? formatCurrency(cashTotal) : '—'}</td>
                    <td className="px-4 py-3 text-right text-blue-700">{cardTotal > 0 ? formatCurrency(cardTotal) : '—'}</td>
                    <td className="px-4 py-3 text-right text-violet-700">{onlineTotal > 0 ? formatCurrency(onlineTotal) : '—'}</td>
                    <td className="px-4 py-3 text-right text-slate-800">{formatCurrency(cashTotal + cardTotal + onlineTotal)}</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table></div>
          )
        })()}
      </div>
    </div>
  )
}
