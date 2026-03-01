import { useEffect, useState } from 'react'
import { Plus, Building2, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { accountingAPI } from '../../api'
import { formatCurrency, formatDate } from '../../utils/formatters'
import LoadingSpinner from '../../components/common/LoadingSpinner'

const EMPTY_FORM = { name: '', purchase_date: new Date().toISOString().split('T')[0], purchase_cost: '', useful_life_years: '', depreciation_method: 'straight_line', category: '' }
const CATEGORIES = ['Land & Building', 'Machinery', 'Vehicles', 'Furniture', 'Computer & Electronics', 'Other']

export default function FixedAssets() {
  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const fetchAssets = () => {
    setLoading(true)
    accountingAPI.getFixedAssets()
      .then(({ data }) => setAssets(data.data || data.assets || []))
      .catch(() => toast.error('Failed to load assets'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchAssets() }, [])

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.name || !form.purchase_cost) return toast.error('Name and cost are required')
    setSaving(true)
    try {
      await accountingAPI.createFixedAsset(form)
      toast.success('Fixed asset added')
      setShowModal(false)
      fetchAssets()
    } catch {
      toast.error('Failed to add asset')
    } finally {
      setSaving(false)
    }
  }

  const totalCost = assets.reduce((s, a) => s + parseFloat(a.purchase_cost || 0), 0)
  const totalDepreciation = assets.reduce((s, a) => s + parseFloat(a.accumulated_depreciation || 0), 0)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fixed Assets</h1>
          <p className="text-sm text-gray-500 mt-0.5">{assets.length} assets registered</p>
        </div>
        <button onClick={() => { setForm(EMPTY_FORM); setShowModal(true) }} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
          <Plus className="h-4 w-4" /> Add Asset
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Cost', value: formatCurrency(totalCost), color: 'text-blue-600' },
          { label: 'Accumulated Depreciation', value: formatCurrency(totalDepreciation), color: 'text-orange-600' },
          { label: 'Net Book Value', value: formatCurrency(totalCost - totalDepreciation), color: 'text-green-600' },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className={`text-xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16"><LoadingSpinner size="lg" /></div>
        ) : assets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Building2 className="h-12 w-12 mb-3 text-gray-300" />
            <p className="text-base font-medium text-gray-500">No fixed assets registered</p>
            <button onClick={() => { setForm(EMPTY_FORM); setShowModal(true) }} className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">Add First Asset</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
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
                    <tr key={a.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{a.name}</td>
                      <td className="px-4 py-3 text-gray-600">{a.category || '-'}</td>
                      <td className="px-4 py-3 text-gray-600">{formatDate(a.purchase_date)}</td>
                      <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(a.purchase_cost)}</td>
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
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Add Fixed Asset</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Asset Name *</label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
                  <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Select...</option>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Purchase Date</label>
                  <input type="date" value={form.purchase_date} onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Purchase Cost (₹) *</label>
                  <input type="number" step="0.01" value={form.purchase_cost} onChange={(e) => setForm({ ...form, purchase_cost: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Useful Life (Years)</label>
                  <input type="number" value={form.useful_life_years} onChange={(e) => setForm({ ...form, useful_life_years: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Depreciation Method</label>
                  <select value={form.depreciation_method} onChange={(e) => setForm({ ...form, depreciation_method: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="straight_line">Straight Line</option>
                    <option value="wdv">Written Down Value</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">{saving ? 'Saving...' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
