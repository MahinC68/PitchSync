import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import styles from './Login.module.css'
import logo from '../../icons/PitchSync-new-gold.png'
import { register, saveSession } from '../api'

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

export default function Register() {
  const navigate = useNavigate()

  const [email,      setEmail]      = useState('')
  const [password,   setPassword]   = useState('')
  const [leagueName, setLeagueName] = useState('')
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const { token, league } = await register(email, password, leagueName)
      saveSession({ role: 'admin', token, LeagueId: league.id, LeagueName: league.name })
      navigate('/standings')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

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
            <h1 className={styles.cardTitle}>Create Account</h1>
          </div>

          {error && (
            <p style={{ color: '#c06060', fontSize: '0.75rem', margin: '-16px 0 8px', lineHeight: 1.4 }}>
              {error}
            </p>
          )}

          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                className={styles.input}
                placeholder="admin@example.com"
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                className={styles.input}
                placeholder="••••••••"
                autoComplete="new-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="leagueName">League Name</label>
              <input
                id="leagueName"
                type="text"
                className={styles.input}
                placeholder="e.g. Sunday 5-a-side"
                autoComplete="off"
                value={leagueName}
                onChange={e => setLeagueName(e.target.value)}
              />
            </div>
            <button type="submit" className={styles.btnSubmit} disabled={loading}>
              {loading ? 'Creating…' : 'Create Account'}
            </button>
            <p style={{ margin: 0, textAlign: 'center', fontSize: '0.5625rem', color: 'var(--color-text-subtle)', letterSpacing: '0.1em' }}>
              Already have an account?{' '}
              <Link to="/login?tab=admin" className={styles.forgotLink} style={{ opacity: 1 }}>Login</Link>
            </p>
          </form>

        </div>
      </main>

    </div>
  )
}
