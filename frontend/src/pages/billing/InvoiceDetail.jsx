import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Printer, Download, Edit2, XCircle, Share2, FileText, Copy, Check, X, MessageCircle, Send, Bookmark, BookmarkCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import { saleAPI, whatsappAPI } from '../../api'
import { formatCurrency, formatDate, getPaymentStatusColor } from '../../utils/formatters'
import LoadingSpinner from '../../components/common/LoadingSpinner'
export default function InvoiceDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [inv, setInv] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showShareModal, setShowShareModal] = useState(false)
  const [copied, setCopied] = useState(false)
  const [sending, setSending] = useState(false)
  const [sentOk, setSentOk] = useState(false)
  const [saved, setSaved] = useState(() => {
    try {
      const list = JSON.parse(localStorage.getItem('saved_invoices') || '[]')
      return list.some((s) => s.id === id)
    } catch { return false }
  })

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

  const handleSharePDF = () => {
    setShowShareModal(true)
    setCopied(false)
    setSentOk(false)
  }

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      toast.success('Link copied!')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for browsers that don't support clipboard API
      const input = document.createElement('input')
      input.value = window.location.href
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
      setCopied(true)
      toast.success('Link copied!')
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleShareDownload = async () => {
    try {
      toast.loading('Preparing PDF…', { id: 'share' })
      const { data } = await saleAPI.generatePDF(id)
      const blob = new Blob([data], { type: 'application/pdf' })
      const fileName = `invoice-${inv?.invoice_no || id}.pdf`
      toast.dismiss('share')
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = fileName; a.click()
      URL.revokeObjectURL(url)
      setShowShareModal(false)
    } catch {
      toast.dismiss('share')
      toast.error('Failed to generate PDF')
    }
  }

  const handleNativeShare = async () => {
    try {
      toast.loading('Preparing PDF…', { id: 'share' })
      const { data } = await saleAPI.generatePDF(id)
      const blob = new Blob([data], { type: 'application/pdf' })
      const fileName = `invoice-${inv?.invoice_no || id}.pdf`
      const file = new File([blob], fileName, { type: 'application/pdf' })
      toast.dismiss('share')
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        setShowShareModal(false)
        await navigator.share({ files: [file], title: `Invoice ${inv?.invoice_no || ''}` })
      } else {
        toast('Native sharing not supported on this browser.')
      }
    } catch (err) {
      toast.dismiss('share')
      if (err?.name !== 'AbortError') toast.error('Failed to share PDF')
    }
  }

  const handleSendToCustomer = async () => {
    const phone = inv?.customer_phone || inv?.customer?.phone
    if (!phone) {
      toast.error('No phone number found for this customer')
      return
    }
    setSending(true)
    setSentOk(false)
    try {
      await whatsappAPI.sendInvoice(id)
      setSentOk(true)
      toast.success(`PDF sent to ${phone} successfully!`)
      setTimeout(() => { setSentOk(false); setShowShareModal(false) }, 2000)
    } catch (err) {
      const msg = err?.response?.data?.message || 'Failed to send. Check customer phone number.'
      toast.error(msg)
    } finally {
      setSending(false)
    }
  }

  const handleSaveInvoice = () => {
    try {
      const list = JSON.parse(localStorage.getItem('saved_invoices') || '[]')
      if (saved) {
        const updated = list.filter((s) => s.id !== id)
        localStorage.setItem('saved_invoices', JSON.stringify(updated))
        setSaved(false)
        toast.success('Removed from Saved Invoices')
      } else {
        const entry = {
          id,
          invoice_no: inv?.invoice_no || id,
          customer_name: inv?.customer_name || 'Walk-in',
          total: inv?.total || 0,
          invoice_date: inv?.invoice_date,
          payment_status: inv?.payment_status,
          savedAt: new Date().toISOString(),
        }
        list.unshift(entry)
        localStorage.setItem('saved_invoices', JSON.stringify(list))
        setSaved(true)
        toast.success('Invoice saved!')
      }
    } catch { toast.error('Failed to save invoice') }
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

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setShowShareModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-80 p-6 relative"
            onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowShareModal(false)}
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-600">
              <X className="h-5 w-5" />
            </button>
            <div className="flex flex-col items-center gap-2 mb-5">
              <div className="bg-red-100 rounded-full p-4">
                <FileText className="h-8 w-8 text-red-500" />
              </div>
              <h2 className="text-base font-bold text-slate-800">Share Invoice</h2>
              <p className="text-xs text-gray-400 text-center">{inv?.invoice_no || `#${id}`}</p>
            </div>

            {/* Copy Link Row */}
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 mb-4">
              <span className="flex-1 text-xs text-slate-500 truncate">{window.location.href}</span>
              <button onClick={handleCopyLink}
                className="flex items-center gap-1 text-xs font-semibold text-green-600 hover:text-green-700 shrink-0">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>

            <div className="flex flex-col gap-2">
              {/* Send to Customer WhatsApp */}
              {(inv?.customer_phone || inv?.customer?.phone) ? (
                <button onClick={handleSendToCustomer} disabled={sending || sentOk}
                  className={`flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg text-white text-sm font-semibold transition-colors
                    ${sentOk ? 'bg-emerald-500' : 'bg-green-600 hover:bg-green-700'}
                    disabled:opacity-70`}>
                  {sentOk
                    ? <><Check className="h-4 w-4" /> PDF Sent Successfully!</>
                    : sending
                      ? <><Send className="h-4 w-4 animate-pulse" /> Sending…</>
                      : <><MessageCircle className="h-4 w-4" /> Send to Customer ({inv?.customer_phone || inv?.customer?.phone})</>
                  }
                </button>
              ) : (
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-700 text-xs">
                  <MessageCircle className="h-4 w-4 shrink-0" />
                  No phone number on this customer — add one to enable WhatsApp sending.
                </div>
              )}

              <button onClick={handleShareDownload}
                className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm">
                <Download className="h-4 w-4" /> Download PDF
              </button>
              {navigator.canShare && (
                <button onClick={handleNativeShare}
                  className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm">
                  <Share2 className="h-4 w-4" /> Share via Device
                </button>
              )}
            </div>
          </div>
        </div>
      )}

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
          <button onClick={handleSaveInvoice}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${saved ? 'bg-amber-500 text-white hover:bg-amber-600' : 'border border-amber-400 text-amber-600 hover:bg-amber-50'}`}>
            {saved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
            {saved ? 'Saved' : 'Save Invoice'}
          </button>
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
