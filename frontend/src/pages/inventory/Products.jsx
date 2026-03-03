import { useEffect, useState, useCallback, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Plus, Search, Edit2, Trash2, Barcode, Upload,
  Package, ChevronLeft, ChevronRight, AlertTriangle,
  Printer, Archive, ArchiveRestore, X, FileText,
  CheckCircle, AlertCircle, Download
} from 'lucide-react'
import Papa from 'papaparse'
import toast from 'react-hot-toast'
import { productAPI, categoryAPI, brandAPI } from '../../api'
import { formatCurrency } from '../../utils/formatters'
import LoadingSpinner from '../../components/common/LoadingSpinner'

// Exact CSV column headers (must match file header row)
const CSV_HEADER = 'type,name,bar_code,hsn_code,sell_price,mrp,cost_price,sku,categories,stock_qty,tax_type,tax_rate,brand,variants,show_on_website,trending,tags'

const SAMPLE_CSV = [
  CSV_HEADER,
  'product,B8BPOE01,BPOE01,7117,2800,2800,933.33,,BLK PLSH CZ EARRING,2,inclusive_tax,3,,,,,',
  'product,B8BPOE02,BPOE02,7117,1200,1200,400,,BLK PLSH CZ EARRING,1,inclusive_tax,3,,,,,',
  'product,MyProduct01,MYBAR001,1234,500,600,350,SKU-001,MY CATEGORY,10,inclusive_tax,5,,,,,',
].join('\n')

// Parse one CSV row object → Product model payload
const csvRowToProduct = (row) => {
  // tax_type: "inclusive_tax" → "inclusive", "exclusive_tax" → "exclusive"
  const rawTaxType = (row.tax_type || '').trim().toLowerCase()
  const taxType = rawTaxType.includes('exclusive') ? 'exclusive' : 'inclusive'

  return {
    name:           (row.name || '').trim()       || undefined,
    sku:            (row.sku  || '').trim()       || undefined,
    barcode:        (row.bar_code || '').trim()   || undefined,
    hsn_code:       (row.hsn_code || '').trim()   || undefined,
    sale_price:     parseFloat(row.sell_price)    || 0,
    mrp:            parseFloat(row.mrp)           || 0,
    purchase_price: parseFloat(row.cost_price)    || 0,
    stock:          parseFloat(row.stock_qty)     || 0,
    tax_type:       taxType,
    tax_rate:       parseFloat(row.tax_rate)      || 0,
    // categories column → stored as description (category_id requires DB lookup)
    description:    (row.categories || '').trim() || undefined,
  }
}

function ImportModal({ onClose, onSuccess }) {
  const fileRef = useRef()
  const [file, setFile] = useState(null)
  const [rows, setRows] = useState([])
  const [errors, setErrors] = useState([])
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState(null)
  const [dragOver, setDragOver] = useState(false)

  const parseFile = (f) => {
    setFile(f)
    setResult(null)
    Papa.parse(f, {
      header: true,
      skipEmptyLines: true,
      complete: ({ data, errors: parseErrors }) => {
        const errs = []
        // Only process rows where type === 'product' (skip service/variant rows)
        const productRows = data.filter((r) => !r.type || r.type.trim().toLowerCase() === 'product')
        const clean = productRows.map((row, i) => {
          const product = csvRowToProduct(row)
          if (!product.name) errs.push(`Row ${i + 2}: "name" is required`)
          return product
        })
        setRows(clean)
        setErrors(parseErrors.map((e) => e.message).concat(errs))
      },
    })
  }

  const handleFile = (f) => {
    if (!f) return
    if (!f.name.endsWith('.csv')) return toast.error('Please upload a .csv file')
    parseFile(f)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    handleFile(e.dataTransfer.files[0])
  }

  const handleImport = async () => {
    if (!rows.length) return toast.error('No valid product rows found in the CSV')
    if (errors.length) return toast.error('Fix errors before importing')
    setImporting(true)
    try {
      const { data } = await productAPI.bulkImport({ products: rows })
      setResult(data.data || { imported: 0 })
      onSuccess()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  const downloadSample = () => {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'sample_products.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center">
              <Upload className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-800">Import Products</h2>
              <p className="text-xs text-slate-500">Upload a CSV file to bulk-add products</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
          {/* Sample download */}
          <div className="flex items-center justify-between bg-amber-50 rounded-lg px-4 py-3 text-sm">
            <span className="text-amber-700">
              <strong>Required columns:</strong> name, bar_code, hsn_code, sell_price, mrp, cost_price, stock_qty, tax_type, tax_rate
            </span>
            <button
              onClick={downloadSample}
              className="flex items-center gap-1.5 text-amber-600 hover:text-amber-800 font-medium whitespace-nowrap ml-3"
            >
              <Download className="h-4 w-4" /> Sample CSV
            </button>
          </div>

          {/* Drop zone */}
          {!file ? (
            <div
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
                dragOver ? 'border-amber-400 bg-amber-50' : 'border-gray-200 hover:border-amber-300 hover:bg-gray-50'
              }`}
            >
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={(e) => handleFile(e.target.files[0])} />
              <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600 font-medium">Drop CSV file here or click to browse</p>
              <p className="text-xs text-gray-400 mt-1">Only .csv files supported</p>
            </div>
          ) : (
            <div className="flex items-center gap-3 bg-gray-50 rounded-lg px-4 py-3">
              <FileText className="h-5 w-5 text-amber-600 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{file.name}</p>
                <p className="text-xs text-slate-500">{rows.length} row{rows.length !== 1 ? 's' : ''} parsed</p>
              </div>
              <button
                onClick={() => { setFile(null); setRows([]); setErrors([]); setResult(null) }}
                className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Errors */}
          {errors.length > 0 && (
            <div className="bg-red-50 rounded-lg p-3 space-y-1">
              <p className="text-xs font-semibold text-red-700 flex items-center gap-1.5"><AlertCircle className="h-4 w-4" /> {errors.length} error{errors.length > 1 ? 's' : ''} found</p>
              {errors.slice(0, 5).map((e, i) => <p key={i} className="text-xs text-red-600 ml-5">• {e}</p>)}
              {errors.length > 5 && <p className="text-xs text-red-400 ml-5">...and {errors.length - 5} more</p>}
            </div>
          )}

          {/* Success result */}
          {result && (
            <div className="bg-green-50 rounded-lg p-4 flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-green-800">{result.imported} product{result.imported !== 1 ? 's' : ''} imported successfully!</p>
                <p className="text-xs text-green-600 mt-0.5">Products are now available in your inventory.</p>
              </div>
            </div>
          )}

          {/* Preview table */}
          {rows.length > 0 && !result && (
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">Preview ({rows.length} products)</p>
              <div className="overflow-x-auto rounded-lg border border-slate-200 max-h-56">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left text-slate-500">#</th>
                      {['Name','Barcode','HSN','Cost Price','Sell Price','MRP','Stock','Tax Type'].map((h) => (
                        <th key={h} className="px-3 py-2 text-left text-slate-500 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 20).map((row, i) => (
                      <tr key={i} className="border-t border-slate-100 hover:bg-slate-50">
                        <td className="px-3 py-1.5 text-gray-400">{i + 1}</td>
                        <td className="px-3 py-1.5 font-medium text-slate-800 max-w-[140px] truncate">{row.name || <span className="text-red-400">MISSING</span>}</td>
                        <td className="px-3 py-1.5 font-mono text-slate-500">{row.barcode || '-'}</td>
                        <td className="px-3 py-1.5 text-slate-500">{row.hsn_code || '-'}</td>
                        <td className="px-3 py-1.5 text-slate-700">₹{row.purchase_price ?? '-'}</td>
                        <td className="px-3 py-1.5 text-slate-700">₹{row.sale_price ?? '-'}</td>
                        <td className="px-3 py-1.5 text-slate-700">₹{row.mrp ?? '-'}</td>
                        <td className="px-3 py-1.5 text-slate-600">{row.stock ?? '-'}</td>
                        <td className="px-3 py-1.5 text-slate-500">{row.tax_type || '-'}</td>
                      </tr>
                    ))}
                    {rows.length > 20 && (
                      <tr><td colSpan={8} className="px-3 py-2 text-center text-gray-400 text-xs">...and {rows.length - 20} more rows</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100">
          <button onClick={onClose} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm">
            {result ? 'Close' : 'Cancel'}
          </button>
          {!result && (
            <button
              onClick={handleImport}
              disabled={!rows.length || importing || errors.length > 0}
              className="bg-amber-600 hover:bg-amber-700 text-white px-5 py-2 rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {importing ? <LoadingSpinner size="sm" /> : <Upload className="h-4 w-4" />}
              Import {rows.length > 0 ? `${rows.length} Products` : 'Products'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

const PER_PAGE = 35

export default function Products() {
  const navigate = useNavigate()
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [brands, setBrands] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [brandFilter, setBrandFilter] = useState('')
  const [tab, setTab] = useState('active') // 'active' | 'archived'
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [selected, setSelected] = useState([])
  const [deleteId, setDeleteId] = useState(null)
  const [showBulkDelete, setShowBulkDelete] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [showImport, setShowImport] = useState(false)

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await productAPI.getAll({
        search,
        category_id: categoryFilter || undefined,
        brand_id: brandFilter || undefined,
        page, limit: PER_PAGE,
        is_active: tab === 'active',
      })
      setProducts(data.data || data.products || data.results || [])
      setTotalPages(data.pagination?.pages || 1)
      setTotal(data.pagination?.total || 0)
      setSelected([])
    } catch {
      toast.error('Failed to load products')
    } finally {
      setLoading(false)
    }
  }, [search, categoryFilter, brandFilter, page, tab])

  useEffect(() => { fetchProducts() }, [fetchProducts])

  useEffect(() => {
    categoryAPI.getAll().then(({ data }) => setCategories(data.data || data.categories || [])).catch(() => {})
    brandAPI.getAll().then(({ data }) => setBrands(data.data || data.brands || [])).catch(() => {})
  }, [])

  const handleDelete = async (id) => {
    try {
      await productAPI.delete(id)
      toast.success('Product deleted')
      setDeleteId(null)
      fetchProducts()
    } catch {
      toast.error('Failed to delete product')
    }
  }

  const handleBulkDelete = async () => {
    setBulkDeleting(true)
    try {
      await Promise.all(selected.map((id) => productAPI.delete(id)))
      toast.success(`${selected.length} product${selected.length > 1 ? 's' : ''} deleted`)
      setShowBulkDelete(false)
      fetchProducts()
    } catch {
      toast.error('Some products could not be deleted')
    } finally {
      setBulkDeleting(false)
    }
  }

  const handleArchive = async (id, archive) => {
    try {
      await productAPI.update(id, { is_active: !archive })
      toast.success(archive ? 'Product archived' : 'Product restored')
      fetchProducts()
    } catch {
      toast.error('Failed to update product')
    }
  }

  const toggleSelect = (id) => setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id])
  const toggleAll = () => setSelected(selected.length === products.length ? [] : products.map((p) => p.id))

  const handlePrintBarcodes = () => {
    if (selected.length === 0) return toast.error('Select products to print barcodes')
    toast.success(`Printing barcodes for ${selected.length} product(s)`)
  }

  // Page number buttons (max 9 shown)
  const pageButtons = () => {
    if (totalPages <= 9) return Array.from({ length: totalPages }, (_, i) => i + 1)
    if (page <= 5) return [1, 2, 3, 4, 5, 6, 7, '...', totalPages]
    if (page >= totalPages - 4) return [1, '...', totalPages - 6, totalPages - 5, totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
    return [1, '...', page - 2, page - 1, page, page + 1, page + 2, '...', totalPages]
  }

  const startRow = (page - 1) * PER_PAGE + 1
  const endRow = Math.min(page * PER_PAGE, total)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Products</h1>
          <p className="text-xs text-slate-400 mt-0.5">Dashboard / Products</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <button
            onClick={() => setShowImport(true)}
            className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-2 rounded-lg text-sm flex items-center gap-1.5"
          >
            <Upload className="h-4 w-4" /> Import Products
          </button>
          <button
            onClick={() => navigate('/tools/barcode')}
            className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-2 rounded-lg text-sm flex items-center gap-1.5"
          >
            <Barcode className="h-4 w-4" /> Generate Barcodes
          </button>
          <Link
            to="/inventory/products/add"
            className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5"
          >
            <Plus className="h-4 w-4" /> Add Product
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-100">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Enter name, barcode or SKU"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setPage(1) }}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 min-w-[150px]"
          >
            <option value="">Select Category</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select
            value={brandFilter}
            onChange={(e) => { setBrandFilter(e.target.value); setPage(1) }}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 min-w-[130px]"
          >
            <option value="">All Brands</option>
            {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <button
            onClick={() => { setSearch(''); setCategoryFilter(''); setBrandFilter(''); setPage(1) }}
            className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            SEARCH
          </button>

          <div className="ml-auto flex items-center gap-2">
            {/* Print Barcodes */}
            <button
              onClick={handlePrintBarcodes}
              className="border border-amber-600 text-amber-600 hover:bg-amber-50 px-3 py-2 rounded-lg text-sm flex items-center gap-1.5"
            >
              <Printer className="h-4 w-4" /> Print Barcodes
            </button>
            {/* Tabs */}
            <div className="flex rounded-lg border border-slate-200 overflow-hidden text-sm">
              <button
                onClick={() => { setTab('active'); setPage(1) }}
                className={`px-3 py-2 flex items-center gap-1.5 ${tab === 'active' ? 'bg-gray-100 text-gray-800 font-medium' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                <ArchiveRestore className="h-3.5 w-3.5" /> Unarchived
              </button>
              <button
                onClick={() => { setTab('archived'); setPage(1) }}
                className={`px-3 py-2 flex items-center gap-1.5 border-l border-slate-200 ${tab === 'archived' ? 'bg-amber-600 text-white font-medium' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                <Archive className="h-3.5 w-3.5" /> Archived
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.length > 0 && (
        <div className="flex items-center justify-between bg-amber-600 text-white px-4 py-2.5 rounded-xl text-sm">
          <span className="font-medium">{selected.length} product{selected.length > 1 ? 's' : ''} selected</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelected([])}
              className="px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-sm"
            >
              Deselect All
            </button>
            <button
              onClick={() => setShowBulkDelete(true)}
              className="px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-sm flex items-center gap-1.5 font-medium"
            >
              <Trash2 className="h-4 w-4" /> Delete {selected.length === products.length ? 'All' : 'Selected'} ({selected.length})
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {/* Info row */}
        {!loading && total > 0 && (
          <div className="px-4 py-2 border-b border-slate-100 text-xs text-slate-500">
            Showing {startRow}–{endRow} of {total} products (Page {page} of {totalPages}, {PER_PAGE} per page)
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16"><LoadingSpinner size="lg" /></div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Package className="h-12 w-12 mb-3 text-gray-300" />
            <p className="text-base font-medium text-slate-500">No products found</p>
            <Link to="/inventory/products/add" className="mt-4 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
              Add First Product
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                <tr>
                  <th className="px-3 py-3 text-center w-8">
                    <input type="checkbox" checked={selected.length === products.length} onChange={toggleAll} className="rounded" />
                  </th>
                  <th className="px-3 py-3 text-left w-10">Image</th>
                  <th className="px-3 py-3 text-left">Name</th>
                  <th className="px-3 py-3 text-right">Cost Price</th>
                  <th className="px-3 py-3 text-right">MRP</th>
                  <th className="px-3 py-3 text-right">Sell Price</th>
                  <th className="px-3 py-3 text-center">SKU</th>
                  <th className="px-3 py-3 text-center">Stock</th>
                  <th className="px-3 py-3 text-center">Barcode</th>
                  <th className="px-3 py-3 text-left">Category</th>
                  <th className="px-3 py-3 text-center">Min Stock</th>
                  <th className="px-3 py-3 text-center">Variants</th>
                  <th className="px-3 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const isLow = p.stock != null && p.min_stock != null && parseFloat(p.stock) <= parseFloat(p.min_stock)
                  const categoryName = p.Category?.name || p.category_name || '-'
                  return (
                    <tr key={p.id} className={`border-b hover:bg-slate-50 ${selected.includes(p.id) ? 'bg-amber-50' : ''}`}>
                      <td className="px-3 py-2 text-center">
                        <input type="checkbox" checked={selected.includes(p.id)} onChange={() => toggleSelect(p.id)} className="rounded" />
                      </td>
                      <td className="px-3 py-2">
                        {p.images?.[0] || p.image ? (
                          <img src={p.images?.[0] || p.image} alt={p.name} className="h-9 w-9 rounded object-cover border border-slate-200" />
                        ) : (
                          <div className="h-9 w-9 rounded bg-gray-100 flex items-center justify-center">
                            <Package className="h-4 w-4 text-gray-400" />
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 max-w-[180px]">
                        <button
                          onClick={() => navigate(`/inventory/products/${p.id}/edit`)}
                          className="font-medium text-amber-600 hover:underline text-left truncate block max-w-[180px]"
                        >
                          {p.name}
                        </button>
                      </td>
                      <td className="px-3 py-2 text-right text-slate-700">{formatCurrency(p.purchase_price || 0)}</td>
                      <td className="px-3 py-2 text-right text-slate-700">{formatCurrency(p.mrp || 0)}</td>
                      <td className="px-3 py-2 text-right font-medium text-slate-800">{formatCurrency(p.sale_price || 0)}</td>
                      <td className="px-3 py-2 text-center font-mono text-xs text-slate-600">{p.sku || '-'}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`font-semibold ${isLow ? 'text-red-600' : 'text-slate-800'}`}>
                          {p.stock ?? '-'}
                        </span>
                        {isLow && <AlertTriangle className="h-3 w-3 text-red-500 inline ml-1" />}
                      </td>
                      <td className="px-3 py-2 text-center font-mono text-xs text-slate-600">{p.barcode || '-'}</td>
                      <td className="px-3 py-2 text-slate-600 text-xs">{categoryName}</td>
                      <td className="px-3 py-2 text-center text-slate-600 text-xs">{p.min_stock ?? '-'}</td>
                      <td className="px-3 py-2 text-center">
                        {p.has_variants ? (
                          <span className="text-xs text-amber-600 font-medium">Yes</span>
                        ) : (
                          <button
                            onClick={() => navigate(`/inventory/products/${p.id}/edit`)}
                            className="text-xs text-amber-500 hover:underline"
                          >
                            + Add More
                          </button>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => navigate(`/inventory/products/${p.id}/edit`)}
                            className="p-1.5 rounded hover:bg-amber-50 text-gray-400 hover:text-amber-600"
                            title="Edit"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleArchive(p.id, tab === 'active')}
                            className="p-1.5 rounded hover:bg-amber-50 text-gray-400 hover:text-amber-600"
                            title={tab === 'active' ? 'Archive' : 'Restore'}
                          >
                            {tab === 'active' ? <Archive className="h-3.5 w-3.5" /> : <ArchiveRestore className="h-3.5 w-3.5" />}
                          </button>
                          <button
                            onClick={() => setDeleteId(p.id)}
                            className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600"
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-1 px-4 py-3 border-t border-slate-100 flex-wrap">
            <button
              onClick={() => setPage(1)}
              disabled={page === 1}
              className="px-2 py-1 rounded border border-slate-200 text-sm disabled:opacity-40 hover:bg-slate-50"
            >
              «
            </button>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-2 py-1 rounded border border-slate-200 text-sm disabled:opacity-40 hover:bg-slate-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {pageButtons().map((btn, i) =>
              btn === '...' ? (
                <span key={`ellipsis-${i}`} className="px-2 py-1 text-sm text-slate-400">...</span>
              ) : (
                <button
                  key={btn}
                  onClick={() => setPage(btn)}
                  className={`px-3 py-1 rounded border text-sm ${page === btn ? 'bg-amber-600 text-white border-amber-600' : 'border-slate-200 hover:bg-slate-50'}`}
                >
                  {btn}
                </button>
              )
            )}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-2 py-1 rounded border border-slate-200 text-sm disabled:opacity-40 hover:bg-slate-50"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => setPage(totalPages)}
              disabled={page === totalPages}
              className="px-2 py-1 rounded border border-slate-200 text-sm disabled:opacity-40 hover:bg-slate-50"
            >
              »
            </button>
          </div>
        )}
      </div>

      {/* Import Modal */}
      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onSuccess={() => { fetchProducts() }}
        />
      )}

      {/* Bulk Delete Confirmation Modal */}
      {showBulkDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 shadow-xl w-full max-w-sm mx-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <Trash2 className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800">Delete {selected.length} Product{selected.length > 1 ? 's' : ''}?</h3>
                <p className="text-sm text-slate-500">This action cannot be undone.</p>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setShowBulkDelete(false)}
                disabled={bulkDeleting}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {bulkDeleting ? <LoadingSpinner size="sm" /> : <Trash2 className="h-4 w-4" />}
                Delete {selected.length}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 shadow-xl w-full max-w-sm mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <Trash2 className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800">Delete Product</h3>
                <p className="text-sm text-slate-500">This action cannot be undone.</p>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setDeleteId(null)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm">Cancel</button>
              <button onClick={() => handleDelete(deleteId)} className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
