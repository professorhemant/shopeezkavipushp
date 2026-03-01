import { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Plus, Search, Download, Printer, Edit2, XCircle, Trash2,
  FileText, ChevronLeft, ChevronRight, Filter, Eye
} from 'lucide-react'
import toast from 'react-hot-toast'
import { saleAPI } from '../../api'
import { formatCurrency, formatDate, getPaymentStatusColor } from '../../utils/formatters'
import LoadingSpinner from '../../components/common/LoadingSpinner'

const STATUS_OPTIONS = ['', 'paid', 'partial', 'unpaid', 'cancelled']

export default function Invoices() {
  const navigate = useNavigate()
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [summary, setSummary] = useState({ count: 0, total: 0, received: 0, balance: 0 })

  const fetchInvoices = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await saleAPI.getAll({
        search, from_date: startDate, to_date: endDate,
        status: statusFilter, page, limit: 20,
      })
      const items = data.data || data.sales || data.results || []
      setInvoices(items)
      setTotalPages(data.pagination?.pages || data.total_pages || 1)
      const active = items.filter((i) => i.status !== 'cancelled')
      setSummary({
        count: data.pagination?.total || data.count || items.length,
        total:    active.reduce((s, i) => s + parseFloat(i.total        || 0), 0),
        received: active.reduce((s, i) => s + parseFloat(i.paid_amount  || 0), 0),
        balance:  active.reduce((s, i) => s + parseFloat(i.balance      || 0), 0),
      })
    } catch {
      toast.error('Failed to load invoices')
    } finally {
      setLoading(false)
    }
  }, [search, startDate, endDate, statusFilter, page])

  useEffect(() => { fetchInvoices() }, [fetchInvoices])

  const handleDownloadPDF = async (id) => {
    try {
      const { data } = await saleAPI.generatePDF(id)
      const url = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }))
      const a = document.createElement('a'); a.href = url; a.download = `invoice-${id}.pdf`; a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Failed to generate PDF')
    }
  }

  const handleCancel = async (id) => {
    if (!window.confirm('Cancel this invoice?')) return
    try {
      await saleAPI.cancel(id)
      toast.success('Invoice cancelled')
      fetchInvoices()
    } catch {
      toast.error('Failed to cancel invoice')
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Permanently delete this cancelled invoice? This cannot be undone.')) return
    try {
      await saleAPI.delete(id)
      toast.success('Invoice deleted')
      fetchInvoices()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to delete invoice')
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sales Invoices</h1>
          <p className="text-sm text-gray-500 mt-0.5">{summary.count} invoices</p>
        </div>
        <Link to="/billing/invoices/create" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
          <Plus className="h-4 w-4" /> New Invoice
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input type="text" placeholder="Search invoice no, customer..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }}
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
          {(search || startDate || endDate || statusFilter) && (
            <button onClick={() => { setSearch(''); setStartDate(''); setEndDate(''); setStatusFilter(''); setPage(1) }}
              className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2">Clear</button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16"><LoadingSpinner size="lg" /></div>
        ) : invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <FileText className="h-12 w-12 mb-3 text-gray-300" />
            <p className="text-base font-medium text-gray-500">No invoices found</p>
            <Link to="/billing/invoices/create" className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">Create First Invoice</Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Invoice No</th>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Customer</th>
                  <th className="px-4 py-3 text-right">Items</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Paid</th>
                  <th className="px-4 py-3 text-right">Balance</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => {
                  const isCancelled = inv.status === 'cancelled'
                  return (
                  <tr key={inv.id} className={`border-b ${isCancelled ? 'bg-red-50' : 'hover:bg-gray-50'}`}>
                    <td className="px-4 py-3">
                      <Link to={`/billing/invoices/${inv.id}`} className={`font-medium hover:underline ${isCancelled ? 'text-red-500 line-through' : 'text-blue-600'}`}>
                        {inv.invoice_no || inv.invoice_number}
                      </Link>
                    </td>
                    <td className={`px-4 py-3 ${isCancelled ? 'text-red-400 line-through' : 'text-gray-600'}`}>{formatDate(inv.invoice_date || inv.date)}</td>
                    <td className={`px-4 py-3 ${isCancelled ? 'text-red-500' : 'text-gray-900'}`}>{inv.customer_name || inv.customer?.name || 'Walk-in'}</td>
                    <td className={`px-4 py-3 text-right ${isCancelled ? 'text-red-400' : 'text-gray-600'}`}>{inv.items_count ?? '-'}</td>
                    <td className={`px-4 py-3 text-right font-medium ${isCancelled ? 'text-red-500 line-through' : 'text-gray-900'}`}>{formatCurrency(inv.total)}</td>
                    <td className={`px-4 py-3 text-right font-medium ${isCancelled ? 'text-red-400 line-through' : 'text-green-700'}`}>{formatCurrency(inv.paid_amount)}</td>
                    <td className={`px-4 py-3 text-right font-medium ${isCancelled ? 'text-red-400 line-through' : 'text-red-600'}`}>{formatCurrency(inv.balance)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${getPaymentStatusColor(isCancelled ? 'cancelled' : (inv.payment_status || inv.status))}`}>
                        {isCancelled ? 'cancelled' : (inv.payment_status || inv.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1.5">
                        <button onClick={() => navigate(`/billing/invoices/${inv.id}`)} className="p-1.5 rounded-lg hover:bg-indigo-50 text-gray-400 hover:text-indigo-600" title="View Invoice">
                          <Eye className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleDownloadPDF(inv.id)} className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600" title="Print PDF">
                          <Printer className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleDownloadPDF(inv.id)} className="p-1.5 rounded-lg hover:bg-green-50 text-gray-400 hover:text-green-600" title="Download">
                          <Download className="h-4 w-4" />
                        </button>
                        <button onClick={() => navigate(`/billing/invoices/${inv.id}/edit`)} className="p-1.5 rounded-lg hover:bg-violet-50 text-gray-400 hover:text-violet-600" title="Edit">
                          <Edit2 className="h-4 w-4" />
                        </button>
                        {inv.status !== 'cancelled' && (
                          <button onClick={() => handleCancel(inv.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600" title="Cancel">
                            <XCircle className="h-4 w-4" />
                          </button>
                        )}
                        {inv.status === 'cancelled' && (
                          <button onClick={() => handleDelete(inv.id)} className="p-1.5 rounded-lg hover:bg-red-100 text-red-400 hover:text-red-700" title="Delete permanently">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  )})}
              </tbody>
            </table>
          </div>
        )}

        {/* Summary */}
        {!loading && invoices.length > 0 && (
          <div className="border-t border-gray-100 px-4 py-3 bg-gray-50">
            <div className="flex flex-wrap gap-6 text-sm">
              <div><span className="text-gray-500">Total Invoices:</span> <span className="font-semibold text-gray-900">{summary.count}</span></div>
              <div><span className="text-gray-500">Total Amount:</span> <span className="font-semibold text-gray-900">{formatCurrency(summary.total)}</span></div>
              <div><span className="text-gray-500">Received:</span> <span className="font-semibold text-green-700">{formatCurrency(summary.received)}</span></div>
              <div><span className="text-gray-500">Balance:</span> <span className="font-semibold text-red-600">{formatCurrency(summary.balance)}</span></div>
            </div>
          </div>
        )}

        {/* Pagination */}
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
