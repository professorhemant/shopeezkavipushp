import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Printer, Users, ShoppingCart,
  Settings, FileText, Boxes, Plus
} from 'lucide-react'
import useAuthStore from '../../store/authStore'

const TABS = [
  { label: 'Dashboard',       to: '/dashboard',               icon: LayoutDashboard },
  { label: 'Customers',       to: '/customers',               icon: Users           },
  { label: 'Orders',          to: '/billing/invoices',        icon: ShoppingCart    },
  { label: 'Create Invoice',  to: '/billing/invoices/create', icon: Plus            },
  { label: 'Products',        to: '/inventory/products',      icon: Boxes           },
  { label: 'Purchase Orders', to: '/purchases/orders',        icon: FileText        },
  { label: 'Settings',        to: '/settings',                icon: Settings        },
]

export default function QuickNavBar() {
  const { user } = useAuthStore()

  return (
    <div className="shrink-0 bg-slate-800 px-3 overflow-x-auto border-b border-slate-700">
      <div className="flex items-center min-w-max gap-0.5 py-1.5">
        {TABS.map((tab) => {
          const Icon = tab.icon
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.to === '/dashboard'}
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium whitespace-nowrap rounded transition-colors ${
                  isActive
                    ? 'bg-amber-500 text-white'
                    : 'text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                }`
              }
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span>{tab.label}</span>
            </NavLink>
          )
        })}

        <div className="ml-auto pl-4 pr-1 text-xs whitespace-nowrap flex items-center gap-1.5">
          <span className="text-slate-500">Logged as</span>
          <span className="bg-amber-500/20 text-amber-400 font-semibold px-2 py-0.5 rounded text-xs">
            {user?.name || 'Admin'}
          </span>
        </div>
      </div>
    </div>
  )
}
