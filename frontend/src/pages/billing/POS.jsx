import { useEffect, useState, useCallback } from 'react'
import {
  Search, Plus, Minus, Trash2, ShoppingCart, CreditCard,
  Smartphone, Banknote, Building2, CheckCircle, Printer, X, Package
} from 'lucide-react'
import toast from 'react-hot-toast'
import { productAPI, saleAPI, customerAPI, categoryAPI } from '../../api'
import { formatCurrency } from '../../utils/formatters'
import LoadingSpinner from '../../components/common/LoadingSpinner'

const PAYMENT_MODES = [
  { id: 'cash', label: 'Cash', icon: Banknote },
  { id: 'upi', label: 'UPI', icon: Smartphone },
  { id: 'card', label: 'Card', icon: CreditCard },
  { id: 'netbanking', label: 'Bank', icon: Building2 },
]

const CASH_DENOMS = [100, 200, 500, 1000, 2000]

function calcCartItem(item) {
  const taxable = item.price * item.qty
  const taxAmt = (taxable * (item.tax_rate || 0)) / 100
  return { ...item, total: taxable + taxAmt, tax_amount: taxAmt }
}

export default function POS() {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [cart, setCart] = useState([])
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [customerSearch, setCustomerSearch] = useState('')
  const [paymentMode, setPaymentMode] = useState('cash')
  const [cashGiven, setCashGiven] = useState(0)
  const [splitPayments, setSplitPayments] = useState([])
  const [isSplit, setIsSplit] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [lastSale, setLastSale] = useState(null)

  useEffect(() => {
    Promise.all([
      productAPI.getAll({ limit: 500, status: 'active' }),
      categoryAPI.getAll(),
      customerAPI.getAll({ limit: 200 }),
    ]).then(([pRes, cRes, custRes]) => {
      setProducts(pRes.data.products || pRes.data.results || pRes.data || [])
      setCategories(cRes.data.categories || cRes.data || [])
      setCustomers(custRes.data.customers || custRes.data.results || custRes.data || [])
    }).catch(() => toast.error('Failed to load POS data'))
      .finally(() => setLoading(false))
  }, [])

  const filteredProducts = products.filter((p) => {
    const matchSearch = !search || (p.name + (p.sku || '')).toLowerCase().includes(search.toLowerCase())
    const matchCat = !categoryFilter || String(p.category) === String(categoryFilter)
    return matchSearch && matchCat
  })

  const addToCart = (product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.product === product.id)
      if (existing) {
        return prev.map((i) => i.product === product.id ? calcCartItem({ ...i, qty: i.qty + 1 }) : i)
      }
      return [...prev, calcCartItem({
        product: product.id, product_name: product.name,
        price: parseFloat(product.sale_price || 0), qty: 1,
        tax_rate: product.tax_rate || 0, unit: product.unit_symbol || 'pcs',
      })]
    })
  }

  const updateQty = (productId, delta) => {
    setCart((prev) => prev
      .map((i) => i.product === productId ? calcCartItem({ ...i, qty: Math.max(1, i.qty + delta) }) : i)
    )
  }

  const removeFromCart = (productId) => setCart((prev) => prev.filter((i) => i.product !== productId))

  const clearCart = () => { setCart([]); setSelectedCustomer(null); setCashGiven(0) }

  const totals = cart.reduce((acc, item) => ({
    subtotal: acc.subtotal + item.price * item.qty,
    tax: acc.tax + item.tax_amount,
    total: acc.total + item.total,
  }), { subtotal: 0, tax: 0, total: 0 })

  const change = Math.max(0, cashGiven - totals.total)

  const handleCompleteSale = async () => {
    if (cart.length === 0) { toast.error('Cart is empty'); return }
    setProcessing(true)
    try {
      const { data } = await saleAPI.create({
        customer: selectedCustomer?.id,
        invoice_date: new Date().toISOString().slice(0, 10),
        items: cart.map(({ product, qty, price, tax_rate, unit, total }) => ({
          product, qty, price, tax_rate, unit, total,
        })),
        total_amount: totals.total,
        paid_amount: totals.total,
        balance_amount: 0,
        payment_mode: paymentMode,
        payment_status: 'paid',
        source: 'pos',
      })
      setLastSale(data.sale || data)
      setShowSuccess(true)
      clearCart()
      toast.success('Sale completed!')
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Sale failed')
    } finally {
      setProcessing(false)
    }
  }

  const filteredCustomers = customerSearch
    ? customers.filter((c) => (c.name + c.phone).toLowerCase().includes(customerSearch.toLowerCase()))
    : customers.slice(0, 5)

  if (loading) return <LoadingSpinner fullscreen />

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4 overflow-hidden">
      {/* Left - Product Grid */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="mb-3 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input type="text" placeholder="Search products or scan barcode..." value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 bg-white" />
          </div>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500">
            <option value="">All Categories</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400">
              <Package className="h-8 w-8 mb-2 text-gray-300" />
              <p className="text-sm">No products found</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
              {filteredProducts.map((p) => (
                <button key={p.id} onClick={() => addToCart(p)}
                  className="bg-white rounded-xl p-3 shadow-sm border border-slate-100 hover:border-amber-300 hover:shadow-md transition-all text-left active:scale-95">
                  {p.image ? (
                    <img src={p.image} alt={p.name} className="w-full h-20 object-cover rounded-lg mb-2" />
                  ) : (
                    <div className="w-full h-20 bg-gray-100 rounded-lg mb-2 flex items-center justify-center">
                      <Package className="h-6 w-6 text-gray-300" />
                    </div>
                  )}
                  <p className="text-xs font-medium text-slate-800 truncate">{p.name}</p>
                  <p className="text-sm font-bold text-amber-600 mt-0.5">{formatCurrency(p.sale_price)}</p>
                  {p.current_stock !== undefined && (
                    <p className={`text-xs mt-0.5 ${p.current_stock <= 0 ? 'text-red-500' : 'text-gray-400'}`}>
                      Stock: {p.current_stock}
                    </p>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right - Cart */}
      <div className="w-80 xl:w-96 flex flex-col bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {/* Customer */}
        <div className="p-3 border-b border-slate-100">
          <div className="relative">
            <input type="text"
              value={selectedCustomer ? selectedCustomer.name : customerSearch}
              onChange={(e) => { setCustomerSearch(e.target.value); setSelectedCustomer(null) }}
              placeholder="Customer (optional)"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" />
            {!selectedCustomer && customerSearch && filteredCustomers.length > 0 && (
              <div className="absolute top-full left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-lg z-30 max-h-32 overflow-y-auto mt-1">
                {filteredCustomers.map((c) => (
                  <button key={c.id} onClick={() => { setSelectedCustomer(c); setCustomerSearch('') }}
                    className="w-full text-left px-3 py-1.5 hover:bg-slate-50 text-xs">
                    {c.name} · {c.phone}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-gray-400">
              <ShoppingCart className="h-8 w-8 mb-2 text-gray-300" />
              <p className="text-sm">Cart is empty</p>
              <p className="text-xs">Click products to add</p>
            </div>
          ) : cart.map((item) => (
            <div key={item.product} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-800 truncate">{item.product_name}</p>
                <p className="text-xs text-gray-400">{formatCurrency(item.price)} × {item.qty}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => updateQty(item.product, -1)} className="w-6 h-6 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center"><Minus className="h-3 w-3" /></button>
                <span className="text-xs font-bold w-5 text-center">{item.qty}</span>
                <button onClick={() => updateQty(item.product, 1)} className="w-6 h-6 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center"><Plus className="h-3 w-3" /></button>
                <button onClick={() => removeFromCart(item.product)} className="w-6 h-6 rounded-full bg-red-100 hover:bg-red-200 flex items-center justify-center ml-1"><Trash2 className="h-3 w-3 text-red-500" /></button>
              </div>
              <p className="text-xs font-bold text-slate-800 w-16 text-right shrink-0">{formatCurrency(item.total)}</p>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="border-t border-slate-100 p-3 space-y-1 text-sm">
          <div className="flex justify-between text-slate-500"><span>Subtotal</span><span>{formatCurrency(totals.subtotal)}</span></div>
          <div className="flex justify-between text-slate-500"><span>GST</span><span>{formatCurrency(totals.tax)}</span></div>
          <div className="flex justify-between font-bold text-lg border-t border-slate-100 pt-2 mt-2">
            <span>Total</span><span className="text-amber-600">{formatCurrency(totals.total)}</span>
          </div>
        </div>

        {/* Payment */}
        <div className="border-t border-slate-100 p-3 space-y-3">
          <div className="grid grid-cols-2 gap-1.5">
            {PAYMENT_MODES.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setPaymentMode(id)}
                className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${paymentMode === id ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                <Icon className="h-3.5 w-3.5" /> {label}
              </button>
            ))}
          </div>

          {paymentMode === 'cash' && (
            <div>
              <p className="text-xs text-slate-500 mb-1.5">Quick Cash</p>
              <div className="flex flex-wrap gap-1 mb-2">
                {CASH_DENOMS.map((d) => (
                  <button key={d} onClick={() => setCashGiven((prev) => prev + d)}
                    className="text-xs bg-green-50 hover:bg-green-100 text-green-700 px-2 py-1 rounded font-medium">
                    +{d}
                  </button>
                ))}
                <button onClick={() => setCashGiven(Math.ceil(totals.total / 10) * 10)}
                  className="text-xs bg-amber-50 hover:bg-amber-100 text-amber-700 px-2 py-1 rounded font-medium">Exact</button>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs">₹</span>
                <input type="number" value={cashGiven || ''} onChange={(e) => setCashGiven(parseFloat(e.target.value) || 0)}
                  placeholder="Cash given"
                  className="w-full pl-6 pr-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" />
              </div>
              {cashGiven > 0 && (
                <div className="mt-2 flex justify-between text-sm font-semibold">
                  <span className="text-slate-600">Change</span>
                  <span className="text-green-600">{formatCurrency(change)}</span>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2">
            {cart.length > 0 && (
              <button onClick={clearCart} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg text-xs flex items-center gap-1">
                <X className="h-3.5 w-3.5" /> Clear
              </button>
            )}
            <button onClick={handleCompleteSale} disabled={processing || cart.length === 0}
              className="flex-1 bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2">
              {processing ? <LoadingSpinner size="sm" /> : <CheckCircle className="h-4 w-4" />}
              Complete Sale
            </button>
          </div>
        </div>
      </div>

      {/* Success Modal */}
      {showSuccess && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 shadow-xl w-full max-w-sm mx-4 text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="font-bold text-slate-800 text-lg mb-1">Sale Completed!</h3>
            <p className="text-slate-500 text-sm mb-1">Invoice #{lastSale?.invoice_no || lastSale?.id}</p>
            <p className="text-2xl font-bold text-amber-600 mb-4">{formatCurrency(lastSale?.total_amount)}</p>
            <div className="flex gap-3">
              <button onClick={() => setShowSuccess(false)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm">New Sale</button>
              <button className="flex-1 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2">
                <Printer className="h-4 w-4" /> Print Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
