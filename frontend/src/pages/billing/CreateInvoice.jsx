import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate, useParams, useLocation, Link } from 'react-router-dom'
import {
  ScanBarcode, X, Truck, Package, Repeat2,
  Trash2, Plus, Calendar, Info, Banknote,
  CreditCard, Smartphone, FileText, ChevronDown,
  RefreshCw
} from 'lucide-react'
import toast from 'react-hot-toast'
import { saleAPI, customerAPI, productAPI, whatsappAPI, settingsAPI } from '../../api'
import LoadingSpinner from '../../components/common/LoadingSpinner'

// ── helpers ───────────────────────────────────────────────────────
function newRow() {
  return {
    _id: Date.now() + Math.random(),
    product_id: '', product_name: '', batch: '',
    qty: 1, stock: 0, mrp: 0, unit_price: 0,
    tax_rate: 0, tax_amt: 0,
    total_before: 0, total_after: 0,
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

const PAYMENT_MODES = [
  { key: 'cash',   label: 'CASH',   shortcut: 'F11', Icon: Banknote },
  { key: 'card',   label: 'CARD',   shortcut: 'F4',  Icon: CreditCard },
  { key: 'upi',    label: 'ONLINE', shortcut: 'F8',  Icon: Smartphone },
  { key: 'cheque', label: 'CHEQUE', shortcut: '',     Icon: FileText },
]

// ── Component ─────────────────────────────────────────────────────
export default function CreateInvoice() {
  const navigate    = useNavigate()
  const location    = useLocation()
  const { id }      = useParams()
  const isEdit      = Boolean(id)
  const barcodeRef  = useRef(null)
  const waAnchorRef = useRef(null)

  // WhatsApp send modal shown after order placement
  const [waModal, setWaModal] = useState(null) // { url, customerName }

  // customer
  const [custSearch,      setCustSearch]      = useState('')
  const [custResults,     setCustResults]     = useState([])
  const [showCustDrop,    setShowCustDrop]    = useState(false)
  const [selectedCust,    setSelectedCust]    = useState(null)
  const [mobile,          setMobile]          = useState('')
  const [custName,        setCustName]        = useState('')
  const [prevBalanceInput, setPrevBalanceInput] = useState('')

  // barcode / product
  const [barcode,         setBarcode]         = useState('')
  const [allProducts,     setAllProducts]     = useState([])

  // invoice meta
  const [invoiceNo,       setInvoiceNo]       = useState('')
  const [invoiceDate,     setInvoiceDate]     = useState(new Date().toLocaleDateString('en-IN'))

  // rows
  const [rows,            setRows]            = useState([newRow()])
  const [activeRowSearch, setActiveRowSearch] = useState(null)
  const [rowSearch,       setRowSearch]       = useState('')
  const [rowResults,      setRowResults]      = useState([])

  // order type
  const [orderType,       setOrderType]       = useState('takeaway') // takeaway | delivery

  // totals
  const [shipping,        setShipping]        = useState(0)
  const [discountType,    setDiscountType]    = useState('after_tax')
  const [discountMode,    setDiscountMode]    = useState('percent')
  const [discountVal,     setDiscountVal]     = useState('')
  const [discountApplied, setDiscountApplied] = useState(0)
  const [coupon,          setCoupon]          = useState('')

  // payment
  const [payMode,         setPayMode]         = useState('')
  const [payType,         setPayType]         = useState('full')   // 'full' | 'partial'
  const [partialAmount,   setPartialAmount]   = useState('')
  const [showPayPopup,    setShowPayPopup]    = useState(false)
  const [payRef,          setPayRef]          = useState('')
  const [cardLast4,       setCardLast4]       = useState('')
  const [cardBank,        setCardBank]        = useState('')
  const [onlineBank,      setOnlineBank]      = useState('')
  const [chequeBank,      setChequeBank]      = useState('')
  const [chequeDate,      setChequeDate]      = useState('')
  const [saving,          setSaving]          = useState(false)
  const [loading,         setLoading]         = useState(isEdit)
  const [showUpiOptions,  setShowUpiOptions]  = useState(false)  // UPI selector panel
  const [showQrModal,     setShowQrModal]     = useState(false)  // QR code modal
  const [upiIds,          setUpiIds]          = useState({ upi1: 'kavipushpjewels@oksbi', upi2: 'Kavipushpbank@okhdfcbank' })

  // ── load master data ─────────────────────────────────────────
  useEffect(() => {
    productAPI.getAll({ limit: 1000 })
      .then(({ data }) => setAllProducts(data.data || data.products || data.results || []))
      .catch(() => {})
    settingsAPI.getSettings()
      .then(({ data }) => {
        const s = data.data || data.settings || data
        if (s.payment_upi_id || s.payment_upi_id_2)
          setUpiIds({ upi1: s.payment_upi_id || '', upi2: s.payment_upi_id_2 || '' })
      }).catch(() => {})
    if (!isEdit) {
      saleAPI.getNextInvoiceNo()
        .then(({ data }) => setInvoiceNo(data.invoice_no || data.next_number || 'KPJ-/0001'))
        .catch(() => {})
    }
  }, [isEdit])

  // ── load existing invoice for edit ───────────────────────────
  useEffect(() => {
    if (!isEdit) return
    saleAPI.getOne(id)
      .then(({ data }) => {
        const s = data.data || data.sale || data
        const items = s.items || []
        setInvoiceNo(s.invoice_no || '')
        setInvoiceDate(new Date(s.invoice_date).toLocaleDateString('en-IN'))
        setCustName(s.customer_name || '')
        setMobile(s.customer_phone || s.mobile || '')
        if (s.customer) setSelectedCust(s.customer)
        setOrderType(s.order_type || 'takeaway')
        setPayMode(s.payment?.mode || s.payment_mode || 'cash')
        setShipping(s.shipping_charges || 0)
        setDiscountApplied(s.discount_amount || 0)
        setRows(
          items.length
            ? items.map((item) => calcRow({
                _id:          item.id || Date.now() + Math.random(),
                product_id:   item.product_id   || '',
                product_name: item.product_name || '',
                batch:        item.batch        || '',
                qty:          parseFloat(item.quantity  || 1),
                stock:        item.stock        || 0,
                mrp:          parseFloat(item.mrp       || 0),
                unit_price:   parseFloat(item.unit_price || 0),
                tax_rate:     parseFloat(item.tax_rate  || 0),
                tax_amt:      parseFloat(item.cgst || 0) + parseFloat(item.sgst || 0) + parseFloat(item.igst || 0),
                total_before: parseFloat(item.taxable_amount || 0),
                total_after:  parseFloat(item.total    || 0),
              }))
            : [newRow()]
        )
      })
      .catch(() => toast.error('Failed to load invoice for editing'))
      .finally(() => setLoading(false))
  }, [id, isEdit])

  // ── customer search ──────────────────────────────────────────
  useEffect(() => {
    if (!custSearch.trim()) { setCustResults([]); return }
    customerAPI.getAll({ search: custSearch, limit: 8 })
      .then(({ data }) => setCustResults(data.data || data.customers || []))
      .catch(() => {})
  }, [custSearch])

  // ── pre-select customer from Customers page ───────────────────
  useEffect(() => {
    const preselected = location.state?.preselectedCustomer
    if (!preselected || isEdit) return
    setMobile(preselected.mobile || preselected.phone || '')
    setCustName(preselected.name)
    const bal = parseFloat(preselected.outstanding_balance || preselected.opening_balance || 0)
    setPrevBalanceInput(bal > 0 ? String(bal) : '')
    customerAPI.getOne(preselected.id)
      .then(({ data }) => {
        const full = data.data || data.customer || data
        setSelectedCust({ ...preselected, ...full })
        const fullBal = parseFloat(full.outstanding_balance || full.opening_balance || 0)
        setPrevBalanceInput(fullBal > 0 ? String(fullBal) : '')
      })
      .catch(() => setSelectedCust(preselected))
  }, [])

  // ── row product search ───────────────────────────────────────
  useEffect(() => {
    if (!rowSearch.trim()) { setRowResults(allProducts); return }
    const q = rowSearch.toLowerCase()
    setRowResults(allProducts.filter((p) =>
      p.name?.toLowerCase().includes(q) ||
      p.barcode?.toLowerCase().includes(q) ||
      p.sku?.toLowerCase().includes(q)
    ))
  }, [rowSearch, allProducts])

  // ── barcode scan ─────────────────────────────────────────────
  const handleBarcodeEnter = (e) => {
    if (e.key !== 'Enter' || !barcode.trim()) return
    const found = allProducts.find(
      (p) => p.barcode === barcode.trim() || p.sku === barcode.trim()
    )
    if (found) {
      addProductRow(found)
      setBarcode('')
    } else {
      toast.error('Product not found')
    }
  }

  const addProductRow = (product) => {
    setRows((prev) => {
      // if last row is empty, fill it; else add new
      const last = prev[prev.length - 1]
      if (!last.product_id) {
        const updated = [...prev]
        updated[updated.length - 1] = calcRow({
          ...last,
          product_id: product.id,
          product_name: product.name,
          stock: product.stock || 0,
          mrp: product.mrp || product.sale_price || 0,
          unit_price: product.sale_price || 0,
          tax_rate: product.tax_rate || 0,
        })
        return updated
      }
      return [...prev, calcRow({
        ...newRow(),
        product_id: product.id,
        product_name: product.name,
        stock: product.stock || 0,
        mrp: product.mrp || product.sale_price || 0,
        unit_price: product.sale_price || 0,
        tax_rate: product.tax_rate || 0,
      })]
    })
    setActiveRowSearch(null)
    setRowSearch('')
  }

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

  // ── computed totals ──────────────────────────────────────────
  const totalQty    = rows.reduce((s, r) => s + (parseFloat(r.qty) || 0), 0)
  const totalItems  = rows.filter((r) => r.product_id).length
  const subTotal    = rows.reduce((s, r) => s + (r.total_before || 0), 0)
  const totalTax    = rows.reduce((s, r) => s + (r.tax_amt || 0), 0)
  const prevBalance = parseFloat(prevBalanceInput) || 0
  const grandTotal  = subTotal + totalTax + parseFloat(shipping || 0) - discountApplied
  const netPayable  = grandTotal + prevBalance
  const partialPaid = payType === 'partial' ? (parseFloat(partialAmount) || 0) : netPayable
  const balanceRemaining = Math.max(0, netPayable - partialPaid)

  const applyDiscount = () => {
    const val = parseFloat(discountVal) || 0
    if (discountMode === 'percent') {
      setDiscountApplied((grandTotal * val) / 100)
    } else {
      setDiscountApplied(val)
    }
  }

  // ── place order ──────────────────────────────────────────────
  const handlePlaceOrder = async () => {
    const validRows = rows.filter((r) => r.product_id)
    if (!validRows.length) { toast.error('Add at least one product'); return }
    if (!payMode) { toast.error('Select a payment mode first'); return }
    setSaving(true)
    try {
      const payload = {
        customer_id: selectedCust?.id || null,
        customer_name: selectedCust?.name || custSearch.trim() || 'Walk-in',
        mobile: selectedCust?.phone || selectedCust?.mobile || '',
        invoice_no: invoiceNo,
        invoice_date: new Date().toISOString().slice(0, 10),
        order_type: orderType,
        items: validRows.map((r) => ({
          product_id: r.product_id,
          product_name: r.product_name,
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
        discount_amount: discountApplied,
        grand_total: grandTotal,
        status: 'confirmed',
        payment: {
          mode: payMode,
          amount: payType === 'partial'
            ? (parseFloat(partialAmount) || 0)
            : netPayable,
          reference_no: payMode === 'card'
            ? (cardLast4 ? `XXXX-${cardLast4}` : null)
            : (payRef || null),
          bank_name: payMode === 'card' ? (cardBank || null)
            : payMode === 'upi' ? (onlineBank || null)
            : payMode === 'cheque' ? (chequeBank || null)
            : null,
          cheque_date: payMode === 'cheque' ? (chequeDate || null) : null,
          notes: payMode === 'card' && payRef ? `Auth Code: ${payRef}` : null,
        },
      }
      if (isEdit) {
        await saleAPI.update(id, payload)
        toast.success('Invoice updated')
      } else {
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
              return // don't navigate yet — wait for user to dismiss modal
            }
          } catch {
            // non-critical — fall through to navigate
          }
        }
      }
      navigate('/billing/invoices')
    } catch (err) {
      toast.error(err?.response?.data?.error || err?.response?.data?.message || err.message || 'Failed to place order')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <LoadingSpinner fullscreen />

  return (
    <div className="flex flex-col min-h-full pb-16 -m-4 lg:-m-6 bg-white">

      {/* ── Row 1: Customer search | Barcode | Action buttons ── */}
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
                  onClick={() => { setSelectedCust(null); setCustSearch(''); setMobile(''); setCustName(''); setPrevBalanceInput('') }}
                  className="text-gray-400 hover:text-red-500 shrink-0"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-red-600 font-medium whitespace-nowrap">Prev. Balance ₹</span>
                <input
                  type="number"
                  min="0"
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
                    setMobile(c.mobile || c.phone || '')
                    setCustName(c.name)
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

        {/* Barcode */}
        <div className="relative flex items-center flex-1 min-w-[180px]">
          <ScanBarcode className="absolute left-2 h-3.5 w-3.5 text-violet-400" />
          <input
            ref={barcodeRef}
            type="text"
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            onKeyDown={handleBarcodeEnter}
            placeholder="Scan or enter barcode/alias(Alt+R)"
            className="w-full border-2 border-violet-300 rounded-lg pl-7 pr-7 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-violet-500 bg-white"
          />
          {barcode && (
            <button onClick={() => setBarcode('')} className="absolute right-2 text-gray-400 hover:text-gray-600">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1 flex-wrap">
          <select className="border-2 border-amber-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white">
            <option>Select Ca</option>
            <option>Category 1</option>
          </select>
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
            <Plus className="h-3 w-3" /> PRODUCT
          </button>
          <button className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded bg-orange-400 text-white hover:bg-orange-500">
            HOLD(F3)
          </button>
          <button className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded bg-yellow-500 text-white hover:bg-yellow-600">
            <Repeat2 className="h-3 w-3" /> EXCHANGE
          </button>
          <button className="px-3 py-1.5 text-xs font-semibold rounded border border-gray-300 text-gray-700 hover:bg-gray-50">
            ADD GST
          </button>
          <button
            onClick={() => { setRows([newRow()]); setSelectedCust(null); setCustSearch(''); setMobile(''); setCustName('') }}
            className="p-1.5 rounded bg-red-500 text-white hover:bg-red-600"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* ── Row 2: Invoice No | Invoice Date ─── */}
      <div className="flex items-center gap-2 px-3 py-2 border-b-2 border-slate-200 bg-slate-50/40 flex-wrap">
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

      {/* ── Main: Table (left) + Totals (right) ──────────────── */}
      <div className="flex flex-1 gap-0 divide-x divide-slate-200 overflow-hidden">

        {/* LEFT: items table */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="overflow-x-auto flex-1">
            <table className="text-xs border-collapse" style={{ tableLayout: 'fixed', width: '100%' }}>
              <colgroup>
                <col style={{ width: '28px' }} />
                <col style={{ width: '140px' }} />
                <col style={{ width: '60px' }} />
                <col style={{ width: '50px' }} />
                <col style={{ width: '65px' }} />
                <col style={{ width: '80px' }} />
                <col style={{ width: '85px' }} />
                <col style={{ width: '65px' }} />
                <col style={{ width: '100px' }} />
                <col style={{ width: '100px' }} />
                <col style={{ width: '28px' }} />
              </colgroup>
              <thead className="bg-slate-800 sticky top-0">
                <tr className="border-b-2 border-slate-600">
                  <th className="px-2 py-2 text-left text-slate-200 font-medium">#</th>
                  <th className="px-2 py-2 text-left text-slate-200 font-medium">Name</th>
                  <th className="px-2 py-2 text-left text-slate-200 font-medium">Batch</th>
                  <th className="px-2 py-2 text-center text-slate-200 font-medium">Qty</th>
                  <th className="px-2 py-2 text-right text-slate-200 font-medium">Stock</th>
                  <th className="px-2 py-2 text-right text-slate-200 font-medium">MRP.</th>
                  <th className="px-2 py-2 text-right text-slate-200 font-medium">UnitPrice</th>
                  <th className="px-2 py-2 text-right text-slate-200 font-medium">Tax</th>
                  <th className="px-2 py-2 text-right text-slate-200 font-medium">
                    Total <span className="text-slate-300 font-normal">(Before Tax)</span>
                  </th>
                  <th className="px-2 py-2 text-right text-slate-200 font-medium">Total(After Tax)</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr key={row._id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-2 py-1.5 text-gray-400">{idx + 1}</td>

                    {/* Name with search dropdown */}
                    <td className="px-2 py-1.5">
                      <div className="relative">
                        <input
                          type="text"
                          value={activeRowSearch === idx ? rowSearch : row.product_name}
                          onChange={(e) => { setRowSearch(e.target.value); setActiveRowSearch(idx) }}
                          onFocus={() => { setActiveRowSearch(idx); setRowSearch(row.product_name) }}
                          onBlur={() => setTimeout(() => { if (activeRowSearch === idx) setActiveRowSearch(null) }, 200)}
                          placeholder="Search product..."
                          className="w-full border-2 border-amber-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 bg-white"
                        />
                        {activeRowSearch === idx && rowResults.length > 0 && (
                          <div className="absolute top-full left-0 bg-white border border-slate-200 rounded shadow-lg z-40 max-h-72 overflow-y-auto min-w-[260px]">
                            {rowResults.map((p) => (
                              <button key={p.id}
                                onMouseDown={() => {
                                  updateRow(idx, 'product_id', p.id)
                                  updateRow(idx, 'product_name', p.name)
                                  setRows((prev) => {
                                    const next = [...prev]
                                    next[idx] = calcRow({
                                      ...next[idx],
                                      product_id: p.id,
                                      product_name: p.name,
                                      stock: p.stock || 0,
                                      mrp: p.mrp || p.sale_price || 0,
                                      unit_price: p.sale_price || 0,
                                      tax_rate: p.tax_rate || 0,
                                    })
                                    return next
                                  })
                                  setActiveRowSearch(null)
                                  setRowSearch('')
                                }}
                                className="w-full text-left px-3 py-1.5 text-xs hover:bg-amber-50"
                              >
                                <span className="font-medium">{p.name}</span>
                                <span className="text-gray-400 ml-2">₹{p.sale_price}</span>
                                <span className="text-gray-300 ml-1">· Stock: {p.stock}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Batch */}
                    <td className="px-2 py-1.5">
                      <input type="text" value={row.batch}
                        onChange={(e) => updateRow(idx, 'batch', e.target.value)}
                        className="w-full border-2 border-amber-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 bg-white"
                      />
                    </td>

                    {/* Qty */}
                    <td className="px-2 py-1.5">
                      <input type="number" min="1" value={row.qty}
                        onChange={(e) => updateRow(idx, 'qty', e.target.value)}
                        className="w-full border-2 border-green-300 rounded-lg px-2 py-1 text-xs text-center focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-green-500 bg-white"
                      />
                    </td>

                    {/* Stock */}
                    <td className="px-2 py-1.5 text-right">
                      <span className="inline-block w-full text-right text-xs font-semibold text-cyan-700 bg-cyan-50 border-2 border-cyan-300 rounded-lg px-2 py-1">{row.stock}</span>
                    </td>

                    {/* MRP */}
                    <td className="px-2 py-1.5">
                      <input type="number" min="0" step="0.01" value={row.mrp}
                        onChange={(e) => updateRow(idx, 'mrp', e.target.value)}
                        className="w-full border-2 border-amber-300 rounded-lg px-2 py-1 text-xs text-right focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-500 bg-white"
                      />
                    </td>

                    {/* UnitPrice */}
                    <td className="px-2 py-1.5">
                      <input type="number" min="0" step="0.01" value={row.unit_price}
                        onChange={(e) => updateRow(idx, 'unit_price', e.target.value)}
                        className="w-full border-2 border-orange-300 rounded-lg px-2 py-1 text-xs text-right focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-500 bg-white"
                      />
                    </td>

                    {/* Tax */}
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

          {/* Custom fields bar */}
          <div className="flex items-center gap-3 px-3 py-2 border-t border-slate-200 bg-slate-50">
            <span className="text-xs font-medium text-gray-600">Custom Fields</span>
            <button className="flex items-center gap-1 px-3 py-1 text-xs bg-orange-500 text-white rounded hover:bg-orange-600 font-medium">
              <Plus className="h-3 w-3" /> New Custom Fields
            </button>
            <Link to="/dashboard"
              className="px-3 py-1 text-xs bg-amber-600 text-white rounded hover:bg-amber-700 font-medium">
              Dashboard
            </Link>
          </div>
        </div>

        {/* RIGHT: totals panel */}
        <div className="w-72 shrink-0 flex flex-col overflow-y-auto border-l-2 border-amber-200">

          {/* Panel Header */}
          <div className="bg-slate-800 px-4 py-3 shrink-0">
            <h3 className="text-sm font-bold text-white tracking-wide">Order Summary</h3>
          </div>

          {/* No. of Qty / Items */}
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
            <span className="font-bold text-yellow-600 text-sm">+₹{totalTax.toFixed(2)}</span>
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
              <span className="text-teal-700 font-medium">Shipping (Alt+T)</span>
            </div>
            <input
              type="number" min="0" step="0.01" value={shipping}
              onChange={(e) => setShipping(e.target.value)}
              className="w-20 border-2 border-teal-300 rounded-lg px-2 py-1 text-xs text-right focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white font-semibold"
            />
          </div>

          {/* Grand Total / Net Payable */}
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
                onChange={(e) => setDiscountType(e.target.value)}
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

      {/* ── UPI Options panel (shown when ONLINE is clicked) ──── */}
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
              {/* UPI ID 1 */}
              {upiIds.upi1 && (
                <button
                  onClick={() => { setOnlineBank('GPay/PhonePe'); setPayRef(upiIds.upi1); setShowUpiOptions(false); setShowPayPopup(true) }}
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
              {/* UPI ID 2 */}
              {upiIds.upi2 && (
                <button
                  onClick={() => { setOnlineBank('GPay/PhonePe'); setPayRef(upiIds.upi2); setShowUpiOptions(false); setShowPayPopup(true) }}
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
              {/* QR Code */}
              <button
                onClick={() => { setShowUpiOptions(false); setShowQrModal(true) }}
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

      {/* ── QR Code Modal ─────────────────────────────────────── */}
      {showQrModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs p-6 text-center">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-800">Scan to Pay</h3>
              <button onClick={() => { setShowQrModal(false); setShowPayPopup(true) }} className="text-gray-400 hover:text-gray-600">
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
              onClick={() => { setShowQrModal(false); setOnlineBank('QR Scan'); setShowPayPopup(true) }}
              className="w-full bg-green-500 hover:bg-green-600 text-white py-2.5 rounded-xl text-sm font-semibold"
            >
              Pay
            </button>
          </div>
        </div>
      )}

      {/* ── Payment popup — shared for all modes ─────────────── */}
      {showPayPopup && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowPayPopup(false)} />
          <div className="fixed bottom-16 left-0 lg:left-64 z-50 w-80 bg-gray-800 border border-gray-600 rounded-xl shadow-2xl overflow-hidden">
            <div className="bg-gray-700 px-4 py-2.5 flex items-center justify-between">
              <span className="text-white text-sm font-bold capitalize">
                {payMode || 'Select'} Payment
              </span>
              <button onClick={() => setShowPayPopup(false)} className="text-gray-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-4 space-y-3">

              {/* Full / Partial toggle */}
              <div className="flex gap-2">
                <button
                  onClick={() => { setPayType('full'); setPartialAmount('') }}
                  className={`flex-1 py-2.5 rounded-lg border-2 text-sm font-semibold transition-colors ${
                    payType === 'full'
                      ? 'border-green-500 bg-green-900/40 text-green-300'
                      : 'border-gray-600 bg-gray-700 text-gray-300 hover:border-gray-500'
                  }`}
                >
                  Full Payment
                  <div className="text-xs font-normal opacity-70">₹{netPayable.toFixed(2)}</div>
                </button>
                <button
                  onClick={() => setPayType('partial')}
                  className={`flex-1 py-2.5 rounded-lg border-2 text-sm font-semibold transition-colors ${
                    payType === 'partial'
                      ? 'border-yellow-500 bg-yellow-900/40 text-yellow-300'
                      : 'border-gray-600 bg-gray-700 text-gray-300 hover:border-gray-500'
                  }`}
                >
                  Partial
                  <div className="text-xs font-normal opacity-70">Part now, rest later</div>
                </button>
              </div>

              {/* Partial amount input */}
              {payType === 'partial' && (
                <div className="space-y-1.5">
                  <input
                    type="number"
                    value={partialAmount}
                    onChange={(e) => setPartialAmount(e.target.value)}
                    placeholder="Enter amount paid"
                    min={0}
                    max={grandTotal}
                    autoFocus
                    className="w-full border border-yellow-500 bg-gray-900 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 placeholder-gray-500"
                  />
                  <div className="flex justify-between text-xs px-1">
                    <span className="text-green-400">Paid: ₹{(parseFloat(partialAmount) || 0).toFixed(2)}</span>
                    <span className="text-red-400 font-bold">Balance: ₹{balanceRemaining.toFixed(2)}</span>
                  </div>
                </div>
              )}

              {/* Mode-specific reference fields */}
              {payMode === 'card' && (
                <div className="space-y-2">
                  <input type="text" value={cardLast4} onChange={(e) => setCardLast4(e.target.value.replace(/\D/g,'').slice(0,4))} placeholder="Last 4 digits" maxLength={4}
                    className="w-full border border-gray-600 bg-gray-900 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400 placeholder-gray-500" />
                  <input type="text" value={cardBank} onChange={(e) => setCardBank(e.target.value)} placeholder="Bank / Card type"
                    className="w-full border border-gray-600 bg-gray-900 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400 placeholder-gray-500" />
                  <input type="text" value={payRef} onChange={(e) => setPayRef(e.target.value)} placeholder="Auth Code"
                    className="w-full border border-gray-600 bg-gray-900 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400 placeholder-gray-500" />
                </div>
              )}
              {payMode === 'upi' && (
                <div className="space-y-2">
                  <input type="text" value={payRef} onChange={(e) => setPayRef(e.target.value)} placeholder="UPI / Transaction Ref"
                    className="w-full border border-gray-600 bg-gray-900 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400 placeholder-gray-500" />
                  <input type="text" value={onlineBank} onChange={(e) => setOnlineBank(e.target.value)} placeholder="Bank / UPI App"
                    className="w-full border border-gray-600 bg-gray-900 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400 placeholder-gray-500" />
                </div>
              )}
              {payMode === 'cheque' && (
                <div className="space-y-2">
                  <input type="text" value={payRef} onChange={(e) => setPayRef(e.target.value)} placeholder="Cheque No."
                    className="w-full border border-gray-600 bg-gray-900 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400 placeholder-gray-500" />
                  <input type="text" value={chequeBank} onChange={(e) => setChequeBank(e.target.value)} placeholder="Bank Name"
                    className="w-full border border-gray-600 bg-gray-900 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400 placeholder-gray-500" />
                  <input type="date" value={chequeDate} onChange={(e) => setChequeDate(e.target.value)}
                    className="w-full border border-gray-600 bg-gray-900 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
                </div>
              )}

              <button
                onClick={() => setShowPayPopup(false)}
                disabled={payType === 'partial' && (!partialAmount || parseFloat(partialAmount) <= 0)}
                className="w-full py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white font-semibold text-sm rounded-lg transition-colors"
              >
                {payType === 'partial' ? 'Confirm Partial Payment' : 'Confirm'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Sticky bottom payment bar ─────────────────────────── */}
      <div className="fixed bottom-0 left-0 lg:left-64 right-0 bg-gray-900 flex items-center z-30 h-14">
        {/* Payment mode buttons */}
        <div className="flex items-stretch h-full">
          {PAYMENT_MODES.map((pm) => {
            const Icon = pm.Icon
            const active = payMode === pm.key
            return (
              <button
                key={pm.key}
                onClick={() => {
                  if (pm.key === 'upi') {
                    // ONLINE → show UPI options first
                    setPayMode('upi')
                    setPayType('full'); setPartialAmount('')
                    setPayRef(''); setCardLast4(''); setCardBank(''); setOnlineBank(''); setChequeBank(''); setChequeDate('')
                    setShowPayPopup(false)
                    setShowUpiOptions(true)
                  } else if (payMode === pm.key) {
                    setShowPayPopup((prev) => !prev)
                  } else {
                    setPayMode(pm.key)
                    setPayType('full'); setPartialAmount('')
                    setPayRef(''); setCardLast4(''); setCardBank(''); setOnlineBank(''); setChequeBank(''); setChequeDate('')
                    setShowPayPopup(true)
                  }
                }}
                className={`flex items-center gap-1.5 px-4 text-xs font-semibold border-r border-gray-700 transition-colors ${
                  active ? 'bg-amber-600 text-white' : 'text-gray-300 hover:bg-gray-700'
                }`}
              >
                <Icon className="h-4 w-4" />
                {pm.label}
                {pm.shortcut && (
                  <span className={`text-xs ${active ? 'text-amber-200' : 'text-gray-500'}`}>({pm.shortcut})</span>
                )}
              </button>
            )
          })}
        </div>

        {/* Active mode indicator pill */}
        <div className="ml-3 flex items-center gap-1.5">
          {payMode ? (
            <span className={`text-xs px-2 py-0.5 rounded font-semibold ${payType === 'partial' ? 'bg-yellow-500 text-white' : 'bg-green-600 text-white'}`}>
              {payType === 'partial' ? `Partial ₹${(parseFloat(partialAmount)||0).toFixed(0)}` : 'Full'}
            </span>
          ) : (
            <span className="text-xs px-2 py-0.5 rounded font-semibold bg-red-500 text-white">Select Mode</span>
          )}
        </div>

        {/* Total amount */}
        <div className={`flex flex-col items-center justify-center px-6 h-full ml-auto ${payType === 'partial' ? 'bg-yellow-600' : 'bg-orange-500'}`}>
          <span className="text-white font-bold text-lg">₹{netPayable.toFixed(2)}</span>
          {payType === 'partial' && (
            <span className="text-yellow-100 text-xs font-medium">Paid: ₹{partialPaid.toFixed(2)}</span>
          )}
        </div>

        {/* Place Order */}
        <button
          onClick={handlePlaceOrder}
          disabled={saving}
          className="flex items-center gap-2 h-full px-6 bg-gradient-to-r from-orange-500 to-yellow-400 text-white font-bold text-sm hover:from-orange-600 hover:to-yellow-500 disabled:opacity-60 whitespace-nowrap"
        >
          {saving ? <LoadingSpinner size="sm" /> : null}
          Place Order (Alt + P)
        </button>
      </div>

      {/* ── WhatsApp send modal (shown after order placed) ── */}
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
              {/* Hidden anchor — clicked programmatically, never popup-blocked */}
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
