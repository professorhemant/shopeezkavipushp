import { useState } from 'react'
import { Plus, Trash2, Download, FileText } from 'lucide-react'
import { formatCurrency } from '../../utils/formatters'

const EMPTY_ITEM = { description: '', qty: 1, unit_price: 0, gst_rate: 18 }
const EMPTY_FORM = {
  invoice_no: `INV-${Date.now()}`,
  date: new Date().toISOString().split('T')[0],
  due_date: '',
  firm_name: '',
  firm_address: '',
  firm_gstin: '',
  customer_name: '',
  customer_address: '',
  customer_gstin: '',
  notes: '',
  terms: 'Payment due within 30 days.',
}

export default function InvoiceGenerator() {
  const [form, setForm] = useState(EMPTY_FORM)
  const [items, setItems] = useState([{ ...EMPTY_ITEM }])

  const addItem = () => setItems([...items, { ...EMPTY_ITEM }])
  const removeItem = (i) => setItems(items.filter((_, idx) => idx !== i))
  const updateItem = (i, field, value) => setItems(items.map((item, idx) => idx === i ? { ...item, [field]: value } : item))

  const calcItem = (item) => {
    const qty = parseFloat(item.qty) || 0
    const price = parseFloat(item.unit_price) || 0
    const gstRate = parseFloat(item.gst_rate) || 0
    const taxable = qty * price
    const gst = taxable * (gstRate / 100)
    return { taxable, gst, total: taxable + gst }
  }

  const totals = items.reduce((acc, item) => {
    const { taxable, gst, total } = calcItem(item)
    return { taxable: acc.taxable + taxable, gst: acc.gst + gst, total: acc.total + total }
  }, { taxable: 0, gst: 0, total: 0 })

  const handlePrint = () => window.print()

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Invoice Generator</h1>
          <p className="text-sm text-slate-500 mt-0.5">Create professional invoices quickly</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handlePrint} className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
            <Download className="h-4 w-4" /> Print / Download PDF
          </button>
        </div>
      </div>

      {/* Invoice Preview / Editor */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-8 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex justify-between mb-8">
          <div className="flex-1 pr-6">
            <input value={form.firm_name} onChange={(e) => setForm({ ...form, firm_name: e.target.value })} placeholder="Your Business Name" className="text-2xl font-bold text-slate-800 border-0 border-b border-dashed border-slate-200 focus:outline-none focus:border-amber-400 w-full mb-1" />
            <textarea value={form.firm_address} onChange={(e) => setForm({ ...form, firm_address: e.target.value })} placeholder="Business Address" rows={2} className="text-sm text-slate-600 border-0 border-b border-dashed border-slate-200 focus:outline-none focus:border-amber-400 w-full resize-none" />
            <input value={form.firm_gstin} onChange={(e) => setForm({ ...form, firm_gstin: e.target.value })} placeholder="GSTIN" className="text-xs font-mono text-slate-500 border-0 border-b border-dashed border-slate-200 focus:outline-none focus:border-amber-400 w-full mt-1" />
          </div>
          <div className="text-right flex-shrink-0">
            <div className="flex items-center gap-2 text-amber-600 justify-end mb-2">
              <FileText className="h-6 w-6" />
              <span className="text-2xl font-bold">TAX INVOICE</span>
            </div>
            <div className="space-y-1 text-sm text-slate-600">
              <div className="flex items-center gap-2 justify-end">
                <span className="text-slate-400">Invoice #:</span>
                <input value={form.invoice_no} onChange={(e) => setForm({ ...form, invoice_no: e.target.value })} className="font-mono text-slate-800 font-medium border-0 border-b border-dashed border-slate-200 focus:outline-none focus:border-amber-400 text-right w-32" />
              </div>
              <div className="flex items-center gap-2 justify-end">
                <span className="text-slate-400">Date:</span>
                <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="border-0 border-b border-dashed border-slate-200 focus:outline-none focus:border-amber-400 text-right" />
              </div>
              <div className="flex items-center gap-2 justify-end">
                <span className="text-slate-400">Due Date:</span>
                <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} className="border-0 border-b border-dashed border-slate-200 focus:outline-none focus:border-amber-400 text-right" />
              </div>
            </div>
          </div>
        </div>

        {/* Bill To */}
        <div className="bg-slate-50 rounded-xl p-4 mb-6">
          <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Bill To</p>
          <input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} placeholder="Customer Name" className="font-semibold text-slate-800 border-0 border-b border-dashed border-slate-200 focus:outline-none focus:border-amber-400 w-full mb-1 bg-transparent" />
          <textarea value={form.customer_address} onChange={(e) => setForm({ ...form, customer_address: e.target.value })} placeholder="Customer Address" rows={2} className="text-sm text-slate-600 border-0 border-b border-dashed border-slate-200 focus:outline-none focus:border-amber-400 w-full resize-none bg-transparent" />
          <input value={form.customer_gstin} onChange={(e) => setForm({ ...form, customer_gstin: e.target.value })} placeholder="Customer GSTIN" className="text-xs font-mono text-slate-500 border-0 border-b border-dashed border-slate-200 focus:outline-none focus:border-amber-400 w-full mt-1 bg-transparent" />
        </div>

        {/* Items Table */}
        <table className="w-full text-sm mb-4">
          <thead className="bg-gray-900 text-white">
            <tr>
              <th className="px-3 py-2 text-left">#</th>
              <th className="px-3 py-2 text-left">Description</th>
              <th className="px-3 py-2 text-right">Qty</th>
              <th className="px-3 py-2 text-right">Rate (₹)</th>
              <th className="px-3 py-2 text-right">GST %</th>
              <th className="px-3 py-2 text-right">Amount (₹)</th>
              <th className="px-3 py-2 print:hidden"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => {
              const { taxable, gst, total } = calcItem(item)
              return (
                <tr key={i} className="border-b border-slate-100">
                  <td className="px-3 py-2 text-slate-500">{i + 1}</td>
                  <td className="px-3 py-2">
                    <input value={item.description} onChange={(e) => updateItem(i, 'description', e.target.value)} placeholder="Item description" className="w-full border-0 focus:outline-none focus:bg-amber-50 rounded px-1 py-0.5" />
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" value={item.qty} onChange={(e) => updateItem(i, 'qty', e.target.value)} className="w-16 text-right border-0 focus:outline-none focus:bg-amber-50 rounded px-1 py-0.5" />
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" step="0.01" value={item.unit_price} onChange={(e) => updateItem(i, 'unit_price', e.target.value)} className="w-24 text-right border-0 focus:outline-none focus:bg-amber-50 rounded px-1 py-0.5" />
                  </td>
                  <td className="px-3 py-2">
                    <select value={item.gst_rate} onChange={(e) => updateItem(i, 'gst_rate', Number(e.target.value))} className="border-0 focus:outline-none text-sm bg-transparent">
                      {[0, 5, 12, 18, 28].map((r) => <option key={r} value={r}>{r}%</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2 text-right font-medium">{formatCurrency(total)}</td>
                  <td className="px-3 py-2 print:hidden">
                    <button onClick={() => removeItem(i)} disabled={items.length === 1} className="text-slate-300 hover:text-red-500 disabled:opacity-20"><Trash2 className="h-4 w-4" /></button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        <button onClick={addItem} className="text-sm text-amber-600 hover:text-amber-700 flex items-center gap-1 mb-6 print:hidden">
          <Plus className="h-4 w-4" /> Add Item
        </button>

        {/* Totals */}
        <div className="flex justify-end mb-6">
          <div className="w-72 space-y-1.5">
            {[
              { label: 'Taxable Amount', value: totals.taxable },
              { label: 'GST Amount', value: totals.gst },
            ].map((row) => (
              <div key={row.label} className="flex justify-between text-sm">
                <span className="text-slate-500">{row.label}</span>
                <span className="text-slate-800">{formatCurrency(row.value)}</span>
              </div>
            ))}
            <div className="flex justify-between text-base font-bold border-t border-slate-200 pt-2 mt-2">
              <span>Total Amount</span>
              <span className="text-amber-700">{formatCurrency(totals.total)}</span>
            </div>
          </div>
        </div>

        {/* Notes & Terms */}
        <div className="border-t border-slate-100 pt-4 grid grid-cols-2 gap-6 text-sm">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Notes</p>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Additional notes..." rows={2} className="text-slate-600 border border-dashed border-slate-200 rounded p-2 focus:outline-none focus:border-amber-400 w-full resize-none text-xs" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Terms & Conditions</p>
            <textarea value={form.terms} onChange={(e) => setForm({ ...form, terms: e.target.value })} rows={2} className="text-slate-600 border border-dashed border-slate-200 rounded p-2 focus:outline-none focus:border-amber-400 w-full resize-none text-xs" />
          </div>
        </div>
      </div>
    </div>
  )
}
