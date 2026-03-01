import { useState } from 'react'
import { Calculator, RefreshCw } from 'lucide-react'
import { formatCurrency } from '../../utils/formatters'

const GST_RATES = [0, 0.1, 0.25, 3, 5, 12, 18, 28]

export default function GSTCalculator() {
  const [mode, setMode] = useState('exclusive') // exclusive = add GST to amount, inclusive = extract GST from amount
  const [amount, setAmount] = useState('')
  const [gstRate, setGstRate] = useState(18)
  const [result, setResult] = useState(null)

  const calculate = () => {
    const base = parseFloat(amount)
    if (!base || base <= 0) return
    const rate = gstRate / 100

    if (mode === 'exclusive') {
      const cgst = base * (rate / 2)
      const sgst = base * (rate / 2)
      const igst = base * rate
      const total = base + igst
      setResult({ base_amount: base, cgst, sgst, igst, total_gst: igst, total_amount: total })
    } else {
      const base_amount = base / (1 + rate)
      const igst = base - base_amount
      const cgst = igst / 2
      const sgst = igst / 2
      setResult({ base_amount, cgst, sgst, igst, total_gst: igst, total_amount: base })
    }
  }

  const reset = () => { setAmount(''); setResult(null) }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">GST Calculator</h1>
        <p className="text-sm text-gray-500 mt-0.5">Calculate CGST, SGST, IGST with ease</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Calculator */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Calculate</h2>
          <div className="space-y-4">
            {/* Mode */}
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              <button onClick={() => setMode('exclusive')} className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${mode === 'exclusive' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
                GST Exclusive
              </button>
              <button onClick={() => setMode('inclusive')} className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${mode === 'inclusive' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
                GST Inclusive
              </button>
            </div>
            <p className="text-xs text-gray-500">
              {mode === 'exclusive' ? 'Enter base amount and GST will be added on top.' : 'Enter total amount (including GST) and we\'ll extract the GST component.'}
            </p>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">{mode === 'exclusive' ? 'Base Amount (₹)' : 'Total Amount with GST (₹)'}</label>
              <input type="number" step="0.01" value={amount} onChange={(e) => { setAmount(e.target.value); setResult(null) }}
                placeholder="Enter amount" className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium" />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">GST Rate</label>
              <div className="flex flex-wrap gap-2">
                {GST_RATES.map((rate) => (
                  <button key={rate} onClick={() => { setGstRate(rate); setResult(null) }}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${gstRate === rate ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200 hover:border-blue-400'}`}>
                    {rate}%
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={calculate} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2">
                <Calculator className="h-4 w-4" /> Calculate
              </button>
              <button onClick={reset} className="px-4 py-2.5 rounded-lg text-sm border border-gray-200 hover:bg-gray-50 text-gray-600">
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Result */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Result</h2>
          {result ? (
            <div className="space-y-3">
              <div className="bg-blue-50 rounded-xl p-4 mb-4">
                <p className="text-xs text-blue-600 mb-1">GST Rate: {gstRate}%</p>
                <p className="text-2xl font-bold text-blue-700">{formatCurrency(result.total_amount)}</p>
                <p className="text-sm text-blue-500 mt-0.5">Total Amount</p>
              </div>
              {[
                { label: 'Base Amount (Taxable Value)', value: result.base_amount },
                { label: `CGST @ ${gstRate / 2}%`, value: result.cgst, color: 'text-orange-600' },
                { label: `SGST @ ${gstRate / 2}%`, value: result.sgst, color: 'text-orange-600' },
                { label: `IGST @ ${gstRate}% (Interstate)`, value: result.igst, color: 'text-purple-600' },
                { label: 'Total GST', value: result.total_gst, bold: true },
              ].map((row, i) => (
                <div key={i} className={`flex justify-between py-2 ${i < 4 ? 'border-b border-gray-50' : ''}`}>
                  <span className="text-sm text-gray-600">{row.label}</span>
                  <span className={`text-sm font-${row.bold ? 'bold' : 'medium'} ${row.color || 'text-gray-900'}`}>{formatCurrency(row.value)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-gray-300">
              <Calculator className="h-16 w-16 mb-3" />
              <p className="text-sm text-gray-400">Results will appear here</p>
            </div>
          )}
        </div>
      </div>

      {/* Quick Reference */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">GST Rate Reference</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          {[
            { rate: '0%', items: 'Food grains, fresh vegetables, milk, eggs' },
            { rate: '5%', items: 'Packaged food, footwear under ₹1000, clothes' },
            { rate: '12%', items: 'Processed food, mobile phones, computers' },
            { rate: '18%', items: 'Most goods & services, restaurants, hotels' },
            { rate: '28%', items: 'Luxury items, cigarettes, automobiles, cement' },
            { rate: '0.25%', items: 'Cut & semi-polished stones' },
            { rate: '3%', items: 'Gold, silver, precious metals, jewellery' },
            { rate: '0.1%', items: 'Dried leguminous vegetables (bulk)' },
          ].map((item) => (
            <div key={item.rate} className="bg-gray-50 rounded-lg p-3">
              <p className="font-bold text-blue-600 text-base">{item.rate}</p>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">{item.items}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
