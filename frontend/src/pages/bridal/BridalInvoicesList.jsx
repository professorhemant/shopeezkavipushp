import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { bridalAPI } from '../../api'
import { formatCurrency } from '../../utils/formatters'
import LoadingSpinner from '../../components/common/LoadingSpinner'

const fmtDate = (d) => {
  if (!d) return '—'
  const [y, m, day] = String(d).split('T')[0].split('-')
  return `${day}/${m}/${y}`
}

const TYPE_BADGE = {
  booking: { label: 'Booking', cls: 'bg-amber-100 text-amber-700' },
  pickup:  { label: 'Pickup',  cls: 'bg-blue-100 text-blue-700' },
  final:   { label: 'Final',   cls: 'bg-green-100 text-green-700' },
}

export default function BridalInvoicesList() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')

  const load = async () => {
    setLoading(true)
    try { const { data } = await bridalAPI.listInvoices(); setRows(data.data || []) }
    catch { toast.error('Failed to load invoices') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const remove = async (r) => {
    if (!window.confirm(`Delete invoice ${r.invoice_no}?`)) return
    try { await bridalAPI.deleteInvoice(r.id); toast.success('Deleted'); load() }
    catch { toast.error('Failed to delete') }
  }

  const term = q.trim().toLowerCase()
  const visible = term
    ? rows.filter(r => [r.invoice_no, r.customer_name, r.set_code, r.set_name].some(v => (v || '').toLowerCase().includes(term)))
    : rows

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Bridal Invoices</h1>
          <p className="text-sm text-slate-500 mt-0.5">{rows.length} saved invoices</p>
        </div>
        <Link to="/bridal/invoice" className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
          <Plus className="h-4 w-4" /> Generate Invoice
        </Link>
      </div>

      <div className="relative">
        <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search invoice no / customer / set"
          className="border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm w-80 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16"><LoadingSpinner size="lg" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-800 text-xs text-slate-200 uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Invoice #</th>
                  <th className="px-4 py-3 text-left">Customer</th>
                  <th className="px-4 py-3 text-left">Set</th>
                  <th className="px-4 py-3 text-center">Type</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-12 text-slate-400">{rows.length ? 'No matches' : 'No saved invoices yet'}</td></tr>
                ) : visible.map(r => {
                  const badge = TYPE_BADGE[r.type] || TYPE_BADGE.booking
                  return (
                    <tr key={r.id} className="border-b hover:bg-slate-50">
                      <td className="px-4 py-3 font-semibold text-amber-600">{r.invoice_no}</td>
                      <td className="px-4 py-3 text-slate-700">
                        {r.customer_name || '—'}
                        {r.mobile_no && <div className="text-xs text-slate-400">{r.mobile_no}</div>}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{r.set_code || r.set_name || '—'}</td>
                      <td className="px-4 py-3 text-center"><span className={`text-xs rounded px-2 py-0.5 ${badge.cls}`}>{badge.label}</span></td>
                      <td className="px-4 py-3 text-right font-medium text-slate-800">{formatCurrency(parseFloat(r.total) || 0)}</td>
                      <td className="px-4 py-3 text-slate-600">{fmtDate(r.invoice_date)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center">
                          <button onClick={() => remove(r)} className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-600" title="Delete"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
