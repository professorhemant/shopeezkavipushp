import { useEffect, useState } from 'react'
import { CalendarClock, CheckCircle2, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import { bridalAPI } from '../../api'
import LoadingSpinner from '../../components/common/LoadingSpinner'

const fmtDate = (d) => {
  if (!d) return '—'
  const [y, m, day] = String(d).split('T')[0].split('-')
  return `${day}/${m}/${y}`
}

const today = () => new Date().toISOString().split('T')[0]

const daysUntil = (dateStr) => {
  if (!dateStr) return null
  const diff = Math.ceil((new Date(dateStr) - new Date(today())) / 86400000)
  return diff
}

const returnBadge = (dateStr) => {
  if (!dateStr) return null
  const d = daysUntil(dateStr)
  if (d < 0) return { label: `${Math.abs(d)}d overdue`, cls: 'bg-red-100 text-red-700' }
  if (d === 0) return { label: 'Due today', cls: 'bg-red-100 text-red-700' }
  if (d === 1) return { label: 'Due tomorrow', cls: 'bg-amber-100 text-amber-700' }
  if (d <= 3) return { label: `Due in ${d}d`, cls: 'bg-amber-50 text-amber-600' }
  return { label: `${d}d left`, cls: 'bg-green-50 text-green-700' }
}

const functionBadge = (dateStr) => {
  if (!dateStr) return null
  const d = daysUntil(dateStr)
  if (d < 0) return null
  if (d === 0) return { label: 'Today!', cls: 'bg-pink-100 text-pink-700 font-semibold' }
  if (d === 1) return { label: 'Tomorrow', cls: 'bg-pink-50 text-pink-600' }
  if (d <= 7) return { label: `in ${d}d`, cls: 'bg-indigo-50 text-indigo-600' }
  return { label: `in ${d}d`, cls: 'bg-slate-100 text-slate-500' }
}

export default function UpcomingBookings() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [marking, setMarking] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await bridalAPI.listUpcomingBookings()
      setRows(data.data || [])
    } catch {
      toast.error('Failed to load upcoming bookings')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const markReturned = async (r) => {
    if (!window.confirm(`Mark "${r.set_code || r.set_name || 'this set'}" as returned for ${r.customer_name || 'customer'}?`)) return
    setMarking(r.id)
    try {
      await bridalAPI.markBookingReturned(r.id)
      toast.success('Marked as returned')
      setRows(prev => prev.filter(b => b.id !== r.id))
    } catch {
      toast.error('Failed to mark as returned')
    } finally {
      setMarking(null)
    }
  }

  const rowUrgency = (r) => {
    if (!r.return_date) return ''
    const d = daysUntil(r.return_date)
    if (d <= 0) return 'bg-red-50'
    if (d <= 1) return 'bg-amber-50'
    return ''
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800 flex items-center gap-2">
            <CalendarClock className="h-6 w-6 text-amber-600" /> Upcoming Bookings
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {loading ? 'Loading…' : `${rows.length} active booking${rows.length !== 1 ? 's' : ''} — auto-clears when return date passes`}
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="border border-slate-200 hover:bg-slate-50 text-slate-600 px-3 py-2 rounded-lg text-sm flex items-center gap-2 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        {loading ? (
          <div className="flex items-center justify-center py-16"><LoadingSpinner size="lg" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-800 text-xs text-slate-200 uppercase sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left">Set Code</th>
                  <th className="px-4 py-3 text-left">Customer</th>
                  <th className="px-4 py-3 text-left">Booking Date</th>
                  <th className="px-4 py-3 text-left">Function Date</th>
                  <th className="px-4 py-3 text-left">Return Date</th>
                  <th className="px-4 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-16 text-slate-400">
                      <CalendarClock className="h-10 w-10 mx-auto mb-2 opacity-30" />
                      No upcoming bookings
                    </td>
                  </tr>
                ) : rows.map(r => {
                  const rBadge = returnBadge(r.return_date)
                  const fBadge = functionBadge(r.function_date)
                  return (
                    <tr key={r.id} className={`border-b hover:bg-slate-50 transition-colors ${rowUrgency(r)}`}>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-amber-600">{r.set_code || r.customized_set || '—'}</div>
                        {r.set_name && <div className="text-xs text-slate-400 mt-0.5">{r.set_name}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-700">{r.customer_name || <span className="text-slate-300">—</span>}</div>
                        {r.mobile_no && <div className="text-xs text-slate-400">{r.mobile_no}</div>}
                      </td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{fmtDate(r.booking_date)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-slate-700">{fmtDate(r.function_date)}</div>
                        {fBadge && (
                          <span className={`inline-block mt-0.5 text-xs px-1.5 py-0.5 rounded-full ${fBadge.cls}`}>
                            {fBadge.label}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-slate-700">{fmtDate(r.return_date)}</div>
                        {rBadge && (
                          <span className={`inline-block mt-0.5 text-xs px-1.5 py-0.5 rounded-full ${rBadge.cls}`}>
                            {rBadge.label}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => markReturned(r)}
                          disabled={marking === r.id}
                          className="inline-flex items-center gap-1.5 bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50 whitespace-nowrap"
                          title="Mark as returned — removes from this list"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {marking === r.id ? 'Marking…' : 'Mark Returned'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
