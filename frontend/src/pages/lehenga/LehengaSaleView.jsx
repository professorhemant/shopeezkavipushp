import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Printer, FileDown } from 'lucide-react'
import { useReactToPrint } from 'react-to-print'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import toast from 'react-hot-toast'
import { lehengaAPI } from '../../api'
import useAuthStore from '../../store/authStore'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import LehengaSaleInvoiceDocument from './LehengaSaleInvoiceDocument'

export default function LehengaSaleView() {
  const { id } = useParams()
  const { firm } = useAuthStore()
  const [inv, setInv] = useState(null)
  const [loading, setLoading] = useState(true)
  const printRef = useRef(null)

  useEffect(() => {
    (async () => {
      try { const { data } = await lehengaAPI.getSale(id); setInv(data.data || null) }
      catch { toast.error('Failed to load sale invoice') }
      finally { setLoading(false) }
    })()
  }, [id])

  const handlePrint = useReactToPrint({ content: () => printRef.current, documentTitle: inv?.invoice_no || 'lehenga-sale' })

  const handlePdf = async () => {
    if (!printRef.current) return
    try {
      const canvas = await html2canvas(printRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff' })
      const img = canvas.toDataURL('image/png')
      const pdf = new jsPDF({ orientation: 'p', unit: 'px', format: [canvas.width, canvas.height] })
      pdf.addImage(img, 'PNG', 0, 0, canvas.width, canvas.height)
      pdf.save(`${inv?.invoice_no || 'lehenga-sale'}.pdf`)
    } catch { toast.error('Could not create PDF') }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link to="/lehenga/sales" className="border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to Sales
        </Link>
        {inv && (
          <div className="flex flex-wrap gap-2">
            <button onClick={handlePrint} className="border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
              <Printer className="h-4 w-4" /> Print Invoice
            </button>
            <button onClick={handlePdf} className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
              <FileDown className="h-4 w-4" /> Create PDF
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><LoadingSpinner size="lg" /></div>
      ) : !inv ? (
        <div className="bg-white rounded-xl p-10 shadow-sm border border-slate-200 text-center text-slate-400">
          Sale invoice not found.
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-2 sm:p-4">
          <LehengaSaleInvoiceDocument ref={printRef} inv={inv} firm={firm} />
        </div>
      )}
    </div>
  )
}
