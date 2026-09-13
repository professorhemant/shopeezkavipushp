import { useState, useEffect } from 'react'
import { Instagram, Phone, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react'
import api from '../../api'

const STATUS_OPTIONS = [
  { value: 'in_progress', label: 'In progress', color: 'bg-blue-500/15 text-blue-400' },
  { value: 'number_collected', label: 'Number collected', color: 'bg-amber-500/15 text-amber-400' },
  { value: 'contacted', label: 'Contacted', color: 'bg-purple-500/15 text-purple-400' },
  { value: 'converted', label: 'Converted', color: 'bg-green-500/15 text-green-400' },
  { value: 'not_interested', label: 'Not interested', color: 'bg-slate-500/15 text-slate-400' },
]

const TABS = ['all', 'number_collected', 'contacted', 'converted', 'in_progress', 'not_interested']

function statusMeta(val) {
  return STATUS_OPTIONS.find(s => s.value === val) || STATUS_OPTIONS[0]
}

export default function InstagramLeads() {
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('all')
  const [expanded, setExpanded] = useState(null)

  useEffect(() => { fetchLeads() }, [])

  const fetchLeads = async () => {
    try {
      const res = await api.get('/instagram/leads')
      if (res.data?.success) setLeads(res.data.leads)
    } catch { } finally { setLoading(false) }
  }

  const updateStatus = async (id, status) => {
    try {
      await api.patch(`/instagram/leads/${id}`, { status })
      setLeads(prev => prev.map(l => l.id === id ? { ...l, status } : l))
    } catch { }
  }

  const filtered = tab === 'all' ? leads : leads.filter(l => l.status === tab)

  const count = (s) => s === 'all' ? leads.length : leads.filter(l => l.status === s).length

  const tabLabel = (s) => {
    if (s === 'all') return `All (${leads.length})`
    const m = statusMeta(s)
    return `${m.label} (${count(s)})`
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-2">
        <Instagram className="h-5 w-5 text-slate-400" />
        <h1 className="text-xl font-bold text-slate-100">Instagram Leads</h1>
      </div>
      <p className="text-sm text-slate-400 mb-6">
        Every bridal enquiry the DM bot has picked up — sorted by most recent message. A phone number means the team should call.
      </p>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              tab === t
                ? 'bg-amber-500 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            {tabLabel(t)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center text-slate-500 py-12">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-slate-500 py-12">No leads in this category.</div>
      ) : (
        <div className="space-y-2">
          {filtered.map(lead => {
            const sm = statusMeta(lead.status)
            const isOpen = expanded === lead.id
            return (
              <div key={lead.id} className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                <div
                  className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-white/5"
                  onClick={() => setExpanded(isOpen ? null : lead.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-200 text-sm">
                        @{lead.username || lead.sender_id}
                      </span>
                      {lead.auto_replied && (
                        <span className="text-[10px] bg-green-500/15 text-green-400 px-1.5 py-0.5 rounded-full">bot replied</span>
                      )}
                    </div>
                    {lead.last_message && (
                      <p className="text-xs text-slate-400 mt-0.5 truncate max-w-xs">{lead.last_message}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {lead.phone ? (
                      <span className="flex items-center gap-1 text-xs text-amber-400 font-medium">
                        <Phone className="h-3 w-3" /> {lead.phone}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-500">Not shared yet</span>
                    )}

                    <select
                      value={lead.status}
                      onChange={e => { e.stopPropagation(); updateStatus(lead.id, e.target.value) }}
                      onClick={e => e.stopPropagation()}
                      className={`text-xs px-2 py-1 rounded-lg border-0 cursor-pointer focus:outline-none ${sm.color}`}
                    >
                      {STATUS_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>

                    <span className="text-xs text-slate-500 w-32 text-right">
                      {new Date(lead.last_message_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>

                    {isOpen ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t border-slate-700 px-5 py-4 bg-black/20">
                    <p className="text-xs text-slate-400 mb-1">Last message</p>
                    <p className="text-sm text-slate-200">{lead.last_message || '—'}</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
