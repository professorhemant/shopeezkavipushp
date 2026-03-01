import { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Plus, Search, Download, Edit2, XCircle, FileText,
  ChevronLeft, ChevronRight
} from 'lucide-react'
import toast from 'react-hot-toast'
import { purchaseAPI } from '../../api'
import { formatCurrency, formatDate, getPaymentStatusColor } from '../../utils/formatters'
import LoadingSpinner from '../../components/common/LoadingSpinner'

export default function Purchases() {
  const navigate = useNavigate()
  const [purchases, setPurchases] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [summary, setSummary] = useState({ count: 0, total: 0, paid: 0, balance: 0 })

  const fetchPurchases = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await purchaseAPI.getAll({
        search, start_date: startDate, end_date: endDate,
        payment_status: statusFilter, page, limit: 20,
      })
      const items = data.data || data.purchases || data.results || []
      setPurchases(items)
      setTotalPages(data.pagination?.pages || data.total_pages || 1)
      setSummary({
        count: data.pagination?.total || data.count || items.length,
        total: data.total_amount || items.reduce((s, i) => s + parseFloat(i.total_amount || 0), 0),
        paid: data.total_paid || items.reduce((s, i) => s + parseFloat(i.paid_amount || 0), 0),
        balance: data.total_balance || items.reduce((s, i) => s + parseFloat(i.balance_amount || 0), 0),
      })
    } catch {
      toast.error('Failed to load purchases')
    } finally {
      setLoading(false)
    }
  }, [search, startDate, endDate, statusFilter, page])

  useEffect(() => { fetchPurchases() }, [fetchPurchases])

  const handleCancel = async (id) => {
    if (!window.confirm('Cancel this purchase?')) return
    try {
      await purchaseAPI.cancel(id)
      toast.success('Purchase cancelled')
      fetchPurchases()
    } catch {
      toast.error('Failed to cancel purchase')
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Purchase Bills</h1>
          <p className="text-sm text-gray-500 mt-0.5">{summary.count} purchase bills</p>
        </div>
        <Link to="/purchases/create" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
          <Plus className="h-4 w-4" /> New Purchase
        </Link>
      </div>

      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input type="text" placeholder="Search bill no, supplier..." value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(1) }}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(1) }}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All Status</option>
            <option value="paid">Paid</option>
            <option value="partial">Partial</option>
            <option value="unpaid">Unpaid</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16"><LoadingSpinner size="lg" /></div>
        ) : purchases.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <FileText className="h-12 w-12 mb-3 text-gray-300" />
            <p className="text-base font-medium text-gray-500">No purchase bills found</p>
            <Link to="/purchases/create" className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">Create First Purchase</Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Bill No</th>
                  <th className="px-4 py-3 text-left">Bill Date</th>
                  <th className="px-4 py-3 text-left">Supplier</th>
                  <th className="px-4 py-3 text-right">Items</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Paid</th>
                  <th className="px-4 py-3 text-right">Balance</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {purchases.map((p) => (
                  <tr key={p.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-blue-600">{p.bill_no || p.purchase_no}</td>
                    <td className="px-4 py-3 text-gray-600">{formatDate(p.bill_date || p.date)}</td>
                    <td className="px-4 py-3 text-gray-900">{p.supplier_name || p.supplier?.name || '-'}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{p.items_count ?? '-'}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">{formatCurrency(p.total_amount)}</td>
                    <td className="px-4 py-3 text-right text-green-700 font-medium">{formatCurrency(p.paid_amount)}</td>
                    <td className="px-4 py-3 text-right text-red-600 font-medium">{formatCurrency(p.balance_amount)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${getPaymentStatusColor(p.payment_status || p.status)}`}>
                        {p.payment_status || p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1.5">
                        <button onClick={() => navigate(`/purchases/${p.id}/edit`)}
                          className="p-1.5 rounded-lg hover:bg-violet-50 text-gray-400 hover:text-violet-600"><Edit2 className="h-4 w-4" /></button>
                        {p.status !== 'cancelled' && (
                          <button onClick={() => handleCancel(p.id)}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600"><XCircle className="h-4 w-4" /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && purchases.length > 0 && (
          <div className="border-t border-gray-100 px-4 py-3 bg-gray-50">
            <div className="flex flex-wrap gap-6 text-sm">
              <div><span className="text-gray-500">Total Bills:</span> <span className="font-semibold text-gray-900">{summary.count}</span></div>
              <div><span className="text-gray-500">Total Amount:</span> <span className="font-semibold text-gray-900">{formatCurrency(summary.total)}</span></div>
              <div><span className="text-gray-500">Paid:</span> <span className="font-semibold text-green-700">{formatCurrency(summary.paid)}</span></div>
              <div><span className="text-gray-500">Balance:</span> <span className="font-semibold text-red-600">{formatCurrency(summary.balance)}</span></div>
            </div>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-sm text-gray-500">Page {page} of {totalPages}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50"><ChevronLeft className="h-4 w-4" /></button>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
