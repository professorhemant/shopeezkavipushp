import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate, useParams, useLocation, Link } from 'react-router-dom'
import {
  ScanBarcode, X,
  Trash2, Plus, Calendar, Info, Banknote,
  CreditCard, Smartphone, FileText, ChevronDown,
  RefreshCw, Camera, Lock
} from 'lucide-react'
import toast from 'react-hot-toast'
import { saleAPI, customerAPI, productAPI, whatsappAPI, settingsAPI } from '../../api'
import LoadingSpinner from '../../components/common/LoadingSpinner'

// ── helpers ───────────────────────────────────────────────────────
function newRow() {
  return {
    _id: Date.now() + Math.random(),
    product_id: '', product_name: '', batch: '',
    qty: 1, stock: 0, mrp: 0, unit_price: 0, discount_per: 0,
    tax_rate: 3, tax_amt: 0,
    total_before: 0, total_after: 0,
  }
}

function calcRow(r) {
  const qty          = parseFloat(r.qty)          || 0
  const mrp          = parseFloat(r.mrp)          || 0
  const discount_per = parseFloat(r.discount_per) || 0
  // Auto-derive unit_price from mrp when discount_per is set; otherwise use raw unit_price
  const unit_price   = discount_per > 0
    ? parseFloat((mrp * (1 - discount_per / 100)).toFixed(2))
    : (parseFloat(r.unit_price) || 0)
  const tax_rate     = parseFloat(r.tax_rate)     || 0
  // MRP/unit_price is GST-inclusive; extract the before-tax amount by back-calculating
  const total_after  = qty * unit_price
  const total_before = tax_rate > 0
    ? parseFloat((total_after / (1 + tax_rate / 100)).toFixed(2))
    : total_after
  const tax_amt      = parseFloat((total_after - total_before).toFixed(2))
  return { ...r, unit_price, tax_amt, total_before, total_after }
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
  const [custName,        setCustName]        = useState('')
  const [mobile,          setMobile]          = useState('')
  const [prevBalanceInput, setPrevBalanceInput] = useState('')

  // barcode / product
  const [barcode,         setBarcode]         = useState('')
  const [allProducts,     setAllProducts]     = useState([])

  // invoice meta
  const [invoiceNo,       setInvoiceNo]       = useState('')
  const [invoiceDate,     setInvoiceDate]     = useState(new Date().toLocaleDateString('en-IN'))

  // rows
  const [rows,              setRows]              = useState([newRow()])
  const [activeRowSearch,   setActiveRowSearch]   = useState(null)
  const [rowSearch,         setRowSearch]         = useState('')
  const [rowResults,        setRowResults]        = useState([])
  const [activeBarcodeSearch, setActiveBarcodeSearch] = useState(null)
  const [barcodeSearch,     setBarcodeSearch]     = useState('')
  const [barcodeResults,    setBarcodeResults]    = useState([])

  // order type
  const [orderType,       setOrderType]       = useState('takeaway') // takeaway | delivery

  // totals
  const [shipping,        setShipping]        = useState(0)
  const [discountType,    setDiscountType]    = useState('after_tax')
  const [discountMode,    setDiscountMode]    = useState('percent')
  const [discountVal,     setDiscountVal]     = useState('')
  const [discountApplied, setDiscountApplied] = useState(0)
  const [coupon,          setCoupon]          = useState('')

  // payment — split across multiple modes
  const [splitPay,        setSplitPay]        = useState({ cash: '', card: '', upi: '', cheque: '' })
  const [cardDetails,     setCardDetails]     = useState({ last4: '', bank: '', authCode: '' })
  const [upiDetails,      setUpiDetails]      = useState({ ref: '', app: '' })
  const [chequeDetails,   setChequeDetails]   = useState({ no: '', bank: '', date: '' })
  const [activePayPopup,  setActivePayPopup]  = useState(null) // 'cash'|'card'|'upi'|'cheque'|null
  const [saving,          setSaving]          = useState(false)
  const [loading,         setLoading]         = useState(isEdit)
  const [showUpiOptions,  setShowUpiOptions]  = useState(false)  // UPI selector panel
  const [showQrModal,     setShowQrModal]     = useState(false)  // QR code modal
  const [upiIds,          setUpiIds]          = useState({ upi1: 'kavipushpjewels@oksbi', upi2: 'Kavipushpbank@okhdfcbank' })

  // photos
  const [invoiceImages,    setInvoiceImages]    = useState([]) // [{file, preview}] for new; existing loaded from DB
  const [existingImages,   setExistingImages]   = useState([]) // string[] of existing URL paths
  const invoiceFileRef = useRef(null)

  const saveCustomer = async () => {
    if (!custName.trim()) { toast.error('Enter customer name to save'); return }
    try {
      const { data: existing } = await customerAPI.getAll({ search: custName.trim(), limit: 5 })
      const match = (existing.data || existing.customers || []).find(
        (c) => c.name.trim().toLowerCase() === custName.trim().toLowerCase()
      )
      if (match) {
        await customerAPI.update(match.id, { phone: mobile.trim() || undefined })
        toast.success('Customer updated!')
      } else {
        await customerAPI.create({ name: custName.trim(), phone: mobile.trim() || undefined })
        toast.success('Customer saved!')
      }
    } catch {
      toast.error('Failed to save customer')
    }
  }

  const fetchNextInvoiceNo = () => {
    saleAPI.getNextInvoiceNo()
      .then(({ data }) => setInvoiceNo(data.invoice_no || data.next_number || 'KPJ-/0001'))
      .catch(() => {})
  }

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
      fetchNextInvoiceNo()
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
        setOrderType(s.order_type || 'takeaway')
        if (s.payments && s.payments.length) {
          const split = { cash: '', card: '', upi: '', cheque: '' }
          s.payments.forEach((p) => {
            const mode = p.payment_mode || p.mode
            if (mode in split) split[mode] = String(p.amount)
          })
          setSplitPay(split)
        }
        setShipping(parseFloat(s.shipping_charges) || 0)
        setDiscountApplied(parseFloat(s.discount_amount) || 0)
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
        try { setExistingImages(JSON.parse(s.images_json || '[]')); } catch {}
      })
      .catch(() => toast.error('Failed to load invoice for editing'))
      .finally(() => setLoading(false))
  }, [id, isEdit])

  // ── pre-fill customer from Customers page link ───────────────
  useEffect(() => {
    const preselected = location.state?.preselectedCustomer
    if (!preselected || isEdit) return
    setCustName(preselected.name || '')
    setMobile(preselected.mobile || preselected.phone || '')
    const bal = parseFloat(preselected.outstanding_balance || preselected.opening_balance || 0)
    setPrevBalanceInput(bal > 0 ? String(bal) : '')
  }, [])

  // ── row product search ───────────────────────────────────────
  useEffect(() => {
    if (!rowSearch.trim()) { setRowResults(allProducts); return }
    const q = rowSearch.toLowerCase()
    const localResults = allProducts.filter((p) =>
      p.name?.toLowerCase().includes(q) ||
      p.barcode?.toLowerCase().includes(q) ||
      p.sku?.toLowerCase().includes(q)
    )
    if (localResults.length > 0) {
      setRowResults(localResults)
    } else {
      // fallback: live API search (handles products outside the local 1000-item cache)
      productAPI.getAll({ search: rowSearch.trim(), limit: 20 })
        .then(({ data }) => setRowResults(data.data || data.products || data.results || []))
        .catch(() => setRowResults([]))
    }
  }, [rowSearch, allProducts])

  // ── barcode live search ──────────────────────────────────────
  useEffect(() => {
    if (!barcodeSearch.trim() || activeBarcodeSearch === null) { setBarcodeResults([]); return }
    const q = barcodeSearch.toLowerCase()
    const localResults = allProducts.filter((p) =>
      (p.barcode || '').toLowerCase().includes(q) ||
      (p.sku || '').toLowerCase().includes(q) ||
      p.name?.toLowerCase().includes(q)
    )
    if (localResults.length > 0) {
      setBarcodeResults(localResults)
    } else {
      productAPI.getAll({ search: barcodeSearch.trim(), limit: 20 })
        .then(({ data }) => setBarcodeResults(data.data || data.products || data.results || []))
        .catch(() => setBarcodeResults([]))
    }
  }, [barcodeSearch, allProducts, activeBarcodeSearch])

  // ── barcode scan ─────────────────────────────────────────────
  const handleBarcodeEnter = async (e) => {
    if (e.key !== 'Enter' || !barcode.trim()) return
    const q = barcode.trim()
    let found = allProducts.find(
      (p) => (p.barcode || '') === q || (p.sku || '') === q
    )
    if (!found) {
      try {
        const res = await productAPI.getAll({ search: q, limit: 10 })
        const list = res.data?.data || res.data?.products || []
        found = list.find(
          (p) => (p.barcode || '').toLowerCase() === q.toLowerCase() ||
                 (p.sku || '').toLowerCase() === q.toLowerCase()
        )
      } catch (_) {}
    }
    if (found) {
      addProductRow(found)
      setBarcode('')
    } else {
      // Check if it's a sold (archived) product
      try {
        const soldRes = await productAPI.getAll({ search: q, limit: 10, is_active: false })
        const soldList = soldRes.data?.data || soldRes.data?.products || []
        const soldMatch = soldList.find(
          (p) => (p.barcode || '').toLowerCase() === q.toLowerCase() ||
                 (p.sku || '').toLowerCase() === q.toLowerCase()
        )
        if (soldMatch) {
          toast.error(`SOLD — ${soldMatch.name} (out of stock)`)
          setBarcode('')
          return
        }
      } catch (_) {}
      toast.error('Product not found for barcode: ' + q)
    }
  }

  const applyProductToRow = (existingRow, product) => calcRow({
    ...existingRow,
    product_id:   product.id,
    product_name: product.name,
    stock:        product.stock       || 0,
    mrp:          parseFloat(product.mrp || product.sale_price || 0),
    unit_price:   parseFloat(product.sale_price || 0), // overridden by calcRow when discount_per > 0
    tax_rate:     parseFloat(product.tax_rate || 0),
    discount_per: parseFloat(product.discount_per || 0),
  })

  const addProductRow = (product) => {
    setRows((prev) => {
      const last = prev[prev.length - 1]
      if (!last.product_id) {
        const updated = [...prev]
        updated[updated.length - 1] = applyProductToRow(last, product)
        return updated
      }
      return [...prev, applyProductToRow(newRow(), product)]
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

  const updateRowDisc = (idx, val) => {
    setRows((prev) => {
      const next = [...prev]
      next[idx] = calcRow({ ...next[idx], discount_per: val })
      return next
    })
  }

  // Reset manual discount when any product with auto-discount is present
  useEffect(() => {
    const hasAuto = rows.some((r) => r.product_id && parseFloat(r.discount_per) > 0)
    if (hasAuto) { setDiscountApplied(0); setDiscountVal('') }
  }, [rows])

  // ── auto-discount derived from product discount_per ─────────
  const hasAutoDiscount  = rows.some((r) => r.product_id && parseFloat(r.discount_per) > 0)
  const autoDiscountAmt  = rows.reduce((s, r) => {
    const saved = Math.max(0, (parseFloat(r.mrp) - parseFloat(r.unit_price)) * (parseFloat(r.qty) || 0))
    return s + saved
  }, 0)

  // ── computed totals ──────────────────────────────────────────
  const totalQty    = rows.reduce((s, r) => s + (parseFloat(r.qty) || 0), 0)
  const totalItems  = rows.filter((r) => r.product_id).length
  const subTotal    = rows.reduce((s, r) => s + (r.total_before || 0), 0)
  const totalTax    = rows.reduce((s, r) => s + (r.tax_amt || 0), 0)
  const prevBalance = parseFloat(prevBalanceInput) || 0
  const shippingAmt = parseFloat(shipping || 0)
  // Before-tax discount: reduces the taxable base, so GST is also reduced proportionally
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
    // Use pre-discount base so clicking Apply multiple times gives the same result
    const base = discountType === 'before_tax'
      ? subTotal
      : (subTotal + totalTax + shippingAmt)
    if (discountMode === 'percent') {
      setDiscountApplied(parseFloat(((base * val) / 100).toFixed(2)))
    } else {
      setDiscountApplied(parseFloat(val.toFixed(2)))
    }
  }

  // ── place order ──────────────────────────────────────────────
  const handlePlaceOrder = async () => {
    const validRows = rows.filter((r) => r.product_id)
    if (!validRows.length) { toast.error('Add at least one product'); return }
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
        customer_id: null,
        customer_name: custName.trim() || 'Walk-in',
        mobile: mobile || '',
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
        discount_amount: parseFloat((subTotal + totalTax - (grandTotal - shippingAmt)).toFixed(2)),
        grand_total: grandTotal,
        status: 'confirmed',
        // Payments are only submitted when raising the bill. On edit the server
        // recomputes paid_amount from the existing payment rows and ignores
        // these, so sending them would imply a change that never happens.
        ...(isEdit ? {} : {
          payment: { mode: primaryMode, amount: totalSplitPaid },
          payments: splitPayments,
        }),
      }
      if (isEdit) {
        await saleAPI.update(id, payload)
        if (invoiceImages.length > 0 || existingImages.length > 0) {
          try {
            const fd = new FormData()
            invoiceImages.forEach(({ file }) => fd.append('images', file))
            fd.append('keep_images', JSON.stringify(existingImages))
            await saleAPI.uploadImages(id, fd)
          } catch { /* non-critical */ }
        }
        toast.success('Invoice updated')
      } else {
        const { data: saleRes } = await saleAPI.create(payload)
        toast.success('Order placed!')
        const saleId    = saleRes?.data?.id || saleRes?.id
        if (saleId && invoiceImages.length > 0) {
          try {
            const fd = new FormData()
            invoiceImages.forEach(({ file }) => fd.append('images', file))
            fd.append('keep_images', '[]')
            await saleAPI.uploadImages(saleId, fd)
          } catch { /* non-critical */ }
        }
        // Offer WhatsApp even when no number was typed on the bill — most
        // walk-in invoices are raised without one, and this used to skip
        // silently so the option looked like it had disappeared.
        let custPhone = mobile
        if (saleId && !custPhone) {
          custPhone = window.prompt("Send this invoice on WhatsApp?\nEnter the customer's number, or leave blank to skip:", '') || ''
        }
        if (saleId && custPhone) {
          try {
            const { data: waRes } = await whatsappAPI.sendInvoice(saleId, { phone: custPhone })
            const msgText = waRes?.message_text
            const phone   = waRes?.phone || custPhone
            if (msgText && phone) {
              const digits    = String(phone).replace(/\D/g, '')
              const intlPhone = digits.startsWith('91') ? digits : `91${digits.replace(/^0/, '')}`
              setWaModal({ url: `https://wa.me/${intlPhone}?text=${encodeURIComponent(msgText)}`, customerName: custName || 'Customer' })
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

  const BACKEND_URL = import.meta.env.VITE_API_URL || 'https://backend-production-59b25.up.railway.app'
  const getImgSrc = (url) => url?.startsWith('http') ? url : `${BACKEND_URL}${url}`

  return (
    <div className="flex flex-col min-h-full pb-16 -m-4 lg:-m-6 bg-white">

      {/* ── Row 1: Customer search | Barcode | Action buttons ── */}
      <div className="flex items-center gap-2 px-3 py-2 border-b-2 border-amber-200 bg-amber-50/40 flex-wrap">

        {/* Customer fields + Save button */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={custName}
              onChange={(e) => setCustName(e.target.value)}
              placeholder="Customer Name"
              className="border-2 border-amber-500 rounded-lg px-2 py-1.5 text-xs w-36 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-500 bg-white"
            />
            <input
              type="text"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              placeholder="Mobile Number"
              className="border-2 border-amber-500 rounded-lg px-2 py-1.5 text-xs w-32 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-500 bg-white"
            />
            <div className="flex items-center gap-1">
              <span className="text-xs text-red-600 font-medium whitespace-nowrap">Prev. ₹</span>
              <input
                type="number"
                min="0"
                value={prevBalanceInput}
                onChange={(e) => setPrevBalanceInput(e.target.value)}
                placeholder="0"
                className="w-20 border border-red-500 rounded-lg px-1.5 py-1.5 text-xs text-red-700 font-semibold bg-white focus:outline-none focus:ring-1 focus:ring-red-400"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={saveCustomer}
            className="self-start text-[10px] font-semibold px-2 py-0.5 rounded bg-green-600 hover:bg-green-700 text-white"
          >
            Save Customer Data
          </button>
        </div>

        {/* Barcode */}
        <div className="relative flex items-center w-56">
          <ScanBarcode className="absolute left-2 h-3.5 w-3.5 text-violet-400" />
          <input
            ref={barcodeRef}
            type="text"
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            onKeyDown={handleBarcodeEnter}
            placeholder="Scan or enter barcode/alias(Alt+R)"
            className="w-full border-2 border-violet-500 rounded-lg pl-7 pr-7 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-violet-500 bg-white"
          />
          {barcode && (
            <button onClick={() => setBarcode('')} className="absolute right-2 text-gray-400 hover:text-gray-600">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1 flex-wrap">
          <button
            onClick={() => setRows((prev) => [...prev, newRow()])}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded border border-gray-500 text-gray-700 hover:bg-gray-50"
          >
            <Plus className="h-3 w-3" /> PRODUCT
          </button>
          <button className="px-3 py-1.5 text-xs font-semibold rounded border border-gray-500 text-gray-700 hover:bg-gray-50">
            ADD GST
          </button>
          <button
            onClick={() => { setRows([newRow()]); setCustName(''); setMobile(''); setPrevBalanceInput('') }}
            className="p-1.5 rounded bg-red-500 text-white hover:bg-red-600"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* ── Row 2: Invoice No | Invoice Date ─── */}
      <div className="flex items-center gap-2 px-3 py-2 border-b-2 border-slate-400 bg-slate-50/40 flex-wrap">
        <div className="flex items-center gap-1 ml-auto">
          <span className="text-xs text-amber-700 font-semibold whitespace-nowrap">Invoice No.</span>
          <input
            type="text"
            value={invoiceNo}
            onChange={(e) => setInvoiceNo(e.target.value)}
            className="w-28 border-2 border-amber-500 rounded-lg px-2 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-500 bg-white"
          />
          <button onClick={fetchNextInvoiceNo} className="p-1.5 bg-green-500 hover:bg-green-600 rounded text-white" title="Refresh invoice number">
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
          <button className="p-1.5 border-2 border-amber-500 rounded-lg text-amber-600 hover:bg-amber-50">
            <Calendar className="h-3.5 w-3.5" />
          </button>
          <button className="p-1.5 border-2 border-amber-500 rounded-lg text-amber-600 hover:bg-amber-50">
            <Info className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* ── Main: Table (left) + Totals (right) ──────────────── */}
      <div className="flex flex-1 gap-0 divide-x divide-slate-200 overflow-hidden">

        {/* LEFT: items table */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="overflow-x-auto flex-1">
            <table className="text-xs border-collapse" style={{ tableLayout: 'fixed', width: '100%', minWidth: '684px' }}>
              <colgroup>
                <col style={{ width: '18px' }} />
                <col style={{ width: '115px' }} />
                <col style={{ width: '65px' }} />
                <col style={{ width: '42px' }} />
                <col style={{ width: '50px' }} />
                <col style={{ width: '60px' }} />
                <col style={{ width: '48px' }} />
                <col style={{ width: '70px' }} />
                <col style={{ width: '48px' }} />
                <col style={{ width: '75px' }} />
                <col style={{ width: '75px' }} />
                <col style={{ width: '18px' }} />
              </colgroup>
              <thead className="bg-slate-800 sticky top-0">
                <tr className="border-b-2 border-slate-600">
                  <th className="px-1 py-1.5 text-left text-slate-200 font-medium">#</th>
                  <th className="px-1 py-1.5 text-left text-slate-200 font-medium">Name</th>
                  <th className="px-1 py-1.5 text-left text-slate-200 font-medium">Barcode</th>
                  <th className="px-1 py-1.5 text-center text-slate-200 font-medium">Qty</th>
                  <th className="px-1 py-1.5 text-right text-slate-200 font-medium">Stock</th>
                  <th className="px-1 py-1.5 text-right text-slate-200 font-medium">MRP.</th>
                  <th className="px-1 py-1.5 text-center text-slate-200 font-medium">Disc%</th>
                  <th className="px-1 py-1.5 text-right text-slate-200 font-medium">UnitPrice</th>
                  <th className="px-1 py-1.5 text-right text-slate-200 font-medium">GST</th>
                  <th className="px-1 py-1.5 text-right text-slate-200 font-medium">Total<span className="text-slate-300 font-normal">(BT)</span></th>
                  <th className="px-1 py-1.5 text-right text-slate-200 font-medium">Total<span className="text-slate-300 font-normal">(AT)</span></th>
                  <th className="px-1 py-1.5"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr key={row._id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-1 py-1 text-gray-400">{idx + 1}</td>

                    {/* Name with search dropdown */}
                    <td className="px-1 py-1">
                      <div className="relative">
                        <input
                          type="text"
                          value={activeRowSearch === idx ? rowSearch : row.product_name}
                          onChange={(e) => { setRowSearch(e.target.value); setActiveRowSearch(idx) }}
                          onFocus={() => { setActiveRowSearch(idx); setRowSearch(row.product_name) }}
                          onBlur={() => setTimeout(() => { if (activeRowSearch === idx) setActiveRowSearch(null) }, 200)}
                          placeholder="Search product..."
                          className="w-full border-2 border-amber-200 rounded-lg px-1 py-0.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 bg-white"
                        />
                        {activeRowSearch === idx && rowResults.length > 0 && (
                          <div className="absolute top-full left-0 bg-white border border-slate-400 rounded shadow-lg z-40 max-h-72 overflow-y-auto min-w-[260px]">
                            {rowResults.map((p) => (
                              <button key={p.id}
                                onMouseDown={() => {
                                  setRows((prev) => {
                                    const next = [...prev]
                                    next[idx] = applyProductToRow(next[idx], p)
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

                    {/* Barcode */}
                    <td className="px-1 py-1">
                      <div className="relative">
                        <input
                          type="text"
                          value={activeBarcodeSearch === idx ? barcodeSearch : row.batch}
                          onChange={(e) => { setBarcodeSearch(e.target.value); setActiveBarcodeSearch(idx) }}
                          onFocus={() => { setActiveBarcodeSearch(idx); setBarcodeSearch(row.batch) }}
                          onBlur={() => setTimeout(() => { if (activeBarcodeSearch === idx) setActiveBarcodeSearch(null) }, 200)}
                          onKeyDown={async (e) => {
                            if (e.key !== 'Enter') return
                            const q = (activeBarcodeSearch === idx ? barcodeSearch : row.batch).trim()
                            if (!q) return
                            let found = allProducts.find(
                              (p) => (p.barcode || '').toLowerCase() === q.toLowerCase() ||
                                     (p.sku || '').toLowerCase() === q.toLowerCase()
                            )
                            if (!found) {
                              try {
                                const res = await productAPI.getAll({ search: q, limit: 10 })
                                const list = res.data?.data || []
                                found = list.find(
                                  (p) => (p.barcode || '').toLowerCase() === q.toLowerCase() ||
                                         (p.sku || '').toLowerCase() === q.toLowerCase()
                                )
                              } catch (_) {}
                            }
                            if (found) {
                              setRows((prev) => { const next = [...prev]; next[idx] = applyProductToRow(next[idx], found); return next })
                              setActiveBarcodeSearch(null); setBarcodeSearch('')
                            } else {
                              toast.error('Product not found for barcode: ' + q)
                            }
                          }}
                          placeholder="Scan barcode..."
                          className="w-full border-2 border-amber-200 rounded-lg px-1 py-0.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 bg-white"
                        />
                        {activeBarcodeSearch === idx && barcodeResults.length > 0 && (
                          <div className="absolute top-full left-0 bg-white border border-slate-400 rounded shadow-lg z-40 max-h-72 overflow-y-auto min-w-[280px]">
                            {barcodeResults.map((p) => (
                              <button key={p.id}
                                onMouseDown={() => {
                                  setRows((prev) => { const next = [...prev]; next[idx] = applyProductToRow(next[idx], p); return next })
                                  setActiveBarcodeSearch(null); setBarcodeSearch('')
                                }}
                                className="w-full text-left px-3 py-1.5 text-xs hover:bg-amber-50 flex items-center gap-2"
                              >
                                <span className="font-mono text-violet-600 shrink-0">{p.barcode || p.sku || '—'}</span>
                                <span className="font-medium text-gray-800 truncate">{p.name}</span>
                                <span className="text-gray-400 ml-auto shrink-0">₹{p.sale_price}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Qty */}
                    <td className="px-1 py-1">
                      <input type="number" min="1" value={row.qty}
                        onChange={(e) => updateRow(idx, 'qty', e.target.value)}
                        className="w-full border-2 border-green-300 rounded-lg px-1 py-0.5 text-xs text-center focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-green-500 bg-white"
                      />
                    </td>

                    {/* Stock */}
                    <td className="px-1 py-1 text-right">
                      <span className="inline-block w-full text-right text-xs font-semibold text-cyan-700 bg-cyan-50 border-2 border-cyan-300 rounded-lg px-1 py-0.5">{row.stock}</span>
                    </td>

                    {/* MRP */}
                    <td className="px-1 py-1">
                      <input type="number" min="0" step="0.01" value={row.mrp}
                        onChange={(e) => updateRow(idx, 'mrp', e.target.value)}
                        className="w-full border-2 border-amber-500 rounded-lg px-1 py-0.5 text-xs text-right focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-500 bg-white"
                      />
                    </td>

                    {/* Disc% */}
                    <td className="px-1 py-1">
                      <input
                        type="number" min="0" max="100" step="0.01"
                        value={row.discount_per}
                        onChange={(e) => updateRowDisc(idx, e.target.value)}
                        placeholder="0"
                        title={parseFloat(row.discount_per) > 0 ? 'Auto from product' : 'Manual discount %'}
                        className={`w-full border-2 rounded-lg px-1 py-0.5 text-xs text-center focus:outline-none focus:ring-2 bg-white ${
                          parseFloat(row.discount_per) > 0
                            ? 'border-green-400 text-green-700 focus:ring-green-400 bg-green-50'
                            : 'border-slate-300 text-slate-600 focus:ring-slate-400'
                        }`}
                      />
                    </td>

                    {/* UnitPrice */}
                    <td className="px-1 py-1">
                      <input type="number" min="0" step="0.01" value={row.unit_price}
                        onChange={(e) => {
                          setRows((prev) => {
                            const next = [...prev]
                            // Clear discount_per so calcRow uses this manual price
                            next[idx] = calcRow({ ...next[idx], unit_price: e.target.value, discount_per: 0 })
                            return next
                          })
                        }}
                        className="w-full border-2 border-orange-300 rounded-lg px-1 py-0.5 text-xs text-right focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-500 bg-white"
                      />
                    </td>

                    {/* GST */}
                    <td className="px-1 py-1">
                      <input type="number" min="0" max="28" step="0.01" value={row.tax_rate}
                        onChange={(e) => updateRow(idx, 'tax_rate', e.target.value)}
                        className="w-full border-2 border-yellow-300 rounded-lg px-1 py-0.5 text-xs text-right focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-yellow-500 bg-yellow-50"
                      />
                    </td>

                    {/* Total Before Tax */}
                    <td className="px-1 py-1 text-right">
                      <span className="inline-block w-full text-right text-xs font-semibold text-indigo-700 bg-indigo-50 border-2 border-indigo-300 rounded-lg px-1 py-0.5">{(row.total_before || 0).toFixed(2)}</span>
                    </td>

                    {/* Total After Tax */}
                    <td className="px-1 py-1 text-right">
                      <span className="inline-block w-full text-right text-xs font-bold text-green-700 bg-green-50 border-2 border-green-400 rounded-lg px-1 py-0.5">{(row.total_after || 0).toFixed(2)}</span>
                    </td>

                    {/* Remove */}
                    <td className="px-1 py-1">
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
          <div className="flex items-center gap-3 px-3 py-2 border-t border-slate-400 bg-slate-50">
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
              <span className="text-gray-600 font-medium">GST</span>
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
              {hasAutoDiscount && (
                <span className="text-xs bg-green-500 text-white px-1.5 py-0.5 rounded font-bold tracking-wide">AUTO</span>
              )}
            </div>

            {hasAutoDiscount ? (
              /* ── Auto discount from product CSV ── */
              <div className="space-y-1.5">
                <div className="bg-green-50 border border-green-300 rounded-lg px-3 py-2">
                  <p className="text-xs text-green-700 font-semibold">Product discounts auto-applied</p>
                  <p className="text-sm text-green-800 font-bold mt-0.5">− ₹{autoDiscountAmt.toFixed(2)} saved on MRP</p>
                </div>
                {rows.filter((r) => r.product_id && parseFloat(r.discount_per) > 0).map((r) => (
                  <div key={r._id} className="flex justify-between items-center bg-white border border-green-200 rounded px-2 py-1">
                    <span className="text-xs text-slate-600 truncate max-w-[130px]">{r.product_name}</span>
                    <span className="text-xs text-green-700 font-bold shrink-0">{parseFloat(r.discount_per)}% off</span>
                  </div>
                ))}
                <p className="text-xs text-orange-500 italic">Discount already embedded in unit price</p>
              </div>
            ) : (
              /* ── Manual discount (no product discount in CSV) ── */
              <>
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
              </>
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

          {/* Photos Section */}
          <div className="px-4 py-3 bg-sky-50 border-b-2 border-sky-200 shrink-0">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1.5 h-4 rounded-full bg-sky-400 shrink-0" />
              <span className="text-xs font-bold text-sky-700 uppercase tracking-wide">Photos</span>
              <span className="text-xs text-sky-500 ml-auto">{existingImages.length + invoiceImages.length}/10</span>
            </div>
            {(existingImages.length > 0 || invoiceImages.length > 0) && (
              <div className="grid grid-cols-3 gap-1.5 mb-2">
                {existingImages.map((url, i) => (
                  <div key={`ex-${i}`} className="relative group aspect-square">
                    <img src={getImgSrc(url)} alt="" className="w-full h-full object-cover rounded-lg border border-sky-200" />
                    <button
                      onClick={() => setExistingImages(prev => prev.filter((_, j) => j !== i))}
                      className="absolute top-0.5 right-0.5 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </div>
                ))}
                {invoiceImages.map((img, i) => (
                  <div key={`new-${i}`} className="relative group aspect-square">
                    <img src={img.preview} alt="" className="w-full h-full object-cover rounded-lg border border-sky-200" />
                    <button
                      onClick={() => setInvoiceImages(prev => { URL.revokeObjectURL(prev[i].preview); return prev.filter((_, j) => j !== i) })}
                      className="absolute top-0.5 right-0.5 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <input
              ref={invoiceFileRef}
              type="file" accept="image/*" multiple className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files || [])
                const remaining = 10 - existingImages.length - invoiceImages.length
                const toAdd = files.slice(0, remaining).map(file => ({ file, preview: URL.createObjectURL(file) }))
                setInvoiceImages(prev => [...prev, ...toAdd])
                e.target.value = ''
              }}
            />
            <button
              onClick={() => invoiceFileRef.current?.click()}
              disabled={existingImages.length + invoiceImages.length >= 10}
              className="w-full border-2 border-dashed border-sky-300 rounded-lg py-2 text-xs text-sky-600 hover:bg-sky-100 disabled:opacity-40 flex items-center justify-center gap-1.5 transition-colors"
            >
              <Camera className="h-3.5 w-3.5" />
              Add Photos
            </button>
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
                  onClick={() => { setUpiDetails(d => ({...d, app: upiIds.upi1, ref: d.ref})); setShowUpiOptions(false); setActivePayPopup('upi') }}
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
                  onClick={() => { setUpiDetails(d => ({...d, app: upiIds.upi2, ref: d.ref})); setShowUpiOptions(false); setActivePayPopup('upi') }}
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
              onClick={() => { setShowQrModal(false) }}
              className="w-full bg-green-500 hover:bg-green-600 text-white py-2.5 rounded-xl text-sm font-semibold"
            >
              Pay
            </button>
          </div>
        </div>
      )}


      {/* ── Payment mode popups ───────────────────────────────── */}
      {/* Locked while editing: PUT /sales/:id recomputes paid_amount from the
          payment rows already on record and ignores any sent here, so an edit
          made in this popup would silently do nothing. */}
      {activePayPopup && !isEdit && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setActivePayPopup(null)} />
          <div className="fixed bottom-16 left-0 lg:left-64 z-50 w-80 bg-gray-800 border border-gray-600 rounded-xl shadow-2xl overflow-hidden">

            {/* Popup header */}
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
              {/* Amount field for all modes */}
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

              {/* CARD details */}
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

              {/* UPI details */}
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

              {/* CHEQUE details */}
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

      {/* ── Sticky bottom payment bar — mode buttons ─────────── */}
      <div className="fixed bottom-0 left-0 lg:left-64 right-0 bg-gray-900 flex items-center z-30 h-14">

        {/* Payment mode buttons — only when raising a new bill. On edit the
            backend keeps the existing payment records untouched, so offering
            these would let staff "change" a payment that never changes. */}
        {!isEdit ? (
          <>
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
          </>
        ) : (
          <div className="flex items-center gap-2 px-4 h-full border-r border-gray-700 text-gray-400">
            <Lock className="h-3.5 w-3.5 shrink-0" />
            <span className="text-xs">
              Payments locked — recorded payments stay as they are.
              <span className="hidden sm:inline"> Use Add Payment on the invoice to record a new one.</span>
            </span>
          </div>
        )}

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

        {/* Create Bill */}
        <button onClick={handlePlaceOrder} disabled={saving}
          className="flex items-center gap-2 h-full px-5 bg-gradient-to-r from-orange-500 to-yellow-400 text-white font-bold text-sm hover:from-orange-600 hover:to-yellow-500 disabled:opacity-60 whitespace-nowrap shrink-0">
          {saving ? <LoadingSpinner size="sm" /> : null}
          Create Bill
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
