import { cn } from '../../utils/cn'

const variants = {
  // Success — emerald
  paid:        'bg-emerald-50 text-emerald-700',
  confirmed:   'bg-emerald-50 text-emerald-700',
  completed:   'bg-emerald-50 text-emerald-700',
  active:      'bg-emerald-50 text-emerald-700',
  sent:        'bg-emerald-50 text-emerald-700',
  generated:   'bg-emerald-50 text-emerald-700',
  // Warning — amber
  partial:     'bg-amber-50  text-amber-700',
  pending:     'bg-amber-50  text-amber-700',
  scheduled:   'bg-amber-50  text-amber-700',
  sending:     'bg-amber-50  text-amber-700',
  low_stock:   'bg-amber-50  text-amber-700',
  returned:    'bg-amber-50  text-amber-700',
  // Danger — red
  unpaid:      'bg-red-50    text-red-700',
  cancelled:   'bg-red-50    text-red-700',
  failed:      'bg-red-50    text-red-700',
  out_of_stock:'bg-red-50    text-red-700',
  expiry:      'bg-red-50    text-red-700',
  // Neutral — slate
  draft:       'bg-slate-100 text-slate-600',
  inactive:    'bg-slate-100 text-slate-600',
}

export default function StatusBadge({ status, label, className }) {
  const key = (status || '').toLowerCase().replace(/\s+/g, '_')
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
      variants[key] || 'bg-slate-100 text-slate-600',
      className
    )}>
      {label || (status ? status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '-')}
    </span>
  )
}
