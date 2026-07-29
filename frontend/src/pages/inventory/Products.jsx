import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
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
import { productAPI, categoryAPI, brandAPI, settingsAPI } from '../../api'
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

// CSV column headers for sample download
const CSV_HEADER = 'name,bar_code,hsn_code,sell_price,mrp,cost_price,wholesale_price,sku,categories,brand,stock_qty,opening_stock,min_stock,tax_type,tax_rate,discount,description,notes'

const SAMPLE_CSV = [
  CSV_HEADER,
  'B8BPOE01,BPOE01,7117,2800,2800,933.33,,B8BPOE01,BLK PLSH CZ EARRING,MyBrand,2,2,1,inclusive_tax,3,0,Elegant earring,',
  'B8BPOE02,BPOE02,7117,1200,1200,400,,,BLK PLSH CZ EARRING,,1,1,0,inclusive_tax,3,0,,',
  'MyProduct01,MYBAR001,1234,500,600,350,480,SKU-001,MY CATEGORY,BrandName,10,10,2,inclusive_tax,5,5,Sample product,Some note',
].join('\n')

// Parse one CSV row object → Product model payload
// Accepts many common column name variations so imports from different sources work
const csvRowToProduct = (row) => {
  const rawTaxType = (row.tax_type || '').trim().toLowerCase()
  const taxType = rawTaxType.includes('exclusive') ? 'exclusive' : 'inclusive'

  const rawDiscount = row.discount_per ?? row['discount%'] ?? row.discount ?? ''
  const discountPer = parseFloat(rawDiscount) || 0

  const str = (v) => (v || '').trim()

  return {
    name:            str(row.name)                                                                              || undefined,
    sku:             str(row.sku)                                                                               || undefined,
    barcode:         str(row.bar_code    || row.barcode    || row.barcode_no    || row.code)                   || undefined,
    hsn_code:        str(row.hsn_code   || row.hsn)                                                            || undefined,
    description:     str(row.description || row.desc      || row.product_description)                          || undefined,
    sale_price:      parseFloat(row.sell_price   || row.sale_price   || row.selling_price  || row.price)       || 0,
    mrp:             parseFloat(row.mrp          || row.max_price    || row.maximum_retail_price)               || 0,
    purchase_price:  parseFloat(row.cost_price   || row.purchase_price || row.cost         || row.buying_price) || 0,
    wholesale_price: parseFloat(row.wholesale_price || row.wholesale)                                          || 0,
    stock:           parseFloat(row.stock_qty    || row.stock  || row.quantity || row.qty  || row.current_stock) || 0,
    opening_stock:   parseFloat(row.opening_stock || row.opening_qty)                                          || 0,
    min_stock:       parseFloat(row.min_stock    || row.minimum_stock || row.reorder_level || row.alert_qty)   || 0,
    max_stock:       parseFloat(row.max_stock    || row.maximum_stock) || undefined,
    tax_type:        taxType,
    tax_rate:        parseFloat(row.tax_rate     || row['tax rate']   || row.gst  || row.gst_rate || row['gst%']) || 3,
    discount_per:    discountPer,
    notes:           str(row.notes  || row.remarks)                                                             || undefined,
    category_name:   str(row.category || row.categories || row.category_name)                                   || undefined,
    brand_name:      str(row.brand  || row.brand_name)                                                          || undefined,
    // _photo is used for image matching; stripped before sending to backend
    _photo:          str(row.photo  || row.image || row.image_url),
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
              <strong>Required:</strong> name &nbsp;·&nbsp; <strong>Supported:</strong> bar_code / barcode, categories, brand, hsn_code, sell_price / price, mrp, cost_price / cost, wholesale_price, stock_qty / stock / qty, opening_stock, min_stock, tax_rate / gst, discount, description, notes
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
                      {['Name','Category','Brand','Barcode','Sell Price','Cost Price','MRP','Disc%','Stock','GST%','Image'].map((h) => (
                        <th key={h} className="px-3 py-2 text-left text-slate-500 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 20).map((row, i) => {
                      const hasImg = !!findImageForRow(row._photo, row.barcode, row.sku)
                      const imgPrice = imagePriceMap[(row.barcode || '').toLowerCase()]
                      return (
                        <tr key={i} className="border-t border-slate-100 hover:bg-slate-50">
                          <td className="px-3 py-1.5 text-gray-400">{i + 1}</td>
                          <td className="px-3 py-1.5 font-medium text-slate-800 max-w-[140px] truncate">{row.name || <span className="text-red-400">MISSING</span>}</td>
                          <td className="px-3 py-1.5 text-slate-600 text-xs max-w-[100px] truncate">{row.category_name || '-'}</td>
                          <td className="px-3 py-1.5 text-slate-500 text-xs truncate">{row.brand_name || '-'}</td>
                          <td className="px-3 py-1.5 font-mono text-slate-500">{row.barcode || '-'}</td>
                          <td className="px-3 py-1.5 text-slate-700">
                            {row.sale_price > 0
                              ? `₹${row.sale_price}`
                              : imgPrice
                                ? <span className="text-blue-600 font-medium">₹{imgPrice} <span className="text-xs text-blue-400">(img)</span></span>
                                : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-3 py-1.5 text-slate-600">{row.purchase_price > 0 ? `₹${row.purchase_price}` : <span className="text-gray-300">—</span>}</td>
                          <td className="px-3 py-1.5 text-slate-700">
                            {row.mrp > 0
                              ? `₹${row.mrp}`
                              : imgPrice
                                ? <span className="text-blue-600 font-medium">₹{imgPrice} <span className="text-xs text-blue-400">(img)</span></span>
                                : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-3 py-1.5 text-center">
                            {parseFloat(row.discount_per) > 0
                              ? <span className="bg-green-100 text-green-700 text-xs font-bold px-1.5 py-0.5 rounded">{row.discount_per}%</span>
                              : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-3 py-1.5 text-slate-600">{row.stock > 0 ? row.stock : <span className="text-gray-300">—</span>}</td>
                          <td className="px-3 py-1.5 text-slate-600">{row.tax_rate}%</td>
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
                      <tr><td colSpan={12} className="px-3 py-2 text-center text-gray-400 text-xs">...and {rows.length - 20} more rows</td></tr>
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
    JsBarcode(canvas, text, { format: 'CODE128', width: 2.2, height: 60, displayValue: false, margin: 6 })
    return canvas.toDataURL('image/png')
  } catch {
    return null
  }
}

// Barcode for 100×15mm thermal label — 25×10mm barcode area
const generateThermalBarcodeDataUrl = (text) => {
  try {
    const canvas = document.createElement('canvas')
    JsBarcode(canvas, text, { format: 'CODE128', width: 2.2, height: 80, displayValue: false, margin: 2 })
    return canvas.toDataURL('image/png')
  } catch {
    return null
  }
}

// ── Label constants — 100×15mm at 203 DPI = 800×120 dots ───────────────────
const LABEL_W = 800
const LABEL_H = 120
const DESIGNER_SCALE = 0.75        // 600×90 px on screen
const RIGHT_MARGIN   = 48          // 6mm non-printable right edge

// Jewellery-optimised default: left 50mm blank (tag string), right 50mm content
// Safe print zone: x 400–752 (352 dots = 44mm)
// Barcode: 25mm wide (200 dots) × 10mm tall (80 dots) at 203 DPI
// Price + code centred in right half just above barcode (y=4); name hidden by default
// Right half: x=400–800 (400 dots). Price≈56 dots + gap 8 + code≈64 dots = 128 dots → start x=536
const DEFAULT_LABEL_TEMPLATE = {
  name:    { x: 400, y: 4,  w: 175, h: 14, fontSize: 8,  bold: false, show: false },
  price:   { x: 536, y: 4,  w: 110, h: 14, fontSize: 8,  bold: true,  show: true  },
  barcode: { x: 500, y: 20, w: 220, h: 80, show: true },
  code:    { x: 600, y: 4,  w: 200, h: 14, fontSize: 8,  bold: false, show: true  },
}

const EL_COLORS = {
  name:    { bg: 'rgba(59,130,246,0.18)',  border: '#3b82f6' },
  price:   { bg: 'rgba(16,185,129,0.18)', border: '#10b981' },
  barcode: { bg: 'rgba(245,158,11,0.18)', border: '#f59e0b' },
  code:    { bg: 'rgba(139,92,246,0.18)', border: '#8b5cf6' },
}
const EL_LABELS = { name: 'Product Name', price: 'Price', barcode: 'Barcode', code: 'Code Text' }

// Map CSS fontSize → TSPL font number
function tsplFont(fs) {
  if (fs <= 8)  return '0'
  if (fs <= 10) return '1'
  if (fs <= 14) return '2'
  if (fs <= 20) return '3'
  return '4'
}

// Build TSPL commands for TVS LP46 Neo
function buildTSPL(name, barcodeText, price, qty, tpl) {
  if (!tpl) tpl = DEFAULT_LABEL_TEMPLATE
  const safeName = String(name).replace(/"/g, "'").substring(0, 22)
  const safeCode = String(barcodeText).replace(/"/g, "'")
  const priceStr = `Rs.${parseFloat(price).toFixed(0)}`
  // SET TEAR ON advances the last printed label to the tear position instead of
  // leaving it held under the print head — fixes the "prints one less" symptom
  // on gap-sensing thermal printers. Only affects the raw TSPL print path.
  const lines = ['SIZE 100 mm,15 mm','GAP 2 mm,0 mm','DIRECTION 1','SET TEAR ON','REFERENCE 0,0','SPEED 2','DENSITY 15','CLS']
  if (tpl.name.show)    lines.push(`TEXT ${tpl.name.x},${tpl.name.y},"${tsplFont(tpl.name.fontSize)}",0,1,1,"${safeName}"`)
  if (tpl.price.show)   lines.push(`TEXT ${tpl.price.x},${tpl.price.y},"${tsplFont(tpl.price.fontSize)}",0,1,1,"${priceStr}"`)
  if (tpl.barcode.show) lines.push(`BARCODE ${tpl.barcode.x},${tpl.barcode.y},"128",${Math.max(40, tpl.barcode.h)},0,0,2.2,4.4,"${safeCode}"`)
  // Always print barcode serial number as readable text below bars — never suppress even if code.show is false in saved template
  lines.push(`TEXT ${tpl.code.x},${tpl.code.y},"${tsplFont(tpl.code.fontSize)}",0,1,1,"${safeCode}"`)
  lines.push(`PRINT ${qty},1`)
  return lines.join('\r\n')
}

function mergeTpl(saved) {
  return {
    name:    { ...DEFAULT_LABEL_TEMPLATE.name,    ...saved?.name },
    price:   { ...DEFAULT_LABEL_TEMPLATE.price,   ...saved?.price },
    barcode: { ...DEFAULT_LABEL_TEMPLATE.barcode, ...saved?.barcode },
    code:    { ...DEFAULT_LABEL_TEMPLATE.code,    ...saved?.code },
  }
}

// ── Label Designer Modal ──────────────────────────────────────────────────────
function LabelDesignerModal({ onClose, product, onSaved }) {
  const [tpl, setTpl]   = useState(DEFAULT_LABEL_TEMPLATE)
  const [sel, setSel]   = useState('barcode')
  const [drag, setDrag] = useState(null)
  const [saving, setSaving] = useState(false)
  const canvasRef      = useRef(null)
  const previewRef     = useRef(null)

  // Real product data — never sample data
  const realName    = product?.name    || '—'
  const realPrice   = `Rs.${parseFloat(product?.sell_price || product?.sale_price || product?.mrp || 0).toFixed(0)}`
  const realBarcode = product?.barcode || product?.sku || ''
  const realBarcodeImg = useMemo(() => realBarcode ? generateThermalBarcodeDataUrl(realBarcode) : null, [realBarcode])

  // Load saved template from DB on open
  useEffect(() => {
    localStorage.removeItem('kavipushp_label_tpl')
    settingsAPI.getSettings().then(res => {
      const raw = res.data?.data?.label_template
      if (raw) { try { setTpl(mergeTpl(typeof raw === 'string' ? JSON.parse(raw) : raw)) } catch {} }
    }).catch(() => {})
  }, [])

  // Draw PREVIEW with real product data — uses 0.5 scale to fit right panel
  const PREV_SCALE = 0.5
  useEffect(() => {
    const canvas = previewRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const S = PREV_SCALE
    const W = canvas.width, H = canvas.height

    const draw = () => {
      ctx.clearRect(0, 0, W, H)
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, W, H)
      ctx.strokeStyle = '#cbd5e1'
      ctx.lineWidth = 1
      ctx.strokeRect(0.5, 0.5, W - 1, H - 1)
      ctx.textBaseline = 'top'
      if (tpl.name.show) {
        ctx.fillStyle = '#000'
        ctx.font = `${tpl.name.bold ? 'bold ' : ''}${Math.round(tpl.name.fontSize * S)}px Arial,sans-serif`
        ctx.fillText(realName, tpl.name.x * S, tpl.name.y * S)
      }
      if (tpl.price.show) {
        ctx.fillStyle = '#000'
        ctx.font = `${tpl.price.bold ? 'bold ' : ''}${Math.round(tpl.price.fontSize * S)}px Arial,sans-serif`
        ctx.fillText(realPrice, tpl.price.x * S, tpl.price.y * S)
      }
      if (tpl.code.show) {
        ctx.fillStyle = '#000'
        ctx.font = `${Math.round(tpl.code.fontSize * S)}px Courier New,monospace`
        ctx.fillText(realBarcode, tpl.code.x * S, tpl.code.y * S)
      }
    }
    draw()
    if (tpl.barcode.show && realBarcodeImg) {
      const img = new Image()
      img.onload = () => { draw(); ctx.drawImage(img, tpl.barcode.x * S, tpl.barcode.y * S, tpl.barcode.w * S, tpl.barcode.h * S) }
      img.src = realBarcodeImg
    }
  }, [tpl, realName, realPrice, realBarcode, realBarcodeImg])

  const update = (key, prop, val) => setTpl(t => ({ ...t, [key]: { ...t[key], [prop]: val } }))

  const onElMouseDown = (e, key) => {
    e.preventDefault(); setSel(key)
    const rect = canvasRef.current.getBoundingClientRect()
    setDrag({ key, sx: e.clientX - rect.left, sy: e.clientY - rect.top, ox: tpl[key].x, oy: tpl[key].y })
  }
  const onMouseMove = (e) => {
    if (!drag) return
    const rect = canvasRef.current.getBoundingClientRect()
    const el = tpl[drag.key]
    const nx = Math.max(0, Math.min(LABEL_W - RIGHT_MARGIN - el.w, drag.ox + ((e.clientX - rect.left) - drag.sx) / DESIGNER_SCALE))
    const ny = Math.max(0, Math.min(LABEL_H - el.h, drag.oy + ((e.clientY - rect.top) - drag.sy) / DESIGNER_SCALE))
    setTpl(t => ({ ...t, [drag.key]: { ...t[drag.key], x: Math.round(nx), y: Math.round(ny) } }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await settingsAPI.updateSettings({ label_template: JSON.stringify(tpl) })
      toast.success('Label design saved to database!')
      onSaved && onSaved(tpl)
      onClose()
    } catch { toast.error('Save failed. Try again.') }
    finally { setSaving(false) }
  }

  const handleReset = () => { setTpl({ ...DEFAULT_LABEL_TEMPLATE }); toast.success('Reset to default') }

  const sampleBarcodeImg = useMemo(() => generateThermalBarcodeDataUrl('1234567890'), [])

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl shadow-2xl flex flex-col" style={{ width: 940 }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-slate-100">
          <div>
            <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
              <Palette className="h-4 w-4 text-violet-500" /> Label Designer — 100×15 mm
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">TVS LP46 Neo · 203 DPI · Drag elements to reposition · Preview shows real product data</p>
          </div>
          <button onClick={onClose}><X className="h-5 w-5 text-slate-400 hover:text-slate-600" /></button>
        </div>

        <div className="flex gap-0">

          {/* Left — Design canvas + properties */}
          <div className="flex flex-col p-5 border-r border-slate-100" style={{ width: 480 }}>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Layout Editor — drag to reposition</p>

            {/* Canvas */}
            <div
              ref={canvasRef}
              style={{ width: Math.round(LABEL_W * DESIGNER_SCALE), height: Math.round(LABEL_H * DESIGNER_SCALE), position: 'relative', background: '#fff', border: '2px solid #cbd5e1', userSelect: 'none', cursor: drag ? 'grabbing' : 'default', flexShrink: 0 }}
              onMouseMove={onMouseMove}
              onMouseUp={() => setDrag(null)}
              onMouseLeave={() => setDrag(null)}
            >
              {/* Grid */}
              {Array.from({ length: 7 }, (_, i) => (
                <div key={`v${i}`} style={{ position: 'absolute', left: (i + 1) * 100 * DESIGNER_SCALE, top: 0, width: 1, height: '100%', background: '#f1f5f9' }} />
              ))}
              <div style={{ position: 'absolute', top: 60 * DESIGNER_SCALE, left: 0, height: 1, width: '100%', background: '#f1f5f9' }} />
              {/* Right margin */}
              <div style={{ position: 'absolute', left: Math.round((LABEL_W - RIGHT_MARGIN) * DESIGNER_SCALE), top: 0, width: 1, height: '100%', borderLeft: '1px dashed #ef4444', opacity: 0.6, pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', right: 0, top: 0, width: Math.round(RIGHT_MARGIN * DESIGNER_SCALE), height: '100%', background: 'rgba(239,68,68,0.06)', pointerEvents: 'none' }} />
              {/* Mid-label guide (left 50mm / right 50mm split) */}
              <div style={{ position: 'absolute', left: Math.round(400 * DESIGNER_SCALE), top: 0, width: 1, height: '100%', borderLeft: '1px dashed #94a3b8', opacity: 0.5, pointerEvents: 'none' }} />

              {/* Draggable elements */}
              {['name', 'price', 'barcode', 'code'].map(key => {
                const el = tpl[key]; if (!el.show) return null
                const isSel = sel === key; const c = EL_COLORS[key]
                return (
                  <div key={key} onMouseDown={e => onElMouseDown(e, key)}
                    style={{
                      position: 'absolute',
                      left: Math.round(el.x * DESIGNER_SCALE), top: Math.round(el.y * DESIGNER_SCALE),
                      width: Math.round(el.w * DESIGNER_SCALE), height: Math.round(el.h * DESIGNER_SCALE),
                      background: isSel ? c.bg.replace('0.18','0.35') : c.bg,
                      border: `${isSel ? 2 : 1}px ${isSel ? 'solid' : 'dashed'} ${c.border}`,
                      cursor: 'grab', overflow: 'hidden', display: 'flex', alignItems: 'center', boxSizing: 'border-box', borderRadius: 2,
                    }}>
                    {key === 'barcode'
                      ? (sampleBarcodeImg ? <img src={sampleBarcodeImg} style={{ width: '100%', height: '100%', objectFit: 'fill' }} draggable={false} /> : <span style={{ fontSize: 7, color: '#aaa', width: '100%', textAlign: 'center' }}>Barcode</span>)
                      : <span style={{ fontSize: Math.min(el.fontSize, 9), fontWeight: el.bold ? 'bold' : 'normal', whiteSpace: 'nowrap', paddingLeft: 2, color: c.border, lineHeight: 1 }}>{EL_LABELS[key]}</span>
                    }
                  </div>
                )
              })}
            </div>

            {/* Legend */}
            <div className="flex gap-2 mt-2 flex-wrap">
              {['name','price','barcode','code'].map(key => (
                <button key={key} onClick={() => setSel(key)}
                  className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded border transition-colors ${sel === key ? 'font-semibold' : 'text-slate-500'}`}
                  style={{ borderColor: EL_COLORS[key].border, background: sel === key ? EL_COLORS[key].bg : 'transparent', color: sel === key ? EL_COLORS[key].border : '' }}>
                  <span style={{ width: 7, height: 7, borderRadius: 2, background: EL_COLORS[key].border, display: 'inline-block' }} />
                  {EL_LABELS[key]}
                </button>
              ))}
            </div>

            {/* Compact properties table */}
            <div className="mt-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Properties</p>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="text-left px-2 py-1 font-semibold text-slate-400 border border-slate-200">Element</th>
                    <th className="text-center px-1 py-1 font-semibold text-slate-400 border border-slate-200">Show</th>
                    <th className="text-center px-1 py-1 font-semibold text-slate-400 border border-slate-200">X</th>
                    <th className="text-center px-1 py-1 font-semibold text-slate-400 border border-slate-200">Y</th>
                    <th className="text-center px-1 py-1 font-semibold text-slate-400 border border-slate-200">W/Size</th>
                    <th className="text-center px-1 py-1 font-semibold text-slate-400 border border-slate-200">H/Bold</th>
                  </tr>
                </thead>
                <tbody>
                  {['name','price','barcode','code'].map(key => {
                    const el = tpl[key]; const isSel = sel === key; const c = EL_COLORS[key]
                    return (
                      <tr key={key} onClick={() => setSel(key)} className="cursor-pointer"
                        style={{ background: isSel ? c.bg : 'transparent' }}>
                        <td className="px-2 py-1 border border-slate-200 font-semibold text-xs" style={{ color: c.border }}>
                          <span className="flex items-center gap-1">
                            <span style={{ width: 6, height: 6, borderRadius: 1, background: c.border, display: 'inline-block' }} />
                            {EL_LABELS[key]}
                          </span>
                        </td>
                        <td className="px-1 py-1 border border-slate-200 text-center">
                          <input type="checkbox" checked={el.show} onChange={e => { e.stopPropagation(); update(key,'show',e.target.checked) }} onClick={e => e.stopPropagation()} />
                        </td>
                        <td className="px-1 py-1 border border-slate-200">
                          <input type="number" value={el.x} min={0} max={LABEL_W} onChange={e => update(key,'x',+e.target.value)} onClick={e => e.stopPropagation()} className="w-14 border border-slate-200 rounded px-1 py-0.5 text-center text-xs" />
                        </td>
                        <td className="px-1 py-1 border border-slate-200">
                          <input type="number" value={el.y} min={0} max={LABEL_H} onChange={e => update(key,'y',+e.target.value)} onClick={e => e.stopPropagation()} className="w-10 border border-slate-200 rounded px-1 py-0.5 text-center text-xs" />
                        </td>
                        <td className="px-1 py-1 border border-slate-200">
                          {key === 'barcode'
                            ? <input type="number" value={el.w} min={20} max={LABEL_W} onChange={e => update(key,'w',+e.target.value)} onClick={e => e.stopPropagation()} className="w-14 border border-slate-200 rounded px-1 py-0.5 text-center text-xs" />
                            : <input type="number" value={el.fontSize} min={6} max={28} onChange={e => update(key,'fontSize',+e.target.value)} onClick={e => e.stopPropagation()} className="w-14 border border-slate-200 rounded px-1 py-0.5 text-center text-xs" />
                          }
                        </td>
                        <td className="px-1 py-1 border border-slate-200 text-center">
                          {key === 'barcode'
                            ? <input type="number" value={el.h} min={10} max={LABEL_H} onChange={e => update(key,'h',+e.target.value)} onClick={e => e.stopPropagation()} className="w-10 border border-slate-200 rounded px-1 py-0.5 text-center text-xs" />
                            : <input type="checkbox" checked={el.bold || false} onChange={e => { e.stopPropagation(); update(key,'bold',e.target.checked) }} onClick={e => e.stopPropagation()} />
                          }
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <p className="text-xs text-slate-400 mt-1">W/Size = Width (barcode) or Font size (text) · H/Bold = Height or Bold</p>
            </div>
          </div>

          {/* Right — Live preview with REAL product data */}
          <div className="flex flex-col p-5 flex-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Live Preview — real product data
            </p>

            <canvas
              ref={previewRef}
              width={Math.round(LABEL_W * 0.5)}
              height={Math.round(LABEL_H * 0.5)}
              style={{ border: '2px solid #e2e8f0', borderRadius: 6, background: '#fff', display: 'block', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', width: '100%' }}
            />

            <div className="mt-3 bg-slate-50 rounded-lg p-3 text-xs space-y-1">
              <div className="flex gap-2"><span className="text-slate-400 w-20">Product:</span><span className="font-semibold text-slate-700">{realName}</span></div>
              <div className="flex gap-2"><span className="text-slate-400 w-20">Price:</span><span className="font-semibold text-slate-700">{realPrice}</span></div>
              <div className="flex gap-2"><span className="text-slate-400 w-20">Barcode:</span><span className="font-mono text-slate-700">{realBarcode || <span className="text-red-400">No barcode/SKU on product</span>}</span></div>
            </div>

            <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
              Preview updates live as you drag or change properties. What you see here is exactly what will print.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-100 bg-slate-50 rounded-b-xl">
          <button onClick={handleReset} className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700">
            <RotateCcw className="h-3 w-3" /> Reset to Default
          </button>
          <div className="flex gap-3">
            <button onClick={onClose} className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg text-sm">Cancel</button>
            <button onClick={handleSave} disabled={saving}
              className="bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white px-5 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
              <Palette className="h-4 w-4" /> {saving ? 'Saving…' : 'Save to Database'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}


function PrintBarcodesModal({ products, selectedIds, onClose }) {
  const parseBC = (bc) => {
    const boxM  = bc.match(/^[A-Za-z](\d+)/i)
    const prodM = bc.match(/(\d+)$/)
    return [boxM ? parseInt(boxM[1], 10) : 0, prodM ? parseInt(prodM[1], 10) : 0]
  }
  const selectedProducts = products
    .filter((p) => selectedIds.includes(p.id))
    .sort((a, b) => {
      const [boxA, prodA] = parseBC((a.sku || a.barcode || '').toUpperCase())
      const [boxB, prodB] = parseBC((b.sku || b.barcode || '').toUpperCase())
      return boxA !== boxB ? boxA - boxB : prodA - prodB
    })
  const [copies, setCopies] = useState(1)
  const [labelsPerRow, setLabelsPerRow] = useState(4)
  const [showName, setShowName] = useState(true)
  const [showPrice, setShowPrice] = useState(true)
  const [labelFormat, setLabelFormat] = useState('standard') // 'standard' | 'thermal100x15'
  const [qzStatus, setQzStatus] = useState('idle') // 'idle' | 'connecting' | 'printing' | 'error'
  const [labelTpl, setLabelTpl] = useState(DEFAULT_LABEL_TEMPLATE)
  const [showDesigner, setShowDesigner] = useState(false)

  // Preview: first valid product
  const previewProduct = useMemo(
    () => selectedProducts.find(p => p.barcode || p.sku) || selectedProducts[0],
    [selectedProducts]
  )
  const previewBarcode   = previewProduct?.barcode || previewProduct?.sku || 'SAMPLE'
  const previewName      = previewProduct?.name || 'Product Name'
  const previewPrice     = parseFloat(previewProduct?.sale_price || previewProduct?.sell_price || previewProduct?.mrp || 0).toFixed(0)
  const previewBarcodeUrl = useMemo(() => generateThermalBarcodeDataUrl(previewBarcode), [previewBarcode])

  // Load label template from DB on open
  useEffect(() => {
    localStorage.removeItem('kavipushp_label_tpl')
    settingsAPI.getSettings().then(res => {
      const raw = res.data?.data?.label_template
      if (raw) { try { setLabelTpl(mergeTpl(typeof raw === 'string' ? JSON.parse(raw) : raw)) } catch {} }
    }).catch(() => {})
  }, [])

  const QZ_CERT = `-----BEGIN CERTIFICATE-----
MIIDhzCCAm+gAwIBAgIUBg2wbdE+ysKv0l2ODbPJgjW6hOQwDQYJKoZIhvcNAQEL
BQAwUzEwMC4GA1UEAwwnZnJvbnRlbmQtcHJvZHVjdGlvbi0zNGIwLnVwLnJhaWx3
YXkuYXBwMRIwEAYDVQQKDAlLYXZpUHVzaHAxCzAJBgNVBAYTAklOMB4XDTI2MDYx
MTE2NDg1NVoXDTM2MDYwODE2NDg1NVowUzEwMC4GA1UEAwwnZnJvbnRlbmQtcHJv
ZHVjdGlvbi0zNGIwLnVwLnJhaWx3YXkuYXBwMRIwEAYDVQQKDAlLYXZpUHVzaHAx
CzAJBgNVBAYTAklOMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAxDZn
P9fvqXpbtCa7L4WY3ZdOiKKojo9BL8TIMMALMvNGVDDXNPOrYg1+2URzukAM9CXe
e9Ki5d0bTvmRFY/ChA41fMl0fN3p0KUf4/P+stRY92moc+0rEbDx06Ph6tqeNPuq
Hh/ml0i5AY4KquQ1IiWMKDK/T0jjK6ZE2WLl/Qei/Yv8hA9NBlYcdv+oKEeDSuAw
uoWpV7rTTohaUHyL9qOGOKqhJKqMt/2oIwCFEnx8aT6Jg+eoaaM6UnRwREJPfCWJ
puYrGV+ig5ypEvsnQDWYDHuwEM6bIYEiwF8MO11SounxOdQOF23xM6YJeQ7afo8f
QFtqzCvheL8OX6lMXQIDAQABo1MwUTAdBgNVHQ4EFgQUBBWNcITyel6LCv8x+n3V
3tToMwAwHwYDVR0jBBgwFoAUBBWNcITyel6LCv8x+n3V3tToMwAwDwYDVR0TAQH/
BAUwAwEB/zANBgkqhkiG9w0BAQsFAAOCAQEAiJoe4GfSRfA9bN2uQaucxXgwrOQh
ETYVOHbRMHQoKBpNwOIx7GPMdLbKz46K8/gKOelmdX3P6ckaSrYo/RjqL+78VfrX
7qMLDC3GXpGC3tLzBNGiLbYEYsO5put50jGW3LNKUuXyvvNJLSzQzd9Xq2cQmtsQ
g0Ppq01UG5lmejJbt4RQRFm+mxMcUd/3uBvrZl7BYLZ/0jS6jjaYKlrbVWEVwdAl
z8JCDwZrSdu7Kth2xQrniMQ1Ed8kOpkeoTj1pOLnRjQYb+0og6nGq1klPynbcfW8
ClB10S+xXvkhBB4UqIKLDBDkdq1M+AfWiaUtOuWZaaV6AGZtcoURZqLhEQ==
-----END CERTIFICATE-----`

  const QZ_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDENmc/1++pelu0
JrsvhZjdl06IoqiOj0EvxMgwwAsy80ZUMNc086tiDX7ZRHO6QAz0Jd570qLl3RtO
+ZEVj8KEDjV8yXR83enQpR/j8/6y1Fj3aahz7SsRsPHTo+Hq2p40+6oeH+aXSLkB
jgqq5DUiJYwoMr9PSOMrpkTZYuX9B6L9i/yED00GVhx2/6goR4NK4DC6halXutNO
iFpQfIv2o4Y4qqEkqoy3/agjAIUSfHxpPomD56hpozpSdHBEQk98JYmm5isZX6KD
nKkS+ydANZgMe7AQzpshgSLAXww7XVKi6fE51A4XbfEzpgl5Dtp+jx9AW2rMK+F4
vw5fqUxdAgMBAAECggEAG36iHjykjUOjmQ16WnDmmFqM+zGL3Bov4ME66jXm+9dC
KicD6RwiDmXkug5RBy7VgdrSn9hG0l4W5wyqq3JPKBETpq5WH+86xe11mAxHSwjd
hKHuJHx99gctA+KplC7ZT4RadMk0l0tt/U1JqmO7HFNVngZqb3I/vwyYBjxJDRkn
aGVcciBET8AE/UzPPFtM02tLgLh+N/sDXv3tUWS/ERkgUm68SWN/4fxKL9ugdU08
IINW3r5dLJBU0K+xG0eCFSTT7p7xTqSnh2rRu4/a2dgb1hH2lLNk/nOsDdUNzKh9
7cLcEsCRTuDAsnkvV2Xf5QJ81BT2T6cMjymSC1RLIwKBgQDvMgTtHHLnUKsEoSVW
fP12D/gVu6JFzjENI+oDsoXTzRsm2+5+M2s7OpQwf4g8GmjSJ3adtJREdreEz0/i
gysikt3nZ702CVViilgUiZWXrXkjdxUtCW6V/HEs69/Iq6ACwlg8xMzQ5rKAFFqn
0VvoGYaw8pIObBCZuZAwNzBOIwKBgQDR/1PpdzrDWE1W048Cwt8WCGfgra9xhJHc
vvd6OEUfOXVgjyzRxxc5lik//mgmYHelBfW1+pU42sCEtvbXvPnBjmRxC/83AEqG
//2Bh023HB/iZXyu3AAmGTz+cZNqJmbPY6mOuUdoeDDalcj356QGZiMnlI5LXii9
DrIsHcljfwKBgQDrjJxhS7SzqjLfujlktG19iDhMXpxslaKkSAu5XGKBsufcGpT/
3m7owsUQBWcJmRBEc+xRXXTs/uO2e9k1POqLf4naycQApKxa/9XBU8PmvEQg8rH9
yd4HAbQKArY7jRdj4DK4lS0FQ0ng6ypjPL5/EDQdqKLAZRbr61rcwFxndQKBgCDt
TBb7XvdqTRYkLfRc4eXug3szQKMoCkb2mo9La2st8z2ktX5fHUEmTml+Vo5N6fSy
LojONb+obS9iEOpa8z5qOU2QeAADx6vLT9CTipf/jPBOwXIZhNx0cJ/k5xxp0Q0L
r3Z1jsDOt7pOaiiU5Z8rPK/kFzuyE+kw+Lb6JK25AoGAP8ZowmXvkprYhfBm8nTb
TTuO3LUsza2m+1vRWEnVdFgJNszwjVRyZllS7p0lRODmmRqyDVbrZhfiTMyols0a
aZfTjG2j5ei145MODrbCY7GGX2wpFU4Dw79i3kga2A/RYWLVlGoChAsXku0G16zM
bBQusfbKqlGg61r07k8bA4M=
-----END PRIVATE KEY-----`

  const handleDirectPrintQZ = async () => {
    setQzStatus('connecting')
    try {
      const qzModule = await import('qz-tray')
      const qz = qzModule.default || qzModule

      qz.security.setCertificatePromise((resolve) => resolve(QZ_CERT))
      qz.security.setSignatureAlgorithm('SHA512')
      qz.security.setSignaturePromise((toSign) => (resolve, reject) => {
        try {
          const pemBody = QZ_PRIVATE_KEY.replace(/-----[^-]+-----/g, '').replace(/\s/g, '')
          const binary = atob(pemBody)
          const bytes = new Uint8Array(binary.length)
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
          window.crypto.subtle.importKey('pkcs8', bytes.buffer,
            { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-512' }, false, ['sign'])
            .then((key) => window.crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(toSign)))
            .then((sig) => resolve(btoa(String.fromCharCode(...new Uint8Array(sig)))))
            .catch(reject)
        } catch (err) { reject(err) }
      })

      if (!qz.websocket.isActive()) {
        await qz.websocket.connect()
      }

      // Find TVS LP46 Neo printer — try multiple name variations, never fall back to default
      let printerName = ''
      const tvsNames = ['TVS LP 46 NEO', 'TVS LP46 NEO', 'TVS LP 46 Neo', 'TVS LP46 Neo', 'TVS LP 46', 'TVS LP46', 'TVS']
      for (const candidate of tvsNames) {
        try {
          const found = await qz.printers.find(candidate)
          const match = Array.isArray(found) ? found[0] : found
          if (match) { printerName = match; break }
        } catch { /* not found with this name, try next */ }
      }

      if (!printerName) {
        toast.error('TVS LP 46 NEO printer not found. Make sure it is installed and powered on.')
        setQzStatus('error')
        return
      }

      setQzStatus('printing')
      const config = qz.configs.create(printerName)

      for (const p of selectedProducts) {
        const barcodeText = p.barcode || p.sku || ''
        if (!barcodeText) continue
        const price = p.sale_price || p.sell_price || 0
        const effectiveTpl = {
          ...labelTpl,
          name:  { ...labelTpl.name,  show: labelTpl.name.show  && showName  },
          price: { ...labelTpl.price, show: labelTpl.price.show && showPrice },
        }
        const tspl = buildTSPL(p.name || '', barcodeText, price, copies, effectiveTpl)
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
    const hasTopRow = showName || showPrice
    const cardH = padV + (hasTopRow ? nameH : 0) + imgH + codeH + padV

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

      // Name (left) + Price (right) on same row — only if toggled on
      if (hasTopRow) {
        const textY = cy + nameH - 1
        if (showName) {
          const name = r.name.length > 18 ? r.name.substring(0, 18) + '…' : r.name
          doc.setFontSize(8)
          doc.setFont('helvetica', 'bold')
          doc.setTextColor(0, 0, 0)
          doc.text(name, x + 2, textY)
        }
        if (showPrice) {
          doc.setFontSize(8)
          doc.setFont('helvetica', 'normal')
          doc.setTextColor(0, 0, 0)
          doc.text(`Rs.${r.price.toFixed(0)}`, x + cardW - 2, textY, { align: 'right' })
        }
        cy += nameH
      }

      // Barcode image (half size, full width)
      const imgW = cardW - 4
      doc.addImage(r.imgUrl, 'PNG', x + 2, cy, imgW, imgH)
      cy += imgH

      // Barcode serial number — always shown, larger font for readability
      doc.setFontSize(8)
      doc.setFont('courier', 'bold')
      doc.setTextColor(0, 0, 0)
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

      // Name (top-left of content area) — only if toggled on
      if (showName) {
        ctx.fillStyle = '#000000'
        ctx.font = 'bold 13px Arial, sans-serif'
        const nm = p.name.length > 15 ? p.name.substring(0, 15) + '…' : p.name
        ctx.fillText(nm, cx + 3, 15)
      }

      // Price (top-right of content area) — only if toggled on
      if (showPrice) {
        ctx.font = '12px Arial, sans-serif'
        ctx.fillStyle = '#000000'
        const priceText = `Rs.${price.toFixed(0)}`
        const pw = ctx.measureText(priceText).width
        ctx.fillText(priceText, cx + cw - pw - 2, 15)
      }

      // Barcode image (sharp, full content width)
      try {
        const bc = document.createElement('canvas')
        JsBarcode(bc, barcodeText, { format: 'CODE128', width: 3.3, height: 100, displayValue: false, margin: 3 })
        ctx.drawImage(bc, cx, 18, cw, 58)
      } catch { /* skip */ }

      // Barcode serial number — bold and larger for visibility
      ctx.fillStyle = '#000000'
      ctx.font = 'bold 11px Courier New, monospace'
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

          {/* Label Preview */}
          {previewProduct && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Label Preview — {previewName}</p>

              {/* Standard label preview */}
              {labelFormat === 'standard' && (
                <div className="border border-slate-200 rounded-lg overflow-hidden bg-white" style={{ width: 180 }}>
                  {showName && (
                    <div className="flex justify-between items-center px-2 pt-1.5 pb-0.5">
                      <span className="text-xs font-bold truncate max-w-[100px]" style={{ color: '#000' }}>{previewName.length > 14 ? previewName.slice(0,14)+'…' : previewName}</span>
                      {showPrice && <span className="text-xs font-medium ml-1" style={{ color: '#000' }}>Rs.{previewPrice}</span>}
                    </div>
                  )}
                  {!showName && showPrice && (
                    <div className="px-2 pt-1.5 pb-0.5 text-xs font-medium" style={{ color: '#000' }}>Rs.{previewPrice}</div>
                  )}
                  {previewBarcodeUrl && (
                    <div className="px-2 py-1">
                      <img src={previewBarcodeUrl} alt="barcode" className="w-full" style={{ height: 36, objectFit: 'fill' }} />
                    </div>
                  )}
                  <div className="text-center pb-1.5 font-mono text-xs" style={{ color: '#000' }}>{previewBarcode}</div>
                </div>
              )}

              {/* Thermal 100×15 mm preview — scaled from labelTpl (340px=800dots=100mm) */}
              {labelFormat === 'thermal100x15' && (() => {
                const S = 340 / 800
                const px = (dots) => Math.round(dots * S)
                return (
                  <div className="border-2 border-slate-300 rounded bg-white overflow-hidden relative" style={{ width: 340, height: 51 }}>
                    <div className="absolute top-0 left-0 bottom-0 border-r border-dashed border-slate-300" style={{ width: 170 }} />
                    {showName && labelTpl.name.show && (
                      <span className="absolute" style={{ left: px(labelTpl.name.x), top: px(labelTpl.name.y), fontSize: 6.5, fontWeight: labelTpl.name.bold ? 'bold' : 'normal', maxWidth: px(labelTpl.name.w), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#000' }}>
                        {previewName}
                      </span>
                    )}
                    {showPrice && labelTpl.price.show && (
                      <span className="absolute" style={{ left: px(labelTpl.price.x), top: px(labelTpl.price.y), fontSize: 6.5, color: '#000' }}>Rs.{previewPrice}</span>
                    )}
                    {previewBarcodeUrl && labelTpl.barcode.show && (
                      <img src={previewBarcodeUrl} alt="barcode" style={{ position: 'absolute', left: px(labelTpl.barcode.x), top: px(labelTpl.barcode.y), width: px(labelTpl.barcode.w), height: px(labelTpl.barcode.h), objectFit: 'fill' }} />
                    )}
                    {labelTpl.code.show && (
                      <div className="absolute font-mono" style={{ left: px(labelTpl.code.x), top: px(labelTpl.code.y), fontSize: 5.5, color: '#000' }}>{previewBarcode}</div>
                    )}
                  </div>
                )
              })()}

              {/* A4 sheet preview — shows 3 sample cards in a row */}
              {labelFormat === 'a4sheet5x13' && (
                <div className="flex gap-1">
                  {[0,1,2].map(i => (
                    <div key={i} className="border border-slate-300 rounded bg-white flex flex-col overflow-hidden" style={{ width: 100 }}>
                      <div className="flex justify-between px-1 pt-1">
                        {showName && <span className="text-xs font-bold text-slate-800 truncate" style={{ fontSize: 7, maxWidth: 60 }}>{previewName.slice(0,10)}</span>}
                        {showPrice && <span className="font-medium text-slate-700" style={{ fontSize: 7 }}>Rs.{previewPrice}</span>}
                      </div>
                      {previewBarcodeUrl && (
                        <img src={previewBarcodeUrl} alt="barcode" className="px-1" style={{ height: 22, objectFit: 'fill' }} />
                      )}
                      <div className="text-center font-mono text-slate-700 pb-1" style={{ fontSize: 6 }}>{previewBarcode}</div>
                    </div>
                  ))}
                  <div className="flex items-center text-slate-400 text-xs px-1">…</div>
                </div>
              )}

              <p className="text-xs text-slate-400 mt-1.5">Preview updates as you change format and options above.</p>
            </div>
          )}

          {/* Summary */}
          <div className="bg-slate-50 rounded-lg px-4 py-3 text-xs text-slate-600">
            Total labels to print: <strong className="text-slate-800">{(selectedProducts.length - skippedCount) * copies}</strong>
          </div>

          {qzStatus === 'connecting' && <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-xs text-blue-700 font-semibold">Connecting to QZ Tray…</div>}
          {qzStatus === 'printing'   && <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2 text-xs text-green-700 font-semibold">Sending labels to printer…</div>}
          {qzStatus === 'error'      && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-xs text-red-600 font-semibold">QZ Tray not running — start it from system tray</div>}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-100 flex-wrap">
          <div className="flex items-center gap-2">
            <button onClick={() => setShowDesigner(true)}
              className="flex items-center gap-2 text-sm font-medium text-violet-600 hover:text-violet-800 border border-violet-200 hover:border-violet-400 px-4 py-2 rounded-lg bg-violet-50 hover:bg-violet-100">
              <Palette className="h-4 w-4" /> Design Label
            </button>
            <button onClick={() => {
              settingsAPI.updateSettings({ label_template: JSON.stringify(DEFAULT_LABEL_TEMPLATE) })
                .then(() => { setLabelTpl(DEFAULT_LABEL_TEMPLATE); toast.success('Layout reset: price+code above barcode, name hidden') })
                .catch(() => toast.error('Failed to reset layout'))
            }} className="text-xs text-slate-500 hover:text-slate-700 border border-slate-200 hover:border-slate-400 px-3 py-2 rounded-lg bg-slate-50 hover:bg-slate-100">
              Reset Layout
            </button>
          </div>
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
            <button onClick={handleDirectPrintQZ} disabled={qzStatus === 'connecting' || qzStatus === 'printing'}
              className="bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white px-5 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
              <Printer className="h-4 w-4" />
              {qzStatus === 'connecting' ? 'Connecting…' : qzStatus === 'printing' ? 'Printing…' : 'Direct Print'}
            </button>
          </div>
        </div>
      </div>
      {showDesigner && (
        <LabelDesignerModal
          onClose={() => setShowDesigner(false)}
          product={selectedProducts[0]}
          onSaved={(saved) => setLabelTpl(saved)}
        />
      )}
    </div>
  )
}

const PER_PAGE = 35

// ── Bulk Edit ─────────────────────────────────────────────────────────
// Columns shown in the bulk-edit grid. `type` drives both the input and how
// values are normalised for change-detection.
const BULK_FIELDS = [
  { key: 'name',           label: 'Name',    type: 'text',     w: 'min-w-[170px]' },
  { key: 'category_id',    label: 'Category',type: 'category', w: 'min-w-[140px]' },
  { key: 'purchase_price', label: 'Cost',    type: 'number',   w: 'w-24' },
  { key: 'mrp',            label: 'MRP',     type: 'number',   w: 'w-24' },
  { key: 'sale_price',     label: 'Sell',    type: 'number',   w: 'w-24' },
  { key: 'discount_per',   label: 'Disc %',  type: 'number',   w: 'w-20' },
  { key: 'tax_rate',       label: 'Tax %',   type: 'number',   w: 'w-20' },
  { key: 'sku',            label: 'SKU',     type: 'text',     w: 'w-28' },
  { key: 'barcode',        label: 'Barcode', type: 'text',     w: 'w-28' },
  { key: 'stock',          label: 'Stock',   type: 'number',   w: 'w-20' },
  { key: 'min_stock',      label: 'Min',     type: 'number',   w: 'w-20' },
]

const bulkFieldFrom = (p) => {
  const row = { id: p.id }
  for (const f of BULK_FIELDS) {
    if (f.key === 'category_id') row[f.key] = p.category_id ?? p.category?.id ?? p.Category?.id ?? ''
    else row[f.key] = p[f.key] == null ? '' : String(p[f.key])
  }
  return row
}

// Normalise a cell value so "3" and "3.00" (etc.) compare equal.
const normBulk = (type, v) => {
  if (type === 'number') return String(parseFloat(v) || 0)
  return (v ?? '').toString().trim()
}

function BulkEditModal({ products, selectedIds, categories, onClose, onSuccess }) {
  const initial = useMemo(
    () => products.filter((p) => selectedIds.includes(p.id)).map(bulkFieldFrom),
    [products, selectedIds]
  )
  const [rows, setRows] = useState(initial)
  const [quickField, setQuickField] = useState('discount_per')
  const [quickValue, setQuickValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [progress, setProgress] = useState(0)

  const setCell = (id, key, value) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [key]: value } : r)))

  const applyToAll = () => {
    setRows((rs) => rs.map((r) => ({ ...r, [quickField]: quickValue })))
    const f = BULK_FIELDS.find((x) => x.key === quickField)
    toast.success(`Set ${f?.label || quickField} on all ${rows.length} rows`)
  }

  const handleSave = async () => {
    // Validate: name can't be blanked
    if (rows.some((r) => !normBulk('text', r.name))) {
      return toast.error('Product name cannot be empty')
    }
    // Build a per-row payload of only the fields that actually changed
    const orig = Object.fromEntries(initial.map((r) => [r.id, r]))
    const jobs = []
    for (const r of rows) {
      const o = orig[r.id]
      const payload = {}
      for (const f of BULK_FIELDS) {
        if (normBulk(f.type, r[f.key]) !== normBulk(f.type, o[f.key])) {
          if (f.type === 'number') payload[f.key] = parseFloat(r[f.key]) || 0
          else if (f.key === 'category_id') payload[f.key] = r[f.key] || null
          else payload[f.key] = (r[f.key] ?? '').toString().trim()
        }
      }
      if (Object.keys(payload).length) jobs.push({ id: r.id, payload })
    }
    if (!jobs.length) return toast('No changes to save', { icon: 'ℹ️' })

    setSaving(true)
    setProgress(0)
    let ok = 0
    let fail = 0
    for (const job of jobs) {
      try {
        await productAPI.update(job.id, job.payload)
        ok++
      } catch {
        fail++
      }
      setProgress(Math.round(((ok + fail) / jobs.length) * 100))
    }
    setSaving(false)
    if (fail) toast.error(`${ok} updated, ${fail} failed`)
    else toast.success(`${ok} product${ok !== 1 ? 's' : ''} updated`)
    onSuccess()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
          <div>
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <Edit2 className="h-4 w-4 text-amber-600" /> Bulk Edit Products
            </h3>
            <p className="text-xs text-slate-500">{rows.length} product{rows.length !== 1 ? 's' : ''} selected — edit inline, then Save All</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Quick fill */}
        <div className="flex items-center gap-2 px-5 py-2.5 bg-amber-50 border-b border-amber-100 flex-wrap">
          <span className="text-xs font-medium text-amber-700">Quick fill:</span>
          <select
            value={quickField}
            onChange={(e) => setQuickField(e.target.value)}
            className="border border-amber-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/30"
          >
            {BULK_FIELDS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
          </select>
          {quickField === 'category_id' ? (
            <select
              value={quickValue}
              onChange={(e) => setQuickValue(e.target.value)}
              className="border border-amber-200 rounded-lg px-2 py-1.5 text-sm bg-white min-w-[150px] focus:outline-none focus:ring-2 focus:ring-amber-500/30"
            >
              <option value="">— none —</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          ) : (
            <input
              type={BULK_FIELDS.find((f) => f.key === quickField)?.type === 'number' ? 'number' : 'text'}
              value={quickValue}
              onChange={(e) => setQuickValue(e.target.value)}
              placeholder="Value for all rows"
              className="border border-amber-200 rounded-lg px-2 py-1.5 text-sm bg-white w-44 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
            />
          )}
          <button
            onClick={applyToAll}
            className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium"
          >
            Apply to all
          </button>
        </div>

        {/* Grid */}
        <div className="overflow-auto flex-1">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase sticky top-0 z-10">
              <tr>
                <th className="px-2 py-2 text-center w-10">Sr.</th>
                {BULK_FIELDS.map((f) => (
                  <th key={f.key} className="px-2 py-2 text-left whitespace-nowrap">{f.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50/60">
                  <td className="px-2 py-1.5 text-center text-xs text-slate-400">{i + 1}</td>
                  {BULK_FIELDS.map((f) => (
                    <td key={f.key} className="px-2 py-1.5">
                      {f.type === 'category' ? (
                        <select
                          value={r[f.key] || ''}
                          onChange={(e) => setCell(r.id, f.key, e.target.value)}
                          className={`border border-slate-200 rounded px-1.5 py-1 text-sm w-full ${f.w} focus:outline-none focus:ring-2 focus:ring-amber-500/30`}
                        >
                          <option value="">—</option>
                          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      ) : (
                        <input
                          type={f.type === 'number' ? 'number' : 'text'}
                          value={r[f.key]}
                          onChange={(e) => setCell(r.id, f.key, e.target.value)}
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

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100">
          <span className="text-xs text-slate-400">
            {saving ? `Saving… ${progress}%` : 'Only changed rows are sent to the server.'}
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              disabled={saving}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-60"
            >
              {saving ? <LoadingSpinner size="sm" /> : <CheckCircle className="h-4 w-4" />}
              {saving ? 'Saving…' : 'Save All'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Products() {
  const navigate = useNavigate()
  const [products, setProducts] = useState([])
  const [boxCounts, setBoxCounts] = useState({})
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
  const [showBulkEdit, setShowBulkEdit] = useState(false)
  const [showDeleteAll, setShowDeleteAll] = useState(false)
  const [deletingAll, setDeletingAll] = useState(false)
  const [showImport,        setShowImport]        = useState(false)
  const [showPriceUpdate,   setShowPriceUpdate]   = useState(false)
  const [showPrintBarcodes, setShowPrintBarcodes] = useState(false)
  const [rangeFrom,   setRangeFrom]   = useState('')
  const [rangeTo,     setRangeTo]     = useState('')
  const [rangePrinting, setRangePrinting] = useState(false)
  const [rangeProducts, setRangeProducts] = useState(null)
  const [exporting, setExporting] = useState(false)
  const [soldProducts, setSoldProducts] = useState([])

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    setSoldProducts([])
    try {
      const { data } = await productAPI.getAll({
        search,
        category_id: categoryFilter || undefined,
        brand_id: brandFilter || undefined,
        page, limit: PER_PAGE,
        is_active: tab === 'active',
        sort_by: 'sku',
        include_images: true,
      })
      const rows = data.data || data.products || data.results || []
      setProducts(rows)
      setTotalPages(data.pagination?.pages || 1)
      setTotal(data.pagination?.total || 0)
      setBoxCounts(data.box_counts || {})
      setSelected([])
      // When searching active tab and no results, check for sold products
      if (tab === 'active' && search.trim() && rows.length === 0) {
        try {
          const { data: soldData } = await productAPI.getAll({ search, is_active: false, limit: 20 })
          setSoldProducts(soldData.data || soldData.products || soldData.results || [])
        } catch (_) {}
      }
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

  const handlePrintRange = async () => {
    const from = rangeFrom.trim().toUpperCase()
    const to   = rangeTo.trim().toUpperCase()
    if (!from && !to) return toast.error('Enter From or To barcode')
    setRangePrinting(true)
    try {
      const { data } = await productAPI.getAll({ limit: 10000, is_active: true })
      const all = data.data || data.products || data.results || []
      const parseBC = (bc) => {
        const boxMatch  = bc.match(/^[A-Za-z](\d+)/i)
        const prodMatch = bc.match(/(\d+)$/)
        return [boxMatch ? parseInt(boxMatch[1], 10) : 0, prodMatch ? parseInt(prodMatch[1], 10) : 0]
      }
      const inRange = (val) => {
        if (!val) return false
        if (from && to) return val >= from && val <= to
        if (from) return val >= from
        return val <= to
      }
      const filtered = all
        .filter(p => {
          const bc1 = (p.barcode || '').toUpperCase()
          const bc2 = (p.sku || '').toUpperCase()
          return inRange(bc1) || inRange(bc2)
        })
        .sort((a, b) => {
          const [boxA, prodA] = parseBC((a.barcode || a.sku || '').toUpperCase())
          const [boxB, prodB] = parseBC((b.barcode || b.sku || '').toUpperCase())
          return boxA !== boxB ? boxA - boxB : prodA - prodB
        })
      if (!filtered.length) return toast.error('No products found in this barcode range')
      setRangeProducts(filtered)
    } catch {
      toast.error('Failed to fetch products')
    } finally {
      setRangePrinting(false)
    }
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

  // Pagination controls — rendered both above and below the table
  const paginationBar = (position) => totalPages > 1 && (
    <div className={`flex items-center justify-center gap-1 px-4 py-3 flex-wrap ${position === 'top' ? 'border-b' : 'border-t'} border-slate-100`}>
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
          <span key={`ellipsis-${position}-${i}`} className="px-2 py-1 text-sm text-slate-400">...</span>
        ) : (
          <button
            key={`${position}-${btn}`}
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
  )

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
            {/* Print Barcodes (selected) */}
            <button
              onClick={handlePrintBarcodes}
              className="border border-amber-600 text-amber-600 hover:bg-amber-50 px-3 py-2 rounded-lg text-sm flex items-center gap-1.5"
            >
              <Printer className="h-4 w-4" /> Print Barcodes
            </button>
            {/* Print by Barcode Range — inline inputs */}
            <div className="flex items-center gap-1 border border-amber-300 rounded-lg px-2 py-1 bg-amber-50">
              <Barcode className="h-4 w-4 text-amber-600 shrink-0" />
              <input
                type="text"
                value={rangeFrom}
                onChange={e => setRangeFrom(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && handlePrintRange()}
                placeholder="From"
                className="w-24 bg-transparent text-xs font-mono placeholder-amber-400 text-amber-800 focus:outline-none"
              />
              <span className="text-amber-400 text-xs">–</span>
              <input
                type="text"
                value={rangeTo}
                onChange={e => setRangeTo(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && handlePrintRange()}
                placeholder="To"
                className="w-24 bg-transparent text-xs font-mono placeholder-amber-400 text-amber-800 focus:outline-none"
              />
              <button
                onClick={handlePrintRange}
                disabled={rangePrinting}
                className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white px-2 py-1 rounded text-xs font-medium flex items-center gap-1"
              >
                {rangePrinting ? <LoadingSpinner size="sm" /> : <Printer className="h-3 w-3" />}
                Print
              </button>
            </div>
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
              onClick={() => setShowBulkEdit(true)}
              className="px-3 py-1.5 rounded-lg bg-white text-amber-700 hover:bg-amber-50 text-sm flex items-center gap-1.5 font-medium"
            >
              <Edit2 className="h-4 w-4" /> Bulk Edit ({selected.length})
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

        {/* Pagination (top) */}
        {!loading && paginationBar('top')}

        {loading ? (
          <div className="flex items-center justify-center py-16"><LoadingSpinner size="lg" /></div>
        ) : products.length === 0 ? (
          <div>
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <Package className="h-12 w-12 mb-3 text-gray-300" />
              <p className="text-base font-medium text-slate-500">No products found</p>
              {!search && (
                <Link to="/inventory/products/add" className="mt-4 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
                  Add First Product
                </Link>
              )}
            </div>
            {soldProducts.length > 0 && (
              <div className="border-t border-red-200">
                <div className="px-4 py-2 bg-red-50 text-xs font-bold text-red-700 uppercase tracking-wider">
                  SOLD / Out of Stock ({soldProducts.length} item{soldProducts.length !== 1 ? 's' : ''})
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-red-50 text-xs text-red-500 uppercase">
                    <tr>
                      <th className="px-3 py-2 text-left">Name</th>
                      <th className="px-3 py-2 text-center">SKU</th>
                      <th className="px-3 py-2 text-center">Barcode</th>
                      <th className="px-3 py-2 text-right">MRP</th>
                      <th className="px-3 py-2 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {soldProducts.map((p) => (
                      <tr key={p.id} className="border-t border-red-100 hover:bg-red-50">
                        <td className="px-3 py-2 font-medium text-slate-700">{p.name}</td>
                        <td className="px-3 py-2 text-center font-mono text-xs text-slate-500">{p.sku || '-'}</td>
                        <td className="px-3 py-2 text-center font-mono text-xs text-slate-500">{p.barcode || '-'}</td>
                        <td className="px-3 py-2 text-right text-slate-700">{formatCurrency(p.mrp || 0)}</td>
                        <td className="px-3 py-2 text-center">
                          <span className="inline-block bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded">SOLD</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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
                  let lastBox = null
                  const getBoxNum = (p) => {
                    const m = (p.sku || p.barcode || '').match(/^[A-Za-z](\d+)/i)
                    return m ? parseInt(m[1], 10) : 0
                  }
                  products.forEach((p, pIdx) => {
                    const boxNum  = getBoxNum(p)
                    const boxKey  = boxNum || 'unknown'
                    const boxLabel = boxNum ? `Box ${boxNum}` : 'No Box'
                    if (boxKey !== lastBox) {
                      lastBox = boxKey
                      const cnt = boxCounts[boxNum]
                      rows.push(
                        <tr key={`box-${boxKey}`} className="bg-amber-50 border-b border-amber-100">
                          <td colSpan={15} className="px-4 py-1.5 text-xs font-bold text-amber-700 uppercase tracking-wider">
                            {boxLabel}
                            {cnt != null && (
                              <span className="font-normal text-amber-500 normal-case ml-2">({cnt} product{cnt !== 1 ? 's' : ''})</span>
                            )}
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
                      <td className="px-3 py-2 text-slate-600 text-xs">{p.category?.name || p.Category?.name || '-'}</td>
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

        {/* Pagination (bottom) */}
        {!loading && paginationBar('bottom')}
      </div>

      {/* Print Barcodes Modal */}
      {(showPrintBarcodes || rangeProducts) && (
        <PrintBarcodesModal
          products={rangeProducts || products}
          selectedIds={rangeProducts ? rangeProducts.map(p => p.id) : selected}
          onClose={() => { setShowPrintBarcodes(false); setRangeProducts(null) }}
        />
      )}


      {/* Bulk Edit Modal */}
      {showBulkEdit && (
        <BulkEditModal
          products={products}
          selectedIds={selected}
          categories={categories}
          onClose={() => setShowBulkEdit(false)}
          onSuccess={() => { setShowBulkEdit(false); fetchProducts() }}
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
