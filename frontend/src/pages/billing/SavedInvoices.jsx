import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bookmark, Trash2, Eye } from 'lucide-react'
import toast from 'react-hot-toast'
import { formatCurrency, formatDate } from '../../utils/formatters'

function loadSaved() {
  try { return JSON.parse(localStorage.getItem('saved_invoices') || '[]') } catch { return [] }
}

const STATUS_BADGE = {
  paid:    'bg-green-100 text-green-700',
  partial: 'bg-yellow-100 text-yellow-700',
  unpaid:  'bg-red-100 text-red-700',
}

export default function SavedInvoices() {
  const navigate = useNavigate()
  const [list, setList] = useState(loadSaved)

  const handleRemove = (id) => {
    const updated = list.filter((s) => s.id !== id)
    localStorage.setItem('saved_invoices', JSON.stringify(updated))
    setList(updated)
    toast.success('Removed from saved invoices')
  }

  const handleClearAll = () => {
    if (!window.confirm('Remove all saved invoices?')) return
    localStorage.removeItem('saved_invoices')
    setList([])
    toast.success('All saved invoices cleared')
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center">
            <Bookmark className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Saved Invoices</h1>
            <p className="text-sm text-slate-500">{list.length} saved</p>
          </div>
        </div>
        {list.length > 0 && (
          <button onClick={handleClearAll}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 text-sm">
            <Trash2 className="h-4 w-4" /> Clear All
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {list.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
            <Bookmark className="h-12 w-12 opacity-30" />
            <p className="text-sm font-medium">No saved invoices yet</p>
            <p className="text-xs">Open any invoice and click "Save Invoice" to bookmark it here</p>
            <button onClick={() => navigate('/billing/invoices')}
              className="mt-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm rounded-lg font-medium">
              Browse Invoices
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-800 text-xs text-slate-200 uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Invoice No</th>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Customer</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Saved On</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map((s) => (
                  <tr key={s.id} className="border-b hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-amber-600">{s.invoice_no}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(s.invoice_date)}</td>
                    <td className="px-4 py-3 text-slate-700">{s.customer_name || 'Walk-in'}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800">{formatCurrency(s.total)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium capitalize ${STATUS_BADGE[s.payment_status] || 'bg-slate-100 text-slate-500'}`}>
                        {s.payment_status || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-slate-400">
                      {s.savedAt ? new Date(s.savedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => navigate(`/billing/invoices/${s.id}`)}
                          title="View" className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700">
                          <Eye className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleRemove(s.id)}
                          title="Remove from saved" className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-500">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
