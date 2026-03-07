import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Printer, Download, Edit2, XCircle, Share2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { saleAPI } from '../../api'
import { formatCurrency, formatDate, getPaymentStatusColor } from '../../utils/formatters'
import LoadingSpinner from '../../components/common/LoadingSpinner'

export default function InvoiceDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [inv, setInv] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    saleAPI.getOne(id)
      .then(({ data }) => {
        const sale = data.data || data.sale || data
        setInv(sale)
      })
      .catch((err) => {
        const msg = err?.response?.data?.message || err?.response?.data?.error || err.message || 'Failed to load invoice'
        setError(msg)
        toast.error(msg)
      })
      .finally(() => setLoading(false))
  }, [id])

  const handleDownloadPDF = async () => {
    try {
      const { data } = await saleAPI.generatePDF(id)
      const url = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }))
      const a = document.createElement('a'); a.href = url; a.download = `invoice-${id}.pdf`; a.click()
      URL.revokeObjectURL(url)
    } catch { toast.error('Failed to generate PDF') }
  }

  const handleSharePDF = async () => {
    try {
      toast.loading('Preparing PDF…', { id: 'share' })
      const { data } = await saleAPI.generatePDF(id)
      const blob = new Blob([data], { type: 'application/pdf' })
      const fileName = `invoice-${inv?.invoice_no || id}.pdf`
      const file = new File([blob], fileName, { type: 'application/pdf' })

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        toast.dismiss('share')
        await navigator.share({
          files: [file],
          title: `Invoice ${inv?.invoice_no || ''}`,
          text: `Invoice from ${inv?.firm?.name || 'us'} — ${fileName}`,
        })
      } else {
        // Fallback: just download the file
        toast.dismiss('share')
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a'); a.href = url; a.download = fileName; a.click()
        URL.revokeObjectURL(url)
        toast('Sharing not supported on this browser — PDF downloaded instead.')
      }
    } catch (err) {
      toast.dismiss('share')
      if (err?.name !== 'AbortError') toast.error('Failed to share PDF')
    }
  }

  const handleCancel = async () => {
    if (!window.confirm('Cancel this invoice?')) return
    try {
      await saleAPI.cancel(id)
      toast.success('Invoice cancelled')
      setInv((prev) => ({ ...prev, status: 'cancelled' }))
    } catch { toast.error('Failed to cancel invoice') }
  }

  if (loading) return <LoadingSpinner fullscreen />

  if (error || !inv) return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <p className="text-red-500 font-medium">{error || 'Invoice not found'}</p>
      <button onClick={() => navigate('/billing/invoices')} className="text-amber-600 underline text-sm">
        ← Back to Invoices
      </button>
    </div>
  )

  // exact field names from Sale model
  const items        = inv.items || []
  const isCancelled  = inv.status === 'cancelled' || inv.status === 'returned'
  const grandTotal   = parseFloat(inv.total            || 0)
  const paidAmount   = parseFloat(inv.paid_amount       || 0)
  const balanceAmt   = parseFloat(inv.balance           || 0)
  const subTotal     = parseFloat(inv.subtotal          || 0)
  const taxTotal     = parseFloat((inv.cgst || 0)) + parseFloat((inv.sgst || 0)) +
                       parseFloat((inv.igst || 0)) + parseFloat((inv.cess || 0))
  const shipping     = parseFloat(inv.shipping_charges  || 0)
  const discount     = parseFloat(inv.discount_amount   || 0)
  const prevBalance  = parseFloat(inv.previous_balance || 0)
  const netPayable   = grandTotal + prevBalance
  const netBalance   = netPayable - paidAmount

  return (
    <div className="space-y-5 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/billing/invoices')}
            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-800">{inv.invoice_no || `#${id}`}</h1>
            <p className="text-xs text-gray-400">{formatDate(inv.invoice_date)}</p>
          </div>
          <span className={`text-xs px-3 py-1 rounded-full font-semibold ${getPaymentStatusColor(isCancelled ? 'cancelled' : inv.payment_status)}`}>
            {isCancelled ? inv.status : inv.payment_status}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleDownloadPDF}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">
            <Printer className="h-4 w-4" /> Print
          </button>
          <button onClick={handleDownloadPDF}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">
            <Download className="h-4 w-4" /> Download
          </button>
          <button onClick={handleSharePDF}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm">
            <Share2 className="h-4 w-4" /> Share PDF
          </button>
          {!isCancelled && (
            <>
              <button onClick={() => navigate(`/billing/invoices/${id}/edit`)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-600 text-white text-sm hover:bg-amber-700">
                <Edit2 className="h-4 w-4" /> Edit
              </button>
              <button onClick={handleCancel}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-500 text-white text-sm hover:bg-red-600">
                <XCircle className="h-4 w-4" /> Cancel
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Left col: customer + payment */}
        <div className="space-y-4">

          {/* Customer */}
          <div className="bg-white rounded-xl border border-amber-200 p-4 shadow-sm">
            <h3 className="text-xs font-bold text-amber-500 uppercase tracking-wide mb-3">Customer</h3>
            <p className="font-semibold text-slate-800">{inv.customer_name || 'Walk-in'}</p>
            {inv.customer_phone && <p className="text-sm text-slate-500 mt-1">{inv.customer_phone}</p>}
            {inv.customer?.email  && <p className="text-sm text-slate-500">{inv.customer.email}</p>}
            {inv.billing_address  && <p className="text-xs text-gray-400 mt-1">{inv.billing_address}</p>}
          </div>

          {/* Payment info */}
          <div className="bg-white rounded-xl border border-emerald-200 p-4 shadow-sm">
            <h3 className="text-xs font-bold text-emerald-600 uppercase tracking-wide mb-3">Payment</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Mode</span>
                <span className="font-semibold text-slate-800 uppercase">{inv.payment_mode || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Status</span>
                <span className="font-semibold text-slate-800 capitalize">{inv.payment_status || '—'}</span>
              </div>
              {/* Payment reference details from Payment record */}
              {(() => {
                const p = inv.payments?.[0]
                if (!p) return null
                return (
                  <>
                    {p.reference_no && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">
                          {inv.payment_mode === 'card' ? 'Card No.' : inv.payment_mode === 'cheque' ? 'Cheque No.' : 'Ref No.'}
                        </span>
                        <span className="font-medium text-slate-800">{p.reference_no}</span>
                      </div>
                    )}
                    {p.bank_name && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">
                          {inv.payment_mode === 'online' ? 'UPI App' : 'Bank'}
                        </span>
                        <span className="font-medium text-slate-800">{p.bank_name}</span>
                      </div>
                    )}
                    {p.cheque_date && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Cheque Date</span>
                        <span className="font-medium text-slate-800">{p.cheque_date}</span>
                      </div>
                    )}
                    {p.notes && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Notes</span>
                        <span className="text-slate-700 text-xs max-w-[120px] text-right">{p.notes}</span>
                      </div>
                    )}
                  </>
                )
              })()}
            </div>
          </div>

          {/* Summary totals */}
          <div className="bg-white rounded-xl border border-green-300 shadow-sm overflow-hidden">
            <div className="bg-green-600 px-4 py-2.5">
              <h3 className="text-sm font-bold text-white">Summary</h3>
            </div>
            <div className="p-4 space-y-2 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Sub Total</span>
                <span className="font-medium">{formatCurrency(subTotal)}</span>
              </div>
              {taxTotal > 0 && (
                <div className="flex justify-between text-yellow-700">
                  <span>Tax (CGST+SGST+IGST)</span>
                  <span className="font-medium">+{formatCurrency(taxTotal)}</span>
                </div>
              )}
              {shipping > 0 && (
                <div className="flex justify-between text-teal-700">
                  <span>Shipping</span>
                  <span className="font-medium">+{formatCurrency(shipping)}</span>
                </div>
              )}
              {discount > 0 && (
                <div className="flex justify-between text-green-700">
                  <span>Discount</span>
                  <span className="font-medium">−{formatCurrency(discount)}</span>
                </div>
              )}
              <div className="border-t border-slate-200 pt-2 flex justify-between font-bold text-slate-800">
                <span>Grand Total</span>
                <span className="text-green-700 text-base">{formatCurrency(grandTotal)}</span>
              </div>
              {prevBalance > 0 && (
                <>
                  <div className="flex justify-between text-orange-600 font-medium">
                    <span>Previous Balance</span>
                    <span>+{formatCurrency(prevBalance)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-slate-800 border-t border-dashed border-slate-200 pt-1">
                    <span>Net Payable</span>
                    <span className="text-orange-700">{formatCurrency(netPayable)}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between text-green-600 font-semibold">
                <span>Paid</span>
                <span>{formatCurrency(paidAmount)}</span>
              </div>
              <div className={`flex justify-between font-bold ${netBalance > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                <span>Net Balance</span>
                <span>{formatCurrency(prevBalance > 0 ? netBalance : balanceAmt)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right col: items table */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-slate-800 px-4 py-3">
              <h3 className="text-sm font-bold text-white">Items ({items.length})</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-700 uppercase">
                  <tr>
                    <th className="px-4 py-2 text-left">#</th>
                    <th className="px-4 py-2 text-left">Product</th>
                    <th className="px-4 py-2 text-right">MRP</th>
                    <th className="px-4 py-2 text-right">Unit Price</th>
                    <th className="px-4 py-2 text-right">Qty</th>
                    <th className="px-4 py-2 text-right">Tax%</th>
                    <th className="px-4 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No items</td></tr>
                  ) : items.map((item, i) => (
                    <tr key={item.id || i} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-gray-400 text-xs">{i + 1}</td>
                      <td className="px-4 py-3 font-medium text-slate-800">{item.product_name || '—'}</td>
                      <td className="px-4 py-3 text-right text-gray-500">{formatCurrency(item.mrp || 0)}</td>
                      <td className="px-4 py-3 text-right text-slate-700">{formatCurrency(item.unit_price || 0)}</td>
                      <td className="px-4 py-3 text-right text-slate-700">{parseFloat(item.quantity || 0)}</td>
                      <td className="px-4 py-3 text-right text-yellow-700">{item.tax_rate || 0}%</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-800">{formatCurrency(item.total || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
