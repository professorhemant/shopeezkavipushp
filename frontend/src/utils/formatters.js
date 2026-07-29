import { format, parseISO } from 'date-fns'

export const formatCurrency = (amount, symbol = '₹') => {
  if (amount === null || amount === undefined) return `${symbol}0.00`
  return `${symbol}${parseFloat(amount).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export const formatDate = (date, fmt = 'dd MMM yyyy') => {
  if (!date) return '-'
  try {
    const d = typeof date === 'string' ? parseISO(date) : date
    return format(d, fmt)
  } catch {
    return date
  }
}

export const formatDateTime = (date) => formatDate(date, 'dd MMM yyyy, hh:mm a')

export const formatNumber = (n, decimals = 2) =>
  parseFloat(n || 0).toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })

export const formatPercent = (n) => `${parseFloat(n || 0).toFixed(2)}%`

export const truncate = (str, length = 30) =>
  str && str.length > length ? `${str.substring(0, length)}...` : str

export const capitalize = (str) =>
  str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : ''

export const phoneFormat = (phone) => {
  if (!phone) return '-'
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.length === 10) return `+91 ${cleaned.slice(0, 5)} ${cleaned.slice(5)}`
  return phone
}

export const gstinFormat = (gstin) => {
  if (!gstin || gstin.length !== 15) return gstin
  return gstin.toUpperCase()
}

export const getPaymentStatusColor = (status) => ({
  paid: 'bg-green-100 text-green-800',
  partial: 'bg-yellow-100 text-yellow-800',
  unpaid: 'bg-red-100 text-red-800',
}[status] || 'bg-gray-100 text-gray-800')

export const getStatusColor = (status) => ({
  active: 'bg-green-100 text-green-800',
  confirmed: 'bg-green-100 text-green-800',
  completed: 'bg-blue-100 text-blue-800',
  draft: 'bg-gray-100 text-gray-800',
  cancelled: 'bg-red-100 text-red-800',
  pending: 'bg-yellow-100 text-yellow-800',
  scheduled: 'bg-purple-100 text-purple-800',
}[status] || 'bg-gray-100 text-gray-800')
