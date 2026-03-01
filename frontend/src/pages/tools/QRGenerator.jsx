import { useState } from 'react'
import { QrCode, Download, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import { toolsAPI } from '../../api'

export default function QRGenerator() {
  const [form, setForm] = useState({ text: '', size: 256, error_correction: 'M', type: 'text' })
  const [qrUrl, setQrUrl] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleGenerate = async (e) => {
    e.preventDefault()
    if (!form.text.trim()) return toast.error('Enter text or URL to generate QR code')
    setLoading(true)
    try {
      const { data } = await toolsAPI.generateQR(form)
      if (data.url || data.image || data.qr_url) {
        setQrUrl(data.url || data.image || data.qr_url)
      } else if (data.base64 || data.data) {
        setQrUrl(`data:image/png;base64,${data.base64 || data.data}`)
      }
      toast.success('QR code generated!')
    } catch {
      toast.error('Failed to generate QR code')
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = () => {
    if (!qrUrl) return
    const a = document.createElement('a')
    a.href = qrUrl
    a.download = 'qrcode.png'
    a.click()
  }

  const QR_TYPES = [
    { value: 'text', label: 'Plain Text' },
    { value: 'url', label: 'Website URL' },
    { value: 'upi', label: 'UPI Payment' },
    { value: 'contact', label: 'Contact (vCard)' },
    { value: 'wifi', label: 'WiFi' },
  ]

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">QR Code Generator</h1>
        <p className="text-sm text-gray-500 mt-0.5">Generate QR codes for URLs, payments, and more</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Settings</h2>
          <form onSubmit={handleGenerate} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">QR Type</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {QR_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                {form.type === 'url' ? 'URL' : form.type === 'upi' ? 'UPI ID or URL' : 'Content'} *
              </label>
              <textarea value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} rows={4} placeholder={
                form.type === 'url' ? 'https://yourwebsite.com' :
                form.type === 'upi' ? 'upi://pay?pa=merchant@upi&pn=Shop Name' :
                'Enter content...'
              } className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Size (px)</label>
                <select value={form.size} onChange={(e) => setForm({ ...form, size: Number(e.target.value) })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {[128, 256, 512, 1024].map((s) => <option key={s} value={s}>{s}x{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Error Correction</label>
                <select value={form.error_correction} onChange={(e) => setForm({ ...form, error_correction: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="L">Low (7%)</option>
                  <option value="M">Medium (15%)</option>
                  <option value="Q">Quartile (25%)</option>
                  <option value="H">High (30%)</option>
                </select>
              </div>
            </div>
            <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Generating...' : 'Generate QR Code'}
            </button>
          </form>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900">Preview</h2>
            {qrUrl && (
              <button onClick={handleDownload} className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-sm">
                <Download className="h-4 w-4" /> Download
              </button>
            )}
          </div>
          {qrUrl ? (
            <div className="flex flex-col items-center justify-center py-8">
              <img src={qrUrl} alt="QR Code" className="max-w-full max-h-64 object-contain rounded-lg" />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-gray-300">
              <QrCode className="h-16 w-16 mb-3" />
              <p className="text-sm text-gray-400">QR code will appear here</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
