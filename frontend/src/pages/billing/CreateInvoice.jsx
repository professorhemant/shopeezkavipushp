import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import {
  ScanBarcode, X, Truck, Package, Repeat2,
  Trash2, Plus, Calendar, Info, Banknote,
  CreditCard, Smartphone, FileText, ChevronDown,
  RefreshCw
} from 'lucide-react'
import toast from 'react-hot-toast'
import { saleAPI, customerAPI, productAPI } from '../../api'
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
  const { id }      = useParams()
  const isEdit      = Boolean(id)
  const barcodeRef  = useRef(null)

  // customer
  const [custSearch,      setCustSearch]      = useState('')
  const [custResults,     setCustResults]     = useState([])
  const [showCustDrop,    setShowCustDrop]    = useState(false)
  const [selectedCust,    setSelectedCust]    = useState(null)
  const [mobile,          setMobile]          = useState('')
  const [custName,        setCustName]        = useState('')

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

  // ── load master data ─────────────────────────────────────────
  useEffect(() => {
    productAPI.getAll({ limit: 1000 })
      .then(({ data }) => setAllProducts(data.data || data.products || data.results || []))
      .catch(() => {})
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

  // ── row product search ───────────────────────────────────────
  useEffect(() => {
    if (!rowSearch.trim()) { setRowResults(allProducts.slice(0, 8)); return }
    const q = rowSearch.toLowerCase()
    setRowResults(allProducts.filter((p) =>
      p.name?.toLowerCase().includes(q) ||
      p.barcode?.toLowerCase().includes(q) ||
      p.sku?.toLowerCase().includes(q)
    ).slice(0, 10))
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
  const prevBalance = parseFloat(selectedCust?.outstanding_balance || selectedCust?.opening_balance || 0)
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
        customer_name: selectedCust?.name || custName || 'Walk-in',
        mobile: selectedCust?.mobile || mobile || '',
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
        await saleAPI.create(payload)
        toast.success('Order placed!')
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
      <div className="flex items-center gap-2 px-3 py-2 border-b-2 border-blue-200 bg-blue-50/40 flex-wrap">

        {/* Customer search */}
        <div className="relative flex-1 min-w-[180px]">
          <input
            type="text"
            value={selectedCust ? selectedCust.name : custSearch}
            onChange={(e) => { setCustSearch(e.target.value); setSelectedCust(null); setShowCustDrop(true) }}
            onFocus={() => setShowCustDrop(true)}
            onBlur={() => setTimeout(() => setShowCustDrop(false), 180)}
            placeholder="Search name, mobile or firm(Alt+c)"
            className="w-full border-2 border-blue-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-500 bg-white"
          />
          {showCustDrop && custResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded shadow-lg z-40 max-h-40 overflow-y-auto">
              {custResults.map((c) => (
                <button key={c.id}
                  onMouseDown={() => {
                    setMobile(c.mobile || c.phone || '')
                    setCustName(c.name)
                    setCustSearch('')
                    setShowCustDrop(false)
                    // Fetch full customer data to get accurate outstanding_balance
                    customerAPI.getOne(c.id)
                      .then(({ data }) => {
                        const full = data.data || data.customer || data
                        setSelectedCust({ ...c, ...full })
                      })
                      .catch(() => setSelectedCust(c))
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50"
                >
                  <span className="font-medium">{c.name}</span>
                  <span className="text-gray-400 ml-2">{c.mobile || c.phone}</span>
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
          <select className="border-2 border-blue-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white">
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
            className={`flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded ${orderType === 'delivery' ? 'bg-blue-600 text-white' : 'border border-blue-500 text-blue-600 hover:bg-blue-50'}`}
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

      {/* ── Row 2: Mobile | Name | Invoice No | Invoice Date ─── */}
      <div className="flex items-center gap-2 px-3 py-2 border-b-2 border-emerald-200 bg-emerald-50/30 flex-wrap">
        <input
          type="text"
          value={mobile}
          onChange={(e) => setMobile(e.target.value)}
          onBlur={(e) => {
            const val = e.target.value.trim()
            if (!val || selectedCust) return
            // Auto-lookup customer by mobile when not already selected
            customerAPI.getAll({ search: val, limit: 1 })
              .then(({ data }) => {
                const found = (data.data || data.customers || [])[0]
                if (!found) return
                setMobile(found.mobile || found.phone || val)
                setCustName(found.name)
                customerAPI.getOne(found.id)
                  .then(({ data: d }) => {
                    const full = d.data || d.customer || d
                    setSelectedCust({ ...found, ...full })
                  })
                  .catch(() => setSelectedCust(found))
              })
              .catch(() => {})
          }}
          placeholder="Mobile number(Alt+M)"
          className="flex-1 min-w-[150px] border-2 border-emerald-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-500 bg-white"
        />
        <input
          type="text"
          value={custName}
          onChange={(e) => setCustName(e.target.value)}
          placeholder="Name(Alt+X)"
          className="flex-1 min-w-[150px] border-2 border-teal-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-teal-500 bg-white"
        />
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
      <div className="flex flex-1 gap-0 divide-x divide-gray-200 overflow-hidden">

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
              <thead className="bg-blue-900 sticky top-0">
                <tr className="border-b-2 border-blue-700">
                  <th className="px-2 py-2 text-left text-blue-200 font-medium">#</th>
                  <th className="px-2 py-2 text-left text-blue-200 font-medium">Name</th>
                  <th className="px-2 py-2 text-left text-blue-200 font-medium">Batch</th>
                  <th className="px-2 py-2 text-center text-blue-200 font-medium">Qty</th>
                  <th className="px-2 py-2 text-right text-blue-200 font-medium">Stock</th>
                  <th className="px-2 py-2 text-right text-blue-200 font-medium">MRP.</th>
                  <th className="px-2 py-2 text-right text-blue-200 font-medium">UnitPrice</th>
                  <th className="px-2 py-2 text-right text-blue-200 font-medium">Tax</th>
                  <th className="px-2 py-2 text-right text-blue-200 font-medium">
                    Total <span className="text-blue-300 font-normal">(Before Tax)</span>
                  </th>
                  <th className="px-2 py-2 text-right text-blue-200 font-medium">Total(After Tax)</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr key={row._id} className="border-b border-gray-100 hover:bg-gray-50">
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
                          className="w-full border-2 border-blue-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 bg-white"
                        />
                        {activeRowSearch === idx && rowResults.length > 0 && (
                          <div className="absolute top-full left-0 bg-white border border-gray-200 rounded shadow-lg z-40 max-h-36 overflow-y-auto min-w-[200px]">
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
                                className="w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50"
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
                        className="w-full border-2 border-blue-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 bg-white"
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
                        className="w-full border-2 border-purple-300 rounded-lg px-2 py-1 text-xs text-right focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-purple-500 bg-white"
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
          <div className="flex items-center gap-3 px-3 py-2 border-t border-gray-200 bg-gray-50">
            <span className="text-xs font-medium text-gray-600">Custom Fields</span>
            <button className="flex items-center gap-1 px-3 py-1 text-xs bg-orange-500 text-white rounded hover:bg-orange-600 font-medium">
              <Plus className="h-3 w-3" /> New Custom Fields
            </button>
            <Link to="/dashboard"
              className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 font-medium">
              Dashboard
            </Link>
          </div>
        </div>

        {/* RIGHT: totals panel */}
        <div className="w-72 shrink-0 flex flex-col overflow-y-auto border-l-2 border-blue-200">

          {/* Panel Header */}
          <div className="bg-blue-900 px-4 py-3 shrink-0">
            <h3 className="text-sm font-bold text-white tracking-wide">Order Summary</h3>
          </div>

          {/* No. of Qty / Items */}
          <div className="flex bg-blue-50 border-b-2 border-blue-200 shrink-0">
            <div className="flex-1 flex flex-col items-center py-3 border-r border-blue-200">
              <span className="text-xs text-blue-500 font-medium">Total Qty</span>
              <span className="text-2xl font-extrabold text-blue-800">{totalQty}</span>
            </div>
            <div className="flex-1 flex flex-col items-center py-3">
              <span className="text-xs text-blue-500 font-medium">Items</span>
              <span className="text-2xl font-extrabold text-blue-800">{totalItems}</span>
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
                    className="w-full border border-gray-600 bg-gray-900 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 placeholder-gray-500" />
                  <input type="text" value={cardBank} onChange={(e) => setCardBank(e.target.value)} placeholder="Bank / Card type"
                    className="w-full border border-gray-600 bg-gray-900 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 placeholder-gray-500" />
                  <input type="text" value={payRef} onChange={(e) => setPayRef(e.target.value)} placeholder="Auth Code"
                    className="w-full border border-gray-600 bg-gray-900 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 placeholder-gray-500" />
                </div>
              )}
              {payMode === 'upi' && (
                <div className="space-y-2">
                  <input type="text" value={payRef} onChange={(e) => setPayRef(e.target.value)} placeholder="UPI / Transaction Ref"
                    className="w-full border border-gray-600 bg-gray-900 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 placeholder-gray-500" />
                  <input type="text" value={onlineBank} onChange={(e) => setOnlineBank(e.target.value)} placeholder="Bank / UPI App"
                    className="w-full border border-gray-600 bg-gray-900 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 placeholder-gray-500" />
                </div>
              )}
              {payMode === 'cheque' && (
                <div className="space-y-2">
                  <input type="text" value={payRef} onChange={(e) => setPayRef(e.target.value)} placeholder="Cheque No."
                    className="w-full border border-gray-600 bg-gray-900 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 placeholder-gray-500" />
                  <input type="text" value={chequeBank} onChange={(e) => setChequeBank(e.target.value)} placeholder="Bank Name"
                    className="w-full border border-gray-600 bg-gray-900 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 placeholder-gray-500" />
                  <input type="date" value={chequeDate} onChange={(e) => setChequeDate(e.target.value)}
                    className="w-full border border-gray-600 bg-gray-900 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
                </div>
              )}

              <button
                onClick={() => setShowPayPopup(false)}
                disabled={payType === 'partial' && (!partialAmount || parseFloat(partialAmount) <= 0)}
                className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-semibold text-sm rounded-lg transition-colors"
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
                  if (payMode === pm.key) {
                    setShowPayPopup((prev) => !prev)
                  } else {
                    setPayMode(pm.key)
                    setPayType('full')
                    setPartialAmount('')
                    setPayRef(''); setCardLast4(''); setCardBank(''); setOnlineBank(''); setChequeBank(''); setChequeDate('')
                    setShowPayPopup(true)
                  }
                }}
                className={`flex items-center gap-1.5 px-4 text-xs font-semibold border-r border-gray-700 transition-colors ${
                  active ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700'
                }`}
              >
                <Icon className="h-4 w-4" />
                {pm.label}
                {pm.shortcut && (
                  <span className={`text-xs ${active ? 'text-blue-200' : 'text-gray-500'}`}>({pm.shortcut})</span>
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

    </div>
  )
}
