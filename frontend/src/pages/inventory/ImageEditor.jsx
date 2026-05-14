import { useState, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import toast from 'react-hot-toast'
import {
  Upload, Image, ScanBarcode, Send, X, Package,
  ChevronRight, CheckCircle, AlertCircle, Loader2,
  Trash2, RefreshCw, UploadCloud, Info,
} from 'lucide-react'
import { productAPI } from '../../api'
import api from '../../api'

// ── helpers ──────────────────────────────────────────────────────────────────

function parseFilename(filename) {
  const base = filename.replace(/\.[^.]+$/, '')
  const parts = base.split(/[_\-\s]+/)
  const barcode = parts[0]?.trim() || ''
  let price = ''
  for (let i = 1; i < parts.length; i++) {
    if (/^\d+(\.\d+)?$/.test(parts[i].trim())) { price = parts[i].trim(); break }
  }
  return { barcode, price }
}

function statusBadge(status) {
  const map = {
    pending:    { cls: 'bg-slate-100 text-slate-500',             icon: null,              label: 'Pending' },
    uploading:  { cls: 'bg-blue-50 text-blue-600',                icon: <Loader2 className="h-3 w-3 animate-spin" />, label: 'Uploading…' },
    success:    { cls: 'bg-emerald-50 text-emerald-600',          icon: <CheckCircle className="h-3 w-3" />, label: 'Done' },
    notfound:   { cls: 'bg-orange-50 text-orange-600',            icon: <AlertCircle className="h-3 w-3" />, label: 'Not Found' },
    error:      { cls: 'bg-red-50 text-red-600',                  icon: <AlertCircle className="h-3 w-3" />, label: 'Error' },
  }
  const { cls, icon, label } = map[status] || map.pending
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
      {icon}{label}
    </span>
  )
}

// ── main component ────────────────────────────────────────────────────────────

export default function ImageEditor() {
  const [queue, setQueue] = useState([])
  const [bulkRunning, setBulkRunning] = useState(false)
  const [doneCount, setDoneCount] = useState(0)

  // single-editor state
  const [tab, setTab] = useState('bulk') // 'bulk' | 'single'
  const [singleFile, setSingleFile] = useState(null)
  const [singleBarcode, setSingleBarcode] = useState('')
  const [singlePosting, setSinglePosting] = useState(false)
  const fileInputRef = useRef(null)

  // ── queue helpers ───────────────────────────────────────────────────────────

  const addFiles = useCallback((files) => {
    const images = files.filter(f => f.type.startsWith('image/'))
    setQueue(prev => [
      ...prev,
      ...images.map(file => {
        const { barcode, price } = parseFilename(file.name)
        return {
          id: `${Date.now()}-${Math.random()}`,
          file,
          objectUrl: URL.createObjectURL(file),
          barcode,
          price,
          status: 'pending',
          message: '',
          productName: '',
        }
      }),
    ])
  }, [])

  const updateItem = (id, patch) =>
    setQueue(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i))

  const removeItem = (id) => {
    setQueue(prev => {
      const item = prev.find(i => i.id === id)
      if (item) URL.revokeObjectURL(item.objectUrl)
      return prev.filter(i => i.id !== id)
    })
  }

  const clearQueue = () => {
    queue.forEach(i => URL.revokeObjectURL(i.objectUrl))
    setQueue([])
    setDoneCount(0)
  }

  // ── drop zone ───────────────────────────────────────────────────────────────

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: addFiles,
    accept: { 'image/*': [] },
    multiple: true,
  })

  // ── upload logic ─────────────────────────────────────────────────────────────

  const uploadItem = async (item) => {
    if (!item.barcode.trim()) {
      updateItem(item.id, { status: 'error', message: 'Barcode is required.' })
      return
    }

    updateItem(item.id, { status: 'uploading', message: '', productName: '' })

    try {
      // 1. Find existing product by barcode
      const res = await productAPI.getAll({ search: item.barcode.trim(), limit: 10 })
      const products = (res.data || res.products || res || [])
      const list = Array.isArray(products) ? products : (products.data || [])

      const product =
        list.find(p => p.barcode === item.barcode.trim()) ||
        list.find(p => (p.barcode || '').toLowerCase() === item.barcode.trim().toLowerCase()) ||
        (list.length === 1 ? list[0] : null)

      if (!product) {
        updateItem(item.id, { status: 'notfound', message: `No product with barcode "${item.barcode}"` })
        return
      }

      // 2. Upload image file
      const formData = new FormData()
      formData.append('image', item.file)
      const uploadRes = await api.post('/upload', formData)
      const imageUrl = uploadRes.data?.url || uploadRes.url

      // 3. Merge with existing images and update product
      let existing = []
      if (product.images) {
        if (Array.isArray(product.images)) existing = product.images
        else if (typeof product.images === 'string') {
          try { existing = JSON.parse(product.images) } catch { existing = [product.images] }
        }
      }
      const newImages = [imageUrl, ...existing.filter(u => u !== imageUrl)]
      await productAPI.update(product.id, { images: newImages })

      updateItem(item.id, { status: 'success', productName: product.name, message: '' })
      setDoneCount(c => c + 1)
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Upload failed'
      updateItem(item.id, { status: 'error', message: msg })
    }
  }

  const uploadAll = async () => {
    const pending = queue.filter(i => ['pending', 'error', 'notfound'].includes(i.status))
    if (!pending.length) { toast('No pending images.'); return }
    setBulkRunning(true)
    for (const item of pending) {
      await uploadItem(item)
    }
    setBulkRunning(false)
    toast.success('Batch upload complete!')
  }

  // ── single editor upload ────────────────────────────────────────────────────

  const handleSingleUpload = async () => {
    if (!singleFile || !singleBarcode.trim()) return
    setSinglePosting(true)
    try {
      const res = await productAPI.getAll({ search: singleBarcode.trim(), limit: 10 })
      const list = Array.isArray(res) ? res : (res.data || res.products || [])
      const flat = Array.isArray(list) ? list : (list.data || [])

      const product =
        flat.find(p => p.barcode === singleBarcode.trim()) ||
        flat.find(p => (p.barcode || '').toLowerCase() === singleBarcode.trim().toLowerCase()) ||
        (flat.length === 1 ? flat[0] : null)

      if (!product) { toast.error(`Product with barcode "${singleBarcode}" not found.`); return }

      const formData = new FormData()
      formData.append('image', singleFile)
      const uploadRes = await api.post('/upload', formData)
      const imageUrl = uploadRes.data?.url || uploadRes.url

      let existing = []
      if (product.images) {
        if (Array.isArray(product.images)) existing = product.images
        else { try { existing = JSON.parse(product.images) } catch { existing = [product.images] } }
      }
      await productAPI.update(product.id, { images: [imageUrl, ...existing.filter(u => u !== imageUrl)] })

      toast.success(`Image posted to "${product.name}"`)
      setSingleFile(null)
      setSingleBarcode('')
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to post image')
    } finally {
      setSinglePosting(false)
    }
  }

  // ── stats ───────────────────────────────────────────────────────────────────

  const counts = {
    total: queue.length,
    done: queue.filter(i => i.status === 'success').length,
    notfound: queue.filter(i => i.status === 'notfound').length,
    error: queue.filter(i => i.status === 'error').length,
    pending: queue.filter(i => i.status === 'pending').length,
  }

  // ── render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Image Upload</h1>
          <p className="text-xs text-slate-400 mt-0.5">Dashboard / Inventory / Image Upload</p>
        </div>
        <div className="flex items-center gap-3">
          {doneCount > 0 && (
            <span className="bg-emerald-100 text-emerald-700 text-sm font-semibold px-3 py-1.5 rounded-full border border-emerald-200">
              ✓ {doneCount} image{doneCount !== 1 ? 's' : ''} uploaded
            </span>
          )}
          <Link
            to="/inventory/products"
            className="flex items-center gap-1.5 text-xs text-amber-600 hover:text-amber-700 font-medium"
          >
            View Products <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        {[
          { key: 'bulk', label: 'Bulk Upload' },
          { key: 'single', label: 'Single Image' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.key
                ? 'bg-white text-amber-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── BULK TAB ── */}
      {tab === 'bulk' && (
        <div className="space-y-4">
          {/* Info banner */}
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-xs text-amber-800">
            <Info className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
            <span>
              Name your image files with the barcode, e.g.{' '}
              <code className="bg-amber-100 px-1 rounded font-mono">Acko001.jpg</code> or{' '}
              <code className="bg-amber-100 px-1 rounded font-mono">Acko001_2500.jpg</code>.
              The barcode is auto-extracted from the filename and matched to the existing product row.
            </span>
          </div>

          {/* Drop zone */}
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
              isDragActive
                ? 'border-amber-500 bg-amber-50'
                : 'border-slate-200 bg-white hover:border-amber-400 hover:bg-amber-50/50'
            }`}
          >
            <input {...getInputProps()} />
            <UploadCloud className="h-10 w-10 mx-auto text-slate-300 mb-3" />
            <p className="text-slate-600 font-semibold text-sm">
              {isDragActive ? 'Drop images here…' : 'Drag & drop multiple product images here'}
            </p>
            <p className="text-slate-400 text-xs mt-1">or click to browse — JPG, PNG, WEBP supported</p>
          </div>

          {/* Stats row + actions */}
          {queue.length > 0 && (
            <>
              <div className="flex items-center gap-3 flex-wrap">
                {/* stat pills */}
                {[
                  { label: 'Total', value: counts.total, cls: 'bg-slate-100 text-slate-600' },
                  { label: 'Done', value: counts.done, cls: 'bg-emerald-50 text-emerald-700' },
                  { label: 'Pending', value: counts.pending, cls: 'bg-blue-50 text-blue-700' },
                  { label: 'Not Found', value: counts.notfound, cls: 'bg-orange-50 text-orange-700' },
                  { label: 'Error', value: counts.error, cls: 'bg-red-50 text-red-700' },
                ].map(s => (
                  <span key={s.label} className={`px-3 py-1 rounded-full text-xs font-semibold ${s.cls}`}>
                    {s.value} {s.label}
                  </span>
                ))}

                <div className="ml-auto flex items-center gap-2">
                  <button
                    onClick={uploadAll}
                    disabled={bulkRunning || counts.pending + counts.error + counts.notfound === 0}
                    className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-200 disabled:text-slate-400 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                  >
                    {bulkRunning
                      ? <><Loader2 className="h-4 w-4 animate-spin" /> Uploading…</>
                      : <><Upload className="h-4 w-4" /> Upload All</>
                    }
                  </button>
                  <button
                    onClick={clearQueue}
                    disabled={bulkRunning}
                    className="flex items-center gap-1.5 border border-slate-200 text-slate-500 hover:bg-slate-50 px-3 py-2 rounded-lg text-sm transition-colors"
                  >
                    <Trash2 className="h-4 w-4" /> Clear
                  </button>
                </div>
              </div>

              {/* Queue table */}
              <div className="rounded-xl border border-slate-100 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">Preview</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">Filename</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">Barcode</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 bg-white">
                    {queue.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 px-4">
                          <img
                            src={item.objectUrl}
                            alt=""
                            className="h-12 w-12 object-cover rounded-lg border border-slate-100"
                          />
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-xs text-slate-400 font-mono break-all max-w-[180px] block">
                            {item.file.name}
                          </span>
                          {item.productName && (
                            <span className="text-xs text-slate-500 mt-0.5 block">{item.productName}</span>
                          )}
                          {item.message && (
                            <span className="text-xs text-red-500 mt-0.5 block">{item.message}</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <input
                            type="text"
                            value={item.barcode}
                            onChange={e => updateItem(item.id, { barcode: e.target.value })}
                            disabled={item.status === 'uploading'}
                            placeholder="Barcode"
                            className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs w-32 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 disabled:bg-slate-50 disabled:text-slate-400"
                          />
                        </td>
                        <td className="py-3 px-4">
                          {statusBadge(item.status)}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => uploadItem(item)}
                              disabled={item.status === 'uploading' || bulkRunning}
                              className="p-1.5 rounded-lg border border-slate-200 hover:bg-amber-50 hover:border-amber-300 text-slate-500 hover:text-amber-600 disabled:opacity-40 transition-colors"
                              title="Upload this image"
                            >
                              {item.status === 'uploading'
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <RefreshCw className="h-3.5 w-3.5" />
                              }
                            </button>
                            <button
                              onClick={() => removeItem(item.id)}
                              disabled={item.status === 'uploading'}
                              className="p-1.5 rounded-lg border border-slate-200 hover:bg-red-50 hover:border-red-200 text-slate-400 hover:text-red-500 disabled:opacity-40 transition-colors"
                              title="Remove"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── SINGLE TAB ── */}
      {tab === 'single' && (
        <div className="flex flex-col xl:flex-row gap-5">
          {/* Image picker */}
          <div className="flex-1 min-w-0">
            {!singleFile ? (
              <label className="border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center py-20 px-8 text-center gap-4 min-h-[360px] bg-white cursor-pointer hover:border-amber-400 hover:bg-amber-50/30 transition-all">
                <input
                  type="file" accept="image/*" className="hidden"
                  onChange={e => setSingleFile(e.target.files[0] || null)}
                />
                <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center">
                  <Image className="h-8 w-8 text-amber-400" />
                </div>
                <div>
                  <p className="text-slate-700 font-semibold text-base">Click to browse an image</p>
                  <p className="text-slate-400 text-sm mt-1">JPG, PNG, WebP supported</p>
                </div>
              </label>
            ) : (
              <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-slate-50">
                  <span className="text-xs text-slate-500 flex-1 font-mono truncate">{singleFile.name}</span>
                  <button
                    onClick={() => setSingleFile(null)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-600 text-xs font-medium hover:bg-red-100"
                  >
                    <X className="h-3.5 w-3.5" /> Clear
                  </button>
                </div>
                <div className="flex items-center justify-center bg-slate-100 min-h-[360px] p-4">
                  <img
                    src={URL.createObjectURL(singleFile)}
                    alt="Preview"
                    className="max-w-full max-h-[400px] object-contain rounded-lg shadow-sm"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Right panel */}
          <div className="w-full xl:w-72 shrink-0 space-y-4">
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 space-y-4">
              <h2 className="text-sm font-semibold text-slate-700">Post to Product</h2>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  Barcode <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <ScanBarcode className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={singleBarcode}
                    onChange={e => setSingleBarcode(e.target.value)}
                    placeholder="Enter barcode"
                    className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
                  />
                </div>
                <p className="text-xs text-slate-400 mt-1">Must match an existing product's barcode.</p>
              </div>

              <button
                onClick={handleSingleUpload}
                disabled={!singleFile || !singleBarcode.trim() || singlePosting}
                className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-200 disabled:text-slate-400 text-white py-2.5 rounded-lg text-sm font-semibold transition-colors"
              >
                {singlePosting
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Posting…</>
                  : <><Send className="h-4 w-4" /> Post Image to Product</>
                }
              </button>
            </div>

            <div className="bg-amber-50 rounded-xl border border-amber-100 p-4">
              <h3 className="text-xs font-semibold text-amber-700 mb-2.5 uppercase tracking-wide">How to use</h3>
              <ol className="space-y-2 text-xs text-amber-800">
                <li className="flex gap-2"><span className="font-bold shrink-0">1.</span> Select a product image file.</li>
                <li className="flex gap-2"><span className="font-bold shrink-0">2.</span> Enter the exact barcode for the product.</li>
                <li className="flex gap-2"><span className="font-bold shrink-0">3.</span> Click Post — the image is uploaded and added to the product's IMAGE column.</li>
              </ol>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
