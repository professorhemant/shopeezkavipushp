import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Phone, Mail, MapPin, CreditCard, FileText, IndianRupee } from 'lucide-react'
import toast from 'react-hot-toast'
import { customerAPI } from '../../api'
import { formatCurrency, formatDate } from '../../utils/formatters'
import LoadingSpinner from '../../components/common/LoadingSpinner'

export default function CustomerDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [customer, setCustomer] = useState(null)
  const [ledger, setLedger] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('overview')

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [{ data: cust }, { data: led }] = await Promise.all([
          customerAPI.getOne(id),
          customerAPI.getLedger(id, {}),
        ])
        setCustomer(cust.customer || cust)
        setLedger(led.ledger || led || [])
      } catch {
        toast.error('Failed to load customer details')
        navigate('/customers')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [id, navigate])

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
          { label: 'Total Paid', value: formatCurrency(customer.total_paid || 0), color: 'text-green-600' },
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
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-1.5 rounded-md text-sm font-medium capitalize transition-colors ${tab === t ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{t}</button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
          <h2 className="text-base font-semibold text-slate-800 mb-4">Contact Information</h2>
          <div className="space-y-3 text-sm">
            {customer.phone && <div className="flex items-center gap-3 text-gray-600"><Phone className="h-4 w-4 text-gray-400" />{customer.phone}</div>}
            {customer.email && <div className="flex items-center gap-3 text-gray-600"><Mail className="h-4 w-4 text-gray-400" />{customer.email}</div>}
            {customer.address && <div className="flex items-center gap-3 text-gray-600"><MapPin className="h-4 w-4 text-gray-400" />{[customer.address, customer.city, customer.state, customer.pincode].filter(Boolean).join(', ')}</div>}
            {customer.gstin && <div className="flex items-center gap-3 text-gray-600"><CreditCard className="h-4 w-4 text-gray-400" />GSTIN: <span className="font-mono">{customer.gstin}</span></div>}
          </div>
        </div>
      )}

      {tab === 'ledger' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <h2 className="text-base font-semibold text-slate-800">Ledger</h2>
          </div>
          {ledger.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <IndianRupee className="h-8 w-8 mb-2 text-gray-300" />
              <p className="text-sm text-slate-500">No transactions found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left">Date</th>
                    <th className="px-4 py-3 text-left">Description</th>
                    <th className="px-4 py-3 text-right">Debit</th>
                    <th className="px-4 py-3 text-right">Credit</th>
                    <th className="px-4 py-3 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.map((l, i) => (
                    <tr key={i} className="border-b hover:bg-slate-50">
                      <td className="px-4 py-3 text-gray-600">{formatDate(l.date)}</td>
                      <td className="px-4 py-3 text-slate-800">{l.description || l.particulars}</td>
                      <td className="px-4 py-3 text-right text-red-600">{l.debit ? formatCurrency(l.debit) : '-'}</td>
                      <td className="px-4 py-3 text-right text-green-600">{l.credit ? formatCurrency(l.credit) : '-'}</td>
                      <td className="px-4 py-3 text-right font-medium text-slate-800">{formatCurrency(l.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'invoices' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
          <div className="flex items-center justify-center py-8 text-gray-400">
            <div className="text-center">
              <FileText className="h-8 w-8 mb-2 text-gray-300 mx-auto" />
              <p className="text-sm text-slate-500">View invoices in the Billing section</p>
              <Link to="/billing/invoices" className="mt-3 inline-block text-sm text-amber-600 hover:underline">Go to Invoices</Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
