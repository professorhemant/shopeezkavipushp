import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import { purchaseAPI, supplierAPI, productAPI } from '../../api'
import { formatCurrency } from '../../utils/formatters'
import LoadingSpinner from '../../components/common/LoadingSpinner'

const TAX_RATES = [0, 5, 12, 18, 28]
const PAYMENT_MODES = ['cash', 'upi', 'card', 'bank', 'cheque']

function newItem() {
  return {
    _id: Date.now(), product: '', product_name: '', hsn_code: '',
    qty: 1, unit: 'pcs', price: 0, discount_pct: 0,
    tax_rate: 18, cgst: 0, sgst: 0, total: 0,
    batch_no: '', expiry_date: '',
  }
}

function calcItem(item) {
  const gross = parseFloat(item.qty || 0) * parseFloat(item.price || 0)
  const discAmt = (gross * parseFloat(item.discount_pct || 0)) / 100
  const taxable = gross - discAmt
  const taxRate = parseFloat(item.tax_rate || 0)
  const taxAmt = (taxable * taxRate) / 100
  const cgst = taxAmt / 2
  const sgst = taxAmt / 2
  return { ...item, discount_amt: discAmt, cgst, sgst, total: taxable + taxAmt, taxable }
}

export default function CreatePurchase() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdit = Boolean(id)

  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [suppliers, setSuppliers] = useState([])
  const [products, setProducts] = useState([])
  const [selectedSupplier, setSelectedSupplier] = useState(null)
  const [supplierSearch, setSupplierSearch] = useState('')
  const [showSupplierDrop, setShowSupplierDrop] = useState(false)
  const [billNo, setBillNo] = useState('')
  const [billDate, setBillDate] = useState(new Date().toISOString().slice(0, 10))
  const [dueDate, setDueDate] = useState('')
  const [items, setItems] = useState([newItem()])
  const [shipping, setShipping] = useState(0)
  const [paidAmount, setPaidAmount] = useState(0)
  const [paymentMode, setPaymentMode] = useState('bank')
  const [notes, setNotes] = useState('')
  const [activeItemSearch, setActiveItemSearch] = useState(null)
  const [productSearch, setProductSearch] = useState('')

  useEffect(() => {
    supplierAPI.getAll({ limit: 200 }).then(({ data }) => setSuppliers(data.data || data.suppliers || data.results || [])).catch(() => {})
    productAPI.getAll({ limit: 500 }).then(({ data }) => setProducts(data.data || data.products || data.results || [])).catch(() => {})
    if (isEdit) {
      purchaseAPI.getOne(id).then(({ data }) => {
        const p = data.purchase || data
        setBillNo(p.bill_no || '')
        setBillDate(p.bill_date?.slice(0, 10) || '')
        setDueDate(p.due_date?.slice(0, 10) || '')
        setItems(p.items?.map((item) => ({ ...item, _id: Date.now() + Math.random() })) || [newItem()])
        setPaidAmount(p.paid_amount || 0)
        setPaymentMode(p.payment_mode || 'bank')
        setNotes(p.notes || '')
      }).catch(() => toast.error('Failed to load purchase'))
        .finally(() => setLoading(false))
    }
  }, [id, isEdit])

  const filteredSuppliers = supplierSearch
    ? suppliers.filter((s) => (s.name + s.phone).toLowerCase().includes(supplierSearch.toLowerCase()))
    : suppliers.slice(0, 8)

  const filteredProducts = productSearch
    ? products.filter((p) => (p.name + (p.sku || '')).toLowerCase().includes(productSearch.toLowerCase()))
    : products.slice(0, 8)

  const updateItem = (idx, field, val) => {
    setItems((prev) => {
      const next = [...prev]
      next[idx] = calcItem({ ...next[idx], [field]: val })
      return next
    })
  }

  const selectProduct = (idx, product) => {
    setItems((prev) => {
      const next = [...prev]
      next[idx] = calcItem({
        ...next[idx],
        product: product.id, product_name: product.name,
        hsn_code: product.hsn_code || '',
        price: parseFloat(product.purchase_price || 0),
        tax_rate: product.tax_rate ?? 18,
        unit: product.unit_symbol || 'pcs',
      })
      return next
    })
    setActiveItemSearch(null)
    setProductSearch('')
  }

  const totals = items.reduce((acc, item) => ({
    subtotal: acc.subtotal + (parseFloat(item.qty || 0) * parseFloat(item.price || 0)),
    discount: acc.discount + parseFloat(item.discount_amt || 0),
    taxable: acc.taxable + parseFloat(item.taxable || 0),
    cgst: acc.cgst + parseFloat(item.cgst || 0),
    sgst: acc.sgst + parseFloat(item.sgst || 0),
    itemsTotal: acc.itemsTotal + parseFloat(item.total || 0),
  }), { subtotal: 0, discount: 0, taxable: 0, cgst: 0, sgst: 0, itemsTotal: 0 })

  const grandTotal = totals.itemsTotal + parseFloat(shipping || 0)
  const balance = grandTotal - parseFloat(paidAmount || 0)

  const handleSave = async () => {
    const validItems = items.filter((it) => it.product || it.product_name?.trim())
    if (!validItems.length) { toast.error('Add at least one item'); return }
    setSaving(true)
    try {
      const payload = {
        supplier: selectedSupplier?.id, bill_no: billNo,
        bill_date: billDate, due_date: dueDate,
        items: validItems.map(({ _id, ...rest }) => rest),
        subtotal: totals.subtotal, discount: totals.discount,
        taxable_amount: totals.taxable,
        cgst: totals.cgst, sgst: totals.sgst,
        shipping_charges: shipping,
        total_amount: grandTotal, paid_amount: paidAmount,
        balance_amount: balance, payment_mode: paymentMode, notes,
      }
      if (isEdit) { await purchaseAPI.update(id, payload); toast.success('Purchase updated') }
      else { await purchaseAPI.create(payload); toast.success('Purchase created') }
      navigate('/purchases')
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save purchase')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <LoadingSpinner fullscreen />

  return (
    <div className="space-y-5 max-w-6xl">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-gray-100"><ArrowLeft className="h-5 w-5 text-gray-600" /></button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{isEdit ? 'Edit Purchase' : 'New Purchase Bill'}</h1>
          <p className="text-sm text-slate-500 mt-0.5">Record supplier invoice</p>
        </div>
      </div>

      <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Supplier</label>
            <div className="relative">
              <input type="text"
                value={selectedSupplier ? selectedSupplier.name : supplierSearch}
                onChange={(e) => { setSupplierSearch(e.target.value); setSelectedSupplier(null); setShowSupplierDrop(true) }}
                onFocus={() => setShowSupplierDrop(true)}
                placeholder="Search supplier..."
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" />
              {showSupplierDrop && filteredSuppliers.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-lg z-30 max-h-48 overflow-y-auto mt-1">
                  {filteredSuppliers.map((s) => (
                    <button key={s.id} onClick={() => { setSelectedSupplier(s); setShowSupplierDrop(false); setSupplierSearch('') }}
                      className="w-full text-left px-3 py-2 hover:bg-slate-50 text-sm">
                      <p className="font-medium">{s.name}</p>
                      <p className="text-xs text-gray-400">{s.phone} {s.gstin ? `· ${s.gstin}` : ''}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Bill No</label>
            <input value={billNo} onChange={(e) => setBillNo(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
              placeholder="Supplier's bill number" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Bill Date</label>
            <input type="date" value={billDate} onChange={(e) => setBillDate(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Due Date</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" />
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100"><h2 className="font-semibold text-slate-800">Items</h2></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
              <tr>
                <th className="px-3 py-2.5 text-left w-44">Product</th>
                <th className="px-3 py-2.5 text-left w-20">HSN</th>
                <th className="px-3 py-2.5 text-right w-14">Qty</th>
                <th className="px-3 py-2.5 text-right w-24">Price</th>
                <th className="px-3 py-2.5 text-right w-16">Disc%</th>
                <th className="px-3 py-2.5 text-right w-16">Tax%</th>
                <th className="px-3 py-2.5 text-right w-16">CGST</th>
                <th className="px-3 py-2.5 text-right w-16">SGST</th>
                <th className="px-3 py-2.5 text-left w-24">Batch No</th>
                <th className="px-3 py-2.5 text-left w-28">Expiry</th>
                <th className="px-3 py-2.5 text-right w-24">Total</th>
                <th className="px-3 py-2.5 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={item._id} className="border-b border-slate-100">
                  <td className="px-3 py-2">
                    <div className="relative">
                      <input
                        value={activeItemSearch === idx ? productSearch : item.product_name}
                        onChange={(e) => { setProductSearch(e.target.value); setActiveItemSearch(idx); updateItem(idx, 'product_name', e.target.value) }}
                        onFocus={() => { setActiveItemSearch(idx); setProductSearch(item.product_name) }}
                        onBlur={() => setTimeout(() => setActiveItemSearch(null), 200)}
                        placeholder="Search or type name..."
                        className="w-full border border-slate-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500/30 focus:border-amber-500" />
                      {activeItemSearch === idx && productSearch && filteredProducts.length > 0 && (
                        <div className="absolute top-full left-0 bg-white border border-slate-200 rounded-lg shadow-lg z-30 max-h-40 overflow-y-auto min-w-[180px]">
                          {filteredProducts.map((p) => (
                            <button key={p.id} onClick={() => selectProduct(idx, p)} className="w-full text-left px-3 py-2 hover:bg-slate-50 text-xs">
                              <p className="font-medium">{p.name}</p>
                              <p className="text-gray-400">₹{p.purchase_price}</p>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2"><input value={item.hsn_code} onChange={(e) => updateItem(idx, 'hsn_code', e.target.value)} className="w-full border border-slate-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500/30 focus:border-amber-500" /></td>
                  <td className="px-3 py-2"><input type="number" min="1" value={item.qty} onChange={(e) => updateItem(idx, 'qty', parseFloat(e.target.value) || 1)} className="w-full border border-slate-200 rounded px-2 py-1.5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-amber-500/30 focus:border-amber-500" /></td>
                  <td className="px-3 py-2"><input type="number" min="0" step="0.01" value={item.price} onChange={(e) => updateItem(idx, 'price', parseFloat(e.target.value) || 0)} className="w-full border border-slate-200 rounded px-2 py-1.5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-amber-500/30 focus:border-amber-500" /></td>
                  <td className="px-3 py-2"><input type="number" min="0" max="100" value={item.discount_pct} onChange={(e) => updateItem(idx, 'discount_pct', parseFloat(e.target.value) || 0)} className="w-full border border-slate-200 rounded px-2 py-1.5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-amber-500/30 focus:border-amber-500" /></td>
                  <td className="px-3 py-2">
                    <select value={item.tax_rate} onChange={(e) => updateItem(idx, 'tax_rate', parseFloat(e.target.value))} className="w-full border border-slate-200 rounded px-1 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500/30 focus:border-amber-500">
                      {TAX_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2 text-right text-xs text-slate-600">{(item.cgst || 0).toFixed(2)}</td>
                  <td className="px-3 py-2 text-right text-xs text-slate-600">{(item.sgst || 0).toFixed(2)}</td>
                  <td className="px-3 py-2"><input value={item.batch_no} onChange={(e) => updateItem(idx, 'batch_no', e.target.value)} className="w-full border border-slate-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500/30 focus:border-amber-500" placeholder="Batch" /></td>
                  <td className="px-3 py-2"><input type="date" value={item.expiry_date} onChange={(e) => updateItem(idx, 'expiry_date', e.target.value)} className="w-full border border-slate-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500/30 focus:border-amber-500" /></td>
                  <td className="px-3 py-2 text-right font-medium text-slate-800 text-xs">{(item.total || 0).toFixed(2)}</td>
                  <td className="px-3 py-2">
                    {items.length > 1 && <button onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))} className="p-1 hover:bg-red-50 text-gray-300 hover:text-red-500 rounded"><Trash2 className="h-3.5 w-3.5" /></button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-3 border-t border-slate-100">
          <button onClick={() => setItems((prev) => [...prev, newItem()])} className="text-sm text-amber-600 hover:text-amber-700 flex items-center gap-1.5 font-medium">
            <Plus className="h-4 w-4" /> Add Item
          </button>
        </div>
      </div>

      {/* Summary + Payment */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 space-y-2">
          <h2 className="font-semibold text-slate-800 mb-3">Summary</h2>
          {[
            { label: 'Subtotal', value: totals.subtotal },
            { label: 'Discount', value: totals.discount, color: 'text-red-600' },
            { label: 'Taxable Amount', value: totals.taxable, bold: true },
            { label: 'CGST', value: totals.cgst },
            { label: 'SGST', value: totals.sgst },
          ].map(({ label, value, color, bold }) => (
            <div key={label} className="flex justify-between text-sm">
              <span className="text-slate-500">{label}</span>
              <span className={`font-${bold ? 'semibold' : 'medium'} ${color || 'text-slate-800'}`}>{formatCurrency(value)}</span>
            </div>
          ))}
          <div className="flex justify-between text-sm items-center">
            <span className="text-slate-500">Shipping</span>
            <input type="number" min="0" value={shipping} onChange={(e) => setShipping(parseFloat(e.target.value) || 0)}
              className="w-24 border border-slate-200 rounded px-2 py-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-amber-500/30 focus:border-amber-500" />
          </div>
          <div className="border-t border-slate-100 pt-2 flex justify-between font-bold">
            <span>Grand Total</span>
            <span className="text-xl text-amber-600">{formatCurrency(grandTotal)}</span>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 space-y-3">
          <h2 className="font-semibold text-slate-800">Payment</h2>
          <div>
            <label className="block text-sm text-slate-500 mb-1">Payment Mode</label>
            <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500">
              {PAYMENT_MODES.map((m) => <option key={m} value={m}>{m.toUpperCase()}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-slate-500 mb-1">Paid Amount</label>
            <input type="number" min="0" value={paidAmount} onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" />
          </div>
          <div className="flex justify-between text-sm font-semibold">
            <span>Balance Payable</span>
            <span className={balance > 0 ? 'text-red-600' : 'text-green-600'}>{formatCurrency(balance)}</span>
          </div>
          <div>
            <label className="block text-sm text-slate-500 mb-1">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" placeholder="Internal notes..." />
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <button onClick={() => navigate(-1)} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm">Cancel</button>
        <button onClick={handleSave} disabled={saving}
          className="bg-amber-600 hover:bg-amber-700 text-white px-6 py-2 rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-60">
          {saving ? <LoadingSpinner size="sm" /> : <Save className="h-4 w-4" />}
          {isEdit ? 'Update Purchase' : 'Save Purchase'}
        </button>
      </div>
    </div>
  )
}
