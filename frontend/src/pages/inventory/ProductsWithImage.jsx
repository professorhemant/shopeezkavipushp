import { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Search, Package, Edit2, Trash2, Archive, ArchiveRestore,
  ChevronLeft, ChevronRight, AlertTriangle, Plus
} from 'lucide-react'
import toast from 'react-hot-toast'
import { productAPI, categoryAPI } from '../../api'
import { formatCurrency } from '../../utils/formatters'
import LoadingSpinner from '../../components/common/LoadingSpinner'

const PER_PAGE = 12

export default function ProductsWithImage() {
  const navigate = useNavigate()
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [tab, setTab] = useState('active')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [deleteId, setDeleteId] = useState(null)

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await productAPI.getAll({
        search,
        category_id: categoryFilter || undefined,
        page,
        limit: PER_PAGE,
        is_active: tab === 'active',
      })
      setProducts(data.data || data.products || data.results || [])
      setTotalPages(data.pagination?.pages || 1)
      setTotal(data.pagination?.total || 0)
    } catch {
      toast.error('Failed to load products')
    } finally {
      setLoading(false)
    }
  }, [search, categoryFilter, page, tab])

  useEffect(() => { fetchProducts() }, [fetchProducts])

  useEffect(() => {
    categoryAPI.getAll().then(({ data }) => setCategories(data.data || data.categories || [])).catch(() => {})
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

  const handleArchive = async (id, archive) => {
    try {
      await productAPI.update(id, { is_active: !archive })
      toast.success(archive ? 'Product archived' : 'Product restored')
      fetchProducts()
    } catch {
      toast.error('Failed to update product')
    }
  }

  const pageButtons = () => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
    if (page <= 4) return [1, 2, 3, 4, 5, '...', totalPages]
    if (page >= totalPages - 3) return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
    return [1, '...', page - 1, page, page + 1, '...', totalPages]
  }

  const startRow = (page - 1) * PER_PAGE + 1
  const endRow = Math.min(page * PER_PAGE, total)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Products with Image</h1>
          <p className="text-xs text-slate-400 mt-0.5">Dashboard / Products with Image</p>
        </div>
        <Link
          to="/inventory/products/add"
          className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5"
        >
          <Plus className="h-4 w-4" /> Add Product
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-100">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, barcode or SKU"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setPage(1) }}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 min-w-[160px]"
          >
            <option value="">All Categories</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button
            onClick={() => { setSearch(''); setCategoryFilter(''); setPage(1) }}
            className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            Reset
          </button>
          <div className="ml-auto flex rounded-lg border border-slate-200 overflow-hidden text-sm">
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

      {/* Count */}
      {!loading && total > 0 && (
        <p className="text-xs text-slate-500 px-1">
          Showing {startRow}–{endRow} of {total} products (Page {page} of {totalPages})
        </p>
      )}

      {/* Cards Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <LoadingSpinner size="lg" />
        </div>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-gray-400">
          <Package className="h-14 w-14 mb-3 text-gray-300" />
          <p className="text-base font-medium text-slate-500">No products found</p>
          <Link
            to="/inventory/products/add"
            className="mt-4 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            Add First Product
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {products.map((p) => {
            const isLow = p.stock != null && p.min_stock != null && parseFloat(p.stock) < parseFloat(p.min_stock)
            const categoryName = p.Category?.name || p.category_name || null
            const imageUrl = p.images?.[0] || p.image || null

            return (
              <div
                key={p.id}
                className="bg-white rounded-xl border border-slate-100 shadow-sm hover:shadow-md hover:border-amber-200 transition-all flex flex-col overflow-hidden group"
              >
                {/* Product Image */}
                <div className="relative w-full h-52 bg-slate-50 flex items-center justify-center overflow-hidden">
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={p.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-slate-300">
                      <Package className="h-14 w-14" />
                      <span className="text-xs font-medium">No Image</span>
                    </div>
                  )}
                  {isLow && (
                    <span className="absolute top-2 left-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" /> Low Stock
                    </span>
                  )}
                  {categoryName && (
                    <span className="absolute top-2 right-2 bg-black/50 text-white text-[10px] px-2 py-0.5 rounded-full truncate max-w-[100px]">
                      {categoryName}
                    </span>
                  )}
                </div>

                {/* Card Body */}
                <div className="flex flex-col flex-1 p-3 gap-2.5">
                  {/* Name */}
                  <button
                    onClick={() => navigate(`/inventory/products/${p.id}/edit`)}
                    className="font-bold text-slate-800 hover:text-amber-600 text-sm text-left leading-snug line-clamp-2 transition-colors"
                  >
                    {p.name}
                  </button>

                  {/* SKU / Barcode row */}
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-400 font-mono">
                    {p.sku   && <span><span className="text-slate-300">SKU:</span> {p.sku}</span>}
                    {p.barcode && <span><span className="text-slate-300">Bar:</span> {p.barcode}</span>}
                    {p.hsn_code && <span><span className="text-slate-300">HSN:</span> {p.hsn_code}</span>}
                  </div>

                  {/* Price grid */}
                  <div className="grid grid-cols-3 divide-x divide-slate-100 bg-slate-50 rounded-lg py-2">
                    <div className="text-center px-1">
                      <p className="text-[10px] text-slate-400 uppercase tracking-wide">Cost</p>
                      <p className="text-xs font-semibold text-slate-700 mt-0.5">{formatCurrency(p.purchase_price || 0)}</p>
                    </div>
                    <div className="text-center px-1">
                      <p className="text-[10px] text-slate-400 uppercase tracking-wide">MRP</p>
                      <p className="text-xs font-semibold text-slate-700 mt-0.5">{formatCurrency(p.mrp || 0)}</p>
                    </div>
                    <div className="text-center px-1">
                      <p className="text-[10px] text-slate-400 uppercase tracking-wide">Sell</p>
                      <p className="text-xs font-bold text-amber-600 mt-0.5">{formatCurrency(p.sale_price || 0)}</p>
                    </div>
                  </div>

                  {/* Stock row */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Stock</span>
                    <span className={`font-bold flex items-center gap-1 ${isLow ? 'text-red-600' : 'text-slate-800'}`}>
                      {p.stock ?? '-'}
                      {p.min_stock != null && <span className="text-slate-300 font-normal">/ min {p.min_stock}</span>}
                      {isLow && <AlertTriangle className="h-3 w-3 text-red-500" />}
                    </span>
                  </div>

                  {/* Tax */}
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>GST</span>
                    <span className="font-medium text-slate-600">{p.tax_rate ?? 0}% ({p.tax_type || 'exclusive'})</span>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2 border-t border-slate-100 mt-auto">
                    <button
                      onClick={() => navigate(`/inventory/products/${p.id}/edit`)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-medium transition-colors"
                    >
                      <Edit2 className="h-3.5 w-3.5" /> Edit
                    </button>
                    <button
                      onClick={() => handleArchive(p.id, tab === 'active')}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-medium transition-colors"
                    >
                      {tab === 'active'
                        ? <><Archive className="h-3.5 w-3.5" /> Archive</>
                        : <><ArchiveRestore className="h-3.5 w-3.5" /> Restore</>
                      }
                    </button>
                    <button
                      onClick={() => setDeleteId(p.id)}
                      className="flex items-center justify-center px-2.5 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 text-xs transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 pt-2 flex-wrap">
          <button
            onClick={() => setPage(1)}
            disabled={page === 1}
            className="px-2 py-1 rounded border border-slate-200 text-sm disabled:opacity-40 hover:bg-slate-50"
          >«</button>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-2 py-1 rounded border border-slate-200 text-sm disabled:opacity-40 hover:bg-slate-50"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          {pageButtons().map((btn, i) =>
            btn === '...' ? (
              <span key={`e-${i}`} className="px-2 py-1 text-sm text-slate-400">...</span>
            ) : (
              <button
                key={btn}
                onClick={() => setPage(btn)}
                className={`px-3 py-1 rounded border text-sm ${
                  page === btn ? 'bg-amber-600 text-white border-amber-600' : 'border-slate-200 hover:bg-slate-50'
                }`}
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
          >»</button>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 shadow-xl w-full max-w-sm mx-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <Trash2 className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800">Delete Product</h3>
                <p className="text-sm text-slate-500">This action cannot be undone.</p>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteId)}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
