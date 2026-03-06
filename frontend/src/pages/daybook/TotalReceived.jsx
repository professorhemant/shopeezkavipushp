import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { dayBookAPI } from '../../api'
import { formatCurrency } from '../../utils/formatters'
import LoadingSpinner from '../../components/common/LoadingSpinner'

const today = () => new Date().toISOString().split('T')[0]

function Row({ label, cash, online, total, highlight }) {
  return (
    <tr className={highlight ? 'bg-amber-50 font-semibold' : 'border-b hover:bg-slate-50'}>
      <td className="px-4 py-3 text-slate-700">{label}</td>
      <td className="px-4 py-3 text-right text-green-700">{formatCurrency(cash)}</td>
      <td className="px-4 py-3 text-right text-blue-700">{formatCurrency(online)}</td>
      <td className="px-4 py-3 text-right text-slate-800">{formatCurrency(total)}</td>
    </tr>
  )
}

export default function TotalReceived() {
  const [date, setDate] = useState(today())
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try { const res = await dayBookAPI.getSummary(date); setData(res.data.data) }
    catch { toast.error('Failed to load summary') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [date])

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Day Book — Total Received</h1>
          <p className="text-sm text-slate-500 mt-0.5">Daily summary</p>
        </div>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24"><LoadingSpinner size="lg" /></div>
      ) : !data ? null : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-green-50 border border-green-200 rounded-xl p-5">
              <p className="text-sm text-green-600 font-medium">Total Cash Received</p>
              <p className="text-3xl font-bold text-green-700 mt-1">{formatCurrency(data.total_cash_received)}</p>
              <p className="text-xs text-green-500 mt-1">Opening Balance: {formatCurrency(data.opening_balance)}</p>
              <p className="text-xs text-green-500">Net Cash in Hand: {formatCurrency(data.net_cash)}</p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
              <p className="text-sm text-blue-600 font-medium">Total Received in Bank</p>
              <p className="text-3xl font-bold text-blue-700 mt-1">{formatCurrency(data.total_online_received)}</p>
              <p className="text-xs text-blue-500 mt-1">Net Bank: {formatCurrency(data.net_bank)}</p>
            </div>
          </div>

          {/* Inflow Table */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">Income / Received</h3>
            </div>
            <table className="w-full text-sm">
              <thead className="text-xs text-slate-500 uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Source</th>
                  <th className="px-4 py-3 text-right text-green-600">Cash</th>
                  <th className="px-4 py-3 text-right text-blue-600">Online</th>
                  <th className="px-4 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                <Row label="Sales" cash={data.received.sales.cash} online={data.received.sales.online} total={data.received.sales.total} />
                <Row label="Bridal Bookings" cash={data.received.bookings.cash} online={data.received.bookings.online} total={data.received.bookings.total} />
                <Row label="Bridal Dispatch" cash={data.received.dispatch.cash} online={data.received.dispatch.online} total={data.received.dispatch.total} />
                <Row label="Security Refunds" cash={data.received.refunds.cash} online={data.received.refunds.online} total={data.received.refunds.total} />
                <Row label="TOTAL RECEIVED" cash={data.total_cash_received} online={data.total_online_received} total={data.total_cash_received + data.total_online_received} highlight />
              </tbody>
            </table>
          </div>

          {/* Expenses Table */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">Expenses / Outflow</h3>
            </div>
            <table className="w-full text-sm">
              <thead className="text-xs text-slate-500 uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Category</th>
                  <th className="px-4 py-3 text-right text-green-600">Cash</th>
                  <th className="px-4 py-3 text-right text-blue-600">Online</th>
                  <th className="px-4 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                <Row label="Routine Expenses" cash={data.expenses.routine.cash} online={data.expenses.routine.online} total={data.expenses.routine.total} />
                <Row label="Incentives" cash={data.expenses.incentive.cash} online={data.expenses.incentive.online} total={data.expenses.incentive.total} />
                <Row label="Salary" cash={data.expenses.salary.cash} online={data.expenses.salary.online} total={data.expenses.salary.total} />
                <Row label="TOTAL EXPENSES" cash={data.expenses.total.cash} online={data.expenses.total.online} total={data.expenses.total.total} highlight />
              </tbody>
            </table>
          </div>

          {/* Net Summary */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
            <h3 className="font-semibold text-slate-800 mb-4">Net Summary</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-green-50 border border-green-100">
                <p className="text-xs text-slate-500 mb-1">Opening Balance + Cash Received − Cash Expenses</p>
                <p className="text-lg font-bold text-green-700">Net Cash in Hand: {formatCurrency(data.net_cash)}</p>
              </div>
              <div className="p-4 rounded-lg bg-blue-50 border border-blue-100">
                <p className="text-xs text-slate-500 mb-1">Online Received − Online Expenses</p>
                <p className="text-lg font-bold text-blue-700">Net Bank: {formatCurrency(data.net_bank)}</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
