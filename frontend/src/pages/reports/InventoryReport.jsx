import { useEffect, useState } from 'react'
import { Download, Package, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import { reportAPI } from '../../api'
import { formatCurrency } from '../../utils/formatters'
import LoadingSpinner from '../../components/common/LoadingSpinner'

export default function InventoryReport() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [summary, setSummary] = useState({ total_items: 0, total_value: 0, low_stock: 0 })

  const fetchReport = async () => {
    setLoading(true)
    try {
      const { data: d } = await reportAPI.getInventory({ filter })
      const items = d.inventory || d.data || d || []
      setData(items)
      setSummary({
        total_items: d.total_items || items.length,
        total_value: d.total_value || items.reduce((s, i) => s + parseFloat(i.stock_value || 0), 0),
        low_stock: d.low_stock_count || items.filter((i) => i.is_low_stock).length,
      })
    } catch {
      toast.error('Failed to load inventory report')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchReport() }, [filter])

  const filtered = data.filter((item) => !search || item.name?.toLowerCase().includes(search.toLowerCase()) || item.sku?.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Inventory Report</h1>
          <p className="text-sm text-slate-500 mt-0.5">Current stock status and valuation</p>
        </div>
        <button className="bg-gray-100 hover:bg-gray-200 text-slate-700 px-4 py-2 rounded-lg text-sm flex items-center gap-2">
          <Download className="h-4 w-4" /> Export
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Products', value: summary.total_items, color: 'text-slate-800' },
          { label: 'Inventory Value', value: formatCurrency(summary.total_value), color: 'text-amber-600' },
          { label: 'Low Stock Items', value: summary.low_stock, color: 'text-red-600' },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
            <p className="text-xs text-slate-500">{s.label}</p>
            <p className={`text-xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input type="text" placeholder="Search product, SKU..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" />
          </div>
          <select value={filter} onChange={(e) => setFilter(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500">
            <option value="all">All Items</option>
            <option value="low_stock">Low Stock</option>
            <option value="out_of_stock">Out of Stock</option>
            <option value="active">Active Only</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16"><LoadingSpinner size="lg" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Package className="h-12 w-12 mb-3 text-slate-300" />
            <p className="text-base font-medium text-slate-500">No inventory data found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Product</th>
                  <th className="px-4 py-3 text-left">SKU</th>
                  <th className="px-4 py-3 text-left">Category</th>
                  <th className="px-4 py-3 text-right">Stock Qty</th>
                  <th className="px-4 py-3 text-right">Min Stock</th>
                  <th className="px-4 py-3 text-right">Unit Cost</th>
                  <th className="px-4 py-3 text-right">Stock Value</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id} className="border-b hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{item.name}</td>
                    <td className="px-4 py-3 text-slate-500 font-mono text-xs">{item.sku || '-'}</td>
                    <td className="px-4 py-3 text-slate-600">{item.category_name || '-'}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-semibold ${item.is_low_stock || item.current_stock < (item.min_stock || 0) ? 'text-red-600' : 'text-slate-800'}`}>
                        {item.current_stock ?? item.stock_qty ?? 0}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600">{item.min_stock || 0}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(item.purchase_price || item.unit_cost)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800">{formatCurrency(item.stock_value || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
