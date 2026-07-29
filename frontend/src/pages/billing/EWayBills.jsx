import { useEffect, useState } from 'react'
import { Truck, Plus, RefreshCw, FileText } from 'lucide-react'
import toast from 'react-hot-toast'
import { gstAPI, saleAPI } from '../../api'
import { formatDate } from '../../utils/formatters'
import LoadingSpinner from '../../components/common/LoadingSpinner'

const STATUS_COLORS = {
  active: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
  expired: 'bg-gray-100 text-gray-600',
  pending: 'bg-yellow-100 text-yellow-700',
}

export default function EWayBills() {
  const [ewbs, setEwbs] = useState([])
  const [eligibleInvoices, setEligibleInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(null)
  const [showGenModal, setShowGenModal] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState('')
  const [transporter, setTransporter] = useState('')
  const [vehicleNo, setVehicleNo] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [ewbRes, invRes] = await Promise.all([
        gstAPI.getGSTR1({ type: 'ewaybills' }).catch(() => ({ data: { ewaybills: [] } })),
        saleAPI.getAll({ ewb_eligible: true, limit: 100 }),
      ])
      setEwbs(ewbRes.data.ewaybills || ewbRes.data || [])
      setEligibleInvoices(invRes.data.sales || invRes.data.results || invRes.data || [])
    } catch {
      toast.error('Failed to load e-way bills')
    } finally {
      setLoading(false)
    }
  }

  const handleGenerate = async () => {
    if (!selectedInvoice) { toast.error('Select an invoice'); return }
    setGenerating(selectedInvoice)
    try {
      await gstAPI.generateEWayBill(selectedInvoice, { transporter_name: transporter, vehicle_no: vehicleNo })
      toast.success('E-Way Bill generated successfully')
      setShowGenModal(false)
      setSelectedInvoice(''); setTransporter(''); setVehicleNo('')
      fetchData()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to generate E-Way Bill')
    } finally {
      setGenerating(null)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">E-Way Bills</h1>
          <p className="text-sm text-gray-500 mt-0.5">{ewbs.length} e-way bills</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchData} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm flex items-center gap-2">
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
          <button onClick={() => setShowGenModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
            <Plus className="h-4 w-4" /> Generate EWB
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16"><LoadingSpinner size="lg" /></div>
        ) : ewbs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Truck className="h-12 w-12 mb-3 text-gray-300" />
            <p className="text-base font-medium text-gray-500">No E-Way Bills generated yet</p>
            <p className="text-sm mt-1">Required for inter-state movement of goods above ₹50,000</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">EWB No.</th>
                  <th className="px-4 py-3 text-left">Invoice No</th>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Transporter</th>
                  <th className="px-4 py-3 text-left">Vehicle No</th>
                  <th className="px-4 py-3 text-left">Valid Upto</th>
                  <th className="px-4 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {ewbs.map((ewb) => (
                  <tr key={ewb.id || ewb.ewb_no} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs font-medium text-blue-600">{ewb.ewb_no}</td>
                    <td className="px-4 py-3 text-gray-700">{ewb.invoice_no}</td>
                    <td className="px-4 py-3 text-gray-600">{formatDate(ewb.generated_at || ewb.date)}</td>
                    <td className="px-4 py-3 text-gray-600">{ewb.transporter_name || '-'}</td>
                    <td className="px-4 py-3 text-gray-600 font-mono text-xs">{ewb.vehicle_no || '-'}</td>
                    <td className="px-4 py-3 text-gray-600">{formatDate(ewb.valid_upto)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[ewb.status] || STATUS_COLORS.active}`}>
                        {ewb.status || 'active'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showGenModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 shadow-xl w-full max-w-md mx-4">
            <h3 className="font-semibold text-gray-900 text-lg mb-5">Generate E-Way Bill</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Invoice *</label>
                <select value={selectedInvoice} onChange={(e) => setSelectedInvoice(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">-- Select Invoice --</option>
                  {eligibleInvoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>{inv.invoice_no} - {inv.customer_name || 'Walk-in'}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Transporter Name</label>
                <input value={transporter} onChange={(e) => setTransporter(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Transporter name" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Number</label>
                <input value={vehicleNo} onChange={(e) => setVehicleNo(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. MH12AB1234" />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowGenModal(false)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm">Cancel</button>
                <button onClick={handleGenerate} disabled={!!generating}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60">
                  {generating ? <LoadingSpinner size="sm" /> : <Truck className="h-4 w-4" />} Generate
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
