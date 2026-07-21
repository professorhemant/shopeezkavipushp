import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, X, Trash2, Pencil, Phone, Clock, CalendarOff, Briefcase, FileText, Printer, FileDown } from 'lucide-react'
import { useReactToPrint } from 'react-to-print'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import toast from 'react-hot-toast'
import { employeeAPI } from '../../api'
import useAuthStore from '../../store/authStore'
import { formatCurrency, formatDate } from '../../utils/formatters'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import AppointmentLetter from './AppointmentLetter'

const APPOINTMENT_TYPES = [
  { value: 'permanent', label: 'Permanent' },
  { value: 'contract', label: 'Contract' },
  { value: 'part_time', label: 'Part-time' },
  { value: 'probation', label: 'Probation' },
  { value: 'intern', label: 'Intern' },
  { value: 'purely_temporary', label: 'Purely Temporary' },
  { value: 'daily_wages', label: 'On Daily Wages' },
]
const typeLabel = (v) => APPOINTMENT_TYPES.find(t => t.value === v)?.label || v

const ENTRY_TYPES = [
  { value: 'salary',    label: 'Salary Payment', cls: 'bg-blue-100 text-blue-700' },
  { value: 'advance',   label: 'Advance',        cls: 'bg-indigo-100 text-indigo-700' },
  { value: 'incentive', label: 'Incentive',      cls: 'bg-green-100 text-green-700' },
  { value: 'deduction', label: 'Deduction',      cls: 'bg-red-100 text-red-700' },
]
const entryMeta = (v) => ENTRY_TYPES.find(t => t.value === v) || { label: v, cls: 'bg-slate-100 text-slate-600' }

const currentMonth = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
const monthLabel = (ym) => new Date(`${ym}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
const today = () => new Date().toISOString().split('T')[0]

const STATUS = {
  paid:    { label: 'Paid',    cls: 'bg-green-100 text-green-700' },
  partial: { label: 'Partially Paid', cls: 'bg-amber-100 text-amber-700' },
  unpaid:  { label: 'Unpaid',  cls: 'bg-red-100 text-red-700' },
}

export default function EmployeeDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { firm } = useAuthStore()
  const [month, setMonth] = useState(currentMonth())
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const [showLetter, setShowLetter] = useState(false)
  const letterRef = useRef(null)

  const [showPay, setShowPay] = useState(false)
  const [payForm, setPayForm] = useState(null)
  const [saving, setSaving] = useState(false)

  const [showEdit, setShowEdit] = useState(false)
  const [editForm, setEditForm] = useState(null)

  const [leaveInput, setLeaveInput] = useState('')
  const [daysWorkedInput, setDaysWorkedInput] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const res = await employeeAPI.get(id, `${month}-01`)
      setData(res.data.data)
      setLeaveInput(String(res.data.data.leave?.leave_days ?? 0))
      setDaysWorkedInput(String(res.data.data.leave?.days_worked ?? 0))
    } catch { toast.error('Failed to load employee') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [id, month])

  const openPay = (type) => {
    setPayForm({ entry_type: type, amount: '', for_month: `${month}-01`, payment_date: today(), payment_mode: 'cash', paid_by: '', notes: '' })
    setShowPay(true)
  }

  const submitPay = async (e) => {
    e.preventDefault()
    if (!payForm.amount) return toast.error('Amount is required')
    setSaving(true)
    try {
      await employeeAPI.addEntry(id, payForm)
      toast.success('Entry added'); setShowPay(false); load()
    } catch { toast.error('Failed to save') }
    finally { setSaving(false) }
  }

  const deleteEntry = async (entryId) => {
    if (!window.confirm('Delete this entry?')) return
    try { await employeeAPI.deleteEntry(entryId); toast.success('Deleted'); load() }
    catch { toast.error('Failed to delete') }
  }

  const saveLeave = async () => {
    try {
      await employeeAPI.setLeave(id, { month: `${month}-01`, leave_days: leaveInput || 0 })
      toast.success('Leave updated'); load()
    } catch { toast.error('Failed to update leave') }
  }

  const saveDaysWorked = async () => {
    try {
      await employeeAPI.setLeave(id, { month: `${month}-01`, days_worked: daysWorkedInput || 0 })
      toast.success('Days worked updated'); load()
    } catch { toast.error('Failed to update days worked') }
  }

  const openEdit = () => { setEditForm({ ...data.employee, date_of_joining: data.employee.date_of_joining || '' }); setShowEdit(true) }

  const submitEdit = async (e) => {
    e.preventDefault()
    if (!editForm.name.trim()) return toast.error('Name is required')
    setSaving(true)
    try {
      await employeeAPI.update(id, { ...editForm, monthly_salary: editForm.monthly_salary || 0, date_of_joining: editForm.date_of_joining || null })
      toast.success('Employee updated'); setShowEdit(false); load()
    } catch { toast.error('Failed to save') }
    finally { setSaving(false) }
  }

  const removeEmployee = async () => {
    if (!window.confirm('Delete this employee and all their payroll records? This cannot be undone.')) return
    try { await employeeAPI.remove(id); toast.success('Employee deleted'); navigate('/salary') }
    catch { toast.error('Failed to delete') }
  }

  const printLetter = useReactToPrint({ content: () => letterRef.current, documentTitle: `Appointment Letter - ${data?.employee?.name || ''}` })

  const downloadLetter = async () => {
    if (!letterRef.current) return
    try {
      const canvas = await html2canvas(letterRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff' })
      const img = canvas.toDataURL('image/png')
      const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' })
      const pageW = pdf.internal.pageSize.getWidth()
      const pageH = pdf.internal.pageSize.getHeight()
      const imgH = (canvas.height * pageW) / canvas.width
      pdf.addImage(img, 'PNG', 0, 0, pageW, Math.min(imgH, pageH))
      pdf.save(`Appointment-Letter-${(data?.employee?.name || 'employee').replace(/\s+/g, '-')}.pdf`)
    } catch { toast.error('Could not create PDF') }
  }

  if (loading || !data) return <div className="flex items-center justify-center py-20"><LoadingSpinner size="lg" /></div>

  const { employee, summary, entries } = data
  const monthEntries = entries.filter(e => e.for_month === `${month}-01`)

  return (
    <div className="space-y-6">
      {/* Back + actions */}
      <div className="flex items-center justify-between gap-2">
        <button onClick={() => navigate('/salary')} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
          <ArrowLeft className="h-4 w-4" /> All Employees
        </button>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowLetter(true)} className="inline-flex items-center gap-1.5 border border-amber-200 text-amber-700 hover:bg-amber-50 px-3 py-1.5 rounded-lg text-sm"><FileText className="h-3.5 w-3.5" /> Appointment Letter</button>
          <button onClick={openEdit} className="inline-flex items-center gap-1.5 border border-slate-200 text-slate-600 hover:bg-slate-50 px-3 py-1.5 rounded-lg text-sm"><Pencil className="h-3.5 w-3.5" /> Edit</button>
          <button onClick={removeEmployee} className="inline-flex items-center gap-1.5 border border-red-200 text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg text-sm"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
        </div>
      </div>

      {/* Profile header */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{employee.name}</h1>
              {!employee.is_active && <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 text-slate-600">Inactive</span>}
            </div>
            <p className="text-sm text-slate-500 mt-0.5">{employee.designation || 'No designation'}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400 uppercase tracking-wide">{employee.pay_basis === 'daily' ? 'Daily Wage' : 'Monthly Salary'}</p>
            <p className="text-xl font-bold text-slate-800">{formatCurrency(employee.monthly_salary)}{employee.pay_basis === 'daily' && <span className="text-sm font-medium text-slate-400">/day</span>}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-sm">
          <Meta icon={Briefcase} label="Appointment" value={typeLabel(employee.employment_type)} />
          <Meta icon={Clock} label="Timings" value={employee.work_timings || '—'} />
          <Meta icon={CalendarOff} label="Weekly Off" value={employee.weekly_off || '—'} />
          <Meta icon={Phone} label="Phone" value={employee.phone || '—'} />
        </div>
        {(employee.date_of_joining || employee.emergency_contact || employee.address) && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3 text-sm text-slate-500">
            {employee.date_of_joining && <div>Joined: <span className="text-slate-700">{formatDate(employee.date_of_joining)}</span></div>}
            {employee.emergency_contact && <div>Emergency: <span className="text-slate-700">{employee.emergency_contact}</span></div>}
            {employee.address && <div className="truncate">Address: <span className="text-slate-700">{employee.address}</span></div>}
          </div>
        )}
      </div>

      {/* Month selector + status */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" />
          <span className="text-sm text-slate-500">Payroll for {monthLabel(month)}</span>
        </div>
        <span className={`text-sm px-3 py-1 rounded-full font-semibold ${STATUS[summary.status]?.cls}`}>{STATUS[summary.status]?.label}</span>
      </div>

      {/* Salary breakdown */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Base Salary" value={summary.base_salary}
          hint={summary.pay_basis === 'daily' ? `${summary.days_worked || 0}d × ${formatCurrency(summary.daily_rate || 0)}/day` : null} />
        <Stat label="Incentives" value={summary.incentives} tone="green" hint="not included in Net Payable" />
        <Stat label="− Deductions" value={summary.manual_deductions + summary.leave_deduction} tone="red"
          hint={summary.leave_deduction ? `incl. ${formatCurrency(summary.leave_deduction)} leave (${summary.leave_days}d)` : null} />
        <Stat label="Net Payable" value={summary.net_payable} tone="bold" />
        <Stat label="Advance Paid" value={summary.advance_paid} />
        <Stat label="Salary Paid" value={summary.salary_paid} />
        <Stat label="Total Paid" value={summary.total_paid} />
        <Stat label="Balance Due" value={summary.balance} tone={summary.balance > 0.5 ? 'red' : 'green'} />
      </div>

      {/* Actions + leave */}
      <div className="flex flex-wrap items-center gap-2">
        {ENTRY_TYPES.map(t => (
          <button key={t.value} onClick={() => openPay(t.value)}
            className="inline-flex items-center gap-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded-lg text-sm">
            <Plus className="h-3.5 w-3.5" /> {t.label}
          </button>
        ))}
        {employee.pay_basis === 'daily' ? (
          <div className="ml-auto flex items-center gap-2 text-sm">
            <span className="text-slate-500">Days worked ({monthLabel(month)}):</span>
            <input type="number" step="0.5" min="0" value={daysWorkedInput} onChange={(e) => setDaysWorkedInput(e.target.value)}
              className="w-20 border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" />
            <button onClick={saveDaysWorked} className="bg-slate-700 hover:bg-slate-800 text-white px-3 py-1.5 rounded-lg text-sm">Save</button>
          </div>
        ) : (
          <div className="ml-auto flex items-center gap-2 text-sm">
            <span className="text-slate-500">Leave days ({monthLabel(month)}):</span>
            <input type="number" step="0.5" min="0" value={leaveInput} onChange={(e) => setLeaveInput(e.target.value)}
              className="w-20 border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" />
            <button onClick={saveLeave} className="bg-slate-700 hover:bg-slate-800 text-white px-3 py-1.5 rounded-lg text-sm">Save</button>
          </div>
        )}
      </div>

      {/* This month's entries */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-4 py-3 border-b bg-slate-50">
          <h3 className="font-semibold text-slate-700">Entries — {monthLabel(month)}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-slate-500 uppercase">
              <tr>
                <th className="px-4 py-2 text-left">Date</th>
                <th className="px-4 py-2 text-left">Type</th>
                <th className="px-4 py-2 text-right">Amount</th>
                <th className="px-4 py-2 text-center">Mode</th>
                <th className="px-4 py-2 text-left">Paid By / Notes</th>
                <th className="px-4 py-2 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {monthEntries.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-6 text-slate-400 text-xs">No entries for this month</td></tr>
              ) : monthEntries.map((r) => (
                <tr key={r.id} className="border-b hover:bg-slate-50">
                  <td className="px-4 py-2 text-slate-600">{formatDate(r.payment_date)}</td>
                  <td className="px-4 py-2"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${entryMeta(r.entry_type).cls}`}>{entryMeta(r.entry_type).label}</span></td>
                  <td className="px-4 py-2 text-right font-semibold text-slate-800">{formatCurrency(r.amount)}</td>
                  <td className="px-4 py-2 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${r.payment_mode === 'cash' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                      {r.payment_mode === 'cash' ? 'Cash' : 'Online'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-slate-500">{[r.paid_by, r.notes].filter(Boolean).join(' · ') || '—'}</td>
                  <td className="px-4 py-2 text-center">
                    <button onClick={() => deleteEntry(r.id)} className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment modal */}
      {showPay && payForm && (
        <Modal title={entryMeta(payForm.entry_type).label} onClose={() => setShowPay(false)}>
          <form onSubmit={submitPay} className="space-y-3">
            <Row2>
              <Field label="Type">
                <select value={payForm.entry_type} onChange={(e) => setPayForm({ ...payForm, entry_type: e.target.value })} className={inp}>
                  {ENTRY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </Field>
              <Field label="Amount (₹) *">
                <input type="number" step="0.01" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} className={inp} placeholder="0.00" autoFocus />
              </Field>
            </Row2>
            <Row2>
              <Field label="For Month">
                <input type="month" value={payForm.for_month.slice(0, 7)} onChange={(e) => setPayForm({ ...payForm, for_month: `${e.target.value}-01` })} className={inp} />
              </Field>
              <Field label="Payment Date">
                <input type="date" value={payForm.payment_date} onChange={(e) => setPayForm({ ...payForm, payment_date: e.target.value })} className={inp} />
              </Field>
            </Row2>
            <Row2>
              <Field label="Payment Mode">
                <select value={payForm.payment_mode} onChange={(e) => setPayForm({ ...payForm, payment_mode: e.target.value })} className={inp}>
                  <option value="cash">Cash</option>
                  <option value="online">Online</option>
                </select>
              </Field>
              <Field label="Paid By">
                <input value={payForm.paid_by} onChange={(e) => setPayForm({ ...payForm, paid_by: e.target.value })} className={inp} placeholder="Who paid" />
              </Field>
            </Row2>
            <Field label="Notes">
              <input value={payForm.notes} onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })} className={inp} placeholder="Optional note" />
            </Field>
            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={saving} className="flex-1 bg-amber-600 hover:bg-amber-700 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50">{saving ? 'Saving...' : 'Add Entry'}</button>
              <button type="button" onClick={() => setShowPay(false)} className="border border-slate-200 text-slate-600 hover:bg-slate-50 px-4 py-2 rounded-lg text-sm">Cancel</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit employee modal */}
      {showEdit && editForm && (
        <Modal title="Edit Employee" onClose={() => setShowEdit(false)} wide>
          <form onSubmit={submitEdit} className="grid grid-cols-2 gap-3">
            <Field label="Full Name *" className="col-span-2"><input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className={inp} /></Field>
            <Field label="Phone"><input value={editForm.phone || ''} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} className={inp} /></Field>
            <Field label="Designation"><input value={editForm.designation || ''} onChange={(e) => setEditForm({ ...editForm, designation: e.target.value })} className={inp} /></Field>
            <Field label="Type of Appointment">
              <select value={editForm.employment_type} onChange={(e) => setEditForm({ ...editForm, employment_type: e.target.value })} className={inp}>
                {APPOINTMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </Field>
            <Field label="Pay Basis">
              <select value={editForm.pay_basis || 'monthly'} onChange={(e) => setEditForm({ ...editForm, pay_basis: e.target.value })} className={inp}>
                <option value="monthly">Monthly Salary</option>
                <option value="daily">Daily Wages</option>
              </select>
            </Field>
            <Field label={editForm.pay_basis === 'daily' ? 'Daily Wage (₹/day)' : 'Monthly Salary (₹)'}><input type="number" step="0.01" value={editForm.monthly_salary} onChange={(e) => setEditForm({ ...editForm, monthly_salary: e.target.value })} className={inp} /></Field>
            <Field label="Work Timings"><input value={editForm.work_timings || ''} onChange={(e) => setEditForm({ ...editForm, work_timings: e.target.value })} className={inp} /></Field>
            <Field label="Weekly Off"><input value={editForm.weekly_off || ''} onChange={(e) => setEditForm({ ...editForm, weekly_off: e.target.value })} className={inp} /></Field>
            <Field label="Date of Joining"><input type="date" value={editForm.date_of_joining || ''} onChange={(e) => setEditForm({ ...editForm, date_of_joining: e.target.value })} className={inp} /></Field>
            <Field label="Emergency Contact"><input value={editForm.emergency_contact || ''} onChange={(e) => setEditForm({ ...editForm, emergency_contact: e.target.value })} className={inp} /></Field>
            <Field label="Address" className="col-span-2"><input value={editForm.address || ''} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} className={inp} /></Field>
            <label className="col-span-2 flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={!!editForm.deduct_leaves} onChange={(e) => setEditForm({ ...editForm, deduct_leaves: e.target.checked })} className="rounded" />
              Auto-deduct salary for leave days
            </label>
            <label className="col-span-2 flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={!!editForm.is_active} onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })} className="rounded" />
              Active employee
            </label>
            <div className="col-span-2 flex gap-2 pt-1">
              <button type="submit" disabled={saving} className="flex-1 bg-amber-600 hover:bg-amber-700 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50">{saving ? 'Saving...' : 'Save Changes'}</button>
              <button type="button" onClick={() => setShowEdit(false)} className="border border-slate-200 text-slate-600 hover:bg-slate-50 px-4 py-2 rounded-lg text-sm">Cancel</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Appointment letter modal */}
      {showLetter && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 px-4 py-8 overflow-y-auto" onClick={() => setShowLetter(false)}>
          <div className="w-full max-w-4xl my-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-2 mb-3">
              <h2 className="font-bold text-white text-lg">Appointment Letter</h2>
              <div className="flex items-center gap-2">
                <button onClick={printLetter} className="inline-flex items-center gap-1.5 bg-white/90 hover:bg-white text-slate-700 px-3 py-1.5 rounded-lg text-sm font-medium"><Printer className="h-4 w-4" /> Print</button>
                <button onClick={downloadLetter} className="inline-flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium"><FileDown className="h-4 w-4" /> Download PDF</button>
                <button onClick={() => setShowLetter(false)} className="inline-flex items-center gap-1.5 bg-white/90 hover:bg-white text-slate-700 p-1.5 rounded-lg"><X className="h-4 w-4" /></button>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-2xl overflow-x-auto">
              <AppointmentLetter ref={letterRef} employee={employee} firm={firm} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const inp = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500'

function Field({ label, className = '', children }) {
  return <div className={className}><label className="block text-xs font-medium text-slate-700 mb-1">{label}</label>{children}</div>
}
function Row2({ children }) { return <div className="grid grid-cols-2 gap-3">{children}</div> }

function Meta({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
      <div>
        <p className="text-xs text-slate-400">{label}</p>
        <p className="text-slate-700 font-medium">{value}</p>
      </div>
    </div>
  )
}

function Stat({ label, value, tone, hint }) {
  const color = tone === 'green' ? 'text-green-700' : tone === 'red' ? 'text-red-600' : tone === 'bold' ? 'text-slate-900' : 'text-slate-800'
  return (
    <div className={`bg-white rounded-xl border border-slate-100 shadow-sm p-3.5 ${tone === 'bold' ? 'ring-1 ring-amber-200' : ''}`}>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={`text-lg font-bold mt-0.5 ${color}`}>{formatCurrency(value)}</p>
      {hint && <p className="text-[11px] text-slate-400 mt-0.5">{hint}</p>}
    </div>
  )
}

function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8 overflow-y-auto" onClick={onClose}>
      <div className={`bg-white rounded-2xl shadow-2xl w-full ${wide ? 'max-w-lg' : 'max-w-md'} my-auto`} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 rounded-t-2xl border-b bg-amber-50 border-amber-100">
          <h2 className="font-bold text-base text-amber-800">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  )
}
