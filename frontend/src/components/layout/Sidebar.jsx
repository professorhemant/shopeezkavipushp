import { useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Package, ShoppingCart, Users, Truck,
  UserCog, BarChart3, Settings, Building2, ChevronDown,
  ChevronRight, X, FileText, AlertTriangle, TrendingUp,
  Clipboard, Tag, Layers, Boxes, Receipt, CreditCard,
  PieChart, Wallet, Shield, Send, QrCode, ScanBarcode,
  Calculator, FileSpreadsheet, Zap, User, DollarSign,
  Landmark, Wrench, Store, Hammer, Warehouse, BookOpen,
  ClipboardList, Factory, MessageSquare, Calendar,
  BarChart2
} from 'lucide-react'
import useAuthStore from '../../store/authStore'

// ─── Menu structure (matches kavipushp.shoppeez.com) ─────────────
const MENU = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    path: '/dashboard',
  },
  {
    id: 'customers',
    label: 'Customers',
    icon: Users,
    path: '/customers',
  },
  {
    id: 'invoices',
    label: 'Invoices',
    icon: Receipt,
    path: '/billing/invoices',
  },
  {
    id: 'sales',
    label: 'Sales',
    icon: TrendingUp,
    children: [
      { label: 'Estimates',         path: '/billing/invoices',       icon: FileText,     noActive: true },
      { label: 'Credit Notes',      path: '/billing/credit-notes',   icon: CreditCard },
      { label: 'Job Cards',         path: '/billing/pos',            icon: ClipboardList },
      { label: 'Delivery Chalans',  path: '/billing/eway-bills',     icon: Truck },
      { label: 'Fast Bills',        path: '/billing/pos',            icon: Zap,          noActive: true },
    ],
  },
  {
    id: 'inventory',
    label: 'Inventory',
    icon: Package,
    children: [
      { label: 'Products',          path: '/inventory/products',   icon: Boxes },
      { label: 'Expiring Products', path: '/inventory/alerts',     icon: AlertTriangle },
      { label: 'Variant Options',   path: '/inventory/products',   icon: Layers,      noActive: true },
      { label: 'Categories',        path: '/inventory/categories', icon: Tag },
      { label: 'Brands',            path: '/inventory/brands',     icon: BookOpen },
      { label: 'Units',             path: '/inventory/units',      icon: Clipboard },
      { label: 'Racks',             path: '/inventory/products',   icon: Warehouse,   noActive: true },
      { label: 'Warehouses',        path: '/inventory/products',   icon: Warehouse,   noActive: true },
      { label: 'Catalogues',        path: '/inventory/products',   icon: BookOpen,    noActive: true },
      { label: 'Stock Audits',      path: '/inventory/alerts',     icon: ClipboardList, noActive: true },
      { label: 'Mfg Dashboard',     path: '/dashboard',            icon: Factory,     noActive: true },
    ],
  },
  {
    id: 'purchase',
    label: 'Purchase',
    icon: ShoppingCart,
    children: [
      { label: 'Purchase Invoices', path: '/purchases',        icon: FileText },
      { label: 'Purchase Orders',   path: '/purchases/orders', icon: Clipboard },
    ],
  },
  {
    id: 'accounting',
    label: 'Bank & Cash Account',
    icon: Landmark,
    children: [
      { label: 'Receivables',   path: '/accounting/receivables',   icon: TrendingUp },
      { label: 'Payables',      path: '/accounting/payables',      icon: DollarSign },
      { label: 'Expenses',      path: '/accounting/expenses',      icon: Wallet },
      { label: 'Profit & Loss', path: '/accounting/profit-loss',   icon: PieChart },
      { label: 'Balance Sheet', path: '/accounting/balance-sheet', icon: BarChart2 },
      { label: 'Fixed Assets',  path: '/accounting/fixed-assets',  icon: Building2 },
    ],
  },
  {
    id: 'rental',
    label: 'Rental Module',
    icon: Store,
    children: [
      { label: 'Appointments',  path: '/appointments',        icon: Calendar },
      { label: 'WhatsApp',      path: '/whatsapp/campaigns',  icon: MessageSquare },
    ],
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    children: [
      { label: 'Company Settings',    path: '/settings',         icon: Building2 },
      { label: 'My Profile',          path: '/settings/profile', icon: UserCog },
      { label: 'Staff',               path: '/staff',            icon: Users },
      { label: 'Roles & Permissions', path: '/staff/roles',      icon: Shield },
      { label: 'Barcode Generator',   path: '/tools/barcode',    icon: ScanBarcode },
      { label: 'GST Calculator',      path: '/tools/gst-calculator', icon: Calculator },
    ],
  },
  {
    id: 'shipping',
    label: 'Shipping Settings',
    icon: Truck,
    children: [
      { label: 'Reports',           path: '/reports/sales',      icon: BarChart2 },
      { label: 'Purchase Report',   path: '/reports/purchases',  icon: ShoppingCart },
      { label: 'GST Report',        path: '/reports/gst',        icon: FileSpreadsheet },
      { label: 'Analytics',         path: '/reports/analytics',  icon: PieChart },
    ],
  },
]

// ─── Single menu item ─────────────────────────────────────────────
function MenuItem({ item }) {
  const location = useLocation()

  const hasActiveChild = item.children?.some((c) =>
    !c.noActive && (location.pathname === c.path || location.pathname.startsWith(c.path + '/'))
  )

  const [expanded, setExpanded] = useState(() => hasActiveChild ?? false)

  const Icon = item.icon

  // Leaf item (no children)
  if (!item.children) {
    return (
      <NavLink
        to={item.path}
        className={({ isActive }) =>
          `flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors border-b border-white/5 ${
            isActive
              ? 'bg-blue-600 text-white'
              : 'text-gray-200 hover:bg-white/10 hover:text-white'
          }`
        }
      >
        <Icon className="h-[18px] w-[18px] shrink-0" />
        <span className="truncate">{item.label}</span>
      </NavLink>
    )
  }

  // Parent item (has children)
  return (
    <div>
      <button
        onClick={() => setExpanded((v) => !v)}
        className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors border-b border-white/5 ${
          hasActiveChild
            ? 'bg-blue-700/60 text-white'
            : 'text-gray-200 hover:bg-white/10 hover:text-white'
        }`}
      >
        <Icon className="h-[18px] w-[18px] shrink-0" />
        <span className="flex-1 text-left truncate">{item.label}</span>
        {expanded
          ? <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
          : <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />
        }
      </button>

      {expanded && (
        <div className="bg-black/20">
          {item.children.map((child) => {
            const isActive = !child.noActive && (
              location.pathname === child.path ||
              location.pathname.startsWith(child.path + '/')
            )
            return (
              <NavLink
                key={child.path}
                to={child.path}
                className={`flex items-center gap-3 pl-10 pr-4 py-2.5 text-sm border-b border-white/5 transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white font-medium'
                    : 'text-gray-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                <span className="truncate">{child.label}</span>
              </NavLink>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Sidebar component ────────────────────────────────────────────
export default function Sidebar({ mobileOpen, onMobileClose }) {
  const { firm, user } = useAuthStore()
  const navigate = useNavigate()

  const SidebarContent = ({ onClose }) => (
    <div className="flex flex-col h-full" style={{ background: '#0f2238' }}>
      {/* Logo / Brand */}
      <div className="flex items-center justify-between px-4 h-16 shrink-0 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-500 flex items-center justify-center text-white font-bold text-base shrink-0">
            {(firm?.name || 'S').charAt(0).toUpperCase()}
          </div>
          <div className="overflow-hidden">
            <p className="font-bold text-white truncate text-sm leading-tight">
              {firm?.name || 'Shopeezkavipushp'}
            </p>
            <p className="text-xs text-blue-300 truncate">Admin Panel</p>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-white hover:bg-white/10 lg:hidden">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto">
        {MENU.map((item) => (
          <MenuItem key={item.id} item={item} />
        ))}
      </nav>

      {/* Bottom: firm/user info */}
      <div
        className="flex items-center gap-3 px-4 py-3 border-t border-white/10 shrink-0 cursor-pointer hover:bg-white/10 transition-colors"
        onClick={() => navigate('/settings/profile')}
      >
        <div className="w-8 h-8 rounded-full bg-blue-500/40 flex items-center justify-center shrink-0">
          <User className="h-4 w-4 text-white" />
        </div>
        <div className="flex-1 overflow-hidden">
          <p className="text-sm font-medium text-white truncate">{firm?.name || 'My Firm'}</p>
          <p className="text-xs text-gray-400 truncate">{user?.email || ''}</p>
        </div>
        <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar — always visible */}
      <aside className="fixed top-0 left-0 h-full w-64 z-30 hidden lg:flex flex-col">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar */}
      <aside className={`fixed top-0 left-0 h-full w-72 z-50 flex flex-col transition-transform duration-300 lg:hidden ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <SidebarContent onClose={onMobileClose} />
      </aside>
    </>
  )
}
