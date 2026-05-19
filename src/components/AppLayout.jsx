import { NavLink, useNavigate } from 'react-router-dom'
import styles from './AppLayout.module.css'
import logo from '../../icons/PitchSync-new-gold.png'
import { getSession, clearSession } from '../api'

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
  const session  = getSession()
  const isAdmin  = session?.role === 'admin'

  function handleLogout() {
    clearSession()
    navigate('/')
  }

  const visibleNav = NAV_ITEMS.filter(item => !item.adminOnly || isAdmin)

  return (
    <div className={styles.shell}>

      <aside className={styles.sidebar}>
        <div className={styles.sideTop}>
          <img src={logo} alt="PitchSync" className={styles.sideLogo} />
        </div>

        <nav className={styles.sideNav}>
          {visibleNav.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
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
        {children}
      </main>

    </div>
  )
}
