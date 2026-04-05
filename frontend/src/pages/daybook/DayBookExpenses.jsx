import { useEffect, useState } from 'react'
import { Edit2, Trash2, X, ShoppingCart, UserCheck, TrendingUp, Gift, RotateCcw } from 'lucide-react'
import toast from 'react-hot-toast'
import { dayBookAPI } from '../../api'
import { formatCurrency } from '../../utils/formatters'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import useAuthStore from '../../store/authStore'

const today = () => new Date().toISOString().split('T')[0]
const ROUTINE_CATEGORIES = ['Milk', 'Polythin', 'Stationery', 'Phynol', 'Pocha', 'Spray Paint', 'Nail Paint Remover', 'Others']

const CARDS = [
  { type: 'routine',        label: 'Routine Expenses', color: 'amber',  icon: ShoppingCart },
  { type: 'salary',         label: 'Salary',           color: 'blue',   icon: UserCheck   },
  { type: 'advance_salary', label: 'Advance Salary',   color: 'indigo', icon: TrendingUp  },
  { type: 'incentive',      label: 'Incentives',       color: 'green',  icon: Gift        },
  { type: 'refund',         label: 'Security Refund',  color: 'red',    icon: RotateCcw   },
]

const COLOR = {
  amber:  { card: 'border-amber-200 bg-amber-50',  icon: 'bg-amber-100 text-amber-600',  btn: 'bg-amber-600 hover:bg-amber-700',  ring: 'focus:ring-amber-500/30 focus:border-amber-500',  head: 'bg-amber-50 border-amber-100', title: 'text-amber-800' },
  blue:   { card: 'border-blue-200 bg-blue-50',    icon: 'bg-blue-100 text-blue-600',    btn: 'bg-blue-600 hover:bg-blue-700',    ring: 'focus:ring-blue-500/30 focus:border-blue-500',    head: 'bg-blue-50 border-blue-100',   title: 'text-blue-800'  },
  indigo: { card: 'border-indigo-200 bg-indigo-50',icon: 'bg-indigo-100 text-indigo-600',btn: 'bg-indigo-600 hover:bg-indigo-700',ring: 'focus:ring-indigo-500/30 focus:border-indigo-500',head: 'bg-indigo-50 border-indigo-100',title: 'text-indigo-800'},
  green:  { card: 'border-green-200 bg-green-50',  icon: 'bg-green-100 text-green-600',  btn: 'bg-green-600 hover:bg-green-700',  ring: 'focus:ring-green-500/30 focus:border-green-500',  head: 'bg-green-50 border-green-100', title: 'text-green-800' },
  red:    { card: 'border-red-200 bg-red-50',       icon: 'bg-red-100 text-red-600',      btn: 'bg-red-600 hover:bg-red-700',      ring: 'focus:ring-red-500/30 focus:border-red-400',      head: 'bg-red-50 border-red-100',     title: 'text-red-800'   },
}

function Modal({ title, color, onClose, children }) {
  const c = COLOR[color]
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className={`flex items-center justify-between px-5 py-4 rounded-t-2xl border-b ${c.head}`}>
          <h2 className={`font-bold text-base ${c.title}`}>{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  )
}

export default function DayBookExpenses() {
  const { user } = useAuthStore()
  const canViewHistory = ['admin', 'super_admin'].includes(user?.role_name)
  const [date, setDate] = useState(today())
  const [expenses, setExpenses] = useState([])
  const [refunds, setRefunds] = useState([])
  const [loading, setLoading] = useState(true)

  // modal state
  const [activeCard, setActiveCard] = useState(null) // type string
  const [form, setForm] = useState({})
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [expRes, refRes] = await Promise.all([
        dayBookAPI.getExpenses(date),
        dayBookAPI.getSecurityRefunds(date),
      ])
      setExpenses(expRes.data.data || [])
      setRefunds(refRes.data.data || [])
    } catch { toast.error('Failed to load') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [date])

  const emptyForm = (type) => {
    if (type === 'routine') return { expense_type: 'routine', category: 'Milk', description: '', amount: '', payment_mode: 'cash' }
    if (type === 'refund')  return { slip_no: '', amount: '', payment_mode: 'cash' }
    if (['salary', 'advance_salary'].includes(type)) return { expense_type: type, category: '', description: '', amount: '', payment_mode: 'cash', paid_by: '' }
    return { expense_type: type, category: '', description: '', amount: '', payment_mode: 'cash' }
  }

  const openModal = (type) => { setForm(emptyForm(type)); setEditId(null); setActiveCard(type) }
  const closeModal = () => { setActiveCard(null); setEditId(null); setForm({}) }

  const startEdit = (type, row) => {
    if (type === 'refund') {
      setForm({ slip_no: row.slip_no || '', amount: row.amount, payment_mode: row.payment_mode })
    } else if (['salary', 'advance_salary'].includes(type)) {
      setForm({ expense_type: row.expense_type, category: row.category || '', description: row.description || '', amount: row.amount, payment_mode: row.payment_mode, paid_by: row.paid_by || '' })
    } else {
      setForm({ expense_type: row.expense_type, category: row.category || '', description: row.description || '', amount: row.amount, payment_mode: row.payment_mode })
    }
    setEditId(row.id); setActiveCard(type)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.amount) return toast.error('Amount is required')
    setSaving(true)
    try {
      if (activeCard === 'refund') {
        if (editId) await dayBookAPI.updateSecurityRefund(editId, { ...form, date })
        else await dayBookAPI.createSecurityRefund({ ...form, date })
      } else {
        if (editId) await dayBookAPI.updateExpense(editId, { ...form, date })
        else await dayBookAPI.createExpense({ ...form, date })
      }
      toast.success(editId ? 'Updated' : 'Added')
      closeModal(); load()
    } catch { toast.error('Failed to save') }
    finally { setSaving(false) }
  }

  const handleDelete = async (type, id) => {
    if (!window.confirm('Delete this entry?')) return
    try {
      if (type === 'refund') await dayBookAPI.deleteSecurityRefund(id)
      else await dayBookAPI.deleteExpense(id)
      toast.success('Deleted'); load()
    } catch { toast.error('Failed to delete') }
  }

  const byType = (type) => type === 'refund' ? refunds : expenses.filter(e => e.expense_type === type)
  const total = (rows) => rows.reduce((a, r) => a + parseFloat(r.amount || 0), 0)
  const grandTotal = expenses.reduce((a, e) => a + parseFloat(e.amount || 0), 0) + refunds.reduce((a, r) => a + parseFloat(r.amount || 0), 0)

  const activeCardDef = CARDS.find(c => c.type === activeCard)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Day Book — Expenses</h1>
          <p className="text-sm text-slate-500 mt-0.5">Total: {formatCurrency(grandTotal)}</p>
        </div>
        <input type="date" value={date} onChange={(e) => canViewHistory && setDate(e.target.value)}
          disabled={!canViewHistory}
          title={!canViewHistory ? 'Only admin Swechha can view previous dates' : ''}
          className={`border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 ${!canViewHistory ? 'border-slate-100 bg-slate-50 text-slate-400 cursor-not-allowed' : 'border-slate-200'}`} />
      </div>

      {/* Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {CARDS.map(({ type, label, color, icon: Icon }) => {
          const rows = byType(type)
          const c = COLOR[color]
          return (
            <button key={type} onClick={() => openModal(type)}
              className={`border-2 rounded-xl p-4 text-left cursor-pointer hover:shadow-md transition-all ${c.card}`}>
              <div className={`inline-flex p-2 rounded-lg mb-3 ${c.icon}`}>
                <Icon className="h-5 w-5" />
              </div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
              <p className="text-lg font-bold text-slate-800 mt-0.5">{formatCurrency(total(rows))}</p>
              <p className="text-xs text-slate-400 mt-0.5">{rows.length} {rows.length === 1 ? 'entry' : 'entries'}</p>
            </button>
          )
        })}
      </div>

      {/* Modal */}
      {activeCard && activeCardDef && (
        <Modal title={`Add ${activeCardDef.label}`} color={activeCardDef.color} onClose={closeModal}>
          <form onSubmit={handleSubmit} className="space-y-3">
            {activeCard === 'routine' && (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Category</label>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className={`w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ${COLOR[activeCardDef.color].ring}`}>
                  {ROUTINE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            )}
            {activeCard === 'refund' && (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Slip No.</label>
                <input value={form.slip_no || ''} onChange={(e) => setForm({ ...form, slip_no: e.target.value })}
                  placeholder="Slip number"
                  className={`w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ${COLOR[activeCardDef.color].ring}`} />
              </div>
            )}
            {!['routine', 'refund'].includes(activeCard) && (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Employee / Description</label>
                <input value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Employee name"
                  className={`w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ${COLOR[activeCardDef.color].ring}`} />
              </div>
            )}
            {['salary', 'advance_salary'].includes(activeCard) && (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Who Paid This</label>
                <input value={form.paid_by || ''} onChange={(e) => setForm({ ...form, paid_by: e.target.value })}
                  placeholder="Name of person who paid"
                  className={`w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ${COLOR[activeCardDef.color].ring}`} />
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Amount (₹) *</label>
              <input type="number" step="0.01" value={form.amount || ''} onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="0.00" required
                className={`w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ${COLOR[activeCardDef.color].ring}`} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Payment Mode</label>
              <select value={form.payment_mode || 'cash'} onChange={(e) => setForm({ ...form, payment_mode: e.target.value })}
                className={`w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ${COLOR[activeCardDef.color].ring}`}>
                <option value="cash">Cash</option>
                <option value="online">Online</option>
              </select>
            </div>
            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={saving}
                className={`flex-1 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50 ${COLOR[activeCardDef.color].btn}`}>
                {saving ? 'Saving...' : editId ? 'Update' : 'Add Entry'}
              </button>
              <button type="button" onClick={closeModal}
                className="border border-slate-200 text-slate-600 hover:bg-slate-50 px-4 py-2 rounded-lg text-sm">
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Tables */}
      {loading ? <div className="flex items-center justify-center py-16"><LoadingSpinner size="lg" /></div> : (
        <div className="space-y-4">
          {CARDS.map(({ type, label, color }) => {
            const rows = byType(type)
            const c = COLOR[color]
            const cashTotal = rows.filter(r => r.payment_mode === 'cash').reduce((a, r) => a + parseFloat(r.amount || 0), 0)
            const onlineTotal = rows.filter(r => r.payment_mode === 'online').reduce((a, r) => a + parseFloat(r.amount || 0), 0)
            return (
              <div key={type} className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <div className={`px-4 py-3 border-b ${c.head}`}>
                  <h3 className={`font-semibold ${c.title}`}>{label}</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs text-slate-500 uppercase">
                      <tr>
                        <th className="px-4 py-2 text-left">S.No.</th>
                        {type === 'routine' && <th className="px-4 py-2 text-left">Category</th>}
                        {type === 'refund'  && <th className="px-4 py-2 text-left">Slip No.</th>}
                        {!['routine','refund'].includes(type) && <th className="px-4 py-2 text-left">Employee / Description</th>}
                        {['salary','advance_salary'].includes(type) && <th className="px-4 py-2 text-left">Who Paid</th>}
                        <th className="px-4 py-2 text-right">Amount</th>
                        <th className="px-4 py-2 text-center">Mode</th>
                        <th className="px-4 py-2 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.length === 0 ? (
                        <tr><td colSpan={5} className="text-center py-5 text-slate-400 text-xs">No entries</td></tr>
                      ) : rows.map((r, i) => (
                        <tr key={r.id} className="border-b hover:bg-slate-50">
                          <td className="px-4 py-2 text-slate-500">{i + 1}</td>
                          {type === 'routine' && <td className="px-4 py-2 text-slate-700">{r.category || '-'}</td>}
                          {type === 'refund'  && <td className="px-4 py-2 text-amber-600 font-medium">{r.slip_no || '-'}</td>}
                          {!['routine','refund'].includes(type) && <td className="px-4 py-2 text-slate-700">{r.description || '-'}</td>}
                          {['salary','advance_salary'].includes(type) && <td className="px-4 py-2 text-slate-600">{r.paid_by || '-'}</td>}
                          <td className="px-4 py-2 text-right font-semibold text-slate-800">{formatCurrency(r.amount)}</td>
                          <td className="px-4 py-2 text-center">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.payment_mode === 'cash' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                              {r.payment_mode === 'cash' ? 'Cash' : 'Online'}
                            </span>
                          </td>
                          <td className="px-4 py-2">
                            <div className="flex items-center justify-center gap-1.5">
                              <button onClick={() => startEdit(type, r)} className="p-1 rounded hover:bg-amber-50 text-slate-400 hover:text-amber-600"><Edit2 className="h-3.5 w-3.5" /></button>
                              <button onClick={() => handleDelete(type, r.id)} className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {rows.length > 0 && (
                      <tfoot className="bg-slate-50 text-xs font-semibold">
                        <tr>
                          <td colSpan={2} className="px-4 py-2 text-slate-600">Total</td>
                          <td className="px-4 py-2 text-right text-slate-800">{formatCurrency(cashTotal + onlineTotal)}</td>
                          <td colSpan={2} className="px-4 py-2 text-slate-500 font-normal">Cash: {formatCurrency(cashTotal)} · Online: {formatCurrency(onlineTotal)}</td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
