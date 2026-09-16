import { useState } from 'react'
import OnboardingModal from '../components/OnboardingModal.jsx'
import { ksh, fmtDate } from '../format.js'

export default function Onboarding() {
  const [open, setOpen] = useState(false)
  const [result, setResult] = useState(null)

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Tenant onboarding</h2>
          <p>Move a tenant into a house/unit in one step — tenant, lease dates, rent and renewal frequency</p>
        </div>
        <button className="btn ok" onClick={() => { setResult(null); setOpen(true) }}>+ Onboard new tenant</button>
      </div>

      <div className="stats">
        <div className="stat"><div className="label">Start here</div><div className="value" style={{ fontSize: 16 }}>1 &rarr; pick a unit</div><div className="sub">existing vacant or add a new one</div></div>
        <div className="stat"><div className="label">Then</div><div className="value" style={{ fontSize: 16 }}>2 &rarr; tenant details</div><div className="sub">name, phone, email</div></div>
        <div className="stat"><div className="label">Finally</div><div className="value" style={{ fontSize: 16 }}>3 &rarr; lease terms</div><div className="sub">start date, rent, renewal frequency</div></div>
      </div>

      {result && (
        <div className="card" style={{ borderColor: '#b7e4c3' }}>
          <h3>Tenancy created</h3>
          <div className="preview-box">
            <div>Tenant: <strong>{result.tenant_name}</strong></div>
            <div>Unit: <strong>{result.unit_number}</strong></div>
            <div>From: <strong>{fmtDate(result.start_date)}</strong></div>
            <div>To: <strong>{fmtDate(result.end_date)}</strong></div>
            <div>Rent: <strong>{ksh(result.monthly_rent)}/mo</strong></div>
            <div>Renews every: <strong>{result.renewal_months} month(s)</strong></div>
          </div>
          <div className="modal-foot" style={{ padding: '14px 0 0', border: 0, background: 'transparent' }}>
            <button className="btn ok" onClick={() => { setResult(null); setOpen(true) }}>Onboard another tenant</button>
            <button className="btn secondary" onClick={() => setResult(null)}>Done</button>
          </div>
        </div>
      )}

      {!result && (
        <div className="card">
          <h3>Onboarding steps</h3>
          <p className="muted small" style={{ marginBottom: 14 }}>
            Onboarding replaces the old “create lease” flow: you pick the house/unit, enter the tenant, the date of
            joining, the lease duration, the initial rent and how often the lease renews. The system creates the tenant,
            lease and marks the unit <span className="badge ok">occupied</span> automatically — and is ready to send
            renewal reminders before the lease expires.
          </p>
          <button className="btn ok" onClick={() => setOpen(true)}>Open onboarding form</button>
        </div>
      )}

      {open && (
        <OnboardingModal
          onClose={() => setOpen(false)}
          onDone={(r) => { setOpen(false); setResult(r) }}
        />
      )}
    </div>
  )
}