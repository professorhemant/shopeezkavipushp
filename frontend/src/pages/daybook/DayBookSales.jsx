import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, Printer, Pencil, XCircle, Trash2, Plus, ScanBarcode, ClipboardList } from 'lucide-react'
import toast from 'react-hot-toast'
import { saleAPI } from '../../api'
import { formatCurrency } from '../../utils/formatters'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import useAuthStore from '../../store/authStore'

const today = () => new Date().toISOString().split('T')[0]

const STATUS_BADGE = {
  paid:      'bg-green-100 text-green-700',
  partial:   'bg-yellow-100 text-yellow-700',
  unpaid:    'bg-red-100 text-red-700',
  confirmed: 'bg-blue-100 text-blue-700',
  cancelled: 'bg-slate-100 text-slate-500',
  returned:  'bg-purple-100 text-purple-700',
  draft:     'bg-slate-100 text-slate-500',
}

const MODE_BADGE = {
  cash:   'bg-green-100 text-green-700',
  card:   'bg-blue-100 text-blue-700',
  upi:    'bg-violet-100 text-violet-700',
  online: 'bg-blue-100 text-blue-700',
  cheque: 'bg-orange-100 text-orange-700',
}

export default function DayBookSales() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const canViewHistory = ['admin', 'super_admin'].includes(user?.role_name)
  const [date, setDate] = useState(today())
  const [sales, setSales] = useState([])
  const [loading, setLoading] = useState(true)
  const [showInvoiceTypeModal, setShowInvoiceTypeModal] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await saleAPI.getAll({ from_date: date, to_date: date, limit: 500, include_items: true, include_payments: true })
      setSales(res.data.data || [])
    } catch { toast.error('Failed to load sales') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [date])

  const handleCancel = async (id) => {
    if (!window.confirm('Cancel this sale?')) return
    try { await saleAPI.cancel(id); toast.success('Sale cancelled'); load() }
    catch { toast.error('Failed to cancel') }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this sale?')) return
    try { await saleAPI.delete(id); toast.success('Deleted'); load() }
    catch { toast.error('Failed to delete') }
  }

  const totalAmt   = sales.reduce((a, s) => a + parseFloat(s.total || 0), 0)
  const totalPaid  = sales.reduce((a, s) => a + parseFloat(s.paid_amount || 0), 0)
  const totalBal   = sales.reduce((a, s) => a + parseFloat(s.balance || 0), 0)

  const modeSum = (mode) => sales.reduce((sum, s) => {
    const payments = s.payments || []
    if (payments.length > 0) return sum + payments.filter(p => mode.includes(p.payment_mode)).reduce((a, p) => a + parseFloat(p.amount || 0), 0)
    return mode.includes(s.payment_mode) ? sum + parseFloat(s.paid_amount || 0) : sum
  }, 0)
  const cashTotal   = modeSum(['cash'])
  const onlineTotal = modeSum(['upi', 'online'])
  const cardTotal   = modeSum(['card'])

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Day Book — Sales</h1>
          <p className="text-sm text-slate-500 mt-0.5">{sales.length} invoice{sales.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowInvoiceTypeModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors"
          >
            <Plus className="h-4 w-4" /> Add First Item
          </button>
          <input type="date" value={date} onChange={(e) => canViewHistory && setDate(e.target.value)}
            disabled={!canViewHistory}
            title={!canViewHistory ? 'Only admin Swechha can view previous dates' : ''}
            className={`border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 ${!canViewHistory ? 'border-slate-100 bg-slate-50 text-slate-400 cursor-not-allowed' : 'border-slate-200'}`} />
        </div>
      </div>

      {/* Invoice Type Choice Modal */}
      {showInvoiceTypeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-1 text-center">Create New Invoice</h2>
            <p className="text-sm text-slate-500 text-center mb-6">How would you like to create this invoice?</p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => { setShowInvoiceTypeModal(false); navigate('/billing/invoices/create') }}
                className="flex items-center gap-4 p-4 rounded-xl border-2 border-amber-300 bg-amber-50 hover:bg-amber-100 text-left transition-colors"
              >
                <div className="w-10 h-10 bg-amber-500 rounded-full flex items-center justify-center shrink-0">
                  <ScanBarcode className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-slate-800 text-sm">Create Invoice Auto</p>
                  <p className="text-xs text-slate-500 mt-0.5">Scan barcode or search products from inventory</p>
                </div>
              </button>
              <button
                onClick={() => { setShowInvoiceTypeModal(false); navigate('/billing/invoices/create-manual') }}
                className="flex items-center gap-4 p-4 rounded-xl border-2 border-slate-200 bg-slate-50 hover:bg-slate-100 text-left transition-colors"
              >
                <div className="w-10 h-10 bg-slate-600 rounded-full flex items-center justify-center shrink-0">
                  <ClipboardList className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-slate-800 text-sm">Create Invoice Manually</p>
                  <p className="text-xs text-slate-500 mt-0.5">Type item name, code, price, tax etc. manually</p>
                </div>
              </button>
              <button
                onClick={() => setShowInvoiceTypeModal(false)}
                className="mt-1 text-sm text-slate-400 hover:text-slate-600 text-center py-2"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment mode summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
          <p className="text-xs text-slate-500 mb-1">Total Amount</p>
          <p className="text-lg font-bold text-slate-800">{formatCurrency(totalAmt)}</p>
        </div>
        <div className="bg-green-50 rounded-xl p-4 border border-green-100 shadow-sm">
          <p className="text-xs text-green-600 mb-1">Cash Received</p>
          <p className="text-lg font-bold text-green-700">{formatCurrency(cashTotal)}</p>
        </div>
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-100 shadow-sm">
          <p className="text-xs text-blue-600 mb-1">Online / UPI</p>
          <p className="text-lg font-bold text-blue-700">{formatCurrency(onlineTotal)}</p>
        </div>
        <div className="bg-violet-50 rounded-xl p-4 border border-violet-100 shadow-sm">
          <p className="text-xs text-violet-600 mb-1">Card</p>
          <p className="text-lg font-bold text-violet-700">{formatCurrency(cardTotal)}</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16"><LoadingSpinner size="lg" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-800 text-xs text-slate-200 uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Invoice No</th>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Customer</th>
                  <th className="px-4 py-3 text-center">Items</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Paid</th>
                  <th className="px-4 py-3 text-right">Balance</th>
                  <th className="px-4 py-3 text-center">Mode</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sales.length === 0 ? (
                  <tr><td colSpan={10} className="text-center py-12 text-slate-400">No sales for this date</td></tr>
                ) : sales.map((s) => (
                  <tr key={s.id} className="border-b hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-amber-600">{s.invoice_no || '-'}</td>
                    <td className="px-4 py-3 text-slate-600">{fmtDate(s.invoice_date)}</td>
                    <td className="px-4 py-3 text-slate-700">{s.customer?.name || s.customer_name || 'Walk-in'}</td>
                    <td className="px-4 py-3 text-center text-slate-600 text-xs">
                      {(s.items || []).length === 0 ? '-' : (s.items || []).map((it) => it.barcode || it.product?.barcode || it.product?.sku || it.product_name || '-').join(', ')}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800">{formatCurrency(s.total)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-green-600">{formatCurrency(s.paid_amount)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-red-500">{formatCurrency(s.balance)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium capitalize ${MODE_BADGE[s.payment_mode] || 'bg-slate-100 text-slate-600'}`}>
                        {s.payment_mode || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium capitalize ${STATUS_BADGE[s.payment_status] || STATUS_BADGE[s.status] || 'bg-slate-100 text-slate-500'}`}>
                        {s.payment_status || s.status || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => navigate(`/billing/invoice/${s.id}`)} title="View" className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700"><Eye className="h-4 w-4" /></button>
                        <button onClick={() => window.open(`/billing/invoice/${s.id}/print`, '_blank')} title="Print" className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700"><Printer className="h-4 w-4" /></button>
                        <button onClick={() => navigate(`/billing/edit/${s.id}`)} title="Edit" className="p-1.5 rounded hover:bg-amber-50 text-slate-400 hover:text-amber-600"><Pencil className="h-4 w-4" /></button>
                        <button onClick={() => handleCancel(s.id)} title="Cancel" className="p-1.5 rounded hover:bg-orange-50 text-slate-400 hover:text-orange-600"><XCircle className="h-4 w-4" /></button>
                        <button onClick={() => handleDelete(s.id)} title="Delete" className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              {sales.length > 0 && (
                <tfoot className="bg-slate-50 text-sm font-semibold border-t-2 border-slate-200">
                  <tr>
                    <td colSpan={4} className="px-4 py-3 text-slate-600">
                      Total Invoices: {sales.length}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-800">{formatCurrency(totalAmt)}</td>
                    <td className="px-4 py-3 text-right text-green-600">{formatCurrency(totalPaid)}</td>
                    <td className="px-4 py-3 text-right text-red-500">{formatCurrency(totalBal)}</td>
                    <td colSpan={3} className="px-4 py-3 text-xs font-normal text-slate-500">
                      Cash: <span className="font-semibold text-green-700">{formatCurrency(cashTotal)}</span>
                      &nbsp;·&nbsp;Online/UPI: <span className="font-semibold text-blue-700">{formatCurrency(onlineTotal)}</span>
                      &nbsp;·&nbsp;Card: <span className="font-semibold text-violet-700">{formatCurrency(cardTotal)}</span>
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
