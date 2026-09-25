import { useEffect, useState } from 'react'
import { Save, Settings as SettingsIcon, Bell, Printer, CreditCard, Globe, Smartphone, Building2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { settingsAPI } from '../../api'
import LoadingSpinner from '../../components/common/LoadingSpinner'

const TABS = [
  { key: 'general',      label: 'General',         icon: SettingsIcon },
  { key: 'invoice',      label: 'Invoice',          icon: Printer },
  { key: 'tax',          label: 'Tax & GST',        icon: CreditCard },
  { key: 'payment',      label: 'Payment Details',  icon: Smartphone },
  { key: 'notifications',label: 'Notifications',    icon: Bell },
]

export default function Settings() {
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('general')

  useEffect(() => {
    settingsAPI.getSettings()
      .then(({ data }) => setSettings(data.data || data.settings || data))
      .catch(() => toast.error('Failed to load settings data'))
      .finally(() => setLoading(false))
  }, [])

  const updateSetting = (key, value) => setSettings((s) => ({ ...s, [key]: value }))

  const handleSave = async () => {
    setSaving(true)
    try {
      await settingsAPI.updateSettings(settings)
      toast.success('Settings saved')
    } catch {
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="flex items-center justify-center py-32"><LoadingSpinner size="lg" /></div>

  const s = settings || {}

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Settings</h1>
          <p className="text-sm text-slate-500 mt-0.5">Configure your application preferences</p>
        </div>
        <button onClick={handleSave} disabled={saving} className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50">
          <Save className="h-4 w-4" />{saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      <div className="flex gap-6">
        {/* Sidebar Tabs */}
        <div className="w-48 flex-shrink-0">
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            {TABS.map(({ key, label, icon: Icon }) => (
              <button key={key} onClick={() => setActiveTab(key)} className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors text-left ${activeTab === key ? 'bg-amber-50 text-amber-700 font-medium border-l-2 border-amber-600' : 'text-slate-600 hover:bg-slate-50'}`}>
                <Icon className="h-4 w-4 flex-shrink-0" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Settings Panel */}
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-100 p-6">
          {activeTab === 'general' && (
            <div className="space-y-6">
              <h2 className="text-base font-semibold text-slate-800">General Settings</h2>
              <div className="grid grid-cols-2 gap-4">
                <Setting label="Business Name" value={s.business_name} onChange={(v) => updateSetting('business_name', v)} />
                <Setting label="Currency Symbol" value={s.currency_symbol || '₹'} onChange={(v) => updateSetting('currency_symbol', v)} />
                <Setting label="Date Format" value={s.date_format} onChange={(v) => updateSetting('date_format', v)} as="select" options={['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD']} />
                <Setting label="Fiscal Year Start" value={s.fiscal_year_start || 'April'} onChange={(v) => updateSetting('fiscal_year_start', v)} as="select" options={['April', 'January', 'July', 'October']} />
                <Setting label="Language" value={s.language || 'en'} onChange={(v) => updateSetting('language', v)} as="select" options={['en']} labels={['English']} />
                <Setting label="Timezone" value={s.timezone || 'Asia/Kolkata'} onChange={(v) => updateSetting('timezone', v)} />
              </div>
            </div>
          )}

          {activeTab === 'invoice' && (
            <div className="space-y-6">
              <h2 className="text-base font-semibold text-slate-800">Invoice Settings</h2>
              <div className="grid grid-cols-2 gap-4">
                <Setting label="Invoice Prefix" value={s.invoice_prefix || 'INV'} onChange={(v) => updateSetting('invoice_prefix', v)} />
                <Setting label="Invoice Start Number" value={s.invoice_start_no || '1001'} onChange={(v) => updateSetting('invoice_start_no', v)} />
                <Setting label="Invoice Due Days" value={s.invoice_due_days || '30'} onChange={(v) => updateSetting('invoice_due_days', v)} type="number" />
                <Setting label="Invoice Theme" value={s.invoice_theme || 'default'} onChange={(v) => updateSetting('invoice_theme', v)} as="select" options={['default', 'modern', 'classic', 'minimal']} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Invoice Footer Text</label>
                <textarea value={s.invoice_footer || ''} onChange={(e) => updateSetting('invoice_footer', e.target.value)} rows={3} placeholder="Thank you for your business!" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Terms & Conditions</label>
                <textarea value={s.invoice_terms || ''} onChange={(e) => updateSetting('invoice_terms', e.target.value)} rows={3} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" />
              </div>
            </div>
          )}

          {activeTab === 'tax' && (
            <div className="space-y-6">
              <h2 className="text-base font-semibold text-slate-800">Tax & GST Settings</h2>
              <div className="grid grid-cols-2 gap-4">
                <Setting label="GSTIN" value={s.gstin || ''} onChange={(v) => updateSetting('gstin', v)} mono />
                <Setting label="State" value={s.state || ''} onChange={(v) => updateSetting('state', v)} />
                <Setting label="Default GST Rate (%)" value={s.default_gst_rate || '18'} onChange={(v) => updateSetting('default_gst_rate', v)} as="select" options={['0', '5', '12', '18', '28']} />
                <div className="flex items-center gap-3 col-span-2">
                  <input type="checkbox" id="tcs" checked={!!s.enable_tcs} onChange={(e) => updateSetting('enable_tcs', e.target.checked)} className="rounded text-amber-600" />
                  <label htmlFor="tcs" className="text-sm text-slate-700">Enable TCS (Tax Collected at Source)</label>
                </div>
                <div className="flex items-center gap-3 col-span-2">
                  <input type="checkbox" id="tds" checked={!!s.enable_tds} onChange={(e) => updateSetting('enable_tds', e.target.checked)} className="rounded text-amber-600" />
                  <label htmlFor="tds" className="text-sm text-slate-700">Enable TDS (Tax Deducted at Source)</label>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'payment' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-base font-semibold text-slate-800">Payment Details</h2>
                <p className="text-xs text-slate-500 mt-0.5">These details appear in every WhatsApp invoice message sent to customers.</p>
              </div>

              {/* UPI Section */}
              <div className="border border-slate-100 rounded-xl p-5 space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <Smartphone className="h-4 w-4 text-green-600" />
                  <h3 className="text-sm font-semibold text-slate-700">UPI Details</h3>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">UPI ID 1 <span className="text-slate-400">(Primary — e.g. kavipushpjewels@oksbi)</span></label>
                    <input
                      type="text"
                      value={s.payment_upi_id || ''}
                      onChange={(e) => updateSetting('payment_upi_id', e.target.value)}
                      placeholder="yourname@bankname"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">UPI ID 2 <span className="text-slate-400">(Secondary — e.g. Kavipushpbank@okhdfcbank)</span></label>
                    <input
                      type="text"
                      value={s.payment_upi_id_2 || ''}
                      onChange={(e) => updateSetting('payment_upi_id_2', e.target.value)}
                      placeholder="yourname@bankname"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
                    />
                  </div>
                </div>
              </div>

              {/* Bank Section */}
              <div className="border border-slate-100 rounded-xl p-5 space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <Building2 className="h-4 w-4 text-blue-600" />
                  <h3 className="text-sm font-semibold text-slate-700">Bank Account Details</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Setting label="Account Holder Name" value={s.payment_bank_holder} onChange={(v) => updateSetting('payment_bank_holder', v)} />
                  </div>
                  <Setting label="Account Number" value={s.payment_bank_account} onChange={(v) => updateSetting('payment_bank_account', v)} mono />
                  <Setting label="IFSC Code" value={s.payment_bank_ifsc} onChange={(v) => updateSetting('payment_bank_ifsc', v)} mono />
                  <Setting label="Bank Name" value={s.payment_bank_name} onChange={(v) => updateSetting('payment_bank_name', v)} />
                </div>
              </div>

              {/* Live Preview */}
              <div className="border border-green-100 rounded-xl p-5 bg-green-50/40">
                <p className="text-xs font-semibold text-slate-600 mb-3">📱 WhatsApp Message Preview</p>
                <pre className="text-xs text-slate-700 whitespace-pre-wrap font-sans leading-relaxed bg-white rounded-lg p-4 border border-green-100">
{`🧿 *${s.business_name || 'Kavipushp Jewels'}*
━━━━━━━━━━━━━━━━
📋 *Invoice: INV-2026-0001*
📅 Date: 03 Mar 2026
👤 Dear Customer Name,

*Items Purchased:*
  • Gold Ring × 1 — ₹4,500.00
━━━━━━━━━━━━━━━━
💰 *Grand Total: ₹4,500.00*
🔴 *Balance Due: ₹3,500.00*
━━━━━━━━━━━━━━━━
💳 *Payment Options:*
${s.payment_upi_id ? `📱 *UPI ID 1:* ${s.payment_upi_id}\n   GPay / PhonePe / Paytm\n   👉 Pay now: upi://pay?pa=${s.payment_upi_id}&am=3500.00\n` : ''}${s.payment_upi_id_2 ? `📱 *UPI ID 2:* ${s.payment_upi_id_2}\n   👉 Pay now: upi://pay?pa=${s.payment_upi_id_2}&am=3500.00\n` : ''}${s.payment_bank_account ? `🏦 *Bank Transfer:*\n   A/C: ${s.payment_bank_account}\n   IFSC: ${s.payment_bank_ifsc || '—'}\n   Bank: ${s.payment_bank_name || '—'}\n   Name: ${s.payment_bank_holder || '—'}\n` : ''}
Thank you for shopping with us! 🙏`}
                </pre>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <h2 className="text-base font-semibold text-slate-800">Notification Preferences</h2>
              <div className="space-y-4">
                {[
                  { key: 'notify_low_stock', label: 'Low Stock Alerts', desc: 'Get notified when product stock falls below minimum level' },
                  { key: 'notify_payment_due', label: 'Payment Due Reminders', desc: 'Reminders for overdue invoices and payments' },
                  { key: 'notify_new_order', label: 'New Order Notifications', desc: 'Alert when new purchase orders are created' },
                  { key: 'notify_daily_summary', label: 'Daily Sales Summary', desc: 'Receive daily sales and revenue report' },
                ].map((n) => (
                  <div key={n.key} className="flex items-start gap-4 p-4 bg-slate-50 rounded-lg">
                    <input type="checkbox" id={n.key} checked={!!s[n.key]} onChange={(e) => updateSetting(n.key, e.target.checked)} className="rounded text-amber-600 mt-0.5" />
                    <label htmlFor={n.key} className="flex-1 cursor-pointer">
                      <p className="text-sm font-medium text-slate-800">{n.label}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{n.desc}</p>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Setting({ label, value, onChange, type = 'text', as = 'input', options = [], labels = [], mono = false }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-700 mb-1">{label}</label>
      {as === 'select' ? (
        <select value={value || ''} onChange={(e) => onChange(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500">
          {options.map((o, i) => <option key={o} value={o}>{labels[i] || o}</option>)}
        </select>
      ) : (
        <input type={type} value={value || ''} onChange={(e) => onChange(e.target.value)} className={`w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 ${mono ? 'font-mono' : ''}`} />
      )}
    </div>
  )
}
