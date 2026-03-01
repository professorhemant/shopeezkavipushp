import { useEffect, useState, useCallback } from 'react'
import { Plus, Search, Calendar, Clock, User, CheckCircle, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { appointmentAPI } from '../../api'
import { formatDate } from '../../utils/formatters'
import LoadingSpinner from '../../components/common/LoadingSpinner'

const EMPTY_FORM = {
  customer_name: '', customer_phone: '', service: '', staff_name: '',
  date: new Date().toISOString().split('T')[0], time: '10:00', duration_minutes: 30, notes: ''
}

const STATUS_COLORS = {
  scheduled: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  no_show: 'bg-gray-100 text-gray-600',
}

export default function Appointments() {
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [summary, setSummary] = useState({ today: 0, total: 0, completed: 0 })

  const fetchAppointments = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await appointmentAPI.getAll({ search, date: dateFilter, status: statusFilter })
      const items = data.data || data.appointments || []
      setAppointments(items)
      setSummary({
        total: data.count || items.length,
        today: data.today_count || items.filter((a) => a.date === new Date().toISOString().split('T')[0]).length,
        completed: items.filter((a) => a.status === 'completed').length,
      })
    } catch {
      toast.error('Failed to load appointments')
    } finally {
      setLoading(false)
    }
  }, [search, dateFilter, statusFilter])

  useEffect(() => { fetchAppointments() }, [fetchAppointments])

  const openAdd = () => { setEditing(null); setForm(EMPTY_FORM); setShowModal(true) }
  const openEdit = (a) => {
    setEditing(a.id)
    setForm({ customer_name: a.customer_name || '', customer_phone: a.customer_phone || '', service: a.service || '', staff_name: a.staff_name || '', date: a.date?.split('T')[0] || '', time: a.time || '10:00', duration_minutes: a.duration_minutes || 30, notes: a.notes || '' })
    setShowModal(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.customer_name || !form.date) return toast.error('Customer name and date are required')
    setSaving(true)
    try {
      if (editing) {
        await appointmentAPI.update(editing, form)
        toast.success('Appointment updated')
      } else {
        await appointmentAPI.create(form)
        toast.success('Appointment created')
      }
      setShowModal(false)
      fetchAppointments()
    } catch {
      toast.error('Failed to save appointment')
    } finally {
      setSaving(false)
    }
  }

  const handleComplete = async (id) => {
    try {
      await appointmentAPI.complete(id)
      toast.success('Marked as completed')
      fetchAppointments()
    } catch {
      toast.error('Failed to update')
    }
  }

  const handleCancel = async (id) => {
    if (!window.confirm('Cancel this appointment?')) return
    try {
      await appointmentAPI.cancel(id)
      toast.success('Appointment cancelled')
      fetchAppointments()
    } catch {
      toast.error('Failed to cancel')
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Appointments</h1>
          <p className="text-sm text-gray-500 mt-0.5">{summary.today} today · {summary.total} total</p>
        </div>
        <button onClick={openAdd} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
          <Plus className="h-4 w-4" /> New Appointment
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Today's Appointments", value: summary.today, color: 'text-blue-600' },
          { label: 'Total This Period', value: summary.total, color: 'text-gray-900' },
          { label: 'Completed', value: summary.completed, color: 'text-green-600' },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className={`text-xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input type="text" placeholder="Search customer, service..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All Status</option>
            <option value="scheduled">Scheduled</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16"><LoadingSpinner size="lg" /></div>
        ) : appointments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Calendar className="h-12 w-12 mb-3 text-gray-300" />
            <p className="text-base font-medium text-gray-500">No appointments found</p>
            <button onClick={openAdd} className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">Create First Appointment</button>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {appointments.map((a) => (
              <div key={a.id} className="px-4 py-3 flex items-center gap-4 hover:bg-gray-50">
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <User className="h-5 w-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900">{a.customer_name}</p>
                  <p className="text-sm text-gray-500">{a.service || 'General'} · {a.customer_phone}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="flex items-center gap-1 text-sm text-gray-600"><Calendar className="h-3.5 w-3.5" />{formatDate(a.date)}</div>
                  <div className="flex items-center gap-1 text-sm text-gray-500 mt-0.5"><Clock className="h-3.5 w-3.5" />{a.time}</div>
                </div>
                <div className="flex-shrink-0">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[a.status] || STATUS_COLORS.scheduled}`}>{a.status || 'scheduled'}</span>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {a.status === 'scheduled' && (
                    <>
                      <button onClick={() => handleComplete(a.id)} title="Mark complete" className="p-1.5 rounded-lg hover:bg-green-50 text-gray-400 hover:text-green-600"><CheckCircle className="h-4 w-4" /></button>
                      <button onClick={() => handleCancel(a.id)} title="Cancel" className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600"><XCircle className="h-4 w-4" /></button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">{editing ? 'Edit Appointment' : 'New Appointment'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Customer Name *</label>
                  <input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
                  <input value={form.customer_phone} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Service</label>
                  <input value={form.service} onChange={(e) => setForm({ ...form, service: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Date *</label>
                  <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Time</label>
                  <input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Duration (mins)</label>
                  <select value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {[15, 30, 45, 60, 90, 120].map((d) => <option key={d} value={d}>{d} min</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Staff</label>
                  <input value={form.staff_name} onChange={(e) => setForm({ ...form, staff_name: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
                  <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">{saving ? 'Saving...' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
