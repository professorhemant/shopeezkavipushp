import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Phone, Mail, MapPin, CreditCard, FileText, IndianRupee } from 'lucide-react'
import toast from 'react-hot-toast'
import { supplierAPI } from '../../api'
import { formatCurrency, formatDate } from '../../utils/formatters'
import LoadingSpinner from '../../components/common/LoadingSpinner'

export default function SupplierDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [supplier, setSupplier] = useState(null)
  const [ledger, setLedger] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('overview')

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [{ data: s }, { data: l }] = await Promise.all([
          supplierAPI.getOne(id),
          supplierAPI.getLedger(id, {}),
        ])
        setSupplier(s.supplier || s)
        setLedger(l.ledger || l || [])
      } catch {
        toast.error('Failed to load supplier details')
        navigate('/suppliers')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [id, navigate])

  if (loading) return <div className="flex items-center justify-center py-32"><LoadingSpinner size="lg" /></div>
  if (!supplier) return null

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"><ArrowLeft className="h-4 w-4" /></button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{supplier.name}</h1>
          <p className="text-sm text-slate-500 mt-0.5">Supplier Profile</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { label: 'Total Purchases', value: formatCurrency(supplier.total_purchases || 0), color: 'text-amber-600' },
          { label: 'Total Paid', value: formatCurrency(supplier.total_paid || 0), color: 'text-green-600' },
          { label: 'Outstanding Payable', value: formatCurrency(supplier.outstanding_balance || 0), color: 'text-red-600' },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
            <p className="text-xs text-slate-500">{s.label}</p>
            <p className={`text-xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {['overview', 'ledger'].map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-1.5 rounded-md text-sm font-medium capitalize transition-colors ${tab === t ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{t}</button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
          <h2 className="text-base font-semibold text-slate-800 mb-4">Contact Information</h2>
          <div className="space-y-3 text-sm">
            {supplier.phone && <div className="flex items-center gap-3 text-slate-600"><Phone className="h-4 w-4 text-slate-400" />{supplier.phone}</div>}
            {supplier.email && <div className="flex items-center gap-3 text-slate-600"><Mail className="h-4 w-4 text-slate-400" />{supplier.email}</div>}
            {supplier.address && <div className="flex items-center gap-3 text-slate-600"><MapPin className="h-4 w-4 text-slate-400" />{[supplier.address, supplier.city, supplier.state, supplier.pincode].filter(Boolean).join(', ')}</div>}
            {supplier.gstin && <div className="flex items-center gap-3 text-slate-600"><CreditCard className="h-4 w-4 text-slate-400" />GSTIN: <span className="font-mono">{supplier.gstin}</span></div>}
          </div>
        </div>
      )}

      {tab === 'ledger' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <h2 className="text-base font-semibold text-slate-800">Ledger</h2>
          </div>
          {ledger.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <IndianRupee className="h-8 w-8 mb-2 text-slate-300" />
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
                      <td className="px-4 py-3 text-slate-600">{formatDate(l.date)}</td>
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
    </div>
  )
}
