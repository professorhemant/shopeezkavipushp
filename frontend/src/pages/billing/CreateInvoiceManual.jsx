import { useEffect, useState, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  X, Truck, Trash2, Plus, Calendar, Info, Banknote,
  CreditCard, Smartphone, FileText, RefreshCw
} from 'lucide-react'
import toast from 'react-hot-toast'
import { saleAPI, customerAPI, whatsappAPI, settingsAPI } from '../../api'
import LoadingSpinner from '../../components/common/LoadingSpinner'

function newRow() {
  return {
    _id: Date.now() + Math.random(),
    item_name: '',
    item_code: '',
    qty: 1,
    mrp: 0,
    unit_price: 0,
    tax_rate: 0,
    tax_amt: 0,
    total_before: 0,
    total_after: 0,
  }
}

function calcRow(r) {
  const qty        = parseFloat(r.qty)        || 0
  const unit_price = parseFloat(r.unit_price) || 0
  const tax_rate   = parseFloat(r.tax_rate)   || 0
  const total_before = qty * unit_price
  const tax_amt      = (total_before * tax_rate) / 100
  const total_after  = total_before + tax_amt
  return { ...r, tax_amt, total_before, total_after }
}

export default function CreateInvoiceManual() {
  const navigate   = useNavigate()
  const waAnchorRef = useRef(null)

  const [waModal, setWaModal] = useState(null)

  // customer
  const [custSearch,      setCustSearch]      = useState('')
  const [custResults,     setCustResults]     = useState([])
  const [showCustDrop,    setShowCustDrop]    = useState(false)
  const [selectedCust,    setSelectedCust]    = useState(null)
  const [prevBalanceInput, setPrevBalanceInput] = useState('')

  // invoice meta
  const [invoiceNo,   setInvoiceNo]   = useState('')
  const [invoiceDate, setInvoiceDate] = useState(new Date().toLocaleDateString('en-IN'))

  // rows
  const [rows, setRows] = useState([newRow()])

  // order type
  const [orderType, setOrderType] = useState('takeaway')

  // totals / discount
  const [shipping,        setShipping]        = useState(0)
  const [discountType,    setDiscountType]    = useState('after_tax')
  const [discountMode,    setDiscountMode]    = useState('percent')
  const [discountVal,     setDiscountVal]     = useState('')
  const [discountApplied, setDiscountApplied] = useState(0)
  const [coupon,          setCoupon]          = useState('')

  // payment
  const [splitPay,       setSplitPay]       = useState({ cash: '', card: '', upi: '', cheque: '' })
  const [cardDetails,    setCardDetails]    = useState({ last4: '', bank: '', authCode: '' })
  const [upiDetails,     setUpiDetails]     = useState({ ref: '', app: '' })
  const [chequeDetails,  setChequeDetails]  = useState({ no: '', bank: '', date: '' })
  const [activePayPopup, setActivePayPopup] = useState(null)
  const [showUpiOptions, setShowUpiOptions] = useState(false)
  const [showQrModal,    setShowQrModal]    = useState(false)
  const [upiIds,         setUpiIds]         = useState({ upi1: 'kavipushpjewels@oksbi', upi2: 'Kavipushpbank@okhdfcbank' })
  const [saving,         setSaving]         = useState(false)

  // ── load next invoice no + settings ──────────────────────────
  useEffect(() => {
    saleAPI.getNextInvoiceNo()
      .then(({ data }) => setInvoiceNo(data.invoice_no || data.next_number || 'KPJ-/0001'))
      .catch(() => {})
    settingsAPI.getSettings()
      .then(({ data }) => {
        const s = data.data || data.settings || data
        if (s.payment_upi_id || s.payment_upi_id_2)
          setUpiIds({ upi1: s.payment_upi_id || '', upi2: s.payment_upi_id_2 || '' })
      }).catch(() => {})
  }, [])

  // ── customer search ───────────────────────────────────────────
  useEffect(() => {
    if (!custSearch.trim()) { setCustResults([]); return }
    customerAPI.getAll({ search: custSearch, limit: 8 })
      .then(({ data }) => setCustResults(data.data || data.customers || []))
      .catch(() => {})
  }, [custSearch])

  // ── row helpers ───────────────────────────────────────────────
  const updateRow = (idx, field, val) => {
    setRows((prev) => {
      const next = [...prev]
      next[idx] = calcRow({ ...next[idx], [field]: val })
      return next
    })
  }

  const removeRow = (idx) => {
    setRows((prev) => {
      const next = prev.filter((_, i) => i !== idx)
      return next.length ? next : [newRow()]
    })
  }

  // ── computed totals ───────────────────────────────────────────
  const totalQty   = rows.reduce((s, r) => s + (parseFloat(r.qty) || 0), 0)
  const totalItems = rows.filter((r) => r.item_name.trim()).length
  const subTotal   = rows.reduce((s, r) => s + (r.total_before || 0), 0)
  const totalTax   = rows.reduce((s, r) => s + (r.tax_amt || 0), 0)
  const prevBalance = parseFloat(prevBalanceInput) || 0
  const shippingAmt = parseFloat(shipping || 0)

  const discountOnSubtotal = discountType === 'before_tax' ? Math.min(discountApplied, subTotal) : 0
  const discountOnTotal    = discountType === 'after_tax'  ? discountApplied : 0
  const effectiveTax       = discountType === 'before_tax' && subTotal > 0
    ? parseFloat((totalTax * Math.max(0, subTotal - discountOnSubtotal) / subTotal).toFixed(2))
    : totalTax
  const grandTotal  = subTotal - discountOnSubtotal + effectiveTax + shippingAmt - discountOnTotal
  const netPayable  = grandTotal + prevBalance
  const totalSplitPaid = ['cash','card','upi','cheque'].reduce((s, m) => s + (parseFloat(splitPay[m]) || 0), 0)
  const splitBalance = Math.max(0, netPayable - totalSplitPaid)

  const applyDiscount = () => {
    const val = parseFloat(discountVal) || 0
    const base = discountType === 'before_tax' ? subTotal : (subTotal + totalTax + shippingAmt)
    if (discountMode === 'percent') {
      setDiscountApplied(parseFloat(((base * val) / 100).toFixed(2)))
    } else {
      setDiscountApplied(parseFloat(val.toFixed(2)))
    }
  }

  // ── place order ───────────────────────────────────────────────
  const handlePlaceOrder = async () => {
    const validRows = rows.filter((r) => r.item_name.trim())
    if (!validRows.length) { toast.error('Add at least one item'); return }
    setSaving(true)
    try {
      const splitPayments = Object.entries(splitPay)
        .filter(([, v]) => parseFloat(v) > 0)
        .map(([mode, v]) => ({
          mode, amount: parseFloat(v),
          reference_no: mode === 'card' ? (cardDetails.last4 ? `XXXX-${cardDetails.last4}` : cardDetails.authCode || null)
            : mode === 'upi' ? (upiDetails.ref || null)
            : mode === 'cheque' ? (chequeDetails.no || null) : null,
          bank_name: mode === 'card' ? (cardDetails.bank || null)
            : mode === 'upi' ? (upiDetails.app || null)
            : mode === 'cheque' ? (chequeDetails.bank || null) : null,
          cheque_date: mode === 'cheque' ? (chequeDetails.date || null) : null,
        }))
      const primaryMode = splitPayments.length === 1 ? splitPayments[0].mode
        : splitPayments.length > 1 ? 'split' : 'unpaid'
      const payload = {
        customer_id: selectedCust?.id || null,
        customer_name: selectedCust?.name || custSearch.trim() || 'Walk-in',
        mobile: selectedCust?.phone || selectedCust?.mobile || '',
        invoice_no: invoiceNo,
        invoice_date: new Date().toISOString().slice(0, 10),
        order_type: orderType,
        items: validRows.map((r) => ({
          product_id: null,
          product_name: r.item_name.trim(),
          batch: r.item_code.trim() || null,
          quantity: parseFloat(r.qty) || 1,
          mrp: parseFloat(r.mrp) || 0,
          unit_price: parseFloat(r.unit_price) || 0,
          tax_rate: parseFloat(r.tax_rate) || 0,
          tax_amount: r.tax_amt || 0,
          total: r.total_after || 0,
        })),
        subtotal: subTotal,
        tax_total: totalTax,
        shipping_charges: parseFloat(shipping) || 0,
        discount_amount: parseFloat((subTotal + totalTax - (grandTotal - shippingAmt)).toFixed(2)),
        grand_total: grandTotal,
        status: 'confirmed',
        payment: { mode: primaryMode, amount: totalSplitPaid },
        payments: splitPayments,
      }
      const { data: saleRes } = await saleAPI.create(payload)
      toast.success('Order placed!')
      const saleId    = saleRes?.data?.id || saleRes?.id
      const custPhone = selectedCust?.phone || selectedCust?.mobile
      if (saleId && custPhone) {
        try {
          const { data: waRes } = await whatsappAPI.sendInvoice(saleId)
          const msgText = waRes?.message_text
          const phone   = waRes?.phone || custPhone
          if (msgText && phone) {
            const digits    = String(phone).replace(/\D/g, '')
            const intlPhone = digits.startsWith('91') ? digits : `91${digits.replace(/^0/, '')}`
            setWaModal({ url: `https://wa.me/${intlPhone}?text=${encodeURIComponent(msgText)}`, customerName: selectedCust?.name || 'Customer' })
            return
          }
        } catch { /* non-critical */ }
      }
      navigate('/billing/invoices')
    } catch (err) {
      toast.error(err?.response?.data?.error || err?.response?.data?.message || err.message || 'Failed to place order')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col min-h-full pb-16 -m-4 lg:-m-6 bg-white">

      {/* ── Row 1: Customer search | Action buttons ── */}
      <div className="flex items-center gap-2 px-3 py-2 border-b-2 border-amber-200 bg-amber-50/40 flex-wrap">

        {/* Customer search / selected chip */}
        <div className="relative flex-1 min-w-[220px]">
          {selectedCust ? (
            <div className="flex flex-col gap-1 border-2 border-amber-400 rounded-lg px-2 py-1.5 bg-amber-50">
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="text-xs font-semibold text-slate-800 truncate">{selectedCust.name}</span>
                  {(selectedCust.phone || selectedCust.mobile) && (
                    <span className="text-xs text-slate-500">{selectedCust.phone || selectedCust.mobile}</span>
                  )}
                </div>
                <button
                  onClick={() => { setSelectedCust(null); setCustSearch(''); setPrevBalanceInput('') }}
                  className="text-gray-400 hover:text-red-500 shrink-0"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-red-600 font-medium whitespace-nowrap">Prev. Balance ₹</span>
                <input
                  type="number" min="0"
                  value={prevBalanceInput}
                  onChange={(e) => setPrevBalanceInput(e.target.value)}
                  placeholder="0"
                  className="w-24 border border-red-300 rounded px-1.5 py-0.5 text-xs text-red-700 font-semibold bg-white focus:outline-none focus:ring-1 focus:ring-red-400"
                />
              </div>
            </div>
          ) : (
            <input
              type="text"
              value={custSearch}
              onChange={(e) => { setCustSearch(e.target.value); setShowCustDrop(true) }}
              onFocus={() => setShowCustDrop(true)}
              onBlur={() => setTimeout(() => setShowCustDrop(false), 180)}
              placeholder="Search customer by name or mobile"
              className="w-full border-2 border-amber-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-500 bg-white"
            />
          )}
          {showCustDrop && custResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded shadow-lg z-40 max-h-48 overflow-y-auto">
              {custResults.map((c) => (
                <button key={c.id}
                  onMouseDown={() => {
                    setCustSearch('')
                    setShowCustDrop(false)
                    const initialBal = parseFloat(c.outstanding_balance || c.opening_balance || 0)
                    setPrevBalanceInput(initialBal > 0 ? String(initialBal) : '')
                    customerAPI.getOne(c.id)
                      .then(({ data }) => {
                        const full = data.data || data.customer || data
                        setSelectedCust({ ...c, ...full })
                        const bal = parseFloat(full.outstanding_balance || full.opening_balance || 0)
                        setPrevBalanceInput(bal > 0 ? String(bal) : '')
                      })
                      .catch(() => setSelectedCust(c))
                  }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-amber-50 border-b border-gray-50 last:border-0"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <span className="font-medium text-slate-800">{c.name}</span>
                      {(c.mobile || c.phone) && (
                        <span className="text-gray-400 ml-2">{c.mobile || c.phone}</span>
                      )}
                    </div>
                    {parseFloat(c.outstanding_balance) > 0 && (
                      <span className="text-red-500 font-medium shrink-0">₹{parseFloat(c.outstanding_balance).toFixed(2)}</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1 flex-wrap">
          <button
            onClick={() => setOrderType('takeaway')}
            className={`px-3 py-1.5 text-xs font-semibold rounded ${orderType === 'takeaway' ? 'bg-orange-500 text-white' : 'border border-orange-500 text-orange-600 hover:bg-orange-50'}`}
          >
            TAKE AWAY
          </button>
          <button
            onClick={() => setOrderType('delivery')}
            className={`flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded ${orderType === 'delivery' ? 'bg-amber-600 text-white' : 'border border-amber-500 text-amber-600 hover:bg-amber-50'}`}
          >
            <Truck className="h-3 w-3" /> DELIVERY
          </button>
          <button
            onClick={() => setRows((prev) => [...prev, newRow()])}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            <Plus className="h-3 w-3" /> ADD ITEM
          </button>
          <button
            onClick={() => { setRows([newRow()]); setSelectedCust(null); setCustSearch(''); setPrevBalanceInput('') }}
            className="p-1.5 rounded bg-red-500 text-white hover:bg-red-600"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* ── Row 2: Invoice No | Invoice Date ── */}
      <div className="flex items-center gap-2 px-3 py-2 border-b-2 border-slate-200 bg-slate-50/40 flex-wrap">
        <span className="text-xs text-amber-700 font-bold">MANUAL INVOICE</span>
        <div className="flex items-center gap-1 ml-auto">
          <span className="text-xs text-amber-700 font-semibold whitespace-nowrap">Invoice No.</span>
          <input
            type="text"
            value={invoiceNo}
            onChange={(e) => setInvoiceNo(e.target.value)}
            className="w-28 border-2 border-amber-300 rounded-lg px-2 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-500 bg-white"
          />
          <button className="p-1.5 bg-green-500 hover:bg-green-600 rounded text-white">
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-amber-700 font-semibold whitespace-nowrap">Invoice Date</span>
          <input
            type="text"
            value={invoiceDate}
            readOnly
            className="w-28 border-2 border-amber-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none bg-amber-50"
          />
          <button className="p-1.5 border-2 border-amber-300 rounded-lg text-amber-600 hover:bg-amber-50">
            <Calendar className="h-3.5 w-3.5" />
          </button>
          <button className="p-1.5 border-2 border-amber-300 rounded-lg text-amber-600 hover:bg-amber-50">
            <Info className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* ── Main: Table (left) + Totals (right) ── */}
      <div className="flex flex-1 gap-0 divide-x divide-slate-200 overflow-hidden">

        {/* LEFT: manual items table */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="overflow-x-auto flex-1">
            <table className="text-xs border-collapse" style={{ tableLayout: 'fixed', width: '100%' }}>
              <colgroup>
                <col style={{ width: '28px' }} />
                <col style={{ width: '160px' }} />
                <col style={{ width: '110px' }} />
                <col style={{ width: '50px' }} />
                <col style={{ width: '80px' }} />
                <col style={{ width: '90px' }} />
                <col style={{ width: '65px' }} />
                <col style={{ width: '100px' }} />
                <col style={{ width: '100px' }} />
                <col style={{ width: '28px' }} />
              </colgroup>
              <thead className="bg-slate-800 sticky top-0">
                <tr className="border-b-2 border-slate-600">
                  <th className="px-2 py-2 text-left text-slate-200 font-medium">#</th>
                  <th className="px-2 py-2 text-left text-slate-200 font-medium">Item Name</th>
                  <th className="px-2 py-2 text-left text-slate-200 font-medium">Code / Barcode</th>
                  <th className="px-2 py-2 text-center text-slate-200 font-medium">Qty</th>
                  <th className="px-2 py-2 text-right text-slate-200 font-medium">MRP</th>
                  <th className="px-2 py-2 text-right text-slate-200 font-medium">Unit Price</th>
                  <th className="px-2 py-2 text-right text-slate-200 font-medium">Tax %</th>
                  <th className="px-2 py-2 text-right text-slate-200 font-medium">
                    Total <span className="text-slate-300 font-normal">(Before Tax)</span>
                  </th>
                  <th className="px-2 py-2 text-right text-slate-200 font-medium">Total (After Tax)</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr key={row._id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-2 py-1.5 text-gray-400">{idx + 1}</td>

                    {/* Item Name */}
                    <td className="px-2 py-1.5">
                      <input
                        type="text"
                        value={row.item_name}
                        onChange={(e) => updateRow(idx, 'item_name', e.target.value)}
                        placeholder="Item name..."
                        className="w-full border-2 border-amber-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 bg-white"
                      />
                    </td>

                    {/* Code / Barcode */}
                    <td className="px-2 py-1.5">
                      <input
                        type="text"
                        value={row.item_code}
                        onChange={(e) => updateRow(idx, 'item_code', e.target.value)}
                        placeholder="Code/Barcode"
                        className="w-full border-2 border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-slate-400 bg-white"
                      />
                    </td>

                    {/* Qty */}
                    <td className="px-2 py-1.5">
                      <input type="number" min="1" step="1" value={row.qty}
                        onChange={(e) => updateRow(idx, 'qty', e.target.value)}
                        className="w-full border-2 border-amber-300 rounded-lg px-2 py-1 text-xs text-center focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-500 bg-white"
                      />
                    </td>

                    {/* MRP */}
                    <td className="px-2 py-1.5">
                      <input type="number" min="0" step="0.01" value={row.mrp}
                        onChange={(e) => updateRow(idx, 'mrp', e.target.value)}
                        className="w-full border-2 border-amber-300 rounded-lg px-2 py-1 text-xs text-right focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-500 bg-white"
                      />
                    </td>

                    {/* Unit Price */}
                    <td className="px-2 py-1.5">
                      <input type="number" min="0" step="0.01" value={row.unit_price}
                        onChange={(e) => updateRow(idx, 'unit_price', e.target.value)}
                        className="w-full border-2 border-orange-300 rounded-lg px-2 py-1 text-xs text-right focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-500 bg-white"
                      />
                    </td>

                    {/* Tax % */}
                    <td className="px-2 py-1.5">
                      <input type="number" min="0" max="28" step="0.01" value={row.tax_rate}
                        onChange={(e) => updateRow(idx, 'tax_rate', e.target.value)}
                        className="w-full border-2 border-amber-300 rounded-lg px-2 py-1 text-xs text-right focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-500 bg-white"
                      />
                    </td>

                    {/* Total Before Tax */}
                    <td className="px-2 py-1.5 text-right">
                      <span className="inline-block w-full text-right text-xs font-semibold text-indigo-700 bg-indigo-50 border-2 border-indigo-300 rounded-lg px-2 py-1">{(row.total_before || 0).toFixed(2)}</span>
                    </td>

                    {/* Total After Tax */}
                    <td className="px-2 py-1.5 text-right">
                      <span className="inline-block w-full text-right text-xs font-bold text-green-700 bg-green-50 border-2 border-green-400 rounded-lg px-2 py-1">{(row.total_after || 0).toFixed(2)}</span>
                    </td>

                    {/* Remove */}
                    <td className="px-2 py-1.5">
                      <button onClick={() => removeRow(idx)}
                        className="text-gray-300 hover:text-red-500 p-0.5 rounded hover:bg-red-50">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer bar */}
          <div className="flex items-center gap-3 px-3 py-2 border-t border-slate-200 bg-slate-50">
            <button
              onClick={() => setRows((prev) => [...prev, newRow()])}
              className="flex items-center gap-1 px-3 py-1 text-xs bg-amber-500 text-white rounded hover:bg-amber-600 font-medium"
            >
              <Plus className="h-3 w-3" /> Add Row
            </button>
            <Link to="/daybook/sales"
              className="px-3 py-1 text-xs bg-slate-600 text-white rounded hover:bg-slate-700 font-medium">
              Back to Day Book
            </Link>
          </div>
        </div>

        {/* RIGHT: totals panel */}
        <div className="w-72 shrink-0 flex flex-col overflow-y-auto border-l-2 border-amber-200">

          {/* Panel Header */}
          <div className="bg-slate-800 px-4 py-3 shrink-0">
            <h3 className="text-sm font-bold text-white tracking-wide">Order Summary</h3>
          </div>

          {/* Qty / Items */}
          <div className="flex bg-amber-50 border-b-2 border-amber-200 shrink-0">
            <div className="flex-1 flex flex-col items-center py-3 border-r border-amber-200">
              <span className="text-xs text-amber-600 font-medium">Total Qty</span>
              <span className="text-2xl font-extrabold text-amber-800">{totalQty}</span>
            </div>
            <div className="flex-1 flex flex-col items-center py-3">
              <span className="text-xs text-amber-600 font-medium">Items</span>
              <span className="text-2xl font-extrabold text-amber-800">{totalItems}</span>
            </div>
          </div>

          {/* Sub Total */}
          <div className="flex justify-between items-center px-4 py-3 border-b border-gray-100 text-xs bg-white">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-5 rounded-full bg-indigo-400 shrink-0" />
              <span className="text-gray-600 font-medium">Sub Total</span>
            </div>
            <span className="font-bold text-indigo-700 text-sm">₹{subTotal.toFixed(2)}</span>
          </div>

          {/* Tax */}
          <div className="flex justify-between items-center px-4 py-3 border-b border-gray-100 text-xs bg-white">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-5 rounded-full bg-yellow-400 shrink-0" />
              <span className="text-gray-600 font-medium">Tax</span>
            </div>
            <span className="font-bold text-yellow-600 text-sm">+₹{effectiveTax.toFixed(2)}</span>
          </div>

          {/* Previous Balance */}
          <div className="flex justify-between items-center px-4 py-3 border-b border-orange-200 text-xs bg-orange-50">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-5 rounded-full bg-orange-400 shrink-0" />
              <span className="text-orange-700 font-medium">Prev. Balance</span>
            </div>
            <span className="font-bold text-orange-600 text-sm">+₹{prevBalance.toFixed(2)}</span>
          </div>

          {/* Shipping */}
          <div className="flex justify-between items-center px-4 py-3 border-b border-teal-200 text-xs bg-teal-50">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-5 rounded-full bg-teal-400 shrink-0" />
              <span className="text-teal-700 font-medium">Shipping</span>
            </div>
            <input
              type="number" min="0" step="0.01" value={shipping}
              onChange={(e) => setShipping(e.target.value)}
              className="w-20 border-2 border-teal-300 rounded-lg px-2 py-1 text-xs text-right focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white font-semibold"
            />
          </div>

          {/* Grand Total */}
          <div className="px-4 py-4 shrink-0" style={{ background: 'linear-gradient(135deg, #16a34a, #059669)' }}>
            <div className="flex justify-between items-center">
              <div>
                <p className="text-green-100 text-xs font-medium">Grand Total</p>
                <p className="text-white text-xs opacity-70">incl. all charges</p>
              </div>
              <span className="text-white font-extrabold text-2xl">₹{netPayable.toFixed(2)}</span>
            </div>
          </div>

          {/* Discount Section */}
          <div className="px-4 py-3 border-b-2 border-orange-200 bg-orange-50 space-y-2 shrink-0">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-1.5 h-4 rounded-full bg-orange-400 shrink-0" />
              <span className="text-xs font-bold text-orange-700 uppercase tracking-wide">Discount</span>
            </div>
            <div className="flex items-center gap-1.5">
              <select
                value={discountType}
                onChange={(e) => { setDiscountType(e.target.value); setDiscountApplied(0); setDiscountVal('') }}
                className="flex-1 border-2 border-orange-300 rounded-lg px-1.5 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
              >
                <option value="after_tax">After Tax</option>
                <option value="before_tax">Before Tax</option>
              </select>
              <select
                value={discountMode}
                onChange={(e) => setDiscountMode(e.target.value)}
                className="w-20 border-2 border-orange-300 rounded-lg px-1.5 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
              >
                <option value="percent">%</option>
                <option value="flat">Flat</option>
              </select>
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="number" min="0" placeholder="Enter discount"
                value={discountVal}
                onChange={(e) => setDiscountVal(e.target.value)}
                className="flex-1 border-2 border-orange-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
              />
              <button
                onClick={applyDiscount}
                className="px-3 py-1 text-xs bg-orange-500 text-white rounded-lg hover:bg-orange-600 font-bold whitespace-nowrap shadow"
              >
                Apply
              </button>
            </div>
            {discountApplied > 0 && (
              <div className="flex items-center gap-1 bg-green-100 rounded-lg px-2 py-1">
                <span className="text-xs text-green-700 font-bold">− ₹{discountApplied.toFixed(2)} saved!</span>
              </div>
            )}
          </div>

          {/* Coupon Section */}
          <div className="px-4 py-3 bg-purple-50 border-b-2 border-purple-200 shrink-0">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1.5 h-4 rounded-full bg-purple-400 shrink-0" />
              <span className="text-xs font-bold text-purple-700 uppercase tracking-wide">Coupon Code</span>
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="text" placeholder="Enter coupon code"
                value={coupon}
                onChange={(e) => setCoupon(e.target.value)}
                className="flex-1 border-2 border-purple-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white"
              />
              <button className="px-3 py-1 text-xs bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-bold whitespace-nowrap shadow">
                Apply
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── UPI Options panel ── */}
      {showUpiOptions && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowUpiOptions(false)} />
          <div className="fixed bottom-16 left-0 lg:left-64 z-50 w-80 bg-gray-800 border border-gray-600 rounded-xl shadow-2xl overflow-hidden">
            <div className="bg-gray-700 px-4 py-2.5 flex items-center justify-between">
              <span className="text-white text-sm font-bold">Select UPI Option</span>
              <button onClick={() => setShowUpiOptions(false)} className="text-gray-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-3 space-y-2">
              {upiIds.upi1 && (
                <button
                  onClick={() => { setUpiDetails(d => ({...d, app: upiIds.upi1})); setShowUpiOptions(false); setActivePayPopup('upi') }}
                  className="w-full flex items-center gap-3 p-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-left transition-colors"
                >
                  <div className="w-9 h-9 bg-green-500/20 rounded-full flex items-center justify-center shrink-0">
                    <Smartphone className="h-4 w-4 text-green-400" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">UPI ID 1</p>
                    <p className="text-sm text-white font-mono font-medium">{upiIds.upi1}</p>
                  </div>
                </button>
              )}
              {upiIds.upi2 && (
                <button
                  onClick={() => { setUpiDetails(d => ({...d, app: upiIds.upi2})); setShowUpiOptions(false); setActivePayPopup('upi') }}
                  className="w-full flex items-center gap-3 p-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-left transition-colors"
                >
                  <div className="w-9 h-9 bg-blue-500/20 rounded-full flex items-center justify-center shrink-0">
                    <Smartphone className="h-4 w-4 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">UPI ID 2</p>
                    <p className="text-sm text-white font-mono font-medium">{upiIds.upi2}</p>
                  </div>
                </button>
              )}
              <button
                onClick={() => { setShowUpiOptions(false); setUpiDetails(d => ({...d, app: 'QR Scan'})); setShowQrModal(true) }}
                className="w-full flex items-center gap-3 p-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-left transition-colors"
              >
                <div className="w-9 h-9 bg-amber-500/20 rounded-full flex items-center justify-center shrink-0">
                  <span className="text-amber-400 text-lg leading-none">⊞</span>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Business QR Code</p>
                  <p className="text-sm text-white font-medium">Show QR for customer to scan</p>
                </div>
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── QR Code Modal ── */}
      {showQrModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs p-6 text-center">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-800">Scan to Pay</h3>
              <button onClick={() => setShowQrModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 mb-4 flex flex-col items-center gap-3">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(`upi://pay?pa=${upiIds.upi1}&pn=Kavipushp+Jewels&am=${netPayable.toFixed(2)}&cu=INR`)}`}
                alt="UPI QR Code"
                className="w-52 h-52 rounded-lg"
              />
              <div>
                <p className="text-xs text-slate-500 font-medium">Kavipushp Jewels</p>
                <p className="text-sm font-mono text-slate-700 mt-0.5">{upiIds.upi1}</p>
                <p className="text-lg font-bold text-green-600 mt-1">₹{netPayable.toFixed(2)}</p>
              </div>
            </div>
            <p className="text-xs text-slate-400 mb-4">GPay · PhonePe · Paytm · Any UPI App</p>
            <button
              onClick={() => setShowQrModal(false)}
              className="w-full bg-green-500 hover:bg-green-600 text-white py-2.5 rounded-xl text-sm font-semibold"
            >
              Pay
            </button>
          </div>
        </div>
      )}

      {/* ── Payment mode popups ── */}
      {activePayPopup && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setActivePayPopup(null)} />
          <div className="fixed bottom-16 left-0 lg:left-64 z-50 w-80 bg-gray-800 border border-gray-600 rounded-xl shadow-2xl overflow-hidden">
            <div className={`px-4 py-3 flex items-center justify-between ${
              activePayPopup === 'cash' ? 'bg-green-800' :
              activePayPopup === 'card' ? 'bg-blue-800' :
              activePayPopup === 'upi'  ? 'bg-violet-800' : 'bg-orange-800'
            }`}>
              <div className="flex items-center gap-2">
                {activePayPopup === 'cash'   && <Banknote className="h-4 w-4 text-white" />}
                {activePayPopup === 'card'   && <CreditCard className="h-4 w-4 text-white" />}
                {activePayPopup === 'upi'    && <Smartphone className="h-4 w-4 text-white" />}
                {activePayPopup === 'cheque' && <FileText className="h-4 w-4 text-white" />}
                <span className="text-white font-bold text-sm capitalize">{activePayPopup === 'upi' ? 'Online / UPI' : activePayPopup} Payment</span>
              </div>
              <button onClick={() => setActivePayPopup(null)} className="text-white/60 hover:text-white"><X className="h-4 w-4" /></button>
            </div>

            <div className="p-4 space-y-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Amount (₹)</label>
                <div className="flex gap-2">
                  <input type="number" min="0" autoFocus
                    value={splitPay[activePayPopup]}
                    onChange={(e) => setSplitPay(p => ({...p, [activePayPopup]: e.target.value}))}
                    placeholder="0.00"
                    className="flex-1 bg-gray-900 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder-gray-500" />
                  <button onClick={() => setSplitPay(p => ({...p, [activePayPopup]: splitBalance > 0 ? (parseFloat(p[activePayPopup]||0) + splitBalance).toFixed(2) : p[activePayPopup]}))}
                    className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded-lg whitespace-nowrap">
                    +Remaining
                  </button>
                </div>
                <div className="flex justify-between text-xs mt-1 px-1">
                  <span className="text-green-400">Paid so far: ₹{totalSplitPaid.toFixed(2)}</span>
                  <span className="text-red-400">Remaining: ₹{splitBalance.toFixed(2)}</span>
                </div>
              </div>

              {activePayPopup === 'card' && (
                <>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Last 4 Digits of Card</label>
                    <input type="text" maxLength={4}
                      value={cardDetails.last4}
                      onChange={(e) => setCardDetails(d => ({...d, last4: e.target.value.replace(/\D/g,'').slice(0,4)}))}
                      placeholder="e.g. 1234"
                      className="w-full bg-gray-900 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 placeholder-gray-500" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Bank / Card Type</label>
                    <input type="text"
                      value={cardDetails.bank}
                      onChange={(e) => setCardDetails(d => ({...d, bank: e.target.value}))}
                      placeholder="e.g. HDFC Visa, SBI Mastercard"
                      className="w-full bg-gray-900 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 placeholder-gray-500" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Auth / Approval Code</label>
                    <input type="text"
                      value={cardDetails.authCode}
                      onChange={(e) => setCardDetails(d => ({...d, authCode: e.target.value}))}
                      placeholder="Authorization code"
                      className="w-full bg-gray-900 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 placeholder-gray-500" />
                  </div>
                </>
              )}

              {activePayPopup === 'upi' && (
                <>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">UPI App / Bank</label>
                    <input type="text"
                      value={upiDetails.app}
                      onChange={(e) => setUpiDetails(d => ({...d, app: e.target.value}))}
                      placeholder="GPay, PhonePe, Paytm..."
                      className="w-full bg-gray-900 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-400 placeholder-gray-500" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Transaction Reference</label>
                    <input type="text"
                      value={upiDetails.ref}
                      onChange={(e) => setUpiDetails(d => ({...d, ref: e.target.value}))}
                      placeholder="UPI transaction ID"
                      className="w-full bg-gray-900 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-400 placeholder-gray-500" />
                  </div>
                  <button onClick={() => setShowUpiOptions(true)} className="w-full py-2 bg-violet-700 hover:bg-violet-600 text-white text-sm rounded-lg">
                    Select UPI ID / QR Code
                  </button>
                </>
              )}

              {activePayPopup === 'cheque' && (
                <>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Cheque No.</label>
                    <input type="text"
                      value={chequeDetails.no}
                      onChange={(e) => setChequeDetails(d => ({...d, no: e.target.value}))}
                      placeholder="Cheque number"
                      className="w-full bg-gray-900 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-400 placeholder-gray-500" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Bank Name</label>
                    <input type="text"
                      value={chequeDetails.bank}
                      onChange={(e) => setChequeDetails(d => ({...d, bank: e.target.value}))}
                      placeholder="Bank name"
                      className="w-full bg-gray-900 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-400 placeholder-gray-500" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Cheque Date</label>
                    <input type="date"
                      value={chequeDetails.date}
                      onChange={(e) => setChequeDetails(d => ({...d, date: e.target.value}))}
                      className="w-full bg-gray-900 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-400" />
                  </div>
                </>
              )}

              <button onClick={() => setActivePayPopup(null)}
                className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-semibold text-sm rounded-lg">
                Confirm
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Sticky bottom payment bar ── */}
      <div className="fixed bottom-0 left-0 lg:left-64 right-0 bg-gray-900 flex items-center z-30 h-14">

        {/* CASH */}
        <button onClick={() => setActivePayPopup('cash')}
          className={`flex flex-col items-center justify-center h-full px-5 border-r border-gray-700 transition-colors gap-0.5 ${parseFloat(splitPay.cash) > 0 ? 'bg-green-700 text-white' : 'text-gray-300 hover:bg-gray-700'}`}>
          <Banknote className="h-4 w-4" />
          <span className="text-xs font-semibold">CASH</span>
          {parseFloat(splitPay.cash) > 0 && <span className="text-xs text-green-200">₹{parseFloat(splitPay.cash).toFixed(0)}</span>}
        </button>

        {/* CARD */}
        <button onClick={() => setActivePayPopup('card')}
          className={`flex flex-col items-center justify-center h-full px-5 border-r border-gray-700 transition-colors gap-0.5 ${parseFloat(splitPay.card) > 0 ? 'bg-blue-700 text-white' : 'text-gray-300 hover:bg-gray-700'}`}>
          <CreditCard className="h-4 w-4" />
          <span className="text-xs font-semibold">CARD</span>
          {parseFloat(splitPay.card) > 0 && <span className="text-xs text-blue-200">₹{parseFloat(splitPay.card).toFixed(0)}</span>}
        </button>

        {/* ONLINE */}
        <button onClick={() => setActivePayPopup('upi')}
          className={`flex flex-col items-center justify-center h-full px-5 border-r border-gray-700 transition-colors gap-0.5 ${parseFloat(splitPay.upi) > 0 ? 'bg-violet-700 text-white' : 'text-gray-300 hover:bg-gray-700'}`}>
          <Smartphone className="h-4 w-4" />
          <span className="text-xs font-semibold">ONLINE</span>
          {parseFloat(splitPay.upi) > 0 && <span className="text-xs text-violet-200">₹{parseFloat(splitPay.upi).toFixed(0)}</span>}
        </button>

        {/* CHEQUE */}
        <button onClick={() => setActivePayPopup('cheque')}
          className={`flex flex-col items-center justify-center h-full px-5 border-r border-gray-700 transition-colors gap-0.5 ${parseFloat(splitPay.cheque) > 0 ? 'bg-orange-700 text-white' : 'text-gray-300 hover:bg-gray-700'}`}>
          <FileText className="h-4 w-4" />
          <span className="text-xs font-semibold">CHEQUE</span>
          {parseFloat(splitPay.cheque) > 0 && <span className="text-xs text-orange-200">₹{parseFloat(splitPay.cheque).toFixed(0)}</span>}
        </button>

        {/* Paid / Balance */}
        <div className="flex items-center gap-4 px-4 text-xs">
          <div className="text-center">
            <div className="text-gray-400">Paid</div>
            <div className="text-green-400 font-bold">₹{totalSplitPaid.toFixed(2)}</div>
          </div>
          <div className="text-center">
            <div className="text-gray-400">Balance</div>
            <div className={`font-bold ${splitBalance > 0 ? 'text-red-400' : 'text-green-400'}`}>₹{splitBalance.toFixed(2)}</div>
          </div>
        </div>

        {/* Grand Total */}
        <div className="flex flex-col items-center justify-center px-4 h-full bg-orange-500 ml-auto shrink-0">
          <span className="text-white font-bold text-base">₹{netPayable.toFixed(2)}</span>
          <span className="text-orange-100 text-xs">Total</span>
        </div>

        {/* Place Order */}
        <button onClick={handlePlaceOrder} disabled={saving}
          className="flex items-center gap-2 h-full px-5 bg-gradient-to-r from-orange-500 to-yellow-400 text-white font-bold text-sm hover:from-orange-600 hover:to-yellow-500 disabled:opacity-60 whitespace-nowrap shrink-0">
          {saving ? <LoadingSpinner size="sm" /> : null}
          Place Order
        </button>
      </div>

      {/* ── WhatsApp send modal ── */}
      {waModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg viewBox="0 0 24 24" className="w-8 h-8 fill-green-500"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-1">Send Invoice on WhatsApp</h3>
            <p className="text-sm text-slate-500 mb-5">
              Send invoice to <span className="font-semibold text-slate-700">{waModal.customerName}</span>
            </p>
            <div className="flex flex-col gap-3">
              <a ref={waAnchorRef} href={waModal.url} target="_blank" rel="noreferrer" className="hidden">wa</a>
              <button
                onClick={() => { waAnchorRef.current?.click(); setWaModal(null); navigate('/billing/invoices') }}
                className="w-full bg-green-500 hover:bg-green-600 text-white py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                Send Now on WhatsApp
              </button>
              <button
                onClick={() => { setWaModal(null); navigate('/billing/invoices') }}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 py-2.5 rounded-xl text-sm"
              >
                Skip
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
