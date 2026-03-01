import { useEffect, useState } from 'react'
import { BarChart2, TrendingUp, Users, Package } from 'lucide-react'
import toast from 'react-hot-toast'
import { reportAPI } from '../../api'
import { formatCurrency } from '../../utils/formatters'
import LoadingSpinner from '../../components/common/LoadingSpinner'

const today = new Date()
const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
const todayStr = today.toISOString().split('T')[0]

export default function Analytics() {
  const [topProducts, setTopProducts] = useState([])
  const [topCustomers, setTopCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState(firstOfMonth)
  const [endDate, setEndDate] = useState(todayStr)

  const fetchData = async () => {
    setLoading(true)
    try {
      const [{ data: prod }, { data: cust }] = await Promise.all([
        reportAPI.getTopProducts({ start_date: startDate, end_date: endDate, limit: 10 }),
        reportAPI.getTopCustomers({ start_date: startDate, end_date: endDate, limit: 10 }),
      ])
      setTopProducts(prod.products || prod || [])
      setTopCustomers(cust.customers || cust || [])
    } catch {
      toast.error('Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [startDate, endDate])

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-sm text-gray-500 mt-0.5">Top performers and business insights</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <span className="text-gray-400 text-sm">to</span>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-32"><LoadingSpinner size="lg" /></div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {/* Top Products */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
              <Package className="h-4 w-4 text-blue-600" />
              <h2 className="text-base font-semibold text-gray-900">Top Products</h2>
            </div>
            {topProducts.length === 0 ? (
              <div className="flex items-center justify-center py-16 text-gray-400"><p className="text-sm">No data available</p></div>
            ) : (
              <div className="divide-y divide-gray-50">
                {topProducts.map((p, i) => {
                  const max = topProducts[0]?.total_quantity || topProducts[0]?.qty || 1
                  const value = p.total_quantity || p.qty || 0
                  return (
                    <div key={p.id || i} className="px-4 py-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-medium text-gray-900 truncate max-w-[60%]">{p.name || p.product_name}</span>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-gray-900">{formatCurrency(p.total_sales || p.revenue || 0)}</p>
                          <p className="text-xs text-gray-400">{value} units</p>
                        </div>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(value / max) * 100}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Top Customers */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
              <Users className="h-4 w-4 text-green-600" />
              <h2 className="text-base font-semibold text-gray-900">Top Customers</h2>
            </div>
            {topCustomers.length === 0 ? (
              <div className="flex items-center justify-center py-16 text-gray-400"><p className="text-sm">No data available</p></div>
            ) : (
              <div className="divide-y divide-gray-50">
                {topCustomers.map((c, i) => {
                  const max = topCustomers[0]?.total_sales || topCustomers[0]?.revenue || 1
                  const value = c.total_sales || c.revenue || 0
                  return (
                    <div key={c.id || i} className="px-4 py-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-medium text-gray-900 truncate max-w-[60%]">{c.name || c.customer_name}</span>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-gray-900">{formatCurrency(value)}</p>
                          <p className="text-xs text-gray-400">{c.invoice_count || c.orders || 0} orders</p>
                        </div>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-green-500 rounded-full" style={{ width: `${(value / max) * 100}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
