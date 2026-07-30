import { useEffect, useState, useRef, useMemo } from 'react'
import { Plus, Edit2, Trash2, Upload, Download, X, AlertTriangle, ImagePlus, Loader2, CheckCircle, FileSpreadsheet } from 'lucide-react'
import Papa from 'papaparse'
import toast from 'react-hot-toast'
import { bridalAPI } from '../../api'
import { formatCurrency } from '../../utils/formatters'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import BridalImageUpload from '../../components/bridal/BridalImageUpload'

export const ITEM_TYPES = [
  { value: 'set',          label: 'Bridal Set' },
  { value: 'nath',         label: 'Nath' },
  { value: 'maang_teeka',  label: 'Maang Teeka' },
  { value: 'ring',         label: 'Ring' },
  { value: 'matha_patti',  label: 'Matha Patti' },
  { value: 'sheesh_patti', label: 'Sheesh Patti' },
  { value: 'hath_phool',   label: 'Hath Phool' },
  { value: 'pasa',         label: 'Pasa' },
  { value: 'borla',        label: 'Borla' },
]
const typeLabel = (v) => ITEM_TYPES.find(t => t.value === v)?.label || v

const EMPTY = { code: '', name: '', item_type: 'set', category: '', rental_price: '', stock: '', location: '', description: '', image: '' }

const inp = "border border-slate-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
const lbl = "block text-xs font-medium text-slate-700 mb-1"

export default function BridalInventory() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [showImgBulk, setShowImgBulk] = useState(false)
  const [nameSearch, setNameSearch] = useState('')

  // Bulk edit state
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [showBulkEdit, setShowBulkEdit] = useState(false)

  const load = async () => {
    setLoading(true)
    try { const { data } = await bridalAPI.listInventory(); setRows(data.data || []) }
    catch { toast.error('Failed to load inventory') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  // Clear selection when filter or search changes
  useEffect(() => { setSelectedIds(new Set()) }, [filter, nameSearch])

  const openAdd = () => { setForm(EMPTY); setEditId(null); setShowForm(true) }
  const openEdit = (r) => {
    setForm({
      code: r.code || '', name: r.name || '', item_type: r.item_type || 'set',
      category: r.category || '', rental_price: r.rental_price ?? '', stock: r.stock ?? '',
      location: r.location || '', description: r.description || '', image: r.image || '',
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
        stock: form.stock === '' ? 1 : parseInt(form.stock, 10),
      }
      if (editId) { await bridalAPI.updateInventory(editId, payload); toast.success('Updated') }
      else        { await bridalAPI.createInventory(payload); toast.success('Added') }
      setShowForm(false); setForm(EMPTY); setEditId(null); load()
    } catch { toast.error('Failed to save') }
    finally { setSaving(false) }
  }

  const remove = async (r) => {
    if (!window.confirm(`Delete "${r.name}"?`)) return
    try { await bridalAPI.deleteInventory(r.id); toast.success('Deleted'); load() }
    catch { toast.error('Failed to delete') }
  }

  const byType = filter === 'all' ? rows : rows.filter(r => r.item_type === filter)
  const visible = nameSearch.trim()
    ? byType.filter(r => r.name.toLowerCase().includes(nameSearch.trim().toLowerCase()))
    : byType

  const removeAll = async () => {
    const n = visible.length
    if (n === 0) return
    const scope = filter === 'all' ? 'items' : `${typeLabel(filter)} items`
    if (!window.confirm(`Delete ${n} ${scope}? This permanently removes them and cannot be undone.`)) return
    if (filter === 'all' && !window.confirm('This erases your ENTIRE bridal inventory. Are you absolutely sure?')) return
    try {
      const { data } = await bridalAPI.deleteAllInventory(filter)
      toast.success(`Deleted ${data?.deleted ?? n} items`)
      load()
    } catch { toast.error('Failed to delete all') }
  }

  // Checkbox helpers
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
    if (allVisibleSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(visible.map(r => r.id)))
    }
  }

  const deleteSelected = async () => {
    const n = selectedIds.size
    if (!window.confirm(`Delete ${n} selected item${n !== 1 ? 's' : ''}? This cannot be undone.`)) return
    let ok = 0, fail = 0
    for (const id of selectedIds) {
      try { await bridalAPI.deleteInventory(id); ok++ }
      catch { fail++ }
    }
    if (fail) toast.error(`${ok} deleted, ${fail} failed`)
    else toast.success(`${ok} item${ok !== 1 ? 's' : ''} deleted`)
    setSelectedIds(new Set())
    load()
  }

  const selectedItems = rows.filter(r => selectedIds.has(r.id))

  const exportToExcel = () => {
    if (visible.length === 0) { toast.error('No items to export'); return }
    const token = localStorage.getItem('auth-storage')
      ? JSON.parse(localStorage.getItem('auth-storage'))?.state?.token
      : null
    const API_BASE = import.meta.env.VITE_API_URL
      ? `${import.meta.env.VITE_API_URL}/api`
      : (import.meta.env.DEV ? '/api' : 'https://backend-production-59b25.up.railway.app/api')
    const type = filter === 'all' ? '' : `&type=${filter}`
    const url = `${API_BASE}/bridal/inventory/export?token=${token}${type}`
    const a = document.createElement('a')
    a.href = url
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    toast.success(`Exporting ${visible.length} items…`)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Bridal Inventory</h1>
          <p className="text-sm text-slate-500 mt-0.5">{rows.length} items · feeds the Bridal Bookings dropdowns</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {visible.length > 0 && (
            <button onClick={removeAll}
              className="border border-red-200 text-red-600 hover:bg-red-50 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> {filter === 'all' ? 'Delete All' : `Delete All ${typeLabel(filter)}`}
            </button>
          )}
          <button onClick={exportToExcel}
            className="border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4" /> Export Excel
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
            <Plus className="h-4 w-4" /> Add Item
          </button>
        </div>
      </div>

      {someSelected && (
        <div className="flex items-center justify-between bg-amber-600 text-white px-4 py-2.5 rounded-xl text-sm">
          <span className="font-medium">{selectedIds.size} item{selectedIds.size !== 1 ? 's' : ''} selected</span>
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

      {/* Type filter */}
      <div className="flex flex-wrap gap-1.5">
        <button onClick={() => setFilter('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium ${filter === 'all' ? 'bg-amber-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
          All ({rows.length})
        </button>
        {ITEM_TYPES.map(t => {
          const n = rows.filter(r => r.item_type === t.value).length
          return (
            <button key={t.value} onClick={() => setFilter(t.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium ${filter === t.value ? 'bg-amber-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              {t.label} ({n})
            </button>
          )
        })}
      </div>

      {/* Name search */}
      <div className="relative max-w-sm">
        <input
          value={nameSearch}
          onChange={e => setNameSearch(e.target.value)}
          placeholder="Search by name to find code…"
          className={inp}
        />
        {nameSearch && (
          <button onClick={() => setNameSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        {loading ? (
          <div className="flex items-center justify-center py-16"><LoadingSpinner size="lg" /></div>
        ) : (
          <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)]">
            <table className="w-full text-sm">
              <thead className="bg-slate-800 text-xs text-slate-200 uppercase sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 accent-amber-400 cursor-pointer"
                      title={allVisibleSelected ? 'Deselect all' : 'Select all visible'}
                    />
                  </th>
                  <th className="px-4 py-3 text-left">Code</th>
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-left">Category</th>
                  <th className="px-4 py-3 text-left">Location</th>
                  <th className="px-4 py-3 text-right">Rent (₹)</th>
                  <th className="px-4 py-3 text-right">Stock</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-12 text-slate-400">No items. Add one or import a CSV.</td></tr>
                ) : visible.map(r => {
                  const isChecked = selectedIds.has(r.id)
                  return (
                    <tr key={r.id} className={`border-b hover:bg-slate-50 ${isChecked ? 'bg-amber-50' : ''}`}>
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelect(r.id)}
                          className="h-4 w-4 accent-amber-600 cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-3 font-semibold text-amber-600">{r.code || '—'}</td>
                      <td className="px-4 py-3 text-slate-700">
                        <div className="flex items-center gap-2">
                          {r.image
                            ? <img src={r.image} alt="" className="h-8 w-8 rounded object-cover border border-slate-200 shrink-0" />
                            : <span className="h-8 w-8 rounded bg-slate-100 border border-slate-200 shrink-0" />}
                          {r.name}
                        </div>
                      </td>
                      <td className="px-4 py-3"><span className="text-xs bg-slate-100 text-slate-600 rounded px-2 py-0.5">{typeLabel(r.item_type)}</span></td>
                      <td className="px-4 py-3 text-slate-600">{r.category || '—'}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{r.location || '—'}</td>
                      <td className="px-4 py-3 text-right text-slate-700">{parseFloat(r.rental_price) > 0 ? formatCurrency(r.rental_price) : '—'}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{r.stock}</td>
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
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-800">{editId ? 'Edit Item' : 'Add Item'}</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-700"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={save} className="grid grid-cols-2 gap-3">
              <div><label className={lbl}>Code / Set ID</label><input value={form.code} onChange={e => setForm(f => ({...f, code: e.target.value}))} className={inp} placeholder="e.g. B001" /></div>
              <div><label className={lbl}>Type</label>
                <select value={form.item_type} onChange={e => setForm(f => ({...f, item_type: e.target.value}))} className={inp}>
                  {ITEM_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="col-span-2"><label className={lbl}>Name *</label><input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} className={inp} placeholder="Item name" required /></div>
              <div><label className={lbl}>Category</label><input value={form.category} onChange={e => setForm(f => ({...f, category: e.target.value}))} className={inp} placeholder="e.g. Kundan" /></div>
              <div><label className={lbl}>Rental Price (₹)</label><input type="number" step="0.01" min="0" value={form.rental_price} onChange={e => setForm(f => ({...f, rental_price: e.target.value}))} className={inp} placeholder="0.00" /></div>
              <div><label className={lbl}>Stock</label><input type="number" min="0" value={form.stock} onChange={e => setForm(f => ({...f, stock: e.target.value}))} className={inp} placeholder="1" /></div>
              <div className="col-span-2"><label className={lbl}>Location</label><input value={form.location} onChange={e => setForm(f => ({...f, location: e.target.value}))} className={inp} placeholder="e.g. Rack A, Shelf 2" /></div>
              <div className="col-span-2"><label className={lbl}>Description</label><textarea value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} className={inp} rows={2} /></div>
              <div className="col-span-2"><BridalImageUpload label="Item Image" value={form.image} onChange={(url) => setForm(f => ({...f, image: url || ''}))} /></div>
              <div className="col-span-2 flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="border border-slate-200 text-slate-600 hover:bg-slate-50 px-4 py-2 rounded-lg text-sm">Cancel</button>
                <button type="submit" disabled={saving} className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-semibold">{saving ? 'Saving…' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showImport && <ImportModal defaultType={filter === 'all' ? 'set' : filter} onClose={() => setShowImport(false)} onSuccess={() => { setShowImport(false); load() }} />}

      {showImgBulk && <BulkImageModal
        items={visible}
        scopeLabel={filter === 'all' ? 'all items' : `${typeLabel(filter)} items`}
        onClose={() => setShowImgBulk(false)}
        onDone={() => { setShowImgBulk(false); load() }} />}

      {showBulkEdit && (
        <BulkEditModal
          items={selectedItems}
          onClose={() => setShowBulkEdit(false)}
          onSuccess={() => { setShowBulkEdit(false); setSelectedIds(new Set()); load() }}
        />
      )}
    </div>
  )
}

// ─── CSV Import (with optional images) ───────────────────────────────
const SAMPLE_CSV = `code,name,item_type,category,rental_price,stock,location,description,image
B001,Royal Kundan Set,set,Kundan,15000,1,Rack A,Heavy bridal set,B001.jpg
N001,Gold Nath,nath,Gold,1200,3,Shelf 2,,N001.jpg
R001,Polki Ring,ring,Polki,800,5,Rack B,,R001.jpg
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
      item_type: (r.item_type || r.type || '').trim(),
      category: r.category || '',
      rental_price: r.rental_price || r.rent || '',
      stock: r.stock || '',
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

  // How many rows have a matching image file selected
  const matchedImages = useMemo(() =>
    rows.filter(r => r._imageFile && imageMap.has(r._imageFile.toLowerCase())).length
  , [rows, imageMap])

  const doImport = async () => {
    if (!rows.length) return
    setImporting(true)
    setImgProgress(0)
    try {
      // Step 1: import data (strip _imageFile from payload)
      let imported = 0
      for (let i = 0; i < rows.length; i += 50) {
        const batch = rows.slice(i, i + 50).map(({ _imageFile, ...rest }) => rest)
        const { data } = await bridalAPI.bulkImportInventory(batch)
        imported += data?.data?.imported || 0
      }

      // Step 2: upload images for rows that have a matching file
      let imgOk = 0, imgFail = 0
      const rowsWithImages = rows.filter(r => r._imageFile && imageMap.has(r._imageFile.toLowerCase()))
      if (rowsWithImages.length > 0) {
        // Fetch freshly imported items to get their IDs
        const { data: inv } = await bridalAPI.listInventory()
        const byCode = new Map((inv.data || []).map(it => [String(it.code || '').trim().toUpperCase(), it]))

        for (const row of rowsWithImages) {
          const item = byCode.get(String(row.code || '').trim().toUpperCase())
          if (!item) { imgFail++; setImgProgress(p => p + 1); continue }
          try {
            const fd = new FormData()
            fd.append('image', imageMap.get(row._imageFile.toLowerCase()))
            const { data: upRes } = await bridalAPI.uploadImage(fd)
            if (upRes?.url) { await bridalAPI.updateInventory(item.id, { image: upRes.url }); imgOk++ }
            else imgFail++
          } catch { imgFail++ }
          setImgProgress(p => p + 1)
        }
      }

      setResult({ imported, total: rows.length, imgOk, imgFail, imgTotal: rowsWithImages.length })
      toast.success(`${imported} items imported${imgOk ? `, ${imgOk} images attached` : ''}`)
    } catch { toast.error('Import failed') }
    finally { setImporting(false) }
  }

  const downloadSample = () => {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'bridal-inventory-sample.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const rowsWithImgCol = rows.filter(r => r._imageFile).length

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-800">Import Bridal Inventory (CSV + Images)</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X className="h-5 w-5" /></button>
        </div>

        <p className="text-xs text-slate-500 mb-2">
          Columns: <code className="bg-slate-100 px-1 rounded">code, name, item_type, category, rental_price, stock, location, description, image</code>.
          <br />The <strong>image</strong> column is a filename (e.g. <code className="bg-slate-100 px-1 rounded">B001.jpg</code>) — select the matching files below.
        </p>

        <button onClick={downloadSample} className="text-amber-600 hover:text-amber-700 text-xs font-medium flex items-center gap-1 mb-3">
          <Download className="h-3.5 w-3.5" /> Download sample CSV
        </button>

        {/* CSV picker */}
        <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden"
          onChange={(e) => parseFile(e.target.files?.[0])} />
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => fileRef.current?.click()}
            className="bg-amber-50 hover:bg-amber-100 text-amber-700 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer inline-block select-none">
            Choose CSV
          </button>
          <span className="text-sm text-slate-500 truncate">{fileName || 'No file chosen'}</span>
        </div>

        {/* Paste text */}
        <div className="mt-4 pt-4 border-t border-slate-100">
          <p className="text-xs font-medium text-slate-600 mb-1">…or paste CSV text:</p>
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows={3}
            placeholder={"code,name,item_type,category,rental_price,stock,location,description,image\nB001,Royal Kundan Set,set,Kundan,15000,1,Rack A,,B001.jpg"}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
          />
          <button type="button" onClick={parsePasted}
            className="mt-2 bg-amber-50 hover:bg-amber-100 text-amber-700 px-4 py-1.5 rounded-lg text-sm font-medium">
            Read pasted rows
          </button>
        </div>

        {/* Image picker — shown after CSV parsed and has image column */}
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
            <Loader2 className="h-4 w-4 animate-spin" /> Attaching images {imgProgress} / {rows.filter(r => r._imageFile && imageMap.has(r._imageFile.toLowerCase())).length}…
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
        const { data } = await bridalAPI.uploadImage(fd)
        if (data?.url) { await bridalAPI.updateInventory(item.id, { image: data.url }); updated++ }
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
          Name each image file after the item&apos;s <strong>code</strong> (e.g. <code className="bg-slate-100 px-1 rounded">B01.jpg</code>, <code className="bg-slate-100 px-1 rounded">SN1.png</code>).
          Each image attaches to the matching item in <strong>{scopeLabel}</strong>. Existing rows are only updated — nothing is added or removed.
        </p>

        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
          onChange={(e) => onPick(e.target.files)} />
        <button type="button" onClick={() => fileRef.current?.click()} disabled={busy}
          className="bg-amber-50 hover:bg-amber-100 disabled:opacity-50 text-amber-700 px-4 py-2 rounded-lg text-sm font-medium select-none">
          Choose images
        </button>

        {plan && !result && (
          <div className="mt-4 text-sm space-y-1">
            <p className="text-green-700 font-medium">{plan.matched.length} image{plan.matched.length === 1 ? '' : 's'} matched to items.</p>
            {plan.unmatched.length > 0 && (
              <details className="text-amber-700">
                <summary className="cursor-pointer">{plan.unmatched.length} no matching code (skipped)</summary>
                <div className="text-xs text-slate-500 mt-1 max-h-24 overflow-auto">{plan.unmatched.join(', ')}</div>
              </details>
            )}
            {plan.ambiguous.length > 0 && (
              <details className="text-amber-700">
                <summary className="cursor-pointer">{plan.ambiguous.length} code used by more than one item (skipped)</summary>
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

// ─── Bulk Edit Modal (Products-style: Quick fill + inline editable table) ────
const BULK_FIELDS = [
  { key: 'name',         label: 'Name',     type: 'text',   w: 'min-w-[160px]' },
  { key: 'item_type',    label: 'Type',     type: 'select', w: 'min-w-[130px]' },
  { key: 'category',     label: 'Category', type: 'text',   w: 'min-w-[120px]' },
  { key: 'rental_price', label: 'Rent (₹)', type: 'number', w: 'min-w-[100px]' },
  { key: 'stock',        label: 'Stock',    type: 'number', w: 'min-w-[80px]'  },
]

function BulkEditModal({ items, onClose, onSuccess }) {
  const initial = useMemo(() => items.map(it => ({
    id:           it.id,
    name:         it.name            || '',
    item_type:    it.item_type       || 'set',
    category:     it.category        || '',
    rental_price: it.rental_price != null ? String(it.rental_price) : '',
    stock:        it.stock        != null ? String(it.stock)        : '',
  })), [items])

  const [rows, setRows] = useState(initial)
  const [quickField, setQuickField] = useState('category')
  const [quickValue, setQuickValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [progress, setProgress] = useState(0)

  const setCell = (id, key, val) =>
    setRows(prev => prev.map(r => r.id === id ? { ...r, [key]: val } : r))

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
        if (rv !== ov) {
          if (f.type === 'number') payload[f.key] = parseFloat(r[f.key]) || 0
          else payload[f.key] = r[f.key]
        }
      }
      if (Object.keys(payload).length) jobs.push({ id: r.id, payload })
    }
    if (!jobs.length) { toast('No changes to save'); return }
    setSaving(true); setProgress(0)
    let ok = 0, fail = 0
    for (const job of jobs) {
      try { await bridalAPI.updateInventory(job.id, job.payload); ok++ }
      catch { fail++ }
      setProgress(Math.round(((ok + fail) / jobs.length) * 100))
    }
    setSaving(false)
    if (fail) toast.error(`${ok} updated, ${fail} failed`)
    else toast.success(`${ok} item${ok !== 1 ? 's' : ''} updated`)
    onSuccess()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col">

        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
          <div>
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <Edit2 className="h-4 w-4 text-amber-600" /> Bulk Edit Items
            </h3>
            <p className="text-xs text-slate-500">
              {rows.length} item{rows.length !== 1 ? 's' : ''} selected — edit inline, then Save All
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex items-center gap-2 px-5 py-2.5 bg-amber-50 border-b border-amber-100 flex-wrap">
          <span className="text-xs font-medium text-amber-700">Quick fill:</span>
          <select
            value={quickField}
            onChange={e => { setQuickField(e.target.value); setQuickValue('') }}
            className="border border-amber-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/30"
          >
            {BULK_FIELDS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
          </select>
          {quickField === 'item_type' ? (
            <select
              value={quickValue}
              onChange={e => setQuickValue(e.target.value)}
              className="border border-amber-200 rounded-lg px-2 py-1.5 text-sm bg-white min-w-[150px] focus:outline-none focus:ring-2 focus:ring-amber-500/30"
            >
              <option value="">— select —</option>
              {ITEM_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          ) : (
            <input
              type={BULK_FIELDS.find(f => f.key === quickField)?.type === 'number' ? 'number' : 'text'}
              value={quickValue}
              onChange={e => setQuickValue(e.target.value)}
              placeholder="Value for all rows"
              className="border border-amber-200 rounded-lg px-2 py-1.5 text-sm bg-white w-44 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
            />
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
                {BULK_FIELDS.map(f => (
                  <th key={f.key} className="px-2 py-2 text-left whitespace-nowrap">{f.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50/60">
                  <td className="px-2 py-1.5 text-center text-xs text-slate-400">{i + 1}</td>
                  {BULK_FIELDS.map(f => (
                    <td key={f.key} className="px-2 py-1.5">
                      {f.type === 'select' ? (
                        <select
                          value={r[f.key] || ''}
                          onChange={e => setCell(r.id, f.key, e.target.value)}
                          className={`border border-slate-200 rounded px-1.5 py-1 text-sm w-full ${f.w} focus:outline-none focus:ring-2 focus:ring-amber-500/30`}
                        >
                          {ITEM_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                      ) : (
                        <input
                          type={f.type === 'number' ? 'number' : 'text'}
                          value={r[f.key]}
                          onChange={e => setCell(r.id, f.key, e.target.value)}
                          className={`border border-slate-200 rounded px-1.5 py-1 text-sm ${f.w} ${f.type === 'number' ? 'text-right' : ''} focus:outline-none focus:ring-2 focus:ring-amber-500/30`}
                        />
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
