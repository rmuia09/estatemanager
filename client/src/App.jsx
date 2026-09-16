import { useEffect, useState } from 'react'
import { api, getToken, setToken } from './api.js'
import Login from './pages/Login.jsx'
import Account from './pages/Account.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Properties from './pages/Properties.jsx'
import Units from './pages/Units.jsx'
import Tenants from './pages/Tenants.jsx'
import Onboarding from './pages/Onboarding.jsx'
import Payments from './pages/Payments.jsx'
import Reports from './pages/Reports.jsx'
import Renewals from './pages/Renewals.jsx'
import Utilities from './pages/Utilities.jsx'
import Notifications from './pages/Notifications.jsx'
import Activity from './pages/Activity.jsx'
import Settings from './pages/Settings.jsx'
import Users from './pages/Users.jsx'

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'properties', label: 'Properties', icon: '🏘️' },
  { id: 'units', label: 'Units', icon: '🏠' },
  { id: 'tenants', label: 'Tenants', icon: '👥' },
  { id: 'onboarding', label: 'Onboarding', icon: '🚪' },
  { id: 'payments', label: 'Rent Payments', icon: '💰' },
  { id: 'reports', label: 'Reports', icon: '📈' },
  { id: 'renewals', label: 'Lease Renewals', icon: '📅' },
  { id: 'utilities', label: 'Utilities', icon: '💧' },
  { id: 'notifications', label: 'Notifications', icon: '🔔' },
  { id: 'activity', label: 'Activity', icon: '🧾' },
  { id: 'settings', label: 'Settings', icon: '⚙️' }
]

export default function App() {
  const [tab, setTab] = useState('dashboard')
  const [user, setUser] = useState(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const token = getToken()
    if (!token) { setChecking(false); return }
    api.get('/api/auth/me')
      .then(setUser)
      .catch(() => setToken(null))
      .finally(() => setChecking(false))
  }, [])

  function logout() {
    api.post('/api/auth/logout').catch(() => {})
    setToken(null)
    setUser(null)
    setTab('dashboard')
  }

  if (checking) {
    return <div className="login-wrap"><p className="loading">Loading…</p></div>
  }

  if (!user) {
    return <Login onLogin={(u) => { setUser(u); setTab('dashboard') }} />
  }

  const isAdmin = user.role === 'admin'
  const tabs = isAdmin ? [...TABS, { id: 'users', label: 'Users', icon: '🔐' }] : TABS
  const initials = (user.full_name || user.username || 'U').split(' ').map((s) => s[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo">🏢</div>
          <div>
            <h1>Estate Manager</h1>
            <p>Rentals, leases &amp; utilities</p>
          </div>
        </div>

        <nav>
          {tabs.map((t) => (
            <button key={t.id} className={tab === t.id ? 'nav-item active' : 'nav-item'} onClick={() => setTab(t.id)}>
              <span className="nav-icon">{t.icon}</span> {t.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-user">
          <div className="user-chip">
            <div className="avatar">{initials}</div>
            <div className="user-text">
              <strong>{user.full_name || user.username}</strong>
              <span className={`badge ${isAdmin ? 'ok' : 'neutral'}`}>{user.role}</span>
            </div>
          </div>
          <div className="user-actions">
            <button className="btn small secondary" onClick={() => setTab('account')}>Change password</button>
            <button className="btn small danger" onClick={logout}>Logout</button>
          </div>
        </div>
      </aside>

      <main className="main">
        {tab === 'dashboard' && <Dashboard onNavigate={setTab} user={user} />}
        {tab === 'account' && <Account user={user} onLogout={logout} />}
        {tab === 'properties' && <Properties />}
        {tab === 'units' && <Units />}
        {tab === 'tenants' && <Tenants />}
        {tab === 'onboarding' && <Onboarding />}
        {tab === 'payments' && <Payments />}
        {tab === 'reports' && <Reports />}
        {tab === 'renewals' && <Renewals />}
        {tab === 'utilities' && <Utilities />}
        {tab === 'notifications' && <Notifications />}
        {tab === 'activity' && <Activity />}
        {tab === 'settings' && <Settings />}
        {tab === 'users' && isAdmin && <Users />}
      </main>
    </div>
  )
}