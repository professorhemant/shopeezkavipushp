import { useEffect, useState, useRef, useMemo } from 'react'
import { Plus, Edit2, Trash2, Upload, Download, X, AlertTriangle, ImagePlus, Loader2, CheckCircle, FileSpreadsheet } from 'lucide-react'
import Papa from 'papaparse'
import toast from 'react-hot-toast'
import { lehengaAPI } from '../../api'
import { formatCurrency } from '../../utils/formatters'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import BridalImageUpload from '../../components/bridal/BridalImageUpload'

// Suggested values — every one of these is a free-text field, so the dropdowns
// only offer shortcuts; anything typed in is kept as-is.
export const SIZES = ['Free Size', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL']
export const CATEGORIES = ['Bridal', 'Reception', 'Sangeet', 'Mehendi', 'Haldi', 'Party Wear', 'Engagement']
export const FABRICS = ['Silk', 'Raw Silk', 'Velvet', 'Georgette', 'Net', 'Organza', 'Banarasi', 'Chiffon', 'Satin']
export const WORK_TYPES = ['Zari', 'Zardozi', 'Sequins', 'Thread Work', 'Mirror Work', 'Gota Patti', 'Stone Work', 'Hand Embroidery']

export const AVAILABILITY = [
  { value: 'both',   label: 'Rental + Sale', cls: 'bg-purple-100 text-purple-700' },
  { value: 'rental', label: 'Rental Only',   cls: 'bg-blue-100 text-blue-700' },
  { value: 'sale',   label: 'Sale Only',     cls: 'bg-green-100 text-green-700' },
]
export const availabilityMeta = (v) => AVAILABILITY.find(a => a.value === v) || AVAILABILITY[0]

const EMPTY = {
  code: '', name: '', category: '', size: '', colour: '', fabric: '', work_type: '',
  rental_price: '', sale_price: '', cost_price: '', stock: '', location: '',
  description: '', image: '', available_for: 'both',
}

const inp = "border border-slate-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
const lbl = "block text-xs font-medium text-slate-700 mb-1"

export default function LehengaInventory() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [catFilter, setCatFilter] = useState('all')
  const [availFilter, setAvailFilter] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [showImportXlsx, setShowImportXlsx] = useState(false)
  const [showImgBulk, setShowImgBulk] = useState(false)
  const [search, setSearch] = useState('')
  const [hoveredImg, setHoveredImg] = useState(null)

  const [selectedIds, setSelectedIds] = useState(new Set())
  const [showBulkEdit, setShowBulkEdit] = useState(false)

  const load = async () => {
    setLoading(true)
    try { const { data } = await lehengaAPI.listInventory(); setRows(data.data || []) }
    catch { toast.error('Failed to load lehenga inventory') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  // Clear selection whenever the visible set changes underneath it
  useEffect(() => { setSelectedIds(new Set()) }, [catFilter, availFilter, search])

  // Category chips come from the data, so new categories appear without a code change
  const categories = useMemo(
    () => [...new Set(rows.map(r => (r.category || '').trim()).filter(Boolean))].sort(),
    [rows],
  )

  const openAdd = () => { setForm(EMPTY); setEditId(null); setShowForm(true) }
  const openEdit = (r) => {
    setForm({
      code: r.code || '', name: r.name || '', category: r.category || '', size: r.size || '',
      colour: r.colour || '', fabric: r.fabric || '', work_type: r.work_type || '',
      rental_price: r.rental_price ?? '', sale_price: r.sale_price ?? '', cost_price: r.cost_price ?? '',
      stock: r.stock ?? '', location: r.location || '', description: r.description || '',
      image: r.image || '', available_for: r.available_for || 'both',
    })
    setEditId(r.id); setShowForm(true)
  }

  const save = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('Name is required'); return }
    setSaving(true)
    try {
      const payload = {
        ...form,
        rental_price: parseFloat(form.rental_price) || 0,
        sale_price: parseFloat(form.sale_price) || 0,
        cost_price: parseFloat(form.cost_price) || 0,
        stock: form.stock === '' ? 1 : parseInt(form.stock, 10),
      }
      if (editId) { await lehengaAPI.updateInventory(editId, payload); toast.success('Updated') }
      else        { await lehengaAPI.createInventory(payload); toast.success('Added') }
      setShowForm(false); setForm(EMPTY); setEditId(null); load()
    } catch { toast.error('Failed to save') }
    finally { setSaving(false) }
  }

  const remove = async (r) => {
    if (!window.confirm(`Delete "${r.name}"?`)) return
    try { await lehengaAPI.deleteInventory(r.id); toast.success('Deleted'); load() }
    catch { toast.error('Failed to delete') }
  }

  const visible = useMemo(() => {
    let list = rows
    if (catFilter !== 'all') list = list.filter(r => (r.category || '') === catFilter)
    if (availFilter !== 'all') list = list.filter(r => (r.available_for || 'both') === availFilter)
    const q = search.trim().toLowerCase()
    if (!q) return list
    const tokens = q.split(/\s+/).filter(Boolean)
    const strip = s => s.replace(/[\s\-_.]+/g, '')
    return list.filter(r => {
      const raw = [r.code, r.name, r.category, r.size, r.colour, r.fabric, r.work_type, r.description, r.location]
        .filter(Boolean).join(' ').toLowerCase()
      const stripped = strip(raw)
      return tokens.every(t => raw.includes(t) || stripped.includes(strip(t)))
    })
  }, [rows, catFilter, availFilter, search])

  const removeAll = async () => {
    const n = visible.length
    if (n === 0) return
    const scope = catFilter === 'all' ? 'lehengas' : `${catFilter} lehengas`
    if (!window.confirm(`Delete ${n} ${scope}? This permanently removes them and cannot be undone.`)) return
    if (catFilter === 'all' && !window.confirm('This erases your ENTIRE lehenga inventory. Are you absolutely sure?')) return
    try {
      const { data } = await lehengaAPI.deleteAllInventory(catFilter)
      toast.success(`Deleted ${data?.deleted ?? n} lehengas`)
      load()
    } catch { toast.error('Failed to delete all') }
  }

  const allVisibleSelected = visible.length > 0 && visible.every(r => selectedIds.has(r.id))
  const someSelected = selectedIds.size > 0

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    setSelectedIds(allVisibleSelected ? new Set() : new Set(visible.map(r => r.id)))
  }

  const deleteSelected = async () => {
    const n = selectedIds.size
    if (!window.confirm(`Delete ${n} selected lehenga${n !== 1 ? 's' : ''}? This cannot be undone.`)) return
    let ok = 0, fail = 0
    for (const id of selectedIds) {
      try { await lehengaAPI.deleteInventory(id); ok++ } catch { fail++ }
    }
    if (fail) toast.error(`${ok} deleted, ${fail} failed`)
    else toast.success(`${ok} lehenga${ok !== 1 ? 's' : ''} deleted`)
    setSelectedIds(new Set())
    load()
  }

  const selectedItems = rows.filter(r => selectedIds.has(r.id))

  const exportToExcel = async () => {
    if (visible.length === 0) { toast.error('No lehengas to export'); return }
    try {
      const res = await lehengaAPI.exportInventory(catFilter)
      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const scope = catFilter === 'all' ? 'all' : catFilter.replace(/\s+/g, '-').toLowerCase()
      const a = document.createElement('a')
      a.href = url
      a.download = `lehenga-inventory-${scope}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 10000)
      toast.success(`Exported ${visible.length} lehengas`)
    } catch { toast.error('Export failed') }
  }

  return (
    <div className="space-y-5">
      {hoveredImg && (
        <div className="fixed z-[9999] pointer-events-none"
          style={{ left: hoveredImg.x, top: hoveredImg.y, transform: 'translateY(-50%)' }}>
          <img src={hoveredImg.src} alt=""
            className="w-52 h-52 object-contain rounded-xl shadow-2xl border-2 border-white bg-white" />
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Lehenga Inventory</h1>
          <p className="text-sm text-slate-500 mt-0.5">{rows.length} lehengas · feeds Lehenga Rental &amp; Lehenga Sale</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {visible.length > 0 && (
            <button onClick={removeAll}
              className="border border-red-200 text-red-600 hover:bg-red-50 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> {catFilter === 'all' ? 'Delete All' : `Delete All ${catFilter}`}
            </button>
          )}
          <button onClick={exportToExcel}
            className="border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4" /> Export Excel
          </button>
          <button onClick={() => setShowImportXlsx(true)}
            className="border border-green-300 hover:bg-green-50 text-green-700 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4" /> Import Excel
          </button>
          <button onClick={() => setShowImport(true)}
            className="border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
            <Upload className="h-4 w-4" /> Import CSV
          </button>
          <button onClick={() => setShowImgBulk(true)}
            className="border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
            <ImagePlus className="h-4 w-4" /> Upload Images
          </button>
          <button onClick={openAdd}
            className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
            <Plus className="h-4 w-4" /> Add Lehenga
          </button>
        </div>
      </div>

      {someSelected && (
        <div className="flex items-center justify-between bg-amber-600 text-white px-4 py-2.5 rounded-xl text-sm">
          <span className="font-medium">{selectedIds.size} lehenga{selectedIds.size !== 1 ? 's' : ''} selected</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setSelectedIds(new Set())} className="px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-sm">Deselect All</button>
            <button onClick={() => setShowBulkEdit(true)} className="px-3 py-1.5 rounded-lg bg-white text-amber-700 hover:bg-amber-50 text-sm flex items-center gap-1.5 font-medium">
              <Edit2 className="h-4 w-4" /> Bulk Edit ({selectedIds.size})
            </button>
            <button onClick={deleteSelected} className="px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-sm flex items-center gap-1.5 font-medium">
              <Trash2 className="h-4 w-4" /> Delete Selected ({selectedIds.size})
            </button>
          </div>
        </div>
      )}

      {/* Category filter */}
      <div className="flex flex-wrap gap-1.5">
        <button onClick={() => setCatFilter('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium ${catFilter === 'all' ? 'bg-amber-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
          All ({rows.length})
        </button>
        {categories.map(cat => {
          const n = rows.filter(r => (r.category || '') === cat).length
          return (
            <button key={cat} onClick={() => setCatFilter(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium ${catFilter === cat ? 'bg-amber-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              {cat} ({n})
            </button>
          )
        })}
      </div>

      {/* Search + availability filter */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1 min-w-[240px]">
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by code, name, colour, fabric, keywords…" className={inp} />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <select value={availFilter} onChange={e => setAvailFilter(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/30">
          <option value="all">All availability</option>
          {AVAILABILITY.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
        </select>
        <span className="text-xs text-slate-400">{visible.length} shown</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        {loading ? (
          <div className="flex items-center justify-center py-16"><LoadingSpinner size="lg" /></div>
        ) : (
          <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-320px)]">
            <table className="w-full text-sm">
              <thead className="bg-slate-800 text-xs text-slate-200 uppercase sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-3 w-10">
                    <input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAll}
                      className="h-4 w-4 accent-amber-400 cursor-pointer"
                      title={allVisibleSelected ? 'Deselect all' : 'Select all visible'} />
                  </th>
                  <th className="px-4 py-3 text-left">Code</th>
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">Category</th>
                  <th className="px-4 py-3 text-left">Size</th>
                  <th className="px-4 py-3 text-left">Colour</th>
                  <th className="px-4 py-3 text-right">Rent (₹)</th>
                  <th className="px-4 py-3 text-right">Sale (₹)</th>
                  <th className="px-4 py-3 text-right">Stock</th>
                  <th className="px-4 py-3 text-center">For</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 ? (
                  <tr><td colSpan={11} className="text-center py-12 text-slate-400">No lehengas. Add one or import a CSV.</td></tr>
                ) : visible.map(r => {
                  const isChecked = selectedIds.has(r.id)
                  const av = availabilityMeta(r.available_for)
                  return (
                    <tr key={r.id} className={`border-b hover:bg-slate-50 ${isChecked ? 'bg-amber-50' : ''}`}>
                      <td className="px-3 py-3">
                        <input type="checkbox" checked={isChecked} onChange={() => toggleSelect(r.id)}
                          className="h-4 w-4 accent-amber-600 cursor-pointer" />
                      </td>
                      <td className="px-4 py-3 font-semibold text-amber-600">{r.code || '—'}</td>
                      <td className="px-4 py-3 text-slate-700">
                        <div className="flex items-center gap-2">
                          {r.image
                            ? <img src={r.image} alt=""
                                className="h-8 w-8 rounded object-cover border border-slate-200 shrink-0 cursor-zoom-in"
                                onMouseEnter={(e) => {
                                  const rect = e.currentTarget.getBoundingClientRect()
                                  setHoveredImg({ src: r.image, x: rect.right + 10, y: rect.top })
                                }}
                                onMouseLeave={() => setHoveredImg(null)} />
                            : <span className="h-8 w-8 rounded bg-slate-100 border border-slate-200 shrink-0" />}
                          <div className="min-w-0">
                            <div className="truncate">{r.name}</div>
                            {(r.fabric || r.work_type) && (
                              <div className="text-xs text-slate-400 truncate">{[r.fabric, r.work_type].filter(Boolean).join(' · ')}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{r.category || '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{r.size || '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{r.colour || '—'}</td>
                      <td className="px-4 py-3 text-right text-slate-700">{parseFloat(r.rental_price) > 0 ? formatCurrency(r.rental_price) : '—'}</td>
                      <td className="px-4 py-3 text-right text-slate-700">{parseFloat(r.sale_price) > 0 ? formatCurrency(r.sale_price) : '—'}</td>
                      <td className={`px-4 py-3 text-right font-medium ${(r.stock ?? 0) <= 0 ? 'text-red-600' : 'text-slate-600'}`}>{r.stock ?? 0}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs rounded px-2 py-0.5 whitespace-nowrap ${av.cls}`}>{av.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1.5">
                          <button onClick={() => openEdit(r)} className="p-1.5 rounded hover:bg-amber-50 text-slate-400 hover:text-amber-600" title="Edit"><Edit2 className="h-4 w-4" /></button>
                          <button onClick={() => remove(r)} className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-600" title="Delete"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-800">{editId ? 'Edit Lehenga' : 'Add Lehenga'}</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-700"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={save} className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <datalist id="lehenga-sizes">{SIZES.map(s => <option key={s} value={s} />)}</datalist>
              <datalist id="lehenga-categories">{[...new Set([...CATEGORIES, ...categories])].map(s => <option key={s} value={s} />)}</datalist>
              <datalist id="lehenga-fabrics">{FABRICS.map(s => <option key={s} value={s} />)}</datalist>
              <datalist id="lehenga-works">{WORK_TYPES.map(s => <option key={s} value={s} />)}</datalist>

              <div><label className={lbl}>Code</label><input value={form.code} onChange={e => setForm(f => ({...f, code: e.target.value}))} className={inp} placeholder="e.g. LH001" /></div>
              <div className="col-span-2"><label className={lbl}>Name *</label><input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} className={inp} placeholder="e.g. Maroon Velvet Bridal Lehenga" required /></div>

              <div><label className={lbl}>Category</label><input list="lehenga-categories" value={form.category} onChange={e => setForm(f => ({...f, category: e.target.value}))} className={inp} placeholder="e.g. Bridal" /></div>
              <div><label className={lbl}>Size</label><input list="lehenga-sizes" value={form.size} onChange={e => setForm(f => ({...f, size: e.target.value}))} className={inp} placeholder="e.g. M" /></div>
              <div><label className={lbl}>Colour</label><input value={form.colour} onChange={e => setForm(f => ({...f, colour: e.target.value}))} className={inp} placeholder="e.g. Maroon" /></div>

              <div><label className={lbl}>Fabric</label><input list="lehenga-fabrics" value={form.fabric} onChange={e => setForm(f => ({...f, fabric: e.target.value}))} className={inp} placeholder="e.g. Velvet" /></div>
              <div><label className={lbl}>Work Type</label><input list="lehenga-works" value={form.work_type} onChange={e => setForm(f => ({...f, work_type: e.target.value}))} className={inp} placeholder="e.g. Zardozi" /></div>
              <div>
                <label className={lbl}>Available For</label>
                <select value={form.available_for} onChange={e => setForm(f => ({...f, available_for: e.target.value}))} className={inp}>
                  {AVAILABILITY.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                </select>
              </div>

              <div><label className={lbl}>Rental Price (₹)</label><input type="number" step="0.01" min="0" value={form.rental_price} onChange={e => setForm(f => ({...f, rental_price: e.target.value}))} className={inp} placeholder="0.00" /></div>
              <div><label className={lbl}>Sale Price (₹)</label><input type="number" step="0.01" min="0" value={form.sale_price} onChange={e => setForm(f => ({...f, sale_price: e.target.value}))} className={inp} placeholder="0.00" /></div>
              <div><label className={lbl}>Cost Price (₹)</label><input type="number" step="0.01" min="0" value={form.cost_price} onChange={e => setForm(f => ({...f, cost_price: e.target.value}))} className={inp} placeholder="0.00" /></div>

              <div><label className={lbl}>Stock</label><input type="number" min="0" value={form.stock} onChange={e => setForm(f => ({...f, stock: e.target.value}))} className={inp} placeholder="1" /></div>
              <div className="col-span-2"><label className={lbl}>Location</label><input value={form.location} onChange={e => setForm(f => ({...f, location: e.target.value}))} className={inp} placeholder="e.g. Rack C, Shelf 1" /></div>

              <div className="col-span-2 sm:col-span-3"><label className={lbl}>Description</label><textarea value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} className={inp} rows={2} /></div>
              <div className="col-span-2 sm:col-span-3">
                <BridalImageUpload label="Lehenga Image" value={form.image}
                  onChange={(url) => setForm(f => ({...f, image: url || ''}))} uploadFn={lehengaAPI.uploadImage} />
              </div>
              <div className="col-span-2 sm:col-span-3 flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="border border-slate-200 text-slate-600 hover:bg-slate-50 px-4 py-2 rounded-lg text-sm">Cancel</button>
                <button type="submit" disabled={saving} className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-semibold">{saving ? 'Saving…' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showImportXlsx && <ImportXlsxModal onClose={() => setShowImportXlsx(false)} onSuccess={() => { setShowImportXlsx(false); load() }} />}
      {showImport && <ImportModal onClose={() => setShowImport(false)} onSuccess={() => { setShowImport(false); load() }} />}
      {showImgBulk && <BulkImageModal
        items={visible}
        scopeLabel={catFilter === 'all' ? 'all lehengas' : `${catFilter} lehengas`}
        onClose={() => setShowImgBulk(false)}
        onDone={() => { setShowImgBulk(false); load() }} />}
      {showBulkEdit && (
        <BulkEditModal items={selectedItems} categories={categories}
          onClose={() => setShowBulkEdit(false)}
          onSuccess={() => { setShowBulkEdit(false); setSelectedIds(new Set()); load() }} />
      )}
    </div>
  )
}

// ─── Excel (XLSX) Import — data rows + embedded images ───────────────
function ImportXlsxModal({ onClose, onSuccess }) {
  const fileRef = useRef()
  const [file, setFile] = useState(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState(null)

  const doImport = async () => {
    if (!file) return
    setImporting(true)
    try {
      const fd = new FormData()
      fd.append('xlsx', file)
      const { data } = await lehengaAPI.importXlsx(fd)
      setResult(data)
      toast.success(data.message || 'Import complete')
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Import failed')
    } finally { setImporting(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-green-600" /> Import Excel (.xlsx)
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X className="h-5 w-5" /></button>
        </div>

        <p className="text-xs text-slate-500 mb-4">
          Columns: <code className="bg-slate-100 px-1 rounded">code · name · category · size · colour · fabric · work_type · rental_price · sale_price · cost_price · stock · available_for · location · description</code>
          <br />Images embedded in the sheet are automatically extracted and attached to their row.
        </p>

        <input ref={fileRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden" onChange={e => { setFile(e.target.files?.[0] || null); setResult(null) }} />

        <div className="flex items-center gap-3">
          <button type="button" onClick={() => fileRef.current?.click()}
            className="bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 px-4 py-2 rounded-lg text-sm font-medium">
            Choose .xlsx file
          </button>
          <span className="text-sm text-slate-500 truncate">{file ? file.name : 'No file chosen'}</span>
        </div>

        {result && (
          <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-3 text-sm space-y-1">
            <p className="flex items-center gap-1.5 text-green-700 font-medium"><CheckCircle className="h-4 w-4" /> {result.message}</p>
            <p className="text-xs text-slate-500">
              {result.data?.created} new · {result.data?.updated} updated · {result.data?.images} images · {result.data?.failed} failed
            </p>
          </div>
        )}

        <div className="flex justify-end gap-2 mt-5">
          <button onClick={result ? onSuccess : onClose}
            className="border border-slate-200 text-slate-600 hover:bg-slate-50 px-4 py-2 rounded-lg text-sm">
            {result ? 'Close' : 'Cancel'}
          </button>
          {!result && (
            <button onClick={doImport} disabled={!file || importing}
              className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-semibold flex items-center gap-2">
              {importing ? <><Loader2 className="h-4 w-4 animate-spin" /> Importing…</> : 'Import'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── CSV Import (with optional images) ───────────────────────────────
const SAMPLE_CSV = `code,name,category,size,colour,fabric,work_type,rental_price,sale_price,cost_price,stock,available_for,location,description,image
LH001,Maroon Velvet Bridal Lehenga,Bridal,M,Maroon,Velvet,Zardozi,25000,85000,52000,1,both,Rack C,Heavy bridal lehenga,LH001.jpg
LH002,Pastel Pink Sangeet Lehenga,Sangeet,L,Pink,Georgette,Sequins,12000,38000,22000,2,rental,Rack D,,LH002.jpg
LH003,Ivory Reception Gown Lehenga,Reception,Free Size,Ivory,Organza,Thread Work,0,45000,28000,1,sale,Rack A,,LH003.jpg
`

function ImportModal({ onClose, onSuccess }) {
  const fileRef = useRef()
  const imgRef = useRef()
  const [rows, setRows] = useState([])
  const [imageFiles, setImageFiles] = useState([])
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState(null)
  const [fileName, setFileName] = useState('')
  const [pasteText, setPasteText] = useState('')
  const [imgProgress, setImgProgress] = useState(0)

  const PAPA_OPTS = {
    header: true, skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, '_'),
  }
  const mapRows = (data) => (data || [])
    .map(r => ({
      code: r.code || '',
      name: r.name || '',
      category: r.category || '',
      size: r.size || '',
      colour: r.colour || r.color || '',
      fabric: r.fabric || r.material || '',
      work_type: r.work_type || r.work || '',
      rental_price: r.rental_price || r.rent || '',
      sale_price: r.sale_price || r.price || r.mrp || '',
      cost_price: r.cost_price || r.cost || '',
      stock: r.stock || r.qty || '',
      available_for: r.available_for || r.availability || '',
      location: r.location || '',
      description: r.description || '',
      _imageFile: r.image || '',
    }))
    .filter(r => r.name && r.name.trim())

  const parseFile = (f) => {
    if (!f) return
    setFileName(f.name); setResult(null)
    Papa.parse(f, {
      ...PAPA_OPTS,
      complete: (res) => {
        const parsed = mapRows(res.data)
        setRows(parsed)
        if (!parsed.length) toast.error('No valid rows found (every row needs a "name")')
      },
      error: () => toast.error('Could not parse CSV'),
    })
  }

  const parsePasted = () => {
    const text = pasteText.trim()
    if (!text) { toast.error('Paste some CSV text first'); return }
    setResult(null)
    try {
      const res = Papa.parse(text, PAPA_OPTS)
      const parsed = mapRows(res.data)
      setRows(parsed)
      setFileName(parsed.length ? 'pasted text' : '')
      if (!parsed.length) toast.error('No valid rows found (every row needs a "name")')
      else toast.success(`${parsed.length} rows read`)
    } catch { toast.error('Could not parse pasted CSV') }
  }

  // Build map: lowercase filename → File object
  const imageMap = useMemo(() => {
    const m = new Map()
    imageFiles.forEach(f => m.set(f.name.toLowerCase(), f))
    return m
  }, [imageFiles])

  const matchedImages = useMemo(
    () => rows.filter(r => r._imageFile && imageMap.has(r._imageFile.toLowerCase())).length,
    [rows, imageMap],
  )

  const doImport = async () => {
    if (!rows.length) return
    setImporting(true)
    setImgProgress(0)
    try {
      // Step 1: import data (strip _imageFile from payload)
      let imported = 0
      for (let i = 0; i < rows.length; i += 50) {
        const batch = rows.slice(i, i + 50).map(({ _imageFile, ...rest }) => rest)
        const { data } = await lehengaAPI.bulkImportInventory(batch)
        imported += data?.data?.imported || 0
      }

      // Step 2: upload images for rows that have a matching file
      let imgOk = 0, imgFail = 0
      const rowsWithImages = rows.filter(r => r._imageFile && imageMap.has(r._imageFile.toLowerCase()))
      if (rowsWithImages.length > 0) {
        // Fetch freshly imported lehengas to get their IDs
        const { data: inv } = await lehengaAPI.listInventory()
        const byCode = new Map((inv.data || []).map(it => [String(it.code || '').trim().toUpperCase(), it]))

        for (const row of rowsWithImages) {
          const item = byCode.get(String(row.code || '').trim().toUpperCase())
          if (!item) { imgFail++; setImgProgress(p => p + 1); continue }
          try {
            const fd = new FormData()
            fd.append('image', imageMap.get(row._imageFile.toLowerCase()))
            const { data: upRes } = await lehengaAPI.uploadImage(fd)
            if (upRes?.url) { await lehengaAPI.updateInventory(item.id, { image: upRes.url }); imgOk++ }
            else imgFail++
          } catch { imgFail++ }
          setImgProgress(p => p + 1)
        }
      }

      setResult({ imported, total: rows.length, imgOk, imgFail, imgTotal: rowsWithImages.length })
      toast.success(`${imported} lehengas imported${imgOk ? `, ${imgOk} images attached` : ''}`)
    } catch { toast.error('Import failed') }
    finally { setImporting(false) }
  }

  const downloadSample = () => {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'lehenga-inventory-sample.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const rowsWithImgCol = rows.filter(r => r._imageFile).length

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-800">Import Lehengas (CSV + Images)</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X className="h-5 w-5" /></button>
        </div>

        <p className="text-xs text-slate-500 mb-2">
          Columns: <code className="bg-slate-100 px-1 rounded">code, name, category, size, colour, fabric, work_type, rental_price, sale_price, cost_price, stock, available_for, location, description, image</code>.
          <br />The <strong>image</strong> column is a filename (e.g. <code className="bg-slate-100 px-1 rounded">LH001.jpg</code>) — select the matching files below.
        </p>

        <button onClick={downloadSample} className="text-amber-600 hover:text-amber-700 text-xs font-medium flex items-center gap-1 mb-3">
          <Download className="h-3.5 w-3.5" /> Download sample CSV
        </button>

        <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden"
          onChange={(e) => parseFile(e.target.files?.[0])} />
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => fileRef.current?.click()}
            className="bg-amber-50 hover:bg-amber-100 text-amber-700 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer inline-block select-none">
            Choose CSV
          </button>
          <span className="text-sm text-slate-500 truncate">{fileName || 'No file chosen'}</span>
        </div>

        <div className="mt-4 pt-4 border-t border-slate-100">
          <p className="text-xs font-medium text-slate-600 mb-1">…or paste CSV text:</p>
          <textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)} rows={3}
            placeholder={"code,name,category,size,colour,rental_price,sale_price,stock\nLH001,Maroon Velvet Bridal Lehenga,Bridal,M,Maroon,25000,85000,1"}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" />
          <button type="button" onClick={parsePasted}
            className="mt-2 bg-amber-50 hover:bg-amber-100 text-amber-700 px-4 py-1.5 rounded-lg text-sm font-medium">
            Read pasted rows
          </button>
        </div>

        {rows.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-xs font-medium text-slate-600 mb-1">
              Upload images <span className="text-slate-400">(optional — {rowsWithImgCol} rows have image filenames)</span>
            </p>
            <input ref={imgRef} type="file" accept="image/*" multiple className="hidden"
              onChange={(e) => setImageFiles(Array.from(e.target.files))} />
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => imgRef.current?.click()}
                className="bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 px-4 py-2 rounded-lg text-sm font-medium select-none">
                Choose images
              </button>
              <span className="text-sm text-slate-500 truncate">
                {imageFiles.length > 0 ? `${imageFiles.length} file${imageFiles.length !== 1 ? 's' : ''} · ${matchedImages} matched` : 'No images chosen'}
              </span>
            </div>
          </div>
        )}

        {fileName && rows.length > 0 && !result && (
          <p className="text-sm text-slate-600 mt-3">
            {rows.length} valid rows from <strong>{fileName}</strong>.
            {matchedImages > 0 && <span className="text-amber-700"> {matchedImages} image{matchedImages !== 1 ? 's' : ''} will be attached.</span>}
          </p>
        )}

        {importing && imgProgress > 0 && (
          <p className="text-sm text-slate-500 mt-2 flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Attaching images {imgProgress} / {matchedImages}…
          </p>
        )}

        {result && (
          <div className="mt-3 text-sm text-green-700 space-y-0.5">
            <p className="flex items-center gap-1.5"><CheckCircle className="h-4 w-4" /> {result.imported} of {result.total} rows imported.</p>
            {result.imgTotal > 0 && <p className="text-xs text-slate-500">{result.imgOk} image{result.imgOk !== 1 ? 's' : ''} attached{result.imgFail ? `, ${result.imgFail} failed` : ''}.</p>}
          </div>
        )}

        <div className="flex justify-end gap-2 mt-5">
          <button onClick={result ? onSuccess : onClose} className="border border-slate-200 text-slate-600 hover:bg-slate-50 px-4 py-2 rounded-lg text-sm">{result ? 'Close' : 'Cancel'}</button>
          {!result && (
            <button onClick={doImport} disabled={!rows.length || importing}
              className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-semibold">
              {importing ? 'Importing…' : `Import ${rows.length || ''}${matchedImages > 0 ? ` + ${matchedImages} images` : ''}`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Bulk Image Upload by Code ───────────────────────────────────────
function BulkImageModal({ items, scopeLabel, onClose, onDone }) {
  const fileRef = useRef()
  const [plan, setPlan] = useState(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState(null)

  const MAX_BYTES = 5 * 1024 * 1024
  const norm = (s) => String(s || '').trim().toUpperCase()
  const codeOf = (filename) => norm(filename.replace(/\.[^.]+$/, ''))

  const onPick = (fileList) => {
    const files = Array.from(fileList || [])
    if (!files.length) return
    setResult(null)
    const byCode = new Map(); const dupes = new Set()
    items.forEach((it) => {
      const c = norm(it.code)
      if (!c) return
      if (byCode.has(c)) dupes.add(c); else byCode.set(c, it)
    })
    const matched = [], unmatched = [], ambiguous = [], oversize = []
    files.forEach((f) => {
      if (!f.type.startsWith('image/')) { unmatched.push(`${f.name} (not an image)`); return }
      if (f.size > MAX_BYTES) { oversize.push(f.name); return }
      const c = codeOf(f.name)
      if (dupes.has(c)) { ambiguous.push(f.name); return }
      const it = byCode.get(c)
      if (it) matched.push({ file: f, item: it }); else unmatched.push(f.name)
    })
    setPlan({ matched, unmatched, ambiguous, oversize })
  }

  const run = async () => {
    if (!plan?.matched.length) return
    setBusy(true); setProgress(0)
    let updated = 0, failed = 0
    for (const { file, item } of plan.matched) {
      try {
        const fd = new FormData(); fd.append('image', file)
        const { data } = await lehengaAPI.uploadImage(fd)
        if (data?.url) { await lehengaAPI.updateInventory(item.id, { image: data.url }); updated++ }
        else failed++
      } catch { failed++ }
      setProgress((p) => p + 1)
    }
    setResult({ updated, failed }); setBusy(false)
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={busy ? undefined : onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-800">Upload Images by Code</h2>
          <button onClick={onClose} disabled={busy} className="text-slate-400 hover:text-slate-700 disabled:opacity-40"><X className="h-5 w-5" /></button>
        </div>

        <p className="text-xs text-slate-500 mb-3">
          Name each image file after the lehenga&apos;s <strong>code</strong> (e.g. <code className="bg-slate-100 px-1 rounded">LH001.jpg</code>).
          Each image attaches to the matching row in <strong>{scopeLabel}</strong>. Existing rows are only updated — nothing is added or removed.
        </p>

        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => onPick(e.target.files)} />
        <button type="button" onClick={() => fileRef.current?.click()} disabled={busy}
          className="bg-amber-50 hover:bg-amber-100 disabled:opacity-50 text-amber-700 px-4 py-2 rounded-lg text-sm font-medium select-none">
          Choose images
        </button>

        {plan && !result && (
          <div className="mt-4 text-sm space-y-1">
            <p className="text-green-700 font-medium">{plan.matched.length} image{plan.matched.length === 1 ? '' : 's'} matched to lehengas.</p>
            {plan.unmatched.length > 0 && (
              <details className="text-amber-700">
                <summary className="cursor-pointer">{plan.unmatched.length} no matching code (skipped)</summary>
                <div className="text-xs text-slate-500 mt-1 max-h-24 overflow-auto">{plan.unmatched.join(', ')}</div>
              </details>
            )}
            {plan.ambiguous.length > 0 && (
              <details className="text-amber-700">
                <summary className="cursor-pointer">{plan.ambiguous.length} code used by more than one lehenga (skipped)</summary>
                <div className="text-xs text-slate-500 mt-1 max-h-24 overflow-auto">{plan.ambiguous.join(', ')}</div>
              </details>
            )}
            {plan.oversize.length > 0 && (
              <p className="text-red-600 text-xs">{plan.oversize.length} over 5&nbsp;MB (skipped): {plan.oversize.join(', ')}</p>
            )}
          </div>
        )}

        {busy && (
          <p className="mt-3 text-sm text-slate-600 flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Uploading {progress} / {plan?.matched.length}…
          </p>
        )}

        {result && (
          <p className="mt-3 text-sm text-green-700">✓ Attached {result.updated} image{result.updated === 1 ? '' : 's'}.{result.failed ? ` ${result.failed} failed.` : ''}</p>
        )}

        <div className="flex justify-end gap-2 mt-5">
          <button onClick={result ? onDone : onClose} disabled={busy}
            className="border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 px-4 py-2 rounded-lg text-sm">
            {result ? 'Close' : 'Cancel'}
          </button>
          {!result && (
            <button onClick={run} disabled={busy || !plan?.matched.length}
              className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-semibold">
              {busy ? 'Uploading…' : `Attach ${plan?.matched.length || ''}`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Bulk Edit Modal (Quick fill + inline editable table) ────────────
const BULK_FIELDS = [
  { key: 'name',          label: 'Name',      type: 'text',   w: 'min-w-[160px]' },
  { key: 'category',      label: 'Category',  type: 'text',   w: 'min-w-[120px]' },
  { key: 'size',          label: 'Size',      type: 'text',   w: 'min-w-[90px]'  },
  { key: 'colour',        label: 'Colour',    type: 'text',   w: 'min-w-[110px]' },
  { key: 'fabric',        label: 'Fabric',    type: 'text',   w: 'min-w-[110px]' },
  { key: 'work_type',     label: 'Work',      type: 'text',   w: 'min-w-[110px]' },
  { key: 'rental_price',  label: 'Rent (₹)',  type: 'number', w: 'min-w-[100px]' },
  { key: 'sale_price',    label: 'Sale (₹)',  type: 'number', w: 'min-w-[100px]' },
  { key: 'cost_price',    label: 'Cost (₹)',  type: 'number', w: 'min-w-[100px]' },
  { key: 'stock',         label: 'Stock',     type: 'number', w: 'min-w-[80px]'  },
  { key: 'available_for', label: 'For',       type: 'select', w: 'min-w-[130px]' },
]

function BulkEditModal({ items, categories, onClose, onSuccess }) {
  const initial = useMemo(() => items.map(it => ({
    id: it.id,
    name: it.name || '',
    category: it.category || '',
    size: it.size || '',
    colour: it.colour || '',
    fabric: it.fabric || '',
    work_type: it.work_type || '',
    rental_price: it.rental_price != null ? String(it.rental_price) : '',
    sale_price:   it.sale_price   != null ? String(it.sale_price)   : '',
    cost_price:   it.cost_price   != null ? String(it.cost_price)   : '',
    stock:        it.stock        != null ? String(it.stock)        : '',
    available_for: it.available_for || 'both',
  })), [items])

  const [rows, setRows] = useState(initial)
  const [quickField, setQuickField] = useState('category')
  const [quickValue, setQuickValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [progress, setProgress] = useState(0)

  const setCell = (id, key, val) => setRows(prev => prev.map(r => r.id === id ? { ...r, [key]: val } : r))

  const applyToAll = () => {
    setRows(prev => prev.map(r => ({ ...r, [quickField]: quickValue })))
    const f = BULK_FIELDS.find(x => x.key === quickField)
    toast.success(`Set ${f?.label || quickField} on all ${rows.length} rows`)
  }

  const saveAll = async () => {
    const orig = Object.fromEntries(initial.map(r => [r.id, r]))
    const jobs = []
    for (const r of rows) {
      const o = orig[r.id]
      const payload = {}
      for (const f of BULK_FIELDS) {
        const rv = f.type === 'number' ? String(parseFloat(r[f.key]) || 0) : (r[f.key] ?? '').toString().trim()
        const ov = f.type === 'number' ? String(parseFloat(o[f.key]) || 0) : (o[f.key] ?? '').toString().trim()
        if (rv !== ov) payload[f.key] = f.type === 'number' ? (parseFloat(r[f.key]) || 0) : r[f.key]
      }
      if (Object.keys(payload).length) jobs.push({ id: r.id, payload })
    }
    if (!jobs.length) { toast('No changes to save'); return }
    setSaving(true); setProgress(0)
    let ok = 0, fail = 0
    for (const job of jobs) {
      try { await lehengaAPI.updateInventory(job.id, job.payload); ok++ } catch { fail++ }
      setProgress(Math.round(((ok + fail) / jobs.length) * 100))
    }
    setSaving(false)
    if (fail) toast.error(`${ok} updated, ${fail} failed`)
    else toast.success(`${ok} lehenga${ok !== 1 ? 's' : ''} updated`)
    onSuccess()
  }

  const quickFieldMeta = BULK_FIELDS.find(f => f.key === quickField)

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
          <div>
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <Edit2 className="h-4 w-4 text-amber-600" /> Bulk Edit Lehengas
            </h3>
            <p className="text-xs text-slate-500">
              {rows.length} lehenga{rows.length !== 1 ? 's' : ''} selected — edit inline, then Save All
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex items-center gap-2 px-5 py-2.5 bg-amber-50 border-b border-amber-100 flex-wrap">
          <span className="text-xs font-medium text-amber-700">Quick fill:</span>
          <select value={quickField} onChange={e => { setQuickField(e.target.value); setQuickValue('') }}
            className="border border-amber-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/30">
            {BULK_FIELDS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
          </select>
          {quickField === 'available_for' ? (
            <select value={quickValue} onChange={e => setQuickValue(e.target.value)}
              className="border border-amber-200 rounded-lg px-2 py-1.5 text-sm bg-white min-w-[150px] focus:outline-none focus:ring-2 focus:ring-amber-500/30">
              <option value="">— select —</option>
              {AVAILABILITY.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          ) : (
            <>
              <datalist id="bulk-categories">{categories.map(c => <option key={c} value={c} />)}</datalist>
              <input type={quickFieldMeta?.type === 'number' ? 'number' : 'text'}
                list={quickField === 'category' ? 'bulk-categories' : undefined}
                value={quickValue} onChange={e => setQuickValue(e.target.value)} placeholder="Value for all rows"
                className="border border-amber-200 rounded-lg px-2 py-1.5 text-sm bg-white w-44 focus:outline-none focus:ring-2 focus:ring-amber-500/30" />
            </>
          )}
          <button onClick={applyToAll} className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium">
            Apply to all
          </button>
        </div>

        <div className="overflow-auto flex-1">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase sticky top-0 z-10">
              <tr>
                <th className="px-2 py-2 text-center w-10">Sr.</th>
                {BULK_FIELDS.map(f => <th key={f.key} className="px-2 py-2 text-left whitespace-nowrap">{f.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50/60">
                  <td className="px-2 py-1.5 text-center text-xs text-slate-400">{i + 1}</td>
                  {BULK_FIELDS.map(f => (
                    <td key={f.key} className="px-2 py-1.5">
                      {f.type === 'select' ? (
                        <select value={r[f.key] || 'both'} onChange={e => setCell(r.id, f.key, e.target.value)}
                          className={`border border-slate-200 rounded px-1.5 py-1 text-sm w-full ${f.w} focus:outline-none focus:ring-2 focus:ring-amber-500/30`}>
                          {AVAILABILITY.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                        </select>
                      ) : (
                        <input type={f.type === 'number' ? 'number' : 'text'} value={r[f.key]}
                          onChange={e => setCell(r.id, f.key, e.target.value)}
                          className={`border border-slate-200 rounded px-1.5 py-1 text-sm ${f.w} ${f.type === 'number' ? 'text-right' : ''} focus:outline-none focus:ring-2 focus:ring-amber-500/30`} />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100">
          <span className="text-xs text-slate-400">
            {saving ? `Saving… ${progress}%` : 'Only changed rows are sent to the server.'}
          </span>
          <div className="flex gap-2">
            <button onClick={onClose} disabled={saving} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm disabled:opacity-60">Cancel</button>
            <button onClick={saveAll} disabled={saving} className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-60">
              {saving ? <LoadingSpinner size="sm" /> : <CheckCircle className="h-4 w-4" />}
              {saving ? 'Saving…' : 'Save All'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
