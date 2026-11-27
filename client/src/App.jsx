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
import Leads from './pages/Leads.jsx'
import Onboarding from './pages/Onboarding.jsx'
import Payments from './pages/Payments.jsx'
import Reports from './pages/Reports.jsx'
import Renewals from './pages/Renewals.jsx'
import Utilities from './pages/Utilities.jsx'
import Notifications from './pages/Notifications.jsx'
import Activity from './pages/Activity.jsx'
import Alerts from './pages/Alerts.jsx'
import Settings from './pages/Settings.jsx'
import Users from './pages/Users.jsx'
import Visitors from './pages/Visitors.jsx'
import YaneMark from './components/YaneMark.jsx'
import { identifyForUser, trackScreen } from './analytics.js'

const NAV_GROUPS = [
  {
    label: null,
    items: [{ id: 'dashboard', label: 'Dashboard', icon: '📊' }],
  },
  {
    label: 'Portfolio',
    items: [
      { id: 'properties', label: 'Properties', icon: '🏘️' },
      { id: 'units', label: 'Units', icon: '🏠' },
    ],
  },
  {
    label: 'People',
    items: [
      { id: 'tenants', label: 'Tenants', icon: '👥' },
      { id: 'leads', label: 'Leads', icon: '🎯' },
      { id: 'onboarding', label: 'Onboarding', icon: '🚪' },
    ],
  },
  {
    label: 'Money',
    items: [
      { id: 'payments', label: 'Rent Payments', icon: '💰' },
      { id: 'utilities', label: 'Utilities', icon: '💧' },
      { id: 'reports', label: 'Reports', icon: '📈' },
    ],
  },
  {
    label: 'Activity',
    items: [
      { id: 'renewals', label: 'Renewals', icon: '📅' },
      { id: 'alerts', label: 'Alerts', icon: '🔔' },
    ],
  },
  {
    label: 'System',
    items: [{ id: 'settings', label: 'Settings', icon: '⚙️' }],
  },
]

const ADMIN_GROUP = {
  label: 'Admin',
  items: [
    { id: 'users', label: 'Users', icon: '🔐' },
    { id: 'visitors', label: 'Visitors', icon: '👀' },
  ],
}

const SHORTCUT_IDS = ['dashboard', 'properties', 'units', 'tenants', 'renewals', 'reports']
const SHORTCUTS = NAV_GROUPS.flatMap((g) => g.items).filter((t) => SHORTCUT_IDS.includes(t.id))

const ALL_TAB_IDS = [...NAV_GROUPS, ADMIN_GROUP].flatMap((g) => g.items).map((t) => t.id).concat('account')
const IDLE_TIMEOUT_MS = 30 * 60 * 1000

export default function App() {
  const [tab, setTab] = useState('dashboard')
  const [user, setUser] = useState(null)
  const [checking, setChecking] = useState(true)
  const [navHistory, setNavHistory] = useState([])

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
    setNavHistory([])
    setTab('dashboard')
    try { sessionStorage.removeItem('estate:last-tab') } catch {}
  }

  function navigate(next) {
    if (next === tab) return
    trackScreen(next, tab)
    setNavHistory((h) => [...h.slice(-9), tab])
    setTab(next)
    try { sessionStorage.setItem('estate:last-tab', next) } catch {}
  }

  function goBack() {
    const prev = navHistory[navHistory.length - 1] || 'dashboard'
    setNavHistory((h) => h.slice(0, -1))
    setTab(prev)
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
    const onUnauthorized = () => { setUser(null) }
    window.addEventListener('estate:unauthorized', onUnauthorized)
    return () => window.removeEventListener('estate:unauthorized', onUnauthorized)
  }, [])

  if (checking) {
    return <div className="login-wrap"><p className="loading">Loading…</p></div>
  }

  if (!user) {
    return <Login onLogin={(u) => {
      setUser(u)
      let stamp = ''
      try { stamp = document.cookie.split(';').map((c) => c.trim()).find((c) => c.startsWith('yane_did='))?.slice(9) || '' } catch {}
      identifyForUser(u, stamp)
      trackScreen('dashboard', 'login')
      let last = null
      try { last = sessionStorage.getItem('estate:last-tab') } catch {}
      setTab(ALL_TAB_IDS.includes(last) ? last : 'dashboard')
    }} />
  }

  const isAdmin = user.role === 'admin'
  const groups = isAdmin ? [...NAV_GROUPS, ADMIN_GROUP] : NAV_GROUPS
  const initials = (user.full_name || user.username || 'U').split(' ').map((s) => s[0]).join('').slice(0, 2).toUpperCase()
  const current = groups.flatMap((g) => g.items).find((t) => t.id === tab)
  const onDashboard = tab === 'dashboard'

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
          <YaneMark size={46} />
          <div>
            <h1>yane</h1>
            <p>Rent, reconciled.</p>
          </div>
        </div>

        <nav>
          {groups.map((group) => (
            <div className="nav-group" key={group.label || 'main'}>
              {group.label && <div className="nav-group-label">{group.label}</div>}
              {group.items.map((t) => (
                <motion.button
                  key={t.id}
                  className={tab === t.id ? 'nav-item active' : 'nav-item'}
                  onClick={() => navigate(t.id)}
                  whileHover={{ background: 'rgba(255,255,255,0.12)' }}
                >
                  <span className="nav-icon">{t.icon}</span> {t.label}
                </motion.button>
              ))}
            </div>
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
            <button className="btn small secondary" onClick={() => navigate('account')}>Change password</button>
            <button className="btn small logout-btn" onClick={logout}>⏻ Logout</button>
          </div>
        </div>
      </motion.aside>

      <main className="main">
        <div className="mobile-topbar">
          <button className="mobile-back" onClick={goBack} disabled={onDashboard} aria-label="Back">←</button>
          <strong>{onDashboard ? 'yane' : current?.label || 'yane'}</strong>
          <button className="mobile-logout" onClick={logout}>Exit</button>
        </div>
        <AnimatePresence mode="wait">
          {tab === 'dashboard' && <Page id="dashboard"><Dashboard onNavigate={navigate} user={user} /></Page>}
          {tab === 'account' && <Page id="account"><Account user={user} onLogout={logout} /></Page>}
          {tab === 'properties' && <Page id="properties"><Properties /></Page>}
          {tab === 'units' && <Page id="units"><Units /></Page>}
          {tab === 'tenants' && <Page id="tenants"><Tenants /></Page>}
          {tab === 'leads' && <Page id="leads"><Leads /></Page>}
          {tab === 'onboarding' && <Page id="onboarding"><Onboarding /></Page>}
          {tab === 'payments' && <Page id="payments"><Payments /></Page>}
          {tab === 'reports' && <Page id="reports"><Reports /></Page>}
          {tab === 'renewals' && <Page id="renewals"><Renewals /></Page>}
          {tab === 'utilities' && <Page id="utilities"><Utilities /></Page>}
          {tab === 'alerts' && <Page id="alerts"><Alerts /></Page>}
          {tab === 'settings' && <Page id="settings"><Settings /></Page>}
          {tab === 'users' && isAdmin && <Page id="users"><Users /></Page>}
          {tab === 'visitors' && isAdmin && <Page id="visitors"><Visitors /></Page>}
        </AnimatePresence>
        <div className="shortcut-bar" aria-label="Quick navigation">
          {SHORTCUTS.map((t) => (
            <button key={t.id} className={tab === t.id ? 'shortcut active' : 'shortcut'} onClick={() => navigate(t.id)} title={t.label}>
              <span className="shortcut-icon">{t.icon}</span>
              <span className="shortcut-label">{t.label}</span>
            </button>
          ))}
        </div>
      </main>
    </div>
  )
}