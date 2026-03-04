import { useEffect, useState } from 'react'
import { TrendingUp, TrendingDown, IndianRupee } from 'lucide-react'
import toast from 'react-hot-toast'
import { accountingAPI } from '../../api'
import { formatCurrency } from '../../utils/formatters'
import LoadingSpinner from '../../components/common/LoadingSpinner'

const today = new Date()
const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
const todayStr = today.toISOString().split('T')[0]

export default function ProfitLoss() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState(firstOfMonth)
  const [endDate, setEndDate] = useState(todayStr)

  const fetchData = async () => {
    setLoading(true)
    try {
      const { data: d } = await accountingAPI.getProfitLoss({ start_date: startDate, end_date: endDate })
      setData(d)
    } catch {
      toast.error('Failed to load P&L report')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [startDate, endDate])

  const revenue = data?.revenue || data?.total_sales || 0
  const cogs = data?.cogs || data?.cost_of_goods || 0
  const grossProfit = data?.gross_profit || (revenue - cogs)
  const expenses = data?.expenses || data?.total_expenses || 0
  const depreciation = data?.depreciation || 0
  const netProfit = data?.net_profit || (grossProfit - expenses - depreciation)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Profit & Loss</h1>
          <p className="text-sm text-slate-500 mt-0.5">Income statement for the selected period</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" />
          <span className="text-slate-400 text-sm">to</span>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-32"><LoadingSpinner size="lg" /></div>
      ) : (
        <div className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Revenue', value: formatCurrency(revenue), icon: TrendingUp, color: 'text-amber-600', bg: 'bg-amber-50' },
              { label: 'Cost of Goods', value: formatCurrency(cogs), icon: TrendingDown, color: 'text-orange-600', bg: 'bg-orange-50' },
              { label: 'Gross Profit', value: formatCurrency(grossProfit), icon: IndianRupee, color: 'text-green-600', bg: 'bg-green-50' },
              { label: 'Net Profit', value: formatCurrency(netProfit), icon: IndianRupee, color: netProfit >= 0 ? 'text-green-600' : 'text-red-600', bg: netProfit >= 0 ? 'bg-green-50' : 'bg-red-50' },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
                <div className={`w-8 h-8 rounded-lg ${s.bg} flex items-center justify-center mb-3`}>
                  <s.icon className={`h-4 w-4 ${s.color}`} />
                </div>
                <p className="text-xs text-slate-500">{s.label}</p>
                <p className={`text-xl font-bold mt-1 ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Detailed P&L */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-800">Income Statement</h2>
            </div>
            <div className="divide-y divide-slate-50">
              {[
                { label: 'Sales Revenue', value: revenue, indent: false, bold: false },
                { label: 'Less: Cost of Goods Sold', value: -cogs, indent: true, bold: false },
                { label: 'Gross Profit', value: grossProfit, indent: false, bold: true },
                { label: 'Less: Operating Expenses', value: -expenses, indent: true, bold: false },
                { label: 'Less: Depreciation', value: -depreciation, indent: true, bold: false },
                { label: 'Net Profit / (Loss)', value: netProfit, indent: false, bold: true },
              ].map((row, i) => (
                <div key={i} className={`flex items-center justify-between px-6 py-3 ${row.bold ? 'bg-slate-50' : ''}`}>
                  <span className={`text-sm ${row.indent ? 'pl-4 text-slate-500' : 'font-medium text-slate-800'}`}>{row.label}</span>
                  <span className={`text-sm font-${row.bold ? 'bold' : 'medium'} ${row.value >= 0 ? 'text-slate-800' : 'text-red-600'}`}>{formatCurrency(Math.abs(row.value))}{row.value < 0 ? ' (Dr)' : ''}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
