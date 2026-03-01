import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { accountingAPI } from '../../api'
import { formatCurrency } from '../../utils/formatters'
import LoadingSpinner from '../../components/common/LoadingSpinner'

const todayStr = new Date().toISOString().split('T')[0]

export default function BalanceSheet() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [asOfDate, setAsOfDate] = useState(todayStr)

  useEffect(() => {
    setLoading(true)
    accountingAPI.getBalanceSheet({ as_of: asOfDate })
      .then(({ data: d }) => setData(d))
      .catch(() => toast.error('Failed to load balance sheet'))
      .finally(() => setLoading(false))
  }, [asOfDate])

  const Section = ({ title, items = [], total, colorClass = 'text-gray-900' }) => (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">{title}</h3>
      <div className="space-y-1">
        {items.map((item, i) => (
          <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-50">
            <span className="text-sm text-gray-600 pl-2">{item.label || item.name}</span>
            <span className="text-sm text-gray-900">{formatCurrency(item.value || item.amount || 0)}</span>
          </div>
        ))}
        <div className={`flex items-center justify-between py-2 font-semibold`}>
          <span className="text-sm">Total {title}</span>
          <span className={`text-sm ${colorClass}`}>{formatCurrency(total || 0)}</span>
        </div>
      </div>
    </div>
  )

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Balance Sheet</h1>
          <p className="text-sm text-gray-500 mt-0.5">Financial position as of selected date</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">As of:</label>
          <input type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-32"><LoadingSpinner size="lg" /></div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {/* Assets */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6">
            <h2 className="text-base font-semibold text-gray-900 border-b pb-2">Assets</h2>
            <Section
              title="Current Assets"
              items={data?.current_assets || [{ label: 'Cash & Bank', value: data?.cash || 0 }, { label: 'Receivables', value: data?.receivables || 0 }, { label: 'Inventory', value: data?.inventory || 0 }]}
              total={data?.total_current_assets || 0}
              colorClass="text-blue-600"
            />
            <Section
              title="Fixed Assets"
              items={data?.fixed_assets_list || []}
              total={data?.total_fixed_assets || 0}
              colorClass="text-blue-600"
            />
            <div className="flex items-center justify-between py-2 border-t-2 border-gray-200 font-bold">
              <span className="text-sm">Total Assets</span>
              <span className="text-sm text-blue-600">{formatCurrency(data?.total_assets || 0)}</span>
            </div>
          </div>

          {/* Liabilities & Equity */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6">
            <h2 className="text-base font-semibold text-gray-900 border-b pb-2">Liabilities & Equity</h2>
            <Section
              title="Current Liabilities"
              items={data?.current_liabilities || [{ label: 'Payables', value: data?.payables || 0 }]}
              total={data?.total_current_liabilities || 0}
              colorClass="text-red-600"
            />
            <Section
              title="Equity"
              items={data?.equity_items || [{ label: 'Capital', value: data?.capital || 0 }, { label: 'Retained Earnings', value: data?.retained_earnings || 0 }]}
              total={data?.total_equity || 0}
              colorClass="text-green-600"
            />
            <div className="flex items-center justify-between py-2 border-t-2 border-gray-200 font-bold">
              <span className="text-sm">Total Liabilities & Equity</span>
              <span className="text-sm text-blue-600">{formatCurrency(data?.total_liabilities_equity || 0)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
