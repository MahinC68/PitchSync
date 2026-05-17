import { Link } from 'react-router-dom'
import styles from './ForgotPassword.module.css'
import logo from '../../icons/PitchSync-new-gold.png'

function SoccerPitch() {
  return (
    <svg
      className={styles.pitchSvg}
      viewBox="0 0 1200 680"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <g stroke="#b4975a" strokeWidth="1.5">
        <rect x="2" y="2" width="1196" height="676" />
        <line x1="600" y1="2" x2="600" y2="678" />
        <circle cx="600" cy="340" r="91" />
        <circle cx="600" cy="340" r="4" fill="#b4975a" stroke="none" />

        <rect x="2" y="140" width="181" height="400" />
        <rect x="2" y="249" width="63" height="182" />
        <circle cx="127" cy="340" r="4" fill="#b4975a" stroke="none" />
        <path d="M 183,270 A 90,90 0 0,1 183,411" />

        <rect x="1017" y="140" width="181" height="400" />
        <rect x="1135" y="249" width="63" height="182" />
        <circle cx="1073" cy="340" r="4" fill="#b4975a" stroke="none" />
        <path d="M 1017,270 A 90,90 0 0,0 1017,411" />

        <path d="M 13,2   A 11,11 0 0,1 2,13" />
        <path d="M 1187,2 A 11,11 0 0,0 1198,13" />
        <path d="M 1198,667 A 11,11 0 0,0 1187,678" />
        <path d="M 2,667   A 11,11 0 0,1 13,678" />
      </g>
    </svg>
  )
}

export default function ForgotPassword() {
  return (
    <div className={styles.root}>

      <nav className={styles.nav}>
        <Link to="/" className={styles.logoLink}>
          <img src={logo} alt="PitchSync" className={styles.logo} />
        </Link>
      </nav>

      <main className={styles.page}>
        <div className={styles.pitchClip}>
          <SoccerPitch />
        </div>

        <div className={styles.card}>

          <div className={styles.cardHeader}>
            <div className={styles.eyebrow}>
              <span className={styles.eyebrowLine} />
              <span className={styles.eyebrowLabel}>PitchSync</span>
            </div>
            <h1 className={styles.cardTitle}>Reset Password</h1>
            <p className={styles.cardSubtitle}>
              Enter your email and we'll send you a reset link
            </p>
          </div>

          <form className={styles.form} onSubmit={e => e.preventDefault()}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                className={styles.input}
                placeholder="admin@example.com"
                autoComplete="email"
              />
            </div>
            <button type="submit" className={styles.btnSubmit}>
              Send Reset Link
            </button>
          </form>

          <Link to="/login" className={styles.backLink}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M8 6H4M6 3.5L4 6l2 2.5"
                stroke="currentColor" strokeWidth="1.1" strokeLinecap="square" />
            </svg>
            Back to login
          </Link>

        </div>
      </main>

    </div>
  )
}
