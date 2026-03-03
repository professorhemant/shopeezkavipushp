import { useEffect, useState } from 'react'
import { Plus, MessageCircle, Send, Users } from 'lucide-react'
import toast from 'react-hot-toast'
import { whatsappAPI } from '../../api'
import { formatDate } from '../../utils/formatters'
import LoadingSpinner from '../../components/common/LoadingSpinner'

const EMPTY_FORM = { name: '', message: '', target: 'all_customers', scheduled_at: '' }

export default function WhatsAppCampaigns() {
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(null)

  const fetchCampaigns = () => {
    setLoading(true)
    whatsappAPI.getCampaigns()
      .then(({ data }) => setCampaigns(data.data || data.campaigns || []))
      .catch(() => toast.error('Failed to load campaigns'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchCampaigns() }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!form.name || !form.message) return toast.error('Name and message are required')
    setSaving(true)
    try {
      await whatsappAPI.createCampaign(form)
      toast.success('Campaign created')
      setShowModal(false)
      setForm(EMPTY_FORM)
      fetchCampaigns()
    } catch {
      toast.error('Failed to create campaign')
    } finally {
      setSaving(false)
    }
  }

  const handleSend = async (id) => {
    if (!window.confirm('Send this campaign now? This will send WhatsApp messages to all targeted customers.')) return
    setSending(id)
    try {
      await whatsappAPI.sendCampaign(id)
      toast.success('Campaign sent successfully!')
      fetchCampaigns()
    } catch {
      toast.error('Failed to send campaign')
    } finally {
      setSending(null)
    }
  }

  const STATUS_COLORS = {
    draft: 'bg-slate-100 text-slate-600',
    scheduled: 'bg-amber-50 text-amber-700',
    sent: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">WhatsApp Campaigns</h1>
          <p className="text-sm text-slate-500 mt-0.5">Bulk messaging and marketing campaigns</p>
        </div>
        <button onClick={() => { setForm(EMPTY_FORM); setShowModal(true) }} className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
          <Plus className="h-4 w-4" /> New Campaign
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-32"><LoadingSpinner size="lg" /></div>
      ) : campaigns.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 flex flex-col items-center justify-center py-20 text-slate-400">
          <MessageCircle className="h-12 w-12 mb-3 text-slate-300" />
          <p className="text-base font-medium text-slate-500">No campaigns yet</p>
          <p className="text-sm mt-1 text-slate-400">Create a campaign to engage your customers via WhatsApp</p>
          <button onClick={() => { setForm(EMPTY_FORM); setShowModal(true) }} className="mt-4 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium">Create First Campaign</button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {campaigns.map((c) => (
            <div key={c.id} className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-slate-800">{c.name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Created {formatDate(c.created_at)}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[c.status] || STATUS_COLORS.draft}`}>{c.status || 'draft'}</span>
              </div>
              <p className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3 mb-3 line-clamp-3">{c.message}</p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{c.target || 'All customers'}</span>
                  {c.sent_count !== undefined && <span>{c.sent_count} sent</span>}
                </div>
                {c.status !== 'sent' && (
                  <button onClick={() => handleSend(c.id)} disabled={sending === c.id}
                    className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50">
                    <Send className="h-3.5 w-3.5" />{sending === c.id ? 'Sending...' : 'Send Now'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-800">New Campaign</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Campaign Name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Festival Sale Offer" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Target Audience</label>
                <select value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500">
                  <option value="all_customers">All Customers</option>
                  <option value="outstanding_customers">Customers with Outstanding</option>
                  <option value="inactive_customers">Inactive Customers (90+ days)</option>
                  <option value="top_customers">Top 50 Customers</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Message *</label>
                <textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} rows={5} placeholder="Type your WhatsApp message here..." className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" />
                <p className="text-xs text-slate-400 mt-1">{form.message.length} characters</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Schedule (optional)</label>
                <input type="datetime-local" value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-slate-700 px-4 py-2 rounded-lg text-sm">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">{saving ? 'Creating...' : 'Create Campaign'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
