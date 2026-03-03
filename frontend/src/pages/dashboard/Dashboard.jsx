import { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  TrendingUp, TrendingDown, AlertTriangle,
  RefreshCw, ArrowUp, ArrowDown, Users, FileText, ReceiptText
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts'
import { dashboardAPI } from '../../api'
import { formatCurrency } from '../../utils/formatters'
import LoadingSpinner from '../../components/common/LoadingSpinner'

const PERIODS = [
  { label: 'Today',        value: 'today' },
  { label: 'Last Week',    value: 'last_week' },
  { label: 'Last 1 Month', value: 'last_1_month' },
  { label: 'Last 3 Month', value: 'last_3_month' },
  { label: 'Last 6 Month', value: 'last_6_month' },
  { label: 'Last 1 year',  value: 'last_1_year' },
  { label: 'Lifetime',     value: 'lifetime' },
]

// Theme colors for charts
const CHART_COLORS = ['#d97706', '#0f172a', '#64748b']

function PayBadge({ status }) {
  const s = (status || '').toUpperCase()
  const cls =
    s === 'CASH' || s === 'PAID'   ? 'bg-emerald-50 text-emerald-700' :
    s === 'UPI'  || s === 'ONLINE' ? 'bg-amber-50 text-amber-700'     :
    s === 'DUE'  || s === 'UNPAID' ? 'bg-red-50 text-red-700'         :
    s === 'PARTIAL'                 ? 'bg-amber-50 text-amber-700'     :
                                     'bg-slate-100 text-slate-600'
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{s || '—'}</span>
  )
}

function ImgPlaceholder() {
  return (
    <div className="w-9 h-9 bg-slate-100 rounded flex items-center justify-center shrink-0">
      <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth="1.5" />
        <circle cx="8.5" cy="8.5" r="1.5" strokeWidth="1.5" />
        <path d="M21 15l-5-5L5 21" strokeWidth="1.5" />
      </svg>
    </div>
  )
}

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
      else setStats(null)
      if (cRes.status === 'fulfilled')  setChart(cRes.value.data?.data || [])
      else setChart([])
      if (iRes.status === 'fulfilled')  setInvoices(iRes.value.data?.data || [])
      else setInvoices([])
      if (tcRes.status === 'fulfilled') setTopCust(tcRes.value.data?.data || [])
      else setTopCust([])
      if (bsRes.status === 'fulfilled') setBestSell(bsRes.value.data?.data || [])
      else setBestSell([])
      if (lsRes.status === 'fulfilled') setLeastSell(lsRes.value.data?.data || [])
      else setLeastSell([])
      if (rRes.status === 'fulfilled')  setReceipts(rRes.value.data?.data || [])
      else setReceipts([])
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

      {/* ── 3 summary banners ───────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Link to="/accounting/receivables"
          className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-5 py-4 hover:border-emerald-300 hover:shadow-sm transition-all group">
          <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
            <ArrowUp className="h-4 w-4 text-emerald-600" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">To Collect</p>
            <p className="text-lg font-bold text-slate-800">{formatCurrency(s.to_collect || 0)}</p>
          </div>
        </Link>

        <Link to="/accounting/payables"
          className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-5 py-4 hover:border-amber-300 hover:shadow-sm transition-all group">
          <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
            <ArrowDown className="h-4 w-4 text-amber-600" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">To Pay</p>
            <p className="text-lg font-bold text-slate-800">{formatCurrency(s.to_pay || 0)}</p>
          </div>
        </Link>

        <Link to="/inventory/alerts"
          className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-5 py-4 hover:border-red-300 hover:shadow-sm transition-all group">
          <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Expiring (30 days)</p>
            <p className="text-lg font-bold text-slate-800">{s.expiring_count ?? 0} Items</p>
          </div>
        </Link>
      </div>

      {/* ── Row 1: Today | Chart | Pie ───────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

        {/* Today's summary */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col gap-4">
          <h3 className="text-sm font-semibold text-slate-700">Today's Summary</h3>

          <div className="space-y-3">
            <div>
              <p className="text-xs text-slate-400">Total Orders</p>
              <p className="text-3xl font-bold text-slate-800">{s.today_orders ?? 0}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Total Sales</p>
              <p className="text-2xl font-bold text-amber-600">
                {(s.today_sales_amount ?? 0).toLocaleString('en-IN')}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center border-t border-slate-100 pt-3">
            <div>
              <p className="text-xs text-slate-400">Cash</p>
              <p className="text-sm font-bold text-slate-700">{(s.today_cash ?? 0).toLocaleString('en-IN')}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Online</p>
              <p className="text-sm font-bold text-slate-700">{(s.today_online ?? 0).toLocaleString('en-IN')}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Due</p>
              <p className="text-sm font-bold text-red-600">{(s.today_due ?? 0).toLocaleString('en-IN')}</p>
            </div>
          </div>

          <div className="flex gap-2 mt-auto">
            <button className="flex-1 text-xs py-1.5 px-2 rounded-lg bg-slate-100 text-slate-600 font-medium hover:bg-slate-200 transition-colors">
              Day Mode
            </button>
            <button className="flex-1 text-xs py-1.5 px-2 rounded-lg bg-amber-500 text-white font-medium hover:bg-amber-600 transition-colors">
              Cash Drawer
            </button>
          </div>
        </div>

        {/* Sales chart */}
        <div className="lg:col-span-6 bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex flex-wrap gap-1 mb-4">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${
                  period === p.value
                    ? 'bg-amber-500 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-4 mb-3 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm inline-block bg-slate-800" /> Orders
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm inline-block bg-amber-500" /> Total Sales
            </span>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chart} margin={{ top: 0, right: 4, left: -10, bottom: 0 }} barCategoryGap="30%" barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
              <Tooltip formatter={(val, name) =>
                name === 'revenue' ? [formatCurrency(val), 'Total Sales'] : [val, 'Orders']} />
              <Bar dataKey="orders"  fill="#0f172a" radius={[2,2,0,0]} />
              <Bar dataKey="revenue" fill="#d97706" radius={[2,2,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Payments Distribution</h3>
          <ResponsiveContainer width="100%" height={165}>
            <PieChart>
              <Pie data={payDist} cx="50%" cy="50%" innerRadius={38} outerRadius={62} dataKey="value" strokeWidth={1}>
                {payDist.map((_, i) => <Cell key={i} fill={CHART_COLORS[i]} />)}
              </Pie>
              <Tooltip formatter={(v) => formatCurrency(v)} />
              <Legend iconType="circle" iconSize={8}
                formatter={(v) => <span className="text-xs text-slate-600">{v}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Row 2: Latest Invoices | Top Customers ─────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
            <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
              <ReceiptText className="h-4 w-4 text-amber-500" /> Latest Invoices
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-xs text-slate-500 uppercase">
                  <th className="px-4 py-2.5 text-left font-medium">Invoice</th>
                  <th className="px-4 py-2.5 text-left font-medium">Client</th>
                  <th className="px-4 py-2.5 text-left font-medium">Date</th>
                  <th className="px-4 py-2.5 text-right font-medium">Total</th>
                  <th className="px-4 py-2.5 text-center font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {invoices.map((inv, i) => (
                  <tr key={i} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-2.5">
                      <Link to="/billing/invoices" className="text-amber-600 hover:underline text-xs font-medium">
                        {inv.invoice_no || inv.id || '-'}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-slate-700 text-xs">{inv.customer_name || '-'}</td>
                    <td className="px-4 py-2.5 text-slate-400 text-xs">{inv.date || '-'}</td>
                    <td className="px-4 py-2.5 text-right text-slate-800 text-xs font-semibold">
                      {formatCurrency(inv.total || inv.grand_total || 0)}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <PayBadge status={inv.payment_mode || inv.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-2.5 border-t border-slate-100">
            <Link to="/billing/invoices" className="text-xs text-amber-600 hover:underline font-medium">
              View all invoices →
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
            <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
              <Users className="h-4 w-4 text-amber-500" /> Top Customers
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-xs text-slate-500 uppercase">
                  <th className="px-4 py-2.5 text-left font-medium">Name</th>
                  <th className="px-4 py-2.5 text-left font-medium">Mobile</th>
                  <th className="px-4 py-2.5 text-left font-medium">Last Purchase</th>
                  <th className="px-4 py-2.5 text-left font-medium">Segment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {topCust.map((c, i) => (
                  <tr key={i} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-2.5">
                      <Link to="/customers" className="text-amber-600 hover:underline text-xs">{c.name || '-'}</Link>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600 text-xs">{c.mobile || c.phone || '-'}</td>
                    <td className="px-4 py-2.5 text-slate-400 text-xs">{c.last_purchase || c.last_purchase_date || '-'}</td>
                    <td className="px-4 py-2.5 text-xs">
                      <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium text-xs">
                        {c.segment || 'Regular'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-2.5 border-t border-slate-100">
            <Link to="/customers" className="text-xs text-amber-600 hover:underline font-medium">
              View all customers →
            </Link>
          </div>
        </div>
      </div>

      {/* ── Row 3: Best / Least selling ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
            <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" /> Best Selling Products
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-xs text-slate-500 uppercase">
                  <th className="px-4 py-2.5 text-left font-medium">Image</th>
                  <th className="px-4 py-2.5 text-left font-medium">Name</th>
                  <th className="px-4 py-2.5 text-right font-medium">Price</th>
                  <th className="px-4 py-2.5 text-right font-medium">Sold</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {bestSell.map((p, i) => (
                  <tr key={i} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-2"><ImgPlaceholder /></td>
                    <td className="px-4 py-2 text-slate-700 text-xs font-medium">{p.name || p.product_name || '-'}</td>
                    <td className="px-4 py-2 text-right text-slate-600 text-xs">{(p.sale_price || p.sell_price || 0).toFixed(1)}</td>
                    <td className="px-4 py-2 text-right text-slate-600 text-xs">{p.sold_qty || p.total_qty || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-2.5 border-t border-slate-100">
            <Link to="/inventory/products" className="text-xs text-amber-600 hover:underline font-medium">
              View all products →
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
            <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-400" /> Least Selling Products
            </h3>
            <Link to="/reports/sales"
              className="text-xs bg-slate-800 hover:bg-slate-700 text-white px-3 py-1 rounded-lg font-medium transition-colors">
              Dead Stock
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-xs text-slate-500 uppercase">
                  <th className="px-4 py-2.5 text-left font-medium">Image</th>
                  <th className="px-4 py-2.5 text-left font-medium">Name</th>
                  <th className="px-4 py-2.5 text-right font-medium">Price</th>
                  <th className="px-4 py-2.5 text-right font-medium">Sold</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {leastSell.map((p, i) => (
                  <tr key={i} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-2"><ImgPlaceholder /></td>
                    <td className="px-4 py-2 text-slate-700 text-xs font-medium">{p.name || p.product_name || '-'}</td>
                    <td className="px-4 py-2 text-right text-slate-600 text-xs">{(p.sale_price || p.sell_price || 0).toFixed(2)}</td>
                    <td className="px-4 py-2 text-right text-slate-600 text-xs">{p.sold_qty || p.total_qty || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-2.5 border-t border-slate-100">
            <Link to="/inventory/products" className="text-xs text-amber-600 hover:underline font-medium">
              View all products →
            </Link>
          </div>
        </div>
      </div>

      {/* ── Row 4: Latest Receipts ───────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800 text-sm">Latest Receipts</h3>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs text-slate-500 uppercase">
                <th className="px-5 py-2.5 text-left font-medium">Invoice #</th>
                <th className="px-5 py-2.5 text-left font-medium">Customer</th>
                <th className="px-5 py-2.5 text-left font-medium">Payment</th>
                <th className="px-5 py-2.5 text-left font-medium">Date</th>
                <th className="px-5 py-2.5 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {receipts.map((r, i) => (
                <tr key={i} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-2.5">
                    <Link to="/billing/invoices" className="text-amber-600 hover:underline text-xs font-medium">
                      {r.invoice_no || r.id || '-'}
                    </Link>
                  </td>
                  <td className="px-5 py-2.5 text-slate-700 text-xs">{r.customer_name || '-'}</td>
                  <td className="px-5 py-2.5 text-xs">
                    <PayBadge status={r.payment_mode || r.payment_type || 'Cash'} />
                  </td>
                  <td className="px-5 py-2.5 text-slate-400 text-xs">{r.date || '-'}</td>
                  <td className="px-5 py-2.5 text-right text-slate-800 text-xs font-semibold">
                    {formatCurrency(r.amount || r.paid_amount || 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-2.5 border-t border-slate-100">
          <Link to="/accounting/receivables" className="text-xs text-amber-600 hover:underline font-medium">
            View all receipts →
          </Link>
        </div>
      </div>

    </div>
  )
}
