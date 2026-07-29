import { useEffect, useState } from 'react'
import { Save } from 'lucide-react'
import toast from 'react-hot-toast'
import { dayBookAPI } from '../../api'
import useAuthStore from '../../store/authStore'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import DayBookSummaryView from './DayBookSummaryView'

const today = () => new Date().toISOString().split('T')[0]

export default function TotalReceived() {
  const { user } = useAuthStore()
  const isAdmin = ['super_admin', 'admin'].includes(user?.role_name)
  const [date, setDate] = useState(today())
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    try { const res = await dayBookAPI.getSummary(date); setData(res.data.data) }
    catch { toast.error('Failed to load summary') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [date])

  const handleSave = async () => {
    setSaving(true)
    try {
      await dayBookAPI.saveSnapshot(date)
      toast.success(date === today() ? "Today's Day Book saved" : `Day Book saved for ${date}`)
    } catch { toast.error('Failed to save Day Book') }
    finally { setSaving(false) }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Day Book — Total Received</h1>
          <p className="text-sm text-slate-500 mt-0.5">{isAdmin ? 'Pick a date to view or back-fill a day, then Save Day Book.' : "Today's summary — for previous days open "}{!isAdmin && <span className="font-medium">Saved Day Book</span>}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleSave} disabled={saving || loading}
            className="inline-flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white px-3 py-2 rounded-lg text-sm font-semibold">
            <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save Day Book'}
          </button>
          <input type="date" value={date} max={today()}
            onChange={(e) => isAdmin && setDate(e.target.value)}
            disabled={!isAdmin}
            title={isAdmin ? 'Pick a date to view or back-fill its Day Book' : 'Previous days are available in Saved Day Book'}
            className={`border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 ${isAdmin ? 'border-slate-200' : 'border-slate-100 bg-slate-50 text-slate-400 cursor-not-allowed'}`} />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24"><LoadingSpinner size="lg" /></div>
      ) : (
        <DayBookSummaryView data={data} />
      )}
    </div>
  )
}
