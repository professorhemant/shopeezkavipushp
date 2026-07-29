import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Menu, Bell, ChevronDown, User, Settings, LogOut, Building2 } from 'lucide-react'
import useAuthStore from '../../store/authStore'
import { formatDate } from '../../utils/formatters'

export default function Header({ onMobileMenuClick }) {
  const { user, firm, logout } = useAuthStore()
  const [profileOpen, setProfileOpen] = useState(false)
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-6 shrink-0 z-20 sticky top-0">
      {/* Left */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMobileMenuClick}
          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        <span className="text-base font-extrabold tracking-widest uppercase select-none text-amber-600">
          KAVIPUSHP JEWELS
        </span>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">
        <span className="hidden md:block text-xs text-slate-400">
          {formatDate(new Date(), 'EEEE, dd MMM yyyy')}
        </span>

        <button className="relative p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600">
          <Bell className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full" />
        </button>

        <div className="relative">
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <div className="w-7 h-7 bg-amber-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
              {user?.name?.charAt(0)?.toUpperCase() || 'A'}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-xs font-semibold text-slate-700 leading-none">{user?.name || 'Admin'}</p>
              <p className="text-xs text-slate-400 capitalize">{user?.role_name || 'admin'}</p>
            </div>
            <ChevronDown className="h-3 w-3 text-slate-400 hidden sm:block" />
          </button>

          {profileOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setProfileOpen(false)} />
              <div className="absolute right-0 top-full mt-1 w-52 bg-white border border-slate-200 rounded-xl shadow-lg z-20 py-1">
                <div className="px-4 py-3 border-b border-slate-100">
                  <p className="text-sm font-semibold text-slate-800">{user?.name}</p>
                  <p className="text-xs text-slate-500">{user?.email}</p>
                  <p className="text-xs text-amber-600 mt-0.5 font-medium">{firm?.name}</p>
                </div>
                <Link to="/settings/profile" onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                  <User className="h-4 w-4 text-slate-400" /> My Profile
                </Link>
                <Link to="/settings" onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                  <Settings className="h-4 w-4 text-slate-400" /> Settings
                </Link>
                <Link to="/firms" onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                  <Building2 className="h-4 w-4 text-slate-400" /> Switch Firm
                </Link>
                <div className="border-t border-slate-100 mt-1">
                  <button onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-red-600 hover:bg-red-50">
                    <LogOut className="h-4 w-4" /> Sign Out
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
