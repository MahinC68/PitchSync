import { Link } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import styles from './Settings.module.css'

const CARDS = [
  {
    to: '/settings/teams',
    title: 'Manage Teams',
    subtitle: 'Add, rename, or remove teams from the league',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <rect x="1" y="7" width="18" height="12" stroke="currentColor" strokeWidth="1.2" />
        <path d="M6 7V5a4 4 0 0 1 8 0v2" stroke="currentColor" strokeWidth="1.2" />
        <line x1="1" y1="12" x2="19" y2="12" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    ),
  },
  {
    to: '/settings/players',
    title: 'Manage Players',
    subtitle: 'Add or remove players and assign them to teams',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <circle cx="10" cy="6" r="4" stroke="currentColor" strokeWidth="1.2" />
        <path d="M2 19c0-4.418 3.582-8 8-8s8 3.582 8 8"
          stroke="currentColor" strokeWidth="1.2" strokeLinecap="square" />
      </svg>
    ),
  },
]

export default function Settings() {
  return (
    <AppLayout>
      <div className={styles.page}>

        <div className={styles.pageHead}>
          <h1 className={styles.pageTitle}>Settings</h1>
          <p className={styles.pageSubtitle}>Manage your league</p>
        </div>

        <div className={styles.cards}>
          {CARDS.map(({ to, title, subtitle, icon }) => (
            <Link key={to} to={to} className={styles.card}>
              <span className={styles.cardIcon}>{icon}</span>
              <span className={styles.cardBody}>
                <span className={styles.cardTitle}>{title}</span>
                <span className={styles.cardSub}>{subtitle}</span>
              </span>
              <span className={styles.cardArrow}>
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                  <path d="M3 6.5h7M7 3.5l3 3-3 3"
                    stroke="currentColor" strokeWidth="1.2" strokeLinecap="square" />
                </svg>
              </span>
            </Link>
          ))}
        </div>

      </div>
    </AppLayout>
  )
}
