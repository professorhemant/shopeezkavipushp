import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Trash2, Users, Phone, ChevronLeft, ChevronRight, MessageCircle, X, Send, Clock, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { customerAPI, whatsappAPI, saleAPI } from '../../api'
import { formatCurrency } from '../../utils/formatters'
import LoadingSpinner from '../../components/common/LoadingSpinner'

const EMPTY_FORM = { name: '', phone: '', email: '', gstin: '', billing_address: '', city: '', state: '', pincode: '', credit_limit: '', opening_balance: '' }

export default function Customers() {
  const navigate = useNavigate()
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [editingOutstanding, setEditingOutstanding] = useState(0)
  const [editingCust, setEditingCust] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [nameSuggestions, setNameSuggestions] = useState([])
  const [showNameDrop, setShowNameDrop] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState(null)
  const [waCustomer,  setWaCustomer]  = useState(null)   // customer whose history is shown
  const [waMessages,  setWaMessages]  = useState([])
  const [waLoading,   setWaLoading]   = useState(false)
  const [waSending,   setWaSending]   = useState(false)  // loading state for Send Latest Invoice
  const [expandedMsg, setExpandedMsg] = useState(null)

  const fetchCustomers = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await customerAPI.getAll({ search, page, limit: 20 })
      setCustomers(data.data || data.customers || data.results || [])
      setTotalPages(data.pagination?.pages || data.total_pages || 1)
      setTotal(data.pagination?.total || data.count || data.total || 0)
    } catch {
      toast.error('Failed to load customers')
    } finally {
      setLoading(false)
    }
  }, [search, page])

  useEffect(() => { fetchCustomers() }, [fetchCustomers])

  const openAdd = () => { setEditing(null); setEditingOutstanding(0); setEditingCust(null); setForm(EMPTY_FORM); setShowModal(true) }
  const openEdit = (c) => { setEditing(c.id); setEditingOutstanding(parseFloat(c.outstanding_balance || 0)); setEditingCust(c); setForm({ name: c.name || '', phone: c.phone || '', email: c.email || '', gstin: c.gstin || '', billing_address: c.billing_address || '', city: c.city || '', state: c.state || '', pincode: c.pincode || '', credit_limit: c.credit_limit || '', opening_balance: parseFloat(c.outstanding_balance || 0) }); setShowModal(true) }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return toast.error('Name is required')
    setSaving(true)
    try {
      const payload = {
        ...form,
        credit_limit: form.credit_limit === '' ? 0 : form.credit_limit,
        opening_balance: form.opening_balance === '' ? 0 : form.opening_balance,
      }
      if (editing) {
        const { opening_balance, ...editPayload } = payload
        await customerAPI.update(editing, editPayload)
        toast.success('Customer updated')
      } else {
        await customerAPI.create(payload)
        toast.success('Customer added')
      }
      setShowModal(false)
      fetchCustomers()
    } catch {
      toast.error('Failed to save customer')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    try {
      await customerAPI.delete(id)
      toast.success('Customer deleted')
      setDeleteId(null)
      fetchCustomers()
    } catch {
      toast.error('Failed to delete customer')
    }
  }

  const openWaModal = async (customer) => {
    setWaCustomer(customer)
    setWaMessages([])
    setExpandedMsg(null)
    setWaLoading(true)
    try {
      const { data } = await whatsappAPI.getCustomerMessages(customer.id)
      setWaMessages(data.data || [])
    } catch {
      setWaMessages([])
    } finally {
      setWaLoading(false)
    }
  }

  const sendLatestInvoice = async () => {
    if (!waCustomer) return
    setWaSending(true)
    try {
      const { data: salesRes } = await saleAPI.getAll({ customer_id: waCustomer.id, limit: 1, sort: 'created_at', order: 'desc' })
      const sales = salesRes?.data || salesRes?.sales || []
      if (!sales.length) { toast.error('No invoice found for this customer'); return }
      const { data: waRes } = await whatsappAPI.sendInvoice(sales[0].id)
      if (waRes?.message_text && waRes?.phone) {
        const digits    = String(waRes.phone).replace(/\D/g, '')
        const intlPhone = digits.startsWith('91') ? digits : `91${digits.replace(/^0/, '')}`
        // Refresh messages list
        const { data } = await whatsappAPI.getCustomerMessages(waCustomer.id)
        setWaMessages(data.data || [])
        // Return the wa.me URL — caller opens it via the anchor ref
        return `https://wa.me/${intlPhone}?text=${encodeURIComponent(waRes.message_text)}`
      }
    } catch {
      toast.error('Could not prepare invoice message')
    } finally {
      setWaSending(false)
    }
    return null
  }

  const openWaLink = (phone, text = '') => {
    const digits    = (phone || '').replace(/\D/g, '')
    const intlPhone = digits.startsWith('91') ? digits : `91${digits.replace(/^0/, '')}`
    const url       = text
      ? `https://wa.me/${intlPhone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/${intlPhone}`
    window.open(url, '_blank')
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Customers</h1>
          <p className="text-sm text-slate-500 mt-0.5">{total} total customers</p>
        </div>
        <button onClick={openAdd} className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
          <Plus className="h-4 w-4" /> Add Customer
        </button>
      </div>

      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input type="text" placeholder="Search by name, phone, GSTIN..." value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16"><LoadingSpinner size="lg" /></div>
        ) : customers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Users className="h-12 w-12 mb-3 text-gray-300" />
            <p className="text-base font-medium text-slate-500">No customers found</p>
            <button onClick={openAdd} className="mt-4 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium">Add First Customer</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Customer</th>
                  <th className="px-4 py-3 text-left">Phone</th>
                  <th className="px-4 py-3 text-left">GSTIN</th>
                  <th className="px-4 py-3 text-left">City</th>
                  <th className="px-4 py-3 text-right">Previous Balance</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.id} className="border-b hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <button onClick={() => openEdit(c)} className="font-medium text-amber-600 hover:underline text-left">{c.name}</button>
                      {c.email && <p className="text-xs text-gray-400">{c.email}</p>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      <div className="flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                        <span>{c.phone || '-'}</span>
                        {c.phone && (
                          <button
                            onClick={() => openWaModal(c)}
                            title="WhatsApp history"
                            className="ml-0.5 text-green-500 hover:text-green-600 transition-colors"
                          >
                            <MessageCircle className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 font-mono text-xs">{c.gstin || '-'}</td>
                    <td className="px-4 py-3 text-gray-600">{c.city || '-'}</td>
                    <td className="px-4 py-3 text-right font-medium text-red-600">
                      {formatCurrency(c.outstanding_balance || 0)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => setDeleteId(c.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <p className="text-sm text-slate-500">Page {page} of {totalPages}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50"><ChevronLeft className="h-4 w-4" /></button>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-800">{editing ? 'Edit Customer' : 'Add Customer'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 relative">
                  <label className="block text-xs font-medium text-slate-700 mb-1">Name *</label>
                  <input
                    value={form.name}
                    onChange={(e) => {
                      setForm({ ...form, name: e.target.value })
                      if (!editing && e.target.value.trim().length > 0) {
                        customerAPI.getAll({ search: e.target.value.trim(), limit: 5 })
                          .then(({ data }) => { setNameSuggestions(data.data || []); setShowNameDrop(true) })
                          .catch(() => {})
                      } else { setNameSuggestions([]); setShowNameDrop(false) }
                    }}
                    onBlur={() => setTimeout(() => setShowNameDrop(false), 150)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
                  />
                  {showNameDrop && nameSuggestions.length > 0 && (
                    <div
                      onMouseDown={(e) => e.preventDefault()}
                      className="absolute top-full left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-lg z-[200] mt-1 max-h-48 overflow-y-auto"
                    >
                      {nameSuggestions.map((c) => (
                        <button key={c.id} type="button"
                          onClick={() => {
                            setEditing(c.id); setEditingOutstanding(parseFloat(c.outstanding_balance || 0)); setEditingCust(c)
                            setForm({ name: c.name || '', phone: c.phone || '', email: c.email || '', gstin: c.gstin || '', billing_address: c.billing_address || '', city: c.city || '', state: c.state || '', pincode: c.pincode || '', credit_limit: c.credit_limit || '', opening_balance: parseFloat(c.outstanding_balance || 0) })
                            setShowNameDrop(false)
                          }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-amber-50 border-b border-slate-50 last:border-0">
                          <span className="font-medium text-slate-800">{c.name}</span>
                          {c.phone && <span className="text-slate-400 ml-2 text-xs">{c.phone}</span>}
                          {parseFloat(c.outstanding_balance) > 0 && <span className="float-right text-red-500 text-xs font-semibold">₹{parseFloat(c.outstanding_balance).toFixed(2)}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Phone</label>
                  <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Email</label>
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">GSTIN</label>
                  <input value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">City</label>
                  <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">State</label>
                  <input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Pincode</label>
                  <input value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">Address</label>
                  <textarea value={form.billing_address} onChange={(e) => setForm({ ...form, billing_address: e.target.value })} rows={2} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Credit Limit (₹)</label>
                  <input type="number" value={form.credit_limit} onChange={(e) => setForm({ ...form, credit_limit: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" />
                </div>
                <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      {editing ? 'Previous Balance (₹)' : 'Opening Balance (₹)'}
                    </label>
                    {editing ? (
                      <div className="w-full bg-orange-50 border border-orange-300 rounded-lg px-3 py-2 text-sm font-bold text-orange-600">
                        ₹{editingOutstanding.toFixed(2)}
                      </div>
                    ) : (
                      <input type="number" value={form.opening_balance} onChange={(e) => setForm({ ...form, opening_balance: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" />
                    )}
                  </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm">Cancel</button>
                {editing && editingCust && (
                  <button type="button" onClick={() => { setShowModal(false); navigate('/create-invoice', { state: { preselectedCustomer: editingCust } }) }} className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium">Create Invoice</button>
                )}
                <button type="submit" disabled={saving} className="flex-1 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">{saving ? 'Saving...' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* WhatsApp History Modal */}
      {waCustomer && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-green-500" />
                <div>
                  <h2 className="text-base font-semibold text-slate-800">{waCustomer.name}</h2>
                  <p className="text-xs text-slate-500">{waCustomer.phone}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Send Latest Invoice — uses data-href trick so click is synchronous (never popup-blocked) */}
                <SendInvoiceBtn
                  disabled={waSending}
                  onPrepare={sendLatestInvoice}
                />
                <button onClick={() => openWaLink(waCustomer.phone)} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs rounded-lg font-medium">
                  <MessageCircle className="h-3.5 w-3.5" /> Open Chat
                </button>
                <button onClick={() => setWaCustomer(null)} className="text-gray-400 hover:text-gray-600">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Message list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {waLoading ? (
                <div className="flex justify-center py-10 text-slate-400 text-sm">Loading messages...</div>
              ) : waMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <MessageCircle className="h-10 w-10 text-gray-200 mb-3" />
                  <p className="text-sm text-slate-500">No messages sent yet</p>
                  <p className="text-xs text-slate-400 mt-1">Messages appear here after an invoice is placed for this customer</p>
                </div>
              ) : (
                waMessages.map((msg) => (
                  <div key={msg.id} className="border border-slate-100 rounded-xl p-3 bg-slate-50">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${msg.status === 'sent' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {msg.status === 'sent' ? '✓ Sent' : '✗ Failed'}
                        </span>
                        {msg.sale_id && <span className="text-xs text-amber-600 font-mono">Invoice</span>}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-slate-400 shrink-0">
                        <Clock className="h-3 w-3" />
                        {msg.sent_at ? new Date(msg.sent_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-'}
                      </div>
                    </div>

                    <div className="mt-2">
                      <p className={`text-xs text-slate-600 whitespace-pre-wrap ${expandedMsg === msg.id ? '' : 'line-clamp-3'}`}>
                        {msg.message || ''}
                      </p>
                      {(msg.message || '').length > 120 && (
                        <button
                          onClick={() => setExpandedMsg(expandedMsg === msg.id ? null : msg.id)}
                          className="text-xs text-amber-600 hover:underline mt-1"
                        >
                          {expandedMsg === msg.id ? 'Show less' : 'Show full message'}
                        </button>
                      )}
                    </div>

                    {msg.message && (
                      <button
                        onClick={() => openWaLink(waCustomer.phone, msg.message)}
                        className="mt-2 flex items-center gap-1 text-xs text-green-600 hover:underline"
                      >
                        <Send className="h-3 w-3" /> Resend this message
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 shadow-xl w-full max-w-sm mx-4">
            <h3 className="font-semibold text-slate-800 mb-1">Delete Customer</h3>
            <p className="text-sm text-slate-500 mb-5">This will permanently delete the customer record.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm">Cancel</button>
              <button onClick={() => handleDelete(deleteId)} className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Button that fetches the invoice URL then opens WhatsApp — works because
// we store the URL and open it via a hidden anchor clicked in the same handler
function SendInvoiceBtn({ onPrepare, disabled }) {
  const [loading, setLoading] = useState(false)
  const anchorRef = useRef(null)

  const handleClick = async () => {
    if (loading || disabled) return
    setLoading(true)
    const url = await onPrepare()
    setLoading(false)
    if (url && anchorRef.current) {
      anchorRef.current.href = url
      anchorRef.current.click()
    }
  }

  return (
    <>
      <a ref={anchorRef} href="#" target="_blank" rel="noreferrer" className="hidden" aria-hidden="true">wa</a>
      <button
        onClick={handleClick}
        disabled={loading || disabled}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 hover:bg-green-600 disabled:opacity-60 text-white text-xs rounded-lg font-medium"
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
        {loading ? 'Preparing…' : 'Send Invoice'}
      </button>
    </>
  )
}
