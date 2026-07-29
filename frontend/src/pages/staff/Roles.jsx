import { useEffect, useState } from 'react'
import { Plus, Trash2, Shield, Save, X, ChevronRight, Users } from 'lucide-react'
import toast from 'react-hot-toast'
import { staffAPI } from '../../api'
import LoadingSpinner from '../../components/common/LoadingSpinner'

const EMPTY_FORM = { name: '', description: '', permissions: [] }

const groupPermissions = (perms) =>
  perms.reduce((acc, p) => {
    const key = typeof p === 'string' ? p : (p.key || '')
    const mod = key.split('.')[0] || 'general'
    if (!acc[mod]) acc[mod] = []
    acc[mod].push(key)
    return acc
  }, {})

const permLabel = (p) => {
  const action = p.split('.')[1] || p
  return action.charAt(0).toUpperCase() + action.slice(1)
}

const modLabel = (m) => m.charAt(0).toUpperCase() + m.slice(1)

const ROLE_COLORS = [
  { bg: 'bg-amber-50', icon: 'text-amber-600', border: 'border-amber-200', badge: 'bg-amber-100 text-amber-700' },
  { bg: 'bg-blue-50', icon: 'text-blue-600', border: 'border-blue-200', badge: 'bg-blue-100 text-blue-700' },
  { bg: 'bg-emerald-50', icon: 'text-emerald-600', border: 'border-emerald-200', badge: 'bg-emerald-100 text-emerald-700' },
  { bg: 'bg-purple-50', icon: 'text-purple-600', border: 'border-purple-200', badge: 'bg-purple-100 text-purple-700' },
  { bg: 'bg-rose-50', icon: 'text-rose-600', border: 'border-rose-200', badge: 'bg-rose-100 text-rose-700' },
  { bg: 'bg-cyan-50', icon: 'text-cyan-600', border: 'border-cyan-200', badge: 'bg-cyan-100 text-cyan-700' },
]

export default function Roles() {
  const [roles, setRoles] = useState([])
  const [allPerms, setAllPerms] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState(null)
  const [selectedRole, setSelectedRole] = useState(null)
  const [edits, setEdits] = useState({})
  const [savingId, setSavingId] = useState(null)

  const fetchData = async () => {
    setLoading(true)
    try {
      const [{ data: r }, { data: p }] = await Promise.all([staffAPI.getRoles(), staffAPI.getPermissions()])
      const fetchedRoles = r.data || r.roles || []
      setRoles(fetchedRoles)
      setAllPerms(p.data || p.permissions || [])
      // Keep selectedRole in sync after refresh
      if (selectedRole) {
        const updated = fetchedRoles.find(ro => ro.id === selectedRole.id)
        if (updated) setSelectedRole(updated)
      }
    } catch (err) {
      console.error('Failed to load roles:', err?.response?.data || err?.message || err)
      toast.error('Failed to load roles')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

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
      if (selectedRole?.id === id) setSelectedRole(null)
      fetchData()
    } catch {
      toast.error('Failed to delete role')
    }
  }

  const grouped = groupPermissions(allPerms)

  // The role currently being viewed in the panel
  const panelRole = selectedRole ? roles.find(r => r.id === selectedRole.id) || selectedRole : null
  const panelPerms = panelRole ? getPerms(panelRole) : []
  const isPanelDirty = panelRole ? edits[panelRole.id] !== undefined : false

  return (
    <div className="flex h-full gap-6">
      {/* Left: Cards list */}
      <div className={`flex flex-col gap-5 transition-all duration-300 ${selectedRole ? 'w-80 flex-shrink-0' : 'flex-1'}`}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Roles & Permissions</h1>
            <p className="text-sm text-slate-500 mt-0.5">{roles.length} roles defined</p>
          </div>
          <button
            onClick={() => { setForm(EMPTY_FORM); setShowModal(true) }}
            className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 whitespace-nowrap"
          >
            <Plus className="h-4 w-4" /> Add Role
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-32"><LoadingSpinner size="lg" /></div>
        ) : roles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400">
            <Shield className="h-12 w-12 mb-3 opacity-30" />
            <p className="font-medium">No roles yet</p>
            <p className="text-sm mt-1">Click "Add Role" to get started</p>
          </div>
        ) : (
          <div className={`grid gap-4 ${selectedRole ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'}`}>
            {roles.map((role, idx) => {
              const color = ROLE_COLORS[idx % ROLE_COLORS.length]
              const isActive = selectedRole?.id === role.id
              const permCount = Array.isArray(role.permissions) ? role.permissions.length : 0
              const isDirty = edits[role.id] !== undefined

              return (
                <div
                  key={role.id}
                  onClick={() => setSelectedRole(isActive ? null : role)}
                  className={`relative bg-white rounded-xl border-2 cursor-pointer transition-all duration-200 hover:shadow-md group
                    ${isActive ? `${color.border} shadow-md` : 'border-slate-100 hover:border-slate-200'}`}
                >
                  {isDirty && (
                    <span className="absolute top-3 right-10 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium z-10">
                      Unsaved
                    </span>
                  )}

                  {/* Delete btn */}
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteId(role.id) }}
                    className="absolute top-3 right-3 p-1 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-50 text-slate-300 hover:text-red-500 transition-all"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>

                  <div className="p-5">
                    <div className={`w-11 h-11 rounded-xl ${color.bg} flex items-center justify-center mb-3`}>
                      <Shield className={`h-5 w-5 ${color.icon}`} />
                    </div>
                    <h3 className="font-semibold text-slate-800 text-base leading-tight">{role.name}</h3>
                    {role.description && (
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">{role.description}</p>
                    )}
                    <div className="flex items-center justify-between mt-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${color.badge}`}>
                        {permCount} permission{permCount !== 1 ? 's' : ''}
                      </span>
                      <ChevronRight className={`h-4 w-4 text-slate-300 transition-transform duration-200 ${isActive ? 'rotate-90' : 'group-hover:translate-x-0.5'}`} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Right: Permissions panel */}
      {selectedRole && panelRole && (
        <div className="flex-1 min-w-0">
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm h-full flex flex-col">
            {/* Panel header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center">
                  <Shield className="h-4 w-4 text-amber-600" />
                </div>
                <div>
                  <h2 className="font-semibold text-slate-800">{panelRole.name}</h2>
                  {panelRole.description && <p className="text-xs text-slate-400">{panelRole.description}</p>}
                </div>
                {isPanelDirty && (
                  <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Unsaved changes</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {isPanelDirty && (
                  <>
                    <button
                      onClick={() => discardEdit(panelRole.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg"
                    >
                      <X className="h-3 w-3" /> Discard
                    </button>
                    <button
                      onClick={() => saveRolePerms(panelRole)}
                      disabled={savingId === panelRole.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-white bg-amber-600 hover:bg-amber-700 rounded-lg disabled:opacity-50"
                    >
                      <Save className="h-3 w-3" /> {savingId === panelRole.id ? 'Saving…' : 'Save'}
                    </button>
                  </>
                )}
                <button
                  onClick={() => setSelectedRole(null)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Permissions */}
            <div className="p-6 flex-1 overflow-y-auto">
              {Object.keys(grouped).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                  <Users className="h-10 w-10 mb-2 opacity-30" />
                  <p className="text-sm">No permissions configured</p>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {Object.entries(grouped).map(([mod, perms]) => (
                    <div key={mod} className="bg-slate-50 rounded-xl p-4">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">{modLabel(mod)}</p>
                      <div className="space-y-2">
                        {perms.map((perm) => {
                          const checked = panelPerms.includes(perm)
                          return (
                            <label key={perm} className="flex items-center gap-2.5 cursor-pointer group">
                              <div
                                className={`w-4 h-4 rounded flex items-center justify-center border-2 flex-shrink-0 transition-colors
                                  ${checked
                                    ? 'bg-amber-500 border-amber-500'
                                    : 'border-slate-300 bg-white group-hover:border-amber-400'
                                  }`}
                              >
                                {checked && (
                                  <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 8" fill="none">
                                    <path d="M1 4L3.5 6.5L9 1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                )}
                              </div>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => togglePerm(panelRole.id, perm)}
                                className="sr-only"
                              />
                              <span className={`text-sm select-none transition-colors ${checked ? 'text-slate-800 font-medium' : 'text-slate-500 group-hover:text-slate-700'}`}>
                                {permLabel(perm)}
                              </span>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
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
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Description</label>
                <input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
                />
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
