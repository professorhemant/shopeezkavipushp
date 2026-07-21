import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, X, Users, ChevronRight, Wallet } from 'lucide-react'
import toast from 'react-hot-toast'
import { employeeAPI } from '../../api'
import { formatCurrency } from '../../utils/formatters'
import LoadingSpinner from '../../components/common/LoadingSpinner'

const APPOINTMENT_TYPES = [
  { value: 'permanent', label: 'Permanent' },
  { value: 'contract', label: 'Contract' },
  { value: 'part_time', label: 'Part-time' },
  { value: 'probation', label: 'Probation' },
  { value: 'intern', label: 'Intern' },
]
const typeLabel = (v) => APPOINTMENT_TYPES.find(t => t.value === v)?.label || v

const currentMonth = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
const monthLabel = (ym) => new Date(`${ym}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })

const STATUS = {
  paid:    { label: 'Paid',    cls: 'bg-green-100 text-green-700' },
  partial: { label: 'Partial', cls: 'bg-amber-100 text-amber-700' },
  unpaid:  { label: 'Unpaid',  cls: 'bg-red-100 text-red-700' },
}

const emptyEmployee = {
  name: '', phone: '', designation: '', employment_type: 'permanent',
  work_timings: '', weekly_off: '', monthly_salary: '', date_of_joining: '',
  address: '', emergency_contact: '', deduct_leaves: false, is_active: true, notes: '',
}

export default function Employees() {
  const navigate = useNavigate()
  const [month, setMonth] = useState(currentMonth())
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyEmployee)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await employeeAPI.getAll({ month: `${month}-01` })
      setEmployees(res.data.data || [])
    } catch { toast.error('Failed to load employees') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [month])

  const openAdd = () => { setForm(emptyEmployee); setShowForm(true) }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return toast.error('Employee name is required')
    setSaving(true)
    try {
      await employeeAPI.create({
        ...form,
        monthly_salary: form.monthly_salary || 0,
        date_of_joining: form.date_of_joining || null,
      })
      toast.success('Employee added')
      setShowForm(false); load()
    } catch { toast.error('Failed to save') }
    finally { setSaving(false) }
  }

  const activeCount = employees.filter(e => e.is_active).length
  const monthlyWage = employees.filter(e => e.is_active).reduce((a, e) => a + parseFloat(e.monthly_salary || 0), 0)
  const paidThisMonth = employees.reduce((a, e) => a + (e.summary?.total_paid || 0), 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Salary — Employees</h1>
          <p className="text-sm text-slate-500 mt-0.5">Payroll status for {monthLabel(month)}</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" />
          <button onClick={openAdd}
            className="inline-flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
            <Plus className="h-4 w-4" /> Add Employee
          </button>
        </div>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
          <div className="inline-flex p-2 rounded-lg bg-blue-100 text-blue-600 mb-2"><Users className="h-5 w-5" /></div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Active Employees</p>
          <p className="text-lg font-bold text-slate-800 mt-0.5">{activeCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
          <div className="inline-flex p-2 rounded-lg bg-indigo-100 text-indigo-600 mb-2"><Wallet className="h-5 w-5" /></div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Monthly Wage Bill</p>
          <p className="text-lg font-bold text-slate-800 mt-0.5">{formatCurrency(monthlyWage)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
          <div className="inline-flex p-2 rounded-lg bg-green-100 text-green-600 mb-2"><Wallet className="h-5 w-5" /></div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Paid This Month</p>
          <p className="text-lg font-bold text-slate-800 mt-0.5">{formatCurrency(paidThisMonth)}</p>
        </div>
      </div>

      {/* Employee table */}
      {loading ? <div className="flex items-center justify-center py-16"><LoadingSpinner size="lg" /></div> : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">Appointment</th>
                  <th className="px-4 py-3 text-left">Timings</th>
                  <th className="px-4 py-3 text-left">Weekly Off</th>
                  <th className="px-4 py-3 text-right">Monthly Salary</th>
                  <th className="px-4 py-3 text-right">Balance</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {employees.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-10 text-slate-400">No employees yet. Click "Add Employee" to start.</td></tr>
                ) : employees.map((e) => (
                  <tr key={e.id} onClick={() => navigate(`/salary/${e.id}`)}
                    className={`border-b hover:bg-amber-50/40 cursor-pointer ${!e.is_active ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{e.name}</div>
                      <div className="text-xs text-slate-500">{e.designation || '—'}{e.phone ? ` · ${e.phone}` : ''}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{typeLabel(e.employment_type)}</td>
                    <td className="px-4 py-3 text-slate-600">{e.work_timings || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{e.weekly_off || '—'}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800">{formatCurrency(e.monthly_salary)}</td>
                    <td className="px-4 py-3 text-right font-medium text-slate-700">{formatCurrency(e.summary?.balance || 0)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS[e.summary?.status]?.cls || 'bg-slate-100 text-slate-600'}`}>
                        {STATUS[e.summary?.status]?.label || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-300"><ChevronRight className="h-4 w-4 inline" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add employee modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8 overflow-y-auto" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 rounded-t-2xl border-b bg-amber-50 border-amber-100">
              <h2 className="font-bold text-base text-amber-800">Add Employee</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="px-5 py-4 grid grid-cols-2 gap-3">
              <Field label="Full Name *" className="col-span-2">
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus className={inp} placeholder="Employee name" />
              </Field>
              <Field label="Phone">
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inp} placeholder="Mobile number" />
              </Field>
              <Field label="Designation">
                <input value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} className={inp} placeholder="e.g. Beautician" />
              </Field>
              <Field label="Type of Appointment">
                <select value={form.employment_type} onChange={(e) => setForm({ ...form, employment_type: e.target.value })} className={inp}>
                  {APPOINTMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </Field>
              <Field label="Monthly Salary (₹)">
                <input type="number" step="0.01" value={form.monthly_salary} onChange={(e) => setForm({ ...form, monthly_salary: e.target.value })} className={inp} placeholder="0.00" />
              </Field>
              <Field label="Work Timings">
                <input value={form.work_timings} onChange={(e) => setForm({ ...form, work_timings: e.target.value })} className={inp} placeholder="e.g. 10 AM – 7 PM" />
              </Field>
              <Field label="Weekly Off">
                <input value={form.weekly_off} onChange={(e) => setForm({ ...form, weekly_off: e.target.value })} className={inp} placeholder="e.g. Sunday" />
              </Field>
              <Field label="Date of Joining">
                <input type="date" value={form.date_of_joining} onChange={(e) => setForm({ ...form, date_of_joining: e.target.value })} className={inp} />
              </Field>
              <Field label="Emergency Contact">
                <input value={form.emergency_contact} onChange={(e) => setForm({ ...form, emergency_contact: e.target.value })} className={inp} placeholder="Contact number" />
              </Field>
              <Field label="Address" className="col-span-2">
                <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className={inp} placeholder="Address" />
              </Field>
              <label className="col-span-2 flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" checked={form.deduct_leaves} onChange={(e) => setForm({ ...form, deduct_leaves: e.target.checked })} className="rounded" />
                Auto-deduct salary for leave days (per-day = salary ÷ 30)
              </label>
              <div className="col-span-2 flex gap-2 pt-1">
                <button type="submit" disabled={saving} className="flex-1 bg-amber-600 hover:bg-amber-700 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                  {saving ? 'Saving...' : 'Add Employee'}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="border border-slate-200 text-slate-600 hover:bg-slate-50 px-4 py-2 rounded-lg text-sm">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

const inp = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500'
function Field({ label, className = '', children }) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-slate-700 mb-1">{label}</label>
      {children}
    </div>
  )
}
