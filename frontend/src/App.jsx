import { Routes, Route, Navigate } from 'react-router-dom'
import { Suspense, lazy, useEffect, useState } from 'react'
import Layout from './components/layout/Layout'
import useAuthStore from './store/authStore'
import LoadingSpinner from './components/common/LoadingSpinner'

// Lazy-loaded pages
const Login = lazy(() => import('./pages/auth/Login'))
const Register = lazy(() => import('./pages/auth/Register'))
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword'))

const Dashboard = lazy(() => import('./pages/dashboard/Dashboard'))

const Products = lazy(() => import('./pages/inventory/Products'))
const AddProduct = lazy(() => import('./pages/inventory/AddProduct'))
const Categories = lazy(() => import('./pages/inventory/Categories'))
const Brands = lazy(() => import('./pages/inventory/Brands'))
const Units = lazy(() => import('./pages/inventory/Units'))
const StockAlerts = lazy(() => import('./pages/inventory/StockAlerts'))

const Invoices = lazy(() => import('./pages/billing/Invoices'))
const InvoiceDetail = lazy(() => import('./pages/billing/InvoiceDetail'))
const CreateInvoice = lazy(() => import('./pages/billing/CreateInvoice'))
const POS = lazy(() => import('./pages/billing/POS'))
const CreditNotes = lazy(() => import('./pages/billing/CreditNotes'))
const EWayBills = lazy(() => import('./pages/billing/EWayBills'))
const EInvoicing = lazy(() => import('./pages/billing/EInvoicing'))

const Purchases = lazy(() => import('./pages/purchases/Purchases'))
const CreatePurchase = lazy(() => import('./pages/purchases/CreatePurchase'))
const PurchaseOrders = lazy(() => import('./pages/purchases/PurchaseOrders'))

const Customers = lazy(() => import('./pages/customers/Customers'))
const CustomerDetails = lazy(() => import('./pages/customers/CustomerDetails'))

const Suppliers = lazy(() => import('./pages/suppliers/Suppliers'))
const SupplierDetails = lazy(() => import('./pages/suppliers/SupplierDetails'))

const Receivables = lazy(() => import('./pages/accounting/Receivables'))
const Payables = lazy(() => import('./pages/accounting/Payables'))
const Expenses = lazy(() => import('./pages/accounting/Expenses'))
const ProfitLoss = lazy(() => import('./pages/accounting/ProfitLoss'))
const BalanceSheet = lazy(() => import('./pages/accounting/BalanceSheet'))
const FixedAssets = lazy(() => import('./pages/accounting/FixedAssets'))

const Staff = lazy(() => import('./pages/staff/Staff'))
const Roles = lazy(() => import('./pages/staff/Roles'))

const SalesReport = lazy(() => import('./pages/reports/SalesReport'))
const PurchaseReport = lazy(() => import('./pages/reports/PurchaseReport'))
const InventoryReport = lazy(() => import('./pages/reports/InventoryReport'))
const GSTReport = lazy(() => import('./pages/reports/GSTReport'))
const Analytics = lazy(() => import('./pages/reports/Analytics'))

const Appointments = lazy(() => import('./pages/appointments/Appointments'))
const WhatsAppCampaigns = lazy(() => import('./pages/whatsapp/WhatsAppCampaigns'))

const BarcodeGenerator = lazy(() => import('./pages/tools/BarcodeGenerator'))
const QRGenerator = lazy(() => import('./pages/tools/QRGenerator'))
const InvoiceGenerator = lazy(() => import('./pages/tools/InvoiceGenerator'))
const GSTCalculator = lazy(() => import('./pages/tools/GSTCalculator'))

const DayBookSales = lazy(() => import('./pages/daybook/DayBookSales'))
const BridalBookings = lazy(() => import('./pages/daybook/BridalBookings'))
const BridalDispatch = lazy(() => import('./pages/daybook/BridalDispatch'))
const DayBookExpenses = lazy(() => import('./pages/daybook/DayBookExpenses'))
const SecurityRefund = lazy(() => import('./pages/daybook/SecurityRefund'))
const TotalReceived = lazy(() => import('./pages/daybook/TotalReceived'))

const Firms = lazy(() => import('./pages/firms/Firms'))
const Settings = lazy(() => import('./pages/settings/Settings'))
const Profile = lazy(() => import('./pages/settings/Profile'))

// Protected route wrapper
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return children
}

// Role-restricted route wrapper
const RoleRoute = ({ children, allowedRoles }) => {
  const { isAuthenticated, user } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!allowedRoles.includes(user?.role_name)) return <Navigate to="/dashboard" replace />
  return children
}

// Public route wrapper (redirect if logged in)
const PublicRoute = ({ children }) => {
  const { isAuthenticated } = useAuthStore()
  if (isAuthenticated) return <Navigate to="/dashboard" replace />
  return children
}

function App() {
  const { isAuthenticated, checkAuth } = useAuthStore()
  const [validating, setValidating] = useState(isAuthenticated)

  useEffect(() => {
    if (isAuthenticated) {
      checkAuth().finally(() => setValidating(false))
    }
  }, [])

  if (validating) return <LoadingSpinner fullscreen />

  return (
    <Suspense fallback={<LoadingSpinner fullscreen />}>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
        <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />

        {/* Protected routes inside Layout */}
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />

          {/* Inventory */}
          <Route path="inventory/products" element={<Products />} />
          <Route path="inventory/products/add" element={<AddProduct />} />
          <Route path="inventory/products/:id/edit" element={<AddProduct />} />
          <Route path="inventory/categories" element={<Categories />} />
          <Route path="inventory/brands" element={<Brands />} />
          <Route path="inventory/units" element={<Units />} />
          <Route path="inventory/alerts" element={<StockAlerts />} />

          {/* Billing */}
          <Route path="billing/invoices" element={<Invoices />} />
          <Route path="billing/invoices/create" element={<CreateInvoice />} />
          <Route path="billing/invoices/:id" element={<InvoiceDetail />} />
          <Route path="billing/invoices/:id/edit" element={<CreateInvoice />} />
          <Route path="billing/pos" element={<POS />} />
          <Route path="billing/credit-notes" element={<CreditNotes />} />
          <Route path="billing/eway-bills" element={<EWayBills />} />
          <Route path="billing/einvoicing" element={<EInvoicing />} />

          {/* Purchases - restricted to admin/super_admin only */}
          <Route path="purchases" element={<RoleRoute allowedRoles={['super_admin','admin']}><Purchases /></RoleRoute>} />
          <Route path="purchases/create" element={<RoleRoute allowedRoles={['super_admin','admin']}><CreatePurchase /></RoleRoute>} />
          <Route path="purchases/:id/edit" element={<RoleRoute allowedRoles={['super_admin','admin']}><CreatePurchase /></RoleRoute>} />
          <Route path="purchases/orders" element={<RoleRoute allowedRoles={['super_admin','admin']}><PurchaseOrders /></RoleRoute>} />

          {/* Customers */}
          <Route path="customers" element={<Customers />} />
          <Route path="customers/:id" element={<CustomerDetails />} />

          {/* Suppliers */}
          <Route path="suppliers" element={<Suppliers />} />
          <Route path="suppliers/:id" element={<SupplierDetails />} />

          {/* Accounting */}
          <Route path="accounting/receivables" element={<Receivables />} />
          <Route path="accounting/payables" element={<Payables />} />
          <Route path="accounting/expenses" element={<Expenses />} />
          <Route path="accounting/profit-loss" element={<ProfitLoss />} />
          <Route path="accounting/balance-sheet" element={<BalanceSheet />} />
          <Route path="accounting/fixed-assets" element={<FixedAssets />} />

          {/* Staff */}
          <Route path="staff" element={<Staff />} />
          <Route path="staff/roles" element={<Roles />} />

          {/* Reports */}
          <Route path="reports/sales" element={<SalesReport />} />
          <Route path="reports/purchases" element={<PurchaseReport />} />
          <Route path="reports/inventory" element={<InventoryReport />} />
          <Route path="reports/gst" element={<GSTReport />} />
          <Route path="reports/analytics" element={<Analytics />} />

          {/* Appointments */}
          <Route path="appointments" element={<Appointments />} />

          {/* WhatsApp */}
          <Route path="whatsapp/campaigns" element={<WhatsAppCampaigns />} />

          {/* Tools */}
          <Route path="tools/barcode" element={<BarcodeGenerator />} />
          <Route path="tools/qr" element={<QRGenerator />} />
          <Route path="tools/invoice" element={<InvoiceGenerator />} />
          <Route path="tools/gst-calculator" element={<GSTCalculator />} />

          {/* Day Book */}
          <Route path="daybook/sales" element={<DayBookSales />} />
          <Route path="daybook/bridal-bookings" element={<BridalBookings />} />
          <Route path="daybook/bridal-dispatch" element={<BridalDispatch />} />
          <Route path="daybook/expenses" element={<DayBookExpenses />} />
          <Route path="daybook/security-refund" element={<SecurityRefund />} />
          <Route path="daybook/total-received" element={<TotalReceived />} />

          {/* Firms & Settings */}
          <Route path="firms" element={<Firms />} />
          <Route path="settings" element={<Settings />} />
          <Route path="settings/profile" element={<Profile />} />
        </Route>

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  )
}

export default App
