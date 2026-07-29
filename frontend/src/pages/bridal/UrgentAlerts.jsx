import { useState, useEffect, useCallback } from 'react'
import { AlertTriangle, CheckCircle, Clock, RefreshCw } from 'lucide-react'
import { bridalAPI } from '../../api'

function AlertTable({ rows, today, onMarkReturned, loading }) {
  if (!rows.length) return (
    <p className="text-slate-400 py-4 text-sm">None.</p>
  )
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-700 text-slate-400 text-xs uppercase">
            <th className="text-left py-2 pr-4">Customer</th>
            <th className="text-left py-2 pr-4">Set / Category</th>
            <th className="text-left py-2 pr-4">Pickup</th>
            <th className="text-left py-2 pr-4">Return Date</th>
            <th className="text-right py-2 pr-4">Security to Return</th>
            <th className="text-center py-2">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((b) => {
            const daysLate = b.return_date < today
              ? Math.round((new Date(today) - new Date(b.return_date)) / 86400000)
              : 0
            return (
              <tr key={b.id} className="border-b border-slate-800 hover:bg-white/3 transition-colors">
                <td className="py-3 pr-4">
                  <p className="font-medium text-slate-200">{b.customer_name || 'N/A'}</p>
                  <p className="text-slate-500 text-xs">{b.mobile_no || ''}</p>
                </td>
                <td className="py-3 pr-4">
                  <p className="font-medium text-slate-200">{b.set_code || b.set_name || 'N/A'}</p>
                  <p className="text-slate-500 text-xs">{b.category || ''}</p>
                </td>
                <td className="py-3 pr-4 text-slate-300">
                  {b.pickup_date ? new Date(b.pickup_date).toLocaleDateString('en-IN') : 'N/A'}
                </td>
                <td className="py-3 pr-4">
                  <p className={`font-semibold ${daysLate > 0 ? 'text-red-400' : 'text-amber-400'}`}>
                    {b.return_date ? new Date(b.return_date).toLocaleDateString('en-IN') : 'N/A'}
                  </p>
                  {daysLate > 0 && (
                    <p className="text-red-400 text-xs">{daysLate} day{daysLate !== 1 ? 's' : ''} late</p>
                  )}
                </td>
                <td className="py-3 pr-4 text-right">
                  {b.security > 0
                    ? <span className="font-bold text-emerald-400 text-base">₹{b.security.toLocaleString('en-IN')}</span>
                    : <span className="text-slate-500">—</span>
                  }
                </td>
                <td className="py-3 text-center">
                  <button
                    onClick={() => onMarkReturned(b.id)}
                    disabled={loading === b.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors disabled:opacity-50"
                  >
                    {loading === b.id
                      ? <RefreshCw className="h-3 w-3 animate-spin" />
                      : <CheckCircle className="h-3 w-3" />
                    }
                    Mark Returned
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default function UrgentAlerts() {
  const [data, setData] = useState({ today: [], overdue: [] })
  const [fetching, setFetching] = useState(true)
  const [markingId, setMarkingId] = useState(null)
  const todayStr = new Date().toISOString().split('T')[0]

  const load = useCallback(async () => {
    setFetching(true)
    try {
      const res = await bridalAPI.getUrgentAlerts()
      if (res.data?.success) setData(res.data)
    } catch (_) {}
    setFetching(false)
  }, [])

  useEffect(() => { load() }, [load])

  const handleMarkReturned = async (id) => {
    if (!window.confirm('Mark this booking as returned? The set will become available for new bookings.')) return
    setMarkingId(id)
    try {
      await bridalAPI.markBookingReturned(id)
      await load()
    } catch (_) {
      alert('Failed to update. Please try again.')
    }
    setMarkingId(null)
  }

  const totalCount = data.today.length + data.overdue.length

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-red-400 flex items-center gap-2">
            <AlertTriangle className="h-6 w-6" />
            Urgent Alerts
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Bridal sets due for return — collect security deposit and mark as returned
          </p>
        </div>
        <button
          onClick={load}
          disabled={fetching}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm transition-colors"
        >
          <RefreshCw className={`h-4 w-4 ${fetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* All clear */}
      {!fetching && totalCount === 0 && (
        <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-8 text-center">
          <CheckCircle className="h-12 w-12 text-emerald-400 mx-auto mb-3" />
          <h3 className="text-emerald-400 font-semibold text-lg">All Clear!</h3>
          <p className="text-slate-400 text-sm mt-1">No urgent returns today and no overdue bookings.</p>
        </div>
      )}

      {/* Due Today */}
      <div className="rounded-xl bg-slate-800 border border-red-500/30 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-700 bg-red-500/10 flex items-center gap-3">
          <Clock className="h-5 w-5 text-red-400" />
          <h2 className="font-semibold text-red-300">
            Due Today — {new Date().toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })}
          </h2>
          <span className="ml-auto bg-red-500 text-white text-xs font-bold px-2.5 py-0.5 rounded-full">
            {data.today.length}
          </span>
        </div>
        <div className="px-5 py-3">
          <AlertTable rows={data.today} today={todayStr} onMarkReturned={handleMarkReturned} loading={markingId} />
        </div>
      </div>

      {/* Overdue */}
      {(data.overdue.length > 0 || fetching) && (
        <div className="rounded-xl bg-slate-800 border border-orange-500/30 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-700 bg-orange-500/10 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-orange-400" />
            <h2 className="font-semibold text-orange-300">Overdue Returns</h2>
            <span className="ml-auto bg-orange-500 text-white text-xs font-bold px-2.5 py-0.5 rounded-full">
              {data.overdue.length}
            </span>
          </div>
          <div className="px-5 py-3">
            <AlertTable rows={data.overdue} today={todayStr} onMarkReturned={handleMarkReturned} loading={markingId} />
          </div>
        </div>
      )}
    </div>
  )
}
