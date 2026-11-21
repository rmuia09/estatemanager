import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { api, getToken, setToken } from './api.js'
import { design } from './design-system.js'
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
import Visitors from './pages/Visitors.jsx'

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

const IDLE_TIMEOUT_MS = 3 * 60 * 1000

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

  const idleRef = useRef(null)

  useEffect(() => {
    if (!user) return
    const lastActive = { at: Date.now() }
    const logoutIfIdle = () => {
      if (Date.now() - lastActive.at >= IDLE_TIMEOUT_MS) logout()
    }
    const reset = () => {
      lastActive.at = Date.now()
      clearTimeout(idleRef.current)
      idleRef.current = setTimeout(logout, IDLE_TIMEOUT_MS)
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') logoutIfIdle()
    }
    const events = ['pointerdown', 'pointermove', 'keydown', 'touchstart', 'scroll', 'wheel']
    events.forEach((e) => window.addEventListener(e, reset))
    document.addEventListener('visibilitychange', onVisible)
    reset()
    return () => {
      clearTimeout(idleRef.current)
      events.forEach((e) => window.removeEventListener(e, reset))
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [user])

  useEffect(() => {
    const onUnauthorized = () => { setUser(null); setTab('dashboard') }
    window.addEventListener('estate:unauthorized', onUnauthorized)
    return () => window.removeEventListener('estate:unauthorized', onUnauthorized)
  }, [])

  if (checking) {
    return <div className="login-wrap"><p className="loading">Loading…</p></div>
  }

  if (!user) {
    return <Login onLogin={(u) => { setUser(u); setTab('dashboard') }} />
  }

  const isAdmin = user.role === 'admin'
  const tabs = isAdmin ? [...TABS, { id: 'users', label: 'Users', icon: '🔐' }, { id: 'visitors', label: 'Visitors', icon: '👀' }] : TABS
  const initials = (user.full_name || user.username || 'U').split(' ').map((s) => s[0]).join('').slice(0, 2).toUpperCase()

  function Page({ id, children }) {
    return (
      <motion.div
        key={id}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
        transition={{ duration: 0.3, ease: design.motion.easings.smooth }}
      >
        {children}
      </motion.div>
    )
  }

  return (
    <div className="app">
      <motion.aside
        className="sidebar"
        initial={{ opacity: 0, x: -14 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, ease: design.motion.easings.smooth }}
      >
        <div className="brand">
          <div className="brand-logo">🏢</div>
          <div>
            <h1>Estate Manager</h1>
            <p>Rentals, leases &amp; utilities</p>
          </div>
        </div>

        <nav>
          {tabs.map((t) => (
            <motion.button
              key={t.id}
              className={tab === t.id ? 'nav-item active' : 'nav-item'}
              onClick={() => setTab(t.id)}
              whileHover={{ background: 'rgba(255,255,255,0.12)' }}
            >
              <span className="nav-icon">{t.icon}</span> {t.label}
            </motion.button>
          ))}
          <button className="nav-item tab-logout" onClick={logout} title="Log out">
            <span className="nav-icon">⏻</span> Logout
          </button>
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
            <button className="btn small logout-btn" onClick={logout}>⏻ Logout</button>
          </div>
        </div>
      </motion.aside>

      <main className="main">
        <AnimatePresence mode="wait">
          {tab === 'dashboard' && <Page id="dashboard"><Dashboard onNavigate={setTab} user={user} /></Page>}
          {tab === 'account' && <Page id="account"><Account user={user} onLogout={logout} /></Page>}
          {tab === 'properties' && <Page id="properties"><Properties /></Page>}
          {tab === 'units' && <Page id="units"><Units /></Page>}
          {tab === 'tenants' && <Page id="tenants"><Tenants /></Page>}
          {tab === 'onboarding' && <Page id="onboarding"><Onboarding /></Page>}
          {tab === 'payments' && <Page id="payments"><Payments /></Page>}
          {tab === 'reports' && <Page id="reports"><Reports /></Page>}
          {tab === 'renewals' && <Page id="renewals"><Renewals /></Page>}
          {tab === 'utilities' && <Page id="utilities"><Utilities /></Page>}
          {tab === 'notifications' && <Page id="notifications"><Notifications /></Page>}
          {tab === 'activity' && <Page id="activity"><Activity /></Page>}
          {tab === 'settings' && <Page id="settings"><Settings /></Page>}
          {tab === 'users' && isAdmin && <Page id="users"><Users /></Page>}
          {tab === 'visitors' && isAdmin && <Page id="visitors"><Visitors /></Page>}
        </AnimatePresence>
      </main>
    </div>
  )
}