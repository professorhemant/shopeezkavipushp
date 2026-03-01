import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Printer, Users, ShoppingCart,
  Settings, FileText, Boxes
} from 'lucide-react'
import useAuthStore from '../../store/authStore'

const TABS = [
  { label: 'Dashboard',       to: '/dashboard',                icon: LayoutDashboard, color: 'bg-sky-400',      shadow: 'shadow-sky-400/60'      },
  { label: 'Print Settings',  to: '/settings/print',           icon: Printer,         color: 'bg-purple-400',   shadow: 'shadow-purple-400/60'   },
  { label: 'Customers',       to: '/customers',                icon: Users,           color: 'bg-emerald-400',  shadow: 'shadow-emerald-400/60'  },
  { label: 'Orders',          to: '/billing/invoices',         icon: ShoppingCart,    color: 'bg-amber-400',    shadow: 'shadow-amber-400/60'    },
  { label: 'Purchase Orders', to: '/purchases/orders',         icon: FileText,        color: 'bg-violet-400',   shadow: 'shadow-violet-400/60'   },
  { label: 'Store Settings',  to: '/settings',                 icon: Settings,        color: 'bg-pink-400',     shadow: 'shadow-pink-400/60'     },
  { label: 'Create Invoice',  to: '/billing/invoices/create',  icon: FileText,        color: 'bg-rose-400',     shadow: 'shadow-rose-400/60'     },
  { label: 'Products',        to: '/inventory/products',       icon: Boxes,           color: 'bg-teal-400',     shadow: 'shadow-teal-400/60'     },
]

export default function QuickNavBar() {
  const { user } = useAuthStore()

  return (
    <div className="shrink-0 bg-gradient-to-r from-blue-900 via-blue-800 to-blue-900 px-3 overflow-x-auto shadow-lg">
      <div className="flex items-center min-w-max gap-1.5 py-2">
        {TABS.map((tab) => {
          const Icon = tab.icon
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.to === '/dashboard'}
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold whitespace-nowrap rounded-md transition-all duration-200 text-white ${tab.color} ${
                  isActive
                    ? `opacity-100 shadow-lg ${tab.shadow} scale-105`
                    : `opacity-100 hover:scale-105 hover:shadow-md ${tab.shadow}`
                }`
              }
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span>{tab.label}</span>
            </NavLink>
          )
        })}

        {/* Logged as Admin */}
        <div className="ml-auto pl-6 pr-2 text-xs whitespace-nowrap flex items-center gap-1.5">
          <span className="text-blue-300">Logged as</span>
          <span className="bg-white/10 text-white font-bold px-2 py-0.5 rounded-full text-xs">
            {user?.name || 'Admin'}
          </span>
        </div>
      </div>
    </div>
  )
}
