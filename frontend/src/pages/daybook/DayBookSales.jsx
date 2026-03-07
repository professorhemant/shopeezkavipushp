import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, Printer, Pencil, XCircle, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { saleAPI } from '../../api'
import { formatCurrency } from '../../utils/formatters'
import LoadingSpinner from '../../components/common/LoadingSpinner'

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
  const [date, setDate] = useState(today())
  const [sales, setSales] = useState([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const res = await saleAPI.getAll({ from_date: date, to_date: date, limit: 500 })
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

  const cashTotal   = sales.filter(s => s.payment_mode === 'cash').reduce((a, s) => a + parseFloat(s.paid_amount || 0), 0)
  const onlineTotal = sales.filter(s => ['online','upi'].includes(s.payment_mode)).reduce((a, s) => a + parseFloat(s.paid_amount || 0), 0)
  const cardTotal   = sales.filter(s => s.payment_mode === 'card').reduce((a, s) => a + parseFloat(s.paid_amount || 0), 0)

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Day Book — Sales</h1>
          <p className="text-sm text-slate-500 mt-0.5">{sales.length} invoice{sales.length !== 1 ? 's' : ''}</p>
        </div>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" />
      </div>

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
                    <td className="px-4 py-3 text-slate-700">{s.customer_name || s.customer?.name || 'Walk-in'}</td>
                    <td className="px-4 py-3 text-center text-slate-500">-</td>
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
