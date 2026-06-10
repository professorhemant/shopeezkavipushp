import { useState, useRef, useEffect } from 'react'
import { Barcode, Download, RefreshCw, Search, Package, Save, Printer, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { toolsAPI, productAPI } from '../../api'

const BARCODE_TYPES = ['CODE128', 'CODE39', 'EAN13', 'EAN8', 'UPC', 'QR']

export default function BarcodeGenerator() {
  const [form, setForm] = useState({ text: '', type: 'CODE128', width: 2, height: 80 })
  const [barcodeUrl, setBarcodeUrl] = useState(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const searchRef = useRef(null)
  const searchTimer = useRef(null)

  useEffect(() => {
    const handler = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) setShowDropdown(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSearch = (q) => {
    setSearchQuery(q)
    setShowDropdown(true)
    clearTimeout(searchTimer.current)
    if (!q.trim()) { setSearchResults([]); return }
    searchTimer.current = setTimeout(async () => {
      setSearching(true)
      try {
        const { data } = await productAPI.getAll({ search: q, limit: 8 })
        setSearchResults(data?.data || [])
      } catch {
        setSearchResults([])
      } finally {
        setSearching(false)
      }
    }, 300)
  }

  const selectProduct = (product) => {
    setSelectedProduct(product)
    setSearchQuery(product.name)
    setShowDropdown(false)
    const barcodeValue = product.barcode || product.sku || ''
    setForm((f) => ({ ...f, text: barcodeValue }))
    setBarcodeUrl(null)
  }

  const clearProduct = () => {
    setSelectedProduct(null)
    setSearchQuery('')
    setForm((f) => ({ ...f, text: '' }))
    setBarcodeUrl(null)
    setSearchResults([])
  }

  const handleGenerate = async (e) => {
    e.preventDefault()
    if (!form.text.trim()) return toast.error('Enter text or select a product')
    setLoading(true)
    try {
      const { data } = await toolsAPI.generateBarcode(form)
      const barcode = data?.data?.barcode
      if (barcode) setBarcodeUrl(barcode)
      toast.success('Barcode generated!')
    } catch {
      toast.error('Failed to generate barcode')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveToProduct = async () => {
    if (!selectedProduct || !form.text.trim()) return
    setSaving(true)
    try {
      await productAPI.update(selectedProduct.id, { barcode: form.text })
      setSelectedProduct((p) => ({ ...p, barcode: form.text }))
      toast.success('Barcode saved to product!')
    } catch {
      toast.error('Failed to save barcode')
    } finally {
      setSaving(false)
    }
  }

  const handleDownload = () => {
    if (!barcodeUrl) return
    const a = document.createElement('a')
    a.href = barcodeUrl
    a.download = `barcode-${form.text}.png`
    a.click()
  }

  const handlePrint = () => {
    if (!barcodeUrl) return
    const win = window.open('', '_blank')
    win.document.write(`
      <html><head><title>Barcode Label</title>
      <style>
        body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #fff; }
        .label { border: 1px solid #ddd; padding: 16px 20px; text-align: center; width: 280px; }
        .label .top-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px; }
        .label .top-row h3 { margin: 0; font-size: 14px; font-weight: bold; text-align: left; }
        .label .top-row .price { font-size: 18px; font-weight: bold; color: #b45309; white-space: nowrap; }
        .label .meta { font-size: 11px; color: #666; margin: 2px 0; }
        img { max-width: 100%; margin: 8px 0 4px; }
      </style></head>
      <body><div class="label">
        ${selectedProduct ? `
          <div class="top-row">
            <h3>${selectedProduct.name}</h3>
            ${selectedProduct.sale_price ? `<span class="price">&#8377;${Number(selectedProduct.sale_price).toFixed(2)}</span>` : ''}
          </div>` : ''}
        <img src="${barcodeUrl}" />
        <div class="meta">${form.text}</div>
      </div>
      <script>window.onload = () => { window.print(); window.close(); }<\/script>
      </body></html>
    `)
    win.document.close()
  }

  const needsSave = selectedProduct && form.text && selectedProduct.barcode !== form.text

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Barcode Generator</h1>
        <p className="text-sm text-slate-500 mt-0.5">Generate and link barcodes to products</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Left panel */}
        <div className="space-y-4">

          {/* Product search */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
            <h2 className="text-base font-semibold text-slate-800 mb-1">Link to Product</h2>
            <p className="text-xs text-slate-400 mb-3">Optional — select a product to auto-fill its barcode and save it back</p>
            <div className="relative" ref={searchRef}>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  onFocus={() => searchQuery && setShowDropdown(true)}
                  placeholder="Search product name, SKU or barcode…"
                  className="w-full border border-slate-200 rounded-lg pl-9 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
                />
                {searchQuery && (
                  <button onClick={clearProduct} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {showDropdown && (searchResults.length > 0 || searching) && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-56 overflow-auto">
                  {searching ? (
                    <div className="px-4 py-3 text-sm text-slate-400">Searching…</div>
                  ) : searchResults.map((p) => (
                    <button key={p.id} onClick={() => selectProduct(p)}
                      className="w-full text-left px-4 py-2.5 hover:bg-amber-50 flex items-center gap-3 border-b border-slate-50 last:border-0">
                      <Package className="h-4 w-4 text-slate-400 shrink-0" />
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-800 truncate">{p.name}</div>
                        <div className="text-xs text-slate-400 flex gap-3">
                          {p.sku && <span>SKU: {p.sku}</span>}
                          {p.barcode && <span>Barcode: {p.barcode}</span>}
                          {p.sale_price && <span>₹{Number(p.sale_price).toFixed(2)}</span>}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedProduct && (
              <div className="mt-3 bg-amber-50 border border-amber-100 rounded-lg p-3">
                <div className="font-semibold text-slate-800 text-sm">{selectedProduct.name}</div>
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-xs text-slate-600">
                  {selectedProduct.sale_price && <span>Sale Price: <strong>₹{Number(selectedProduct.sale_price).toFixed(2)}</strong></span>}
                  {selectedProduct.purchase_price && <span>Cost: ₹{Number(selectedProduct.purchase_price).toFixed(2)}</span>}
                  {selectedProduct.mrp && <span>MRP: ₹{Number(selectedProduct.mrp).toFixed(2)}</span>}
                  {selectedProduct.stock != null && <span>Stock: {selectedProduct.stock} {selectedProduct.Unit?.short_name || ''}</span>}
                  {selectedProduct.Category?.name && <span>Category: {selectedProduct.Category.name}</span>}
                </div>
                {selectedProduct.barcode
                  ? <p className="text-xs text-slate-500 mt-1.5">Current barcode: <span className="font-mono">{selectedProduct.barcode}</span></p>
                  : <p className="text-xs text-amber-600 mt-1.5">No barcode set — generate one below and save it</p>
                }
              </div>
            )}
          </div>

          {/* Barcode settings */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
            <h2 className="text-base font-semibold text-slate-800 mb-4">Barcode Settings</h2>
            <form onSubmit={handleGenerate} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Text / Value *</label>
                <input
                  value={form.text}
                  onChange={(e) => setForm({ ...form, text: e.target.value })}
                  placeholder="e.g. ITEM-001 or 123456789012"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Barcode Type</label>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500">
                  {BARCODE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Width</label>
                  <input type="number" min={1} max={5} value={form.width}
                    onChange={(e) => setForm({ ...form, width: Number(e.target.value) })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Height (px)</label>
                  <input type="number" min={40} max={200} step={10} value={form.height}
                    onChange={(e) => setForm({ ...form, height: Number(e.target.value) })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" />
                </div>
              </div>

              <button type="submit" disabled={loading}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                {loading ? 'Generating…' : 'Generate Barcode'}
              </button>

              {needsSave && (
                <button type="button" onClick={handleSaveToProduct} disabled={saving}
                  className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
                  <Save className="h-4 w-4" />
                  {saving ? 'Saving…' : `Save Barcode to "${selectedProduct.name}"`}
                </button>
              )}
            </form>
          </div>
        </div>

        {/* Right: Preview */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-slate-800">Preview</h2>
            {barcodeUrl && (
              <div className="flex gap-2">
                <button onClick={handlePrint}
                  className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-slate-700 px-3 py-1.5 rounded-lg text-sm">
                  <Printer className="h-4 w-4" /> Print Label
                </button>
                <button onClick={handleDownload}
                  className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-slate-700 px-3 py-1.5 rounded-lg text-sm">
                  <Download className="h-4 w-4" /> Download
                </button>
              </div>
            )}
          </div>

          {barcodeUrl ? (
            <div className="flex flex-col items-center gap-4 py-4">
              {selectedProduct && (
                <div className="w-full bg-slate-50 border border-slate-100 rounded-lg p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-bold text-slate-800 text-base">{selectedProduct.name}</div>
                    {selectedProduct.sale_price && (
                      <div className="text-2xl font-bold text-amber-600 whitespace-nowrap">
                        ₹{Number(selectedProduct.sale_price).toFixed(2)}
                      </div>
                    )}
                  </div>
                </div>
              )}
              <img src={barcodeUrl} alt="Barcode" className="max-w-full max-h-40 object-contain" />
              <p className="text-sm text-slate-500 font-mono">{form.text}</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center flex-1 py-16 text-slate-300">
              <Barcode className="h-16 w-16 mb-3" />
              <p className="text-sm text-slate-400">Barcode will appear here</p>
              <p className="text-xs text-slate-300 mt-1">Search a product or enter text above</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
