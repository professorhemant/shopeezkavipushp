import { useState, useEffect } from 'react'
import { X, Package } from 'lucide-react'
import toast from 'react-hot-toast'
import { productAPI } from '../../api'

function generateBarcode(name) {
  const letters = (name || '').replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 4).padEnd(4, 'X')
  const digits = String(Math.floor(100 + Math.random() * 900))
  return `KVP-${letters}-${digits}`
}

export default function QuickInventoryModal({ onClose, onProductCreated }) {
  const [name,          setName]          = useState('')
  const [barcode,       setBarcode]       = useState('')
  const [price,         setPrice]         = useState('')
  const [barcodeManual, setBarcodeManual] = useState(false)
  const [saving,        setSaving]        = useState(false)

  useEffect(() => {
    if (!barcodeManual && name.trim()) setBarcode(generateBarcode(name))
  }, [name, barcodeManual])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) { toast.error('Enter product name'); return }
    const salePrice = parseFloat(price)
    if (!salePrice || salePrice <= 0) { toast.error('Enter selling price'); return }
    setSaving(true)
    try {
      const { data } = await productAPI.create({
        name:            name.trim(),
        barcode:         barcode.trim() || undefined,
        sale_price:      salePrice,
        mrp:             salePrice,
        stock:           1,
        track_inventory: true,
        is_active:       true,
      })
      const product = data.data || data.product || data
      toast.success(`"${name.trim()}" added to inventory`)
      onProductCreated?.(product)
      onClose()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to add product')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-80 p-6 relative"
        onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-3 right-3 text-gray-400 hover:text-gray-600">
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2 mb-4">
          <Package className="h-5 w-5 text-amber-600" />
          <h2 className="text-base font-bold text-slate-800">Quick Inventory</h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 font-medium block mb-1">Product Name *</label>
            <input
              type="text" required autoFocus
              value={name}
              onChange={e => { setName(e.target.value); setBarcodeManual(false) }}
              placeholder="e.g. Pearl Necklace"
              className="w-full border-2 border-amber-400 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          <div>
            <label className="text-xs text-gray-500 font-medium block mb-1">
              Barcode <span className="text-amber-500">(auto-generated, editable)</span>
            </label>
            <input
              type="text"
              value={barcode}
              onChange={e => { setBarcode(e.target.value); setBarcodeManual(true) }}
              placeholder="KVP-XXXX-000"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-300"
            />
          </div>

          <div>
            <label className="text-xs text-gray-500 font-medium block mb-1">Selling Price (₹) *</label>
            <input
              type="number" min="0.01" step="0.01" required
              value={price}
              onChange={e => setPrice(e.target.value)}
              placeholder="0.00"
              className="w-full border-2 border-green-400 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            />
          </div>

          <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
            <span className="text-xs text-gray-500 font-medium">Stock</span>
            <span className="text-sm font-bold text-slate-700">1 <span className="text-xs font-normal text-gray-400">(fixed)</span></span>
          </div>

          <button
            type="submit" disabled={saving}
            className="w-full bg-amber-600 hover:bg-amber-700 text-white py-2.5 rounded-xl font-semibold text-sm disabled:opacity-60"
          >
            {saving ? 'Adding…' : 'Add to Inventory'}
          </button>
        </form>
      </div>
    </div>
  )
}
