import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Phone, Mail, MapPin, CreditCard, FileText, IndianRupee, Search, ExternalLink } from 'lucide-react'
import toast from 'react-hot-toast'
import { customerAPI, saleAPI } from '../../api'
import { formatCurrency, formatDate } from '../../utils/formatters'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import StatusBadge from '../../components/common/StatusBadge'

export default function CustomerDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [customer, setCustomer] = useState(null)
  const [ledger, setLedger] = useState([])
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [ledgerLoading, setLedgerLoading] = useState(false)
  const [invoicesLoading, setInvoicesLoading] = useState(false)
  const [tab, setTab] = useState('overview')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  useEffect(() => {
    setCustomer(null)
    setLedger([])
    setInvoices([])
    setTab('overview')
    const fetchData = async () => {
      try {
        const [custRes, ledRes] = await Promise.all([
          customerAPI.getOne(id),
          customerAPI.getLedger(id, {}),
        ])
        setCustomer(custRes.data?.data || custRes.data)
        setLedger(ledRes.data?.data?.ledger || ledRes.data?.ledger || [])
      } catch {
        toast.error('Failed to load customer details')
        navigate('/customers')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [id, navigate])

  const fetchLedger = async () => {
    setLedgerLoading(true)
    try {
      const params = {}
      if (fromDate) params.from_date = fromDate
      if (toDate) params.to_date = toDate
      const res = await customerAPI.getLedger(id, params)
      setLedger(res.data?.data?.ledger || res.data?.ledger || [])
    } catch {
      toast.error('Failed to load ledger')
    } finally {
      setLedgerLoading(false)
    }
  }

  const fetchInvoices = async () => {
    setInvoicesLoading(true)
    try {
      const res = await saleAPI.getAll({ customer_id: id, limit: 100 })
      setInvoices(res.data?.data || res.data?.sales || [])
    } catch {
      toast.error('Failed to load invoices')
    } finally {
      setInvoicesLoading(false)
    }
  }

  const handleTabChange = (t) => {
    setTab(t)
    if (t === 'invoices') fetchInvoices()
  }

  if (loading) return <div className="flex items-center justify-center py-32"><LoadingSpinner size="lg" /></div>
  if (!customer) return null

  const tabs = ['overview', 'ledger', 'invoices']

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{customer.name}</h1>
          <p className="text-sm text-slate-500 mt-0.5">Customer Profile</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Sales', value: formatCurrency(customer.total_sales || 0), color: 'text-amber-600' },
          { label: 'Total Paid', value: formatCurrency(customer.total_paid || 0), color: 'text-emerald-600' },
          { label: 'Previous Balance', value: formatCurrency(customer.outstanding_balance || 0), color: 'text-red-600' },
          { label: 'Credit Limit', value: formatCurrency(customer.credit_limit || 0), color: 'text-slate-800' },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
            <p className="text-xs text-slate-500">{s.label}</p>
            <p className={`text-xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {tabs.map((t) => (
          <button key={t} onClick={() => handleTabChange(t)} className={`px-4 py-1.5 rounded-md text-sm font-medium capitalize transition-colors ${tab === t ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{t}</button>
        ))}
      </div>

      {/* Overview Tab */}
      {tab === 'overview' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 space-y-6">
          <div>
            <h2 className="text-base font-semibold text-slate-800 mb-4">Contact Information</h2>
            <div className="space-y-3 text-sm">
              {customer.phone && (
                <div className="flex items-center gap-3 text-gray-600">
                  <Phone className="h-4 w-4 text-gray-400 shrink-0" />
                  <span>{customer.phone}</span>
                </div>
              )}
              {customer.email && (
                <div className="flex items-center gap-3 text-gray-600">
                  <Mail className="h-4 w-4 text-gray-400 shrink-0" />
                  <span>{customer.email}</span>
                </div>
              )}
              {(customer.billing_address || customer.city || customer.state) && (
                <div className="flex items-start gap-3 text-gray-600">
                  <MapPin className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" />
                  <span>{[customer.billing_address, customer.city, customer.state, customer.pincode].filter(Boolean).join(', ')}</span>
                </div>
              )}
              {customer.gstin && (
                <div className="flex items-center gap-3 text-gray-600">
                  <CreditCard className="h-4 w-4 text-gray-400 shrink-0" />
                  <span>GSTIN: <span className="font-mono">{customer.gstin}</span></span>
                </div>
              )}
              {!customer.phone && !customer.email && !customer.billing_address && !customer.gstin && (
                <p className="text-slate-400 text-sm">No contact information available</p>
              )}
            </div>
          </div>

          <div className="border-t border-slate-100 pt-5">
            <h2 className="text-base font-semibold text-slate-800 mb-4">Financial Details</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-slate-500">Opening Balance</p>
                <p className="font-medium text-slate-800 mt-0.5">{formatCurrency(parseFloat(customer.opening_balance) || 0)}</p>
              </div>
              <div>
                <p className="text-slate-500">Credit Limit</p>
                <p className="font-medium text-slate-800 mt-0.5">{formatCurrency(parseFloat(customer.credit_limit) || 0)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ledger Tab */}
      {tab === 'ledger' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center gap-3">
            <h2 className="text-base font-semibold text-slate-800 flex-1">Ledger</h2>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <span className="text-slate-400 text-xs">to</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <button
                onClick={fetchLedger}
                disabled={ledgerLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white text-sm rounded-lg hover:bg-amber-700 disabled:opacity-50"
              >
                <Search className="h-3.5 w-3.5" />
                Filter
              </button>
            </div>
          </div>

          {ledgerLoading ? (
            <div className="flex justify-center py-12"><LoadingSpinner /></div>
          ) : ledger.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <IndianRupee className="h-8 w-8 mb-2 text-gray-300" />
              <p className="text-sm text-slate-500">No transactions found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-800 text-xs text-slate-200 uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left">Date</th>
                    <th className="px-4 py-3 text-left">Description</th>
                    <th className="px-4 py-3 text-left">Reference</th>
                    <th className="px-4 py-3 text-right">Debit</th>
                    <th className="px-4 py-3 text-right">Credit</th>
                    <th className="px-4 py-3 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.map((l, i) => (
                    <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {l.date ? formatDate(l.date) : '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-800 capitalize">
                        {(l.type || '').replace(/_/g, ' ')}
                      </td>
                      <td className="px-4 py-3 text-slate-500 font-mono text-xs">
                        {l.reference || '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-red-600">
                        {l.debit ? formatCurrency(l.debit) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-emerald-600">
                        {l.credit ? formatCurrency(l.credit) : '—'}
                      </td>
                      <td className={`px-4 py-3 text-right font-semibold ${l.balance >= 0 ? 'text-slate-800' : 'text-emerald-600'}`}>
                        {formatCurrency(Math.abs(l.balance))}
                        {l.balance < 0 && <span className="text-xs font-normal text-emerald-500 ml-1">Cr</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Invoices Tab */}
      {tab === 'invoices' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-800">Invoices</h2>
            <Link to={`/billing/invoices?customer_id=${id}`} className="text-sm text-amber-600 hover:underline flex items-center gap-1">
              View All <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>

          {invoicesLoading ? (
            <div className="flex justify-center py-12"><LoadingSpinner /></div>
          ) : invoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <FileText className="h-8 w-8 mb-2 text-gray-300" />
              <p className="text-sm text-slate-500">No invoices found</p>
              <Link to="/billing/invoices/create" className="mt-3 inline-block text-sm text-amber-600 hover:underline">Create Invoice</Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-800 text-xs text-slate-200 uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left">Invoice No</th>
                    <th className="px-4 py-3 text-left">Date</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="px-4 py-3 text-right">Paid</th>
                    <th className="px-4 py-3 text-right">Balance</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono text-slate-700">{inv.invoice_no}</td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDate(inv.invoice_date)}</td>
                      <td className="px-4 py-3 text-right text-slate-800 font-medium">{formatCurrency(inv.total)}</td>
                      <td className="px-4 py-3 text-right text-emerald-600">{formatCurrency(inv.paid_amount || 0)}</td>
                      <td className="px-4 py-3 text-right text-red-600">{formatCurrency(inv.balance || 0)}</td>
                      <td className="px-4 py-3 text-center">
                        <StatusBadge status={inv.payment_status || inv.status} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Link to={`/billing/invoices/${inv.id}`} className="text-amber-600 hover:underline text-xs">View</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
