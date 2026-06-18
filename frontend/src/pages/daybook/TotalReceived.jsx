import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { dayBookAPI } from '../../api'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import DayBookSummaryView from './DayBookSummaryView'

const today = () => new Date().toISOString().split('T')[0]

export default function TotalReceived() {
  const [date] = useState(today())
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try { const res = await dayBookAPI.getSummary(date); setData(res.data.data) }
    catch { toast.error('Failed to load summary') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [date])

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Day Book — Total Received</h1>
          <p className="text-sm text-slate-500 mt-0.5">Today's summary — for previous days open <span className="font-medium">Saved Day Book</span></p>
        </div>
        <input type="date" value={date} disabled
          title="Previous days are available in Saved Day Book"
          className="border rounded-lg px-3 py-2 text-sm border-slate-100 bg-slate-50 text-slate-400 cursor-not-allowed" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24"><LoadingSpinner size="lg" /></div>
      ) : (
        <DayBookSummaryView data={data} />
      )}
    </div>
  )
}
