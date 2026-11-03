import { useEffect, useState } from 'react'
import { useSession, setActiveLeague } from '../session'
import { LeagueContext } from './LeagueContext'
import LeagueSwitcher from './LeagueSwitcher'
import LeagueModal from './LeagueModal'
import { NavLink, Navigate, Outlet, useNavigate, useLocation } from 'react-router-dom'
import styles from './AppLayout.module.css'
import logo from '../../icons/PitchSync-new-gold.png'
import { clearSession, getLeagues, getOwnedLeague, createLeague, renameLeague } from '../api'

const NAV_ITEMS = [
  {
    to: '/standings',
    label: 'Standings',
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
        <rect x="1" y="8"  width="3" height="6" fill="currentColor" fillOpacity="0.9" />
        <rect x="6" y="5"  width="3" height="9" fill="currentColor" fillOpacity="0.7" />
        <rect x="11" y="2" width="3" height="12" fill="currentColor" fillOpacity="0.5" />
      </svg>
    ),
  },
  {
    to: '/schedule',
    label: 'Schedule',
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
        <rect x="1" y="3" width="13" height="11" stroke="currentColor" strokeWidth="1" />
        <line x1="1" y1="7" x2="14" y2="7" stroke="currentColor" strokeWidth="1" />
        <line x1="5" y1="1" x2="5" y2="4"  stroke="currentColor" strokeWidth="1" />
        <line x1="10" y1="1" x2="10" y2="4" stroke="currentColor" strokeWidth="1" />
      </svg>
    ),
  },
  {
    to: '/players',
    label: 'Players',
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
        <circle cx="7.5" cy="5" r="3" stroke="currentColor" strokeWidth="1" />
        <path d="M1.5 14.5c0-3.314 2.686-6 6-6s6 2.686 6 6"
          stroke="currentColor" strokeWidth="1" strokeLinecap="square" />
      </svg>
    ),
  },
  {
    to: '/settings',
    label: 'Settings',
    adminOnly: true,
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
        <line x1="1" y1="4"  x2="14" y2="4"  stroke="currentColor" strokeWidth="1" />
        <line x1="1" y1="11" x2="14" y2="11" stroke="currentColor" strokeWidth="1" />
        <circle cx="5"  cy="4"  r="1.5" stroke="currentColor" strokeWidth="1" />
        <circle cx="10" cy="11" r="1.5" stroke="currentColor" strokeWidth="1" />
      </svg>
    ),
  },
]

export default function AppLayout({ children }) {
  const navigate = useNavigate()
  const session = useSession()
  const location = useLocation()
  const [leagues, setLeagues] = useState([])
  const [ready, setReady] = useState(false)
  const [switching, setSwitching] = useState(false)
  const [leagueError, setLeagueError] = useState('')
  const [dialog, setDialog] = useState(null)
  const [reload, setReload] = useState(0)
  const isAdmin  = session?.role === 'admin'

  useEffect(() => {
    let live = true
    if (session?.role !== 'admin') { setReady(true); return }
    setReady(false); setLeagueError('')
    getLeagues().then(owned => {
      if (!live) return
      setLeagues(owned)
      const active = owned.find(league => league.id === session.leagueId) || owned[0]
      setActiveLeague(active)
      setReady(true)
    }).catch(error => { if (live) setLeagueError(error.message) })
    return () => { live = false }
  }, [session?.token, session?.role, reload])

  function modalConfig(league, event) {
    const trigger = event?.currentTarget
    const rect = trigger?.getBoundingClientRect()
    setDialog({ league, trigger, origin: rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, width: rect.width } : null })
  }
  async function switchLeague(id) {
    if (id === session.leagueId || switching) return
    setSwitching(true); setLeagueError('')
    try {
      const owned = await getOwnedLeague(id)
      setActiveLeague(owned)
    } catch (error) { setLeagueError(error.message) }
    finally { setSwitching(false) }
  }
  async function saveLeague(name) {
    if (dialog.league) {
      const updated = await renameLeague(dialog.league.id, name)
      setLeagues(current => current.map(league => league.id === updated.id ? updated : league))
      if (updated.id === session.leagueId) setActiveLeague(updated)
    } else {
      const created = await createLeague(name)
      setLeagues(current => [...current, created])
      setActiveLeague(created)
    }
  }
  const leagueContext = { leagues, activeId: session?.leagueId, switching,
    switchLeague, openCreate: event => modalConfig(null, event), openRename: (league, event) => modalConfig(league, event) }


  function handleLogout() {
    clearSession()
    navigate('/')
  }

  const visibleNav = NAV_ITEMS.filter(item => !item.adminOnly || isAdmin)

  if (!session) return <Navigate to="/login" replace />
  if (!isAdmin && location.pathname.startsWith('/settings')) return <Navigate to="/standings" replace />

  return (
    <LeagueContext.Provider value={leagueContext}>
    <div className={styles.shell}>

      <aside className={styles.sidebar}>
        <div className={styles.sideTop}>
          <img src={logo} alt="PitchSync" className={styles.sideLogo} />
        </div>

        <div className={styles.leagueIdentity}>
          <span className={styles.workspaceLabel}>Your league</span>
          {isAdmin ? <LeagueSwitcher /> : <strong>{session.leagueName || 'League dashboard'}</strong>}
          <span className={styles.roleBadge}>{isAdmin ? 'Admin workspace' : 'Player workspace'}</span>
        </div>
        <nav className={styles.sideNav} aria-label="Main navigation">
          {visibleNav.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              viewTransition
              className={({ isActive }) =>
                `${styles.navItem} ${isActive ? styles.navItemActive : ''}`
              }
            >
              <span className={styles.navIcon}>{icon}</span>
              <span className={styles.navLabel}>{label}</span>
            </NavLink>
          ))}
        </nav>

        <button
          onClick={handleLogout}
          className={styles.navItem}
          style={{ background: 'transparent', border: '1px solid transparent', cursor: 'pointer', width: '100%', textAlign: 'left' }}
        >
          <span className={styles.navIcon}>
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
              <path d="M6 2H2v11h4M10 10l3-3-3-3M13 7H6" stroke="currentColor" strokeWidth="1" strokeLinecap="square" />
            </svg>
          </span>
          <span className={styles.navLabel}>Logout</span>
        </button>
      </aside>

      <main className={styles.content}>
        {leagueError && <div className={styles.leagueNotice} role="alert">{leagueError}{!ready && <button onClick={() => setReload(value => value + 1)}>Retry</button>}</div>}
        {isAdmin && (!ready || switching) ? <p className={styles.leagueLoading}>{switching ? 'Switching league…' : 'Loading your leagues…'}</p> :
          isAdmin && !leagues.length ? <div className={styles.leagueLoading}><h1>Create your first league</h1><button onClick={event => modalConfig(null, event)}>+ Create league</button></div> :
          <div key={`${session.role}:${session.leagueId}`}>{children || <Outlet />}</div>}

      </main>

    </div>
    {dialog && <LeagueModal config={dialog} onClose={() => setDialog(null)} onSubmit={saveLeague} />}
    </LeagueContext.Provider>
  )
}
