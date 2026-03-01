import { useEffect, useState } from 'react'
import { Download, FileSpreadsheet } from 'lucide-react'
import toast from 'react-hot-toast'
import { reportAPI, gstAPI } from '../../api'
import { formatCurrency } from '../../utils/formatters'
import LoadingSpinner from '../../components/common/LoadingSpinner'

const currentYear = new Date().getFullYear()
const currentMonth = new Date().getMonth() + 1

export default function GSTReport() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState(currentMonth)
  const [year, setYear] = useState(currentYear)
  const [reportType, setReportType] = useState('gstr1')

  const fetchReport = async () => {
    setLoading(true)
    try {
      const { data: d } = await gstAPI.getGSTR1({ month, year })
      setData(d)
    } catch {
      toast.error('Failed to load GST report')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchReport() }, [month, year, reportType])

  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  const years = [currentYear - 1, currentYear, currentYear + 1]

  const b2b = data?.b2b || []
  const b2c = data?.b2c || data?.b2cs || []
  const summary = data?.summary || {}

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">GST Reports</h1>
          <p className="text-sm text-gray-500 mt-0.5">GSTR-1, GSTR-2 and GST analytics</p>
        </div>
        <button className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm flex items-center gap-2">
          <Download className="h-4 w-4" /> Export JSON
        </button>
      </div>

      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <div className="flex flex-wrap gap-3 items-center">
          <select value={reportType} onChange={(e) => setReportType(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="gstr1">GSTR-1 (Sales)</option>
            <option value="gstr2">GSTR-2 (Purchases)</option>
          </select>
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            {months.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-32"><LoadingSpinner size="lg" /></div>
      ) : (
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Taxable Value', value: formatCurrency(summary.taxable_value || 0) },
              { label: 'CGST', value: formatCurrency(summary.cgst || 0) },
              { label: 'SGST', value: formatCurrency(summary.sgst || 0) },
              { label: 'IGST', value: formatCurrency(summary.igst || 0) },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <p className="text-xs text-gray-500">{s.label}</p>
                <p className="text-xl font-bold mt-1 text-gray-900">{s.value}</p>
              </div>
            ))}
          </div>

          {/* B2B Invoices */}
          {b2b.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-blue-600" />
                <h2 className="text-base font-semibold text-gray-900">B2B Invoices</h2>
                <span className="ml-auto text-xs text-gray-500">{b2b.length} invoices</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                    <tr>
                      <th className="px-4 py-3 text-left">Invoice No</th>
                      <th className="px-4 py-3 text-left">Date</th>
                      <th className="px-4 py-3 text-left">Party GSTIN</th>
                      <th className="px-4 py-3 text-right">Taxable</th>
                      <th className="px-4 py-3 text-right">CGST</th>
                      <th className="px-4 py-3 text-right">SGST</th>
                      <th className="px-4 py-3 text-right">IGST</th>
                      <th className="px-4 py-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {b2b.map((inv, i) => (
                      <tr key={i} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-blue-600">{inv.invoice_no}</td>
                        <td className="px-4 py-3 text-gray-600">{inv.date}</td>
                        <td className="px-4 py-3 text-gray-600 font-mono text-xs">{inv.party_gstin}</td>
                        <td className="px-4 py-3 text-right">{formatCurrency(inv.taxable)}</td>
                        <td className="px-4 py-3 text-right">{formatCurrency(inv.cgst)}</td>
                        <td className="px-4 py-3 text-right">{formatCurrency(inv.sgst)}</td>
                        <td className="px-4 py-3 text-right">{formatCurrency(inv.igst)}</td>
                        <td className="px-4 py-3 text-right font-semibold">{formatCurrency(inv.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {b2b.length === 0 && b2c.length === 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center py-20 text-gray-400">
              <FileSpreadsheet className="h-12 w-12 mb-3 text-gray-300" />
              <p className="text-base font-medium text-gray-500">No GST data for {months[month - 1]} {year}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
