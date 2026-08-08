import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, Trash2, Eye } from 'lucide-react'
import toast from 'react-hot-toast'
import { lehengaAPI } from '../../api'
import { formatCurrency } from '../../utils/formatters'
import LoadingSpinner from '../../components/common/LoadingSpinner'

const fmtDate = (d) => {
  if (!d) return '—'
  const [y, m, day] = String(d).split('T')[0].split('-')
  return `${day}/${m}/${y}`
}

const STATUS_BADGE = {
  completed: { label: 'Completed', cls: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Cancelled', cls: 'bg-slate-200 text-slate-600' },
}

export default function LehengaSalesList() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')

  const load = async () => {
    setLoading(true)
    try { const { data } = await lehengaAPI.listSales(); setRows(data.data || []) }
    catch { toast.error('Failed to load sales') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const remove = async (r) => {
    if (!window.confirm(`Delete sale ${r.invoice_no}? The sold quantity goes back into stock.`)) return
    try { await lehengaAPI.deleteSale(r.id); toast.success('Deleted — stock restored'); load() }
    catch { toast.error('Failed to delete') }
  }

  const term = q.trim().toLowerCase()
  const visible = term
    ? rows.filter(r => [r.invoice_no, r.customer_name, r.mobile_no, r.code, r.name].some(v => (v || '').toLowerCase().includes(term)))
    : rows

  // Cancelled bills are excluded from the money totals
  const totals = useMemo(() => visible.reduce((acc, r) => {
    if (r.status === 'cancelled') return acc
    acc.taxable += parseFloat(r.taxable_value) || 0
    acc.gst += (parseFloat(r.cgst) || 0) + (parseFloat(r.sgst) || 0)
    acc.total += parseFloat(r.total) || 0
    acc.due += parseFloat(r.balance) || 0
    return acc
  }, { taxable: 0, gst: 0, total: 0, due: 0 }), [visible])

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Saved Lehenga Sales</h1>
          <p className="text-sm text-slate-500 mt-0.5">{rows.length} sale invoices</p>
        </div>
        <Link to="/lehenga/sale" className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
          <Plus className="h-4 w-4" /> New Sale
        </Link>
      </div>

      {/* Money summary for what's on screen */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Taxable Value', value: totals.taxable, cls: 'text-slate-800' },
          { label: 'GST Collected', value: totals.gst, cls: 'text-blue-700' },
          { label: 'Grand Total', value: totals.total, cls: 'text-green-700' },
          { label: 'Balance Due', value: totals.due, cls: totals.due > 0 ? 'text-red-600' : 'text-slate-500' },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3">
            <p className="text-xs text-slate-500">{c.label}</p>
            <p className={`text-lg font-bold ${c.cls}`}>{formatCurrency(c.value)}</p>
          </div>
        ))}
      </div>

      <div className="relative">
        <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search invoice no / customer / lehenga"
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
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Customer</th>
                  <th className="px-4 py-3 text-left">Lehenga</th>
                  <th className="px-4 py-3 text-right">Qty</th>
                  <th className="px-4 py-3 text-right">Taxable</th>
                  <th className="px-4 py-3 text-right">GST</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Due</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 ? (
                  <tr><td colSpan={11} className="text-center py-12 text-slate-400">{rows.length ? 'No matches' : 'No sales yet'}</td></tr>
                ) : visible.map(r => {
                  const badge = STATUS_BADGE[r.status] || STATUS_BADGE.completed
                  const gst = (parseFloat(r.cgst) || 0) + (parseFloat(r.sgst) || 0)
                  const due = parseFloat(r.balance) || 0
                  return (
                    <tr key={r.id} className="border-b hover:bg-slate-50">
                      <td className="px-4 py-3 font-semibold text-amber-600">{r.invoice_no}</td>
                      <td className="px-4 py-3 text-slate-600">{fmtDate(r.sale_date)}</td>
                      <td className="px-4 py-3 text-slate-700">
                        {r.customer_name || '—'}
                        {r.mobile_no && <div className="text-xs text-slate-400">{r.mobile_no}</div>}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        <div className="truncate max-w-[220px]">{r.name || '—'}</div>
                        {r.code && <div className="text-xs text-slate-400">{r.code}</div>}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">{r.quantity}</td>
                      <td className="px-4 py-3 text-right text-slate-700">{formatCurrency(parseFloat(r.taxable_value) || 0)}</td>
                      <td className="px-4 py-3 text-right text-blue-700">{formatCurrency(gst)}</td>
                      <td className="px-4 py-3 text-right font-medium text-slate-800">{formatCurrency(parseFloat(r.total) || 0)}</td>
                      <td className={`px-4 py-3 text-right ${due > 0 ? 'text-red-600 font-medium' : 'text-slate-400'}`}>{formatCurrency(due)}</td>
                      <td className="px-4 py-3 text-center"><span className={`text-xs rounded px-2 py-0.5 ${badge.cls}`}>{badge.label}</span></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <Link to={`/lehenga/sale/view/${r.id}`} className="p-1.5 rounded hover:bg-amber-50 text-slate-400 hover:text-amber-600" title="View / Print"><Eye className="h-4 w-4" /></Link>
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
