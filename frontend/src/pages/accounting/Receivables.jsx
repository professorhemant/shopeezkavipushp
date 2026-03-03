import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TrendingUp, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import { accountingAPI } from '../../api'
import { formatCurrency, formatDate } from '../../utils/formatters'
import LoadingSpinner from '../../components/common/LoadingSpinner'

export default function Receivables() {
  const navigate = useNavigate()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [summary, setSummary] = useState({ total: 0, count: 0, overdue: 0 })

  useEffect(() => {
    accountingAPI.getReceivables()
      .then(({ data: d }) => {
        const items = Array.isArray(d.data) ? d.data : (Array.isArray(d) ? d : [])
        setData(items)
        setSummary({
          total: d.total_receivables || items.reduce((s, i) => s + parseFloat(i.total_balance || 0), 0),
          count: items.length,
          overdue: 0,
        })
      })
      .catch(() => toast.error('Failed to load receivables'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = data.filter((r) => !search || r.customer_name?.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Receivables</h1>
        <p className="text-sm text-slate-500 mt-0.5">Outstanding amounts from customers</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Receivable', value: formatCurrency(summary.total), color: 'text-amber-600' },
          { label: 'Customers', value: summary.count, color: 'text-slate-800' },
          { label: 'Overdue Amount', value: formatCurrency(summary.overdue), color: 'text-red-600' },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
            <p className="text-xs text-slate-500">{s.label}</p>
            <p className={`text-xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input type="text" placeholder="Search customer..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16"><LoadingSpinner size="lg" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <TrendingUp className="h-12 w-12 mb-3 text-slate-300" />
            <p className="text-base font-medium text-slate-500">No outstanding receivables</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Customer</th>
                  <th className="px-4 py-3 text-left">Phone</th>
                  <th className="px-4 py-3 text-right">Invoices</th>
                  <th className="px-4 py-3 text-right">Total Paid</th>
                  <th className="px-4 py-3 text-right">Outstanding</th>
                  <th className="px-4 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.customer_id || r.customer_name} className="border-b hover:bg-slate-50 cursor-pointer" onClick={() => r.customer_id && navigate(`/customers/${r.customer_id}`)}>
                    <td className="px-4 py-3 font-medium text-amber-600">{r.customer_name}</td>
                    <td className="px-4 py-3 text-slate-600">{r.customer?.phone || '-'}</td>
                    <td className="px-4 py-3 text-right text-slate-800">{r.invoice_count} invoice{r.invoice_count !== 1 ? 's' : ''}</td>
                    <td className="px-4 py-3 text-right text-slate-500">-</td>
                    <td className="px-4 py-3 text-right font-semibold text-red-600">{formatCurrency(r.total_balance)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-xs px-2 py-1 rounded-full font-medium bg-yellow-100 text-yellow-800">
                        Pending
                      </span>
                    </td>
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
