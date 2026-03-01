import { cn } from '../../utils/cn'

const variants = {
  paid: 'bg-green-100 text-green-800',
  confirmed: 'bg-green-100 text-green-800',
  completed: 'bg-blue-100 text-blue-800',
  active: 'bg-green-100 text-green-800',
  partial: 'bg-yellow-100 text-yellow-800',
  pending: 'bg-yellow-100 text-yellow-800',
  scheduled: 'bg-purple-100 text-purple-800',
  unpaid: 'bg-red-100 text-red-800',
  cancelled: 'bg-red-100 text-red-800',
  draft: 'bg-gray-100 text-gray-700',
  inactive: 'bg-gray-100 text-gray-600',
  returned: 'bg-orange-100 text-orange-800',
  generated: 'bg-blue-100 text-blue-800',
  failed: 'bg-red-100 text-red-800',
  sent: 'bg-green-100 text-green-800',
  sending: 'bg-blue-100 text-blue-800',
  low_stock: 'bg-orange-100 text-orange-800',
  out_of_stock: 'bg-red-100 text-red-800',
  expiry: 'bg-red-100 text-red-800',
}

export default function StatusBadge({ status, label, className }) {
  const key = (status || '').toLowerCase().replace(' ', '_')
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
      variants[key] || 'bg-gray-100 text-gray-700',
      className
    )}>
      {label || (status ? status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '-')}
    </span>
  )
}
