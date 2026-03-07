import { useEffect, useState } from 'react'
import { AlertTriangle, Clock, RefreshCw, ShoppingCart, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { inventoryAPI } from '../../api'
import { formatDate } from '../../utils/formatters'
import LoadingSpinner from '../../components/common/LoadingSpinner'

const TABS = ['Low Stock', 'Expiry Alerts']

function getExpiryUrgency(expiryDate) {
  if (!expiryDate) return { color: 'text-gray-500', bg: 'bg-gray-100', label: 'Unknown' }
  const days = Math.ceil((new Date(expiryDate) - new Date()) / (1000 * 60 * 60 * 24))
  if (days < 0) return { color: 'text-red-700', bg: 'bg-red-100', label: 'Expired' }
  if (days <= 7) return { color: 'text-red-600', bg: 'bg-red-100', label: `${days}d left` }
  if (days <= 30) return { color: 'text-orange-600', bg: 'bg-orange-100', label: `${days}d left` }
  return { color: 'text-yellow-600', bg: 'bg-yellow-100', label: `${days}d left` }
}

export default function StockAlerts() {
  const [activeTab, setActiveTab] = useState('Low Stock')
  const [lowStock, setLowStock] = useState([])
  const [expiryAlerts, setExpiryAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [resetting, setResetting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const fetchAlerts = async () => {
    setLoading(true)
    try {
      const [lowRes, expiryRes] = await Promise.all([
        inventoryAPI.getLowStockAlerts(),
        inventoryAPI.getExpiryAlerts(30),
      ])
      setLowStock(lowRes.data.alerts || lowRes.data || [])
      setExpiryAlerts(expiryRes.data.alerts || expiryRes.data || [])
    } catch {
      toast.error('Failed to load alerts')
    } finally {
      setLoading(false)
    }
  }

  const handleResetAll = async () => {
    setResetting(true)
    try {
      const res = await inventoryAPI.resetAllInventory()
      toast.success(`Inventory reset: ${res.data.data.products_updated} products cleared`)
      setShowConfirm(false)
      fetchAlerts()
    } catch {
      toast.error('Failed to reset inventory')
    } finally {
      setResetting(false)
    }
  }

  useEffect(() => { fetchAlerts() }, [])

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Stock Alerts</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {lowStock.length} low stock · {expiryAlerts.length} expiry alerts
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchAlerts} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm flex items-center gap-2">
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
          <button onClick={() => setShowConfirm(true)} className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-4 py-2 rounded-lg text-sm flex items-center gap-2">
            <Trash2 className="h-4 w-4" /> Reset All Inventory
          </button>
        </div>

        {showConfirm && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                </div>
                <h3 className="text-lg font-semibold text-slate-800">Reset All Inventory?</h3>
              </div>
              <p className="text-sm text-slate-500 mb-5">
                This will set stock to <strong>0</strong> for all products and delete all inventory batches. This cannot be undone.
              </p>
              <div className="flex gap-3 justify-end">
                <button onClick={() => setShowConfirm(false)} className="px-4 py-2 text-sm rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700">
                  Cancel
                </button>
                <button onClick={handleResetAll} disabled={resetting} className="px-4 py-2 text-sm rounded-lg bg-red-600 hover:bg-red-700 text-white disabled:opacity-60 flex items-center gap-2">
                  {resetting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  {resetting ? 'Resetting...' : 'Yes, Reset All'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-amber-700">{lowStock.length}</p>
            <p className="text-sm text-amber-600">Low Stock Items</p>
          </div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
            <Clock className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-red-700">{expiryAlerts.length}</p>
            <p className="text-sm text-red-600">Expiry Alerts (30 days)</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <div className="flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-amber-600 text-amber-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab}
              <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${activeTab === tab ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
                {tab === 'Low Stock' ? lowStock.length : expiryAlerts.length}
              </span>
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><LoadingSpinner size="lg" /></div>
      ) : activeTab === 'Low Stock' ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          {lowStock.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <AlertTriangle className="h-10 w-10 mb-3 text-gray-300" />
              <p className="font-medium text-slate-500">No low stock alerts</p>
              <p className="text-sm mt-1">All products have sufficient stock.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Product</th>
                  <th className="px-4 py-3 text-left">Category</th>
                  <th className="px-4 py-3 text-right">Current Stock</th>
                  <th className="px-4 py-3 text-right">Min Stock</th>
                  <th className="px-4 py-3 text-right">Shortage</th>
                  <th className="px-4 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {lowStock.map((item) => {
                  const shortage = (item.min_stock || 0) - (item.current_stock || 0)
                  return (
                    <tr key={item.id} className="border-b hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800">{item.name || item.product_name}</p>
                        <p className="text-xs text-gray-400">{item.sku || ''}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{item.category_name || item.category || '-'}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-bold text-red-600">{item.current_stock ?? 0}</span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">{item.min_stock ?? 0}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
                          -{Math.max(0, shortage)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button className="text-xs bg-amber-50 hover:bg-amber-100 text-amber-700 px-3 py-1.5 rounded-lg flex items-center gap-1 mx-auto">
                          <ShoppingCart className="h-3 w-3" /> Reorder
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          {expiryAlerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <Clock className="h-10 w-10 mb-3 text-gray-300" />
              <p className="font-medium text-slate-500">No expiry alerts</p>
              <p className="text-sm mt-1">No items expiring in the next 30 days.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Product</th>
                  <th className="px-4 py-3 text-left">Batch No.</th>
                  <th className="px-4 py-3 text-left">Expiry Date</th>
                  <th className="px-4 py-3 text-right">Quantity</th>
                  <th className="px-4 py-3 text-center">Urgency</th>
                </tr>
              </thead>
              <tbody>
                {expiryAlerts.map((item, i) => {
                  const urgency = getExpiryUrgency(item.expiry_date)
                  return (
                    <tr key={i} className="border-b hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-800">{item.product_name || item.name}</td>
                      <td className="px-4 py-3 text-gray-600 font-mono text-xs">{item.batch_no || '-'}</td>
                      <td className="px-4 py-3 text-gray-600">{formatDate(item.expiry_date)}</td>
                      <td className="px-4 py-3 text-right font-medium text-slate-800">{item.quantity ?? 0}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${urgency.bg} ${urgency.color}`}>
                          {urgency.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
