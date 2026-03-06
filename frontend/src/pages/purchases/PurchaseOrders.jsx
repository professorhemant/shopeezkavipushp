import { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Search, Edit2, XCircle, Trash2, FileText, ChevronLeft, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { purchaseAPI } from '../../api'
import { formatCurrency, formatDate } from '../../utils/formatters'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import EditOtpModal from '../../components/common/EditOtpModal'

export default function PurchaseOrders() {
  const navigate = useNavigate()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [summary, setSummary] = useState({ count: 0, total: 0 })
  const [otpModal, setOtpModal] = useState({ open: false, editId: null })

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await purchaseAPI.getAll({ search, type: 'order', payment_status: statusFilter, page, limit: 20 })
      const items = data.data || data.purchases || data.results || []
      setOrders(items)
      setTotalPages(data.pagination?.pages || data.total_pages || 1)
      setSummary({ count: data.pagination?.total || data.count || items.length, total: data.total_amount || 0 })
    } catch {
      toast.error('Failed to load purchase orders')
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter, page])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  const handleCancel = async (id) => {
    if (!window.confirm('Cancel this order?')) return
    try {
      await purchaseAPI.cancel(id)
      toast.success('Order cancelled')
      fetchOrders()
    } catch {
      toast.error('Failed to cancel order')
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Permanently delete this order? This cannot be undone.')) return
    try {
      await purchaseAPI.delete(id)
      toast.success('Order deleted')
      fetchOrders()
    } catch {
      toast.error('Failed to delete order')
    }
  }

  return (
    <>
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Purchase Orders</h1>
          <p className="text-sm text-slate-500 mt-0.5">{summary.count} orders</p>
        </div>
        <Link to="/purchases/create" className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
          <Plus className="h-4 w-4" /> New Order
        </Link>
      </div>

      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input type="text" placeholder="Search order no, supplier..." value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" />
          </div>
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500">
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="received">Received</option>
            <option value="partial">Partial</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16"><LoadingSpinner size="lg" /></div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <FileText className="h-12 w-12 mb-3 text-gray-300" />
            <p className="text-base font-medium text-slate-500">No purchase orders found</p>
            <Link to="/purchases/create" className="mt-4 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium">Create First Order</Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Order No</th>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Supplier</th>
                  <th className="px-4 py-3 text-right">Products</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-b hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-amber-600">{o.bill_no || o.order_no || `PO-${o.id}`}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(o.bill_date || o.date)}</td>
                    <td className="px-4 py-3 text-slate-800">{o.supplier_name || o.supplier?.name || '-'}</td>
                    <td className="px-4 py-3 text-slate-600">{o.product_names || '-'}</td>
                    <td className="px-4 py-3 text-right font-medium text-slate-800">{formatCurrency(o.total)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        o.status === 'received' ? 'bg-green-100 text-green-800' :
                        o.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                        o.status === 'partial' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-700'
                      }`}>{o.status || 'pending'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1.5">
                        <button onClick={() => setOtpModal({ open: true, editId: o.id })}
                          className="p-1.5 rounded-lg hover:bg-amber-50 text-gray-400 hover:text-amber-600"><Edit2 className="h-4 w-4" /></button>
                        {o.status !== 'cancelled' && (
                          <button onClick={() => handleCancel(o.id)}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600"><XCircle className="h-4 w-4" /></button>
                        )}
                        <button onClick={() => handleDelete(o.id)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-700"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <p className="text-sm text-slate-500">Page {page} of {totalPages}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50"><ChevronLeft className="h-4 w-4" /></button>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
        )}
      </div>
    </div>

    {otpModal.open && (
      <EditOtpModal
        onVerified={() => { setOtpModal({ open: false, editId: null }); navigate(`/purchases/${otpModal.editId}/edit`) }}
        onClose={() => setOtpModal({ open: false, editId: null })}
      />
    )}
    </>
  )
}
