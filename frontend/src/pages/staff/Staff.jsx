import { useEffect, useState, useCallback } from 'react'
import { Plus, Search, Edit2, UserX, UserCheck, Trash2, Users, Shield } from 'lucide-react'
import toast from 'react-hot-toast'
import { staffAPI } from '../../api'
import { formatDate } from '../../utils/formatters'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import useAuthStore from '../../store/authStore'

const EMPTY_FORM = { name: '', email: '', phone: '', role_name: 'staff', password: '' }

export default function Staff() {
  const { user: currentUser } = useAuthStore()
  const [staff, setStaff] = useState([])
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const fetchStaff = useCallback(async () => {
    setLoading(true)
    try {
      const [{ data: s }, { data: r }] = await Promise.all([staffAPI.getAll(), staffAPI.getRoles()])
      setStaff(s.data || s.staff || [])
      setRoles(r.data || r.roles || [])
    } catch {
      toast.error('Failed to load staff')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchStaff() }, [fetchStaff])

  const filtered = staff.filter((s) => !search || s.name?.toLowerCase().includes(search.toLowerCase()) || s.email?.toLowerCase().includes(search.toLowerCase()))

  const openAdd = () => { setEditing(null); setForm(EMPTY_FORM); setShowModal(true) }
  const openEdit = (s) => { setEditing(s.id); setForm({ name: s.name || '', email: s.email || '', phone: s.phone || '', role_name: s.role_name || 'staff', password: '' }); setShowModal(true) }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.name || !form.email) return toast.error('Name and email are required')
    if (!editing && !form.password) return toast.error('Password is required for new staff')
    setSaving(true)
    try {
      if (editing) {
        await staffAPI.update(editing, form)
        toast.success('Staff updated')
      } else {
        await staffAPI.create(form)
        toast.success('Staff added')
      }
      setShowModal(false)
      fetchStaff()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save staff')
    } finally {
      setSaving(false)
    }
  }

  const handleDeactivate = async (id) => {
    if (!window.confirm('Deactivate this staff member?')) return
    try {
      await staffAPI.deactivate(id)
      toast.success('Staff deactivated')
      fetchStaff()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to deactivate')
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Permanently delete this staff member? This cannot be undone.')) return
    try {
      await staffAPI.remove(id)
      toast.success('Staff deleted')
      fetchStaff()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to delete')
    }
  }

  const handleReactivate = async (id) => {
    try {
      await staffAPI.reactivate(id)
      toast.success('Staff reactivated')
      fetchStaff()
    } catch {
      toast.error('Failed to reactivate')
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Staff Management</h1>
          <p className="text-sm text-slate-500 mt-0.5">{filtered.length} staff members</p>
        </div>
        <button onClick={openAdd} className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
          <Plus className="h-4 w-4" /> Add Staff
        </button>
      </div>

      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input type="text" placeholder="Search by name or email..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16"><LoadingSpinner size="lg" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Users className="h-12 w-12 mb-3 text-slate-300" />
            <p className="text-base font-medium text-slate-500">No staff members found</p>
            <button onClick={openAdd} className="mt-4 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium">Add First Staff</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">Email</th>
                  <th className="px-4 py-3 text-left">Phone</th>
                  <th className="px-4 py-3 text-left">Role</th>
                  <th className="px-4 py-3 text-left">Joined</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id} className="border-b hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center text-amber-700 font-semibold text-xs">{s.name?.[0]?.toUpperCase()}</div>
                        <span className="font-medium text-slate-800">{s.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{s.email}</td>
                    <td className="px-4 py-3 text-slate-600">{s.phone || '-'}</td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1 text-slate-600"><Shield className="h-3.5 w-3.5 text-slate-400" />{s.role_name || s.role?.name || 'Staff'}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(s.created_at || s.joined_date)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${s.status === 'active' || !s.status ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-slate-600'}`}>{s.status || 'active'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg hover:bg-amber-50 text-slate-400 hover:text-amber-600" title="Edit"><Edit2 className="h-4 w-4" /></button>
                        {s.is_active
                          ? s.id === currentUser?.id
                            ? <button disabled className="p-1.5 rounded-lg text-slate-300 cursor-not-allowed" title="Cannot deactivate your own account"><UserX className="h-4 w-4" /></button>
                            : <button onClick={() => handleDeactivate(s.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600" title="Deactivate"><UserX className="h-4 w-4" /></button>
                          : <button onClick={() => handleReactivate(s.id)} className="p-1.5 rounded-lg hover:bg-green-50 text-slate-400 hover:text-green-600" title="Reactivate"><UserCheck className="h-4 w-4" /></button>
                        }
                        {s.id !== currentUser?.id && (
                          <button onClick={() => handleDelete(s.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600" title="Delete"><Trash2 className="h-4 w-4" /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-800">{editing ? 'Edit Staff' : 'Add Staff'}</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">Full Name *</label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Email *</label>
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Phone</label>
                  <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Role</label>
                  <select value={form.role_name} onChange={(e) => setForm({ ...form, role_name: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500">
                    <option value="staff">Staff</option>
                    <option value="billing">Billing</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">{editing ? 'New Password (leave blank to keep)' : 'Password *'}</label>
                  <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-slate-700 px-4 py-2 rounded-lg text-sm">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">{saving ? 'Saving...' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
