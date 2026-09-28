import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Gift, Users, TrendingUp, AlertTriangle, IndianRupee, Search, Plus, Minus } from 'lucide-react'
import toast from 'react-hot-toast'
import { loyaltyAPI } from '../../api'
import { formatDate } from '../../utils/formatters'

const STATUS_CONFIG = {
  active:        { label: 'Active',         bg: 'bg-green-500/10',  text: 'text-green-400',  border: 'border-green-500/30' },
  expiring_soon: { label: 'Expiring Soon',  bg: 'bg-amber-500/10',  text: 'text-amber-400',  border: 'border-amber-500/30' },
  expired:       { label: 'Expired',        bg: 'bg-red-500/10',    text: 'text-red-400',    border: 'border-red-500/30'   },
}

export default function LoyaltyDashboard() {
  const [customers, setCustomers] = useState([])
  const [filtered, setFiltered] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('all')
  const [search, setSearch] = useState('')
  const [adjustModal, setAdjustModal] = useState(null) // { customer }
  const [adjustPoints, setAdjustPoints] = useState('')
  const [adjustNote, setAdjustNote] = useState('')
  const [adjusting, setAdjusting] = useState(false)

  const load = async () => {
    try {
      const res = await loyaltyAPI.getSummary()
      setCustomers(res.data?.data || [])
    } catch {
      toast.error('Failed to load loyalty data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    let data = customers
    if (tab !== 'all') data = data.filter(c => c.status === tab)
    if (search.trim()) {
      const q = search.toLowerCase()
      data = data.filter(c => c.name?.toLowerCase().includes(q) || c.phone?.includes(q))
    }
    setFiltered(data)
  }, [customers, tab, search])

  const handleAdjust = async () => {
    if (!adjustPoints || isNaN(parseInt(adjustPoints))) return toast.error('Enter valid points')
    setAdjusting(true)
    try {
      await loyaltyAPI.adjust({ customer_id: adjustModal.id, points: parseInt(adjustPoints), notes: adjustNote })
      toast.success('Points adjusted')
      setAdjustModal(null)
      setAdjustPoints('')
      setAdjustNote('')
      load()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Adjustment failed')
    } finally {
      setAdjusting(false)
    }
  }

  const stats = {
    total: customers.length,
    active: customers.filter(c => c.status === 'active').length,
    expiring: customers.filter(c => c.status === 'expiring_soon').length,
    totalPoints: customers.reduce((s, c) => s + (c.loyalty_points || 0), 0),
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-400">Loading…</div>

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Gift className="h-6 w-6 text-amber-400" /> Loyalty Points</h1>
          <p className="text-slate-400 text-sm mt-0.5">Manage customer reward points — 1 pt = ₹1 discount · 3-month rolling validity</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Customers', value: stats.total,       icon: Users,        color: 'text-blue-400'   },
          { label: 'Active Points',   value: stats.active,      icon: TrendingUp,   color: 'text-green-400'  },
          { label: 'Expiring Soon',   value: stats.expiring,    icon: AlertTriangle, color: 'text-amber-400' },
          { label: 'Points in Pool',  value: stats.totalPoints.toLocaleString('en-IN'), icon: Gift, color: 'text-purple-400' },
        ].map(s => (
          <div key={s.label} className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <div className="flex items-center gap-2 text-slate-400 text-xs mb-1"><s.icon className={`h-4 w-4 ${s.color}`} />{s.label}</div>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or phone…"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500" />
        </div>
        <div className="flex gap-1 bg-slate-800 border border-slate-700 rounded-lg p-1">
          {['all', 'active', 'expiring_soon', 'expired'].map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${tab === t ? 'bg-amber-500 text-white' : 'text-slate-400 hover:text-white'}`}>
              {t === 'all' ? 'All' : t === 'expiring_soon' ? 'Expiring' : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-500">
            <Gift className="h-10 w-10 mb-3 opacity-30" />
            <p className="text-sm">No customers match this filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-slate-400 text-xs uppercase tracking-wide">
                  <th className="text-left px-4 py-3">Customer</th>
                  <th className="text-right px-4 py-3">Points</th>
                  <th className="text-right px-4 py-3">Value</th>
                  <th className="text-left px-4 py-3">Expires</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Lifetime Spend</th>
                  <th className="text-right px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => {
                  const cfg = STATUS_CONFIG[c.status] || STATUS_CONFIG.active
                  return (
                    <tr key={c.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                      <td className="px-4 py-3">
                        <Link to={`/customers/${c.id}`} className="font-medium text-white hover:text-amber-400">{c.name}</Link>
                        <p className="text-xs text-slate-500">{c.phone}</p>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-amber-400">{(c.loyalty_points || 0).toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 text-right text-green-400 flex items-center justify-end gap-0.5">
                        <IndianRupee className="h-3 w-3" />{(c.loyalty_points || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3 text-slate-300 text-xs">{c.points_expires_at ? formatDate(c.points_expires_at) : '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${cfg.bg} ${cfg.text} ${cfg.border}`}>{cfg.label}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-300 text-xs">₹{parseFloat(c.lifetime_spend || 0).toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => setAdjustModal(c)}
                          className="text-xs px-2 py-1 rounded bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white">
                          Adjust
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

      {/* Adjust Modal */}
      {adjustModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-sm p-6 space-y-4">
            <h2 className="text-lg font-bold text-white">Adjust Points — {adjustModal.name}</h2>
            <p className="text-sm text-slate-400">Current balance: <span className="text-amber-400 font-bold">{adjustModal.loyalty_points} pts</span></p>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Points (+add / −deduct)</label>
              <input type="number" value={adjustPoints} onChange={e => setAdjustPoints(e.target.value)} placeholder="e.g. 50 or -20"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Reason / Note</label>
              <input type="text" value={adjustNote} onChange={e => setAdjustNote(e.target.value)} placeholder="e.g. Correction for return"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500" />
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setAdjustModal(null)} className="flex-1 px-4 py-2 rounded-lg border border-slate-600 text-slate-400 text-sm hover:text-white">Cancel</button>
              <button onClick={handleAdjust} disabled={adjusting}
                className="flex-1 px-4 py-2 rounded-lg bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 disabled:opacity-50">
                {adjusting ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
