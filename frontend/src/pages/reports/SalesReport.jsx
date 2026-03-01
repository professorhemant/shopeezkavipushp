import { useEffect, useState } from 'react'
import { Download, FileText } from 'lucide-react'
import toast from 'react-hot-toast'
import { reportAPI } from '../../api'
import { formatCurrency, formatDate } from '../../utils/formatters'
import LoadingSpinner from '../../components/common/LoadingSpinner'

const today = new Date()
const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
const todayStr = today.toISOString().split('T')[0]

export default function SalesReport() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState(firstOfMonth)
  const [endDate, setEndDate] = useState(todayStr)
  const [groupBy, setGroupBy] = useState('day')
  const [summary, setSummary] = useState({ count: 0, total: 0, tax: 0 })

  const fetchReport = async () => {
    setLoading(true)
    try {
      const { data: d } = await reportAPI.getSales({ start_date: startDate, end_date: endDate, group_by: groupBy })
      const items = d.report || d.data || d || []
      setData(items)
      setSummary({
        count: d.total_invoices || d.count || items.length,
        total: d.total_amount || items.reduce((s, i) => s + parseFloat(i.total || 0), 0),
        tax: d.total_tax || items.reduce((s, i) => s + parseFloat(i.tax || i.gst || 0), 0),
      })
    } catch {
      toast.error('Failed to load sales report')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchReport() }, [startDate, endDate, groupBy])

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sales Report</h1>
          <p className="text-sm text-gray-500 mt-0.5">Sales analysis for the selected period</p>
        </div>
        <button className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm flex items-center gap-2">
          <Download className="h-4 w-4" /> Export
        </button>
      </div>

      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <div className="flex flex-wrap gap-3 items-center">
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <span className="text-gray-400 text-sm">to</span>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <select value={groupBy} onChange={(e) => setGroupBy(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="day">Daily</option>
            <option value="week">Weekly</option>
            <option value="month">Monthly</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Invoices', value: summary.count, color: 'text-gray-900' },
          { label: 'Total Revenue', value: formatCurrency(summary.total), color: 'text-blue-600' },
          { label: 'Total GST', value: formatCurrency(summary.tax), color: 'text-green-600' },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className={`text-xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16"><LoadingSpinner size="lg" /></div>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <FileText className="h-12 w-12 mb-3 text-gray-300" />
            <p className="text-base font-medium text-gray-500">No data for selected period</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Period</th>
                  <th className="px-4 py-3 text-right">Invoices</th>
                  <th className="px-4 py-3 text-right">Revenue</th>
                  <th className="px-4 py-3 text-right">Taxable</th>
                  <th className="px-4 py-3 text-right">GST</th>
                  <th className="px-4 py-3 text-right">Discount</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row, i) => (
                  <tr key={i} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-900 font-medium">{row.period || row.date || formatDate(row.date)}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{row.count || row.invoices || 0}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(row.total || row.revenue)}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(row.taxable_amount || row.taxable)}</td>
                    <td className="px-4 py-3 text-right text-green-700">{formatCurrency(row.tax || row.gst)}</td>
                    <td className="px-4 py-3 text-right text-orange-600">{formatCurrency(row.discount || 0)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 font-semibold">
                <tr>
                  <td className="px-4 py-3 text-gray-900">Total</td>
                  <td className="px-4 py-3 text-right text-gray-900">{summary.count}</td>
                  <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(summary.total)}</td>
                  <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(summary.total - summary.tax)}</td>
                  <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(summary.tax)}</td>
                  <td className="px-4 py-3 text-right text-gray-900">-</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
