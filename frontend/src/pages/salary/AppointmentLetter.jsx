import { forwardRef } from 'react'
import { formatCurrency, formatDate } from '../../utils/formatters'

const TYPE_LABELS = {
  permanent: 'Permanent',
  contract: 'Contract',
  part_time: 'Part-time',
  probation: 'Probation',
  intern: 'Intern',
  purely_temporary: 'Purely Temporary',
}
const typeLabel = (v) => TYPE_LABELS[v] || v || '—'

// Appointment letter rendered on the KAVIPUSHP JEWELS letter pad.
// Content is generated deterministically from the saved employee record,
// so it is always available on the employee page for print and future use.
const AppointmentLetter = forwardRef(function AppointmentLetter({ employee, firm }, ref) {
  const addr = [firm?.address, firm?.city, firm?.state].filter(Boolean).join(', ')
  const phone = firm?.phone
  const email = firm?.email
  const firmName = (firm?.name || 'Kavipushp Jewels').toUpperCase()
  const joining = employee?.date_of_joining
  const issueDate = joining || new Date().toISOString().split('T')[0]

  const Detail = ({ label, value }) => (
    <tr>
      <td style={{ padding: '4px 0', color: '#475569', width: '42%', verticalAlign: 'top' }}>{label}</td>
      <td style={{ padding: '4px 0', color: '#0f172a', fontWeight: 600 }}>{value || '—'}</td>
    </tr>
  )

  return (
    <div
      ref={ref}
      style={{
        background: '#ffffff',
        color: '#0f172a',
        width: '794px',       // ~A4 width @ 96dpi
        minHeight: '1123px',  // ~A4 height
        margin: '0 auto',
        padding: '48px 56px',
        boxSizing: 'border-box',
        fontFamily: "'Segoe UI', Arial, sans-serif",
        fontSize: '14px',
        lineHeight: 1.6,
      }}
    >
      {/* Letterhead */}
      <div style={{ textAlign: 'center', borderBottom: '3px solid #d97706', paddingBottom: '14px' }}>
        <h1 style={{ fontSize: '30px', fontWeight: 800, letterSpacing: '1px', color: '#b45309', margin: 0 }}>{firmName}</h1>
        {addr && <p style={{ fontSize: '12.5px', color: '#64748b', margin: '6px 0 0' }}>{addr}</p>}
        {(phone || email) && (
          <p style={{ fontSize: '12.5px', color: '#64748b', margin: '3px 0 0' }}>
            {phone && <span>Mobile Number: {phone}</span>}
            {phone && email && <span style={{ padding: '0 6px' }}>|</span>}
            {email && <span>{email}</span>}
          </p>
        )}
      </div>

      {/* Title + date */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '28px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 700, textDecoration: 'underline', margin: 0 }}>APPOINTMENT LETTER</h2>
        <span style={{ fontSize: '13px', color: '#475569' }}>Date: {formatDate(issueDate)}</span>
      </div>

      {/* Salutation */}
      <p style={{ marginTop: '22px' }}>To,</p>
      <p style={{ margin: '2px 0 0', fontWeight: 700 }}>{employee?.name || '—'}</p>
      {employee?.address && <p style={{ margin: '2px 0 0', color: '#475569', fontSize: '13px' }}>{employee.address}</p>}
      {employee?.phone && <p style={{ margin: '2px 0 0', color: '#475569', fontSize: '13px' }}>Mobile: {employee.phone}</p>}

      {/* Body */}
      <p style={{ marginTop: '20px' }}>Dear {(employee?.name || '').split(' ')[0] || 'Sir/Madam'},</p>
      <p style={{ marginTop: '10px', textAlign: 'justify' }}>
        We are pleased to appoint you as <strong>{employee?.designation || 'an employee'}</strong> at {firmName}
        {' '}on a <strong>{typeLabel(employee?.employment_type)}</strong> basis
        {joining ? <> with effect from <strong>{formatDate(joining)}</strong></> : null}.
        The particulars of your appointment are as follows:
      </p>

      {/* Details table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', margin: '16px 0', fontSize: '14px' }}>
        <tbody>
          <Detail label="Name" value={employee?.name} />
          <Detail label="Designation" value={employee?.designation} />
          <Detail label="Type of Appointment" value={typeLabel(employee?.employment_type)} />
          <Detail label="Date of Joining" value={joining ? formatDate(joining) : '—'} />
          <Detail label="Monthly Salary" value={formatCurrency(employee?.monthly_salary || 0)} />
          <Detail label="Working Hours" value={employee?.work_timings} />
          <Detail label="Weekly Off" value={employee?.weekly_off} />
        </tbody>
      </table>

      {/* Terms & Conditions */}
      <p style={{ marginTop: '8px', fontWeight: 700 }}>Terms &amp; Conditions:</p>
      <ol style={{ margin: '8px 0 0', paddingLeft: '20px' }}>
        <li style={{ marginBottom: '8px', textAlign: 'justify' }}>
          The minimum service trial period is <strong>7 days</strong>. No salary shall be payable if this trial
          period of 7 days is not completed.
        </li>
        <li style={{ marginBottom: '8px', textAlign: 'justify' }}>
          If one month of service is not completed, then <strong>50% of the due salary</strong> will be paid for the
          number of days actually completed.
        </li>
      </ol>

      <p style={{ marginTop: '18px', textAlign: 'justify' }}>
        Kindly sign and return the duplicate copy of this letter as a token of your acceptance of the above terms
        and conditions of appointment.
      </p>

      {/* Signatures */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '70px' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ borderTop: '1px solid #94a3b8', width: '200px', paddingTop: '6px', fontSize: '13px', color: '#475569' }}>
            Employee's Signature
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ borderTop: '1px solid #94a3b8', width: '200px', paddingTop: '6px', fontSize: '13px', color: '#475569' }}>
            For {firmName}<br />(Authorised Signatory)
          </div>
        </div>
      </div>
    </div>
  )
})

export default AppointmentLetter
