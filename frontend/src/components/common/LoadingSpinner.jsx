import { cn } from '../../utils/cn'

export default function LoadingSpinner({ size = 'md', fullscreen = false, className }) {
  const sizes = { sm: 'h-4 w-4', md: 'h-8 w-8', lg: 'h-12 w-12' }

  const spinner = (
    <div className={cn(
      'animate-spin rounded-full border-2 border-gray-300 border-t-blue-600',
      sizes[size],
      className
    )} />
  )

  if (fullscreen) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white/80 z-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
          <p className="text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    )
  }

  return spinner
}
