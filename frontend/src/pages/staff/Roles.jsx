import { useEffect, useState } from 'react'
import { Plus, Trash2, Shield, Save, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { staffAPI } from '../../api'
import LoadingSpinner from '../../components/common/LoadingSpinner'

const EMPTY_FORM = { name: '', description: '', permissions: [] }

// Group flat permission strings by module
const groupPermissions = (perms) =>
  perms.reduce((acc, p) => {
    const key = typeof p === 'string' ? p : (p.key || '')
    const mod = key.split('.')[0] || 'general'
    if (!acc[mod]) acc[mod] = []
    acc[mod].push(key)
    return acc
  }, {})

// "products.create" → "Create"
const permLabel = (p) => {
  const action = p.split('.')[1] || p
  return action.charAt(0).toUpperCase() + action.slice(1)
}

// "products" → "Products"
const modLabel = (m) => m.charAt(0).toUpperCase() + m.slice(1)

export default function Roles() {
  const [roles, setRoles] = useState([])
  const [allPerms, setAllPerms] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState(null)
  // per-role pending edits: { [roleId]: string[] }
  const [edits, setEdits] = useState({})
  const [savingId, setSavingId] = useState(null)

  const fetchData = async () => {
    setLoading(true)
    try {
      const [{ data: r }, { data: p }] = await Promise.all([staffAPI.getRoles(), staffAPI.getPermissions()])
      setRoles(r.data || r.roles || [])
      setAllPerms(p.data || p.permissions || [])
    } catch (err) {
      console.error('Failed to load roles:', err?.response?.data || err?.message || err)
      toast.error('Failed to load roles')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  // Returns current permissions for a role (pending edit or saved)
  const getPerms = (role) =>
    edits[role.id] !== undefined ? edits[role.id] : (Array.isArray(role.permissions) ? role.permissions : [])

  const togglePerm = (roleId, perm) => {
    setEdits((prev) => {
      const role = roles.find((r) => r.id === roleId)
      const current = prev[roleId] !== undefined ? prev[roleId] : (Array.isArray(role?.permissions) ? role.permissions : [])
      const next = current.includes(perm) ? current.filter((p) => p !== perm) : [...current, perm]
      return { ...prev, [roleId]: next }
    })
  }

  const discardEdit = (roleId) => {
    setEdits((prev) => { const n = { ...prev }; delete n[roleId]; return n })
  }

  const saveRolePerms = async (role) => {
    setSavingId(role.id)
    try {
      await staffAPI.updateRole(role.id, { name: role.name, description: role.description, permissions: edits[role.id] })
      toast.success(`${role.name} updated`)
      discardEdit(role.id)
      fetchData()
    } catch {
      toast.error('Failed to save role')
    } finally {
      setSavingId(null)
    }
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return toast.error('Role name is required')
    setSaving(true)
    try {
      await staffAPI.createRole(form)
      toast.success('Role created')
      setShowModal(false)
      setForm(EMPTY_FORM)
      fetchData()
    } catch {
      toast.error('Failed to create role')
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

  const grouped = groupPermissions(allPerms)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Roles & Permissions</h1>
          <p className="text-sm text-slate-500 mt-0.5">{roles.length} roles defined</p>
        </div>
        <button onClick={() => { setForm(EMPTY_FORM); setShowModal(true) }}
          className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
          <Plus className="h-4 w-4" /> Add Role
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-32"><LoadingSpinner size="lg" /></div>
      ) : (
        <div className="space-y-4">
          {roles.map((role) => {
            const rolePerms = getPerms(role)
            const isDirty = edits[role.id] !== undefined
            return (
              <div key={role.id} className="bg-white rounded-xl shadow-sm border border-slate-100">
                {/* Role header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center">
                      <Shield className="h-4 w-4 text-amber-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800">{role.name}</h3>
                      {role.description && <p className="text-xs text-slate-500">{role.description}</p>}
                    </div>
                    {isDirty && (
                      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Unsaved changes</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {isDirty && (
                      <>
                        <button onClick={() => discardEdit(role.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg">
                          <X className="h-3 w-3" /> Discard
                        </button>
                        <button onClick={() => saveRolePerms(role)} disabled={savingId === role.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-white bg-amber-600 hover:bg-amber-700 rounded-lg disabled:opacity-50">
                          <Save className="h-3 w-3" /> {savingId === role.id ? 'Saving…' : 'Save'}
                        </button>
                      </>
                    )}
                    <button onClick={() => setDeleteId(role.id)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Permissions grid */}
                <div className="p-5 grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                  {Object.entries(grouped).map(([mod, perms]) => (
                    <div key={mod}>
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">{modLabel(mod)}</p>
                      <div className="space-y-1.5">
                        {perms.map((perm) => (
                          <label key={perm} className="flex items-center gap-2 cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={rolePerms.includes(perm)}
                              onChange={() => togglePerm(role.id, perm)}
                              className="w-4 h-4 rounded accent-amber-600 cursor-pointer"
                            />
                            <span className="text-sm text-slate-700 group-hover:text-slate-900 select-none">
                              {permLabel(perm)}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Create Role Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-800">Create Role</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Role Name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Description</label>
                <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" />
              </div>
              <p className="text-xs text-slate-400">You can assign permissions after creating the role.</p>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-slate-700 px-4 py-2 rounded-lg text-sm">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                  {saving ? 'Creating…' : 'Create Role'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
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
