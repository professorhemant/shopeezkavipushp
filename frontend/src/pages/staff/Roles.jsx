import { useEffect, useState } from 'react'
import { Plus, Edit2, Trash2, Shield } from 'lucide-react'
import toast from 'react-hot-toast'
import { staffAPI } from '../../api'
import LoadingSpinner from '../../components/common/LoadingSpinner'

const EMPTY_FORM = { name: '', description: '', permissions: [] }

export default function Roles() {
  const [roles, setRoles] = useState([])
  const [permissions, setPermissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState(null)

  const fetchData = async () => {
    setLoading(true)
    try {
      const [{ data: r }, { data: p }] = await Promise.all([staffAPI.getRoles(), staffAPI.getPermissions()])
      setRoles(r.data || r.roles || [])
      setPermissions(p.data || p.permissions || [])
    } catch {
      toast.error('Failed to load roles')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const openAdd = () => { setEditing(null); setForm(EMPTY_FORM); setShowModal(true) }
  const openEdit = (r) => { setEditing(r.id); setForm({ name: r.name || '', description: r.description || '', permissions: r.permissions || [] }); setShowModal(true) }

  const togglePermission = (perm) => {
    setForm((f) => ({
      ...f,
      permissions: f.permissions.includes(perm) ? f.permissions.filter((p) => p !== perm) : [...f.permissions, perm],
    }))
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return toast.error('Role name is required')
    setSaving(true)
    try {
      if (editing) {
        await staffAPI.updateRole(editing, form)
        toast.success('Role updated')
      } else {
        await staffAPI.createRole(form)
        toast.success('Role created')
      }
      setShowModal(false)
      fetchData()
    } catch {
      toast.error('Failed to save role')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    try {
      await staffAPI.deleteRole(id)
      toast.success('Role deleted')
      setDeleteId(null)
      fetchData()
    } catch {
      toast.error('Failed to delete role')
    }
  }

  const grouped = permissions.reduce((acc, p) => {
    const mod = p.module || 'General'
    if (!acc[mod]) acc[mod] = []
    acc[mod].push(p)
    return acc
  }, {})

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Roles & Permissions</h1>
          <p className="text-sm text-slate-500 mt-0.5">{roles.length} roles defined</p>
        </div>
        <button onClick={openAdd} className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
          <Plus className="h-4 w-4" /> Add Role
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-32"><LoadingSpinner size="lg" /></div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {roles.map((role) => (
            <div key={role.id} className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center"><Shield className="h-4 w-4 text-amber-600" /></div>
                  <div>
                    <h3 className="font-semibold text-slate-800 text-sm">{role.name}</h3>
                    {role.description && <p className="text-xs text-slate-500 mt-0.5">{role.description}</p>}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(role)} className="p-1.5 rounded-lg hover:bg-amber-50 text-slate-400 hover:text-amber-600"><Edit2 className="h-3.5 w-3.5" /></button>
                  <button onClick={() => setDeleteId(role.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                {(role.permissions || []).slice(0, 6).map((p, i) => (
                  <span key={i} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{p}</span>
                ))}
                {(role.permissions || []).length > 6 && (
                  <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded">+{role.permissions.length - 6} more</span>
                )}
              </div>
              {(role.staff_count !== undefined) && (
                <p className="text-xs text-slate-400 mt-3">{role.staff_count} staff member{role.staff_count !== 1 ? 's' : ''}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl my-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-800">{editing ? 'Edit Role' : 'Create Role'}</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Role Name *</label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Description</label>
                  <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" />
                </div>
              </div>

              {Object.keys(grouped).length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-2">Permissions</label>
                  <div className="space-y-3 max-h-64 overflow-y-auto border border-slate-200 rounded-lg p-3">
                    {Object.entries(grouped).map(([module, perms]) => (
                      <div key={module}>
                        <p className="text-xs font-semibold text-slate-500 uppercase mb-1">{module}</p>
                        <div className="flex flex-wrap gap-2">
                          {perms.map((p) => (
                            <label key={p.key || p} className="flex items-center gap-1.5 text-sm text-slate-700 cursor-pointer">
                              <input type="checkbox" checked={form.permissions.includes(p.key || p)} onChange={() => togglePermission(p.key || p)} className="rounded text-amber-600" />
                              {p.label || p.key || p}
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-slate-700 px-4 py-2 rounded-lg text-sm">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">{saving ? 'Saving...' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 shadow-xl w-full max-w-sm mx-4">
            <h3 className="font-semibold text-slate-800 mb-1">Delete Role</h3>
            <p className="text-sm text-slate-500 mb-5">Staff assigned this role may lose their permissions.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-slate-700 px-4 py-2 rounded-lg text-sm">Cancel</button>
              <button onClick={() => handleDelete(deleteId)} className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
