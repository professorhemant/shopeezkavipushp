import { useEffect, useState } from 'react'
import { FileCheck, Plus, RefreshCw, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { gstAPI, saleAPI } from '../../api'
import { formatCurrency, formatDate } from '../../utils/formatters'
import LoadingSpinner from '../../components/common/LoadingSpinner'

const STATUS_COLORS = {
  generated: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
  pending: 'bg-yellow-100 text-yellow-700',
  failed: 'bg-red-100 text-red-600',
}

export default function EInvoicing() {
  const [einvoices, setEinvoices] = useState([])
  const [eligibleInvoices, setEligibleInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(null)
  const [showGenModal, setShowGenModal] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState('')
  const [cancelId, setCancelId] = useState(null)
  const [cancelReason, setCancelReason] = useState('')

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [eiRes, invRes] = await Promise.all([
        gstAPI.getGSTR1({ type: 'einvoices' }).catch(() => ({ data: { einvoices: [] } })),
        saleAPI.getAll({ einvoice_eligible: true, limit: 100 }),
      ])
      setEinvoices(eiRes.data.einvoices || eiRes.data || [])
      setEligibleInvoices(invRes.data.sales || invRes.data.results || invRes.data || [])
    } catch {
      toast.error('Failed to load e-invoices')
    } finally {
      setLoading(false)
    }
  }

  const handleGenerate = async () => {
    if (!selectedInvoice) { toast.error('Select an invoice'); return }
    setGenerating(selectedInvoice)
    try {
      await gstAPI.generateEInvoice(selectedInvoice)
      toast.success('E-Invoice (IRN) generated successfully')
      setShowGenModal(false)
      setSelectedInvoice('')
      fetchData()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to generate e-invoice')
    } finally {
      setGenerating(null)
    }
  }

  const handleCancel = async (id) => {
    try {
      await gstAPI.calculate({ action: 'cancel_irn', id, reason: cancelReason })
      toast.success('IRN cancelled')
      setCancelId(null)
      fetchData()
    } catch {
      toast.error('Failed to cancel IRN')
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">E-Invoicing (IRN)</h1>
          <p className="text-sm text-gray-500 mt-0.5">GST e-invoice generation and management</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchData} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm flex items-center gap-2">
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
          <button onClick={() => setShowGenModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
            <Plus className="h-4 w-4" /> Generate IRN
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16"><LoadingSpinner size="lg" /></div>
        ) : einvoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <FileCheck className="h-12 w-12 mb-3 text-gray-300" />
            <p className="text-base font-medium text-gray-500">No e-invoices generated yet</p>
            <p className="text-sm mt-1">Mandatory for businesses with turnover above ₹5 crore</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">IRN</th>
                  <th className="px-4 py-3 text-left">Invoice No</th>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Customer</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-left">Ack No</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {einvoices.map((ei) => (
                  <tr key={ei.id || ei.irn} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-600 max-w-[150px] truncate" title={ei.irn}>{ei.irn ? ei.irn.slice(0, 20) + '...' : '-'}</td>
                    <td className="px-4 py-3 font-medium text-blue-600">{ei.invoice_no}</td>
                    <td className="px-4 py-3 text-gray-600">{formatDate(ei.generated_at || ei.date)}</td>
                    <td className="px-4 py-3 text-gray-900">{ei.customer_name || '-'}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">{formatCurrency(ei.total_amount)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{ei.ack_no || '-'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[ei.status] || STATUS_COLORS.generated}`}>
                        {ei.status || 'generated'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {ei.status !== 'cancelled' && (
                        <button onClick={() => setCancelId(ei.id)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600" title="Cancel IRN">
                          <XCircle className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Generate Modal */}
      {showGenModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 shadow-xl w-full max-w-md mx-4">
            <h3 className="font-semibold text-gray-900 text-lg mb-5">Generate E-Invoice (IRN)</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Invoice *</label>
                <select value={selectedInvoice} onChange={(e) => setSelectedInvoice(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">-- Select Invoice --</option>
                  {eligibleInvoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>{inv.invoice_no} - {inv.customer_name || 'Walk-in'}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowGenModal(false)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm">Cancel</button>
                <button onClick={handleGenerate} disabled={!!generating}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60">
                  {generating ? <LoadingSpinner size="sm" /> : <FileCheck className="h-4 w-4" />} Generate IRN
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {cancelId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 shadow-xl w-full max-w-md mx-4">
            <h3 className="font-semibold text-gray-900 text-lg mb-4">Cancel IRN</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cancellation Reason *</label>
                <textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} rows={3}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Reason for cancellation..." />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setCancelId(null)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm">Back</button>
                <button onClick={() => handleCancel(cancelId)}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium">Cancel IRN</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
