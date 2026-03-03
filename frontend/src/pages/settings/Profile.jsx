import { useEffect, useState } from 'react'
import { Save, User, Lock, Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'
import { authAPI } from '../../api'
import useAuthStore from '../../store/authStore'
import LoadingSpinner from '../../components/common/LoadingSpinner'

export default function Profile() {
  const { user, updateUser } = useAuthStore()
  const [profile, setProfile] = useState({ name: '', email: '', phone: '' })
  const [passwords, setPasswords] = useState({ current_password: '', new_password: '', confirm_password: '' })
  const [loading, setLoading] = useState(true)
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [showPasswords, setShowPasswords] = useState({ current: false, new: false, confirm: false })
  const [tab, setTab] = useState('profile')

  useEffect(() => {
    authAPI.getProfile()
      .then(({ data }) => {
        const u = data.user || data
        setProfile({ name: u.name || '', email: u.email || '', phone: u.phone || '' })
      })
      .catch(() => toast.error('Failed to load profile'))
      .finally(() => setLoading(false))
  }, [])

  const handleSaveProfile = async (e) => {
    e.preventDefault()
    if (!profile.name.trim()) return toast.error('Name is required')
    setSavingProfile(true)
    try {
      const { data } = await authAPI.updateProfile(profile)
      toast.success('Profile updated')
      if (updateUser) updateUser(data.user || data)
    } catch {
      toast.error('Failed to update profile')
    } finally {
      setSavingProfile(false)
    }
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    if (!passwords.current_password) return toast.error('Enter current password')
    if (passwords.new_password.length < 8) return toast.error('New password must be at least 8 characters')
    if (passwords.new_password !== passwords.confirm_password) return toast.error('Passwords do not match')
    setSavingPassword(true)
    try {
      await authAPI.changePassword(passwords)
      toast.success('Password changed successfully')
      setPasswords({ current_password: '', new_password: '', confirm_password: '' })
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to change password')
    } finally {
      setSavingPassword(false)
    }
  }

  if (loading) return <div className="flex items-center justify-center py-32"><LoadingSpinner size="lg" /></div>

  const PasswordField = ({ label, field, show, onToggle }) => (
    <div>
      <label className="block text-xs font-medium text-slate-700 mb-1">{label}</label>
      <div className="relative">
        <input type={show ? 'text' : 'password'} value={passwords[field]} onChange={(e) => setPasswords({ ...passwords, [field]: e.target.value })}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" />
        <button type="button" onClick={onToggle} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  )

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Profile</h1>
        <p className="text-sm text-slate-500 mt-0.5">Manage your account settings</p>
      </div>

      {/* Avatar */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center text-amber-700 font-bold text-2xl">
            {profile.name?.[0]?.toUpperCase() || user?.name?.[0]?.toUpperCase() || 'U'}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-800">{profile.name || 'User'}</h2>
            <p className="text-sm text-slate-500">{profile.email}</p>
            <p className="text-xs text-slate-400 mt-0.5 capitalize">{user?.role || 'Admin'}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        <button onClick={() => setTab('profile')} className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'profile' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          <User className="h-3.5 w-3.5" /> Profile
        </button>
        <button onClick={() => setTab('password')} className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'password' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          <Lock className="h-3.5 w-3.5" /> Password
        </button>
      </div>

      {tab === 'profile' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
          <h2 className="text-base font-semibold text-slate-800 mb-4">Personal Information</h2>
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Full Name *</label>
              <input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Email Address</label>
              <input type="email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Phone Number</label>
              <input type="tel" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" />
            </div>
            <button type="submit" disabled={savingProfile} className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-6 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
              <Save className="h-4 w-4" />{savingProfile ? 'Saving...' : 'Save Profile'}
            </button>
          </form>
        </div>
      )}

      {tab === 'password' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
          <h2 className="text-base font-semibold text-slate-800 mb-4">Change Password</h2>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <PasswordField label="Current Password" field="current_password" show={showPasswords.current} onToggle={() => setShowPasswords((s) => ({ ...s, current: !s.current }))} />
            <PasswordField label="New Password" field="new_password" show={showPasswords.new} onToggle={() => setShowPasswords((s) => ({ ...s, new: !s.new }))} />
            <PasswordField label="Confirm New Password" field="confirm_password" show={showPasswords.confirm} onToggle={() => setShowPasswords((s) => ({ ...s, confirm: !s.confirm }))} />
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-xs text-yellow-700">Password must be at least 8 characters long and contain a mix of letters and numbers.</p>
            </div>
            <button type="submit" disabled={savingPassword} className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-6 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
              <Lock className="h-4 w-4" />{savingPassword ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
