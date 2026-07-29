import { useEffect, useState } from 'react'
import { Lock } from 'lucide-react'
import toast from 'react-hot-toast'
import { verifyCredentials, dayBookAPI } from '../../api'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import DayBookSummaryView from './DayBookSummaryView'

const today = () => new Date().toISOString().split('T')[0]
const UNLOCK_KEY = 'daybook_saved_unlocked'
const ALLOWED_ROLES = ['admin', 'super_admin']

export default function SavedDayBook() {
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem(UNLOCK_KEY) === '1')

  // Unlock form state
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState('')

  // Viewer state
  const [date, setDate] = useState(today())
  const [data, setData] = useState(null)
  const [meta, setMeta] = useState(null) // { saved_by, saved_at } when the day was saved
  const [loading, setLoading] = useState(false)
  const [snapshots, setSnapshots] = useState([])

  const handleUnlock = async (e) => {
    e.preventDefault()
    setError('')
    setVerifying(true)
    try {
      // Verified against a real account (bcrypt on the server). Does NOT change
      // the current session — the returned token is intentionally ignored.
      const res = await verifyCredentials({ email: email.trim(), password })
      const role = res.data?.user?.role_name
      if (!ALLOWED_ROLES.includes(role)) {
        setError('This account is not authorized to view saved day books.')
        return
      }
      sessionStorage.setItem(UNLOCK_KEY, '1')
      setUnlocked(true)
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid email or password.')
    } finally {
      setVerifying(false)
    }
  }

  const lock = () => {
    sessionStorage.removeItem(UNLOCK_KEY)
    setUnlocked(false)
    setPassword('')
    setData(null)
  }

  const load = async () => {
    setLoading(true)
    try {
      // Prefer the saved snapshot; fall back to a live recompute if not saved.
      try {
        const res = await dayBookAPI.getSnapshot(date)
        setData(res.data.data.data)
        setMeta({ saved_by: res.data.data.saved_by, saved_at: res.data.data.updatedAt })
      } catch (err) {
        if (err.response?.status !== 404) throw err
        const res = await dayBookAPI.getSummary(date)
        setData(res.data.data)
        setMeta(null)
      }
    } catch { toast.error('Failed to load summary') }
    finally { setLoading(false) }
  }

  const loadList = async () => {
    try { const res = await dayBookAPI.listSnapshots(); setSnapshots(res.data.data || []) }
    catch { /* non-critical */ }
  }

  useEffect(() => { if (unlocked) load() }, [unlocked, date])
  useEffect(() => { if (unlocked) loadList() }, [unlocked])

  if (!unlocked) {
    return (
      <div className="max-w-md mx-auto mt-10">
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
              <Lock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800">Saved Day Book</h1>
              <p className="text-xs text-slate-500">Enter authorized credentials to view previous days</p>
            </div>
          </div>
          <form onSubmit={handleUnlock} className="space-y-3 mt-4">
            <div>
              <label className="block text-sm text-slate-600 mb-1">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="off"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="off"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button type="submit" disabled={verifying}
              className="w-full bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-semibold">
              {verifying ? 'Verifying…' : 'Unlock'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Saved Day Book</h1>
          <p className="text-sm text-slate-500 mt-0.5">View any previous day's summary</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" />
          <button onClick={lock} className="text-sm text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg px-3 py-2">Lock</button>
        </div>
      </div>

      {snapshots.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-400 uppercase">Saved days:</span>
          {snapshots.map((s) => (
            <button key={s.date} onClick={() => setDate(s.date)}
              className={`text-xs px-2.5 py-1 rounded-full border ${s.date === date ? 'bg-amber-100 border-amber-300 text-amber-800' : 'bg-white border-slate-200 text-slate-600 hover:border-amber-300'}`}>
              {s.date}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-24"><LoadingSpinner size="lg" /></div>
      ) : (
        <>
          {meta ? (
            <p className="text-xs text-green-600">✓ Saved snapshot{meta.saved_by ? ` by ${meta.saved_by}` : ''}{meta.saved_at ? ` on ${new Date(meta.saved_at).toLocaleString()}` : ''}</p>
          ) : (
            <p className="text-xs text-slate-400">Live figures — this day was not explicitly saved.</p>
          )}
          <DayBookSummaryView data={data} />
        </>
      )}
    </div>
  )
}
