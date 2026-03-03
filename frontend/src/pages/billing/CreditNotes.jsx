import { useEffect, useState, useCallback } from 'react'
import { FileText, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { saleAPI } from '../../api'
import { formatCurrency, formatDate, getPaymentStatusColor } from '../../utils/formatters'
import LoadingSpinner from '../../components/common/LoadingSpinner'

export default function CreditNotes() {
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [summary, setSummary] = useState({ count: 0, total: 0 })

  const fetchNotes = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await saleAPI.getAll({ type: 'return', search, start_date: startDate, end_date: endDate, page, limit: 20 })
      const items = data.data || data.sales || data.credit_notes || data.results || []
      setNotes(items)
      setTotalPages(data.pagination?.pages || data.total_pages || 1)
      setSummary({
        count: data.pagination?.total || data.count || items.length,
        total: data.total_amount || items.reduce((s, i) => s + parseFloat(i.total_amount || 0), 0),
      })
    } catch {
      toast.error('Failed to load credit notes')
    } finally {
      setLoading(false)
    }
  }, [search, startDate, endDate, page])

  useEffect(() => { fetchNotes() }, [fetchNotes])

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Credit Notes</h1>
          <p className="text-sm text-slate-500 mt-0.5">Sales returns and credit notes</p>
        </div>
      </div>

      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input type="text" placeholder="Search credit note no, customer..." value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" />
          </div>
          <input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(1) }}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" />
          <input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(1) }}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16"><LoadingSpinner size="lg" /></div>
        ) : notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <FileText className="h-12 w-12 mb-3 text-gray-300" />
            <p className="text-base font-medium text-slate-500">No credit notes found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left">Credit Note No</th>
                    <th className="px-4 py-3 text-left">Original Invoice</th>
                    <th className="px-4 py-3 text-left">Date</th>
                    <th className="px-4 py-3 text-left">Customer</th>
                    <th className="px-4 py-3 text-left">Reason</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="px-4 py-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {notes.map((note) => (
                    <tr key={note.id} className="border-b hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-amber-600">{note.invoice_no || note.credit_note_no}</td>
                      <td className="px-4 py-3 text-gray-600">{note.original_invoice_no || '-'}</td>
                      <td className="px-4 py-3 text-gray-600">{formatDate(note.invoice_date || note.date)}</td>
                      <td className="px-4 py-3 text-slate-800">{note.customer_name || note.customer?.name || 'Walk-in'}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{note.return_reason || note.notes || '-'}</td>
                      <td className="px-4 py-3 text-right font-medium text-red-600">{formatCurrency(note.total_amount)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${getPaymentStatusColor(note.status)}`}>
                          {note.status || 'processed'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-slate-100 px-4 py-3 bg-slate-50">
              <div className="flex gap-6 text-sm">
                <div><span className="text-slate-500">Total Notes:</span> <span className="font-semibold text-slate-800">{summary.count}</span></div>
                <div><span className="text-slate-500">Total Value:</span> <span className="font-semibold text-red-600">{formatCurrency(summary.total)}</span></div>
              </div>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
                <p className="text-sm text-slate-500">Page {page} of {totalPages}</p>
                <div className="flex gap-2">
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50"><ChevronLeft className="h-4 w-4" /></button>
                  <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50"><ChevronRight className="h-4 w-4" /></button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
