import { useEffect, useState, useRef } from 'react'
import { Plus, Edit2, Trash2, Banknote, CreditCard, Smartphone, AlertCircle, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { dayBookAPI } from '../../api'
import { formatCurrency } from '../../utils/formatters'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import useAuthStore from '../../store/authStore'

const today = () => new Date().toISOString().split('T')[0]

const addDays = (dateStr, days) => {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

const fmtDate = (d) => {
  if (!d) return '—'
  const [y, m, day] = String(d).split('T')[0].split('-')
  return `${day}/${m}/${y}`
}

const EMPTY_SPLIT = { slip_no: '', cash: '', card: '', online: '', function_date: '', booking_date: today(), pickup_date: '', return_date: '' }
const EMPTY_EDIT  = { slip_no: '', amount: '', payment_mode: 'cash', function_date: '', booking_date: '', pickup_date: '', return_date: '' }

export default function BridalBookings() {
  const { user } = useAuthStore()
  const canViewHistory = ['admin', 'super_admin'].includes(user?.role_name)
  const [date, setDate] = useState(today())
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [splitForm, setSplitForm] = useState(EMPTY_SPLIT)
  const [editForm, setEditForm]   = useState(EMPTY_EDIT)
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [availability, setAvailability] = useState([])
  const [checkingAvail, setCheckingAvail] = useState(false)
  const debounceRef = useRef(null)

  // Standalone checker
  const [checkerCode, setCheckerCode] = useState('')
  const [checkerResult, setCheckerResult] = useState(null) // null = not checked yet, [] = available, [...] = conflicts
  const [checkerLoading, setCheckerLoading] = useState(false)
  const checkerDebounceRef = useRef(null)

  const load = async () => {
    setLoading(true)
    try { const { data } = await dayBookAPI.getBridalBookings(date); setRows(data.data || []) }
    catch { toast.error('Failed to load') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [date])

  // Debounced availability check — only in add mode
  useEffect(() => {
    if (editId) return
    const code = splitForm.slip_no.trim()
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      if (!code) { setAvailability([]); return }
      setCheckingAvail(true)
      try {
        const res = await dayBookAPI.checkBridalAvailability(code)
        setAvailability(res.data.data || [])
      } catch { setAvailability([]) }
      finally { setCheckingAvail(false) }
    }, 500)
    return () => clearTimeout(debounceRef.current)
  }, [splitForm.slip_no, editId])

  // Standalone checker debounce
  useEffect(() => {
    const code = checkerCode.trim()
    if (checkerDebounceRef.current) clearTimeout(checkerDebounceRef.current)
    if (!code) { setCheckerResult(null); return }
    checkerDebounceRef.current = setTimeout(async () => {
      setCheckerLoading(true)
      try {
        const res = await dayBookAPI.checkBridalAvailability(code)
        setCheckerResult(res.data.data || [])
      } catch { setCheckerResult([]) }
      finally { setCheckerLoading(false) }
    }, 500)
    return () => clearTimeout(checkerDebounceRef.current)
  }, [checkerCode])

  const handleFunctionDate = (val, isEdit) => {
    const pickup = addDays(val, -1)
    const ret    = addDays(val, +1)
    if (isEdit) setEditForm(f => ({ ...f, function_date: val, pickup_date: pickup, return_date: ret }))
    else        setSplitForm(f => ({ ...f, function_date: val, pickup_date: pickup, return_date: ret }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (editId) {
        if (!editForm.amount) { toast.error('Amount is required'); setSaving(false); return }
        await dayBookAPI.updateBridalBooking(editId, {
          slip_no: editForm.slip_no,
          amount: editForm.amount,
          payment_mode: editForm.payment_mode,
          date,
          function_date: editForm.function_date || null,
          booking_date:  editForm.booking_date  || null,
          pickup_date:   editForm.pickup_date   || null,
          return_date:   editForm.return_date   || null,
        })
        toast.success('Updated')
      } else {
        const entries = [
          { mode: 'cash',   amount: parseFloat(splitForm.cash)   || 0 },
          { mode: 'card',   amount: parseFloat(splitForm.card)   || 0 },
          { mode: 'online', amount: parseFloat(splitForm.online) || 0 },
        ].filter(e => e.amount > 0)
        if (!entries.length) { toast.error('Enter at least one amount'); setSaving(false); return }
        for (const entry of entries) {
          await dayBookAPI.createBridalBooking({
            slip_no: splitForm.slip_no,
            amount: entry.amount,
            payment_mode: entry.mode,
            date,
            function_date: splitForm.function_date || null,
            booking_date:  splitForm.booking_date  || null,
            pickup_date:   splitForm.pickup_date   || null,
            return_date:   splitForm.return_date   || null,
          })
        }
        toast.success(`${entries.length} entry/entries added`)
      }
      setSplitForm(EMPTY_SPLIT); setEditForm(EMPTY_EDIT); setEditId(null); setShowForm(false); setAvailability([]); load()
    } catch { toast.error('Failed to save') }
    finally { setSaving(false) }
  }

  const startEditGroup = (entries) => {
    const first = entries[0]
    setEditForm({
      slip_no:       first.slip_no       || '',
      amount:        first.amount,
      payment_mode:  first.payment_mode,
      function_date: first.function_date || '',
      booking_date:  first.booking_date  || '',
      pickup_date:   first.pickup_date   || '',
      return_date:   first.return_date   || '',
    })
    setEditId(first.id); setShowForm(true); setAvailability([])
  }

  const handleDeleteGroup = async (entries) => {
    if (!window.confirm('Delete all entries for this set?')) return
    for (const e of entries) {
      try { await dayBookAPI.deleteBridalBooking(e.id) } catch {}
    }
    toast.success('Deleted'); load()
  }

  const cashTotal   = rows.filter(r => r.payment_mode === 'cash').reduce((a, r) => a + parseFloat(r.amount || 0), 0)
  const cardTotal   = rows.filter(r => r.payment_mode === 'card').reduce((a, r) => a + parseFloat(r.amount || 0), 0)
  const onlineTotal = rows.filter(r => r.payment_mode === 'online').reduce((a, r) => a + parseFloat(r.amount || 0), 0)

  const inp = "border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
  const lbl = "block text-xs font-medium text-slate-700 mb-1"

  const curForm = editId ? editForm : splitForm
  const setField = (key, val) => editId
    ? setEditForm(f => ({ ...f, [key]: val }))
    : setSplitForm(f => ({ ...f, [key]: val }))

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Day Book — Bridal Bookings</h1>
          <p className="text-sm text-slate-500 mt-0.5">{rows.length} entries</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input type="date" value={date} onChange={(e) => canViewHistory && setDate(e.target.value)}
            disabled={!canViewHistory}
            title={!canViewHistory ? 'Only admin Swechha can view previous dates' : ''}
            className={`border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 ${!canViewHistory ? 'border-slate-100 bg-slate-50 text-slate-400 cursor-not-allowed' : 'border-slate-200'}`} />
          <button onClick={() => { setSplitForm(EMPTY_SPLIT); setEditForm(EMPTY_EDIT); setEditId(null); setShowForm(true); setAvailability([]) }}
            className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
            <Plus className="h-4 w-4" /> Add Entry
          </button>
        </div>
      </div>

      {/* Standalone Availability Checker */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Check Set Availability</p>
        <div className="flex flex-wrap items-center gap-3">
          <input
            value={checkerCode}
            onChange={(e) => setCheckerCode(e.target.value)}
            placeholder="Enter set code to check…"
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 w-64"
          />
          {checkerLoading && <p className="text-xs text-slate-400 italic">Checking…</p>}
          {!checkerLoading && checkerResult !== null && checkerCode.trim() && (
            checkerResult.length === 0 ? (
              <span className="flex items-center gap-1.5 text-green-600 text-sm font-medium">
                <CheckCircle className="h-4 w-4" /> Available — no existing bookings for &ldquo;{checkerCode}&rdquo;
              </span>
            ) : (
              <div className="flex flex-wrap items-start gap-2">
                <span className="flex items-center gap-1.5 text-red-600 text-sm font-semibold">
                  <AlertCircle className="h-4 w-4 shrink-0" /> &ldquo;{checkerCode}&rdquo; already booked:
                </span>
                <div className="flex flex-wrap gap-2">
                  {checkerResult.map((r, i) => (
                    <span key={i} className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-1.5">
                      Not available from <strong>{fmtDate(r.pickup_date)}</strong> to <strong>{fmtDate(r.return_date)}</strong>
                      {r.function_date ? <span className="text-red-400"> · Function: {fmtDate(r.function_date)}</span> : ''}
                    </span>
                  ))}
                </div>
              </div>
            )
          )}
        </div>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl p-4 shadow-sm border border-amber-200">
          <form onSubmit={handleSubmit} onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault() }}>

            {/* Row 1: Set Code + payment amounts */}
            <div className="flex flex-wrap gap-3 items-end mb-4">
              <div>
                <label className={lbl}>Set Code</label>
                <input
                  value={curForm.slip_no}
                  onChange={(e) => setField('slip_no', e.target.value)}
                  placeholder="Set code"
                  className={`${inp} w-36`} />
              </div>

              {editId ? (
                <>
                  <div>
                    <label className={lbl}>Amount (₹)</label>
                    <input type="number" step="0.01" value={editForm.amount}
                      onChange={(e) => setEditForm(f => ({...f, amount: e.target.value}))}
                      placeholder="0.00" required className={`${inp} w-36`} />
                  </div>
                  <div>
                    <label className={lbl}>Mode</label>
                    <select value={editForm.payment_mode}
                      onChange={(e) => setEditForm(f => ({...f, payment_mode: e.target.value}))}
                      className={inp}>
                      <option value="cash">Cash</option>
                      <option value="card">Card</option>
                      <option value="online">Online</option>
                    </select>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="flex items-center gap-1 text-xs font-medium text-green-700 mb-1"><Banknote className="h-3.5 w-3.5" /> Cash (₹)</label>
                    <input type="number" step="0.01" min="0" value={splitForm.cash}
                      onChange={(e) => setSplitForm(f => ({...f, cash: e.target.value}))}
                      placeholder="0.00"
                      className="border-2 border-green-200 focus:border-green-400 rounded-lg px-3 py-2 text-sm w-32 focus:outline-none focus:ring-2 focus:ring-green-300" />
                  </div>
                  <div>
                    <label className="flex items-center gap-1 text-xs font-medium text-blue-700 mb-1"><CreditCard className="h-3.5 w-3.5" /> Card (₹)</label>
                    <input type="number" step="0.01" min="0" value={splitForm.card}
                      onChange={(e) => setSplitForm(f => ({...f, card: e.target.value}))}
                      placeholder="0.00"
                      className="border-2 border-blue-200 focus:border-blue-400 rounded-lg px-3 py-2 text-sm w-32 focus:outline-none focus:ring-2 focus:ring-blue-300" />
                  </div>
                  <div>
                    <label className="flex items-center gap-1 text-xs font-medium text-violet-700 mb-1"><Smartphone className="h-3.5 w-3.5" /> Online (₹)</label>
                    <input type="number" step="0.01" min="0" value={splitForm.online}
                      onChange={(e) => setSplitForm(f => ({...f, online: e.target.value}))}
                      placeholder="0.00"
                      className="border-2 border-violet-200 focus:border-violet-400 rounded-lg px-3 py-2 text-sm w-32 focus:outline-none focus:ring-2 focus:ring-violet-300" />
                  </div>
                  {(parseFloat(splitForm.cash)||0) + (parseFloat(splitForm.card)||0) + (parseFloat(splitForm.online)||0) > 0 && (
                    <div className="flex flex-col justify-end pb-2">
                      <span className="text-xs text-slate-500">Total</span>
                      <span className="text-sm font-bold text-slate-800">
                        {formatCurrency((parseFloat(splitForm.cash)||0) + (parseFloat(splitForm.card)||0) + (parseFloat(splitForm.online)||0))}
                      </span>
                    </div>
                  )}
                </>
              )}

              <div className="flex flex-col justify-end gap-1 pb-0.5">
                <button type="submit" disabled={saving}
                  className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-semibold">
                  {saving ? 'Saving...' : editId ? 'Update' : 'Save'}
                </button>
                <button type="button"
                  onClick={() => { setShowForm(false); setEditId(null); setSplitForm(EMPTY_SPLIT); setEditForm(EMPTY_EDIT); setAvailability([]) }}
                  className="border border-slate-200 text-slate-500 hover:bg-slate-50 px-4 py-1.5 rounded-lg text-xs text-center">
                  Cancel
                </button>
              </div>
            </div>

            {/* Row 2: Date fields */}
            <div className="flex flex-wrap gap-3 items-end pt-3 border-t border-slate-100">
              <div>
                <label className={lbl}>Booking Date</label>
                <input type="date" value={curForm.booking_date || ''}
                  onChange={(e) => setField('booking_date', e.target.value)}
                  className={`${inp} w-40`} />
              </div>
              <div>
                <label className={lbl}>Function Date</label>
                <input type="date" value={curForm.function_date || ''}
                  onChange={(e) => handleFunctionDate(e.target.value, !!editId)}
                  className={`${inp} w-40`} />
              </div>
              <div>
                <label className={lbl}>
                  Pickup Date <span className="text-slate-400 font-normal text-xs">(auto −1)</span>
                </label>
                <input type="date" value={curForm.pickup_date || ''}
                  onChange={(e) => setField('pickup_date', e.target.value)}
                  className={`${inp} w-40`} />
              </div>
              <div>
                <label className={lbl}>
                  Return Date <span className="text-slate-400 font-normal text-xs">(auto +1)</span>
                </label>
                <input type="date" value={curForm.return_date || ''}
                  onChange={(e) => setField('return_date', e.target.value)}
                  className={`${inp} w-40`} />
              </div>
            </div>

            {/* Availability result */}
            {!editId && (
              <div className="mt-3 min-h-[24px]">
                {checkingAvail && (
                  <p className="text-xs text-slate-400 italic">Checking availability…</p>
                )}
                {!checkingAvail && availability.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 space-y-1">
                    <div className="flex items-center gap-1.5 text-red-700 font-semibold text-xs">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      Set &ldquo;{splitForm.slip_no}&rdquo; already booked:
                    </div>
                    {availability.map((a, i) => (
                      <p key={i} className="text-xs text-red-600 pl-5">
                        Not available from <strong>{fmtDate(a.pickup_date)}</strong> to <strong>{fmtDate(a.return_date)}</strong>
                        {a.function_date ? ` (Function: ${fmtDate(a.function_date)})` : ''}
                      </p>
                    ))}
                  </div>
                )}
                {!checkingAvail && splitForm.slip_no.trim() && availability.length === 0 && (
                  <p className="text-xs text-green-600 flex items-center gap-1">
                    <CheckCircle className="h-3.5 w-3.5" /> Set available
                  </p>
                )}
              </div>
            )}
          </form>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16"><LoadingSpinner size="lg" /></div>
        ) : (() => {
          const groups = Object.values(rows.reduce((acc, r) => {
            const key = r.slip_no || `__nosliip__${r.id}`
            if (!acc[key]) acc[key] = {
              slip_no: r.slip_no,
              entries: [],
              function_date: r.function_date,
              pickup_date:   r.pickup_date,
              return_date:   r.return_date,
            }
            acc[key].entries.push(r)
            return acc
          }, {}))

          return (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-800 text-xs text-slate-200 uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left">#</th>
                    <th className="px-4 py-3 text-left">Set Code</th>
                    <th className="px-4 py-3 text-left">Function Date</th>
                    <th className="px-4 py-3 text-right text-green-300">Cash</th>
                    <th className="px-4 py-3 text-right text-blue-300">Card</th>
                    <th className="px-4 py-3 text-right text-violet-300">Online</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.length === 0 ? (
                    <tr><td colSpan={8} className="text-center py-12 text-slate-400">No entries for this date</td></tr>
                  ) : groups.map((g, i) => {
                    const cash   = g.entries.filter(e => e.payment_mode === 'cash').reduce((s, e) => s + parseFloat(e.amount || 0), 0)
                    const card   = g.entries.filter(e => e.payment_mode === 'card').reduce((s, e) => s + parseFloat(e.amount || 0), 0)
                    const online = g.entries.filter(e => e.payment_mode === 'online').reduce((s, e) => s + parseFloat(e.amount || 0), 0)
                    return (
                      <tr key={g.slip_no || i} className="border-b hover:bg-slate-50">
                        <td className="px-4 py-3 text-slate-500">{i + 1}</td>
                        <td className="px-4 py-3 font-semibold text-amber-600">{g.slip_no || '-'}</td>
                        <td className="px-4 py-3 text-slate-600">
                          {g.function_date ? (
                            <div>
                              <div className="font-medium text-slate-700">{fmtDate(g.function_date)}</div>
                              {(g.pickup_date || g.return_date) && (
                                <div className="text-xs text-slate-400">
                                  Pickup: {fmtDate(g.pickup_date)} · Return: {fmtDate(g.return_date)}
                                </div>
                              )}
                            </div>
                          ) : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right text-green-700 font-medium">{cash > 0 ? formatCurrency(cash) : <span className="text-slate-300">—</span>}</td>
                        <td className="px-4 py-3 text-right text-blue-700 font-medium">{card > 0 ? formatCurrency(card) : <span className="text-slate-300">—</span>}</td>
                        <td className="px-4 py-3 text-right text-violet-700 font-medium">{online > 0 ? formatCurrency(online) : <span className="text-slate-300">—</span>}</td>
                        <td className="px-4 py-3 text-right font-bold text-slate-800">{formatCurrency(cash + card + online)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1.5">
                            <button onClick={() => startEditGroup(g.entries)} className="p-1.5 rounded hover:bg-amber-50 text-slate-400 hover:text-amber-600" title="Edit"><Edit2 className="h-4 w-4" /></button>
                            <button onClick={() => handleDeleteGroup(g.entries)} className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-600" title="Delete"><Trash2 className="h-4 w-4" /></button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                {groups.length > 0 && (
                  <tfoot className="bg-slate-50 text-sm font-semibold border-t-2 border-slate-200">
                    <tr>
                      <td colSpan={3} className="px-4 py-3 text-slate-600">Total ({groups.length} sets)</td>
                      <td className="px-4 py-3 text-right text-green-700">{cashTotal > 0 ? formatCurrency(cashTotal) : '—'}</td>
                      <td className="px-4 py-3 text-right text-blue-700">{cardTotal > 0 ? formatCurrency(cardTotal) : '—'}</td>
                      <td className="px-4 py-3 text-right text-violet-700">{onlineTotal > 0 ? formatCurrency(onlineTotal) : '—'}</td>
                      <td className="px-4 py-3 text-right text-slate-800">{formatCurrency(cashTotal + cardTotal + onlineTotal)}</td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )
        })()}
      </div>
    </div>
  )
}
