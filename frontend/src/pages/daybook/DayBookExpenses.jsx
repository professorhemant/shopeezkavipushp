import { useEffect, useState } from 'react'
import { Plus, Edit2, Trash2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { dayBookAPI } from '../../api'
import { formatCurrency } from '../../utils/formatters'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import useAuthStore from '../../store/authStore'

const today = () => new Date().toISOString().split('T')[0]
const ROUTINE_CATEGORIES = ['Milk', 'Polythin', 'Stationery', 'Phynol', 'Pocha', 'Spray Paint', 'Nail Paint Remover', 'Others']
const EMPTY = { expense_type: 'routine', category: 'Milk', description: '', amount: '', payment_mode: 'cash' }
const EMPTY_REFUND = { slip_no: '', amount: '', payment_mode: 'cash' }

function ExpenseSection({ title, type, rows, onAdd, onEdit, onDelete }) {
  const cashTotal = rows.filter(r => r.payment_mode === 'cash').reduce((a, r) => a + parseFloat(r.amount || 0), 0)
  const onlineTotal = rows.filter(r => r.payment_mode === 'online').reduce((a, r) => a + parseFloat(r.amount || 0), 0)
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-100">
        <h3 className="font-semibold text-slate-800">{title}</h3>
        <button onClick={() => onAdd(type)}
          className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Add
        </button>
      </div>
      <div className="overflow-x-auto"><table className="w-full text-sm">
        <thead className="text-xs text-slate-500 uppercase">
          <tr>
            <th className="px-4 py-2 text-left">S.No.</th>
            {type === 'routine' ? <th className="px-4 py-2 text-left">Category</th> : <th className="px-4 py-2 text-left">Employee / Description</th>}
            <th className="px-4 py-2 text-right">Amount</th>
            <th className="px-4 py-2 text-center">Mode</th>
            <th className="px-4 py-2 text-center">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={5} className="text-center py-6 text-slate-400 text-xs">No entries</td></tr>
          ) : rows.map((r, i) => (
            <tr key={r.id} className="border-b hover:bg-slate-50">
              <td className="px-4 py-2 text-slate-500">{i + 1}</td>
              <td className="px-4 py-2 text-slate-700">{type === 'routine' ? (r.category || '-') : (r.description || '-')}</td>
              <td className="px-4 py-2 text-right font-semibold text-slate-800">{formatCurrency(r.amount)}</td>
              <td className="px-4 py-2 text-center">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.payment_mode === 'cash' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                  {r.payment_mode === 'cash' ? 'Cash' : 'Online'}
                </span>
              </td>
              <td className="px-4 py-2">
                <div className="flex items-center justify-center gap-1.5">
                  <button onClick={() => onEdit(r)} className="p-1 rounded hover:bg-amber-50 text-slate-400 hover:text-amber-600"><Edit2 className="h-3.5 w-3.5" /></button>
                  <button onClick={() => onDelete(r.id)} className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
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
      </table></div>
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
  const [form, setForm] = useState(EMPTY)
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [refundForm, setRefundForm] = useState(EMPTY_REFUND)
  const [refundEditId, setRefundEditId] = useState(null)
  const [refundSaving, setRefundSaving] = useState(false)
  const [showRefundForm, setShowRefundForm] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [expRes, refRes] = await Promise.all([
        dayBookAPI.getExpenses(date),
        dayBookAPI.getSecurityRefunds(date),
      ])
      setExpenses(expRes.data.data || [])
      setRefunds(refRes.data.data || [])
    }
    catch { toast.error('Failed to load') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [date])

  const openAdd = (type) => {
    setForm({ ...EMPTY, expense_type: type, category: type === 'routine' ? 'Milk' : '', description: '' })
    setEditId(null); setShowForm(true)
  }
  const startEdit = (row) => {
    setForm({ expense_type: row.expense_type, category: row.category || '', description: row.description || '', amount: row.amount, payment_mode: row.payment_mode })
    setEditId(row.id); setShowForm(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.amount) return toast.error('Amount is required')
    setSaving(true)
    try {
      if (editId) { await dayBookAPI.updateExpense(editId, { ...form, date }); toast.success('Updated') }
      else { await dayBookAPI.createExpense({ ...form, date }); toast.success('Added') }
      setForm(EMPTY); setEditId(null); setShowForm(false); load()
    } catch { toast.error('Failed to save') }
    finally { setSaving(false) }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this entry?')) return
    try { await dayBookAPI.deleteExpense(id); toast.success('Deleted'); load() }
    catch { toast.error('Failed to delete') }
  }

  // Security Refund handlers
  const startRefundEdit = (row) => {
    setRefundForm({ slip_no: row.slip_no || '', amount: row.amount, payment_mode: row.payment_mode })
    setRefundEditId(row.id); setShowRefundForm(true)
  }
  const handleRefundSubmit = async (e) => {
    e.preventDefault()
    if (!refundForm.amount) return toast.error('Amount is required')
    setRefundSaving(true)
    try {
      if (refundEditId) { await dayBookAPI.updateSecurityRefund(refundEditId, { ...refundForm, date }); toast.success('Updated') }
      else { await dayBookAPI.createSecurityRefund({ ...refundForm, date }); toast.success('Added') }
      setRefundForm(EMPTY_REFUND); setRefundEditId(null); setShowRefundForm(false); load()
    } catch { toast.error('Failed to save') }
    finally { setRefundSaving(false) }
  }
  const handleRefundDelete = async (id) => {
    if (!window.confirm('Delete this entry?')) return
    try { await dayBookAPI.deleteSecurityRefund(id); toast.success('Deleted'); load() }
    catch { toast.error('Failed to delete') }
  }

  const byType = (type) => expenses.filter(e => e.expense_type === type)
  const refundCashTotal   = refunds.filter(r => r.payment_mode === 'cash').reduce((a, r) => a + parseFloat(r.amount || 0), 0)
  const refundOnlineTotal = refunds.filter(r => r.payment_mode === 'online').reduce((a, r) => a + parseFloat(r.amount || 0), 0)
  const grandTotal = expenses.reduce((a, e) => a + parseFloat(e.amount || 0), 0) + refunds.reduce((a, r) => a + parseFloat(r.amount || 0), 0)

  return (
    <div className="space-y-5">
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

      {/* Add/Edit Expense Form */}
      {showForm && (
        <div className="bg-white rounded-xl p-4 shadow-sm border border-amber-200">
          <form onSubmit={handleSubmit} className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Type</label>
              <select value={form.expense_type} onChange={(e) => setForm({ ...form, expense_type: e.target.value, category: e.target.value === 'routine' ? 'Milk' : '', description: '' })}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500">
                <option value="routine">Routine Expense</option>
                <option value="advance_salary">Salary</option>
                <option value="incentive">Incentive</option>
              </select>
            </div>
            {form.expense_type === 'routine' ? (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Category</label>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500">
                  {ROUTINE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Employee / Description</label>
                <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Employee name"
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm w-44 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" />
              </div>
            )}
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

      {/* Add/Edit Security Refund Form */}
      {showRefundForm && (
        <div className="bg-white rounded-xl p-4 shadow-sm border border-red-200">
          <form onSubmit={handleRefundSubmit} className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Slip No.</label>
              <input value={refundForm.slip_no} onChange={(e) => setRefundForm({ ...refundForm, slip_no: e.target.value })}
                placeholder="Slip number"
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm w-40 focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Amount (₹) *</label>
              <input type="number" step="0.01" value={refundForm.amount} onChange={(e) => setRefundForm({ ...refundForm, amount: e.target.value })}
                placeholder="0.00" required
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm w-36 focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Mode</label>
              <select value={refundForm.payment_mode} onChange={(e) => setRefundForm({ ...refundForm, payment_mode: e.target.value })}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400">
                <option value="cash">Cash</option>
                <option value="online">Online</option>
              </select>
            </div>
            <button type="submit" disabled={refundSaving}
              className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium">
              {refundSaving ? 'Saving...' : refundEditId ? 'Update' : 'Add'}
            </button>
            <button type="button" onClick={() => { setShowRefundForm(false); setRefundEditId(null); setRefundForm(EMPTY_REFUND) }}
              className="border border-slate-200 text-slate-600 hover:bg-slate-50 px-3 py-2 rounded-lg text-sm">
              <X className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}

      {loading ? <div className="flex items-center justify-center py-16"><LoadingSpinner size="lg" /></div> : (
        <>
          <ExpenseSection title="Routine Expenses" type="routine" rows={byType('routine')} onAdd={openAdd} onEdit={startEdit} onDelete={handleDelete} />
          <ExpenseSection title="Salary" type="advance_salary" rows={byType('advance_salary')} onAdd={openAdd} onEdit={startEdit} onDelete={handleDelete} />
          <ExpenseSection title="Incentives" type="incentive" rows={byType('incentive')} onAdd={openAdd} onEdit={startEdit} onDelete={handleDelete} />

          {/* Security Refund section */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-red-50 border-b border-red-100">
              <h3 className="font-semibold text-red-800">Security Refunds</h3>
              <button onClick={() => { setRefundForm(EMPTY_REFUND); setRefundEditId(null); setShowRefundForm(true) }}
                className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Add
              </button>
            </div>
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead className="text-xs text-slate-500 uppercase">
                <tr>
                  <th className="px-4 py-2 text-left">S.No.</th>
                  <th className="px-4 py-2 text-left">Slip No.</th>
                  <th className="px-4 py-2 text-right">Amount</th>
                  <th className="px-4 py-2 text-center">Mode</th>
                  <th className="px-4 py-2 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {refunds.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-6 text-slate-400 text-xs">No entries</td></tr>
                ) : refunds.map((r, i) => (
                  <tr key={r.id} className="border-b hover:bg-slate-50">
                    <td className="px-4 py-2 text-slate-500">{i + 1}</td>
                    <td className="px-4 py-2 text-amber-600 font-medium">{r.slip_no || '-'}</td>
                    <td className="px-4 py-2 text-right font-semibold text-slate-800">{formatCurrency(r.amount)}</td>
                    <td className="px-4 py-2 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.payment_mode === 'cash' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                        {r.payment_mode === 'cash' ? 'Cash' : 'Online'}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center justify-center gap-1.5">
                        <button onClick={() => startRefundEdit(r)} className="p-1 rounded hover:bg-amber-50 text-slate-400 hover:text-amber-600"><Edit2 className="h-3.5 w-3.5" /></button>
                        <button onClick={() => handleRefundDelete(r.id)} className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              {refunds.length > 0 && (
                <tfoot className="bg-slate-50 text-xs font-semibold">
                  <tr>
                    <td colSpan={2} className="px-4 py-2 text-slate-600">Total</td>
                    <td className="px-4 py-2 text-right text-slate-800">{formatCurrency(refundCashTotal + refundOnlineTotal)}</td>
                    <td colSpan={2} className="px-4 py-2 text-slate-500 font-normal">Cash: {formatCurrency(refundCashTotal)} · Online: {formatCurrency(refundOnlineTotal)}</td>
                  </tr>
                </tfoot>
              )}
            </table></div>
          </div>
        </>
      )}
    </div>
  )
}
