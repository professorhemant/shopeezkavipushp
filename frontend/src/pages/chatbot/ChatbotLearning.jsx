import { useState, useEffect } from 'react'
import { GraduationCap, Plus, Trash2, Save, Bot } from 'lucide-react'
import api from '../../api'

export default function ChatbotLearning() {
  const [rules, setRules] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [newKeyword, setNewKeyword] = useState('')
  const [newReply, setNewReply] = useState('')
  const [toast, setToast] = useState(null)

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => {
    fetchRules()
  }, [])

  const fetchRules = async () => {
    try {
      const res = await api.get('/chatbot/rules')
      if (res.data?.success) setRules(res.data.rules || [])
    } catch {
      // If endpoint doesn't exist yet, start with empty rules
      setRules([])
    } finally {
      setLoading(false)
    }
  }

  const addRule = () => {
    if (!newKeyword.trim() || !newReply.trim()) return
    setRules(prev => [...prev, { id: Date.now(), keyword: newKeyword.trim(), reply: newReply.trim() }])
    setNewKeyword('')
    setNewReply('')
  }

  const removeRule = (id) => {
    setRules(prev => prev.filter(r => r.id !== id))
  }

  const saveRules = async () => {
    setSaving(true)
    try {
      await api.post('/chatbot/rules', { rules })
      showToast('Chatbot rules saved successfully!')
    } catch {
      showToast('Failed to save rules. Backend endpoint not set up yet.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg text-white text-sm shadow-lg ${toast.type === 'error' ? 'bg-red-500' : 'bg-green-500'}`}>
          {toast.msg}
        </div>
      )}

      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
          <GraduationCap className="h-5 w-5 text-purple-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-100">Chatbot Learning</h1>
          <p className="text-sm text-slate-400">Train the Instagram DM bot — set keywords and auto-replies</p>
        </div>
      </div>

      {/* Info banner */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 mb-6 flex gap-3">
        <Bot className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-300">
          <p className="font-medium mb-1">How it works</p>
          <p className="text-blue-400">When someone sends a DM on Instagram, the bot checks if their message contains a keyword below. If matched, it replies automatically with the configured reply message.</p>
        </div>
      </div>

      {/* Add new rule */}
      <div className="bg-slate-800 rounded-xl p-5 mb-6 border border-slate-700">
        <h2 className="text-sm font-semibold text-slate-300 mb-4">Add New Rule</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Keyword (what customer sends)</label>
            <input
              value={newKeyword}
              onChange={e => setNewKeyword(e.target.value)}
              placeholder="e.g. price, bridal set, necklace"
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Auto-Reply Message</label>
            <input
              value={newReply}
              onChange={e => setNewReply(e.target.value)}
              placeholder="e.g. Hi! Please share your number for price details."
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>
        <button
          onClick={addRule}
          disabled={!newKeyword.trim() || !newReply.trim()}
          className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Rule
        </button>
      </div>

      {/* Rules list */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden mb-6">
        <div className="px-5 py-3 border-b border-slate-700 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-300">Active Rules ({rules.length})</h2>
        </div>
        {loading ? (
          <div className="p-8 text-center text-slate-500 text-sm">Loading...</div>
        ) : rules.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">No rules yet. Add your first keyword-reply rule above.</div>
        ) : (
          <div className="divide-y divide-slate-700">
            {rules.map((rule, idx) => (
              <div key={rule.id || idx} className="flex items-start gap-4 px-5 py-4">
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Keyword</p>
                    <span className="inline-block bg-amber-500/15 text-amber-400 text-xs font-medium px-2.5 py-1 rounded-full">
                      {rule.keyword}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Auto-Reply</p>
                    <p className="text-sm text-slate-300">{rule.reply}</p>
                  </div>
                </div>
                <button
                  onClick={() => removeRule(rule.id || idx)}
                  className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Save button */}
      <div className="flex justify-end">
        <button
          onClick={saveRules}
          disabled={saving || rules.length === 0}
          className="flex items-center gap-2 px-6 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Save className="h-4 w-4" />
          {saving ? 'Saving...' : 'Save Rules'}
        </button>
      </div>
    </div>
  )
}
