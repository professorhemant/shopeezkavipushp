import { useState } from 'react'
import { ShieldCheck, X, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { authAPI } from '../../api'

export default function EditOtpModal({ onVerified, onClose }) {
  const [otp, setOtp] = useState('')
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [otpSent, setOtpSent] = useState(false)
  const [maskedPhone, setMaskedPhone] = useState('')
  const [devOtp, setDevOtp] = useState('')

  const requestOtp = async () => {
    setSending(true)
    try {
      const { data } = await authAPI.requestEditOtp()
      setMaskedPhone(data.maskedPhone || '')
      setDevOtp(data.otp || '')
      setOtpSent(true)
      toast.success(`OTP sent to ${data.maskedPhone}`)
    } catch {
      toast.error('Failed to send OTP')
    } finally {
      setSending(false)
    }
  }

  const verifyOtp = async () => {
    if (!otp.trim()) { toast.error('Enter OTP'); return }
    setVerifying(true)
    try {
      await authAPI.verifyEditOtp({ otp: otp.trim() })
      toast.success('OTP verified')
      onVerified()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Invalid or expired OTP')
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
          <h2 className="text-lg font-semibold text-slate-800">Verify to Edit</h2>
          <p className="text-sm text-slate-500">
            {otpSent
              ? `OTP sent to ${maskedPhone}. Enter it below to proceed.`
              : 'An OTP will be sent to your registered mobile number.'}
          </p>
        </div>

        {!otpSent ? (
          <button
            onClick={requestOtp}
            disabled={sending}
            className="w-full flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-xl text-sm"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {sending ? 'Sending OTP…' : 'Send OTP'}
          </button>
        ) : (
          <div className="space-y-3">
            {devOtp && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-center text-sm text-amber-700">
                Your OTP: <span className="font-bold text-lg tracking-widest">{devOtp}</span>
              </div>
            )}
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              placeholder="Enter 6-digit OTP"
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-center text-lg font-semibold tracking-widest focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
              autoFocus
            />
            <button
              onClick={verifyOtp}
              disabled={verifying || otp.length !== 6}
              className="w-full flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-xl text-sm"
            >
              {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {verifying ? 'Verifying…' : 'Verify & Edit'}
            </button>
            <button
              onClick={() => { setOtpSent(false); setOtp(''); setDevOtp('') }}
              className="w-full text-sm text-slate-400 hover:text-slate-600 py-1"
            >
              Resend OTP
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
