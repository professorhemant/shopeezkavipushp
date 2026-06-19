import { useEffect, useState, useRef } from 'react'
import { Plus, Edit2, Trash2, Upload, Download, X, AlertTriangle } from 'lucide-react'
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

  const load = async () => {
    setLoading(true)
    try { const { data } = await bridalAPI.listInventory(); setRows(data.data || []) }
    catch { toast.error('Failed to load inventory') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

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

  const visible = filter === 'all' ? rows : rows.filter(r => r.item_type === filter)

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
          <button onClick={openAdd}
            className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
            <Plus className="h-4 w-4" /> Add Item
          </button>
        </div>
      </div>

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

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16"><LoadingSpinner size="lg" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-800 text-xs text-slate-200 uppercase">
                <tr>
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
                  <tr><td colSpan={7} className="text-center py-12 text-slate-400">No items. Add one or import a CSV.</td></tr>
                ) : visible.map(r => (
                  <tr key={r.id} className="border-b hover:bg-slate-50">
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
                ))}
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
      // Keep the raw value (may be blank or a label like "Maang Teeka"); the
      // server normalizes it and falls back to the chosen importType.
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

        {/* Trigger the hidden input via a real click handler. Safari won't open
            the picker from a <label htmlFor> when the input is display:none, but
            a programmatic .click() inside this user gesture works everywhere. */}
        <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden"
          onChange={(e) => parseFile(e.target.files?.[0])} />
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => fileRef.current?.click()}
            className="bg-amber-50 hover:bg-amber-100 text-amber-700 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer inline-block select-none">
            Choose file
          </button>
          <span className="text-sm text-slate-500 truncate">{fileName || 'No file chosen'}</span>
        </div>

        {/* Fallback that needs no file dialog: paste CSV text directly */}
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
