import { Phone } from 'lucide-react'

// Shared invoice letterhead — centered firm name, address and "Phone … | email"
// over a gold rule. Everything is pulled from the firm (Firm Settings) so the
// header is identical on every invoice (bridal, sales PDF preview, tools).
export default function InvoiceLetterhead({ firm }) {
  const addr = [firm?.address, firm?.city, firm?.state].filter(Boolean).join(', ')
  const phone = firm?.phone
  const email = firm?.email
  return (
    <div className="text-center border-b-2 border-amber-600 pb-3">
      <h2 className="text-xl font-bold text-slate-900">{firm?.name || 'Kavipushp Jewels'}</h2>
      {addr && <p className="text-xs text-slate-500 mt-1">{addr}</p>}
      {(phone || email) && (
        <p className="text-xs text-slate-500 mt-0.5 flex items-center justify-center gap-1 flex-wrap">
          {phone && (
            <span className="inline-flex items-center gap-1">
              <Phone className="h-3 w-3" /> Phone: {phone}
            </span>
          )}
          {phone && email && <span className="px-1">|</span>}
          {email && <span>{email}</span>}
        </p>
      )}
    </div>
  )
}
