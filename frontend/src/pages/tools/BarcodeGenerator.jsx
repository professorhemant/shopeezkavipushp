import { useState } from 'react'
import { Barcode, Download, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import { toolsAPI } from '../../api'

const BARCODE_TYPES = ['CODE128', 'CODE39', 'EAN13', 'EAN8', 'UPC', 'QR']

export default function BarcodeGenerator() {
  const [form, setForm] = useState({ text: '', type: 'CODE128', width: 2, height: 80 })
  const [barcodeUrl, setBarcodeUrl] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleGenerate = async (e) => {
    e.preventDefault()
    if (!form.text.trim()) return toast.error('Enter text to generate barcode')
    setLoading(true)
    try {
      const { data } = await toolsAPI.generateBarcode(form)
      if (data.url || data.image || data.barcode_url) {
        setBarcodeUrl(data.url || data.image || data.barcode_url)
      } else if (data.base64 || data.data) {
        setBarcodeUrl(`data:image/png;base64,${data.base64 || data.data}`)
      }
      toast.success('Barcode generated!')
    } catch {
      toast.error('Failed to generate barcode')
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = () => {
    if (!barcodeUrl) return
    const a = document.createElement('a')
    a.href = barcodeUrl
    a.download = `barcode-${form.text}.png`
    a.click()
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Barcode Generator</h1>
        <p className="text-sm text-gray-500 mt-0.5">Generate barcodes for products and inventory</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Input Form */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Settings</h2>
          <form onSubmit={handleGenerate} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Text / Value *</label>
              <input value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} placeholder="e.g. 123456789012" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Barcode Type</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {BARCODE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Width</label>
                <input type="number" min={1} max={5} value={form.width} onChange={(e) => setForm({ ...form, width: Number(e.target.value) })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Height (px)</label>
                <input type="number" min={40} max={200} step={10} value={form.height} onChange={(e) => setForm({ ...form, height: Number(e.target.value) })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Generating...' : 'Generate Barcode'}
            </button>
          </form>
        </div>

        {/* Preview */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900">Preview</h2>
            {barcodeUrl && (
              <button onClick={handleDownload} className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-sm">
                <Download className="h-4 w-4" /> Download
              </button>
            )}
          </div>
          {barcodeUrl ? (
            <div className="flex flex-col items-center justify-center py-8">
              <img src={barcodeUrl} alt="Barcode" className="max-w-full max-h-48 object-contain" />
              <p className="text-sm text-gray-500 mt-4 font-mono">{form.text}</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-gray-300">
              <Barcode className="h-16 w-16 mb-3" />
              <p className="text-sm text-gray-400">Barcode will appear here</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
