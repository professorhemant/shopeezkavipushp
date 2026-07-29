import { useState } from 'react'
import { ShieldCheck, X, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { verifyCredentials } from '../../api'
import useAuthStore from '../../store/authStore'

// Re-verify the user's account (email + password) before allowing an edit.
// Uses verifyCredentials() (bare axios -> /auth/login) so it does NOT disturb
// the current session. Keeps the same props as before (onVerified/onClose/actionLabel).
export default function EditOtpModal({ onVerified, onClose, actionLabel = 'Edit' }) {
  const user = useAuthStore((s) => s.user)
  const [email, setEmail] = useState(user?.email || '')
  const [password, setPassword] = useState('')
  const [verifying, setVerifying] = useState(false)
  // read-only until the user focuses it — reliably blocks browser password autofill
  const [pwReadOnly, setPwReadOnly] = useState(true)

  const verify = async (e) => {
    e?.preventDefault?.()
    if (!email.trim() || !password) { toast.error('Enter email and password'); return }
    setVerifying(true)
    try {
      await verifyCredentials({ email: email.trim(), password })
      toast.success('Verified')
      onVerified()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Invalid email or password')
    } finally {
      setVerifying(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
          <X className="h-5 w-5" />
        </button>

        <div className="flex flex-col items-center text-center gap-3 mb-5">
          <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center">
            <ShieldCheck className="h-7 w-7 text-amber-600" />
          </div>
          <h2 className="text-lg font-semibold text-slate-800">Verify to {actionLabel}</h2>
          <p className="text-sm text-slate-500">Confirm your account email &amp; password to continue.</p>
        </div>

        <form onSubmit={verify} className="space-y-3">
          <input
            type="email"
            name="verify_email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            autoComplete="off"
            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
          />
          {/* hidden dummy fields absorb Chrome's autofill so the real password starts empty */}
          <input type="text" name="username" autoComplete="username" className="hidden" tabIndex={-1} aria-hidden="true" />
          <input
            type="password"
            name="verify_password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoComplete="new-password"
            readOnly={pwReadOnly}
            onFocus={() => setPwReadOnly(false)}
            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
          />
          <button
            type="submit"
            disabled={verifying || !email.trim() || !password}
            className="w-full flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-xl text-sm"
          >
            {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {verifying ? 'Verifying…' : `Verify & ${actionLabel}`}
          </button>
        </form>
      </div>
    </div>
  )
}
