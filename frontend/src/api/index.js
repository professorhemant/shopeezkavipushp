import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : (import.meta.env.DEV ? '/api' : 'https://backend-production-59b25.up.railway.app/api')

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
})

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Handle auth errors globally
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      localStorage.removeItem('auth-storage')
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default api

// ─── Auth ───────────────────────────────────────────────────────────
export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  forgotPassword: (data) => api.post('/auth/forgot-password', data),
  resetPassword: (data) => api.post('/auth/reset-password', data),
  getProfile: () => api.get('/auth/profile'),
  updateProfile: (data) => api.put('/auth/profile', data),
  changePassword: (data) => api.put('/auth/change-password', data),
  requestEditOtp: () => api.post('/auth/request-edit-otp'),
  verifyEditOtp: (data) => api.post('/auth/verify-edit-otp', data),
}

// ─── Dashboard ──────────────────────────────────────────────────────
export const dashboardAPI = {
  getStats: () => api.get('/dashboard/stats'),
  getSalesChart: (period) => api.get('/dashboard/sales-chart', { params: { period } }),
  getLatestInvoices: () => api.get('/dashboard/latest-invoices'),
  getTopCustomers: () => api.get('/dashboard/top-customers'),
  getBestSelling: () => api.get('/dashboard/best-selling'),
  getLeastSelling: () => api.get('/dashboard/least-selling'),
  getLatestReceipts: () => api.get('/dashboard/latest-receipts'),
}

// ─── Products ───────────────────────────────────────────────────────
export const productAPI = {
  getAll: (params) => api.get('/products', { params }),
  getOne: (id) => api.get(`/products/${id}`),
  create: (data) => api.post('/products', data),
  update: (id, data) => api.put(`/products/${id}`, data),
  delete: (id) => api.delete(`/products/${id}`),
  updateStock: (id, data) => api.post(`/products/${id}/stock`, data),
  getLowStock: () => api.get('/products/low-stock'),
  generateBarcode: (id) => api.get(`/products/${id}/barcode`),
  bulkImport: (data) => api.post('/products/bulk-import', data),
}

// ─── Categories ─────────────────────────────────────────────────────
export const categoryAPI = {
  getAll: (params) => api.get('/categories', { params }),
  create: (data) => api.post('/categories', data),
  update: (id, data) => api.put(`/categories/${id}`, data),
  delete: (id) => api.delete(`/categories/${id}`),
}

// ─── Brands ─────────────────────────────────────────────────────────
export const brandAPI = {
  getAll: (params) => api.get('/brands', { params }),
  create: (data) => api.post('/brands', data),
  update: (id, data) => api.put(`/brands/${id}`, data),
  delete: (id) => api.delete(`/brands/${id}`),
}

// ─── Units ──────────────────────────────────────────────────────────
export const unitAPI = {
  getAll: () => api.get('/units'),
  create: (data) => api.post('/units', data),
  update: (id, data) => api.put(`/units/${id}`, data),
  delete: (id) => api.delete(`/units/${id}`),
}

// ─── Customers ──────────────────────────────────────────────────────
export const customerAPI = {
  getAll: (params) => api.get('/customers', { params }),
  getOne: (id) => api.get(`/customers/${id}`),
  create: (data) => api.post('/customers', data),
  update: (id, data) => api.put(`/customers/${id}`, data),
  delete: (id) => api.delete(`/customers/${id}`),
  getLedger: (id, params) => api.get(`/customers/${id}/ledger`, { params }),
  getOutstanding: () => api.get('/customers/outstanding'),
}

// ─── Suppliers ──────────────────────────────────────────────────────
export const supplierAPI = {
  getAll: (params) => api.get('/suppliers', { params }),
  getOne: (id) => api.get(`/suppliers/${id}`),
  create: (data) => api.post('/suppliers', data),
  update: (id, data) => api.put(`/suppliers/${id}`, data),
  delete: (id) => api.delete(`/suppliers/${id}`),
  getLedger: (id, params) => api.get(`/suppliers/${id}/ledger`, { params }),
}

// ─── Sales ──────────────────────────────────────────────────────────
export const saleAPI = {
  getAll: (params) => api.get('/sales', { params }),
  getOne: (id) => api.get(`/sales/${id}`),
  create: (data) => api.post('/sales', data),
  update: (id, data) => api.put(`/sales/${id}`, data),
  cancel: (id) => api.put(`/sales/${id}/cancel`),
  delete: (id) => api.delete(`/sales/${id}`),
  return: (id, data) => api.post(`/sales/${id}/return`, data),
  addPayment: (id, data) => api.post(`/sales/${id}/payment`, data),
  generatePDF: (id) => api.get(`/sales/${id}/pdf`, { responseType: 'blob' }),
  getNextInvoiceNo: () => api.get('/sales/next-invoice-no'),
}

// ─── Purchases ──────────────────────────────────────────────────────
export const purchaseAPI = {
  getAll: (params) => api.get('/purchases', { params }),
  getOne: (id) => api.get(`/purchases/${id}`),
  create: (data) => api.post('/purchases', data),
  update: (id, data) => api.put(`/purchases/${id}`, data),
  cancel: (id) => api.put(`/purchases/${id}/cancel`),
  delete: (id) => api.delete(`/purchases/${id}`),
  addPayment: (id, data) => api.post(`/purchases/${id}/payment`, data),
}

// ─── Inventory ──────────────────────────────────────────────────────
export const inventoryAPI = {
  getStockSummary: (params) => api.get('/inventory/stock', { params }),
  getLowStockAlerts: () => api.get('/inventory/alerts/low-stock'),
  getExpiryAlerts: (days) => api.get('/inventory/alerts/expiry', { params: { days } }),
  getStockLedger: (productId, params) => api.get(`/inventory/ledger/${productId}`, { params }),
  adjustStock: (data) => api.post('/inventory/adjust', data),
  resetAllInventory: () => api.delete('/inventory/reset-all'),
}

// ─── Accounting ─────────────────────────────────────────────────────
export const accountingAPI = {
  getReceivables: () => api.get('/accounting/receivables'),
  getPayables: () => api.get('/accounting/payables'),
  getProfitLoss: (params) => api.get('/accounting/profit-loss', { params }),
  getBalanceSheet: (params) => api.get('/accounting/balance-sheet', { params }),
  getExpenses: (params) => api.get('/accounting/expenses', { params }),
  createExpense: (data) => api.post('/accounting/expenses', data),
  updateExpense: (id, data) => api.put(`/accounting/expenses/${id}`, data),
  deleteExpense: (id) => api.delete(`/accounting/expenses/${id}`),
  getFixedAssets: () => api.get('/accounting/fixed-assets'),
  createFixedAsset: (data) => api.post('/accounting/fixed-assets', data),
  updateFixedAsset: (id, data) => api.put(`/accounting/fixed-assets/${id}`, data),
  deleteFixedAsset: (id) => api.delete(`/accounting/fixed-assets/${id}`),
}

// ─── Staff ──────────────────────────────────────────────────────────
export const staffAPI = {
  getAll: () => api.get('/staff'),
  getOne: (id) => api.get(`/staff/${id}`),
  create: (data) => api.post('/staff', data),
  update: (id, data) => api.put(`/staff/${id}`, data),
  deactivate: (id) => api.post(`/staff/${id}/deactivate`),
  reactivate: (id) => api.post(`/staff/${id}/reactivate`),
  remove: (id) => api.delete(`/staff/${id}`),
  getRoles: () => api.get('/staff/roles'),
  createRole: (data) => api.post('/staff/roles', data),
  updateRole: (id, data) => api.put(`/staff/roles/${id}`, data),
  deleteRole: (id) => api.delete(`/staff/roles/${id}`),
  getPermissions: () => api.get('/staff/permissions'),
}

// ─── Reports ────────────────────────────────────────────────────────
export const reportAPI = {
  getSales: (params) => api.get('/reports/sales', { params }),
  getPurchases: (params) => api.get('/reports/purchases', { params }),
  getInventory: (params) => api.get('/reports/inventory', { params }),
  getGST: (params) => api.get('/reports/gst', { params }),
  getTopProducts: (params) => api.get('/reports/top-products', { params }),
  getTopCustomers: (params) => api.get('/reports/top-customers', { params }),
}

// ─── Appointments ───────────────────────────────────────────────────
export const appointmentAPI = {
  getAll: (params) => api.get('/appointments', { params }),
  getOne: (id) => api.get(`/appointments/${id}`),
  create: (data) => api.post('/appointments', data),
  update: (id, data) => api.put(`/appointments/${id}`, data),
  cancel: (id) => api.post(`/appointments/${id}/cancel`),
  complete: (id) => api.post(`/appointments/${id}/complete`),
  getToday: () => api.get('/appointments/today'),
}

// ─── WhatsApp ───────────────────────────────────────────────────────
export const whatsappAPI = {
  getCampaigns: () => api.get('/whatsapp/campaigns'),
  createCampaign: (data) => api.post('/whatsapp/campaigns', data),
  sendCampaign: (id) => api.post(`/whatsapp/campaigns/${id}/send`),
  sendMessage: (data) => api.post('/whatsapp/send', data),
  sendInvoice: (saleId) => api.post(`/whatsapp/send-invoice/${saleId}`),
  getCustomerMessages: (customerId) => api.get(`/whatsapp/customer/${customerId}/messages`),
}

// ─── Settings ───────────────────────────────────────────────────────
export const settingsAPI = {
  getSettings: () => api.get('/settings'),
  updateSettings: (data) => api.put('/settings', data),
  getFirm: () => api.get('/settings/firm'),
  updateFirm: (data) => api.put('/settings/firm', data),
}

// ─── GST Tools ──────────────────────────────────────────────────────
export const gstAPI = {
  calculate: (data) => api.post('/gst/calculate', data),
  getGSTR1: (params) => api.get('/gst/gstr1', { params }),
  generateEInvoice: (saleId) => api.post(`/gst/einvoice/${saleId}`),
  generateEWayBill: (saleId, data) => api.post(`/gst/ewaybill/${saleId}`, data),
}

// ─── Day Book ────────────────────────────────────────────────────────
export const dayBookAPI = {
  getConfig: (date) => api.get('/daybook/config', { params: { date } }),
  updateConfig: (data) => api.put('/daybook/config', data),
  getSummary: (date) => api.get('/daybook/summary', { params: { date } }),
  getSales: (date) => api.get('/daybook/sales', { params: { date } }),
  createSale: (data) => api.post('/daybook/sales', data),
  updateSale: (id, data) => api.put(`/daybook/sales/${id}`, data),
  deleteSale: (id) => api.delete(`/daybook/sales/${id}`),
  getBridalBookings: (date) => api.get('/daybook/bridal-bookings', { params: { date } }),
  createBridalBooking: (data) => api.post('/daybook/bridal-bookings', data),
  updateBridalBooking: (id, data) => api.put(`/daybook/bridal-bookings/${id}`, data),
  deleteBridalBooking: (id) => api.delete(`/daybook/bridal-bookings/${id}`),
  getBridalDispatch: (date) => api.get('/daybook/bridal-dispatch', { params: { date } }),
  createBridalDispatch: (data) => api.post('/daybook/bridal-dispatch', data),
  updateBridalDispatch: (id, data) => api.put(`/daybook/bridal-dispatch/${id}`, data),
  deleteBridalDispatch: (id) => api.delete(`/daybook/bridal-dispatch/${id}`),
  getExpenses: (date) => api.get('/daybook/expenses', { params: { date } }),
  createExpense: (data) => api.post('/daybook/expenses', data),
  updateExpense: (id, data) => api.put(`/daybook/expenses/${id}`, data),
  deleteExpense: (id) => api.delete(`/daybook/expenses/${id}`),
  getSecurityRefunds: (date) => api.get('/daybook/security-refunds', { params: { date } }),
  createSecurityRefund: (data) => api.post('/daybook/security-refunds', data),
  updateSecurityRefund: (id, data) => api.put(`/daybook/security-refunds/${id}`, data),
  deleteSecurityRefund: (id) => api.delete(`/daybook/security-refunds/${id}`),
}

// ─── Tools ──────────────────────────────────────────────────────────
export const toolsAPI = {
  generateBarcode: (data) => api.post('/tools/barcode', data),
  generateQR: (data) => api.post('/tools/qr', data),
}
