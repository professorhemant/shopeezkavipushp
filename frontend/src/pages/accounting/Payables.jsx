import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TrendingDown, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import { accountingAPI } from '../../api'
import { formatCurrency } from '../../utils/formatters'
import LoadingSpinner from '../../components/common/LoadingSpinner'

export default function Payables() {
  const navigate = useNavigate()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [summary, setSummary] = useState({ total: 0, count: 0 })

  useEffect(() => {
    accountingAPI.getPayables()
      .then(({ data: d }) => {
        const items = d.payables || d || []
        setData(items)
        setSummary({ total: items.reduce((s, i) => s + parseFloat(i.outstanding || 0), 0), count: items.length })
      })
      .catch(() => toast.error('Failed to load payables'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = data.filter((r) => !search || r.supplier_name?.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Payables</h1>
        <p className="text-sm text-slate-500 mt-0.5">Outstanding amounts to suppliers</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {[
          { label: 'Total Payable', value: formatCurrency(summary.total), color: 'text-red-600' },
          { label: 'Suppliers', value: summary.count, color: 'text-slate-800' },
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
          <input type="text" placeholder="Search supplier..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16"><LoadingSpinner size="lg" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <TrendingDown className="h-12 w-12 mb-3 text-slate-300" />
            <p className="text-base font-medium text-slate-500">No outstanding payables</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Supplier</th>
                  <th className="px-4 py-3 text-left">Phone</th>
                  <th className="px-4 py-3 text-right">Total Purchases</th>
                  <th className="px-4 py-3 text-right">Total Paid</th>
                  <th className="px-4 py-3 text-right">Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.supplier_id || r.id} className="border-b hover:bg-slate-50 cursor-pointer" onClick={() => navigate(`/suppliers/${r.supplier_id || r.id}`)}>
                    <td className="px-4 py-3 font-medium text-amber-600">{r.supplier_name}</td>
                    <td className="px-4 py-3 text-slate-600">{r.phone || '-'}</td>
                    <td className="px-4 py-3 text-right text-slate-800">{formatCurrency(r.total_purchases || r.total)}</td>
                    <td className="px-4 py-3 text-right text-green-700">{formatCurrency(r.total_paid || r.paid)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-red-600">{formatCurrency(r.outstanding || r.balance)}</td>
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
