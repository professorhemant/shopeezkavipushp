import { useEffect, useState } from 'react'
import { Plus, Edit2, Trash2, Ruler, X, Save } from 'lucide-react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { unitAPI } from '../../api'
import LoadingSpinner from '../../components/common/LoadingSpinner'

export default function Units() {
  const [units, setUnits] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState(null)

  const { register, handleSubmit, reset, formState: { errors } } = useForm()

  const fetchUnits = async () => {
    setLoading(true)
    try {
      const { data } = await unitAPI.getAll()
      setUnits(data.data || data.units || [])
    } catch {
      toast.error('Failed to load units')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchUnits() }, [])

  const openAdd = () => {
    setEditItem(null)
    reset({ name: '', short_name: '', description: '' })
    setShowModal(true)
  }

  const openEdit = (unit) => {
    setEditItem(unit)
    reset({ name: unit.name, short_name: unit.short_name || '', description: unit.description || '' })
    setShowModal(true)
  }

  const onSubmit = async (data) => {
    setSaving(true)
    try {
      if (editItem) {
        await unitAPI.update(editItem.id, data)
        toast.success('Unit updated')
      } else {
        await unitAPI.create(data)
        toast.success('Unit created')
      }
      setShowModal(false)
      fetchUnits()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save unit')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    try {
      await unitAPI.delete(id)
      toast.success('Unit deleted')
      setDeleteId(null)
      fetchUnits()
    } catch {
      toast.error('Cannot delete unit used by products')
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Units of Measurement</h1>
          <p className="text-sm text-slate-500 mt-0.5">{units.length} units</p>
        </div>
        <button onClick={openAdd} className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
          <Plus className="h-4 w-4" /> Add Unit
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16"><LoadingSpinner size="lg" /></div>
        ) : units.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Ruler className="h-12 w-12 mb-3 text-gray-300" />
            <p className="text-base font-medium text-slate-500">No units defined</p>
            <p className="text-sm mt-1">e.g. Pieces, Kg, Litres, Box...</p>
            <button onClick={openAdd} className="mt-4 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium">Add First Unit</button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Unit Name</th>
                <th className="px-4 py-3 text-left">Symbol</th>
                <th className="px-4 py-3 text-left">Description</th>
                <th className="px-4 py-3 text-right">Products Using</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {units.map((unit) => (
                <tr key={unit.id} className="border-b hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{unit.name}</td>
                  <td className="px-4 py-3">
                    <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded text-xs font-mono font-medium">{unit.short_name || unit.name}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{unit.description || '-'}</td>
                  <td className="px-4 py-3 text-right font-medium text-slate-800">{unit.products_count ?? 0}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => openEdit(unit)} className="p-1.5 rounded-lg hover:bg-amber-50 text-gray-400 hover:text-amber-600"><Edit2 className="h-4 w-4" /></button>
                      <button onClick={() => setDeleteId(unit.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold text-slate-800 text-lg">{editItem ? 'Edit Unit' : 'Add Unit'}</h3>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-gray-100"><X className="h-5 w-5 text-gray-500" /></button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Unit Name *</label>
                <input {...register('name', { required: 'Name is required' })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" placeholder="e.g. Kilogram" />
                {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Short Name *</label>
                <input {...register('short_name', { required: 'Short name is required' })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" placeholder="e.g. Kg" />
                {errors.short_name && <p className="text-red-500 text-xs mt-1">{errors.short_name.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <input {...register('description')} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" placeholder="Optional description" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60">
                  {saving ? <LoadingSpinner size="sm" /> : <Save className="h-4 w-4" />} Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 shadow-xl w-full max-w-sm mx-4">
            <h3 className="font-semibold text-slate-800 mb-2">Delete Unit?</h3>
            <p className="text-sm text-slate-500 mb-5">Units linked to products cannot be deleted.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm">Cancel</button>
              <button onClick={() => handleDelete(deleteId)} className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
