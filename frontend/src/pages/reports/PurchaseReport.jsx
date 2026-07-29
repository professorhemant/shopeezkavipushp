import { useEffect, useState } from 'react'
import { Download, FileText } from 'lucide-react'
import toast from 'react-hot-toast'
import { reportAPI } from '../../api'
import { formatCurrency } from '../../utils/formatters'
import LoadingSpinner from '../../components/common/LoadingSpinner'

const today = new Date()
const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
const todayStr = today.toISOString().split('T')[0]

export default function PurchaseReport() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState(firstOfMonth)
  const [endDate, setEndDate] = useState(todayStr)
  const [summary, setSummary] = useState({ count: 0, total: 0, paid: 0 })

  const fetchReport = async () => {
    setLoading(true)
    try {
      const { data: d } = await reportAPI.getPurchases({ start_date: startDate, end_date: endDate })
      const items = d.report || d.data || d || []
      setData(items)
      setSummary({
        count: d.total_bills || items.length,
        total: d.total_amount || items.reduce((s, i) => s + parseFloat(i.total || 0), 0),
        paid: d.total_paid || items.reduce((s, i) => s + parseFloat(i.paid || 0), 0),
      })
    } catch {
      toast.error('Failed to load purchase report')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchReport() }, [startDate, endDate])

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Purchase Report</h1>
          <p className="text-sm text-slate-500 mt-0.5">Purchase analysis for the selected period</p>
        </div>
        <button className="bg-gray-100 hover:bg-gray-200 text-slate-700 px-4 py-2 rounded-lg text-sm flex items-center gap-2">
          <Download className="h-4 w-4" /> Export
        </button>
      </div>

      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
        <div className="flex flex-wrap gap-3 items-center">
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" />
          <span className="text-slate-400 text-sm">to</span>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Bills', value: summary.count, color: 'text-slate-800' },
          { label: 'Total Amount', value: formatCurrency(summary.total), color: 'text-amber-600' },
          { label: 'Total Paid', value: formatCurrency(summary.paid), color: 'text-green-600' },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
            <p className="text-xs text-slate-500">{s.label}</p>
            <p className={`text-xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16"><LoadingSpinner size="lg" /></div>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <FileText className="h-12 w-12 mb-3 text-slate-300" />
            <p className="text-base font-medium text-slate-500">No data for selected period</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Period / Supplier</th>
                  <th className="px-4 py-3 text-right">Bills</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Paid</th>
                  <th className="px-4 py-3 text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row, i) => (
                  <tr key={i} className="border-b hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-800 font-medium">{row.period || row.supplier_name || row.date}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{row.count || row.bills || 0}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800">{formatCurrency(row.total || row.amount)}</td>
                    <td className="px-4 py-3 text-right text-green-700">{formatCurrency(row.paid)}</td>
                    <td className="px-4 py-3 text-right text-red-600">{formatCurrency((row.total || 0) - (row.paid || 0))}</td>
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
