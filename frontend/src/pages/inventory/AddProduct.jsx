import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { useDropzone } from 'react-dropzone'
import {
  ArrowLeft, Save, Package, Upload, X, Image as ImageIcon
} from 'lucide-react'
import toast from 'react-hot-toast'
import { productAPI, categoryAPI, brandAPI, unitAPI } from '../../api'
import LoadingSpinner from '../../components/common/LoadingSpinner'

const TAX_RATES = [0, 5, 12, 18, 28]

export default function AddProduct() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)

  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [categories, setCategories] = useState([])
  const [brands, setBrands] = useState([])
  const [units, setUnits] = useState([])
  const [imagePreview, setImagePreview] = useState(null)
  const [imageFile, setImageFile] = useState(null)

  const { register, handleSubmit, reset, control, watch, formState: { errors } } = useForm({
    defaultValues: {
      name: '', sku: '', barcode: '', hsn_code: '', description: '',
      category_id: '', brand_id: '', unit_id: '',
      purchase_price: '', sale_price: '', mrp: '', wholesale_price: '',
      tax_rate: '18', tax_type: 'exclusive',
      stock: 0, min_stock: 5, max_stock: 100, opening_stock: 0,
      is_service: false, track_inventory: true, has_variants: false,
      is_active: true,
    },
  })

  const onDrop = useCallback((accepted) => {
    const file = accepted[0]
    if (file) {
      setImageFile(file)
      setImagePreview(URL.createObjectURL(file))
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'image/*': [] }, maxFiles: 1, maxSize: 5 * 1024 * 1024,
  })

  useEffect(() => {
    Promise.all([
      categoryAPI.getAll(),
      brandAPI.getAll(),
      unitAPI.getAll(),
    ]).then(([catRes, brandRes, unitRes]) => {
      setCategories(catRes.data.data || catRes.data.categories || [])
      setBrands(brandRes.data.data || brandRes.data.brands || [])
      setUnits(unitRes.data.data || unitRes.data.units || [])
    }).catch(() => toast.error('Failed to load dropdown data'))

    if (isEdit) {
      productAPI.getOne(id)
        .then(({ data }) => {
          const p = data.data || data.product || data
          reset({
            name: p.name || '', sku: p.sku || '', barcode: p.barcode || '',
            hsn_code: p.hsn_code || '', description: p.description || '',
            category_id: p.category_id || '', brand_id: p.brand_id || '', unit_id: p.unit_id || '',
            purchase_price: p.purchase_price || '', sale_price: p.sale_price || '',
            mrp: p.mrp || '', wholesale_price: p.wholesale_price || '',
            tax_rate: String(p.tax_rate ?? 18), tax_type: p.tax_type || 'exclusive',
            stock: p.stock ?? 0, min_stock: p.min_stock ?? 5,
            max_stock: p.max_stock ?? 100, opening_stock: p.opening_stock ?? 0,
            is_service: p.is_service ?? false, track_inventory: p.track_inventory ?? true,
            has_variants: p.has_variants ?? false, is_active: p.is_active ?? true,
          })
          if (p.images?.[0]) setImagePreview(p.images[0])
        })
        .catch(() => toast.error('Failed to load product'))
        .finally(() => setLoading(false))
    }
  }, [id, isEdit, reset])

  const onSubmit = async (data) => {
    setSaving(true)
    try {
      const payload = { ...data }
      // Convert numeric strings to numbers
      ;['purchase_price', 'sale_price', 'mrp', 'wholesale_price', 'tax_rate',
        'stock', 'min_stock', 'max_stock', 'opening_stock'].forEach((k) => {
        if (payload[k] !== '' && payload[k] != null) payload[k] = parseFloat(payload[k]) || 0
      })
      // Convert empty string IDs to null
      ;['category_id', 'brand_id', 'unit_id'].forEach((k) => {
        if (payload[k] === '') payload[k] = null
      })

      if (isEdit) {
        await productAPI.update(id, payload)
        toast.success('Product updated successfully')
      } else {
        await productAPI.create(payload)
        toast.success('Product created successfully')
      }
      navigate('/inventory/products')
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save product')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <LoadingSpinner fullscreen />

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{isEdit ? 'Edit Product' : 'Add Product'}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{isEdit ? 'Update product details' : 'Create a new product in inventory'}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Basic Info */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Package className="h-4 w-4 text-blue-600" /> Basic Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Product Name *</label>
              <input
                {...register('name', { required: 'Name is required' })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter product name"
              />
              {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
              <input
                {...register('sku')}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Auto-generate or enter SKU"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Barcode</label>
              <input
                {...register('barcode')}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Scan or enter barcode"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">HSN Code</label>
              <input
                {...register('hsn_code')}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. 6109"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select {...register('is_active')} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value={true}>Active</option>
                <option value={false}>Inactive</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                {...register('description')}
                rows={3}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Product description..."
              />
            </div>
          </div>
        </div>

        {/* Classification */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h2 className="font-semibold text-gray-900 mb-4">Classification</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select {...register('category_id')} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select Category</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Brand</label>
              <select {...register('brand_id')} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select Brand</option>
                {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
              <select {...register('unit_id')} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select Unit</option>
                {units.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.short_name})</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Pricing */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h2 className="font-semibold text-gray-900 mb-4">Pricing</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { key: 'purchase_price', label: 'Purchase Price' },
              { key: 'sale_price', label: 'Sale Price' },
              { key: 'mrp', label: 'MRP' },
              { key: 'wholesale_price', label: 'Wholesale Price' },
            ].map(({ key, label }) => (
              <div key={key}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">₹</span>
                  <input
                    type="number" step="0.01" min="0"
                    {...register(key)}
                    className="w-full pl-7 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tax */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h2 className="font-semibold text-gray-900 mb-4">Tax Settings</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tax Rate (GST %)</label>
              <select {...register('tax_rate')} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {TAX_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tax Type</label>
              <select {...register('tax_type')} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="exclusive">Exclusive (Tax added on top)</option>
                <option value="inclusive">Inclusive (Tax included in price)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Stock */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h2 className="font-semibold text-gray-900 mb-4">Stock Management</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            {[
              { key: 'stock', label: 'Current Stock' },
              { key: 'opening_stock', label: 'Opening Stock' },
              { key: 'min_stock', label: 'Min Stock (Alert)' },
              { key: 'max_stock', label: 'Max Stock' },
            ].map(({ key, label }) => (
              <div key={key}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                <input
                  type="number" min="0"
                  {...register(key)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-5">
            {[
              { key: 'track_inventory', label: 'Track Inventory' },
              { key: 'is_service', label: 'Is Service (no stock tracking)' },
              { key: 'has_variants', label: 'Has Variants (Size/Color)' },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" {...register(key)} className="h-4 w-4 text-blue-600 rounded border-gray-300" />
                <span className="text-sm text-gray-700">{label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Image */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h2 className="font-semibold text-gray-900 mb-4">Product Image</h2>
          {imagePreview ? (
            <div className="relative inline-block">
              <img src={imagePreview} alt="Preview" className="h-40 w-40 rounded-xl object-cover border border-gray-200" />
              <button
                type="button"
                onClick={() => { setImagePreview(null); setImageFile(null) }}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                isDragActive ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
              }`}
            >
              <input {...getInputProps()} />
              <ImageIcon className="h-10 w-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Drag & drop image here, or click to select</p>
              <p className="text-xs text-gray-400 mt-1">PNG, JPG, WEBP up to 5MB</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => navigate(-1)} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm">
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-60"
          >
            {saving ? <LoadingSpinner size="sm" /> : <Save className="h-4 w-4" />}
            {isEdit ? 'Update Product' : 'Create Product'}
          </button>
        </div>
      </form>
    </div>
  )
}
