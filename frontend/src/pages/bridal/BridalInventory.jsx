import { useEffect, useState, useRef } from 'react'
import { Plus, Edit2, Trash2, Upload, Download, X, AlertTriangle, ImagePlus, Loader2, CheckSquare } from 'lucide-react'
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

const EMPTY = { code: '', name: '', item_type: 'set', category: '', rental_price: '', stock: '', description: '', image: '' }

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
  const [bulkMode, setBulkMode] = useState(false)
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
      description: r.description || '', image: r.image || '',
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

  const exitBulkMode = () => { setBulkMode(false); setSelectedIds(new Set()) }

  const colSpan = bulkMode ? 8 : 7

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
          <button onClick={() => setShowImport(true)}
            className="border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
            <Upload className="h-4 w-4" /> Import CSV
          </button>
          <button onClick={() => setShowImgBulk(true)}
            className="border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
            <ImagePlus className="h-4 w-4" /> Upload Images
          </button>
          {bulkMode ? (
            <button onClick={exitBulkMode}
              className="border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
              <X className="h-4 w-4" /> Exit Bulk Edit
            </button>
          ) : (
            <button onClick={() => setBulkMode(true)}
              className="border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
              <CheckSquare className="h-4 w-4" /> Bulk Edit
            </button>
          )}
          <button onClick={openAdd}
            className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
            <Plus className="h-4 w-4" /> Add Item
          </button>
        </div>
      </div>

      {/* Bulk selection action bar */}
      {bulkMode && (
        <div className={`flex items-center gap-3 px-4 py-2.5 rounded-lg border text-sm transition-all ${someSelected ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
          {someSelected ? (
            <>
              <span className="font-medium">{selectedIds.size} item{selectedIds.size !== 1 ? 's' : ''} selected</span>
              <button onClick={() => setShowBulkEdit(true)}
                className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-1 rounded-md text-xs font-semibold">
                Edit Selected
              </button>
              <button onClick={() => setSelectedIds(new Set())}
                className="text-amber-600 hover:text-amber-800 text-xs font-medium">
                Deselect All
              </button>
            </>
          ) : (
            <span>Check rows below to select items for bulk editing</span>
          )}
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
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16"><LoadingSpinner size="lg" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-800 text-xs text-slate-200 uppercase">
                <tr>
                  {bulkMode && (
                    <th className="px-3 py-3 w-10">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={toggleSelectAll}
                        className="h-4 w-4 accent-amber-500 cursor-pointer"
                        title={allVisibleSelected ? 'Deselect all' : 'Select all visible'}
                      />
                    </th>
                  )}
                  <th className="px-4 py-3 text-left">Code</th>
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-left">Category</th>
                  <th className="px-4 py-3 text-right">Rent (₹)</th>
                  <th className="px-4 py-3 text-right">Stock</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 ? (
                  <tr><td colSpan={colSpan} className="text-center py-12 text-slate-400">No items. Add one or import a CSV.</td></tr>
                ) : visible.map(r => {
                  const isChecked = selectedIds.has(r.id)
                  return (
                    <tr key={r.id} className={`border-b hover:bg-slate-50 ${isChecked ? 'bg-amber-50' : ''}`}>
                      {bulkMode && (
                        <td className="px-3 py-3">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleSelect(r.id)}
                            className="h-4 w-4 accent-amber-600 cursor-pointer"
                          />
                        </td>
                      )}
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
          selectedIds={selectedIds}
          onClose={() => setShowBulkEdit(false)}
          onDone={() => { setShowBulkEdit(false); setSelectedIds(new Set()); load() }}
        />
      )}
    </div>
  )
}

// ─── CSV Import ──────────────────────────────────────────────────────
const SAMPLE_CSV = `code,name,item_type,category,rental_price,stock,description
B001,Royal Kundan Set,set,Kundan,15000,1,Heavy bridal set
N001,Gold Nath,nath,Gold,1200,3,
R001,Polki Ring,ring,Polki,800,5,
`

function ImportModal({ onClose, onSuccess }) {
  const fileRef = useRef()
  const [rows, setRows] = useState([])
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState(null)
  const [fileName, setFileName] = useState('')
  const [pasteText, setPasteText] = useState('')

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
      description: r.description || '',
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

  const doImport = async () => {
    if (!rows.length) return
    setImporting(true)
    try {
      let imported = 0
      for (let i = 0; i < rows.length; i += 50) {
        const batch = rows.slice(i, i + 50)
        const { data } = await bridalAPI.bulkImportInventory(batch)
        imported += data?.data?.imported || 0
      }
      setResult({ imported, total: rows.length })
      toast.success(`${imported} items imported`)
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

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-800">Import Bridal Inventory (CSV)</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X className="h-5 w-5" /></button>
        </div>

        <p className="text-xs text-slate-500 mb-3">
          Columns: <code className="bg-slate-100 px-1 rounded">code, name, item_type, category, rental_price, stock, description</code>.
          <br /><code className="bg-slate-100 px-1 rounded">item_type</code> = set, nath, maang_teeka, ring, matha_patti, sheesh_patti, hath_phool, pasa, borla.
        </p>

        <button onClick={downloadSample} className="text-amber-600 hover:text-amber-700 text-xs font-medium flex items-center gap-1 mb-3">
          <Download className="h-3.5 w-3.5" /> Download sample CSV
        </button>

        <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden"
          onChange={(e) => parseFile(e.target.files?.[0])} />
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => fileRef.current?.click()}
            className="bg-amber-50 hover:bg-amber-100 text-amber-700 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer inline-block select-none">
            Choose file
          </button>
          <span className="text-sm text-slate-500 truncate">{fileName || 'No file chosen'}</span>
        </div>

        <div className="mt-4 pt-4 border-t border-slate-100">
          <p className="text-xs font-medium text-slate-600 mb-1">…or paste CSV text (open your CSV in Excel/Numbers/Notes, select all, copy, paste here):</p>
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows={4}
            placeholder={"code,name,item_type,category,rental_price,stock,description\nB001,Royal Kundan Set,set,Kundan,15000,1,"}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
          />
          <button type="button" onClick={parsePasted}
            className="mt-2 bg-amber-50 hover:bg-amber-100 text-amber-700 px-4 py-1.5 rounded-lg text-sm font-medium">
            Read pasted rows
          </button>
        </div>

        {fileName && rows.length > 0 && !result && (
          <p className="text-sm text-slate-600 mt-3">{rows.length} valid rows ready from <strong>{fileName}</strong>.</p>
        )}
        {result && (
          <p className="text-sm text-green-600 mt-3">✓ Imported {result.imported} of {result.total} rows.</p>
        )}

        <div className="flex justify-end gap-2 mt-5">
          <button onClick={result ? onSuccess : onClose} className="border border-slate-200 text-slate-600 hover:bg-slate-50 px-4 py-2 rounded-lg text-sm">{result ? 'Close' : 'Cancel'}</button>
          {!result && (
            <button onClick={doImport} disabled={!rows.length || importing}
              className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-semibold">
              {importing ? 'Importing…' : `Import ${rows.length || ''}`}
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

// ─── Bulk Edit Modal ─────────────────────────────────────────────────
function BulkEditModal({ selectedIds, onClose, onDone }) {
  const [fields, setFields] = useState({
    item_type:    { enabled: false, value: 'set' },
    category:     { enabled: false, value: '' },
    rental_price: { enabled: false, value: '' },
    stock:        { enabled: false, value: '' },
  })
  const [saving, setSaving] = useState(false)

  const toggle = (k) => setFields(f => ({ ...f, [k]: { ...f[k], enabled: !f[k].enabled } }))
  const setVal = (k, v) => setFields(f => ({ ...f, [k]: { ...f[k], value: v } }))

  const apply = async () => {
    const updates = {}
    if (fields.item_type.enabled)    updates.item_type    = fields.item_type.value
    if (fields.category.enabled)     updates.category     = fields.category.value
    if (fields.rental_price.enabled) updates.rental_price = parseFloat(fields.rental_price.value) || 0
    if (fields.stock.enabled)        updates.stock        = parseInt(fields.stock.value, 10) || 0
    if (!Object.keys(updates).length) { toast.error('Enable at least one field to update'); return }
    setSaving(true)
    try {
      const { data } = await bridalAPI.bulkUpdateInventory([...selectedIds], updates)
      toast.success(`Updated ${data.updated} item${data.updated !== 1 ? 's' : ''}`)
      onDone()
    } catch { toast.error('Bulk update failed') }
    finally { setSaving(false) }
  }

  const row = "flex items-center gap-3"
  const labelCls = "text-sm font-medium text-slate-700 w-28 shrink-0"

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-bold text-slate-800">Bulk Edit</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X className="h-5 w-5" /></button>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          {selectedIds.size} item{selectedIds.size !== 1 ? 's' : ''} selected. Check each field you want to change — unchecked fields are left untouched.
        </p>

        <div className="space-y-3">
          {/* Type */}
          <div className={row}>
            <input type="checkbox" id="be-type" checked={fields.item_type.enabled} onChange={() => toggle('item_type')} className="h-4 w-4 accent-amber-600 cursor-pointer shrink-0" />
            <label htmlFor="be-type" className={labelCls}>Type</label>
            <select
              disabled={!fields.item_type.enabled}
              value={fields.item_type.value}
              onChange={e => setVal('item_type', e.target.value)}
              className={inp + (!fields.item_type.enabled ? ' opacity-40' : '')}
            >
              {ITEM_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          {/* Category */}
          <div className={row}>
            <input type="checkbox" id="be-cat" checked={fields.category.enabled} onChange={() => toggle('category')} className="h-4 w-4 accent-amber-600 cursor-pointer shrink-0" />
            <label htmlFor="be-cat" className={labelCls}>Category</label>
            <input
              disabled={!fields.category.enabled}
              value={fields.category.value}
              onChange={e => setVal('category', e.target.value)}
              placeholder="e.g. Kundan"
              className={inp + (!fields.category.enabled ? ' opacity-40' : '')}
            />
          </div>

          {/* Rental Price */}
          <div className={row}>
            <input type="checkbox" id="be-price" checked={fields.rental_price.enabled} onChange={() => toggle('rental_price')} className="h-4 w-4 accent-amber-600 cursor-pointer shrink-0" />
            <label htmlFor="be-price" className={labelCls}>Rental Price</label>
            <input
              type="number" min="0" step="0.01"
              disabled={!fields.rental_price.enabled}
              value={fields.rental_price.value}
              onChange={e => setVal('rental_price', e.target.value)}
              placeholder="0.00"
              className={inp + (!fields.rental_price.enabled ? ' opacity-40' : '')}
            />
          </div>

          {/* Stock */}
          <div className={row}>
            <input type="checkbox" id="be-stock" checked={fields.stock.enabled} onChange={() => toggle('stock')} className="h-4 w-4 accent-amber-600 cursor-pointer shrink-0" />
            <label htmlFor="be-stock" className={labelCls}>Stock</label>
            <input
              type="number" min="0"
              disabled={!fields.stock.enabled}
              value={fields.stock.value}
              onChange={e => setVal('stock', e.target.value)}
              placeholder="1"
              className={inp + (!fields.stock.enabled ? ' opacity-40' : '')}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="border border-slate-200 text-slate-600 hover:bg-slate-50 px-4 py-2 rounded-lg text-sm">Cancel</button>
          <button onClick={apply} disabled={saving}
            className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-semibold">
            {saving ? 'Saving…' : 'Apply Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
