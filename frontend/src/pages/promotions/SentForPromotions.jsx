import { useEffect, useState, useCallback, useRef } from 'react'
import { Plus, Search, Megaphone, RotateCcw, Trash2, Edit2, X, Check, Image, Upload } from 'lucide-react'
import toast from 'react-hot-toast'
import { promotionAPI } from '../../api'

const TYPES = ['celebrity', 'influencer', 'model', 'designer', 'event', 'other']
const TYPE_LABELS = { celebrity: 'Celebrity', influencer: 'Influencer', model: 'Model', designer: 'Designer', event: 'Event/Show', other: 'Other' }

const STATUS_STYLE = {
  sent:     'bg-amber-50 text-amber-700 border border-amber-200',
  returned: 'bg-green-50 text-green-700 border border-green-200',
  lost:     'bg-red-50 text-red-700 border border-red-200',
  overdue:  'bg-red-100 text-red-800 border border-red-300',
}

const EMPTY_FORM = {
  sent_to_name: '', sent_to_type: 'celebrity', contact_phone: '', contact_instagram: '',
  sent_date: new Date().toISOString().split('T')[0], expected_return_date: '',
  actual_return_date: '', event_name: '', status: 'sent', notes: '', items_json: '[]',
}

const EMPTY_ITEM = { name: '', code: '', category: '', notes: '' }

const BACKEND_URL = import.meta.env.VITE_API_URL || 'https://backend-production-59b25.up.railway.app'

function isOverdue(promo) {
  return promo.status === 'sent' && promo.expected_return_date && promo.expected_return_date < new Date().toISOString().split('T')[0]
}

function displayStatus(promo) {
  return isOverdue(promo) ? 'overdue' : promo.status
}

function fmt(d) {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

function getImageSrc(url) {
  if (!url) return null
  if (url.startsWith('http')) return url
  return `${BACKEND_URL}${url}`
}

function parseImages(promo) {
  let imgs = []
  try { imgs = JSON.parse(promo.images_json || '[]') } catch {}
  if (imgs.length === 0 && promo.image_url) imgs = [promo.image_url]
  return imgs
}

export default function SentForPromotions() {
  const [promos, setPromos]       = useState([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing]     = useState(null)
  const [form, setForm]           = useState(EMPTY_FORM)
  const [items, setItems]         = useState([])
  const [saving, setSaving]       = useState(false)
  // existingImages: relative URLs already in DB (sent back as keep_images)
  const [existingImages, setExistingImages] = useState([])
  // newImageFiles: { file: File, preview: string }[] — selected but not yet saved
  const [newImageFiles, setNewImageFiles] = useState([])
  const fileInputRef = useRef(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await promotionAPI.getAll({ search, status: statusFilter })
      setPromos(data.data || [])
    } catch {
      toast.error('Failed to load promotions')
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter])

  useEffect(() => { fetchAll() }, [fetchAll])

  const resetImages = () => {
    newImageFiles.forEach(f => URL.revokeObjectURL(f.preview))
    setExistingImages([])
    setNewImageFiles([])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const openAdd = () => {
    setEditing(null); setForm(EMPTY_FORM); setItems([{ ...EMPTY_ITEM }])
    resetImages(); setShowModal(true)
  }

  const openEdit = (p) => {
    setEditing(p.id)
    setForm({
      sent_to_name: p.sent_to_name || '', sent_to_type: p.sent_to_type || 'celebrity',
      contact_phone: p.contact_phone || '', contact_instagram: p.contact_instagram || '',
      sent_date: p.sent_date || '', expected_return_date: p.expected_return_date || '',
      actual_return_date: p.actual_return_date || '', event_name: p.event_name || '',
      status: p.status || 'sent', notes: p.notes || '', items_json: p.items_json || '[]',
    })
    try { setItems(JSON.parse(p.items_json || '[]')) } catch { setItems([]) }
    resetImages()
    setExistingImages(parseImages(p))
    setShowModal(true)
  }

  const handleFilesAdded = (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    const entries = files.map(f => ({ file: f, preview: URL.createObjectURL(f) }))
    setNewImageFiles(prev => [...prev, ...entries])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removeExisting = (idx) => {
    setExistingImages(prev => prev.filter((_, i) => i !== idx))
  }

  const removeNew = (idx) => {
    setNewImageFiles(prev => {
      URL.revokeObjectURL(prev[idx].preview)
      return prev.filter((_, i) => i !== idx)
    })
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.sent_to_name.trim()) return toast.error('Name is required')
    if (!form.sent_date) return toast.error('Sent date is required')
    setSaving(true)
    try {
      const filteredItems = items.filter(i => i.name.trim())
      const fd = new FormData()
      Object.entries({ ...form, items_json: JSON.stringify(filteredItems) }).forEach(([k, v]) => {
        if (v !== null && v !== undefined) fd.append(k, v)
      })
      fd.append('keep_images', JSON.stringify(existingImages))
      newImageFiles.forEach(({ file }) => fd.append('images', file))

      if (editing) {
        await promotionAPI.update(editing, fd)
        toast.success('Updated successfully')
      } else {
        await promotionAPI.create(fd)
        toast.success('Promotion record saved')
      }
      setShowModal(false)
      fetchAll()
    } catch {
      toast.error('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleReturn = async (p) => {
    if (!confirm(`Mark "${p.sent_to_name}" record as returned?`)) return
    try {
      await promotionAPI.markReturned(p.id)
      toast.success('Marked as returned')
      fetchAll()
    } catch { toast.error('Failed') }
  }

  const handleDelete = async (p) => {
    if (!confirm(`Delete record for "${p.sent_to_name}"?`)) return
    try {
      await promotionAPI.remove(p.id)
      toast.success('Deleted')
      fetchAll()
    } catch { toast.error('Failed') }
  }

  const addItem = () => setItems(prev => [...prev, { ...EMPTY_ITEM }])
  const removeItem = (i) => setItems(prev => prev.filter((_, idx) => idx !== i))
  const updateItem = (i, field, val) => setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [field]: val } : it))

  const total   = promos.length
  const out     = promos.filter(p => p.status === 'sent').length
  const ret     = promos.filter(p => p.status === 'returned').length
  const overdue = promos.filter(p => isOverdue(p)).length

  const totalImageCount = existingImages.length + newImageFiles.length

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-amber-500" /> Sent for Promotions
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Track jewelry sent to celebrities, influencers & events</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition-colors">
          <Plus className="h-4 w-4" /> New Record
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Records', val: total,   color: 'text-slate-700',  bg: 'bg-slate-50' },
          { label: 'Currently Out', val: out,     color: 'text-amber-600',  bg: 'bg-amber-50' },
          { label: 'Returned',      val: ret,     color: 'text-green-600',  bg: 'bg-green-50' },
          { label: 'Overdue',       val: overdue, color: 'text-red-600',    bg: 'bg-red-50'   },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-xl p-4 border border-slate-100`}>
            <div className={`text-2xl font-bold ${s.color}`}>{s.val}</div>
            <div className="text-xs text-slate-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, event, phone..."
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400">
          <option value="">All Status</option>
          <option value="sent">Sent</option>
          <option value="returned">Returned</option>
          <option value="lost">Lost</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400 text-sm">Loading...</div>
        ) : promos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Megaphone className="h-10 w-10 text-slate-300" />
            <p className="text-slate-400 text-sm">No promotion records yet. Add one to get started.</p>
            <button onClick={openAdd} className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600">+ New Record</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['Ref #', 'Photos', 'Sent To', 'Type', 'Event', 'Items', 'Sent Date', 'Due Date', 'Status', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {promos.map(p => {
                  const st = displayStatus(p)
                  let parsedItems = []
                  try { parsedItems = JSON.parse(p.items_json || '[]') } catch {}
                  const itemSummary = parsedItems.length > 0
                    ? parsedItems.slice(0, 2).map(i => i.name).join(', ') + (parsedItems.length > 2 ? ` +${parsedItems.length - 2}` : '')
                    : '—'
                  const imgs = parseImages(p)
                  return (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">{p.promo_number}</td>
                      {/* Photo strip — up to 3 thumbnails */}
                      <td className="px-4 py-3">
                        {imgs.length > 0 ? (
                          <div className="flex items-center gap-1">
                            {imgs.slice(0, 3).map((url, i) => (
                              <img
                                key={i}
                                src={getImageSrc(url)}
                                alt={`photo ${i + 1}`}
                                className="h-9 w-9 rounded-lg object-cover border border-slate-200 cursor-pointer hover:opacity-80 flex-shrink-0"
                                onClick={() => window.open(getImageSrc(url), '_blank')}
                              />
                            ))}
                            {imgs.length > 3 && (
                              <span className="h-9 w-9 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-semibold text-slate-500 flex-shrink-0">
                                +{imgs.length - 3}
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="h-9 w-9 rounded-lg bg-slate-100 flex items-center justify-center">
                            <Image className="h-4 w-4 text-slate-300" />
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">{p.sent_to_name}</div>
                        {p.contact_phone && <div className="text-xs text-slate-400">{p.contact_phone}</div>}
                        {p.contact_instagram && <div className="text-xs text-amber-500">@{p.contact_instagram}</div>}
                      </td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{TYPE_LABELS[p.sent_to_type] || p.sent_to_type}</td>
                      <td className="px-4 py-3 text-slate-600 max-w-[150px] truncate">{p.event_name || '—'}</td>
                      <td className="px-4 py-3 text-slate-600 max-w-[160px]">
                        <span className="truncate block" title={itemSummary}>{itemSummary}</span>
                        {parsedItems.length > 0 && <span className="text-xs text-slate-400">({parsedItems.length} item{parsedItems.length !== 1 ? 's' : ''})</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{fmt(p.sent_date)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={isOverdue(p) ? 'text-red-600 font-semibold' : 'text-slate-600'}>{fmt(p.expected_return_date)}</span>
                        {p.actual_return_date && <div className="text-xs text-green-600">↩ {fmt(p.actual_return_date)}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${STATUS_STYLE[st] || STATUS_STYLE.sent}`}>
                          {st}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEdit(p)} className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-amber-600 transition-colors" title="Edit">
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          {p.status === 'sent' && (
                            <button onClick={() => handleReturn(p)} className="p-1.5 rounded hover:bg-green-50 text-slate-500 hover:text-green-600 transition-colors" title="Mark returned">
                              <RotateCcw className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button onClick={() => handleDelete(p)} className="p-1.5 rounded hover:bg-red-50 text-slate-500 hover:text-red-500 transition-colors" title="Delete">
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
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 px-4 bg-black/50" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
              <h2 className="font-bold text-slate-800">{editing ? 'Edit Promotion Record' : 'New Promotion Record'}</h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="px-6 py-5 space-y-5">
              {/* Recipient */}
              <div>
                <h3 className="text-xs font-semibold text-amber-500 uppercase tracking-wider mb-3">Recipient Details</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-xs font-medium text-slate-600 mb-1">Full Name *</label>
                    <input required value={form.sent_to_name} onChange={e => setForm(f => ({ ...f, sent_to_name: e.target.value }))}
                      placeholder="e.g. Tanya Mittal"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Type</label>
                    <select value={form.sent_to_type} onChange={e => setForm(f => ({ ...f, sent_to_type: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400">
                      {TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Phone / WhatsApp</label>
                    <input value={form.contact_phone} onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))}
                      placeholder="Contact number"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Instagram Handle</label>
                    <input value={form.contact_instagram} onChange={e => setForm(f => ({ ...f, contact_instagram: e.target.value }))}
                      placeholder="without @"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                  </div>
                </div>
              </div>

              {/* Event & Dates */}
              <div>
                <h3 className="text-xs font-semibold text-amber-500 uppercase tracking-wider mb-3">Event & Dates</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-slate-600 mb-1">Event / Purpose</label>
                    <input value={form.event_name} onChange={e => setForm(f => ({ ...f, event_name: e.target.value }))}
                      placeholder="e.g. Wedding, Photoshoot, Fashion Show"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Date Sent *</label>
                    <input required type="date" value={form.sent_date} onChange={e => setForm(f => ({ ...f, sent_date: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Expected Return</label>
                    <input type="date" value={form.expected_return_date} onChange={e => setForm(f => ({ ...f, expected_return_date: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Actual Return Date <span className="text-slate-400 font-normal">(optional)</span>
                    </label>
                    <div className="relative">
                      <input type="date" value={form.actual_return_date} onChange={e => setForm(f => ({ ...f, actual_return_date: e.target.value }))}
                        className="w-full px-3 py-2 pr-8 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                      {form.actual_return_date && (
                        <button type="button" onClick={() => setForm(f => ({ ...f, actual_return_date: '' }))}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500 transition-colors" title="Clear date">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
                    <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400">
                      <option value="sent">Sent (Currently Out)</option>
                      <option value="returned">Returned</option>
                      <option value="lost">Lost</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Items */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold text-amber-500 uppercase tracking-wider">Items Sent</h3>
                  <button type="button" onClick={addItem} className="text-xs text-amber-600 hover:text-amber-700 font-medium flex items-center gap-1">
                    <Plus className="h-3 w-3" /> Add Item
                  </button>
                </div>
                {items.length === 0 ? (
                  <button type="button" onClick={addItem} className="w-full py-3 border-2 border-dashed border-slate-200 rounded-lg text-sm text-slate-400 hover:border-amber-300 hover:text-amber-500 transition-colors">
                    + Add items sent for promotion
                  </button>
                ) : (
                  <div className="space-y-2">
                    {items.map((item, i) => (
                      <div key={i} className="flex gap-2 items-start">
                        <div className="flex-1 grid grid-cols-2 gap-2">
                          <input value={item.name} onChange={e => updateItem(i, 'name', e.target.value)}
                            placeholder="Item / Set name" required
                            className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-amber-400" />
                          <input value={item.code} onChange={e => updateItem(i, 'code', e.target.value)}
                            placeholder="Code (e.g. KP001)"
                            className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-amber-400" />
                          <input value={item.category} onChange={e => updateItem(i, 'category', e.target.value)}
                            placeholder="Category"
                            className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-amber-400" />
                          <input value={item.notes} onChange={e => updateItem(i, 'notes', e.target.value)}
                            placeholder="Notes (optional)"
                            className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-amber-400" />
                        </div>
                        <button type="button" onClick={() => removeItem(i)} className="mt-1.5 p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Photos — multiple upload */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold text-amber-500 uppercase tracking-wider">
                    Photos {totalImageCount > 0 && <span className="text-amber-400 font-normal">({totalImageCount})</span>}
                  </h3>
                  {totalImageCount > 0 && (
                    <button type="button" onClick={() => fileInputRef.current?.click()}
                      className="text-xs text-amber-600 hover:text-amber-700 font-medium flex items-center gap-1">
                      <Upload className="h-3 w-3" /> Add More
                    </button>
                  )}
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                  multiple
                  onChange={handleFilesAdded}
                  className="hidden"
                />

                {totalImageCount === 0 ? (
                  <button type="button" onClick={() => fileInputRef.current?.click()}
                    className="w-full py-6 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center gap-2 text-slate-400 hover:border-amber-300 hover:text-amber-500 transition-colors">
                    <Image className="h-8 w-8" />
                    <span className="text-sm font-medium">Upload Photos</span>
                    <span className="text-xs">Select multiple — JPG, PNG, WEBP up to 10MB each</span>
                  </button>
                ) : (
                  <div className="grid grid-cols-4 gap-2">
                    {/* Existing saved images */}
                    {existingImages.map((url, i) => (
                      <div key={`ex-${i}`} className="relative group aspect-square">
                        <img
                          src={getImageSrc(url)}
                          alt={`photo ${i + 1}`}
                          className="w-full h-full object-cover rounded-xl border border-slate-200 cursor-pointer"
                          onClick={() => window.open(getImageSrc(url), '_blank')}
                        />
                        <button
                          type="button"
                          onClick={() => removeExisting(i)}
                          className="absolute top-1 right-1 p-0.5 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity shadow"
                          title="Remove"
                        >
                          <X className="h-3 w-3" />
                        </button>
                        {i === 0 && (
                          <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded font-medium">Cover</span>
                        )}
                      </div>
                    ))}
                    {/* Newly selected files (not yet saved) */}
                    {newImageFiles.map(({ preview }, i) => (
                      <div key={`new-${i}`} className="relative group aspect-square">
                        <img
                          src={preview}
                          alt={`new photo ${i + 1}`}
                          className="w-full h-full object-cover rounded-xl border-2 border-amber-300"
                        />
                        <button
                          type="button"
                          onClick={() => removeNew(i)}
                          className="absolute top-1 right-1 p-0.5 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity shadow"
                          title="Remove"
                        >
                          <X className="h-3 w-3" />
                        </button>
                        <span className="absolute bottom-1 left-1 bg-amber-500/80 text-white text-[9px] px-1.5 py-0.5 rounded font-medium">New</span>
                      </div>
                    ))}
                    {/* Add more tile */}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="aspect-square border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center gap-1 text-slate-400 hover:border-amber-300 hover:text-amber-500 transition-colors"
                    >
                      <Plus className="h-5 w-5" />
                      <span className="text-[10px] font-medium">Add</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Additional Notes</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2} placeholder="Any conditions, contacts, remarks..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-400" />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={saving}
                  className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
                  {saving ? 'Saving...' : <><Check className="h-4 w-4" /> {editing ? 'Update' : 'Save Record'}</>}
                </button>
                <button type="button" onClick={() => setShowModal(false)}
                  className="px-6 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
