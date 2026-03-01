import { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  TrendingUp, TrendingDown, AlertTriangle, Bell,
  RefreshCw, ArrowUp, ArrowDown, Users, FileText
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts'
import { dashboardAPI } from '../../api'
import { formatCurrency } from '../../utils/formatters'
import LoadingSpinner from '../../components/common/LoadingSpinner'

// ── Period tabs ────────────────────────────────────────────────────
const PERIODS = [
  { label: 'Today',        value: 'today' },
  { label: 'Last Week',    value: 'last_week' },
  { label: 'Last 1 Month', value: 'last_1_month' },
  { label: 'Last 3 Month', value: 'last_3_month' },
  { label: 'Last 6 Month', value: 'last_6_month' },
  { label: 'Last 1 year',  value: 'last_1_year' },
  { label: 'Lifetime',     value: 'lifetime' },
]

const PIE_COLORS = ['#3b82f6', '#22c55e', '#f97316']

// ── Image placeholder ──────────────────────────────────────────────
function ImgPlaceholder() {
  return (
    <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center shrink-0">
      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth="1.5" />
        <circle cx="8.5" cy="8.5" r="1.5" strokeWidth="1.5" />
        <path d="M21 15l-5-5L5 21" strokeWidth="1.5" />
      </svg>
    </div>
  )
}

// ── Status badge ───────────────────────────────────────────────────
function StatusBadge({ status }) {
  const s = (status || '').toUpperCase()
  const cls =
    s === 'CASH' || s === 'PAID'     ? 'bg-green-100 text-green-700' :
    s === 'ONLINE'                    ? 'bg-blue-100 text-blue-700' :
    s === 'DUE' || s === 'UNPAID'    ? 'bg-red-100 text-red-700' :
    s === 'PARTIAL'                   ? 'bg-orange-100 text-orange-700' :
                                       'bg-gray-100 text-gray-600'
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>{s || 'N/A'}</span>
  )
}

// ── Main dashboard ─────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate()

  const [stats,      setStats]      = useState(null)
  const [chart,      setChart]      = useState([])
  const [invoices,   setInvoices]   = useState([])
  const [topCust,    setTopCust]    = useState([])
  const [bestSell,   setBestSell]   = useState([])
  const [leastSell,  setLeastSell]  = useState([])
  const [receipts,   setReceipts]   = useState([])
  const [period,     setPeriod]     = useState('last_1_month')
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    try {
      const [sRes, cRes, iRes, tcRes, bsRes, lsRes, rRes] = await Promise.allSettled([
        dashboardAPI.getStats(),
        dashboardAPI.getSalesChart(period),
        dashboardAPI.getLatestInvoices(),
        dashboardAPI.getTopCustomers(),
        dashboardAPI.getBestSelling(),
        dashboardAPI.getLeastSelling(),
        dashboardAPI.getLatestReceipts(),
      ])
      if (sRes.status === 'fulfilled')  setStats(sRes.value.data?.data || sRes.value.data || null)
      else                              setStats(null)
      if (cRes.status === 'fulfilled')  setChart(cRes.value.data?.data || [])
      else                              setChart([])
      if (iRes.status === 'fulfilled')  setInvoices(iRes.value.data?.data || [])
      else                              setInvoices([])
      if (tcRes.status === 'fulfilled') setTopCust(tcRes.value.data?.data || [])
      else                              setTopCust([])
      if (bsRes.status === 'fulfilled') setBestSell(bsRes.value.data?.data || [])
      else                              setBestSell([])
      if (lsRes.status === 'fulfilled') setLeastSell(lsRes.value.data?.data || [])
      else                              setLeastSell([])
      if (rRes.status === 'fulfilled')  setReceipts(rRes.value.data?.data || [])
      else                              setReceipts([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [period])

  useEffect(() => { load() }, [load])

  if (loading) return <LoadingSpinner fullscreen />

  const s = stats || {}

  const payDist = [
    { name: 'Online', value: s.online_sales || 0 },
    { name: 'Cash',   value: s.cash_sales   || 0 },
    { name: 'Due',    value: s.due_amount   || 0 },
  ]

  return (
    <div className="space-y-4">

      {/* ── Top 3 banner boxes ──────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* To Collect */}
        <Link to="/accounting/receivables"
          className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-5 py-4 hover:bg-green-100 transition-colors"
        >
          <ArrowUp className="h-5 w-5 text-green-600 shrink-0" />
          <div>
            <p className="text-xs text-green-700 font-medium">To Collect</p>
            <p className="text-lg font-bold text-green-800">{formatCurrency(s.to_collect || 0)}</p>
          </div>
        </Link>
        {/* To Pay */}
        <Link to="/accounting/payables"
          className="flex items-center gap-3 bg-orange-50 border border-orange-200 rounded-xl px-5 py-4 hover:bg-orange-100 transition-colors"
        >
          <ArrowDown className="h-5 w-5 text-orange-600 shrink-0" />
          <div>
            <p className="text-xs text-orange-700 font-medium">To Pay</p>
            <p className="text-lg font-bold text-orange-800">{formatCurrency(s.to_pay || 0)}</p>
          </div>
        </Link>
        {/* Expiring */}
        <Link to="/inventory/alerts"
          className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-5 py-4 hover:bg-red-100 transition-colors"
        >
          <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
          <div>
            <p className="text-xs text-red-700 font-medium">Items Expiring in 30 days</p>
            <p className="text-lg font-bold text-red-700">{s.expiring_count ?? 0} Items Expiring in 30 days</p>
          </div>
        </Link>
      </div>

      {/* ── Row 1: Today's card | Sales chart | Pie chart ──────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

        {/* Today's summary */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-col gap-3">
          <h3 className="text-base font-semibold text-gray-700">Today's</h3>

          <div>
            <p className="text-xs text-gray-400">Total Orders</p>
            <p className="text-4xl font-bold text-green-600">{s.today_orders ?? 0}</p>
          </div>

          <div>
            <p className="text-xs text-gray-400">Total Sales</p>
            <p className="text-3xl font-bold text-green-600">{(s.today_sales_amount ?? 0).toLocaleString('en-IN')}</p>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center text-sm mt-1">
            <div>
              <p className="text-xs text-gray-400">Cash</p>
              <p className="font-bold text-gray-800">{(s.today_cash ?? 0).toLocaleString('en-IN')}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Online</p>
              <p className="font-bold text-gray-800">{(s.today_online ?? 0).toLocaleString('en-IN')}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Due</p>
              <p className="font-bold text-gray-800">{(s.today_due ?? 0).toLocaleString('en-IN')}</p>
            </div>
          </div>

          <div className="flex gap-2 mt-auto pt-2">
            <button className="flex-1 text-xs py-1.5 px-2 rounded bg-amber-400 text-white font-medium hover:bg-amber-500">
              Day Mode
            </button>
            <button className="flex-1 text-xs py-1.5 px-2 rounded bg-green-500 text-white font-medium hover:bg-green-600">
              Cash Drawer
            </button>
          </div>
        </div>

        {/* Sales chart */}
        <div className="lg:col-span-6 bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          {/* Period tabs */}
          <div className="flex flex-wrap gap-1 mb-4">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${
                  period === p.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          {/* Legend */}
          <div className="flex items-center gap-4 mb-3 text-xs text-gray-500">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm inline-block bg-blue-500" /> Orders
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm inline-block bg-orange-400" /> Total Sales
            </span>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart
              data={chart}
              margin={{ top: 0, right: 4, left: -10, bottom: 0 }}
              barCategoryGap="30%"
              barGap={2}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false}
                tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
              <Tooltip
                formatter={(val, name) =>
                  name === 'revenue'
                    ? [formatCurrency(val), 'Total Sales']
                    : [val, 'Orders']
                }
              />
              <Bar dataKey="orders"  fill="#3b82f6" radius={[2,2,0,0]} />
              <Bar dataKey="revenue" fill="#fb923c" radius={[2,2,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Payments Distribution pie */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Payments Distribution</h3>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie
                data={payDist}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={65}
                dataKey="value"
                strokeWidth={1}
              >
                {payDist.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i]} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => formatCurrency(v)} />
              <Legend
                iconType="circle"
                iconSize={8}
                formatter={(v) => <span className="text-xs text-gray-600">{v}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Row 2: Latest Invoices | Top Customers ──────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Latest Invoices */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-500" /> Latest Invoices
            </h3>
            <Bell className="h-4 w-4 text-gray-400" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500 uppercase">
                  <th className="px-4 py-2 text-left font-medium">Invoice ID</th>
                  <th className="px-4 py-2 text-left font-medium">Client</th>
                  <th className="px-4 py-2 text-left font-medium">Date</th>
                  <th className="px-4 py-2 text-right font-medium">Total</th>
                  <th className="px-4 py-2 text-center font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {invoices.map((inv, i) => (
                  <tr key={i} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2.5">
                      <Link to={`/billing/invoices`} className="text-blue-600 hover:underline text-xs font-medium">
                        {inv.invoice_no || inv.id || '-'}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-gray-700 text-xs">{inv.customer_name || '-'}</td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs">{inv.date || '-'}</td>
                    <td className="px-4 py-2.5 text-right text-gray-800 text-xs font-medium">
                      {formatCurrency(inv.total || inv.grand_total || 0)}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <StatusBadge status={inv.payment_mode || inv.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-2.5 border-t border-gray-100">
            <Link to="/billing/invoices" className="text-xs text-blue-600 hover:underline">
              View all invoices →
            </Link>
          </div>
        </div>

        {/* Top Customers */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" /> Top Customers
            </h3>
            <Bell className="h-4 w-4 text-gray-400" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500 uppercase">
                  <th className="px-4 py-2 text-left font-medium">Name</th>
                  <th className="px-4 py-2 text-left font-medium">Mobile</th>
                  <th className="px-4 py-2 text-left font-medium">Last Purchase</th>
                  <th className="px-4 py-2 text-left font-medium">Segment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {topCust.map((c, i) => (
                  <tr key={i} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2.5">
                      <Link to="/customers" className="text-blue-600 hover:underline text-xs">{c.name || '-'}</Link>
                    </td>
                    <td className="px-4 py-2.5 text-gray-600 text-xs">{c.mobile || c.phone || '-'}</td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs">{c.last_purchase || c.last_purchase_date || '-'}</td>
                    <td className="px-4 py-2.5 text-xs">
                      <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-medium">
                        {c.segment || 'Regular'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-2.5 border-t border-gray-100">
            <Link to="/customers" className="text-xs text-blue-600 hover:underline">
              View all customers →
            </Link>
          </div>
        </div>
      </div>

      {/* ── Row 3: Best Selling | Least Selling ─────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Best Selling Products */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" /> Best Selling Products
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500 uppercase">
                  <th className="px-4 py-2 text-left font-medium">Image</th>
                  <th className="px-4 py-2 text-left font-medium">Name</th>
                  <th className="px-4 py-2 text-right font-medium">Sell Price</th>
                  <th className="px-4 py-2 text-right font-medium">Sold Qty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {bestSell.map((p, i) => (
                  <tr key={i} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2"><ImgPlaceholder /></td>
                    <td className="px-4 py-2 text-gray-700 text-xs font-medium">{p.name || p.product_name || '-'}</td>
                    <td className="px-4 py-2 text-right text-gray-600 text-xs">{(p.sale_price || p.sell_price || 0).toFixed(1)}</td>
                    <td className="px-4 py-2 text-right text-gray-600 text-xs">{p.sold_qty || p.total_qty || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-2.5 border-t border-gray-100">
            <Link to="/inventory/products" className="text-xs text-blue-600 hover:underline">
              View all products →
            </Link>
          </div>
        </div>

        {/* Least Selling Products */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-500" /> Least Selling Products
            </h3>
            <Link to="/reports/sales" className="text-xs bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded font-medium">
              Dead Stock Report
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500 uppercase">
                  <th className="px-4 py-2 text-left font-medium">Image</th>
                  <th className="px-4 py-2 text-left font-medium">Name</th>
                  <th className="px-4 py-2 text-right font-medium">Sell Price</th>
                  <th className="px-4 py-2 text-right font-medium">Sold Qty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {leastSell.map((p, i) => (
                  <tr key={i} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2"><ImgPlaceholder /></td>
                    <td className="px-4 py-2 text-gray-700 text-xs font-medium">{p.name || p.product_name || '-'}</td>
                    <td className="px-4 py-2 text-right text-gray-600 text-xs">{(p.sale_price || p.sell_price || 0).toFixed(2)}</td>
                    <td className="px-4 py-2 text-right text-gray-600 text-xs">{p.sold_qty || p.total_qty || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-2.5 border-t border-gray-100">
            <Link to="/inventory/products" className="text-xs text-blue-600 hover:underline">
              View all products →
            </Link>
          </div>
        </div>
      </div>

      {/* ── Row 4: Latest Receipts ───────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">Latest Receipts</h3>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500 uppercase">
                <th className="px-5 py-2 text-left font-medium">Invoice #</th>
                <th className="px-5 py-2 text-left font-medium">Customer</th>
                <th className="px-5 py-2 text-left font-medium">Payment Type</th>
                <th className="px-5 py-2 text-left font-medium">Date</th>
                <th className="px-5 py-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {receipts.map((r, i) => (
                <tr key={i} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-2.5">
                    <Link to="/billing/invoices" className="text-blue-600 hover:underline text-xs font-medium">
                      {r.invoice_no || r.id || '-'}
                    </Link>
                  </td>
                  <td className="px-5 py-2.5 text-gray-700 text-xs">{r.customer_name || '-'}</td>
                  <td className="px-5 py-2.5 text-gray-500 text-xs">{r.payment_mode || r.payment_type || 'Cash'}</td>
                  <td className="px-5 py-2.5 text-gray-500 text-xs">{r.date || '-'}</td>
                  <td className="px-5 py-2.5 text-right text-gray-800 text-xs font-medium">
                    {formatCurrency(r.amount || r.paid_amount || 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-2.5 border-t border-gray-100">
          <Link to="/accounting/receivables" className="text-xs text-blue-600 hover:underline">
            View all receipts →
          </Link>
        </div>
      </div>

    </div>
  )
}

