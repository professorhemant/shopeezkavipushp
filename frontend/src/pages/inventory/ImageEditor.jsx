import { useState, useRef, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import toast from 'react-hot-toast'
import {
  ZoomIn, ZoomOut, Crop, Check, Upload, Image,
  ScanBarcode, Send, X, Package, ChevronRight, Sun, RefreshCw
} from 'lucide-react'
import { productAPI } from '../../api'

export default function ImageEditor() {
  const [imageSrc, setImageSrc] = useState(null)
  const [imgDims, setImgDims] = useState({ w: 0, h: 0 })
  const [zoom, setZoom] = useState(1)
  const [brightness, setBrightness] = useState(1)
  const [cropMode, setCropMode] = useState(false)
  const [cropRect, setCropRect] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [dragStart, setDragStart] = useState(null)
  const [barcode, setBarcode] = useState('')
  const [productName, setProductName] = useState('')
  const [posting, setPosting] = useState(false)
  const [postedCount, setPostedCount] = useState(0)

  const imgRef = useRef(null)
  const overlayRef = useRef(null)

  const loadImage = (src) => {
    setImageSrc(src)
    setZoom(1)
    setBrightness(1)
    setCropMode(false)
    setCropRect(null)
  }

  const onDrop = useCallback((accepted) => {
    if (!accepted.length) return
    const reader = new FileReader()
    reader.onload = (e) => loadImage(e.target.result)
    reader.readAsDataURL(accepted[0])
  }, [])

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    noClick: true,
    noKeyboard: true,
  })

  useEffect(() => {
    const handlePaste = (e) => {
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          const reader = new FileReader()
          reader.onload = (ev) => loadImage(ev.target.result)
          reader.readAsDataURL(file)
          break
        }
      }
    }
    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [])

  const handleImageLoad = () => {
    if (!imgRef.current) return
    const { naturalWidth: nw, naturalHeight: nh } = imgRef.current
    const scale = Math.min(560 / nw, 400 / nh, 1)
    setImgDims({ w: nw * scale, h: nh * scale })
  }

  const handleOverlayMouseDown = (e) => {
    if (!cropMode) return
    const rect = overlayRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    setDragStart({ x, y })
    setCropRect({ x, y, w: 0, h: 0 })
    setDragging(true)
  }

  const handleOverlayMouseMove = (e) => {
    if (!dragging || !dragStart) return
    const rect = overlayRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    setCropRect({
      x: Math.min(x, dragStart.x),
      y: Math.min(y, dragStart.y),
      w: Math.abs(x - dragStart.x),
      h: Math.abs(y - dragStart.y),
    })
  }

  const handleOverlayMouseUp = () => {
    setDragging(false)
  }

  const applyCrop = () => {
    if (!cropRect || cropRect.w <= 5 || !imgRef.current) return
    const { naturalWidth: nw, naturalHeight: nh } = imgRef.current
    const displayW = imgDims.w * zoom
    const displayH = imgDims.h * zoom
    const scaleX = nw / displayW
    const scaleY = nh / displayH

    const canvas = document.createElement('canvas')
    const cx = Math.round(cropRect.x * scaleX)
    const cy = Math.round(cropRect.y * scaleY)
    const cw = Math.round(cropRect.w * scaleX)
    const ch = Math.round(cropRect.h * scaleY)
    canvas.width = cw
    canvas.height = ch
    const ctx = canvas.getContext('2d')
    ctx.drawImage(imgRef.current, cx, cy, cw, ch, 0, 0, cw, ch)
    const result = canvas.toDataURL('image/jpeg', 0.92)
    setImageSrc(result)
    setZoom(1)
    setCropMode(false)
    setCropRect(null)
    setDragStart(null)
  }

  const getEditedBase64 = () => {
    if (!imgRef.current) return imageSrc
    const canvas = document.createElement('canvas')
    canvas.width = imgRef.current.naturalWidth
    canvas.height = imgRef.current.naturalHeight
    const ctx = canvas.getContext('2d')
    ctx.filter = `brightness(${brightness})`
    ctx.drawImage(imgRef.current, 0, 0)
    return canvas.toDataURL('image/jpeg', 0.92)
  }

  const handlePost = async () => {
    if (!imageSrc || !barcode.trim()) return
    setPosting(true)
    try {
      const base64 = getEditedBase64()
      await productAPI.create({
        name: productName.trim() || `Product-${barcode.trim()}`,
        barcode: barcode.trim(),
        images: [base64],
        is_active: true,
        track_inventory: true,
      })
      toast.success('Product posted successfully')
      setImageSrc(null)
      setImgDims({ w: 0, h: 0 })
      setZoom(1)
      setBrightness(1)
      setCropMode(false)
      setCropRect(null)
      setBarcode('')
      setProductName('')
      setPostedCount((c) => c + 1)
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to post product')
    } finally {
      setPosting(false)
    }
  }

  const displayW = imgDims.w * zoom
  const displayH = imgDims.h * zoom

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Image Upload & Editor</h1>
          <p className="text-xs text-slate-400 mt-0.5">Dashboard / Inventory / Image Upload</p>
        </div>
        {postedCount > 0 && (
          <span className="bg-amber-100 text-amber-700 text-sm font-semibold px-3 py-1.5 rounded-full border border-amber-200">
            {postedCount} product{postedCount > 1 ? 's' : ''} posted
          </span>
        )}
      </div>

      <div className="flex flex-col xl:flex-row gap-4">
        {/* Left: Editor Panel */}
        <div className="flex-1 min-w-0">
          <div {...getRootProps()} className="relative">
            <input {...getInputProps()} />

            {isDragActive && (
              <div className="absolute inset-0 z-20 bg-amber-500/20 border-2 border-dashed border-amber-500 rounded-xl flex items-center justify-center pointer-events-none">
                <p className="text-amber-600 font-semibold text-lg">Drop image here</p>
              </div>
            )}

            {!imageSrc ? (
              <div className="bg-white rounded-xl shadow-sm border border-slate-100 flex flex-col items-center justify-center py-20 px-8 text-center gap-4 min-h-[400px]">
                <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center">
                  <Image className="h-8 w-8 text-amber-400" />
                </div>
                <div>
                  <p className="text-slate-700 font-semibold text-base">Paste, drag, or browse an image</p>
                  <p className="text-slate-400 text-sm mt-1">Use Ctrl+V to paste from WhatsApp Web, or drag a file here</p>
                </div>
                <button
                  onClick={open}
                  className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
                >
                  <Upload className="h-4 w-4" /> Browse File
                </button>
                <p className="text-xs text-slate-400">Supports JPG, PNG, WebP, GIF</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                {/* Toolbar */}
                <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-slate-100 bg-slate-50">
                  <button
                    onClick={() => setZoom((z) => Math.max(0.2, parseFloat((z - 0.1).toFixed(1))))}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600"
                    title="Zoom Out"
                  >
                    <ZoomOut className="h-4 w-4" />
                  </button>
                  <span className="text-xs font-mono text-slate-600 min-w-[42px] text-center">
                    {Math.round(zoom * 100)}%
                  </span>
                  <button
                    onClick={() => setZoom((z) => Math.min(4, parseFloat((z + 0.1).toFixed(1))))}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600"
                    title="Zoom In"
                  >
                    <ZoomIn className="h-4 w-4" />
                  </button>

                  <div className="w-px h-5 bg-slate-200 mx-1" />

                  <button
                    onClick={() => { setCropMode((v) => !v); setCropRect(null) }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                      cropMode
                        ? 'bg-amber-500 border-amber-500 text-white'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Crop className="h-3.5 w-3.5" /> Crop
                  </button>

                  {cropMode && cropRect && cropRect.w > 5 && (
                    <button
                      onClick={applyCrop}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-500 bg-emerald-500 text-white text-xs font-medium hover:bg-emerald-600"
                    >
                      <Check className="h-3.5 w-3.5" /> Apply Crop
                    </button>
                  )}

                  {cropMode && (
                    <button
                      onClick={() => { setCropMode(false); setCropRect(null) }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 text-xs font-medium hover:bg-slate-100"
                    >
                      <X className="h-3.5 w-3.5" /> Cancel
                    </button>
                  )}

                  <div className="w-px h-5 bg-slate-200 mx-1" />

                  <Sun className="h-4 w-4 text-slate-400 shrink-0" />
                  <input
                    type="range"
                    min="0.3"
                    max="2"
                    step="0.1"
                    value={brightness}
                    onChange={(e) => setBrightness(parseFloat(e.target.value))}
                    className="w-24 accent-amber-500"
                    title="Brightness"
                  />
                  <span className="text-xs text-slate-500 min-w-[28px]">{brightness.toFixed(1)}x</span>

                  <div className="w-px h-5 bg-slate-200 mx-1" />

                  <button
                    onClick={open}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 text-xs font-medium hover:bg-slate-100"
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> Change
                  </button>
                  <button
                    onClick={() => { setImageSrc(null); setCropMode(false); setCropRect(null); setZoom(1); setBrightness(1) }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-600 text-xs font-medium hover:bg-red-100"
                  >
                    <X className="h-3.5 w-3.5" /> Clear
                  </button>
                </div>

                {/* Image container */}
                <div className="overflow-auto bg-slate-100 flex items-center justify-center" style={{ minHeight: 420, maxHeight: 520 }}>
                  <div className="relative inline-block" style={{ width: displayW, height: displayH }}>
                    <img
                      ref={imgRef}
                      src={imageSrc}
                      alt="Editing"
                      onLoad={handleImageLoad}
                      style={{
                        width: displayW,
                        height: displayH,
                        filter: `brightness(${brightness})`,
                        display: 'block',
                        userSelect: 'none',
                        pointerEvents: 'none',
                      }}
                    />

                    {cropMode && (
                      <div
                        ref={overlayRef}
                        className="absolute inset-0"
                        style={{ cursor: 'crosshair' }}
                        onMouseDown={handleOverlayMouseDown}
                        onMouseMove={handleOverlayMouseMove}
                        onMouseUp={handleOverlayMouseUp}
                        onMouseLeave={handleOverlayMouseUp}
                      >
                        {cropRect && cropRect.w > 0 && (
                          <div
                            style={{
                              position: 'absolute',
                              left: cropRect.x,
                              top: cropRect.y,
                              width: cropRect.w,
                              height: cropRect.h,
                              boxShadow: '0 0 0 9999px rgba(0,0,0,0.4)',
                              border: '2px solid #f59e0b',
                              pointerEvents: 'none',
                            }}
                          />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Controls Panel */}
        <div className="w-full xl:w-80 shrink-0 flex flex-col gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 space-y-4">
            <h2 className="text-sm font-semibold text-slate-700">Product Details</h2>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Barcode <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <ScanBarcode className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  placeholder="Enter or scan barcode"
                  className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Product Name <span className="text-slate-400">(optional)</span>
              </label>
              <div className="relative">
                <Package className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder={barcode ? `Product-${barcode}` : 'Auto-generated from barcode'}
                  className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
                />
              </div>
            </div>

            <button
              onClick={handlePost}
              disabled={!imageSrc || !barcode.trim() || posting}
              className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-200 disabled:text-slate-400 text-white py-2.5 rounded-lg text-sm font-semibold transition-colors"
            >
              <Send className="h-4 w-4" />
              {posting ? 'Posting...' : 'Post to Products'}
            </button>

            <Link
              to="/inventory/products"
              className="flex items-center justify-center gap-1 text-xs text-amber-600 hover:text-amber-700 font-medium"
            >
              View Products <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {/* How-to-use tips */}
          <div className="bg-amber-50 rounded-xl border border-amber-100 p-4">
            <h3 className="text-xs font-semibold text-amber-700 mb-2.5 uppercase tracking-wide">How to use</h3>
            <ol className="space-y-2 text-xs text-amber-800">
              <li className="flex gap-2">
                <span className="font-bold shrink-0">1.</span>
                Open WhatsApp Web in another tab and find the product image.
              </li>
              <li className="flex gap-2">
                <span className="font-bold shrink-0">2.</span>
                Right-click the image → Copy Image, then click here and press Ctrl+V to paste.
              </li>
              <li className="flex gap-2">
                <span className="font-bold shrink-0">3.</span>
                Or drag an image file from your desktop / file explorer directly onto this page.
              </li>
              <li className="flex gap-2">
                <span className="font-bold shrink-0">4.</span>
                Use Zoom, Crop, and Brightness tools to adjust the photo.
              </li>
              <li className="flex gap-2">
                <span className="font-bold shrink-0">5.</span>
                Enter the barcode, optionally a product name, then click Post to Products.
              </li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}
