import { useEffect, useState, useCallback } from 'react'
import { Plus, Building2, Trash2, Edit2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { accountingAPI } from '../../api'
import { formatCurrency, formatDate } from '../../utils/formatters'
import LoadingSpinner from '../../components/common/LoadingSpinner'

const EMPTY_FORM = { name: '', purchase_date: new Date().toISOString().split('T')[0], purchase_cost: '', accumulated_depreciation: '', useful_life_years: '', depreciation_method: 'straight_line', category: '' }
const CATEGORIES = ['Land & Building', 'Machinery', 'Vehicles', 'Furniture', 'Computer & Electronics', 'Other']

export default function FixedAssets() {
  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [depManual, setDepManual] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState(null)

  const calcDepreciation = useCallback((cost, date, lifeYears, method) => {
    const c = parseFloat(cost)
    const y = parseFloat(lifeYears)
    if (!c || !y || !date) return ''
    const purchaseDate = new Date(date)
    const today = new Date()
    const elapsedYears = Math.max(0, (today - purchaseDate) / (365.25 * 24 * 60 * 60 * 1000))
    let dep = 0
    if (method === 'wdv') {
      const rate = 1 - Math.pow(0, 1 / y) // simplified: rate = 1/y for display
      dep = c * (1 - Math.pow(Math.max(0, 1 - 1 / y), elapsedYears))
    } else {
      dep = (c / y) * elapsedYears
    }
    return Math.min(c, Math.max(0, dep)).toFixed(2)
  }, [])

  const fetchAssets = () => {
    setLoading(true)
    accountingAPI.getFixedAssets()
      .then(({ data }) => setAssets(data.data || data.assets || []))
      .catch(() => toast.error('Failed to load assets'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchAssets() }, [])

  const updateForm = (patch) => {
    setForm((prev) => {
      const next = { ...prev, ...patch }
      if (!depManual) {
        const auto = calcDepreciation(next.purchase_cost, next.purchase_date, next.useful_life_years, next.depreciation_method)
        if (auto !== '') next.accumulated_depreciation = auto
      }
      return next
    })
  }

  const openAdd = () => { setEditing(null); setDepManual(false); setForm(EMPTY_FORM); setShowModal(true) }
  const openEdit = (a) => {
    setEditing(a.id)
    setDepManual(false)
    const purchaseDate = a.purchase_date?.split('T')[0] || ''
    const purchaseCost = a.purchase_cost || ''
    const usefulLife = a.useful_life_years || ''
    const method = a.depreciation_method || 'straight_line'
    const autoDep = calcDepreciation(purchaseCost, purchaseDate, usefulLife, method)
    setForm({ name: a.name, purchase_date: purchaseDate, purchase_cost: purchaseCost, accumulated_depreciation: autoDep !== '' ? autoDep : (a.accumulated_depreciation || ''), useful_life_years: usefulLife, depreciation_method: method, category: a.category || '' })
    setShowModal(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.name || !form.purchase_cost) return toast.error('Name and cost are required')
    setSaving(true)
    try {
      if (editing) {
        await accountingAPI.updateFixedAsset(editing, form)
        toast.success('Asset updated')
      } else {
        await accountingAPI.createFixedAsset(form)
        toast.success('Fixed asset added')
      }
      setShowModal(false)
      fetchAssets()
    } catch {
      toast.error('Failed to save asset')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    try {
      await accountingAPI.deleteFixedAsset(id)
      toast.success('Asset deleted')
      setDeleteId(null)
      fetchAssets()
    } catch {
      toast.error('Failed to delete asset')
    }
  }

  const totalCost = assets.reduce((s, a) => s + parseFloat(a.purchase_cost || 0), 0)
  const totalDepreciation = assets.reduce((s, a) => s + parseFloat(a.accumulated_depreciation || 0), 0)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Fixed Assets</h1>
          <p className="text-sm text-slate-500 mt-0.5">{assets.length} assets registered</p>
        </div>
        <button onClick={openAdd} className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
          <Plus className="h-4 w-4" /> Add Asset
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Cost', value: formatCurrency(totalCost), color: 'text-amber-600' },
          { label: 'Accumulated Depreciation', value: formatCurrency(totalDepreciation), color: 'text-orange-600' },
          { label: 'Net Book Value', value: formatCurrency(totalCost - totalDepreciation), color: 'text-green-600' },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
            <p className="text-xs text-slate-500">{s.label}</p>
            <p className={`text-xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16"><LoadingSpinner size="lg" /></div>
        ) : assets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Building2 className="h-12 w-12 mb-3 text-slate-300" />
            <p className="text-base font-medium text-slate-500">No fixed assets registered</p>
            <button onClick={openAdd} className="mt-4 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium">Add First Asset</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Actions</th>
                  <th className="px-4 py-3 text-left">Asset Name</th>
                  <th className="px-4 py-3 text-left">Category</th>
                  <th className="px-4 py-3 text-left">Purchase Date</th>
                  <th className="px-4 py-3 text-right">Cost</th>
                  <th className="px-4 py-3 text-right">Depreciation</th>
                  <th className="px-4 py-3 text-right">Net Value</th>
                </tr>
              </thead>
              <tbody>
                {assets.map((a) => {
                  const netValue = parseFloat(a.purchase_cost || 0) - parseFloat(a.accumulated_depreciation || 0)
                  return (
                    <tr key={a.id} className="border-b hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => openEdit(a)} className="p-1.5 rounded-lg hover:bg-amber-50 text-gray-400 hover:text-amber-600"><Edit2 className="h-4 w-4" /></button>
                          <button onClick={() => setDeleteId(a.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800">{a.name}</td>
                      <td className="px-4 py-3 text-slate-600">{a.category || '-'}</td>
                      <td className="px-4 py-3 text-slate-600">{formatDate(a.purchase_date)}</td>
                      <td className="px-4 py-3 text-right text-slate-800">{formatCurrency(a.purchase_cost)}</td>
                      <td className="px-4 py-3 text-right text-orange-600">{formatCurrency(a.accumulated_depreciation || 0)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-green-700">{formatCurrency(netValue)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-800">{editing ? 'Edit Fixed Asset' : 'Add Fixed Asset'}</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">Asset Name *</label>
                  <input value={form.name} onChange={(e) => updateForm({ name: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Category</label>
                  <select value={form.category} onChange={(e) => updateForm({ category: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500">
                    <option value="">Select...</option>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Purchase Date</label>
                  <input type="date" value={form.purchase_date} onChange={(e) => updateForm({ purchase_date: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Purchase Cost (₹) *</label>
                  <input type="number" step="0.01" value={form.purchase_cost} onChange={(e) => updateForm({ purchase_cost: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Useful Life (Years)</label>
                  <input type="number" value={form.useful_life_years} onChange={(e) => updateForm({ useful_life_years: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Depreciation Method</label>
                  <select value={form.depreciation_method} onChange={(e) => updateForm({ depreciation_method: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500">
                    <option value="straight_line">Straight Line</option>
                    <option value="wdv">Written Down Value</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Accumulated Depreciation (₹)
                    <span className="ml-2 text-amber-600 font-normal">{depManual ? '(manual)' : '(auto-calculated)'}</span>
                  </label>
                  <input type="number" step="0.01" value={form.accumulated_depreciation}
                    onChange={(e) => { setDepManual(true); setForm((p) => ({ ...p, accumulated_depreciation: e.target.value })) }}
                    placeholder="Auto-calculated from purchase date & useful life"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 bg-amber-50/40" />
                  {depManual && <button type="button" onClick={() => { setDepManual(false); updateForm({}) }} className="text-xs text-amber-600 hover:underline mt-1">Reset to auto-calculate</button>}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-slate-700 px-4 py-2 rounded-lg text-sm">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">{saving ? 'Saving...' : editing ? 'Update' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {deleteId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 shadow-xl w-full max-w-sm mx-4">
            <h3 className="font-semibold text-slate-800 mb-1">Delete Asset</h3>
            <p className="text-sm text-slate-500 mb-5">This will permanently delete this fixed asset record.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-slate-700 px-4 py-2 rounded-lg text-sm">Cancel</button>
              <button onClick={() => handleDelete(deleteId)} className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium">Delete</button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
