import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { accountingAPI } from '../../api'
import { formatCurrency, formatDate } from '../../utils/formatters'
import LoadingSpinner from '../../components/common/LoadingSpinner'

const todayStr = new Date().toISOString().split('T')[0]

export default function BalanceSheet() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [asOfDate, setAsOfDate] = useState(todayStr)

  useEffect(() => {
    setLoading(true)
    accountingAPI.getBalanceSheet({ as_of: asOfDate })
      .then(({ data: d }) => setData(d.data || d))
      .catch(() => toast.error('Failed to load balance sheet'))
      .finally(() => setLoading(false))
  }, [asOfDate])

  const Row = ({ label, value, bold, indent, colorClass = 'text-slate-800' }) => (
    <div className={`flex items-center justify-between py-2 ${bold ? 'border-t border-slate-200 mt-1' : 'border-b border-slate-50'}`}>
      <span className={`text-sm ${indent ? 'pl-5 text-slate-500' : bold ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>{label}</span>
      <span className={`text-sm ${bold ? 'font-bold' : ''} ${colorClass}`}>{formatCurrency(value || 0)}</span>
    </div>
  )

  const fa = data?.fixed_assets || {}
  const schedule = fa.schedule || []

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Balance Sheet</h1>
          <p className="text-sm text-slate-500 mt-0.5">Financial position as of selected date</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-600">As of:</label>
          <input type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-32"><LoadingSpinner size="lg" /></div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">

          {/* ASSETS */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 space-y-5">
            <h2 className="text-base font-bold text-slate-800 border-b pb-2 uppercase tracking-wide">Assets</h2>

            {/* Fixed Assets Schedule */}
            <div>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Fixed Assets</h3>
              <div className="text-xs text-slate-400 grid grid-cols-4 gap-1 px-1 mb-1 font-medium">
                <span className="col-span-1">Asset</span>
                <span className="text-right">Cost</span>
                <span className="text-right">Accum. Dep.</span>
                <span className="text-right">Net Value</span>
              </div>
              {schedule.length === 0 ? (
                <p className="text-xs text-slate-400 pl-1">No fixed assets registered</p>
              ) : schedule.map((a, i) => (
                <div key={i} className="grid grid-cols-4 gap-1 px-1 py-1.5 border-b border-slate-50 text-sm">
                  <span className="text-slate-600 col-span-1 truncate" title={a.name}>{a.name}</span>
                  <span className="text-right text-slate-700">{formatCurrency(a.cost)}</span>
                  <span className="text-right text-orange-600">({formatCurrency(a.accumulated_depreciation)})</span>
                  <span className="text-right font-medium text-slate-800">{formatCurrency(a.net_value)}</span>
                </div>
              ))}
              <div className="grid grid-cols-4 gap-1 px-1 py-2 font-semibold text-sm border-t border-slate-200 mt-1">
                <span className="text-slate-700">Total</span>
                <span className="text-right text-slate-700">{formatCurrency(fa.total_cost)}</span>
                <span className="text-right text-orange-600">({formatCurrency(fa.total_accumulated_depreciation)})</span>
                <span className="text-right text-amber-700">{formatCurrency(fa.total_net_value)}</span>
              </div>
            </div>

            {/* Current Assets */}
            <div>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Current Assets</h3>
              <Row label="Trade Receivables" value={data?.current_assets?.trade_receivables} indent />
              <Row label="Inventory (Stock Value)" value={data?.current_assets?.inventory} indent />
              <Row label="Total Current Assets" value={data?.total_current_assets} bold colorClass="text-amber-600" />
            </div>

            <Row label="TOTAL ASSETS" value={data?.total_assets} bold colorClass="text-amber-700" />
          </div>

          {/* LIABILITIES & EQUITY */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 space-y-5">
            <h2 className="text-base font-bold text-slate-800 border-b pb-2 uppercase tracking-wide">Liabilities & Equity</h2>

            {/* Current Liabilities */}
            <div>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Current Liabilities</h3>
              <Row label="Trade Payables" value={data?.current_liabilities?.trade_payables} indent />
              <Row label="Total Current Liabilities" value={data?.total_liabilities} bold colorClass="text-red-600" />
            </div>

            {/* Equity */}
            <div>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Equity</h3>
              <Row label="Net Worth (Assets − Liabilities)" value={data?.equity} indent colorClass={data?.equity >= 0 ? 'text-green-700' : 'text-red-600'} />
              <Row label="Total Equity" value={data?.equity} bold colorClass={data?.equity >= 0 ? 'text-green-700' : 'text-red-600'} />
            </div>

            <Row label="TOTAL LIABILITIES & EQUITY" value={data?.total_liabilities_equity} bold colorClass="text-amber-700" />

            {/* Balance check */}
            <div className={`mt-2 text-center text-xs py-1.5 rounded-lg ${Math.abs((data?.total_assets || 0) - (data?.total_liabilities_equity || 0)) < 0.01 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
              {Math.abs((data?.total_assets || 0) - (data?.total_liabilities_equity || 0)) < 0.01 ? '✓ Balance Sheet is balanced' : '⚠ Balance Sheet does not balance'}
            </div>
          </div>

        </div>
      )}
    </div>
  )
}
