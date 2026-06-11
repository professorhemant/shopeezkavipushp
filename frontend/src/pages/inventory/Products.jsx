import { useEffect, useState, useCallback, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Plus, Search, Edit2, Trash2, Barcode, Upload,
  Package, ChevronLeft, ChevronRight, AlertTriangle,
  Printer, Archive, ArchiveRestore, X, FileText,
  CheckCircle, AlertCircle, Download, FolderOpen, Image as ImageIcon,
  Palette, RotateCcw
} from 'lucide-react'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import JsBarcode from 'jsbarcode'
import { jsPDF } from 'jspdf'
import ExcelJS from 'exceljs'
import toast from 'react-hot-toast'
import { productAPI, categoryAPI, brandAPI } from '../../api'
import { formatCurrency } from '../../utils/formatters'
import LoadingSpinner from '../../components/common/LoadingSpinner'

// Build a lookup map: normalised filename (no ext, no price suffix) → File object
// Parse image filenames of the form "<BARCODE>_<PRICE>.jpg" or "<BARCODE> <PRICE>.jpg"
// Returns { map: { key → File }, prices: { barcodeKey → price } }
const buildImageMap = (files) => {
  const map = {}
  const prices = {}
  for (const f of files) {
    const lower = f.name.toLowerCase()
    const noExt = lower.replace(/\.[^.]+$/, '')
    map[lower] = f   // full filename with ext
    map[noExt]  = f  // without ext

    // Split on spaces, underscores, or hyphens
    const parts = noExt.split(/[\s_-]+/).filter(Boolean)
    const barcodePart = parts[0]
    if (parts.length > 1 && barcodePart && barcodePart !== noExt) {
      map[barcodePart] = f  // barcode-only key for matching

      // Find the last numeric-looking part as the price
      for (let i = parts.length - 1; i >= 1; i--) {
        const p = parseFloat(parts[i])
        if (!isNaN(p) && p > 0) {
          prices[barcodePart] = p
          break
        }
      }
    }
  }
  return { map, prices }
}

const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(reader.result)
  reader.onerror = reject
  reader.readAsDataURL(file)
})

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
  // tax_type: "inclusive_tax" → "inclusive", "exclusive_tax" → "exclusive", missing → "inclusive"
  const rawTaxType = (row.tax_type || '').trim().toLowerCase()
  const taxType = rawTaxType.includes('exclusive') ? 'exclusive' : 'inclusive'

  // discount_per: support "discount_per", "discount%" or "discount" columns
  const rawDiscount = row.discount_per ?? row['discount%'] ?? row.discount ?? ''
  const discountPer = parseFloat(rawDiscount) || 0

  return {
    name:           (row.name || '').trim()       || undefined,
    sku:            (row.sku  || '').trim()       || undefined,
    barcode:        (row.bar_code || row.barcode || '').trim() || undefined,
    hsn_code:       (row.hsn_code || '').trim()   || undefined,
    sale_price:     parseFloat(row.sell_price)    || 0,
    mrp:            parseFloat(row.mrp)           || 0,
    purchase_price: parseFloat(row.cost_price)    || 0,
    stock:          parseFloat(row.stock_qty)     || 0,
    tax_type:       taxType,
    // Support both "tax_rate" and "TAX RATE" (normalized to "tax rate" by PapaParse)
    tax_rate:       parseFloat(row.tax_rate || row['tax rate']) || 0,
    discount_per:   discountPer,
    color:          (row.color || '').trim()      || undefined,
    show_on_website: (row.show_on_website || '').trim().toUpperCase() === 'Y',
    trending:        (row.trending || '').trim().toUpperCase() === 'Y',
    category_name:  (row.category || row.categories || row.category_name || '').trim() || undefined,
    // _photo is used for image matching; stripped before sending to backend
    _photo:         (row.photo || row.image || row.image_url || '').trim(),
  }
}

function ImportModal({ onClose, onSuccess }) {
  const fileRef = useRef()
  const folderRef = useRef()
  const [file, setFile] = useState(null)
  const [rows, setRows] = useState([])
  const [errors, setErrors] = useState([])
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [imageFiles,    setImageFiles]    = useState({})  // normalised key → File
  const [imagePriceMap, setImagePriceMap] = useState({})  // barcode key → price from filename
  const [progress, setProgress] = useState(0)

  // Set webkitdirectory on the folder input so user can pick an entire folder
  useEffect(() => {
    if (folderRef.current) folderRef.current.setAttribute('webkitdirectory', '')
  }, [])

  const findImageForRow = useCallback((photo, barcode, sku) => {
    const checks = []
    if (photo) {
      const pl = photo.toLowerCase()
      checks.push(pl, pl.replace(/\.[^.]+$/, ''))
    }
    if (barcode) checks.push(barcode.toLowerCase())
    if (sku) checks.push(sku.toLowerCase())
    for (const key of checks) {
      if (imageFiles[key]) return imageFiles[key]
    }
    return null
  }, [imageFiles])

  const parseFile = (f) => {
    setFile(f)
    setResult(null)
    Papa.parse(f, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase(),
      complete: ({ data, errors: parseErrors }) => {
        const errs = []
        // If CSV has a 'type' column, only include rows where type === 'product'. Otherwise include all rows.
        const hasTypeCol = data.length > 0 && 'type' in data[0]
        const productRows = hasTypeCol
          ? data.filter((r) => !r.type || r.type.trim().toLowerCase() === 'product')
          : data
        const clean = productRows.map((row, i) => {
          const product = csvRowToProduct(row)
          if (!product.name) errs.push(`Row ${i + 2}: "name" is required`)
          return product
        })
        // Sort rows by category name so import is serial category-wise
        clean.sort((a, b) => {
          const ca = (a.category_name || '').toLowerCase()
          const cb = (b.category_name || '').toLowerCase()
          return ca < cb ? -1 : ca > cb ? 1 : 0
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
    setProgress(0)
    try {
      const BATCH = 20
      let done = 0

      // Convert matched images to base64 and strip _photo from each row
      const enriched = await Promise.all(rows.map(async (row) => {
        const { _photo, ...product } = row

        // Auto-fill sell_price / mrp from image filename price if missing in CSV
        const barcodeKey = (row.barcode || '').toLowerCase()
        const priceFromImg = imagePriceMap[barcodeKey]
        if (priceFromImg) {
          if (!product.sale_price || product.sale_price === 0) product.sale_price = priceFromImg
          if (!product.mrp || product.mrp === 0) product.mrp = priceFromImg
        }

        const imgFile = findImageForRow(_photo, row.barcode, row.sku)
        if (imgFile) {
          try {
            const base64 = await fileToBase64(imgFile)
            return { ...product, images: [base64] }
          } catch { /* skip image on error */ }
        }
        // If photo column is a URL, use it directly
        if (_photo && _photo.startsWith('http')) {
          return { ...product, images: [_photo] }
        }
        return product
      }))

      // Import in batches of 20 to stay within the 50MB body limit
      for (let i = 0; i < enriched.length; i += BATCH) {
        const batch = enriched.slice(i, i + BATCH)
        await productAPI.bulkImport({ products: batch })
        done += batch.length
        setProgress(Math.round((done / enriched.length) * 100))
      }

      setResult({ imported: done })
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
              <strong>Required columns:</strong> name, bar_code, categories, hsn_code, sell_price, mrp, cost_price, stock_qty, tax_rate
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

          {/* Image Folder Picker */}
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <FolderOpen className="h-5 w-5 text-amber-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-700">Product Images Folder</p>
                  <p className="text-xs text-slate-400 truncate">
                    {Object.keys(imageFiles).length > 0
                      ? (() => {
                          const totalFiles = Object.values(imageFiles).filter((v, i, a) => a.indexOf(v) === i).length
                          const matched = rows.filter(r => findImageForRow(r._photo, r.barcode, r.sku)).length
                          return `${totalFiles} images loaded · ${matched}/${rows.length} products matched`
                        })()
                      : 'Name images as BARCODE_PRICE.jpg (e.g. BPHCZ1_1150.jpg) — price auto-extracted'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => folderRef.current?.click()}
                className="shrink-0 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5"
              >
                <ImageIcon className="h-3.5 w-3.5" />
                {Object.keys(imageFiles).length > 0 ? 'Change' : 'Select Folder'}
              </button>
            </div>
            <input
              ref={folderRef}
              type="file"
              multiple
              accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.tiff,.tif,.heic,.heif,.avif,.jfif"
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files)
                if (!files.length) return
                const { map, prices } = buildImageMap(files)
                setImageFiles(map)
                setImagePriceMap(prices)
                const priceCount = Object.keys(prices).length
                toast.success(`${files.length} images loaded${priceCount ? ` · ${priceCount} prices extracted from filenames` : ''}`)
              }}
            />
          </div>

          {/* Errors */}
          {errors.length > 0 && (
            <div className="bg-red-50 rounded-lg p-3 space-y-1">
              <p className="text-xs font-semibold text-red-700 flex items-center gap-1.5"><AlertCircle className="h-4 w-4" /> {errors.length} error{errors.length > 1 ? 's' : ''} found</p>
              {errors.slice(0, 5).map((e, i) => <p key={i} className="text-xs text-red-600 ml-5">• {e}</p>)}
              {errors.length > 5 && <p className="text-xs text-red-400 ml-5">...and {errors.length - 5} more</p>}
            </div>
          )}

          {/* Import progress */}
          {importing && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-slate-500">
                <span>Importing products with images...</span>
                <span className="font-medium">{progress}%</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
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
                      {['Name','Category','Barcode','Sell Price','MRP','Disc%','Stock','Image'].map((h) => (
                        <th key={h} className="px-3 py-2 text-left text-slate-500 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 20).map((row, i) => {
                      const hasImg = !!findImageForRow(row._photo, row.barcode, row.sku)
                      return (
                        <tr key={i} className="border-t border-slate-100 hover:bg-slate-50">
                          <td className="px-3 py-1.5 text-gray-400">{i + 1}</td>
                          <td className="px-3 py-1.5 font-medium text-slate-800 max-w-[140px] truncate">{row.name || <span className="text-red-400">MISSING</span>}</td>
                          <td className="px-3 py-1.5 text-slate-600 text-xs max-w-[100px] truncate">{row.category_name || '-'}</td>
                          <td className="px-3 py-1.5 font-mono text-slate-500">{row.barcode || '-'}</td>
                          <td className="px-3 py-1.5 text-slate-700">
                            {(() => {
                              const csvPrice = row.sale_price
                              const imgPrice = imagePriceMap[(row.barcode || '').toLowerCase()]
                              if (csvPrice && csvPrice > 0) return `₹${csvPrice}`
                              if (imgPrice) return <span className="text-blue-600 font-medium">₹{imgPrice} <span className="text-xs text-blue-400">(img)</span></span>
                              return <span className="text-gray-300">—</span>
                            })()}
                          </td>
                          <td className="px-3 py-1.5 text-slate-700">
                            {(() => {
                              const csvMrp = row.mrp
                              const imgPrice = imagePriceMap[(row.barcode || '').toLowerCase()]
                              if (csvMrp && csvMrp > 0) return `₹${csvMrp}`
                              if (imgPrice) return <span className="text-blue-600 font-medium">₹{imgPrice} <span className="text-xs text-blue-400">(img)</span></span>
                              return <span className="text-gray-300">—</span>
                            })()}
                          </td>
                          <td className="px-3 py-1.5 text-center">
                            {parseFloat(row.discount_per) > 0
                              ? <span className="bg-green-100 text-green-700 text-xs font-bold px-1.5 py-0.5 rounded">{row.discount_per}%</span>
                              : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-3 py-1.5 text-slate-600">{row.stock ?? '-'}</td>
                          <td className="px-3 py-1.5">
                            {Object.keys(imageFiles).length > 0 ? (
                              hasImg
                                ? <span className="text-green-600 font-medium">✓</span>
                                : <span className="text-gray-300">—</span>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                    {rows.length > 20 && (
                      <tr><td colSpan={9} className="px-3 py-2 text-center text-gray-400 text-xs">...and {rows.length - 20} more rows</td></tr>
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

// ── Price Update Modal ────────────────────────────────────────────────────────
function PriceUpdateModal({ products, onClose, onSuccess }) {
  const folderRef = useRef()
  const [priceMap,  setPriceMap]  = useState({}) // barcode_lower → price
  const [matches,   setMatches]   = useState([])
  const [updating,  setUpdating]  = useState(false)
  const [done,      setDone]      = useState(null)

  const handleImages = (allFiles) => {
    const imgExts = /\.(jpe?g|png|webp|gif|bmp|tiff?|heic|heif|avif|jfif|svg)$/i
    const files = allFiles.filter(f => imgExts.test(f.name))
    const { prices } = buildImageMap(files)
    setPriceMap(prices)
    const matched = products
      .map((p) => ({ product: p, price: prices[(p.barcode || '').toLowerCase()] }))
      .filter((m) => m.price)
    setMatches(matched)
    if (!Object.keys(prices).length) toast.error('No prices found in filenames — use BARCODE_PRICE.jpg format')
  }

  const handleUpdate = async () => {
    setUpdating(true)
    let updated = 0
    for (const { product, price } of matches) {
      try {
        await productAPI.update(product.id, { sale_price: price, mrp: price })
        updated++
      } catch (_) {}
    }
    setDone(updated)
    setUpdating(false)
    onSuccess()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center">
              <ImageIcon className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-800">Update Prices from Images</h2>
              <p className="text-xs text-slate-500">Image name format: BARCODE_PRICE.jpg (e.g. BPHCZ1_1150.jpg)</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X className="h-5 w-5 text-gray-500" /></button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
          {/* Folder picker */}
          <div className="border-2 border-dashed border-blue-200 rounded-xl p-6 text-center">
            <input ref={folderRef} type="file" multiple className="hidden"
              onChange={(e) => { const f = Array.from(e.target.files); if (f.length) handleImages(f) }} />
            <ImageIcon className="h-10 w-10 text-blue-300 mx-auto mb-2" />
            <p className="text-sm text-slate-600 font-medium mb-1">Select your image files</p>
            <p className="text-xs text-slate-400 mb-1">Filenames: <code className="bg-slate-100 px-1 rounded">BPHCZ1_1150.jpg</code> → price ₹1150 for barcode BPHCZ1</p>
            <p className="text-xs text-blue-500 mb-3">Tip: Open your folder → press <strong>Ctrl+A</strong> to select all images → click Open</p>
            <button
              onClick={() => folderRef.current?.click()}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
            >
              Select Images
            </button>
          </div>

          {/* No matches */}
          {Object.keys(priceMap).length > 0 && matches.length === 0 && !done && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg px-4 py-3 text-sm text-orange-700">
              No matching barcodes found. Make sure image names start with the product barcode (e.g. BPHCZ1_1150.jpg).
            </div>
          )}

          {/* Matches preview */}
          {matches.length > 0 && done === null && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{matches.length} products matched — prices to be set:</p>
              <div className="border border-slate-200 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left text-slate-500">Name</th>
                      <th className="px-3 py-2 text-left text-slate-500">Barcode</th>
                      <th className="px-3 py-2 text-right text-slate-500">Sell Price / MRP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matches.map(({ product, price }) => (
                      <tr key={product.id} className="border-t border-slate-100 hover:bg-slate-50">
                        <td className="px-3 py-2 font-medium text-slate-800 truncate max-w-[180px]">{product.name}</td>
                        <td className="px-3 py-2 font-mono text-slate-500">{product.barcode}</td>
                        <td className="px-3 py-2 text-right text-green-600 font-bold">₹{price}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Success */}
          {done !== null && (
            <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
              <p className="text-sm font-semibold text-green-800">{done} products updated with prices!</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100">
          <button onClick={onClose} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm">
            {done !== null ? 'Close' : 'Cancel'}
          </button>
          {done === null && matches.length > 0 && (
            <button onClick={handleUpdate} disabled={updating}
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50">
              {updating && <LoadingSpinner size="sm" />}
              Update {matches.length} Products
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Barcode Print Modal ───────────────────────────────────────────────────────
const generateBarcodeDataUrl = (text) => {
  try {
    const canvas = document.createElement('canvas')
    JsBarcode(canvas, text, { format: 'CODE128', width: 2, height: 60, displayValue: false, margin: 6 })
    return canvas.toDataURL('image/png')
  } catch {
    return null
  }
}

// Barcode for 1.5×1 inch thermal label
const generateThermalBarcodeDataUrl = (text) => {
  try {
    const canvas = document.createElement('canvas')
    JsBarcode(canvas, text, { format: 'CODE128', width: 3, height: 120, displayValue: false, margin: 2 })
    return canvas.toDataURL('image/png')
  } catch {
    return null
  }
}

// ── Label Designer constants (100×15mm at 203 DPI = 800×120 dots) ────────────
const LABEL_W = 800   // dots
const LABEL_H = 120   // dots
const DESIGNER_SCALE = 0.75  // display at 75% → 600×90 px in designer

// Default layout: LEFT EMPTY (51mm), all content on RIGHT side
const DEFAULT_LABEL_TEMPLATE = {
  name:    { x: 412, y: 3,  w: 185, h: 19, fontSize: 11, bold: true,  show: true },
  price:   { x: 602, y: 3,  w: 190, h: 19, fontSize: 11, bold: false, show: true },
  barcode: { x: 412, y: 22, w: 383, h: 70, show: true },
  code:    { x: 412, y: 95, w: 383, h: 12, fontSize: 8,  bold: false, show: true },
}

function getLabelTemplate() {
  try {
    const s = localStorage.getItem('kavipushp_label_tpl')
    if (s) {
      const parsed = JSON.parse(s)
      return {
        name:    { ...DEFAULT_LABEL_TEMPLATE.name,    ...parsed.name },
        price:   { ...DEFAULT_LABEL_TEMPLATE.price,   ...parsed.price },
        barcode: { ...DEFAULT_LABEL_TEMPLATE.barcode, ...parsed.barcode },
        code:    { ...DEFAULT_LABEL_TEMPLATE.code,    ...parsed.code },
      }
    }
  } catch {}
  return { ...DEFAULT_LABEL_TEMPLATE }
}

// Map CSS fontSize → TSPL font number
function tsplFont(fs) {
  if (fs <= 8)  return '0'
  if (fs <= 10) return '1'
  if (fs <= 14) return '2'
  if (fs <= 20) return '3'
  return '4'
}

// Generate TSPL for TVS LP46 Neo using saved template
function buildTSPL(name, barcodeText, price, qty) {
  const tpl = getLabelTemplate()
  const safeName = String(name).replace(/"/g, "'").substring(0, 22)
  const safeCode = String(barcodeText).replace(/"/g, "'")
  const priceStr = `Rs.${parseFloat(price).toFixed(0)}`
  const lines = [
    'SIZE 100 mm,15 mm',
    'GAP 2 mm,0 mm',
    'DIRECTION 1',
    'REFERENCE 0,0',
    'SPEED 2',
    'DENSITY 12',
    'CLS',
  ]
  if (tpl.name.show)
    lines.push(`TEXT ${tpl.name.x},${tpl.name.y},"${tsplFont(tpl.name.fontSize)}",0,1,1,"${safeName}"`)
  if (tpl.price.show)
    lines.push(`TEXT ${tpl.price.x},${tpl.price.y},"${tsplFont(tpl.price.fontSize)}",0,1,1,"${priceStr}"`)
  if (tpl.barcode.show)
    lines.push(`BARCODE ${tpl.barcode.x},${tpl.barcode.y},"128",${tpl.barcode.h},0,0,2,3,"${safeCode}"`)
  if (tpl.code.show)
    lines.push(`TEXT ${tpl.code.x},${tpl.code.y},"${tsplFont(tpl.code.fontSize)}",0,1,1,"${safeCode}"`)
  lines.push(`PRINT ${qty},1`)
  return lines.join('\r\n')
}

// ── Label Designer Modal ──────────────────────────────────────────────────────
const EL_COLORS = {
  name:    { bg: 'rgba(59,130,246,0.18)',  border: '#3b82f6' },
  price:   { bg: 'rgba(16,185,129,0.18)', border: '#10b981' },
  barcode: { bg: 'rgba(245,158,11,0.18)', border: '#f59e0b' },
  code:    { bg: 'rgba(139,92,246,0.18)', border: '#8b5cf6' },
}
const EL_LABELS = { name: 'Product Name', price: 'Price', barcode: 'Barcode Image', code: 'Barcode Number' }

function LabelDesignerModal({ onClose }) {
  const [tpl, setTpl] = useState(() => ({
    name:    { ...DEFAULT_LABEL_TEMPLATE.name },
    price:   { ...DEFAULT_LABEL_TEMPLATE.price },
    barcode: { ...DEFAULT_LABEL_TEMPLATE.barcode },
    code:    { ...DEFAULT_LABEL_TEMPLATE.code },
    ...(() => { try { const s = localStorage.getItem('kavipushp_label_tpl'); return s ? JSON.parse(s) : {} } catch { return {} } })(),
  }))
  const [sel, setSel] = useState('name')
  const [drag, setDrag] = useState(null)
  const canvasRef = useRef(null)

  const sampleBarcode = generateThermalBarcodeDataUrl('1234567890') || ''

  const onElMouseDown = (e, key) => {
    e.preventDefault()
    setSel(key)
    const rect = canvasRef.current.getBoundingClientRect()
    setDrag({ key, sx: e.clientX - rect.left, sy: e.clientY - rect.top, ox: tpl[key].x, oy: tpl[key].y })
  }

  const onMouseMove = (e) => {
    if (!drag) return
    const rect = canvasRef.current.getBoundingClientRect()
    const dx = ((e.clientX - rect.left) - drag.sx) / DESIGNER_SCALE
    const dy = ((e.clientY - rect.top) - drag.sy) / DESIGNER_SCALE
    const el = tpl[drag.key]
    const nx = Math.max(0, Math.min(LABEL_W - el.w, drag.ox + dx))
    const ny = Math.max(0, Math.min(LABEL_H - el.h, drag.oy + dy))
    setTpl(t => ({ ...t, [drag.key]: { ...t[drag.key], x: Math.round(nx), y: Math.round(ny) } }))
  }

  const update = (key, prop, val) => setTpl(t => ({ ...t, [key]: { ...t[key], [prop]: val } }))

  const handleSave = () => {
    localStorage.setItem('kavipushp_label_tpl', JSON.stringify(tpl))
    toast.success('Label design saved!')
    onClose()
  }

  const handleReset = () => {
    const d = {
      name:    { ...DEFAULT_LABEL_TEMPLATE.name },
      price:   { ...DEFAULT_LABEL_TEMPLATE.price },
      barcode: { ...DEFAULT_LABEL_TEMPLATE.barcode },
      code:    { ...DEFAULT_LABEL_TEMPLATE.code },
    }
    setTpl(d)
    localStorage.removeItem('kavipushp_label_tpl')
    toast.success('Reset to default layout')
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl shadow-2xl flex flex-col max-h-[95vh]" style={{ width: 760 }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2"><Palette className="h-5 w-5 text-violet-500" /> Label Designer</h2>
            <p className="text-xs text-slate-500 mt-0.5">TVS LP46 Neo · 38.1×25.4mm · 203 DPI · Drag elements to reposition</p>
          </div>
          <button onClick={onClose}><X className="h-5 w-5 text-slate-400 hover:text-slate-600" /></button>
        </div>

        {/* Body */}
        <div className="flex gap-5 p-5 overflow-y-auto flex-1">

          {/* Label canvas */}
          <div className="flex-shrink-0">
            <p className="text-xs text-center text-slate-500 mb-2">Label canvas · 100×15 mm · {LABEL_W}×{LABEL_H} dots (displayed at 75%)</p>
            <div
              ref={canvasRef}
              style={{ width: Math.round(LABEL_W * DESIGNER_SCALE), height: Math.round(LABEL_H * DESIGNER_SCALE), position: 'relative', background: '#fff', border: '2px solid #cbd5e1', userSelect: 'none', cursor: drag ? 'grabbing' : 'crosshair' }}
              onMouseMove={onMouseMove}
              onMouseUp={() => setDrag(null)}
              onMouseLeave={() => setDrag(null)}
            >
              {/* Subtle grid (every 100 dots = 75px) */}
              {Array.from({ length: 7 }, (_, i) => (
                <div key={`v${i}`} style={{ position: 'absolute', left: (i + 1) * 100 * DESIGNER_SCALE, top: 0, width: 1, height: '100%', background: '#e2e8f0' }} />
              ))}
              {Array.from({ length: 1 }, (_, i) => (
                <div key={`h${i}`} style={{ position: 'absolute', top: (i + 1) * 60 * DESIGNER_SCALE, left: 0, height: 1, width: '100%', background: '#e2e8f0' }} />
              ))}

              {/* Draggable elements */}
              {['name', 'price', 'barcode', 'code'].map(key => {
                const el = tpl[key]
                if (!el.show) return null
                const isSel = sel === key
                const c = EL_COLORS[key]
                return (
                  <div key={key}
                    onMouseDown={(e) => onElMouseDown(e, key)}
                    style={{
                      position: 'absolute',
                      left: Math.round(el.x * DESIGNER_SCALE), top: Math.round(el.y * DESIGNER_SCALE),
                      width: Math.round(el.w * DESIGNER_SCALE), height: Math.round(el.h * DESIGNER_SCALE),
                      background: isSel ? c.bg.replace('0.18', '0.35') : c.bg,
                      border: `${isSel ? 2 : 1}px ${isSel ? 'solid' : 'dashed'} ${c.border}`,
                      cursor: 'grab', overflow: 'hidden', display: 'flex', alignItems: 'center', boxSizing: 'border-box', borderRadius: 2,
                    }}
                  >
                    {key === 'barcode' ? (
                      sampleBarcode
                        ? <img src={sampleBarcode} style={{ width: '100%', height: '100%', objectFit: 'fill' }} draggable={false} />
                        : <span style={{ fontSize: 8, color: '#888', width: '100%', textAlign: 'center' }}>Barcode</span>
                    ) : (
                      <span style={{ fontSize: el.fontSize, fontWeight: el.bold ? 'bold' : 'normal', whiteSpace: 'nowrap', paddingLeft: 2, color: '#1a1a1a', lineHeight: 1 }}>
                        {key === 'name' ? 'Product Name' : key === 'price' ? 'Rs.299' : '1234567890'}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-3 mt-2">
              {['name', 'price', 'barcode', 'code'].map(key => (
                <button key={key} onClick={() => setSel(key)}
                  className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded border ${sel === key ? 'font-semibold' : 'text-slate-500'}`}
                  style={{ borderColor: EL_COLORS[key].border, background: sel === key ? EL_COLORS[key].bg : 'transparent', color: sel === key ? EL_COLORS[key].border : '' }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: EL_COLORS[key].border, display: 'inline-block' }} />
                  {EL_LABELS[key]}
                </button>
              ))}
            </div>
          </div>

          {/* Properties panel */}
          <div className="flex-1 space-y-3">
            <p className="text-sm font-semibold text-slate-700">Properties</p>
            {['name', 'price', 'barcode', 'code'].map(key => {
              const el = tpl[key]
              const isSel = sel === key
              return (
                <div key={key} onClick={() => setSel(key)}
                  className={`rounded-lg border p-3 cursor-pointer transition-colors ${isSel ? 'border-blue-300 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold" style={{ color: EL_COLORS[key].border }}>{EL_LABELS[key]}</span>
                    <label className="flex items-center gap-1 text-xs text-slate-600 cursor-pointer" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={el.show}
                        onChange={e => update(key, 'show', e.target.checked)} className="rounded" />
                      Visible
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <label className="flex flex-col gap-0.5 text-slate-500">
                      X (dots)
                      <input type="number" value={el.x} min={0} max={LABEL_W}
                        onChange={e => update(key, 'x', +e.target.value)}
                        className="border border-slate-200 rounded px-2 py-1 text-slate-800" />
                    </label>
                    <label className="flex flex-col gap-0.5 text-slate-500">
                      Y (dots)
                      <input type="number" value={el.y} min={0} max={LABEL_H}
                        onChange={e => update(key, 'y', +e.target.value)}
                        className="border border-slate-200 rounded px-2 py-1 text-slate-800" />
                    </label>
                    {key === 'barcode' ? (
                      <>
                        <label className="flex flex-col gap-0.5 text-slate-500">
                          Width
                          <input type="number" value={el.w} min={20} max={LABEL_W}
                            onChange={e => update(key, 'w', +e.target.value)}
                            className="border border-slate-200 rounded px-2 py-1 text-slate-800" />
                        </label>
                        <label className="flex flex-col gap-0.5 text-slate-500">
                          Height
                          <input type="number" value={el.h} min={10} max={LABEL_H}
                            onChange={e => update(key, 'h', +e.target.value)}
                            className="border border-slate-200 rounded px-2 py-1 text-slate-800" />
                        </label>
                      </>
                    ) : (
                      <>
                        <label className="flex flex-col gap-0.5 text-slate-500">
                          Font size
                          <input type="number" value={el.fontSize} min={6} max={28}
                            onChange={e => update(key, 'fontSize', +e.target.value)}
                            className="border border-slate-200 rounded px-2 py-1 text-slate-800" />
                        </label>
                        <label className="flex items-center gap-2 text-slate-500 pt-4 cursor-pointer" onClick={e => e.stopPropagation()}>
                          <input type="checkbox" checked={el.bold || false}
                            onChange={e => update(key, 'bold', e.target.checked)} className="rounded" />
                          Bold
                        </label>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100">
          <button onClick={handleReset} className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700">
            <RotateCcw className="h-3 w-3" /> Reset to Default
          </button>
          <div className="flex gap-3">
            <button onClick={onClose} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm">Cancel</button>
            <button onClick={handleSave} className="bg-violet-600 hover:bg-violet-700 text-white px-5 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
              <Palette className="h-4 w-4" /> Save Design
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function PrintBarcodesModal({ products, selectedIds, onClose }) {
  const selectedProducts = products.filter((p) => selectedIds.includes(p.id))
  const [copies, setCopies] = useState(1)
  const [labelsPerRow, setLabelsPerRow] = useState(4)
  const [showName, setShowName] = useState(true)
  const [showPrice, setShowPrice] = useState(true)
  const [labelFormat, setLabelFormat] = useState('standard') // 'standard' | 'thermal100x15'
  const [qzStatus, setQzStatus] = useState('idle') // 'idle' | 'connecting' | 'printing' | 'error'
  const [showDesigner, setShowDesigner] = useState(false)

  const handleDirectPrintQZ = async () => {
    setQzStatus('connecting')
    try {
      const qzModule = await import('qz-tray')
      const qz = qzModule.default || qzModule

      // Unsigned mode — user must enable "Allow unsigned" in QZ Tray settings
      qz.security.setCertificatePromise((resolve) => resolve(''))
      qz.security.setSignatureAlgorithm('SHA512')
      qz.security.setSignaturePromise(() => (resolve) => resolve(''))

      if (!qz.websocket.isActive()) {
        await qz.websocket.connect()
      }

      // Find TVS LP46 Neo printer
      let printerName = ''
      try {
        const found = await qz.printers.find('TVS')
        printerName = Array.isArray(found) ? found[0] : found
      } catch {
        // fallback: try common name variations
        const all = await qz.printers.getDefault()
        printerName = all
      }

      if (!printerName) {
        toast.error('TVS LP46 Neo printer not found. Check it is installed.')
        setQzStatus('error')
        return
      }

      setQzStatus('printing')
      const config = qz.configs.create(printerName)

      for (const p of selectedProducts) {
        const barcodeText = p.barcode || p.sku || ''
        if (!barcodeText) continue
        const price = p.sale_price || p.sell_price || 0
        const tspl = buildTSPL(p.name || '', barcodeText, price, copies)
        await qz.print(config, [{ type: 'raw', format: 'plain', data: tspl }])
      }

      toast.success(`Sent ${selectedProducts.length} label(s) to ${printerName}`)
      setQzStatus('idle')
    } catch (err) {
      setQzStatus('error')
      if (err.message && err.message.toLowerCase().includes('unable to establish')) {
        toast.error('QZ Tray not running. Install from qz.io and start it, then try again.')
      } else {
        toast.error(`Direct print failed: ${err.message}`)
      }
    }
  }

  const handleExportBarcode = () => {
    const rows = []
    for (const p of selectedProducts) {
      const barcodeText = p.barcode || p.sku || ''
      if (!barcodeText) continue
      const imgUrl = generateThermalBarcodeDataUrl(barcodeText)
      if (!imgUrl) continue
      const price = parseFloat(p.sale_price || p.sell_price || 0)
      for (let c = 0; c < copies; c++) {
        rows.push({ name: p.name || '', barcodeText, imgUrl, price })
      }
    }
    if (!rows.length) { toast.error('No valid barcodes to export'); return }

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageW = 210
    const margin = 10
    const cardsPerRow = 3
    const gap = 4
    const cardW = (pageW - margin * 2 - gap * (cardsPerRow - 1)) / cardsPerRow  // ~56mm
    const imgH = 7        // half size barcode
    const nameH = 5       // name+price row height
    const codeH = 4       // barcode text line height
    const padV = 2        // top/bottom padding inside card
    const cardH = padV + nameH + imgH + codeH + padV  // ~20mm

    let col = 0
    let y = margin

    rows.forEach((r, idx) => {
      if (col === 0 && idx > 0 && y + cardH > 287) { doc.addPage(); y = margin }
      const x = margin + col * (cardW + gap)

      // Single card border
      doc.setDrawColor(180, 180, 180)
      doc.setFillColor(255, 255, 255)
      doc.rect(x, y, cardW, cardH, 'FD')

      let cy = y + padV

      // Name (left) + Price (right) on same row
      const textY = cy + nameH - 1
      const name = r.name.length > 18 ? r.name.substring(0, 18) + '…' : r.name
      doc.setFontSize(8)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(30, 30, 30)
      doc.text(name, x + 2, textY)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(60, 60, 60)
      doc.text(`Rs.${r.price.toFixed(0)}`, x + cardW - 2, textY, { align: 'right' })
      cy += nameH

      // Barcode image (half size, full width)
      const imgW = cardW - 4
      doc.addImage(r.imgUrl, 'PNG', x + 2, cy, imgW, imgH)
      cy += imgH

      // Barcode code text centered
      doc.setFontSize(6.5)
      doc.setFont('courier', 'normal')
      doc.setTextColor(80, 80, 80)
      doc.text(r.barcodeText, x + cardW / 2, cy + codeH - 0.5, { align: 'center' })

      col++
      if (col >= cardsPerRow) { col = 0; y += cardH + gap }
    })

    doc.save(`barcodes_${new Date().toISOString().split('T')[0]}.pdf`)
    toast.success(`Exported ${rows.length} barcode image${rows.length > 1 ? 's' : ''} to PDF`)
  }

  const handleFinalExportExcel = async () => {
    try {
    const items = []
    for (const p of selectedProducts) {
      const barcodeText = p.barcode || p.sku || ''
      if (!barcodeText) continue
      const price = parseFloat(p.sale_price || p.sell_price || 0)

      // Render label (600×90px, 2× retina for sharp barcode)
      const W = 600, H = 90
      const R = 2  // retina scale
      const canvas = document.createElement('canvas')
      canvas.width = W * R; canvas.height = H * R
      const ctx = canvas.getContext('2d')
      ctx.scale(R, R)

      // White background + border
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, W, H)
      ctx.strokeStyle = '#cccccc'
      ctx.lineWidth = 0.5
      ctx.strokeRect(0.5, 0.5, W - 1, H - 1)

      // RIGHT-SIDE CONTENT (left half is empty, like the physical label)
      const cx = Math.round(W * 0.51)  // content start x ≈ 306px = 51mm
      const cw = W - cx - 3            // content width ≈ 291px

      // Name (top-left of content area)
      ctx.fillStyle = '#111111'
      ctx.font = 'bold 13px Arial, sans-serif'
      const nm = p.name.length > 15 ? p.name.substring(0, 15) + '…' : p.name
      ctx.fillText(nm, cx + 3, 15)

      // Price (top-right of content area)
      ctx.font = '12px Arial, sans-serif'
      ctx.fillStyle = '#222222'
      const priceText = `Rs.${price.toFixed(0)}`
      const pw = ctx.measureText(priceText).width
      ctx.fillText(priceText, cx + cw - pw - 2, 15)

      // Barcode image (sharp, full content width)
      try {
        const bc = document.createElement('canvas')
        JsBarcode(bc, barcodeText, { format: 'CODE128', width: 3, height: 100, displayValue: false, margin: 3 })
        ctx.drawImage(bc, cx, 18, cw, 58)
      } catch { /* skip */ }

      // Barcode number (bottom, centered in content area)
      ctx.fillStyle = '#444444'
      ctx.font = '8.5px Courier New, monospace'
      const ctw = ctx.measureText(barcodeText).width
      ctx.fillText(barcodeText, cx + (cw - ctw) / 2, 83)

      const base64 = canvas.toDataURL('image/png').split(',')[1]
      for (let c = 0; c < copies; c++) {
        items.push({ base64 })
      }
    }

    if (!items.length) { toast.error('No valid barcodes to export'); return }

    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Barcodes')

    ws.getColumn(1).width = 80   // ~600px wide

    for (let i = 0; i < items.length; i++) {
      const row = ws.getRow(i + 1)
      row.height = 68             // ~90px tall

      const imgId = wb.addImage({ base64: items[i].base64, extension: 'png' })
      ws.addImage(imgId, {
        tl: { col: 0, row: i },
        br: { col: 1, row: i + 1 },
        editAs: 'oneCell'
      })
    }

    const buffer = await wb.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `barcodes_${new Date().toISOString().split('T')[0]}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`Exported ${items.length} label image${items.length > 1 ? 's' : ''} to Excel`)
    } catch (err) {
      toast.error(`Excel export failed: ${err.message}`)
    }
  }

  const handlePrint = () => {
    // ── 100×15mm Thermal Label ──────────────────────────────────────────────
    if (labelFormat === 'thermal100x15') {
      const labels = []
      for (const p of selectedProducts) {
        const barcodeText = p.barcode || p.sku || ''
        if (!barcodeText) continue
        const imgUrl = generateThermalBarcodeDataUrl(barcodeText)
        if (!imgUrl) continue
        const price = p.sale_price || p.mrp || 0
        for (let c = 0; c < copies; c++) {
          labels.push({ name: p.name, barcodeText, imgUrl, price })
        }
      }
      if (!labels.length) {
        toast.error('No valid barcodes to print (products need a barcode value)')
        return
      }
      const esc = (s) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
      const thermalHtml = `<!DOCTYPE html><html><head>
        <meta charset="UTF-8"/>
        <title>Barcodes (${labels.length})</title>
        <style>
          *{box-sizing:border-box;margin:0;padding:0;}
          body{font-family:Arial,sans-serif;background:#fff;}
          .label{width:100mm;height:15mm;display:flex;flex-direction:column;padding:0.3mm 0.5mm 0.3mm 51mm;page-break-after:always;overflow:hidden;background:#fff;box-sizing:border-box;}
          .label:last-child{page-break-after:avoid;}
          .top-row{display:flex;justify-content:space-between;align-items:baseline;flex-shrink:0;overflow:hidden;gap:0.5mm;}
          .name{font-size:8pt;font-weight:bold;color:#000;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:60%;}
          .price{font-size:8pt;color:#000;white-space:nowrap;flex-shrink:0;}
          .bc-wrap{flex:1;display:flex;flex-direction:column;min-height:0;overflow:hidden;}
          .barcode-img{flex:1;width:100%;min-height:0;object-fit:fill;display:block;}
          .code{font-size:5.5pt;font-family:monospace;color:#222;text-align:center;white-space:nowrap;flex-shrink:0;letter-spacing:0.3px;}
          @media print{body{margin:0;padding:0;}@page{size:100mm 15mm;margin:0;}}
        </style>
      </head><body>
        ${labels.map((l) => `<div class="label">
          <div class="top-row">
            ${showName ? `<span class="name">${esc(l.name)}</span>` : ''}
            ${showPrice && l.price > 0 ? `<span class="price">Rs.${Number(l.price).toFixed(0)}</span>` : ''}
          </div>
          <div class="bc-wrap">
            <img class="barcode-img" src="${l.imgUrl}"/>
            <div class="code">${esc(l.barcodeText)}</div>
          </div>
        </div>`).join('')}
        <script>setTimeout(function(){window.print();window.onafterprint=function(){window.close();};},400);<\/script>
      </body></html>`
      const win = window.open('', '_blank', 'width=400,height=300,toolbar=0,menubar=0,scrollbars=0')
      if (!win) { toast.error('Allow popups to print barcode labels.'); return }
      win.document.open()
      win.document.write(thermalHtml)
      win.document.close()
      return
    }

    // ── A4 Sheet 5×13 (HP Smart Tank 589) ──────────────────────────────────
    if (labelFormat === 'a4sheet5x13') {
      const labels = []
      for (const p of selectedProducts) {
        const barcodeText = p.barcode || p.sku || ''
        if (!barcodeText) continue
        const imgUrl = generateThermalBarcodeDataUrl(barcodeText)
        if (!imgUrl) continue
        const price = p.sale_price || p.sell_price || p.mrp || 0
        for (let c = 0; c < copies; c++) {
          labels.push({ name: p.name, barcodeText, imgUrl, price })
        }
      }
      if (!labels.length) {
        toast.error('No valid barcodes to print (products need a barcode value)')
        return
      }
      const esc = (s) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
      const a4Html = `<!DOCTYPE html><html><head>
        <meta charset="UTF-8"/>
        <title>Barcodes A4 (${labels.length})</title>
        <style>
          *{box-sizing:border-box;margin:0;padding:0;}
          body{font-family:Arial,sans-serif;background:#fff;}
          .sheet{
            display:grid;
            grid-template-columns:repeat(5,38.1mm);
            grid-auto-rows:25.4mm;
            gap:0;
            padding:9.75mm 9.75mm;
            width:210mm;
          }
          .label{
            width:38.1mm;
            height:25.4mm;
            overflow:hidden;
            display:flex;
            flex-direction:column;
            padding:1mm 0mm 1mm 13.1mm;
            break-inside:avoid;
            page-break-inside:avoid;
          }
          .name-price-row{display:flex;justify-content:flex-end;align-items:baseline;gap:1mm;flex-shrink:0;overflow:hidden;}
          .name{font-size:6pt;font-weight:bold;color:#000;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.3;}
          .price{font-size:6pt;font-weight:bold;color:#000;white-space:nowrap;flex-shrink:0;line-height:1.3;}
          .barcode-img{flex:1;width:100%;min-height:0;object-fit:fill;display:block;}
          .code{font-size:5pt;font-family:monospace;color:#333;line-height:1;letter-spacing:0.3px;text-align:right;white-space:nowrap;flex-shrink:0;}
          @media print{body{margin:0;padding:0;}@page{size:A4 portrait;margin:0;}}
        </style>
      </head><body>
        <div class="sheet">
          ${labels.map((l) => `<div class="label">
            ${(showName || (showPrice && l.price > 0)) ? `<div class="name-price-row">
              ${showName ? `<span class="name">${esc(l.name)}</span>` : ''}
              ${showPrice && l.price > 0 ? `<span class="price">&#8377;${Number(l.price).toFixed(0)}</span>` : ''}
            </div>` : ''}
            <img class="barcode-img" src="${l.imgUrl}"/>
            <div class="code">${esc(l.barcodeText)}</div>
          </div>`).join('')}
        </div>
        <script>setTimeout(function(){window.print();window.onafterprint=function(){window.close();};},400);<\/script>
      </body></html>`
      const win = window.open('', '_blank', 'width=900,height=700,toolbar=0,menubar=0,scrollbars=0')
      if (!win) { toast.error('Allow popups to print barcode labels.'); return }
      win.document.open()
      win.document.write(a4Html)
      win.document.close()
      return
    }

    // ── Standard Labels ─────────────────────────────────────────────────────
    const labels = []
    for (const p of selectedProducts) {
      const barcodeText = p.barcode || p.sku || ''
      if (!barcodeText) continue
      const imgUrl = generateBarcodeDataUrl(barcodeText)
      if (!imgUrl) continue
      const price = p.sale_price || p.mrp || 0
      const mrp = p.mrp || 0
      for (let c = 0; c < copies; c++) {
        labels.push({ name: p.name, barcodeText, imgUrl, price, mrp })
      }
    }

    if (!labels.length) {
      toast.error('No valid barcodes to print (products need a barcode value)')
      return
    }

    const labelWidth = labelsPerRow === 1 ? 220 : labelsPerRow === 2 ? 190 : labelsPerRow === 4 ? 145 : 165
    const stdHtml = `<!DOCTYPE html>
      <html>
      <head>
        <title>Barcode Labels</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: Arial, sans-serif; background: #fff; padding: 8px; }
          .grid { display: flex; flex-wrap: wrap; gap: 6px; }
          .label {
            width: ${labelWidth}px;
            border: 1px solid #ccc;
            border-radius: 4px;
            padding: 6px 8px;
            text-align: center;
            page-break-inside: avoid;
            background: #fff;
          }
          .label .name {
            font-size: 10px;
            font-weight: bold;
            color: #1e293b;
            margin-bottom: 3px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .label .price {
            font-size: 13px;
            font-weight: bold;
            color: #b45309;
            margin-bottom: 2px;
          }
          .label .mrp {
            font-size: 9px;
            color: #94a3b8;
            margin-bottom: 2px;
          }
          .label img { width: 100%; max-height: 48px; object-fit: contain; }
          .label .code { font-size: 9px; font-family: monospace; color: #64748b; margin-top: 2px; }
          @media print {
            body { padding: 4px; }
            @page { margin: 6mm; }
          }
        </style>
      </head>
      <body>
        <div class="grid">
          ${labels.map((l) => `
            <div class="label">
              ${showName ? `<div class="name" title="${l.name}">${l.name}</div>` : ''}
              ${showPrice && l.price > 0 ? `<div class="price">&#8377;${Number(l.price).toFixed(0)}</div>` : ''}
              ${showPrice && l.mrp > 0 && l.mrp !== l.price ? `<div class="mrp">MRP: &#8377;${Number(l.mrp).toFixed(0)}</div>` : ''}
              <img src="${l.imgUrl}" alt="${l.barcodeText}" />
              <div class="code">${l.barcodeText}</div>
            </div>
          `).join('')}
        </div>
      </body>
      </html>`
    const stdBlob = new Blob([stdHtml], { type: 'text/html' })
    const stdUrl = URL.createObjectURL(stdBlob)
    const win = window.open(stdUrl, '_blank')
    if (!win) { toast.error('Allow popups to print barcode labels.'); URL.revokeObjectURL(stdUrl); return }
    win.onload = () => {
      setTimeout(() => {
        win.focus()
        win.print()
        win.onafterprint = () => { win.close(); URL.revokeObjectURL(stdUrl) }
      }, 200)
    }
  }

  const skippedCount = selectedProducts.filter((p) => !p.barcode && !p.sku).length

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center">
              <Printer className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-800">Print Barcode Labels</h2>
              <p className="text-xs text-slate-500">{selectedProducts.length} product{selectedProducts.length !== 1 ? 's' : ''} selected</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
          {skippedCount > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-xs text-orange-700 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {skippedCount} product{skippedCount !== 1 ? 's have' : ' has'} no barcode/SKU and will be skipped
            </div>
          )}

          {/* Copies */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Copies per product</label>
            <div className="flex items-center gap-2">
              <button onClick={() => setCopies((c) => Math.max(1, c - 1))}
                className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 font-bold text-lg">−</button>
              <span className="w-10 text-center font-semibold text-slate-800">{copies}</span>
              <button onClick={() => setCopies((c) => Math.min(20, c + 1))}
                className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 font-bold text-lg">+</button>
            </div>
          </div>

          {/* Label Format */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-2">Label Format</label>
            <div className="flex gap-2 flex-wrap">
              {[
                { value: 'standard',      label: 'Standard' },
                { value: 'thermal100x15', label: 'TVS LP46 Neo' },
                { value: 'a4sheet5x13',   label: 'HP A4 Sheet' },
              ].map((f) => (
                <button key={f.value} onClick={() => setLabelFormat(f.value)}
                  className={`flex-1 py-1.5 px-2 rounded-lg border text-xs font-medium ${labelFormat === f.value ? 'bg-amber-600 text-white border-amber-600' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                  {f.label}
                </button>
              ))}
            </div>
            {labelFormat === 'thermal100x15' && (
              <p className="mt-1.5 text-xs text-slate-500">TVS LP 46 NEO · 100×15 mm label · name+price left · barcode right</p>
            )}
            {labelFormat === 'a4sheet5x13' && (
              <p className="mt-1.5 text-xs text-slate-500">HP Smart Tank 589 · A4 sheet · 5 columns × 13 rows · 1.5×1 inch per label</p>
            )}
          </div>

          {/* Labels per row — hidden for thermal / A4 sheet format */}
          {labelFormat === 'standard' && (
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-2">Labels per row</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4].map((n) => (
                <button key={n} onClick={() => setLabelsPerRow(n)}
                  className={`flex-1 py-1.5 rounded-lg border text-sm font-medium ${labelsPerRow === n ? 'bg-amber-600 text-white border-amber-600' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                  {n}
                </button>
              ))}
            </div>
          </div>
          )}

          {/* Options */}
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input type="checkbox" checked={showName} onChange={(e) => setShowName(e.target.checked)} className="rounded" />
              Product Name
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input type="checkbox" checked={showPrice} onChange={(e) => setShowPrice(e.target.checked)} className="rounded" />
              Price
            </label>
          </div>

          {/* Summary */}
          <div className="bg-slate-50 rounded-lg px-4 py-3 text-xs text-slate-600">
            Total labels to print: <strong className="text-slate-800">{(selectedProducts.length - skippedCount) * copies}</strong>
          </div>

          {/* QZ Tray install note — shown only for TVS LP46 Neo */}
          {labelFormat === 'thermal100x15' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-xs text-blue-700 space-y-1">
              <p><strong>One-time setup for Direct Print:</strong></p>
              <p>1. Download QZ Tray (free, no email needed) →{' '}
                <a href="https://github.com/qzind/tray/releases/latest" target="_blank" rel="noreferrer" className="underline font-semibold text-blue-800">
                  github.com/qzind/tray/releases
                </a>
              </p>
              <p>2. Install it → it runs in system tray (bottom-right taskbar)</p>
              <p>3. Right-click QZ Tray icon → <strong>Preferences</strong> → tick <strong>"Allow unsigned"</strong> → Save</p>
              <p>4. Click <strong>Direct Print</strong> button above — done!</p>
              {qzStatus === 'connecting' && <p className="font-semibold text-blue-800">Connecting to QZ Tray…</p>}
              {qzStatus === 'printing'   && <p className="font-semibold text-green-700">Sending labels to printer…</p>}
              {qzStatus === 'error'      && <p className="font-semibold text-red-600">Could not connect — is QZ Tray running?</p>}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-100 flex-wrap">
          <button onClick={() => setShowDesigner(true)}
            className="flex items-center gap-2 text-sm font-medium text-violet-600 hover:text-violet-800 border border-violet-200 hover:border-violet-400 px-4 py-2 rounded-lg bg-violet-50 hover:bg-violet-100">
            <Palette className="h-4 w-4" /> Design Label
          </button>
          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={onClose} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm">
              Cancel
            </button>
            <button onClick={handleExportBarcode}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
              <Download className="h-4 w-4" /> Export PDF
            </button>
            <button onClick={handleFinalExportExcel}
              className="bg-violet-600 hover:bg-violet-700 text-white px-5 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
              <Download className="h-4 w-4" /> Final Export Excel
            </button>
            {labelFormat === 'thermal100x15' && (
              <button onClick={handleDirectPrintQZ} disabled={qzStatus === 'connecting' || qzStatus === 'printing'}
                className="bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white px-5 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
                <Printer className="h-4 w-4" />
                {qzStatus === 'connecting' ? 'Connecting…' : qzStatus === 'printing' ? 'Printing…' : 'Direct Print'}
              </button>
            )}
            <button onClick={handlePrint}
              className="bg-amber-600 hover:bg-amber-700 text-white px-5 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
              <Printer className="h-4 w-4" /> Print Labels
            </button>
          </div>
        </div>
      </div>
      {showDesigner && <LabelDesignerModal onClose={() => setShowDesigner(false)} />}
    </div>
  )
}

const PER_PAGE = 35

export default function Products() {
  const navigate = useNavigate()
  const [products, setProducts] = useState([])
  const [categoryCounts, setCategoryCounts] = useState({})
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
  const [showDeleteAll, setShowDeleteAll] = useState(false)
  const [deletingAll, setDeletingAll] = useState(false)
  const [showImport,        setShowImport]        = useState(false)
  const [showPriceUpdate,   setShowPriceUpdate]   = useState(false)
  const [showPrintBarcodes, setShowPrintBarcodes] = useState(false)
  const [exporting, setExporting] = useState(false)

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await productAPI.getAll({
        search,
        category_id: categoryFilter || undefined,
        brand_id: brandFilter || undefined,
        page, limit: PER_PAGE,
        is_active: tab === 'active',
        sort_by: 'category',
      })
      setProducts(data.data || data.products || data.results || [])
      setTotalPages(data.pagination?.pages || 1)
      setTotal(data.pagination?.total || 0)
      setCategoryCounts(data.category_counts || {})
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

  const handleExport = async () => {
    setExporting(true)
    try {
      const { data } = await productAPI.getAll({ limit: 5000, is_active: tab === 'active' })
      const rows = data.data || data.products || data.results || []
      const sheetData = rows.map((p) => ({
        'Name': p.name || '',
        'SKU': p.sku || '',
        'Barcode': p.barcode || '',
        'HSN Code': p.hsn_code || '',
        'Category': p.category?.name || p.Category?.name || '',
        'Brand': p.brand?.name || p.Brand?.name || '',
        'Purchase Price (₹)': parseFloat(p.purchase_price || 0),
        'Selling Price (₹)': parseFloat(p.sell_price || p.selling_price || 0),
        'MRP (₹)': parseFloat(p.mrp || 0),
        'Tax Type': p.tax_type || '',
        'Tax Rate (%)': parseFloat(p.tax_rate || 0),
        'Current Stock': parseFloat(p.stock || 0),
        'Min Stock': parseFloat(p.min_stock || 0),
        'Stock Value (₹)': parseFloat((p.stock || 0) * (p.purchase_price || 0)).toFixed(2),
        'Track Inventory': p.track_inventory ? 'Yes' : 'No',
        'Status': p.is_active ? 'Active' : 'Archived',
      }))
      const ws = XLSX.utils.json_to_sheet(sheetData)
      // Auto-width columns
      const colWidths = Object.keys(sheetData[0] || {}).map((k) => ({ wch: Math.max(k.length, 15) }))
      ws['!cols'] = colWidths
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Products')
      XLSX.writeFile(wb, `products_inventory_${new Date().toISOString().split('T')[0]}.xlsx`)
      toast.success(`Exported ${sheetData.length} products`)
    } catch {
      toast.error('Export failed')
    } finally {
      setExporting(false)
    }
  }

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

  const handleDeleteAll = async () => {
    setDeletingAll(true)
    try {
      const { data } = await productAPI.deleteAll()
      toast.success(`All products deleted (${data.data.deleted} removed)`)
      setShowDeleteAll(false)
      fetchProducts()
    } catch {
      toast.error('Failed to delete all products')
    } finally {
      setDeletingAll(false)
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
    setShowPrintBarcodes(true)
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
            onClick={() => setShowPriceUpdate(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm flex items-center gap-1.5"
          >
            <ImageIcon className="h-4 w-4" /> Update Prices from Images
          </button>
          <button
            onClick={() => navigate('/tools/barcode')}
            className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-2 rounded-lg text-sm flex items-center gap-1.5"
          >
            <Barcode className="h-4 w-4" /> Generate Barcodes
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5"
          >
            <Download className="h-4 w-4" /> {exporting ? 'Exporting...' : 'Export Excel'}
          </button>
          <button
            onClick={() => setShowDeleteAll(true)}
            className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5"
          >
            <Trash2 className="h-4 w-4" /> Delete All
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
            className="bg-slate-500 hover:bg-slate-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            Reset
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
                  <th className="px-3 py-3 text-center w-8">Sr.</th>
                  <th className="px-3 py-3 text-left w-10">Image</th>
                  <th className="px-3 py-3 text-left">Name</th>
                  <th className="px-3 py-3 text-right">Cost Price</th>
                  <th className="px-3 py-3 text-right">MRP</th>
                  <th className="px-3 py-3 text-right">Sell Price</th>
                  <th className="px-3 py-3 text-center">Disc %</th>
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
                {(() => {
                  const rows = []
                  let lastCategory = null
                  products.forEach((p, pIdx) => {
                    const catName = p.Category?.name || p.category_name || 'Uncategorised'
                    if (catName !== lastCategory) {
                      lastCategory = catName
                      rows.push(
                        <tr key={`cat-${catName}`} className="bg-amber-50 border-b border-amber-100">
                          <td colSpan={15} className="px-4 py-1.5 text-xs font-bold text-amber-700 uppercase tracking-wider flex items-center gap-2">
                            {catName}
                            <span className="font-normal text-amber-500 normal-case">({categoryCounts[catName]} product{categoryCounts[catName] !== 1 ? 's' : ''})</span>
                          </td>
                        </tr>
                      )
                    }
                    const isLow = p.stock != null && p.min_stock != null && parseFloat(p.stock) < parseFloat(p.min_stock)
                    rows.push(
                    <tr key={p.id} className={`border-b hover:bg-slate-50 ${selected.includes(p.id) ? 'bg-amber-50' : ''}`}>
                      <td className="px-3 py-2 text-center">
                        <input type="checkbox" checked={selected.includes(p.id)} onChange={() => toggleSelect(p.id)} className="rounded" />
                      </td>
                      <td className="px-3 py-2 text-center text-xs text-slate-400 font-medium">{startRow + pIdx}</td>
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
                      <td className="px-3 py-2 text-center">
                        {parseFloat(p.discount_per) > 0 ? (
                          <span className="inline-block bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded">
                            {parseFloat(p.discount_per)}%
                          </span>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center font-mono text-xs text-slate-600">{p.sku || '-'}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`font-semibold ${isLow ? 'text-red-600' : 'text-slate-800'}`}>
                          {p.stock ?? '-'}
                        </span>
                        {isLow && <AlertTriangle className="h-3 w-3 text-red-500 inline ml-1" />}
                      </td>
                      <td className="px-3 py-2 text-center font-mono text-xs text-slate-600">{p.barcode || '-'}</td>
                      <td className="px-3 py-2 text-slate-600 text-xs">{catName}</td>
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
                  })
                  return rows
                })()}
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

      {/* Print Barcodes Modal */}
      {showPrintBarcodes && (
        <PrintBarcodesModal
          products={products}
          selectedIds={selected}
          onClose={() => setShowPrintBarcodes(false)}
        />
      )}

      {/* Import Modal */}
      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onSuccess={() => { fetchProducts() }}
        />
      )}

      {/* Price Update from Images Modal */}
      {showPriceUpdate && (
        <PriceUpdateModal
          products={products}
          onClose={() => setShowPriceUpdate(false)}
          onSuccess={() => { fetchProducts(); setShowPriceUpdate(false) }}
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

      {/* Delete All Confirmation Modal */}
      {showDeleteAll && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 shadow-xl w-full max-w-sm mx-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800">Delete All Products?</h3>
                <p className="text-sm text-slate-500">This will permanently delete <strong>all {total} products</strong>. This cannot be undone.</p>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setShowDeleteAll(false)}
                disabled={deletingAll}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAll}
                disabled={deletingAll}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {deletingAll ? <LoadingSpinner size="sm" /> : <Trash2 className="h-4 w-4" />}
                {deletingAll ? 'Deleting...' : 'Yes, Delete All'}
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
