import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { authAPI } from '../../api'

export default function ForgotPassword() {
  const [step, setStep] = useState(1) // 1=email, 2=otp+new password
  const [email, setEmail] = useState('')
  const { register, handleSubmit, formState: { isSubmitting } } = useForm()

  const onRequestOTP = async (values) => {
    try {
      await authAPI.forgotPassword(values)
      setEmail(values.email)
      setStep(2)
      toast.success('OTP sent to your email/phone')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send OTP')
    }
  }

  const onResetPassword = async (values) => {
    try {
      await authAPI.resetPassword({ ...values, email })
      toast.success('Password reset successfully!')
      window.location.href = '/login'
    } catch (err) {
      toast.error(err.response?.data?.error || 'Reset failed')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <span className="text-white text-xl font-bold">S</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900">Reset Password</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          {step === 1 ? (
            <form onSubmit={handleSubmit(onRequestOTP)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email / Mobile</label>
                <input {...register('email', { required: true })} placeholder="Enter your email or mobile"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <button type="submit" disabled={isSubmitting}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl">
                {isSubmitting ? 'Sending...' : 'Send OTP'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleSubmit(onResetPassword)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Enter OTP</label>
                <input {...register('otp', { required: true })} placeholder="6-digit OTP"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-center tracking-widest font-mono text-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">New Password</label>
                <input {...register('password', { required: true })} type="password" placeholder="New password"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <button type="submit" disabled={isSubmitting}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl">
                {isSubmitting ? 'Resetting...' : 'Reset Password'}
              </button>
            </form>
          )}

          <p className="text-center text-sm text-gray-500 mt-4">
            <Link to="/login" className="text-blue-600 hover:underline">Back to Login</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
