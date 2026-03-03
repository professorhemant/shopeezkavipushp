import { useEffect, useState } from 'react'
import { Plus, Edit2, Building2, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { settingsAPI } from '../../api'

const EMPTY_FORM = {
  name: '', legal_name: '', gstin: '', pan: '', phone: '', email: '', address: '',
  city: '', state: '', pincode: '', country: 'India',
  bank_name: '', account_no: '', ifsc: '', branch: ''
}

export default function Firms() {
  const [firms, setFirms] = useState([])
  const [activeFirmId, setActiveFirmId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    settingsAPI.getFirm()
      .then(({ data }) => {
        const f = data.firm || data
        if (f) {
          setFirms([f])
          setActiveFirmId(f.id)
        }
      })
      .catch(() => toast.error('Failed to load firm'))
      .finally(() => setLoading(false))
  }, [])

  const openAdd = () => { setEditing(null); setForm(EMPTY_FORM); setShowModal(true) }
  const openEdit = (f) => {
    setEditing(f.id)
    setForm({
      name: f.name || '', legal_name: f.legal_name || '', gstin: f.gstin || '', pan: f.pan || '',
      phone: f.phone || '', email: f.email || '', address: f.address || '', city: f.city || '',
      state: f.state || '', pincode: f.pincode || '', country: f.country || 'India',
      bank_name: f.bank_name || '', account_no: f.account_no || '', ifsc: f.ifsc || '', branch: f.branch || ''
    })
    setShowModal(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return toast.error('Business name is required')
    setSaving(true)
    try {
      await settingsAPI.updateFirm(form)
      toast.success('Firm saved')
      setShowModal(false)
      settingsAPI.getFirm().then(({ data }) => {
        const f = data.firm || data
        if (f) { setFirms([f]); setActiveFirmId(f.id) }
      })
    } catch {
      toast.error('Failed to save firm')
    } finally {
      setSaving(false)
    }
  }

  const Field = ({ label, field, type = 'text', mono = false, colSpan = 1 }) => (
    <div className={colSpan === 2 ? 'col-span-2' : ''}>
      <label className="block text-xs font-medium text-slate-700 mb-1">{label}</label>
      <input type={type} value={form[field]} onChange={(e) => setForm({ ...form, [field]: e.target.value })}
        className={`w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 ${mono ? 'font-mono' : ''}`} />
    </div>
  )

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Firms / Businesses</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage your business profiles</p>
        </div>
        <button onClick={openAdd} className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
          <Plus className="h-4 w-4" /> Add Firm
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><div className="animate-spin w-6 h-6 border-2 border-amber-600 border-t-transparent rounded-full" /></div>
      ) : firms.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 flex flex-col items-center justify-center py-20 text-slate-400">
          <Building2 className="h-12 w-12 mb-3 text-slate-300" />
          <p className="text-base font-medium text-slate-500">No firms configured</p>
          <p className="text-sm mt-1">Add your business details to get started</p>
          <button onClick={openAdd} className="mt-4 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium">Add Your Business</button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {firms.map((firm) => (
            <div key={firm.id} className={`bg-white rounded-xl shadow-sm border-2 p-6 relative ${firm.id === activeFirmId ? 'border-amber-500' : 'border-slate-100'}`}>
              {firm.id === activeFirmId && (
                <div className="absolute top-3 right-3 flex items-center gap-1 text-xs text-green-600 font-medium">
                  <CheckCircle className="h-4 w-4" /> Active
                </div>
              )}
              <div className="flex items-start gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
                  <Building2 className="h-6 w-6 text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-slate-800 text-lg">{firm.name}</h3>
                  {firm.legal_name && firm.legal_name !== firm.name && <p className="text-sm text-slate-500">{firm.legal_name}</p>}
                </div>
              </div>
              <div className="space-y-1.5 text-sm">
                {firm.gstin && <div className="flex gap-2"><span className="text-slate-400 w-16 flex-shrink-0">GSTIN:</span><span className="font-mono text-slate-700">{firm.gstin}</span></div>}
                {firm.phone && <div className="flex gap-2"><span className="text-slate-400 w-16 flex-shrink-0">Phone:</span><span className="text-slate-700">{firm.phone}</span></div>}
                {firm.email && <div className="flex gap-2"><span className="text-slate-400 w-16 flex-shrink-0">Email:</span><span className="text-slate-700">{firm.email}</span></div>}
                {firm.address && <div className="flex gap-2"><span className="text-slate-400 w-16 flex-shrink-0">Address:</span><span className="text-slate-700">{[firm.address, firm.city, firm.state, firm.pincode].filter(Boolean).join(', ')}</span></div>}
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={() => openEdit(firm)} className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-slate-700 px-3 py-1.5 rounded-lg text-sm">
                  <Edit2 className="h-3.5 w-3.5" /> Edit
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl my-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-800">{editing ? 'Edit Firm' : 'Add Firm'}</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Business Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Business Name *" field="name" colSpan={2} />
                  <Field label="Legal Name" field="legal_name" colSpan={2} />
                  <Field label="GSTIN" field="gstin" mono />
                  <Field label="PAN" field="pan" mono />
                  <Field label="Phone" field="phone" />
                  <Field label="Email" field="email" type="email" />
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Address</h3>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Address" field="address" colSpan={2} />
                  <Field label="City" field="city" />
                  <Field label="State" field="state" />
                  <Field label="Pincode" field="pincode" />
                  <Field label="Country" field="country" />
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Bank Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Bank Name" field="bank_name" colSpan={2} />
                  <Field label="Account Number" field="account_no" mono />
                  <Field label="IFSC Code" field="ifsc" mono />
                  <Field label="Branch" field="branch" colSpan={2} />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-slate-700 px-4 py-2 rounded-lg text-sm">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">{saving ? 'Saving...' : 'Save Firm'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
