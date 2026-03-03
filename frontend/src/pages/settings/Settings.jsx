import { useEffect, useState } from 'react'
import { Save, Settings as SettingsIcon, Bell, Printer, CreditCard, Globe } from 'lucide-react'
import toast from 'react-hot-toast'
import { settingsAPI } from '../../api'
import LoadingSpinner from '../../components/common/LoadingSpinner'

const TABS = [
  { key: 'general', label: 'General', icon: SettingsIcon },
  { key: 'invoice', label: 'Invoice', icon: Printer },
  { key: 'tax', label: 'Tax & GST', icon: CreditCard },
  { key: 'notifications', label: 'Notifications', icon: Bell },
]

export default function Settings() {
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('general')

  useEffect(() => {
    settingsAPI.getSettings()
      .then(({ data }) => setSettings(data.settings || data))
      .catch(() => toast.error('Failed to load settings'))
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
